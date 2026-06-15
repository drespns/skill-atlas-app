import type { CvDocumentSectionId } from "@lib/cv-document-section-order";

/** Claves i18n alineadas con los `<h3>` del documento CV (`CvDocumentHost`). */
export const CV_STUDIO_SECTION_LABEL_KEYS: Record<CvDocumentSectionId, string> = {
  experience: "cv.docExperienceHeading",
  education: "cv.docEducationHeading",
  complementaryEducation: "cv.docComplementaryEducationHeading",
  certifications: "cv.docCertificationsHeading",
  languages: "cv.docLanguagesHeading",
  technologies: "cv.docTechnologiesHeading",
  projects: "cv.docProjectsHeading",
  highlights: "cv.docHighlightsHeading",
  publications: "cv.docPublicationsHeading",
  awards: "cv.docAwardsHeading",
  volunteering: "cv.docVolunteeringHeading",
  interests: "cv.docInterestsHeading",
  coverLetters: "cv.docCoverHeading",
};

export function cvStudioSectionLabel(id: CvDocumentSectionId, tt: (key: string, fallback: string) => string): string {
  const key = CV_STUDIO_SECTION_LABEL_KEYS[id];
  return key ? tt(key, id) : id;
}
