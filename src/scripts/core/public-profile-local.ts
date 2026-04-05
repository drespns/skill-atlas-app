/** Perfil público (nombre + bio + stack de ayuda); local-first y sync con `portfolio_profiles` en Supabase. */

export const PUBLIC_PROFILE_STORAGE_KEY = "skillatlas_public_profile_v1";

export type StoredPublicProfile = {
  publicName: string;
  bio: string;
  /** Claves de `HELP_STACK_ITEMS` */
  helpStack: string[];
};

function safeParse(raw: string | null): Partial<StoredPublicProfile> | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    const out: Partial<StoredPublicProfile> = {};
    if (typeof o.publicName === "string") out.publicName = o.publicName;
    if (typeof o.bio === "string") out.bio = o.bio;
    if (Array.isArray(o.helpStack))
      out.helpStack = o.helpStack.filter((x): x is string => typeof x === "string");
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export function readStoredPublicProfile(): Partial<StoredPublicProfile> | null {
  return safeParse(localStorage.getItem(PUBLIC_PROFILE_STORAGE_KEY));
}

export function writeStoredPublicProfile(profile: StoredPublicProfile) {
  localStorage.setItem(PUBLIC_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

/** Refresca cabecera del portfolio desde localStorage (fallback si no hay fila en servidor). */
export function hydratePortfolioPublicProfile() {
  const nameEl = document.querySelector<HTMLElement>("[data-portfolio-public-name]");
  const bioEl = document.querySelector<HTMLElement>("[data-portfolio-public-bio]");
  const stored = readStoredPublicProfile();
  if (!stored) return;
  const name = stored.publicName?.trim();
  const bio = stored.bio?.trim();
  if (name && nameEl) nameEl.textContent = name;
  if (bio !== undefined && bioEl) bioEl.textContent = bio || "";
}
