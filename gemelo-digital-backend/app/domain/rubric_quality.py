from typing import Dict, Any, List

KEYWORDS_EXCELLENCE = ["excelente", "sobresaliente", "alto", "avanzado"]
KEYWORDS_LOW = ["insuficiente", "bajo", "incipiente", "inicial", "deficiente"]

def detect_rubric_inconsistency(rubric_detail: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Heurística simple: si el nivel más bajo contiene lenguaje de excelencia repetido,
    o si niveles se contradicen de forma obvia.
    Devuelve lista de señales.
    """
    signals = []
    # TODO: adaptar a la estructura real del payload.
    # Ejemplo de enfoque:
    # - identificar "lowest level" por puntos o por orden
    # - leer descriptores de criterios
    # - contar keywords
    return signals