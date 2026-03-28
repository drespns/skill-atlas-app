import i18next from "i18next";
import es from "../i18n/es.json";
import en from "../i18n/en.json";

/**
 * Client bootstrap script.
 *
 * Responsibilities:
 * 1) Theme toggle (light/dark) + persistence
 * 2) ES/EN language switch + text replacement using data-i18n attributes
 */

function initTheme() {
  // Key used in localStorage to remember user preference.
  const themeKey = "theme";

  // Button is rendered in AppShell header.
  const themeBtn = document.querySelector<HTMLElement>("[data-theme-toggle]");

  /**
   * Applies visual theme to the root document.
   *
   * We use:
   * - `.dark` class for Tailwind dark variants
   * - `data-theme` for debugging/inspection
   * - `colorScheme` so native controls follow the selected theme
   */
  const applyTheme = (isDark: boolean) => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    themeBtn?.setAttribute("aria-pressed", String(isDark));
  };

  // Toggle theme on button click and persist selection.
  themeBtn?.addEventListener("click", () => {
    const isDark = !document.documentElement.classList.contains("dark");
    applyTheme(isDark);
    localStorage.setItem(themeKey, isDark ? "dark" : "light");
  });

  // Sync button state with initial theme set in <head>
  applyTheme(document.documentElement.classList.contains("dark"));
}

async function initI18n() {
  // Key used in localStorage for current language.
  const langKey = "lang";
  const langSelect = document.querySelector<HTMLSelectElement>("[data-lang-select]");

  /**
   * i18next setup.
   * For MVP we keep translations inline to avoid extra files.
   */
  await i18next.init({
    lng: localStorage.getItem(langKey) || "es",
    fallbackLng: "es",
    resources: {
      es: { translation: es as any },
      en: { translation: en as any },
    },
  });

  const setLangAttr = (lng: string) => {
    document.documentElement.lang = lng?.startsWith("en") ? "en" : "es";
  };

  /**
   * Re-renders all translatable nodes.
   *
   * Convention:
   * Any element with `data-i18n="some.key"` gets replaced with i18next text.
   */
  const render = () => {
    setLangAttr(i18next.language);
    if (langSelect) langSelect.value = i18next.language.startsWith("en") ? "en" : "es";
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;

      const attrList = (el.getAttribute("data-i18n-attr") ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const argsRaw = el.getAttribute("data-i18n-args");
      const args = argsRaw ? (JSON.parse(argsRaw) as Record<string, any>) : undefined;

      if (attrList.length > 0) {
        const value = i18next.t(key, args);
        for (const attr of attrList) el.setAttribute(attr, value);
      } else {
        el.textContent = i18next.t(key, args);
      }
    });
  };

  render();

  // Handle language changes from the ES/EN selector.
  langSelect?.addEventListener("change", async (e) => {
    const next = (e.target as HTMLSelectElement).value === "en" ? "en" : "es";
    await i18next.changeLanguage(next);
    localStorage.setItem(langKey, next);
    render();
  });
}

// Ensure header elements are available before initialization.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    void initI18n();
  });
} else {
  initTheme();
  void initI18n();
}

