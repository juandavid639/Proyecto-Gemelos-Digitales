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
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
if (!API_BASE) {
  console.error("VITE_API_BASE_URL no está definida");
}

const GEMELO_API = API_BASE_URL;
const DEFAULT_ORG_UNIT_ID = 29120;

/**
 * =========================
 * CSS injection (tokens + animaciones)
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

  /* ---- Loader ---- */
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

  /* Water text */
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

  /* ---- Fade in ---- */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.35s ease both; }
  .fade-up-1 { animation-delay: 0.05s; }
  .fade-up-2 { animation-delay: 0.1s; }
  .fade-up-3 { animation-delay: 0.15s; }
  .fade-up-4 { animation-delay: 0.2s; }

  /* ---- Pulse dot ---- */
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }
  .pulse-dot {
    display: inline-block; width: 8px; height: 8px;
    border-radius: 50%; animation: pulse 1.4s ease infinite;
  }

  /* ---- Progress bar ---- */
  @keyframes fillBar {
    from { width: 0%; }
    to { width: var(--target-w); }
  }
  .fill-bar { animation: fillBar 0.7s cubic-bezier(.4,0,.2,1) both; animation-delay: 0.2s; }

  /* ---- Drawer ---- */
  .drawer-enter { animation: drawerIn 0.28s cubic-bezier(.4,0,.2,1) both; }
  @keyframes drawerIn {
    from { transform: translateX(40px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  /* ---- Tooltip row hover ---- */
  .tr-hover { transition: background 0.15s ease; }
  .tr-hover:hover { background: rgba(11,95,255,0.04) !important; }

  /* ---- Scrollbar ---- */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted); }

  /* ---- Badge pill ---- */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; white-space: nowrap;
    letter-spacing: 0.01em;
  }

  /* ---- KPI card ---- */
  .kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    box-shadow: var(--shadow);
    transition: box-shadow 0.2s ease;
  }
  .kpi-card:hover { box-shadow: var(--shadow-lg); }

  /* ---- Tag ---- */
  .tag {
    display: inline-flex; align-items: center;
    padding: 3px 8px; border-radius: 6px;
    font-size: 11px; font-weight: 700;
    font-family: var(--font-mono);
    background: var(--brand-light);
    color: var(--brand);
  }

  /* ---- Chip ---- */
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

  /* ---- Button ---- */
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

  /* ---- Scenario cards ---- */
  .scenario-card {
    border: 1px solid var(--border);
    border-radius: 10px; padding: 12px;
    display: flex; flex-direction: column; gap: 4px;
    background: var(--card);
  }
  .scenario-card.scenario-risk { border-color: #FECDCA; background: var(--critical-bg); }
  .scenario-card.scenario-base { border-color: var(--border); }
  .scenario-card.scenario-improve { border-color: #A9EFC5; background: var(--ok-bg); }

  /* ---- QC flag ---- */
  .qc-flag {
    font-size: 12px; padding: 8px 12px;
    border-radius: 8px; background: var(--pending-bg);
    border: 1px solid var(--border);
    font-family: var(--font-mono);
    color: var(--muted);
  }

  /* ---- Search input ---- */
  input[type="text"], input[type="number"] {
    font-family: var(--font);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  input[type="text"]:focus, input[type="number"]:focus {
    border-color: var(--brand) !important;
    box-shadow: 0 0 0 3px rgba(11,95,255,0.12) !important;
  }

  /* ---- Empty state ---- */
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
`;

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
  solido:           { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  "óptimo":         { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  optimo:           { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  observacion:      { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Seguimiento" },
  "en seguimiento": { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Seguimiento" },
  "en desarrollo":  { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "En desarrollo" },
  critico:          { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Crítico" },
  cargando:         { bg: "var(--brand-light)", fg: "#1D4ED8", dot: COLORS.brand, label: "Cargando" },
  pending:          { bg: "var(--pending-bg)", fg: "var(--muted)", dot: COLORS.pending, label: "Pendiente" },
  alto:             { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Alto" },
  medio:            { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Medio" },
  bajo:             { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Bajo" },
};


/**
 * =========================
 * Helpers
 * =========================
 */
function normStatus(x) { return String(x || "").toLowerCase().trim(); }

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

async function apiGet(url, opts = {}) {
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} - ${txt?.slice?.(0, 600) || txt}`);
  }
  return res.json();
}

async function mapLimit(arr, limit, mapper) {
  const list = Array.isArray(arr) ? arr : [];
  const results = new Array(list.length);
  let i = 0;
  const workers = new Array(Math.min(limit, list.length)).fill(null).map(async () => {
    while (i < list.length) { const idx = i++; results[idx] = await mapper(list[idx], idx); }
  });
  await Promise.all(workers);
  return results;
}

function pickCriticalMacroFromGemelo(g) {
  const arr = g?.macro?.units || g?.macroUnits || [];
  if (!Array.isArray(arr) || !arr.length) return null;
  const copy = arr.map((x) => ({ code: x.code, pct: Number(x.pct ?? x.avgPct ?? 0) })).filter((x) => x.code);
  if (!copy.length) return null;
  copy.sort((a, b) => a.pct - b.pct);
  return copy[0];
}

function suggestRouteForStudent(s, thresholds) {
  const risk = String(s?.risk || "").toLowerCase();
  const perf = s?.currentPerformancePct != null ? Number(s.currentPerformancePct) : null;
  const cov = s?.coveragePct != null ? Number(s.coveragePct) : null;
  if (cov != null && cov < 40) return { id: "route_coverage", title: "Ruta 0 — Activar evidencia", summary: "Priorizar calificación de evidencias pendientes.", actions: ["Identificar 1 evidencia crítica y publicarla esta semana", "Acordar fecha de entrega con el estudiante"] };
  if (risk === "alto") return { id: "route_high_risk", title: "Ruta 1 — Recuperación", summary: "Intervención inmediata con plan corto (7 días).", actions: ["Reunión 1:1 (15 min) para acordar objetivo semanal", "Actividad de refuerzo o re-entrega enfocada en el error", "Retroalimentación concreta + checklist de mejora"] };
  if (risk === "medio" || (perf != null && perf < thresholds.watch)) {
    const macro = s?.mostCriticalMacro?.code;
    return { id: "route_watch", title: "Ruta 2 — Ajuste dirigido", summary: macro ? `Enfoque: ${macro} (${fmtPct(s?.mostCriticalMacro?.pct)})` : "Enfoque: desempeño general", actions: ["Microtarea guiada (30–45 min) sobre el punto débil", "Ejemplo resuelto + plantilla de entrega", "Seguimiento en próxima evidencia"] };
  }
  return { id: "route_ok", title: "Ruta 3 — Mantener desempeño", summary: "Sostener ritmo y calidad.", actions: ["Mantener entregas a tiempo", "Extensión opcional: reto avanzado"] };
}

/**
 * =========================
 * UI Atoms
 * =========================
 */

function StatusBadge({ status }) {
  const s = normStatus(status);
  const cfg = STATUS_CONFIG[s] || { bg: "var(--pending-bg)", fg: "var(--muted)", dot: COLORS.pending, label: status || "—" };
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.fg }}>
      <span className="pulse-dot" style={{ background: cfg.dot, width: 6, height: 6 }} />
      {cfg.label}
    </span>
  );
}

function Card({ title, right, children, className = "", style = {} }) {
  return (
    <div className={`kpi-card ${className}`} style={style}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>{title}</div>
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
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 26, color: valueColor || "var(--text)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, fontWeight: 500 }}>{sub}</div> : null}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", width: "100%", margin: "4px 0" }} />;
}

function ProgressBar({ value, color, showLabel = false, animate = true }) {
  const pct = Math.max(0, Math.min(100, Number(value ?? 0)));
  // Solo anima en el primer mount; re-renders posteriores (búsqueda, filtros, etc.)
  // no deben volver a disparar la animación CSS.
  const mountedRef = React.useRef(false);
  const [didMount, setDidMount] = React.useState(false);
  React.useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; setDidMount(true); }
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
      {showLabel && <div style={{ position: "absolute", right: 0, top: -18, fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{fmtPct(pct)}</div>}
    </div>
  );
}

function InfoTooltip({ text }) {
  const [open, setOpen] = React.useState(false);
  if (!String(text || "").trim()) return null;
  return (
    <span style={{ position: "relative", display: "inline-flex", flex: "0 0 auto" }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
    >
      <span role="button" tabIndex={0} aria-label="Ver descripción" style={{ display: "inline-flex", width: 16, height: 16, borderRadius: 999, alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 10, fontWeight: 900, cursor: "help", background: "var(--card)", lineHeight: 1 }}>?</span>
      {open && (
        <div role="tooltip" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: "min(300px, 70vw)", zIndex: 9999, background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", borderRadius: 12, padding: 10, color: "var(--text)", fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
          {text}
          <div style={{ position: "absolute", right: 8, top: -5, width: 9, height: 9, background: "var(--card)", borderLeft: "1px solid var(--border)", borderTop: "1px solid var(--border)", transform: "rotate(45deg)" }} />
        </div>
      )}
    </span>
  );
}

function SortTh({ label, active, dir, onClick, title }) {
  return (
    <th onClick={onClick} title={title} style={{ padding: "10px 10px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: active ? "var(--brand)" : "var(--muted)" }}>
      {label} {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

/**
 * Coverage bars with count
 */
function CoverageBars({ donePct, pendingPct, notSubmittedPct }) {
  const d = Math.max(0, Math.min(100, Number(donePct ?? 0)));
  const p = Math.max(0, Math.min(100, Number(pendingPct ?? 0)));
  // notSubmittedPct: % de asignaciones vencidas sin entrega (no enviado)
  const ns = notSubmittedPct != null ? Math.max(0, Math.min(100, Number(notSubmittedPct))) : null;

  const BarRow = ({ label, value, color, tooltip }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }} title={tooltip}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
          {label}
        </div>
        <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 800, fontFamily: "var(--font-mono)" }}>{value.toFixed(1)}%</div>
      </div>
      {/* animate=false: la barra nunca re-anima en re-renders (búsqueda, filtros, etc.) */}
      <ProgressBar value={value} color={color} animate={false} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Índice de cumplimiento evaluativo</div>
      <BarRow label="Calificado" value={d} color={COLORS.ok} tooltip="Evidencias calificadas sobre el total de ítems del curso" />
      <BarRow label="Pendiente" value={p} color={COLORS.pending} tooltip="Ítems aún no calificados" />
      {ns != null && (
        <BarRow
          label="No enviado"
          value={ns}
          color={COLORS.critical}
          tooltip="Asignaciones con fecha de vencimiento pasada donde el estudiante no entregó"
        />
      )}
    </div>
  );
}

/**
 * =========================
 * Loader CESA
 * =========================
 */
function CesaLoader({ title = "Gemelo V. 1.0", subtitle = "Cargando tablero..." }) {
  React.useEffect(() => { injectStyles(); }, []);
  return (
    <div className="cesa-loader-wrap">
      <div className="cesa-loader-card">
        <div><div className="cesa-loader-title">{title}</div><div className="cesa-loader-sub">{subtitle}</div></div>
        <div className="cesa-loader-center">
          <div className="cesa-water-text" aria-label="Cargando CESA">
            <span className="cesa-water-text__outline">CESA</span>
            <span className="cesa-water-text__fill" aria-hidden="true">CESA</span>
            <span className="cesa-water-text__wave" aria-hidden="true" />
          </div>
        </div>
        <div className="cesa-loader-foot">Conectando con Brightspace y consolidando evidencias académicas…</div>
      </div>
    </div>
  );
}

/**
 * =========================
 * Alerts Panel (Radar docente)
 * =========================
 */
function AlertsPanel({ alerts }) {
  const list = Array.isArray(alerts) ? alerts : [];
  const [open, setOpen] = React.useState(false);
  if (!list.length) return null;

  const sevRank = (s) => { const x = normStatus(s); if (x === "critico") return 0; if (x === "en desarrollo" || x === "en seguimiento" || x === "observacion") return 1; return 2; };
  const sorted = list.slice().sort((a, b) => sevRank(a.severity) - sevRank(b.severity));

  const countBySev = (sev) => sorted.filter((x) => normStatus(x.severity) === sev).length;
  const cCrit = countBySev("critico");
  const cObs = sorted.filter((x) => ["en desarrollo", "en seguimiento", "observacion"].includes(normStatus(x.severity))).length;
  const cSol = countBySev("solido");


  return (
    <Card>
      <div role="button" tabIndex={0} onClick={() => setOpen((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((v) => !v); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔭</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Radar docente</span>
            <span className="tag">{sorted.length}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {cCrit > 0 && <span className="badge" style={{ background: "var(--critical-bg)", color: "#B42318" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.critical, display: "inline-block" }} />Críticos: {cCrit}</span>}
            {cObs > 0 && <span className="badge" style={{ background: "var(--watch-bg)", color: "#9A3412" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.watch, display: "inline-block" }} />Seguimiento: {cObs}</span>}
            {cSol > 0 && <span className="badge" style={{ background: "var(--ok-bg)", color: "#1B5E20" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.ok, display: "inline-block" }} />Óptimos: {cSol}</span>}
          </div>
        </div>
        <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }}>{open ? "Ocultar ▴" : "Ver ▾"}</button>
      </div>

      {open && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((a) => (
            <div key={a.id || `${a.title}-${Math.random()}`} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--card)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 800, color: "var(--text)", fontSize: 13 }}>{a.title || "Alerta"}</div>
                <StatusBadge status={a.severity} />
              </div>
              {a.message && <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{a.message}</div>}
              {/* KPIs inline desde el backend */}
              {a.kpis && Object.keys(a.kpis).length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  {Object.entries(a.kpis).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
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

/**
 * =========================
 * Drawer
 * =========================
 */
function Drawer({ open, onClose, title, children }) {
  React.useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,17,23,0.45)", display: "flex", justifyContent: "flex-end", zIndex: 50, backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div className="drawer-enter" style={{ width: "min(680px, 96vw)", height: "100%", background: "var(--card)", padding: 20, overflow: "auto", borderLeft: "1px solid var(--border)", color: "var(--text)", display: "flex", flexDirection: "column", gap: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Detalle del gemelo digital · Vista docente</div>
          </div>
          <button className="btn" onClick={onClose}>✕ Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * =========================
 * Projection Scenarios Block
 * =========================
 */
function ProjectionBlock({ projection, thresholds }) {
  if (!projection || !Array.isArray(projection.scenarios) || !projection.scenarios.length) return null;

  if (projection.isFinal) {
    return (
      <Card title="Proyección final" right={<span className="tag">Cobertura 100%</span>}>
        <Stat label="Nota final" value={fmtGrade10FromPct(projection.finalPct)} valueColor={colorForPct(projection.finalPct, thresholds)} />
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>La cobertura del 100% indica que esta es la nota definitiva del curso.</div>
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
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{meta.sub} · asume {fmtPct(s.assumptionPendingPct)} pendiente</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * =========================
 * Quality Flags Block
 * =========================
 */
function QualityFlagsBlock({ flags }) {
  const list = Array.isArray(flags) ? flags.filter(f => f?.type) : [];
  const [open, setOpen] = React.useState(false);
  if (!list.length) return null;

  const relevant = list.filter(f => f.type !== "role_not_enabled");
  if (!relevant.length) return null;

  return (
    <Card title={null}>
      <div role="button" tabIndex={0} onClick={() => setOpen(v => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(v => !v); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Flags de calidad del modelo</span>
          <span className="tag" style={{ background: "var(--watch-bg)", color: "var(--watch)" }}>{relevant.length}</span>
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

/**
 * =========================
 * Pending Items Block
 * =========================
 */
function PendingItemsBlock({ pendingItems, missingValues }) {
  const items = Array.isArray(pendingItems) ? pendingItems : [];
  const missing = Array.isArray(missingValues) ? missingValues : [];
  if (!items.length && !missing.length) return null;

  const [open, setOpen] = React.useState(false);
  const topPending = items.slice(0, 5);

  return (
    <Card title={null}>
      <div role="button" tabIndex={0} onClick={() => setOpen(v => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(v => !v); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sin calificar (por peso)</div>
              {topPending.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", flex: 1, minWidth: 0 }}>{it.name || `Ítem ${it.gradeObjectId}`}</div>
                  <span className="tag" style={{ background: "var(--watch-bg)", color: "#9A3412", flexShrink: 0 }}>{fmtPct(it.weightPct)} peso</span>
                </div>
              ))}
              {items.length > 5 && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "4px 0" }}>+ {items.length - 5} más</div>}
            </div>
          )}
          {missing.length > 0 && (
            <div style={{ marginTop: items.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>No liberados en gradebook ({missing.length})</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Ítems sin valor visible para el estudiante. Revisar configuración de visibilidad.</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * =========================
 * Evidences Timeline
 * =========================
 */
function EvidencesTimeline({ evidences, thresholds }) {
  const list = Array.isArray(evidences) ? evidences.filter(e => e.scorePct !== null && e.scorePct !== undefined) : [];
  if (!list.length) return null;
  const [open, setOpen] = React.useState(false);

  const chartData = list.map(e => ({
    name: (e.name || "").slice(0, 20),
    pct: Number(e.scorePct ?? 0),
    nota: Number((e.scorePct ?? 0) / 10).toFixed(1),
  }));

  return (
    <Card title={null}>
      <div role="button" tabIndex={0} onClick={() => setOpen(v => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(v => !v); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
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
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Nota"]} />
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

/**
 * =========================
 * Student card (mobile)
 * =========================
 */
function StudentCard({ s, onOpen }) {
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(s)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(s); }}
      className="kpi-card fade-up" style={{ cursor: "pointer" }}>
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
          <div style={{ fontWeight: 900, color: colorForPct(s.currentPerformancePct, null), fontSize: 16, fontFamily: "var(--font-mono)" }}>{fmtGrade10FromPct(s.currentPerformancePct)}</div>
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
        <button className="btn" style={{ fontSize: 11, padding: "5px 10px" }} onClick={(e) => { e.stopPropagation(); onOpen(s); }}>Ver gemelo →</button>
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
  React.useEffect(() => { injectStyles(); }, []);

  const isNarrow = useMediaQuery("(max-width: 900px)");
  const isMobile = useMediaQuery("(max-width: 640px)");

  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const [orgUnitId, setOrgUnitId] = useState(DEFAULT_ORG_UNIT_ID);
  const [orgUnitInput, setOrgUnitInput] = useState(String(DEFAULT_ORG_UNIT_ID));

  const [outcomesMap, setOutcomesMap] = useState({});
  const [learningOutcomesPayload, setLearningOutcomesPayload] = useState(null);

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

  // Active tab in drawer
  const [drawerTab, setDrawerTab] = useState("resumen"); // resumen | evidencias | unidades | prescripcion | calidad

  const hideGlobalProgressCol = isNarrow;
  const hideCriticalMacroCol = isMobile;
  const compactRouteCol = isNarrow;
  const useCards = isMobile;

  /**
   * Load course data
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
          apiGet(`${GEMELO_API}/gemelo/course/${orgUnitId}/overview`, { signal: controller.signal }),
          apiGet(`${GEMELO_API}/gemelo/course/${orgUnitId}/students?include=summary`, { signal: controller.signal }),
          apiGet(`${GEMELO_API}/gemelo/course/${orgUnitId}/ra/dashboard`, { signal: controller.signal }),
          apiGet(`${GEMELO_API}/gemelo/course/${orgUnitId}/learning-outcomes`, { signal: controller.signal }),
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
                map[code] = { code, description: desc, title: String(m[2] || "").trim() };
              }
            }
          }
          setOutcomesMap(map);
        }
        
        const studentItems = (st?.students?.items || st?.items || []).slice();
        const thr = ov?.thresholds || { critical: 50, watch: 70 };

        const baseRows = studentItems.map((s) => {
          const userId = s.userId ?? s.UserId ?? s.Identifier;
          const base = { userId: Number(userId), displayName: s.displayName ?? s.DisplayName ?? "—", roleName: s.roleName ?? "—", isLoading: true, risk: "cargando", globalPct: null, currentPerformancePct: null, coveragePct: null, coverageCountText: null, gradedItemsCount: null, totalItemsCount: null, hasPrescription: false, mostCriticalMacro: null };
          base.route = suggestRouteForStudent(base, thr);
          return base;
        });

        setStudentRows(baseRows);
        setLoading(false);

        const hasInlineSummary = studentItems.length > 0 && (studentItems[0]?.summary || studentItems[0]?.risk || studentItems[0]?.coveragePct != null || studentItems[0]?.currentPerformancePct != null);

        if (hasInlineSummary) {
          const details = studentItems.map((s) => {
            const userId = s.userId ?? s.UserId ?? s.Identifier;
            const sum = s.summary || s;
            const gradedItemsCount = sum?.gradedItemsCount ?? sum?.coverageGradedCount ?? null;
            const totalItemsCount = sum?.totalItemsCount ?? sum?.coverageTotalCount ?? null;
            const coverageCountText = sum?.coverageCountText ?? (gradedItemsCount != null && totalItemsCount != null ? `${gradedItemsCount}/${totalItemsCount}` : null);
            const row = { userId: Number(userId), displayName: s.displayName ?? s.DisplayName ?? "—", roleName: s.roleName ?? "—", isLoading: false, risk: sum?.risk || "pending", globalPct: sum?.globalPct ?? null, currentPerformancePct: sum?.currentPerformancePct ?? null, coveragePct: sum?.coveragePct ?? null, gradedItemsCount, totalItemsCount, coverageCountText, hasPrescription: Boolean(sum?.hasPrescription ?? s?.hasPrescription ?? false), mostCriticalMacro: s?.mostCriticalMacro ?? null };
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
            const g = await apiGet(`${GEMELO_API}/gemelo/course/${orgUnitId}/student/${userId}`, { signal: controller.signal });
            if (!isMounted) return;
            const sum = g?.summary || {};
            const mostCriticalMacro = pickCriticalMacroFromGemelo(g);
            const gradedItemsCount = sum?.gradedItemsCount ?? sum?.coverageGradedCount ?? g?.gradebook?.gradedItemsCount ?? null;
            const totalItemsCount = sum?.totalItemsCount ?? sum?.coverageTotalCount ?? g?.gradebook?.totalItemsCount ?? null;
            const coverageCountText = sum?.coverageCountText ?? g?.gradebook?.coverageCountText ?? (gradedItemsCount != null && totalItemsCount != null ? `${gradedItemsCount}/${totalItemsCount}` : null);
            const patch = { isLoading: false, risk: sum?.risk || "pending", globalPct: sum?.globalPct ?? null, currentPerformancePct: sum?.currentPerformancePct ?? null, coveragePct: sum?.coveragePct ?? null, gradedItemsCount, totalItemsCount, coverageCountText, hasPrescription: Array.isArray(g?.prescription) && g.prescription.length > 0, mostCriticalMacro };
            setStudentRows((prev) => prev.map((row) => { if (row.userId !== Number(userId)) return row; const merged = { ...row, ...patch }; merged.route = suggestRouteForStudent(merged, thr); return merged; }));
          } catch (e) {
            if (controller.signal.aborted || !isMounted) return;
            setStudentRows((prev) => prev.map((row) => row.userId === Number(userId) ? { ...row, isLoading: false, risk: "pending" } : row));
          }
        });
      } catch (e) {
        if (controller.signal.aborted || !isMounted) return;
        setErr(String(e?.message || e));
        setLoading(false);
      }
    })();
    

    return () => { isMounted = false; controller.abort(); };
  }, [orgUnitId]);

  useEffect(() => {
  if (!orgUnitId) return;

  fetch(`/brightspace/course/${orgUnitId}`)
    .then(res => res.json())
    .then(data => {
      setCourseInfo(data);
    })
    .catch(err => {
      console.error("Error cargando curso:", err);
    });
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
        const g = await apiGet(`${GEMELO_API}/gemelo/course/${orgUnitId}/student/${selectedStudent.userId}`, { signal: controller.signal });
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

    return () => { alive = false; controller.abort(); };
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
    const ras = raDashboard?.ras;
    const descList = flattenOutcomeDescriptions(learningOutcomesPayload);
    if (Array.isArray(ras) && ras.length) {
      const w = 100 / ras.length;
      return ras.map((r, idx) => ({ code: r.code, name: descList[idx] || r.label || "", description: descList[idx] || "", avgPct: Number(r.avgPct ?? 0), weightPct: w, status: r.status || null, coveragePct: Number(r.coveragePct ?? 0), studentsWithData: Number(r.studentsWithData ?? 0), totalStudents: Number(r.totalStudents ?? 0) }));
    }
    if (descList.length) {
      const w = 100 / descList.length;
      return descList.map((d, idx) => ({ code: `LO${idx + 1}`, name: d, description: d, avgPct: 0, weightPct: w, status: null, coveragePct: 0, studentsWithData: 0, totalStudents: 0 }));
    }
    return [];
  }, [raDashboard, learningOutcomesPayload]);

  const avgPerfPct = overview?.courseGradebook?.avgCurrentPerformancePct ?? null;
  const avgCov = overview?.courseGradebook?.avgCoveragePct ?? null;
  const covDone = avgCov == null ? 0 : Math.max(0, Math.min(100, Number(avgCov)));
  const covPending = Math.max(0, 100 - covDone);

  // "No enviado": % de asignaciones vencidas sin entrega sobre el total de estudiantes.
  // Se calcula como (promedio de ítems sin entregar con fecha vencida / total ítems) * 100.
  // Si el backend lo expone directamente lo usamos; si no, estimamos desde missingValues
  // del overview o dejamos null para no mostrar la barra.
  const avgNotSubmittedPct = useMemo(() => {
    // Intento 1: campo directo del backend
    const direct = overview?.courseGradebook?.avgNotSubmittedPct;
    if (direct != null) return Math.max(0, Math.min(100, Number(direct)));

    // Intento 2: derivado de gradebook counts cuando hay totales
    const avgGraded = overview?.courseGradebook?.avgGradedItemsCount;
    const avgTotal = overview?.courseGradebook?.avgTotalItemsCount;
    const avgMissing = overview?.courseGradebook?.avgMissingItemsCount; // campo futuro
    if (avgMissing != null && avgTotal != null && Number(avgTotal) > 0) {
      return Math.max(0, Math.min(100, (Number(avgMissing) / Number(avgTotal)) * 100));
    }

    // Intento 3: estimar desde studentRows con los que ya cargaron
    const loaded = studentRows.filter(s => !s.isLoading && s.totalItemsCount != null && s.totalItemsCount > 0);
    if (!loaded.length) return null;
    const sumNotSubmitted = loaded.reduce((acc, s) => {
      const graded = Number(s.gradedItemsCount ?? 0);
      const total = Number(s.totalItemsCount ?? 0);
      if (!total) return acc;
      // "no enviado" = total - calificados, pero sólo si hay cobertura baja
      // Aquí usamos covPending como proxy: lo que está pendiente Y vencido no podemos
      // distinguirlo sin fecha, así que dejamos null si no hay dato directo.
      return acc;
    }, 0);

    return null; // sin datos suficientes no mostramos la barra
  }, [overview, studentRows]);
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
    const a = Number(rd2.alto || 0), m = Number(rd2.medio || 0), b = Number(rd2.bajo || 0);
    if (a >= m && a >= b && a > 0) return "critico";
    if (m >= a && m >= b && m > 0) return "en desarrollo";
    if (b > 0) return "solido";
    return "pending";
  }, [avgPerfPct, thresholds, overview]);

  const filteredStudents = useMemo(() => {
    let list = Array.isArray(studentRows) ? [...studentRows] : [];
    if (onlyRisk) list = list.filter((s) => ["alto", "medio"].includes(normStatus(s.risk)));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((s) => String(s.userId).includes(q) || String(s.displayName || "").toLowerCase().includes(q));
    return list;
  }, [studentRows, query, onlyRisk]);

  const sortedStudents = useMemo(() => {
    const list = filteredStudents.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (s) => {
      switch (sortKey) {
        case "userId": return Number(s.userId || 0);
        case "grade10": return s.currentPerformancePct == null ? -1 : Number(s.currentPerformancePct) / 10;
        case "coverage": return s.coveragePct == null ? -1 : Number(s.coveragePct);
        case "risk": { const r = normStatus(s.risk); return r === "alto" ? 0 : r === "medio" ? 1 : r === "bajo" ? 2 : 3; }
        default: return String(s.displayName || "").toLowerCase();
      }
    };
    list.sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "es", { sensitivity: "base" }) * dir;
      return (Number(va) - Number(vb)) * dir;
    });
    return list;
  }, [filteredStudents, sortKey, sortDir]);

  // Derived drawer data
  const drawerSummary = studentDetail?.summary || {};
  const drawerMacro = (studentDetail?.macroUnits || studentDetail?.macro?.units || []).map(u => ({ code: u.code, pct: Number(u.pct || 0) }));
  const drawerUnits = studentDetail?.units || [];
  const drawerPrescription = Array.isArray(studentDetail?.prescription) ? studentDetail.prescription : [];
  const drawerProjection = studentDetail?.projection || null;
  const drawerGradebook = studentDetail?.gradebook || {};
  const drawerEvidences = Array.isArray(drawerGradebook?.evidences) ? drawerGradebook.evidences : [];
  const drawerPendingItems = Array.isArray(drawerGradebook?.pendingItems) ? drawerGradebook.pendingItems : [];
  const drawerMissingValues = Array.isArray(drawerGradebook?.missingValues) ? drawerGradebook.missingValues : [];
  const drawerQcFlags = Array.isArray(studentDetail?.qualityFlags) ? studentDetail.qualityFlags : [];

  const covGraded = Number(drawerSummary?.gradedItemsCount ?? drawerGradebook?.gradedItemsCount ?? 0) || 0;
  const covTotal = Number(drawerSummary?.totalItemsCount ?? drawerGradebook?.totalItemsCount ?? 0) || 0;
  const covText = drawerSummary?.coverageCountText || drawerGradebook?.coverageCountText || (covTotal > 0 ? `${covGraded}/${covTotal}` : null);
  const covMissing = covTotal > 0 ? Math.max(0, covTotal - covGraded) : 0;

  // Drawer tabs config
  const drawerTabs = [
    { id: "resumen", label: "Resumen", icon: "📊" },
    { id: "evidencias", label: "Evidencias", icon: "📋", count: drawerEvidences.length || undefined },
    { id: "unidades", label: "Unidades", icon: "🎯", count: drawerUnits.length || undefined },
    ...(drawerPrescription.length ? [{ id: "prescripcion", label: "Intervención", icon: "💊", count: drawerPrescription.length }] : []),
    ...(drawerQcFlags.filter(f => f?.type && f.type !== "role_not_enabled").length ? [{ id: "calidad", label: "Calidad", icon: "🔍" }] : []),
  ];

  const makeSort = (key) => ({
    active: sortKey === key, dir: sortDir,
    onClick: () => { const d = sortKey === key && sortDir === "asc" ? "desc" : "asc"; setSortKey(key); setSortDir(d); }
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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "12px" : "20px" }}>

        {/* ── Top Bar ── */}
        <div className="fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, flexDirection: isMobile ? "column" : "row", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>Gemelo Digital</div>
              <span className="tag">Vista Docente</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              Curso{" "}
            <strong style={{ fontFamily: "var(--font-mono)" }}>
              {courseInfo?.Name || orgUnitId}
            </strong>
              {GEMELO_BASE_URL && <> · <span style={{ fontFamily: "var(--font-mono)" }}>{GEMELO_BASE_URL}</span></>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={orgUnitInput} onChange={(e) => setOrgUnitInput(e.target.value)} type="number"
              style={{ width: 130, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", fontWeight: 700, background: "var(--card)", color: "var(--text)", fontSize: 13 }}
              placeholder="OrgUnitId" onKeyDown={(e) => { if (e.key === "Enter") { const v = Number(orgUnitInput); if (v > 0) setOrgUnitId(v); }}} />
            <button className="btn btn-primary" onClick={() => { const v = Number(orgUnitInput); if (v > 0) setOrgUnitId(v); }}>Buscar</button>
            <button className="btn" onClick={() => setDarkMode((v) => !v)} title="Cambiar tema">{darkMode ? "☀️" : "🌙"}</button>
          </div>
        </div>

        {/* ── Radar docente ── */}
        <div className="fade-up fade-up-1" style={{ marginBottom: 12 }}>
          <AlertsPanel alerts={overview?.alerts} />
        </div>

        {/* ── KPI Grid ── */}
        <div className="fade-up fade-up-2" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isNarrow ? "1fr 1fr" : "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>

          {/* Resumen ejecutivo */}
          <Card title="Resumen ejecutivo" right={<StatusBadge status={courseStatus} />}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <Stat label="Nota promedio (0–10)"
                value={avgPerfPct == null || Number(avgPerfPct) === 0 ? "—" : fmtGrade10FromPct(avgPerfPct)}
                valueColor={colorForPct(avgPerfPct, thresholds)}
                sub={avgCov == null || Number(avgCov) === 0 ? "Sin cobertura registrada" : `${fmtPct(covDone)} calificado · ${fmtPct(covPending)} pendiente`} />
              <Stat label="Estudiantes" value={studentsCount}
                sub={`${overview?.courseGradebook?.avgGradedItemsCount ?? 0}/${overview?.courseGradebook?.avgTotalItemsCount ?? 0} ítems prom.`} />
            </div>
            <Divider />
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <Stat label="En riesgo (alto + medio)"
                value={atRiskPct == null ? "—" : fmtPct(atRiskPct)}
                valueColor={atRiskPct != null && atRiskPct > 40 ? COLORS.critical : atRiskPct != null && atRiskPct > 20 ? COLORS.watch : COLORS.ok}
                sub={totalStudents ? `${atRiskCount} de ${totalStudents} estudiantes` : "—"} />
            </div>
            <Divider />
            <div style={{ marginTop: 14 }}>
              {avgCov == null || Number(avgCov) === 0
                ? <div style={{ fontSize: 12, color: "var(--muted)" }}>Cobertura no disponible (sin evidencias calificadas)</div>
                : <CoverageBars donePct={covDone} pendingPct={covPending} notSubmittedPct={avgNotSubmittedPct} />
              }
            </div>
          </Card>

          {/* Riesgo */}
          <Card title="Riesgo académico">
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>
                    {riskData.map((entry) => <Cell key={entry.key} fill={colorForRisk(entry.key)} />)}
                  </Pie>
                  <Tooltip formatter={(value) => { const v = Number(value || 0); const pct = totalStudents > 0 ? (v / totalStudents) * 100 : 0; return [`${v} (${pct.toFixed(1)}%)`, "Estudiantes"]; }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
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
          </Card>

          {/* Resultados de aprendizaje */}
          <Card title="Resultados de aprendizaje">
            <div style={{ width: "100%", height: 200 }}>
              {learningOutcomesData?.length ? (
                <ResponsiveContainer>
                  <BarChart data={learningOutcomesData} margin={{ bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="code" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                    <Tooltip formatter={(value, name, ctx) => {
                      const pl = ctx?.payload || {};
                      const extra = pl.coveragePct != null ? ` · Cob: ${Number(pl.coveragePct).toFixed(1)}%` : "";
                      return [`${Number(value).toFixed(1)}%${extra}`, "Promedio"];
                    }} labelFormatter={(label) => { const item = learningOutcomesData.find((m) => m.code === label); return item ? `${item.code}${item.name ? ` — ${item.name.slice(0, 40)}` : ""}` : String(label); }} />
                    <Bar dataKey="avgPct" name="Promedio" radius={[4, 4, 0, 0]}>
                      {learningOutcomesData.map((m) => <Cell key={m.code} fill={colorForLearningOutcome(m, thresholds)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ height: "100%" }}>
                  <span className="empty-state-icon">📊</span>
                  <span style={{ fontSize: 12 }}>Sin resultados de aprendizaje configurados</span>
                </div>
              )}
            </div>
            {raDashboard?.updatedAt && <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>↺ {String(raDashboard.updatedAt).replace("T", " ").slice(0, 16)}</div>}
          </Card>

          {/* Indicador de prioridad */}
          <Card title="Prioridad académica">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {learningOutcomesData.slice().sort((a, b) => a.avgPct - b.avgPct).slice(0, 3).map((m) => {
                const computedStatus = m.status || (m.avgPct < thresholds.critical ? "critico" : m.avgPct < thresholds.watch ? "observacion" : "solido");
                return (
                  <div key={m.code} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, background: "var(--card)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="tag">{m.code}</span>
                        <InfoTooltip text={(m.description || m.name || "Sin descripción disponible.").trim()} />
                      </div>
                      <StatusBadge status={computedStatus} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 900, fontSize: 18, fontFamily: "var(--font-mono)", color: colorForPct(m.avgPct, thresholds) }}>{fmtPct(m.avgPct)}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Peso {m.weightPct ? `${Number(m.weightPct).toFixed(0)}%` : "—"}</span>
                    </div>
                    {m.coveragePct != null && (
                      <div style={{ marginTop: 4 }}>
                        <ProgressBar value={m.coveragePct} color={colorForPct(m.coveragePct, thresholds)} />
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, textAlign: "right" }}>
                          {fmtPct(m.coveragePct)} · {m.studentsWithData}/{m.totalStudents} estudiantes
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!learningOutcomesData.length && <div className="empty-state"><span className="empty-state-icon">🎯</span><span style={{ fontSize: 12 }}>Sin datos de RA</span></div>}
            </div>
          </Card>
        </div>

        {/* ── Students Table ── */}
        <div className="fade-up fade-up-3">
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Estudiantes</span>
                <span className="tag">{studentsList?.students?.count ?? studentRows.length ?? 0}</span>
                {studentRows.some(s => s.isLoading) && <span className="pulse-dot" style={{ background: COLORS.brand, width: 8, height: 8 }} title="Cargando datos..." />}
              </div>
            }
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--text)", cursor: "pointer" }}>
                  <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} />Solo en riesgo
                </label>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por ID o nombre…"
                  type="text" style={{ width: isMobile ? "100%" : 220, border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px", fontWeight: 600, background: "var(--card)", color: "var(--text)", fontSize: 12 }} />
              </div>
            }
          >
            {useCards ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedStudents.map((s) => <StudentCard key={s.userId} s={s} onOpen={setSelectedStudent} />)}
                {!sortedStudents.length && <div className="empty-state"><span className="empty-state-icon">🔍</span><span>Sin resultados para el filtro</span></div>}
              </div>
            ) : (
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)", borderBottom: "2px solid var(--border)" }}>
                      <SortTh label="ID" {...makeSort("userId")} />
                      <SortTh label="Nombre" {...makeSort("name")} />
                      <SortTh label="Riesgo" {...makeSort("risk")} />
                      <th style={{ padding: "10px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Ruta</th>
                      {!hideCriticalMacroCol && <th style={{ padding: "10px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>RA crítico</th>}
                      {!hideGlobalProgressCol && <th style={{ padding: "10px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Global</th>}
                      <SortTh label="Nota" {...makeSort("grade10")} />
                      <SortTh label="Cobertura" {...makeSort("coverage")} title="% del curso con evidencias calificadas" />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((s) => (
                      <tr key={s.userId} onClick={() => setSelectedStudent(s)} className="tr-hover" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                        <td style={{ padding: "10px 10px", fontWeight: 700, color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.userId}</td>
                        <td style={{ padding: "10px 10px", fontWeight: 700, color: "var(--text)", minWidth: 180 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {s.displayName}
                            {s.hasPrescription && <span title="Tiene prescripción activa" style={{ fontSize: 14 }}>📋</span>}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <StatusBadge status={s.isLoading ? "cargando" : s.risk} />
                        </td>
                        <td style={{ padding: "10px 10px", maxWidth: compactRouteCol ? 200 : 320, minWidth: 160 }}>
                          {s.route ? (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)" }}>{s.route.title}</div>
                              <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: compactRouteCol ? 180 : 300 }} title={s.route.summary}>{s.route.summary}</div>
                            </div>
                          ) : "—"}
                        </td>
                        {!hideCriticalMacroCol && (
                          <td style={{ padding: "10px 10px", minWidth: 90 }}>
                            {s.mostCriticalMacro ? (
                              <div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: colorForPct(s.mostCriticalMacro.pct, thresholds) }}>{s.mostCriticalMacro.code}</div>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>{fmtPct(s.mostCriticalMacro.pct)}</div>
                              </div>
                            ) : "—"}
                          </td>
                        )}
                        {!hideGlobalProgressCol && <td style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{fmtPct(s.globalPct)}</td>}
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 900, color: colorForPct(s.currentPerformancePct, thresholds) }}>
                            {fmtGrade10FromPct(s.currentPerformancePct)}
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", minWidth: 110 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "var(--font-mono)" }}>{fmtPct(s.coveragePct)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{s.coverageCountText || "—"}</div>
                          {s.coveragePct != null && <ProgressBar value={s.coveragePct} color={colorForPct(s.coveragePct, thresholds)} animate={false} />}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right" }}>
                          <button className="btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={(e) => { e.stopPropagation(); setSelectedStudent(s); }}>Ver →</button>
                        </td>
                      </tr>
                    ))}
                    {!sortedStudents.length && (
                      <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin resultados para el filtro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Drawer ── */}
      <Drawer
        open={!!selectedStudent}
        onClose={() => { setSelectedStudent(null); setStudentDetail(null); setStudentErr(""); setStudentLoading(false); }}
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
            {/* Student KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div style={{ textAlign: "center", padding: "12px 8px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Nota</div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)", color: colorForPct(drawerSummary?.currentPerformancePct, thresholds) }}>{fmtGrade10FromPct(drawerSummary?.currentPerformancePct)}</div>
              </div>
              <div style={{ textAlign: "center", padding: "12px 8px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Cobertura</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)", color: colorForPct(drawerSummary?.coveragePct, thresholds) }}>{fmtPct(drawerSummary?.coveragePct)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{covText || "—"} · faltan {covMissing}</div>
              </div>
              <div style={{ textAlign: "center", padding: "12px 8px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Riesgo</div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}><StatusBadge status={drawerSummary?.risk || "pending"} /></div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              {drawerTabs.map(tab => (
                <button key={tab.id} className={`chip ${drawerTab === tab.id ? "active" : ""}`} onClick={() => setDrawerTab(tab.id)} style={{ fontSize: 12 }}>
                  {tab.icon} {tab.label} {tab.count != null ? <span className="tag" style={{ fontSize: 10, padding: "1px 6px" }}>{tab.count}</span> : null}
                </button>
              ))}
            </div>

            {/* Tab: Resumen */}
            {drawerTab === "resumen" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Macro chart */}
                {drawerMacro.length > 0 && (
                  <Card title="Resultados de aprendizaje" right={<span className="tag">{drawerMacro.length} RAs</span>}>
                    <div style={{ width: "100%", height: 200 }}>
                      <ResponsiveContainer>
                        <BarChart data={drawerMacro} margin={{ left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="code" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                          <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Desempeño"]} />
                          <ReferenceLine y={Number(thresholds?.watch || 70)} stroke={COLORS.watch} strokeDasharray="4 4" />
                          <ReferenceLine y={Number(thresholds?.critical || 50)} stroke={COLORS.critical} strokeDasharray="4 4" />
                          <Bar dataKey="pct" name="Desempeño" radius={[4, 4, 0, 0]}>
                            {drawerMacro.map((m) => <Cell key={m.code} fill={colorForPct(m?.pct, thresholds)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {/* Projection */}
                {drawerProjection && <ProjectionBlock projection={drawerProjection} thresholds={thresholds} />}

                {/* Route */}
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

                {/* Pending items summary */}
                <PendingItemsBlock pendingItems={drawerPendingItems} missingValues={drawerMissingValues} />
              </div>
            )}

            {/* Tab: Evidencias */}
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
                                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{e.name || `Ítem ${e.gradeObjectId}`}</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{fmtPct(e.weightPct)}</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 900, color: colorForPct(e.scorePct, thresholds) }}>
                                  {e.scorePct != null ? (Number(e.scorePct) / 10).toFixed(1) : "—"}
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "center" }}><StatusBadge status={e.status || "pending"} /></td>
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
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Los ítems del gradebook aún no tienen nota registrada.</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Unidades */}
            {drawerTab === "unidades" && (
              <Card title="Subcompetencias / Unidades">
                {drawerUnits.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {drawerUnits.map((u) => (
                      <div key={u.code} style={{ display: "flex", flexDirection: "column", gap: 5, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="tag">{u.code}</span>
                          <StatusBadge status={u.status} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 900, color: colorForPct(u.pct, thresholds) }}>{fmtPct(u.pct)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{(u.evidence || []).length} evidencias</div>
                        </div>
                        <ProgressBar value={u.pct} color={colorForPct(u.pct, thresholds)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon">🎯</span>
                    <span>Sin unidades consolidadas</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Posible falta de rúbricas evaluadas o mapeadas.</span>
                  </div>
                )}
              </Card>
            )}

            {/* Tab: Prescripción */}
            {drawerTab === "prescripcion" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--watch-bg)", border: "1px solid #FED7AA", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#9A3412" }}>
                  ⚠️ Este estudiante requiere intervención prioritaria.
                </div>
                {drawerPrescription.map((p) => (
                  <Card key={p.routeId} title={p.title} right={<span className="tag">{p.routeId}</span>}>
                    {p.successCriteria && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, padding: "6px 10px", background: "var(--bg)", borderRadius: 8 }}>🎯 {p.successCriteria}</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(p.actions || []).map((a, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span style={{ background: COLORS.brand, color: "#fff", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>{idx + 1}</span>
                          <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                    {p.priority?.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.priority.map((pr) => <span key={pr} className="tag" style={{ background: "var(--critical-bg)", color: "#B42318" }}>{pr}</span>)}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Tab: Calidad */}
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