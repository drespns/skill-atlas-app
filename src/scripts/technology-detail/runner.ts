import { getSupabaseBrowserClient } from "../client-supabase";
import { getSessionUserId } from "../auth-session";
import { conceptEditModal, confirmModal, showToast } from "../ui-feedback";

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

export async function initConceptActions() {
  const editButtons = document.querySelectorAll<HTMLButtonElement>("[data-concept-edit]");
  const deleteButtons = document.querySelectorAll<HTMLButtonElement>("[data-concept-delete]");
  const feedback = document.querySelector<HTMLElement>("[data-concept-feedback]");
  if (editButtons.length === 0 && deleteButtons.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const userId = await getSessionUserId(supabase);
  if (!userId) {
    if (feedback) {
      feedback.textContent = "Inicia sesión en Ajustes para editar o eliminar conceptos.";
      feedback.className = "text-sm text-amber-600 m-0";
    }
    editButtons.forEach((btn) => (btn.disabled = true));
    deleteButtons.forEach((btn) => (btn.disabled = true));
    return;
  }

  for (const button of editButtons) {
    button.addEventListener("click", async () => {
      const conceptId = button.dataset.conceptId;
      const currentTitle = button.dataset.conceptTitle ?? "";
      const currentNotes = button.dataset.conceptNotes ?? "";
      const currentProgress = button.dataset.conceptProgress ?? "aprendido";
      if (!conceptId) return;

      const next = await conceptEditModal({
        title: `Editar concepto`,
        initialTitle: currentTitle,
        initialNotes: currentNotes,
        initialProgress: currentProgress as "aprendido" | "practicado" | "mastered",
      });
      if (!next) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Actualizando concepto...";
        feedback.className = "text-sm text-gray-600 m-0";
      }

      const updateRes = await supabase
        .from("concepts")
        .update({
          title: next.title,
          notes: next.notes,
          progress: next.progress,
        })
        .eq("id", conceptId);

      if (updateRes.error) {
        if (feedback) {
          feedback.textContent = `Error al actualizar: ${updateRes.error.message}`;
          feedback.className = "text-sm text-red-600 m-0";
        }
        showToast("Error al actualizar concepto.", "error");
        button.disabled = false;
        return;
      }

      showToast("Concepto actualizado correctamente.", "success");
      window.location.reload();
    });
  }

  for (const button of deleteButtons) {
    button.addEventListener("click", async () => {
      const conceptId = button.dataset.conceptId;
      const conceptTitle = button.dataset.conceptTitle ?? conceptId ?? "";
      if (!conceptId) return;

      const accepted = await confirmModal({
        title: `Eliminar concepto "${conceptTitle}"`,
        description: "Esta acción no se puede deshacer.",
        confirmLabel: "Eliminar",
        danger: true,
      });
      if (!accepted) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Eliminando concepto...";
        feedback.className = "text-sm text-gray-600 m-0";
      }

      const deleteRes = await supabase.from("concepts").delete().eq("id", conceptId);
      if (deleteRes.error) {
        if (feedback) {
          feedback.textContent = `Error al eliminar: ${deleteRes.error.message}`;
          feedback.className = "text-sm text-red-600 m-0";
        }
        showToast("Error al eliminar concepto.", "error");
        button.disabled = false;
        return;
      }

      showToast("Concepto eliminado.", "success");
      window.location.reload();
    });
  }
}

export async function runTechnologyDetailInits() {
  await initConceptForm();
  await initConceptActions();
}
