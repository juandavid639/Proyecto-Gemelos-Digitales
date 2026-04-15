import React, { useState, useMemo, useEffect } from "react";
import { apiGet, apiDownloadUrl } from "../../utils/api";
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
  const [feedbackModal, setFeedbackModal] = useState(null); // { studentName, evidenceName, loading, data, error }

  const openFeedback = async (student, evidence) => {
    if (!evidence.linkedDropboxId) return;
    setFeedbackModal({
      studentName: student.displayName,
      evidenceName: evidence.name || `Ítem ${evidence.gradeObjectId}`,
      loading: true,
      data: null,
      error: null,
    });
    try {
      const data = await apiGet(
        `/brightspace/course/${orgUnitId}/dropbox/folder/${evidence.linkedDropboxId}/student/${student.userId}/feedback`
      );
      setFeedbackModal((prev) => prev && { ...prev, loading: false, data });
    } catch (err) {
      setFeedbackModal((prev) => prev && { ...prev, loading: false, error: String(err?.message || err) });
    }
  };

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
                const hasDropbox = e.linkedDropboxId != null;
                const downloadHref = hasDropbox
                  ? apiDownloadUrl(`/brightspace/course/${orgUnitId}/dropbox/folder/${e.linkedDropboxId}/student/${student.userId}/download`)
                  : null;
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
                    {hasDropbox && (
                      <>
                        <a
                          href={downloadHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Descargar entrega del estudiante (ZIP)"
                          style={{
                            fontSize: 10, fontWeight: 700,
                            padding: "3px 7px", borderRadius: 6,
                            background: "rgba(52, 120, 246, 0.12)",
                            color: "var(--brand)",
                            textDecoration: "none",
                            border: "1px solid rgba(52, 120, 246, 0.25)",
                            flexShrink: 0,
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          ⬇
                        </a>
                        <button
                          type="button"
                          title="Ver retroalimentación del docente"
                          onClick={(ev) => { ev.stopPropagation(); openFeedback(student, e); }}
                          style={{
                            fontSize: 10, fontWeight: 700,
                            padding: "3px 7px", borderRadius: 6,
                            background: "rgba(255, 170, 0, 0.15)",
                            color: "#b27300",
                            border: "1px solid rgba(255, 170, 0, 0.3)",
                            cursor: "pointer",
                            flexShrink: 0,
                            fontFamily: "var(--font)",
                          }}
                        >
                          💬
                        </button>
                      </>
                    )}
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
        💡 Estos informes son útiles para reuniones de coordinación o revisiones de calidad. Haz clic en un estudiante para abrir su gemelo digital completo. Usa ⬇ para descargar el trabajo y 💬 para ver la retroalimentación del docente.
      </div>

      {feedbackModal && (
        <div
          onClick={() => setFeedbackModal(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              maxWidth: 640, width: "100%", maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "flex-start", gap: 12,
              position: "sticky", top: 0, background: "var(--card)", zIndex: 2,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Retroalimentación del docente
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                  {feedbackModal.evidenceName}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {feedbackModal.studentName}
                </div>
              </div>
              <button
                onClick={() => setFeedbackModal(null)}
                style={{
                  background: "transparent", border: "none",
                  fontSize: 20, cursor: "pointer", color: "var(--muted)",
                  padding: 4, lineHeight: 1,
                }}
                aria-label="Cerrar"
              >✕</button>
            </div>
            <div style={{ padding: 18 }}>
              {feedbackModal.loading ? (
                <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: 24 }}>
                  Cargando retroalimentación...
                </div>
              ) : feedbackModal.error ? (
                <div style={{ fontSize: 12, color: "var(--critical)", padding: 12, background: "var(--critical-bg)", borderRadius: 8 }}>
                  Error: {feedbackModal.error}
                </div>
              ) : (() => {
                const fb = feedbackModal.data || {};
                const text = fb.feedbackText || "";
                const score = fb.score;
                const outOf = fb.outOf;
                const files = Array.isArray(fb.files) ? fb.files : [];
                const rubrics = Array.isArray(fb.rubrics) ? fb.rubrics : [];
                const hasContent =
                  text || score != null || files.length > 0 || rubrics.length > 0;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Global score header */}
                    {(score != null || outOf != null) && (
                      <div style={{
                        display: "flex", alignItems: "baseline", gap: 10,
                        padding: "10px 14px", borderRadius: 10,
                        background: "var(--brand-light)",
                        border: "1px solid var(--brand-light2, #D6E4FF)",
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Calificación
                        </span>
                        <span style={{
                          fontSize: 22, fontWeight: 900,
                          fontFamily: "var(--font-mono)", color: "var(--brand)",
                          marginLeft: "auto",
                        }}>
                          {score != null ? score : "—"}
                          {outOf != null && (
                            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                              {" "}/ {outOf}
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Teacher's general comment */}
                    {text && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                          💬 Comentario general del docente
                        </div>
                        <div
                          style={{
                            fontSize: 13, lineHeight: 1.6, color: "var(--text)",
                            padding: "12px 14px", borderRadius: 10,
                            background: "var(--bg)", border: "1px solid var(--border)",
                          }}
                          dangerouslySetInnerHTML={{ __html: text }}
                        />
                      </div>
                    )}

                    {/* Rubrics (per criterion level + comments) */}
                    {rubrics.length > 0 && rubrics.map((r, ri) => (
                      <div key={ri}>
                        <div style={{
                          display: "flex", alignItems: "baseline", gap: 8,
                          marginBottom: 8,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            📋 Rúbrica: {r.name || "Sin nombre"}
                          </span>
                          {r.score != null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", marginLeft: "auto" }}>
                              {r.score}{r.outOf != null ? ` / ${r.outOf}` : ""}
                              {r.level && ` · ${r.level}`}
                            </span>
                          )}
                        </div>
                        {Array.isArray(r.criteria) && r.criteria.length > 0 ? (
                          <div style={{
                            border: "1px solid var(--border)", borderRadius: 10,
                            overflow: "hidden",
                          }}>
                            {r.criteria.map((c, ci) => (
                              <div key={ci} style={{
                                padding: "10px 14px",
                                borderTop: ci === 0 ? "none" : "1px solid var(--border)",
                                background: ci % 2 === 0 ? "var(--bg)" : "var(--card)",
                                display: "flex", flexDirection: "column", gap: 4,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", flex: 1 }}>
                                    {c.name}
                                  </span>
                                  {c.level && (
                                    <span className="tag" style={{
                                      background: "rgba(52, 120, 246, 0.12)",
                                      color: "var(--brand)",
                                      fontSize: 10, fontWeight: 700,
                                      padding: "2px 8px", borderRadius: 10,
                                    }}>
                                      {c.level}
                                    </span>
                                  )}
                                  {c.points != null && (
                                    <span style={{
                                      fontSize: 11, fontWeight: 800,
                                      fontFamily: "var(--font-mono)", color: "var(--muted)",
                                      minWidth: 30, textAlign: "right",
                                    }}>
                                      {c.points}
                                    </span>
                                  )}
                                </div>
                                {c.comment && (
                                  <div
                                    style={{
                                      fontSize: 11, color: "var(--muted)",
                                      lineHeight: 1.5, paddingLeft: 2,
                                      fontStyle: "italic",
                                    }}
                                    dangerouslySetInnerHTML={{ __html: c.comment }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", padding: "8px 0" }}>
                            Rúbrica sin criterios evaluados
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Teacher's attached files */}
                    {files.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                          📎 Archivos del docente ({files.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {files.map((f, idx) => (
                            <div key={idx} style={{ fontSize: 12, padding: "6px 10px", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--border)" }}>
                              {f.FileName || f.Name || `Archivo ${idx + 1}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasContent && (
                      <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", textAlign: "center", padding: 20 }}>
                        Sin retroalimentación registrada para esta entrega.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
