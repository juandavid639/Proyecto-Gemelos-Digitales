
import os
import secrets
import urllib.parse
from datetime import datetime, timezone

import httpx
import logging

from fastapi import FastAPI, Request, Query
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.state import TOKENS
from app.api.gemelo import router as gemelo_router
from app.api.lti_keys import get_jwks
from app.api import lti

logger = logging.getLogger("uvicorn.error")

# ──────────────────────────────────────────────────────────────────────────────
# App
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Gemelo Digital - Backend")

app.include_router(lti.router)
app.include_router(gemelo_router)

# ──────────────────────────────────────────────────────────────────────────────
# CORS
# ──────────────────────────────────────────────────────────────────────────────
ALLOWED_ORIGIN_REGEX = (
    r"^https:\/\/(.*\.)?cesa\.edu\.co$"
    r"|^http:\/\/localhost(:\d+)?$"
    r"|^http:\/\/127\.0\.0\.1(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────────────────
# Configuración Brightspace
# ──────────────────────────────────────────────────────────────────────────────
BRIGHTSPACE_BASE_URL = (os.getenv("BRIGHTSPACE_BASE_URL", "") or "").rstrip("/")

# LP (Learning Platform) y LE (Learning Environment) son versiones distintas
LP_VERSION = os.getenv("BRIGHTSPACE_LP_VERSION", "1.50")
LE_VERSION  = os.getenv("BRIGHTSPACE_LE_VERSION",  "1.92")

BRIGHTSPACE_AUTH_URL  = os.getenv("BRIGHTSPACE_AUTH_URL",  "https://auth.brightspace.com/oauth2/auth")
BRIGHTSPACE_TOKEN_URL = os.getenv("BRIGHTSPACE_TOKEN_URL", "https://auth.brightspace.com/core/connect/token")

CLIENT_ID     = os.getenv("BRIGHTSPACE_CLIENT_ID",     "")
CLIENT_SECRET = os.getenv("BRIGHTSPACE_CLIENT_SECRET", "")
REDIRECT_URI  = os.getenv("BRIGHTSPACE_REDIRECT_URI",  "")
SCOPE         = os.getenv("BRIGHTSPACE_SCOPE",         "Application:*:* Data:*:*")

# ──────────────────────────────────────────────────────────────────────────────
# Static frontend (si existe build de Vite/React)
# ──────────────────────────────────────────────────────────────────────────────
FRONTEND_DIST = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend_dist")
)

if os.path.isdir(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers internos
# ──────────────────────────────────────────────────────────────────────────────
def _require_token():
    access_token = TOKENS.get("access_token")
    if not access_token:
        return None, JSONResponse(
            status_code=401,
            content={
                "error": (
                    "No hay access_token. "
                    "Reautentica en /auth/brightspace/login (en ESTE backend)."
                )
            },
        )
    return access_token, None


def _auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


async def _bs_get(
    url: str,
    headers: dict,
    params: dict | None = None,
    timeout: int = 30,
):
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, headers=headers, params=params)

    ct = (resp.headers.get("content-type") or "").lower()
    if ct.startswith("application/json"):
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, {"body": resp.text, "content_type": ct}

    # Brightspace puede devolver HTML en errores/redirects
    return resp.status_code, {"body": resp.text, "content_type": ct}


async def _get_whoami_id(headers: dict) -> tuple[str | None, JSONResponse | None]:
    """Retorna (user_id_str, None) o (None, error_response)."""
    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/users/whoami"
    status, data = await _bs_get(url, headers)
    if status != 200:
        return None, JSONResponse(
            status_code=status,
            content={"error": "whoami falló", "status": status, "detail": data},
        )
    uid = data.get("Identifier")
    if not uid:
        return None, JSONResponse(
            status_code=500,
            content={"error": "whoami no retornó Identifier", "data": data},
        )
    return str(uid), None


# ──────────────────────────────────────────────────────────────────────────────
# Health / Debug / JWKS
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "gemelo-digital-backend"}


@app.get("/debug/runtime")
def debug_runtime():
    return {
        "cors_mode": "regex",
        "allowed_origin_regex": ALLOWED_ORIGIN_REGEX,
        "lp_version": LP_VERSION,
        "le_version": LE_VERSION,
        "brightspace_base_url": BRIGHTSPACE_BASE_URL,
        "has_access_token": bool(TOKENS.get("access_token")),
    }


@app.get("/debug/tokens")
def debug_tokens():
    return {
        "keys": list(TOKENS.keys()),
        "has_access_token": "access_token" in TOKENS,
    }


@app.get("/.well-known/jwks.json")
def well_known_jwks():
    return JSONResponse(get_jwks())


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# ──────────────────────────────────────────────────────────────────────────────
# OAuth Brightspace
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/auth/brightspace/login")
def brightspace_login():
    if not CLIENT_ID or not REDIRECT_URI:
        return JSONResponse(
            status_code=500,
            content={
                "error": (
                    "Faltan variables: "
                    "BRIGHTSPACE_CLIENT_ID y/o BRIGHTSPACE_REDIRECT_URI"
                )
            },
        )
    state = secrets.token_urlsafe(24)
    params = {
        "client_id":     CLIENT_ID,
        "redirect_uri":  REDIRECT_URI,
        "response_type": "code",
        "scope":         SCOPE,
        "state":         state,
    }
    url = f"{BRIGHTSPACE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@app.get("/auth/brightspace/callback")
async def brightspace_callback(request: Request):
    code              = request.query_params.get("code")
    state             = request.query_params.get("state")
    error             = request.query_params.get("error")
    error_description = request.query_params.get("error_description")

    if error:
        return JSONResponse(
            status_code=400,
            content={
                "message":           "Brightspace devolvió error",
                "error":             error,
                "error_description": error_description,
                "state":             state,
            },
        )

    if not code:
        return JSONResponse(
            status_code=400,
            content={"message": "No llegó 'code' en el callback", "state": state},
        )

    if not CLIENT_ID or not CLIENT_SECRET or not REDIRECT_URI:
        return JSONResponse(
            status_code=500,
            content={
                "error": (
                    "Faltan variables: "
                    "BRIGHTSPACE_CLIENT_ID / BRIGHTSPACE_CLIENT_SECRET / BRIGHTSPACE_REDIRECT_URI"
                )
            },
        )

    data = {
        "grant_type":    "authorization_code",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri":  REDIRECT_URI,
        "code":          code,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(BRIGHTSPACE_TOKEN_URL, data=data)

    if resp.status_code != 200:
        return JSONResponse(
            status_code=resp.status_code,
            content={
                "message": "Fallo intercambiando code por token",
                "status":  resp.status_code,
                "body":    resp.text,
            },
        )

    token_json = resp.json()
    TOKENS.clear()
    TOKENS.update(token_json)

    access_preview = (
        (TOKENS.get("access_token") or "")[:20] + "..."
        if TOKENS.get("access_token")
        else None
    )

    return JSONResponse(
        content={
            "message":             "Token obtenido correctamente",
            "access_token_preview": access_preview,
            "has_refresh_token":   bool(TOKENS.get("refresh_token")),
            "expires_in":          TOKENS.get("expires_in"),
            "scope":               TOKENS.get("scope"),
            "state":               state,
            "token_keys":          list(TOKENS.keys()),
        }
    )


# ──────────────────────────────────────────────────────────────────────────────
# Brightspace: utilidades base
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/brightspace/whoami")
async def brightspace_whoami():
    access_token, err = _require_token()
    if err:
        return err

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/users/whoami"
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


# ──────────────────────────────────────────────────────────────────────────────
# Brightspace: Cursos del usuario autenticado
# ──────────────────────────────────────────────────────────────────────────────

async def _fetch_all_enrollments(
    headers: dict,
    user_id: str,
    org_unit_type_id: int | None = 3,   # 3 = Course Offering
    limit: int = 500,
) -> list[dict]:
    """
    Itera todas las páginas de matrículas de un usuario y retorna
    la lista completa de items. Sin límite de páginas (hasta `limit` items).

    orgUnitTypeId=3 → solo Course Offerings (excluye departamentos, secciones, etc.)
    """
    base_url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}"
        f"/enrollments/users/{user_id}/orgUnits/"
    )
    all_items: list[dict] = []
    bookmark: str | None  = None

    async with httpx.AsyncClient(timeout=45) as client:
        while len(all_items) < limit:
            params: dict = {}
            if org_unit_type_id is not None:
                params["orgUnitTypeId"] = org_unit_type_id
            if bookmark:
                params["bookmark"] = bookmark

            resp = await client.get(base_url, headers=headers, params=params)
            if resp.status_code != 200:
                logger.warning(
                    "_fetch_all_enrollments: Brightspace retornó %s — %s",
                    resp.status_code, resp.text[:200],
                )
                break

            data     = resp.json()
            page     = data.get("Items") or []
            all_items.extend(page)

            paging   = data.get("PagingInfo") or {}
            bookmark = paging.get("Bookmark")
            if not bookmark or not page:
                break  # no hay más páginas

    return all_items


def _normalize_offering(ou: dict) -> dict:
    """
    Convierte un OrgUnit de Brightspace al formato esperado por el frontend:
      { id, name, code, startDate, endDate, isActive }
    """
    start_raw = ou.get("StartDate")
    end_raw   = ou.get("EndDate")

    # Determinar isActive desde EndDate (si no hay EndDate, se asume activo)
    is_active = True
    if end_raw:
        try:
            end_dt   = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
            now_utc  = datetime.now(timezone.utc)
            is_active = end_dt >= now_utc
        except Exception:
            pass  # si el parse falla, no filtrar

    return {
        "id":        ou.get("Id"),
        "name":      ou.get("Name", ""),
        "code":      ou.get("Code", ""),
        "startDate": start_raw,
        "endDate":   end_raw,
        "isActive":  is_active,
    }


@app.get("/brightspace/my-courses")
async def brightspace_my_courses(bookmark: str | None = Query(default=None)):
    """
    Retorna UNA página de matrículas (raw Brightspace) del usuario autenticado.
    Útil como fallback o para debug. El frontend prefiere /my-course-offerings.
    """
    access_token, err = _require_token()
    if err:
        return err

    headers = _auth_headers(access_token)
    user_id, err = await _get_whoami_id(headers)
    if err:
        return err

    enroll_url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}"
        f"/enrollments/users/{user_id}/orgUnits/"
    )
    params: dict = {}
    if bookmark:
        params["bookmark"] = bookmark

    status, data = await _bs_get(enroll_url, headers, params)
    return JSONResponse(status_code=status, content=data)


@app.get("/brightspace/my-course-offerings")
async def brightspace_my_course_offerings(
    active_only: bool        = Query(default=True,  description="Solo cursos activos (EndDate >= hoy)"),
    search:      str | None  = Query(default=None,  description="Filtro por nombre (case-insensitive)"),
    limit:       int         = Query(default=500,   description="Máx. de items a traer de Brightspace"),
):
    """
    Lista todos los Course Offerings del docente autenticado.

    - Itera automáticamente la paginación de Brightspace.
    - Filtra por active_only y/o search si se pasan como query params.
    - Respuesta normalizada: { count, items: [{id, name, code, startDate, endDate, isActive}] }

    Scopes requeridos: enrollment:orgunit:read, users:profile:read (whoami)
    """
    access_token, err = _require_token()
    if err:
        return err

    headers = _auth_headers(access_token)
    user_id, err = await _get_whoami_id(headers)
    if err:
        return err

    # Traer todos los Course Offerings (orgUnitTypeId=3)
    all_items = await _fetch_all_enrollments(
        headers, user_id, org_unit_type_id=3, limit=limit
    )

    # Normalizar y filtrar
    offerings: list[dict] = []
    for item in all_items:
        ou = item.get("OrgUnit") or {}

        # Doble check: asegurar que es Course Offering
        if (ou.get("Type") or {}).get("Code") not in ("Course Offering", "CourseOffering"):
            # orgUnitTypeId=3 ya filtra en Brightspace, pero por seguridad
            ou_type_id = (ou.get("Type") or {}).get("Id")
            if ou_type_id != 3:
                continue

        offering = _normalize_offering(ou)

        # Filtro active_only
        if active_only and not offering["isActive"]:
            continue

        # Filtro search
        if search and search.lower() not in offering["name"].lower():
            continue

        offerings.append(offering)

    # Ordenar: cursos activos primero, luego por nombre
    offerings.sort(key=lambda x: (not x["isActive"], (x["name"] or "").lower()))

    return {
        "count":       len(offerings),
        "active_only": active_only,
        "items":       offerings,
    }


@app.get("/brightspace/courses/enrolled")
async def brightspace_courses_enrolled(
    active_only: bool       = Query(default=True),
    search:      str | None = Query(default=None),
):
    """
    Alias de /brightspace/my-course-offerings para compatibilidad con versiones
    anteriores del frontend que probaban esta ruta.
    """
    return await brightspace_my_course_offerings(
        active_only=active_only,
        search=search,
        limit=500,
    )


@app.get("/brightspace/courses/all")
async def brightspace_courses_all(
    search: str | None = Query(default=None),
    limit:  int        = Query(default=500),
):
    """
    Todos los cursos (activos e históricos). Útil para admin/debug.
    Equivale a /my-course-offerings?active_only=false
    """
    return await brightspace_my_course_offerings(
        active_only=False,
        search=search,
        limit=limit,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Brightspace: Curso individual
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/brightspace/course/{org_unit_id}")
async def brightspace_course(org_unit_id: int):
    """
    Detalle de un curso (OrgUnit) por ID.
    Retorna Name, Code, StartDate, EndDate, etc.
    """
    access_token, err = _require_token()
    if err:
        return err

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/courses/{org_unit_id}"
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


# ──────────────────────────────────────────────────────────────────────────────
# Brightspace: Classlist / Usuarios
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/brightspace/course/{org_unit_id}/classlist")
async def brightspace_classlist(
    org_unit_id: int,
    search:      str | None = Query(default=None),
):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}"
        f"/enrollments/orgUnits/{org_unit_id}/users/"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))

    if status != 200:
        return JSONResponse(
            status_code=status,
            content={"message": "Falló classlist", "data": data},
        )

    items = (data or {}).get("Items", []) if isinstance(data, dict) else []

    if search:
        s = search.lower().strip()
        items = [
            u for u in items
            if s in (u.get("User", {}).get("FirstName",  "").lower())
            or s in (u.get("User", {}).get("LastName",   "").lower())
            or s in (u.get("User", {}).get("UniqueName", "").lower())
        ]

    compact = []
    for u in items:
        usr = u.get("User", {}) or {}
        compact.append(
            {
                "UserId":    usr.get("Identifier"),
                "FirstName": usr.get("FirstName"),
                "LastName":  usr.get("LastName"),
                "UniqueName":usr.get("UniqueName"),
                "RoleName":  (u.get("Role", {}) or {}).get("Name"),
            }
        )

    return {"count": len(compact), "items": compact}


@app.get("/brightspace/users/{user_id}")
async def brightspace_user(user_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/users/{user_id}"
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


# ──────────────────────────────────────────────────────────────────────────────
# Brightspace: Content
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/brightspace/course/{org_unit_id}/content/root")
async def brightspace_content_root(org_unit_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}/{org_unit_id}/content/root/"
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


# ──────────────────────────────────────────────────────────────────────────────
# Brightspace: Grades
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/brightspace/course/{org_unit_id}/grades/items")
async def brightspace_grade_items(org_unit_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}/{org_unit_id}/grades/"
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


@app.get("/brightspace/course/{org_unit_id}/grades/student/{user_id}")
async def brightspace_grade_values(org_unit_id: int, user_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/grades/values/{user_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


@app.get("/brightspace/course/{org_unit_id}/grades/{grade_object_id}/student/{user_id}")
async def brightspace_grade_value_by_item(
    org_unit_id: int, grade_object_id: int, user_id: int
):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/grades/{grade_object_id}/values/{user_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


@app.get("/brightspace/course/{org_unit_id}/gradeitem/{grade_object_id}")
async def brightspace_gradeitem_detail(org_unit_id: int, grade_object_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/grades/{grade_object_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


@app.get("/brightspace/course/{org_unit_id}/grades/student/{user_id}/evidence")
async def brightspace_student_evidence(org_unit_id: int, user_id: int):
    """
    Retorna todas las evidencias (grade items + valores) de un estudiante.
    Llama a grades/ para la lista de items, luego a grades/{id}/values/{userId}
    para cada uno en paralelo.
    """
    access_token, err = _require_token()
    if err:
        return err

    headers   = _auth_headers(access_token)
    items_url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}/{org_unit_id}/grades/"

    async with httpx.AsyncClient(timeout=60) as client:
        items_resp = await client.get(items_url, headers=headers)
        if items_resp.status_code != 200:
            return JSONResponse(
                status_code=items_resp.status_code,
                content={
                    "message": "Falló grades/items",
                    "status":  items_resp.status_code,
                    "body":    items_resp.text,
                },
            )

        items     = items_resp.json()
        evidences = []

        for it in items:
            grade_object_id = it.get("Id")
            name            = it.get("Name")
            max_points      = it.get("MaxPoints")
            weight          = it.get("Weight")

            value_url = (
                f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
                f"/{org_unit_id}/grades/{grade_object_id}/values/{user_id}"
            )
            v  = await client.get(value_url, headers=headers)
            ct = v.headers.get("content-type", "")

            if v.status_code == 200 and ct.startswith("application/json") and v.text:
                val = v.json()
                evidences.append(
                    {
                        "gradeObjectId":  grade_object_id,
                        "name":           name,
                        "maxPoints":      max_points,
                        "weight":         weight,
                        "points":         val.get("PointsNumerator"),
                        "displayed":      val.get("DisplayedGrade"),
                        "commentsHtml":   (val.get("Comments") or {}).get("Html", ""),
                        "lastModified":   val.get("LastModified"),
                    }
                )
            else:
                evidences.append(
                    {
                        "gradeObjectId":  grade_object_id,
                        "name":           name,
                        "maxPoints":      max_points,
                        "weight":         weight,
                        "points":         None,
                        "displayed":      None,
                        "commentsHtml":   "",
                        "lastModified":   None,
                    }
                )

    return {
        "orgUnitId": org_unit_id,
        "userId":    user_id,
        "count":     len(evidences),
        "items":     evidences,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Brightspace: Dropbox / Assignments
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/brightspace/course/{org_unit_id}/dropbox/folders")
async def brightspace_dropbox_folders(org_unit_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))

    if status != 200:
        return JSONResponse(
            status_code=status,
            content={"message": "Falló consulta Dropbox folders", "data": data},
        )
    return data


@app.get("/brightspace/course/{org_unit_id}/dropbox/folder/{folder_id}")
async def brightspace_dropbox_folder(org_unit_id: int, folder_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/{folder_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))

    if status != 200:
        return JSONResponse(
            status_code=status,
            content={"message": "Falló folder detail", "data": data},
        )
    return data


@app.get("/brightspace/course/{org_unit_id}/assignments/{assignment_id}")
async def brightspace_assignment(org_unit_id: int, assignment_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/{assignment_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


@app.get("/brightspace/course/{org_unit_id}/assignment/{assignment_id}/rubric/student/{user_id}")
async def brightspace_rubric_evaluation(org_unit_id: int, assignment_id: int, user_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/{assignment_id}/feedback/{user_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(status_code=status, content=data)


@app.get("/brightspace/course/{org_unit_id}/dropbox/{folder_id}/feedback/user/{user_id}")
async def brightspace_dropbox_feedback_user(org_unit_id: int, folder_id: int, user_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/{folder_id}/feedback/user/{user_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))
    return JSONResponse(
        status_code=status,
        content=(
            {"status": status, **data}
            if isinstance(data, dict)
            else {"status": status, "data": data}
        ),
    )


@app.get("/brightspace/course/{org_unit_id}/dropbox/{folder_id}/rubric/{rubric_id}/assessment/user/{user_id}")
async def brightspace_rubric_assessment_dropbox_user(
    org_unit_id: int, folder_id: int, rubric_id: int, user_id: int
):
    access_token, err = _require_token()
    if err:
        return err

    headers = _auth_headers(access_token)
    url     = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}/{org_unit_id}/assessment"
    params  = {
        "assessmentType": "Rubric",
        "objectType":     "Dropbox",
        "objectId":       str(folder_id),
        "rubricId":       str(rubric_id),
        "userId":         str(user_id),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers, params=params)

    ct = resp.headers.get("content-type", "")
    return JSONResponse(
        status_code=resp.status_code,
        content={
            "status":       resp.status_code,
            "content_type": ct,
            "json":         resp.json() if ct.startswith("application/json") and resp.text else None,
            "body":         resp.text,
        },
    )


@app.get("/brightspace/course/{org_unit_id}/dropbox/folder/{folder_id}/assessment/{user_id}")
async def brightspace_dropbox_assessment(org_unit_id: int, folder_id: int, user_id: int):
    access_token, err = _require_token()
    if err:
        return err

    url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/{folder_id}/feedback/user/{user_id}"
    )
    status, data = await _bs_get(url, _auth_headers(access_token))

    if status != 200:
        return JSONResponse(
            status_code=status,
            content={"message": "Falló consulta assessment", "data": data},
        )
    return data


# ──────────────────────────────────────────────────────────────────────────────
# Gemelo: endpoints compuestos
# ──────────────────────────────────────────────────────────────────────────────

def _level_name_from_assignment_rubric(assignment_json: dict, level_id: int) -> str | None:
    rubrics = (assignment_json.get("Assessment") or {}).get("Rubrics") or []
    if not rubrics:
        return None
    cg = (rubrics[0].get("CriteriaGroups") or [])
    if not cg:
        return None
    for lv in (cg[0].get("Levels") or []):
        if lv.get("Id") == level_id:
            return lv.get("Name")
    return None


def _criterion_max_points(assignment_json: dict, criterion_id: int) -> float | None:
    rubrics = (assignment_json.get("Assessment") or {}).get("Rubrics") or []
    if not rubrics:
        return None
    cg = (rubrics[0].get("CriteriaGroups") or [])
    if not cg:
        return None
    for c in (cg[0].get("Criteria") or []):
        if c.get("Id") == criterion_id:
            pts = [
                cell.get("Points")
                for cell in (c.get("Cells") or [])
                if cell.get("Points") is not None
            ]
            return float(max(pts)) if pts else None
    return None


def _criterion_name(assignment_json: dict, criterion_id: int) -> str | None:
    rubrics = (assignment_json.get("Assessment") or {}).get("Rubrics") or []
    if not rubrics:
        return None
    cg = (rubrics[0].get("CriteriaGroups") or [])
    if not cg:
        return None
    for c in (cg[0].get("Criteria") or []):
        if c.get("Id") == criterion_id:
            return c.get("Name")
    return None


@app.get("/gemelo/course/{org_unit_id}/assignment/{folder_id}/student/{user_id}")
async def gemelo_assignment(org_unit_id: int, folder_id: int, user_id: int):
    """
    Combina los datos de un assignment (dropbox folder) con el feedback rubric
    de un estudiante específico para construir la vista de Gemelo.
    """
    access_token, err = _require_token()
    if err:
        return err

    headers      = _auth_headers(access_token)
    assignment_url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/{folder_id}"
    )
    feedback_url = (
        f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LE_VERSION}"
        f"/{org_unit_id}/dropbox/folders/{folder_id}/feedback/user/{user_id}"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        a = await client.get(assignment_url, headers=headers)
        f = await client.get(feedback_url,   headers=headers)

    if a.status_code != 200:
        return JSONResponse(
            status_code=a.status_code,
            content={"message": "Falló assignment", "status": a.status_code, "body": a.text},
        )
    if f.status_code != 200:
        return JSONResponse(
            status_code=f.status_code,
            content={"message": "Falló feedback", "status": f.status_code, "body": f.text},
        )

    assignment = a.json()
    feedback   = f.json()

    rubric_assessments = feedback.get("RubricAssessments") or []
    if not rubric_assessments:
        return {
            "message":   "No hay RubricAssessments",
            "orgUnitId": org_unit_id,
            "folderId":  folder_id,
            "userId":    user_id,
        }

    ra              = rubric_assessments[0]
    criteria_outcome = ra.get("CriteriaOutcome") or []

    items = []
    for co in criteria_outcome:
        criterion_id = co.get("CriterionId")
        level_id     = co.get("LevelId")
        score        = co.get("Score")

        max_pts    = _criterion_max_points(assignment, criterion_id)
        level_name = _level_name_from_assignment_rubric(assignment, level_id)
        crit_name  = _criterion_name(assignment, criterion_id)

        pct = None
        if score is not None and max_pts:
            pct = round((float(score) / float(max_pts)) * 100, 1)

        items.append(
            {
                "criterionId":   criterion_id,
                "criterionName": crit_name,
                "levelId":       level_id,
                "levelName":     level_name,
                "score":         score,
                "maxPoints":     max_pts,
                "pct":           pct,
            }
        )

    gaps = [it for it in items if (it.get("pct") is not None and it["pct"] < 70)]
    recommendation = (
        {
            "focus":            "Fortalecer criterios por debajo de 70%",
            "priorityCriteria": [g["criterionName"] for g in gaps],
        }
        if gaps
        else {
            "focus":            "Mantener y escalar desempeño",
            "priorityCriteria": [],
        }
    )

    return {
        "orgUnitId":    org_unit_id,
        "folderId":     folder_id,
        "userId":       user_id,
        "activityName": assignment.get("Name"),
        "score":        feedback.get("Score"),
        "feedback":     feedback.get("Feedback"),
        "rubricId":     ra.get("RubricId"),
        "overallScore": ra.get("OverallScore"),
        "criteria":     items,
        "recommendation": recommendation,
    }


# ──────────────────────────────────────────────────────────────────────────────
# SPA hosting (si hay build de Vite)
# ──────────────────────────────────────────────────────────────────────────────
if os.path.isdir(FRONTEND_DIST):

    @app.get("/")
    def serve_index():
        index = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return JSONResponse({"detail": "Frontend not built"}, status_code=404)

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Protege los prefijos de API para que el SPA fallback no los capture
        if full_path.startswith(
            (
                "auth/",
                "gemelo/",
                "lti/",
                ".well-known/",
                "health",
                "debug/",
                "docs",
                "openapi.json",
                "brightspace/",
            )
        ):
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        index = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return JSONResponse({"detail": "Frontend not built"}, status_code=404)
