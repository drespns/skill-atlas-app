/** Escala tipográfica del documento CV para vista previa / impresión según páginas objetivo (1–6). */
export function clampCvPrintMaxPages(raw: unknown, fallback = 3): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(6, Math.max(1, Math.round(n)));
}

export type CvPrintScaleOpts = {
  /** Secciones del documento con datos (visibles y no vacías); solo afecta cuando el objetivo es 1 página. */
  densityFilledSections?: number;
};

/**
 * Con muchas secciones rellenas, el objetivo «1 página» necesita algo más de compresión que el valor base.
 * Fórmula suave a partir de 5 bloques; tope para no volver ilegible el texto.
 */
export function cvPrintTypographicScale(maxPages: unknown, opts?: CvPrintScaleOpts): number {
  const n = clampCvPrintMaxPages(maxPages);
  let base: number;
  if (n === 1) {
    base = 0.66;
    const c = opts?.densityFilledSections;
    if (typeof c === "number" && Number.isFinite(c)) {
      const blocks = Math.max(0, Math.min(14, Math.round(c)));
      const extraShrink = Math.max(0, blocks - 5) * 0.024;
      base = Math.max(0.52, base - extraShrink);
    }
  } else {
    base = Math.min(1, 0.86 + ((n - 2) / 4) * 0.14);
  }
  return base;
}

/** Porcentaje entero (p. ej. 74) para UI de «objetivo de extensión». */
export function cvPrintTypographicScalePercent(maxPages: unknown, opts?: CvPrintScaleOpts): number {
  return Math.round(cvPrintTypographicScale(maxPages, opts) * 100);
}
