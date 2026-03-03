# app/services/brightspace_client.py
import os
from typing import Any, Dict, Optional, List, Union

import httpx
from app.state import TOKENS

JsonType = Union[Dict[str, Any], List[Any]]


class BrightspaceClient:
    def __init__(self, tokens: Optional[Dict[str, Any]] = None):
        self.base_url = os.getenv("BRIGHTSPACE_BASE_URL", "").rstrip("/")

        # LE (Learning Environment) API version
        self.lp_version = os.getenv("BRIGHTSPACE_LP_VERSION", "1.50")

        # Gradebook usa LE también
        self.grade_version = os.getenv("BRIGHTSPACE_GRADE_VERSION", self.lp_version)

        # LO endpoint (en tu caso lo estás consumiendo desde LE 1.92)
        self.lo_version = os.getenv("BRIGHTSPACE_LO_VERSION", "1.92")

        self.tokens = tokens or {}
        if not self.base_url:
            raise RuntimeError("Falta BRIGHTSPACE_BASE_URL en variables de entorno")

    def _auth_headers(self) -> Dict[str, str]:
        token = self.tokens.get("access_token")
        if not token:
            raise RuntimeError(
                f"No hay access_token en TOKENS. Claves actuales: {list(self.tokens.keys())}"
            )
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def _ensure_json(r: httpx.Response, url: str) -> None:
        if r.status_code != 200:
            raise RuntimeError(f"Brightspace error {r.status_code} en {url}: {r.text[:800]}")
        ct = (r.headers.get("content-type") or "").lower()
        if "application/json" not in ct:
            raise RuntimeError(f"Respuesta no JSON ({r.status_code}) en {url}: {r.text[:300]}")

    async def _request_json(
        self,
        method: str,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> JsonType:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.request(method, url, headers=self._auth_headers(), params=params)
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

    # -------------------------
    # Gradebook (LE API)
    # -------------------------
    async def list_grade_items(self, orgUnitId: int) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/d2l/api/le/{self.grade_version}/{orgUnitId}/grades/"
        data = await self._request_json("GET", url)
        return self._as_list_of_dicts(data)

    async def get_grade_value(self, orgUnitId: int, gradeObjectId: int, userId: int) -> Dict[str, Any]:
        url = (
            f"{self.base_url}/d2l/api/le/{self.grade_version}/{orgUnitId}"
            f"/grades/{int(gradeObjectId)}/values/{int(userId)}"
        )
        data = await self._request_json("GET", url)
        return data if isinstance(data, dict) else {"data": data}

    async def list_grade_values_for_user(self, orgUnitId: int, userId: int) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/d2l/api/le/{self.grade_version}/{orgUnitId}/grades/values/{int(userId)}/"
        data = await self._request_json("GET", url)
        return self._as_list_of_dicts(data)

    # -------------------------
    # Classlist / Dropbox
    # -------------------------
    async def list_classlist(self, orgUnitId: int) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/d2l/api/le/{self.lp_version}/{orgUnitId}/classlist/"
        data = await self._request_json("GET", url)
        return self._as_list_of_dicts(data)

    async def list_dropbox_folders(self, orgUnitId: int) -> JsonType:
        url = f"{self.base_url}/d2l/api/le/{self.lp_version}/{orgUnitId}/dropbox/folders/"
        return await self._request_json("GET", url)

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
            "objectType": "Dropbox",
            "objectId": str(folderId),
            "rubricId": str(rubricId),
            "userId": str(userId),
        }
        data = await self._request_json("GET", url, params=params)
        return data if isinstance(data, dict) else {"data": data}

    # -------------------------
    # Learning Outcomes (Outcome Sets)
    # -------------------------
    async def list_outcome_sets(self, orgUnitId: int) -> JsonType:
        """
        Endpoint que tú validaste:
        GET /d2l/api/le/1.92/{orgUnitId}/lo/outcomeSets/
        """
        url = f"{self.base_url}/d2l/api/le/{self.lo_version}/{orgUnitId}/lo/outcomeSets/"
        return await self._request_json("GET", url)


def get_brightspace_client() -> BrightspaceClient:
    return BrightspaceClient(tokens=TOKENS)
