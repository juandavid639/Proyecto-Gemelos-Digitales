# app/api/gemelo.py
import logging
import traceback
from typing import Any, Dict, List, Optional
import asyncio
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config_loader import load_course_bundle
from app.services.brightspace_client import get_brightspace_client
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.services.brightspace_client import BrightspaceClient
from app.services.gemelo_service import GemeloService

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/gemelo", tags=["gemelo"])

# Cache simple en memoria para el RA dashboard (evita recalcular en cada refresh)
import time as _time
_RA_DASHBOARD_CACHE: dict = {}
_RA_DASHBOARD_TTL = 300  # 5 minutos



def get_service(
    request: Request,
    bs: "BrightspaceClient" = Depends(get_brightspace_client),
) -> GemeloService:
    return GemeloService(bs)


def _dump(obj: Any) -> Dict[str, Any]:
    """
    Convierte Pydantic/dataclass/obj a dict de forma defensiva.
    Cubre los casos que causaban el error:
      - obj es None o Ellipsis (...)
      - obj es un tipo primitivo (str, int, bool)
      - obj es Pydantic con campos en Ellipsis
      - obj no tiene __dict__
    """
    # Casos nulos o centinela
    if obj is None or obj is ...:
        return {}

    # Ya es dict: devolver directo
    if isinstance(obj, dict):
        # Filtramos valores Ellipsis que puedan venir en el dict
        return {k: v for k, v in obj.items() if v is not ...}

    # Tipos primitivos: no tienen sentido como dict
    if isinstance(obj, (str, int, float, bool, list, tuple, set)):
        return {}

    # Pydantic v2
    if hasattr(obj, "model_dump"):
        try:
            result = obj.model_dump()
            if isinstance(result, dict):
                return result
        except Exception as e:
            logger.warning("_dump model_dump() falló: %s", e)

    # Pydantic v1
    if hasattr(obj, "dict"):
        try:
            result = obj.dict()
            if isinstance(result, dict):
                return result
        except Exception as e:
            logger.warning("_dump .dict() falló: %s", e)

    # Dataclass / objeto genérico con __dict__
    try:
        raw = vars(obj)
        # Filtramos Ellipsis y privados
        return {
            k: v
            for k, v in raw.items()
            if not k.startswith("_") and v is not ...
        }
    except TypeError:
        # vars() falla en objetos sin __dict__ (built-ins, slots, etc.)
        logger.warning("_dump vars() falló para tipo %s", type(obj))
        return {}


def _safe_bundle(orgUnitId: int) -> Dict[str, Any]:
    """
    Carga el bundle del curso de forma segura.
    Si no existe o falla, retorna dict vacío sin propagar la excepción.
    Centraliza el try/except para no repetirlo en cada endpoint.
    """
    try:
        return load_course_bundle(orgUnitId) or {}
    except FileNotFoundError:
        return {}
    except Exception as e:
        logger.warning("_safe_bundle orgUnitId=%s error=%s", orgUnitId, e)
        return {}


def _http500(e: Exception, where: str, **ctx):
    logger.error("HTTP 500 en %s | ctx=%s | err=%s", where, ctx, str(e))
    logger.error(traceback.format_exc())
    raise HTTPException(status_code=500, detail=str(e))


# =========================================================
# Endpoints productivos
# =========================================================

@router.get("/course/{orgUnitId}/student/{userId}")
async def gemelo_course_student(
    orgUnitId: int,
    userId: int,
    svc: GemeloService = Depends(get_service),
):
    try:
        return await svc.build_gemelo(orgUnitId, userId)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        _http500(e, "gemelo_course_student", orgUnitId=orgUnitId, userId=userId)


@router.get("/course/{orgUnitId}/overview")
async def gemelo_course_overview(
    orgUnitId: int,
    svc: GemeloService = Depends(get_service),
):
    try:
        return await svc.build_course_overview(orgUnitId)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        _http500(e, "gemelo_course_overview", orgUnitId=orgUnitId)


@router.get("/course/{orgUnitId}/ra/dashboard")
async def gemelo_course_ra_dashboard(
    orgUnitId: int,
    only_students: bool = Query(True, description="Si true, filtra roles de estudiante"),
    limit: Optional[int] = Query(None, ge=1, le=500, description="Max usuarios a procesar (para piloto)"),
    concurrency: int = Query(8, ge=1, le=25, description="Concurrencia de cómputo (no subir demasiado)"),
    svc: GemeloService = Depends(get_service),
):
    """
    Agrega RA1/RA2/RA3 a nivel curso a partir del cálculo existente del gemelo
    por estudiante. Retorna promedio (%) y cobertura por RA.
    """
    try:
        now_ts = _time.time()
        cached = _RA_DASHBOARD_CACHE.get(orgUnitId)
        if cached and (now_ts - cached["ts"] < _RA_DASHBOARD_TTL):
            # Solo usar cache si tiene datos reales (al menos 1 RA con studentsWithData > 0)
            cached_ras = (cached["data"].get("ras") or [])
            has_real_data = any(r.get("studentsWithData", 0) > 0 for r in cached_ras)
            if has_real_data:
                return cached["data"]
            # Cache vacío/inválido → recalcular

        students_payload = await svc.list_course_students(orgUnitId)
        items = (
            students_payload.get("items") or []
            if isinstance(students_payload, dict)
            else []
        )

        if not items:
            return {
                "orgUnitId": orgUnitId,
                "totalStudents": 0,
                "ras": [],
                "updatedAt": None,
                "note": "Sin estudiantes en list_course_students()",
            }

        if only_students:
            items = [
                s for s in items
                if _is_student_role(s.get("roleName") or s.get("RoleName"))
            ]

        if limit:
            items = items[:limit]

        user_ids: List[int] = []
        for s in items:
            uid = s.get("userId") or s.get("UserId") or s.get("UserID")
            if uid is None:
                continue
            try:
                user_ids.append(int(uid))
            except Exception:
                continue

        total_students = len(user_ids)
        if total_students == 0:
            return {
                "orgUnitId": orgUnitId,
                "totalStudents": 0,
                "ras": [],
                "updatedAt": None,
            }

        coros = [svc.build_gemelo(orgUnitId, uid) for uid in user_ids]
        results = await _gather_with_semaphore(coros, limit=concurrency)

        agg: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"sum": 0.0, "count": 0}
        )
        last_updated_at: Optional[str] = None

        for r in results:
            if isinstance(r, Exception) or not isinstance(r, dict):
                continue

            try:
                upd = (
                    (r.get("summary") or {}).get("updatedAt")
                    or (r.get("course") or {}).get("updatedAt")
                )
                if upd:
                    last_updated_at = upd
            except Exception:
                pass

            macro_units = (r.get("macro") or {}).get("units") or []
            for u in macro_units:
                code = u.get("code")
                pct = u.get("pct")
                if not code or pct is None:
                    continue
                try:
                    agg[code]["sum"] += float(pct)
                    agg[code]["count"] += 1
                except Exception:
                    continue

        ras = []
        for code in sorted(agg.keys()):
            count = agg[code]["count"]
            avg = round(agg[code]["sum"] / count, 1) if count else None
            coverage_pct = (
                round((count / total_students) * 100.0, 1)
                if total_students else 0.0
            )
            ras.append({
                "code": code,
                "label": code,
                "avgPct": avg,
                "coveragePct": coverage_pct,
                "studentsWithData": count,
                "totalStudents": total_students,
            })

        payload = {
            "orgUnitId": orgUnitId,
            "totalStudents": total_students,
            "updatedAt": last_updated_at,
            "ras": ras,
        }

        _RA_DASHBOARD_CACHE[orgUnitId] = {"ts": _time.time(), "data": payload}
        return payload

    except Exception as e:
        _http500(e, "gemelo_course_ra_dashboard", orgUnitId=orgUnitId)


@router.get("/course/{orgUnitId}/students")
async def gemelo_course_students(
    orgUnitId: int,
    with_metrics: bool = Query(False),
    include: Optional[str] = Query(None),   # "summary" → activa métricas batch
    svc: GemeloService = Depends(get_service),
):
    try:
        bundle = _safe_bundle(orgUnitId)

        # ── Extraer course de forma segura ──────────────────────────────────
        # bundle puede ser:
        #   a) {"course": <PydanticModel>, "rubricsModel": ...}  → caso normal
        #   b) {}                                                 → sin config
        #   c) el propio modelo de curso directamente             → config plana
        #
        # NO hacemos `bundle.get("course") or bundle` porque si "course" existe
        # pero es un objeto Pydantic con campos en Ellipsis, el `or` lo ignora
        # y cae al bundle entero, propagando el mismo problema.
        raw_course = bundle.get("course") if isinstance(bundle, dict) else bundle
        course_dict = _dump(raw_course) if raw_course is not None else {}

        students = await svc.list_course_students(orgUnitId)

        # Thresholds de forma segura
        scale = course_dict.get("scale")
        thresholds = (
            scale.get("thresholds")
            if isinstance(scale, dict)
            else None
        )

        course_brief = {
            "orgUnitId": orgUnitId,
            "modelType": (
                course_dict.get("modelType")
                or course_dict.get("maturityProfile")
            ),
            "maturityProfile": course_dict.get("maturityProfile"),
            "scale": scale,
            "thresholds": thresholds,
        }

        items: List[Dict[str, Any]] = students.get("items") or []

        # include=summary es alias de with_metrics=true (usado por el frontend)
        load_metrics = with_metrics or (include == "summary")

        if load_metrics and items:
            student_ids = [
                int(x["userId"])
                for x in items
                if x.get("userId") is not None
            ]
            # Pasamos raw_course (el objeto original), no course_dict,
            # porque compute_students_gradebook_metrics ya llama _as_dict internamente
            metrics_by_user = await svc.compute_students_gradebook_metrics(
                orgUnitId, student_ids, raw_course
            )

            enriched = []
            for s in items:
                uid = int(s["userId"])
                m = metrics_by_user.get(uid, {})
                enriched.append({**s, "summary": m, "gradebook": m})
            items = enriched

        return {
            "course": course_brief,
            "students": {
                "count": students.get("count", 0),
                "items": items,
            },
        }

    except Exception as e:
        _http500(e, "gemelo_course_students", orgUnitId=orgUnitId)


@router.get("/config/{orgUnitId}")
def get_course_config(orgUnitId: int):
    try:
        bundle = load_course_bundle(orgUnitId)
        # Dumpeamos el bundle completo, no solo "course"
        bundle_dict = _dump(bundle) if bundle is not None else {}
        return {
            "course": bundle_dict,
            "hasRubricsModel": (
                bundle.get("rubricsModel") is not None
                if isinstance(bundle, dict)
                else hasattr(bundle, "rubricsModel")
            ),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        _http500(e, "get_course_config", orgUnitId=orgUnitId)


# =========================================================
# Endpoints de debug
# =========================================================

@router.get("/debug/{orgUnitId}/folders")
async def debug_folders(
    orgUnitId: int,
    svc: GemeloService = Depends(get_service),
):
    try:
        data = await svc.bs.list_dropbox_folders(orgUnitId)
        return {"orgUnitId": orgUnitId, "pythonType": str(type(data)), "data": data}
    except Exception as e:
        _http500(e, "debug_folders", orgUnitId=orgUnitId)


@router.get("/debug/{orgUnitId}/rubric/{rubricId}")
async def debug_rubric(
    orgUnitId: int,
    rubricId: str,
    svc: GemeloService = Depends(get_service),
):
    try:
        return await svc.bs.get_rubric_detail(orgUnitId, rubricId)
    except Exception as e:
        _http500(e, "debug_rubric", orgUnitId=orgUnitId, rubricId=rubricId)


@router.get("/course/{orgUnitId}/learning-outcomes")
async def gemelo_learning_outcomes(
    orgUnitId: int,
    svc: GemeloService = Depends(get_service),
):
    try:
        data = await svc.bs.list_outcome_sets(orgUnitId)
        return {"orgUnitId": orgUnitId, "outcomeSets": data}
    except Exception as e:
        _http500(e, "gemelo_learning_outcomes", orgUnitId=orgUnitId)


@router.get("/course/{orgUnitId}/grade-items")
async def gemelo_grade_items(
    orgUnitId: int,
    svc: GemeloService = Depends(get_service),
):
    """Return all grade items + dropbox folders in the course with their
    due dates. Used by the frontend to build the course-wide due date calendar.

    Merges TWO sources:
    1. Grade items (gradebook columns) — may have DueDate/EndDate
    2. Dropbox folders (assignments) — usually have DueDate set even when
       the linked grade item does not (Brightspace UX puts DueDate on the
       dropbox folder, not the grade item).

    Both sources are linked via AssociatedTool.ToolItemId on grade items.

    Returns:
        {orgUnitId, count, items: [{id, name, weight, maxPoints, dueDate,
                                    endDate, gradeType, source}]}
    """
    import asyncio

    async def _safe_grade_items():
        try:
            raw = await svc.bs.list_grade_items(orgUnitId)
            if isinstance(raw, dict):
                return raw.get("Items") or raw.get("items") or []
            return raw if isinstance(raw, list) else []
        except Exception:
            return []

    async def _safe_dropbox_folders():
        try:
            raw = await svc.bs.list_dropbox_folders(orgUnitId)
            if isinstance(raw, dict):
                return raw.get("Items") or raw.get("items") or []
            return raw if isinstance(raw, list) else []
        except Exception:
            return []

    def _pick_dropbox_due_date(df: dict) -> Optional[str]:
        """Extract a usable due/end date from a dropbox folder, trying several
        fields because Brightspace stores dates in different places depending
        on whether the teacher configured a real DueDate or only Availability."""
        if not isinstance(df, dict):
            return None
        # Direct fields (older API shape)
        direct = df.get("DueDate") or df.get("EndDate")
        if direct:
            return direct
        # Newer API shape: Availability { StartDate, EndDate, DueDate }
        availability = df.get("Availability") or {}
        if isinstance(availability, dict):
            for k in ("DueDate", "EndDate", "dueDate", "endDate"):
                if availability.get(k):
                    return availability[k]
        # RestrictedDueDate etc.
        for k in ("RestrictedDueDate", "SubmissionEndDate"):
            if df.get(k):
                return df[k]
        return None

    try:
        grade_items, dropbox_folders = await asyncio.gather(
            _safe_grade_items(),
            _safe_dropbox_folders(),
        )

        # Build dropbox lookup by Id (and by GradeItemId for cross-ref)
        dropbox_by_id = {}
        dropbox_by_grade_item = {}
        for df in dropbox_folders:
            if not isinstance(df, dict):
                continue
            df_id = df.get("Id") or df.get("Identifier")
            if df_id is not None:
                dropbox_by_id[str(df_id)] = df
            grade_item_id = df.get("GradeItemId")
            if grade_item_id is not None:
                dropbox_by_grade_item[str(grade_item_id)] = df

        items = []
        seen_dropbox_ids = set()

        # 1. Grade items — try to enrich with dropbox folder due dates
        for it in grade_items:
            if not isinstance(it, dict):
                continue
            grade_id = it.get("Id") or it.get("Identifier")
            name = it.get("Name")
            due_date = it.get("DueDate")
            end_date = it.get("EndDate")

            # Try to find an associated dropbox folder via AssociatedTool
            # Brightspace uses ToolId=1 OR ToolId=2000 for Dropbox depending on
            # the API version. Try both.
            associated = it.get("AssociatedTool") or {}
            tool_item_id = associated.get("ToolItemId")
            tool_id = associated.get("ToolId")
            linked_dropbox = None
            if tool_id in (1, 2000) and tool_item_id is not None:
                linked_dropbox = dropbox_by_id.get(str(tool_item_id))
            if not linked_dropbox and grade_id is not None:
                linked_dropbox = dropbox_by_grade_item.get(str(grade_id))

            if linked_dropbox:
                seen_dropbox_ids.add(str(linked_dropbox.get("Id") or ""))
                # Prefer dropbox due date if grade item doesn't have one
                df_due = _pick_dropbox_due_date(linked_dropbox)
                if not due_date:
                    due_date = df_due
                if not end_date:
                    end_date = df_due

            items.append({
                "id": grade_id,
                "name": name,
                "weightPct": it.get("Weight"),
                "maxPoints": it.get("MaxPoints"),
                "dueDate": due_date,
                "endDate": end_date,
                "gradeType": it.get("GradeType"),
                "categoryId": it.get("CategoryId"),
                "source": "grade_item",
                "linkedDropboxId": (linked_dropbox or {}).get("Id"),
            })

        # 2. Dropbox folders that aren't linked to any grade item yet
        #    (e.g. assignments created but not yet graded)
        for df in dropbox_folders:
            if not isinstance(df, dict):
                continue
            df_id = df.get("Id") or df.get("Identifier")
            if str(df_id) in seen_dropbox_ids:
                continue
            df_due = _pick_dropbox_due_date(df)
            items.append({
                "id": df_id,
                "name": df.get("Name"),
                "weightPct": None,
                "maxPoints": None,
                "dueDate": df_due,
                "endDate": df_due,
                "gradeType": "Dropbox",
                "categoryId": df.get("CategoryId"),
                "source": "dropbox",
                "linkedDropboxId": df_id,
            })

        return {
            "orgUnitId": orgUnitId,
            "count": len(items),
            "gradeItemsCount": len(grade_items),
            "dropboxFoldersCount": len(dropbox_folders),
            "items": items,
        }
    except Exception as e:
        msg = str(e)
        if "403" in msg or "401" in msg or "404" in msg:
            return {"orgUnitId": orgUnitId, "count": 0, "items": [], "error": msg[:200]}
        _http500(e, "gemelo_grade_items", orgUnitId=orgUnitId)


@router.get(
    "/debug/{orgUnitId}/folder/{folderId}/student/{userId}/rubric/{rubricId}/assessment"
)
async def debug_assessment(
    orgUnitId: int,
    folderId: int,
    userId: int,
    rubricId: int,
    svc: GemeloService = Depends(get_service),
):
    try:
        return await svc.bs.get_dropbox_rubric_assessment(
            orgUnitId=orgUnitId,
            folderId=folderId,
            rubricId=rubricId,
            userId=userId,
        )
    except Exception as e:
        _http500(
            e, "debug_assessment",
            orgUnitId=orgUnitId, folderId=folderId,
            userId=userId, rubricId=rubricId,
        )


@router.get("/debug/{orgUnitId}/classlist")
async def debug_classlist(
    orgUnitId: int,
    full: bool = Query(False, description="Si true, devuelve la lista completa"),
    limit: int = Query(3, ge=1, le=500, description="Tamaño del sample cuando full=false"),
    svc: GemeloService = Depends(get_service),
):
    try:
        data = await svc.bs.list_classlist(orgUnitId)

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("Items") or data.get("items") or []
        else:
            items = []

        payload = {
            "orgUnitId": orgUnitId,
            "pythonType": str(type(data)),
            "count": len(items),
        }
        payload["items" if full else "sample"] = items if full else items[:limit]
        return payload
    except Exception as e:
        _http500(e, "debug_classlist", orgUnitId=orgUnitId)


@router.get("/debug/{orgUnitId}/grades/items")
async def debug_grade_items(
    orgUnitId: int,
    svc: GemeloService = Depends(get_service),
):
    try:
        data = await svc.bs.list_grade_items(orgUnitId)

        if isinstance(data, dict):
            data_list = data.get("Items") or data.get("items") or []
        else:
            data_list = data if isinstance(data, list) else []

        parsed = []
        for it in (data_list[:10] if isinstance(data_list, list) else []):
            if isinstance(it, dict):
                parsed.append({
                    "Id": it.get("Id") or it.get("Identifier"),
                    "Name": it.get("Name"),
                    "Weight": it.get("Weight"),
                    "GradeType": it.get("GradeType"),
                    "CategoryId": it.get("CategoryId"),
                    # Incluimos fechas para diagnóstico del "no enviado"
                    "DueDate": it.get("DueDate"),
                    "EndDate": it.get("EndDate"),
                })

        return {
            "orgUnitId": orgUnitId,
            "pythonType": str(type(data)),
            "count": len(data_list) if isinstance(data_list, list) else None,
            "parsedSample": parsed,
            "rawSample": data_list[:5] if isinstance(data_list, list) else data_list,
        }
    except Exception as e:
        _http500(e, "debug_grade_items", orgUnitId=orgUnitId)


@router.get("/debug/{orgUnitId}/grades/{gradeObjectId}/student/{userId}")
async def debug_grade_value(
    orgUnitId: int,
    gradeObjectId: int,
    userId: int,
    svc: GemeloService = Depends(get_service),
):
    try:
        data = await svc.bs.get_grade_value(orgUnitId, gradeObjectId, userId)
        return {
            "orgUnitId": orgUnitId,
            "gradeObjectId": gradeObjectId,
            "userId": userId,
            "pythonType": str(type(data)),
            "raw": data,
            "extracted": {
                "PointsNumerator": data.get("PointsNumerator") if isinstance(data, dict) else None,
                "PointsDenominator": data.get("PointsDenominator") if isinstance(data, dict) else None,
                "WeightedNumerator": data.get("WeightedNumerator") if isinstance(data, dict) else None,
                "WeightedDenominator": data.get("WeightedDenominator") if isinstance(data, dict) else None,
            },
        }
    except Exception as e:
        _http500(
            e, "debug_grade_value",
            orgUnitId=orgUnitId, gradeObjectId=gradeObjectId, userId=userId,
        )


# =========================================================
# Helpers internos
# =========================================================

def _is_student_role(role_name: Optional[str]) -> bool:
    """Filtra solo estudiantes. Si no viene rol, no bloquea."""
    if not role_name:
        return True
    rn = role_name.lower()
    return ("student" in rn) or ("estudiante" in rn) or ("learner" in rn)


async def _gather_with_semaphore(coros, limit: int = 10):
    """Ejecuta corutinas con límite de concurrencia."""
    sem = asyncio.Semaphore(limit)

    async def runner(c):
        async with sem:
            return await c

    return await asyncio.gather(*(runner(c) for c in coros), return_exceptions=True)