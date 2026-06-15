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
  id: "v0.150.0",
  version: "0.150.0",
  text:
    "v0.150.0 · Hub /tools con favoritos (prefs, cabecera, Ctrl+K), i18n del hub; base para más utilidades dev y pulido herramienta a herramienta.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};
