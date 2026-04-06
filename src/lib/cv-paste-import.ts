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

function splitBlocks(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/** Línea con rango de fechas (años o mes+año). */
function isLikelyDateLine(s: string): boolean {
  const t = s.trim();
  if (/presente|present|actual|hoy|now/i.test(t)) return true;
  if (/\d{4}\s*[\-–—]\s*(\d{4}|presente|present|actual)/i.test(t)) return true;
  if (/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(t) && /\d{4}/.test(t)) return true;
  if (/^\d{4}\s*[\-–—]\s*\d{1,2}\b/.test(t)) return true;
  return false;
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
  return line.replace(/^[-•*]\s+/, "").trim();
}

function isBulletLine(line: string): boolean {
  return /^[-•*]\s+/.test(line.trim());
}

/**
 * Cada bloque = un puesto o formación: primera línea título (rol en empresa o título en centro),
 * opcional línea de fechas, resto bullets → bullets/details.
 */
export function parseExperienceBlocksFromPaste(raw: string): LooseExperienceRow[] {
  const out: LooseExperienceRow[] = [];
  for (const block of splitBlocks(raw)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
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
      if (!dateLine && isLikelyDateLine(m)) dateLine = m;
      else restMeta.push(m);
    }
    const titleLine = restMeta[0] ?? "";
    const extraMeta = restMeta.slice(1);
    const { role, company } = titleLine ? parseRoleCompany(titleLine) : { role: "", company: "" };
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
  return out.filter((r) => r.role || r.company || r.bullets);
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
    let dateLine = "";
    const restMeta: string[] = [];
    for (const m of meta) {
      if (!dateLine && isLikelyDateLine(m)) dateLine = m;
      else restMeta.push(m);
    }
    const titleLine = restMeta[0] ?? "";
    const extraMeta = restMeta.slice(1);
    const { role: degree, company: school } = titleLine ? parseRoleCompany(titleLine) : { role: "", company: "" };
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
