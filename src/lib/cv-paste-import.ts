/**
 * Importación heurística de bloques de experiencia / educación desde texto pegado (CV previo).
 * No sustituye a un parser de PDF ni a IA; sirve para ahorrar tiempo con formato libre.
 */

export type LooseExperienceRow = {
  company?: string;
  role?: string;
  location?: string;
  start?: string;
  end?: string;
  bullets?: string;
};

export type LooseEducationRow = {
  school?: string;
  degree?: string;
  location?: string;
  start?: string;
  end?: string;
  details?: string;
};

export type LooseCertificationRow = { name?: string; issuer?: string; year?: string; url?: string };
export type LooseLanguageRow = { name?: string; level?: string };

function splitBlocks(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

const MONTH_ES =
  "ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|noviembre|diciembre";
const MONTH_EN =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

/** Línea con rango de fechas (años o mes+año). Puede dar falsos positivos en párrafos largos. */
function isLikelyDateLine(s: string): boolean {
  const t = s.trim();
  if (/presente|present|actual|hoy|now|current/i.test(t)) return true;
  if (/\d{4}\s*[\-–—]\s*(\d{4}|presente|present|actual|current)/i.test(t)) return true;
  if (
    /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(
      t,
    ) &&
    /\d{4}/.test(t)
  )
    return true;
  if (
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
      t,
    ) &&
    /\d{4}/.test(t)
  )
    return true;
  if (/^\d{4}\s*[\-–—]\s*\d{1,2}\b/.test(t)) return true;
  if (/\(\s*\d+\s*MESES\s*\)/i.test(t) && /\d{4}/.test(t)) return true;
  return false;
}

/** Línea que es casi solo fechas/duración (no un párrafo de trabajo con un mes mencionado). */
function isPrimarilyDateLine(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 130) return false;
  if (/\|/.test(t) || /@/.test(t)) return false;
  if (looksLikeJobTitleFragment(t)) return false;
  if (/\b(grado|m[aá]ster|master|licen|universidad|experto|phd|bachelor)\b/i.test(t)) return false;

  if (/presente|present|actual|now|current|hoy/i.test(t) && /\d{4}/.test(t)) return true;
  if (/^\d{4}\s*[\-–—]\s*(\d{4}|presente|present|actual|current|hoy)\b/i.test(t)) return true;
  if (/^\d{4}\s*[\-–—]\s*\d{1,2}\b/.test(t)) return true;

  const moSingle = new RegExp(`^(?:${MONTH_ES}|${MONTH_EN})\\s+\\d{4}(\\s*\\([^)]*\\))?$`, "i");
  if (moSingle.test(t)) return true;

  const moRange = new RegExp(
    `^(?:${MONTH_ES}|${MONTH_EN})\\s+\\d{4}\\s*[–—-]\\s*(?:${MONTH_ES}|${MONTH_EN})?\\s*\\d{4}(\\s*\\([^)]*\\))?$`,
    "i",
  );
  if (moRange.test(t)) return true;

  if (/^\d{4}\s*\(\s*\d+\s*mes(es)?\s*\)\.?$/i.test(t)) return true;
  if (/^\d{4}\s*[\-–—]\s*\d{4}\s*\(\s*\d+\s*mes(es)?\s*\)\.?$/i.test(t)) return true;

  return false;
}

function looksLikeJobTitleFragment(s: string): boolean {
  const t = s.trim();
  if (/\|/.test(t)) return true;
  if (
    /\b(analista|developer|engineer|ingeniero|ingeniera|pr[aá]cticas|becario|becaria|junior|senior|consultor|consultora|data\s+scientist|scientist|analyst)\b/i.test(
      t,
    )
  )
    return true;
  return false;
}

/** Solo fecha/duración sin rol (evita cortar bloques mal en la normalización). */
function isStandaloneDateOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 130) return false;
  if (/\|/.test(t) || /@/.test(t)) return false;
  return isPrimarilyDateLine(t);
}

/**
 * Separa empresa y fragmento de fechas cuando vienen en la misma línea tras `|`
 * (p. ej. «SERVICIOS … S.L. MAYO 2025 – ENERO 2026 (8 MESES)»).
 */
function splitCompanyAndTrailingDates(companyRaw: string): { company: string; dateFragment: string } {
  let s = companyRaw.trim().replace(/\.+$/, "").trim();
  let dateFragment = "";
  const month =
    "(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)";
  const reRange = new RegExp(
    `^(.*?)(\\s+${month}\\s+\\d{4}\\s*[–—-]\\s*(?:${month}\\s+)?\\d{4}(?:\\s*\\([^)]+\\))?|\\s+\\d{4}\\s*\\(\\s*\\d+\\s*MESES\\s*\\)\\.?)$`,
    "i",
  );
  const m1 = s.match(reRange);
  if (m1 && m1[1]!.trim().length > 2) {
    s = m1[1]!.trim().replace(/\.+$/, "").trim();
    dateFragment = m1[2]!.trim().replace(/^\.+\s*/, "");
    return { company: s, dateFragment };
  }
  const reYearRange = /^(.+?)(\s+\d{4}\s*[–—-]\s*\d{4}(?:\s*\([^)]+\))?)$/i.exec(s);
  if (reYearRange && reYearRange[1]!.trim().length > 2) {
    return {
      company: reYearRange[1]!.trim().replace(/\.+$/, "").trim(),
      dateFragment: reYearRange[2]!.trim(),
    };
  }
  return { company: s, dateFragment };
}

function parseRoleCompany(line: string): { role: string; company: string } {
  const at = /\s+@\s+|\s+at\s+/i.exec(line);
  if (at && at.index !== undefined && at.index > 0) {
    return { role: line.slice(0, at.index).trim(), company: line.slice(at.index + at[0].length).trim() };
  }
  const en = /\s+en\s+/i.exec(line);
  if (en && en.index !== undefined && en.index > 0) {
    return { role: line.slice(0, en.index).trim(), company: line.slice(en.index + en[0].length).trim() };
  }
  const pipe = line.split(/\s*\|\s*/);
  if (pipe.length >= 2) {
    return { role: pipe[0].trim(), company: pipe.slice(1).join(" | ").trim() };
  }
  const mdash = line.split(/\s*[—–-]\s+/);
  if (mdash.length >= 2 && mdash[0].length < 80) {
    return { role: mdash[0].trim(), company: mdash.slice(1).join(" – ").trim() };
  }
  return { role: line.trim(), company: "" };
}

function stripBullet(line: string): string {
  return line
    .replace(/^[-•*\u2022·]\s+/, "")
    .replace(/^[\u2022·](?=[^\s])/, "")
    .trim();
}

function isBulletLine(line: string): boolean {
  const t = line.trim();
  return (
    /^[-•*\u2022·]\s+/.test(t) ||
    /^[\u2022·](?=[A-Za-zÁÉÍÑÜáéíóúñ0-9])/i.test(t) ||
    /^\d+[\).\u00bb]\s+/i.test(t)
  );
}

/** Títulos de bloque típicos en CV (experiencia / formación). */
function looksLikeCvTitleLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/\s@\s|\s+en\s+|\s*\|\s*/.test(t)) return true;
  if (/^[A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9\s().]{12,}\|\s*\S/.test(t)) return true;
  if (/(grado|master|máster|licenciatura|ingeniería|ingenieria|bachelor|phd|doctorado|mba|fp\b)/i.test(t)) return true;
  return false;
}

/** Inicio de línea típico de formación (no debe forzar párrafo nuevo por el « en » del puesto). */
function looksLikeEducationHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^(grado|m[aá]ster|master|experto(\s+universitario)?\s+en|licenciatura|ingenier[íi]a|ingeniero|ingeniera|bachelor|phd|doctorado|mba|fp\b|ciclo\s+formativo|curso\s+superior|t[ií]tulo\s+propio)/i.test(
    t,
  );
}

/** PDFs suelen poner empresa en línea aparte sin «en» (p. ej. rol en una línea y «… S.L.» debajo). */
function looksLikeOrganizationLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/\b(S\.?\s*L\.?|S\.?\s*A\.?|Ltd\.?|Inc\.?|GmbH|LLC)\b/i.test(t)) return true;
  if (/^uni(versidad|versidad)/i.test(t)) return true;
  if (/\b(opinión|opinion|consulting|consultores|servicios)\b/i.test(t) && t.length > 12) return true;
  if (t.length >= 14 && t === t.toUpperCase() && /\s/.test(t)) return true;
  return false;
}

function looksLikeSchoolContinuationLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^uni(versidad|versidad)/i.test(t)) return true;
  if (/\b(viu|upc|uam|ucm|uned|unir|esade|ie)\b/i.test(t)) return true;
  if (t.length >= 12 && t === t.toUpperCase() && /\s/.test(t)) return true;
  return false;
}

const EXP_SECTION_HEADER =
  /^(experiencia(\s+laboral)?|experiencia\s+profesional|work\s*experience|employment(\s+history)?|professional\s+experience|historial\s+profesional|empleos?|trayectoria\s+profesional)\s*:?\s*$/i;

const EDU_SECTION_HEADER =
  /^(educaci[oó]n|formaci[oó]n|education|academic(\s+background)?|estudios|qualifications|titulaciones?)\s*:?\s*$/i;

const CERT_SECTION_HEADER = /^(certificaciones?|certifications?|cursos\s+certificados?)\s*:?\s*$/i;

const LANG_SECTION_HEADER = /^(idiomas?|languages?)\s*:?\s*$/i;

const TECH_SECTION_HEADER = /^(tecnolog[ií]as?|technical\s+skills|stack(\s+tecnol[oó]gico)?)\s*:?\s*$/i;

const OTHER_SECTION_HEADER =
  /^(skills|habilidades|competencias|proyectos(\s+personales)?|publicaciones?|publications?|references?|referencias|intereses|awards|premios|cursos(\s+complementarios)?|datos?\s+personales|contacto|summary|resumen(\s+profesional)?|about|perfil|sobre\s+m[ií]|presentaci[oó]n)\s*:?\s*$/i;

/** Líneas que no son idiomas: cabecera/contacto/bio/certificaciones pegadas al final del PDF. */
function looksLikeLanguageSectionContaminant(t: string): boolean {
  const s = t.trim();
  if (!s) return false;
  if (/https?:\/\/|www\.\S/i.test(s)) return true;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s)) return true;
  if (/\b(linkedin|github)\.com\b/i.test(s)) return true;
  if (/\b\+34\b|\b00\s*34\b/i.test(s)) return true;
  if (/\+\d{1,3}[\s().\d-]{8,}\d/.test(s)) return true;
  if (s.length > 220) return true;
  if (/\b(AWS\s+Certified|CLF-C02|PL-300|Microsoft\s+PL-)\b/i.test(s)) return true;
  if (s.length > 90 && /\b(graduado|licenciado|especializado\s+en|mathematics|matemáticas)\b/i.test(s) && s.split(/\s+/).length > 14)
    return true;
  if (EXP_SECTION_HEADER.test(s) || EDU_SECTION_HEADER.test(s) || CERT_SECTION_HEADER.test(s) || TECH_SECTION_HEADER.test(s))
    return true;
  return false;
}

function normImpKeyLocal(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function experienceLooseKey(r: LooseExperienceRow): string {
  return `${normImpKeyLocal(r.role ?? "")}|${normImpKeyLocal(r.company ?? "")}`;
}

function collapseAdjacentDuplicateExperiences(rows: LooseExperienceRow[]): LooseExperienceRow[] {
  if (rows.length < 2) return rows;
  const out: LooseExperienceRow[] = [];
  for (const r of rows) {
    const prev = out[out.length - 1];
    if (prev && experienceLooseKey(prev) === experienceLooseKey(r)) {
      const pb = (prev.bullets ?? "").trim();
      const rb = (r.bullets ?? "").trim();
      if (pb && rb) {
        if (pb === rb) continue;
        const short = Math.min(pb.length, rb.length);
        if (short > 80 && (pb.slice(0, 80) === rb.slice(0, 80) || pb.includes(rb.slice(0, 60)) || rb.includes(pb.slice(0, 60))))
          continue;
      }
    }
    out.push(r);
  }
  return out;
}

export type CvPasteSectionSplit = {
  preamble: string;
  experience: string;
  education: string;
  certifications: string;
  languages: string;
  technologies: string;
  sawExperienceHeader: boolean;
  sawEducationHeader: boolean;
  sawCertificationsHeader: boolean;
  sawLanguagesHeader: boolean;
  sawTechnologiesHeader: boolean;
};

/**
 * Detecta cabeceras típicas de CV y parte el texto para parsear por sección.
 */
export function splitCvPasteBySections(raw: string): CvPasteSectionSplit {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let state: "pre" | "exp" | "edu" | "cert" | "lang" | "tech" | "skip" = "pre";
  const pre: string[] = [];
  const exp: string[] = [];
  const edu: string[] = [];
  const cert: string[] = [];
  const lang: string[] = [];
  const tech: string[] = [];
  let sawExperienceHeader = false;
  let sawEducationHeader = false;
  let sawCertificationsHeader = false;
  let sawLanguagesHeader = false;
  let sawTechnologiesHeader = false;

  for (const line of lines) {
    const t = line.trim();
    if (EXP_SECTION_HEADER.test(t)) {
      sawExperienceHeader = true;
      state = "exp";
      continue;
    }
    if (EDU_SECTION_HEADER.test(t)) {
      sawEducationHeader = true;
      state = "edu";
      continue;
    }
    if (CERT_SECTION_HEADER.test(t)) {
      sawCertificationsHeader = true;
      state = "cert";
      continue;
    }
    if (state === "cert" && LANG_SECTION_HEADER.test(t)) {
      sawLanguagesHeader = true;
      state = "lang";
      continue;
    }
    if (LANG_SECTION_HEADER.test(t)) {
      sawLanguagesHeader = true;
      state = "lang";
      continue;
    }
    if (TECH_SECTION_HEADER.test(t)) {
      sawTechnologiesHeader = true;
      state = "tech";
      continue;
    }
    if (OTHER_SECTION_HEADER.test(t)) {
      state = "skip";
      continue;
    }
    if (state === "lang" && t.length > 0 && looksLikeLanguageSectionContaminant(t)) {
      state = "skip";
      continue;
    }
    if (state === "pre") pre.push(line);
    else if (state === "exp") exp.push(line);
    else if (state === "edu") edu.push(line);
    else if (state === "cert") cert.push(line);
    else if (state === "lang") lang.push(line);
    else if (state === "tech") tech.push(line);
  }

  return {
    preamble: pre.join("\n").trim(),
    experience: exp.join("\n").trim(),
    education: edu.join("\n").trim(),
    certifications: cert.join("\n").trim(),
    languages: lang.join("\n").trim(),
    technologies: tech.join("\n").trim(),
    sawExperienceHeader,
    sawEducationHeader,
    sawCertificationsHeader,
    sawLanguagesHeader,
    sawTechnologiesHeader,
  };
}

/**
 * Si «IDIOMAS» quedó pegado al final de certificaciones (sin cabecera aparte), separa ese trozo.
 */
export function splitLanguagesTailFromCertificationsText(certText: string): {
  certifications: string;
  languagesExtra: string;
} {
  const t = certText.replace(/\r\n/g, "\n");
  const idx = t.search(/\n\s*IDIOM(?:AS|A)\b/i);
  if (idx >= 0) {
    const certPart = t.slice(0, idx).trim();
    const langPart = t
      .slice(idx)
      .replace(/^\s*IDIOM(?:AS|A)\s*:?\s*/i, "")
      .trim();
    return { certifications: certPart, languagesExtra: langPart };
  }
  const sameLine = t.match(/^([\s\S]*?)(\s+IDIOM(?:AS|A)\s+[\s\S]+)$/i);
  if (sameLine && sameLine[1] && sameLine[2] && /\b(japon|inglés|ingles|francés|frances|alemán|aleman|chino)\b/i.test(sameLine[2])) {
    return {
      certifications: sameLine[1]!.trim(),
      languagesExtra: sameLine[2]!.replace(/^\s*IDIOM(?:AS|A)\s+/i, "").trim(),
    };
  }
  return { certifications: t.trim(), languagesExtra: "" };
}

export function mergeLanguagesSplitFromCertificationsSection(split: CvPasteSectionSplit): CvPasteSectionSplit {
  const peeled = splitLanguagesTailFromCertificationsText(split.certifications);
  if (!peeled.languagesExtra.trim()) return split;
  const combined = [split.languages.trim(), peeled.languagesExtra.trim()].filter(Boolean).join("\n\n");
  return {
    ...split,
    certifications: peeled.certifications.trim(),
    languages: combined,
    sawLanguagesHeader: true,
  };
}

/** Evita que titulaciones acaben en «experiencia» cuando no hay secciones explícitas en el pegado. */
export function filterFalsePositiveExperienceRows(rows: LooseExperienceRow[]): LooseExperienceRow[] {
  return rows.filter((r) => !experienceRowLooksLikeEducation(r));
}

function experienceRowLooksLikeEducation(r: LooseExperienceRow): boolean {
  const role = (r.role ?? "").trim();
  const company = (r.company ?? "").trim();
  if (!role) return false;
  const degreeish =
    /^(grado|m[aá]ster|master|licenciatura|licenciado|bachelor|phd|doctorado|mba|fp\b|ingenier[ií]a|bsc|msc|ba\b|ma\b|bs\b|ms\b)\b/i.test(
      role,
    );
  const schoolish =
    !company ||
    looksLikeSchoolContinuationLine(company) ||
    /^uni(versidad)?/i.test(company) ||
    /\b(viu|upc|uam|ucm|uned|unir|esade|ie)\b/i.test(company);
  return degreeish && schoolish;
}

/**
 * Antes de normalizar: partir líneas largas con varios puestos `ROL | EMPRESA` y listas con punto medio « · ».
 */
export function preprocessCvPasteForImport(raw: string): string {
  const t = raw.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const lines = t.split("\n");
  const out: string[] = [];

  for (let line of lines) {
    const trimmed = line.trimEnd();
    let tline = trimmed
      .trim()
      .replace(/\s+-\s+-\s+/g, " – ")
      .replace(/\s+[–—]\s+[–—]\s+/g, " – ")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (tline.includes("|")) {
      const nPipes = (tline.match(/\|/g) || []).length;
      if (nPipes >= 2 && tline.length > 65) {
        const parts = tline.split(/\s+(?=[A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9\s().,]{8,}\|\s*)/);
        if (parts.length > 1) {
          for (const p of parts) {
            const s = p.trim();
            if (s) out.push(s);
          }
          continue;
        }
      }
    }

    if (tline.length > 90 && tline.includes("|")) {
      const parts = tline.split(/\s+(?=[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s()]{6,}\|\s*[A-ZÁÉÍÓÚÑÜ])/);
      if (parts.length > 1) {
        for (const p of parts) {
          const s = p.trim();
          if (s) out.push(s);
        }
        continue;
      }
    }

    const mdSplits = tline.split(/\s+·\s+/).map((c) => c.trim()).filter(Boolean);
    const pipeEarly = /^[^|]{0,100}\|/.test(tline) && tline.indexOf("|") < 90;
    if (mdSplits.length >= 2 && !pipeEarly && tline.length > 70) {
      out.push(mdSplits[0]!);
      for (let i = 1; i < mdSplits.length; i++) {
        out.push(`- ${mdSplits[i]!}`);
      }
      continue;
    }

    out.push(trimmed);
  }

  return out.join("\n").trim();
}

/**
 * PDF y copias desde Word suelen traer un solo `\n` entre párrafos; los parsers usan bloques separados por línea en blanco.
 * Inserta saltos de párrafo antes de líneas que parecen un nuevo puesto o titulación.
 */
export function normalizeCvPasteForHeuristics(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
  if (!t) return t;
  const lines = t.split("\n").map((l) => l.trim());
  const out: string[] = [];
  let buf: string[] = [];

  const flushBuf = () => {
    if (buf.length === 0) return;
    out.push(buf.join("\n"));
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line) {
      flushBuf();
      continue;
    }
    const next = lines[i + 1] ?? "";
    if (buf.length > 0 && isStandaloneDateOnlyLine(line) && !looksLikeCvTitleLine(next)) {
      buf.push(line);
      continue;
    }
    if (isBulletLine(line)) {
      flushBuf();
      out.push(line);
      continue;
    }
    if (
      buf.length > 0 &&
      buf.join("").length > 70 &&
      /^[A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9\s().]{14,}\|\s*\S/.test(line) &&
      !isBulletLine(line)
    ) {
      flushBuf();
      out.push("");
    }
    if (
      buf.length > 0 &&
      ((!looksLikeEducationHeadingLine(line) && looksLikeCvTitleLine(line)) ||
        (isPrimarilyDateLine(line) && looksLikeCvTitleLine(next)))
    ) {
      flushBuf();
      out.push("");
    }
    buf.push(line);
  }
  flushBuf();
  const joined = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return joined;
}

function expandLongLineIntoBulletLines(line: string): string[] {
  const t = line.trim();
  if (t.length < 36 || !t.includes(" · ")) return [line];
  const parts = t.split(/\s+·\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [line];
  const jobish = /^[A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9\s().]{0,65}\|\s*\S/.test(t);
  const allShort = parts.every((p) => p.length <= 58);
  if (jobish && parts.length <= 3 && allShort && t.length < 220) return [line];
  if (parts.length >= 4 || (t.length > 120 && parts.length >= 2 && !allShort)) {
    return [parts[0]!, ...parts.slice(1).map((p) => `- ${p}`)];
  }
  return [parts[0]!, ...parts.slice(1).map((p) => `- ${p}`)];
}

/**
 * Cada bloque = un puesto o formación: primera línea título (rol en empresa o título en centro),
 * opcional línea de fechas, resto bullets → bullets/details.
 */
export function parseExperienceBlocksFromPaste(raw: string): LooseExperienceRow[] {
  const out: LooseExperienceRow[] = [];
  for (const block of splitBlocks(raw)) {
    const expandedLines: string[] = [];
    for (const ln of block.split("\n")) {
      expandedLines.push(...expandLongLineIntoBulletLines(ln));
    }
    const lines = expandedLines.map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const bullets: string[] = [];
    const meta: string[] = [];
    for (const line of lines) {
      if (isBulletLine(line)) bullets.push(stripBullet(line));
      else meta.push(line);
    }
    if (meta.length === 0 && bullets.length === 0) continue;
    let dateLine = "";
    const restMeta: string[] = [];
    for (const m of meta) {
      if (!dateLine && isPrimarilyDateLine(m)) dateLine = m;
      else restMeta.push(m);
    }
    while (restMeta.length > 0 && isPrimarilyDateLine(restMeta[0]!)) {
      const d = restMeta.shift()!;
      dateLine = dateLine ? `${dateLine} · ${d}` : d;
    }
    let titleLine = restMeta[0] ?? "";
    let metaSliceFrom = 1;
    if (titleLine) {
      const pc0 = parseRoleCompany(titleLine);
      if (!pc0.company && restMeta[1] && !isPrimarilyDateLine(restMeta[1]) && looksLikeOrganizationLine(restMeta[1])) {
        titleLine = `${titleLine} en ${restMeta[1]}`;
        metaSliceFrom = 2;
      }
    }
    let extraMeta = restMeta.slice(metaSliceFrom);
    let { role, company } = titleLine ? parseRoleCompany(titleLine) : { role: "", company: "" };
    if (company) {
      const { company: co, dateFragment } = splitCompanyAndTrailingDates(company);
      company = co;
      if (dateFragment && !dateLine) dateLine = dateFragment;
    }
    let start = "";
    let end = "";
    if (dateLine) {
      const parts = dateLine.split(/\s*[\-–—]\s+/).map((s) => s.trim());
      if (parts.length >= 2) {
        start = parts[0] ?? "";
        end = parts.slice(1).join(" – ");
      } else {
        start = dateLine;
      }
    }
    const location = extraMeta.join(" · ").trim();
    out.push({
      role,
      company,
      location: location || undefined,
      start,
      end,
      bullets: bullets.length > 0 ? bullets.join("\n") : undefined,
    });
  }
  const filtered = out.filter((r) => r.role || r.company || r.bullets);
  return collapseAdjacentDuplicateExperiences(filtered);
}

function parseEducationLeadingYearLine(line: string): { yearPart: string; rest: string } | null {
  const m = line.match(/^(\d{4}(?:\s*[–—-]\s*\d{2,4})?)\s*[-–—.:]\s*(.+)$/);
  if (!m) return null;
  return { yearPart: m[1]!.trim().replace(/\s+/g, ""), rest: m[2]!.trim() };
}

export function parseEducationBlocksFromPaste(raw: string): LooseEducationRow[] {
  const out: LooseEducationRow[] = [];
  for (const block of splitBlocks(raw)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const details: string[] = [];
    const meta: string[] = [];
    for (const line of lines) {
      if (isBulletLine(line)) details.push(stripBullet(line));
      else meta.push(line);
    }
    if (meta.length === 0 && details.length === 0) continue;

    let dateLine = "";
    const restMeta: string[] = [];
    for (const m of meta) {
      const lead = parseEducationLeadingYearLine(m);
      if (lead && !dateLine) {
        dateLine = lead.yearPart;
        restMeta.push(lead.rest);
        continue;
      }
      if (!dateLine && isPrimarilyDateLine(m) && !/^grado|m[aá]ster|master|licen|experto|phd|bachelor/i.test(m.slice(0, 24))) {
        dateLine = m;
        continue;
      }
      restMeta.push(m);
    }
    while (restMeta.length > 0 && isPrimarilyDateLine(restMeta[0]!)) {
      const d = restMeta.shift()!;
      dateLine = dateLine ? `${dateLine} · ${d}` : d;
    }
    if (
      restMeta.length >= 2 &&
      looksLikeSchoolContinuationLine(restMeta[0]!) &&
      /^(grado|m[aá]ster|master|experto|phd|bachelor|licen|ingenier)/i.test((restMeta[1] ?? "").trim().slice(0, 48))
    ) {
      restMeta.splice(0, 2, `${restMeta[1]!.trim()} en ${restMeta[0]!.trim()}`);
    }
    let titleLine = restMeta[0] ?? "";
    let eduMetaFrom = 1;
    if (titleLine) {
      const pc0 = parseRoleCompany(titleLine);
      if (!pc0.company && restMeta[1] && !isPrimarilyDateLine(restMeta[1]) && looksLikeSchoolContinuationLine(restMeta[1])) {
        titleLine = `${titleLine} en ${restMeta[1]}`;
        eduMetaFrom = 2;
      }
    }
    let extraMeta = restMeta.slice(eduMetaFrom);
    let adjDateLine = dateLine;
    const yearOnlyLines = extraMeta.filter((x) => /^\d{4}\s*[–—-]\s*\d{2,4}\s*$/.test(x.trim()));
    const nonYearExtra = extraMeta.filter((x) => !yearOnlyLines.includes(x));
    if (!adjDateLine && yearOnlyLines.length > 0) {
      adjDateLine = yearOnlyLines[0]!.trim().replace(/\s+/g, "");
      extraMeta = nonYearExtra;
    }
    const { role: degree, company: school } = titleLine ? parseRoleCompany(titleLine) : { role: "", company: "" };

    let start = "";
    let end = "";
    if (adjDateLine) {
      const parts = adjDateLine.split(/\s*[\-–—]\s+/).map((s) => s.trim());
      if (parts.length >= 2) {
        start = parts[0] ?? "";
        end = parts.slice(1).join(" – ");
      } else {
        start = adjDateLine;
      }
    }
    const location = extraMeta.join(" · ").trim();
    out.push({
      degree,
      school,
      location: location || undefined,
      start,
      end,
      details: details.length > 0 ? details.join("\n") : undefined,
    });
  }
  return out.filter((r) => r.degree || r.school || r.details);
}

function looksLikeJobOrDegreeHeaderLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/@/.test(t) || /\s+en\s+/i.test(t) || /\s+at\s+/i.test(t) || /\s*\|\s*/.test(t)) return true;
  if (isLikelyDateLine(t)) return true;
  if (/^(grado|master|máster|licenciatura|bachelor|phd|doctorado|mba)\b/i.test(t)) return true;
  return false;
}

/**
 * Campos sueltos (email, titular corto, resumen) antes del primer bloque que parece experiencia/educación.
 * Solo rellenar en el formulario si esos campos están vacíos.
 */
export function extractLooseCvHeaderFields(norm: string): {
  email?: string;
  headline?: string;
  summary?: string;
  phoneMobile?: string;
} {
  const out: { email?: string; headline?: string; summary?: string; phoneMobile?: string } = {};
  const text = norm.trim();
  if (!text) return out;
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) out.email = emailMatch[0].trim();

  const phoneMatch =
    text.match(/\+\d{1,3}[\d\s().\-]{8,20}\d/) ||
    text.match(/\b(?:\+34|0034)\s*\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3}\b/);
  if (phoneMatch) {
    out.phoneMobile = phoneMatch[0]!.replace(/\s+/g, " ").trim();
  }

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return out;

  const sectionish = /^(experiencia|educaci|formaci|certific|idiomas|tecnolog|work\s*exp|education)/i;
  const first = lines[0]!;
  if (!looksLikeJobOrDegreeHeaderLine(first) && first.length >= 2 && first.length <= 120) {
    out.headline = first;
    const body: string[] = [];
    for (let i = 1; i < lines.length && body.join("\n").length < 1400; i++) {
      const L = lines[i]!;
      if (sectionish.test(L)) break;
      if (looksLikeJobOrDegreeHeaderLine(L) || isBulletLine(L)) break;
      body.push(L);
    }
    const s = body.join("\n").trim();
    if (s.length >= 24) out.summary = s;
  }
  return out;
}

/** Rellena huecos 0–4 como en `migrateCvLinksToSlots` (LinkedIn, GitHub, portfolio, X, web). */
export function extractUrlsForCvSlots(text: string): string[] {
  const slots = Array.from({ length: 5 }, () => "");
  const found: string[] = [];
  const re = /https?:\/\/[^\s<>\]"'()]+|www\.[^\s<>\]"'()]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let u = m[0]!.replace(/[),.;:]+$/g, "");
    if (/^www\./i.test(u)) u = `https://${u}`;
    if (!/^https?:\/\//i.test(u)) continue;
    if (found.includes(u)) continue;
    found.push(u);
  }
  for (const u of found) {
    if (/linkedin\.com/i.test(u)) slots[0] = slots[0] || u;
    else if (/github\.com/i.test(u)) slots[1] = slots[1] || u;
    else if (/skillatlas\.|portfolio|behance\.|dribbble\./i.test(u)) slots[2] = slots[2] || u;
    else if (/twitter\.com|(^|\.)x\.com\//i.test(u)) slots[3] = slots[3] || u;
    else {
      const idx = slots.findIndex((s) => !s);
      if (idx >= 0) slots[idx] = u;
    }
  }
  return slots;
}

export function parseCertificationsFromPaste(text: string): LooseCertificationRow[] {
  const out: LooseCertificationRow[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (/^IDIOM(?:AS|A)\b/i.test(line)) continue;
    if (
      /\b(japonés|japanese|inglés|ingles|francés|frances|alemán|aleman|chino|mandarín)\b/i.test(line) &&
      /\b(n5|n4|b1|b2|c1|c2|iniciación|nativo)\b/i.test(line) &&
      !/certif|AWS|Microsoft|CLF|PL-\d|associate|GCP|Kubernetes/i.test(line)
    ) {
      continue;
    }
    const bullet = /^[-•*\u2022·]\s*(.+)$/.exec(line);
    if (bullet) {
      const inner = bullet[1]!.trim();
      if (/^IDIOM(?:AS|A)\b/i.test(inner)) continue;
      out.push(parseCertificationOneLine(inner));
      continue;
    }
    if (
      line.length > 18 &&
      /certif|associate|AWS|Microsoft|CLF|PL-\d|GCP|Google\s+Cloud|Scrum|Kubernetes|preparaci/i.test(line)
    ) {
      out.push(parseCertificationOneLine(line));
    }
  }
  return out.filter((r) => (r.name ?? "").trim().length > 2);
}

function parseCertificationOneLine(s: string): LooseCertificationRow {
  let name = s.trim();
  let year = "";
  const y = name.match(/\b(20\d{2}|19\d{2})\b/);
  if (y) year = y[1]!;
  name = name.replace(/\s*[–—-]\s*en\s+preparaci[oó]n.*$/i, "").trim();
  return { name, year: year || undefined };
}

export function parseLanguagesFromPaste(text: string): LooseLanguageRow[] {
  const out: LooseLanguageRow[] = [];
  let raw = text.replace(/\r\n/g, "\n").trim();
  raw = raw.replace(/^(idiomas?|languages?)\s*:\s*/im, "");
  const segments = raw.includes("|")
    ? raw.split("|").map((p) => p.trim()).filter(Boolean)
    : raw.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = segments.length > 0 ? segments : [raw];
  for (const chunk of chunks) {
    if (looksLikeLanguageSectionContaminant(chunk)) continue;
    const dash = chunk.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (dash) {
      const name = dash[1]!.trim();
      const level = dash[2]!.trim();
      if (looksLikeLanguageSectionContaminant(name) || looksLikeLanguageSectionContaminant(level)) continue;
      out.push({ name, level });
    } else if (chunk.length > 1) {
      out.push({ name: chunk, level: undefined });
    }
  }
  return out.filter((r) => (r.name ?? "").trim().length > 1);
}
