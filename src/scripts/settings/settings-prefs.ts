import {
  loadPrefs,
  updatePrefs,
  type Accent,
  type Density,
  type DefaultView,
  type FontPreset,
  type Lang,
  type Motion,
  type SettingsSidebarSide,
  type ThemeMode,
} from "@scripts/core/prefs";

function isThemeMode(v: string): v is ThemeMode {
  return v === "auto" || v === "light" || v === "dark";
}
function isDensity(v: string): v is Density {
  return v === "comfortable" || v === "compact";
}
function isFont(v: string): v is FontPreset {
  return v === "system" || v === "inter" || v === "mono" || v === "serif";
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
  if (document.body.dataset.settingsPrefsInit === "1") return;

  const theme = document.querySelector<HTMLSelectElement>("[data-pref-theme]");
  const fontEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-font]");
  const accentEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-accent]");
  const densityEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-density]");
  const motionEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-motion]");
  const technologiesViewEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-technologies-view]");
  const projectsViewEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-projects-view]");
  const showHeaderIconsEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-show-header-icons]");
  const showLangSelectorEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-show-lang-selector]");

  if (
    !theme ||
    fontEls.length === 0 ||
    accentEls.length === 0 ||
    densityEls.length === 0 ||
    motionEls.length === 0 ||
    technologiesViewEls.length === 0 ||
    projectsViewEls.length === 0 ||
    showHeaderIconsEls.length === 0 ||
    showLangSelectorEls.length === 0
  )
    return;

  document.body.dataset.settingsPrefsInit = "1";

  const render = () => {
    const p = loadPrefs();
    theme.value = p.themeMode;
    fontEls.forEach((font) => {
      font.value = p.font;
    });
    accentEls.forEach((el) => {
      el.value = p.accent;
    });
    densityEls.forEach((el) => {
      el.value = p.density;
    });
    motionEls.forEach((el) => {
      el.value = p.motion;
    });
    technologiesViewEls.forEach((el) => {
      el.value = p.technologiesView;
    });
    projectsViewEls.forEach((el) => {
      el.value = p.projectsView;
    });
    showHeaderIconsEls.forEach((el) => {
      el.value = p.showHeaderIcons ? "yes" : "no";
    });
    showLangSelectorEls.forEach((el) => {
      el.value = p.showLangSelector ? "yes" : "no";
    });
    document.querySelectorAll<HTMLButtonElement>("[data-pref-font-choice]").forEach((btn) => {
      const active = btn.dataset.prefFontChoice === p.font;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };

  render();

  theme.addEventListener("change", () => {
    const v = theme.value;
    if (!isThemeMode(v)) return;
    updatePrefs({ themeMode: v });
    if (v === "dark" || v === "light") localStorage.setItem("theme", v);
    if (v === "auto") localStorage.removeItem("theme");
  });

  document.querySelectorAll<HTMLElement>("[data-pref-font-picker]").forEach((fontPicker) => {
    if (fontPicker.dataset.bound === "1") return;
    fontPicker.dataset.bound = "1";
    fontPicker.querySelectorAll<HTMLButtonElement>("[data-pref-font-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.prefFontChoice;
        if (!v || !isFont(v)) return;
        updatePrefs({ font: v });
        render();
      });
    });
  });

  fontEls.forEach((font) => {
    font.addEventListener("change", () => {
      const v = font.value;
      if (!isFont(v)) return;
      updatePrefs({ font: v });
      render();
    });
  });

  const bindSelectAll = <T extends string>(
    els: NodeListOf<HTMLSelectElement>,
    ok: (v: string) => v is T,
    patch: (v: T) => Partial<Parameters<typeof updatePrefs>[0]>,
  ) => {
    els.forEach((el) => {
      el.addEventListener("change", () => {
        const v = el.value;
        if (!ok(v)) return;
        updatePrefs(patch(v) as any);
        render();
      });
    });
  };

  bindSelectAll(accentEls, isAccent, (v) => ({ accent: v }));
  bindSelectAll(densityEls, isDensity, (v) => ({ density: v }));
  bindSelectAll(motionEls, isMotion, (v) => ({ motion: v }));
  bindSelectAll(technologiesViewEls, isDefaultView, (v) => ({ technologiesView: v }));
  bindSelectAll(projectsViewEls, isDefaultView, (v) => ({ projectsView: v }));

  showHeaderIconsEls.forEach((el) => {
    el.addEventListener("change", () => {
      const v = el.value === "yes";
      updatePrefs({ showHeaderIcons: v });
    });
  });
  showLangSelectorEls.forEach((el) => {
    el.addEventListener("change", () => {
      const v = el.value === "yes";
      updatePrefs({ showLangSelector: v });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-pref-lang-flags]").forEach((langFlags) => {
    langFlags.querySelectorAll<HTMLButtonElement>("[data-pref-lang-flag]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const v = btn.dataset.prefLangFlag;
        if (!v || !isLang(v)) return;
        updatePrefs({ lang: v });
        if (window.skillatlas?.setUiLang) {
          await window.skillatlas.setUiLang(v);
        } else {
          window.location.reload();
        }
      });
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-pref-reset]").forEach((reset) => {
    if (reset.dataset.bound === "1") return;
    reset.dataset.bound = "1";
    reset.addEventListener("click", async () => {
      localStorage.removeItem("skillatlas_prefs_v1");
      localStorage.removeItem("theme");
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
        settingsSidebarSide: "left" as SettingsSidebarSide,
        settingsActiveSection: "prefs",
        qaTesterMode: false,
      });
      render();
      await window.skillatlas?.setUiLang?.("es");
      window.dispatchEvent(new CustomEvent("skillatlas:settings-panel", { detail: { id: "prefs" } }));
    });
  });
}

const boot = () => initSettingsPrefs();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);
