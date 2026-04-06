import {
  FONT_GOOGLE_CATALOG_PREVIEW_LINK_ID,
  googleFontsCatalogPreviewHref,
  isValidFontId,
} from "@config/font-catalog";
import {
  loadPrefs,
  updatePrefs,
  type Accent,
  type DefaultView,
  type FontPreset,
  type Motion,
  type SettingsSidebarSide,
  type ThemeMode,
  type UiFontScale,
} from "@scripts/core/prefs";

function isThemeMode(v: string): v is ThemeMode {
  return v === "auto" || v === "light" || v === "dark";
}
function isFont(v: string): v is FontPreset {
  return isValidFontId(v);
}
function isUiFontScale(v: string): v is UiFontScale {
  return v === "sm" || v === "md" || v === "lg";
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
function initSettingsPrefs() {
  if (document.body.dataset.settingsPrefsInit === "1") return;

  const theme = document.querySelector<HTMLSelectElement>("[data-pref-theme]");
  const fontEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-font]");
  const uiFontScaleEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-ui-font-scale]");
  const accentEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-accent]");
  const motionEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-motion]");
  const technologiesViewEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-technologies-view]");
  const projectsViewEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-projects-view]");
  const showHeaderIconsEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-show-header-icons]");
  const showLangSelectorEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-show-lang-selector]");

  if (
    !theme ||
    fontEls.length === 0 ||
    uiFontScaleEls.length === 0 ||
    accentEls.length === 0 ||
    motionEls.length === 0 ||
    technologiesViewEls.length === 0 ||
    projectsViewEls.length === 0 ||
    showHeaderIconsEls.length === 0 ||
    showLangSelectorEls.length === 0
  )
    return;

  document.body.dataset.settingsPrefsInit = "1";

  if (!document.getElementById(FONT_GOOGLE_CATALOG_PREVIEW_LINK_ID)) {
    const href = googleFontsCatalogPreviewHref();
    if (href) {
      const link = document.createElement("link");
      link.id = FONT_GOOGLE_CATALOG_PREVIEW_LINK_ID;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }

  const render = () => {
    const p = loadPrefs();
    theme.value = p.themeMode;
    fontEls.forEach((font) => {
      font.value = p.font;
    });
    uiFontScaleEls.forEach((el) => {
      el.value = p.uiFontScale;
    });
    accentEls.forEach((el) => {
      el.value = p.accent;
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
  };

  render();

  theme.addEventListener("change", () => {
    const v = theme.value;
    if (!isThemeMode(v)) return;
    updatePrefs({ themeMode: v });
    if (v === "dark" || v === "light") localStorage.setItem("theme", v);
    if (v === "auto") localStorage.removeItem("theme");
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

  bindSelectAll(uiFontScaleEls, isUiFontScale, (v) => ({ uiFontScale: v }));
  bindSelectAll(accentEls, isAccent, (v) => ({ accent: v }));
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

  document.querySelectorAll<HTMLButtonElement>("[data-pref-reset]").forEach((reset) => {
    if (reset.dataset.bound === "1") return;
    reset.dataset.bound = "1";
    reset.addEventListener("click", async () => {
      localStorage.removeItem("skillatlas_prefs_v1");
      localStorage.removeItem("theme");
      updatePrefs({
        themeMode: "auto",
        font: "system",
        uiFontScale: "md",
        accent: "indigo",
        motion: "normal",
        technologiesView: "cards",
        projectsView: "cards",
        showHeaderIcons: true,
        showLangSelector: true,
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
