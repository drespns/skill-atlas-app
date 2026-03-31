/** Slug visible en /portfolio/<slug> — validación compartida (Ajustes + futuras APIs). */

export const RESERVED_PUBLIC_SLUGS = new Set([
  "login",
  "settings",
  "admin",
  "api",
  "app",
  "demo",
  "pricing",
  "request-access",
  "technologies",
  "projects",
  "portfolio",
  "p",
  "view",
  "static",
  "assets",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function normalizePublicSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

/** true si cumple formato (2–32) y no está reservado. */
export function isValidPublicSlug(normalized: string): boolean {
  const s = normalized.trim().toLowerCase();
  if (s.length < 2 || s.length > 32) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s)) return false;
  if (RESERVED_PUBLIC_SLUGS.has(s)) return false;
  return true;
}
