/** Presentación del portfolio público (tema, densidad, acento, cabecera). */

export type PortfolioPublicTheme = "classic" | "minimal" | "contrast" | "reader";
export type PortfolioPublicDensity = "comfortable" | "compact";
export type PortfolioHeaderStyle = "default" | "cta_prominent";

export function normalizePublicTheme(v: unknown): PortfolioPublicTheme {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "minimal" || s === "contrast" || s === "reader") return s;
  return "classic";
}

export function normalizePublicDensity(v: unknown): PortfolioPublicDensity {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "compact") return "compact";
  return "comfortable";
}

/** Hex sin #, 6 caracteres; null si inválido. */
export function normalizePublicAccentHex(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

export function normalizePublicHeaderStyle(v: unknown): PortfolioHeaderStyle {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "cta_prominent") return "cta_prominent";
  return "default";
}

export function accentHexToRgbSpaceSeparated(hex: string | null): string | null {
  if (!hex || !/^[0-9A-Fa-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex.replace(/^#/, ""), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function parseFeaturedSlugsFromText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function featuredSlugsFromRpc(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return out;
}

export function featuredSlugsToTextareaLines(raw: unknown): string {
  return featuredSlugsFromRpc(raw).join("\n");
}

/** Orden: slugs en `featured` primero (en ese orden), resto por título. */
export function sortProjectsByFeaturedSlugs<T extends { slug: string; title: string }>(
  projects: T[],
  featured: string[],
): T[] {
  const order = new Map<string, number>();
  featured.forEach((s, i) => order.set(s.trim().toLowerCase(), i));
  return [...projects].sort((a, b) => {
    const ia = order.get(a.slug.trim().toLowerCase());
    const ib = order.get(b.slug.trim().toLowerCase());
    const aFeat = ia !== undefined;
    const bFeat = ib !== undefined;
    if (aFeat && bFeat) return (ia as number) - (ib as number);
    if (aFeat) return -1;
    if (bFeat) return 1;
    return a.title.localeCompare(b.title, "es");
  });
}

export function applyPortfolioPresentationToRoot(
  root: HTMLElement | null,
  opts: {
    theme: PortfolioPublicTheme;
    density: PortfolioPublicDensity;
    accentHex: string | null;
    headerStyle: PortfolioHeaderStyle;
  },
): void {
  if (!root) return;
  root.dataset.publicPresentationTheme = opts.theme;
  root.dataset.publicPresentationDensity = opts.density;
  root.dataset.publicHeaderStyle = opts.headerStyle;
  const rgb = accentHexToRgbSpaceSeparated(opts.accentHex);
  if (rgb) {
    root.style.setProperty("--portfolio-accent-rgb", rgb);
    root.dataset.publicAccentHex = (opts.accentHex ?? "").replace(/^#/, "").toLowerCase();
  } else {
    root.style.removeProperty("--portfolio-accent-rgb");
    delete root.dataset.publicAccentHex;
  }
}
