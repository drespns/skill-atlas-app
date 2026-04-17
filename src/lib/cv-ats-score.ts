import type { AtsCheckResult } from "./cv-ats-check";

/**
 * Puntuación heurística 0–100 (no sustituye a un ATS comercial; mismas reglas que el checklist).
 * Kickresume y similares no publican algoritmos; esto resume el propio checklist en un número.
 */
export function computeAtsHeuristicScore(result: AtsCheckResult): {
  score: number;
  okCount: number;
  warnCount: number;
  infoCount: number;
} {
  const okCount = result.ok.length;
  const warnCount = result.warn.length;
  const infoCount = result.info.length;
  let score = 72 + okCount * 5 - warnCount * 12 - infoCount * 3;
  score = Math.round(Math.min(100, Math.max(18, score)));
  return { score, okCount, warnCount, infoCount };
}
