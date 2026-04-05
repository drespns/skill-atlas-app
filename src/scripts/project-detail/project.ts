import { confirmModal, projectEditModal, showToast, userFacingDbError } from "../ui-feedback";
import { refreshProjectDetailPage } from "./refresh-ui";

export async function initProjectEdit(supabase: any, projectSlug: string) {
  const button = document.querySelector<HTMLButtonElement>("[data-project-edit-open]");
  const feedback = document.querySelector<HTMLElement>("[data-project-edit-feedback]");
  const container = document.querySelector<HTMLElement>("[data-project-id]");
  if (!button || !container) return;

  button.addEventListener("click", async () => {
    const initialTitle = container.dataset.projectTitle ?? "";
    const initialDescription = container.dataset.projectDescription ?? "";
    const initialRole = container.dataset.projectRole ?? "";
    const initialOutcome = container.dataset.projectOutcome ?? "";

    const result = await projectEditModal({
      title: "Editar proyecto",
      initialTitle,
      initialDescription,
      initialRole,
      initialOutcome,
    });
    if (!result) return;
    if (
      result.title === initialTitle &&
      result.description === initialDescription &&
      result.role === initialRole &&
      result.outcome === initialOutcome
    ) {
      return;
    }

    button.disabled = true;
    if (feedback) {
      feedback.textContent = "Guardando proyecto...";
      feedback.className = "text-sm text-gray-600";
    }

    const updateRes = await supabase
      .from("projects")
      .update({
        title: result.title,
        description: result.description,
        role: result.role || null,
        outcome: result.outcome || null,
      })
      .eq("slug", projectSlug);

    if (updateRes.error) {
      const hint = userFacingDbError(updateRes.error.message, "No se pudo guardar el proyecto.");
      if (feedback) {
        feedback.textContent = hint;
        feedback.className = "text-sm text-red-600";
      }
      showToast(hint, "error");
      button.disabled = false;
      return;
    }

    if (feedback) {
      feedback.textContent = "Proyecto actualizado correctamente.";
      feedback.className = "text-sm text-green-600";
    }
    showToast("Proyecto actualizado.", "success");
    await refreshProjectDetailPage();
  });
}

export async function initProjectDelete(supabase: any, projectSlug: string) {
  const button = document.querySelector<HTMLButtonElement>("[data-project-delete]");
  if (!button) return;

  button.addEventListener("click", async () => {
    const accepted = await confirmModal({
      title: "Eliminar proyecto",
      description: "También se eliminarán sus relaciones y embeds.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!accepted) return;

    button.disabled = true;
    const deleteRes = await supabase.from("projects").delete().eq("slug", projectSlug);
    if (deleteRes.error) {
      showToast(userFacingDbError(deleteRes.error.message, "Error al eliminar proyecto."), "error");
      button.disabled = false;
      return;
    }

    showToast("Proyecto eliminado.", "success");
    window.location.href = "/projects";
  });
}
