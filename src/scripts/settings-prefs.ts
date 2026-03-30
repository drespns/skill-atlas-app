import {
  loadPrefs,
  updatePrefs,
  type Accent,
  type Density,
  type DefaultView,
  type FontPreset,
  type Lang,
  type Motion,
  type ThemeMode,
} from "./prefs";

function isThemeMode(v: string): v is ThemeMode {
  return v === "auto" || v === "light" || v === "dark";
}
function isDensity(v: string): v is Density {
  return v === "comfortable" || v === "compact";
}
function isFont(v: string): v is FontPreset {
  return v === "system" || v === "inter" || v === "mono";
}
function isAccent(v: string): v is Accent {
  return v === "indigo" || v === "emerald" || v === "rose" || v === "amber" || v === "sky" || v === "violet";
}
function isMotion(v: string): v is Motion {
  return v === "normal" || v === "reduced";
}
function isDefaultView(v: string): v is DefaultView {
  return v === "cards" || v === "list";
}
function isLang(v: string): v is Lang {
  return v === "es" || v === "en";
}

function initSettingsPrefs() {
  const theme = document.querySelector<HTMLSelectElement>("[data-pref-theme]");
  const font = document.querySelector<HTMLSelectElement>("[data-pref-font]");
  const accent = document.querySelector<HTMLSelectElement>("[data-pref-accent]");
  const density = document.querySelector<HTMLSelectElement>("[data-pref-density]");
  const motion = document.querySelector<HTMLSelectElement>("[data-pref-motion]");
  const technologiesView = document.querySelector<HTMLSelectElement>("[data-pref-technologies-view]");
  const projectsView = document.querySelector<HTMLSelectElement>("[data-pref-projects-view]");
  const showHeaderIcons = document.querySelector<HTMLSelectElement>("[data-pref-show-header-icons]");
  const showLangSelector = document.querySelector<HTMLSelectElement>("[data-pref-show-lang-selector]");
  const lang = document.querySelector<HTMLSelectElement>("[data-pref-lang]");
  const reset = document.querySelector<HTMLButtonElement>("[data-pref-reset]");

  if (
    !theme ||
    !font ||
    !accent ||
    !density ||
    !motion ||
    !technologiesView ||
    !projectsView ||
    !showHeaderIcons ||
    !showLangSelector ||
    !lang
  )
    return;

  const render = () => {
    const p = loadPrefs();
    theme.value = p.themeMode;
    font.value = p.font;
    accent.value = p.accent;
    density.value = p.density;
    motion.value = p.motion;
    technologiesView.value = p.technologiesView;
    projectsView.value = p.projectsView;
    showHeaderIcons.value = p.showHeaderIcons ? "yes" : "no";
    showLangSelector.value = p.showLangSelector ? "yes" : "no";
    lang.value = p.lang;
  };

  render();

  theme.addEventListener("change", () => {
    const v = theme.value;
    if (!isThemeMode(v)) return;
    updatePrefs({ themeMode: v });
    if (v === "dark" || v === "light") localStorage.setItem("theme", v);
    if (v === "auto") localStorage.removeItem("theme");
  });

  font.addEventListener("change", () => {
    const v = font.value;
    if (!isFont(v)) return;
    updatePrefs({ font: v });
  });

  accent.addEventListener("change", () => {
    const v = accent.value;
    if (!isAccent(v)) return;
    updatePrefs({ accent: v });
  });

  density.addEventListener("change", () => {
    const v = density.value;
    if (!isDensity(v)) return;
    updatePrefs({ density: v });
  });

  motion.addEventListener("change", () => {
    const v = motion.value;
    if (!isMotion(v)) return;
    updatePrefs({ motion: v });
  });

  technologiesView.addEventListener("change", () => {
    const v = technologiesView.value;
    if (!isDefaultView(v)) return;
    updatePrefs({ technologiesView: v });
  });

  projectsView.addEventListener("change", () => {
    const v = projectsView.value;
    if (!isDefaultView(v)) return;
    updatePrefs({ projectsView: v });
  });

  showHeaderIcons.addEventListener("change", () => {
    const v = showHeaderIcons.value === "yes";
    updatePrefs({ showHeaderIcons: v });
    // refresh current page so header reacts immediately
    window.location.reload();
  });

  showLangSelector.addEventListener("change", () => {
    const v = showLangSelector.value === "yes";
    updatePrefs({ showLangSelector: v });
    // let client.ts re-render toggle state next time; fast reload keeps UX consistent
    window.location.reload();
  });

  lang.addEventListener("change", () => {
    const v = lang.value;
    if (!isLang(v)) return;
    updatePrefs({ lang: v });
    window.location.reload();
  });

  reset?.addEventListener("click", () => {
    localStorage.removeItem("skillatlas_prefs_v1");
    localStorage.removeItem("theme");
    render();
    updatePrefs({
      themeMode: "auto",
      font: "system",
      accent: "indigo",
      density: "comfortable",
      motion: "normal",
      technologiesView: "cards",
      projectsView: "cards",
      showHeaderIcons: true,
      showLangSelector: true,
      lang: "es",
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsPrefs);
} else {
  initSettingsPrefs();
}

