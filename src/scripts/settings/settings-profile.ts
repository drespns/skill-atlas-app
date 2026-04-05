import i18next from "i18next";
import { HELP_STACK_ITEMS } from "@config/help-stack";
import { isValidPublicSlug, normalizePublicSlug } from "@lib/public-portfolio-slug";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import {
  PUBLIC_PROFILE_STORAGE_KEY,
  readStoredPublicProfile,
  writeStoredPublicProfile,
  type StoredPublicProfile,
} from "@scripts/core/public-profile-local";
import {
  featuredSlugsToTextareaLines,
  normalizePublicAccentHex,
  normalizePublicDensity,
  normalizePublicHeaderStyle,
  normalizePublicTheme,
  parseFeaturedSlugsFromText,
} from "@lib/portfolio-presentation";
import { showToast } from "@scripts/core/ui-feedback";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function collectHelpStackKeys(): string[] {
  const set = new Set<string>();
  document.querySelectorAll<HTMLInputElement>("input[data-help-stack-key]:checked").forEach((cb) => {
    const k = cb.dataset.helpStackKey?.trim();
    if (k) set.add(k);
  });
  return Array.from(set);
}

function applyHelpStackToDom(keys: string[]) {
  const want = new Set(keys);
  document.querySelectorAll<HTMLInputElement>("input[data-help-stack-key]").forEach((cb) => {
    const k = cb.dataset.helpStackKey;
    if (k) cb.checked = want.has(k);
  });
}

async function initSettingsProfile() {
  if (document.body.dataset.settingsProfileInit === "1") return;

  const nameInputs = document.querySelectorAll<HTMLInputElement>("[data-profile-public-name]");
  const bioInputs = document.querySelectorAll<HTMLTextAreaElement>("[data-profile-public-bio]");
  const saveBtns = document.querySelectorAll<HTMLButtonElement>("[data-profile-save]");
  const nameInput = nameInputs[0];
  const bioInput = bioInputs[0];
  const saveBtn = saveBtns[0];
  const hints = document.querySelectorAll<HTMLElement>("[data-profile-feedback]");
  const cloudHints = document.querySelectorAll<HTMLElement>("[data-profile-cloud-hint]");
  const avatarFiles = document.querySelectorAll<HTMLInputElement>("[data-profile-avatar-file]");
  const avatarPreviews = document.querySelectorAll<HTMLImageElement>("[data-profile-avatar-preview]");
  const avatarFallbacks = document.querySelectorAll<HTMLElement>("[data-profile-avatar-fallback]");
  const shareCbs = document.querySelectorAll<HTMLInputElement>("[data-profile-share-enabled]");
  const slugInputs = document.querySelectorAll<HTMLInputElement>("[data-profile-public-slug]");
  const urlPreviews = document.querySelectorAll<HTMLElement>("[data-profile-public-url-preview]");
  const copyBtns = document.querySelectorAll<HTMLButtonElement>("[data-profile-copy-public-url]");
  const applyPublicLinksBtns = document.querySelectorAll<HTMLButtonElement>("[data-profile-apply-public-links]");
  const tokenWraps = document.querySelectorAll<HTMLElement>("[data-portfolio-token-share]");
  const tokenUrlInputs = document.querySelectorAll<HTMLInputElement>("[data-portfolio-token-url]");
  const tokenCopyBtns = document.querySelectorAll<HTMLButtonElement>("[data-portfolio-token-copy]");
  const tokenRotateBtns = document.querySelectorAll<HTMLButtonElement>("[data-portfolio-token-rotate]");
  const cvShareWraps = document.querySelectorAll<HTMLElement>("[data-cv-share]");
  const cvShareEnabledCbs = document.querySelectorAll<HTMLInputElement>("[data-cv-share-enabled]");
  const cvShareUrlInputs = document.querySelectorAll<HTMLInputElement>("[data-cv-share-url]");
  const cvShareCopyBtns = document.querySelectorAll<HTMLButtonElement>("[data-cv-share-copy]");
  const cvShareRotateBtns = document.querySelectorAll<HTMLButtonElement>("[data-cv-share-rotate]");
  const layoutSels = document.querySelectorAll<HTMLSelectElement>("[data-profile-public-layout]");
  const embedLimitSels = document.querySelectorAll<HTMLSelectElement>("[data-profile-public-embeds-limit]");
  const heroCtaLabelIns = document.querySelectorAll<HTMLInputElement>("[data-profile-hero-cta-label]");
  const heroCtaUrlIns = document.querySelectorAll<HTMLInputElement>("[data-profile-hero-cta-url]");
  const themeSels = document.querySelectorAll<HTMLSelectElement>("[data-profile-public-theme]");
  const densitySels = document.querySelectorAll<HTMLSelectElement>("[data-profile-public-density]");
  const accentColors = document.querySelectorAll<HTMLInputElement>("[data-profile-accent-color]");
  const accentHexIns = document.querySelectorAll<HTMLInputElement>("[data-profile-accent-hex]");
  const accentClearBtns = document.querySelectorAll<HTMLButtonElement>("[data-profile-accent-clear]");
  const headerStyleSels = document.querySelectorAll<HTMLSelectElement>("[data-profile-header-style]");
  const featuredTas = document.querySelectorAll<HTMLTextAreaElement>("[data-profile-featured-slugs]");
  const featuredHints = document.querySelectorAll<HTMLElement>("[data-profile-featured-slugs-hint]");

  if (nameInputs.length === 0 || bioInputs.length === 0 || saveBtns.length === 0) return;
  document.body.dataset.settingsProfileInit = "1";

  const defaultName = nameInput.dataset.defaultPublicName ?? "";
  const defaultBio = bioInput.dataset.defaultPublicBio ?? "";

  const slugPrimary = () => slugInputs[0]?.value ?? "";

  const updatePublicUrlPreview = () => {
    const norm = normalizePublicSlug(slugPrimary());
    const origin = window.location.origin;
    const text =
      norm && isValidPublicSlug(norm) ? `${origin}/portfolio/${norm}` : `${origin}/portfolio/…`;
    urlPreviews.forEach((el) => {
      el.textContent = text;
    });
  };

  slugInputs.forEach((si) => {
    if (si.dataset.slugPreviewBound === "1") return;
    si.dataset.slugPreviewBound = "1";
    si.addEventListener("input", () => {
      const v = si.value;
      slugInputs.forEach((o) => {
        if (o !== si) o.value = v;
      });
      updatePublicUrlPreview();
    });
  });
  shareCbs.forEach((cb) => {
    if (cb.dataset.slugPreviewBound === "1") return;
    cb.dataset.slugPreviewBound = "1";
    cb.addEventListener("change", () => {
      const on = cb.checked;
      shareCbs.forEach((o) => {
        if (o !== cb) o.checked = on;
      });
      updatePublicUrlPreview();
    });
  });
  copyBtns.forEach((copyBtn) => {
    if (copyBtn.dataset.bound === "1") return;
    copyBtn.dataset.bound = "1";
    copyBtn.addEventListener("click", async () => {
      const norm = normalizePublicSlug(slugPrimary());
      if (!isValidPublicSlug(norm)) {
        showToast(
          tt("settings.portfolio.copyNeedsValidSlug", "Elige un identificador válido para copiar el enlace."),
          "error",
        );
        return;
      }
      const url = `${window.location.origin}/portfolio/${norm}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast(tt("settings.portfolio.copySuccess", "Enlace copiado."), "success");
      } catch {
        showToast(tt("settings.portfolio.copyFailed", "No se pudo copiar al portapapeles."), "error");
      }
    });
  });

  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;
  let pendingAvatarFile: File | null = null;
  let avatarUrl: string | null = null;
  let portfolioShareToken: string | null = null;
  let cvShareEnabled: boolean | null = null;
  let cvShareToken: string | null = null;

  if (!userId || !supabase) {
    shareCbs.forEach((el) => {
      el.disabled = true;
    });
    slugInputs.forEach((el) => {
      el.disabled = true;
    });
    copyBtns.forEach((el) => {
      el.disabled = true;
    });
    layoutSels.forEach((el) => {
      el.disabled = true;
    });
    embedLimitSels.forEach((el) => {
      el.disabled = true;
    });
    heroCtaLabelIns.forEach((el) => {
      el.disabled = true;
    });
    heroCtaUrlIns.forEach((el) => {
      el.disabled = true;
    });
    themeSels.forEach((el) => {
      el.disabled = true;
    });
    densitySels.forEach((el) => {
      el.disabled = true;
    });
    accentColors.forEach((el) => {
      el.disabled = true;
    });
    accentHexIns.forEach((el) => {
      el.disabled = true;
    });
    accentClearBtns.forEach((el) => {
      el.disabled = true;
    });
    headerStyleSels.forEach((el) => {
      el.disabled = true;
    });
    featuredTas.forEach((el) => {
      el.disabled = true;
    });
    applyPublicLinksBtns.forEach((el) => {
      el.disabled = true;
    });
  }

  const setAvatarPreview = (url: string | null) => {
    avatarPreviews.forEach((avatarPreview, i) => {
      const avatarFallback = avatarFallbacks[i];
      if (url) {
        avatarPreview.src = url;
        avatarPreview.classList.remove("hidden");
        avatarFallback?.classList.add("hidden");
      } else {
        avatarPreview.removeAttribute("src");
        avatarPreview.classList.add("hidden");
        avatarFallback?.classList.remove("hidden");
      }
    });
  };

  /** Storage path `userId/file.ext` needs a signed URL for <img src>. */
  const resolveAvatarSrcForPreview = async (raw: string | null): Promise<string | null> => {
    if (!raw) return null;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (!supabase || !raw.includes("/")) return null;
    try {
      const { data } = await supabase.storage.from("portfolio_avatars").createSignedUrl(raw, 60 * 60);
      return data?.signedUrl ?? null;
    } catch {
      return null;
    }
  };

  const syncAvatarPreviewFromState = async () => {
    if (!avatarUrl) {
      setAvatarPreview(null);
      return;
    }
    const src = await resolveAvatarSrcForPreview(avatarUrl);
    if (src) {
      setAvatarPreview(src);
      return;
    }
    if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
      setAvatarPreview(avatarUrl);
      return;
    }
    const { data: sessionData } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const meta = (sessionData?.session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const fb =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null;
    setAvatarPreview(fb);
  };

  const afterProfilePersisted = async () => {
    await syncAvatarPreviewFromState();
    window.dispatchEvent(new Event("skillatlas:portfolio-profile-updated"));
  };

  avatarFiles.forEach((avatarFile) => {
    if (avatarFile.dataset.bound === "1") return;
    avatarFile.dataset.bound = "1";
    avatarFile.addEventListener("change", () => {
      const f = avatarFile.files?.[0] ?? null;
      if (!f) return;
      pendingAvatarFile = f;
      const url = URL.createObjectURL(f);
      setAvatarPreview(url);
    });
  });

  const loadLocal = (): StoredPublicProfile => {
    const s = readStoredPublicProfile();
    const helpStack = Array.isArray(s?.helpStack)
      ? s.helpStack.filter((x): x is string => typeof x === "string")
      : [];
    return {
      publicName: (s?.publicName ?? defaultName).trim() || defaultName,
      bio: (s?.bio ?? defaultBio).trim() || defaultBio,
      helpStack,
    };
  };

  const applyToForm = (p: StoredPublicProfile) => {
    nameInputs.forEach((el) => {
      el.value = p.publicName;
    });
    bioInputs.forEach((el) => {
      el.value = p.bio;
    });
    applyHelpStackToDom(p.helpStack);
  };

  const applyShareToForm = (shareEnabled: boolean, publicSlug: string) => {
    shareCbs.forEach((cb) => {
      if (!cb.disabled) cb.checked = shareEnabled;
    });
    slugInputs.forEach((si) => {
      if (!si.disabled) si.value = publicSlug;
    });
    updatePublicUrlPreview();
  };

  if (supabase && userId) {
    let data: {
      display_name?: string | null;
      bio?: string | null;
      help_stack?: unknown;
      avatar_url?: string | null;
      share_enabled?: boolean | null;
      public_slug?: string | null;
      share_token?: string | null;
      cv_share_enabled?: boolean | null;
      cv_share_token?: string | null;
      public_layout?: string | null;
      public_embeds_limit?: number | null;
      public_hero_cta_label?: string | null;
      public_hero_cta_url?: string | null;
      public_theme?: string | null;
      public_density?: string | null;
      public_accent_hex?: string | null;
      public_header_style?: string | null;
      featured_project_slugs?: unknown;
    } | null = null;
    let error: { message?: string; code?: string } | null = null;

    const selWith014 =
      "display_name, bio, help_stack, avatar_url, share_enabled, share_token, public_slug, cv_share_enabled, cv_share_token, public_layout, public_embeds_limit, public_hero_cta_label, public_hero_cta_url, public_theme, public_density, public_accent_hex, public_header_style, featured_project_slugs";
    const sel013Only =
      "display_name, bio, help_stack, avatar_url, share_enabled, share_token, public_slug, cv_share_enabled, cv_share_token, public_layout, public_embeds_limit, public_hero_cta_label, public_hero_cta_url";
    const selNo013 =
      "display_name, bio, help_stack, avatar_url, share_enabled, share_token, public_slug, cv_share_enabled, cv_share_token";

    let resOpt = await supabase.from("portfolio_profiles").select(selWith014).eq("user_id", userId).maybeSingle();

    if (
      resOpt.error &&
      /public_theme|public_density|public_accent_hex|public_header_style|featured_project_slugs|42703|column/i.test(
        resOpt.error.message ?? "",
      )
    ) {
      resOpt = await supabase.from("portfolio_profiles").select(sel013Only).eq("user_id", userId).maybeSingle();
    }

    if (resOpt.error && /public_layout|public_embeds_limit|public_hero_cta|42703|column/i.test(resOpt.error.message ?? "")) {
      resOpt = await supabase.from("portfolio_profiles").select(selNo013).eq("user_id", userId).maybeSingle();
    }

    if (resOpt.error && /public_slug|42703|column/i.test(resOpt.error.message ?? "")) {
      resOpt = await supabase
        .from("portfolio_profiles")
        .select("display_name, bio, help_stack, avatar_url, share_enabled, share_token, cv_share_enabled, cv_share_token")
        .eq("user_id", userId)
        .maybeSingle();
    }

    if (resOpt.error && /cv_share_|share_token|column/i.test(resOpt.error.message ?? "")) {
      resOpt = await supabase
        .from("portfolio_profiles")
        .select("display_name, bio, help_stack, avatar_url, share_enabled, share_token")
        .eq("user_id", userId)
        .maybeSingle();
    }

    if (resOpt.error && /help_stack|column/i.test(resOpt.error.message ?? "")) {
      const resBasic = await supabase
        .from("portfolio_profiles")
        .select("display_name, bio, share_enabled, share_token")
        .eq("user_id", userId)
        .maybeSingle();
      data = resBasic.data;
      error = resBasic.error;
    } else {
      data = resOpt.data;
      error = resOpt.error;
    }

    if (!error && data) {
      const hsRaw = data.help_stack;
      const helpFromServer = Array.isArray(hsRaw)
        ? (hsRaw as unknown[]).filter((x): x is string => typeof x === "string")
        : [];

      const merged: StoredPublicProfile = {
        publicName: (data.display_name ?? "").trim() || defaultName,
        bio: data.bio ?? "",
        helpStack:
          helpFromServer.length > 0
            ? helpFromServer.filter((k) => HELP_STACK_ITEMS.some((i) => i.key === k))
            : loadLocal().helpStack,
      };
      applyToForm(merged);
      writeStoredPublicProfile(merged);
      cloudHints.forEach((h) => {
        h.textContent = "";
      });

      const slugStr = data.public_slug != null ? String(data.public_slug).trim() : "";
      applyShareToForm(Boolean(data.share_enabled), slugStr);

      portfolioShareToken =
        typeof (data as any).share_token === "string" && (data as any).share_token ? String((data as any).share_token) : null;

      cvShareEnabled = typeof (data as any).cv_share_enabled === "boolean" ? Boolean((data as any).cv_share_enabled) : null;
      cvShareToken =
        typeof (data as any).cv_share_token === "string" && (data as any).cv_share_token
          ? String((data as any).cv_share_token)
          : null;

      const a = (data as { avatar_url?: string | null }).avatar_url;
      avatarUrl = typeof a === "string" && a ? a : null;
      if (!avatarUrl) {
        const { data: sessionData } = await supabase.auth.getSession();
        const meta = (sessionData.session?.user?.user_metadata ?? {}) as Record<string, unknown>;
        avatarUrl =
          (typeof meta.avatar_url === "string" && meta.avatar_url) ||
          (typeof meta.picture === "string" && meta.picture) ||
          null;
      }
      await syncAvatarPreviewFromState();

      layoutSels.forEach((layoutSel) => {
        if (!layoutSel.disabled) {
          const pl = data.public_layout != null ? String(data.public_layout).toLowerCase() : "grid";
          layoutSel.value = pl === "list" ? "list" : "grid";
        }
      });
      embedLimitSels.forEach((embedLimitSel) => {
        if (!embedLimitSel.disabled) {
          const n = Number(data.public_embeds_limit);
          const lim = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 3;
          embedLimitSel.value = String(lim);
        }
      });
      heroCtaLabelIns.forEach((heroCtaLabelIn) => {
        if (!heroCtaLabelIn.disabled) {
          heroCtaLabelIn.value = data.public_hero_cta_label != null ? String(data.public_hero_cta_label) : "";
        }
      });
      heroCtaUrlIns.forEach((heroCtaUrlIn) => {
        if (!heroCtaUrlIn.disabled) {
          heroCtaUrlIn.value = data.public_hero_cta_url != null ? String(data.public_hero_cta_url) : "";
        }
      });
      themeSels.forEach((themeSel) => {
        if (!themeSel.disabled) themeSel.value = normalizePublicTheme(data.public_theme);
      });
      densitySels.forEach((densitySel) => {
        if (!densitySel.disabled) densitySel.value = normalizePublicDensity(data.public_density);
      });
      headerStyleSels.forEach((headerStyleSel) => {
        if (!headerStyleSel.disabled) headerStyleSel.value = normalizePublicHeaderStyle(data.public_header_style);
      });
      accentHexIns.forEach((accentHexIn, i) => {
        if (!accentHexIn.disabled) {
          const hx = normalizePublicAccentHex(data.public_accent_hex);
          accentHexIn.value = hx ?? "";
          const ac = accentColors[i];
          if (ac) ac.value = hx ? `#${hx}` : "#10b981";
        }
      });
      featuredTas.forEach((featuredTa) => {
        if (!featuredTa.disabled) {
          featuredTa.value = featuredSlugsToTextareaLines(data.featured_project_slugs);
        }
      });

      const loadFeaturedHint = async () => {
        if (featuredHints.length === 0 || !supabase || !userId) return;
        const { data: pl } = await supabase.from("projects").select("slug").eq("user_id", userId).order("slug");
        const slugs = (pl ?? []).map((r: { slug: string }) => r.slug).filter(Boolean);
        const text =
          slugs.length > 0
            ? `${tt("settings.portfolio.featuredHintPrefix", "Slugs de tus proyectos:")} ${slugs.join(", ")}`
            : tt("settings.portfolio.featuredHintEmpty", "Crea proyectos para ver aquí sus slugs.");
        featuredHints.forEach((h) => {
          h.textContent = text;
        });
      };
      void loadFeaturedHint();
    } else {
      applyToForm(loadLocal());
      applyShareToForm(false, "");
      cloudHints.forEach((h) => {
        h.textContent = "";
      });
    }
  } else {
    applyToForm(loadLocal());
    applyShareToForm(false, "");
    cloudHints.forEach((h) => {
      h.textContent = "";
    });
  }

  const updateCvShareUrl = () => {
    const v = cvShareToken ? `${window.location.origin}/cv/p/${cvShareToken}` : "";
    cvShareUrlInputs.forEach((inp) => {
      inp.value = v;
    });
  };

  const syncCvShareCheckboxes = () => {
    cvShareEnabledCbs.forEach((cb) => {
      cb.checked = Boolean(cvShareEnabled);
    });
  };

  if (supabase && userId && (cvShareEnabled !== null || Boolean(cvShareToken))) {
    cvShareWraps.forEach((cvShareWrap, i) => {
      const cvShareEnabledCb = cvShareEnabledCbs[i];
      const cvShareUrlInput = cvShareUrlInputs[i];
      const cvShareCopyBtn = cvShareCopyBtns[i];
      const cvShareRotateBtn = cvShareRotateBtns[i];
      if (!cvShareWrap || !cvShareEnabledCb || !cvShareUrlInput || !cvShareCopyBtn || !cvShareRotateBtn) return;
      cvShareWrap.classList.remove("hidden");
    });
    syncCvShareCheckboxes();
    updateCvShareUrl();

    cvShareEnabledCbs.forEach((cvShareEnabledCb) => {
      if (cvShareEnabledCb.dataset.bound === "1") return;
      cvShareEnabledCb.dataset.bound = "1";
      cvShareEnabledCb.addEventListener("change", async () => {
        const nextEnabled = Boolean(cvShareEnabledCb.checked);
        const nextToken = cvShareToken ?? crypto.randomUUID();
        try {
          const up1 = await supabase
            .from("portfolio_profiles")
            .upsert({ user_id: userId, cv_share_enabled: nextEnabled, cv_share_token: nextToken } as any, {
              onConflict: "user_id",
            })
            .select("cv_share_enabled, cv_share_token")
            .maybeSingle();
          if (up1.error) {
            if (/duplicate key|unique/i.test(up1.error.message ?? "")) {
              const retryToken = crypto.randomUUID();
              const up2 = await supabase
                .from("portfolio_profiles")
                .upsert({ user_id: userId, cv_share_enabled: nextEnabled, cv_share_token: retryToken } as any, {
                  onConflict: "user_id",
                })
                .select("cv_share_enabled, cv_share_token")
                .maybeSingle();
              if (up2.error) throw up2.error;
              cvShareEnabled =
                typeof (up2.data as any)?.cv_share_enabled === "boolean" ? (up2.data as any).cv_share_enabled : nextEnabled;
              cvShareToken = typeof (up2.data as any)?.cv_share_token === "string" ? (up2.data as any).cv_share_token : retryToken;
            } else {
              throw up1.error;
            }
          } else {
            cvShareEnabled =
              typeof (up1.data as any)?.cv_share_enabled === "boolean" ? (up1.data as any).cv_share_enabled : nextEnabled;
            cvShareToken = typeof (up1.data as any)?.cv_share_token === "string" ? (up1.data as any).cv_share_token : nextToken;
          }
          syncCvShareCheckboxes();
          updateCvShareUrl();
          showToast(
            nextEnabled
              ? tt("cv.publicShareEnabledToast", "Enlace público activado.")
              : tt("cv.publicShareDisabledToast", "Enlace público desactivado."),
            "success",
          );
        } catch (e: any) {
          syncCvShareCheckboxes();
          showToast(e?.message ?? tt("cv.publicShareSaveError", "No se pudo guardar."), "error");
        }
      });
    });

    cvShareCopyBtns.forEach((cvShareCopyBtn, i) => {
      if (cvShareCopyBtn.dataset.bound === "1") return;
      cvShareCopyBtn.dataset.bound = "1";
      cvShareCopyBtn.addEventListener("click", async () => {
        const url = (cvShareUrlInputs[i]?.value ?? "").trim();
        if (!url) {
          showToast(tt("cv.publicShareNoUrl", "Activa el enlace para poder copiarlo."), "warning");
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          showToast(tt("cv.publicShareCopied", "Enlace copiado."), "success");
        } catch {
          showToast(tt("settings.portfolio.copyFailed", "No se pudo copiar al portapapeles."), "error");
        }
      });
    });

    cvShareRotateBtns.forEach((cvShareRotateBtn) => {
      if (cvShareRotateBtn.dataset.bound === "1") return;
      cvShareRotateBtn.dataset.bound = "1";
      cvShareRotateBtn.addEventListener("click", async () => {
        try {
          const next = crypto.randomUUID();
          const up = await supabase
            .from("portfolio_profiles")
            .upsert({ user_id: userId, cv_share_token: next } as any, { onConflict: "user_id" })
            .select("cv_share_token")
            .maybeSingle();
          if (up.error) throw up.error;
          const got = (up.data as any)?.cv_share_token;
          cvShareToken = typeof got === "string" && got ? got : next;
          updateCvShareUrl();
          showToast(tt("cv.publicShareRotated", "Enlace regenerado."), "success");
        } catch (e: any) {
          showToast(e?.message ?? tt("cv.publicShareRotateError", "No se pudo regenerar."), "error");
        }
      });
    });
  }

  const updatePortfolioTokenUrl = () => {
    const v = portfolioShareToken ? `${window.location.origin}/p/${portfolioShareToken}` : "";
    tokenUrlInputs.forEach((inp) => {
      inp.value = v;
    });
  };

  if (supabase && userId && portfolioShareToken) {
    tokenWraps.forEach((tokenWrap) => {
      tokenWrap.classList.remove("hidden");
    });
    updatePortfolioTokenUrl();

    tokenCopyBtns.forEach((tokenCopyBtn, i) => {
      if (tokenCopyBtn.dataset.bound === "1") return;
      tokenCopyBtn.dataset.bound = "1";
      tokenCopyBtn.addEventListener("click", async () => {
        const url = (tokenUrlInputs[i]?.value ?? "").trim();
        if (!url) {
          showToast(tt("settings.portfolio.tokenNoUrl", "No hay enlace todavía."), "warning");
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          showToast(tt("settings.portfolio.copySuccess", "Enlace copiado."), "success");
        } catch {
          showToast(tt("settings.portfolio.copyFailed", "No se pudo copiar al portapapeles."), "error");
        }
      });
    });

    tokenRotateBtns.forEach((tokenRotateBtn) => {
      if (tokenRotateBtn.dataset.bound === "1") return;
      tokenRotateBtn.dataset.bound = "1";
      tokenRotateBtn.addEventListener("click", async () => {
        try {
          const next = crypto.randomUUID();
          const up = await supabase
            .from("portfolio_profiles")
            .upsert({ user_id: userId, share_token: next } as any, { onConflict: "user_id" })
            .select("share_token")
            .maybeSingle();
          if (up.error) throw up.error;
          const got = (up.data as any)?.share_token;
          portfolioShareToken = typeof got === "string" && got ? got : next;
          updatePortfolioTokenUrl();
          showToast(tt("settings.portfolio.tokenRotated", "Enlace regenerado."), "success");
        } catch (e: any) {
          showToast(e?.message ?? tt("settings.portfolio.tokenRotateError", "No se pudo regenerar."), "error");
        }
      });
    });
  }

  accentColors.forEach((accentColor, i) => {
    const accentHexIn = accentHexIns[i];
    if (!accentHexIn || accentColor.dataset.skillatlasAccentSync === "1") return;
    accentColor.dataset.skillatlasAccentSync = "1";
    accentColor.addEventListener("input", () => {
      const v = accentColor.value.replace(/^#/, "");
      if (/^[0-9A-Fa-f]{6}$/.test(v)) accentHexIn.value = v.toUpperCase();
    });
    accentHexIn.addEventListener("input", () => {
      const n = normalizePublicAccentHex(accentHexIn.value);
      if (n) accentColor.value = `#${n}`;
    });
  });
  accentClearBtns.forEach((accentClearBtn, i) => {
    if (accentClearBtn.dataset.bound === "1") return;
    accentClearBtn.dataset.bound = "1";
    accentClearBtn.addEventListener("click", () => {
      const accentHexIn = accentHexIns[i];
      const accentColor = accentColors[i];
      if (accentHexIn) accentHexIn.value = "";
      if (accentColor) accentColor.value = "#10b981";
    });
  });

  applyPublicLinksBtns.forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", async () => {
      if (!supabase || !userId) {
        showToast(tt("settings.portfolio.applyNeedsSession", "Inicia sesión para aplicar estos cambios."), "error");
        return;
      }
      const shareOn = shareCbs[0]?.checked ?? false;
      const slugNorm = normalizePublicSlug(slugPrimary());
      const slugToSave = isValidPublicSlug(slugNorm) ? slugNorm : null;
      if (shareOn && !slugToSave) {
        showToast(
          tt(
            "settings.portfolio.slugInvalid",
            "Para publicar necesitas un identificador válido: 2–32 caracteres, minúsculas, números o guiones (sin reservadas).",
          ),
          "error",
        );
        return;
      }
      const payload: Record<string, unknown> = {
        user_id: userId,
        share_enabled: shareOn,
        public_slug: slugToSave,
      };
      if (portfolioShareToken) payload.share_token = portfolioShareToken;
      if (cvShareToken) payload.cv_share_token = cvShareToken;
      if (cvShareEnabled !== null) payload.cv_share_enabled = cvShareEnabled;

      let res = await supabase.from("portfolio_profiles").upsert(payload, { onConflict: "user_id" });
      if (res.error) {
        const msg = res.error.message ?? "";
        const code = (res.error as { code?: string }).code;
        if (code === "23505") {
          showToast(tt("settings.portfolio.slugTaken", "Ese identificador ya está en uso. Prueba otro."), "error");
          return;
        }
        if (msg.includes("public_slug")) {
          const { public_slug: _ps, ...rest } = payload;
          res = await supabase.from("portfolio_profiles").upsert(rest, { onConflict: "user_id" });
        }
      }
      if (res.error) {
        showToast(
          res.error.message ?? tt("settings.portfolio.publicLinksSaveError", "No se pudo guardar la visibilidad ni el slug."),
          "error",
        );
        return;
      }
      applyShareToForm(shareOn, slugToSave ?? "");
      if (shareOn && portfolioShareToken) {
        tokenWraps.forEach((w) => w.classList.remove("hidden"));
        updatePortfolioTokenUrl();
      }
      showToast(tt("settings.portfolio.publicLinksSaved", "Visibilidad y enlace públicos guardados."), "success");
      window.dispatchEvent(new Event("skillatlas:portfolio-profile-updated"));
    });
  });

  saveBtns.forEach((saveBtn) => {
    if (saveBtn.dataset.bound === "1") return;
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const publicName = (nameInputs[0]?.value ?? "").trim() || defaultName;
      const bio = (bioInputs[0]?.value ?? "").trim();
      const helpStack = collectHelpStackKeys();
      const payload: StoredPublicProfile = { publicName, bio, helpStack };
      writeStoredPublicProfile(payload);
      applyToForm(payload);

      const shareOn = shareCbs[0]?.checked ?? false;
      const slugNorm = normalizePublicSlug(slugPrimary());
      const slugToSave = isValidPublicSlug(slugNorm) ? slugNorm : null;
      if (shareOn && !slugToSave) {
        showToast(
          tt(
            "settings.portfolio.slugInvalid",
            "Para publicar necesitas un identificador válido: 2–32 caracteres, minúsculas, números o guiones (sin reservadas).",
          ),
          "error",
        );
        return;
      }

      const publicLayout = layoutSels[0]?.value === "list" ? "list" : "grid";
      let embedLim = Number(embedLimitSels[0]?.value ?? "3");
      if (!Number.isFinite(embedLim)) embedLim = 3;
      embedLim = Math.min(5, Math.max(1, Math.round(embedLim)));
      const rawCtaLabel = (heroCtaLabelIns[0]?.value ?? "").trim();
      const rawCtaUrl = (heroCtaUrlIns[0]?.value ?? "").trim();
      if (rawCtaLabel && !rawCtaUrl) {
        showToast(
          tt("settings.portfolio.heroCtaNeedsUrl", "Si pones texto del botón, indica también una URL https válida."),
          "error",
        );
        return;
      }
      if (rawCtaUrl) {
        try {
          const u = new URL(rawCtaUrl);
          if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad");
        } catch {
          showToast(tt("settings.portfolio.heroCtaUrlInvalid", "La URL del botón debe ser http o https."), "error");
          return;
        }
      }
      const heroCtaLabelToSave = rawCtaLabel || null;
      const heroCtaUrlToSave = rawCtaUrl || null;

      const publicTheme = normalizePublicTheme(themeSels[0]?.value);
      const publicDensity = normalizePublicDensity(densitySels[0]?.value);
      const publicHeaderStyleSave = normalizePublicHeaderStyle(headerStyleSels[0]?.value);
      const accentParsed = normalizePublicAccentHex(accentHexIns[0]?.value ?? "");
      const publicAccentHexSave = accentParsed ? accentParsed.toUpperCase() : null;

      let featuredSaved: string[] = [];
      if (supabase && userId) {
        const wishFeatured = parseFeaturedSlugsFromText(featuredTas[0]?.value ?? "");
        const { data: pslug } = await supabase.from("projects").select("slug").eq("user_id", userId);
        const valid = new Set((pslug ?? []).map((r: { slug: string }) => String(r.slug).toLowerCase()));
        featuredSaved = wishFeatured.filter((s) => valid.has(s.toLowerCase()));
        if (wishFeatured.length > featuredSaved.length) {
          showToast(
            tt(
              "settings.portfolio.featuredSlugsFiltered",
              "Se ignoraron líneas que no coinciden con el slug de ningún proyecto.",
            ),
            "warning",
          );
        }
      }

      hints.forEach((hint) => {
        hint.textContent = "Guardado.";
        hint.className = "m-0 text-xs text-green-600 dark:text-green-400";
      });
      window.setTimeout(() => {
        hints.forEach((hint) => {
          hint.textContent = "";
        });
      }, 3200);

      if (supabase && userId) {
        let nextAvatarUrl: string | null = avatarUrl;
        if (pendingAvatarFile) {
          const ext = (pendingAvatarFile.name.split(".").pop() || "png").toLowerCase();
          const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
          const path = `${userId}/avatar.${safeExt}`;
          const upload = await supabase.storage.from("portfolio_avatars").upload(path, pendingAvatarFile, {
            upsert: true,
            cacheControl: "3600",
            contentType: pendingAvatarFile.type || undefined,
          });
          if (upload.error) {
            showToast(upload.error.message ?? "No se pudo subir la imagen.", "error");
            return;
          }
          nextAvatarUrl = path;
        }

        const row: Record<string, unknown> = {
          user_id: userId,
          display_name: publicName,
          bio,
          help_stack: helpStack,
          avatar_url: nextAvatarUrl,
          share_enabled: shareOn,
          public_slug: slugToSave,
          public_layout: publicLayout,
          public_embeds_limit: embedLim,
          public_hero_cta_label: heroCtaLabelToSave,
          public_hero_cta_url: heroCtaUrlToSave,
          public_theme: publicTheme,
          public_density: publicDensity,
          public_accent_hex: publicAccentHexSave,
          public_header_style: publicHeaderStyleSave,
          featured_project_slugs: featuredSaved,
        };
        if (portfolioShareToken) row.share_token = portfolioShareToken;
        if (cvShareToken) row.cv_share_token = cvShareToken;
        if (cvShareEnabled !== null) row.cv_share_enabled = cvShareEnabled;

        const tryUpsert = async (r: Record<string, unknown>) =>
          supabase.from("portfolio_profiles").upsert(r, { onConflict: "user_id" });

        let res = await tryUpsert(row);
        if (res.error) {
          const msg = res.error.message ?? "";
          const code = (res.error as { code?: string }).code;
          if (code === "23505") {
            showToast(
              tt("settings.portfolio.slugTaken", "Ese identificador ya está en uso. Prueba otro."),
              "error",
            );
            return;
          }
          if (msg.includes("public_slug")) {
            const { public_slug: _ps, ...rest } = row;
            res = await tryUpsert(rest);
            if (!res.error) {
              showToast(
                tt(
                  "settings.portfolio.savedProfileSlugNeedsMigration",
                  "Perfil guardado. La URL pública no se guardó hasta aplicar saas-011 en Supabase.",
                ),
                "info",
              );
              cloudHints.forEach((h) => {
                h.textContent = "";
              });
              avatarUrl = nextAvatarUrl;
              pendingAvatarFile = null;
              updatePublicUrlPreview();
              await afterProfilePersisted();
              return;
            }
          }
          if (
            msg.includes("public_layout") ||
            msg.includes("public_embeds_limit") ||
            msg.includes("public_hero_cta")
          ) {
            const {
              public_layout: _pl,
              public_embeds_limit: _pel,
              public_hero_cta_label: _hl,
              public_hero_cta_url: _hu,
              ...restDisplay
            } = row;
            res = await tryUpsert(restDisplay);
            if (!res.error) {
              showToast(
                tt(
                  "settings.portfolio.savedProfileDisplayNeedsMigration",
                  "Perfil guardado. La vista pública no se sincronizó hasta aplicar saas-013.",
                ),
                "info",
              );
              cloudHints.forEach((h) => {
                h.textContent = "";
              });
              avatarUrl = nextAvatarUrl;
              pendingAvatarFile = null;
              updatePublicUrlPreview();
              await afterProfilePersisted();
              return;
            }
          }
          if (
            msg.includes("public_theme") ||
            msg.includes("public_density") ||
            msg.includes("public_accent_hex") ||
            msg.includes("public_header_style") ||
            msg.includes("featured_project_slugs")
          ) {
            const {
              public_theme: _pt,
              public_density: _pd,
              public_accent_hex: _pa,
              public_header_style: _ph,
              featured_project_slugs: _pf,
              ...rest014
            } = row;
            res = await tryUpsert(rest014);
            if (!res.error) {
              showToast(
                tt(
                  "settings.portfolio.savedProfile014Migration",
                  "Perfil guardado. La presentación pública no se guardó hasta aplicar saas-014 en Supabase.",
                ),
                "info",
              );
              cloudHints.forEach((h) => {
                h.textContent = "";
              });
              avatarUrl = nextAvatarUrl;
              pendingAvatarFile = null;
              updatePublicUrlPreview();
              await afterProfilePersisted();
              return;
            }
          }
          const noColumn = msg.includes("help_stack") || (msg.includes("column") && !msg.includes("public_slug"));
          if (noColumn) {
            const minimal: Record<string, unknown> = {
              user_id: userId,
              display_name: publicName,
              bio,
              avatar_url: nextAvatarUrl,
              share_enabled: shareOn,
              public_slug: slugToSave,
            };
            if (portfolioShareToken) minimal.share_token = portfolioShareToken;
            if (cvShareToken) minimal.cv_share_token = cvShareToken;
            if (cvShareEnabled !== null) minimal.cv_share_enabled = cvShareEnabled;
            const res2 = await supabase.from("portfolio_profiles").upsert(minimal, { onConflict: "user_id" });
            if (res2.error) {
              showToast(res2.error.message ?? "No se pudo guardar.", "error");
              return;
            }
            showToast("Perfil guardado.", "success");
            avatarUrl = nextAvatarUrl;
            pendingAvatarFile = null;
            updatePublicUrlPreview();
            await afterProfilePersisted();
            return;
          }
          showToast(res.error.message ?? "No se pudo guardar.", "error");
          return;
        }
        showToast("Perfil guardado.", "success");
        cloudHints.forEach((h) => {
          h.textContent = "";
        });
        avatarUrl = nextAvatarUrl;
        pendingAvatarFile = null;
        updatePublicUrlPreview();
        await afterProfilePersisted();
      } else {
        showToast("Perfil guardado.", "success");
      }
    });
  });

  if ((window as any).__skillatlasProfileStorageBound !== true) {
    (window as any).__skillatlasProfileStorageBound = true;
    window.addEventListener("storage", (e) => {
      if (e.key === PUBLIC_PROFILE_STORAGE_KEY) applyToForm(loadLocal());
    });
  }
}

const boot = () => void initSettingsProfile();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);
