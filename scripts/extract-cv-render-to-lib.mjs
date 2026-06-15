/**
 * One-off style maintainer script: extracts `const renderDocument = () => { ... };` from cv-page.ts
 * and writes src/lib/cv-document-render.ts with renderCvDocument(refs, input).
 * Run: node scripts/extract-cv-render-to-lib.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cvPage = path.join(root, "src", "scripts", "cv", "cv-page.ts");
const s = fs.readFileSync(cvPage, "utf8");
const start = s.indexOf("  const renderDocument = () => {");
const end = s.indexOf("\n\n  const sectionRailLabel", start);
if (start < 0 || end < 0) throw new Error("markers not found");
let body = s.slice(start + "  const renderDocument = () => {".length, end).trimEnd();
body = body.replace(/\n  \};[\s\n]*$/, "\n");

const renames = [
  ["docName", "refs.docName"],
  ["docEl", "refs.docEl"],
  ["docTargetRole", "refs.docTargetRole"],
  ["docHeadline", "refs.docHeadline"],
  ["docWorkPrefs", "refs.docWorkPrefs"],
  ["docContact", "refs.docContact"],
  ["docBio", "refs.docBio"],
  ["docHelpStack", "refs.docHelpStack"],
  ["docProjectsSection", "refs.docProjectsSection"],
  ["docProjects", "refs.docProjects"],
  ["docHighlightsSection", "refs.docHighlightsSection"],
  ["docHighlights", "refs.docHighlights"],
  ["docPhoto", "refs.docPhoto"],
  ["docExperienceSection", "refs.docExperienceSection"],
  ["docExperience", "refs.docExperience"],
  ["docEducationSection", "refs.docEducationSection"],
  ["docEducation", "refs.docEducation"],
  ["docComplEducationSection", "refs.docComplEducationSection"],
  ["docComplEducation", "refs.docComplEducation"],
  ["docCertSection", "refs.docCertSection"],
  ["docCert", "refs.docCert"],
  ["docLangSection", "refs.docLangSection"],
  ["docLang", "refs.docLang"],
  ["docTechnologiesSection", "refs.docTechnologiesSection"],
  ["docTechnologies", "refs.docTechnologies"],
  ["docTechFeaturedBand", "refs.docTechFeaturedBand"],
  ["docTechFeaturedBandTech", "refs.docTechFeaturedBandTech"],
  ["docTechFeaturedBandProject", "refs.docTechFeaturedBandProject"],
  ["docPublicationsSection", "refs.docPublicationsSection"],
  ["docPublications", "refs.docPublications"],
  ["docAwardsSection", "refs.docAwardsSection"],
  ["docAwards", "refs.docAwards"],
  ["docVolunteeringSection", "refs.docVolunteeringSection"],
  ["docVolunteering", "refs.docVolunteering"],
  ["docInterestsSection", "refs.docInterestsSection"],
  ["docInterests", "refs.docInterests"],
  ["docCoverSection", "refs.docCoverSection"],
  ["docCoverLetters", "refs.docCoverLetters"],
  ["docSectionsHost", "refs.docSectionsHost"],
];
for (const [from, to] of renames) {
  const re = new RegExp(`(?<!refs\\.)\\b${from}\\b`, "g");
  body = body.replace(re, to);
}
body = body.replace(/\bgetResolvedTechnologyGroups\(\)/g, "getResolvedTechnologyGroups(input)");

const header = `import { getHelpStackItem, HELP_STACK_ITEMS } from "@config/help-stack";
import { buildCvSocialChipsHtml, type CvSocialLinkDisplay } from "@lib/cv-contact-html";
import { applyCvDocumentSectionOrder } from "@lib/cv-document-section-order";
import { educationBulletLines, educationProseDetails, linesToBullets } from "@lib/cv-bullets";
import { formatCvDateRange } from "@lib/cv-display-format";
import { clampCvPrintMaxPages, cvPrintTypographicScale } from "@lib/cv-print-scale";
import { countFilledCvDocumentSections } from "@lib/cv-section-fill";
import { CV_TEMPLATE_BODY_CLASSES, normalizeCvTemplateId } from "@lib/cv-templates";
import type { CvProfileV1 } from "@scripts/core/prefs";

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  role: string | null;
  outcome: string | null;
};

type CvTechKind = "technology" | "framework" | "library" | "package" | "other";

function normalizeTechKind(raw: unknown): CvTechKind {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "technology" || s === "framework" || s === "library" || s === "package") return s;
  return "other";
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\\/\\//i.test(t)) return t;
  return \`https://\${t}\`;
}

function normalizeEmail(raw: string): string {
  return raw.trim();
}

function isProbablyEmail(s: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s.trim());
}

function cvTelHref(raw: string): string {
  const d = raw.replace(/[^\\d+]/g, "");
  if (!d) return "#";
  if (d.startsWith("00")) return \`tel:+\${d.slice(2)}\`;
  if (d.startsWith("+")) return \`tel:\${d}\`;
  return \`tel:\${d}\`;
}

export type CvDocumentDomRefs = {
  docEl: HTMLElement;
  docSectionsHost: HTMLElement | null;
  docName: HTMLElement | null;
  docTargetRole: HTMLElement | null;
  docHeadline: HTMLElement | null;
  docWorkPrefs: HTMLElement | null;
  docContact: HTMLElement | null;
  docBio: HTMLElement;
  docHelpStack: HTMLElement | null;
  docProjectsSection: HTMLElement | null;
  docProjects: HTMLElement;
  docHighlightsSection: HTMLElement | null;
  docHighlights: HTMLElement | null;
  docPhoto: HTMLImageElement | null;
  docExperienceSection: HTMLElement | null;
  docExperience: HTMLElement | null;
  docEducationSection: HTMLElement | null;
  docEducation: HTMLElement | null;
  docComplEducationSection: HTMLElement | null;
  docComplEducation: HTMLElement | null;
  docCertSection: HTMLElement | null;
  docCert: HTMLElement | null;
  docLangSection: HTMLElement | null;
  docLang: HTMLElement | null;
  docTechnologiesSection: HTMLElement | null;
  docTechnologies: HTMLElement | null;
  docTechFeaturedBand: HTMLElement | null;
  docTechFeaturedBandTech: HTMLElement | null;
  docTechFeaturedBandProject: HTMLElement | null;
  docPublicationsSection: HTMLElement | null;
  docPublications: HTMLElement | null;
  docAwardsSection: HTMLElement | null;
  docAwards: HTMLElement | null;
  docVolunteeringSection: HTMLElement | null;
  docVolunteering: HTMLElement | null;
  docInterestsSection: HTMLElement | null;
  docInterests: HTMLUListElement | null;
  docCoverSection: HTMLElement | null;
  docCoverLetters: HTMLElement | null;
};

export type CvDocumentRenderInput = {
  cvProfile: CvProfileV1;
  displayName: string;
  bio: string;
  helpStackKeys: string[];
  projects: ProjectRow[];
  selectedOrder: string[];
  projectIdBySlug: Map<string, string>;
  techsByProject: Map<string, string[]>;
  techIdsByProject: Map<string, string[]>;
  techName: Map<string, string>;
  techKind: Map<string, CvTechKind>;
  avatarSignedUrl: string | null;
  linkedinAvatar: string | null;
  githubAvatar: string | null;
  tt: (key: string, fallback: string) => string;
  esc: (s: string) => string;
  getCvLinkSlots: () => string[];
  slotLabels: () => string[];
};

export function getResolvedTechnologyEntries(input: CvDocumentRenderInput): Array<{ label: string; kind: CvTechKind }> {
  const { cvProfile, selectedOrder, projectIdBySlug, techIdsByProject, techName, techKind, helpStackKeys, tt } = input;
  const mode = cvProfile.cvTechnologiesMode ?? "fromCvProjects";
  if (mode === "roleGroups") {
    const groups = Array.isArray(cvProfile.cvTechnologyRoleGroups) ? cvProfile.cvTechnologyRoleGroups : [];
    const rows = new Map<string, { label: string; kind: CvTechKind }>();
    for (const g of groups) {
      for (const tid of g.technologyIds ?? []) {
        const label = techName.get(tid);
        if (!label?.trim()) continue;
        if (!rows.has(tid)) rows.set(tid, { label: label.trim(), kind: techKind.get(tid) ?? "other" });
      }
    }
    return Array.from(rows.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }
  if (mode === "helpStack") {
    const allowed = new Set(HELP_STACK_ITEMS.map((i) => i.key));
    const uniq = Array.from(new Set(helpStackKeys)).filter((k) => allowed.has(k));
    return uniq
      .map((k) => ({ label: getHelpStackItem(k)?.label ?? k, kind: "technology" as const }))
      .filter((x) => Boolean(x.label))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }
  if (mode === "fromCvProjects") {
    const rows = new Map<string, { label: string; kind: CvTechKind }>();
    for (const slug of selectedOrder) {
      const pid = projectIdBySlug.get(slug);
      if (!pid) continue;
      for (const tid of techIdsByProject.get(pid) ?? []) {
        const label = techName.get(tid);
        if (!label) continue;
        if (!rows.has(tid)) rows.set(tid, { label, kind: techKind.get(tid) ?? "other" });
      }
    }
    return Array.from(rows.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }
  const chosenIds = Array.isArray(cvProfile.cvTechnologyIds) ? cvProfile.cvTechnologyIds : [];
  const out = new Map<string, { label: string; kind: CvTechKind }>();
  for (const id of chosenIds) {
    const label = techName.get(id);
    if (!label?.trim()) continue;
    if (!out.has(id)) out.set(id, { label, kind: techKind.get(id) ?? "other" });
  }
  return Array.from(out.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function techKindLabel(kind: CvTechKind, tt: (k: string, f: string) => string): string {
  if (kind === "technology") return tt("cv.techKindTechnology", "Tecnologías");
  if (kind === "framework") return tt("cv.techKindFramework", "Frameworks");
  if (kind === "library") return tt("cv.techKindLibrary", "Librerías");
  if (kind === "package") return tt("cv.techKindPackage", "Paquetes");
  return tt("cv.techKindOther", "Otros");
}

export function getResolvedTechnologyGroups(input: CvDocumentRenderInput): Array<{ kind: CvTechKind; title: string; labels: string[] }> {
  const { cvProfile, tt, techName } = input;
  const mode = cvProfile.cvTechnologiesMode ?? "fromCvProjects";
  if (mode === "roleGroups") {
    const groups = Array.isArray(cvProfile.cvTechnologyRoleGroups) ? cvProfile.cvTechnologyRoleGroups : [];
    const out: Array<{ kind: CvTechKind; title: string; labels: string[] }> = [];
    const fallback = tt("cv.techRoleGroupUntitled", "Stack");
    for (const g of groups) {
      const title = (g.title ?? "").trim() || fallback;
      const labels: string[] = [];
      for (const tid of g.technologyIds ?? []) {
        const lab = techName.get(tid)?.trim();
        if (!lab) continue;
        if (!labels.includes(lab)) labels.push(lab);
      }
      if (labels.length === 0) continue;
      labels.sort((a, b) => a.localeCompare(b, "es"));
      out.push({ kind: "other", title, labels });
    }
    return out;
  }
  const order: CvTechKind[] = ["technology", "framework", "library", "package", "other"];
  const grouped = new Map<CvTechKind, string[]>();
  for (const row of getResolvedTechnologyEntries(input)) {
    const k = row.kind ?? "other";
    const list = grouped.get(k) ?? [];
    if (!list.includes(row.label)) list.push(row.label);
    grouped.set(k, list);
  }
  const out: Array<{ kind: CvTechKind; title: string; labels: string[] }> = [];
  for (const k of order) {
    const labels = (grouped.get(k) ?? []).sort((a, b) => a.localeCompare(b, "es"));
    if (labels.length === 0) continue;
    out.push({ kind: k, title: techKindLabel(k, tt), labels });
  }
  return out;
}

export function resolveCvDocumentDomRefs(host: ParentNode): CvDocumentDomRefs | null {
  const wrap = host.querySelector("[data-cv-doc-host]") ?? host;
  const docEl = wrap.querySelector<HTMLElement>("[data-cv-document]");
  const docBio = wrap.querySelector<HTMLElement>("[data-cv-doc-bio]");
  const docProjects = wrap.querySelector<HTMLElement>("[data-cv-doc-projects]");
  if (!docEl || !docBio || !docProjects) return null;
  return {
    docEl,
    docSectionsHost: wrap.querySelector("[data-cv-doc-sections]"),
    docName: wrap.querySelector("[data-cv-doc-name]"),
    docTargetRole: wrap.querySelector("[data-cv-doc-target-role]"),
    docHeadline: wrap.querySelector("[data-cv-doc-headline]"),
    docWorkPrefs: wrap.querySelector("[data-cv-doc-work-prefs]"),
    docContact: wrap.querySelector("[data-cv-doc-contact]"),
    docBio,
    docHelpStack: wrap.querySelector("[data-cv-doc-helpstack]"),
    docProjectsSection: wrap.querySelector("[data-cv-doc-projects-section]"),
    docProjects,
    docHighlightsSection: wrap.querySelector("[data-cv-doc-highlights-section]"),
    docHighlights: wrap.querySelector("[data-cv-doc-highlights]"),
    docPhoto: wrap.querySelector<HTMLImageElement>("[data-cv-doc-photo]"),
    docExperienceSection: wrap.querySelector("[data-cv-doc-experience-section]"),
    docExperience: wrap.querySelector("[data-cv-doc-experience]"),
    docEducationSection: wrap.querySelector("[data-cv-doc-education-section]"),
    docEducation: wrap.querySelector("[data-cv-doc-education]"),
    docComplEducationSection: wrap.querySelector("[data-cv-doc-complementary-education-section]"),
    docComplEducation: wrap.querySelector("[data-cv-doc-complementary-education]"),
    docCertSection: wrap.querySelector("[data-cv-doc-certifications-section]"),
    docCert: wrap.querySelector("[data-cv-doc-certifications]"),
    docLangSection: wrap.querySelector("[data-cv-doc-languages-section]"),
    docLang: wrap.querySelector("[data-cv-doc-languages]"),
    docTechnologiesSection: wrap.querySelector("[data-cv-doc-technologies-section]"),
    docTechnologies: wrap.querySelector("[data-cv-doc-technologies]"),
    docTechFeaturedBand: wrap.querySelector("[data-cv-doc-tech-featured-band]"),
    docTechFeaturedBandTech: wrap.querySelector("[data-cv-doc-tech-featured-band-tech]"),
    docTechFeaturedBandProject: wrap.querySelector("[data-cv-doc-tech-featured-band-project]"),
    docPublicationsSection: wrap.querySelector("[data-cv-doc-publications-section]"),
    docPublications: wrap.querySelector("[data-cv-doc-publications]"),
    docAwardsSection: wrap.querySelector("[data-cv-doc-awards-section]"),
    docAwards: wrap.querySelector("[data-cv-doc-awards]"),
    docVolunteeringSection: wrap.querySelector("[data-cv-doc-volunteering-section]"),
    docVolunteering: wrap.querySelector("[data-cv-doc-volunteering]"),
    docInterestsSection: wrap.querySelector("[data-cv-doc-interests-section]"),
    docInterests: wrap.querySelector<HTMLUListElement>("[data-cv-doc-interests]"),
    docCoverSection: wrap.querySelector("[data-cv-doc-cover-section]"),
    docCoverLetters: wrap.querySelector("[data-cv-doc-cover-letters]"),
  };
}

export function renderCvDocument(refs: CvDocumentDomRefs, input: CvDocumentRenderInput): void {
  const {
    cvProfile,
    displayName,
    bio,
    helpStackKeys,
    projects,
    selectedOrder,
    projectIdBySlug,
    techsByProject,
    techIdsByProject,
    techName,
    techKind,
    avatarSignedUrl,
    linkedinAvatar,
    githubAvatar,
    tt,
    esc,
    getCvLinkSlots,
    slotLabels,
  } = input;

`;

const footer = `
}

`;

const out = header + "\n" + body + "\n" + footer;
const outPath = path.join(root, "src", "lib", "cv-document-render.ts");
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath, "bytes", out.length);
