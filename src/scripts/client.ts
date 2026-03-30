import i18next from "i18next";
import es from "../i18n/es.json";
import en from "../i18n/en.json";
import { getSupabaseBrowserClient } from "./client-supabase";
import { showToast } from "./ui-feedback";
import { applyPrefs, loadPrefs, updatePrefs } from "./prefs";
import "./command-palette";

/**
 * Client bootstrap script.
 *
 * Responsibilities:
 * 1) Global prefs (theme/font/density/accent) + persistence
 * 2) ES/EN language switch + text replacement using data-i18n attributes
 */

function initPrefs() {
  // Apply stored prefs (head inline script already applies early; this keeps it in sync and sets listeners)
  applyPrefs(loadPrefs());

  const themeBtn = document.querySelector<HTMLElement>("[data-theme-toggle]");

  // Toggle theme button forces explicit light/dark (leaves auto only via Settings)
  themeBtn?.addEventListener("click", () => {
    const isDark = !document.documentElement.classList.contains("dark");
    updatePrefs({ themeMode: isDark ? "dark" : "light" });
    themeBtn.setAttribute("aria-pressed", String(isDark));
    // Back-compat: keep legacy key updated so older code paths remain consistent
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", () => {
    const prefs = loadPrefs();
    if (prefs.themeMode === "auto") applyPrefs(prefs);
  });
}

function initCommandPaletteTrigger() {
  const btn = document.querySelector<HTMLButtonElement>("[data-command-palette-trigger]");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.dispatchEvent(new Event("skillatlas:open-palette"));
  });
}

function initHeaderIconVisibility() {
  const wrap = document.querySelector<HTMLElement>("[data-header-icons]");
  if (!wrap) return;
  try {
    const prefsRaw = localStorage.getItem("skillatlas_prefs_v1");
    const prefs = prefsRaw ? (JSON.parse(prefsRaw) as any) : null;
    const show = prefs?.showHeaderIcons ?? true;
    wrap.classList.toggle("hidden", !show);
    wrap.classList.toggle("flex", Boolean(show));
  } catch {
    // ignore
  }
}

async function initI18n() {
  const langFlags = document.querySelector<HTMLElement>("[data-lang-flags]");
  const langFlagBtns = document.querySelectorAll<HTMLButtonElement>("[data-lang-flag]");

  /**
   * i18next setup.
   * For MVP we keep translations inline to avoid extra files.
   */
  await i18next.init({
    lng: loadPrefs().lang,
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
    const lng = i18next.language.startsWith("en") ? "en" : "es";
    langFlagBtns.forEach((btn) => {
      const active = btn.dataset.langFlag === lng;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const show = loadPrefs().showLangSelector;
    if (langFlags) {
      langFlags.classList.toggle("hidden", !show);
      langFlags.classList.toggle("sm:inline-flex", Boolean(show));
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

  langFlagBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = btn.dataset.langFlag === "en" ? "en" : "es";
      await i18next.changeLanguage(next);
      updatePrefs({ lang: next });
      render();
    });
  });
}

async function initAuthHeader() {
  const loginLink = document.querySelector<HTMLAnchorElement>("[data-auth-header-login]");
  const settingsLink = document.querySelector<HTMLAnchorElement>("[data-auth-header-settings]");
  const signOutBtn = document.querySelector<HTMLButtonElement>("[data-auth-header-signout]");
  const avatarWrap = document.querySelector<HTMLElement>("[data-auth-avatar-wrap]");
  const avatarImg = document.querySelector<HTMLImageElement>("[data-auth-avatar]");
  if (!loginLink || !settingsLink || !signOutBtn) return;

  const setAvatar = (url: string | null) => {
    if (!avatarWrap || !avatarImg) return;
    if (url) {
      avatarImg.src = url;
      avatarWrap.classList.remove("hidden");
      avatarWrap.classList.add("inline-flex");
    } else {
      avatarImg.removeAttribute("src");
      avatarWrap.classList.add("hidden");
      avatarWrap.classList.remove("inline-flex");
    }
  };

  const setVisibility = (isAuthed: boolean) => {
    // Login
    loginLink.classList.toggle("hidden", isAuthed);
    loginLink.classList.toggle("inline-flex", !isAuthed);

    // Settings
    settingsLink.classList.toggle("hidden", !isAuthed);
    settingsLink.classList.toggle("inline-flex", isAuthed);

    // Sign out
    signOutBtn.classList.toggle("hidden", !isAuthed);
    signOutBtn.classList.toggle("inline-flex", isAuthed);
  };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    setVisibility(false);
    return;
  }

  // If user clicks the login icon, remember current page so /login can bounce back.
  loginLink.addEventListener("click", () => {
    try {
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      sessionStorage.setItem("skillatlas_post_login_next", current);
    } catch {
      // ignore
    }
  });

  signOutBtn.addEventListener("click", async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    signOutBtn.disabled = true;
    const { error } = await supabase.auth.signOut();
    signOutBtn.disabled = false;
    if (error) {
      showToast(`No se pudo cerrar sesión: ${error.message}`, "error");
      return;
    }
    showToast("Sesión cerrada.", "success");
    // Stay on current page; header will update via auth state listener.
  });

  const render = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setVisibility(Boolean(user));
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const avatarUrl =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null;
    setAvatar(avatarUrl);
  };

  await render();
  supabase.auth.onAuthStateChange(() => {
    void render();
  });
}

function initLayoutVars() {
  const header = document.querySelector<HTMLElement>("[data-app-header]");
  if (!header) return;

  const apply = () => {
    const h = header.offsetHeight;
    document.documentElement.style.setProperty("--app-header-h", `${h}px`);
  };

  apply();
  window.addEventListener("resize", apply);
}

// Ensure header elements are available before initialization.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initLayoutVars();
    initPrefs();
    initHeaderIconVisibility();
    initCommandPaletteTrigger();
    void initI18n();
    void initAuthHeader();
  });
} else {
  initLayoutVars();
  initPrefs();
  initHeaderIconVisibility();
  initCommandPaletteTrigger();
  void initI18n();
  void initAuthHeader();
}

