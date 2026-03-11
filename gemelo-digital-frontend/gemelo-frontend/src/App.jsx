import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
/**
 * =========================
 * Config
 * =========================
 */

const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_GEMELO_BASE_URL ||
  ""
).replace(/\/$/, "");

if (!API_BASE_URL) {
  console.error("⚠️ Falta definir VITE_API_BASE_URL (o VITE_GEMELO_BASE_URL) en el .env");
}

function apiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

const DEFAULT_ORG_UNIT_ID = 29120;

/**
 * =========================
 * CSS injection
 * =========================
 */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --bg: #F4F5F7;
    --card: #FFFFFF;
    --border: #E2E5EA;
    --text: #0D1117;
    --muted: #6B7280;
    --brand: #0B5FFF;
    --brand-light: #EEF3FF;
    --shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.10);
    --radius: 14px;
    --font: 'DM Sans', system-ui, sans-serif;
    --font-mono: 'DM Mono', monospace;
    --ok: #12B76A;
    --ok-bg: #ECFDF3;
    --watch: #F79009;
    --watch-bg: #FFFAEB;
    --critical: #D92D20;
    --critical-bg: #FEF3F2;
    --pending: #98A2B3;
    --pending-bg: #F2F4F7;
  }

  .dark {
    --bg: #0D1117;
    --card: #161B22;
    --border: #21262D;
    --text: #E6EDF3;
    --muted: #7D8590;
    --brand-light: #1A2844;
    --shadow: 0 1px 4px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.4);
    --ok-bg: #0D2818;
    --watch-bg: #2A1F06;
    --critical-bg: #2A0B09;
    --pending-bg: #1C2128;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .cesa-loader-wrap {
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg);
    z-index: 100;
  }
  .cesa-loader-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 40px 48px;
    text-align: center;
    box-shadow: var(--shadow-lg);
    min-width: 320px;
    max-width: 480px;
  }
  .cesa-loader-title { font-size: 20px; font-weight: 800; color: var(--text); }
  .cesa-loader-sub { font-size: 13px; color: var(--muted); margin-top: 4px; }
  .cesa-loader-center { margin: 28px 0; }
  .cesa-loader-foot { font-size: 12px; color: var(--muted); }

  .cesa-water-text {
    position: relative; display: inline-block;
    font-size: 56px; font-weight: 900; letter-spacing: -2px;
    overflow: hidden; height: 72px; line-height: 72px;
  }
  .cesa-water-text__outline {
    color: transparent;
    -webkit-text-stroke: 2px var(--border);
  }
  .cesa-water-text__fill {
    position: absolute; inset: 0;
    color: var(--brand);
    clip-path: inset(100% 0 0 0);
    animation: waterFill 1.8s ease-in-out infinite alternate;
  }
  .cesa-water-text__wave {
    position: absolute; bottom: 0; left: -100%;
    width: 300%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(11,95,255,.08), transparent);
    animation: waveSlide 2s linear infinite;
  }
  @keyframes waterFill {
    0% { clip-path: inset(100% 0 0 0); }
    100% { clip-path: inset(0% 0 0 0); }
  }
  @keyframes waveSlide {
    from { transform: translateX(0); }
    to { transform: translateX(33.33%); }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.35s ease both; }
  .fade-up-1 { animation-delay: 0.05s; }
  .fade-up-2 { animation-delay: 0.1s; }
  .fade-up-3 { animation-delay: 0.15s; }
  .fade-up-4 { animation-delay: 0.2s; }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }
  .pulse-dot {
    display: inline-block; width: 8px; height: 8px;
    border-radius: 50%; animation: pulse 1.4s ease infinite;
  }

  @keyframes fillBar {
    from { width: 0%; }
    to { width: var(--target-w); }
  }
  .fill-bar { animation: fillBar 0.7s cubic-bezier(.4,0,.2,1) both; animation-delay: 0.2s; }

  .drawer-enter { animation: drawerIn 0.28s cubic-bezier(.4,0,.2,1) both; }
  @keyframes drawerIn {
    from { transform: translateX(40px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .tr-hover { transition: background 0.15s ease; }
  .tr-hover:hover { background: rgba(11,95,255,0.04) !important; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted); }

  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; white-space: nowrap;
    letter-spacing: 0.01em;
  }

  .kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    box-shadow: var(--shadow);
    transition: box-shadow 0.2s ease;
  }
  .kpi-card:hover { box-shadow: var(--shadow-lg); }

  .tag {
    display: inline-flex; align-items: center;
    padding: 3px 8px; border-radius: 6px;
    font-size: 11px; font-weight: 700;
    font-family: var(--font-mono);
    background: var(--brand-light);
    color: var(--brand);
  }

  .chip {
    display: inline-flex; align-items: center; gap: 4px;
    border: 1px solid var(--border);
    border-radius: 8px; padding: 4px 10px;
    font-size: 12px; font-weight: 700;
    background: var(--card); color: var(--muted);
    cursor: pointer; transition: all 0.15s ease;
  }
  .chip:hover, .chip.active {
    border-color: var(--brand);
    color: var(--brand);
    background: var(--brand-light);
  }

  .btn {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    border-radius: 10px;
    padding: 8px 14px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    font-family: var(--font);
    transition: all 0.15s ease;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .btn:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-light); }
  .btn-primary {
    background: var(--brand); color: #fff; border-color: var(--brand);
  }
  .btn-primary:hover { background: #0A52E0; color: #fff; border-color: #0A52E0; }

  .scenario-card {
    border: 1px solid var(--border);
    border-radius: 10px; padding: 12px;
    display: flex; flex-direction: column; gap: 4px;
    background: var(--card);
  }
  .scenario-card.scenario-risk { border-color: #FECDCA; background: var(--critical-bg); }
  .scenario-card.scenario-base { border-color: var(--border); }
  .scenario-card.scenario-improve { border-color: #A9EFC5; background: var(--ok-bg); }

  .qc-flag {
    font-size: 12px; padding: 8px 12px;
    border-radius: 8px; background: var(--pending-bg);
    border: 1px solid var(--border);
    font-family: var(--font-mono);
    color: var(--muted);
  }

  input[type="text"], input[type="number"] {
    font-family: var(--font);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  input[type="text"]:focus, input[type="number"]:focus {
    border-color: var(--brand) !important;
    box-shadow: 0 0 0 3px rgba(11,95,255,0.12) !important;
  }
  
  .scroll-y {
    overflow-y: auto;
    overflow-x: hidden;
  }

  .ra-scroll {
    max-height: 260px;
    padding-right: 4px;
  }

  .ra-priority-scroll {
    max-height: 380px;
    padding-right: 4px;
    overflow-y: auto;
  }

  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 8px;
    padding: 40px 20px;
    color: var(--muted);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    background: var(--card);
  }
  .empty-state-icon { font-size: 32px; opacity: 0.4; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.65); }

  /* Keyframe animations */
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes slideInUp {
    from { transform: translateY(10px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* Panel animation class */
  .panel-slide { animation: slideInRight 0.22s cubic-bezier(0.4,0,0.2,1); }

  /* Tag */
  .tag { font-weight: 700 !important; }
`;

function toDate(x) {
  const d = x ? new Date(x) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const ms = Math.max(0, end.getTime() - start.getTime());
  return ms / (7 * 24 * 60 * 60 * 1000);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function injectStyles() {
  if (typeof document === "undefined") return;
  const id = "gemelo-styles";
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = GLOBAL_STYLES;
  document.head.appendChild(el);
}

/**
 * =========================
 * Hook: Media Query
 * =========================
 */
function useMediaQuery(query) {
  const getMatch = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };
  const [matches, setMatches] = React.useState(getMatch);

  React.useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();

    if (m.addEventListener) m.addEventListener("change", onChange);
    else m.addListener(onChange);

    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else m.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

/**
 * =========================
 * Colors
 * =========================
 */
const COLORS = {
  critical: "#D92D20",
  watch: "#F79009",
  ok: "#12B76A",
  pending: "#98A2B3",
  brand: "#0B5FFF",
};

const STATUS_CONFIG = {
  solido: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  "óptimo": { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  optimo: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  observacion: { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Seguimiento" },
  "en seguimiento": { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Seguimiento" },
  "en desarrollo": { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "En desarrollo" },
  critico: { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Crítico" },
  cargando: { bg: "var(--brand-light)", fg: "#1D4ED8", dot: COLORS.brand, label: "Cargando" },
  pending: { bg: "var(--pending-bg)", fg: "var(--muted)", dot: COLORS.pending, label: "Pendiente" },
  alto: { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Alto" },
  medio: { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Medio" },
  bajo: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Bajo" },
};

/**
 * =========================
 * Helpers
 * =========================
 */
function normStatus(x) {
  return String(x || "").toLowerCase().trim();
}

function colorForRisk(risk) {
  const r = normStatus(risk);
  if (r === "alto" || r === "critico") return COLORS.critical;
  if (r === "medio" || r === "en desarrollo") return COLORS.watch;
  if (r === "bajo" || r === "óptimo") return COLORS.ok;
  return COLORS.pending;
}

function colorForPct(pct, thresholds) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return COLORS.pending;
  const p = Number(pct);
  const thr = thresholds || { critical: 50, watch: 70 };
  if (p < Number(thr.critical)) return COLORS.critical;
  if (p < Number(thr.watch)) return COLORS.watch;
  return COLORS.ok;
}

function contentRhythmStatus(progressRatio) {
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

function colorForLearningOutcome(m, thresholds) {
  const st = normStatus(m?.status);
  if (st === "critico") return COLORS.critical;
  if (st === "en desarrollo" || st === "en seguimiento" || st === "observacion") return COLORS.watch;
  if (st === "optimo" || st === "solido" || st === "óptimo") return COLORS.ok;
  return colorForPct(m?.avgPct, thresholds);
}

function fmtPct(x) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return "—";
  return `${Number(x).toFixed(1)}%`;
}

function fmtGrade10FromPct(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return "—";
  return (Number(pct) / 10).toFixed(1);
}

function flattenOutcomeDescriptions(payload) {
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

function isVisibleContentItem(item) {
  if (!item || typeof item !== "object") return false;
  if (item.IsHidden === true) return false;

  // En Brightspace content root:
  // Type 0 = módulo/folder
  // Type 1 = topic/item
  // Queremos contar solo contenido real, no módulos.
  return Number(item.Type) !== 0;
}

function safeAvg(list) {
  const nums = (Array.isArray(list) ? list : [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function apiGet(path, opts = {}) {
  const res = await fetch(apiUrl(path), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json", ...(opts.headers || {}) },
    signal: opts.signal,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson =
    ct.includes("application/json") ||
    ct.includes("application/problem+json");

  if (!res.ok) {
    const body = isJson
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => "");
    const msg =
      typeof body === "string"
        ? body
        : body?.detail || body?.message || body?.error || JSON.stringify(body);
    throw new Error(`HTTP ${res.status} - ${String(msg).slice(0, 600)}`);
  }

  if (!isJson) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Respuesta no JSON (${ct}): ${txt.slice(0, 300)}`);
  }

  return res.json();
}

async function mapLimit(arr, limit, mapper) {
  const list = Array.isArray(arr) ? arr : [];
  const results = new Array(list.length);
  let i = 0;
  const workers = new Array(Math.min(limit, list.length)).fill(null).map(async () => {
    while (i < list.length) {
      const idx = i++;
      results[idx] = await mapper(list[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function pickCriticalMacroFromGemelo(g) {
  const arr = g?.macro?.units || g?.macroUnits || [];
  if (!Array.isArray(arr) || !arr.length) return null;
  const copy = arr
    .map((x) => ({ code: x.code, pct: Number(x.pct ?? x.avgPct ?? 0) }))
    .filter((x) => x.code);
  if (!copy.length) return null;
  copy.sort((a, b) => a.pct - b.pct);
  return copy[0];
}

function suggestRouteForStudent(s, thresholds) {
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

/**
 * =========================
 * UI Atoms
 * =========================
 */

function StatusBadge({ status }) {
  const s = normStatus(status);
  const cfg = STATUS_CONFIG[s] || {
    bg: "var(--pending-bg)",
    fg: "var(--muted)",
    dot: COLORS.pending,
    label: status || "—",
  };
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.fg }}>
      <span className="pulse-dot" style={{ background: cfg.dot, width: 6, height: 6 }} />
      {cfg.label}
    </span>
  );
}

function Card({ title, right, children, className = "", style = {} }) {
  return (
    <div className={`kpi-card ${className}`} style={{ display: "flex", flexDirection: "column", ...style }}>
      {(title || right) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {title}
          </div>
          <div>{right}</div>
        </div>
      )}
      {children}
    </div>
  );
}

function Stat({ label, value, sub, valueColor }) {
  return (
    <div>
      {label ? (
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
      ) : null}
      <div style={{ fontSize: 26, color: valueColor || "var(--text)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, fontWeight: 500 }}>{sub}</div> : null}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", width: "100%", margin: "4px 0" }} />;
}

function ProgressBar({ value, color, showLabel = false, animate = true }) {
  const pct = Math.max(0, Math.min(100, Number(value ?? 0)));
  const mountedRef = React.useRef(false);
  const [didMount, setDidMount] = React.useState(false);

  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDidMount(true);
    }
  }, []);

  const shouldAnimate = animate && didMount;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.15)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div
          className={shouldAnimate ? "fill-bar" : ""}
          style={{
            "--target-w": `${pct}%`,
            width: shouldAnimate ? undefined : `${pct}%`,
            height: "100%",
            background: color || COLORS.brand,
            borderRadius: 999,
            transition: shouldAnimate ? undefined : "none",
          }}
        />
      </div>
      {showLabel && (
        <div style={{ position: "absolute", right: 0, top: -18, fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
          {fmtPct(pct)}
        </div>
      )}
    </div>
  );
}

function InfoTooltip({ text }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);
  if (!String(text || "").trim()) return null;

  const updatePos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.top, left: r.left + r.width / 2 });
  };

  return (
    <span style={{ position: "relative", display: "inline-flex", flex: "0 0 auto" }}>
      <span
        ref={btnRef}
        role="button"
        tabIndex={0}
        aria-label="Ver descripción"
        onMouseEnter={() => { updatePos(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => { updatePos(); setOpen(true); }}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); updatePos(); setOpen((v) => !v); }}
        style={{
          display: "inline-flex",
          width: 16, height: 16,
          borderRadius: 999,
          alignItems: "center", justifyContent: "center",
          border: "1px solid var(--border)",
          color: "var(--muted)", fontSize: 10, fontWeight: 900,
          cursor: "help", background: "var(--card)",
          lineHeight: 1, flexShrink: 0,
        }}
      >?</span>

      {open && (
        <div
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, calc(-100% - 10px))",
            width: "min(280px, 85vw)",
            zIndex: 99998,
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            borderRadius: 10,
            padding: "10px 13px",
            color: "var(--text)", fontSize: 12, fontWeight: 500,
            lineHeight: 1.55, whiteSpace: "normal",
            pointerEvents: "none",
          }}
        >
          <div style={{
            position: "absolute", bottom: -5, left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: 8, height: 8,
            background: "var(--card)", border: "1px solid var(--border)",
            borderTop: "none", borderLeft: "none",
          }} />
          {text}
        </div>
      )}
    </span>
  );
}

function SortTh({ label, active, dir, onClick, title }) {
  return (
    <th
      onClick={onClick}
      title={title}
      style={{
        padding: "10px 10px",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: active ? "var(--brand)" : "var(--muted)",
      }}
    >
      {label} {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

function CoverageBars({ donePct, pendingPct, overduePct }) {
  // donePct   = calificado (nota numérica publicada)
  // pendingPct = pendiente calificación (entregado, sin nota)
  // overduePct = vencido sin registro (sin entrega, fecha pasada)
  // open = 100 - d - p - ov (sin entregar, fecha futura o sin fecha)
  const d = Math.max(0, Math.min(100, Number(donePct ?? 0)));
  const p = Math.max(0, Math.min(100, Number(pendingPct ?? 0)));
  const ov = Math.max(0, Math.min(100, Number(overduePct ?? 0)));

  const BarRow = ({ label, value, color, tooltip }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }} title={tooltip}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text)",
            fontWeight: 800,
            fontFamily: "var(--font-mono)",
          }}
        >
          {value.toFixed(1)}%
        </div>
      </div>
      <ProgressBar value={value} color={color} animate={false} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Índice de cumplimiento evaluativo
      </div>

      <BarRow
        label="Calificado"
        value={d}
        color={COLORS.ok}
        tooltip="Ítems con nota numérica publicada en el gradebook."
      />

      <BarRow
        label="Pendiente calificación"
        value={p}
        color={COLORS.brand}
        tooltip="El estudiante entregó pero el docente aún no ha publicado nota numérica."
      />

      {Math.max(0, 100 - d - p - ov) > 0.5 && (
        <BarRow
          label="Sin entregar (abierto)"
          value={Math.max(0, 100 - d - p - ov)}
          color={COLORS.pending}
          tooltip="Sin nota, sin señal de entrega, y la fecha de vencimiento aún no ha llegado."
        />
      )}

      <BarRow
        label="Vencido sin registro"
        value={ov}
        color={ov > 0 ? COLORS.critical : "rgba(148,163,184,0.4)"}
        tooltip="Sin nota, sin entrega registrada, y la fecha de vencimiento ya pasó. Requiere acción docente."
      />
    </div>
  );
}

function CesaLoader({ title = "Gemelo V. 1.0", subtitle = "Cargando tablero..." }) {
  React.useEffect(() => {
    injectStyles();
  }, []);

  return (
    <div className="cesa-loader-wrap">
      <div className="cesa-loader-card">
        <div>
          <div className="cesa-loader-title">{title}</div>
          <div className="cesa-loader-sub">{subtitle}</div>
        </div>
        <div className="cesa-loader-center">
          <div className="cesa-water-text" aria-label="Cargando CESA">
            <span className="cesa-water-text__outline">CESA</span>
            <span className="cesa-water-text__fill" aria-hidden="true">
              CESA
            </span>
            <span className="cesa-water-text__wave" aria-hidden="true" />
          </div>
        </div>
        <div className="cesa-loader-foot">Conectando con Brightspace y consolidando evidencias académicas…</div>
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }) {
  const list = Array.isArray(alerts) ? alerts : [];
  const [open, setOpen] = React.useState(false);
  if (!list.length) return null;

  const sevRank = (s) => {
    const x = normStatus(s);
    if (x === "critico") return 0;
    if (x === "en desarrollo" || x === "en seguimiento" || x === "observacion") return 1;
    return 2;
  };

  const sorted = list.slice().sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
  const countBySev = (sev) => sorted.filter((x) => normStatus(x.severity) === sev).length;
  const cCrit = countBySev("critico");
  const cObs = sorted.filter((x) => ["en desarrollo", "en seguimiento", "observacion"].includes(normStatus(x.severity))).length;
  const cSol = countBySev("solido");

  return (
    <Card>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔭</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Radar docente</span>
            <span className="tag">{sorted.length}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {cCrit > 0 && (
              <span className="badge" style={{ background: "var(--critical-bg)", color: "#B42318" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.critical, display: "inline-block" }} />
                Críticos: {cCrit}
              </span>
            )}
            {cObs > 0 && (
              <span className="badge" style={{ background: "var(--watch-bg)", color: "#9A3412" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.watch, display: "inline-block" }} />
                Seguimiento: {cObs}
              </span>
            )}
            {cSol > 0 && (
              <span className="badge" style={{ background: "var(--ok-bg)", color: "#1B5E20" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.ok, display: "inline-block" }} />
                Óptimos: {cSol}
              </span>
            )}
          </div>
        </div>
        <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }}>
          {open ? "Ocultar ▴" : "Ver ▾"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((a) => (
            <div
              key={a.id || `${a.title}-${Math.random()}`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                background: "var(--card)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 800, color: "var(--text)", fontSize: 13 }}>{a.title || "Alerta"}</div>
                <StatusBadge status={a.severity} />
              </div>
              {a.message && <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{a.message}</div>}
              {a.kpis && Object.keys(a.kpis).length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  {Object.entries(a.kpis).map(([k, v]) => (
                    <span
                      key={k}
                      style={{
                        fontSize: 11,
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--muted)",
                      }}
                    >
                      {k}: <strong style={{ color: "var(--text)" }}>{typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : String(v)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Drawer({ open, onClose, title, children }) {
  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,17,23,0.45)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 50,
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        className="drawer-enter"
        style={{
          width: "min(680px, 96vw)",
          height: "100%",
          background: "var(--card)",
          padding: 20,
          overflow: "auto",
          borderLeft: "1px solid var(--border)",
          color: "var(--text)",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Detalle del gemelo digital · Vista docente</div>
          </div>
          <button className="btn" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProjectionBlock({ projection, thresholds }) {
  if (!projection || !Array.isArray(projection.scenarios) || !projection.scenarios.length) return null;

  if (projection.isFinal) {
    return (
      <Card title="Proyección final" right={<span className="tag">Cobertura 100%</span>}>
        <Stat label="Nota final" value={fmtGrade10FromPct(projection.finalPct)} valueColor={colorForPct(projection.finalPct, thresholds)} />
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          La cobertura del 100% indica que esta es la nota definitiva del curso.
        </div>
      </Card>
    );
  }

  const scenarioMeta = {
    risk: { label: "Escenario riesgo", sub: "si el resto baja", cls: "scenario-risk", icon: "📉" },
    base: { label: "Escenario base", sub: "desempeño actual", cls: "scenario-base", icon: "📊" },
    improve: { label: "Escenario mejora", sub: "si el resto sube", cls: "scenario-improve", icon: "📈" },
  };

  return (
    <Card title="Proyección de nota final" right={<span className="tag">{fmtPct(projection.coveragePct)} calificado</span>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {projection.scenarios.map((s) => {
          const meta = scenarioMeta[s.id] || { label: s.id, sub: "", cls: "scenario-base", icon: "📊" };
          return (
            <div key={s.id} className={`scenario-card ${meta.cls}`}>
              <div style={{ fontSize: 18 }}>{meta.icon}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{meta.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", color: colorForPct(s.projectedFinalPct, thresholds) }}>
                {fmtGrade10FromPct(s.projectedFinalPct)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {meta.sub} · asume {fmtPct(s.assumptionPendingPct)} pendiente
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function QualityFlagsBlock({ flags }) {
  const list = Array.isArray(flags) ? flags.filter((f) => f?.type) : [];
  const [open, setOpen] = React.useState(false);
  if (!list.length) return null;

  const relevant = list.filter((f) => f.type !== "role_not_enabled");
  if (!relevant.length) return null;

  return (
    <Card title={null}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
        }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Flags de calidad del modelo</span>
          <span className="tag" style={{ background: "var(--watch-bg)", color: "var(--watch)" }}>
            {relevant.length}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{open ? "▴" : "▾"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {relevant.map((f, i) => (
            <div key={i} className="qc-flag">
              <strong>{f.type}</strong>
              {f.message && <span style={{ marginLeft: 8, opacity: 0.8 }}>— {f.message}</span>}
              {f.rubricId && <span style={{ marginLeft: 8, opacity: 0.6 }}>rubric:{f.rubricId}</span>}
              {f.unitCode && <span style={{ marginLeft: 8, opacity: 0.6 }}>unit:{f.unitCode}</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PendingItemsBlock({ pendingItems, missingValues }) {
  const items = Array.isArray(pendingItems) ? pendingItems : [];
  const missing = Array.isArray(missingValues) ? missingValues : [];
  if (!items.length && !missing.length) return null;

  const [open, setOpen] = React.useState(false);
  const topPending = items.slice(0, 5);

  return (
    <Card title={null}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
        }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>⏳</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Evidencias pendientes</span>
          <span className="tag">{items.length + missing.length}</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{open ? "▴" : "▾"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {topPending.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Sin calificar (por peso)
              </div>
              {topPending.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", flex: 1, minWidth: 0 }}>
                    {it.name || `Ítem ${it.gradeObjectId}`}
                  </div>
                  <span className="tag" style={{ background: "var(--watch-bg)", color: "#9A3412", flexShrink: 0 }}>
                    {fmtPct(it.weightPct)} peso
                  </span>
                </div>
              ))}
              {items.length > 5 && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "4px 0" }}>+ {items.length - 5} más</div>}
            </div>
          )}
          {missing.length > 0 && (
            <div style={{ marginTop: items.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                No liberados en gradebook ({missing.length})
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Ítems sin valor visible para el estudiante. Revisar configuración de visibilidad.</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EvidencesTimeline({ evidences, thresholds }) {
  const list = Array.isArray(evidences) ? evidences.filter((e) => e.scorePct !== null && e.scorePct !== undefined) : [];
  if (!list.length) return null;
  const [open, setOpen] = React.useState(false);

  const chartData = list.map((e) => ({
    name: (e.name || "").slice(0, 20),
    pct: Number(e.scorePct ?? 0),
  }));

  return (
    <Card title={null}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
        }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Historial de evidencias</span>
          <span className="tag">{list.length} calificadas</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{open ? "▴" : "▾"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Desempeño"]} />
                <ReferenceLine y={Number(thresholds?.watch || 70)} stroke={COLORS.watch} strokeDasharray="4 4" label={{ value: "70%", fill: COLORS.watch, fontSize: 10 }} />
                <ReferenceLine y={Number(thresholds?.critical || 50)} stroke={COLORS.critical} strokeDasharray="4 4" label={{ value: "50%", fill: COLORS.critical, fontSize: 10 }} />
                <Line type="monotone" dataKey="pct" stroke={COLORS.brand} strokeWidth={2} dot={{ fill: COLORS.brand, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

function StudentCard({ s, onOpen }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(s)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(s);
      }}
      className="kpi-card fade-up"
      style={{ cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: "var(--text)", fontSize: 14 }}>{s.displayName}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>ID {s.userId}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <StatusBadge status={s.isLoading ? "cargando" : s.risk} />
          {s.hasPrescription && <span className="tag" style={{ fontSize: 10 }}>📋 Prescripción</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ textAlign: "center", padding: "8px 4px", background: "var(--bg)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>NOTA</div>
          <div style={{ fontWeight: 900, color: colorForPct(s.currentPerformancePct, null), fontSize: 16, fontFamily: "var(--font-mono)" }}>
            {fmtGrade10FromPct(s.currentPerformancePct)}
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "8px 4px", background: "var(--bg)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>COBERTURA</div>
          <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "var(--font-mono)" }}>{fmtPct(s.coveragePct)}</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{s.coverageCountText || "—"}</div>
        </div>
        <div style={{ textAlign: "center", padding: "8px 4px", background: "var(--bg)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>RA CRÍTICO</div>
          <div style={{ fontWeight: 800, fontSize: 12, fontFamily: "var(--font-mono)" }}>{s.mostCriticalMacro ? s.mostCriticalMacro.code : "—"}</div>
        </div>
      </div>

      {s.coveragePct != null && <ProgressBar value={s.coveragePct} color={colorForPct(s.coveragePct, null)} />}

      <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{s.route?.title || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginTop: 1 }}>{s.route?.summary}</div>
        </div>
        <button className="btn" style={{ fontSize: 11, padding: "5px 10px" }} onClick={(e) => { e.stopPropagation(); onOpen(s); }}>
          Ver gemelo →
        </button>
      </div>
    </div>
  );
}

/**
 * =========================
 * Main App
 * =========================
 */
export default function App() {
  useEffect(() => {
    injectStyles();
  }, []);

  const isNarrow = useMediaQuery("(max-width: 900px)");
  const isMobile = useMediaQuery("(max-width: 640px)");

  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const [orgUnitId, setOrgUnitId] = useState(DEFAULT_ORG_UNIT_ID);
  const [orgUnitInput, setOrgUnitInput] = useState(String(DEFAULT_ORG_UNIT_ID));
  const [showCoursePanel, setShowCoursePanel] = useState(false);
  const [courseList, setCourseList] = useState([]);
  const [courseListLoading, setCourseListLoading] = useState(false);

  // Fetch enrolled courses when panel opens
  // Tries multiple common Brightspace/backend endpoints in sequence
  React.useEffect(() => {
    if (!showCoursePanel || courseList.length > 0) return;
    setCourseListLoading(true);

    const tryEndpoints = async () => {
      // Rutas en orden de prioridad — las dos primeras existen en el backend actual.
      // /brightspace/my-course-offerings  → retorna { count, items: [{id,name,code,...}] }
      // /brightspace/courses/enrolled     → alias del anterior (mismo schema)
      // /brightspace/my-courses           → raw Brightspace { Items: [{OrgUnit:{...}},...] }
      const endpoints = [
        "/brightspace/my-course-offerings",
        "/brightspace/courses/enrolled",
        "/brightspace/my-courses",
      ];

      for (const ep of endpoints) {
        try {
          const d = await apiGet(ep);

          // /my-course-offerings y /courses/enrolled → { items: [...] }
          if (Array.isArray(d?.items) && d.items.length > 0) return d.items;

          // /my-courses → raw Brightspace { Items: [{OrgUnit:{Id,Name,Code,...}},...] }
          if (Array.isArray(d?.Items) && d.Items.length > 0) {
            return d.Items
              .map((it) => {
                const ou = it?.OrgUnit || {};
                return {
                  id:   ou.Id,
                  name: ou.Name || "",
                  code: ou.Code || "",
                };
              })
              .filter((c) => c.id);
          }

          // Array directo (fallback)
          if (Array.isArray(d) && d.length > 0) return d;
        } catch {
          // intentar siguiente ruta
        }
      }
      return [];
    };

    tryEndpoints()
      .then((items) => setCourseList(items))
      .catch(() => setCourseList([]))
      .finally(() => setCourseListLoading(false));
  }, [showCoursePanel]);

  const [outcomesMap, setOutcomesMap] = useState({});
  const [learningOutcomesPayload, setLearningOutcomesPayload] = useState(null);
  const [contentRoot, setContentRoot] = useState([]);
  const [overview, setOverview] = useState(null);
  const [studentsList, setStudentsList] = useState(null);
  const [studentRows, setStudentRows] = useState([]);
  const [raDashboard, setRaDashboard] = useState(null);

  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [courseInfo, setCourseInfo] = useState(null);
  const [query, setQuery] = useState("");
  const [onlyRisk, setOnlyRisk] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentErr, setStudentErr] = useState("");

  const [drawerTab, setDrawerTab] = useState("resumen");

  const hideGlobalProgressCol = isNarrow;
  const hideCriticalMacroCol = isMobile;
  const compactRouteCol = isNarrow;
  const useCards = isMobile;

  /**
   * Load course overview/student dashboard
   */
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    setLoading(true);
    setErr("");
    setOverview(null);
    setStudentsList(null);
    setStudentRows([]);
    setRaDashboard(null);
    setLearningOutcomesPayload(null);
    setOutcomesMap({});

    (async () => {
      try {
        const [ovRes, stRes, raRes, loRes] = await Promise.allSettled([
          apiGet(`/gemelo/course/${orgUnitId}/overview`, { signal: controller.signal }),
          apiGet(`/gemelo/course/${orgUnitId}/students?include=summary`, { signal: controller.signal }),
          apiGet(`/gemelo/course/${orgUnitId}/ra/dashboard`, { signal: controller.signal }),
          apiGet(`/gemelo/course/${orgUnitId}/learning-outcomes`, { signal: controller.signal }),
        ]);

        if (!isMounted) return;
        if (ovRes.status !== "fulfilled") throw ovRes.reason;
        if (stRes.status !== "fulfilled") throw stRes.reason;

        const ov = ovRes.value;
        const st = stRes.value;

        setOverview(ov);
        setStudentsList(st);
        if (raRes.status === "fulfilled") setRaDashboard(raRes.value);

        if (loRes.status === "fulfilled") {
          const payload = loRes.value;
          setLearningOutcomesPayload(payload);

          const sets = Array.isArray(payload?.outcomeSets) ? payload.outcomeSets : [];
          const map = {};
          for (const set of sets) {
            for (const o of set?.Outcomes || []) {
              const desc = String(o?.Description || "").trim();
              const m = desc.match(/^([A-Za-z0-9_.-]+)\s*-\s*(.+)$/);
              if (m) {
                const code = String(m[1]).toUpperCase();
                map[code] = {
                  code,
                  description: desc,
                  title: String(m[2] || "").trim(),
                };
              }
            }
          }
          setOutcomesMap(map);
        }

        const studentItems = (st?.students?.items || st?.items || []).slice();
        const thr = ov?.thresholds || { critical: 50, watch: 70 };

        const baseRows = studentItems.map((s) => {
          const userId = s.userId ?? s.UserId ?? s.Identifier;
          const base = {
            userId: Number(userId),
            displayName: s.displayName ?? s.DisplayName ?? "—",
            roleName: s.roleName ?? "—",
            isLoading: true,
            risk: "cargando",
            globalPct: null,
            currentPerformancePct: null,
            coveragePct: null,
            coverageCountText: null,
            gradedItemsCount: null,
            totalItemsCount: null,
            hasPrescription: false,
            mostCriticalMacro: null,
            notSubmittedWeightPct: null,
          };
          base.route = suggestRouteForStudent(base, thr);
          return base;
        });

        setStudentRows(baseRows);
        setLoading(false);

        const hasInlineSummary =
          studentItems.length > 0 &&
          (studentItems[0]?.summary ||
            studentItems[0]?.risk ||
            studentItems[0]?.coveragePct != null ||
            studentItems[0]?.currentPerformancePct != null);

        if (hasInlineSummary) {
          const details = studentItems.map((s) => {
            const userId = s.userId ?? s.UserId ?? s.Identifier;
            const sum = s.summary || s;
            const gradedItemsCount = sum?.gradedItemsCount ?? sum?.coverageGradedCount ?? null;
            const totalItemsCount = sum?.totalItemsCount ?? sum?.coverageTotalCount ?? null;
            const coverageCountText =
              sum?.coverageCountText ??
              (gradedItemsCount != null && totalItemsCount != null ? `${gradedItemsCount}/${totalItemsCount}` : null);

            const row = {
              userId: Number(userId),
              displayName: s.displayName ?? s.DisplayName ?? "—",
              roleName: s.roleName ?? "—",
              isLoading: false,
              risk: sum?.risk || "pending",
              globalPct: sum?.globalPct ?? null,
              currentPerformancePct: sum?.currentPerformancePct ?? null,
              coveragePct: sum?.coveragePct ?? null,
              gradedItemsCount,
              totalItemsCount,
              coverageCountText,
              hasPrescription: Boolean(sum?.hasPrescription ?? s?.hasPrescription ?? false),
              mostCriticalMacro: s?.mostCriticalMacro ?? null,
              // Nuevo: enviado sin nota (pendingSubmitted) y vencido sin registro (overdue)
              pendingSubmittedCount: sum?.pendingSubmittedCount ?? 0,
              pendingSubmittedWeightPct: sum?.pendingSubmittedWeightPct ?? 0,
              overdueCount: sum?.overdueCount ?? 0,
              overdueWeightPct: sum?.overdueWeightPct ?? 0,
              // Aliases legacy
              notSubmittedCount: sum?.overdueCount ?? sum?.notSubmittedCount ?? 0,
              notSubmittedWeightPct: sum?.overdueWeightPct ?? sum?.notSubmittedWeightPct ?? 0,
            };
            row.route = suggestRouteForStudent(row, thr);
            return row;
          });

          if (!isMounted) return;
          setStudentRows(details);
          return;
        }

        await mapLimit(studentItems, 4, async (s) => {
          const userId = s.userId ?? s.UserId ?? s.Identifier;
          try {
            const g = await apiGet(`/gemelo/course/${orgUnitId}/student/${userId}`, { signal: controller.signal });
            if (!isMounted) return;

            const sum = g?.summary || {};
            const mostCriticalMacro = pickCriticalMacroFromGemelo(g);
            const gradedItemsCount = sum?.gradedItemsCount ?? sum?.coverageGradedCount ?? g?.gradebook?.gradedItemsCount ?? null;
            const totalItemsCount = sum?.totalItemsCount ?? sum?.coverageTotalCount ?? g?.gradebook?.totalItemsCount ?? null;
            const coverageCountText =
              sum?.coverageCountText ??
              g?.gradebook?.coverageCountText ??
              (gradedItemsCount != null && totalItemsCount != null ? `${gradedItemsCount}/${totalItemsCount}` : null);

            const patch = {
              isLoading: false,
              risk: sum?.risk || "pending",
              globalPct: sum?.globalPct ?? null,
              currentPerformancePct: sum?.currentPerformancePct ?? null,
              coveragePct: sum?.coveragePct ?? null,
              gradedItemsCount,
              totalItemsCount,
              coverageCountText,
              hasPrescription: Array.isArray(g?.prescription) && g.prescription.length > 0,
              mostCriticalMacro,
              // Nuevo: enviado sin nota (pendingSubmitted) y vencido sin registro (overdue)
              pendingSubmittedCount: sum?.pendingSubmittedCount ?? 0,
              pendingSubmittedWeightPct: sum?.pendingSubmittedWeightPct ?? 0,
              overdueCount: sum?.overdueCount ?? 0,
              overdueWeightPct: sum?.overdueWeightPct ?? 0,
              // Aliases legacy
              notSubmittedCount: sum?.overdueCount ?? sum?.notSubmittedCount ?? 0,
              notSubmittedWeightPct: sum?.overdueWeightPct ?? sum?.notSubmittedWeightPct ?? 0,
            };

            setStudentRows((prev) =>
              prev.map((row) => {
                if (row.userId !== Number(userId)) return row;
                const merged = { ...row, ...patch };
                merged.route = suggestRouteForStudent(merged, thr);
                return merged;
              })
            );
          } catch {
            if (controller.signal.aborted || !isMounted) return;
            setStudentRows((prev) =>
              prev.map((row) =>
                row.userId === Number(userId)
                  ? { ...row, isLoading: false, risk: "pending" }
                  : row
              )
            );
          }
        });
      } catch (e) {
        if (controller.signal.aborted || !isMounted) return;
        setErr(String(e?.message || e));
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [orgUnitId]);

  /**
   * Load course info + content root
   */
  useEffect(() => {
    if (!orgUnitId) return;

    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        const [courseRes, contentRes] = await Promise.allSettled([
          apiGet(`/brightspace/course/${orgUnitId}`, { signal: controller.signal }),
          apiGet(`/brightspace/course/${orgUnitId}/content/root`, { signal: controller.signal }),
        ]);

        if (!alive) return;

        if (courseRes.status === "fulfilled") {
          setCourseInfo(courseRes.value);
        } else {
          console.error("Error cargando curso:", courseRes.reason);
          setCourseInfo(null);
        }

        if (contentRes.status === "fulfilled") {
          setContentRoot(Array.isArray(contentRes.value) ? contentRes.value : []);
        } else {
          console.error("Error cargando contenido root:", contentRes.reason);
          setContentRoot([]);
        }
      } catch (e) {
        if (!alive || controller.signal.aborted) return;
        console.error("Error cargando curso/contenido:", e);
        setCourseInfo(null);
        setContentRoot([]);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [orgUnitId]);

  /**
   * Load student detail
   */
  useEffect(() => {
    if (!selectedStudent?.userId) return;

    let alive = true;
    const controller = new AbortController();

    setStudentLoading(true);
    setStudentErr("");
    setStudentDetail(null);
    setDrawerTab("resumen");

    (async () => {
      try {
        const g = await apiGet(`/gemelo/course/${orgUnitId}/student/${selectedStudent.userId}`, {
          signal: controller.signal,
        });
        if (!alive) return;
        setStudentDetail(g);
      } catch (e) {
        if (controller.signal.aborted || !alive) return;
        setStudentErr(String(e?.message || e));
      } finally {
        if (!alive) return;
        setStudentLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [selectedStudent?.userId, orgUnitId]);

  const thresholds = overview?.thresholds || { critical: 50, watch: 70 };

  const riskData = useMemo(() => {
    const rd = overview?.globalRiskDistribution || {};
    return [
      { name: "Alto", key: "alto", value: Number(rd.alto || 0) },
      { name: "Medio", key: "medio", value: Number(rd.medio || 0) },
      { name: "Bajo", key: "bajo", value: Number(rd.bajo || 0) },
    ];
  }, [overview]);

  const learningOutcomesData = useMemo(() => {
  const ras = Array.isArray(raDashboard?.ras) ? raDashboard.ras : [];
  const descList = flattenOutcomeDescriptions(learningOutcomesPayload);

  if (ras.length) {
    const outcomeMap = {};
    Object.values(outcomesMap || {}).forEach((o) => {
      if (o?.code) outcomeMap[String(o.code).toUpperCase()] = o;
    });

    const w = 100 / ras.length;

    return ras.map((r, idx) => {
      const code = String(r.code || `RA${idx + 1}`).toUpperCase();
      const match = outcomeMap[code];
      const fallbackDesc = descList[idx] || "";

      return {
        code,
        name: match?.title || r.label || fallbackDesc || code,
        description: match?.description || fallbackDesc || r.label || code,
        avgPct: Number(r.avgPct ?? 0),
        weightPct: Number(r.weightPct ?? w),
        status: r.status || null,
        coveragePct: Number(r.coveragePct ?? 0),
        studentsWithData: Number(r.studentsWithData ?? 0),
        totalStudents: Number(r.totalStudents ?? 0),
      };
    });
  }

  if (descList.length) {
    const w = 100 / descList.length;
    return descList.map((d, idx) => ({
      code: `RA${idx + 1}`,
      name: d,
      description: d,
      avgPct: 0,
      weightPct: w,
      status: null,
      coveragePct: 0,
      studentsWithData: 0,
      totalStudents: 0,
    }));
  }

  return [];
}, [raDashboard, learningOutcomesPayload, outcomesMap]);

const weakestAssignment = useMemo(() => {
  const allEvidence = [];

  for (const s of studentRows) {
    const evs = s?.evidences || s?.gradebook?.evidences || [];
    for (const ev of evs) {
      if (ev?.scorePct != null && !Number.isNaN(Number(ev.scorePct))) {
        allEvidence.push({
          gradeObjectId: ev.gradeObjectId,
          name: ev.name || `Ítem ${ev.gradeObjectId}`,
          scorePct: Number(ev.scorePct),
        });
      }
    }
  }

  if (!allEvidence.length) return null;

  const byItem = {};
  for (const ev of allEvidence) {
    const key = String(ev.gradeObjectId);
    if (!byItem[key]) {
      byItem[key] = {
        gradeObjectId: ev.gradeObjectId,
        name: ev.name,
        values: [],
      };
    }
    byItem[key].values.push(ev.scorePct);
  }

  const summary = Object.values(byItem).map((it) => {
    const avg = it.values.reduce((a, b) => a + b, 0) / it.values.length;
    return {
      gradeObjectId: it.gradeObjectId,
      name: it.name,
      avgPct: avg,
      count: it.values.length,
    };
  });

  summary.sort((a, b) => a.avgPct - b.avgPct);
  return summary[0] || null;
}, [studentRows]);

  const weakestMacro = useMemo(() => {
  if (!Array.isArray(learningOutcomesData) || !learningOutcomesData.length) return null;

  const valid = learningOutcomesData
    .filter((m) => m && m.avgPct != null && !Number.isNaN(Number(m.avgPct)))
    .map((m) => ({
      ...m,
      avgPct: Number(m.avgPct),
      coveragePct: Number(m.coveragePct ?? 0),
      studentsWithData: Number(m.studentsWithData ?? 0),
      totalStudents: Number(m.totalStudents ?? 0),
    }));

  if (!valid.length) return null;

  valid.sort((a, b) => a.avgPct - b.avgPct);
  return valid[0];
}, [learningOutcomesData]);

  const avgPerfPct = overview?.courseGradebook?.avgCurrentPerformancePct ?? null;
  const avgCov = overview?.courseGradebook?.avgCoveragePct ?? null;
  const covDone = avgCov == null ? 0 : Math.max(0, Math.min(100, Number(avgCov)));

  // avgPendingSubmittedPct = enviado por el estudiante, aún sin nota numérica
  const avgPendingSubmittedPct = useMemo(() => {
    const v = overview?.courseGradebook?.avgPendingSubmittedPct;
    if (v != null && !Number.isNaN(Number(v))) return Math.max(0, Math.min(100, Number(v)));
    return 0;
  }, [overview]);

  // avgNotSubmittedPct = vencido sin ninguna señal de entrega (el verdadero "sin registro")
  const avgNotSubmittedPct = useMemo(() => {
    const gb = overview?.courseGradebook ?? {};
    // Try all possible field names from different back versions
    const v = gb.avgNotSubmittedPct ?? gb.avgOverdueWeightPct ?? gb.overdueWeightPct ?? gb.avgOverduePct;
    if (v != null && !Number.isNaN(Number(v))) return Math.max(0, Math.min(100, Number(v)));
    // Fallback: compute from studentsAtRisk average if overview fields are missing
    const atRisk = Array.isArray(overview?.studentsAtRisk) ? overview.studentsAtRisk : [];
    if (atRisk.length > 0) {
      const vals = atRisk.map(s => Number(s.notSubmittedWeightPct ?? s.overdueWeightPct ?? 0)).filter(x => !isNaN(x));
      if (vals.length > 0) return Math.min(100, vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return 0;
  }, [overview]);

  // Alias para retrocompatibilidad con CoverageBars
  const avgPendingUngradedPct = avgPendingSubmittedPct;
  const avgOverdueUnscoredPct = avgNotSubmittedPct;

  // covPending = lo que no está calificado, no está vencido y no está enviado pendiente
  // Matemáticamente: 100 - calificado - enviado_sin_nota - vencido_sin_registro
  const covPending = useMemo(() => {
    const cov = Number(overview?.courseGradebook?.avgCoveragePct ?? 0);
    const pending = avgPendingSubmittedPct;
    const overdue = avgNotSubmittedPct;
    return Math.max(0, Math.min(100, 100 - cov - pending - overdue));
  }, [overview, avgPendingSubmittedPct, avgNotSubmittedPct]);

  const studentsCount = overview?.studentsCount ?? studentsList?.students?.count ?? studentRows.length ?? 0;
  const totalStudents = Number(studentsCount || 0) || 0;
  const rd = overview?.globalRiskDistribution || {};
  const atRiskCount = Number(rd.alto || 0) + Number(rd.medio || 0);
  const atRiskPct = totalStudents > 0 ? (atRiskCount / totalStudents) * 100 : null;

  const courseStatus = useMemo(() => {
    if (avgPerfPct != null && Number(avgPerfPct) > 0) {
      const p = Number(avgPerfPct);
      if (p < thresholds.critical) return "critico";
      if (p < thresholds.watch) return "en seguimiento";
      return "solido";
    }
    const rd2 = overview?.globalRiskDistribution || {};
    const a = Number(rd2.alto || 0);
    const m = Number(rd2.medio || 0);
    const b = Number(rd2.bajo || 0);
    if (a >= m && a >= b && a > 0) return "critico";
    if (m >= a && m >= b && m > 0) return "en desarrollo";
    if (b > 0) return "solido";
    return "pending";
  }, [avgPerfPct, thresholds, overview]);


  // Estudiantes prioritarios: nota < 5 | ítems vencidos | cobertura baja
  // Fuente 1: overview.studentsAtRisk (disponible de inmediato, calculado en el back)
  // Fuente 2: studentRows enriquecidos (disponible tras carga incremental)
  const assignmentRiskData = useMemo(() => {
    // Fuente 1: backend ya calculó
    const backendRisk = Array.isArray(overview?.studentsAtRisk) ? overview.studentsAtRisk : [];
    if (backendRisk.length > 0) {
      const mapped = backendRisk.slice(0, 10).map((s) => {
        const perf = s.currentPerformancePct;
        const overduePct = Number(s.notSubmittedWeightPct ?? s.overdueWeightPct ?? 0);
        const pendingPct = Number(s.pendingSubmittedWeightPct ?? 0);
        const type = (perf != null && Number(perf) < 50)
          ? "low_grade"
          : overduePct > 0
          ? "overdue"
          : pendingPct > 0
          ? "pending_submitted"
          : "low_coverage";
        return {
          userId: s.userId,
          name: s.displayName,
          type,
          notSubmittedWeightPct: overduePct,
          pendingSubmittedWeightPct: pendingPct,
          coveragePct: Number(s.coveragePct ?? 0),
          currentPerformancePct: perf != null ? Number(perf) : null,
          risk: s.risk,
        };
      });
      // Ordenar: pendingSubmitted arriba, low_coverage medio, low_grade abajo (más urgentes visualmente al final)
      const typeOrder = { pending_submitted: 0, low_coverage: 1, overdue: 2, low_grade: 3 };
      return mapped.sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2)).slice(0, 7);
    }

    // Fuente 2: derivar desde studentRows (carga incremental)
    const loaded = studentRows.filter((s) => !s.isLoading);
    if (!loaded.length) return [];

    const toRow = (s, type) => ({
      userId: s.userId,
      name: s.displayName,
      type,
      notSubmittedWeightPct: Number(s.notSubmittedWeightPct ?? s.overdueWeightPct ?? 0),
      pendingSubmittedWeightPct: Number(s.pendingSubmittedWeightPct ?? 0),
      coveragePct: Number(s.coveragePct ?? 0),
      currentPerformancePct: s.currentPerformancePct != null ? Number(s.currentPerformancePct) : null,
      risk: s.risk,
    });

    const lowGrade = loaded
      .filter((s) => s.currentPerformancePct != null && Number(s.currentPerformancePct) < 50)
      .map((s) => toRow(s, "low_grade"))
      .sort((a, b) => (a.currentPerformancePct ?? 0) - (b.currentPerformancePct ?? 0));

    const overdue = loaded
      .filter((s) => Number(s.notSubmittedWeightPct ?? s.overdueWeightPct ?? 0) > 0)
      .map((s) => toRow(s, "overdue"))
      .sort((a, b) => b.notSubmittedWeightPct - a.notSubmittedWeightPct);

    const lowCov = loaded
      .filter((s) => s.coveragePct != null && Number(s.coveragePct) < 60)
      .map((s) => toRow(s, "low_coverage"))
      .sort((a, b) => a.coveragePct - b.coveragePct);

    const seen = new Set();
    const merged = [];
    // Orden: pendientes/baja-cobertura primero, críticos de nota abajo
    for (const s of [...lowCov, ...overdue, ...lowGrade]) {
      if (!seen.has(s.userId)) {
        seen.add(s.userId);
        merged.push(s);
      }
    }
    return merged.slice(0, 7);
  }, [overview, studentRows]);

  const filteredStudents = useMemo(() => {
    let list = Array.isArray(studentRows) ? [...studentRows] : [];
    if (onlyRisk) list = list.filter((s) => ["alto", "medio"].includes(normStatus(s.risk)));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          String(s.userId).includes(q) ||
          String(s.displayName || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [studentRows, query, onlyRisk]);

const contentKpis = useMemo(() => {
    const root = Array.isArray(contentRoot) ? contentRoot : [];
    if (!root.length) {
      return { createdCount: null, minExpected: null, progressRatio: null };
    }

    const start = toDate(courseInfo?.StartDate);
    const end = toDate(courseInfo?.EndDate);
    if (!start) {
      return { createdCount: null, minExpected: null, progressRatio: null };
    }

    const now = new Date();
    const windowEnd = end && end < now ? end : now;

    let createdCount = 0;

    for (const mod of root) {
      if (mod?.IsHidden === true) continue;

      const items = Array.isArray(mod?.Structure) ? mod.Structure : [];
      for (const it of items) {
        const isVisible = it?.IsHidden !== true;
        const isLeafContent = Number(it?.Type) === 1; // no contar módulos/folders
        const itDate = toDate(it?.LastModifiedDate);

        if (isVisible && isLeafContent && itDate && itDate >= start) {
          createdCount += 1;
        }
      }
    }

    const weeks = weeksBetween(start, windowEnd);
    const minExpected = Math.max(1, Math.ceil(weeks / 2));
    const progressRatio = minExpected > 0 ? clamp(createdCount / minExpected, 0, 2) : null;

    return { createdCount, minExpected, progressRatio };
  }, [contentRoot, courseInfo?.StartDate, courseInfo?.EndDate]);

  const contentRhythmMeta = useMemo(() => {
    return contentRhythmStatus(contentKpis?.progressRatio);
  }, [contentKpis]);
  const performanceBands = useMemo(() => {
    // Aligned with dashboard thresholds (50 = critical, 70 = watch)
    // Converted to 0-10 scale: 50% = 5.0, 70% = 7.0
    const bands = [
      { name: "Óptimo (≥7)", key: "solid", value: 0, students: [], color: COLORS.ok },
      { name: "Seguimiento (5–7)", key: "watch", value: 0, students: [], color: COLORS.watch },
      { name: "Crítico (<5)", key: "critical", value: 0, students: [], color: COLORS.critical },
      { name: "Sin datos", key: "pending", value: 0, students: [], color: COLORS.pending },
    ];

    for (const s of studentRows) {
      const p = s?.currentPerformancePct;
      if (p == null || Number.isNaN(Number(p))) {
        bands[3].value += 1;
        bands[3].students.push(s);
      } else if (Number(p) >= 70) {
        bands[0].value += 1;
        bands[0].students.push(s);
      } else if (Number(p) >= 50) {
        bands[1].value += 1;
        bands[1].students.push(s);
      } else {
        bands[2].value += 1;
        bands[2].students.push(s);
      }
    }

    return bands;
  }, [studentRows]);

  const sortedStudents = useMemo(() => {
    const list = filteredStudents.slice();
    const dir = sortDir === "asc" ? 1 : -1;

    const getVal = (s) => {
      switch (sortKey) {
        case "userId":
          return Number(s.userId || 0);
        case "grade10":
          return s.currentPerformancePct == null ? -1 : Number(s.currentPerformancePct) / 10;
        case "coverage":
          return s.coveragePct == null ? -1 : Number(s.coveragePct);
        case "risk": {
          const r = normStatus(s.risk);
          return r === "alto" ? 0 : r === "medio" ? 1 : r === "bajo" ? 2 : 3;
        }
        default:
          return String(s.displayName || "").toLowerCase();
      }
    };

    list.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb), "es", { sensitivity: "base" }) * dir;
      }
      return (Number(va) - Number(vb)) * dir;
    });

    return list;
  }, [filteredStudents, sortKey, sortDir]);

  const drawerSummary = studentDetail?.summary || {};
  const drawerMacro = (studentDetail?.macroUnits || studentDetail?.macro?.units || []).map((u) => ({
    code: u.code,
    pct: Number(u.pct || 0),
  }));
  const drawerUnits = studentDetail?.units || [];
  const drawerPrescription = Array.isArray(studentDetail?.prescription) ? studentDetail.prescription : [];
  const drawerProjection = studentDetail?.projection || null;
  const drawerGradebook = studentDetail?.gradebook || {};
  const drawerEvidences = Array.isArray(drawerGradebook?.evidences) ? drawerGradebook.evidences : [];
  const drawerPendingItems = Array.isArray(drawerGradebook?.pendingItems) ? drawerGradebook.pendingItems : [];
  const drawerMissingValues = Array.isArray(drawerGradebook?.missingValues) ? drawerGradebook.missingValues : [];
  const drawerQcFlags = Array.isArray(studentDetail?.qualityFlags) ? studentDetail.qualityFlags : [];
  // Drawer: usar nuevos campos semánticos
  const drawerPendingSubmittedPct = Number(
    drawerSummary?.pendingSubmittedWeightPct ?? drawerSummary?.pendingUngradedWeightPct ?? 0
  );
  const drawerOverduePct = Number(
    drawerSummary?.overdueWeightPct ?? drawerSummary?.notSubmittedWeightPct ?? drawerSummary?.overdueUnscoredWeightPct ?? 0
  );
  // Aliases para compatibilidad con CoverageBars existente en drawer
  const drawerPendingUngradedPct = drawerPendingSubmittedPct;
  const drawerOverdueUnscoredPct = drawerOverduePct;
  const covGraded = Number(drawerSummary?.gradedItemsCount ?? drawerGradebook?.gradedItemsCount ?? 0) || 0;
  const covTotal = Number(drawerSummary?.totalItemsCount ?? drawerGradebook?.totalItemsCount ?? 0) || 0;
  const covText =
    drawerSummary?.coverageCountText ||
    drawerGradebook?.coverageCountText ||
    (covTotal > 0 ? `${covGraded}/${covTotal}` : null);
  const covMissing = covTotal > 0 ? Math.max(0, covTotal - covGraded) : 0;

  const drawerTabs = [
    { id: "resumen", label: "Resumen", icon: "📊" },
    { id: "evidencias", label: "Evidencias", icon: "📋", count: drawerEvidences.length || undefined },
    { id: "unidades", label: "Unidades", icon: "🎯", count: drawerUnits.length || undefined },
    ...(drawerPrescription.length
      ? [{ id: "prescripcion", label: "Intervención", icon: "💊", count: drawerPrescription.length }]
      : []),
    ...(drawerQcFlags.filter((f) => f?.type && f.type !== "role_not_enabled").length
      ? [{ id: "calidad", label: "Calidad", icon: "🔍" }]
      : []),
  ];

  const makeSort = (key) => ({
    active: sortKey === key,
    dir: sortDir,
    onClick: () => {
      const d = sortKey === key && sortDir === "asc" ? "desc" : "asc";
      setSortKey(key);
      setSortDir(d);
    },
  });

  if (loading) return <CesaLoader subtitle="Cargando tablero..." />;

  if (err) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
        <Card title="Error al cargar el curso" right={<StatusBadge status="critico" />}>
          <div style={{ color: "var(--critical)", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{err}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Verifica: <code style={{ fontFamily: "var(--font-mono)" }}>/gemelo/course/{orgUnitId}/overview</code>
          </div>
        </Card>
      </div>
    );
  }

  if (!overview) return <CesaLoader subtitle="Inicializando información del curso..." />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>

      {/* ── Course Panel Portal — rendered at root to avoid stacking context issues ── */}
      {showCoursePanel && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)",
            display: "flex", justifyContent: "flex-end",
          }}
          onClick={() => setShowCoursePanel(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel-slide"
            style={{
              width: "min(380px, 96vw)", height: "100%",
              background: "var(--bg)",
              boxShadow: "-8px 0 48px rgba(0,0,0,0.22)",
              display: "flex", flexDirection: "column",
              borderLeft: "1px solid var(--border)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "18px 18px 14px",
              borderBottom: "1px solid var(--border)",
              background: "var(--card)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>
                    📚 Mis cursos
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                    Selecciona un curso o ingresa el ID
                  </div>
                </div>
                <button
                  onClick={() => setShowCoursePanel(false)}
                  style={{
                    background: "var(--bg)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "4px 9px", cursor: "pointer",
                    fontSize: 14, color: "var(--muted)", lineHeight: 1,
                  }}
                >✕</button>
              </div>
              {/* Inline ID search */}
              <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
                <input
                  value={orgUnitInput}
                  onChange={(e) => setOrgUnitInput(e.target.value)}
                  type="number"
                  style={{
                    flex: 1, border: "1px solid var(--border)", borderRadius: 8,
                    padding: "8px 11px", fontWeight: 700, background: "var(--bg)",
                    color: "var(--text)", fontSize: 13, outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                  placeholder="OrgUnitId…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = Number(orgUnitInput);
                      if (v > 0) { setOrgUnitId(v); setShowCoursePanel(false); }
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  style={{ paddingLeft: 14, paddingRight: 14, borderRadius: 8 }}
                  onClick={() => {
                    const v = Number(orgUnitInput);
                    if (v > 0) { setOrgUnitId(v); setShowCoursePanel(false); }
                  }}
                >
                  Ir →
                </button>
              </div>
            </div>
            {/* Course list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
              {courseListLoading ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <span className="pulse-dot" style={{ background: "var(--brand)", width: 10, height: 10 }} />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Cargando cursos…</div>
                </div>
              ) : courseList.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 8px 6px" }}>
                    {courseList.length} curso{courseList.length !== 1 ? "s" : ""}
                  </div>
                  {courseList.map((c, i) => {
                    const cId = c.OrgUnitId || c.orgUnitId || c.Id || c.id;
                    const cName = c.Name || c.name || c.DisplayName || c.displayName || `Curso ${cId}`;
                    const cCode = c.Code || c.code || c.OrgUnitCode || "";
                    const isActive = cId && Number(cId) === Number(orgUnitId);
                    return (
                      <button
                        key={cId || i}
                        onClick={() => {
                          if (cId) { setOrgUnitId(Number(cId)); setOrgUnitInput(String(cId)); }
                          setShowCoursePanel(false);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 10px", borderRadius: 10,
                          border: isActive ? "1px solid var(--brand)" : "1px solid transparent",
                          background: isActive ? "rgba(99,102,241,0.07)" : "var(--card)",
                          cursor: "pointer", textAlign: "left",
                          transition: "background 0.12s",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg)"; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "var(--card)"; }}
                      >
                        <div style={{ width: 4, flexShrink: 0, alignSelf: "stretch", borderRadius: 999, background: isActive ? "var(--brand)" : "var(--border)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {cName}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                            {cCode ? `${cCode} · ` : ""}ID {cId}
                          </div>
                        </div>
                        {isActive && <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)", flexShrink: 0 }}>Activo</div>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📭</div>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>Sin cursos cargados</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                    El endpoint de cursos no retornó datos.<br />
                    Usa el campo de ID arriba para navegar.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "12px" : "20px" }}>
        <div
          className="fade-up"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            gap: 12,
            flexDirection: isMobile ? "column" : "row",
            marginBottom: 20,
          }}
        >
          {/* ── Brand + Course breadcrumb ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
                  Gemelo Digital
                </span>
                <span className="tag">Vista Docente</span>
              </div>
              <button
                onClick={() => setShowCoursePanel(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "none", border: "none", cursor: "pointer",
                  padding: 0, textAlign: "left",
                }}
                title="Cambiar de curso"
              >
                <span style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  {courseInfo?.Name
                    ? (courseInfo.Name.length > 55 ? courseInfo.Name.slice(0, 52) + "…" : courseInfo.Name)
                    : `Curso ${orgUnitId}`}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
              </button>
            </div>
          </div>

          {/* ── Controls ── */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn"
              onClick={() => setShowCoursePanel(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <span>📚</span>
              <span>{isMobile ? "" : "Mis cursos"}</span>
            </button>

            <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <input
                value={orgUnitInput}
                onChange={(e) => setOrgUnitInput(e.target.value)}
                type="number"
                style={{
                  width: 110, border: "none", borderRight: "1px solid var(--border)",
                  padding: "8px 10px", fontWeight: 700,
                  background: "var(--card)", color: "var(--text)", fontSize: 13,
                  outline: "none",
                }}
                placeholder="OrgUnitId"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { const v = Number(orgUnitInput); if (v > 0) setOrgUnitId(v); }
                }}
              />
              <button
                className="btn btn-primary"
                style={{ borderRadius: 0, border: "none", paddingLeft: 12, paddingRight: 12 }}
                onClick={() => { const v = Number(orgUnitInput); if (v > 0) setOrgUnitId(v); }}
              >
                →
              </button>
            </div>

            <button className="btn" onClick={() => setDarkMode((v) => !v)} title="Cambiar tema" style={{ padding: "8px 10px" }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>

        <div className="fade-up fade-up-1" style={{ marginBottom: 12 }}>
          <AlertsPanel alerts={overview?.alerts} />
        </div>

        <div
          className="fade-up fade-up-2"
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : isNarrow ? "1fr 1fr" : "2fr 1fr 1fr 1fr",
            gap: 12,
            marginBottom: 12,
            alignItems: "stretch",
          }}
        >
          <Card title="Gestión del curso" right={<StatusBadge status={courseStatus} />}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
                marginBottom: 14,
              }}
            >
              <Stat
                label="Nota promedio (0–10)"
                value={avgPerfPct == null || Number(avgPerfPct) === 0 ? "—" : fmtGrade10FromPct(avgPerfPct)}
                valueColor={colorForPct(avgPerfPct, thresholds)}
                sub={
                  avgCov == null || Number(avgCov) === 0
                    ? "Sin cobertura registrada"
                    : avgPendingSubmittedPct > 0
                    ? `${fmtPct(covDone)} calif. · ${fmtPct(avgPendingSubmittedPct)} pend. · ${fmtPct(avgNotSubmittedPct)} venc.`
                    : `${fmtPct(covDone)} calificado · ${fmtPct(covPending)} sin entregar`
                }
              />
              <Stat
                label="Estudiantes"
                value={studentsCount}
                sub={`${overview?.courseGradebook?.avgGradedItemsCount ?? 0}/${overview?.courseGradebook?.avgTotalItemsCount ?? 0} ítems prom.`}
              />
            </div>

            <Divider />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                En riesgo (alto + medio)
              </div>
              <InfoTooltip text="Este indicador es un resultado. La gestión del curso se prioriza por acciones docentes: publicación sostenida de contenidos, oportunidad de retroalimentación y cierre evaluativo. Objetivo operativo: mínimo 1 contenido nuevo cada 2 semanas y retroalimentación posterior al vencimiento en máximo 8 días." />
            </div>

            <Stat
              label=""
              value={atRiskPct == null ? "—" : fmtPct(atRiskPct)}
              valueColor={
                atRiskPct != null && atRiskPct > 40
                  ? COLORS.critical
                  : atRiskPct != null && atRiskPct > 20
                  ? COLORS.watch
                  : COLORS.ok
              }
              sub={totalStudents ? `${atRiskCount} de ${totalStudents} estudiantes` : "—"}
            />

            <Divider />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Ritmo de contenidos del profesor
              </div>
              <InfoTooltip text="Se mide el contenido o módulo actualizados/creados desde el inicio del curso." />
              <div style={{ marginLeft: "auto" }}>
                <span
                  className="badge"
                  style={{ background: contentRhythmMeta.bg, color: contentRhythmMeta.color }}
                >
                  <span
                    className="pulse-dot"
                    style={{ background: contentRhythmMeta.color, width: 6, height: 6 }}
                  />
                  {contentRhythmMeta.label}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              <div
                style={{
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--card)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Contenidos creados
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
                  {contentKpis?.createdCount == null ? "—" : contentKpis.createdCount}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Desde inicio del curso
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--card)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Mínimo esperado
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
                  {contentKpis?.minExpected == null ? "—" : contentKpis.minExpected}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Basado en avance del curso
                </div>
              </div>
            </div>

            {contentKpis?.progressRatio != null && (
              <div style={{ marginTop: 10 }}>
                <ProgressBar
                  value={Math.min(100, contentKpis.progressRatio * 100)}
                  color={contentRhythmMeta.color}
                  animate={false}
                  showLabel={false}
                />
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    marginTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Cumplimiento vs mínimo</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800 }}>
                    {Math.round(contentKpis.progressRatio * 100)}%
                  </span>
                </div>
              </div>
            )}

            <Divider />

            <div style={{ marginTop: 14 }}>
              {avgCov == null || Number(avgCov) === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Cobertura no disponible (sin evidencias calificadas)
                </div>
              ) : (
                <CoverageBars
                  donePct={covDone}
                  pendingPct={avgPendingSubmittedPct}
                  overduePct={avgNotSubmittedPct}
                />
              )}
            </div>
          </Card>

          <Card title="Riesgo académico">
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>
                    {riskData.map((entry) => (
                      <Cell key={entry.key} fill={colorForRisk(entry.key)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => {
                    const v = Number(value || 0);
                    const pct = totalStudents > 0 ? (v / totalStudents) * 100 : 0;
                    return [`${v} (${pct.toFixed(1)}%)`, "Estudiantes"];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
              {riskData.map((r) => {
                const count = Number(r.value || 0);
                const pct = totalStudents > 0 ? (count / totalStudents) * 100 : 0;
                return (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: colorForRisk(r.key), flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "var(--font-mono)", color: colorForRisk(r.key) }}>{count}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", width: 44, textAlign: "right" }}>{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>

            <div style={{ height: 1, background: "var(--border)", margin: "4px 0 10px" }} />

            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Distribución de notas
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {performanceBands.map((b) => {
                const pct = totalStudents > 0 ? (b.value / totalStudents) * 100 : 0;
                if (b.value === 0) return null;
                return (
                  <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 11, color: b.key === "critical" ? COLORS.critical : "var(--muted)", width: 78, flexShrink: 0, fontWeight: b.key === "critical" ? 800 : 600 }}>
                      {b.name}
                    </div>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(148,163,184,0.15)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: b.color, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, fontFamily: "var(--font-mono)", color: b.color, width: 24, textAlign: "right" }}>{b.value}</div>
                  </div>
                );
              })}
            </div>

            {avgNotSubmittedPct > 0 && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "10px 0 8px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Vencidos sin registro</div>
                  <div style={{ fontSize: 13, fontWeight: 900, fontFamily: "var(--font-mono)", color: COLORS.critical }}>
                    {fmtPct(avgNotSubmittedPct)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Promedio del curso · peso del gradebook
                </div>
              </>
            )}
          </Card>

          <Card
            title="Estudiantes prioritarios"
            right={
              assignmentRiskData.length > 0
                ? <span className="tag" style={{ background: "var(--critical-bg)", color: "#B42318" }}>Requieren atención</span>
                : <StatusBadge status="solido" />
            }
          >
            {studentRows.some((s) => s.isLoading) && !assignmentRiskData.length ? (
              <div className="empty-state" style={{ minHeight: 120 }}>
                <span className="pulse-dot" style={{ background: COLORS.brand, width: 10, height: 10 }} />
                <span style={{ fontSize: 12 }}>Cargando datos de cobertura…</span>
              </div>
            ) : assignmentRiskData.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Nota &lt;5 · cobertura baja · ítems vencidos
                </div>
                <div style={{ overflowY: "auto", maxHeight: 420, paddingRight: 2, display: "flex", flexDirection: "column", gap: 6 }}>
                {assignmentRiskData.map((item) => {
                  const covColor = colorForPct(item.coveragePct, thresholds);
                  const hasOverdue = item.notSubmittedWeightPct > 0;
                  const hasLowGrade = item.type === "low_grade";
                  const grade10 = item.currentPerformancePct != null ? (item.currentPerformancePct / 10).toFixed(1) : null;
                  const gradeColor = item.currentPerformancePct != null ? colorForPct(item.currentPerformancePct, thresholds) : COLORS.pending;

                  // Border/bg color priority: low grade > overdue > default
                  const borderColor = hasLowGrade ? "#FECDCA" : hasOverdue ? "#FED7AA" : "var(--border)";
                  const bgColor = hasLowGrade ? "var(--critical-bg)" : hasOverdue ? "var(--watch-bg)" : "var(--card)";

                  return (
                    <div
                      key={item.userId}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const s = studentRows.find((r) => r.userId === item.userId);
                        if (s) setSelectedStudent(s);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const s = studentRows.find((r) => r.userId === item.userId);
                          if (s) setSelectedStudent(s);
                        }
                      }}
                      style={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 10,
                        padding: "9px 11px",
                        background: bgColor,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        transition: "box-shadow 0.15s, transform 0.1s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                    >
                      {/* Row 1: name + risk + reason tag */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </div>
                          <div style={{ marginTop: 2 }}>
                            {item.type === "pending_submitted" && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: COLORS.brand, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                ⏳ Pendiente calificación
                              </span>
                            )}
                            {item.type === "overdue" && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: COLORS.critical, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                🔴 Vencido sin entrega
                              </span>
                            )}
                            {item.type === "low_grade" && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: COLORS.critical, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                ⚠️ Nota crítica
                              </span>
                            )}
                            {item.type === "low_coverage" && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                📉 Cobertura baja
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={item.risk} />
                      </div>

                      {/* Row 2: metrics */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {/* Grade pill */}
                        {grade10 != null && (
                          <div style={{ flexShrink: 0, textAlign: "center", minWidth: 38, padding: "3px 7px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: `1px solid ${gradeColor}30` }}>
                            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Nota</div>
                            <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "var(--font-mono)", color: gradeColor, lineHeight: 1.1 }}>{grade10}</div>
                          </div>
                        )}
                        {/* Coverage bar */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Cobertura</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(148,163,184,0.2)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${item.coveragePct}%`, background: covColor, borderRadius: 999 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "var(--font-mono)", color: covColor, flexShrink: 0 }}>
                              {fmtPct(item.coveragePct)}
                            </span>
                          </div>
                        </div>
                        {/* Overdue pill */}
                        {item.pendingSubmittedWeightPct > 0 && (
                          <div style={{ flexShrink: 0, textAlign: "center", padding: "3px 7px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px solid #FED7AA" }}>
                            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pendiente</div>
                            <div style={{ fontSize: 12, fontWeight: 900, fontFamily: "var(--font-mono)", color: COLORS.watch }}>{fmtPct(item.pendingSubmittedWeightPct)}</div>
                          </div>
                        )}
                        {hasOverdue && (
                          <div style={{ flexShrink: 0, textAlign: "center", padding: "3px 7px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px solid #FECDCA" }}>
                            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Vencido</div>
                            <div style={{ fontSize: 12, fontWeight: 900, fontFamily: "var(--font-mono)", color: COLORS.critical }}>{fmtPct(item.notSubmittedWeightPct)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 2 }}>
                  Haz clic en un estudiante para ver su gemelo →
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ minHeight: 160 }}>
                <span className="empty-state-icon">✅</span>
                <span style={{ fontSize: 12 }}>Sin estudiantes críticos</span>
                <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                  Todos los estudiantes tienen cobertura ≥ 60% y sin ítems vencidos.
                </span>
              </div>
            )}
          </Card>

          <Card title="Prioridad académica">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 560,
                overflowY: "auto",
                paddingRight: 2,
              }}
            >
              {learningOutcomesData
                .slice()
                .sort((a, b) => a.avgPct - b.avgPct)
                .map((m) => {
                  const computedStatus =
                    m.status ||
                    (m.avgPct < thresholds.critical
                      ? "critico"
                      : m.avgPct < thresholds.watch
                      ? "observacion"
                      : "solido");
                  const pctColor = colorForPct(m.avgPct, thresholds);
                  const desc = (m.description || m.name || "").trim();

                  return (
                    <div
                      key={m.code}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: 10,
                        background: "var(--card)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="tag">{m.code}</span>
                          <InfoTooltip text={desc || "Sin descripción disponible."} />
                        </div>
                        <StatusBadge status={computedStatus} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 900, fontSize: 18, fontFamily: "var(--font-mono)", color: pctColor }}>
                          {fmtPct(m.avgPct)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          Peso {m.weightPct ? `${Number(m.weightPct).toFixed(0)}%` : "—"}
                        </span>
                      </div>

                      {m.coveragePct != null && (
                        <div style={{ marginTop: 4 }}>
                          <ProgressBar value={m.coveragePct} color={pctColor} />
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, display: "flex", justifyContent: "space-between" }}>
                            <span>{m.studentsWithData}/{m.totalStudents} estudiantes</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fmtPct(m.coveragePct)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {!learningOutcomesData.length && (
                <div className="empty-state">
                  <span className="empty-state-icon">🎯</span>
                  <span style={{ fontSize: 12 }}>Sin datos de RA</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="fade-up fade-up-3">
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Estudiantes</span>
                <span className="tag">{studentsList?.students?.count ?? studentRows.length ?? 0}</span>
                {studentRows.some((s) => s.isLoading) && (
                  <span
                    className="pulse-dot"
                    style={{ background: COLORS.brand, width: 8, height: 8 }}
                    title="Cargando datos..."
                  />
                )}
              </div>
            }
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} />
                  Solo en riesgo
                </label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por ID o nombre…"
                  type="text"
                  style={{
                    width: isMobile ? "100%" : 220,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "7px 10px",
                    fontWeight: 600,
                    background: "var(--card)",
                    color: "var(--text)",
                    fontSize: 12,
                  }}
                />
              </div>
            }
          >
            {useCards ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedStudents.map((s) => (
                  <StudentCard key={s.userId} s={s} onOpen={setSelectedStudent} />
                ))}
                {!sortedStudents.length && (
                  <div className="empty-state">
                    <span className="empty-state-icon">🔍</span>
                    <span>Sin resultados para el filtro</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)", borderBottom: "2px solid var(--border)" }}>
                      <SortTh label="ID" {...makeSort("userId")} />
                      <SortTh label="Nombre" {...makeSort("name")} />
                      <SortTh label="Riesgo" {...makeSort("risk")} />
                      <th
                        style={{
                          padding: "10px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--muted)",
                        }}
                      >
                        Ruta
                      </th>
                      {!hideCriticalMacroCol && (
                        <th
                          style={{
                            padding: "10px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--muted)",
                          }}
                        >
                          RA crítico
                        </th>
                      )}
                      {!hideGlobalProgressCol && (
                        <th
                          style={{
                            padding: "10px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--muted)",
                          }}
                        >
                          Global
                        </th>
                      )}
                      <SortTh label="Nota" {...makeSort("grade10")} />
                      <SortTh label="Cobertura" {...makeSort("coverage")} title="% del curso con evidencias calificadas" />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((s) => (
                      <tr
                        key={s.userId}
                        onClick={() => setSelectedStudent(s)}
                        className="tr-hover"
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      >
                        <td
                          style={{
                            padding: "10px 10px",
                            fontWeight: 700,
                            color: "var(--muted)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                          }}
                        >
                          {s.userId}
                        </td>
                        <td style={{ padding: "10px 10px", fontWeight: 700, color: "var(--text)", minWidth: 180 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {s.displayName}
                            {s.hasPrescription && (
                              <span title="Tiene prescripción activa" style={{ fontSize: 14 }}>
                                📋
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <StatusBadge status={s.isLoading ? "cargando" : s.risk} />
                        </td>
                        <td style={{ padding: "10px 10px", maxWidth: compactRouteCol ? 200 : 320, minWidth: 160 }}>
                          {s.route ? (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)" }}>
                                {s.route.title}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--muted)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: compactRouteCol ? 180 : 300,
                                }}
                                title={s.route.summary}
                              >
                                {s.route.summary}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        {!hideCriticalMacroCol && (
                          <td style={{ padding: "10px 10px", minWidth: 90 }}>
                            {s.mostCriticalMacro ? (
                              <div>
                                <div
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: colorForPct(s.mostCriticalMacro.pct, thresholds),
                                  }}
                                >
                                  {s.mostCriticalMacro.code}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                  {fmtPct(s.mostCriticalMacro.pct)}
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                        {!hideGlobalProgressCol && (
                          <td
                            style={{
                              padding: "10px 10px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--text)",
                            }}
                          >
                            {fmtPct(s.globalPct)}
                          </td>
                        )}
                        <td style={{ padding: "10px 10px" }}>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 16,
                              fontWeight: 900,
                              color: colorForPct(s.currentPerformancePct, thresholds),
                            }}
                          >
                            {fmtGrade10FromPct(s.currentPerformancePct)}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", minWidth: 110 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "var(--font-mono)" }}>
                            {fmtPct(s.coveragePct)}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>
                            {s.coverageCountText || "—"}
                          </div>
                          {s.coveragePct != null && (
                            <ProgressBar
                              value={s.coveragePct}
                              color={colorForPct(s.coveragePct, thresholds)}
                              animate={false}
                            />
                          )}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right" }}>
                          <button
                            className="btn"
                            style={{ fontSize: 12, padding: "5px 10px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudent(s);
                            }}
                          >
                            Ver →
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!sortedStudents.length && (
                      <tr>
                        <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                          Sin resultados para el filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Drawer
        open={!!selectedStudent}
        onClose={() => {
          setSelectedStudent(null);
          setStudentDetail(null);
          setStudentErr("");
          setStudentLoading(false);
        }}
        title={selectedStudent ? `${selectedStudent.displayName}` : "Estudiante"}
      >
        {studentLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
            <div className="cesa-water-text" style={{ fontSize: 36 }}>
              <span className="cesa-water-text__outline" style={{ fontSize: 36 }}>CESA</span>
              <span className="cesa-water-text__fill" aria-hidden="true" style={{ fontSize: 36 }}>CESA</span>
              <span className="cesa-water-text__wave" aria-hidden="true" />
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Consolidando gemelo digital…</div>
          </div>
        ) : studentErr ? (
          <Card title="Error" right={<StatusBadge status="critico" />}>
            <div style={{ color: "var(--critical)", fontWeight: 700 }}>{studentErr}</div>
          </Card>
        ) : !studentDetail ? (
          <Card title="Sin información" right={<StatusBadge status="pending" />}>
            <div style={{ color: "var(--muted)" }}>No hay datos consolidados para este estudiante.</div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div style={{ textAlign: "center", padding: "12px 8px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Nota</div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)", color: colorForPct(drawerSummary?.currentPerformancePct, thresholds) }}>
                  {fmtGrade10FromPct(drawerSummary?.currentPerformancePct)}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "12px 8px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Cobertura</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)", color: colorForPct(drawerSummary?.coveragePct, thresholds) }}>
                  {fmtPct(drawerSummary?.coveragePct)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {covText || "—"} · faltan {covMissing}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "12px 8px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Riesgo</div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <StatusBadge status={drawerSummary?.risk || "pending"} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              {drawerTabs.map((tab) => (
                <button key={tab.id} className={`chip ${drawerTab === tab.id ? "active" : ""}`} onClick={() => setDrawerTab(tab.id)} style={{ fontSize: 12 }}>
                  {tab.icon} {tab.label}{" "}
                  {tab.count != null ? (
                    <span className="tag" style={{ fontSize: 10, padding: "1px 6px" }}>
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {drawerTab === "resumen" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {drawerMacro.length > 0 && (
                  <Card title="Resultados de aprendizaje del estudiante">
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <BarChart data={drawerMacro} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="code" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Desempeño"]} />
                          <ReferenceLine y={Number(thresholds?.watch || 70)} stroke={COLORS.watch} strokeDasharray="4 4" />
                          <ReferenceLine y={Number(thresholds?.critical || 50)} stroke={COLORS.critical} strokeDasharray="4 4" />
                          <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                            {drawerMacro.map((item) => (
                              <Cell key={item.code} fill={colorForPct(item.pct, thresholds)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {drawerProjection && <ProjectionBlock projection={drawerProjection} thresholds={thresholds} />}

                {selectedStudent?.route && (
                  <Card title={selectedStudent.route.title} right={<StatusBadge status={selectedStudent.risk || "pending"} />}>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{selectedStudent.route.summary}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(selectedStudent.route.actions || []).map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span style={{ color: COLORS.brand, fontWeight: 900, minWidth: 16, fontSize: 12 }}>{i + 1}.</span>
                          <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <PendingItemsBlock pendingItems={drawerPendingItems} missingValues={drawerMissingValues} />
              </div>
            )}

            {drawerTab === "evidencias" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {drawerEvidences.length > 0 ? (
                  <>
                    <EvidencesTimeline evidences={drawerEvidences} thresholds={thresholds} />
                    <Card title="Detalle de evidencias">
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid var(--border)" }}>
                              <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "left" }}>Evidencia</th>
                              <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "right" }}>Peso</th>
                              <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "right" }}>Nota</th>
                              <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "center" }}>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drawerEvidences.map((e, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                                  {e.name || `Ítem ${e.gradeObjectId}`}
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                                  {fmtPct(e.weightPct)}
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 900, color: colorForPct(e.scorePct, thresholds) }}>
                                  {e.scorePct != null ? (Number(e.scorePct) / 10).toFixed(1) : "—"}
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "center" }}>
                                  <StatusBadge status={e.status || "pending"} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon">📭</span>
                    <span>Sin evidencias calificadas disponibles</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Los ítems del gradebook aún no tienen nota registrada.
                    </span>
                  </div>
                )}
              </div>
            )}

            {drawerTab === "unidades" && (
              <Card title="Subcompetencias / Unidades">
                {drawerUnits.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {drawerUnits.map((u) => {
                      // Find matching RA description from learningOutcomesData
                      const raInfo = learningOutcomesData.find(
                        (r) => String(r.code).toUpperCase() === String(u.code).toUpperCase()
                      );
                      const raDesc = raInfo?.description || raInfo?.name || null;
                      const pctColor = colorForPct(u.pct, thresholds);
                      const evCount = (u.evidence || []).length;
                      return (
                        <div key={u.code} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                          {/* Header strip */}
                          <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", background: "var(--bg)", borderBottom: "1px solid var(--border)"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="tag" style={{ fontWeight: 900, fontSize: 12 }}>{u.code}</span>
                              <span style={{ fontSize: 13, fontWeight: 900, fontFamily: "var(--font-mono)", color: pctColor }}>
                                {fmtPct(u.pct)}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {evCount > 0 && (
                                <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 7px" }}>
                                  {evCount} evidencia{evCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              <StatusBadge status={u.status} />
                            </div>
                          </div>
                          {/* Body */}
                          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {raDesc && (
                              <div style={{
                                fontSize: 12, color: "var(--text)", lineHeight: 1.55, fontWeight: 500,
                                padding: "8px 10px", background: "var(--bg)", borderRadius: 8,
                                borderLeft: `3px solid ${pctColor}`
                              }}>
                                {raDesc}
                              </div>
                            )}
                            <ProgressBar value={u.pct} color={pctColor} />
                            {/* Evidence list */}
                            {(u.evidence || []).length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                                {(u.evidence || []).map((ev, i) => {
                                  const evPct = ev.scorePct ?? ev.pct ?? null;
                                  return (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--muted)", gap: 8 }}>
                                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        📄 {ev.name || ev.title || `Evidencia ${i + 1}`}
                                      </span>
                                      {evPct != null && (
                                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: colorForPct(evPct, thresholds), flexShrink: 0 }}>
                                          {fmtPct(evPct)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon">🎯</span>
                    <span>Sin unidades consolidadas</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Posible falta de rúbricas evaluadas o mapeadas.
                    </span>
                  </div>
                )}
              </Card>
            )}

            {drawerTab === "prescripcion" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--watch-bg)", border: "1px solid #FED7AA", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#9A3412" }}>
                  ⚠️ Este estudiante requiere intervención prioritaria.
                </div>
                {drawerPrescription.map((p) => (
                  <Card key={p.routeId} title={p.title} right={<span className="tag">{p.routeId}</span>}>
                    {p.successCriteria && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, padding: "6px 10px", background: "var(--bg)", borderRadius: 8 }}>
                        🎯 {p.successCriteria}
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(p.actions || []).map((a, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span
                            style={{
                              background: COLORS.brand,
                              color: "#fff",
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 900,
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                    {p.priority?.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.priority.map((pr) => (
                          <span key={pr} className="tag" style={{ background: "var(--critical-bg)", color: "#B42318" }}>
                            {pr}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {drawerTab === "calidad" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 12px", background: "var(--bg)", borderRadius: 8 }}>
                  Flags generados por el motor de calidad del gemelo. Indican posibles inconsistencias en rúbricas, criterios no mapeados, o datos ausentes.
                </div>
                <QualityFlagsBlock flags={drawerQcFlags} />
              </div>
            )}
          </div>
        )}
      </Drawer>
      </div>
  );
}