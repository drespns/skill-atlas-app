import type {
  CvCertificationV1,
  CvEducationV1,
  CvExperienceV1,
  CvLanguageV1,
  CvProfileV1,
} from "@scripts/core/prefs";
import { CV_LINK_SLOT_COUNT } from "@lib/cv-contact-html";
import { parseLanguagesFromPaste } from "@lib/cv-paste-import";

export type CvManualAssignment = {
  start: number;
  end: number;
  target: string;
  /** Si se define, sustituye el trozo `text.slice(start,end)` al aplicar (texto editado en el panel). */
  valueOverride?: string;
};

const EXP_FIELDS = new Set(["role", "company", "location", "start", "end", "bullets"]);
const EDU_FIELDS = new Set(["degree", "school", "location", "start", "end", "details"]);

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ManualImportSidebarSectionId =
  | "profile"
  | "links"
  | "experience"
  | "education"
  | "certifications"
  | "languages"
  | "other";

export const MANUAL_IMPORT_SIDEBAR_SECTION_ORDER: ManualImportSidebarSectionId[] = [
  "profile",
  "links",
  "experience",
  "education",
  "certifications",
  "languages",
  "other",
];

export function manualImportSidebarSection(target: string): ManualImportSidebarSectionId {
  const t = target.trim();
  if (t === "headline" || t === "summary" || t === "email" || t === "phoneMobile" || t === "phoneLandline") {
    return "profile";
  }
  if (/^link:\d+$/.test(t)) return "links";
  if (t.startsWith("exp:")) return "experience";
  if (t.startsWith("edu:")) return "education";
  if (t.startsWith("cert:")) return "certifications";
  if (t.startsWith("lang:")) return "languages";
  return "other";
}

/** `exist:0` / `new:1` para agrupar filas en el panel lateral; null si no aplica. */
export function manualImportExpEduSubgroupKey(target: string): string | null {
  const m = target.trim().match(/^(exp|edu):(exist|new):(\d+):/);
  if (!m) return null;
  return `${m[2]}:${m[3]}`;
}

/** Índice 0-based de fila para el sidebar: fusiona `exist` y `new` en un solo bloque por posición. */
export function manualImportExperienceRowIndexKey(target: string): string | null {
  const m = target.trim().match(/^exp:(exist|new):(\d+):/);
  return m ? m[2]! : null;
}

export function manualImportEducationRowIndexKey(target: string): string | null {
  const m = target.trim().match(/^edu:(exist|new):(\d+):/);
  return m ? m[2]! : null;
}

/** Clases Tailwind para <mark> (fondo semitransparente). Experiencia/educación: tono por campo + aro según fila exist/new. */
export function manualTargetMarkClass(target: string): string {
  const t = target.trim();
  const ti = "text-inherit";
  if (t === "headline") return `bg-violet-400/42 dark:bg-violet-500/34 ${ti}`;
  if (t === "summary") return `bg-amber-400/42 dark:bg-amber-500/34 ${ti}`;
  if (t === "email") return `bg-sky-400/42 dark:bg-sky-500/34 ${ti}`;
  if (t === "phoneMobile" || t === "phoneLandline") return `bg-cyan-400/42 dark:bg-cyan-500/34 ${ti}`;
  if (/^link:\d+$/.test(t)) {
    const n = parseInt(t.slice("link:".length), 10) || 0;
    const alt = n % 3;
    const tones = [
      `bg-emerald-400/40 dark:bg-emerald-500/32 ${ti}`,
      `bg-teal-400/38 dark:bg-teal-500/30 ${ti}`,
      `bg-green-400/38 dark:bg-green-600/28 ${ti}`,
    ];
    return tones[alt]!;
  }

  const expM = t.match(/^exp:(exist|new):(\d+):(role|company|location|start|end|bullets)$/);
  if (expM) {
    const field = expM[3]!;
    const pool: Record<string, string> = {
      role: "bg-indigo-400/48 dark:bg-indigo-400/32",
      company: "bg-blue-400/45 dark:bg-blue-500/32",
      location: "bg-sky-400/42 dark:bg-sky-500/30",
      start: "bg-amber-400/50 dark:bg-amber-500/36",
      end: "bg-orange-400/45 dark:bg-orange-500/34",
      bullets: "bg-lime-400/42 dark:bg-lime-500/30",
    };
    const ring =
      expM[1] === "new"
        ? " ring-1 ring-inset ring-fuchsia-400/55 dark:ring-fuchsia-500/45"
        : " ring-1 ring-inset ring-slate-400/35 dark:ring-slate-500/35";
    return `${pool[field] ?? "bg-slate-400/40 dark:bg-slate-500/30"} ${ti}${ring}`;
  }

  const eduM = t.match(/^edu:(exist|new):(\d+):(degree|school|location|start|end|details)$/);
  if (eduM) {
    const field = eduM[3]!;
    const pool: Record<string, string> = {
      degree: "bg-rose-400/48 dark:bg-rose-500/34",
      school: "bg-pink-400/42 dark:bg-pink-500/32",
      location: "bg-fuchsia-400/38 dark:bg-fuchsia-500/28",
      start: "bg-red-400/40 dark:bg-red-500/32",
      end: "bg-orange-400/40 dark:bg-orange-600/30",
      details: "bg-rose-300/40 dark:bg-rose-600/28",
    };
    const ring =
      eduM[1] === "new"
        ? " ring-1 ring-inset ring-yellow-400/55 dark:ring-yellow-600/40"
        : " ring-1 ring-inset ring-rose-300/50 dark:ring-rose-700/45";
    return `${pool[field] ?? "bg-rose-400/40 dark:bg-rose-500/32"} ${ti}${ring}`;
  }

  if (t.startsWith("cert:")) {
    const idx = parseInt(/^cert:(?:exist|new):(\d+):/.exec(t)?.[1] ?? "0", 10);
    const alt = idx % 3;
    const tones = [
      `bg-lime-400/42 dark:bg-lime-500/32 ${ti}`,
      `bg-yellow-400/40 dark:bg-yellow-500/28 ${ti}`,
      `bg-green-400/38 dark:bg-green-500/28 ${ti}`,
    ];
    return tones[alt]!;
  }
  if (t.startsWith("lang:")) {
    const idx = parseInt(/^lang:(?:exist|new):(\d+):/.exec(t)?.[1] ?? "0", 10);
    const alt = idx % 3;
    const tones = [
      `bg-fuchsia-400/42 dark:bg-fuchsia-500/32 ${ti}`,
      `bg-purple-400/40 dark:bg-purple-500/30 ${ti}`,
      `bg-violet-400/38 dark:bg-violet-500/28 ${ti}`,
    ];
    return tones[alt]!;
  }
  return `bg-gray-400/38 dark:bg-gray-600/30 ${ti}`;
}

export function manualAssignmentTargetIsMultiline(target: string): boolean {
  const t = target.trim();
  return t.endsWith(":bullets") || t.endsWith(":details") || t === "summary" || t === "headline";
}

export function normalizeManualAssignments(text: string, list: CvManualAssignment[]): CvManualAssignment[] {
  const n = text.length;
  return list
    .map((a) => {
      const s0 = Math.min(a.start, a.end);
      const e0 = Math.max(a.start, a.end);
      const o: CvManualAssignment = {
        start: Math.max(0, Math.min(s0, n)),
        end: Math.max(0, Math.min(e0, n)),
        target: a.target.trim(),
      };
      if (a.valueOverride !== undefined) o.valueOverride = a.valueOverride;
      return o;
    })
    .filter((a) => a.end > a.start && a.target.length > 0);
}

/**
 * Última asignación gana en solapes; fragmentos contiguos con el mismo índice de asignación se pintan igual.
 */
export function buildManualHighlightHtml(text: string, assignments: CvManualAssignment[]): string {
  const norm = normalizeManualAssignments(text, assignments);
  if (!text) return "";
  if (norm.length === 0) return escHtml(text);

  const cov: (number | null)[] = new Array(text.length).fill(null);
  for (let ai = 0; ai < norm.length; ai++) {
    const a = norm[ai]!;
    for (let p = a.start; p < a.end; p++) cov[p] = ai;
  }

  let html = "";
  let i = 0;
  while (i < text.length) {
    const idx = cov[i];
    if (idx === null) {
      let j = i + 1;
      while (j < text.length && cov[j] === null) j++;
      html += escHtml(text.slice(i, j));
      i = j;
    } else {
      const cls = manualTargetMarkClass(norm[idx]!.target);
      let j = i + 1;
      while (j < text.length && cov[j] === idx) j++;
      html += `<mark class="${cls} rounded-sm px-0.5">${escHtml(text.slice(i, j))}</mark>`;
      i = j;
    }
  }
  return html;
}

function extractEmail(s: string): string {
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (m ? m[0]! : s).trim();
}

function extractFirstUrl(s: string): string {
  const t = s.trim();
  const m1 = t.match(/https?:\/\/[^\s<>"')]+/i);
  if (m1) return m1[0]!.replace(/[),.;]+$/, "");
  const m2 = t.match(/www\.[^\s<>"')]+/i);
  if (m2) return `https://${m2[0]!.replace(/[),.;]+$/, "")}`;
  return t;
}

function isMultilineField(target: string): boolean {
  return (
    target.endsWith(":bullets") ||
    target.endsWith(":details") ||
    target === "summary" ||
    target === "headline"
  );
}

/** Agrupa por target; ordena por posición en el texto; campos multilínea se unen con \n, el resto el último gana. */
export function mergeAssignmentSlices(text: string, assignments: CvManualAssignment[]): Map<string, string> {
  const norm = normalizeManualAssignments(text, assignments);
  norm.sort((a, b) => a.start - b.start || b.end - a.end);
  const map = new Map<string, string[]>();
  for (const a of norm) {
    const fromSource = text.slice(a.start, a.end);
    const slice = (a.valueOverride !== undefined ? a.valueOverride : fromSource).trim();
    if (!slice) continue;
    const cur = map.get(a.target) ?? [];
    cur.push(slice);
    map.set(a.target, cur);
  }
  const out = new Map<string, string>();
  for (const [k, parts] of map) {
    if (parts.length === 0) continue;
    if (isMultilineField(k)) {
      out.set(k, parts.join("\n").trim());
    } else {
      out.set(k, parts[parts.length - 1]!.trim());
    }
  }
  return out;
}

export function parseExpTarget(
  key: string,
): { mode: "exist" | "new"; index: number; field: keyof CvExperienceV1 } | null {
  const m = /^exp:(exist|new):(\d+):(role|company|location|start|end|bullets)$/.exec(key);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const field = m[3] as keyof CvExperienceV1;
  if (!EXP_FIELDS.has(field)) return null;
  return { mode: m[1] as "exist" | "new", index: Number(m[2]), field };
}

export function parseEduTarget(
  key: string,
): { mode: "exist" | "new"; index: number; field: keyof CvEducationV1 } | null {
  const m = /^edu:(exist|new):(\d+):(degree|school|location|start|end|details)$/.exec(key);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const field = m[3] as keyof CvEducationV1;
  if (!EDU_FIELDS.has(field)) return null;
  return { mode: m[1] as "exist" | "new", index: Number(m[2]), field };
}

export function parseCertTarget(key: string): { mode: "exist" | "new"; index: number } | null {
  const m = /^cert:(exist|new):(\d+):name$/.exec(key);
  if (!m || !m[1] || !m[2]) return null;
  return { mode: m[1] as "exist" | "new", index: Number(m[2]) };
}

export function parseLangTarget(
  key: string,
): { mode: "exist" | "new"; index: number; field: "name" | "level" | "line" } | null {
  const m = /^lang:(exist|new):(\d+):(name|level|line)$/.exec(key);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  return { mode: m[1] as "exist" | "new", index: Number(m[2]), field: m[3] as "name" | "level" | "line" };
}

export type BumpManualImportContext = {
  expLen: number;
  eduLen: number;
  certLen: number;
  langLen: number;
};

/**
 * Si ya hay una asignación para el mismo índice de fila y campo (exist/new cuentan como el mismo hueco),
 * avanza índice / pasa a "nueva fila" como harías a mano, en lugar de pisar la asignación anterior.
 * Campos multilínea (bullets, details, summary, headline) no se reubican.
 */
export function bumpManualImportTargetIfOccupied(
  target: string,
  assignments: CvManualAssignment[],
  ctx: BumpManualImportContext,
): string {
  const t = target.trim();
  if (manualAssignmentTargetIsMultiline(t)) return t;

  const exp = parseExpTarget(t);
  if (exp) {
    let mode = exp.mode;
    let idx = exp.index;
    const field = exp.field;
    const occupied = (i: number) =>
      assignments.some((a) => {
        const q = parseExpTarget(a.target);
        return q && q.field === field && q.index === i;
      });
    for (let n = 0; n < 48; n++) {
      while (mode === "exist" && idx >= ctx.expLen) {
        mode = "new";
        idx = 0;
      }
      if (!occupied(idx)) return `exp:${mode}:${idx}:${field}`;
      idx++;
      if (mode === "exist" && idx >= ctx.expLen) {
        mode = "new";
        idx = 0;
      }
    }
    return `exp:new:${idx}:${field}`;
  }

  const edu = parseEduTarget(t);
  if (edu) {
    let mode = edu.mode;
    let idx = edu.index;
    const field = edu.field;
    const occupied = (i: number) =>
      assignments.some((a) => {
        const q = parseEduTarget(a.target);
        return q && q.field === field && q.index === i;
      });
    for (let n = 0; n < 48; n++) {
      while (mode === "exist" && idx >= ctx.eduLen) {
        mode = "new";
        idx = 0;
      }
      if (!occupied(idx)) return `edu:${mode}:${idx}:${field}`;
      idx++;
      if (mode === "exist" && idx >= ctx.eduLen) {
        mode = "new";
        idx = 0;
      }
    }
    return `edu:new:${idx}:${field}`;
  }

  const cert = parseCertTarget(t);
  if (cert) {
    let mode = cert.mode;
    let idx = cert.index;
    const occupied = (i: number) =>
      assignments.some((a) => {
        const q = parseCertTarget(a.target);
        return q && q.index === i;
      });
    for (let n = 0; n < 48; n++) {
      while (mode === "exist" && idx >= ctx.certLen) {
        mode = "new";
        idx = 0;
      }
      if (!occupied(idx)) return `cert:${mode}:${idx}:name`;
      idx++;
      if (mode === "exist" && idx >= ctx.certLen) {
        mode = "new";
        idx = 0;
      }
    }
    return `cert:new:${idx}:name`;
  }

  const lang = parseLangTarget(t);
  if (lang) {
    let mode = lang.mode;
    let idx = lang.index;
    const field = lang.field;
    const occupied = (i: number) =>
      assignments.some((a) => {
        const q = parseLangTarget(a.target);
        return q && q.field === field && q.index === i;
      });
    for (let n = 0; n < 48; n++) {
      while (mode === "exist" && idx >= ctx.langLen) {
        mode = "new";
        idx = 0;
      }
      if (!occupied(idx)) return `lang:${mode}:${idx}:${field}`;
      idx++;
      if (mode === "exist" && idx >= ctx.langLen) {
        mode = "new";
        idx = 0;
      }
    }
    return `lang:new:${idx}:${field}`;
  }

  return t;
}

function buildNewExperiences(slices: Map<string, string>): CvExperienceV1[] {
  let maxIdx = -1;
  for (const k of slices.keys()) {
    const p = parseExpTarget(k);
    if (p && p.mode === "new") maxIdx = Math.max(maxIdx, p.index);
  }
  if (maxIdx < 0) return [];
  const rows: CvExperienceV1[] = Array.from({ length: maxIdx + 1 }, () => ({}));
  for (const [k, v] of slices) {
    const p = parseExpTarget(k);
    if (p && p.mode === "new") {
      (rows[p.index] as Record<string, string | undefined>)[p.field] = v;
    }
  }
  return rows.filter((r) =>
    Object.values(r).some((val) => typeof val === "string" && val.trim().length > 0),
  );
}

function buildNewEducation(slices: Map<string, string>): CvEducationV1[] {
  let maxIdx = -1;
  for (const k of slices.keys()) {
    const p = parseEduTarget(k);
    if (p && p.mode === "new") maxIdx = Math.max(maxIdx, p.index);
  }
  if (maxIdx < 0) return [];
  const rows: CvEducationV1[] = Array.from({ length: maxIdx + 1 }, () => ({}));
  for (const [k, v] of slices) {
    const p = parseEduTarget(k);
    if (p && p.mode === "new") {
      (rows[p.index] as Record<string, string | undefined>)[p.field] = v;
    }
  }
  return rows.filter((r) =>
    Object.values(r).some((val) => typeof val === "string" && val.trim().length > 0),
  );
}

function buildNewLanguages(slices: Map<string, string>): CvLanguageV1[] {
  let maxIdx = -1;
  for (const k of slices.keys()) {
    const p = parseLangTarget(k);
    if (p && p.mode === "new") maxIdx = Math.max(maxIdx, p.index);
  }
  if (maxIdx < 0) return [];
  const out: CvLanguageV1[] = [];
  for (let i = 0; i <= maxIdx; i++) {
    const line = slices.get(`lang:new:${i}:line`);
    if (line !== undefined) {
      const parsed = parseLanguagesFromPaste(line)[0];
      if (parsed && (parsed.name ?? "").trim().length > 0) {
        out.push({ name: parsed.name!.trim(), level: parsed.level });
      }
      continue;
    }
    const name = slices.get(`lang:new:${i}:name`)?.trim() ?? "";
    const level = slices.get(`lang:new:${i}:level`)?.trim() ?? "";
    if (name) out.push({ name, level: level || undefined });
  }
  return out;
}

export type ApplyCvManualImportResult = {
  profile: CvProfileV1;
  filled: string[];
  errors: string[];
  /** Si hay resumen en el mapa y ya existía uno: el caller puede pedir confirmación. */
  summaryPendingReplace?: string;
};

export function applyCvManualImport(
  sourceText: string,
  assignments: CvManualAssignment[],
  profile: CvProfileV1,
  opts?: { displayNameLower?: string },
): ApplyCvManualImportResult {
  const filled: string[] = [];
  const errors: string[] = [];
  const slices = mergeAssignmentSlices(sourceText, assignments);
  const next: CvProfileV1 = JSON.parse(JSON.stringify(profile)) as CvProfileV1;

  const dn = (opts?.displayNameLower ?? "").trim();

  const touch = (label: string) => {
    if (!filled.includes(label)) filled.push(label);
  };

  let summaryPendingReplace: string | undefined;
  const sumSlice = slices.get("summary");
  if (sumSlice !== undefined) {
    const curSum = (next.summary ?? "").trim();
    if (!curSum) {
      next.summary = sumSlice.trim();
      touch("summary");
    } else {
      summaryPendingReplace = sumSlice.trim();
      touch("summary");
    }
  }

  for (const [key, raw] of slices) {
    if (key === "summary") continue;

    if (key === "headline") {
      const v = raw.replace(/\s+/g, " ").trim();
      if (dn && v.toLowerCase() === dn) continue;
      next.headline = v;
      touch("headline");
      continue;
    }
    if (key === "email") {
      next.email = extractEmail(raw);
      touch("email");
      continue;
    }
    if (key === "phoneMobile") {
      next.phoneMobile = raw.replace(/\s+/g, " ").trim();
      touch("phoneMobile");
      continue;
    }
    if (key === "phoneLandline") {
      next.phoneLandline = raw.replace(/\s+/g, " ").trim();
      touch("phoneLandline");
      continue;
    }

    const linkM = /^link:(\d+)$/.exec(key);
    if (linkM) {
      const slot = Number(linkM[1]);
      if (slot < 0 || slot >= CV_LINK_SLOT_COUNT) {
        errors.push(`link:${slot}`);
        continue;
      }
      const slots = Array.from(
        { length: CV_LINK_SLOT_COUNT },
        (_, i) => (Array.isArray(next.cvLinkSlots) ? next.cvLinkSlots[i] : "") ?? "",
      );
      slots[slot] = extractFirstUrl(raw);
      next.cvLinkSlots = slots;
      touch(`link:${slot}`);
      continue;
    }

    const expT = parseExpTarget(key);
    if (expT) {
      if (expT.mode === "new") continue;
      const ex = Array.isArray(next.experiences) ? [...next.experiences] : [];
      if (expT.index < 0 || expT.index >= ex.length) {
        errors.push(key);
        continue;
      }
      const row = { ...(ex[expT.index] ?? {}) } as CvExperienceV1;
      (row as Record<string, string | undefined>)[expT.field] = raw;
      ex[expT.index] = row;
      next.experiences = ex;
      touch(`exp:exist:${expT.index}`);
      continue;
    }

    const eduT = parseEduTarget(key);
    if (eduT) {
      if (eduT.mode === "new") continue;
      const ed = Array.isArray(next.education) ? [...next.education] : [];
      if (eduT.index < 0 || eduT.index >= ed.length) {
        errors.push(key);
        continue;
      }
      const row = { ...(ed[eduT.index] ?? {}) } as CvEducationV1;
      (row as Record<string, string | undefined>)[eduT.field] = raw;
      ed[eduT.index] = row;
      next.education = ed;
      touch(`edu:exist:${eduT.index}`);
      continue;
    }

    const certT = parseCertTarget(key);
    if (certT) {
      const name = raw.replace(/\s+/g, " ").trim();
      if (!name) continue;
      const certs = Array.isArray(next.certifications) ? [...next.certifications] : [];
      if (certT.mode === "exist") {
        if (certT.index < 0 || certT.index >= certs.length) {
          errors.push(key);
          continue;
        }
        const row = { ...(certs[certT.index] ?? {}) } as CvCertificationV1;
        row.name = name;
        certs[certT.index] = row;
        next.certifications = certs;
        touch(`cert:exist:${certT.index}`);
      } else {
        continue;
      }
      continue;
    }

    const langT = parseLangTarget(key);
    if (langT && langT.mode === "exist") {
      const langs = Array.isArray(next.languages) ? [...next.languages] : [];
      if (langT.index < 0 || langT.index >= langs.length) {
        errors.push(key);
        continue;
      }
      const row = { ...(langs[langT.index] ?? {}) } as CvLanguageV1;
      if (langT.field === "line") {
        const parsed = parseLanguagesFromPaste(raw)[0];
        if (parsed && (parsed.name ?? "").trim()) {
          row.name = parsed.name!.trim();
          if (parsed.level) row.level = parsed.level;
        }
      } else if (langT.field === "name") row.name = raw.trim();
      else if (langT.field === "level") row.level = raw.trim();
      langs[langT.index] = row;
      next.languages = langs;
      touch(`lang:exist:${langT.index}`);
      continue;
    }
  }

  const newExp = buildNewExperiences(slices);
  if (newExp.length > 0) {
    const base = Array.isArray(next.experiences) ? next.experiences : [];
    next.experiences = [...base, ...newExp];
    touch("exp:new");
  }

  const newEdu = buildNewEducation(slices);
  if (newEdu.length > 0) {
    const base = Array.isArray(next.education) ? next.education : [];
    next.education = [...base, ...newEdu];
    touch("edu:new");
  }

  for (const [key, raw] of slices) {
    const certT = parseCertTarget(key);
    if (certT && certT.mode === "new") {
      const name = raw.replace(/\s+/g, " ").trim();
      if (!name) continue;
      const certs = Array.isArray(next.certifications) ? [...next.certifications] : [];
      certs.push({ name });
      next.certifications = certs;
      touch("cert:new");
    }
  }

  const newLangs = buildNewLanguages(slices);
  if (newLangs.length > 0) {
    const base = Array.isArray(next.languages) ? next.languages : [];
    next.languages = [...base, ...newLangs];
    touch("lang:new");
  }

  return { profile: next, filled, errors, summaryPendingReplace };
}
