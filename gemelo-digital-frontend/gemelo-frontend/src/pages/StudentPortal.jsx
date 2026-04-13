import React, { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../utils/api";
import { COLORS, colorForPct, colorForRisk } from "../utils/colors";
import {
  fmtPct,
  fmtGrade10FromPct,
  normStatus,
  computeRiskFromPct,
  suggestRouteForStudent,
  flattenOutcomeDescriptions,
} from "../utils/helpers";
import { injectStyles } from "../styles/global";
import useMediaQuery from "../hooks/useMediaQuery";

/* ── Inline micro-components (keep portal self-contained) ── */

function CircularRing({ pct, size = 80, stroke = 8, color, label, sublabel, fontSize }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pctClamped = Math.max(0, Math.min(100, Number(pct) || 0));
  const offset = circ - (circ * pctClamped) / 100;
  const ringColor = color || "var(--brand)";
  const textSize = fontSize || Math.round(size * 0.22);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ringColor} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: textSize, fontWeight: 900, fontFamily: "var(--font-mono)", color: ringColor, lineHeight: 1 }}>{label ?? `${Math.round(pctClamped)}%`}</span>
        {sublabel && <span style={{ fontSize: Math.round(textSize * 0.55), fontWeight: 700, color: "var(--muted)", marginTop: 1 }}>{sublabel}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = normStatus(status);
  const CONFIG = {
    solido: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
    optimo: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
    "en seguimiento": { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Seguimiento" },
    critico: { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Crítico" },
    pending: { bg: "var(--pending-bg)", fg: "var(--muted)", dot: COLORS.pending, label: "Pendiente" },
    alto: { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Alto" },
    medio: { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Medio" },
    bajo: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Bajo" },
  };
  const cfg = CONFIG[s] || { bg: "var(--pending-bg)", fg: "var(--muted)", dot: COLORS.pending, label: status || "—" };
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.dot}22`, fontWeight: 700, letterSpacing: "0.03em", padding: "4px 10px", fontSize: 11, borderRadius: 999 }}>
      <span className="pulse-dot" style={{ background: cfg.dot, width: 5, height: 5, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function Card({ title, right, children, accent }) {
  return (
    <div className="kpi-card" style={{ borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", border: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `var(--${accent})`, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }} />}
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, paddingTop: accent ? 4 : 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1.3 }}>{title}</div>
          <div style={{ flexShrink: 0 }}>{right}</div>
        </div>
      )}
      {children}
    </div>
  );
}

function ProgressBar({ value, color, animate = true }) {
  const pct = Math.max(0, Math.min(100, Number(value ?? 0)));
  return (
    <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.15)", border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color || COLORS.brand, borderRadius: 999, transition: animate ? "width 0.7s cubic-bezier(.4,0,.2,1)" : "none" }} />
    </div>
  );
}

/* ── Student Portal Page ── */

export default function StudentPortal() {
  useEffect(() => { injectStyles(); }, []);

  const { authUser, logout, initialOrgUnitId } = useAuth();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Course selection (students typically come from LTI with orgUnitId)
  const [orgUnitId, setOrgUnitId] = useState(() => {
    if (initialOrgUnitId) return initialOrgUnitId;
    const saved = sessionStorage.getItem("gemelo_pending_org");
    if (saved && Number(saved) > 0) return Number(saved);
    return 0;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentData, setStudentData] = useState(null);
  const [courseInfo, setCourseInfo] = useState(null);
  const [learningOutcomesPayload, setLearningOutcomesPayload] = useState(null);

  const userId = authUser?.user_id;
  const userName = authUser?.user_name || "Estudiante";
  const firstName = userName.split(" ")[0];

  // Load student data
  useEffect(() => {
    if (!orgUnitId || !userId) return;

    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setStudentData(null);

    (async () => {
      try {
        const [studentRes, courseRes, loRes] = await Promise.allSettled([
          apiGet(`/gemelo/course/${orgUnitId}/student/${userId}`, { signal: controller.signal }),
          apiGet(`/brightspace/course/${orgUnitId}`, { signal: controller.signal }),
          apiGet(`/gemelo/course/${orgUnitId}/learning-outcomes`, { signal: controller.signal }),
        ]);

        if (!alive) return;

        if (studentRes.status === "fulfilled") {
          setStudentData(studentRes.value);
        } else {
          throw studentRes.reason;
        }

        if (courseRes.status === "fulfilled") {
          setCourseInfo(courseRes.value);
        }

        if (loRes.status === "fulfilled") {
          setLearningOutcomesPayload(loRes.value);
        }
      } catch (e) {
        if (!alive || controller.signal.aborted) return;
        setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; controller.abort(); };
  }, [orgUnitId, userId]);

  // Derived data
  const summary = studentData?.summary || {};
  const thresholds = { critical: 50, watch: 70 };
  const risk = computeRiskFromPct(summary?.currentPerformancePct);
  const macroUnits = (studentData?.macroUnits || studentData?.macro?.units || []).map((u) => ({
    code: u.code,
    pct: Number(u.pct || 0),
    status: u.status,
    evidence: u.evidence || [],
  }));
  const evidences = Array.isArray(studentData?.gradebook?.evidences)
    ? studentData.gradebook.evidences
    : [];
  const prescription = Array.isArray(studentData?.prescription)
    ? studentData.prescription
    : [];
  const qualityFlags = Array.isArray(studentData?.qualityFlags)
    ? studentData.qualityFlags.filter((f) => f?.type && f.type !== "role_not_enabled")
    : [];
  const projection = studentData?.projection || null;

  const route = useMemo(() => {
    return suggestRouteForStudent({
      risk,
      currentPerformancePct: summary?.currentPerformancePct,
      coveragePct: summary?.coveragePct,
      mostCriticalMacro: macroUnits.length > 0
        ? macroUnits.slice().sort((a, b) => a.pct - b.pct)[0]
        : null,
    }, thresholds);
  }, [summary, risk, macroUnits]);

  const outcomesMap = useMemo(() => {
    const sets = Array.isArray(learningOutcomesPayload?.outcomeSets) ? learningOutcomesPayload.outcomeSets : [];
    const map = {};
    for (const set of sets) {
      for (const o of set?.Outcomes || []) {
        const desc = String(o?.Description || "").trim();
        const m = desc.match(/^([A-Za-z0-9_.-]+)\s*-\s*(.+)$/);
        if (m) {
          map[String(m[1]).toUpperCase()] = { code: String(m[1]).toUpperCase(), description: desc, title: String(m[2] || "").trim() };
        }
      }
    }
    return map;
  }, [learningOutcomesPayload]);

  const chartData = useMemo(() => {
    return evidences
      .filter((e) => e.scorePct != null)
      .map((e) => ({ name: (e.name || "").slice(0, 20), pct: Number(e.scorePct ?? 0) }));
  }, [evidences]);

  const pendingUngradedPct = Number(summary?.pendingUngradedWeightPct ?? 0);
  const overdueUnscoredPct = Number(summary?.overdueUnscoredWeightPct ?? 0);

  // ── No course selected ──
  if (!orgUnitId || orgUnitId === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", padding: 20 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "36px 40px", maxWidth: 480, width: "100%", boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: "0 0 10px" }}>Portal Estudiante</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 24px" }}>
            Hola, {firstName}. Para ver tu información académica, accede desde tu curso en Brightspace usando el enlace de Gemelo Digital.
          </p>
          <button onClick={logout} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "40px 48px", textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Cargando tu información...</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Consolidando tu gemelo digital</div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", padding: 20 }}>
        <div style={{ background: "var(--card)", border: "1.5px solid var(--critical)", borderRadius: 18, padding: "40px 44px", maxWidth: 460, width: "100%", boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: "0 0 10px" }}>Error al cargar datos</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 24px" }}>{error}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => { setError(""); setStudentData(null); }} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Reintentar
            </button>
            <button onClick={logout} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!studentData) return null;

  // ── Main Student Portal ──
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* ── Top Bar ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 900 }}>CESA</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Gemelo Digital</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Portal Estudiante</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setDarkMode((v) => !v)} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 15 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName.split(" ").slice(0, 2).join(" ")}
          </span>
          <button onClick={logout} title="Cerrar sesión" style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>
            Salir
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ padding: isMobile ? "16px 14px" : "24px 28px", maxWidth: 900, margin: "0 auto" }}>
        {/* Page Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Gemelo Digital · Mi Rendimiento
          </div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Hola, {firstName}
          </h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, fontWeight: 500 }}>
            {courseInfo?.Name || `Curso ${orgUnitId}`}
          </div>
        </div>

        {/* ── KPI Hero Row ── */}
        <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap", marginBottom: 20 }}>
          {/* Nota ring */}
          <div style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 10px", background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow)", gap: 6 }}>
            <CircularRing
              pct={summary?.currentPerformancePct ?? 0}
              size={100} stroke={9}
              color={colorForPct(summary?.currentPerformancePct, thresholds)}
              label={fmtGrade10FromPct(summary?.currentPerformancePct)}
              sublabel="/10" fontSize={24}
            />
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mi Nota Actual</div>
          </div>

          {/* Cobertura ring */}
          <div style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 10px", background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow)", gap: 6 }}>
            <CircularRing
              pct={summary?.coveragePct ?? 0}
              size={100} stroke={9}
              color={colorForPct(summary?.coveragePct, thresholds)}
              label={fmtPct(summary?.coveragePct)}
              fontSize={16}
            />
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Cobertura</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {summary?.gradedItemsCount ?? 0}/{summary?.totalItemsCount ?? 0} ítems
            </div>
          </div>

          {/* Risk + pending info */}
          <div style={{ flex: "2 1 200px", display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 16px", background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow)", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mi Estado</span>
              <StatusBadge status={risk} />
            </div>
            {pendingUngradedPct > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "var(--watch-bg)", border: "1px solid var(--watch-border)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--watch)" }}>⏳ Pendiente de calificación</span>
                <span style={{ fontSize: 12, fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--watch)" }}>{fmtPct(pendingUngradedPct)}</span>
              </div>
            )}
            {overdueUnscoredPct > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "var(--critical-bg)", border: "1px solid var(--critical-border)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)" }}>🔴 Entregas vencidas</span>
                <span style={{ fontSize: 12, fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--critical)" }}>{fmtPct(overdueUnscoredPct)}</span>
              </div>
            )}
            {pendingUngradedPct === 0 && overdueUnscoredPct === 0 && (
              <div style={{ fontSize: 12, color: "var(--ok)", fontWeight: 700 }}>✅ Sin entregas pendientes</div>
            )}
          </div>
        </div>

        {/* ── Ruta de Mejora ── */}
        {route && (
          <div style={{ marginBottom: 20 }}>
            <Card title="Mi Ruta de Mejora" right={<StatusBadge status={risk} />} accent="brand">
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{route.summary}</div>
              <div style={{ background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-2, #003EA6) 100%)", borderRadius: 12, padding: 16, color: "#fff" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{route.title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(route.actions || []).map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ background: "rgba(255,255,255,0.2)", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.95 }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Resultados de Aprendizaje ── */}
        {macroUnits.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Card title="Mis Resultados de Aprendizaje" accent="brand">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 14 }}>
                {macroUnits.map((item) => {
                  const ringColor = colorForPct(item.pct, thresholds);
                  const isCrit = item.pct < thresholds.critical;
                  const isWatch = !isCrit && item.pct < thresholds.watch;
                  const statusLabel = isCrit ? "Crítico" : isWatch ? "Observación" : "Óptimo";
                  const statusColor = isCrit ? COLORS.critical : isWatch ? COLORS.watch : COLORS.ok;
                  const desc = outcomesMap[item.code]?.title || "";
                  return (
                    <div key={item.code} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "14px 12px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", flex: "1 1 100px", maxWidth: 160 }}>
                      <CircularRing pct={item.pct} size={68} stroke={7} color={ringColor} label={fmtPct(item.pct)} fontSize={11} />
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", textAlign: "center" }}>{item.code}</div>
                      <span style={{ fontSize: 9, fontWeight: 800, color: statusColor, background: statusColor + "1A", padding: "2px 7px", borderRadius: 99, textTransform: "uppercase" }}>{statusLabel}</span>
                      {desc && <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", lineHeight: 1.3 }}>{desc}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--muted)", justifyContent: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 2, background: COLORS.critical, display: "inline-block", borderRadius: 1 }} /> Crítico (&lt;{thresholds.critical}%)
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 2, background: COLORS.watch, display: "inline-block", borderRadius: 1 }} /> Observación (&lt;{thresholds.watch}%)
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* ── Historial de Evidencias ── */}
        {evidences.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Card title={`Mis Evidencias (${evidences.filter(e => e.scorePct != null).length} calificadas)`} accent="brand">
              {/* Chart */}
              {chartData.length > 1 && (
                <div style={{ width: "100%", height: 180, marginBottom: 16 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ left: -10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                      <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Mi nota"]} />
                      <ReferenceLine y={70} stroke={COLORS.watch} strokeDasharray="4 4" label={{ value: "70%", fill: COLORS.watch, fontSize: 10 }} />
                      <ReferenceLine y={50} stroke={COLORS.critical} strokeDasharray="4 4" label={{ value: "50%", fill: COLORS.critical, fontSize: 10 }} />
                      <Line type="monotone" dataKey="pct" stroke={COLORS.brand} strokeWidth={2} dot={{ fill: COLORS.brand, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "left" }}>Evidencia</th>
                      <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "right" }}>Peso</th>
                      <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "right" }}>Mi Nota</th>
                      <th style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", textAlign: "center" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidences.map((e, i) => (
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
          </div>
        )}

        {/* ── Proyección ── */}
        {projection && Array.isArray(projection.scenarios) && projection.scenarios.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Card title="Proyección de mi Nota Final" right={<span className="tag">{fmtPct(projection.coveragePct)} calificado</span>}>
              {projection.isFinal ? (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Nota final</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: colorForPct(projection.finalPct, thresholds), fontFamily: "var(--font-mono)" }}>{fmtGrade10FromPct(projection.finalPct)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Cobertura 100% — esta es tu nota definitiva.</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {projection.scenarios.map((s) => {
                    const meta = {
                      risk: { label: "Si baja", icon: "📉", cls: "scenario-risk" },
                      base: { label: "Actual", icon: "📊", cls: "scenario-base" },
                      improve: { label: "Si mejora", icon: "📈", cls: "scenario-improve" },
                    }[s.id] || { label: s.id, icon: "📊", cls: "scenario-base" };
                    return (
                      <div key={s.id} className={`scenario-card ${meta.cls}`}>
                        <div style={{ fontSize: 18 }}>{meta.icon}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>{meta.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: colorForPct(s.projectedFinalPct, thresholds) }}>
                          {fmtGrade10FromPct(s.projectedFinalPct)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Prescripción del docente ── */}
        {prescription.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Card title="Plan de Intervención" accent="watch">
              <div style={{ background: "var(--watch-bg)", border: "1px solid #FED7AA", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, color: "#9A3412", marginBottom: 12 }}>
                Tu docente ha creado un plan de intervención personalizado para ti.
              </div>
              {prescription.map((p) => (
                <div key={p.routeId} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>{p.title}</div>
                  {p.successCriteria && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, padding: "6px 10px", background: "var(--bg)", borderRadius: 8 }}>
                      🎯 {p.successCriteria}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(p.actions || []).map((a, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ background: COLORS.brand, color: "#fff", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{idx + 1}</span>
                        <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── Quality Flags ── */}
        {qualityFlags.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Card title="Calidad de Datos">
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                Algunos indicadores pueden estar incompletos debido a datos faltantes en la configuración del curso.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {qualityFlags.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "var(--pending-bg)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                    <strong>{f.type}</strong>
                    {f.message && <span style={{ marginLeft: 8, opacity: 0.8 }}>— {f.message}</span>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0 40px", fontSize: 11, color: "var(--muted)" }}>
          CESA · Gemelo Digital v2.0 · Portal Estudiante
        </div>
      </main>
    </div>
  );
}
