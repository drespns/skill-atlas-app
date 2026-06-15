/**
 * Comprobaciones heurísticas orientativas para CV frente a parsers tipo ATS.
 * No garantiza compatibilidad con ningún sistema concreto.
 */

export type CvTemplateForAts =
  | "classic"
  | "minimal"
  | "modern"
  | "compact"
  | "mono"
  | "sidebar"
  | "serif"
  | "atlas"
  | "contrast"
  | "focus";

export type AtsCvProfileInput = {
  email?: string;
  phoneMobile?: string;
  phoneLandline?: string;
  summary?: string;
  experiences?: Array<{
    role?: string;
    company?: string;
    start?: string;
    end?: string;
    bullets?: string;
  }>;
  education?: unknown[];
  showHelpStack?: boolean;
  highlights?: string;
  cvSectionVisibility?: Record<string, boolean>;
  /** Cartas guardadas en el perfil (solo se usa presencia para el checklist). */
  coverLetters?: Array<{ body?: string }>;
  /** Rellenado en cliente: bloque tecnologías visible y recuento resuelto. */
  atsTechnologiesVisible?: boolean;
  atsTechnologiesCount?: number;
  cvTargetRole?: string;
  cvWorkArrangement?: string;
  cvWorkAuthorization?: string;
};

/** Claves i18n bajo `cv.ats.*` (mensaje completo por clave). */
export type AtsCheckResult = {
  ok: string[];
  warn: string[];
  info: string[];
};

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBullets(raw: string): string[] {
  return splitLines(raw).map((line) => line.replace(/^[-*•\u2022]\s*/, "").trim());
}

function normalizeBulletForDedupe(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(raw: string): number {
  return raw.trim().split(/\s+/).filter(Boolean).length;
}

function bulletLooksQuantified(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  // Signals such as "30%", "x2", "+15", "3M", "12k", etc.
  return /(\d+([.,]\d+)?\s*%|x\s*\d+|\+\s*\d+|\b\d+([.,]\d+)?\s*(k|m|b)\b|\b\d+[.,]?\d*\b)/i.test(s);
}

function roleKeywords(raw: string): string[] {
  const words = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  const stop = new Set([
    "senior",
    "junior",
    "lead",
    "principal",
    "staff",
    "developer",
    "engineer",
    "analyst",
    "manager",
    "specialist",
  ]);
  return Array.from(new Set(words.filter((w) => !stop.has(w))));
}

function containsOutcomeSignal(raw: string): boolean {
  const s = raw.toLowerCase();
  return /(reduc|aument|increment|improv|improved|decreas|optim|ahorr|saving|impact|resultado|result|conversion|efficien|latenc|uptime|roi|ctr|retention|churn)/i.test(
    s,
  );
}

function normalizeTemplate(raw: string): CvTemplateForAts | string {
  const t = String(raw ?? "").trim();
  if (
    t === "classic" ||
    t === "minimal" ||
    t === "modern" ||
    t === "compact" ||
    t === "mono" ||
    t === "sidebar" ||
    t === "serif" ||
    t === "atlas" ||
    t === "contrast" ||
    t === "focus"
  )
    return t;
  return "classic";
}

export function analyzeCvForAts(profile: AtsCvProfileInput, templateId: string): AtsCheckResult {
  const ok: string[] = [];
  const warn: string[] = [];
  const info: string[] = [];

  const tpl = normalizeTemplate(templateId);

  const email = (profile.email ?? "").trim();
  if (email) ok.push("cv.ats.ok.email");
  else warn.push("cv.ats.warn.noEmail");

  const phone = (profile.phoneMobile ?? "").trim() || (profile.phoneLandline ?? "").trim();
  if (phone) ok.push("cv.ats.ok.phone");
  else info.push("cv.ats.info.noPhone");

  const summary = (profile.summary ?? "").trim();
  if (summary.length >= 80) ok.push("cv.ats.ok.summary");
  else if (summary.length > 0 && summary.length < 40) warn.push("cv.ats.warn.shortSummary");
  else if (!summary) warn.push("cv.ats.warn.noSummary");
  if (summary.length > 1200) warn.push("cv.ats.warn.longSummary");

  const exps = Array.isArray(profile.experiences) ? profile.experiences : [];
  if (exps.length === 0) warn.push("cv.ats.warn.noExperience");
  else {
    let anyBullets = false;
    let missingBullets = 0;
    let missingDates = 0;
    const allBullets: string[] = [];
    let quantifiedBullets = 0;
    let longBullets = 0;
    for (const e of exps) {
      const hasTitle = Boolean((e.role ?? "").trim() || (e.company ?? "").trim());
      if (!hasTitle) continue;
      const bullets = (e.bullets ?? "").trim();
      if (bullets) anyBullets = true;
      else missingBullets++;
      for (const b of parseBullets(bullets)) {
        allBullets.push(b);
        if (bulletLooksQuantified(b)) quantifiedBullets++;
        if (wordCount(b) > 32) longBullets++;
      }
      const st = (e.start ?? "").trim();
      const en = (e.end ?? "").trim();
      if (!st && !en) missingDates++;
    }
    if (anyBullets) ok.push("cv.ats.ok.experienceBullets");
    if (missingBullets > 0) warn.push("cv.ats.warn.expMissingBullets");
    if (missingDates > 0) warn.push("cv.ats.warn.expMissingDates");
    if (allBullets.length >= 3 && quantifiedBullets === 0) warn.push("cv.ats.warn.expNoMetrics");
    if (longBullets >= 2) info.push("cv.ats.info.longBullets");
    if (allBullets.length > 1) {
      const seen = new Set<string>();
      let hasDup = false;
      for (const b of allBullets) {
        const k = normalizeBulletForDedupe(b);
        if (!k) continue;
        if (seen.has(k)) {
          hasDup = true;
          break;
        }
        seen.add(k);
      }
      if (hasDup) warn.push("cv.ats.warn.repeatedBullets");
    }
  }

  const edu = Array.isArray(profile.education) ? profile.education : [];
  if (edu.length === 0) info.push("cv.ats.info.noEducation");

  if (tpl === "sidebar") warn.push("cv.ats.warn.sidebarLayout");
  if (tpl === "atlas") info.push("cv.ats.info.decorativeTemplate");

  const cov = Array.isArray(profile.coverLetters)
    ? profile.coverLetters.filter((c) => String(c?.body ?? "").trim())
    : [];
  if (cov.length > 0) ok.push("cv.ats.ok.coverLetters");

  const targetRole = (profile.cvTargetRole ?? "").trim();
  if (targetRole) ok.push("cv.ats.ok.targetRole");
  else info.push("cv.ats.info.noTargetRole");

  const wa = (profile.cvWorkArrangement ?? "").trim();
  const wb = (profile.cvWorkAuthorization ?? "").trim();
  if (wa || wb) ok.push("cv.ats.ok.workEligibilityLine");

  const vis = profile.cvSectionVisibility ?? {};
  if (vis.summary === false) warn.push("cv.ats.warn.sectionSummaryHidden");
  if (vis.experience === false) warn.push("cv.ats.warn.sectionExperienceHidden");
  if (vis.education === false) info.push("cv.ats.info.sectionEducationHidden");
  if (vis.projects === false) info.push("cv.ats.info.sectionProjectsHidden");
  if (vis.technologies === false) info.push("cv.ats.info.sectionTechnologiesHidden");

  const techVis = profile.atsTechnologiesVisible !== false;
  const techCount = typeof profile.atsTechnologiesCount === "number" ? profile.atsTechnologiesCount : 0;
  if (techVis && techCount >= 4) ok.push("cv.ats.ok.technologiesBlock");
  else if (techVis && techCount > 0 && techCount < 4) info.push("cv.ats.info.fewTechnologiesListed");
  if (techVis && techCount === 0) warn.push("cv.ats.warn.technologiesEmptyVisible");

  const stackOn = profile.showHelpStack !== false;
  const hl = (profile.highlights ?? "").trim();
  if (!stackOn && !hl) info.push("cv.ats.info.keywordsMuted");

  if (targetRole) {
    const kws = roleKeywords(targetRole);
    if (kws.length > 0) {
      const corpus = [summary, hl]
        .concat(exps.map((e) => `${(e.role ?? "").trim()} ${(e.company ?? "").trim()} ${(e.bullets ?? "").trim()}`))
        .join(" ")
        .toLowerCase();
      const covered = kws.filter((k) => corpus.includes(k));
      if (covered.length === 0) warn.push("cv.ats.warn.targetRoleKeywordsMissing");
      else if (covered.length < kws.length) info.push("cv.ats.info.targetRoleKeywordsPartial");
      else ok.push("cv.ats.ok.targetRoleKeywordsAligned");
    }
  }

  if (exps.length > 0) {
    const bullets = exps.flatMap((e) => parseBullets(e.bullets ?? ""));
    if (bullets.length >= 3) {
      const withOutcome = bullets.filter((b) => containsOutcomeSignal(b) || bulletLooksQuantified(b)).length;
      if (withOutcome === 0) warn.push("cv.ats.warn.expResultsWeak");
      else if (withOutcome < Math.ceil(bullets.length / 3)) info.push("cv.ats.info.expResultsMixed");
      else ok.push("cv.ats.ok.expResultsSignal");
    }
  }

  return { ok, warn, info };
}
