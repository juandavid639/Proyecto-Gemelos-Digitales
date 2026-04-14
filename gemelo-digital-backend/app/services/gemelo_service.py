from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.config_loader import load_course_bundle
from app.domain.rubric_quality import detect_rubric_inconsistency


# =========================================================
# Helpers generales
# =========================================================

def _is_graded_value(v: Dict[str, Any]) -> bool:
    """
    Define si un grade value cuenta como 'calificado' para cobertura.
    - Si hay PointsDenominator > 0, se considera calificado.
    - Fallback a señales de publicación (DisplayedGrade o LastModified).
    - Nunca contar dict vacío {} como calificado.
    """
    if not isinstance(v, dict) or not v:
        return False

    pn = v.get("PointsNumerator")
    pd = v.get("PointsDenominator")

    if pn is not None and pd is not None:
        try:
            return float(pd) > 0
        except Exception:
            return False

    # Fallback: WeightedNumerator/WeightedDenominator también indica calificado
    wn = v.get("WeightedNumerator")
    wd = v.get("WeightedDenominator")
    if wn is not None and wd is not None:
        try:
            return float(wd) > 0
        except Exception:
            return False

    return bool(v.get("DisplayedGrade") or v.get("LastModified"))

def _strip_html(text: Any) -> str:
    s = str(text or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# Regex to detect "Corte" / summary columns that aggregate other grades.
# These must be displayed but NOT counted in weighted averages.
# Matches: "Corte 1", "C1", "Cohorte 1", "1 Corte", "Primer Corte",
#          "Corte N°1", "Corte Nº 1", "Corte I/II/III"
_CORTE_REGEX = re.compile(
    r"(?:^|\s|_|-)"                                   # word boundary-ish
    r"(?:"
    r"c(?:ohor?te|orte)?\s*(?:n[°º]?\s*)?([123]|i{1,3})"   # "Corte 1/2/3", "C1", "Cohorte 1", "Corte I/II/III"
    r"|"
    r"(primer|segund[oa]|tercer)\s+(?:cohor?te|corte)"     # "Primer/Segundo/Tercer Corte"
    r"|"
    r"([123])(?:er|do|ro)?\s+(?:cohor?te|corte)"          # "1er Corte", "2do Corte", "3 Corte"
    r")"
    r"(?:\s|$|:|_|-)",
    re.IGNORECASE,
)


def _is_corte_item(name: Any) -> bool:
    """Detect if a grade item name matches a 'Corte' / summary pattern.
    These are aggregated totals that should be shown but not counted in
    weighted averages (they'd double-count).
    Examples that match:
      - "Corte 1", "Corte 2", "Corte 3"
      - "C1", "C2", "C3"
      - "Cohorte 1", "Cohorte 2"
      - "1 Corte", "2 Corte", "3 Corte", "1er Corte", "2do Corte"
      - "Primer Corte", "Segundo Corte", "Tercer Corte"
      - "Corte I", "Corte II", "Corte III"
    """
    s = _strip_html(name)
    if not s:
        return False
    return bool(_CORTE_REGEX.search(s))


def _extract_corte_period(name: Any) -> Optional[int]:
    """Extract the numeric period (1, 2, 3) from a Corte item name.
    Returns None if not a Corte item."""
    s = _strip_html(name)
    if not s:
        return None
    m = _CORTE_REGEX.search(s)
    if not m:
        return None
    # Group 1: numeric or roman (1, 2, 3, I, II, III)
    # Group 2: spanish ordinal word (primer, segundo, tercero)
    # Group 3: digit prefix (1er, 2do, etc.)
    g1, g2, g3 = m.group(1), m.group(2), m.group(3)
    if g1:
        g1 = g1.lower()
        if g1 == "i":
            return 1
        if g1 == "ii":
            return 2
        if g1 == "iii":
            return 3
        try:
            return int(g1)
        except Exception:
            return None
    if g2:
        g2 = g2.lower()
        if g2.startswith("primer"):
            return 1
        if g2.startswith("segund"):
            return 2
        if g2.startswith("tercer"):
            return 3
    if g3:
        try:
            return int(g3)
        except Exception:
            return None
    return None


def _looks_like_not_submitted(comment_html: Any) -> bool:
    txt = _strip_html(comment_html).lower()
    if not txt:
        return False

    patterns = [
        "no entrego",
        "no entregó",
        "sin entrega",
        "no presentó",
        "no presento",
        "not submitted",
        "missing submission",
        "did not submit",
        "no submission",
    ]
    return any(p in txt for p in patterns)


def _is_grade_zero(points_num: Any, displayed: Any) -> bool:
    try:
        if points_num is not None and float(points_num) == 0.0:
            return True
    except Exception:
        pass

    disp = str(displayed or "").strip().lower()
    return disp in {"0%", "0.0%", "0"}

def _parse_iso_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None
    
def _as_items_list(classlist_resp: Any) -> List[Dict[str, Any]]:
    """Normaliza la respuesta de classlist a una lista de dicts."""
    if classlist_resp is None:
        return []
    if isinstance(classlist_resp, list):
        return [x for x in classlist_resp if isinstance(x, dict)]
    if isinstance(classlist_resp, dict):
        items = classlist_resp.get("items") or classlist_resp.get("Items") or []
        return [x for x in items if isinstance(x, dict)]
    return []


def _num(x: Any, default: float = 0.0) -> float:
    try:
        if x is None:
            return float(default)
        return float(x)
    except Exception:
        return float(default)


def status_from_pct(pct: Any, thresholds: Dict[str, float]) -> str:
    """
    pct puede venir None cuando no hay evidencia/calificación consolidada.
    En ese caso devolvemos 'pending'.
    """
    try:
        if pct is None:
            return "pending"
        p = float(pct)
    except Exception:
        return "pending"

    if p < float(thresholds.get("critical", 50.0)):
        return "critico"
    if p < float(thresholds.get("watch", 70.0)):
        return "observacion"
    return "solido"


def weighted_avg(items: List[Tuple[float, float]]) -> float:
    den = sum(w for _, w in items) or 0.0
    if den == 0:
        return 0.0
    return sum(p * w for p, w in items) / den


def _as_dict(obj: Any) -> Dict[str, Any]:
    """
    Convierte Pydantic/dataclass/obj a dict de forma defensiva.
    Cubre: None, Ellipsis, primitivos, Pydantic v1/v2, objetos con __dict__.
    """
    if obj is None or obj is ...:
        return {}

    if isinstance(obj, dict):
        return {k: v for k, v in obj.items() if v is not ...}

    if isinstance(obj, (str, int, float, bool, list, tuple, set)):
        return {}

    if hasattr(obj, "model_dump"):
        try:
            result = obj.model_dump()
            if isinstance(result, dict):
                return {k: v for k, v in result.items() if v is not ...}
        except Exception:
            pass

    if hasattr(obj, "dict"):
        try:
            result = obj.dict()
            if isinstance(result, dict):
                return {k: v for k, v in result.items() if v is not ...}
        except Exception:
            pass

    try:
        return {
            k: v for k, v in vars(obj).items()
            if not k.startswith("_") and v is not ...
        }
    except TypeError:
        return {}


def _get_thresholds(course_cfg: Any, legacy_cfg: Any) -> Dict[str, float]:
    defaults = {"critical": 50.0, "watch": 70.0}

    for cfg in (course_cfg, legacy_cfg):
        if cfg is None or cfg is ...:
            continue

        try:
            scale = getattr(cfg, "scale", None)
            if scale is not None and scale is not ...:
                thr = getattr(scale, "thresholds", None)
                if thr is not None and thr is not ...:
                    result = dict(thr) if not isinstance(thr, dict) else thr
                    if result:
                        return result
        except Exception:
            pass

        try:
            d = _as_dict(cfg)
            sc = d.get("scale")
            if isinstance(sc, dict):
                thr = sc.get("thresholds")
                if isinstance(thr, dict) and thr:
                    return thr
        except Exception:
            pass

    return defaults


def _get_scale_settings(legacy_cfg: Any) -> Tuple[str, float]:
    scale_type = "level_points"
    max_level_points = 4.0

    if legacy_cfg is None or legacy_cfg is ...:
        return scale_type, max_level_points

    try:
        scale = getattr(legacy_cfg, "scale", None)
        if scale is not None and scale is not ...:
            st = getattr(scale, "type", None)
            if st is not None and st is not ...:
                scale_type = str(st)
            mlp = getattr(scale, "maxLevelPoints", None)
            if mlp is not None and mlp is not ...:
                try:
                    max_level_points = float(mlp)
                except Exception:
                    pass
            return scale_type, max_level_points
    except Exception:
        pass

    try:
        d = _as_dict(legacy_cfg)
        sc = d.get("scale", {})
        if isinstance(sc, dict):
            st = sc.get("type")
            if st is not None:
                scale_type = str(st)
            mlp = sc.get("maxLevelPoints")
            if mlp is not None:
                try:
                    max_level_points = float(mlp)
                except Exception:
                    pass
    except Exception:
        pass

    return scale_type, max_level_points

def _text_has_no_submission_signal(text: Any) -> bool:
    s = str(text or "").strip().lower()
    if not s:
        return False

    patterns = [
        "no entrego",
        "no entregó",
        "no presento",
        "no presentó",
        "sin entrega",
        "no submission",
        "not submitted",
        "did not submit",
    ]
    return any(p in s for p in patterns)


# =========================================================
# Macrocompetencias dinámicas (C1, C2, RA1, etc.)
# =========================================================

_MACRO_RE = re.compile(r"^([A-Za-z]+)\.(\d+)(?:\.)?")


def _macro_code_from_unit(code: str) -> Optional[str]:
    m = _MACRO_RE.match(str(code or "").strip())
    if not m:
        return None
    prefix, num = m.group(1), m.group(2)
    return f"{prefix}{num}"


def _get_unit_weight_from_cfg(cfg: Any, unit_code: str) -> float:
    if cfg is None:
        return 1.0

    rubrics = getattr(cfg, "rubrics", None) if not isinstance(cfg, dict) else cfg.get("rubrics")
    if not rubrics or not isinstance(rubrics, dict):
        return 1.0

    for _, r in rubrics.items():
        lu = getattr(r, "learningUnits", None) if not isinstance(r, dict) else r.get("learningUnits")
        if isinstance(lu, dict) and unit_code in lu:
            ud = lu[unit_code]
            try:
                return float(ud.get("weight", 1.0)) if isinstance(ud, dict) else float(getattr(ud, "weight", 1.0))
            except Exception:
                return 1.0

    return 1.0


def build_macro_units(
    units: List[Dict[str, Any]],
    cfg: Any,
    thresholds: Dict[str, float],
) -> List[Dict[str, Any]]:
    acc: Dict[str, List[Tuple[float, float, str]]] = {}

    for u in units:
        child_code = str(u.get("code", "")).strip()
        macro = _macro_code_from_unit(child_code)
        if not macro:
            continue

        w = _get_unit_weight_from_cfg(cfg, child_code)
        pct = _num(u.get("pct", 0.0), 0.0)
        acc.setdefault(macro, []).append((pct, w, child_code))

    out: List[Dict[str, Any]] = []
    for macro_code, rows in acc.items():
        pct_macro = weighted_avg([(p, w) for p, w, _ in rows])
        pct_macro_round = round(pct_macro, 1)
        out.append(
            {
                "code": macro_code,
                "pct": pct_macro_round,
                "status": status_from_pct(pct_macro_round, thresholds),
                "children": [c for _, __, c in rows],
            }
        )

    return sorted(out, key=lambda x: x["code"])


# =========================================================
# Roles / Access control
# =========================================================

def _norm(x: Any) -> str:
    return str(x or "").strip().lower()


def _is_student_role(role_name: str) -> bool:
    r = _norm(role_name)
    return ("estudiante" in r) or ("student" in r) or ("learner" in r)


def _extract_role_name(row: Dict[str, Any]) -> str:
    if not isinstance(row, dict):
        return ""
    for k in ("ClasslistRoleDisplayName", "RoleName", "ClasslistRoleName"):
        v = row.get(k)
        if v:
            return str(v)
    role_obj = row.get("Role")
    if isinstance(role_obj, dict) and role_obj.get("Name"):
        return str(role_obj.get("Name"))
    return ""


def _extract_user_id(row: Any) -> Optional[int]:
    if not isinstance(row, dict):
        return None
    for k in ("Identifier", "UserId", "Id"):
        v = row.get(k)
        if v is None:
            continue
        try:
            return int(v)
        except Exception:
            continue
    return None


def _display_name(row: Dict[str, Any]) -> str:
    dn = row.get("DisplayName")
    if dn:
        return str(dn)
    fn = row.get("FirstName")
    ln = row.get("LastName")
    if fn or ln:
        return f"{fn or ''} {ln or ''}".strip()
    odi = row.get("OrgDefinedId")
    if odi:
        return str(odi)
    uid = _extract_user_id(row)
    return str(uid) if uid is not None else ""


def resolve_access_level(
    classlist_role_name: str,
    lis_roles: Optional[List[str]] = None,
) -> str:
    r = _norm(classlist_role_name)
    lis = [_norm(x) for x in (lis_roles or [])]

    is_admin = ("super administrator" in r) or ("administrator" in r) or any("administrator" in x for x in lis)
    if is_admin:
        return "admin"

    is_teacher = ("instructor" in r) or ("faculty" in r) or any(
        ("instructor" in x) or ("faculty" in x) for x in lis
    )
    if is_teacher:
        return "teacher"

    is_student = (
        ("estudiante" in r) or ("student" in r) or ("learner" in r)
        or any(("learner" in x) or ("student" in x) for x in lis)
    )
    if is_student:
        return "student"

    return "student"


def normalize_view_from_enrollment(enrollment: Dict[str, Any]) -> Dict[str, Any]:
    access = enrollment.get("Access") or {}
    classlist_role = access.get("ClasslistRoleName")
    lis_roles = access.get("LISRoles") or []

    access_level = resolve_access_level(
        str(classlist_role or ""), [str(x) for x in lis_roles]
    )
    view = "teacher" if access_level in ("admin", "teacher") else "student"

    return {
        "accessLevel": access_level,
        "view": view,
        "classlistRoleName": classlist_role,
        "lisRoles": lis_roles,
        "isAdmin": access_level == "admin",
        "isInstructor": access_level == "teacher",
        "isStudent": access_level == "student",
    }


# =========================================================
# Lookups de rúbricas (Brightspace)
# =========================================================

def _lookup_level_points(
    rubric_detail: Dict[str, Any], level_id: Any
) -> Optional[float]:
    if level_id is None:
        return None
    try:
        level_id = int(level_id)
    except Exception:
        return None

    criteria_groups = rubric_detail.get("CriteriaGroups") or []
    if not criteria_groups:
        return None

    levels = criteria_groups[0].get("Levels") or []
    for lv in levels:
        try:
            if int(lv.get("Id")) == level_id:
                pts = lv.get("Points")
                return float(pts) if pts is not None else None
        except Exception:
            continue
    return None


def _lookup_criterion_max_points(
    rubric_detail: Dict[str, Any], criterion_id: Any
) -> Optional[float]:
    if criterion_id is None:
        return None
    try:
        criterion_id = int(criterion_id)
    except Exception:
        return None

    criteria_groups = rubric_detail.get("CriteriaGroups") or []
    if not criteria_groups:
        return None

    criteria = criteria_groups[0].get("Criteria") or []
    for c in criteria:
        try:
            if int(c.get("Id")) == criterion_id:
                pts = [
                    float(cell.get("Points"))
                    for cell in (c.get("Cells") or [])
                    if cell.get("Points") is not None
                ]
                return max(pts) if pts else None
        except Exception:
            continue
    return None


# =========================================================
# Gradebook helpers
# =========================================================

def _parse_due_datetime(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except Exception:
        return None
    
def _is_graded(points_num: Any, points_den: Any) -> bool:
    try:
        return (
            points_num is not None
            and points_den is not None
            and float(points_den) > 0
        )
    except Exception:
        return False


# =========================================================
# Servicio principal: GemeloService
# =========================================================

class GemeloService:
    def __init__(self, brightspace_client):
        self.bs = brightspace_client

    # --------------------------------------------------
    # Students
    # --------------------------------------------------
    async def list_course_students(self, orgUnitId: int) -> Dict[str, Any]:
        fn = getattr(self.bs, "list_classlist", None)
        if not callable(fn):
            raise RuntimeError("brightspace_client no expone list_classlist")

        # Graceful: if classlist is unavailable (403/401/404), return empty
        try:
            data = await fn(orgUnitId)
        except Exception as e:
            msg = str(e)
            if "403" in msg or "401" in msg or "404" in msg:
                import logging
                logging.getLogger(__name__).warning(
                    "list_course_students: classlist unavailable for course %s (%s)",
                    orgUnitId, msg[:120],
                )
                return {"count": 0, "items": [], "roleCounts": {}}
            raise
        items = _as_items_list(data)

        students: List[Dict[str, Any]] = []
        role_counts: Dict[str, int] = {}

        for it in items:
            if not isinstance(it, dict):
                continue

            role = _extract_role_name(it).strip()
            role_counts[role or "unknown"] = role_counts.get(role or "unknown", 0) + 1

            if not _is_student_role(role):
                continue

            uid = _extract_user_id(it)
            if uid is None:
                continue

            # Extract email from classlist entry — try every common field name
            # CESA frequently puts the email in OrgDefinedId or UserName too.
            user_obj = it.get("User") if isinstance(it.get("User"), dict) else {}
            def _pick_email(*objs):
                for o in objs:
                    if not isinstance(o, dict):
                        continue
                    for k in ("EmailAddress", "emailAddress", "Email", "email",
                              "UserName", "userName", "OrgDefinedId", "orgDefinedId"):
                        v = o.get(k)
                        if v and isinstance(v, str) and "@" in v:
                            return v.strip()
                return None
            email = _pick_email(user_obj, it)

            students.append(
                {
                    "userId": uid,
                    "displayName": _display_name(it),
                    "email": email,
                    "roleName": role,
                }
            )

        return {"count": len(students), "items": students, "roleCounts": role_counts}

    # --------------------------------------------------
    # Core calc helpers
    # --------------------------------------------------
    def _risk_from_performance(
        self, pct: Optional[float], thresholds: Dict[str, float]
    ) -> str:
        if pct is None:
            return "pending"
        critical = float(thresholds.get("critical", 50.0))
        watch = float(thresholds.get("watch", 70.0))
        if pct < critical:
            return "alto"
        if pct < watch:
            return "medio"
        return "bajo"

    def _risk_from_global(
        self, pct: Any, thresholds: Optional[Dict[str, float]] = None
    ) -> str:
        try:
            if pct is None:
                return "pending"
            pct_f = float(pct)
        except Exception:
            return "pending"

        thr = thresholds or {"critical": 50.0, "watch": 70.0}
        critical = float(thr.get("critical", 50.0))
        watch = float(thr.get("watch", 70.0))

        if pct_f < critical:
            return "alto"
        if pct_f < watch:
            return "medio"
        return "bajo"

    def _pct_from_outcome(
        self,
        co: Dict[str, Any],
        rubric_detail: Dict[str, Any],
        scale_type: str,
        max_level_points: float,
    ) -> float:
        if scale_type == "level_points":
            score = co.get("Score")
            if score is None:
                score = _lookup_level_points(rubric_detail, co.get("LevelId")) or 0.0
            if not max_level_points:
                return 0.0
            return (float(score) / float(max_level_points)) * 100.0

        score = co.get("Score", 0.0) or 0.0
        max_points = (
            _lookup_criterion_max_points(rubric_detail, co.get("CriterionId")) or 0.0
        )
        return (float(score) / float(max_points) * 100.0) if max_points else 0.0

    def _apply_prescription(
        self,
        cfg: Any,
        units: List[Dict[str, Any]],
        thresholds: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        pres = (
            getattr(cfg, "prescription", None)
            if not isinstance(cfg, dict)
            else cfg.get("prescription")
        )
        if not pres:
            return []
        rules = (
            getattr(pres, "rules", None)
            if not isinstance(pres, dict)
            else pres.get("rules")
        )
        if not rules:
            return []

        watch = float(thresholds.get("watch", 70.0))
        unit_by_code = {u["code"]: u for u in units}
        out: List[Dict[str, Any]] = []

        for r in rules:
            when = getattr(r, "when", None) if not isinstance(r, dict) else r.get("when")
            do = getattr(r, "do", None) if not isinstance(r, dict) else r.get("do")
            if not when or not do:
                continue

            code = when.code if hasattr(when, "code") else when.get("code")
            below = float(
                when.belowPct if hasattr(when, "belowPct") else when.get("belowPct", 0)
            )

            u = unit_by_code.get(code)
            if u and float(u["pct"]) < below:
                route_id = do.routeId if hasattr(do, "routeId") else do.get("routeId")
                title = do.title if hasattr(do, "title") else do.get("title")
                actions = do.actions if hasattr(do, "actions") else do.get("actions", [])

                out.append(
                    {
                        "routeId": route_id,
                        "title": title,
                        "priority": [code],
                        "actions": actions,
                        "successCriteria": (
                            f"Subir {code} a ≥{watch}% en la siguiente evidencia."
                        ),
                    }
                )

        return out

    # --------------------------------------------------
    # OVERVIEW (CURSO)
    # --------------------------------------------------
    async def build_course_overview(self, orgUnitId: int) -> Dict[str, Any]:
        fn = getattr(self.bs, "list_classlist", None)
        if not callable(fn):
            raise RuntimeError("brightspace_client no expone list_classlist")

        # Attempt classlist fetch. If it fails (403/404), return a graceful
        # empty-state response instead of blocking the whole course view.
        # This lets Super Administrators see the course shell even when
        # their token doesn't grant classlist access for that specific course.
        try:
            data = await fn(orgUnitId)
        except Exception as e:
            msg = str(e)
            if "403" in msg or "401" in msg or "404" in msg:
                import logging
                logging.getLogger(__name__).warning(
                    "classlist unavailable for course %s (%s) — returning empty overview",
                    orgUnitId, msg[:120],
                )
                return {
                    "orgUnitId": orgUnitId,
                    "studentsCount": 0,
                    "macroCompetencies": [],
                    "courseGradebook": {
                        "avgCurrentPerformancePct": 0.0,
                        "avgCoveragePct": 0.0,
                        "avgNotSubmittedPct": 0.0,
                        "avgPendingUngradedPct": 0.0,
                        "avgOverdueUnscoredPct": 0.0,
                        "avgGradedItemsCount": 0,
                        "avgTotalItemsCount": 0,
                        "coverageCountText": "0/0",
                        "status": "pending",
                    },
                    "globalRiskDistribution": {"alto": 0, "medio": 0, "bajo": 0, "pending": 0},
                    "thresholds": {"critical": 50.0, "watch": 70.0},
                    "alerts": [],
                    "studentsAtRisk": [],
                    "qualityFlags": [{
                        "type": "classlist_unavailable",
                        "message": "No se pudo obtener el classlist de este curso (403/404). El usuario no tiene permisos específicos en este curso.",
                    }],
                }
            raise
        items = _as_items_list(data)

        student_ids: List[int] = []
        for it in items:
            role = _extract_role_name(it)
            if _is_student_role(role):
                uid = _extract_user_id(it)
                if uid is not None:
                    student_ids.append(uid)

        try:
            bundle = load_course_bundle(orgUnitId)
            course_cfg = bundle.get("course") if isinstance(bundle, dict) else None
            cfg = bundle.get("rubricsModel") if isinstance(bundle, dict) else None
            thresholds = _get_thresholds(course_cfg, cfg)
        except FileNotFoundError:
            course_cfg = None
            cfg = None
            thresholds = {"critical": 50.0, "watch": 70.0}
        except Exception:
            course_cfg = None
            cfg = None
            thresholds = {"critical": 50.0, "watch": 70.0}

        if not student_ids:
            return {
                "orgUnitId": orgUnitId,
                "studentsCount": 0,
                "macroCompetencies": [],
                "courseGradebook": {
                    "avgCurrentPerformancePct": 0.0,
                    "avgCoveragePct": 0.0,
                    "avgNotSubmittedPct": 0.0,
                    "avgPendingUngradedPct": 0.0,
                    "avgOverdueUnscoredPct": 0.0,
                    "avgGradedItemsCount": 0,
                    "avgTotalItemsCount": 0,
                    "coverageCountText": "0/0",
                    "status": "pending",
                },
                "globalRiskDistribution": {"alto": 0, "medio": 0, "bajo": 0, "pending": 0},
                "thresholds": thresholds,
                "alerts": [],
            }

        # Semáforo: build_gemelo hace ~10 requests HTTP por estudiante.
        # Con Semaphore(10) → mayor paralelismo para evitar 504 Gateway Timeout.
        # Hard timeout de 50s (ALB timeout es 60s por defecto).
        _overview_sem = asyncio.Semaphore(10)

        async def _build_gemelo_limited(uid: int):
            async with _overview_sem:
                return await self.build_gemelo(orgUnitId, uid)

        tasks = [_build_gemelo_limited(uid) for uid in student_ids]
        results: List[Any]
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=50.0,
            )
        except asyncio.TimeoutError:
            # Partial results: cancel unfinished tasks and use what we have
            import logging
            logging.getLogger(__name__).warning(
                "build_course_overview timeout (50s) for course %s with %d students — returning partial",
                orgUnitId, len(student_ids),
            )
            results = [Exception("timeout") for _ in student_ids]
            # Don't raise — proceed with empty-ish aggregation

        risk_dist = {"alto": 0, "medio": 0, "bajo": 0, "pending": 0}
        perf_vals: List[float] = []
        cov_vals: List[float] = []
        graded_counts: List[float] = []
        total_counts: List[float] = []
        not_submitted_vals: List[float] = []
        pending_ungraded_vals: List[float] = []
        overdue_unscored_vals: List[float] = []
        macro_acc: Dict[str, List[float]] = {}
        students_at_risk: List[Dict[str, Any]] = []
        student_names: Dict[int, str] = {}

        # Construir mapa nombre por userId desde classlist
        for it in items:
            role = _extract_role_name(it)
            if _is_student_role(role):
                uid = _extract_user_id(it)
                if uid is not None:
                    student_names[uid] = _display_name(it)

        for g in results:
            if isinstance(g, Exception):
                risk_dist["pending"] += 1
                continue

            summary = g.get("summary") or {}
            uid = g.get("userId")
            perf_pct = summary.get("currentPerformancePct")
            cov_pct_s = summary.get("coveragePct") or 0.0
            overdue_pct_s = (
                summary.get("overdueUnscoredWeightPct")
                if summary.get("overdueUnscoredWeightPct") is not None
                else summary.get("notSubmittedWeightPct") or 0.0
            )
            pending_pct_s = summary.get("pendingUngradedWeightPct") or 0.0

            # Risk basado en nota del gradebook (no en RA)
            r = self._risk_from_performance(perf_pct, thresholds)
            risk_dist[r] = risk_dist.get(r, 0) + 1

            is_at_risk = (
                r in ("alto", "medio")
                or (perf_pct is not None and float(perf_pct) < float(thresholds.get("critical", 50.0)))
                or overdue_pct_s > 0
                or float(cov_pct_s) < 60
            )
            if is_at_risk and uid is not None:
                # Compute mostCriticalMacro from macroUnits (worst RA for this student)
                _macro_units = g.get("macroUnits") or g.get("macro", {}).get("units") or []
                _worst_macro = None
                if _macro_units:
                    _valid = [
                        {"code": str(m.get("code", "")), "pct": float(m.get("pct") or 0)}
                        for m in _macro_units if m.get("code") and m.get("pct") is not None
                    ]
                    if _valid:
                        _worst_macro = min(_valid, key=lambda x: x["pct"])

                students_at_risk.append({
                    "userId": uid,
                    "displayName": student_names.get(uid, str(uid)),
                    "risk": r,
                    "currentPerformancePct": perf_pct,
                    "coveragePct": round(float(cov_pct_s), 1),
                    "notSubmittedWeightPct": round(float(overdue_pct_s), 1),
                    "overdueUnscoredWeightPct": round(float(overdue_pct_s), 1),
                    "pendingUngradedWeightPct": round(float(pending_pct_s), 1),
                    "mostCriticalMacro": _worst_macro,
                })

            for m in (g.get("macroUnits") or []):
                code = str(m.get("code", ""))
                pct = m.get("pct")
                if pct is None:
                    continue
                try:
                    macro_acc.setdefault(code, []).append(float(pct))
                except Exception:
                    pass

            for key, target in (
                ("currentPerformancePct", perf_vals),
                ("coveragePct", cov_vals),
                ("gradedItemsCount", graded_counts),
                ("totalItemsCount", total_counts),
                ("notSubmittedWeightPct", not_submitted_vals),
                ("pendingUngradedWeightPct", pending_ungraded_vals),
                ("overdueUnscoredWeightPct", overdue_unscored_vals),
            ):
                val = summary.get(key)
                if val is not None:
                    try:
                        target.append(float(val))
                    except Exception:
                        pass

        def _safe_avg(lst: List[float], ndigits: int = 2) -> float:
            return round(sum(lst) / len(lst), ndigits) if lst else 0.0

        avg_perf = _safe_avg(perf_vals)
        avg_cov = _safe_avg(cov_vals)
        avg_graded = int(round(_safe_avg(graded_counts))) if graded_counts else 0
        avg_total = int(round(_safe_avg(total_counts))) if total_counts else 0
        avg_not_submitted = _safe_avg(not_submitted_vals)
        avg_pending_ungraded = _safe_avg(pending_ungraded_vals)
        avg_overdue_unscored = _safe_avg(overdue_unscored_vals)

        macro_out = sorted(
            [
                {
                    "code": code,
                    "avgPct": round(sum(vals) / len(vals), 1),
                    "status": status_from_pct(round(sum(vals) / len(vals), 1), thresholds),
                }
                for code, vals in macro_acc.items()
                if vals
            ],
            key=lambda x: x["code"],
        )

        def _sev_from_pct(pct: float, thr: Dict[str, float]) -> str:
            if pct < float(thr.get("critical", 50.0)):
                return "critico"
            if pct < float(thr.get("watch", 70.0)):
                return "observacion"
            return "solido"

        alerts: List[Dict[str, Any]] = []

        pending_pct = round(max(0.0, 100.0 - float(avg_cov)), 2)
        sev_cov = "critico" if avg_cov < 40 else ("observacion" if avg_cov < 70 else "solido")
        alerts.append(
            {
                "id": "coverage_low" if sev_cov != "solido" else "coverage_ok",
                "severity": sev_cov,
                "title": "Cobertura de evaluación",
                "message": (
                    f"El curso tiene {avg_cov:.2f}% de cobertura; "
                    f"queda {pending_pct:.2f}% pendiente por calificar."
                ),
                "kpis": {
                    "coveragePct": avg_cov,
                    "pendingPct": pending_pct,
                    "gradedItemsCount": avg_graded,
                    "totalItemsCount": avg_total,
                    "coverageCountText": (
                        f"{avg_graded}/{avg_total}" if avg_total else "0/0"
                    ),
                },
            }
        )

        if avg_perf == 0.0 and avg_cov > 0.0:
            alerts.append(
                {
                    "id": "performance_inconsistent",
                    "severity": "observacion",
                    "title": "Nota promedio no consolidada",
                    "message": (
                        "Hay cobertura registrada, pero la nota promedio aparece en 0%. "
                        "Revisar configuración/visibilidad de ítems del gradebook."
                    ),
                    "kpis": {
                        "avgCurrentPerformancePct": avg_perf,
                        "avgCoveragePct": avg_cov,
                    },
                }
            )
        else:
            sev_perf = _sev_from_pct(float(avg_perf), thresholds) if avg_perf > 0 else "pending"
            if sev_perf != "pending":
                alerts.append(
                    {
                        "id": "performance_low" if sev_perf != "solido" else "performance_ok",
                        "severity": sev_perf,
                        "title": "Desempeño académico del curso",
                        "message": f"La nota promedio actual del curso es {avg_perf:.2f}%.",
                        "kpis": {"avgCurrentPerformancePct": avg_perf},
                    }
                )

        total = len(student_ids)
        high = int(risk_dist.get("alto", 0) or 0)
        pct_high = round((high / total) * 100.0, 2) if total > 0 else 0.0
        sev_risk = (
            "critico" if pct_high >= 40
            else ("observacion" if pct_high >= 20 else "solido")
        )
        if total > 0 and sev_risk != "solido":
            alerts.append(
                {
                    "id": "risk_concentration_high",
                    "severity": sev_risk,
                    "title": "Concentración de riesgo alto",
                    "message": (
                        f"{high} de {total} estudiantes ({pct_high:.2f}%) "
                        "están en riesgo ALTO."
                    ),
                    "kpis": {
                        "alto": int(risk_dist.get("alto", 0) or 0),
                        "medio": int(risk_dist.get("medio", 0) or 0),
                        "bajo": int(risk_dist.get("bajo", 0) or 0),
                        "pending": int(risk_dist.get("pending", 0) or 0),
                        "pctAlto": pct_high,
                    },
                }
            )

        if macro_out:
            worst = sorted(macro_out, key=lambda x: float(x.get("avgPct") or 0.0))[0]
            worst_status = worst.get("status")
            if worst_status in ("critico", "observacion"):
                alerts.append(
                    {
                        "id": (
                            "macro_critical" if worst_status == "critico"
                            else "macro_watch"
                        ),
                        "severity": worst_status,
                        "title": "Macrocompetencia prioritaria",
                        "message": (
                            f"La macro {worst.get('code')} es la más comprometida "
                            f"con {worst.get('avgPct')}%."
                        ),
                        "kpis": {
                            "macro": worst.get("code"),
                            "avgPct": worst.get("avgPct"),
                            "status": worst_status,
                        },
                    }
                )

        if avg_not_submitted > 0:
            sev_not_submitted = (
                "critico"
                if avg_not_submitted >= 25
                else ("observacion" if avg_not_submitted >= 10 else "solido")
            )
            alerts.append(
                {
                    "id": "not_submitted_overdue",
                    "severity": sev_not_submitted,
                    "title": "Entregas no enviadas",
                    "message": (
                        f"En promedio, {avg_not_submitted:.2f}% del peso evaluativo "
                        "corresponde a actividades vencidas no entregadas."
                    ),
                    "kpis": {
                        "avgNotSubmittedPct": avg_not_submitted,
                    },
                }
            )

        # ── Alert: grade items without RA mapping ────────────
        try:
            # Collect all folderId/gradeObjectIds that ARE linked to RA rubric criteria
            linked_ids: set = set()
            if isinstance(cfg, dict):
                for ra in (cfg.get("outcomes") or []):
                    for crit in (ra.get("criteria") or []):
                        fid = crit.get("folderId") or crit.get("gradeObjectId")
                        if fid is not None:
                            linked_ids.add(int(fid))
            elif hasattr(cfg, "outcomes"):
                for ra in (getattr(cfg, "outcomes", None) or []):
                    for crit in (getattr(ra, "criteria", None) or []):
                        fid = getattr(crit, "folderId", None) or getattr(crit, "gradeObjectId", None)
                        if fid is not None:
                            linked_ids.add(int(fid))

            # Get all grade items from Brightspace
            _grade_items_raw = await self.bs.list_grade_items(orgUnitId)
            if isinstance(_grade_items_raw, dict):
                _grade_items_raw = _grade_items_raw.get("Items") or _grade_items_raw.get("items") or []
            _grade_items_raw = _grade_items_raw if isinstance(_grade_items_raw, list) else []

            # Filter: items with weight > 0 (evaluable) that are NOT linked to RA
            unlinked_items = []
            for it in _grade_items_raw:
                if not isinstance(it, dict):
                    continue
                gid = it.get("Id") or it.get("id")
                if gid is None:
                    continue
                weight = float(it.get("Weight") or it.get("weight") or 0)
                if weight <= 0:
                    continue  # skip unweighted items
                if int(gid) not in linked_ids:
                    unlinked_items.append({
                        "gradeObjectId": int(gid),
                        "name": it.get("Name") or it.get("name") or f"Ítem {gid}",
                        "weightPct": round(weight, 2),
                    })

            if unlinked_items and linked_ids:
                # Only alert if there are SOME linked items (course uses RAs)
                # and SOME unlinked (some items lack RA mapping)
                total_w = sum(x["weightPct"] for x in unlinked_items)
                alerts.append({
                    "id": "items_without_ra",
                    "severity": "observacion",
                    "title": f"Actividades sin Resultado de Aprendizaje ({len(unlinked_items)})",
                    "message": (
                        f"{len(unlinked_items)} actividad{'es' if len(unlinked_items) != 1 else ''} "
                        f"calificada{'s' if len(unlinked_items) != 1 else ''} no están vinculadas "
                        f"a ningún RA en la rúbrica ({total_w:.1f}% del peso total). "
                        f"Estas notas no se reflejan en el análisis de competencias."
                    ),
                    "kpis": {
                        "sin_ra": len(unlinked_items),
                        "peso_total": round(total_w, 1),
                    },
                    "items": unlinked_items[:10],  # max 10 for payload size
                })
            elif unlinked_items and not linked_ids:
                # No RA config at all — different message
                alerts.append({
                    "id": "no_ra_config",
                    "severity": "observacion",
                    "title": "Sin configuración de Resultados de Aprendizaje",
                    "message": (
                        "El curso tiene actividades calificadas pero no hay rúbricas "
                        "vinculadas a Resultados de Aprendizaje. "
                        "Configura los RA en el modelo del curso para activar el análisis por competencias."
                    ),
                    "kpis": {"actividades": len(unlinked_items)},
                    "items": [],
                })
        except Exception:
            pass  # alert es informativa — no bloquear si falla

        return {
            "orgUnitId": orgUnitId,
            "studentsCount": len(student_ids),
            "macroCompetencies": macro_out,
            "courseGradebook": {
                "avgCurrentPerformancePct": avg_perf,
                "avgCoveragePct": avg_cov,
                "avgNotSubmittedPct": avg_not_submitted,
                "avgPendingUngradedPct": avg_pending_ungraded,
                "avgOverdueUnscoredPct": avg_overdue_unscored,
                "avgGradedItemsCount": avg_graded,
                "avgTotalItemsCount": avg_total,
                "coverageCountText": (
                    f"{avg_graded}/{avg_total}" if avg_total else "0/0"
                ),
                "status": status_from_pct(avg_perf, thresholds),
            },
            "globalRiskDistribution": risk_dist,
            "studentsAtRisk": sorted(
                students_at_risk,
                key=lambda s: (
                    0 if s["risk"] == "alto" else 1 if s["risk"] == "medio" else 2,
                    float(s.get("currentPerformancePct") or 999),
                ),
            ),
            "thresholds": thresholds,
            "alerts": alerts,
        }

    # --------------------------------------------------
    # GEMELO (ESTUDIANTE)
    # --------------------------------------------------
    async def build_gemelo(self, orgUnitId: int, userId: int) -> Dict[str, Any]:
        """
        Construye el gemelo digital de un estudiante.
        Nunca lanza excepción — en caso de error retorna un dict mínimo válido
        con el error registrado en qualityFlags.
        """
        try:
            return await self._build_gemelo_inner(orgUnitId, userId)
        except Exception as exc:
            # Captura de seguridad: nunca devolver 500 al frontend
            return {
                "orgUnitId": orgUnitId,
                "userId": userId,
                "course": {"updatedAt": datetime.now(timezone.utc).isoformat()},
                "access": {},
                "capabilities": {},
                "summary": {
                    "globalPct": None,
                    "risk": "pending",
                    "coveragePct": None,
                    "currentPerformancePct": None,
                    "gradedItemsCount": 0,
                    "totalItemsCount": 0,
                    "coverageCountText": "0/0",
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                },
                "macro": {"units": []},
                "units": [],
                "prescription": [],
                "macroUnits": [],
                "gradebook": {},
                "projection": {},
                "qualityFlags": [{"type": "build_gemelo_failed", "message": str(exc)}],
            }

    async def _build_gemelo_inner(self, orgUnitId: int, userId: int) -> Dict[str, Any]:
        try:
            bundle = load_course_bundle(orgUnitId)
        except FileNotFoundError:
            bundle = {"course": None, "rubricsModel": None}
        except Exception:
            bundle = {"course": None, "rubricsModel": None}

        course_cfg = bundle.get("course") if isinstance(bundle, dict) else None
        cfg = bundle.get("rubricsModel") if isinstance(bundle, dict) else None

        qc_flags: List[Dict[str, Any]] = []
        view = "student"
        role_ctx: Dict[str, Any] = {}
        access_level = "student"

        thresholds = _get_thresholds(course_cfg, cfg)
        scale_type, max_level_points = _get_scale_settings(cfg)

        try:
            fn = getattr(self.bs, "get_my_enrollment", None)
            if callable(fn):
                enr = await fn(orgUnitId)
                role_ctx = normalize_view_from_enrollment(enr)
                view = role_ctx.get("view", "student")
                access_level = role_ctx.get("accessLevel", "student")
            else:
                qc_flags.append(
                    {
                        "type": "role_not_enabled",
                        "message": "brightspace_client no expone get_my_enrollment",
                    }
                )
        except Exception as e:
            qc_flags.append({"type": "role_resolve_failed", "message": str(e)})

        force_teacher_mode = True
        if force_teacher_mode:
            access_level = "teacher"
            view = "teacher"
            role_ctx = {
                "accessLevel": "teacher",
                "view": "teacher",
                "classlistRoleName": "Instructor (forced)",
            }

        is_teacher = access_level in ("teacher", "admin")
        is_admin = access_level == "admin"

        units_acc: Dict[str, List[Tuple[float, float, Dict[str, Any]]]] = {}

        rubrics_cfg = None
        if cfg is not None:
            rubrics_cfg = (
                getattr(cfg, "rubrics", None)
                if not isinstance(cfg, dict)
                else cfg.get("rubrics")
            )

        if rubrics_cfg:
            folders = await self.bs.list_dropbox_folders(orgUnitId)

            def _folder_rubric_id(folder: Dict[str, Any]) -> Optional[int]:
                rubrics = (folder.get("Assessment") or {}).get("Rubrics") or []
                if not rubrics:
                    return None
                rid = rubrics[0].get("RubricId")
                return int(rid) if rid is not None else None

            for folder in [f for f in folders if _folder_rubric_id(f) is not None]:
                folderId = int(folder["Id"])
                rubricId_int = _folder_rubric_id(folder)
                if rubricId_int is None:
                    continue
                rubricId = str(rubricId_int)

                assessment = await self.bs.get_dropbox_rubric_assessment(
                    orgUnitId=orgUnitId,
                    folderId=folderId,
                    rubricId=rubricId_int,
                    userId=userId,
                )

                rubric_detail = (
                    (folder.get("Assessment") or {}).get("Rubrics") or [{}]
                )[0]

                try:
                    inc = detect_rubric_inconsistency(rubric_detail)
                    if inc:
                        qc_flags.append(
                            {
                                "type": "rubric_inconsistency",
                                "rubricId": rubricId,
                                "folderId": folderId,
                                "signals": inc,
                            }
                        )
                except Exception as e:
                    qc_flags.append(
                        {
                            "type": "rubric_quality_check_failed",
                            "rubricId": rubricId,
                            "folderId": folderId,
                            "message": str(e),
                        }
                    )

                rubric_cfg = (
                    rubrics_cfg.get(rubricId)
                    if isinstance(rubrics_cfg, dict)
                    else getattr(rubrics_cfg, rubricId, None)
                )
                if not rubric_cfg:
                    qc_flags.append(
                        {
                            "type": "missing_rubric_config",
                            "rubricId": rubricId,
                            "folderId": folderId,
                        }
                    )
                    continue

                criteria_outcomes = assessment.get("CriteriaOutcome") or []
                if not criteria_outcomes:
                    qc_flags.append(
                        {
                            "type": "no_rubric_outcome",
                            "rubricId": rubricId,
                            "folderId": folderId,
                            "userId": userId,
                            "message": "No hay CriteriaOutcome (rúbrica no diligenciada/publicada).",
                        }
                    )
                    continue

                outcome_by_criterion: Dict[str, Dict[str, Any]] = {}
                for co in criteria_outcomes:
                    cid = co.get("CriterionId")
                    if cid is None:
                        continue
                    outcome_by_criterion[str(int(cid))] = co

                learning_units = (
                    getattr(rubric_cfg, "learningUnits", None)
                    if not isinstance(rubric_cfg, dict)
                    else rubric_cfg.get("learningUnits")
                )
                if learning_units and isinstance(learning_units, dict):
                    for unit_code, unit_def in learning_units.items():
                        unit_weight = (
                            float(unit_def.get("weight", 1.0))
                            if isinstance(unit_def, dict)
                            else float(getattr(unit_def, "weight", 1.0))
                        )
                        criteria_list = (
                            unit_def.get("criteria", [])
                            if isinstance(unit_def, dict)
                            else getattr(unit_def, "criteria", [])
                        )

                        for criterion_id in criteria_list:
                            cid = str(int(criterion_id))
                            co = outcome_by_criterion.get(cid)
                            if not co:
                                qc_flags.append(
                                    {
                                        "type": "missing_criterion_outcome",
                                        "rubricId": rubricId,
                                        "folderId": folderId,
                                        "unitCode": unit_code,
                                        "criterionId": cid,
                                    }
                                )
                                continue

                            pct = self._pct_from_outcome(
                                co, rubric_detail, scale_type, max_level_points
                            )
                            units_acc.setdefault(unit_code, []).append(
                                (
                                    pct,
                                    unit_weight,
                                    {
                                        "folderId": folderId,
                                        "rubricId": rubricId_int,
                                        "criterionId": int(cid),
                                    },
                                )
                            )
                    continue

                criteria_map = (
                    getattr(rubric_cfg, "criteriaMap", None)
                    if not isinstance(rubric_cfg, dict)
                    else rubric_cfg.get("criteriaMap")
                )
                if not criteria_map or not isinstance(criteria_map, dict):
                    qc_flags.append(
                        {
                            "type": "missing_mapping_structure",
                            "rubricId": rubricId,
                            "folderId": folderId,
                        }
                    )
                    continue

                for cid, co in outcome_by_criterion.items():
                    map_item = criteria_map.get(cid)
                    if not map_item:
                        qc_flags.append(
                            {
                                "type": "missing_criterion_mapping",
                                "rubricId": rubricId,
                                "criterionId": cid,
                                "folderId": folderId,
                            }
                        )
                        continue

                    unit_code = (
                        map_item.code
                        if hasattr(map_item, "code")
                        else map_item["code"]
                    )
                    weight = float(
                        map_item.weight
                        if hasattr(map_item, "weight")
                        else map_item.get("weight", 1.0)
                    )

                    pct = self._pct_from_outcome(
                        co, rubric_detail, scale_type, max_level_points
                    )
                    units_acc.setdefault(unit_code, []).append(
                        (
                            pct,
                            weight,
                            {
                                "folderId": folderId,
                                "rubricId": rubricId_int,
                                "criterionId": int(cid),
                            },
                        )
                    )

        units: List[Dict[str, Any]] = sorted(
            [
                {
                    "code": code,
                    "pct": round(weighted_avg([(r[0], r[1]) for r in rows]), 1),
                    "status": status_from_pct(
                        round(weighted_avg([(r[0], r[1]) for r in rows]), 1), thresholds
                    ),
                    "evidence": [
                        {
                            "folderId": r[2]["folderId"],
                            "rubricId": r[2]["rubricId"],
                            "criterionId": r[2]["criterionId"],
                        }
                        for r in rows
                    ],
                }
                for code, rows in units_acc.items()
            ],
            key=lambda x: x["code"],
        )

        gradebook_block: Dict[str, Any] = {}
        projection_block: Dict[str, Any] = {}

        async def _compute_gradebook(include_evidences: bool) -> Dict[str, Any]:
            list_items_fn = getattr(self.bs, "list_grade_items", None)
            get_value_fn = getattr(self.bs, "get_grade_value", None)
            list_dropbox_fn = getattr(self.bs, "list_dropbox_folders", None)

            if not (callable(list_items_fn) and callable(get_value_fn)):
                qc_flags.append(
                    {
                        "type": "gradebook_not_enabled",
                        "message": "brightspace_client no expone list_grade_items/get_grade_value",
                    }
                )
                return {}

            raw_items = await list_items_fn(orgUnitId)
            if isinstance(raw_items, dict):
                raw_items = raw_items.get("Items") or raw_items.get("items") or []
            if not isinstance(raw_items, list):
                return {}

            course_dict = _as_dict(course_cfg)
            gp = (
                course_dict.get("gradingPolicy", {})
                if isinstance(course_dict.get("gradingPolicy", {}), dict)
                else {}
            )
            include_ids = set(gp.get("includeGradeObjectIds") or [])
            exclude_ids = set(gp.get("excludeGradeObjectIds") or [])

            items_in_scope = [
                it for it in raw_items
                if isinstance(it, dict) and it.get("Id") is not None
            ]
            if include_ids:
                items_in_scope = [
                    it for it in items_in_scope
                    if int(it.get("Id")) in include_ids
                ]
            if exclude_ids:
                items_in_scope = [
                    it for it in items_in_scope
                    if int(it.get("Id")) not in exclude_ids
                ]

            # Mapa folderId -> due date desde Dropbox
            dropbox_due_by_folder_id: Dict[int, Optional[datetime]] = {}
            if callable(list_dropbox_fn):
                try:
                    folders = await list_dropbox_fn(orgUnitId)
                    if isinstance(folders, dict):
                        folders = folders.get("Items") or folders.get("items") or []
                    if isinstance(folders, list):
                        for f in folders:
                            if not isinstance(f, dict) or f.get("Id") is None:
                                continue
                            fid = int(f["Id"])
                            due_raw = (
                                f.get("DueDate")
                                or f.get("EndDate")
                                or f.get("StartDate")
                            )
                            dropbox_due_by_folder_id[fid] = _parse_iso_dt(due_raw)
                except Exception as e:
                    qc_flags.append(
                        {
                            "type": "dropbox_due_lookup_failed",
                            "message": str(e),
                        }
                    )

            def _due_date_for_grade_item(it: Dict[str, Any]) -> Optional[datetime]:
                assoc = it.get("AssociatedTool") or {}
                tool_id = assoc.get("ToolId")
                tool_item_id = assoc.get("ToolItemId")

                # Dropbox / Assignments suele venir con ToolId 2000
                if tool_id == 2000 and tool_item_id is not None:
                    try:
                        return dropbox_due_by_folder_id.get(int(tool_item_id))
                    except Exception:
                        return None

                return _parse_iso_dt(
                    it.get("DueDate") or it.get("EndDate") or it.get("dueDate")
                )

            def _is_404(err: Exception) -> bool:
                msg = str(err or "")
                return (
                    "Brightspace error 404" in msg
                    or " 404 " in msg
                    or msg.strip().startswith("404")
                )

            values: List[Dict[str, Any]] = []
            missing_values: List[Dict[str, Any]] = []

            for it in items_in_scope:
                gid = int(it["Id"])
                try:
                    val = await get_value_fn(orgUnitId, gid, userId)
                    values.append(
                        {
                            "item": it,
                            "value": val if isinstance(val, dict) else {},
                        }
                    )
                except Exception as e:
                    if _is_404(e):
                        missing_values.append(
                            {
                                "gradeObjectId": gid,
                                "name": it.get("Name"),
                                "weightPct": float(it.get("Weight", 0) or 0),
                                "reason": "not_released_or_no_value",
                            }
                        )
                        values.append({"item": it, "value": {}})
                    else:
                        qc_flags.append(
                            {
                                "type": "grade_value_failed",
                                "gradeObjectId": gid,
                                "message": str(e),
                            }
                        )
                        values.append({"item": it, "value": {}})

            _now = datetime.now(timezone.utc)

            graded: List[Tuple[float, float]] = []
            total_weight = 0.0
            graded_weight = 0.0
            graded_items_count = 0
            total_items_count = 0

            pending_ungraded_count = 0
            pending_ungraded_weight = 0.0

            overdue_unscored_count = 0
            overdue_unscored_weight = 0.0

            evidences: List[Dict[str, Any]] = []
            pending_items: List[Dict[str, Any]] = []

            for row in values:
                it = row["item"]
                val = row["value"] or {}

                item_name = it.get("Name")
                w = float(it.get("Weight", 0) or 0.0)

                # Detect "Corte" / summary items: these are aggregated running totals
                # (Corte 1/2/3, C1, Cohorte, etc.). We DISPLAY them but DO NOT count
                # them in weighted averages — they'd double-count the component grades.
                is_corte = _is_corte_item(item_name)
                corte_period = _extract_corte_period(item_name) if is_corte else None

                points_num = val.get("PointsNumerator")
                points_den = val.get("PointsDenominator")
                weighted_num = val.get("WeightedNumerator")
                weighted_den = val.get("WeightedDenominator")

                due_dt = _due_date_for_grade_item(it)
                is_overdue = bool(due_dt and due_dt < _now)

                has_grade = _is_graded(points_num, points_den)

                score_pct = None
                evidence_status = "pending"

                if has_grade:
                    try:
                        score_pct = round((float(points_num) / float(points_den)) * 100.0, 2)
                    except Exception:
                        score_pct = None
                    evidence_status = "graded"
                else:
                    if is_overdue:
                        evidence_status = "overdue_unscored"
                    else:
                        evidence_status = "pending"

                # Only non-Corte items contribute to aggregate counts/weights
                if not is_corte:
                    total_weight += w
                    total_items_count += 1

                    if has_grade:
                        graded_items_count += 1
                        graded_weight += w
                    else:
                        if is_overdue:
                            overdue_unscored_count += 1
                            overdue_unscored_weight += w
                        else:
                            pending_ungraded_count += 1
                            pending_ungraded_weight += w

                    if has_grade and weighted_num is not None and weighted_den is not None:
                        if _num(weighted_den, 0.0) > 0:
                            graded.append((float(weighted_num), float(weighted_den)))

                if include_evidences:
                    # Find linked dropbox folder ID for download/feedback links
                    _assoc = it.get("AssociatedTool") or {}
                    _tool_id = _assoc.get("ToolId")
                    _tool_item = _assoc.get("ToolItemId")
                    linked_dropbox_id = None
                    if _tool_id in (1, 2000) and _tool_item is not None:
                        try:
                            linked_dropbox_id = int(_tool_item)
                        except Exception:
                            linked_dropbox_id = None

                    evidences.append(
                        {
                            "gradeObjectId": int(it.get("Id")),
                            "name": item_name,
                            "weightPct": w,
                            "scorePct": score_pct,
                            "status": evidence_status,
                            "isGraded": has_grade,
                            "isOverdue": is_overdue,
                            "isCorte": is_corte,
                            "cortePeriod": corte_period,
                            "dueDate": due_dt.isoformat() if due_dt else None,
                            "lastModified": val.get("LastModified"),
                            "linkedDropboxId": linked_dropbox_id,
                        }
                    )

                    # Don't mark Corte items as pending items
                    if not has_grade and not is_corte:
                        pending_items.append(
                            {
                                "gradeObjectId": int(it.get("Id")),
                                "name": item_name,
                                "weightPct": w,
                                "status": evidence_status,
                                "isOverdue": is_overdue,
                                "dueDate": due_dt.isoformat() if due_dt else None,
                            }
                        )

            weighted_earned = sum(a for a, _ in graded) if graded else 0.0
            weighted_possible = sum(b for _, b in graded) if graded else 0.0

            current_perf_pct: Optional[float] = (
                round((weighted_earned / weighted_possible) * 100.0, 2)
                if weighted_possible
                else None
            )

            # Fallback si no hay ponderados (también excluye Corte)
            if current_perf_pct is None:
                acc: List[Tuple[float, float]] = []
                for row in values:
                    it = row["item"]
                    val = row["value"] or {}
                    if _is_corte_item(it.get("Name")):
                        continue
                    w = float(it.get("Weight", 0) or 0.0)
                    pn = val.get("PointsNumerator")
                    pd = val.get("PointsDenominator")
                    if not _is_graded(pn, pd):
                        continue
                    try:
                        acc.append(((float(pn) / float(pd)) * 100.0, w))
                    except Exception:
                        pass
                if acc and sum(w for _, w in acc) > 0:
                    current_perf_pct = round(weighted_avg(acc), 2)

            coverage_pct = (
                round((graded_weight / total_weight) * 100.0, 2)
                if total_weight else 0.0
            )

            pending_ungraded_weight_pct = (
                round((pending_ungraded_weight / total_weight) * 100.0, 2)
                if total_weight else 0.0
            )

            overdue_unscored_weight_pct = (
                round((overdue_unscored_weight / total_weight) * 100.0, 2)
                if total_weight else 0.0
            )

            out: Dict[str, Any] = {
                "currentPerformancePct": current_perf_pct,
                "coveragePct": coverage_pct,
                "pendingWeightPct": round(max(0.0, 100.0 - coverage_pct), 2),
                "pendingUngradedCount": pending_ungraded_count,
                "pendingUngradedWeightPct": pending_ungraded_weight_pct,
                "overdueUnscoredCount": overdue_unscored_count,
                "overdueUnscoredWeightPct": overdue_unscored_weight_pct,
                "gradedItemsCount": graded_items_count,
                "totalItemsCount": total_items_count,
                "status": status_from_pct(current_perf_pct, thresholds),
            }

            if include_evidences:
                out["evidences"] = evidences
                out["pendingItems"] = sorted(
                    pending_items,
                    key=lambda x: float(x.get("weightPct") or 0.0),
                    reverse=True,
                )
                out["missingValues"] = sorted(
                    missing_values,
                    key=lambda x: float(x.get("weightPct") or 0.0),
                    reverse=True,
                )

            return out

        try:
            # Include evidences for BOTH teachers and students.
            # Students need to see their own evidences (graded, pending, overdue)
            # in the portal view.
            gradebook_block = await _compute_gradebook(include_evidences=True) or {}
        except Exception as e:
            qc_flags.append({"type": "gradebook_compute_failed", "message": str(e)})
            gradebook_block = {}

        globalPct = (
            round(sum(u["pct"] for u in units) / len(units), 1) if units else None
        )
        risk = (
            self._risk_from_global(globalPct, thresholds)
            if globalPct is not None
            else self._risk_from_performance(
                gradebook_block.get("currentPerformancePct"), thresholds
            )
        )

        prescription = self._apply_prescription(cfg, units, thresholds)

        if (
            is_teacher
            and gradebook_block
            and gradebook_block.get("coveragePct") is not None
            and gradebook_block.get("currentPerformancePct") is not None
        ):
            try:
                course_dict = _as_dict(course_cfg)
                proj_cfg = course_dict.get("projection") or {}
                proj_cfg = proj_cfg if isinstance(proj_cfg, dict) else {}
                scen = proj_cfg.get("scenarioPendingPct") or {}
                scen = scen if isinstance(scen, dict) else {}

                risk_assump = float(scen.get("risk", 50))
                improve_assump = float(scen.get("improve", 70))

                coverage_pct = float(gradebook_block.get("coveragePct") or 0.0)
                current_perf_pct = float(
                    gradebook_block.get("currentPerformancePct") or 0.0
                )
                c = coverage_pct / 100.0
                p = current_perf_pct

                if coverage_pct >= 99.999:
                    projection_block = {
                        "coveragePct": coverage_pct,
                        "currentPerformancePct": current_perf_pct,
                        "isFinal": True,
                        "finalPct": current_perf_pct,
                        "scenarios": [],
                        "note": "Cobertura 100%: la proyección coincide con el desempeño final.",
                    }
                else:
                    projection_block = {
                        "coveragePct": coverage_pct,
                        "currentPerformancePct": current_perf_pct,
                        "isFinal": False,
                        "finalPct": None,
                        "scenarios": [
                            {
                                "id": "risk",
                                "assumptionPendingPct": risk_assump,
                                "projectedFinalPct": round(
                                    (c * p) + ((1 - c) * risk_assump), 2
                                ),
                            },
                            {
                                "id": "base",
                                "assumptionPendingPct": p,
                                "projectedFinalPct": round(p, 2),
                            },
                            {
                                "id": "improve",
                                "assumptionPendingPct": improve_assump,
                                "projectedFinalPct": round(
                                    (c * p) + ((1 - c) * improve_assump), 2
                                ),
                            },
                        ],
                    }
            except Exception as e:
                qc_flags.append(
                    {"type": "projection_compute_failed", "message": str(e)}
                )
                projection_block = {}

        model_type = None
        if cfg is not None:
            model_type = (
                cfg.modelType
                if hasattr(cfg, "modelType")
                else (cfg.get("modelType") if isinstance(cfg, dict) else None)
            )
        if model_type is None:
            cd = _as_dict(course_cfg)
            model_type = cd.get("modelType") or cd.get("maturityProfile")

        macro_units = build_macro_units(units, cfg, thresholds)

        capabilities = {
            "gradebook": bool(gradebook_block),
            "projection": bool(projection_block) if is_teacher else False,
            "competencies": bool(units),
            "prescription": bool(prescription),
            "accessLevel": access_level,
            "view": view,
        }

        if not is_admin and role_ctx:
            role_ctx = {
                "accessLevel": role_ctx.get("accessLevel"),
                "view": role_ctx.get("view"),
                "classlistRoleName": role_ctx.get("classlistRoleName"),
            }

        if not is_teacher:
            gradebook_block = {
                "currentPerformancePct": gradebook_block.get("currentPerformancePct"),
                "coveragePct": gradebook_block.get("coveragePct"),
                "pendingWeightPct": gradebook_block.get("pendingWeightPct"),
                "gradedItemsCount": gradebook_block.get("gradedItemsCount"),
                "totalItemsCount": gradebook_block.get("totalItemsCount"),
                "status": gradebook_block.get("status"),
            }
            projection_block = {}

        graded_items_count = int(gradebook_block.get("gradedItemsCount") or 0)
        total_items_count = int(gradebook_block.get("totalItemsCount") or 0)

        return {
            "orgUnitId": orgUnitId,
            "userId": userId,
            "course": {
                "maturityProfile": (
                    getattr(course_cfg, "maturityProfile", None)
                    if course_cfg is not None
                    else None
                ),
                "modelType": model_type,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            },
            "access": role_ctx,
            "capabilities": capabilities,
            "summary": {
                "globalPct": globalPct,
                "risk": risk,
                "coveragePct": (
                    gradebook_block.get("coveragePct") if gradebook_block else None
                ),
                "currentPerformancePct": (
                    gradebook_block.get("currentPerformancePct")
                    if gradebook_block
                    else None
                ),
                "gradedItemsCount": graded_items_count,
                "totalItemsCount": total_items_count,
                "pendingUngradedCount": gradebook_block.get("pendingUngradedCount", 0),
                "pendingUngradedWeightPct": gradebook_block.get("pendingUngradedWeightPct", 0.0),
                "overdueUnscoredCount": gradebook_block.get("overdueUnscoredCount", 0),
                "overdueUnscoredWeightPct": gradebook_block.get("overdueUnscoredWeightPct", 0.0),
                "coverageCountText": (
                    f"{graded_items_count}/{total_items_count}"
                    if total_items_count
                    else "0/0"
                ),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            },
            "macro": {"units": macro_units},
            "units": units,
            "prescription": prescription,
            "macroUnits": macro_units,
            "gradebook": gradebook_block,
            "projection": projection_block,
            "qualityFlags": qc_flags,
        }

    # --------------------------------------------------
    # Métricas masivas (para /students?with_metrics=true)
    # --------------------------------------------------
    async def compute_students_gradebook_metrics(
        self,
        orgUnitId: int,
        student_ids: List[int],
        course_cfg: Any,
    ) -> Dict[int, Dict[str, Any]]:
        """
        Devuelve por userId:
        - coveragePct / gradedItemsCount / totalItemsCount / coverageCountText
        - pendingUngradedCount / pendingUngradedWeightPct
        - overdueUnscoredCount / overdueUnscoredWeightPct
        - currentPerformancePct
        """
        list_items_fn = getattr(self.bs, "list_grade_items", None)
        list_values_fn = getattr(self.bs, "list_grade_values_for_user", None)
        list_dropbox_fn = getattr(self.bs, "list_dropbox_folders", None)

        if not (callable(list_items_fn) and callable(list_values_fn)):
            return {}

        raw_items = await list_items_fn(orgUnitId)
        if isinstance(raw_items, dict):
            raw_items = raw_items.get("Items") or raw_items.get("items") or []
        if not isinstance(raw_items, list):
            return {}

        course_dict = _as_dict(course_cfg)
        gp = (
            course_dict.get("gradingPolicy", {})
            if isinstance(course_dict.get("gradingPolicy"), dict)
            else {}
        )
        include_ids = set(gp.get("includeGradeObjectIds") or [])
        exclude_ids = set(gp.get("excludeGradeObjectIds") or [])

        items_in_scope = [
            it for it in raw_items
            if isinstance(it, dict) and it.get("Id") is not None
        ]
        if include_ids:
            items_in_scope = [
                it for it in items_in_scope if int(it.get("Id")) in include_ids
            ]
        if exclude_ids:
            items_in_scope = [
                it for it in items_in_scope if int(it.get("Id")) not in exclude_ids
            ]

        total_items_count = len(items_in_scope)

        item_weight_by_id: Dict[int, float] = {}
        total_weight = 0.0
        for it in items_in_scope:
            gid = int(it["Id"])
            w = float(it.get("Weight", 0) or 0.0)
            item_weight_by_id[gid] = w
            total_weight += w

        dropbox_due_by_folder_id: Dict[int, Optional[datetime]] = {}
        if callable(list_dropbox_fn):
            try:
                folders = await list_dropbox_fn(orgUnitId)
                if isinstance(folders, dict):
                    folders = folders.get("Items") or folders.get("items") or []
                if isinstance(folders, list):
                    for f in folders:
                        if not isinstance(f, dict) or f.get("Id") is None:
                            continue
                        fid = int(f["Id"])
                        due_raw = (
                            f.get("DueDate")
                            or f.get("EndDate")
                            or f.get("StartDate")
                        )
                        dropbox_due_by_folder_id[fid] = _parse_iso_dt(due_raw)
            except Exception:
                pass

        def _due_date_for_grade_item(it: Dict[str, Any]) -> Optional[datetime]:
            assoc = it.get("AssociatedTool") or {}
            tool_id = assoc.get("ToolId")
            tool_item_id = assoc.get("ToolItemId")

            if tool_id == 2000 and tool_item_id is not None:
                try:
                    return dropbox_due_by_folder_id.get(int(tool_item_id))
                except Exception:
                    return None

            return _parse_iso_dt(
                it.get("DueDate") or it.get("EndDate") or it.get("dueDate")
            )

        due_date_by_id: Dict[int, Optional[datetime]] = {}
        for it in items_in_scope:
            gid = int(it["Id"])
            due_date_by_id[gid] = _due_date_for_grade_item(it)

        _now = datetime.now(timezone.utc)

        async def _calc_one(uid: int) -> Tuple[int, Dict[str, Any]]:
            vals = await list_values_fn(orgUnitId, uid)

            by_id: Dict[int, Dict[str, Any]] = {}
            if isinstance(vals, list):
                for v in vals:
                    if not isinstance(v, dict):
                        continue
                    # Brightspace puede usar distintos nombres según la versión del API
                    raw_gid = (
                        v.get("GradeObjectIdentifier")
                        or v.get("Id")
                        or v.get("id")
                        or v.get("GradeObjectId")
                    )
                    if raw_gid is None:
                        continue
                    try:
                        gid = int(raw_gid)
                    except Exception:
                        continue
                    by_id[gid] = v

            graded_count = 0
            graded_weight = 0.0
            weighted_num_sum = 0.0
            weighted_den_sum = 0.0

            pending_ungraded_count = 0
            pending_ungraded_weight_sum = 0.0

            overdue_unscored_count = 0
            overdue_unscored_weight_sum = 0.0

            points_acc: List[Tuple[float, float]] = []

            for gid, w in item_weight_by_id.items():
                v = by_id.get(gid) or {}
                is_graded_v = _is_graded_value(v)
                due_dt = due_date_by_id.get(gid)
                is_overdue = bool(due_dt and due_dt < _now)

                if is_graded_v:
                    graded_count += 1
                    graded_weight += w
                else:
                    if is_overdue:
                        overdue_unscored_count += 1
                        overdue_unscored_weight_sum += w
                    else:
                        pending_ungraded_count += 1
                        pending_ungraded_weight_sum += w

                wn = v.get("WeightedNumerator")
                wd = v.get("WeightedDenominator")
                try:
                    if wn is not None and wd is not None and float(wd) > 0:
                        weighted_num_sum += float(wn)
                        weighted_den_sum += float(wd)
                except Exception:
                    pass

                pn = v.get("PointsNumerator")
                pd = v.get("PointsDenominator")
                if pn is not None and pd is not None:
                    try:
                        pd_f = float(pd)
                        if pd_f > 0:
                            points_acc.append(((float(pn) / pd_f) * 100.0, w))
                    except Exception:
                        pass

            coverage_pct = (
                round((graded_weight / total_weight) * 100.0, 1)
                if total_weight > 0 else 0.0
            )
            pending_ungraded_weight_pct = (
                round((pending_ungraded_weight_sum / total_weight) * 100.0, 1)
                if total_weight > 0 else 0.0
            )
            overdue_unscored_weight_pct = (
                round((overdue_unscored_weight_sum / total_weight) * 100.0, 1)
                if total_weight > 0 else 0.0
            )

            current_perf_pct: Optional[float] = None
            if weighted_den_sum > 0:
                current_perf_pct = round(
                    (weighted_num_sum / weighted_den_sum) * 100.0, 1
                )
            elif points_acc and sum(w for _, w in points_acc) > 0:
                current_perf_pct = round(weighted_avg(points_acc), 1)

            return uid, {
                "coveragePct": coverage_pct,
                "gradedItemsCount": graded_count,
                "totalItemsCount": total_items_count,
                "coverageCountText": (
                    f"{graded_count}/{total_items_count}"
                    if total_items_count else "0/0"
                ),
                "currentPerformancePct": current_perf_pct,
                "pendingUngradedCount": pending_ungraded_count,
                "pendingUngradedWeightPct": pending_ungraded_weight_pct,
                "overdueUnscoredCount": overdue_unscored_count,
                "overdueUnscoredWeightPct": overdue_unscored_weight_pct,
                # compatibilidad temporal
                "notSubmittedCount": overdue_unscored_count,
                "notSubmittedWeightPct": overdue_unscored_weight_pct,
            }

        # Semáforo para limitar concurrencia a Brightspace (evita rate-limit / timeout)
        _sem = asyncio.Semaphore(8)

        async def _calc_one_limited(uid: int):
            async with _sem:
                return await _calc_one(uid)

        pairs = await asyncio.gather(
            *[_calc_one_limited(uid) for uid in student_ids],
            return_exceptions=True,
        )

        out: Dict[int, Dict[str, Any]] = {}
        for p in pairs:
            if isinstance(p, Exception):
                continue
            try:
                uid, metrics = p
                out[uid] = metrics
            except Exception:
                continue

        return out