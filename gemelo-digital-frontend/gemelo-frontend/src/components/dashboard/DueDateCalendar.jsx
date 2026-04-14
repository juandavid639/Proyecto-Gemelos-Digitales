import React, { useMemo } from "react";

/**
 * Workload heatmap / due date calendar.
 * Takes all student evidences and aggregates due dates to show when
 * the course has heavy workload weeks.
 *
 * Props:
 *   studentRows: array of student objects (may not have evidences loaded)
 *   drawerEvidences: optional fallback — evidences from current student
 *     (used if studentRows don't have evidences; extracts unique due dates)
 */
export default function DueDateCalendar({ studentRows = [], drawerEvidences = [] }) {
  // Extract unique due dates from evidences
  const dueDates = useMemo(() => {
    const map = new Map();

    const addEv = (ev) => {
      if (!ev?.dueDate) return;
      const d = new Date(ev.dueDate);
      if (Number.isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, {
          date: key,
          items: new Set(),
          totalWeight: 0,
        });
      }
      const entry = map.get(key);
      entry.items.add(ev.name || `Ítem ${ev.gradeObjectId}`);
      entry.totalWeight += Number(ev.weightPct || 0);
    };

    // Aggregate from drawerEvidences (most complete per student) and studentRows
    (drawerEvidences || []).forEach(addEv);
    (studentRows || []).forEach((s) => {
      (s.evidences || []).forEach(addEv);
      (s.gradebook?.evidences || []).forEach(addEv);
    });

    return Array.from(map.values())
      .map((e) => ({ ...e, items: Array.from(e.items), itemCount: e.items.size }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [studentRows, drawerEvidences]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // Group by week for heatmap display
  const weeks = useMemo(() => {
    if (dueDates.length === 0) return [];
    const byWeek = {};
    for (const d of dueDates) {
      const date = new Date(d.date);
      // Week key: year-weekNum
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Sunday
      const key = weekStart.toISOString().slice(0, 10);
      if (!byWeek[key]) byWeek[key] = { weekStart: key, days: [], totalItems: 0 };
      byWeek[key].days.push(d);
      byWeek[key].totalItems += d.itemCount;
    }
    return Object.values(byWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [dueDates]);

  // Upcoming items (next 30 days)
  const upcoming = useMemo(() => {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const upTo = in30.toISOString().slice(0, 10);
    return dueDates.filter((d) => d.date >= todayStr && d.date <= upTo);
  }, [dueDates, todayStr]);

  if (dueDates.length === 0) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }}>📅</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Sin fechas de entrega disponibles
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          Abre un estudiante en el drawer para cargar sus evidencias y fechas.
        </div>
      </div>
    );
  }

  const maxItemsPerDay = Math.max(...dueDates.map((d) => d.itemCount), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Upcoming entregables list */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Próximas entregas ({upcoming.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {upcoming.map((d) => {
              const dateObj = new Date(d.date);
              const weekday = dateObj.toLocaleDateString("es-CO", { weekday: "short" });
              const daystr = dateObj.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
              const isHeavy = d.itemCount >= 3;
              return (
                <div key={d.date} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${isHeavy ? "var(--watch-border)" : "var(--border)"}`,
                  background: isHeavy ? "var(--watch-bg)" : "var(--bg)",
                }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    minWidth: 48, padding: "4px 6px", borderRadius: 8,
                    background: isHeavy ? "var(--watch)" : "var(--brand)",
                    color: "#fff",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{weekday}</div>
                    <div style={{ fontSize: 12, fontWeight: 900 }}>{daystr}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      {d.itemCount} {d.itemCount === 1 ? "entrega" : "entregas"}
                      {isHeavy && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--watch)", fontWeight: 800 }}>⚠ SOBRECARGA</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.items.slice(0, 3).join(", ")}{d.items.length > 3 ? "..." : ""}
                    </div>
                  </div>
                  {d.totalWeight > 0 && (
                    <span className="tag" style={{ flexShrink: 0 }}>
                      {d.totalWeight.toFixed(0)}% peso
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap by week */}
      {weeks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Carga por semana (heatmap)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {weeks.map((w) => {
              const intensity = Math.min(1, w.totalItems / (maxItemsPerDay * 3));
              const isPast = w.weekStart < todayStr;
              return (
                <div
                  key={w.weekStart}
                  title={`Semana del ${w.weekStart}: ${w.totalItems} entregas`}
                  style={{
                    width: 24, height: 24, borderRadius: 4,
                    background: isPast
                      ? `rgba(148, 163, 184, ${0.15 + intensity * 0.4})`
                      : `rgba(11, 95, 255, ${0.15 + intensity * 0.7})`,
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800,
                    color: intensity > 0.5 ? "#fff" : "var(--muted)",
                    cursor: "help",
                  }}
                >
                  {w.totalItems}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
            Cada casilla es una semana. Más oscuro = más entregas concentradas.
          </div>
        </div>
      )}
    </div>
  );
}
