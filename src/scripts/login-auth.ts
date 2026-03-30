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

function authErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (/rate limit|too many requests/i.test(raw)) {
    return "Límite de envíos alcanzado (Supabase Auth). Espera unos minutos o usa login con contraseña.";
  }
  if (m.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirma el correo antes de entrar.";
  }
  return raw;
}

async function initLoginAuth() {
  const passwordForm = document.querySelector<HTMLFormElement>("[data-auth-password-form]");
  const emailInput = document.querySelector<HTMLInputElement>("[data-auth-email]");
  const passwordInput = document.querySelector<HTMLInputElement>("[data-auth-password]");
  const signUpBtn = document.querySelector<HTMLButtonElement>("[data-auth-sign-up]");
  const feedback = document.querySelector<HTMLElement>("[data-auth-feedback]");
  if (!passwordForm || !emailInput || !passwordInput || !signUpBtn || !feedback) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    setFeedback(feedback, "Faltan variables de entorno de Supabase.", "error");
    passwordForm.querySelectorAll("input,button").forEach((el) => ((el as HTMLInputElement).disabled = true));
    return;
  }

  const redirectTo = `${window.location.origin}/login`;

  const getNextUrl = () => {
    const url = new URL(window.location.href);
    const nextParam = url.searchParams.get("next");
    const fromSession = (() => {
      try {
        return sessionStorage.getItem("skillatlas_post_login_next");
      } catch {
        return null;
      }
    })();
    const candidate = nextParam ?? fromSession ?? "";
    if (!candidate) return "/app";
    try {
      // Only allow same-origin relative paths.
      if (candidate.startsWith("/")) return candidate;
      return "/app";
    } finally {
      try {
        sessionStorage.removeItem("skillatlas_post_login_next");
      } catch {
        // ignore
      }
    }
  };

  const redirectAfterAuth = () => {
    const next = getNextUrl();
    // Avoid redirect loop
    if (next.startsWith("/login")) return "/app";
    return next;
  };

  const render = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      window.location.href = `${window.location.origin}${redirectAfterAuth()}`;
    }
  };

  await render();
  supabase.auth.onAuthStateChange(() => {
    void render();
  });

  const readCredentials = () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    return { email, password };
  };

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { email, password } = readCredentials();
    if (!email || password.length < 6) return;

    const signInBtn = passwordForm.querySelector<HTMLButtonElement>("[data-auth-sign-in]");
    signInBtn && (signInBtn.disabled = true);
    signUpBtn.disabled = true;
    setFeedback(feedback, "Entrando…", "info");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    signInBtn && (signInBtn.disabled = false);
    signUpBtn.disabled = false;
    if (error) {
      setFeedback(feedback, authErrorMessage(error.message), "error");
      showToast("No se pudo iniciar sesión.", "error");
      return;
    }

    setFeedback(feedback, "Sesión iniciada.", "ok");
    showToast("Sesión iniciada.", "success");
    passwordInput.value = "";
    await render();
  });

  signUpBtn.addEventListener("click", async () => {
    const { email, password } = readCredentials();
    if (!email || password.length < 6) {
      setFeedback(feedback, "Introduce correo y contraseña (mín. 6 caracteres).", "error");
      return;
    }

    signUpBtn.disabled = true;
    const signInBtn = passwordForm.querySelector<HTMLButtonElement>("[data-auth-sign-in]");
    signInBtn && (signInBtn.disabled = true);
    setFeedback(feedback, "Creando cuenta…", "info");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    signUpBtn.disabled = false;
    signInBtn && (signInBtn.disabled = false);

    if (error) {
      setFeedback(feedback, authErrorMessage(error.message), "error");
      showToast("No se pudo crear la cuenta.", "error");
      return;
    }

    if (data.session) {
      setFeedback(feedback, "Cuenta creada e iniciada sesión.", "ok");
      showToast("Cuenta lista.", "success");
      passwordInput.value = "";
      await render();
      return;
    }

    setFeedback(
      feedback,
      "Cuenta creada. Si Supabase pide confirmación, revisa tu correo.",
      "info",
    );
    showToast("Revisa tu correo si hace falta confirmar.", "success");
  });

  const oauthButtons = document.querySelectorAll<HTMLButtonElement>("[data-auth-oauth-provider]");
  for (const btn of oauthButtons) {
    btn.addEventListener("click", async () => {
      const provider = btn.dataset.authOauthProvider;
      if (!provider) return;

      btn.disabled = true;
      setFeedback(feedback, `Abriendo ${provider}…`, "info");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: { redirectTo },
      });

      btn.disabled = false;
      if (error) {
        setFeedback(feedback, authErrorMessage(error.message), "error");
        showToast("OAuth falló.", "error");
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initLoginAuth();
  });
} else {
  void initLoginAuth();
}

