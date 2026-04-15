export function toDate(x) {
  const d = x ? new Date(x) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const ms = Math.max(0, end.getTime() - start.getTime());
  return ms / (7 * 24 * 60 * 60 * 1000);
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function normStatus(x) {
  return String(x || "").toLowerCase().trim();
}

export function fmtPct(x) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return "—";
  return `${Number(x).toFixed(1)}%`;
}

export function fmtGrade10FromPct(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return "—";
  return (Number(pct) / 10).toFixed(1);
}

export function flattenOutcomeDescriptions(payload) {
  const sets = payload?.outcomeSets;
  if (!Array.isArray(sets)) return [];
  const flat = [];
  for (const s of sets) {
    for (const o of s?.Outcomes || []) {
      if (o?.Description) flat.push(String(o.Description));
    }
  }
  return flat;
}

export function isVisibleContentItem(item) {
  if (!item || typeof item !== "object") return false;
  if (item.IsHidden === true) return false;
  return Number(item.Type) !== 0;
}

export function safeAvg(list) {
  const nums = (Array.isArray(list) ? list : [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function pickCriticalMacroFromGemelo(g) {
  const arr = g?.macro?.units || g?.macroUnits || [];
  if (!Array.isArray(arr) || !arr.length) return null;
  const copy = arr
    .map((x) => ({ code: x.code, pct: Number(x.pct ?? x.avgPct ?? 0) }))
    .filter((x) => x.code);
  if (!copy.length) return null;
  copy.sort((a, b) => a.pct - b.pct);
  return copy[0];
}

export function computeRiskFromPct(pct) {
  if (pct == null || Number.isNaN(Number(pct))) return "pending";
  const p = Number(pct);
  if (p < 50) return "alto";
  if (p < 70) return "medio";
  return "bajo";
}

export function suggestRouteForStudent(s, thresholds) {
  const risk = String(s?.risk || "").toLowerCase();
  const perf = s?.currentPerformancePct != null ? Number(s.currentPerformancePct) : null;
  const cov = s?.coveragePct != null ? Number(s.coveragePct) : null;

  if (cov != null && cov < 40) {
    return {
      id: "route_coverage",
      title: "Ruta 0 — Activar evidencia",
      summary: "Priorizar calificación de evidencias pendientes.",
      actions: [
        "Identificar 1 evidencia crítica y publicarla esta semana",
        "Acordar fecha de entrega con el estudiante",
      ],
    };
  }

  if (risk === "alto") {
    return {
      id: "route_high_risk",
      title: "Ruta 1 — Recuperación",
      summary: "Intervención inmediata con plan corto (7 días).",
      actions: [
        "Reunión 1:1 (15 min) para acordar objetivo semanal",
        "Actividad de refuerzo o re-entrega enfocada en el error",
        "Retroalimentación concreta + checklist de mejora",
      ],
    };
  }

  if (risk === "medio" || (perf != null && perf < thresholds.watch)) {
    const macro = s?.mostCriticalMacro?.code;
    return {
      id: "route_watch",
      title: "Ruta 2 — Ajuste dirigido",
      summary: macro ? `Enfoque: ${macro} (${fmtPct(s?.mostCriticalMacro?.pct)})` : "Enfoque: desempeño general",
      actions: [
        "Microtarea guiada (30–45 min) sobre el punto débil",
        "Ejemplo resuelto + plantilla de entrega",
        "Seguimiento en próxima evidencia",
      ],
    };
  }

  return {
    id: "route_ok",
    title: "Ruta 3 — Mantener desempeño",
    summary: "Sostener ritmo y calidad.",
    actions: ["Mantener entregas a tiempo", "Extensión opcional: reto avanzado"],
  };
}

export function contentRhythmStatus(progressRatio) {
  const COLORS = { pending: "#98A2B3", critical: "#D92D20", watch: "#F79009", ok: "#12B76A" };
  if (progressRatio == null) {
    return { status: "pending", color: COLORS.pending, bg: "var(--pending-bg)", label: "Pendiente" };
  }
  if (progressRatio < 0.8) {
    return { status: "critico", color: COLORS.critical, bg: "var(--critical-bg)", label: "Crítico" };
  }
  if (progressRatio < 1.0) {
    return { status: "observacion", color: COLORS.watch, bg: "var(--watch-bg)", label: "En seguimiento" };
  }
  return { status: "solido", color: COLORS.ok, bg: "var(--ok-bg)", label: "Óptimo" };
}

/**
 * Parse a Brightspace grade item formula to extract the evidence names it
 * references.
 *
 * Example:
 *   AVG{ [Actividad I-1 - IA y Derechos de Autor.Puntos recibidos],
 *        [Actividad I-2 - ¿Listos para lanzar un chatbot?.Puntos recibidos] }
 *
 * Returns: ["Actividad I-1 - IA y Derechos de Autor",
 *           "Actividad I-2 - ¿Listos para lanzar un chatbot?"]
 */
export function parseFormulaReferences(formula) {
  if (!formula || typeof formula !== "string") return [];
  let decoded = formula;
  try {
    if (typeof document !== "undefined") {
      const txt = document.createElement("textarea");
      txt.innerHTML = formula;
      decoded = txt.value;
    }
  } catch {}
  const re = /\[([^\]]+?)\.(?:Puntos recibidos|Points Received|Puntos Recibidos|Puntos|Points|Calificaci[óo]n|Grade|Score|Max Points|Puntaje)\]/gi;
  const names = [];
  let m;
  while ((m = re.exec(decoded)) !== null) {
    const name = m[1].trim();
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length === 0) {
    const re2 = /\[([^\]]+?)\]/g;
    while ((m = re2.exec(decoded)) !== null) {
      const name = m[1].trim();
      if (name && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(name) && !names.includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

/**
 * Build "corte groups" for the Resumen por Cortes section.
 *
 * Returns: [
 *   {
 *     id: string,            // unique key
 *     name: string,          // group title
 *     period: number|null,   // cortePeriod if we can infer one
 *     aggregates: Evidence[],// corte summary items (Formula / isCorte)
 *     components: Evidence[],// the individual evidences that make up the corte
 *   },
 *   ...
 * ]
 *
 * Priority:
 *   1. If gradeCategories[] is provided (category-based grouping, most reliable):
 *      each category becomes a group. Items inside are split into
 *      aggregates (isCorte OR gradeType=Formula) vs components (the rest).
 *      Categories that contain no meaningful content are skipped.
 *
 *   2. Fallback for courses WITHOUT categories but with formula text:
 *      parse each corte's formula references (via matchEvidencesByFormula).
 *
 *   3. Last-resort fallback: if there's only ONE corte in the whole course
 *      and no categories, put every non-corte evidence under it. Better than
 *      showing an empty group (pattern common when course uses a Formula
 *      item that Brightspace doesn't expose the formula text for).
 */
export function buildCorteGroups(evidences, gradeCategories) {
  const list = Array.isArray(evidences) ? evidences : [];
  if (list.length === 0) return [];

  const corteItems = list.filter((e) => e?.isCorte === true);
  const nonCorteItems = list.filter((e) => e?.isCorte !== true);

  // ── Path 1: categories ────────────────────────────────────────────────
  const cats = Array.isArray(gradeCategories) ? gradeCategories : [];
  if (cats.length > 0) {
    const groups = [];
    const byId = new Map();
    for (const e of list) byId.set(String(e.gradeObjectId), e);

    for (const cat of cats) {
      const ids = Array.isArray(cat?.itemIds) ? cat.itemIds : [];
      const itemsInCat = ids
        .map((id) => byId.get(String(id)))
        .filter(Boolean);
      if (itemsInCat.length === 0) continue;

      const aggregates = itemsInCat.filter(
        (e) => e.isCorte === true || String(e.gradeType || "").toLowerCase() === "formula"
      );
      const components = itemsInCat.filter(
        (e) => e.isCorte !== true && String(e.gradeType || "").toLowerCase() !== "formula"
      );

      // Skip empty groups. Keep categories that have at least one item.
      if (aggregates.length === 0 && components.length === 0) continue;

      // Infer a corte period from the category name or from any aggregate
      let period = null;
      const nm = String(cat?.name || "");
      const m = nm.match(/\b(?:CORTE|Corte|C)\s*([1-4])\b/);
      if (m) period = parseInt(m[1], 10);
      if (period == null && aggregates.length > 0 && aggregates[0].cortePeriod) {
        period = aggregates[0].cortePeriod;
      }

      groups.push({
        id: `cat-${cat.id}`,
        name: cat.name || "Sin nombre",
        period,
        aggregates,
        components,
      });
    }

    if (groups.length > 0) {
      // Sort: by inferred period (if any), then by name
      groups.sort((a, b) => {
        const pa = a.period ?? 99;
        const pb = b.period ?? 99;
        if (pa !== pb) return pa - pb;
        return String(a.name).localeCompare(String(b.name), "es");
      });
      return groups;
    }
  }

  // ── Path 2: no categories, multiple cortes with formula text ──────────
  if (corteItems.length > 1) {
    const groups = corteItems
      .slice()
      .sort((a, b) => (a.cortePeriod || 99) - (b.cortePeriod || 99))
      .map((c) => {
        const components = matchEvidencesByFormula(c, nonCorteItems);
        return {
          id: `corte-${c.gradeObjectId}`,
          name: c.name || `Corte ${c.cortePeriod || "?"}`,
          period: c.cortePeriod || null,
          aggregates: [c],
          components,
        };
      });
    // If formula parsing yielded nothing AND we still have non-corte items,
    // distribute them by name prefix heuristic
    const allMatched = new Set();
    for (const g of groups) for (const c of g.components) allMatched.add(c.gradeObjectId);
    const unmatched = nonCorteItems.filter((e) => !allMatched.has(e.gradeObjectId));
    if (unmatched.length > 0 && groups.length > 0) {
      // Append to the first corte by default
      groups[0].components = [...groups[0].components, ...unmatched];
    }
    return groups;
  }

  // ── Path 3: single corte OR no cortes at all ─────────────────────────
  if (corteItems.length === 1) {
    // Try formula first
    const fromFormula = matchEvidencesByFormula(corteItems[0], nonCorteItems);
    const components = fromFormula.length > 0 ? fromFormula : nonCorteItems;
    return [{
      id: `corte-${corteItems[0].gradeObjectId}`,
      name: corteItems[0].name || "Corte 1",
      period: corteItems[0].cortePeriod || 1,
      aggregates: [corteItems[0]],
      components,
    }];
  }

  // No cortes at all
  return [];
}

/**
 * Given a formula-based corte item and the full evidence list, return the
 * matching evidences referenced by the formula.
 */
export function matchEvidencesByFormula(corteItem, allEvidences) {
  const refs = parseFormulaReferences(corteItem?.formula);
  if (refs.length === 0) return [];
  const list = Array.isArray(allEvidences) ? allEvidences : [];
  const norm = (s) => String(s || "").toLowerCase().trim();
  const out = [];
  const seen = new Set();
  for (const ref of refs) {
    const r = norm(ref);
    let hit = list.find((e) => norm(e.name) === r);
    if (!hit) hit = list.find((e) => norm(e.name).startsWith(r));
    if (!hit) hit = list.find((e) => norm(e.name).includes(r) || r.includes(norm(e.name)));
    if (hit && !seen.has(hit.gradeObjectId)) {
      out.push(hit);
      seen.add(hit.gradeObjectId);
    }
  }
  return out;
}
