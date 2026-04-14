import { useState, useEffect } from "react";

/**
 * Hook for compact/dense UI mode (persisted in localStorage).
 * When enabled, adds `compact` class to document.documentElement so CSS
 * can tighten padding/font sizes globally.
 */
export default function useCompactMode() {
  const [compact, setCompactState] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem("gemelo_compact") === "1";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("compact", compact);
    try {
      localStorage.setItem("gemelo_compact", compact ? "1" : "0");
    } catch {}
  }, [compact]);

  const setCompact = (val) => setCompactState(Boolean(val));
  const toggleCompact = () => setCompactState((v) => !v);

  return { compact, setCompact, toggleCompact };
}
