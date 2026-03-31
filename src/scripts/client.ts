import i18next from "i18next";
import es from "../i18n/es.json";
import en from "../i18n/en.json";
import { getSupabaseBrowserClient } from "./client-supabase";
import { isSkillAtlasAdmin } from "./admin-role";
import { showToast } from "./ui-feedback";
import { applyPrefs, loadPrefs, updatePrefs } from "./prefs";
import "./command-palette";

declare global {
  interface Window {
    skillatlas?: {
      bootstrapProjectsList?: () => Promise<void>;
      clearProjectsCache?: () => void;
      setUiLang?: (lng: "es" | "en") => Promise<void>;
    };
  }
}

type SupabaseLike = ReturnType<typeof getSupabaseBrowserClient>;

/**
 * Client bootstrap script.
 *
 * Responsibilities:
 * 1) Global prefs (theme/font/density/accent) + persistence
 * 2) ES/EN language switch + text replacement using data-i18n attributes
 */

async function initPrefs() {
  // Apply stored prefs (head inline script already applies early; this keeps it in sync and sets listeners)
  applyPrefs(loadPrefs());

  const themeBtn = document.querySelector<HTMLElement>("[data-theme-toggle]");

  // Toggle theme button forces explicit light/dark (leaves auto only via Settings)
  if (themeBtn && themeBtn.dataset.bound !== "1") {
    themeBtn.dataset.bound = "1";
    themeBtn.addEventListener("click", () => {
    const isDark = !document.documentElement.classList.contains("dark");
    updatePrefs({ themeMode: isDark ? "dark" : "light" });
    themeBtn.setAttribute("aria-pressed", String(isDark));
    // Back-compat: keep legacy key updated so older code paths remain consistent
    localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }

  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (mq && (mq as any).__skillatlasBound !== true) {
    (mq as any).__skillatlasBound = true;
    mq?.addEventListener?.("change", () => {
      const prefs = loadPrefs();
      if (prefs.themeMode === "auto") applyPrefs(prefs);
    });
  }

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    // Load DB prefs (if any) and apply them once per page load.
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (userId) {
        const res = await supabase.from("user_prefs").select("prefs").eq("user_id", userId).maybeSingle();
        const remote = (res?.data?.prefs ?? null) as any;
        if (remote && typeof remote === "object") {
          // Merge remote onto local (remote wins), then persist locally.
          const merged = { ...loadPrefs(), ...remote, v: 1 };
          localStorage.setItem("skillatlas_prefs_v1", JSON.stringify(merged));
          applyPrefs(merged);
        }
      }
    } catch {
      // ignore (offline / missing table / RLS)
    }

    // Persist changes (debounced) when authed.
    let t: number | null = null;
    const saveRemote = async (prefs: any) => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) return;
        await supabase.from("user_prefs").upsert({ user_id: userId, prefs }, { onConflict: "user_id" });
      } catch {
        // ignore
      }
    };

    if ((window as any).__skillatlasPrefsRemoteBound !== true) {
      (window as any).__skillatlasPrefsRemoteBound = true;
      window.addEventListener("skillatlas:prefs-updated", (e: Event) => {
        const prefs = (e as CustomEvent).detail;
        if (!prefs) return;
        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => void saveRemote(prefs), 450);
      });
    }
  }
}

function initCommandPaletteTrigger() {
  const btn = document.querySelector<HTMLButtonElement>("[data-command-palette-trigger]");
  if (!btn) return;
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => window.dispatchEvent(new Event("skillatlas:open-palette")));
}

function initHeaderNavIndicator() {
  const nav = document.querySelector<HTMLElement>("[data-header-nav]");
  if (!nav) return;
  if (nav.dataset.bound === "1") return;
  nav.dataset.bound = "1";
  const indicator = nav.querySelector<HTMLElement>("[data-header-nav-indicator]");
  if (!indicator) return;

  const allLinks = () =>
    Array.from(nav.querySelectorAll<HTMLAnchorElement>("[data-header-nav-link]")).filter((a) => {
      // Only visible links (auth will toggle hidden)
      return !a.classList.contains("hidden") && a.offsetParent !== null;
    });

  const moveTo = (a: HTMLElement | null) => {
    const links = allLinks();
    if (!a || links.length === 0) {
      indicator.style.opacity = "0";
      indicator.style.width = "0px";
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const r = a.getBoundingClientRect();
    const x = r.left - navRect.left;
    indicator.style.opacity = "1";
    indicator.style.transform = `translateX(${Math.max(0, x)}px)`;
    indicator.style.width = `${Math.max(0, r.width)}px`;
  };

  const activeLink = () => allLinks().find((a) => a.dataset.navActive === "true") ?? null;

  const attach = () => {
    const links = allLinks();
    for (const a of links) {
      a.addEventListener("mouseenter", () => moveTo(a));
      a.addEventListener("focus", () => moveTo(a));
    }
    nav.addEventListener("mouseleave", () => moveTo(activeLink()));
  };

  // Initial position
  moveTo(activeLink());
  attach();

  const ro = new ResizeObserver(() => moveTo(activeLink()));
  ro.observe(nav);

  // When auth toggles link visibility, re-evaluate.
  window.addEventListener("skillatlas:auth-nav-updated", () => {
    moveTo(activeLink());
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

function initGlobalBanner() {
  const root = document.querySelector<HTMLElement>("[data-global-banner]");
  if (!root) return;
  const bannerId = root.dataset.bannerId ?? "";
  const storageKey = `skillatlas_banner_dismissed:${bannerId || "default"}`;
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-banner-close]");
  const reopenBtn = document.querySelector<HTMLButtonElement>("[data-banner-reopen]");
  const glow = document.querySelector<HTMLElement>("[data-banner-glow]");

  const dismissed = (() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  })();

  const open = () => {
    root.dataset.bannerState = "open";
    root.classList.remove("max-h-0", "opacity-0", "-translate-y-2", "pointer-events-none");
    root.classList.add("max-h-24", "opacity-100", "translate-y-0", "pointer-events-auto");
    glow?.classList.remove("opacity-0");
    glow?.classList.add("opacity-100");
    reopenBtn?.classList.add("hidden");
  };

  const close = () => {
    root.dataset.bannerState = "closed";
    root.classList.add("max-h-0", "opacity-0", "-translate-y-2", "pointer-events-none");
    root.classList.remove("max-h-24", "opacity-100", "translate-y-0", "pointer-events-auto");
    glow?.classList.add("opacity-0");
    glow?.classList.remove("opacity-100");
    reopenBtn?.classList.remove("hidden");
  };

  if (!dismissed) open();
  else close();

  closeBtn?.addEventListener("click", () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    close();
  });

  reopenBtn?.addEventListener("click", () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    // Force a reflow so the transition is visible even if user spam-clicks.
    void root.offsetHeight;
    open();
  });
}

function updateLandingCtas(isAuthed: boolean) {
  const requestAccess = document.querySelector<HTMLElement>("[data-landing-request-access]");
  const haveInvite = document.querySelector<HTMLElement>("[data-landing-have-invite]");
  const openApp = document.querySelector<HTMLElement>("[data-landing-open-app]");
  const demo = document.querySelector<HTMLElement>("[data-landing-demo]");

  if (requestAccess) {
    requestAccess.classList.toggle("hidden", isAuthed);
    requestAccess.classList.toggle("inline-flex", !isAuthed);
  }
  if (haveInvite) {
    haveInvite.classList.toggle("hidden", isAuthed);
    haveInvite.classList.toggle("inline-flex", !isAuthed);
  }

  if (openApp) {
    openApp.classList.toggle("hidden", !isAuthed);
    openApp.classList.toggle("inline-flex", isAuthed);
  }

  // Demo is always visible (public).
  if (demo) {
    demo.classList.remove("hidden");
    demo.classList.add("inline-flex");
  }
}

async function initLandingCtas() {
  const hasAny =
    Boolean(document.querySelector("[data-landing-request-access]")) ||
    Boolean(document.querySelector("[data-landing-have-invite]")) ||
    Boolean(document.querySelector("[data-landing-open-app]")) ||
    Boolean(document.querySelector("[data-landing-demo]"));
  if (!hasAny) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const render = async () => {
    const { data } = await supabase.auth.getSession();
    updateLandingCtas(Boolean(data.session?.user));
  };

  await render();
  supabase.auth.onAuthStateChange(() => {
    void render();
  });
}

async function initAuthGuard() {
  const guard = document.querySelector<HTMLElement>("[data-requires-auth]");
  if (!guard) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return;

  // Remember next url so /login can bounce back.
  try {
    sessionStorage.setItem("skillatlas_post_login_next", window.location.pathname + window.location.search);
  } catch {
    // ignore
  }
  const url = new URL(window.location.origin + "/");
  url.searchParams.set("reason", "auth");
  window.location.href = url.toString();
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

  const notifyLangChanged = (lang: "es" | "en") => {
    window.dispatchEvent(new CustomEvent("skillatlas:ui-lang-changed", { detail: { lang } }));
  };

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

    // Region-aware Spanish flag (Spain vs LatAm) without any geo API.
    const inferCountryForSpanish = (): "Spain" | "Mexico" | "Argentina" | "Chile" | "Ecuador" => {
      try {
        const nav = (navigator.language || "").toLowerCase();
        // Use explicit region first (best signal)
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

    langFlagBtns.forEach((btn) => {
      const active = btn.dataset.langFlag === lng;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll<HTMLButtonElement>("[data-pref-lang-flag]").forEach((btn) => {
      const active = btn.dataset.prefLangFlag === lng;
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
  notifyLangChanged(i18next.language.startsWith("en") ? "en" : "es");

  window.skillatlas = window.skillatlas ?? {};
  window.skillatlas.setUiLang = async (lng: "es" | "en") => {
    await i18next.changeLanguage(lng);
    render();
    notifyLangChanged(lng);
  };

  langFlagBtns.forEach((btn) => {
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
}

async function initAuthHeader() {
  const settingsLink = document.querySelector<HTMLAnchorElement>("[data-auth-header-settings]");
  const signOutBtn = document.querySelector<HTMLButtonElement>("[data-auth-header-signout]");
  const publicHeaderPricing = document.querySelector<HTMLAnchorElement>("[data-public-header-pricing]");
  const adminHeaderLink = document.querySelector<HTMLAnchorElement>("[data-admin-header-link]");
  const avatarWrap = document.querySelector<HTMLElement>("[data-auth-avatar-wrap]");
  const avatarImg = document.querySelector<HTMLImageElement>("[data-auth-avatar]");
  const authNavLinks = document.querySelectorAll<HTMLElement>("[data-auth-nav]");
  const footerAuthNavLinks = document.querySelectorAll<HTMLElement>("[data-auth-footer-nav]");
  const homeLink = document.querySelector<HTMLAnchorElement>("[data-home-link]");
  const homeWrap = document.querySelector<HTMLElement>("[data-home-wrap]");
  const homePopover = document.querySelector<HTMLElement>("[data-home-popover]");
  if (
    !settingsLink &&
    !signOutBtn &&
    !publicHeaderPricing &&
    !adminHeaderLink &&
    authNavLinks.length === 0 &&
    footerAuthNavLinks.length === 0 &&
    !homeLink
  )
    return;

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
    // Settings
    settingsLink?.classList.toggle("hidden", !isAuthed);
    settingsLink?.classList.toggle("inline-flex", isAuthed);

    // Sign out
    signOutBtn?.classList.toggle("hidden", !isAuthed);
    signOutBtn?.classList.toggle("inline-flex", isAuthed);

    // Nav
    authNavLinks.forEach((el) => {
      el.classList.toggle("hidden", !isAuthed);
      el.classList.toggle("inline-flex", isAuthed);
    });

    if (publicHeaderPricing) {
      publicHeaderPricing.classList.add("hidden");
      if (!isAuthed) publicHeaderPricing.classList.add("md:inline-flex");
      else publicHeaderPricing.classList.remove("md:inline-flex");
    }

    if (adminHeaderLink) {
      adminHeaderLink.classList.add("hidden");
      adminHeaderLink.classList.remove("inline-flex");
    }
    footerAuthNavLinks.forEach((el) => {
      el.classList.toggle("hidden", !isAuthed);
      el.classList.toggle("inline-flex", isAuthed);
    });

    // Home link: landing when public, /app when authed.
    if (homeLink) homeLink.href = isAuthed ? "/app" : "/";

    // Home popover: keep hidden by default; it only appears on real hover when authed.
    if (homePopover) {
      homePopover.classList.add("hidden");
      homePopover.classList.remove("block");
    }
    if (homeWrap) homeWrap.dataset.homeAuthed = isAuthed ? "true" : "false";

    window.dispatchEvent(new Event("skillatlas:auth-nav-updated"));
  };

  // Hover popover (authed only). Kept independent of i18n for now.
  if (homeWrap && homeLink && homePopover) {
    let hover = false;
    let timer: number | null = null;

    const show = () => {
      homePopover.classList.remove("hidden");
      homePopover.classList.add("block");
    };
    const hide = () => {
      homePopover.classList.add("hidden");
      homePopover.classList.remove("block");
    };

    const scheduleHide = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!hover) hide();
      }, 120);
    };

    homeWrap.addEventListener("mouseenter", () => {
      if (homeWrap.dataset.homeAuthed !== "true") return;
      hover = true;
      if (timer) window.clearTimeout(timer);
      show();
    });
    homeWrap.addEventListener("mouseleave", () => {
      hover = false;
      scheduleHide();
    });

    document.addEventListener("click", (e) => {
      if (!homeWrap.contains(e.target as Node)) hide();
    });
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    setVisibility(false);
    return;
  }

  if (signOutBtn && signOutBtn.dataset.bound !== "1") {
    signOutBtn.dataset.bound = "1";
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
  }

  const render = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setVisibility(Boolean(user));
    updateLandingCtas(Boolean(user));

    if (adminHeaderLink && supabase && user) {
      const ok = await isSkillAtlasAdmin(supabase, user.id);
      adminHeaderLink.classList.toggle("hidden", !ok);
      adminHeaderLink.classList.toggle("inline-flex", ok);
    } else if (adminHeaderLink) {
      adminHeaderLink.classList.add("hidden");
      adminHeaderLink.classList.remove("inline-flex");
    }
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const lastProvider = (() => {
      try {
        return localStorage.getItem("skillatlas_last_auth_provider");
      } catch {
        return null;
      }
    })();

    const githubAvatar = typeof meta.avatar_url === "string" && meta.avatar_url ? meta.avatar_url : null;
    const linkedinAvatar = typeof meta.picture === "string" && meta.picture ? meta.picture : null;

    const avatarUrl =
      lastProvider === "linkedin_oidc"
        ? linkedinAvatar ?? githubAvatar
        : lastProvider === "github"
          ? githubAvatar ?? linkedinAvatar
          : githubAvatar ?? linkedinAvatar;
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

async function bootClient() {
  initLayoutVars();
  await initPrefs();
  initHeaderIconVisibility();
  initGlobalBanner();
  initHeaderNavIndicator();
  initCommandPaletteTrigger();
  await initI18n();
  await initAuthHeader();
  await initLandingCtas();
  await initAuthGuard();
}

const boot = () => void bootClient();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

// With <ClientRouter />, page navigations don't trigger DOMContentLoaded.
document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

