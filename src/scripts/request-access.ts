import { getSupabaseBrowserClient } from "./client-supabase";
import { showToast } from "./ui-feedback";

function setFeedback(node: HTMLElement | null, msg: string, kind: "ok" | "error" | "info") {
  if (!node) return;
  node.textContent = msg;
  node.className =
    kind === "ok"
      ? "m-0 text-sm text-green-600 dark:text-green-400"
      : kind === "error"
        ? "m-0 text-sm text-red-600 dark:text-red-400"
        : "m-0 text-sm text-gray-600 dark:text-gray-400";
}

async function run() {
  const form = document.querySelector<HTMLFormElement>("[data-access-request-form]");
  const feedback = document.querySelector<HTMLElement>("[data-access-request-feedback]");
  const submit = document.querySelector<HTMLButtonElement>("[data-access-request-submit]");
  if (!form || !submit) return;
  if (form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    setFeedback(feedback, "No se pudo inicializar el formulario.", "error");
    submit.disabled = true;
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const full_name = String(fd.get("full_name") ?? "").trim();
    const message = String(fd.get("message") ?? "").trim();
    const linkedin_url = String(fd.get("linkedin_url") ?? "").trim();
    const github_url = String(fd.get("github_url") ?? "").trim();

    if (!email) return;

    submit.disabled = true;
    setFeedback(feedback, "Enviando…", "info");

    const { error } = await supabase.from("access_requests").insert([
      {
        email,
        full_name: full_name || null,
        message: message || null,
        linkedin_url: linkedin_url || null,
        github_url: github_url || null,
        source: "landing",
        user_agent: navigator.userAgent,
      },
    ]);

    submit.disabled = false;
    if (error) {
      setFeedback(feedback, "No se pudo enviar. Inténtalo más tarde.", "error");
      showToast("No se pudo enviar la solicitud.", "error");
      return;
    }

    form.reset();
    setFeedback(feedback, "Solicitud enviada. ¡Gracias!", "ok");
    showToast("Solicitud enviada.", "success");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void run());
else void run();

document.addEventListener("astro:page-load", () => void run());
document.addEventListener("astro:after-swap", () => void run());

