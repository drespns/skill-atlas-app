import i18next from "i18next";
import { HELP_STACK_ITEMS } from "../config/help-stack";
import { isValidPublicSlug, normalizePublicSlug } from "../lib/public-portfolio-slug";
import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import {
  PUBLIC_PROFILE_STORAGE_KEY,
  readStoredPublicProfile,
  writeStoredPublicProfile,
  type StoredPublicProfile,
} from "./public-profile-local";
import { showToast } from "./ui-feedback";

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
  const nameInput = document.querySelector<HTMLInputElement>("[data-profile-public-name]");
  const bioInput = document.querySelector<HTMLTextAreaElement>("[data-profile-public-bio]");
  const saveBtn = document.querySelector<HTMLButtonElement>("[data-profile-save]");
  const hint = document.querySelector<HTMLElement>("[data-profile-feedback]");
  const cloudHint = document.querySelector<HTMLElement>("[data-profile-cloud-hint]");
  const avatarFile = document.querySelector<HTMLInputElement>("[data-profile-avatar-file]");
  const avatarPreview = document.querySelector<HTMLImageElement>("[data-profile-avatar-preview]");
  const avatarFallback = document.querySelector<HTMLElement>("[data-profile-avatar-fallback]");
  const shareCb = document.querySelector<HTMLInputElement>("[data-profile-share-enabled]");
  const slugInput = document.querySelector<HTMLInputElement>("[data-profile-public-slug]");
  const urlPreview = document.querySelector<HTMLElement>("[data-profile-public-url-preview]");
  const copyBtn = document.querySelector<HTMLButtonElement>("[data-profile-copy-public-url]");

  if (!nameInput || !bioInput || !saveBtn) return;
  const portfolioCard = document.querySelector<HTMLElement>('[data-settings-section="portfolio"]');
  if (portfolioCard && portfolioCard.dataset.bound === "1") return;
  if (portfolioCard) portfolioCard.dataset.bound = "1";

  const defaultName = nameInput.dataset.defaultPublicName ?? "";
  const defaultBio = bioInput.dataset.defaultPublicBio ?? "";

  const updatePublicUrlPreview = () => {
    if (!urlPreview) return;
    const norm = normalizePublicSlug(slugInput?.value ?? "");
    const origin = window.location.origin;
    if (norm && isValidPublicSlug(norm)) urlPreview.textContent = `${origin}/portfolio/${norm}`;
    else urlPreview.textContent = `${origin}/portfolio/…`;
  };

  if (slugInput && slugInput.dataset.slugPreviewBound !== "1") {
    slugInput.dataset.slugPreviewBound = "1";
    slugInput.addEventListener("input", updatePublicUrlPreview);
  }
  if (shareCb && shareCb.dataset.slugPreviewBound !== "1") {
    shareCb.dataset.slugPreviewBound = "1";
    shareCb.addEventListener("change", updatePublicUrlPreview);
  }
  if (copyBtn && copyBtn.dataset.bound !== "1") {
    copyBtn.dataset.bound = "1";
    copyBtn.addEventListener("click", async () => {
      const norm = normalizePublicSlug(slugInput?.value ?? "");
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
  }

  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;
  let pendingAvatarFile: File | null = null;
  let avatarUrl: string | null = null;

  if (!userId || !supabase) {
    if (shareCb) shareCb.disabled = true;
    if (slugInput) slugInput.disabled = true;
    if (copyBtn) copyBtn.disabled = true;
  }

  const setAvatarPreview = (url: string | null) => {
    if (!avatarPreview) return;
    if (url) {
      avatarPreview.src = url;
      avatarPreview.classList.remove("hidden");
      avatarFallback?.classList.add("hidden");
    } else {
      avatarPreview.removeAttribute("src");
      avatarPreview.classList.add("hidden");
      avatarFallback?.classList.remove("hidden");
    }
  };

  if (avatarFile && avatarFile.dataset.bound !== "1") {
    avatarFile.dataset.bound = "1";
    avatarFile.addEventListener("change", () => {
      const f = avatarFile.files?.[0] ?? null;
      if (!f) return;
      pendingAvatarFile = f;
      const url = URL.createObjectURL(f);
      setAvatarPreview(url);
    });
  }

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
    nameInput.value = p.publicName;
    bioInput.value = p.bio;
    applyHelpStackToDom(p.helpStack);
  };

  const applyShareToForm = (shareEnabled: boolean, publicSlug: string) => {
    if (shareCb && !shareCb.disabled) shareCb.checked = shareEnabled;
    if (slugInput && !slugInput.disabled) slugInput.value = publicSlug;
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
    } | null = null;
    let error: { message?: string; code?: string } | null = null;

    let resOpt = await supabase
      .from("portfolio_profiles")
      .select("display_name, bio, help_stack, avatar_url, share_enabled, public_slug")
      .eq("user_id", userId)
      .maybeSingle();

    if (resOpt.error && /public_slug|42703|column/i.test(resOpt.error.message ?? "")) {
      resOpt = await supabase
        .from("portfolio_profiles")
        .select("display_name, bio, help_stack, avatar_url, share_enabled")
        .eq("user_id", userId)
        .maybeSingle();
    }

    if (resOpt.error && /help_stack|column/i.test(resOpt.error.message ?? "")) {
      const resBasic = await supabase
        .from("portfolio_profiles")
        .select("display_name, bio, share_enabled")
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
      if (cloudHint) cloudHint.textContent = "";

      const slugStr = data.public_slug != null ? String(data.public_slug).trim() : "";
      applyShareToForm(Boolean(data.share_enabled), slugStr);

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
      setAvatarPreview(avatarUrl);
    } else {
      applyToForm(loadLocal());
      applyShareToForm(false, "");
      if (cloudHint) {
        if (error) {
          cloudHint.textContent = "";
        } else {
          cloudHint.textContent = "";
        }
      }
    }
  } else {
    applyToForm(loadLocal());
    applyShareToForm(false, "");
    if (cloudHint) cloudHint.textContent = "";
  }

  if (saveBtn.dataset.bound !== "1") {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      const publicName = nameInput.value.trim() || defaultName;
      const bio = bioInput.value.trim();
      const helpStack = collectHelpStackKeys();
      const payload: StoredPublicProfile = { publicName, bio, helpStack };
      writeStoredPublicProfile(payload);
      applyToForm(payload);

      const shareOn = shareCb?.checked ?? false;
      const slugNorm = normalizePublicSlug(slugInput?.value ?? "");
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

      if (hint) {
        hint.textContent = "Guardado.";
        hint.className = "m-0 text-xs text-green-600 dark:text-green-400";
        window.setTimeout(() => {
          hint.textContent = "";
        }, 3200);
      }

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
        };

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
              if (cloudHint) cloudHint.textContent = "";
              avatarUrl = nextAvatarUrl;
              pendingAvatarFile = null;
              updatePublicUrlPreview();
              return;
            }
          }
          const noColumn = msg.includes("help_stack") || (msg.includes("column") && !msg.includes("public_slug"));
          if (noColumn) {
            const res2 = await supabase
              .from("portfolio_profiles")
              .upsert(
                { user_id: userId, display_name: publicName, bio },
                { onConflict: "user_id" },
              );
            if (res2.error) {
              showToast(res2.error.message ?? "No se pudo guardar.", "error");
              return;
            }
            showToast("Perfil guardado.", "success");
            updatePublicUrlPreview();
            return;
          }
          showToast(res.error.message ?? "No se pudo guardar.", "error");
          return;
        }
        showToast("Perfil guardado.", "success");
        if (cloudHint) cloudHint.textContent = "";
        avatarUrl = nextAvatarUrl;
        pendingAvatarFile = null;
        updatePublicUrlPreview();
      } else {
        showToast("Perfil guardado.", "success");
      }
    });
  }

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
