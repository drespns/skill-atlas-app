import i18next from "i18next";
import es from "@i18n/es.json";
import en from "@i18n/en.json";
import { loadPrefs, updatePrefs } from "@scripts/core/prefs";
import { refreshHeaderIconsFromPrefs } from "@scripts/client-shell/header-icons";
import { syncThemeToggleAria } from "@scripts/client-shell/theme-toggle-sync";

export async function initI18n() {
  await i18next.init({
    lng: loadPrefs().lang,
    fallbackLng: "es",
    resources: {
      es: { translation: es as any },
      en: { translation: en as any },
    },
  });

  const notifyLangChanged = (lang: "es" | "en") => {
    window.dispatchEvent(new CustomEvent("skillatlas:ui-lang-changed", { detail: { lang } }));
  };

  const setLangAttr = (lng: string) => {
    document.documentElement.lang = lng?.startsWith("en") ? "en" : "es";
  };

  const render = () => {
    setLangAttr(i18next.language);
    const lng = i18next.language.startsWith("en") ? "en" : "es";

    const inferCountryForSpanish = (): "Spain" | "Mexico" | "Argentina" | "Chile" | "Ecuador" => {
      try {
        const nav = (navigator.language || "").toLowerCase();
        if (nav === "es-es" || nav.endsWith("-es")) return "Spain";
        if (nav === "es-mx" || nav.endsWith("-mx")) return "Mexico";
        if (nav === "es-ar" || nav.endsWith("-ar")) return "Argentina";
        if (nav === "es-cl" || nav.endsWith("-cl")) return "Chile";
        if (nav === "es-ec" || nav.endsWith("-ec")) return "Ecuador";

        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (typeof tz === "string") {
          if (tz === "Europe/Madrid") return "Spain";
          if (tz === "America/Mexico_City") return "Mexico";
          if (tz === "America/Argentina/Buenos_Aires") return "Argentina";
          if (tz === "America/Santiago") return "Chile";
          if (tz === "America/Guayaquil") return "Ecuador";
        }
      } catch {
        // ignore
      }
      return "Mexico";
    };

    const esCountry = inferCountryForSpanish();
    const esFlagSrc = `/icons/flags/${esCountry}.svg`;
    const esTitle =
      esCountry === "Spain"
        ? "Español (España)"
        : esCountry === "Argentina"
          ? "Español (Argentina)"
          : esCountry === "Chile"
            ? "Español (Chile)"
            : esCountry === "Ecuador"
              ? "Español (Ecuador)"
              : "Español (México)";

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
      quickFlagImg.src = lng === "en" ? "/icons/flags/United_Kingdom.svg" : esFlagSrc;
      quickFlagImg.alt = lng === "en" ? "English" : esTitle;
    }

    const show = loadPrefs().showLangSelector;
    const langQuick = document.querySelector<HTMLElement>("[data-lang-quick-toggle]");
    if (langQuick) {
      if (!show) {
        langQuick.classList.add("hidden");
        langQuick.classList.remove("inline-flex");
      } else {
        langQuick.classList.remove("hidden");
        langQuick.classList.add("inline-flex");
      }
    }
    const langFlags = document.querySelector<HTMLElement>("[data-lang-flags]");
    if (langFlags) {
      if (!show) {
        langFlags.classList.add("hidden");
        langFlags.classList.remove("inline-flex");
      } else {
        langFlags.classList.remove("hidden");
        langFlags.classList.add("inline-flex");
      }
    }
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
  notifyLangChanged(i18next.language.startsWith("en") ? "en" : "es");

  window.skillatlas = window.skillatlas ?? {};
  window.skillatlas.setUiLang = async (lng: "es" | "en") => {
    await i18next.changeLanguage(lng);
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
      updatePrefs({ lang: next });
      render();
      notifyLangChanged(next);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-lang-quick-toggle]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", async () => {
      const cur = i18next.language.startsWith("en") ? "en" : "es";
      const next: "es" | "en" = cur === "en" ? "es" : "en";
      await i18next.changeLanguage(next);
      updatePrefs({ lang: next });
      render();
      notifyLangChanged(next);
    });
  });
}
