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
  id: "v0.20.3",
  version: "0.20.3",
  text: "v0.20.3 · Fix scripts en prod/dev: bundle Astro (sin ?url, sin .ts por URL).",
  href: "/demo",
  hrefLabel: "Ver demo",
  tone: "info",
};

