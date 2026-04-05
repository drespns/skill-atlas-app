import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { disableProjectDetailUi, runProjectDetailInits } from "@scripts/projects/project-detail/runner";

async function initProjectDetailForms() {
  if (document.querySelector("[data-project-csr-mount]")) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const projectContainer = document.querySelector<HTMLElement>("[data-project-id]");
  const projectSlug = projectContainer?.dataset.projectId;
  if (!projectSlug) return;

  const sessionRes = await supabase.auth.getSession();
  if (!sessionRes.data.session) {
    disableProjectDetailUi("Inicia sesión en Ajustes para gestionar este proyecto.");
    return;
  }

  await runProjectDetailInits(supabase, projectSlug);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initProjectDetailForms();
  });
} else {
  void initProjectDetailForms();
}
