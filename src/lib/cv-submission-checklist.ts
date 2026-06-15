/**
 * Checklist opcional por **slot de CV** (plantilla de envío / recordatorio).
 * No altera `cvSectionVisibility`: solo ayuda a revisar qué incluir antes de enviar.
 */

export const CV_SUBMISSION_CHECKLIST_KEYS = [
  "targetRole",
  "summary",
  "experience",
  "projects",
  "education",
  "complementaryEducation",
  "technologies",
  "certifications",
] as const;

export type CvSubmissionChecklistKey = (typeof CV_SUBMISSION_CHECKLIST_KEYS)[number];

export type CvSubmissionChecklistV1 = Partial<Record<CvSubmissionChecklistKey, boolean>>;

export function normalizeCvSubmissionChecklist(raw: unknown): CvSubmissionChecklistV1 | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o: CvSubmissionChecklistV1 = {};
  for (const k of CV_SUBMISSION_CHECKLIST_KEYS) {
    if (typeof (raw as Record<string, unknown>)[k] === "boolean") {
      o[k] = (raw as Record<string, boolean>)[k];
    }
  }
  return Object.keys(o).length > 0 ? o : undefined;
}
