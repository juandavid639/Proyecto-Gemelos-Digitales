import React from "react";

/**
 * Simple breadcrumb navigation component.
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: "Inicio", onClick: () => navigate("/") },
 *     { label: "Dashboard", onClick: () => navigate("/dashboard") },
 *     { label: "Curso X" },
 *   ]} />
 */
export default function Breadcrumb({ items = [], style = {} }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <nav
      aria-label="Ruta de navegación"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: "var(--muted)",
        marginBottom: 8,
        flexWrap: "wrap",
        ...style,
      }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isClickable = !isLast && typeof item.onClick === "function";

        return (
          <React.Fragment key={i}>
            {isClickable ? (
              <button
                onClick={item.onClick}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  padding: "2px 6px",
                  borderRadius: 6,
                  transition: "color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--brand)";
                  e.currentTarget.style.background = "var(--brand-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--muted)";
                  e.currentTarget.style.background = "none";
                }}
              >
                {item.icon && <span style={{ marginRight: 4 }}>{item.icon}</span>}
                {item.label}
              </button>
            ) : (
              <span style={{
                padding: "2px 6px",
                color: isLast ? "var(--text)" : "var(--muted)",
                fontWeight: isLast ? 800 : 600,
              }}>
                {item.icon && <span style={{ marginRight: 4 }}>{item.icon}</span>}
                {item.label}
              </span>
            )}
            {!isLast && (
              <span style={{ color: "var(--border2, #CDD3DE)", fontSize: 11 }}>›</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
