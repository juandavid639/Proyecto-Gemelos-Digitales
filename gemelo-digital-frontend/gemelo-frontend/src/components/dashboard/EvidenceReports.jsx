import React, { useState, useMemo, useEffect } from "react";
import { apiGet } from "../../utils/api";
import { COLORS, colorForPct } from "../../utils/colors";
import { fmtPct, fmtGrade10FromPct, computeRiskFromPct } from "../../utils/helpers";
import StudentAvatar from "../ui/StudentAvatar";

/**
 * EvidenceReports: generates random sample reports of student work.
 * Picks a random student from each band:
 *   - High performers (≥85%)
 *   - Mid performers (60-84%)
 *   - Low performers (<60%)
 *
 * For each, fetches the full gemelo (evidences) so the teacher can see
 * concrete examples of work submitted at each level.
 */
export default function EvidenceReports({
  orgUnitId,
  studentRows = [],
  courseInfo = null,
  onStudentClick = () => {},
}) {
  const [seed, setSeed] = useState(0); // bump to re-randomize
  const [details, setDetails] = useState({}); // userId → { evidences, loading, error }

  // Pick one random student per band
  const samples = useMemo(() => {
    const loaded = studentRows.filter(
      (s) => !s.isLoading && s.currentPerformancePct != null
    );
    if (loaded.length === 0) return null;

    const high = loaded.filter((s) => s.currentPerformancePct >= 85);
    const mid = loaded.filter((s) => s.currentPerformancePct >= 60 && s.currentPerformancePct < 85);
    const low = loaded.filter((s) => s.currentPerformancePct < 60);

    const pickRandom = (arr) => arr.length === 0 ? null : arr[Math.floor(Math.random() * arr.length)];

    // eslint-disable-next-line no-unused-vars
    const _ = seed; // dependency to retrigger on seed change
    return {
      high: pickRandom(high),
      mid: pickRandom(mid),
      low: pickRandom(low),
      counts: { high: high.length, mid: mid.length, low: low.length },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentRows, seed]);

  // Fetch evidences for each sampled student
  useEffect(() => {
    if (!samples || !orgUnitId) return;
    const targets = [samples.high, samples.mid, samples.low].filter(Boolean);

    targets.forEach(async (s) => {
      if (details[s.userId]?.evidences || details[s.userId]?.loading) return;
      setDetails((prev) => ({ ...prev, [s.userId]: { loading: true } }));
      try {
        const data = await apiGet(`/gemelo/course/${orgUnitId}/student/${s.userId}`);
        const evidences = Array.isArray(data?.gradebook?.evidences)
          ? data.gradebook.evidences.filter((e) => !e.isCorte)
          : [];
        setDetails((prev) => ({
          ...prev,
          [s.userId]: { evidences, loading: false, summary: data?.summary || {} },
        }));
      } catch (e) {
        setDetails((prev) => ({
          ...prev,
          [s.userId]: { error: String(e?.message || e), loading: false, evidences: [] },
        }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, orgUnitId]);

  const reroll = () => {
    setSeed((s) => s + 1);
    setDetails({}); // clear cache so we re-fetch
  };

  if (!samples) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 8 }}>📑</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>No hay datos suficientes para generar informes</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Se necesitan estudiantes con notas calificadas.</div>
      </div>
    );
  }

  const renderSample = ({ student, label, color, bgColor, borderColor, icon, description, count }) => {
    if (!student) {
      return (
        <div style={{
          padding: 16, borderRadius: 12,
          border: "1px dashed var(--border)",
          background: "var(--bg)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {icon} {label}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Sin estudiantes en esta banda
          </div>
        </div>
      );
    }

    const detail = details[student.userId] || {};
    const evidences = detail.evidences || [];
    const grade10 = (student.currentPerformancePct / 10).toFixed(1);

    return (
      <div style={{
        padding: 16, borderRadius: 12,
        border: `1.5px solid ${borderColor}`,
        background: bgColor,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {label}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{description}</div>
          </div>
          <span className="tag" style={{ background: color + "22", color: color }}>
            {count} estudiante{count !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Student card */}
        <button
          onClick={() => onStudentClick(student.userId)}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.5)",
            cursor: "pointer", textAlign: "left",
            fontFamily: "var(--font)",
          }}
        >
          <StudentAvatar userId={student.userId} name={student.displayName} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {student.displayName}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              ID {student.userId} · Cobertura: {student.coveragePct != null ? `${student.coveragePct.toFixed(0)}%` : "—"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Nota</div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)", color: color, lineHeight: 1 }}>
              {grade10}
            </div>
          </div>
        </button>

        {/* Evidences list */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Trabajos asociados
          </div>
          {detail.loading ? (
            <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>
              Cargando trabajos...
            </div>
          ) : detail.error ? (
            <div style={{ fontSize: 11, color: "var(--critical)", textAlign: "center", padding: "12px 0" }}>
              Error al cargar
            </div>
          ) : evidences.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>
              Sin evidencias calificadas para mostrar
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {evidences.slice(0, 6).map((e, i) => {
                const isGraded = e.scorePct != null;
                const evColor = isGraded ? colorForPct(e.scorePct, null) : "var(--muted)";
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: evColor, flexShrink: 0,
                    }} />
                    <span style={{ flex: 1, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.name || `Ítem ${e.gradeObjectId}`}
                    </span>
                    {e.weightPct != null && (
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>
                        {Number(e.weightPct).toFixed(0)}%
                      </span>
                    )}
                    <span style={{
                      fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 12,
                      color: evColor, minWidth: 28, textAlign: "right",
                    }}>
                      {isGraded ? (Number(e.scorePct) / 10).toFixed(1) : "—"}
                    </span>
                  </div>
                );
              })}
              {evidences.length > 6 && (
                <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", padding: "4px 0" }}>
                  + {evidences.length - 6} evidencias más
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header with reroll button */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, padding: "12px 14px",
        background: "var(--brand-light)",
        borderRadius: 10,
        border: "1px solid var(--brand-light2, #D6E4FF)",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--brand)" }}>
            📑 Muestras de evidencias
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Selección aleatoria de un estudiante por banda de desempeño con sus trabajos calificados
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={reroll}
          style={{ fontSize: 12, padding: "7px 14px" }}
        >
          🔀 Generar nuevo informe
        </button>
      </div>

      {/* 3 sample cards in a grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {renderSample({
          student: samples.high,
          label: "Mejor calificación",
          color: COLORS.ok,
          bgColor: "var(--ok-bg)",
          borderColor: "var(--ok-border)",
          icon: "🏆",
          description: "Estudiante con desempeño sobresaliente (≥ 8.5/10)",
          count: samples.counts.high,
        })}
        {renderSample({
          student: samples.mid,
          label: "Calificación media",
          color: COLORS.brand,
          bgColor: "var(--brand-light)",
          borderColor: "var(--brand-light2, #D6E4FF)",
          icon: "📊",
          description: "Estudiante con desempeño promedio (6.0 - 8.4/10)",
          count: samples.counts.mid,
        })}
        {renderSample({
          student: samples.low,
          label: "Calificación baja",
          color: COLORS.critical,
          bgColor: "var(--critical-bg)",
          borderColor: "var(--critical-border)",
          icon: "⚠️",
          description: "Estudiante con desempeño bajo (< 6.0/10) — requiere atención",
          count: samples.counts.low,
        })}
      </div>

      <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg)", borderRadius: 8, border: "1px dashed var(--border)", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
        💡 Estos informes son útiles para reuniones de coordinación o revisiones de calidad. Haz clic en un estudiante para abrir su gemelo digital completo.
      </div>
    </div>
  );
}
