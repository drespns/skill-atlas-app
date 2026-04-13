import i18next from "i18next";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { isSkillAtlasAdmin } from "@scripts/core/admin-role";
import { showToast } from "@scripts/core/ui-feedback";
import { loadPrefs, type HeaderPopoverTrigger } from "@scripts/core/prefs";
import { updateLandingCtas } from "@scripts/client-shell/landing-ctas";
import { oauthPictureFromUser } from "@scripts/core/oauth-avatar";

export async function initAuthHeader() {
  const userMenuWrap = document.querySelector<HTMLElement>("[data-header-user-menu]");
  const userMenuTrigger = document.querySelector<HTMLButtonElement>("[data-user-menu-trigger]");
  const userMenuPanel = document.querySelector<HTMLElement>("[data-user-menu-panel]");
  const menuSignOutBtn = document.querySelector<HTMLButtonElement>("[data-user-menu-signout]");
  const avatarImg = document.querySelector<HTMLImageElement>("[data-auth-avatar]");
  const avatarInitial = document.querySelector<HTMLElement>("[data-user-menu-initial]");
  const publicFooterPricing = document.querySelector<HTMLAnchorElement>("[data-public-footer-pricing]");
  const adminHeaderLink = document.querySelector<HTMLAnchorElement>("[data-admin-header-link]");
  const authNavLinks = document.querySelectorAll<HTMLElement>("[data-auth-nav]");
  const footerAuthNavLinks = document.querySelectorAll<HTMLElement>("[data-auth-footer-nav]");
  const homeLink = document.querySelector<HTMLAnchorElement>("[data-home-link]");
  const homeWrap = document.querySelector<HTMLElement>("[data-home-wrap]");
  const homePopover = document.querySelector<HTMLElement>("[data-home-popover]");
  if (
    !userMenuWrap &&
    !adminHeaderLink &&
    authNavLinks.length === 0 &&
    footerAuthNavLinks.length === 0 &&
    !homeLink
  )
    return;

  const closeUserMenu = () => {
    if (!userMenuPanel || !userMenuTrigger) return;
    userMenuPanel.classList.add("hidden");
    userMenuTrigger.setAttribute("aria-expanded", "false");
  };

  const openUserMenu = () => {
    if (!userMenuPanel || !userMenuTrigger) return;
    userMenuPanel.classList.remove("hidden");
    userMenuTrigger.setAttribute("aria-expanded", "true");
  };

  let userMenuPopoverAc: AbortController | null = null;

  const bindUserMenuPopover = () => {
    if (!userMenuWrap || !userMenuTrigger || !userMenuPanel) return;
    userMenuPopoverAc?.abort();
    userMenuPopoverAc = new AbortController();
    const { signal } = userMenuPopoverAc;

    const mode: HeaderPopoverTrigger = loadPrefs().headerUserMenuPopover ?? "click";
    userMenuWrap.dataset.userMenuMode = mode;

    /** Evita que el mismo clic que abre el menú dispare el cierre por el listener de document. */
    let ignoreDocumentClose = false;

    let hover = false;
    let timer: number | null = null;
    const scheduleHide = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!hover) closeUserMenu();
      }, 120);
    };

    if (mode === "hover") {
      userMenuWrap.addEventListener(
        "mouseenter",
        () => {
          hover = true;
          if (timer) window.clearTimeout(timer);
          openUserMenu();
        },
        { signal },
      );
      userMenuWrap.addEventListener(
        "mouseleave",
        () => {
          hover = false;
          scheduleHide();
        },
        { signal },
      );
    }

    userMenuTrigger.addEventListener(
      "click",
      (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.stopPropagation();
        const willOpen = userMenuPanel.classList.contains("hidden");
        // En modo `click` el objetivo es abrir (no alternar cerrado/abierto en el mismo clic).
        if (mode === "click") {
          if (willOpen) {
            openUserMenu();
            ignoreDocumentClose = true;
            queueMicrotask(() => {
              ignoreDocumentClose = false;
            });
          } else {
            // Si ya está abierto, mantenlo abierto.
            openUserMenu();
          }
          return;
        }

        // Modo `hover`: alternar abierto/cerrado con el click.
        if (willOpen) {
          openUserMenu();
          ignoreDocumentClose = true;
          queueMicrotask(() => {
            ignoreDocumentClose = false;
          });
        } else {
          closeUserMenu();
        }
      },
      { signal },
    );

    document.addEventListener(
      "click",
      (e) => {
        if (ignoreDocumentClose) return;
        if (!userMenuWrap.contains(e.target as Node)) closeUserMenu();
      },
      { signal },
    );
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") closeUserMenu();
      },
      { signal },
    );
    userMenuPanel.querySelectorAll("a[role='menuitem']").forEach((a) => {
      a.addEventListener("click", () => closeUserMenu(), { signal });
    });
  };

  bindUserMenuPopover();
  if (!(window as unknown as { __skillatlasUserMenuPrefs?: boolean }).__skillatlasUserMenuPrefs) {
    (window as unknown as { __skillatlasUserMenuPrefs?: boolean }).__skillatlasUserMenuPrefs = true;
    window.addEventListener("skillatlas:prefs-updated", () => bindUserMenuPopover());
  }

  /* Menú /app vs / (logo): siempre hover + clic fuera; pref hover|clic desactivado de momento (ver bloque comentado abajo). */
  if (homeWrap && homeLink && homePopover && homeWrap.dataset.homeHoverBound !== "1") {
    homeWrap.dataset.homeHoverBound = "1";
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
  }

  /* Menú Herramientas (/tools): hover + clic fuera. */
  const toolsWrap = document.querySelector<HTMLElement>("[data-tools-wrap]");
  const toolsLink = document.querySelector<HTMLAnchorElement>("[data-tools-link]");
  const toolsPopover = document.querySelector<HTMLElement>("[data-tools-popover]");
  if (toolsWrap && toolsLink && toolsPopover && toolsWrap.dataset.toolsHoverBound !== "1") {
    toolsWrap.dataset.toolsHoverBound = "1";
    let hover = false;
    let timer: number | null = null;

    const show = () => {
      toolsPopover.classList.remove("hidden");
      toolsPopover.classList.add("block");
      toolsLink.setAttribute("aria-expanded", "true");
    };
    const hide = () => {
      toolsPopover.classList.add("hidden");
      toolsPopover.classList.remove("block");
      toolsLink.setAttribute("aria-expanded", "false");
    };
    const scheduleHide = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!hover) hide();
      }, 120);
    };

    toolsWrap.addEventListener("mouseenter", () => {
      hover = true;
      if (timer) window.clearTimeout(timer);
      show();
    });
    toolsWrap.addEventListener("mouseleave", () => {
      hover = false;
      scheduleHide();
    });
  }

  if (!(window as unknown as { __skillatlasHomeOutsideDoc?: boolean }).__skillatlasHomeOutsideDoc) {
    (window as unknown as { __skillatlasHomeOutsideDoc?: boolean }).__skillatlasHomeOutsideDoc = true;
    document.addEventListener("click", (e) => {
      const hw = document.querySelector<HTMLElement>("[data-home-wrap]");
      const hp = document.querySelector<HTMLElement>("[data-home-popover]");
      if (!hw || !hp) return;
      if (!hw.contains(e.target as Node)) {
        hp.classList.add("hidden");
        hp.classList.remove("block");
      }
    });
  }

  if (!(window as unknown as { __skillatlasToolsOutsideDoc?: boolean }).__skillatlasToolsOutsideDoc) {
    (window as unknown as { __skillatlasToolsOutsideDoc?: boolean }).__skillatlasToolsOutsideDoc = true;
    document.addEventListener("click", (e) => {
      const tw = document.querySelector<HTMLElement>("[data-tools-wrap]");
      const tp = document.querySelector<HTMLElement>("[data-tools-popover]");
      const tl = document.querySelector<HTMLAnchorElement>("[data-tools-link]");
      if (!tw || !tp || !tl) return;
      if (!tw.contains(e.target as Node)) {
        tp.classList.add("hidden");
        tp.classList.remove("block");
        tl.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const tp = document.querySelector<HTMLElement>("[data-tools-popover]");
      const tl = document.querySelector<HTMLAnchorElement>("[data-tools-link]");
      if (!tp || !tl) return;
      tp.classList.add("hidden");
      tp.classList.remove("block");
      tl.setAttribute("aria-expanded", "false");
    });
  }

  /*
  // Pref `headerHomePopover` (hover|clic en logo) — desactivado: el usuario prefiere solo hover.
  // let homePopoverAc: AbortController | null = null;
  // const bindHomePopover = () => { ... loadPrefs().headerHomePopover ... };
  // bindHomePopover();
  // window.addEventListener("skillatlas:prefs-updated", () => bindHomePopover());
  */

  const setAvatar = (url: string | null, emailHint: string | null) => {
    if (!avatarImg || !avatarInitial) return;
    const letter = (emailHint?.trim().charAt(0) || "?").toUpperCase();
    if (url) {
      avatarImg.src = url;
      avatarImg.classList.remove("hidden");
      avatarInitial.classList.add("hidden");
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.classList.add("hidden");
      avatarInitial.classList.remove("hidden");
      avatarInitial.textContent = letter;
    }
  };

  const setVisibility = (isAuthed: boolean) => {
    if (userMenuWrap) {
      userMenuWrap.classList.toggle("hidden", !isAuthed);
    }
    if (!isAuthed) closeUserMenu();

    authNavLinks.forEach((el) => {
      el.classList.toggle("hidden", !isAuthed);
      el.classList.toggle("inline-flex", isAuthed);
    });

    if (publicFooterPricing) {
      publicFooterPricing.classList.toggle("hidden", !isAuthed);
    }

    if (adminHeaderLink) {
      adminHeaderLink.classList.add("hidden");
      adminHeaderLink.classList.remove("inline-flex");
    }
    footerAuthNavLinks.forEach((el) => {
      el.classList.toggle("hidden", !isAuthed);
      el.classList.toggle("inline-flex", isAuthed);
    });

    if (homeLink) homeLink.href = isAuthed ? "/app" : "/";

    if (homePopover) {
      homePopover.classList.add("hidden");
      homePopover.classList.remove("block");
    }
    if (homeWrap) homeWrap.dataset.homeAuthed = isAuthed ? "true" : "false";

    window.dispatchEvent(new Event("skillatlas:auth-nav-updated"));
  };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    setVisibility(false);
    return;
  }

  if (menuSignOutBtn && menuSignOutBtn.dataset.bound !== "1") {
    menuSignOutBtn.dataset.bound = "1";
    menuSignOutBtn.addEventListener("click", async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      closeUserMenu();
      menuSignOutBtn.disabled = true;
      const { error } = await sb.auth.signOut();
      menuSignOutBtn.disabled = false;
      if (error) {
        showToast(i18next.t("settings.auth.logoutError", { message: error.message }), "error");
        return;
      }
      showToast(i18next.t("settings.auth.logoutSuccess"), "success");
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
    const oauthAvatar = oauthPictureFromUser(user);

    let portfolioAvatar: string | null = null;
    if (user) {
      try {
        const { data: prof } = await supabase
          .from("portfolio_profiles")
          .select("avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        const raw = prof?.avatar_url;
        if (typeof raw === "string" && raw) {
          if (raw.startsWith("http://") || raw.startsWith("https://")) {
            portfolioAvatar = raw;
          } else if (raw.includes("/")) {
            const signed = await supabase.storage.from("portfolio_avatars").createSignedUrl(raw, 3600);
            portfolioAvatar = signed.data?.signedUrl ?? null;
          }
        }
      } catch {
        /* ignore */
      }
    }

    const email = typeof user?.email === "string" ? user.email : null;
    setAvatar(portfolioAvatar ?? oauthAvatar, email);
  };

  window.skillatlas = window.skillatlas ?? {};
  window.skillatlas.refreshAuthHeader = render;

  await render();
  supabase.auth.onAuthStateChange(() => {
    void render();
  });

  if (!(window as unknown as { __skillatlasHeaderProfileListener?: boolean }).__skillatlasHeaderProfileListener) {
    (window as unknown as { __skillatlasHeaderProfileListener?: boolean }).__skillatlasHeaderProfileListener = true;
    window.addEventListener("skillatlas:portfolio-profile-updated", () => {
      void window.skillatlas?.refreshAuthHeader?.();
    });
  }
}
