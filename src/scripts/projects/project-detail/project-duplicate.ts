import i18next from "i18next";
import { getSessionUserId } from "@scripts/core/auth-session";
import { confirmModal, showToast, userFacingDbError } from "@scripts/core/ui-feedback";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

async function pickUniqueProjectSlug(supabase: any, userId: string, baseSlug: string): Promise<{ slug: string } | { error: string }> {
  const root = baseSlug.trim() || "proyecto-copia";
  let candidate = root;
  for (let n = 0; n < 80; n += 1) {
    const res = await supabase.from("projects").select("id").eq("slug", candidate).eq("user_id", userId).maybeSingle();
    if (res.error) return { error: userFacingDbError(res.error.message, tt("projects.duplicateSlugError", "Could not reserve a unique slug.")) };
    if (!res.data) return { slug: candidate };
    candidate = `${root}-${n + 2}`;
  }
  return { error: tt("projects.duplicateSlugError", "Could not reserve a unique slug.") };
}

export async function initProjectDuplicate(supabase: any, _projectSlug: string) {
  const button = document.querySelector<HTMLButtonElement>("[data-project-duplicate]");
  const section = document.querySelector<HTMLElement>("[data-project-db-id]");
  if (!button || !section) return;

  button.addEventListener("click", async () => {
    const oldId = section.dataset.projectDbId?.trim();
    if (!oldId) return;

    const accepted = await confirmModal({
      title: tt("projects.duplicateConfirmTitle", "Duplicar proyecto"),
      description: tt(
        "projects.duplicateConfirmBody",
        "Se creará una copia con el mismo stack, conceptos y evidencias. La portada no se copia.",
      ),
      confirmLabel: tt("projects.duplicateConfirm", "Duplicar"),
      cancelLabel: tt("common.cancel", "Cancelar"),
    });
    if (!accepted) return;

    const userId = await getSessionUserId(supabase);
    if (!userId) {
      showToast(tt("projects.duplicateNeedSession", "Inicia sesión para duplicar."), "warning");
      return;
    }

    button.disabled = true;
    try {
      const titleBase = (section.dataset.projectTitle ?? "").trim() || _projectSlug;
      const suffix = tt("projects.duplicateTitleSuffix", "copia");
      const newTitle = `${titleBase} (${suffix})`;
      const baseSlug = toSlug(`${titleBase}-${suffix}`) || "proyecto-copia";
      const slugPick = await pickUniqueProjectSlug(supabase, userId, baseSlug);
      if ("error" in slugPick) {
        showToast(slugPick.error, "error");
        return;
      }
      const newSlug = slugPick.slug;

      const description = section.dataset.projectDescription ?? "";
      const role = section.dataset.projectRole ?? "";
      const outcome = section.dataset.projectOutcome ?? "";
      const statusRaw = String(section.dataset.projectStatus ?? "in_progress").trim();
      const status =
        statusRaw === "draft" ||
        statusRaw === "in_progress" ||
        statusRaw === "portfolio_visible" ||
        statusRaw === "archived"
          ? statusRaw
          : "in_progress";
      let tags: string[] = [];
      try {
        const raw = section.dataset.projectTagsJson?.trim();
        if (raw) tags = JSON.parse(raw) as string[];
      } catch {
        tags = [];
      }
      if (!Array.isArray(tags)) tags = [];
      const dateStart = section.dataset.projectDateStart?.trim() || null;
      const dateEnd = section.dataset.projectDateEnd?.trim() || null;

      const ins = await supabase
        .from("projects")
        .insert([
          {
            slug: newSlug,
            title: newTitle,
            description: description || null,
            role: role || null,
            outcome: outcome || null,
            user_id: userId,
            status,
            tags,
            date_start: dateStart,
            date_end: dateEnd,
          },
        ] as any)
        .select("id")
        .single();

      if (ins.error || !ins.data?.id) {
        showToast(userFacingDbError(ins.error?.message, tt("projects.duplicateError", "No se pudo duplicar el proyecto.")), "error");
        return;
      }
      const newProjectId = ins.data.id as string;

      const [pt, pc, emb] = await Promise.all([
        supabase.from("project_technologies").select("technology_id").eq("project_id", oldId),
        supabase.from("project_concepts").select("concept_id").eq("project_id", oldId),
        supabase
          .from("project_embeds")
          .select("kind,title,url,sort_order,show_in_public,thumbnail_url")
          .eq("project_id", oldId)
          .order("sort_order", { ascending: true }),
      ]);

      if (pt.error || pc.error || emb.error) {
        showToast(tt("projects.duplicateRelationsError", "Proyecto creado, pero no se copiaron todas las relaciones."), "warning");
      }

      if (pt.data?.length) {
        await supabase.from("project_technologies").insert(
          (pt.data as { technology_id: string }[]).map((r) => ({
            project_id: newProjectId,
            technology_id: r.technology_id,
          })) as any,
        );
      }
      if (pc.data?.length) {
        await supabase.from("project_concepts").insert(
          (pc.data as { concept_id: string }[]).map((r) => ({
            project_id: newProjectId,
            concept_id: r.concept_id,
          })) as any,
        );
      }
      if (emb.data?.length) {
        await supabase.from("project_embeds").insert(
          (emb.data as any[]).map((r) => ({
            project_id: newProjectId,
            kind: r.kind === "iframe" ? "iframe" : "link",
            title: r.title ?? "",
            url: r.url ?? "",
            sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
            show_in_public: r.show_in_public !== false,
            thumbnail_url: r.thumbnail_url ?? null,
          })) as any,
        );
      }

      showToast(tt("projects.duplicateToast", "Proyecto duplicado."), "success");
      window.skillatlas?.clearProjectsCache?.();
      window.location.assign(`/projects/view?project=${encodeURIComponent(newSlug)}`);
    } finally {
      button.disabled = false;
    }
  });
}
