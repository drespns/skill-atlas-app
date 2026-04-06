import i18next from "i18next";
import es from "@i18n/es.json";
import en from "@i18n/en.json";
import { loadPrefs, updatePrefs } from "@scripts/core/prefs";
import { refreshHeaderIconsFromPrefs } from "@scripts/client-shell/header-icons";
import { syncThemeToggleAria } from "@scripts/client-shell/theme-toggle-sync";
import { resolveSpanishPickerId, clearSpanishPickerSession } from "@lib/lang-picker-infer";
import { LANG_PICKER_OPTIONS, preferEnglishPickerId } from "@lib/lang-picker-options";

function normalizePathname(): string {
  const p = window.location.pathname.replace(/\/$/, "");
  return p === "" ? "/" : p;
}

function shouldForceLangPickerVisible(): boolean {
  const path = normalizePathname();
  return path === "/" || path === "/login";
}

function isLangSelectorVisible(): boolean {
  return loadPrefs().showLangSelector || shouldForceLangPickerVisible();
}

function getUiLangFromI18n(): "es" | "en" {
  const l = (i18next.language || "es").toLowerCase();
  return l.startsWith("en") ? "en" : "es";
}

function countryFromSpanishPickerId(id: string): "Spain" | "Mexico" | "Argentina" | "Chile" | "Ecuador" {
  if (id === "es") return "Spain";
  if (id === "es_mx") return "Mexico";
  if (id === "es_ar") return "Argentina";
  if (id === "es_cl") return "Chile";
  if (id === "es_ec") return "Ecuador";
  return "Mexico";
}

export async function initI18n() {
  const initial = loadPrefs().lang;

  await i18next.init({
    lng: initial,
    fallbackLng: "es",
    resources: {
      es: { translation: es as any },
      en: { translation: en as any },
    },
  });
  await i18next.changeLanguage(initial);

  const notifyLangChanged = (lang: "es" | "en") => {
    window.dispatchEvent(new CustomEvent("skillatlas:ui-lang-changed", { detail: { lang } }));
  };

  const setLangAttr = () => {
    const lng = getUiLangFromI18n();
    document.documentElement.lang = lng === "en" ? "en" : "es";
  };

  const render = () => {
    setLangAttr();
    const lng: "es" | "en" = getUiLangFromI18n();

    const esPickerId = resolveSpanishPickerId();
    const esCountry = countryFromSpanishPickerId(esPickerId);
    const esFlagSrc = `/icons/flags/${esCountry}.svg`;
    const opt = LANG_PICKER_OPTIONS.find((o) => o.id === esPickerId);
    const esTitle = opt?.label ?? "Español";

    document.querySelectorAll<HTMLElement>('[data-lang-flag="es"], [data-pref-lang-flag="es"]').forEach((btn) => {
      btn.setAttribute("title", esTitle);
    });
    document.querySelectorAll<HTMLImageElement>('[data-flag-img="es"]').forEach((img) => {
      img.src = esFlagSrc;
    });

    document.querySelectorAll<HTMLElement>('[data-lang-flag="en"], [data-pref-lang-flag="en"]').forEach((btn) => {
      btn.setAttribute("title", "English");
    });
    document.querySelectorAll<HTMLImageElement>('[data-flag-img="en"]').forEach((img) => {
      img.src = "/icons/flags/United_Kingdom.svg";
    });

    document.querySelectorAll<HTMLButtonElement>("[data-lang-flag]").forEach((btn) => {
      const active = btn.dataset.langFlag === lng;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll<HTMLButtonElement>("[data-pref-lang-flag]").forEach((btn) => {
      const active = btn.dataset.prefLangFlag === lng;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const quickFlagImg = document.querySelector<HTMLImageElement>("[data-lang-quick-flag]");
    if (quickFlagImg) {
      if (lng === "en") {
        const enId = preferEnglishPickerId();
        const enFlag = LANG_PICKER_OPTIONS.find((o) => o.id === enId)?.flag ?? "United_Kingdom";
        quickFlagImg.src = `/icons/flags/${enFlag}.svg`;
        quickFlagImg.alt = enId === "en_us" ? "English (US)" : "English";
      } else {
        quickFlagImg.src = esFlagSrc;
        quickFlagImg.alt = esTitle;
      }
    }

    const show = isLangSelectorVisible();
    const langWrap = document.querySelector<HTMLElement>("[data-lang-wrap]");
    if (langWrap) {
      langWrap.classList.toggle("hidden", !show);
      langWrap.classList.toggle("inline-flex", show);
    }

    const langQuick = document.querySelector<HTMLElement>("[data-lang-quick-toggle]");
    if (langQuick) langQuick.setAttribute("aria-haspopup", "menu");

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

    window.dispatchEvent(new CustomEvent("skillatlas:lang-picker-sync"));
  };

  render();
  notifyLangChanged(initial);

  window.skillatlas = window.skillatlas ?? {};
  window.skillatlas.setUiLang = async (lng: "es" | "en") => {
    await i18next.changeLanguage(lng);
    if (lng === "en") clearSpanishPickerSession();
    updatePrefs({ lang: lng });
    render();
    notifyLangChanged(lng);
  };
  window.skillatlas.refreshI18nDom = render;

  if (!(window as unknown as { __skillatlasPrefsChrome?: boolean }).__skillatlasPrefsChrome) {
    (window as unknown as { __skillatlasPrefsChrome?: boolean }).__skillatlasPrefsChrome = true;
    window.addEventListener("skillatlas:prefs-updated", () => {
      window.skillatlas?.refreshI18nDom?.();
      refreshHeaderIconsFromPrefs();
      syncThemeToggleAria();
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-lang-flag]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", async () => {
      const next = btn.dataset.langFlag === "en" ? "en" : "es";
      await i18next.changeLanguage(next);
      if (next === "en") clearSpanishPickerSession();
      updatePrefs({ lang: next });
      render();
      notifyLangChanged(next);
    });
  });
}
