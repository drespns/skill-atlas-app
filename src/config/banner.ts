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
  id: "v0.110.0",
  version: "0.110.0",
  text:
    "v0.110.0 · Import GitHub (stack + ponderación), multiselect tecnologías, mejoras Command Palette, CV (plantillas/print) y fixes de navegación.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};
