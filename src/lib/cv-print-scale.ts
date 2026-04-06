/** Escala tipográfica del documento CV para vista previa / impresión según páginas objetivo (1–6). */
export function clampCvPrintMaxPages(raw: unknown, fallback = 3): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(6, Math.max(1, Math.round(n)));
}

export function cvPrintTypographicScale(maxPages: unknown): number {
  const n = clampCvPrintMaxPages(maxPages);
  return 0.78 + ((n - 1) / 5) * 0.22;
}
