import { getSupabaseBrowserClient } from "./client-supabase";
import { showToast } from "./ui-feedback";

function setFeedback(node: HTMLElement | null, message: string, kind: "ok" | "error" | "info") {
  if (!node) return;
  node.textContent = message;
  node.className =
    kind === "ok"
      ? "text-sm text-green-600 m-0"
      : kind === "error"
        ? "text-sm text-red-600 m-0"
        : "text-sm text-gray-600 m-0";
}

async function initSettingsAuth() {
  const form = document.querySelector<HTMLFormElement>("[data-auth-login-form]");
  const emailInput = document.querySelector<HTMLInputElement>("[data-auth-email]");
  const feedback = document.querySelector<HTMLElement>("[data-auth-feedback]");
  const userEmail = document.querySelector<HTMLElement>("[data-auth-user-email]");
  const status = document.querySelector<HTMLElement>("[data-auth-status]");
  const logoutBtn = document.querySelector<HTMLButtonElement>("[data-auth-logout]");
  const refreshBtn = document.querySelector<HTMLButtonElement>("[data-auth-refresh]");
  if (!form || !emailInput || !userEmail || !status || !logoutBtn || !refreshBtn) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    setFeedback(feedback, "Faltan variables de entorno de Supabase.", "error");
    form.querySelectorAll("input,button").forEach((el) => ((el as HTMLInputElement).disabled = true));
    logoutBtn.disabled = true;
    refreshBtn.disabled = true;
    return;
  }

  const renderAuthState = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user?.email) {
      status.textContent = "Sesión activa";
      status.className = "text-xs px-2 py-1 rounded-full bg-green-100 text-green-800";
      userEmail.textContent = session.user.email;
      logoutBtn.disabled = false;
    } else {
      status.textContent = "Sin sesión";
      status.className = "text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800";
      userEmail.textContent = "-";
      logoutBtn.disabled = true;
    }
  };

  await renderAuthState();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    setFeedback(feedback, "Enviando magic link...", "info");
    const submit = form.querySelector<HTMLButtonElement>("[type='submit']");
    if (submit) submit.disabled = true;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/settings`,
      },
    });

    if (submit) submit.disabled = false;

    if (error) {
      setFeedback(feedback, `Error de login: ${error.message}`, "error");
      showToast("No se pudo enviar el magic link.", "error");
      return;
    }

    setFeedback(feedback, "Revisa tu correo y abre el enlace para iniciar sesión.", "ok");
    showToast("Magic link enviado.", "success");
  });

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

