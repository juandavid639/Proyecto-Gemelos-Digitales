import { useState, useEffect, useCallback } from "react";

/**
 * Hook for a per-student "chat log" (simple timeline of interactions).
 * Stored in localStorage — not synced to backend.
 *
 * Entry shape: { id, date, type, text }
 * Types: "meeting", "email", "note", "action"
 */
export default function useStudentChat(orgUnitId, userId) {
  const storageKey = orgUnitId && userId ? `gemelo_chat_${orgUnitId}_${userId}` : null;

  const [entries, setEntries] = useState(() => {
    if (!storageKey || typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) || []) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!storageKey) { setEntries([]); return; }
    try {
      const raw = localStorage.getItem(storageKey);
      setEntries(raw ? (JSON.parse(raw) || []) : []);
    } catch { setEntries([]); }
  }, [storageKey]);

  const persist = useCallback((next) => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }, [storageKey]);

  const addEntry = useCallback((type, text) => {
    if (!text || !text.trim()) return;
    const entry = {
      id: Date.now() + Math.random().toString(36).slice(2),
      date: new Date().toISOString(),
      type: type || "note",
      text: text.trim(),
    };
    setEntries((prev) => {
      const next = [entry, ...prev];
      persist(next);
      return next;
    });
  }, [persist]);

  const deleteEntry = useCallback((id) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearAll = useCallback(() => {
    setEntries([]);
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }, [storageKey]);

  return { entries, addEntry, deleteEntry, clearAll };
}
