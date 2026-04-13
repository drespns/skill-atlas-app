import { applyFontToDocument, normalizeFontId } from "@config/font-catalog";
import { CV_LINK_SLOT_COUNT, migrateCvLinksToSlots, slotsToPersistedLinks } from "@lib/cv-contact-html";
import { isDefaultCvDocumentSectionOrder, normalizeCvDocumentSectionOrder } from "@lib/cv-document-section-order";

export type ThemeMode = "auto" | "light" | "dark";
export type Density = "comfortable" | "compact";
/** Id de fuente (`FONT_CATALOG` en `src/config/font-catalog.ts`). */
export type FontPreset = string;
export type Accent = "indigo" | "emerald" | "rose" | "amber" | "sky" | "violet";
export type Motion = "normal" | "reduced";
export type DefaultView = "cards" | "list";
/** Vista de la lista de evidencias en detalle de proyecto (CSR). */
export type ProjectEvidenceLayout = "large" | "grid" | "list";
export type Lang = "es" | "en";
export type HabitsMarkStyle = "paint" | "fill" | "check";

/** Cómo abrir popovers de la cabecera (idioma / menú usuario). */
export type HeaderPopoverTrigger = "hover" | "click";
/** Escala del texto base de la UI (rem); pensado para pocos saltos seguros. */
export type UiFontScale = "sm" | "md" | "lg";

/** Posición de la barra lateral en /settings. */
export type SettingsSidebarSide = "left" | "right";

/** IDs de panel en `/settings` (hash `#…` y prefs). */
export const SETTINGS_PANEL_IDS = [
  "prefs",
  "shortcuts",
  "portfolio-profile",
  "portfolio-links",
  "portfolio-display",
  "portfolio-presentation",
  "qa",
] as const;
export type SettingsPanelId = (typeof SETTINGS_PANEL_IDS)[number];

/** Hash antiguo `#classic-*` → id actual (prefs y URLs guardadas). */
export const LEGACY_SETTINGS_PANEL_ID: Record<string, SettingsPanelId> = {
  "classic-prefs": "prefs",
  "classic-shortcuts": "shortcuts",
  "classic-portfolio-profile": "portfolio-profile",
  "classic-portfolio-links": "portfolio-links",
  "classic-portfolio-display": "portfolio-display",
  "classic-portfolio-presentation": "portfolio-presentation",
  "classic-cv-public": "portfolio-links",
  "classic-qa": "qa",
};

export function isSettingsPanelId(s: string): s is SettingsPanelId {
  return (SETTINGS_PANEL_IDS as readonly string[]).includes(s);
}

export function migrateSettingsPanelHashFragment(raw: string): SettingsPanelId | null {
  const t = raw.trim();
  if (!t) return null;
  if (t === "cv-public") return "portfolio-links";
  if (isSettingsPanelId(t)) return t;
  const mapped = LEGACY_SETTINGS_PANEL_ID[t];
  return mapped ?? null;
}

export type CvLink = {
  label: string;
  url: string;
};

export type CvExperienceV1 = {
  company?: string;
  role?: string;
  location?: string;
  start?: string;
  end?: string;
  bullets?: string;
};

export type CvEducationV1 = {
  school?: string;
  degree?: string;
  location?: string;
  start?: string;
  end?: string;
  details?: string;
};

export type CvCertificationV1 = {
  name?: string;
  issuer?: string;
  year?: string;
  url?: string;
};

export type CvLanguageV1 = {
  name?: string;
  level?: string;
};

/** Qué bloques del CV se muestran en vista previa / impresión (por defecto todo visible). */
export type CvSectionVisibilityV1 = {
  highlights?: boolean;
  projects?: boolean;
  experience?: boolean;
  education?: boolean;
  certifications?: boolean;
  languages?: boolean;
};

export type CvSocialLinkDisplayV1 = "url" | "icon" | "both";

export type CvTemplateIdV1 = "classic" | "minimal" | "modern" | "compact" | "mono" | "sidebar" | "serif";

export type CvProfileV1 = {
  headline?: string;
  location?: string;
  email?: string;
  /** Móvil u otro teléfono principal (texto libre, p. ej. +34 …). */
  phoneMobile?: string;
  /** Teléfono fijo u otro contacto telefónico. */
  phoneLandline?: string;
  links?: CvLink[];
  /** Resumen del CV (privado). Si falta, se usa `portfolio_profiles.bio` como fallback. */
  summary?: string;
  /** Mostrar chips del stack de ayuda en el CV. */
  showHelpStack?: boolean;
  /** Texto libre (líneas) para experiencia/logros. */
  highlights?: string;
  /** Mostrar foto (avatar de portfolio_profiles.avatar_url) en el CV. */
  showPhoto?: boolean;
  /** Fuente de la foto cuando hay varias opciones. */
  photoSource?: "uploaded" | "linkedin" | "provider";
  experiences?: CvExperienceV1[];
  education?: CvEducationV1[];
  certifications?: CvCertificationV1[];
  languages?: CvLanguageV1[];
  /**
   * URLs fijas por hueco (LinkedIn, GitHub, portfolio, X/Twitter, web).
   * Evita que al filtrar `links` se desalineen etiqueta y URL.
   */
  cvLinkSlots?: string[];
  /** Cómo mostrar enlaces sociales en el CV: texto, icono o ambos. */
  socialLinkDisplay?: CvSocialLinkDisplayV1;
  cvSectionVisibility?: CvSectionVisibilityV1;
  /** Plantilla visual del documento (extensible). */
  cvTemplate?: CvTemplateIdV1;
  /** Orden de bloques del documento CV (Experiencia, Educación, …). */
  cvDocumentSectionOrder?: string[];
  /** Objetivo de extensión al imprimir (1–6 páginas A4 aprox.); ajusta escala tipográfica. */
  cvPrintMaxPages?: number;
  /** Proyecto resaltado en el CV (slug); el resto se muestra en lista compacta. */
  cvFeaturedProjectSlug?: string;
};

/** Máximo de CV guardados por usuario (prefs + sync remoto). */
export const CV_DOCUMENTS_MAX = 5;

/** Un CV con nombre, etiquetas y payload aislado (perfil + proyectos del editor). */
export type CvDocumentSlotV1 = {
  id: string;
  name: string;
  tags: string[];
  /** CV por defecto (enlace público / RPC usa su `cvProfile` espejado en prefs). */
  isMain: boolean;
  cvProfile: CvProfileV1;
  cvProjectSlugs?: string[];
  cvProjectDisplayOrder?: string[];
};

export type AppPrefsV1 = {
  v: 1;
  themeMode: ThemeMode;
  /** Legado: la UI ya no expone densidad; se normaliza siempre a `comfortable`. */
  density: Density;
  font: FontPreset;
  /** Tamaño base del texto de la interfaz (afecta `rem` / Tailwind). */
  uiFontScale: UiFontScale;
  accent: Accent;
  motion: Motion;
  technologiesView: DefaultView;
  projectsView: DefaultView;
  /** Evidencias en /projects/view: fila completa vs cuadrícula compacta. */
  projectEvidenceLayout: ProjectEvidenceLayout;
  showHeaderIcons: boolean;
  showLangSelector: boolean;
  /** Abrir selector de idioma: hover (rápido) o clic (evita aperturas accidentales). */
  headerLangPopover?: HeaderPopoverTrigger;
  /** Abrir menú de cuenta (avatar): hover o clic. */
  headerUserMenuPopover?: HeaderPopoverTrigger;
  /* Pref desactivado en UI: menú del logo (/app vs /) solo hover en cabecera.
  headerHomePopover?: HeaderPopoverTrigger; */
  lang: Lang;
  /** Barra lateral de /settings a izquierda o derecha. */
  settingsSidebarSide: SettingsSidebarSide;
  /** Última sección visible en /settings (sin hash en URL). */
  settingsActiveSection?: SettingsPanelId;
  /**
   * Proyectos mostrados en /cv (slugs, orden conservado).
   * Ausente o `undefined`: todos los proyectos del usuario.
   */
  cvProjectSlugs?: string[];
  /**
   * Orden de la lista de proyectos en el editor del CV (todos visibles; el checkbox marca inclusión).
   * Ausente: mismo orden que la lista cargada del servidor.
   */
  cvProjectDisplayOrder?: string[];
  /** Metadatos del CV (privado) en /cv. */
  cvProfile?: CvProfileV1;
  /** Varios CV (hasta `CV_DOCUMENTS_MAX`); el activo es `cvActiveDocumentId`. */
  cvDocuments?: CvDocumentSlotV1[];
  /** Id del documento CV mostrado en `/cv`. */
  cvActiveDocumentId?: string;
  /** Modo tester (QA): habilita checklist, seed y debug UI en Ajustes. */
  qaTesterMode?: boolean;
  /** Mostrar pestaña IA en bubble (solo invitado; por defecto apagado). */
  showFabAi?: boolean;
  /** Mostrar pestaña Calendario en bubble. */
  showFabCalendar?: boolean;
  /** Mostrar pestaña Curiosidades en bubble. */
  showFabCuriosities?: boolean;
  /** Mostrar pestaña Atajos en bubble. */
  showFabShortcuts?: boolean;
  /** Estilo de marcado en la herramienta de hábitos. */
  habitsMarkStyle?: HabitsMarkStyle;
  /** Recorrido guiado (spotlight): progreso y completados. */
  onboardingV2?: { done?: boolean; step?: number; completedIds?: string[]; dismissed?: boolean };
};

const STORAGE_KEY = "skillatlas_prefs_v1";

const DEFAULT_PREFS: AppPrefsV1 = {
  v: 1,
  themeMode: "auto",
  density: "comfortable",
  font: "system",
  uiFontScale: "md",
  accent: "indigo",
  motion: "normal",
  technologiesView: "cards",
  projectsView: "cards",
  projectEvidenceLayout: "large",
  showHeaderIcons: true,
  showLangSelector: false,
  headerLangPopover: "hover",
  headerUserMenuPopover: "click",
  // headerHomePopover: "hover",
  lang: "es",
  settingsSidebarSide: "left",
  cvProfile: {},
  qaTesterMode: false,
  showFabAi: false,
  showFabCalendar: true,
  showFabCuriosities: true,
  showFabShortcuts: true,
  habitsMarkStyle: "paint",
  onboardingV2: { done: false, step: 0, completedIds: [], dismissed: false },
};

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeSettingsSidebarSide(raw: unknown): SettingsSidebarSide {
  return raw === "right" ? "right" : "left";
}

function normalizeSettingsActiveSection(raw: unknown): SettingsPanelId | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw === "cv-public") return "portfolio-links";
  if (isSettingsPanelId(raw)) return raw;
  const migrated = LEGACY_SETTINGS_PANEL_ID[raw];
  return migrated && isSettingsPanelId(migrated) ? migrated : undefined;
}

function normalizeProjectEvidenceLayout(raw: unknown): ProjectEvidenceLayout {
  if (raw === "grid" || raw === "large" || raw === "list") return raw;
  return "large";
}

function normalizeUiFontScale(raw: unknown): UiFontScale {
  if (raw === "sm" || raw === "lg") return raw;
  return "md";
}

function normalizeHabitsMarkStyle(raw: unknown): HabitsMarkStyle {
  return raw === "fill" || raw === "check" ? raw : "paint";
}

function normalizeCvProjectSlugs(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length > 0 ? Array.from(new Set(out)) : [];
}

function normalizeCvProjectDisplayOrder(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

const CV_LINK_CANON_LABELS = ["LinkedIn", "GitHub", "Portfolio", "X / Twitter", "Web"];

function normalizeCvProfile(raw: unknown): CvProfileV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as any;
  const headline = typeof r.headline === "string" ? r.headline.trim() : "";
  const location = typeof r.location === "string" ? r.location.trim() : "";
  const email = typeof r.email === "string" ? r.email.trim() : "";
  const phoneMobile = typeof r.phoneMobile === "string" ? r.phoneMobile.trim() : "";
  const phoneLandline = typeof r.phoneLandline === "string" ? r.phoneLandline.trim() : "";
  const summary = typeof r.summary === "string" ? r.summary.trim() : "";
  const highlights = typeof r.highlights === "string" ? r.highlights.trim() : "";
  const showHelpStack = typeof r.showHelpStack === "boolean" ? r.showHelpStack : undefined;
  const showPhoto = typeof r.showPhoto === "boolean" ? r.showPhoto : undefined;
  const photoSource =
    r.photoSource === "uploaded" || r.photoSource === "linkedin" || r.photoSource === "provider"
      ? (r.photoSource as "uploaded" | "linkedin" | "provider")
      : undefined;
  const linksRaw = Array.isArray(r.links) ? r.links : [];
  const legacyPairs: CvLink[] = linksRaw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const rx = x as any;
      const label = typeof rx.label === "string" ? rx.label.trim() : "";
      const url = typeof rx.url === "string" ? rx.url.trim() : "";
      if (!label && !url) return null;
      return { label: label || "Link", url };
    })
    .filter((x): x is CvLink => Boolean(x));

  let cvLinkSlots: string[] = Array.from({ length: CV_LINK_SLOT_COUNT }, () => "");
  const rawSlots = Array.isArray(r.cvLinkSlots) ? r.cvLinkSlots : null;
  if (rawSlots && rawSlots.length === CV_LINK_SLOT_COUNT) {
    cvLinkSlots = rawSlots.map((x: unknown) => (typeof x === "string" ? x.trim() : ""));
  } else {
    cvLinkSlots = migrateCvLinksToSlots(legacyPairs);
  }

  const links = slotsToPersistedLinks(cvLinkSlots, CV_LINK_CANON_LABELS);

  const out: CvProfileV1 = {};
  if (headline) out.headline = headline;
  if (location) out.location = location;
  if (email) out.email = email;
  if (phoneMobile) out.phoneMobile = phoneMobile;
  if (phoneLandline) out.phoneLandline = phoneLandline;
  if (summary) out.summary = summary;
  if (highlights) out.highlights = highlights;
  if (showHelpStack !== undefined) out.showHelpStack = showHelpStack;
  if (showPhoto !== undefined) out.showPhoto = showPhoto;
  if (photoSource !== undefined) out.photoSource = photoSource;
  if (links.length > 0) out.links = links.slice(0, 6);
  if (cvLinkSlots.some((s) => s.length > 0)) out.cvLinkSlots = cvLinkSlots;

  const disp = r.socialLinkDisplay;
  if (disp === "url" || disp === "icon" || disp === "both") out.socialLinkDisplay = disp;

  const tpl = r.cvTemplate;
  if (
    tpl === "classic" ||
    tpl === "minimal" ||
    tpl === "modern" ||
    tpl === "compact" ||
    tpl === "mono" ||
    tpl === "sidebar" ||
    tpl === "serif"
  )
    out.cvTemplate = tpl;

  if (r.cvSectionVisibility && typeof r.cvSectionVisibility === "object") {
    const v = r.cvSectionVisibility as Record<string, unknown>;
    const vis: CvSectionVisibilityV1 = {};
    for (const k of ["highlights", "projects", "experience", "education", "certifications", "languages"] as const) {
      if (typeof v[k] === "boolean") (vis as any)[k] = v[k];
    }
    if (Object.keys(vis).length > 0) out.cvSectionVisibility = vis;
  }

  const expRaw = Array.isArray(r.experiences) ? r.experiences : [];
  const experiences = expRaw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const rx = x as any;
      const company = typeof rx.company === "string" ? rx.company.trim() : "";
      const role = typeof rx.role === "string" ? rx.role.trim() : "";
      const location = typeof rx.location === "string" ? rx.location.trim() : "";
      const start = typeof rx.start === "string" ? rx.start.trim() : "";
      const end = typeof rx.end === "string" ? rx.end.trim() : "";
      const bullets = typeof rx.bullets === "string" ? rx.bullets.trim() : "";
      if (!company && !role && !bullets) return null;
      return { company, role, location, start, end, bullets } as CvExperienceV1;
    })
    .filter(Boolean) as CvExperienceV1[];
  if (experiences.length > 0) out.experiences = experiences.slice(0, 12);

  const eduRaw = Array.isArray(r.education) ? r.education : [];
  const education = eduRaw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const rx = x as any;
      const school = typeof rx.school === "string" ? rx.school.trim() : "";
      const degree = typeof rx.degree === "string" ? rx.degree.trim() : "";
      const location = typeof rx.location === "string" ? rx.location.trim() : "";
      const start = typeof rx.start === "string" ? rx.start.trim() : "";
      const end = typeof rx.end === "string" ? rx.end.trim() : "";
      const details = typeof rx.details === "string" ? rx.details.trim() : "";
      if (!school && !degree && !details) return null;
      return { school, degree, location, start, end, details } as CvEducationV1;
    })
    .filter(Boolean) as CvEducationV1[];
  if (education.length > 0) out.education = education.slice(0, 12);

  const certRaw = Array.isArray(r.certifications) ? r.certifications : [];
  const certifications = certRaw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const rx = x as any;
      const name = typeof rx.name === "string" ? rx.name.trim() : "";
      const issuer = typeof rx.issuer === "string" ? rx.issuer.trim() : "";
      const year = typeof rx.year === "string" ? rx.year.trim() : "";
      const url = typeof rx.url === "string" ? rx.url.trim() : "";
      if (!name && !issuer && !year && !url) return null;
      return { name, issuer, year, url } as CvCertificationV1;
    })
    .filter(Boolean) as CvCertificationV1[];
  if (certifications.length > 0) out.certifications = certifications.slice(0, 16);

  const langRaw = Array.isArray(r.languages) ? r.languages : [];
  const languages = langRaw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const rx = x as any;
      const name = typeof rx.name === "string" ? rx.name.trim() : "";
      const level = typeof rx.level === "string" ? rx.level.trim() : "";
      if (!name && !level) return null;
      return { name, level } as CvLanguageV1;
    })
    .filter(Boolean) as CvLanguageV1[];
  if (languages.length > 0) out.languages = languages.slice(0, 16);

  const docOrder = normalizeCvDocumentSectionOrder(r.cvDocumentSectionOrder);
  if (!isDefaultCvDocumentSectionOrder(docOrder)) out.cvDocumentSectionOrder = docOrder;

  const ppm = Number(r.cvPrintMaxPages);
  if (Number.isFinite(ppm)) {
    const n = Math.round(ppm);
    if (n >= 1 && n <= 6) out.cvPrintMaxPages = n;
  }

  const feat = typeof r.cvFeaturedProjectSlug === "string" ? r.cvFeaturedProjectSlug.trim() : "";
  if (feat) out.cvFeaturedProjectSlug = feat;

  return out;
}

export function newCvDocumentId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCvDocumentTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, 24);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

function normalizeCvDocumentSlot(raw: unknown, fallbackProfile: CvProfileV1): CvDocumentSlotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
  if (!id) return null;
  let name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
  if (!name) name = "CV";
  const prof = normalizeCvProfile(r.cvProfile) ?? fallbackProfile;
  return {
    id,
    name,
    tags: normalizeCvDocumentTags(r.tags),
    isMain: Boolean(r.isMain),
    cvProfile: prof,
    cvProjectSlugs: normalizeCvProjectSlugs(r.cvProjectSlugs),
    cvProjectDisplayOrder: normalizeCvProjectDisplayOrder(r.cvProjectDisplayOrder),
  };
}

function mirrorMainDocumentsToTopLevel(documents: CvDocumentSlotV1[]): {
  cvProfile: CvProfileV1;
  cvProjectSlugs?: string[];
  cvProjectDisplayOrder?: string[];
} {
  const main = documents.find((d) => d.isMain) ?? documents[0];
  if (!main) return { cvProfile: {} };
  return {
    cvProfile: JSON.parse(JSON.stringify(main.cvProfile)) as CvProfileV1,
    cvProjectSlugs: main.cvProjectSlugs,
    cvProjectDisplayOrder: main.cvProjectDisplayOrder,
  };
}

/** Garantiza `cvDocuments`, `cvActiveDocumentId` y espejo top-level desde el CV principal (RPC público). */
export function migrateCvDocumentsIntoPrefs(prefs: AppPrefsV1): AppPrefsV1 {
  const baseProfile = prefs.cvProfile ?? {};
  const rawDocs = prefs.cvDocuments;
  let documents: CvDocumentSlotV1[] = [];

  if (Array.isArray(rawDocs) && rawDocs.length > 0) {
    for (const row of rawDocs) {
      const slot = normalizeCvDocumentSlot(row, baseProfile);
      if (slot) documents.push(slot);
    }
  }

  if (documents.length === 0) {
    documents = [
      {
        id: newCvDocumentId(),
        name: "Principal",
        tags: [],
        isMain: true,
        cvProfile: normalizeCvProfile(baseProfile) ?? {},
        cvProjectSlugs: normalizeCvProjectSlugs(prefs.cvProjectSlugs),
        cvProjectDisplayOrder: normalizeCvProjectDisplayOrder(prefs.cvProjectDisplayOrder),
      },
    ];
  }

  documents = documents.slice(0, CV_DOCUMENTS_MAX);

  const mains = documents.filter((d) => d.isMain);
  if (mains.length === 0) documents[0] = { ...documents[0]!, isMain: true };
  if (mains.length > 1) {
    let seen = false;
    documents = documents.map((d) => {
      if (!d.isMain) return d;
      if (!seen) {
        seen = true;
        return d;
      }
      return { ...d, isMain: false };
    });
  }

  let activeId =
    typeof prefs.cvActiveDocumentId === "string" && prefs.cvActiveDocumentId.trim()
      ? prefs.cvActiveDocumentId.trim()
      : "";
  if (!documents.some((d) => d.id === activeId)) {
    const main = documents.find((d) => d.isMain) ?? documents[0]!;
    activeId = main.id;
  }

  const mirror = mirrorMainDocumentsToTopLevel(documents);
  return {
    ...prefs,
    cvDocuments: documents,
    cvActiveDocumentId: activeId,
    cvProfile: mirror.cvProfile,
    cvProjectSlugs: mirror.cvProjectSlugs,
    cvProjectDisplayOrder: mirror.cvProjectDisplayOrder,
  };
}

export function buildCvDocumentsPrefsPatch(
  documents: CvDocumentSlotV1[],
  activeId: string,
): Pick<AppPrefsV1, "cvDocuments" | "cvActiveDocumentId" | "cvProfile" | "cvProjectSlugs" | "cvProjectDisplayOrder"> {
  const mirror = mirrorMainDocumentsToTopLevel(documents);
  return {
    cvDocuments: documents,
    cvActiveDocumentId: activeId,
    cvProfile: mirror.cvProfile,
    cvProjectSlugs: mirror.cvProjectSlugs,
    cvProjectDisplayOrder: mirror.cvProjectDisplayOrder,
  };
}

export function loadPrefs(): AppPrefsV1 {
  const inferredLang: Lang = (() => {
    try {
      const navLang = (navigator.language || "").toLowerCase();
      if (navLang.startsWith("es")) return "es";
      if (navLang.startsWith("en")) return "en";
    } catch {
      // ignore
    }
    return DEFAULT_PREFS.lang;
  })();

  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!parsed || typeof parsed !== "object") return migrateLegacyPrefs({ ...DEFAULT_PREFS, lang: inferredLang });

  const p = parsed as Partial<AppPrefsV1>;
  const baseObj: Record<string, unknown> = p.v === 1 ? { ...(p as object as Record<string, unknown>) } : {};
  delete baseObj.onboardingV1;
  const base = baseObj as Partial<AppPrefsV1>;
  const merged: AppPrefsV1 = {
    ...DEFAULT_PREFS,
    ...base,
    v: 1,
    settingsSidebarSide: normalizeSettingsSidebarSide(
      (base as Partial<AppPrefsV1>).settingsSidebarSide ?? DEFAULT_PREFS.settingsSidebarSide,
    ),
    settingsActiveSection: normalizeSettingsActiveSection((base as Partial<AppPrefsV1>).settingsActiveSection),
    cvProjectSlugs: normalizeCvProjectSlugs((base as Partial<AppPrefsV1>).cvProjectSlugs),
    cvProjectDisplayOrder: normalizeCvProjectDisplayOrder((base as Partial<AppPrefsV1>).cvProjectDisplayOrder),
    cvProfile: normalizeCvProfile((base as Partial<AppPrefsV1>).cvProfile) ?? DEFAULT_PREFS.cvProfile,
    qaTesterMode: typeof (base as any).qaTesterMode === "boolean" ? Boolean((base as any).qaTesterMode) : false,
    showFabAi: typeof (base as any).showFabAi === "boolean" ? Boolean((base as any).showFabAi) : DEFAULT_PREFS.showFabAi,
    showFabCalendar:
      typeof (base as any).showFabCalendar === "boolean"
        ? Boolean((base as any).showFabCalendar)
        : DEFAULT_PREFS.showFabCalendar,
    showFabCuriosities:
      typeof (base as any).showFabCuriosities === "boolean"
        ? Boolean((base as any).showFabCuriosities)
        : DEFAULT_PREFS.showFabCuriosities,
    showFabShortcuts:
      typeof (base as any).showFabShortcuts === "boolean"
        ? Boolean((base as any).showFabShortcuts)
        : DEFAULT_PREFS.showFabShortcuts,
    habitsMarkStyle: normalizeHabitsMarkStyle((base as any).habitsMarkStyle ?? DEFAULT_PREFS.habitsMarkStyle),
    onboardingV2: (() => {
      const raw = (base as any)?.onboardingV2;
      if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS.onboardingV2 };
      const done = typeof raw.done === "boolean" ? Boolean(raw.done) : false;
      const step = Number.isFinite(Number(raw.step)) ? Number(raw.step) : 0;
      const completedIds = Array.isArray(raw.completedIds)
        ? raw.completedIds
            .filter((x: unknown): x is string => typeof x === "string")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];
      const dismissed = typeof raw.dismissed === "boolean" ? Boolean(raw.dismissed) : false;
      return { done, step, dismissed, completedIds: Array.from(new Set(completedIds)).slice(0, 30) };
    })(),
    projectEvidenceLayout: normalizeProjectEvidenceLayout((base as Partial<AppPrefsV1>).projectEvidenceLayout),
    font: normalizeFontId((base as Partial<AppPrefsV1>).font ?? DEFAULT_PREFS.font),
    uiFontScale: normalizeUiFontScale((base as Partial<AppPrefsV1>).uiFontScale),
    headerLangPopover: normalizeHeaderPopoverTrigger(
      (base as Partial<AppPrefsV1>).headerLangPopover,
      DEFAULT_PREFS.headerLangPopover,
    ),
    headerUserMenuPopover: normalizeHeaderPopoverTrigger(
      (base as Partial<AppPrefsV1>).headerUserMenuPopover,
      DEFAULT_PREFS.headerUserMenuPopover,
    ),
    /* headerHomePopover: normalizeHeaderPopoverTrigger(
      (base as Partial<AppPrefsV1>).headerHomePopover,
      DEFAULT_PREFS.headerHomePopover,
    ), */
  };

  return finalizeAppPrefs(migrateLegacyPrefs(migrateCvDocumentsIntoPrefs(merged as AppPrefsV1)));
}

function normalizeUiLang(raw: unknown): Lang {
  return raw === "en" ? "en" : "es";
}

function normalizeHeaderPopoverTrigger(raw: unknown, fallback: HeaderPopoverTrigger): HeaderPopoverTrigger {
  return raw === "hover" || raw === "click" ? raw : fallback;
}

/** Densidad de shell fija; escala de texto normalizada; idioma UI es | en. */
function finalizeAppPrefs(prefs: AppPrefsV1): AppPrefsV1 {
  return {
    ...prefs,
    lang: normalizeUiLang(prefs.lang),
    density: "comfortable",
    uiFontScale: normalizeUiFontScale(prefs.uiFontScale),
  };
}

function migrateLegacyPrefs(prefs: AppPrefsV1): AppPrefsV1 {
  // Back-compat with older theme storage ("theme" => "dark" | "light")
  const legacyTheme = localStorage.getItem("theme");
  let next = prefs;
  if (legacyTheme === "dark" || legacyTheme === "light") {
    next = { ...next, themeMode: legacyTheme };
  }

  // Back-compat with older lang storage ("lang" => "es" | "en")
  const legacyLang = localStorage.getItem("lang");
  if (legacyLang === "es" || legacyLang === "en") {
    next = { ...next, lang: legacyLang };
  }

  return next;
}

export function savePrefs(next: AppPrefsV1) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function updatePrefs(patch: Partial<Omit<AppPrefsV1, "v">>): AppPrefsV1 {
  const current = loadPrefs();
  const next: AppPrefsV1 = finalizeAppPrefs({
    ...current,
    ...patch,
    v: 1,
    font: normalizeFontId(patch.font !== undefined ? patch.font : current.font),
    uiFontScale: normalizeUiFontScale(patch.uiFontScale !== undefined ? patch.uiFontScale : current.uiFontScale),
  });
  savePrefs(next);
  applyPrefs(next);
  window.dispatchEvent(new CustomEvent("skillatlas:prefs-updated", { detail: next }));
  return next;
}

/**
 * Fusiona `user_prefs` remoto. Los modos hover|clic de cabecera **siempre** se toman de `loadPrefs()`
 * (estado local antes de escribir), no del remoto: el servidor puede ir atrasado y el merge `{ local, …remote }`
 * pisaba “Al pasar el cursor”. Restaurar solo desde JSON crudo tampoco sirve: tras un merge remoto el local
 * ya contiene esas claves, y quedaba bloqueado en `click`.
 */
export function mergeRemoteUserPrefs(remote: unknown): void {
  if (!remote || typeof remote !== "object") return;
  const incoming = remote as Record<string, unknown>;
  const local = loadPrefs();
  const merged: Record<string, unknown> = { ...local, ...incoming, v: 1 };

  if (incoming.cvDocuments !== undefined && Array.isArray(incoming.cvDocuments) && incoming.cvDocuments.length > 0) {
    const draft: AppPrefsV1 = {
      ...(local as AppPrefsV1),
      cvDocuments: incoming.cvDocuments as CvDocumentSlotV1[],
      cvActiveDocumentId:
        typeof incoming.cvActiveDocumentId === "string" && incoming.cvActiveDocumentId.trim()
          ? incoming.cvActiveDocumentId.trim()
          : local.cvActiveDocumentId,
    };
    const norm = migrateCvDocumentsIntoPrefs(draft);
    merged.cvDocuments = norm.cvDocuments;
    merged.cvActiveDocumentId = norm.cvActiveDocumentId;
    merged.cvProfile = norm.cvProfile;
    merged.cvProjectSlugs = norm.cvProjectSlugs;
    merged.cvProjectDisplayOrder = norm.cvProjectDisplayOrder;
  } else if (incoming.cvProfile && typeof incoming.cvProfile === "object") {
    if (local.cvDocuments && local.cvDocuments.length > 0) {
      const docs = local.cvDocuments.map((d) => ({
        ...d,
        cvProfile: { ...(d.cvProfile ?? {}) },
      }));
      const mainIdx = docs.findIndex((d) => d.isMain);
      const i = mainIdx >= 0 ? mainIdx : 0;
      const cur = docs[i]!;
      docs[i] = {
        ...cur,
        cvProfile: { ...(cur.cvProfile ?? {}), ...(incoming.cvProfile as object) } as CvProfileV1,
      };
      const patch = buildCvDocumentsPrefsPatch(docs, local.cvActiveDocumentId ?? cur.id);
      merged.cvDocuments = patch.cvDocuments;
      merged.cvActiveDocumentId = patch.cvActiveDocumentId;
      merged.cvProfile = patch.cvProfile;
      merged.cvProjectSlugs = patch.cvProjectSlugs;
      merged.cvProjectDisplayOrder = patch.cvProjectDisplayOrder;
    } else {
      merged.cvProfile = { ...((local as any).cvProfile ?? {}), ...(incoming.cvProfile as object) };
    }
  }

  merged.headerLangPopover = local.headerLangPopover;
  merged.headerUserMenuPopover = local.headerUserMenuPopover;
  // Prefer local for high-churn UI prefs to avoid race conditions on first hydrate.
  merged.habitsMarkStyle = local.habitsMarkStyle;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  const next = loadPrefs();
  applyPrefs(next);
  window.dispatchEvent(new CustomEvent("skillatlas:prefs-updated", { detail: next }));
}

export function applyPrefs(prefs: AppPrefsV1) {
  const root = document.documentElement;
  const p = finalizeAppPrefs(prefs);

  root.dataset.themeMode = p.themeMode;
  root.dataset.density = p.density;
  root.dataset.accent = p.accent;
  root.dataset.motion = prefs.motion;
  root.dataset.technologiesView = p.technologiesView;
  root.dataset.projectsView = p.projectsView;
  root.dataset.projectEvidenceLayout = p.projectEvidenceLayout;
  root.dataset.showHeaderIcons = p.showHeaderIcons ? "true" : "false";
  root.dataset.showLangSelector = p.showLangSelector ? "true" : "false";
  root.dataset.langPref = p.lang;
  root.dataset.settingsSidebarSide = p.settingsSidebarSide;
  root.dataset.uiFontScale = p.uiFontScale;
  root.dataset.headerLangPopover = p.headerLangPopover ?? "hover";
  root.dataset.headerUserMenuPopover = p.headerUserMenuPopover ?? "click";
  // root.dataset.headerHomePopover = p.headerHomePopover ?? "hover";
  root.dataset.habitsMarkStyle = p.habitsMarkStyle ?? "paint";

  // Theme
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const isDark =
    p.themeMode === "dark" ? true : p.themeMode === "light" ? false : Boolean(prefersDark);

  root.classList.toggle("dark", isDark);
  root.dataset.theme = isDark ? "dark" : "light";
  root.style.colorScheme = isDark ? "dark" : "light";

  applyFontToDocument(p.font);

  // Shell paddings (densidad fija “cómoda”)
  const mainPy = "1.5rem";
  const mainPx = "1.25rem";
  const headerPy = "1rem";
  const headerPx = "1.25rem";
  root.style.setProperty("--app-main-py", mainPy);
  root.style.setProperty("--app-main-px", mainPx);
  root.style.setProperty("--app-header-py", headerPy);
  root.style.setProperty("--app-header-px", headerPx);

  const rootFontPct = p.uiFontScale === "sm" ? "93.75%" : p.uiFontScale === "lg" ? "106.25%" : "100%";
  root.style.setProperty("--app-root-font-size", rootFontPct);

  // Accent (HSL is easy to reuse in CSS)
  const accentHsl =
    p.accent === "emerald"
      ? "152 76% 36%"
      : p.accent === "rose"
        ? "346 77% 49%"
        : p.accent === "amber"
          ? "38 92% 50%"
          : p.accent === "sky"
            ? "199 89% 48%"
            : p.accent === "violet"
              ? "262 83% 58%"
              : "239 84% 67%"; // indigo default
  root.style.setProperty("--app-accent-hsl", accentHsl);

  // Motion
  root.style.setProperty("--app-motion", p.motion);
}

