import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { showToast, technologyPickerModal } from "@scripts/core/ui-feedback";
import { getSeedCatalogEntries } from "@scripts/technologies/technology-detail/concept-seeds";
import { getProjectDbId, getTechnologyDbId } from "@scripts/projects/project-detail/helpers";
import { refreshProjectDetailPage } from "@scripts/projects/project-detail/refresh-ui";

export async function initProjectTechnologyForm(supabase: any, projectSlug: string) {
  const form = document.querySelector<HTMLFormElement>("[data-project-tech-form]");
  if (!form) return;

  const feedback = form.querySelector<HTMLElement>("[data-project-tech-feedback]");
  const openButtons = document.querySelectorAll<HTMLButtonElement>("[data-project-tech-picker-open]");
  if (!feedback || openButtons.length === 0) return;

  const open = async () => {
    const sb = getSupabaseBrowserClient() ?? supabase;
    if (!sb) return;
    const userId = await getSessionUserId(sb);
    if (!userId) return;

    const linked = new Set<string>();
    document
      .querySelectorAll<HTMLButtonElement>("[data-project-tech-remove][data-tech-id]")
      .forEach((b) => linked.add((b.dataset.techId ?? "").trim()));

    const techRes = await sb.from("technologies").select("slug, name").eq("user_id", userId).order("name");
    if (techRes.error) {
      feedback.textContent = `Error al cargar tecnologías: ${techRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      return;
    }
    const technologies = ((techRes.data ?? []) as { slug: string; name: string }[]).filter(
      (t) => t.slug && !linked.has(t.slug),
    );

    const seedCatalog = getSeedCatalogEntries();
    const result = await technologyPickerModal({
      title: "Añadir tecnología al proyecto",
      technologies,
      seedCatalog,
    });
    if (!result) return;

    const projectDbId = await getProjectDbId(sb, projectSlug);
    if (!projectDbId) {
      feedback.textContent = "No se pudo resolver el proyecto en Supabase.";
      feedback.className = "text-sm text-red-600";
      return;
    }

    const ensureTechnologyId = async (slug: string) => getTechnologyDbId(sb, slug);

    const associate = async (technologyDbId: string) => {
      const duplicate = await sb
        .from("project_technologies")
        .select("project_id, technology_id")
        .eq("project_id", projectDbId)
        .eq("technology_id", technologyDbId)
        .maybeSingle();
      if (duplicate.data) return "duplicate" as const;
      const insertRes = await sb
        .from("project_technologies")
        .insert([{ project_id: projectDbId, technology_id: technologyDbId }] as any);
      if (insertRes.error) throw insertRes.error;
      return "ok" as const;
    };

    for (const btn of openButtons) btn.disabled = true;
    feedback.textContent = "Procesando...";
    feedback.className = "text-sm text-gray-600";

    try {
      if (result.kind === "pick") {
        const technologyDbId = await ensureTechnologyId(result.slug);
        if (!technologyDbId) throw new Error("No se pudo resolver la tecnología.");
        const st = await associate(technologyDbId);
        if (st === "duplicate") {
          feedback.textContent = "La tecnología ya está asociada.";
          feedback.className = "text-sm text-amber-600";
          return;
        }
        showToast("Tecnología asociada.", "success");
        await refreshProjectDetailPage();
        return;
      }

      // create
      const dup = await sb
        .from("technologies")
        .select("id")
        .eq("slug", result.slug)
        .eq("user_id", userId)
        .maybeSingle();
      if (dup.data) {
        feedback.textContent = "Ya existe una tecnología con ese slug.";
        feedback.className = "text-sm text-amber-600";
        return;
      }
      const ins = await sb.from("technologies").insert({
        name: result.name,
        slug: result.slug,
        icon_key: result.slug,
        user_id: userId,
      });
      if (ins.error) throw ins.error;

      const technologyDbId = await ensureTechnologyId(result.slug);
      if (!technologyDbId) throw new Error("No se pudo resolver la tecnología creada.");
      await associate(technologyDbId);

      showToast("Tecnología creada y asociada.", "success");
      if (result.importMode !== "none") {
        const tier = result.importMode === "junior" ? "&tier=junior" : "";
        window.location.href = `/technologies/view?tech=${encodeURIComponent(result.slug)}&seed=1${tier}`;
        return;
      }
      await refreshProjectDetailPage();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "Error inesperado.";
      feedback.textContent = `Error: ${msg}`;
      feedback.className = "text-sm text-red-600";
    } finally {
      for (const btn of openButtons) btn.disabled = false;
    }
  };

  for (const btn of openButtons) btn.addEventListener("click", open);
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
      await refreshProjectDetailPage();
    });
  }
}
