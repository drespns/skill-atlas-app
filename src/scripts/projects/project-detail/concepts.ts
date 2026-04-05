import { showToast } from "@scripts/core/ui-feedback";
import { getProjectDbId } from "@scripts/projects/project-detail/helpers";
import { refreshProjectDetailPage } from "@scripts/projects/project-detail/refresh-ui";

export function initProjectConceptsDialog() {
  const dialog = document.querySelector<HTMLDialogElement>("[data-project-concepts-dialog]");
  const openBtn = document.querySelector<HTMLButtonElement>("[data-project-concepts-modal-open]");
  const closeBtn = document.querySelector<HTMLButtonElement>("[data-project-concepts-dialog-close]");
  if (!dialog || !openBtn) return;

  openBtn.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") dialog.showModal();
  });

  closeBtn?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

export async function initProjectConceptForm(supabase: any, projectSlug: string) {
  const form = document.querySelector<HTMLFormElement>("[data-project-concept-form]");
  if (!form) return;

  const feedback = form.querySelector<HTMLElement>("[data-project-concept-feedback]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[type='submit']");
  const conceptSelect = form.querySelector<HTMLSelectElement>("[name='conceptId']");

  if (!feedback || !submitBtn || !conceptSelect) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const conceptId = conceptSelect.value;
    if (!conceptId) return;

    submitBtn.disabled = true;
    feedback.textContent = "Guardando relación...";
    feedback.className = "text-sm text-gray-600";

    const projectDbId = await getProjectDbId(supabase, projectSlug);
    if (!projectDbId) {
      feedback.textContent = "No se encontró el proyecto en Supabase.";
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    const duplicateRes = await supabase
      .from("project_concepts")
      .select("project_id, concept_id")
      .eq("project_id", projectDbId)
      .eq("concept_id", conceptId)
      .maybeSingle();

    if (duplicateRes.error) {
      feedback.textContent = `Error validando duplicados: ${duplicateRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    if (duplicateRes.data) {
      feedback.textContent = "Ese concepto ya está relacionado con el proyecto.";
      feedback.className = "text-sm text-amber-600";
      submitBtn.disabled = false;
      return;
    }

    const insertRes = await supabase
      .from("project_concepts")
      .insert([{ project_id: projectDbId, concept_id: conceptId }] as any);

    if (insertRes.error) {
      feedback.textContent = `Error al guardar: ${insertRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Concepto asociado correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Concepto asociado.", "success");
    await refreshProjectDetailPage();
  });
}
