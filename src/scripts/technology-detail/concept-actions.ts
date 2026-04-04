import { getSupabaseBrowserClient } from "../client-supabase";
import { getSessionUserId } from "../auth-session";
import { conceptEditModal, confirmModal, showToast } from "../ui-feedback";
import { refreshTechnologyDetailPage } from "./refresh-ui";

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
      feedback.className = "text-sm text-amber-600 dark:text-amber-400 m-0";
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
        feedback.className = "text-sm text-gray-600 dark:text-gray-300 m-0";
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
          feedback.className = "text-sm text-red-600 dark:text-red-400 m-0";
        }
        showToast("Error al actualizar concepto.", "error");
        button.disabled = false;
        return;
      }

      showToast("Concepto actualizado correctamente.", "success");
      await refreshTechnologyDetailPage();
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
        feedback.className = "text-sm text-gray-600 dark:text-gray-300 m-0";
      }

      const deleteRes = await supabase.from("concepts").delete().eq("id", conceptId);
      if (deleteRes.error) {
        if (feedback) {
          feedback.textContent = `Error al eliminar: ${deleteRes.error.message}`;
          feedback.className = "text-sm text-red-600 dark:text-red-400 m-0";
        }
        showToast("Error al eliminar concepto.", "error");
        button.disabled = false;
        return;
      }

      showToast("Concepto eliminado.", "success");
      await refreshTechnologyDetailPage();
    });
  }
}
