import json
import os
from pathlib import Path
from typing import Any, Dict

def _courses_dir() -> Path:
    env_dir = os.getenv("COURSE_CONFIG_DIR")
    if env_dir:
        return Path(env_dir)

    root = Path(__file__).resolve().parent
    project_root = root.parent
    return project_root / "config" / "courses"

def load_course_bundle(orgUnitId: int) -> Dict[str, Any]:
    orgUnitId = int(orgUnitId)
    path = _courses_dir() / f"{orgUnitId}.json"

    # ✅ fallback institucional: NO romper si no existe config
    if not path.exists():
        return {
            "course": {
                "orgUnitId": orgUnitId,
                "modelType": None,
                "scale": {"thresholds": {"critical": 50, "watch": 70}},
                "rubrics": {},
            },
            "rubricsModel": {
                "orgUnitId": orgUnitId,
                "modelType": None,
                "scale": {"thresholds": {"critical": 50, "watch": 70}},
                "rubrics": {},
            },
            "grading": {},
            "sources": {
                "missing": True,
                "dir": str(_courses_dir()),
                "pathTried": str(path),
            },
        }

    data = json.loads(path.read_text(encoding="utf-8"))

    # Si tu JSON ya viene “plano”, lo envolvemos para que GemeloService no reviente
    if "course" in data or "rubricsModel" in data:
        return data

    return {
        "course": data,
        "rubricsModel": data,
        "grading": {},
        "sources": {"missing": False, "dir": str(_courses_dir()), "path": str(path)},
    }