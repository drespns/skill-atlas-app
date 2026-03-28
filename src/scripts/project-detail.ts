import { getSupabaseBrowserClient } from "./client-supabase";
import { initProjectConceptForm } from "./project-detail/concepts";
import { initProjectEmbedAdd, initProjectEmbedEdit, initProjectEmbedMove, initProjectEmbedRemove } from "./project-detail/embeds";
import { initProjectDelete, initProjectEdit } from "./project-detail/project";
import {
  initProjectTechnologyForm,
  initProjectTechnologyRemove,
} from "./project-detail/technologies";

async function initProjectDetailForms() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const projectContainer = document.querySelector<HTMLElement>("[data-project-id]");
  const projectSlug = projectContainer?.dataset.projectId;
  if (!projectSlug) return;

  const sessionRes = await supabase.auth.getSession();
  if (!sessionRes.data.session) {
    const message = "Inicia sesión en Ajustes para gestionar este proyecto.";
    document.querySelectorAll<HTMLElement>(
      "[data-project-edit-feedback],[data-project-tech-feedback],[data-project-concept-feedback],[data-project-embed-feedback]",
    ).forEach((node) => {
      node.textContent = message;
      node.className = "text-sm text-amber-600 m-0";
    });
    document
      .querySelectorAll<HTMLButtonElement>(
        "[data-project-edit-open],[data-project-delete],[data-project-tech-remove],[data-project-embed-add],[data-project-embed-edit],[data-project-embed-remove],[data-project-embed-move]",
      )
      .forEach((btn) => (btn.disabled = true));
    document
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "[data-project-tech-form] select,[data-project-concept-form] select,[data-project-tech-form] button,[data-project-concept-form] button",
      )
      .forEach((input) => (input.disabled = true));
    return;
  }

  await initProjectEdit(supabase, projectSlug);
  await initProjectTechnologyForm(supabase, projectSlug);
  await initProjectTechnologyRemove(supabase, projectSlug);
  await initProjectConceptForm(supabase, projectSlug);
  await initProjectEmbedAdd(supabase, projectSlug);
  await initProjectEmbedEdit(supabase, projectSlug);
  await initProjectEmbedRemove(supabase);
  await initProjectEmbedMove(supabase, projectSlug);
  await initProjectDelete(supabase, projectSlug);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initProjectDetailForms();
  });
} else {
  void initProjectDetailForms();
}
