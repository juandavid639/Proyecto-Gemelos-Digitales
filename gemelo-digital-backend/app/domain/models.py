from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

ModelType = Literal["competencias", "resultados_aprendizaje"]
ScaleType = Literal["level_points", "criterion_max_points"]

class ScaleConfig(BaseModel):
    type: ScaleType
    maxLevelPoints: Optional[float] = None  # requerido si type == level_points
    thresholds: Dict[str, float]  # {"critical": 50, "watch": 70}

class CriterionMapItem(BaseModel):
    code: str
    weight: float = 1.0
    name: str

class RubricConfig(BaseModel):
    name: str
    criteriaMap: Dict[str, CriterionMapItem]  # key: criterionId (string)

class PrescriptionRuleWhen(BaseModel):
    code: str
    belowPct: float

class PrescriptionRuleDo(BaseModel):
    routeId: str
    title: str
    actions: List[str]

class PrescriptionRule(BaseModel):
    when: PrescriptionRuleWhen
    do: PrescriptionRuleDo

class CourseConfig(BaseModel):
    orgUnitId: int
    modelType: ModelType
    scale: ScaleConfig
    rubrics: Dict[str, RubricConfig]          # key: rubricId (string)
    prescription: Optional[Dict[str, Any]] = None  # {"rules":[...]}

class Thresholds(BaseModel):
    critical: float = 50
    watch: float = 70


class InstitutionalScale(BaseModel):
    thresholds: Thresholds = Field(default_factory=Thresholds)


class AutoDiscover(BaseModel):
    enabled: bool = True
    includeToolIds: List[int] = Field(default_factory=list)
    excludeByNameContains: List[str] = Field(default_factory=list)


class GradingPolicy(BaseModel):
    includeGradeObjectIds: List[int] = Field(default_factory=list)
    excludeGradeObjectIds: List[int] = Field(default_factory=list)
    autoDiscover: AutoDiscover = Field(default_factory=AutoDiscover)


class ScenarioPendingPct(BaseModel):
    risk: float = 50
    improve: float = 70


class ProjectionConfig(BaseModel):
    scenarioPendingPct: ScenarioPendingPct = Field(default_factory=ScenarioPendingPct)


class CourseInstitutionConfig(BaseModel):
    orgUnitId: int
    modelVersion: str = "default.v1"
    maturityProfile: int = 0
    gradingPolicy: GradingPolicy = Field(default_factory=GradingPolicy)
    scale: InstitutionalScale = Field(default_factory=InstitutionalScale)
    projection: ProjectionConfig = Field(default_factory=ProjectionConfig)