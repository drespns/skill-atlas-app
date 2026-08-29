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
  id: "finanzas-inplace-2026",
  version: "finanzas",
  text:
    "SkillAtlas se centra en finanzas personales: gastos, suscripciones, patrimonio e inversiones. El portfolio/CV queda aparcado (rutas antiguas siguen vivas).",
  href: "/tools/expense-tracker",
  hrefLabel: "Abrir cuaderno",
  tone: "info",
};
