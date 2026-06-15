/** Viñetas a partir de texto multilínea del editor CV (misma semántica que el documento HTML). */

export function linesToBullets(raw: string): string[] {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^-+\s*/, ""));
}

/** Viñetas en educación: campo `bullets` si existe; si no, líneas de `details` (compatibilidad). */
export function educationBulletLines(x: { bullets?: string; details?: string }): string[] {
  const fromBullets = linesToBullets(x.bullets ?? "");
  if (fromBullets.length > 0) return fromBullets;
  return linesToBullets(x.details ?? "");
}

/** Texto libre bajo las viñetas cuando hay `bullets` dedicado. */
export function educationProseDetails(x: { bullets?: string; details?: string }): string {
  if (linesToBullets(x.bullets ?? "").length === 0) return "";
  return String(x.details ?? "").trim();
}
