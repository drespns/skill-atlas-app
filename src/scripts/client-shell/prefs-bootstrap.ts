import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { applyPrefs, loadPrefs, mergeRemoteUserPrefs, updatePrefs } from "@scripts/core/prefs";
import { syncThemeToggleAria } from "@scripts/client-shell/theme-toggle-sync";

export async function initPrefs() {
  applyPrefs(loadPrefs());
  syncThemeToggleAria();

  const themeBtn = document.querySelector<HTMLElement>("[data-theme-toggle]");

  if (themeBtn && themeBtn.dataset.bound !== "1") {
    themeBtn.dataset.bound = "1";
    themeBtn.addEventListener("click", () => {
      const isDark = !document.documentElement.classList.contains("dark");
      updatePrefs({ themeMode: isDark ? "dark" : "light" });
      syncThemeToggleAria();
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }

  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (mq && (mq as any).__skillatlasBound !== true) {
    (mq as any).__skillatlasBound = true;
    mq?.addEventListener?.("change", () => {
      const prefs = loadPrefs();
      if (prefs.themeMode === "auto") {
        applyPrefs(prefs);
        syncThemeToggleAria();
      }
    });
  }

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (userId) {
        const res = await supabase.from("user_prefs").select("prefs").eq("user_id", userId).maybeSingle();
        const remote = (res?.data?.prefs ?? null) as any;
        if (remote && typeof remote === "object") {
          mergeRemoteUserPrefs(remote);
          syncThemeToggleAria();
        }
      }
    } catch {
      // ignore (offline / missing table / RLS)
    }

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
