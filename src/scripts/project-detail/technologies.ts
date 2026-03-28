import { showToast } from "../ui-feedback";
import { getProjectDbId, getTechnologyDbId } from "./helpers";

export async function initProjectTechnologyForm(supabase: any, projectSlug: string) {
  const form = document.querySelector<HTMLFormElement>("[data-project-tech-form]");
  if (!form) return;

  const feedback = form.querySelector<HTMLElement>("[data-project-tech-feedback]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[type='submit']");
  const select = form.querySelector<HTMLSelectElement>("[name='technologyId']");
  if (!feedback || !submitBtn || !select) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const technologySlug = select.value;
    if (!technologySlug) return;

    submitBtn.disabled = true;
    feedback.textContent = "Asociando tecnología...";
    feedback.className = "text-sm text-gray-600";

    const projectDbId = await getProjectDbId(supabase, projectSlug);
    const technologyDbId = await getTechnologyDbId(supabase, technologySlug);
    if (!projectDbId || !technologyDbId) {
      feedback.textContent = "No se pudo resolver proyecto/tecnología en Supabase.";
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    const duplicate = await supabase
      .from("project_technologies")
      .select("project_id, technology_id")
      .eq("project_id", projectDbId)
      .eq("technology_id", technologyDbId)
      .maybeSingle();

    if (duplicate.error) {
      feedback.textContent = `Error validando duplicado: ${duplicate.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    if (duplicate.data) {
      feedback.textContent = "La tecnología ya está asociada.";
      feedback.className = "text-sm text-amber-600";
      submitBtn.disabled = false;
      return;
    }

    const insertRes = await supabase
      .from("project_technologies")
      .insert([{ project_id: projectDbId, technology_id: technologyDbId }] as any);

    if (insertRes.error) {
      feedback.textContent = `Error al asociar: ${insertRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Tecnología asociada correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Tecnología asociada.", "success");
    window.location.reload();
  });
}

export async function initProjectTechnologyRemove(supabase: any, projectSlug: string) {
  const removeButtons = document.querySelectorAll<HTMLButtonElement>("[data-project-tech-remove]");
  if (removeButtons.length === 0) return;

  const feedback = document.querySelector<HTMLElement>("[data-project-tech-feedback]");

  for (const button of removeButtons) {
    button.addEventListener("click", async () => {
      const technologySlug = button.dataset.techId;
      if (!technologySlug) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Quitando tecnología...";
        feedback.className = "text-sm text-gray-600";
      }

      const projectDbId = await getProjectDbId(supabase, projectSlug);
      const technologyDbId = await getTechnologyDbId(supabase, technologySlug);
      if (!projectDbId || !technologyDbId) {
        if (feedback) {
          feedback.textContent = "No se pudo resolver proyecto/tecnología.";
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      const deleteRes = await supabase
        .from("project_technologies")
        .delete()
        .eq("project_id", projectDbId)
        .eq("technology_id", technologyDbId);

      if (deleteRes.error) {
        if (feedback) {
          feedback.textContent = `Error al quitar: ${deleteRes.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Tecnología quitada correctamente.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Tecnología quitada.", "success");
      window.location.reload();
    });
  }
}
