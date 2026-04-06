/** Orden de bloques del documento CV (Experiencia, Educación, …). */

export const CV_DOCUMENT_SECTION_IDS = [
  "experience",
  "education",
  "certifications",
  "languages",
  "projects",
  "highlights",
] as const;

export type CvDocumentSectionId = (typeof CV_DOCUMENT_SECTION_IDS)[number];

const DEFAULT_ORDER = [...CV_DOCUMENT_SECTION_IDS];

export function normalizeCvDocumentSectionOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ORDER];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    if (!CV_DOCUMENT_SECTION_IDS.includes(x as CvDocumentSectionId)) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function isDefaultCvDocumentSectionOrder(order: string[]): boolean {
  return order.length === DEFAULT_ORDER.length && order.every((id, i) => id === DEFAULT_ORDER[i]);
}

/**
 * Reordena nodos hijos del contenedor que tengan `data-cv-section` según `order`.
 */
export function applyCvDocumentSectionOrder(container: HTMLElement | null, order: string[] | undefined): void {
  if (!container) return;
  const normalized = normalizeCvDocumentSectionOrder(order);
  const byId = new Map<string, HTMLElement>();
  container.querySelectorAll<HTMLElement>("[data-cv-section]").forEach((el) => {
    const id = el.dataset.cvSection?.trim();
    if (id) byId.set(id, el);
  });
  for (const id of normalized) {
    const el = byId.get(id);
    if (el) container.appendChild(el);
  }
}
