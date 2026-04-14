import { useState, useEffect, useMemo } from "react";

/**
 * Persists daily snapshots of course metrics in localStorage so we can
 * show a "trend over time" chart even without a backend history.
 *
 * Stores one snapshot per day keyed by orgUnitId. On subsequent loads in
 * the same day, the snapshot is updated (not appended).
 *
 * Snapshot shape:
 *   { date: "YYYY-MM-DD", avgPct, atRiskPct, coveragePct, totalStudents }
 *
 * Returns:
 *   - snapshots: sorted array of historical snapshots (last 90 days)
 *   - today: the snapshot for today (if captured)
 */
export default function useCourseSnapshots(orgUnitId, currentMetrics) {
  const storageKey = orgUnitId ? `gemelo_snapshots_${orgUnitId}` : null;

  const [snapshots, setSnapshots] = useState(() => {
    if (!storageKey || typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Auto-capture snapshot when metrics change and we have real data
  useEffect(() => {
    if (!storageKey) return;
    if (!currentMetrics) return;
    if (currentMetrics.totalStudents == null || currentMetrics.totalStudents === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const newSnap = {
      date: today,
      avgPct: currentMetrics.avgPct ?? null,
      atRiskPct: currentMetrics.atRiskPct ?? null,
      coveragePct: currentMetrics.coveragePct ?? null,
      totalStudents: currentMetrics.totalStudents ?? 0,
    };

    setSnapshots((prev) => {
      // Replace today's snapshot if exists, otherwise append
      const filtered = prev.filter((s) => s.date !== today);
      const next = [...filtered, newSnap];
      // Keep only last 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const trimmed = next.filter((s) => s.date >= cutoffStr);
      trimmed.sort((a, b) => a.date.localeCompare(b.date));

      try {
        localStorage.setItem(storageKey, JSON.stringify(trimmed));
      } catch {}

      return trimmed;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storageKey,
    currentMetrics?.avgPct,
    currentMetrics?.atRiskPct,
    currentMetrics?.coveragePct,
    currentMetrics?.totalStudents,
  ]);

  const today = useMemo(() => {
    const d = new Date().toISOString().slice(0, 10);
    return snapshots.find((s) => s.date === d) || null;
  }, [snapshots]);

  return { snapshots, today };
}
