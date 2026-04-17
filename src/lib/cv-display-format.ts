/**
 * Formato de fechas y metadatos en el documento CV (experiencia / educación).
 */

export type CvDateDisplayMode = "full" | "year";

const YEAR_RE = /\b(19|20)\d{2}\b/;

/** Extrae un año de cadena tipo "ene 2020", "2020-01", "2020". */
export function extractYearPart(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const m = t.match(YEAR_RE);
  return m ? m[0] : "";
}

/**
 * Rango start–end para el CV.
 * - `full`: concatena tal cual (comportamiento histórico).
 * - `year`: intenta mostrar solo años; si no hay año reconocible, cae a texto original.
 */
export function formatCvDateRange(start: string, end: string, mode: CvDateDisplayMode): string {
  const s0 = String(start ?? "").trim();
  const e0 = String(end ?? "").trim();
  if (mode !== "year") {
    return [s0, e0].filter(Boolean).join(" – ");
  }
  const ys = extractYearPart(s0) || (s0 && !YEAR_RE.test(s0) ? s0 : "");
  const ye = extractYearPart(e0) || (e0 && !YEAR_RE.test(e0) ? e0 : "");
  if (ys && ye && ys !== ye) return `${ys} – ${ye}`;
  if (ys && ye && ys === ye) return ys;
  if (ys) return e0 ? `${ys} – ${extractYearPart(e0) || e0}`.replace(/ – $/, "") : ys;
  if (ye) return ye;
  return [s0, e0].filter(Boolean).join(" – ");
}
