# app/api/gemelo.py
import logging
import traceback
from typing import Any, Dict, List, Optional
import asyncio
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config_loader import load_course_bundle
from app.services.brightspace_client import get_brightspace_client
from app.services.gemelo_service import GemeloService

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/gemelo", tags=["Gemelo Digital"])


def get_service(bs=Depends(get_brightspace_client)) -> GemeloService:
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

@app.get("/health")
def health():
    return {"status": "ok"}

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

        return {
            "orgUnitId": orgUnitId,
            "totalStudents": total_students,
            "updatedAt": last_updated_at,
            "ras": ras,
        }

    except Exception as e:
        _http500(e, "gemelo_course_ra_dashboard", orgUnitId=orgUnitId)


@router.get("/course/{orgUnitId}/students")
async def gemelo_course_students(
    orgUnitId: int,
    with_metrics: bool = Query(False),
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

        if with_metrics and items:
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
                enriched.append({**s, "gradebook": m})
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