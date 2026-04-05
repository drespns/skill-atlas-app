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
  id: "v0.60.0",
  version: "0.60.0",
  text: "v0.60.0 · Ajustes estilo GitHub: barra lateral, sección única, animaciones y prefs; retirado tablero GridStack.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};

