/**
 * Metadatos por defecto (SEO / Open Graph). Las páginas pueden sobrescribir vía `AppShell`.
 */
export const SITE_NAME = "SkillAtlas";

export const SITE_DEFAULT_DESCRIPTION =
  "Organiza tecnologías, conceptos y proyectos; publica portfolio y CV. Tu mapa de conocimiento técnico con SkillAtlas.";

/** Ruta bajo `public/` (ideal 1200×630; SVG válido para muchos compartidos). */
export const SITE_DEFAULT_OG_IMAGE = "/og/og-default.svg";

/** twitter:card */
export const SITE_TWITTER_CARD = "summary_large_image" as const;
