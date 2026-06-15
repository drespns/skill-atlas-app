import { getHelpStackItem, HELP_STACK_ITEMS } from "@config/help-stack";
import {
  buildCvSocialChipsHtml,
  CV_LINK_SLOT_ICON_PATHS,
  normalizeCvUrl,
  type CvSocialLinkDisplay,
} from "@lib/cv-contact-html";
import { applyCvDocumentSectionOrder } from "@lib/cv-document-section-order";
import { educationBulletLines, educationProseDetails, linesToBullets } from "@lib/cv-bullets";
import { clampCvPrintMaxPages, cvPrintTypographicScale } from "@lib/cv-print-scale";
import { countFilledCvDocumentSections } from "@lib/cv-section-fill";
import { CV_TEMPLATE_BODY_CLASSES, normalizeCvTemplateId } from "@lib/cv-templates";
import { applyCvStudioCanvasLayoutToDocument } from "@lib/cv-studio-layout";
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

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function normalizeEmail(raw: string): string {
  return raw.trim();
}

function isProbablyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function cvTelHref(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  if (!d) return "#";
  if (d.startsWith("00")) return `tel:+${d.slice(2)}`;
  if (d.startsWith("+")) return `tel:${d}`;
  return `tel:${d}`;
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
  /**
   * `plain`: enlaces y contacto como texto editable (lienzo Canva); `anchors`: `<a href>` (preview /cv).
   * @default "anchors"
   */
  contactChipsMode?: "anchors" | "plain";
};

function buildPlainHeroContactChips(opts: {
  location: string;
  showLoc: boolean;
  email: string;
  phoneMobile: string;
  phoneLandline: string;
  slots: string[];
  slotLabels: string[];
  display: CvSocialLinkDisplay;
  esc: (s: string) => string;
}): string[] {
  const { location, showLoc, email, phoneMobile, phoneLandline, slots, slotLabels, display, esc } = opts;
  const chips: string[] = [];
  if (location && showLoc) {
    chips.push(
      `<span class="inline-flex items-center gap-1"><span class="text-gray-400 cv-hero-loc-icon" aria-hidden="true">📍</span> <span data-cv-canva-entity="contact" data-cv-canva-field="location" data-cv-canva-idx="0" class="cv-canva-cell">${esc(location)}</span></span>`,
    );
  }
  if (email && isProbablyEmail(email)) {
    chips.push(
      `<span class="inline-flex items-center gap-1"><span class="text-gray-400" aria-hidden="true">✉</span><span data-cv-canva-entity="contact" data-cv-canva-field="email" data-cv-canva-idx="0" class="cv-canva-cell">${esc(email)}</span></span>`,
    );
  }
  if (phoneMobile) {
    chips.push(
      `<span class="inline-flex items-center gap-1"><span class="text-gray-400" aria-hidden="true">☎</span><span data-cv-canva-entity="contact" data-cv-canva-field="phoneMobile" data-cv-canva-idx="0" class="cv-canva-cell">${esc(phoneMobile)}</span></span>`,
    );
  }
  if (phoneLandline) {
    chips.push(
      `<span class="inline-flex items-center gap-1"><span class="text-gray-400" aria-hidden="true">☎</span><span data-cv-canva-entity="contact" data-cv-canva-field="phoneLandline" data-cv-canva-idx="0" class="cv-canva-cell">${esc(phoneLandline)}</span></span>`,
    );
  }
  const n = Math.min(slots.length, CV_LINK_SLOT_ICON_PATHS.length);
  for (let i = 0; i < n; i++) {
    const url = normalizeCvUrl(slots[i] ?? "");
    if (!url) continue;
    const label = (slotLabels[i] || "").trim();
    const iconPath = CV_LINK_SLOT_ICON_PATHS[i] ?? "/icons/link-external.svg";
    const showIcon = display === "icon" || display === "both";
    const iconHtml = showIcon
      ? `<img src="${esc(iconPath)}" alt="" class="cv-social-slot-icon h-4 w-4 shrink-0 opacity-90" width="16" height="16" loading="lazy" decoding="async" />`
      : "";
    const labHtml =
      display === "both" || display === "url"
        ? `<span class="ms-1 text-xs font-medium text-gray-400 dark:text-gray-500">${esc(label || `Link ${i + 1}`)}</span>`
        : "";
    chips.push(
      `<span class="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border border-transparent px-0.5 py-0.5 hover:border-gray-200/80 dark:hover:border-gray-700">${iconHtml}<span data-cv-canva-entity="linkSlots" data-cv-canva-field="url" data-cv-canva-idx="${i}" class="cv-canva-cell min-w-0 break-all text-left">${esc(url)}</span>${labHtml}</span>`,
    );
  }
  return chips;
}

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
    contactChipsMode = "anchors",
  } = input;



    if (refs.docName) refs.docName.textContent = displayName;
    const headline = (cvProfile.headline ?? "").trim();
    const location = (cvProfile.location ?? "").trim();
    const email = normalizeEmail((cvProfile.email ?? "").trim());
    const phoneMobile = (cvProfile.phoneMobile ?? "").trim();
    const phoneLandline = (cvProfile.phoneLandline ?? "").trim();
    const summary = (cvProfile.summary ?? "").trim();
    const showHelp = cvProfile.showHelpStack ?? true;
    const vis = cvProfile.cvSectionVisibility ?? {};
    const showBlock = (key: string) => (vis as Record<string, boolean>)[key] !== false;

    if (refs.docEl) {
      refs.docEl.classList.remove(...CV_TEMPLATE_BODY_CLASSES);
      const tpl = normalizeCvTemplateId(cvProfile.cvTemplate);
      refs.docEl.classList.add(`cv-template-${tpl}`);
    }

    const targetRoleDoc = (cvProfile.cvTargetRole ?? "").trim();
    if (refs.docTargetRole) {
      refs.docTargetRole.textContent = targetRoleDoc;
      refs.docTargetRole.classList.toggle("hidden", !targetRoleDoc);
    }

    if (refs.docHeadline) {
      refs.docHeadline.textContent = headline;
      refs.docHeadline.classList.toggle("hidden", !headline);
    }

    const waDoc = (cvProfile.cvWorkArrangement ?? "").trim();
    const wbDoc = (cvProfile.cvWorkAuthorization ?? "").trim();
    if (refs.docWorkPrefs) {
      const parts: string[] = [];
      if (waDoc) {
        parts.push(
          `<p class="m-0 whitespace-pre-line text-sm leading-snug text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="workPrefs" data-cv-canva-field="cvWorkArrangement" data-cv-canva-idx="0" class="cv-canva-cell">${esc(waDoc)}</span></p>`,
        );
      }
      if (wbDoc) {
        parts.push(
          `<p class="m-0 mt-2 whitespace-pre-line text-sm leading-snug text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="workPrefs" data-cv-canva-field="cvWorkAuthorization" data-cv-canva-idx="0" class="cv-canva-cell">${esc(wbDoc)}</span></p>`,
        );
      }
      refs.docWorkPrefs.innerHTML = parts.join("");
      refs.docWorkPrefs.classList.toggle("hidden", parts.length === 0);
    }

    if (refs.docContact) {
      const chips: string[] = [];
      const showLoc = cvProfile.cvShowContactLocation !== false;
      const slots = getCvLinkSlots();
      const mode = (cvProfile.socialLinkDisplay ?? "both") as CvSocialLinkDisplay;
      if (contactChipsMode === "plain") {
        chips.push(
          ...buildPlainHeroContactChips({
            location,
            showLoc,
            email,
            phoneMobile,
            phoneLandline,
            slots,
            slotLabels: slotLabels(),
            display: mode,
            esc,
          }),
        );
      } else {
        if (location && showLoc) {
          chips.push(
            `<span class="inline-flex items-center gap-1"><span class="text-gray-400">📍</span> <span data-cv-canva-entity="contact" data-cv-canva-field="location" data-cv-canva-idx="0" class="cv-canva-cell">${esc(location)}</span></span>`,
          );
        }
        if (email && isProbablyEmail(email)) {
          chips.push(`<a class="no-underline hover:underline" href="mailto:${esc(email)}">${esc(email)}</a>`);
        }
        if (phoneMobile) {
          chips.push(`<a class="no-underline hover:underline" href="${esc(cvTelHref(phoneMobile))}">${esc(phoneMobile)}</a>`);
        }
        if (phoneLandline) {
          chips.push(`<a class="no-underline hover:underline" href="${esc(cvTelHref(phoneLandline))}">${esc(phoneLandline)}</a>`);
        }
        chips.push(...buildCvSocialChipsHtml({ slots, slotLabels: slotLabels(), display: mode, esc }));
      }
      refs.docContact.innerHTML = chips.length > 0 ? chips.join(`<span class="text-gray-300 dark:text-gray-700">•</span>`) : "";
      refs.docContact.classList.toggle("hidden", chips.length === 0);
    }

    const finalSummary = summary || bio || tt("cv.noBio", "");
    refs.docBio.textContent = finalSummary;
    const showSummary = showBlock("summary");
    refs.docBio.classList.toggle("hidden", !finalSummary || !showSummary);

    if (refs.docHelpStack) {
      const allowed = new Set(HELP_STACK_ITEMS.map((i) => i.key));
      const uniq = Array.from(new Set(helpStackKeys)).filter((k) => allowed.has(k));
      const visible = showHelp && uniq.length > 0;
      refs.docHelpStack.classList.toggle("hidden", !visible);
      refs.docHelpStack.classList.toggle("flex", visible);
      if (visible) {
        refs.docHelpStack.innerHTML = uniq
          .map((k) => {
            const it = getHelpStackItem(k);
            if (!it) return "";
            return `<span class="inline-flex items-center gap-1 rounded-md border border-gray-200/70 dark:border-gray-800/80 bg-gray-50/80 dark:bg-gray-900/50 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 print:text-[9px]">
              <img src="${esc(it.icon)}" alt="" class="h-3 w-3 opacity-80" loading="lazy" decoding="async" />
              ${esc(it.label)}
            </span>`;
          })
          .join("");
      } else {
        refs.docHelpStack.innerHTML = "";
      }
    }

    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    const chosen = selectedOrder.map((s) => bySlug.get(s)).filter(Boolean) as ProjectRow[];
    const techGroupsResolved = getResolvedTechnologyGroups(input);

    if (refs.docEl) {
      const maxP = clampCvPrintMaxPages(cvProfile.cvPrintMaxPages);
      const densityFilled = countFilledCvDocumentSections(cvProfile, {
        selectedProjectCount: chosen.length,
        technologyGroupCount: techGroupsResolved.length,
      });
      refs.docEl.style.setProperty("--cv-print-scale", String(cvPrintTypographicScale(maxP, { densityFilledSections: densityFilled })));
      refs.docEl.dataset.cvPrintMaxPages = String(maxP);
    }

    const featSlug = (cvProfile.cvFeaturedProjectSlug ?? "").trim();
    const featured = featSlug ? chosen.find((p) => p.slug === featSlug) : undefined;
    const others = featured ? chosen.filter((p) => p.slug !== featSlug) : chosen;
    const useTechFeaturedBand =
      cvProfile.cvPrintTechFeaturedBand === true &&
      Boolean(featured) &&
      showBlock("technologies") &&
      showBlock("projects") &&
      techGroupsResolved.length > 0;

    const projectFullHtml = (p: ProjectRow) => {
      const pid = projectIdBySlug.get(p.slug);
      const techLabels = pid ? (techsByProject.get(pid) ?? []).sort((a, b) => a.localeCompare(b, "es")) : [];
      const techHtml =
        techLabels.length > 0
          ? `<p class="m-0 mt-2 flex flex-wrap gap-1.5">${techLabels
              .map(
                (n) =>
                  `<span class="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">${esc(n)}</span>`,
              )
              .join("")}</p>`
          : "";
      const role = (p.role ?? "").trim();
      const outcome = (p.outcome ?? "").trim();
      const meta =
        role || outcome
          ? `<p class="m-0 mt-2 text-sm text-gray-600 dark:text-gray-400"><span class="font-semibold text-gray-800 dark:text-gray-200">${esc(role || "—")}</span>${role && outcome ? " · " : ""}${esc(outcome)}</p>`
          : "";
      const descOn = cvProfile.cvShowProjectDescriptions !== false;
      const descHtml =
        descOn && (p.description ?? "").trim()
          ? `<p class="m-0 mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">${esc((p.description ?? "").trim())}</p>`
          : "";
      return `<section class="cv-doc-project">
            <h4 class="m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">${esc(p.title)}</h4>
            ${meta}
            ${descHtml}
            ${techHtml}
          </section>`;
    };

    const projectCompactLi = (p: ProjectRow) => {
      const role = (p.role ?? "").trim();
      const one = role ? ` — ${esc(role)}` : "";
      return `<li class="text-sm text-gray-800 dark:text-gray-200"><span class="font-semibold">${esc(p.title)}</span>${one}</li>`;
    };

    if (refs.docProjectsSection) {
      refs.docProjectsSection.classList.toggle("hidden", chosen.length === 0 || !showBlock("projects"));
    }
    if (chosen.length === 0) {
      refs.docProjects.innerHTML = `<p class="m-0 text-sm text-gray-500 dark:text-gray-400">${esc(tt("cv.noProjectsSelected", "No hay proyectos seleccionados."))}</p>`;
    } else if (featured) {
      const restUl =
        others.length > 0
          ? `<p class="m-0 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(
              tt("cv.projectsMoreLabel", "También"),
            )}</p><ul class="m-0 mt-1 space-y-0.5 pl-5 list-disc text-gray-700 dark:text-gray-300">${others.map(projectCompactLi).join("")}</ul>`
          : "";
      refs.docProjects.innerHTML = useTechFeaturedBand ? restUl : `${projectFullHtml(featured)}${restUl}`;
    } else {
      refs.docProjects.innerHTML = `<ul class="m-0 space-y-0.5 pl-5 list-disc text-gray-700 dark:text-gray-300">${chosen.map(projectCompactLi).join("")}</ul>`;
    }

    // Highlights (experience / achievements)
    const lines = linesToBullets(cvProfile.highlights ?? "");
    if (refs.docHighlightsSection && refs.docHighlights) {
      const show = lines.length > 0 && showBlock("highlights");
      refs.docHighlightsSection.classList.toggle("hidden", !show);
      refs.docHighlights.innerHTML = show
        ? lines
            .map(
              (s, i) =>
                `<li><span data-cv-canva-entity="highlights" data-cv-canva-field="line" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(s)}</span></li>`,
            )
            .join("")
        : "";
      if (show) refs.docHighlights.setAttribute("data-cv-canva-bullets-root", "highlights");
      else refs.docHighlights.removeAttribute("data-cv-canva-bullets-root");
    }

    // Photo (prefer uploaded; else LinkedIn; else provider)
    if (refs.docPhoto) {
      const source = cvProfile.photoSource ?? (avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider");
      const url =
        source === "uploaded"
          ? avatarSignedUrl
          : source === "linkedin"
            ? linkedinAvatar
            : githubAvatar ?? linkedinAvatar;
      const show = Boolean(cvProfile.showPhoto ?? true) && Boolean(url);
      refs.docPhoto.classList.toggle("hidden", !show);
      if (show && url) refs.docPhoto.src = url;
      else refs.docPhoto.removeAttribute("src");
    }

    // Experience
    if (refs.docExperienceSection && refs.docExperience) {
      const exp = Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [];
      const show = exp.length > 0 && showBlock("experience");
      refs.docExperienceSection.classList.toggle("hidden", !show);
      const expShowLoc = cvProfile.cvShowExperienceLocation !== false;
      refs.docExperience.innerHTML = show
        ? exp
            .map((x, i) => {
              const company = (x.company ?? "").trim();
              const role = (x.role ?? "").trim();
              const loc = (x.location ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const primaryExpField: "role" | "company" = role.trim() ? "role" : "company";
              const primaryExpText = role.trim() ? role : company.trim() ? company : tt("cv.untitled", "—");
              const bullets = linesToBullets(x.bullets ?? "");
              const bulletsHtml =
                bullets.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300" data-cv-canva-bullets-root="experiences" data-cv-canva-idx="${i}">${bullets
                      .map(
                        (b, bi) =>
                          `<li><span data-cv-canva-entity="experiences" data-cv-canva-field="bullet" data-cv-canva-idx="${i}" data-cv-canva-sub="${bi}" class="cv-canva-cell">${esc(b)}</span></li>`,
                      )
                      .join("")}</ul>`
                  : "";
              const locBit =
                expShowLoc && loc
                  ? ` · <span data-cv-canva-entity="experiences" data-cv-canva-field="location" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(loc)}</span>`
                  : "";
              const locOnlyRowExp =
                expShowLoc && loc
                  ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="experiences" data-cv-canva-field="location" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(loc)}</span></p>`
                  : "";
              const companyRow = role.trim()
                ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="experiences" data-cv-canva-field="company" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(company)}</span>${locBit}</p>`
                : locOnlyRowExp;
              return `<section class="cv-doc-project">
                <div class="cv-doc-entry-head cv-doc-entry-head--row flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="experiences" data-cv-canva-field="${primaryExpField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(primaryExpText)}</span></p>
                    ${companyRow}
                  </div>
                  <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400 flex flex-wrap items-center justify-end gap-0.5"><span data-cv-canva-entity="experiences" data-cv-canva-field="start" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(start)}</span><span aria-hidden="true">–</span><span data-cv-canva-entity="experiences" data-cv-canva-field="end" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(end)}</span></p>
                </div>
                ${bulletsHtml}
              </section>`;
            })
            .join("")
        : "";
    }

    // Education
    if (refs.docEducationSection && refs.docEducation) {
      const edu = Array.isArray(cvProfile.education) ? cvProfile.education : [];
      const show = edu.length > 0 && showBlock("education");
      refs.docEducationSection.classList.toggle("hidden", !show);
      const eduShowLoc = cvProfile.cvShowEducationLocation !== false;
      const eduShowDetails = cvProfile.cvShowEducationDetails !== false;
      refs.docEducation.innerHTML = show
        ? edu
            .map((x, i) => {
              const school = (x.school ?? "").trim();
              const degree = (x.degree ?? "").trim();
              const loc = (x.location ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const primaryEduField: "degree" | "school" = degree.trim() ? "degree" : "school";
              const primaryEduText = degree.trim() ? degree : school.trim() ? school : tt("cv.untitled", "—");
              const listItems = educationBulletLines(x);
              const prose = educationProseDetails(x);
              const bulletsUl =
                eduShowDetails && listItems.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300" data-cv-canva-bullets-root="education" data-cv-canva-idx="${i}">${listItems
                      .map(
                        (b, bi) =>
                          `<li><span data-cv-canva-entity="education" data-cv-canva-field="bullet" data-cv-canva-idx="${i}" data-cv-canva-sub="${bi}" class="cv-canva-cell">${esc(b)}</span></li>`,
                      )
                      .join("")}</ul>`
                  : "";
              const proseHtml =
                eduShowDetails && prose
                  ? `<p class="mt-2 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300"><span data-cv-canva-entity="education" data-cv-canva-field="details" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(prose)}</span></p>`
                  : "";
              const detailsHtml = eduShowDetails && (listItems.length > 0 || prose) ? `${bulletsUl}${proseHtml}` : "";
              const locBit =
                eduShowLoc && loc
                  ? ` · <span data-cv-canva-entity="education" data-cv-canva-field="location" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(loc)}</span>`
                  : "";
              const locOnlyRow =
                eduShowLoc && loc
                  ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="education" data-cv-canva-field="location" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(loc)}</span></p>`
                  : "";
              const schoolRow = degree.trim()
                ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="education" data-cv-canva-field="school" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(school)}</span>${locBit}</p>`
                : locOnlyRow;
              return `<section class="cv-doc-project">
                <div class="cv-doc-entry-head cv-doc-entry-head--row flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="education" data-cv-canva-field="${primaryEduField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(primaryEduText)}</span></p>
                    ${schoolRow}
                  </div>
                  <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400 flex flex-wrap items-center justify-end gap-0.5"><span data-cv-canva-entity="education" data-cv-canva-field="start" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(start)}</span><span aria-hidden="true">–</span><span data-cv-canva-entity="education" data-cv-canva-field="end" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(end)}</span></p>
                </div>
                ${detailsHtml}
              </section>`;
            })
            .join("")
        : "";
    }

    // Complementary education (bootcamps, MOOCs)
    if (refs.docComplEducationSection && refs.docComplEducation) {
      const edu = Array.isArray(cvProfile.complementaryEducation) ? cvProfile.complementaryEducation : [];
      const show = edu.length > 0 && showBlock("complementaryEducation");
      refs.docComplEducationSection.classList.toggle("hidden", !show);
      const eduShowLoc = cvProfile.cvShowEducationLocation !== false;
      const eduShowDetails = cvProfile.cvShowEducationDetails !== false;
      refs.docComplEducation.innerHTML = show
        ? edu
            .map((x, i) => {
              const school = (x.school ?? "").trim();
              const degree = (x.degree ?? "").trim();
              const loc = (x.location ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const primaryComplField: "degree" | "school" = degree.trim() ? "degree" : "school";
              const primaryComplText = degree.trim() ? degree : school.trim() ? school : tt("cv.untitled", "—");
              const listItems = educationBulletLines(x);
              const prose = educationProseDetails(x);
              const bulletsUl =
                eduShowDetails && listItems.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300" data-cv-canva-bullets-root="complementaryEducation" data-cv-canva-idx="${i}">${listItems
                      .map(
                        (b, bi) =>
                          `<li><span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="bullet" data-cv-canva-idx="${i}" data-cv-canva-sub="${bi}" class="cv-canva-cell">${esc(b)}</span></li>`,
                      )
                      .join("")}</ul>`
                  : "";
              const proseHtml =
                eduShowDetails && prose
                  ? `<p class="mt-2 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300"><span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="details" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(prose)}</span></p>`
                  : "";
              const detailsHtml = eduShowDetails && (listItems.length > 0 || prose) ? `${bulletsUl}${proseHtml}` : "";
              const locBitCompl =
                eduShowLoc && loc
                  ? ` · <span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="location" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(loc)}</span>`
                  : "";
              const locOnlyRowCompl =
                eduShowLoc && loc
                  ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="location" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(loc)}</span></p>`
                  : "";
              const schoolRowCompl = degree.trim()
                ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="school" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(school)}</span>${locBitCompl}</p>`
                : locOnlyRowCompl;
              return `<section class="cv-doc-project">
                <div class="cv-doc-entry-head cv-doc-entry-head--row flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="${primaryComplField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(primaryComplText)}</span></p>
                    ${schoolRowCompl}
                  </div>
                  <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400 flex flex-wrap items-center justify-end gap-0.5"><span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="start" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(start)}</span><span aria-hidden="true">–</span><span data-cv-canva-entity="complementaryEducation" data-cv-canva-field="end" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(end)}</span></p>
                </div>
                ${detailsHtml}
              </section>`;
            })
            .join("")
        : "";
    }

    // Certifications
    if (refs.docCertSection && refs.docCert) {
      const certs = Array.isArray(cvProfile.certifications) ? cvProfile.certifications : [];
      const show = certs.length > 0 && showBlock("certifications");
      refs.docCertSection.classList.toggle("hidden", !show);
      refs.docCert.innerHTML = show
        ? certs
            .map((c, i) => {
              const name = (c.name ?? "").trim();
              const issuer = (c.issuer ?? "").trim();
              const year = (c.year ?? "").trim();
              const url = normalizeUrl((c.url ?? "").trim());
              const title = name || issuer || tt("cv.untitled", "—");
              const primaryCertField: "name" | "issuer" = name.trim() ? "name" : "issuer";
              const primaryCertText = name.trim() ? name : issuer.trim() ? issuer : title;
              const link = url
                ? ` <a class="text-sm font-medium no-underline hover:underline" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(tt("cv.certLink", "Enlace"))}</a>`
                : "";
              const issuerBit =
                issuer.trim() && name.trim()
                  ? `<span data-cv-canva-entity="certifications" data-cv-canva-field="issuer" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(issuer)}</span>`
                  : "";
              const yearBit = year.trim()
                ? `${issuerBit ? "<span aria-hidden=\"true\"> · </span>" : ""}<span data-cv-canva-entity="certifications" data-cv-canva-field="year" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(year)}</span>`
                : "";
              const subInner = [issuerBit, yearBit].filter(Boolean).join("");
              const yearOnlyWhenIssuerPrimary =
                !name.trim() && issuer.trim() && year.trim()
                  ? `<p class="m-0 mt-1 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="certifications" data-cv-canva-field="year" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(year)}</span></p>`
                  : "";
              const subBlock =
                name.trim() && subInner
                  ? `<p class="m-0 mt-1 text-sm text-gray-600 dark:text-gray-400">${subInner}</p>`
                  : yearOnlyWhenIssuerPrimary;
              return `<section class="cv-doc-project">
                <div class="cv-doc-entry-head cv-doc-entry-head--stack">
                  <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="certifications" data-cv-canva-field="${primaryCertField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(primaryCertText)}</span></p>
                  ${subBlock}
                </div>
                ${link}
              </section>`;
            })
            .join("")
        : "";
    }

    // Languages
    if (refs.docLangSection && refs.docLang) {
      const langs = Array.isArray(cvProfile.languages) ? cvProfile.languages : [];
      const show = langs.length > 0 && showBlock("languages");
      refs.docLangSection.classList.toggle("hidden", !show);
      const showLangLevel = cvProfile.cvShowLanguageLevel !== false;
      refs.docLang.innerHTML = show
        ? `<ul class="m-0 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">${langs
            .map((l, i) => {
              const name = (l.name ?? "").trim();
              const level = (l.level ?? "").trim();
              const line = showLangLevel ? [name, level].filter(Boolean).join(" — ") : name || level;
              if (!line) return "";
              const primaryLangField: "name" | "level" = name.trim() ? "name" : "level";
              const primaryLangText = name.trim() ? name : level.trim() ? level : line;
              const levelPart =
                showLangLevel && level.trim() && name.trim()
                  ? ` — <span data-cv-canva-entity="languages" data-cv-canva-field="level" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(level)}</span>`
                  : "";
              return `<li><span data-cv-canva-entity="languages" data-cv-canva-field="${primaryLangField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(primaryLangText)}</span>${levelPart}</li>`;
            })
            .filter(Boolean)
            .join("")}</ul>`
        : "";
    }

    // Technologies / tools (SkillAtlas catalog, proyectos CV o stack de ayuda)
    if (refs.docTechnologiesSection && refs.docTechnologies) {
      const techGroups = techGroupsResolved;
      const show = techGroups.length > 0 && showBlock("technologies");
      refs.docTechnologiesSection.classList.toggle("hidden", !show);
      const layout = cvProfile.cvTechnologiesLayout === "list" ? "list" : "chips";
      if (show) {
        if (layout === "list") {
          refs.docTechnologies.innerHTML = techGroups
            .map(
              (g) =>
                `<section class="space-y-1.5">
                  <h4 class="m-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(g.title)}</h4>
                  <ul class="m-0 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">${g.labels.map((lab) => `<li>${esc(lab)}</li>`).join("")}</ul>
                </section>`,
            )
            .join("");
        } else {
          refs.docTechnologies.innerHTML = techGroups
            .map(
              (g) =>
                `<section class="space-y-1.5">
                  <h4 class="m-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(g.title)}</h4>
                  <p class="m-0 flex flex-wrap gap-1.5">${g.labels
                    .map(
                      (lab) =>
                        `<span class="inline-flex items-center rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">${esc(lab)}</span>`,
                    )
                    .join("")}</p>
                </section>`,
            )
            .join("");
        }
      } else {
        refs.docTechnologies.innerHTML = "";
      }

      if (refs.docTechFeaturedBand && refs.docTechFeaturedBandTech && refs.docTechFeaturedBandProject) {
        if (useTechFeaturedBand && show && featured) {
          const techHead = tt("cv.docTechnologiesHeading", "Tecnologías");
          const featHead = tt("cv.featuredProjectBandHeading", "Proyecto destacado");
          refs.docTechFeaturedBandTech.innerHTML = `<h3 class="m-0 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(techHead)}</h3><div class="mt-4">${refs.docTechnologies.innerHTML}</div>`;
          refs.docTechFeaturedBandProject.innerHTML = `<h3 class="m-0 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(featHead)}</h3><div class="mt-4">${projectFullHtml(featured)}</div>`;
          refs.docTechFeaturedBand.classList.remove("hidden");
          refs.docTechFeaturedBand.removeAttribute("aria-hidden");
          refs.docTechnologiesSection.classList.add("hidden");
        } else {
          refs.docTechFeaturedBand.classList.add("hidden");
          refs.docTechFeaturedBand.setAttribute("aria-hidden", "true");
          refs.docTechFeaturedBandTech.innerHTML = "";
          refs.docTechFeaturedBandProject.innerHTML = "";
        }
      }
    }

    // Publications
    if (refs.docPublicationsSection && refs.docPublications) {
      const pubs = Array.isArray(cvProfile.publications) ? cvProfile.publications : [];
      const show = pubs.length > 0 && showBlock("publications");
      refs.docPublicationsSection.classList.toggle("hidden", !show);
      refs.docPublications.innerHTML = show
        ? pubs
            .map((p, i) => {
              const title = (p.title ?? "").trim();
              const venue = (p.venue ?? "").trim();
              const year = (p.year ?? "").trim();
              const url = normalizeUrl((p.url ?? "").trim());
              const head = title || venue || tt("cv.untitled", "—");
              const primaryPubField: "title" | "venue" = title.trim() ? "title" : venue.trim() ? "venue" : "title";
              const primaryPubText = title.trim() ? title : venue.trim() ? venue : head;
              const showVenueInSub = !!(venue.trim() && venue !== title && !!title.trim());
              const subParts: string[] = [];
              if (showVenueInSub) {
                subParts.push(
                  `<span data-cv-canva-entity="publications" data-cv-canva-field="venue" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(venue)}</span>`,
                );
              }
              if (year) {
                if (showVenueInSub) subParts.push(`<span aria-hidden="true"> · </span>`);
                subParts.push(
                  `<span data-cv-canva-entity="publications" data-cv-canva-field="year" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(year)}</span>`,
                );
              }
              const subHtml = subParts.length > 0 ? `<p class="m-0 mt-1 text-sm text-gray-600 dark:text-gray-400">${subParts.join("")}</p>` : "";
              const link = url
                ? ` <a class="text-sm font-medium no-underline hover:underline" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(tt("cv.pubLink", "Enlace"))}</a>`
                : "";
              return `<section class="cv-doc-project">
                <div class="cv-doc-entry-head cv-doc-entry-head--stack">
                  <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="publications" data-cv-canva-field="${primaryPubField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(primaryPubText)}</span></p>
                  ${subHtml}
                </div>
                ${link}
              </section>`;
            })
            .join("")
        : "";
    }

    // Awards
    if (refs.docAwardsSection && refs.docAwards) {
      const aw = Array.isArray(cvProfile.awards) ? cvProfile.awards : [];
      const show = aw.length > 0 && showBlock("awards");
      refs.docAwardsSection.classList.toggle("hidden", !show);
      refs.docAwards.innerHTML = show
        ? aw
            .map((a, i) => {
              const title = (a.title ?? "").trim();
              const issuer = (a.issuer ?? "").trim();
              const year = (a.year ?? "").trim();
              const detail = (a.detail ?? "").trim();
              const url = normalizeUrl((a.url ?? "").trim());
              const head = title || issuer || tt("cv.untitled", "—");
              const primaryAwardField: "title" | "issuer" = title.trim() ? "title" : issuer.trim() ? "issuer" : "title";
              const primaryAwardText = title.trim() ? title : issuer.trim() ? issuer : head;
              const showIssuerInSub = !!(issuer.trim() && issuer !== title && !!title.trim());
              const subParts: string[] = [];
              if (showIssuerInSub) {
                subParts.push(
                  `<span data-cv-canva-entity="awards" data-cv-canva-field="issuer" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(issuer)}</span>`,
                );
              }
              if (year) {
                if (showIssuerInSub) subParts.push(`<span aria-hidden="true"> · </span>`);
                subParts.push(
                  `<span data-cv-canva-entity="awards" data-cv-canva-field="year" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(year)}</span>`,
                );
              }
              const subHtml = subParts.length > 0 ? `<p class="m-0 mt-1 text-sm text-gray-600 dark:text-gray-400">${subParts.join("")}</p>` : "";
              const link = url
                ? ` <a class="text-sm font-medium no-underline hover:underline" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(tt("cv.awardLink", "Enlace"))}</a>`
                : "";
              const detailHtml = detail
                ? `<p class="m-0 mt-2 text-sm text-gray-700 dark:text-gray-300"><span data-cv-canva-entity="awards" data-cv-canva-field="detail" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(detail)}</span></p>`
                : "";
              return `<section class="cv-doc-project">
                <div class="cv-doc-entry-head cv-doc-entry-head--stack">
                  <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="awards" data-cv-canva-field="${primaryAwardField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(primaryAwardText)}</span></p>
                  ${subHtml}
                </div>
                ${detailHtml}
                ${link}
              </section>`;
            })
            .join("")
        : "";
    }

    // Volunteering
    if (refs.docVolunteeringSection && refs.docVolunteering) {
      const vol = Array.isArray(cvProfile.volunteering) ? cvProfile.volunteering : [];
      const show = vol.length > 0 && showBlock("volunteering");
      refs.docVolunteeringSection.classList.toggle("hidden", !show);
      refs.docVolunteering.innerHTML = show
        ? vol
            .map((x, i) => {
              const organization = (x.organization ?? "").trim();
              const role = (x.role ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const bullets = linesToBullets(x.bullets ?? "");
              const bulletsHtml =
                bullets.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300" data-cv-canva-bullets-root="volunteering" data-cv-canva-idx="${i}">${bullets
                      .map(
                        (b, bi) =>
                          `<li><span data-cv-canva-entity="volunteering" data-cv-canva-field="bullet" data-cv-canva-idx="${i}" data-cv-canva-sub="${bi}" class="cv-canva-cell">${esc(b)}</span></li>`,
                      )
                      .join("")}</ul>`
                  : "";
              const headline = organization || role || tt("cv.untitled", "—");
              const subHead = organization && role ? role : "";
              const primaryField: "organization" | "role" = organization.trim() ? "organization" : "role";
              const subHeadHtml = subHead
                ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400"><span data-cv-canva-entity="volunteering" data-cv-canva-field="role" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(subHead)}</span></p>`
                : "";
              return `<section class="cv-doc-project">
                <div class="cv-doc-entry-head cv-doc-entry-head--row flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="volunteering" data-cv-canva-field="${primaryField}" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(headline)}</span></p>
                    ${subHeadHtml}
                  </div>
                  <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400 flex flex-wrap items-center justify-end gap-0.5"><span data-cv-canva-entity="volunteering" data-cv-canva-field="start" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(start)}</span><span aria-hidden="true">–</span><span data-cv-canva-entity="volunteering" data-cv-canva-field="end" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(end)}</span></p>
                </div>
                ${bulletsHtml}
              </section>`;
            })
            .join("")
        : "";
    }

    // Interests (personal)
    const interestLines = linesToBullets(cvProfile.cvInterests ?? "");
    if (refs.docInterestsSection && refs.docInterests) {
      const show = interestLines.length > 0 && showBlock("interests");
      refs.docInterestsSection.classList.toggle("hidden", !show);
      if (refs.docInterests) {
        refs.docInterests.innerHTML = show
          ? interestLines
              .map(
                (s, i) =>
                  `<li><span data-cv-canva-entity="interests" data-cv-canva-field="line" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(s)}</span></li>`,
              )
              .join("")
          : "";
        if (show) refs.docInterests.setAttribute("data-cv-canva-bullets-root", "interests");
        else refs.docInterests.removeAttribute("data-cv-canva-bullets-root");
      }
    }

    if (refs.docCoverSection && refs.docCoverLetters) {
      const letters = Array.isArray(cvProfile.coverLetters) ? cvProfile.coverLetters : [];
      const show = letters.length > 0 && showBlock("coverLetters");
      refs.docCoverSection.classList.toggle("hidden", !show);
      refs.docCoverLetters.innerHTML = show
        ? letters
            .map((c, i) => {
              const t0 = (c.title ?? "").trim() || tt("cv.coverUntitled", "Carta");
              const body = (c.body ?? "").trim();
              const wc = body ? body.split(/\s+/).filter(Boolean).length : 0;
              return `<section class="cv-doc-project">
                <h4 class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100"><span data-cv-canva-entity="coverLetters" data-cv-canva-field="title" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(t0)}</span></h4>
                <p class="m-0 mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300"><span data-cv-canva-entity="coverLetters" data-cv-canva-field="body" data-cv-canva-idx="${i}" class="cv-canva-cell">${esc(body)}</span></p>
                <p class="m-0 mt-1 text-[10px] text-gray-400">${wc} ${esc(tt("cv.coverWords", "palabras"))}</p>
              </section>`;
            })
            .join("")
        : "";
    }

    applyCvDocumentSectionOrder(refs.docSectionsHost, cvProfile.cvDocumentSectionOrder);

    if (refs.docTechnologiesSection && refs.docTechFeaturedBand) {
      refs.docTechnologiesSection.insertAdjacentElement("afterend", refs.docTechFeaturedBand);
    }

    applyCvStudioCanvasLayoutToDocument(refs.docEl, cvProfile.cvStudioCanvasLayout);

    refs.docEl?.classList.remove("hidden");
}

