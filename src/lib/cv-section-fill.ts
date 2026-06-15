/**
 * Detecta si una sección del documento CV tiene contenido real (además de estar visible en ajustes).
 * Alineado con la lógica de `renderDocument` en cv-page / public-cv-by-token.
 */

import { linesToBullets } from "@lib/cv-bullets";
import type { CvDocumentSectionId } from "@lib/cv-document-section-order";

export type CvSectionFillProfile = {
  cvSectionVisibility?: Record<string, boolean>;
  experiences?: unknown[];
  education?: unknown[];
  complementaryEducation?: unknown[];
  certifications?: unknown[];
  languages?: { name?: string; level?: string }[];
  publications?: unknown[];
  awards?: unknown[];
  volunteering?: unknown[];
  highlights?: string;
  cvInterests?: string;
  coverLetters?: { body?: string }[];
};

const visOn = (vis: Record<string, boolean> | undefined, key: string) => (vis?.[key] ?? true) !== false;

export function isCvDocumentSectionFilled(
  sectionId: CvDocumentSectionId,
  profile: CvSectionFillProfile,
  opts: { selectedProjectCount: number; technologyGroupCount: number },
): boolean {
  const v = profile.cvSectionVisibility ?? {};
  switch (sectionId) {
    case "experience":
      return visOn(v, "experience") && Array.isArray(profile.experiences) && profile.experiences.length > 0;
    case "education":
      return visOn(v, "education") && Array.isArray(profile.education) && profile.education.length > 0;
    case "complementaryEducation":
      return (
        visOn(v, "complementaryEducation") &&
        Array.isArray(profile.complementaryEducation) &&
        profile.complementaryEducation.length > 0
      );
    case "certifications":
      return visOn(v, "certifications") && Array.isArray(profile.certifications) && profile.certifications.length > 0;
    case "languages": {
      if (!visOn(v, "languages") || !Array.isArray(profile.languages)) return false;
      return profile.languages.some((l) => {
        const name = (l?.name ?? "").trim();
        const level = (l?.level ?? "").trim();
        return Boolean(name || level);
      });
    }
    case "technologies":
      return visOn(v, "technologies") && opts.technologyGroupCount > 0;
    case "projects":
      return visOn(v, "projects") && opts.selectedProjectCount > 0;
    case "highlights":
      return visOn(v, "highlights") && linesToBullets(profile.highlights ?? "").length > 0;
    case "publications":
      return visOn(v, "publications") && Array.isArray(profile.publications) && profile.publications.length > 0;
    case "awards":
      return visOn(v, "awards") && Array.isArray(profile.awards) && profile.awards.length > 0;
    case "volunteering":
      return visOn(v, "volunteering") && Array.isArray(profile.volunteering) && profile.volunteering.length > 0;
    case "interests":
      return visOn(v, "interests") && linesToBullets(profile.cvInterests ?? "").length > 0;
    case "coverLetters": {
      if (!visOn(v, "coverLetters") || !Array.isArray(profile.coverLetters)) return false;
      return profile.coverLetters.some((c) => (c?.body ?? "").trim().length > 0);
    }
    default:
      return false;
  }
}

export function countFilledCvDocumentSections(
  profile: CvSectionFillProfile,
  opts: { selectedProjectCount: number; technologyGroupCount: number },
): number {
  const ids: CvDocumentSectionId[] = [
    "experience",
    "education",
    "complementaryEducation",
    "certifications",
    "languages",
    "technologies",
    "projects",
    "highlights",
    "publications",
    "awards",
    "volunteering",
    "interests",
    "coverLetters",
  ];
  return ids.filter((id) => isCvDocumentSectionFilled(id, profile, opts)).length;
}
