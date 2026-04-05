import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { isSkillAtlasAdmin } from "@scripts/core/admin-role";
import { showToast } from "@scripts/core/ui-feedback";
import { updateLandingCtas } from "@scripts/client-shell/landing-ctas";

export async function initAuthHeader() {
  const settingsLink = document.querySelector<HTMLAnchorElement>("[data-auth-header-settings]");
  const signOutBtn = document.querySelector<HTMLButtonElement>("[data-auth-header-signout]");
  const publicFooterPricing = document.querySelector<HTMLAnchorElement>("[data-public-footer-pricing]");
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
    settingsLink?.classList.toggle("hidden", !isAuthed);
    settingsLink?.classList.toggle("inline-flex", isAuthed);

    signOutBtn?.classList.toggle("hidden", !isAuthed);
    signOutBtn?.classList.toggle("inline-flex", isAuthed);

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

  if (signOutBtn && signOutBtn.dataset.bound !== "1") {
    signOutBtn.dataset.bound = "1";
    signOutBtn.addEventListener("click", async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      signOutBtn.disabled = true;
      const { error } = await sb.auth.signOut();
      signOutBtn.disabled = false;
      if (error) {
        showToast(`No se pudo cerrar sesión: ${error.message}`, "error");
        return;
      }
      showToast("Sesión cerrada.", "success");
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

    setAvatar(portfolioAvatar ?? oauthAvatar);
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
