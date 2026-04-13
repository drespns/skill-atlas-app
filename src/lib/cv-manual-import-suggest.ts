import type { CvManualAssignment } from "./cv-manual-import-map";
import { normalizeManualAssignments } from "./cv-manual-import-map";
import {
  extractLooseCvHeaderFields,
  extractUrlsForCvSlots,
  filterFalsePositiveExperienceRows,
  mergeLanguagesSplitFromCertificationsSection,
  normalizeCvPasteForHeuristics,
  parseCertificationsFromPaste,
  parseEducationBlocksFromPaste,
  parseExperienceBlocksFromPaste,
  parseLanguagesFromPaste,
  preprocessCvPasteForImport,
  splitCvPasteBySections,
} from "./cv-paste-import";

function overlaps(a: CvManualAssignment, b: CvManualAssignment): boolean {
  return a.start < b.end && b.start < a.end;
}

function overlapsAny(a: CvManualAssignment, list: CvManualAssignment[]): boolean {
  return list.some((x) => overlaps(a, x));
}

/** Localiza needle en source (índices sobre el texto del textarea). */
export function findAssignmentSpan(source: string, needle: string): { start: number; end: number } | null {
  const n = needle.trim();
  if (n.length < 2) return null;
  let i = source.indexOf(n);
  if (i >= 0) return { start: i, end: i + n.length };
  const compact = n.replace(/\s+/g, " ").trim();
  if (compact.length >= 2) {
    i = source.indexOf(compact);
    if (i >= 0) return { start: i, end: i + compact.length };
  }
  if (n.length > 20) {
    const head = n.slice(0, 20);
    i = source.indexOf(head);
    if (i >= 0) return { start: i, end: Math.min(i + n.length, source.length) };
  }
  return null;
}

export function mergeSuggestedAssignments(
  sourceText: string,
  existing: CvManualAssignment[],
  suggested: CvManualAssignment[],
): CvManualAssignment[] {
  const ex = normalizeManualAssignments(sourceText, existing);
  const su = normalizeManualAssignments(sourceText, suggested);
  const merged = [...ex];
  for (const s of su) {
    if (!overlapsAny(s, merged)) merged.push(s);
  }
  merged.sort((a, b) => a.start - b.start || a.end - b.end);
  return merged;
}

/**
 * Propone asignaciones usando las mismas heurísticas que el import automático,
 * buscando cada fragmento en el texto original para obtener [start,end).
 */
export function suggestManualAssignmentsFromPaste(sourceRaw: string): CvManualAssignment[] {
  const source = sourceRaw;
  const out: CvManualAssignment[] = [];
  const push = (target: string, needle: string) => {
    const sp = findAssignmentSpan(source, needle);
    if (!sp) return;
    const a: CvManualAssignment = { ...sp, target };
    if (overlapsAny(a, out)) return;
    out.push(a);
  };

  const norm = normalizeCvPasteForHeuristics(preprocessCvPasteForImport(sourceRaw));
  const hints = extractLooseCvHeaderFields(norm);
  if (hints.email) push("email", hints.email);
  if (hints.phoneMobile) push("phoneMobile", hints.phoneMobile);
  if (hints.headline) push("headline", hints.headline);
  if (hints.summary) push("summary", hints.summary);

  const urlSlots = extractUrlsForCvSlots(sourceRaw);
  for (let i = 0; i < urlSlots.length; i++) {
    const u = urlSlots[i]?.trim();
    if (u) push(`link:${i}`, u);
  }

  const split = mergeLanguagesSplitFromCertificationsSection(splitCvPasteBySections(norm));
  const expText = split.sawExperienceHeader ? (split.experience.trim() || norm) : norm;
  let expRows = parseExperienceBlocksFromPaste(expText);
  if (!split.sawExperienceHeader || !split.experience.trim()) {
    expRows = filterFalsePositiveExperienceRows(expRows);
  }
  expRows.slice(0, 4).forEach((row, idx) => {
    if (row.role?.trim()) push(`exp:new:${idx}:role`, row.role.trim());
    if (row.company?.trim()) push(`exp:new:${idx}:company`, row.company.trim());
    if (row.location?.trim()) push(`exp:new:${idx}:location`, row.location.trim());
    const dateJoined = [row.start, row.end].filter((x) => (x ?? "").trim()).join(" – ");
    if (dateJoined.trim()) {
      const sp =
        (row.start?.trim() ? findAssignmentSpan(source, row.start.trim()) : null) ??
        findAssignmentSpan(source, dateJoined.trim());
      if (sp) {
        const a: CvManualAssignment = { ...sp, target: `exp:new:${idx}:start` };
        if (!overlapsAny(a, out)) out.push(a);
      }
    }
    if (row.end?.trim() && row.start?.trim() !== row.end?.trim()) {
      push(`exp:new:${idx}:end`, row.end.trim());
    }
    if (row.bullets?.trim()) push(`exp:new:${idx}:bullets`, row.bullets.trim());
  });

  const eduText = split.sawEducationHeader ? split.education.trim() : "";
  if (eduText) {
    const eduRows = parseEducationBlocksFromPaste(eduText);
    eduRows.slice(0, 4).forEach((row, idx) => {
      if (row.degree?.trim()) push(`edu:new:${idx}:degree`, row.degree.trim());
      if (row.school?.trim()) push(`edu:new:${idx}:school`, row.school.trim());
      if (row.location?.trim()) push(`edu:new:${idx}:location`, row.location.trim());
      const dj = [row.start, row.end].filter((x) => (x ?? "").trim()).join(" – ");
      if (dj.trim()) {
        const sp =
          (row.start?.trim() ? findAssignmentSpan(source, row.start.trim()) : null) ??
          findAssignmentSpan(source, dj.trim());
        if (sp) {
          const a: CvManualAssignment = { ...sp, target: `edu:new:${idx}:start` };
          if (!overlapsAny(a, out)) out.push(a);
        }
      }
      if (row.end?.trim() && row.start?.trim() !== row.end?.trim()) {
        push(`edu:new:${idx}:end`, row.end.trim());
      }
      if (row.details?.trim()) push(`edu:new:${idx}:details`, row.details.trim());
    });
  }

  if (split.sawCertificationsHeader && split.certifications.trim()) {
    const certs = parseCertificationsFromPaste(split.certifications.trim());
    certs.slice(0, 4).forEach((c, idx) => {
      if (c.name?.trim()) push(`cert:new:${idx}:name`, c.name.trim());
    });
  }

  if (split.sawLanguagesHeader && split.languages.trim()) {
    const langs = parseLanguagesFromPaste(split.languages.trim());
    langs.slice(0, 4).forEach((l, idx) => {
      const line = l.level ? `${l.name} — ${l.level}` : (l.name ?? "");
      if (line.trim()) push(`lang:new:${idx}:line`, line.trim());
    });
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}
