import React, { useState, useEffect, useRef, useMemo } from "react";

/**
 * Command palette modal (like Ctrl+K in VSCode/Linear).
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   commands: [{ id, label, hint, icon, group, action }]
 *
 * The user types to filter, arrow keys to navigate, Enter to execute,
 * Escape to close.
 */
export default function CommandPalette({ open, onClose, commands = [] }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.label} ${c.hint || ""} ${c.group || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, commands]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) {
        cmd.action?.();
        onClose?.();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
    }
  };

  if (!open) return null;

  // Group commands by `group` field
  const grouped = {};
  filtered.forEach((c, originalIdx) => {
    const g = c.group || "General";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push({ ...c, _originalIdx: filtered.indexOf(c) });
  });

  return (
    <div
      role="dialog"
      aria-label="Paleta de comandos"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(13,17,23,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", paddingLeft: 20, paddingRight: 20,
        animation: "fadeIn 0.15s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comando o busca un estudiante..."
            aria-label="Buscar comando"
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent", color: "var(--text)",
              fontSize: 15, fontWeight: 500,
              fontFamily: "var(--font)",
            }}
          />
          <span style={{
            fontSize: 9, fontWeight: 800, color: "var(--muted)",
            padding: "3px 7px", borderRadius: 5,
            background: "var(--bg)", border: "1px solid var(--border)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>ESC</span>
        </div>

        {/* Results list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Sin resultados para "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName}>
                <div style={{
                  padding: "8px 18px 4px",
                  fontSize: 10, fontWeight: 800, color: "var(--muted)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  {groupName}
                </div>
                {items.map((cmd) => {
                  const isActive = cmd._originalIdx === activeIdx;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action?.();
                        onClose?.();
                      }}
                      onMouseEnter={() => setActiveIdx(cmd._originalIdx)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        width: "100%", padding: "10px 18px",
                        background: isActive ? "var(--brand-light)" : "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                        fontSize: 13, fontFamily: "var(--font)",
                        color: isActive ? "var(--brand)" : "var(--text)",
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{cmd.icon || "▸"}</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{cmd.label}</span>
                      {cmd.hint && (
                        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>
                          {cmd.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: "8px 18px",
          borderTop: "1px solid var(--border)",
          fontSize: 10, color: "var(--muted)", fontWeight: 600,
          display: "flex", gap: 14,
        }}>
          <span>↑↓ Navegar</span>
          <span>↵ Seleccionar</span>
          <span>Esc Cerrar</span>
          <span style={{ marginLeft: "auto" }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
