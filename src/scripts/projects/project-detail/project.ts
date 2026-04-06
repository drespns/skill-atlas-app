import { confirmModal, projectEditModal, showToast, userFacingDbError, type ProjectEditStatus } from "@scripts/core/ui-feedback";
import { refreshProjectDetailPage } from "@scripts/projects/project-detail/refresh-ui";

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
    const initialStatus = (container.dataset.projectStatus ?? "in_progress") as ProjectEditStatus;
    let initialTags: string[] = [];
    try {
      const raw = container.dataset.projectTagsJson?.trim();
      if (raw) initialTags = JSON.parse(raw) as string[];
    } catch {
      initialTags = [];
    }
    if (!Array.isArray(initialTags)) initialTags = [];
    const initialDateStart = (container.dataset.projectDateStart ?? "").trim() || null;
    const initialDateEnd = (container.dataset.projectDateEnd ?? "").trim() || null;

    const result = await projectEditModal({
      title: "Editar proyecto",
      initialTitle,
      initialDescription,
      initialRole,
      initialOutcome,
      initialStatus,
      initialTags,
      initialDateStart,
      initialDateEnd,
    });
    if (!result) return;
    const tagsEqual =
      JSON.stringify([...initialTags].sort()) === JSON.stringify([...result.tags].sort());
    if (
      result.title === initialTitle &&
      result.description === initialDescription &&
      result.role === initialRole &&
      result.outcome === initialOutcome &&
      result.status === initialStatus &&
      tagsEqual &&
      (result.dateStart ?? "") === (initialDateStart ?? "") &&
      (result.dateEnd ?? "") === (initialDateEnd ?? "")
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
        status: result.status,
        tags: result.tags,
        date_start: result.dateStart || null,
        date_end: result.dateEnd || null,
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
