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
  id: "v0.140.0",
  version: "0.140.0",
  text:
    "v0.140.0 · Landing (métricas ECharts, herramientas, FAQ), retirada /demo y /prep, CV (tabs, gastos/plantillas), expense tracker + XLSX, shell y prefs.",
  href: "https://github.com/drespns/skill-atlas-app",
  hrefLabel: "Repositorio",
  tone: "info",
};
