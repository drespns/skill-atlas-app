import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { githubRepoTechImportModal, projectTechRemoveModal, showToast, technologyPickerModal } from "@scripts/core/ui-feedback";
import { getSeedCatalogEntries } from "@scripts/technologies/technology-detail/concept-seeds";
import { getProjectDbId, getTechnologyDbId } from "@scripts/projects/project-detail/helpers";
import { refreshProjectDetailPage } from "@scripts/projects/project-detail/refresh-ui";
import { supportsTechnologiesKindColumn } from "@scripts/core/supabase-schema";
import { getCatalogEntryForSlug } from "@scripts/technologies/technology-detail/concept-seeds";
import { fetchGitHubRepoLanguages, mapGitHubLanguagesToTechSlugs, parseGitHubRepoUrl } from "@scripts/core/github-repo-analyzer";

export async function initProjectTechnologyForm(supabase: any, projectSlug: string) {
  const form = document.querySelector<HTMLFormElement>("[data-project-tech-form]");
  if (!form) return;

  const feedback = form.querySelector<HTMLElement>("[data-project-tech-feedback]");
  const openButtons = document.querySelectorAll<HTMLButtonElement>("[data-project-tech-picker-open]");
  const githubBtn = document.querySelector<HTMLButtonElement>("[data-project-tech-github-import]");
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

      if (result.kind === "pickMany") {
        let ok = 0;
        for (const slug of result.slugs) {
          const technologyDbId = await ensureTechnologyId(slug);
          if (!technologyDbId) continue;
          const st = await associate(technologyDbId);
          if (st === "ok") ok += 1;
        }
        if (ok > 0) showToast(`Tecnologías asociadas: ${ok}.`, "success");
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

  githubBtn?.addEventListener("click", async () => {
    const sb = getSupabaseBrowserClient() ?? supabase;
    if (!sb) return;
    const userId = await getSessionUserId(sb);
    if (!userId) return;

    // Prefill: intenta usar la evidencia rápida si apunta a github.com.
    const prefill = (document.querySelector<HTMLInputElement>("[data-project-evidence-quick-url]")?.value ?? "").trim();
    const result = await githubRepoTechImportModal({ title: "Importar stack desde GitHub", initialRepoUrl: prefill });
    if (!result) return;

    const projectDbId = await getProjectDbId(sb, projectSlug);
    if (!projectDbId) {
      feedback.textContent = "No se pudo resolver el proyecto en Supabase.";
      feedback.className = "text-sm text-red-600";
      return;
    }

    const ensureTechnologyId = async (slug: string, name: string) => {
      const existing = await getTechnologyDbId(sb, slug);
      if (existing) return existing;
      const kind = getCatalogEntryForSlug(slug)?.kind ?? null;
      const supportsKind = kind ? await supportsTechnologiesKindColumn(sb) : false;
      const payload: any = { name, slug, icon_key: slug, user_id: userId };
      if (supportsKind && kind) payload.kind = kind;
      const ins = await sb.from("technologies").insert(payload);
      if (ins.error) {
        // Si otro flujo lo creó a la vez, reintenta obtener el id y continúa.
        if (String(ins.error.code ?? "") === "23505") return await getTechnologyDbId(sb, slug);
        throw ins.error;
      }
      return await getTechnologyDbId(sb, slug);
    };

    const associate = async (technologyDbId: string) => {
      const duplicate = await sb
        .from("project_technologies")
        .select("project_id, technology_id")
        .eq("project_id", projectDbId)
        .eq("technology_id", technologyDbId)
        .maybeSingle();
      if (duplicate.data) return "duplicate" as const;
      const insertRes = await sb.from("project_technologies").insert([{ project_id: projectDbId, technology_id: technologyDbId }] as any);
      if (insertRes.error) throw insertRes.error;
      return "ok" as const;
    };

    githubBtn.disabled = true;
    for (const btn of openButtons) btn.disabled = true;
    feedback.textContent = "Importando tecnologías...";
    feedback.className = "text-sm text-gray-600";

    try {
      let ok = 0;
      for (const t of result.technologies) {
        const tid = await ensureTechnologyId(t.slug, t.name);
        if (!tid) continue;
        const st = await associate(tid);
        if (st === "ok") ok += 1;
      }

      // Prepara evidencia GitHub (tiene sentido al importar stack desde el repo).
      const repoUrl = result.repoUrl.trim();
      const urlInput = document.querySelector<HTMLInputElement>("[data-project-evidence-quick-url]");
      if (urlInput && repoUrl) {
        urlInput.value = repoUrl;
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (repoUrl) {
        const existing = await sb
          .from("project_embeds")
          .select("id")
          .eq("project_id", projectDbId)
          .eq("url", repoUrl)
          .maybeSingle();
        if (!existing.data) {
          const countRes = await sb
            .from("project_embeds")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectDbId);
          const sortOrder = countRes.count ?? 0;
          await sb.from("project_embeds").insert([
            {
              project_id: projectDbId,
              kind: "link",
              title: "Repositorio GitHub",
              url: repoUrl,
              sort_order: sortOrder,
              show_in_public: true,
              thumbnail_url: null,
            },
          ] as any);
        }
      }

      // Guardar ponderación real (GitHub languages) para /app (localStorage, por proyecto).
      if (repoUrl) {
        const parsed = parseGitHubRepoUrl(repoUrl);
        if (parsed) {
          try {
            const langs = await fetchGitHubRepoLanguages(parsed);
            const techWeights = mapGitHubLanguagesToTechSlugs(langs.pctByLanguage);
            localStorage.setItem(
              `skillatlas_github_weights_v1:${projectSlug}`,
              JSON.stringify({ repoUrl, ts: Date.now(), techWeights, pctByLanguage: langs.pctByLanguage }),
            );
          } catch {
            // ignore (rate limit / private repo)
          }
        }
      }

      showToast(
        ok > 0 ? `Tecnologías importadas y asociadas: ${ok}.` : "Importación GitHub completada (sin nuevas tecnologías).",
        ok > 0 ? "success" : "info",
      );
      await refreshProjectDetailPage();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "Error inesperado.";
      feedback.textContent = `Error: ${msg}`;
      feedback.className = "text-sm text-red-600";
    } finally {
      githubBtn.disabled = false;
      for (const btn of openButtons) btn.disabled = false;
    }
  });
}

export async function initProjectTechnologyRemove(supabase: any, projectSlug: string) {
  const removeButtons = document.querySelectorAll<HTMLButtonElement>("[data-project-tech-remove]");
  if (removeButtons.length === 0) return;

  const feedback = document.querySelector<HTMLElement>("[data-project-tech-feedback]");

  for (const button of removeButtons) {
    button.addEventListener("click", async () => {
      const technologySlug = button.dataset.techId;
      const technologyName = (button.dataset.techName ?? technologySlug ?? "").trim() || technologySlug;
      if (!technologySlug) return;

      const choice = await projectTechRemoveModal({ technologyName: technologyName ?? technologySlug });
      if (!choice) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent =
          choice === "unlink" ? "Quitando tecnología del proyecto..." : "Eliminando tecnología del catálogo...";
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

      if (choice === "unlink") {
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
          feedback.textContent = "Tecnología quitada del proyecto.";
          feedback.className = "text-sm text-green-600";
        }
        showToast("Tecnología quitada del proyecto.", "success");
        await refreshProjectDetailPage();
        button.disabled = false;
        return;
      }

      const delTech = await supabase.from("technologies").delete().eq("slug", technologySlug);
      if (delTech.error) {
        if (feedback) {
          feedback.textContent = `Error al eliminar del catálogo: ${delTech.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        showToast(delTech.error.message ?? "No se pudo eliminar la tecnología.", "error");
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Tecnología eliminada del catálogo.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Tecnología eliminada del catálogo.", "success");
      if (window.skillatlas?.clearTechnologiesCache) window.skillatlas.clearTechnologiesCache();
      await refreshProjectDetailPage();
      button.disabled = false;
    });
  }
}
