import i18next from "i18next";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { isSkillAtlasAdmin } from "@scripts/core/admin-role";
import { showToast } from "@scripts/core/ui-feedback";
import { updateLandingCtas } from "@scripts/client-shell/landing-ctas";

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

  if (userMenuWrap && userMenuTrigger && userMenuPanel && userMenuTrigger.dataset.menuBound !== "1") {
    userMenuTrigger.dataset.menuBound = "1";
    userMenuTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = userMenuPanel.classList.contains("hidden");
      if (open) openUserMenu();
      else closeUserMenu();
    });
    document.addEventListener("click", (e) => {
      if (!userMenuWrap.contains(e.target as Node)) closeUserMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeUserMenu();
    });
    userMenuPanel.querySelectorAll("a[role='menuitem']").forEach((a) => {
      a.addEventListener("click", () => closeUserMenu());
    });
  }

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

    const oauthAvatar =
      lastProvider === "linkedin_oidc"
        ? linkedinAvatar ?? githubAvatar
        : lastProvider === "github"
          ? githubAvatar ?? linkedinAvatar
          : githubAvatar ?? linkedinAvatar;

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
