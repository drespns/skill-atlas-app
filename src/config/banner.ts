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
  id: "v0.50.0",
  version: "0.50.0",
  text: "v0.50.0 · CV público, QA/OG, onboarding avanzado, prep y estudio.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};

