/**
 * Metadatos por defecto (SEO / Open Graph). Las páginas pueden sobrescribir vía `AppShell`.
 */
export const SITE_NAME = "Finanzas";

export const SITE_DEFAULT_DESCRIPTION =
  "Cuaderno de gastos, suscripciones, patrimonio e inversiones. Datos en el navegador; copia opcional cifrada en tu cuenta.";

/** Ruta bajo `public/` (ideal 1200×630; SVG válido para muchos compartidos). */
export const SITE_DEFAULT_OG_IMAGE = "/og/og-default.svg";

/** twitter:card */
export const SITE_TWITTER_CARD = "summary_large_image" as const;
