import React, { useMemo } from "react";
import { predictClassFailures, predictFinalGrade } from "../../utils/prediction";
import { COLORS } from "../../utils/colors";

/**
 * Class-level grade prediction summary.
 * Uses trajectory projection (not ML) to estimate how many students
 * will pass/fail if current performance holds.
 *
 * Props:
 *   studentRows: array
 *   onStudentClick: (userId) => void
 *   courseInfo: { Name, StartDate, EndDate } — optional
 *   variant: "compact" | "full" — compact = small summary, full = large view
 */
export default function GradePredictions({
  studentRows = [],
  onStudentClick = () => {},
  courseInfo = null,
  variant = "compact",
}) {
  const { willFail, borderline, willPass, total } = useMemo(
    () => predictClassFailures(studentRows),
    [studentRows]
  );

  const fmtDate = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "2-digit" });
    } catch { return null; }
  };

  const startDateStr = fmtDate(courseInfo?.StartDate);
  const endDateStr = fmtDate(courseInfo?.EndDate);

  // Compute days elapsed and remaining
  const { daysElapsed, daysRemaining, progressPct } = useMemo(() => {
    if (!courseInfo?.StartDate || !courseInfo?.EndDate) {
      return { daysElapsed: null, daysRemaining: null, progressPct: null };
    }
    try {
      const start = new Date(courseInfo.StartDate).getTime();
      const end = new Date(courseInfo.EndDate).getTime();
      const now = Date.now();
      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
        return { daysElapsed: null, daysRemaining: null, progressPct: null };
      }
      const total = end - start;
      const elapsed = Math.max(0, now - start);
      const remaining = Math.max(0, end - now);
      return {
        daysElapsed: Math.floor(elapsed / 86400000),
        daysRemaining: Math.floor(remaining / 86400000),
        progressPct: Math.min(100, Math.max(0, (elapsed / total) * 100)),
      };
    } catch {
      return { daysElapsed: null, daysRemaining: null, progressPct: null };
    }
  }, [courseInfo]);

  if (total === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: 24, opacity: 0.4, marginBottom: 6 }}>🔮</div>
        <div style={{ fontSize: 12 }}>Sin datos suficientes para predecir notas finales.</div>
      </div>
    );
  }

  const failPct = Math.round((willFail.length / total) * 100);
  const borderPct = Math.round((borderline.length / total) * 100);
  const passPct = Math.round((willPass.length / total) * 100);

  return (
    <div>
      {/* Course timeline header (visible in full variant) */}
      {variant === "full" && (startDateStr || endDateStr) && (
        <div style={{
          marginBottom: 16, padding: "14px 16px",
          borderRadius: 12, background: "var(--brand-light)",
          border: "1px solid var(--brand-light2, #D6E4FF)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            📅 Línea de tiempo del curso
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            {startDateStr && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Inicio</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{startDateStr}</div>
              </div>
            )}
            {endDateStr && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Finaliza</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{endDateStr}</div>
              </div>
            )}
          </div>
          {progressPct != null && (
            <div>
              <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.6)", overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--brand)", borderRadius: 99 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                <span>{daysElapsed} días transcurridos</span>
                <span style={{ fontWeight: 700, color: "var(--brand)" }}>{progressPct.toFixed(0)}% completado</span>
                <span>{daysRemaining} días restantes</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Proyección basada en la trayectoria actual (sin considerar mejora/empeoramiento futuro).
        Confianza crece con la cobertura calificada.
      </div>

      {/* Summary bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", border: "1px solid var(--border)" }}>
          {willPass.length > 0 && (
            <div style={{ flex: willPass.length, background: COLORS.ok }} title={`Pasarán: ${willPass.length}`} />
          )}
          {borderline.length > 0 && (
            <div style={{ flex: borderline.length, background: COLORS.watch }} title={`Borderline: ${borderline.length}`} />
          )}
          {willFail.length > 0 && (
            <div style={{ flex: willFail.length, background: COLORS.critical }} title={`Reprobarán: ${willFail.length}`} />
          )}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: COLORS.ok }} />
            Pasarán: <strong style={{ color: COLORS.ok }}>{willPass.length}</strong> ({passPct}%)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: COLORS.watch }} />
            Borderline: <strong style={{ color: COLORS.watch }}>{borderline.length}</strong> ({borderPct}%)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: COLORS.critical }} />
            Reprobarán: <strong style={{ color: COLORS.critical }}>{willFail.length}</strong> ({failPct}%)
          </span>
        </div>
      </div>

      {/* At-risk students detail */}
      {willFail.length > 0 && (
        <div style={{ padding: 12, background: "var(--critical-bg)", border: "1px solid var(--critical-border)", borderRadius: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--critical)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            ⚠️ Alto riesgo de reprobación ({willFail.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {willFail.slice(0, 5).map(({ student, pred }) => (
              <button
                key={student.userId}
                onClick={() => onStudentClick(student.userId)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px", borderRadius: 8,
                  background: "rgba(255,255,255,0.5)",
                  border: "none", cursor: "pointer",
                  fontSize: 12, fontFamily: "var(--font)", textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--text)" }}>
                  {student.displayName}
                </span>
                <span style={{ fontSize: 11, color: "var(--critical)", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                  Proyección: {pred.expectedGrade10.toFixed(1)}/10
                </span>
              </button>
            ))}
            {willFail.length > 5 && (
              <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", padding: "4px 0" }}>
                + {willFail.length - 5} más
              </div>
            )}
          </div>
        </div>
      )}

      {borderline.length > 0 && (
        <div style={{ padding: 12, background: "var(--watch-bg)", border: "1px solid var(--watch-border)", borderRadius: 10, marginBottom: variant === "full" ? 10 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--watch)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            🟡 En el límite ({borderline.length})
          </div>
          {variant === "full" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {borderline.map(({ student, pred }) => (
                <button
                  key={student.userId}
                  onClick={() => onStudentClick(student.userId)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.5)",
                    border: "none", cursor: "pointer",
                    fontSize: 12, fontFamily: "var(--font)", textAlign: "left",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                    {student.displayName}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--watch)", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                    Proyección: {pred.expectedGrade10.toFixed(1)}/10
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {borderline.map(x => x.student.displayName.split(" ")[0]).slice(0, 5).join(", ")}
              {borderline.length > 5 ? `, y ${borderline.length - 5} más` : ""}
            </div>
          )}
        </div>
      )}

      {/* Full list of all students with their predictions (full variant only) */}
      {variant === "full" && willPass.length > 0 && (
        <div style={{ padding: 12, background: "var(--ok-bg)", border: "1px solid var(--ok-border)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ok)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            ✅ En camino a aprobar ({willPass.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
            {willPass.map(({ student, pred }) => (
              <button
                key={student.userId}
                onClick={() => onStudentClick(student.userId)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px", borderRadius: 8,
                  background: "rgba(255,255,255,0.5)",
                  border: "none", cursor: "pointer",
                  fontSize: 12, fontFamily: "var(--font)", textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--text)" }}>
                  {student.displayName}
                </span>
                <span style={{ fontSize: 11, color: "var(--ok)", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                  Proyección: {pred.expectedGrade10.toFixed(1)}/10
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
