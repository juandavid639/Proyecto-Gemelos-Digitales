import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { COLORS } from "../../utils/colors";

/**
 * CourseTrends: line chart showing evolution over time of
 * avgPct, atRiskPct, coveragePct.
 *
 * Data comes from useCourseSnapshots (localStorage-persisted).
 * If there are < 2 snapshots, shows an empty state.
 */
export default function CourseTrends({ snapshots = [] }) {
  const data = snapshots.map((s) => ({
    date: s.date ? s.date.slice(5) : "",  // MM-DD
    "Nota promedio": s.avgPct != null ? Number((s.avgPct / 10).toFixed(2)) : null,
    "% en riesgo": s.atRiskPct != null ? Number(s.atRiskPct.toFixed(1)) : null,
    "Cobertura": s.coveragePct != null ? Number(s.coveragePct.toFixed(1)) : null,
  }));

  if (snapshots.length < 2) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }}>📈</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Aún no hay suficientes datos para graficar tendencias
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          Vuelve mañana — se captura un snapshot automático cada día.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Evolución de los últimos <strong>{snapshots.length}</strong> días. Los snapshots se
        capturan automáticamente al abrir el dashboard cada día.
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: -10, right: 10, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
            <Line
              type="monotone"
              dataKey="Nota promedio"
              stroke={COLORS.brand}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="% en riesgo"
              stroke={COLORS.critical}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Cobertura"
              stroke={COLORS.ok}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
