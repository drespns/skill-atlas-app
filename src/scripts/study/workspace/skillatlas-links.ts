import { showToast, technologyPickerModal, githubRepoTechImportModal } from "@scripts/core/ui-feedback";
import { getSeedCatalogEntries, getCatalogEntryForSlug } from "@scripts/technologies/technology-detail/concept-seeds";
import { getTechnologyDbId } from "@scripts/projects/project-detail/helpers";
import { supportsTechnologiesKindColumn } from "@scripts/core/supabase-schema";
import { fetchTechRegistryLookup } from "@scripts/technologies/tech-registry-client";
import { renderLinkedConceptsPanel } from "./linked-concepts";
import { replaceStudySpaceTechnologies, upsertWorkspace } from "./study-db";
import type { State, SupabaseLike } from "./types";

export async function wireStudySkillAtlasLinks(
  sb: SupabaseLike,
  userId: string,
  getStudySpaceId: () => string | null,
  getState: () => State,
  applyState: (next: State) => void,
  ttFn: (key: string, fallback: string) => string,
) {
  const projSel = document.querySelector<HTMLSelectElement>("[data-study-link-project]");
  const techMulti = document.querySelector<HTMLSelectElement>("[data-study-link-tech]");
  const pickerBtn = document.querySelector<HTMLButtonElement>("[data-study-tech-picker-open]");
  const registryBtn = document.querySelector<HTMLButtonElement>("[data-study-registry-add]");
  const registryIn = document.querySelector<HTMLInputElement>("[data-study-registry-query]");
  const githubBtn = document.querySelector<HTMLButtonElement>("[data-study-tech-github-import]");
  if (!projSel || !techMulti) return;

  const escAttr = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");

  const persistLinks = async () => {
    const spaceId = getStudySpaceId();
    if (!spaceId) return;
    const cur = getState();
    try {
      await upsertWorkspace(sb, spaceId, cur);
      await replaceStudySpaceTechnologies(sb, spaceId, cur.linkedTechnologyIds);
    } catch {
      showToast(ttFn("study.linkSaveError", "No se pudieron guardar los vínculos con SkillAtlas."), "warning");
    }
  };

  const refreshSelects = async () => {
    const [{ data: projects }, { data: technologies }] = await Promise.all([
      sb.from("projects").select("id, title, slug").order("title"),
      sb.from("technologies").select("id, slug, name").eq("user_id", userId).order("name"),
    ]);

    projSel.innerHTML =
      `<option value="">${escAttr(ttFn("study.linkNone", "— Sin proyecto —"))}</option>` +
      (projects ?? [])
        .map((p: any) => `<option value="${escAttr(String(p.id))}">${escAttr(String(p.title ?? p.slug ?? ""))}</option>`)
        .join("");

    techMulti.innerHTML = (technologies ?? [])
      .map((t: any) => `<option value="${escAttr(String(t.id))}">${escAttr(String(t.name ?? ""))}</option>`)
      .join("");

    const techEmptyEl = document.querySelector<HTMLElement>("[data-study-link-tech-empty]");
    if (techEmptyEl) techEmptyEl.classList.toggle("hidden", (technologies ?? []).length > 0);

    const st = getState();
    if (st.linkedProjectId) projSel.value = st.linkedProjectId;
    for (const id of st.linkedTechnologyIds) {
      const opt = Array.from(techMulti.options).find((o) => o.value === id);
      if (opt) opt.selected = true;
    }

    projSel.onchange = () => {
      const s = getState();
      applyState({ ...s, linkedProjectId: projSel.value.trim() || null });
      void persistLinks();
    };
    techMulti.onchange = () => {
      const s = getState();
      const ids = [...techMulti.selectedOptions].map((o) => o.value).filter(Boolean);
      applyState({ ...s, linkedTechnologyIds: ids });
      void persistLinks();
    };

    try {
      window.dispatchEvent(new Event("skillatlas:select-popovers-refresh"));
    } catch {
      /* ignore */
    }

    await renderLinkedConceptsPanel(sb, userId, getState().linkedTechnologyIds, ttFn);
  };

  await refreshSelects();
  projSel.disabled = false;
  techMulti.disabled = false;

  const mergeLinkedIds = (newIds: string[]) => {
    const s = getState();
    const set = new Set(s.linkedTechnologyIds);
    for (const id of newIds) if (id) set.add(id);
    applyState({ ...s, linkedTechnologyIds: Array.from(set) });
    void persistLinks();
  };

  const ensureTechRow = async (slug: string, name: string, kindHint?: string | null) => {
    const existing = await getTechnologyDbId(sb, slug);
    if (existing) return existing;
    const catKind = getCatalogEntryForSlug(slug)?.kind ?? null;
    const k =
      kindHint === "library" || kindHint === "package" ? kindHint : catKind === "library" || catKind === "package" ? catKind : null;
    const supportsKind = k ? await supportsTechnologiesKindColumn(sb) : false;
    const payload: Record<string, unknown> = { name, slug, icon_key: slug, user_id: userId };
    if (supportsKind && k) payload.kind = k;
    const ins = await sb.from("technologies").insert(payload as any);
    if (ins.error) {
      if (String(ins.error.code ?? "") === "23505") return await getTechnologyDbId(sb, slug);
      throw ins.error;
    }
    return await getTechnologyDbId(sb, slug);
  };

  pickerBtn?.addEventListener("click", async () => {
    const linked = new Set(getState().linkedTechnologyIds);
    const techRes = await sb.from("technologies").select("slug, name, id").eq("user_id", userId).order("name");
    if (techRes.error) {
      showToast(techRes.error.message || ttFn("study.techPickerLoadError", "No se pudieron cargar tecnologías."), "error");
      return;
    }
    const forModal = ((techRes.data ?? []) as { slug: string; name: string; id: string }[])
      .filter((t) => t.slug && !linked.has(t.id))
      .map((t) => ({ slug: t.slug, name: t.name }));
    const result = await technologyPickerModal({
      title: ttFn("study.techPickerTitle", "Añadir tecnología al estudio"),
      technologies: forModal,
      seedCatalog: getSeedCatalogEntries(),
    });
    if (!result) return;
    pickerBtn.disabled = true;
    try {
      const addSlug = async (slug: string) => {
        const id = await getTechnologyDbId(sb, slug);
        if (!id) return;
        mergeLinkedIds([id]);
      };
      if (result.kind === "pick") await addSlug(result.slug);
      else if (result.kind === "pickMany") {
        for (const sl of result.slugs) await addSlug(sl);
      } else {
        const dup = await sb.from("technologies").select("id").eq("slug", result.slug).eq("user_id", userId).maybeSingle();
        if (dup.data?.id) {
          mergeLinkedIds([dup.data.id as string]);
        } else {
          const ins = await sb.from("technologies").insert({
            name: result.name,
            slug: result.slug,
            icon_key: result.slug,
            user_id: userId,
          } as any);
          if (ins.error && String(ins.error.code ?? "") !== "23505") throw ins.error;
          const tid = await getTechnologyDbId(sb, result.slug);
          if (tid) mergeLinkedIds([tid]);
        }
        if (result.importMode !== "none") {
          const tier = result.importMode === "junior" ? "&tier=junior" : "";
          window.location.href = `/technologies/view?tech=${encodeURIComponent(result.slug)}&seed=1${tier}`;
          return;
        }
      }
      await refreshSelects();
      projSel.disabled = false;
      techMulti.disabled = false;
      showToast(ttFn("study.techLinkedToast", "Tecnologías actualizadas en el estudio."), "success");
    } catch (e: any) {
      showToast(e?.message ? String(e.message) : ttFn("study.techPickerError", "Error al añadir tecnología."), "error");
    } finally {
      pickerBtn.disabled = false;
    }
  });

  registryBtn?.addEventListener("click", async () => {
    const q = (registryIn?.value ?? "").trim();
    if (!q) {
      showToast(ttFn("technologies.registryNeedQuery", "Escribe un paquete o URL."), "warning");
      return;
    }
    const { data: sess } = await sb.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      showToast(ttFn("study.searchNeedSession", "Inicia sesión."), "warning");
      return;
    }
    registryBtn.disabled = true;
    try {
      const json = await fetchTechRegistryLookup(token, q);
      if (!json || !("ok" in json) || !json.ok) {
        showToast((json as { error?: string })?.error || ttFn("technologies.registryError", "Error del registro."), "error");
        return;
      }
      const name = String(json.displayName ?? "").trim() || q;
      const slug = String(json.suggestedSlug ?? "").trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const tid = await ensureTechRow(slug, name, json.suggestedKind);
      if (tid) mergeLinkedIds([tid]);
      if (registryIn) registryIn.value = "";
      await refreshSelects();
      projSel.disabled = false;
      techMulti.disabled = false;
      showToast(ttFn("study.registryLinkedToast", "Tecnología creada o enlazada desde el registro."), "success");
    } catch (e: any) {
      showToast(e?.message ? String(e.message) : ttFn("technologies.registryError", "Error del registro."), "error");
    } finally {
      registryBtn.disabled = false;
    }
  });

  githubBtn?.addEventListener("click", async () => {
    const result = await githubRepoTechImportModal({
      title: ttFn("study.githubImportTitle", "Importar tecnologías desde GitHub"),
    });
    if (!result || result.technologies.length === 0) return;
    githubBtn.disabled = true;
    try {
      const newIds: string[] = [];
      for (const t of result.technologies) {
        const tid = await ensureTechRow(t.slug, t.name, null);
        if (tid) newIds.push(tid);
      }
      if (newIds.length) mergeLinkedIds(newIds);
      await refreshSelects();
      projSel.disabled = false;
      techMulti.disabled = false;
      showToast(
        newIds.length
          ? ttFn("study.githubImportOk", "Tecnologías importadas: {{n}}.").replace("{{n}}", String(newIds.length))
          : ttFn("study.githubImportNone", "No había tecnologías nuevas."),
        newIds.length ? "success" : "info",
      );
    } catch (e: any) {
      showToast(e?.message ? String(e.message) : "GitHub import error", "error");
    } finally {
      githubBtn.disabled = false;
    }
  });
}
