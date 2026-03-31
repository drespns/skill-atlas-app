import { HELP_STACK_ITEMS } from "../config/help-stack";
import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import {
  PUBLIC_PROFILE_STORAGE_KEY,
  readStoredPublicProfile,
  writeStoredPublicProfile,
  type StoredPublicProfile,
} from "./public-profile-local";
import { showToast } from "./ui-feedback";

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

  if (!nameInput || !bioInput || !saveBtn) return;
  const portfolioCard = document.querySelector<HTMLElement>('[data-settings-section="portfolio"]');
  if (portfolioCard && portfolioCard.dataset.bound === "1") return;
  if (portfolioCard) portfolioCard.dataset.bound = "1";

  const defaultName = nameInput.dataset.defaultPublicName ?? "";
  const defaultBio = bioInput.dataset.defaultPublicBio ?? "";

  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;
  let pendingAvatarFile: File | null = null;
  let avatarUrl: string | null = null;

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

  if (supabase && userId) {
    let data: {
      display_name?: string | null;
      bio?: string | null;
      help_stack?: unknown;
    } | null = null;
    let error: { message?: string } | null = null;

    const resFull = await supabase
      .from("portfolio_profiles")
      .select("display_name, bio, help_stack, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (resFull.error && /help_stack|column/i.test(resFull.error.message ?? "")) {
      const resBasic = await supabase
        .from("portfolio_profiles")
        .select("display_name, bio")
        .eq("user_id", userId)
        .maybeSingle();
      data = resBasic.data;
      error = resBasic.error;
    } else {
      data = resFull.data;
      error = resFull.error;
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
            : loadLocal().helpStack
      };
      applyToForm(merged);
      writeStoredPublicProfile(merged);
      if (cloudHint) cloudHint.textContent = "";

      const a = (data as any).avatar_url;
      avatarUrl = typeof a === "string" && a ? a : null;
      if (!avatarUrl) {
        const { data: sessionData } = await supabase.auth.getSession();
        const meta = (sessionData.session?.user?.user_metadata ?? {}) as Record<string, any>;
        avatarUrl =
          (typeof meta.avatar_url === "string" && meta.avatar_url) ||
          (typeof meta.picture === "string" && meta.picture) ||
          null;
      }
      setAvatarPreview(avatarUrl);
    } else {
      applyToForm(loadLocal());
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
      };
      const res = await supabase.from("portfolio_profiles").upsert(row, { onConflict: "user_id" });
      if (res.error) {
        const msg = res.error.message ?? "";
        const noColumn = msg.includes("help_stack") || msg.includes("column");
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
          return;
        }
        showToast(res.error.message ?? "No se pudo guardar.", "error");
        return;
      }
      showToast("Perfil guardado.", "success");
      if (cloudHint) cloudHint.textContent = "";
      avatarUrl = nextAvatarUrl;
      pendingAvatarFile = null;
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
