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

const STATUS_ACTIVE_CLASS =
  "text-xs px-2 py-1 rounded-full shrink-0 bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200";
const STATUS_INACTIVE_CLASS =
  "text-xs px-2 py-1 rounded-full shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";

async function initSettingsAuth() {
  const feedback = document.querySelector<HTMLElement>("[data-auth-feedback]");
  const userEmails = document.querySelectorAll<HTMLElement>("[data-auth-user-email]");
  const statusWraps = document.querySelectorAll<HTMLElement>("[data-auth-status]");
  const statusActives = document.querySelectorAll<HTMLElement>("[data-auth-status-active]");
  const statusInactives = document.querySelectorAll<HTMLElement>("[data-auth-status-inactive]");
  const noSessionEl = document.querySelector<HTMLElement>("[data-auth-no-session]");
  const logoutBtn = document.querySelector<HTMLButtonElement>("[data-auth-logout]");
  const refreshBtn = document.querySelector<HTMLButtonElement>("[data-auth-refresh]");

  if (
    userEmails.length === 0 ||
    statusWraps.length === 0 ||
    statusActives.length === 0 ||
    statusInactives.length === 0 ||
    !logoutBtn ||
    !refreshBtn
  ) {
    return;
  }

  const supabase = getSupabaseBrowserClient();

  const renderAuthState = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user?.email) {
      statusActives.forEach((el) => el.classList.remove("hidden"));
      statusInactives.forEach((el) => el.classList.add("hidden"));
      statusWraps.forEach((el) => {
        el.className = STATUS_ACTIVE_CLASS;
      });
      userEmails.forEach((el) => {
        el.textContent = session.user.email;
      });
      logoutBtn.disabled = false;
      if (noSessionEl) noSessionEl.hidden = true;
    } else {
      statusActives.forEach((el) => el.classList.add("hidden"));
      statusInactives.forEach((el) => el.classList.remove("hidden"));
      statusWraps.forEach((el) => {
        el.className = STATUS_INACTIVE_CLASS;
      });
      userEmails.forEach((el) => {
        el.textContent = "-";
      });
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
