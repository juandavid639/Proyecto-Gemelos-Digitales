import React, { useState, useEffect } from "react";

/**
 * ContextualTip: shows a dismissable tooltip/tip near a UI element
 * the first time a user sees it. Uses localStorage to remember dismissal.
 *
 * Usage:
 *   <ContextualTip id="first_alerts" title="Alertas inteligentes"
 *     description="Haz clic en un chip para abrir al estudiante." />
 */
export default function ContextualTip({ id, title, description, icon = "💡", style = {} }) {
  const storageKey = id ? `gemelo_tip_${id}` : null;
  const [visible, setVisible] = useState(() => {
    if (!storageKey || typeof localStorage === "undefined") return false;
    return localStorage.getItem(storageKey) !== "dismissed";
  });

  useEffect(() => {
    if (!storageKey) setVisible(false);
  }, [storageKey]);

  const dismiss = () => {
    setVisible(false);
    if (storageKey) {
      try { localStorage.setItem(storageKey, "dismissed"); } catch {}
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--brand-light)",
        border: "1px solid var(--brand)",
        fontSize: 12,
        color: "var(--brand)",
        marginBottom: 12,
        animation: "fadeUp 0.3s ease both",
        ...style,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 800, marginBottom: 2 }}>{title}</div>}
        {description && <div style={{ color: "var(--text)", lineHeight: 1.45 }}>{description}</div>}
      </div>
      <button
        onClick={dismiss}
        aria-label="Cerrar consejo"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          color: "var(--brand)",
          padding: "0 4px",
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
