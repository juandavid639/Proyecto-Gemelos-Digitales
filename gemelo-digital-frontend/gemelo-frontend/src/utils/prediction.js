/**
 * Simple trajectory-based grade prediction.
 * Not ML — just a weighted projection: if the student keeps performing
 * at the current avg on the remaining coverage, what's the expected final grade?
 *
 * Also supports best/worst case scenarios.
 */

export function predictFinalGrade(student) {
  if (!student) return null;
  const currentPct = Number(student.currentPerformancePct);
  const coveragePct = Number(student.coveragePct);

  if (Number.isNaN(currentPct) || Number.isNaN(coveragePct) || coveragePct <= 0) {
    return null;
  }

  const remainingWeight = Math.max(0, 100 - coveragePct);
  const done = currentPct * (coveragePct / 100);

  // Scenario: maintains current performance
  const expected = done + currentPct * (remainingWeight / 100);

  // Scenario: improves (current + 15 points, capped at 100)
  const improve = done + Math.min(100, currentPct + 15) * (remainingWeight / 100);

  // Scenario: drops (current - 15 points, floored at 0)
  const drops = done + Math.max(0, currentPct - 15) * (remainingWeight / 100);

  // Confidence = coverage (more data = higher confidence)
  const confidence = Math.min(100, coveragePct);

  // Will pass? (>= 60% = 6.0 / 10)
  const expectedGrade10 = expected / 10;
  const willPass = expected >= 60;
  const willFail = expected < 50;
  const borderline = expected >= 50 && expected < 60;

  return {
    expectedPct: Math.round(expected * 10) / 10,
    expectedGrade10: Math.round(expectedGrade10 * 10) / 10,
    improvePct: Math.round(improve * 10) / 10,
    dropsPct: Math.round(drops * 10) / 10,
    confidence: Math.round(confidence),
    willPass,
    willFail,
    borderline,
  };
}

export function predictClassFailures(studentRows) {
  const rows = Array.isArray(studentRows) ? studentRows : [];
  const predictions = rows
    .map((s) => ({ student: s, pred: predictFinalGrade(s) }))
    .filter((x) => x.pred != null);

  const willFail = predictions.filter((x) => x.pred.willFail);
  const borderline = predictions.filter((x) => x.pred.borderline);
  const willPass = predictions.filter((x) => x.pred.willPass);

  return { willFail, borderline, willPass, total: predictions.length };
}
