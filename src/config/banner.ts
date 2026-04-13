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
  id: "v0.130.0",
  version: "0.130.0",
  text:
    "v0.130.0 · Estudio (espacios, chat+citas, temario, sync cuenta), hub /tools ampliado, CV (import/ATS), admin stats, tech npm/PyPI y jerarquía.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};
