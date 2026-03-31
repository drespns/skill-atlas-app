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
  id: "v0.45.0",
  version: "0.45.0",
  text: "v0.45.0 · Portfolio público por slug (/portfolio/…), CV privado, despliegue Vercel y pulido del header.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};

