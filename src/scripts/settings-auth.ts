import { getSupabaseBrowserClient } from "./client-supabase";
import { showToast } from "./ui-feedback";

function setFeedback(node: HTMLElement | null, message: string, kind: "ok" | "error" | "info") {
  if (!node) return;
  node.textContent = message;
  node.className =
    kind === "ok"
      ? "text-sm text-green-600 dark:text-green-400 m-0"
      : kind === "error"
        ? "text-sm text-red-600 dark:text-red-400 m-0"
        : "text-sm text-gray-600 dark:text-gray-400 m-0";
}

async function initSettingsAuth() {
  const feedback = document.querySelector<HTMLElement>("[data-auth-feedback]");
  const userEmail = document.querySelector<HTMLElement>("[data-auth-user-email]");
  const statusWrap = document.querySelector<HTMLElement>("[data-auth-status]");
  const statusActive = document.querySelector<HTMLElement>("[data-auth-status-active]");
  const statusInactive = document.querySelector<HTMLElement>("[data-auth-status-inactive]");
  const noSessionEl = document.querySelector<HTMLElement>("[data-auth-no-session]");
  const logoutBtn = document.querySelector<HTMLButtonElement>("[data-auth-logout]");
  const refreshBtn = document.querySelector<HTMLButtonElement>("[data-auth-refresh]");

  if (!feedback || !userEmail || !statusWrap || !statusActive || !statusInactive || !logoutBtn || !refreshBtn) {
    return;
  }

  const supabase = getSupabaseBrowserClient();

  const renderAuthState = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user?.email) {
      if (statusActive) statusActive.classList.remove("hidden");
      if (statusInactive) statusInactive.classList.add("hidden");
      statusWrap.className =
        "text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200";
      userEmail.textContent = session.user.email;
      logoutBtn.disabled = false;
      if (noSessionEl) noSessionEl.hidden = true;
    } else {
      if (statusActive) statusActive.classList.add("hidden");
      if (statusInactive) statusInactive.classList.remove("hidden");
      statusWrap.className =
        "text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
      userEmail.textContent = "-";
      logoutBtn.disabled = true;
      if (noSessionEl) noSessionEl.hidden = false;
    }
  };

  if (!supabase) {
    logoutBtn.disabled = true;
    refreshBtn.disabled = true;
    setFeedback(feedback, "Faltan variables de entorno de Supabase.", "error");
    return;
  }

  await renderAuthState();

  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setFeedback(feedback, `Error al cerrar sesión: ${error.message}`, "error");
      showToast("No se pudo cerrar sesión.", "error");
      logoutBtn.disabled = false;
      return;
    }
    setFeedback(feedback, "Sesión cerrada.", "ok");
    showToast("Sesión cerrada.", "success");
    await renderAuthState();
  });

  refreshBtn.addEventListener("click", async () => {
    await renderAuthState();
    setFeedback(feedback, "Estado de sesión actualizado.", "info");
  });

  supabase.auth.onAuthStateChange(() => {
    void renderAuthState();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initSettingsAuth();
  });
} else {
  void initSettingsAuth();
}
