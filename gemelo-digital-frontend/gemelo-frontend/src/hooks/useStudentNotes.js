import { useState, useEffect, useCallback } from "react";

/**
 * Hook for persistent private teacher notes per student.
 * Uses localStorage keyed by orgUnitId+userId.
 * Notes are private to the teacher's browser (not synced to backend).
 *
 * Usage:
 *   const { notes, setNotes, lastUpdated } = useStudentNotes(orgUnitId, userId);
 */
export default function useStudentNotes(orgUnitId, userId) {
  const storageKey = orgUnitId && userId ? `gemelo_note_${orgUnitId}_${userId}` : null;

  const [notes, setNotesState] = useState(() => {
    if (!storageKey || typeof localStorage === "undefined") return "";
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return parsed?.text || "";
    } catch {
      return "";
    }
  });

  const [lastUpdated, setLastUpdated] = useState(() => {
    if (!storageKey || typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.updatedAt || null;
    } catch {
      return null;
    }
  });

  // Reload notes when storageKey changes (different student opened)
  useEffect(() => {
    if (!storageKey) {
      setNotesState("");
      setLastUpdated(null);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setNotesState(parsed?.text || "");
        setLastUpdated(parsed?.updatedAt || null);
      } else {
        setNotesState("");
        setLastUpdated(null);
      }
    } catch {
      setNotesState("");
      setLastUpdated(null);
    }
  }, [storageKey]);

  const setNotes = useCallback((text) => {
    setNotesState(text);
    if (!storageKey) return;
    try {
      const now = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ text, updatedAt: now }));
      setLastUpdated(now);
    } catch {
      // quota exceeded or disabled
    }
  }, [storageKey]);

  const clearNotes = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
      setNotesState("");
      setLastUpdated(null);
    } catch {}
  }, [storageKey]);

  return { notes, setNotes, lastUpdated, clearNotes };
}
