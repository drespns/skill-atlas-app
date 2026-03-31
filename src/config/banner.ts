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
  id: "v0.20.1",
  version: "0.20.1",
  text: "v0.20.1 · Fix producción: scripts como módulos JS (sin MIME .ts). UI y accesos coherentes.",
  href: "/demo",
  hrefLabel: "Ver demo",
  tone: "info",
};

