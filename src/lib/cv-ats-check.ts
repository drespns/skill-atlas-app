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
  | "serif";

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
};

/** Claves i18n bajo `cv.ats.*` (mensaje completo por clave). */
export type AtsCheckResult = {
  ok: string[];
  warn: string[];
  info: string[];
};

function normalizeTemplate(raw: string): CvTemplateForAts | string {
  const t = String(raw ?? "").trim();
  if (
    t === "classic" ||
    t === "minimal" ||
    t === "modern" ||
    t === "compact" ||
    t === "mono" ||
    t === "sidebar" ||
    t === "serif"
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

  const exps = Array.isArray(profile.experiences) ? profile.experiences : [];
  if (exps.length === 0) warn.push("cv.ats.warn.noExperience");
  else {
    let anyBullets = false;
    let missingBullets = 0;
    let missingDates = 0;
    for (const e of exps) {
      const hasTitle = Boolean((e.role ?? "").trim() || (e.company ?? "").trim());
      if (!hasTitle) continue;
      const bullets = (e.bullets ?? "").trim();
      if (bullets) anyBullets = true;
      else missingBullets++;
      const st = (e.start ?? "").trim();
      const en = (e.end ?? "").trim();
      if (!st && !en) missingDates++;
    }
    if (anyBullets) ok.push("cv.ats.ok.experienceBullets");
    if (missingBullets > 0) warn.push("cv.ats.warn.expMissingBullets");
    if (missingDates > 0) warn.push("cv.ats.warn.expMissingDates");
  }

  const edu = Array.isArray(profile.education) ? profile.education : [];
  if (edu.length === 0) info.push("cv.ats.info.noEducation");

  if (tpl === "sidebar") warn.push("cv.ats.warn.sidebarLayout");

  const vis = profile.cvSectionVisibility ?? {};
  if (vis.experience === false) warn.push("cv.ats.warn.sectionExperienceHidden");
  if (vis.education === false) info.push("cv.ats.info.sectionEducationHidden");
  if (vis.projects === false) info.push("cv.ats.info.sectionProjectsHidden");

  const stackOn = profile.showHelpStack !== false;
  const hl = (profile.highlights ?? "").trim();
  if (!stackOn && !hl) info.push("cv.ats.info.keywordsMuted");

  return { ok, warn, info };
}
