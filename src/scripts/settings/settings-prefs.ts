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
  type HabitsMarkStyle,
  type Motion,
  type SettingsSidebarSide,
  type ThemeMode,
  type HeaderPopoverTrigger,
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
function isHeaderPopoverTrigger(v: string): v is HeaderPopoverTrigger {
  return v === "hover" || v === "click";
}
function isHabitsMarkStyle(v: string): v is HabitsMarkStyle {
  return v === "paint" || v === "fill" || v === "check";
}
function initSettingsPrefs() {
  const theme = document.querySelector<HTMLSelectElement>("[data-pref-theme]");
  const fontEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-font]");
  const uiFontScaleEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-ui-font-scale]");
  const accentEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-accent]");
  const motionEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-motion]");
  const habitsMarkStyleEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-habits-mark-style]");
  const technologiesViewEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-technologies-view]");
  const projectsViewEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-projects-view]");
  const showHeaderIconsEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-show-header-icons]");
  const showLangSelectorEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-show-lang-selector]");
  const headerLangPopoverEls = document.querySelectorAll<HTMLSelectElement>("[data-pref-header-lang-popover]");
  const headerUserMenuPopoverEls = document.querySelectorAll<HTMLSelectElement>(
    "[data-pref-header-user-menu-popover]",
  );
  const fabShortcutsEls = document.querySelectorAll<HTMLInputElement>("[data-pref-fab-shortcuts]");
  const fabCalendarEls = document.querySelectorAll<HTMLInputElement>("[data-pref-fab-calendar]");
  const fabCuriositiesEls = document.querySelectorAll<HTMLInputElement>("[data-pref-fab-curiosities]");
  const fabAiEls = document.querySelectorAll<HTMLInputElement>("[data-pref-fab-ai]");
  const fabCvTipsEls = document.querySelectorAll<HTMLInputElement>("[data-pref-fab-cv-tips]");
  if (
    !theme ||
    fontEls.length === 0 ||
    uiFontScaleEls.length === 0 ||
    accentEls.length === 0 ||
    motionEls.length === 0 ||
    technologiesViewEls.length === 0 ||
    projectsViewEls.length === 0 ||
    showHeaderIconsEls.length === 0 ||
    showLangSelectorEls.length === 0 ||
    headerLangPopoverEls.length === 0 ||
    headerUserMenuPopoverEls.length === 0
  )
    return;

  if (theme.dataset.bound === "1") return;
  theme.dataset.bound = "1";

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
    habitsMarkStyleEls.forEach((el) => {
      el.value = p.habitsMarkStyle ?? "paint";
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
    headerLangPopoverEls.forEach((el) => {
      el.value = p.headerLangPopover ?? "hover";
    });
    headerUserMenuPopoverEls.forEach((el) => {
      el.value = p.headerUserMenuPopover ?? "click";
    });
    fabShortcutsEls.forEach((el) => {
      el.checked = Boolean(p.showFabShortcuts ?? true);
    });
    fabCalendarEls.forEach((el) => {
      el.checked = Boolean(p.showFabCalendar ?? true);
    });
    fabCuriositiesEls.forEach((el) => {
      el.checked = Boolean(p.showFabCuriosities ?? true);
    });
    fabAiEls.forEach((el) => {
      el.checked = Boolean(p.showFabAi ?? false);
    });
    fabCvTipsEls.forEach((el) => {
      el.checked = Boolean(p.showFabCvTips ?? true);
    });

    // Ensure custom select-popovers reflect programmatic value updates.
    window.dispatchEvent(new Event("skillatlas:select-popovers-refresh"));
  };

  render();

  // If prefs get hydrated/merged after init (remote-first), re-render.
  if ((window as any).__skillatlasSettingsPrefsRerender !== true) {
    (window as any).__skillatlasSettingsPrefsRerender = true;
    window.addEventListener("skillatlas:prefs-updated", () => render());
  }

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
  bindSelectAll(habitsMarkStyleEls, isHabitsMarkStyle, (v) => ({ habitsMarkStyle: v }));
  bindSelectAll(technologiesViewEls, isDefaultView, (v) => ({ technologiesView: v }));
  bindSelectAll(projectsViewEls, isDefaultView, (v) => ({ projectsView: v }));
  bindSelectAll(headerLangPopoverEls, isHeaderPopoverTrigger, (v) => ({ headerLangPopover: v }));
  bindSelectAll(headerUserMenuPopoverEls, isHeaderPopoverTrigger, (v) => ({ headerUserMenuPopover: v }));
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

  const bindChecks = (els: NodeListOf<HTMLInputElement>, patch: (checked: boolean) => any) => {
    els.forEach((el) => {
      el.addEventListener("change", () => {
        updatePrefs(patch(Boolean(el.checked)));
        render();
      });
    });
  };
  bindChecks(fabCalendarEls, (checked) => ({ showFabCalendar: checked }));
  bindChecks(fabCuriositiesEls, (checked) => ({ showFabCuriosities: checked }));
  bindChecks(fabAiEls, (checked) => ({ showFabAi: checked }));
  bindChecks(fabCvTipsEls, (checked) => ({ showFabCvTips: checked }));
  bindChecks(fabShortcutsEls, (checked) => ({ showFabShortcuts: checked }));

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
        showLangSelector: false,
        headerLangPopover: "hover",
        headerUserMenuPopover: "click",
        settingsSidebarSide: "left" as SettingsSidebarSide,
        settingsActiveSection: "prefs",
        qaTesterMode: false,
        showFabAi: false,
        showFabCvTips: true,
        showFabCalendar: true,
        showFabCuriosities: true,
        showFabShortcuts: true,
        habitsMarkStyle: "paint",
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
