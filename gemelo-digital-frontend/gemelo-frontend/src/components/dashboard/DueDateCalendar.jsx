import React, { useMemo, useState, useEffect } from "react";
import { apiGet } from "../../utils/api";

/**
 * Workload heatmap / due date calendar.
 *
 * Fetches grade items directly from the course (NOT from per-student gemelos).
 * This way the calendar shows ALL course assignments, not just those of
 * students whose drawer has been opened.
 *
 * Props:
 *   orgUnitId: course id
 */
export default function DueDateCalendar({ orgUnitId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgUnitId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiGet(`/gemelo/course/${orgUnitId}/grade-items`);
        if (!alive) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        setItems(list);
      } catch (e) {
        if (alive) setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [orgUnitId]);

  // Aggregate by date
  const dueDates = useMemo(() => {
    const map = new Map();

    for (const it of items) {
      if (!it?.dueDate) continue;
      try {
        const d = new Date(it.dueDate);
        if (Number.isNaN(d.getTime())) continue;
        const key = d.toISOString().slice(0, 10);
        if (!map.has(key)) {
          map.set(key, {
            date: key,
            items: [],
            totalWeight: 0,
          });
        }
        const entry = map.get(key);
        entry.items.push(it.name || `Ítem ${it.id}`);
        entry.totalWeight += Number(it.weightPct || 0);
      } catch {}
    }

    return Array.from(map.values())
      .map((e) => ({ ...e, itemCount: e.items.length }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [items]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // Group by week for heatmap display
  const weeks = useMemo(() => {
    if (dueDates.length === 0) return [];
    const byWeek = {};
    for (const d of dueDates) {
      const date = new Date(d.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Sunday
      const key = weekStart.toISOString().slice(0, 10);
      if (!byWeek[key]) byWeek[key] = { weekStart: key, days: [], totalItems: 0 };
      byWeek[key].days.push(d);
      byWeek[key].totalItems += d.itemCount;
    }
    return Object.values(byWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [dueDates]);

  // Upcoming items (next 60 days)
  const upcoming = useMemo(() => {
    const in60 = new Date();
    in60.setDate(in60.getDate() + 60);
    const upTo = in60.toISOString().slice(0, 10);
    return dueDates.filter((d) => d.date >= todayStr && d.date <= upTo);
  }, [dueDates, todayStr]);

  // Recently passed (last 30 days)
  const recent = useMemo(() => {
    const ago30 = new Date();
    ago30.setDate(ago30.getDate() - 30);
    const fromStr = ago30.toISOString().slice(0, 10);
    return dueDates.filter((d) => d.date >= fromStr && d.date < todayStr).slice(-5);
  }, [dueDates, todayStr]);

  if (loading) {
    return (
      <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
        Cargando entregas del curso…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: 24, opacity: 0.4, marginBottom: 6 }}>📅</div>
        <div style={{ fontSize: 12 }}>No se pudieron cargar las entregas del curso.</div>
      </div>
    );
  }

  if (dueDates.length === 0) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }}>📅</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Sin fechas de entrega en este curso
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {items.length === 0
            ? "El curso no tiene ítems calificables aún."
            : `${items.length} ítems del gradebook, pero ninguno tiene fecha de entrega configurada en Brightspace.`}
        </div>
      </div>
    );
  }

  const maxItemsPerWeek = Math.max(...weeks.map((w) => w.totalItems), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Upcoming entregables list */}
      {upcoming.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Próximas entregas ({upcoming.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {upcoming.map((d) => {
              const dateObj = new Date(d.date);
              const weekday = dateObj.toLocaleDateString("es-CO", { weekday: "short" });
              const daystr = dateObj.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
              const isHeavy = d.itemCount >= 3;
              const daysUntil = Math.ceil((dateObj - today) / 86400000);
              return (
                <div key={d.date} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${isHeavy ? "var(--watch-border)" : "var(--border)"}`,
                  background: isHeavy ? "var(--watch-bg)" : "var(--bg)",
                }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    minWidth: 52, padding: "5px 8px", borderRadius: 8,
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
                      {daysUntil <= 3 && daysUntil >= 0 && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "var(--critical)", fontWeight: 800 }}>
                          {daysUntil === 0 ? "HOY" : `En ${daysUntil}d`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.3 }}>
                      {d.items.slice(0, 3).join(" · ")}
                      {d.items.length > 3 ? ` … (+${d.items.length - 3})` : ""}
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
      ) : (
        <div style={{ padding: "16px 12px", textAlign: "center", color: "var(--muted)", fontSize: 12, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
          ✓ Sin entregas pendientes en los próximos 60 días
        </div>
      )}

      {/* Recently passed (info) */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Recientes (últimos 30 días)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recent.map(d => {
              const dateObj = new Date(d.date);
              return (
                <div key={`recent-${d.date}`} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: "var(--muted)",
                  padding: "4px 8px", borderRadius: 6, background: "var(--bg)",
                }}>
                  <span>{dateObj.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}</span>
                  <span>{d.itemCount} {d.itemCount === 1 ? "ítem" : "ítems"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap by week */}
      {weeks.length > 1 && (
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Heatmap semanal de carga
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {weeks.map((w) => {
              const intensity = Math.min(1, w.totalItems / (maxItemsPerWeek + 1));
              const isPast = w.weekStart < todayStr;
              return (
                <div
                  key={w.weekStart}
                  title={`Semana del ${w.weekStart}: ${w.totalItems} entrega${w.totalItems !== 1 ? "s" : ""}`}
                  style={{
                    width: 24, height: 24, borderRadius: 4,
                    background: isPast
                      ? `rgba(148, 163, 184, ${0.12 + intensity * 0.4})`
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
            Cada casilla = 1 semana. Color más intenso = más entregas concentradas.
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        {items.length} ítems del gradebook · {dueDates.length} con fecha
      </div>
    </div>
  );
}
