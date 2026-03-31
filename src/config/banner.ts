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
  id: "v0.20.0",
  version: "0.20.0",
  text: "v0.20.0 · Landing + demo pública. App privada (invites only) con banner global y guard de rutas.",
  href: "/demo",
  hrefLabel: "Ver demo",
  tone: "info",
};

