import { initProjectConceptForm, initProjectConceptsDialog } from "./concepts";
import {
  initProjectEvidenceQuickAdd,
  initProjectEvidenceTemplates,
  initProjectEmbedAdd,
  initProjectEmbedEdit,
  initProjectEmbedMove,
  initProjectEmbedRemove,
  initProjectEvidenceLayoutToggle,
} from "./embeds";
import { initProjectDelete, initProjectEdit } from "./project";
import { initProjectTechnologyForm, initProjectTechnologyRemove } from "./technologies";

export async function runProjectDetailInits(supabase: any, projectSlug: string) {
  await initProjectEdit(supabase, projectSlug);
  await initProjectTechnologyForm(supabase, projectSlug);
  await initProjectTechnologyRemove(supabase, projectSlug);
  initProjectConceptsDialog();
  await initProjectConceptForm(supabase, projectSlug);
  initProjectEvidenceTemplates();
  initProjectEvidenceLayoutToggle();
  await initProjectEvidenceQuickAdd(supabase, projectSlug);
  await initProjectEmbedAdd(supabase, projectSlug);
  await initProjectEmbedEdit(supabase, projectSlug);
  await initProjectEmbedRemove(supabase);
  await initProjectEmbedMove(supabase, projectSlug);
  await initProjectDelete(supabase, projectSlug);
}

export function disableProjectDetailUi(message: string) {
  document.querySelectorAll<HTMLElement>(
    "[data-project-edit-feedback],[data-project-tech-feedback],[data-project-concept-feedback],[data-project-embed-feedback]",
  ).forEach((node) => {
    node.textContent = message;
    node.className = "text-sm text-amber-600 m-0";
  });
  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-project-edit-open],[data-project-delete],[data-project-tech-picker-open],[data-project-tech-remove],[data-project-concepts-modal-open],[data-project-concepts-dialog-close],[data-project-embed-add],[data-project-evidence-quick-open],[data-project-evidence-template],[data-project-embed-edit],[data-project-embed-remove],[data-project-embed-move],[data-evidence-layout]",
    )
    .forEach((btn) => (btn.disabled = true));
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "[data-project-tech-form] select,[data-project-concept-form] select,[data-project-tech-form] button,[data-project-concept-form] button,[data-project-evidence-quick-url]",
    )
    .forEach((input) => (input.disabled = true));
}
