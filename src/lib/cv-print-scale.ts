/** Escala tipográfica del documento CV para vista previa / impresión según páginas objetivo (1–6). */
export function clampCvPrintMaxPages(raw: unknown, fallback = 3): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(6, Math.max(1, Math.round(n)));
}

export function cvPrintTypographicScale(maxPages: unknown): number {
  const n = clampCvPrintMaxPages(maxPages);
  /** Objetivo 1 página: escala más agresiva para acercar el documento a una sola hoja A4. */
  if (n === 1) return 0.66;
  return 0.74 + ((n - 2) / 4) * 0.24;
}
