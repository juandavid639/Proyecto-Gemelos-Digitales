# app/services/brightspace_client.py
import os
from typing import Any, Dict, Optional, List, Union

import httpx
from fastapi import Request, HTTPException

from app.state import get_access_token

JsonType = Union[Dict[str, Any], List[Any]]

# Cookie name must match what main.py sets
SESSION_COOKIE = "gemelo_session_id"


def _extract_session_id(request: Optional[Request]) -> Optional[str]:
    """Extrae el session_id de la cookie de la request."""
    if request is None:
        return None
    return request.cookies.get(SESSION_COOKIE)


def _resolve_token(request: Optional[Request], tokens: Optional[Dict[str, Any]]) -> str:
    """
    Resuelve el access_token con esta prioridad:
    1. tokens dict explícito (legacy)
    2. Authorization: Bearer <session_id> header (cross-domain)
    3. Cookie gemelo_session_id
    Lanza 401 si no hay token.
    """
    # 1. dict explícito (legacy)
    if tokens:
        t = tokens.get("access_token")
        if t:
            return t

    if request:
        # 2. Authorization: Bearer <session_id> header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            sid_from_header = auth_header[7:].strip()
            if sid_from_header:
                t = get_access_token(sid_from_header)
                if t:
                    return t

        # 3. Cookie de sesión
        sid = _extract_session_id(request)
        if sid:
            t = get_access_token(sid)
            if t:
                return t

    raise HTTPException(
        status_code=401,
        detail=(
            "No autenticado. "
            "Inicia sesión en /auth/brightspace/login "
            "o accede desde Brightspace mediante LTI."
        ),
    )


class BrightspaceClient:
    def __init__(
        self,
        tokens: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None,
    ):
        self.base_url = os.getenv("BRIGHTSPACE_BASE_URL", "").rstrip("/")
        self.lp_version   = os.getenv("BRIGHTSPACE_LP_VERSION",    "1.50")
        self.grade_version = os.getenv("BRIGHTSPACE_GRADE_VERSION", "1.50")
        self.lo_version    = os.getenv("BRIGHTSPACE_LO_VERSION",    "1.92")

        self._tokens  = tokens or {}
        self._request = request

        if not self.base_url:
            raise RuntimeError("Falta BRIGHTSPACE_BASE_URL en variables de entorno")

    def _auth_headers(self) -> Dict[str, str]:
        token = _resolve_token(self._request, self._tokens)
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def _ensure_json(r: httpx.Response, url: str) -> None:
        if r.status_code != 200:
            raise RuntimeError(
                f"Brightspace error {r.status_code} en {url}: {r.text[:800]}"
            )
        ct = (r.headers.get("content-type") or "").lower()
        if "application/json" not in ct:
            raise RuntimeError(
                f"Respuesta no JSON ({r.status_code}) en {url}: {r.text[:300]}"
            )

    async def _request_json(
        self,
        method: str,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> JsonType:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.request(
                method, url, headers=self._auth_headers(), params=params
            )
        self._ensure_json(r, url)
        return r.json()

    @staticmethod
    def _as_list_of_dicts(data: JsonType) -> List[Dict[str, Any]]:
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            for k in ("Items", "items", "Objects", "objects"):
                v = data.get(k)
                if isinstance(v, list):
                    return [x for x in v if isinstance(x, dict)]
        return []

    # ── Gradebook ─────────────────────────────────────────────────────────────
    async def list_grade_items(self, orgUnitId: int) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/d2l/api/le/{self.grade_version}/{orgUnitId}/grades/"
        data = await self._request_json("GET", url)
        return self._as_list_of_dicts(data)

    async def list_grade_categories(self, orgUnitId: int) -> List[Dict[str, Any]]:
        """Fetch grade categories (Parcial 1, Quizzes, etc.) for a course.
        Returns [] if the tenant doesn't expose them or on error."""
        url = (
            f"{self.base_url}/d2l/api/le/{self.grade_version}/{orgUnitId}"
            f"/grades/categories/"
        )
        try:
            data = await self._request_json("GET", url)
            return self._as_list_of_dicts(data)
        except Exception:
            return []

    async def get_grade_value(
        self, orgUnitId: int, gradeObjectId: int, userId: int
    ) -> Dict[str, Any]:
        url = (
            f"{self.base_url}/d2l/api/le/{self.grade_version}/{orgUnitId}"
            f"/grades/{int(gradeObjectId)}/values/{int(userId)}"
        )
        data = await self._request_json("GET", url)
        return data if isinstance(data, dict) else {"data": data}

    async def list_grade_values_for_user(
        self, orgUnitId: int, userId: int
    ) -> List[Dict[str, Any]]:
        url = (
            f"{self.base_url}/d2l/api/le/{self.grade_version}/{orgUnitId}"
            f"/grades/values/{int(userId)}/"
        )
        data = await self._request_json("GET", url)
        return self._as_list_of_dicts(data)

    # ── Classlist / Dropbox ───────────────────────────────────────────────────
    async def list_classlist(self, orgUnitId: int) -> List[Dict[str, Any]]:
        url = (
            f"{self.base_url}/d2l/api/le/{self.lp_version}/{orgUnitId}/classlist/"
        )
        data = await self._request_json("GET", url)
        return self._as_list_of_dicts(data)

    async def list_dropbox_folders(self, orgUnitId: int) -> JsonType:
        url = (
            f"{self.base_url}/d2l/api/le/{self.lp_version}/{orgUnitId}"
            f"/dropbox/folders/"
        )
        return await self._request_json("GET", url)

    async def list_dropbox_submissions_for_user(
        self,
        orgUnitId: int,
        folderId: int,
        userId: int,
    ) -> List[Dict[str, Any]]:
        url = (
            f"{self.base_url}/d2l/api/le/{self.lp_version}/{orgUnitId}"
            f"/dropbox/folders/{int(folderId)}/submissions/"
        )
        data = await self._request_json("GET", url)
        items = self._as_list_of_dicts(data)
        result = []
        for sub in items:
            entity_id = sub.get("EntityId") or sub.get("UserId") or sub.get("userId")
            try:
                if int(entity_id) == int(userId):
                    result.append(sub)
            except Exception:
                continue
        return result

    async def get_dropbox_rubric_assessment(
        self,
        orgUnitId: int,
        folderId: int,
        rubricId: int,
        userId: int,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/d2l/api/le/unstable/{orgUnitId}/assessment"
        params = {
            "assessmentType": "Rubric",
            "objectType":     "Dropbox",
            "objectId":       str(folderId),
            "rubricId":       str(rubricId),
            "userId":         str(userId),
        }
        data = await self._request_json("GET", url, params=params)
        return data if isinstance(data, dict) else {"data": data}

    # ── Learning Outcomes ─────────────────────────────────────────────────────
    async def list_outcome_sets(self, orgUnitId: int) -> JsonType:
        url = (
            f"{self.base_url}/d2l/api/le/{self.lo_version}/{orgUnitId}"
            f"/lo/outcomeSets/"
        )
        return await self._request_json("GET", url)


# ── Dependency FastAPI ────────────────────────────────────────────────────────
def get_brightspace_client(request: Request) -> BrightspaceClient:
    """
    Dependency de FastAPI. Crea un BrightspaceClient con el token
    de la sesión del usuario que hace la request.
    """
    return BrightspaceClient(request=request)