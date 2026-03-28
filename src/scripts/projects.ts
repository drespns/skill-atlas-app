import { getSupabaseBrowserClient } from "./client-supabase";
import { showToast } from "./ui-feedback";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function initProjectForm() {
  const form = document.querySelector<HTMLFormElement>("[data-project-form]");
  if (!form) return;

  const titleInput = form.querySelector<HTMLInputElement>("[name='title']");
  const descInput = form.querySelector<HTMLTextAreaElement>("[name='description']");
  const feedback = form.querySelector<HTMLElement>("[data-project-feedback]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[type='submit']");
  if (!titleInput || !descInput || !feedback || !submitBtn) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    feedback.textContent = "Faltan variables de entorno de Supabase.";
    feedback.className = "text-sm text-red-600";
    return;
  }
  const sessionRes = await supabase.auth.getSession();
  if (!sessionRes.data.session) {
    feedback.textContent = "Inicia sesión en Ajustes para crear proyectos.";
    feedback.className = "text-sm text-amber-600";
    submitBtn.disabled = true;
    titleInput.disabled = true;
    descInput.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    if (!title) return;

    submitBtn.disabled = true;
    feedback.textContent = "Guardando proyecto...";
    feedback.className = "text-sm text-gray-600";

    const slug = toSlug(title);
    const duplicate = await supabase.from("projects").select("id").eq("slug", slug).maybeSingle();
    if (duplicate.error) {
      feedback.textContent = `Error validando duplicado: ${duplicate.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }
    if (duplicate.data) {
      feedback.textContent = "Ya existe un proyecto con ese título/slug.";
      feedback.className = "text-sm text-amber-600";
      submitBtn.disabled = false;
      return;
    }

    const insertRes = await supabase.from("projects").insert([{ slug, title, description }] as any);
    if (insertRes.error) {
      feedback.textContent = `Error al guardar: ${insertRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Proyecto creado correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Proyecto creado correctamente.", "success");
    window.location.reload();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initProjectForm();
  });
} else {
  void initProjectForm();
}

