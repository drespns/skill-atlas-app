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

  if (!nameInput || !bioInput || !saveBtn) return;

  const defaultName = nameInput.dataset.defaultPublicName ?? "";
  const defaultBio = bioInput.dataset.defaultPublicBio ?? "";

  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;

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
      .select("display_name, bio, help_stack")
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
      if (cloudHint) {
        cloudHint.textContent = "Cargado desde tu cuenta (Supabase).";
        cloudHint.className = "m-0 text-xs text-gray-500 dark:text-gray-400";
      }
    } else {
      applyToForm(loadLocal());
      if (cloudHint) {
        if (error) {
          cloudHint.textContent = "Perfil local; no se pudo leer la nube.";
          cloudHint.className = "m-0 text-xs text-amber-600 dark:text-amber-400";
        } else {
          cloudHint.textContent =
            "Aún no hay perfil en la nube. Pulsa «Guardar perfil» para crear tu fila en Supabase.";
          cloudHint.className = "m-0 text-xs text-gray-500 dark:text-gray-400";
        }
      }
    }
  } else {
    applyToForm(loadLocal());
    if (cloudHint) {
      cloudHint.textContent = "Inicia sesión para sincronizar nombre, bio y stack con Supabase.";
      cloudHint.className = "m-0 text-xs text-gray-500 dark:text-gray-400";
    }
  }

  saveBtn.addEventListener("click", async () => {
    const publicName = nameInput.value.trim() || defaultName;
    const bio = bioInput.value.trim();
    const helpStack = collectHelpStackKeys();
    const payload: StoredPublicProfile = { publicName, bio, helpStack };
    writeStoredPublicProfile(payload);
    applyToForm(payload);

    if (hint) {
      hint.textContent = "Guardado en este navegador.";
      hint.className = "m-0 text-xs text-green-600 dark:text-green-400";
      window.setTimeout(() => {
        hint.textContent = "";
      }, 3200);
    }

    if (supabase && userId) {
      const row: Record<string, unknown> = {
        user_id: userId,
        display_name: publicName,
        bio,
        help_stack: helpStack,
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
            showToast(`Supabase: ${res2.error.message}`, "error");
            return;
          }
          showToast("Perfil guardado (ejecuta docs/sql/saas-005 para sincronizar el stack en la nube).", "info");
          return;
        }
        showToast(`Supabase: ${res.error.message}`, "error");
        return;
      }
      showToast("Perfil guardado en la nube y en este navegador.", "success");
      if (cloudHint) {
        cloudHint.textContent = "Sincronizado con Supabase.";
        cloudHint.className = "m-0 text-xs text-green-600 dark:text-green-400";
      }
    } else {
      showToast("Perfil guardado en este navegador.", "success");
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === PUBLIC_PROFILE_STORAGE_KEY) applyToForm(loadLocal());
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void initSettingsProfile());
} else {
  void initSettingsProfile();
}
