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
  id: "v0.31.0",
  version: "0.31.0",
  text: "v0.31.0 · Solicitud de acceso (invite-only): formulario público + registro en BD.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};

