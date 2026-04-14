import React, { useMemo } from "react";
import { predictClassFailures } from "../../utils/prediction";
import { COLORS } from "../../utils/colors";

/**
 * Class-level grade prediction summary.
 * Uses trajectory projection (not ML) to estimate how many students
 * will pass/fail if current performance holds.
 */
export default function GradePredictions({ studentRows = [], onStudentClick = () => {} }) {
  const { willFail, borderline, willPass, total } = useMemo(
    () => predictClassFailures(studentRows),
    [studentRows]
  );

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
        <div style={{ padding: 12, background: "var(--watch-bg)", border: "1px solid var(--watch-border)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--watch)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            🟡 En el límite ({borderline.length})
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {borderline.map(x => x.student.displayName.split(" ")[0]).slice(0, 5).join(", ")}
            {borderline.length > 5 ? `, y ${borderline.length - 5} más` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
