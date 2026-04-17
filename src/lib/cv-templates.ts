import type { CvTemplateIdV1 } from "@scripts/core/prefs";

export const CV_TEMPLATE_IDS: CvTemplateIdV1[] = [
  "classic",
  "minimal",
  "modern",
  "compact",
  "mono",
  "sidebar",
  "serif",
  "atlas",
  "contrast",
  "focus",
];

export function isCvTemplateId(raw: string): raw is CvTemplateIdV1 {
  return (CV_TEMPLATE_IDS as readonly string[]).includes(raw);
}

export function normalizeCvTemplateId(raw: string | undefined | null, fallback: CvTemplateIdV1 = "classic"): CvTemplateIdV1 {
  const t = String(raw ?? "").trim();
  return isCvTemplateId(t) ? t : fallback;
}

/** Clase CSS en el host del documento (`cv-template-*`). */
export function cvTemplateClassName(id: CvTemplateIdV1): string {
  return `cv-template-${id}`;
}

export const CV_TEMPLATE_BODY_CLASSES = CV_TEMPLATE_IDS.map((id) => `cv-template-${id}`);
