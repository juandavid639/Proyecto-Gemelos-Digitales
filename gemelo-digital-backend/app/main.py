import os
import secrets
import urllib.parse
import httpx
import logging

from fastapi.responses import JSONResponse
from app.api.lti_keys import get_jwks  # lo creamos abajo

from fastapi import FastAPI, Request, Query
from fastapi.responses import RedirectResponse, JSONResponse
from app.state import TOKENS
from app.api.gemelo import router as gemelo_router
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api import lti



logger = logging.getLogger("uvicorn.error")

# Crear UNA sola instancia de FastAPI
app = FastAPI(title="Gemelo Digital - Backend")
app.include_router(lti.router)

# Registrar el router del gemelo
app.include_router(gemelo_router)

# ==============================
# Configuración Brightspace
# ==============================
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://cesa.brightspace.com",
    "https://grown-duplicate-site-oral.trycloudflare.com",
    "https://gemelo.cesa.edu.co",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,   # si manejas cookies/sesión
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... luego tus routers
# app.include_router(...)

BRIGHTSPACE_BASE_URL = os.getenv("BRIGHTSPACE_BASE_URL", "")
LP_VERSION = os.getenv("BRIGHTSPACE_LP_VERSION", "1.50")

BRIGHTSPACE_AUTH_URL = os.getenv(
    "BRIGHTSPACE_AUTH_URL",
    "https://auth.brightspace.com/oauth2/auth"
)
BRIGHTSPACE_TOKEN_URL = os.getenv(
    "BRIGHTSPACE_TOKEN_URL",
    "https://auth.brightspace.com/core/connect/token"
)

CLIENT_ID = os.getenv("BRIGHTSPACE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("BRIGHTSPACE_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("BRIGHTSPACE_REDIRECT_URI", "")
SCOPE = os.getenv("BRIGHTSPACE_SCOPE", "Application:*:* Data:*:*")

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend_dist")
FRONTEND_DIST = os.path.abspath(FRONTEND_DIST)

if os.path.isdir(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/.well-known/jwks.json")
def well_known_jwks():
    return JSONResponse(get_jwks())


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})

@app.get("/health")
def health():
    return {"status": "ok", "service": "gemelo-digital-backend"}


@app.get("/auth/brightspace/login")
def brightspace_login():
    if not CLIENT_ID or not REDIRECT_URI:
        return JSONResponse(
            status_code=500,
            content={"error": "Faltan variables: BRIGHTSPACE_CLIENT_ID y/o BRIGHTSPACE_REDIRECT_URI"},
        )

    state = secrets.token_urlsafe(24)
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
    }

    url = f"{BRIGHTSPACE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@app.get("/auth/brightspace/callback")
async def brightspace_callback(request: Request):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")
    error_description = request.query_params.get("error_description")

    if error:
        return JSONResponse(
            status_code=400,
            content={
                "message": "Brightspace devolvió error",
                "error": error,
                "error_description": error_description,
                "state": state,
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
                "error": "Faltan variables: BRIGHTSPACE_CLIENT_ID / BRIGHTSPACE_CLIENT_SECRET / BRIGHTSPACE_REDIRECT_URI"
            },
        )

    data = {
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "code": code,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(BRIGHTSPACE_TOKEN_URL, data=data)

    if resp.status_code != 200:
        return JSONResponse(
            status_code=resp.status_code,
            content={
                "message": "Fallo intercambiando code por token",
                "status": resp.status_code,
                "body": resp.text,
            },
        )

    token_json = resp.json()

    # ✅ Guarda TODO el token JSON en el TOKENS compartido (app.state.TOKENS)
    TOKENS.clear()
    TOKENS.update(token_json)

    access_preview = (TOKENS.get("access_token") or "")[:20] + "..." if TOKENS.get("access_token") else None

    return JSONResponse(
        content={
            "message": "Token obtenido correctamente",
            "access_token_preview": access_preview,
            "has_refresh_token": bool(TOKENS.get("refresh_token")),
            "expires_in": TOKENS.get("expires_in"),
            "scope": TOKENS.get("scope"),
            "state": state,
            "token_keys": list(TOKENS.keys()),  # útil en piloto
        }
    )


@app.get("/debug/tokens")
def debug_tokens():
    return {
        "keys": list(TOKENS.keys()),
        "has_access_token": "access_token" in TOKENS
    }

@app.get("/brightspace/whoami")
async def brightspace_whoami():
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/users/whoami"
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(status_code=resp.status_code, content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text})

@app.get("/brightspace/my-courses")
async def brightspace_my_courses(bookmark: str | None = Query(default=None)):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        whoami_url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/users/whoami"
        w = await client.get(whoami_url, headers=headers)
        if w.status_code != 200:
            return JSONResponse(status_code=w.status_code, content={"message": "Falló whoami", "status": w.status_code, "body": w.text})
        user_id = w.json().get("Identifier")

        enroll_url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/enrollments/users/{user_id}/orgUnits/"
        params = {}
        if bookmark:
            params["bookmark"] = bookmark

        e = await client.get(enroll_url, headers=headers, params=params)
        if e.status_code != 200:
            return JSONResponse(status_code=e.status_code, content={"message": "Falló enrollments", "status": e.status_code, "body": e.text})

    return e.json()

@app.get("/brightspace/my-course-offerings")
async def brightspace_my_course_offerings(bookmark: str | None = Query(default=None)):
    data = await brightspace_my_courses(bookmark=bookmark)  # reutiliza la lógica
    if isinstance(data, JSONResponse):
        return data

    items = data.get("Items", [])
    offerings = []
    for it in items:
        ou = it.get("OrgUnit", {})
        t = ou.get("Type", {})
        if t.get("Code") == "Course Offering":
            offerings.append({"id": ou.get("Id"), "name": ou.get("Name"), "code": ou.get("Code")})

    return {
        "paging": data.get("PagingInfo"),
        "items": offerings
    }

@app.get("/brightspace/course/{org_unit_id}")
async def brightspace_course(org_unit_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/courses/{org_unit_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(
        status_code=resp.status_code,
        content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text},
    )

from fastapi import Query

@app.get("/brightspace/course/{org_unit_id}/classlist")
async def brightspace_classlist(org_unit_id: int, search: str | None = Query(default=None)):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    # Lista usuarios enrolados en el curso (puede ser larga)
    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/enrollments/orgUnits/{org_unit_id}/users/"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        return JSONResponse(status_code=resp.status_code, content={"message": "Falló classlist", "status": resp.status_code, "body": resp.text})

    data = resp.json()
    items = data.get("Items", [])

    # Filtro simple por nombre o email si nos pasas 'search'
    if search:
        s = search.lower()
        items = [
            u for u in items
            if s in (u.get("User", {}).get("FirstName","").lower())
            or s in (u.get("User", {}).get("LastName","").lower())
            or s in (u.get("User", {}).get("UniqueName","").lower())
        ]

    # Reducir payload para uso práctico
    compact = []
    for u in items:
        usr = u.get("User", {})
        compact.append({
            "UserId": usr.get("Identifier"),
            "FirstName": usr.get("FirstName"),
            "LastName": usr.get("LastName"),
            "UniqueName": usr.get("UniqueName"),
            "RoleName": u.get("Role", {}).get("Name"),
        })

    return {"count": len(compact), "items": compact}

@app.get("/brightspace/users/{user_id}")
async def brightspace_user(user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/lp/{LP_VERSION}/users/{user_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(
        status_code=resp.status_code,
        content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text},
    )


@app.get("/brightspace/course/{org_unit_id}/grades/items")
async def brightspace_grade_items(org_unit_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/grades/"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(status_code=resp.status_code, content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text})

@app.get("/brightspace/course/{org_unit_id}/grades/student/{user_id}")
async def brightspace_grade_values(org_unit_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/grades/values/{user_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(status_code=resp.status_code, content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text})

@app.get("/brightspace/course/{org_unit_id}/grades/{grade_object_id}/student/{user_id}")
async def brightspace_grade_value_by_item(org_unit_id: int, grade_object_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/grades/{grade_object_id}/values/{user_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(
        status_code=resp.status_code,
        content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text},
    )

@app.get("/brightspace/course/{org_unit_id}/grades/student/{user_id}/evidence")
async def brightspace_student_evidence(org_unit_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    items_url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/grades/"

    async with httpx.AsyncClient(timeout=30) as client:
        items_resp = await client.get(items_url, headers=headers)
        if items_resp.status_code != 200:
            return JSONResponse(status_code=items_resp.status_code, content={"message": "Falló grades/items", "status": items_resp.status_code, "body": items_resp.text})

        items = items_resp.json()

        evidences = []
        for it in items:
            grade_object_id = it.get("Id")
            name = it.get("Name")
            max_points = it.get("MaxPoints")
            weight = it.get("Weight")

            value_url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/grades/{grade_object_id}/values/{user_id}"
            v = await client.get(value_url, headers=headers)

            if v.status_code == 200 and v.headers.get("content-type","").startswith("application/json"):
                val = v.json()
                evidences.append({
                    "gradeObjectId": grade_object_id,
                    "name": name,
                    "maxPoints": max_points,
                    "weight": weight,
                    "points": val.get("PointsNumerator"),
                    "displayed": val.get("DisplayedGrade"),
                    "commentsHtml": (val.get("Comments") or {}).get("Html", ""),
                    "lastModified": val.get("LastModified"),
                })
            else:
                # sin nota liberada o no disponible
                evidences.append({
                    "gradeObjectId": grade_object_id,
                    "name": name,
                    "maxPoints": max_points,
                    "weight": weight,
                    "points": None,
                    "displayed": None,
                    "commentsHtml": "",
                    "lastModified": None,
                })

    return {
        "orgUnitId": org_unit_id,
        "userId": user_id,
        "count": len(evidences),
        "items": evidences
    }

@app.get("/brightspace/course/{org_unit_id}/gradeitem/{grade_object_id}")
async def brightspace_gradeitem_detail(org_unit_id: int, grade_object_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/grades/{grade_object_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(
        status_code=resp.status_code,
        content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text},
    )

@app.get("/brightspace/course/{org_unit_id}/assignments/{assignment_id}")
async def brightspace_assignment(org_unit_id: int, assignment_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/{assignment_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(
        status_code=resp.status_code,
        content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text},
    )

@app.get("/brightspace/course/{org_unit_id}/assignment/{assignment_id}/rubric/student/{user_id}")
async def brightspace_rubric_evaluation(org_unit_id: int, assignment_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/{assignment_id}/feedback/{user_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    return JSONResponse(
        status_code=resp.status_code,
        content=resp.json() if resp.headers.get("content-type","").startswith("application/json") else {"body": resp.text},
    )

@app.get("/brightspace/course/{org_unit_id}/dropbox/{folder_id}/feedback/user/{user_id}")
async def brightspace_dropbox_feedback_user(org_unit_id: int, folder_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/{folder_id}/feedback/user/{user_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    # Respuesta “diagnóstico” (nunca ciega)
    content_type = resp.headers.get("content-type", "")
    return JSONResponse(
        status_code=resp.status_code,
        content={
            "status": resp.status_code,
            "content_type": content_type,
            "json": resp.json() if content_type.startswith("application/json") and resp.text else None,
            "body": resp.text,
        }
    )
@app.get("/brightspace/course/{org_unit_id}/dropbox/{folder_id}/rubric/{rubric_id}/assessment/user/{user_id}")
async def brightspace_rubric_assessment_dropbox_user(org_unit_id: int, folder_id: int, rubric_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    # Este endpoint usa query params
    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/assessment"
    params = {
        "assessmentType": "Rubric",
        "objectType": "Dropbox",
        "objectId": str(folder_id),
        "rubricId": str(rubric_id),
        "userId": str(user_id),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers, params=params)

    content_type = resp.headers.get("content-type", "")
    return JSONResponse(
        status_code=resp.status_code,
        content={
            "status": resp.status_code,
            "content_type": content_type,
            "json": resp.json() if content_type.startswith("application/json") and resp.text else None,
            "body": resp.text,
        }
    )

def _level_name_from_assignment_rubric(assignment_json, level_id: int) -> str | None:
    rubrics = (assignment_json.get("Assessment") or {}).get("Rubrics") or []
    if not rubrics:
        return None
    cg = (rubrics[0].get("CriteriaGroups") or [])
    if not cg:
        return None
    levels = (cg[0].get("Levels") or [])
    for lv in levels:
        if lv.get("Id") == level_id:
            return lv.get("Name")
    return None

def _criterion_max_points(assignment_json, criterion_id: int) -> float | None:
    rubrics = (assignment_json.get("Assessment") or {}).get("Rubrics") or []
    if not rubrics:
        return None
    cg = (rubrics[0].get("CriteriaGroups") or [])
    if not cg:
        return None
    criteria = (cg[0].get("Criteria") or [])
    for c in criteria:
        if c.get("Id") == criterion_id:
            pts = [cell.get("Points") for cell in (c.get("Cells") or []) if cell.get("Points") is not None]
            return float(max(pts)) if pts else None
    return None

def _criterion_name(assignment_json, criterion_id: int) -> str | None:
    rubrics = (assignment_json.get("Assessment") or {}).get("Rubrics") or []
    if not rubrics:
        return None
    cg = (rubrics[0].get("CriteriaGroups") or [])
    if not cg:
        return None
    criteria = (cg[0].get("Criteria") or [])
    for c in criteria:
        if c.get("Id") == criterion_id:
            return c.get("Name")
    return None

@app.get("/brightspace/course/{org_unit_id}/dropbox/folders")
async def brightspace_dropbox_folders(org_unit_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(
            status_code=401,
            content={"error": "No hay access_token. Reautentica /auth/brightspace/login"}
        )

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        return JSONResponse(
            status_code=resp.status_code,
            content={
                "message": "Falló consulta Dropbox folders",
                "status": resp.status_code,
                "body": resp.text
            }
        )

    return resp.json()

@app.get("/gemelo/course/{org_unit_id}/assignment/{folder_id}/student/{user_id}")
async def gemelo_assignment(org_unit_id: int, folder_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    assignment_url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/{folder_id}"
    feedback_url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/{folder_id}/feedback/user/{user_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        a = await client.get(assignment_url, headers=headers)
        f = await client.get(feedback_url, headers=headers)

    if a.status_code != 200:
        return JSONResponse(status_code=a.status_code, content={"message": "Falló assignment", "status": a.status_code, "body": a.text})
    if f.status_code != 200:
        return JSONResponse(status_code=f.status_code, content={"message": "Falló feedback", "status": f.status_code, "body": f.text})

    assignment = a.json()
    feedback = f.json()

    rubric_assessments = feedback.get("RubricAssessments") or []
    if not rubric_assessments:
        return {"message": "No hay RubricAssessments", "orgUnitId": org_unit_id, "folderId": folder_id, "userId": user_id}

    ra = rubric_assessments[0]
    criteria_outcome = ra.get("CriteriaOutcome") or []

    items = []
    for co in criteria_outcome:
        criterion_id = co.get("CriterionId")
        level_id = co.get("LevelId")
        score = co.get("Score")

        max_pts = _criterion_max_points(assignment, criterion_id)
        level_name = _level_name_from_assignment_rubric(assignment, level_id)
        crit_name = _criterion_name(assignment, criterion_id)

        pct = None
        if score is not None and max_pts:
            pct = round((float(score) / float(max_pts)) * 100, 1)

        items.append({
            "criterionId": criterion_id,
            "criterionName": crit_name,
            "levelId": level_id,
            "levelName": level_name,
            "score": score,
            "maxPoints": max_pts,
            "pct": pct,
        })

    # MVP de recomendación (umbral)
    gaps = [it for it in items if (it.get("pct") is not None and it["pct"] < 70)]
    recommendation = {
        "focus": "Fortalecer criterios por debajo de 70%",
        "priorityCriteria": [g["criterionName"] for g in gaps],
    } if gaps else {
        "focus": "Mantener y escalar desempeño",
        "priorityCriteria": [],
    }

    return {
        "orgUnitId": org_unit_id,
        "folderId": folder_id,
        "userId": user_id,
        "activityName": assignment.get("Name"),
        "score": feedback.get("Score"),
        "feedback": feedback.get("Feedback"),
        "rubricId": ra.get("RubricId"),
        "overallScore": ra.get("OverallScore"),
        "criteria": items,
        "recommendation": recommendation,
    }

@app.get("/brightspace/course/{org_unit_id}/dropbox/folder/{folder_id}/assessment/{user_id}")
async def brightspace_dropbox_assessment(org_unit_id: int, folder_id: int, user_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(
            status_code=401,
            content={"error": "No hay access_token. Reautentica /auth/brightspace/login"}
        )

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/{folder_id}/feedback/user/{user_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        return JSONResponse(
            status_code=resp.status_code,
            content={
                "message": "Falló consulta assessment",
                "status": resp.status_code,
                "body": resp.text
            }
        )

    return resp.json()

@app.get("/brightspace/course/{org_unit_id}/dropbox/folder/{folder_id}")
async def brightspace_dropbox_folder(org_unit_id: int, folder_id: int):
    access_token = TOKENS.get("access_token")
    if not access_token:
        return JSONResponse(status_code=401, content={"error": "No hay access_token. Reautentica /auth/brightspace/login"})

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Authentication": f"Bearer {access_token}",
    }

    url = f"{BRIGHTSPACE_BASE_URL}/d2l/api/le/{LP_VERSION}/{org_unit_id}/dropbox/folders/{folder_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        return JSONResponse(status_code=resp.status_code, content={"message": "Falló folder detail", "status": resp.status_code, "body": resp.text})

    return resp.json()

async def get_dropbox_rubric_assessment(self, orgUnitId: int, folderId: int, userId: int):
    url = f"{self.base_url}/d2l/api/le/{self.lp_version}/{orgUnitId}/dropbox/folders/{folderId}/feedback/user/{userId}"

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=self._auth_headers())

    if r.status_code != 200:
        raise RuntimeError(f"Brightspace error {r.status_code} en {url}: {r.text[:800]}")

    # Validación de content-type para evitar parseos rotos
    ct = r.headers.get("content-type", "")
    if not ct.startswith("application/json"):
        raise RuntimeError(f"Respuesta no JSON ({r.status_code}) en {url}: {r.text[:300]}")

    return r.json()


FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend_dist"))

if os.path.isdir(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_index():
        index = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return JSONResponse({"detail": "Frontend not built"}, status_code=404)

    # Fallback SPA: SOLO para rutas que NO sean API
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # protege APIs y well-known
        if full_path.startswith((
            "auth/", "gemelo/", "lti/", ".well-known/",
            "health", "debug/", "docs", "openapi.json"
        )):
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        index = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return JSONResponse({"detail": "Frontend not built"}, status_code=404)

