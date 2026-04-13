import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const ToastContext = createContext(null);

let _toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, { type = "info", duration = 5000 } = {}) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    info: (msg, opts) => addToast(msg, { ...opts, type: "info" }),
    success: (msg, opts) => addToast(msg, { ...opts, type: "success" }),
    warning: (msg, opts) => addToast(msg, { ...opts, type: "warning" }),
    error: (msg, opts) => addToast(msg, { ...opts, type: "error", duration: opts?.duration || 8000 }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/* ── Toast Container + individual Toast ── */

const TOAST_STYLES = {
  info:    { bg: "var(--brand-light, #EBF1FF)", border: "var(--brand, #0B5FFF)", color: "var(--brand, #0B5FFF)", icon: "ℹ️" },
  success: { bg: "var(--ok-bg, #ECFDF3)",       border: "var(--ok, #12B76A)",    color: "#1B5E20",              icon: "✅" },
  warning: { bg: "var(--watch-bg, #FFF8ED)",     border: "var(--watch, #E8900A)", color: "#9A3412",              icon: "⚠️" },
  error:   { bg: "var(--critical-bg, #FEF3F2)",  border: "var(--critical, #D92D20)", color: "#B42318",           icon: "❌" },
};

function Toast({ toast, onRemove }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => onRemove(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px", borderRadius: 12,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: 13, fontWeight: 600,
        fontFamily: "'Manrope', system-ui, sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        animation: "fadeUp 0.3s ease both",
        maxWidth: 420,
        wordBreak: "break-word",
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 14, color: style.color, opacity: 0.6, padding: "2px 4px",
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed", top: 16, right: 16, zIndex: 99999,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "auto",
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
