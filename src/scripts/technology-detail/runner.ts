import { getSupabaseBrowserClient } from "../client-supabase";
import { getSessionUserId } from "../auth-session";
import { showToast } from "../ui-feedback";
import { initConceptActions } from "./concept-actions";
import { initConceptImport } from "./concept-import";

export async function initConceptForm() {
  const form = document.querySelector<HTMLFormElement>("[data-concept-form]");
  if (!form) return;

  const feedback = form.querySelector<HTMLElement>("[data-concept-feedback]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[type='submit']");
  const titleInput = form.querySelector<HTMLInputElement>("[name='title']");
  const progressInput = form.querySelector<HTMLSelectElement>("[name='progress']");
  const notesInput = form.querySelector<HTMLTextAreaElement>("[name='notes']");

  if (!feedback || !submitBtn || !titleInput || !progressInput || !notesInput) return;

  const technologySlug = form.dataset.techId;
  if (!technologySlug) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    feedback.textContent = "Faltan variables de entorno de Supabase.";
    feedback.className = "text-sm text-red-600";
    return;
  }
  const userId = await getSessionUserId(supabase);
  if (!userId) {
    feedback.textContent = "Inicia sesión en Ajustes para crear conceptos.";
    feedback.className = "text-sm text-amber-600";
    submitBtn.disabled = true;
    titleInput.disabled = true;
    progressInput.disabled = true;
    notesInput.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const progress = progressInput.value as "aprendido" | "practicado" | "mastered";
    const notes = notesInput.value.trim();
    if (!title) return;

    submitBtn.disabled = true;
    feedback.textContent = "Guardando concepto...";
    feedback.className = "text-sm text-gray-600";

    const techRow = await supabase
      .from("technologies")
      .select("id")
      .eq("slug", technologySlug)
      .maybeSingle();

    if (techRow.error || !techRow.data) {
      feedback.textContent = "No se encontró la tecnología en Supabase.";
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    const existing = await supabase
      .from("concepts")
      .select("id")
      .eq("technology_id", techRow.data.id)
      .ilike("title", title)
      .maybeSingle();

    if (existing.error) {
      feedback.textContent = `Error al validar duplicados: ${existing.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    if (existing.data) {
      feedback.textContent = "Ese concepto ya existe para esta tecnología.";
      feedback.className = "text-sm text-amber-600";
      submitBtn.disabled = false;
      return;
    }

    const insertRes = await supabase.from("concepts").insert({
      technology_id: techRow.data.id,
      title,
      progress,
      notes,
      user_id: userId,
    });

    if (insertRes.error) {
      feedback.textContent = `Error al guardar: ${insertRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Concepto creado correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Concepto creado correctamente.", "success");
    window.location.reload();
  });
}

export async function runTechnologyDetailInits() {
  await initConceptForm();
  await initConceptActions();
  await initConceptImport();
}
