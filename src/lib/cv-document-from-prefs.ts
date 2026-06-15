import type { ProjectRow } from "@lib/cv-document-render";
import type { AppPrefsV1, CvDocumentSlotV1, CvProfileV1 } from "@scripts/core/prefs";
import { migrateCvDocumentsIntoPrefs } from "@scripts/core/prefs";

export type CvSlotDocumentState = {
  cvProfile: CvProfileV1;
  selectedOrder: string[];
  cvActiveDocumentId: string;
};

function buildCvDisplayOrder(saved: string[] | undefined, slugs: string[]): string[] {
  const allowed = new Set(slugs);
  const seen = new Set<string>();
  const out: string[] = [];
  if (saved) {
    for (const s of saved) {
      if (allowed.has(s) && !seen.has(s)) {
        out.push(s);
        seen.add(s);
      }
    }
  }
  for (const s of slugs) {
    if (!seen.has(s)) {
      out.push(s);
      seen.add(s);
    }
  }
  return out;
}

function hydrateCvProfileFromSlot(
  slot: CvDocumentSlotV1 | undefined,
  avatarSignedUrl: string | null,
  linkedinAvatar: string | null,
): CvProfileV1 {
  const cvProfile: CvProfileV1 = {
    showHelpStack: true,
    showPhoto: true,
    experiences: [],
    education: [],
    complementaryEducation: [],
    certifications: [],
    languages: [],
    publications: [],
    awards: [],
    volunteering: [],
    cvInterests: "",
    cvTargetRole: "",
    cvWorkArrangement: "",
    cvWorkAuthorization: "",
    socialLinkDisplay: "both",
    cvTemplate: "classic",
    cvSectionVisibility: {},
    cvPrintMaxPages: 3,
    cvTechnologiesMode: "fromCvProjects",
    cvTechnologiesLayout: "chips",
    cvShowLanguageLevel: true,
    ...(slot?.cvProfile ?? {}),
  };
  if (!cvProfile.photoSource) {
    cvProfile.photoSource = avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider";
  }
  return cvProfile;
}

/**
 * Snapshot del slot de CV activo y del orden de proyectos del PDF, alineado con `cv-page.ts`
 * (`hydrateCvProfileFromActiveSlot` + `applySelectionFromPrefs`).
 */
export function readCvSlotDocumentStateFromPrefs(
  prefsRaw: AppPrefsV1,
  projects: ProjectRow[],
  avatarSignedUrl: string | null,
  linkedinAvatar: string | null,
): CvSlotDocumentState {
  const prefs = migrateCvDocumentsIntoPrefs(prefsRaw);
  const cvDocuments: CvDocumentSlotV1[] = (prefs.cvDocuments ?? []).map((d) => ({
    ...d,
    cvProfile: JSON.parse(JSON.stringify(d.cvProfile)) as CvProfileV1,
  }));
  const cvActiveDocumentId = prefs.cvActiveDocumentId ?? cvDocuments[0]?.id ?? "";
  const activeSlot = cvDocuments.find((d) => d.id === cvActiveDocumentId) ?? cvDocuments[0];
  const defaultOrder = projects.map((p) => p.slug);
  const cvProfile = hydrateCvProfileFromSlot(activeSlot, avatarSignedUrl, linkedinAvatar);
  const displayOrder = buildCvDisplayOrder(activeSlot?.cvProjectDisplayOrder, defaultOrder);
  const selectedSlugs = new Set<string>();
  const raw = activeSlot?.cvProjectSlugs;
  if (raw === undefined) {
    for (const s of defaultOrder) selectedSlugs.add(s);
  } else {
    const allowed = new Set(defaultOrder);
    for (const s of raw) {
      if (allowed.has(s)) selectedSlugs.add(s);
    }
  }
  const selectedOrder = displayOrder.filter((s) => selectedSlugs.has(s));
  return { cvProfile, selectedOrder, cvActiveDocumentId };
}
