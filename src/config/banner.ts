export type GlobalBanner = {
  id: string;
  version: string;
  text: string;
  href?: string;
  hrefLabel?: string;
  tone?: "neutral" | "info" | "warning";
};

// Banner global (sticky) para versión/noticias.
export const GLOBAL_BANNER: GlobalBanner = {
  id: "v0.30.0",
  version: "0.30.0",
  text: "v0.30.0 · Ajustes: grid 2D + sync prefs. View Transitions + Prefetch. Avatar de portfolio.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};

