export const COLORS = {
  critical: "#D92D20",
  watch: "#F79009",
  ok: "#12B76A",
  pending: "#98A2B3",
  brand: "#0B5FFF",
};

export const STATUS_CONFIG = {
  solido: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  "óptimo": { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  optimo: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Óptimo" },
  observacion: { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Seguimiento" },
  "en seguimiento": { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Seguimiento" },
  "en desarrollo": { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "En desarrollo" },
  critico: { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Crítico" },
  cargando: { bg: "var(--brand-light)", fg: "#1D4ED8", dot: COLORS.brand, label: "Cargando" },
  pending: { bg: "var(--pending-bg)", fg: "var(--muted)", dot: COLORS.pending, label: "Pendiente" },
  alto: { bg: "var(--critical-bg)", fg: "#B42318", dot: COLORS.critical, label: "Alto" },
  medio: { bg: "var(--watch-bg)", fg: "#9A3412", dot: COLORS.watch, label: "Medio" },
  bajo: { bg: "var(--ok-bg)", fg: "#1B5E20", dot: COLORS.ok, label: "Bajo" },
};

import { normStatus } from "./helpers";

export function colorForRisk(risk) {
  const r = normStatus(risk);
  if (r === "alto" || r === "critico") return COLORS.critical;
  if (r === "medio" || r === "en desarrollo") return COLORS.watch;
  if (r === "bajo" || r === "óptimo") return COLORS.ok;
  return COLORS.pending;
}

export function colorForPct(pct, thresholds) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return COLORS.pending;
  const p = Number(pct);
  const thr = thresholds || { critical: 50, watch: 70 };
  if (p < Number(thr.critical)) return COLORS.critical;
  if (p < Number(thr.watch)) return COLORS.watch;
  return COLORS.ok;
}

export function colorForLearningOutcome(m, thresholds) {
  const st = normStatus(m?.status);
  if (st === "critico") return COLORS.critical;
  if (st === "en desarrollo" || st === "en seguimiento" || st === "observacion") return COLORS.watch;
  if (st === "optimo" || st === "solido" || st === "óptimo") return COLORS.ok;
  return colorForPct(m?.avgPct, thresholds);
}
