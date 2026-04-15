import React, { useMemo, useState, useEffect } from "react";
import { apiGet } from "../../utils/api";

/**
 * Per-assignment upcoming delivery list.
 *
 * Shows every assignment with a due date individually (not grouped), sorted
 * chronologically. Each item has:
 *   - Blue chip with abbreviated date
 *   - Assignment name
 *   - Hover tooltip showing exact time remaining
 *   - ⚠ alarm icon if the deadline is within 2 days
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

  // Extract each assignment individually (not grouped by date)
  const assignments = useMemo(() => {
    const now = new Date();
    const list = [];
    for (const it of items) {
      if (!it?.dueDate) continue;
      const d = new Date(it.dueDate);
      if (Number.isNaN(d.getTime())) continue;
      const msDiff = d - now;
      const daysUntil = Math.floor(msDiff / 86400000);
      const hoursUntil = Math.floor(msDiff / 3600000);
      list.push({
        id: it.id,
        name: it.name || `Ítem ${it.id}`,
        weightPct: Number(it.weightPct || 0),
        due: d,
        dueIso: it.dueDate,
        msDiff,
        daysUntil,
        hoursUntil,
        isPast: msDiff < 0,
        isUrgent: msDiff >= 0 && daysUntil <= 2,
        source: it.source,
      });
    }
    list.sort((a, b) => a.due - b.due);
    return list;
  }, [items]);

  const upcoming = useMemo(() => assignments.filter((a) => !a.isPast), [assignments]);
  const recent = useMemo(
    () => assignments.filter((a) => a.isPast).slice(-3).reverse(),
    [assignments]
  );

  const formatRemaining = (a) => {
    if (a.isPast) {
      const daysAgo = Math.abs(a.daysUntil);
      if (daysAgo === 0) return "Venció hoy";
      if (daysAgo === 1) return "Venció ayer";
      return `Venció hace ${daysAgo} días`;
    }
    if (a.daysUntil === 0) {
      if (a.hoursUntil <= 1) return "Vence en menos de 1 hora";
      return `Vence hoy en ${a.hoursUntil}h`;
    }
    if (a.daysUntil === 1) return "Vence mañana";
    if (a.daysUntil <= 7) return `Vence en ${a.daysUntil} días`;
    if (a.daysUntil <= 30) return `Vence en ${Math.round(a.daysUntil / 7)} semana(s)`;
    return `Vence en ${a.daysUntil} días`;
  };

  const formatExactDate = (a) => {
    return a.due.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  if (assignments.length === 0) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }}>📅</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Sin fechas de entrega en este curso
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {items.length === 0
            ? "El curso no tiene ítems calificables aún."
            : `${items.length} ítems del gradebook, pero ninguno tiene fecha configurada.`}
        </div>
      </div>
    );
  }

  const renderItem = (a, past = false) => {
    const dateObj = a.due;
    const weekday = dateObj.toLocaleDateString("es-CO", { weekday: "short" });
    const day = dateObj.toLocaleDateString("es-CO", { day: "2-digit" });
    const month = dateObj.toLocaleDateString("es-CO", { month: "short" });
    const chipColor = past ? "#94a3b8" : (a.isUrgent ? "#dc2626" : "#0b5fff");
    const chipBg = past
      ? "rgba(148, 163, 184, 0.10)"
      : (a.isUrgent ? "rgba(220, 38, 38, 0.08)" : "rgba(11, 95, 255, 0.06)");
    const chipBorder = past
      ? "rgba(148, 163, 184, 0.30)"
      : (a.isUrgent ? "rgba(220, 38, 38, 0.35)" : "rgba(11, 95, 255, 0.25)");

    const tooltip = `${formatRemaining(a)} · ${formatExactDate(a)}`;

    return (
      <div
        key={`${a.id}-${a.dueIso}`}
        title={tooltip}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${chipBorder}`,
          background: chipBg,
          cursor: "help",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(11, 95, 255, 0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }}
      >
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          minWidth: 46, padding: "6px 8px", borderRadius: 8,
          background: chipColor,
          color: "#fff",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", opacity: 0.9 }}>{weekday}</div>
          <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{day}</div>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", opacity: 0.9 }}>{month}</div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 700, color: "var(--text)",
          }}>
            {a.isUrgent && (
              <span
                title="¡Atención! Esta entrega vence pronto"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#dc2626",
                  color: "#fff", fontSize: 11, fontWeight: 900,
                  flexShrink: 0,
                  animation: "pulse-alert 1.4s ease-in-out infinite",
                }}
              >!</span>
            )}
            <span style={{
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{a.name}</span>
          </div>
          <div style={{ fontSize: 10, color: past ? "var(--muted)" : chipColor, marginTop: 2, fontWeight: 600 }}>
            {formatRemaining(a)}
          </div>
        </div>

        {a.weightPct > 0 && (
          <span className="tag" style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700,
            background: past ? "var(--bg)" : "rgba(11, 95, 255, 0.10)",
            color: past ? "var(--muted)" : "#0b5fff",
          }}>
            {a.weightPct.toFixed(0)}%
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`
        @keyframes pulse-alert {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
          50% { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0); }
        }
      `}</style>

      {upcoming.length > 0 ? (
        <div>
          <div style={{
            fontSize: 11, color: "var(--muted)", fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>📅 Próximas entregas ({upcoming.length})</span>
            {upcoming.some((a) => a.isUrgent) && (
              <span style={{
                fontSize: 10, color: "#dc2626", fontWeight: 800,
                padding: "2px 6px", borderRadius: 10,
                background: "rgba(220, 38, 38, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
              }}>
                ⚠ {upcoming.filter((a) => a.isUrgent).length} urgente(s)
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
            {upcoming.map((a) => renderItem(a, false))}
          </div>
        </div>
      ) : (
        <div style={{ padding: "16px 12px", textAlign: "center", color: "var(--muted)", fontSize: 12, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
          ✓ Sin entregas pendientes
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Vencidas recientemente
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {recent.map((a) => renderItem(a, true))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        {items.length} ítems del curso · {assignments.length} con fecha de entrega
      </div>
    </div>
  );
}
