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
  id: "v0.100.0",
  version: "0.100.0",
  text:
    "v0.100.0 · Shell (SEO/OG, footer con clip-path, banner), landing responsive, carrusel facetas, precios, CV/import y más desde 0.70.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};
