/** Preferencias de UI del visitante en portfolio público (localStorage). */

export const PUBLIC_PORTFOLIO_GUEST_PREFS_KEY = "skillatlas_public_portfolio_ui_v1";

export type PublicPortfolioGuestLayout = "inherit" | "grid" | "list";

export type PublicPortfolioGuestPrefs = {
  layout?: PublicPortfolioGuestLayout;
  /** 1–5 o heredar del autor */
  embedCap?: "inherit" | 1 | 2 | 3 | 4 | 5;
  /** Si true, desactiva animaciones de entrada aunque el sistema permita movimiento */
  reducedMotion?: boolean;
};

type StoreShape = {
  byKey: Record<string, PublicPortfolioGuestPrefs>;
};

function emptyStore(): StoreShape {
  return { byKey: {} };
}

function readStore(): StoreShape {
  try {
    const raw = localStorage.getItem(PUBLIC_PORTFOLIO_GUEST_PREFS_KEY);
    if (!raw) return emptyStore();
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === "object" && "byKey" in p && typeof (p as StoreShape).byKey === "object") {
      return p as StoreShape;
    }
  } catch {
    /* ignore */
  }
  return emptyStore();
}

function writeStore(s: StoreShape) {
  try {
    localStorage.setItem(PUBLIC_PORTFOLIO_GUEST_PREFS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function guestPrefsKeyForSlug(slug: string): string {
  return `slug:${slug.trim().toLowerCase()}`;
}

export function guestPrefsKeyForToken(token: string): string {
  return `token:${token.trim().toLowerCase()}`;
}

/** Clave estable para la vista previa autenticada en `/portfolio`. */
export const GUEST_PREFS_PREVIEW_KEY = "preview:session";

export function readPublicPortfolioGuestPrefs(scopeKey: string): PublicPortfolioGuestPrefs {
  const s = readStore();
  return { ...(s.byKey[scopeKey] ?? {}) };
}

export function patchPublicPortfolioGuestPrefs(scopeKey: string, patch: Partial<PublicPortfolioGuestPrefs>) {
  const s = readStore();
  const cur = { ...(s.byKey[scopeKey] ?? {}) };
  const next = { ...cur, ...patch };
  if (next.layout === "inherit") delete next.layout;
  if (next.embedCap === "inherit") delete next.embedCap;
  if (next.reducedMotion === false) delete next.reducedMotion;
  s.byKey[scopeKey] = next;
  if (Object.keys(next).length === 0) delete s.byKey[scopeKey];
  writeStore(s);
}

export function normalizeOwnerLayout(v: unknown): "grid" | "list" {
  return typeof v === "string" && v.trim().toLowerCase() === "list" ? "list" : "grid";
}

export function normalizeOwnerEmbedLimit(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function effectivePublicLayout(
  owner: "grid" | "list",
  guest: PublicPortfolioGuestPrefs,
): "grid" | "list" {
  if (guest.layout === "grid" || guest.layout === "list") return guest.layout;
  return owner;
}

export function effectiveEmbedCap(ownerLimit: number, guest: PublicPortfolioGuestPrefs): number {
  if (guest.embedCap === 1 || guest.embedCap === 2 || guest.embedCap === 3 || guest.embedCap === 4 || guest.embedCap === 5) {
    return Math.min(guest.embedCap, ownerLimit);
  }
  return ownerLimit;
}

export function motionEnabledForGuest(guest: PublicPortfolioGuestPrefs): boolean {
  if (guest.reducedMotion) return false;
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Clases del contenedor de tarjetas (público o preview autenticado). */
export function publicPortfolioMountGridClass(layout: "grid" | "list"): string {
  if (layout === "list") {
    return "portfolio-public-mount portfolio-public-mount--list grid grid-cols-1 gap-5 sm:gap-6 max-w-4xl mx-auto w-full";
  }
  return "portfolio-public-mount portfolio-public-mount--grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6";
}
