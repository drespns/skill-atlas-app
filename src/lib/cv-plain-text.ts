/**
 * CV en texto plano para pegar en formularios web (ATS) o editores.
 * La composición sigue el orden de `cvDocumentSectionOrder` y la visibilidad del perfil.
 */

import type {
  CvProfileV1,
  CvPublicationV1,
  CvAwardV1,
  CvVolunteeringV1,
} from "@scripts/core/prefs";
import { normalizeCvDocumentSectionOrder } from "@lib/cv-document-section-order";
import { formatCvDateRange } from "@lib/cv-display-format";
import { educationBulletLines, educationProseDetails, linesToBullets } from "@lib/cv-bullets";

export type CvPlainTextLabels = {
  docExperienceHeading: string;
  docEducationHeading: string;
  docComplementaryEducationHeading: string;
  docCertificationsHeading: string;
  docLanguagesHeading: string;
  docTechnologiesHeading: string;
  docProjectsHeading: string;
  docHighlightsHeading: string;
  docPublicationsHeading: string;
  docAwardsHeading: string;
  docVolunteeringHeading: string;
  docInterestsHeading: string;
  docCoverHeading: string;
  certLink: string;
  pubLink: string;
  awardLink: string;
  projectsMoreLabel: string;
  coverWords: string;
  present: string;
  untitled: string;
};

export type CvPlainTextProjectEntry = {
  title: string;
  role: string;
  outcome: string;
  description: string;
  technologies: string[];
  includeLongDescription: boolean;
};

export type CvPlainTextProjectsPayload = {
  featured?: CvPlainTextProjectEntry;
  others: CvPlainTextProjectEntry[];
};

export type CvPlainTextTechnologyBlock = { title: string; labels: string[] };

export type CvPlainTextBuildArgs = {
  profile: CvProfileV1;
  displayName: string;
  /** Resumen tal como en el documento (summary o bio fallback). */
  resolvedSummary: string;
  contactLines: string[];
  /** Etiquetas del stack de ayuda ya resueltas. */
  helpStackLabels: string[];
  /** Proyectos seleccionados del CV (destacado + resto). */
  projectsPayload: CvPlainTextProjectsPayload | null;
  technologyLabels: string[];
  /** Si se define, sustituye la lista plana del bloque Tecnologías (subtítulos por rol). */
  technologyBlocks?: CvPlainTextTechnologyBlock[];
  labels: CvPlainTextLabels;
};

const SEP = "\n";

function heading(title: string): string {
  return `${title}${SEP}${"-".repeat(Math.min(Math.max(title.length, 4), 52))}`;
}

function showSection(vis: Record<string, boolean> | undefined, key: string): boolean {
  return (vis as Record<string, boolean> | undefined)?.[key] !== false;
}

function appendSection(out: string[], title: string, body: string): void {
  const t = body.trim();
  if (!t) return;
  out.push(`${heading(title)}${SEP}${SEP}${t}`);
}

export function buildCvPlainTextDocument(args: CvPlainTextBuildArgs): string {
  const {
    profile,
    displayName,
    resolvedSummary,
    contactLines,
    helpStackLabels,
    projectsPayload,
    technologyLabels,
    technologyBlocks,
    labels,
  } = args;
  const vis = profile.cvSectionVisibility ?? {};
  const out: string[] = [];

  const name = displayName.trim();
  if (name) out.push(name);

  const targetRole = (profile.cvTargetRole ?? "").trim();
  if (targetRole) out.push(targetRole);

  const headline = (profile.headline ?? "").trim();
  if (headline) out.push(headline);

  const arrangement = (profile.cvWorkArrangement ?? "").trim();
  const authorization = (profile.cvWorkAuthorization ?? "").trim();
  if (arrangement) out.push(arrangement);
  if (authorization) out.push(authorization);

  const contact = contactLines.map((s) => s.trim()).filter(Boolean);
  if (contact.length > 0) out.push(contact.join(` · `));

  const showSummary = showSection(vis, "summary");
  const summaryText = resolvedSummary.trim();
  if (showSummary && summaryText) out.push("", summaryText);

  const showHelp = profile.showHelpStack !== false && helpStackLabels.length > 0;
  if (showHelp) out.push("", helpStackLabels.join(", "));

  if (out.length > 0 && out[out.length - 1] !== "") out.push("");
  const headerTail = out.join(SEP).trimEnd();
  const sections: string[] = [];
  if (headerTail) sections.push(headerTail);

  const order = normalizeCvDocumentSectionOrder(profile.cvDocumentSectionOrder);

  const expMode = profile.cvDateDisplayExperience === "year" ? "year" : "full";
  const eduMode = profile.cvDateDisplayEducation === "year" ? "year" : "full";
  const volMode = profile.cvDateDisplayExperience === "year" ? "year" : "full";
  const showLangLevel = profile.cvShowLanguageLevel !== false;
  const showProjDesc = profile.cvShowProjectDescriptions !== false;

  for (const id of order) {
    switch (id) {
      case "experience": {
        if (!showSection(vis, "experience")) break;
        const exp = Array.isArray(profile.experiences) ? profile.experiences : [];
        if (exp.length === 0) break;
        const lines: string[] = [];
        const expShowLoc = profile.cvShowExperienceLocation !== false;
        for (const x of exp) {
          const company = (x.company ?? "").trim();
          const role = (x.role ?? "").trim();
          const loc = (x.location ?? "").trim();
          const when = formatCvDateRange((x.start ?? "").trim(), (x.end ?? "").trim(), expMode);
          const bullets = linesToBullets(x.bullets ?? "");
          const titleLine = [role, company].filter(Boolean).join(" — ") || labels.untitled;
          const meta = [when, expShowLoc && loc ? loc : ""].filter(Boolean).join(" · ");
          lines.push(meta ? `${titleLine}${SEP}${meta}` : titleLine);
          for (const b of bullets) lines.push(`- ${b}`);
          lines.push("");
        }
        appendSection(sections, labels.docExperienceHeading, lines.join(SEP).trimEnd());
        break;
      }
      case "education": {
        if (!showSection(vis, "education")) break;
        const edu = Array.isArray(profile.education) ? profile.education : [];
        if (edu.length === 0) break;
        const eduShowLoc = profile.cvShowEducationLocation !== false;
        const eduShowDetails = profile.cvShowEducationDetails !== false;
        const lines: string[] = [];
        for (const x of edu) {
          const school = (x.school ?? "").trim();
          const degree = (x.degree ?? "").trim();
          const loc = (x.location ?? "").trim();
          const when = formatCvDateRange((x.start ?? "").trim(), (x.end ?? "").trim(), eduMode);
          const head = degree || school || labels.untitled;
          lines.push(head);
          const subParts = [school && school !== degree ? school : "", eduShowLoc && loc ? loc : ""].filter(Boolean);
          if (subParts.length > 0) lines.push(subParts.join(" · "));
          if (when) lines.push(when);
          if (eduShowDetails) {
            for (const b of educationBulletLines(x)) lines.push(`- ${b}`);
            const prose = educationProseDetails(x);
            if (prose) {
              for (const ln of prose.split(/\r?\n/)) {
                const t = ln.trim();
                if (t) lines.push(t);
              }
            }
          }
          lines.push("");
        }
        appendSection(sections, labels.docEducationHeading, lines.join(SEP).trimEnd());
        break;
      }
      case "complementaryEducation": {
        if (!showSection(vis, "complementaryEducation")) break;
        const edu = Array.isArray(profile.complementaryEducation) ? profile.complementaryEducation : [];
        if (edu.length === 0) break;
        const eduShowLoc = profile.cvShowEducationLocation !== false;
        const eduShowDetails = profile.cvShowEducationDetails !== false;
        const lines: string[] = [];
        for (const x of edu) {
          const school = (x.school ?? "").trim();
          const degree = (x.degree ?? "").trim();
          const loc = (x.location ?? "").trim();
          const when = formatCvDateRange((x.start ?? "").trim(), (x.end ?? "").trim(), eduMode);
          const head = degree || school || labels.untitled;
          lines.push(head);
          const subParts = [school && school !== degree ? school : "", eduShowLoc && loc ? loc : ""].filter(Boolean);
          if (subParts.length > 0) lines.push(subParts.join(" · "));
          if (when) lines.push(when);
          if (eduShowDetails) {
            for (const b of educationBulletLines(x)) lines.push(`- ${b}`);
            const prose = educationProseDetails(x);
            if (prose) {
              for (const ln of prose.split(/\r?\n/)) {
                const t = ln.trim();
                if (t) lines.push(t);
              }
            }
          }
          lines.push("");
        }
        appendSection(sections, labels.docComplementaryEducationHeading, lines.join(SEP).trimEnd());
        break;
      }
      case "certifications": {
        if (!showSection(vis, "certifications")) break;
        const certs = Array.isArray(profile.certifications) ? profile.certifications : [];
        if (certs.length === 0) break;
        const lines: string[] = [];
        for (const c of certs) {
          const name = (c.name ?? "").trim();
          const issuer = (c.issuer ?? "").trim();
          const year = (c.year ?? "").trim();
          const url = (c.url ?? "").trim();
          const title = name || issuer || labels.untitled;
          const sub = [issuer, year].filter(Boolean).join(" · ");
          let s = sub ? `${title}${SEP}${sub}` : title;
          if (url) s += `${SEP}${labels.certLink}: ${url}`;
          lines.push(s, "");
        }
        appendSection(sections, labels.docCertificationsHeading, lines.join(SEP).trimEnd());
        break;
      }
      case "languages": {
        if (!showSection(vis, "languages")) break;
        const langs = Array.isArray(profile.languages) ? profile.languages : [];
        if (langs.length === 0) break;
        const lines: string[] = [];
        for (const l of langs) {
          const n = (l.name ?? "").trim();
          const level = (l.level ?? "").trim();
          const line = showLangLevel ? [n, level].filter(Boolean).join(" — ") : n || level;
          if (line) lines.push(line);
        }
        appendSection(sections, labels.docLanguagesHeading, lines.join(SEP));
        break;
      }
      case "technologies": {
        if (!showSection(vis, "technologies")) break;
        const blocks = technologyBlocks?.filter((b) => (b.labels ?? []).length > 0) ?? [];
        if (blocks.length > 0) {
          const parts: string[] = [];
          for (const b of blocks) {
            const sub = (b.title ?? "").trim();
            const labs = (b.labels ?? []).map((x) => x.trim()).filter(Boolean);
            if (labs.length === 0) continue;
            const line = labs.join(", ");
            parts.push(sub ? `${sub}${SEP}${line}` : line);
          }
          if (parts.length > 0) appendSection(sections, labels.docTechnologiesHeading, parts.join(`${SEP}${SEP}`));
          break;
        }
        if (technologyLabels.length === 0) break;
        appendSection(sections, labels.docTechnologiesHeading, technologyLabels.join(", "));
        break;
      }
      case "projects": {
        if (!showSection(vis, "projects")) break;
        if (!projectsPayload) break;
        const { featured, others } = projectsPayload;
        if (!featured && others.length === 0) break;
        const lines: string[] = [];
        const fmtEntry = (p: CvPlainTextProjectEntry, detailed: boolean) => {
          const meta = [p.role, p.outcome].filter(Boolean).join(" · ");
          lines.push(detailed ? p.title : `- ${p.title}${meta ? ` — ${meta}` : ""}`);
          if (detailed && meta) lines.push(meta);
          if (detailed && showProjDesc && p.description.trim()) lines.push(p.description.trim());
          if (p.technologies.length > 0) lines.push(p.technologies.join(", "));
          lines.push("");
        };
        if (featured) fmtEntry(featured, true);
        if (others.length > 0) {
          if (featured) lines.push(labels.projectsMoreLabel, "");
          for (const p of others) fmtEntry(p, false);
        }
        appendSection(sections, labels.docProjectsHeading, lines.join(SEP).trimEnd());
        break;
      }
      case "highlights": {
        if (!showSection(vis, "highlights")) break;
        const raw = linesToBullets(profile.highlights ?? "");
        if (raw.length === 0) break;
        appendSection(sections, labels.docHighlightsHeading, raw.map((s) => `- ${s}`).join(SEP));
        break;
      }
      case "publications": {
        if (!showSection(vis, "publications")) break;
        const pubs = Array.isArray(profile.publications) ? profile.publications : [];
        if (pubs.length === 0) break;
        const lines = pubs.map((p: CvPublicationV1) => {
          const title = (p.title ?? "").trim();
          const venue = (p.venue ?? "").trim();
          const year = (p.year ?? "").trim();
          const url = (p.url ?? "").trim();
          const head = title || venue || labels.untitled;
          const sub = [venue && venue !== title ? venue : "", year].filter(Boolean).join(" · ");
          return sub ? `${head}${SEP}${sub}${url ? `${SEP}${labels.pubLink}: ${url}` : ""}` : `${head}${url ? `${SEP}${labels.pubLink}: ${url}` : ""}`;
        });
        appendSection(sections, labels.docPublicationsHeading, lines.join(SEP + SEP));
        break;
      }
      case "awards": {
        if (!showSection(vis, "awards")) break;
        const aw = Array.isArray(profile.awards) ? profile.awards : [];
        if (aw.length === 0) break;
        const lines: string[] = [];
        for (const a of aw) {
          const title = (a.title ?? "").trim();
          const issuer = (a.issuer ?? "").trim();
          const year = (a.year ?? "").trim();
          const detail = (a.detail ?? "").trim();
          const url = (a.url ?? "").trim();
          const head = title || issuer || labels.untitled;
          const sub = [issuer && issuer !== title ? issuer : "", year].filter(Boolean).join(" · ");
          let s = sub ? `${head}${SEP}${sub}` : head;
          if (detail) s += `${SEP}${detail}`;
          if (url) s += `${SEP}${labels.awardLink}: ${url}`;
          lines.push(s, "");
        }
        appendSection(sections, labels.docAwardsHeading, lines.join(SEP).trimEnd());
        break;
      }
      case "volunteering": {
        if (!showSection(vis, "volunteering")) break;
        const vol = Array.isArray(profile.volunteering) ? profile.volunteering : [];
        if (vol.length === 0) break;
        const lines: string[] = [];
        for (const x of vol) {
          const organization = (x.organization ?? "").trim();
          const role = (x.role ?? "").trim();
          const when = formatCvDateRange((x.start ?? "").trim(), (x.end ?? "").trim(), volMode);
          const headline = organization || role || labels.untitled;
          const subHead = organization && role ? role : "";
          if (subHead) {
            lines.push(headline, subHead);
            if (when) lines.push(when);
          } else lines.push(when ? `${headline}${SEP}${when}` : headline);
          for (const b of linesToBullets(x.bullets ?? "")) lines.push(`- ${b}`);
          lines.push("");
        }
        appendSection(sections, labels.docVolunteeringHeading, lines.join(SEP).trimEnd());
        break;
      }
      case "interests": {
        if (!showSection(vis, "interests")) break;
        const raw = linesToBullets(profile.cvInterests ?? "");
        if (raw.length === 0) break;
        appendSection(sections, labels.docInterestsHeading, raw.map((s) => `- ${s}`).join(SEP));
        break;
      }
      case "coverLetters": {
        if (!showSection(vis, "coverLetters")) break;
        const letters = Array.isArray(profile.coverLetters) ? profile.coverLetters : [];
        const nonEmpty = letters.filter((c) => String(c.body ?? "").trim());
        if (nonEmpty.length === 0) break;
        const lines: string[] = [];
        for (const c of nonEmpty) {
          const t0 = (c.title ?? "").trim() || labels.untitled;
          const body = (c.body ?? "").trim();
          const wc = body ? body.split(/\s+/).filter(Boolean).length : 0;
          lines.push(t0, body, `${wc} ${labels.coverWords}`, "");
        }
        appendSection(sections, labels.docCoverHeading, lines.join(SEP).trimEnd());
        break;
      }
      default:
        break;
    }
  }

  return sections.filter(Boolean).join(SEP + SEP).replace(/\n{3,}/g, "\n\n").trim();
}
