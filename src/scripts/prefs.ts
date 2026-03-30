export type ThemeMode = "auto" | "light" | "dark";
export type Density = "comfortable" | "compact";
export type FontPreset = "system" | "inter" | "mono";
export type Accent = "indigo" | "emerald" | "rose" | "amber" | "sky" | "violet";
export type Motion = "normal" | "reduced";
export type DefaultView = "cards" | "list";
export type Lang = "es" | "en";

export const SETTINGS_SECTION_IDS = ["prefs", "shortcuts", "account", "portfolio"] as const;
export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export type SettingsGridColumns = 1 | 2 | 3 | 4;

export type AppPrefsV1 = {
  v: 1;
  themeMode: ThemeMode;
  density: Density;
  font: FontPreset;
  accent: Accent;
  motion: Motion;
  technologiesView: DefaultView;
  projectsView: DefaultView;
  showHeaderIcons: boolean;
  showLangSelector: boolean;
  lang: Lang;
  /** Grid de la página Ajustes (≥ md). */
  settingsGridColumns: SettingsGridColumns;
  /** Orden de las tarjetas en Ajustes. */
  settingsSectionOrder: SettingsSectionId[];
};

const STORAGE_KEY = "skillatlas_prefs_v1";

const DEFAULT_PREFS: AppPrefsV1 = {
  v: 1,
  themeMode: "auto",
  density: "comfortable",
  font: "system",
  accent: "indigo",
  motion: "normal",
  technologiesView: "cards",
  projectsView: "cards",
  showHeaderIcons: true,
  showLangSelector: true,
  lang: "es",
  settingsGridColumns: 2,
  settingsSectionOrder: [...SETTINGS_SECTION_IDS],
};

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clampSettingsColumns(n: unknown): SettingsGridColumns {
  const x = Number(n);
  if (!Number.isFinite(x)) return 2;
  if (x < 1) return 1;
  if (x > 4) return 4;
  return x as SettingsGridColumns;
}

function normalizeSectionOrder(raw: unknown): SettingsSectionId[] {
  const allowed = new Set<string>(SETTINGS_SECTION_IDS);
  const out: SettingsSectionId[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === "string" && allowed.has(x) && !seen.has(x)) {
        out.push(x as SettingsSectionId);
        seen.add(x);
      }
    }
  }
  for (const id of SETTINGS_SECTION_IDS) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function loadPrefs(): AppPrefsV1 {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!parsed || typeof parsed !== "object") return migrateLegacyPrefs(DEFAULT_PREFS);

  const p = parsed as Partial<AppPrefsV1>;
  const base = p.v === 1 ? p : {};
  const merged: AppPrefsV1 = {
    ...DEFAULT_PREFS,
    ...base,
    v: 1,
    settingsGridColumns: clampSettingsColumns(base.settingsGridColumns ?? DEFAULT_PREFS.settingsGridColumns),
    settingsSectionOrder: normalizeSectionOrder(base.settingsSectionOrder ?? DEFAULT_PREFS.settingsSectionOrder),
  };

  return migrateLegacyPrefs(merged);
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
  const next: AppPrefsV1 = { ...current, ...patch, v: 1 };
  savePrefs(next);
  applyPrefs(next);
  return next;
}

export function applyPrefs(prefs: AppPrefsV1) {
  const root = document.documentElement;

  root.dataset.themeMode = prefs.themeMode;
  root.dataset.density = prefs.density;
  root.dataset.font = prefs.font;
  root.dataset.accent = prefs.accent;
  root.dataset.motion = prefs.motion;
  root.dataset.technologiesView = prefs.technologiesView;
  root.dataset.projectsView = prefs.projectsView;
  root.dataset.showHeaderIcons = prefs.showHeaderIcons ? "true" : "false";
  root.dataset.showLangSelector = prefs.showLangSelector ? "true" : "false";
  root.dataset.langPref = prefs.lang;

  // Theme
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const isDark =
    prefs.themeMode === "dark" ? true : prefs.themeMode === "light" ? false : Boolean(prefersDark);

  root.classList.toggle("dark", isDark);
  root.dataset.theme = isDark ? "dark" : "light";
  root.style.colorScheme = isDark ? "dark" : "light";

  // Font
  const fontFamily =
    prefs.font === "mono"
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      : prefs.font === "inter"
        ? 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"'
        : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"';
  root.style.setProperty("--app-font-family", fontFamily);

  // Density (affects AppShell paddings)
  const mainPy = prefs.density === "compact" ? "1rem" : "1.5rem";
  const mainPx = prefs.density === "compact" ? "1rem" : "1.25rem";
  const headerPy = prefs.density === "compact" ? "0.75rem" : "1rem";
  const headerPx = prefs.density === "compact" ? "1rem" : "1.25rem";
  root.style.setProperty("--app-main-py", mainPy);
  root.style.setProperty("--app-main-px", mainPx);
  root.style.setProperty("--app-header-py", headerPy);
  root.style.setProperty("--app-header-px", headerPx);

  // Accent (HSL is easy to reuse in CSS)
  const accentHsl =
    prefs.accent === "emerald"
      ? "152 76% 36%"
      : prefs.accent === "rose"
        ? "346 77% 49%"
        : prefs.accent === "amber"
          ? "38 92% 50%"
          : prefs.accent === "sky"
            ? "199 89% 48%"
            : prefs.accent === "violet"
              ? "262 83% 58%"
              : "239 84% 67%"; // indigo default
  root.style.setProperty("--app-accent-hsl", accentHsl);

  // Motion
  root.style.setProperty("--app-motion", prefs.motion);
}

