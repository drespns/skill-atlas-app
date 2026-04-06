import { coerceEvidenceDisplayKind, detectEvidenceUrl } from "@lib/evidence-url";
import i18next from "i18next";
import { embedEditModal, showToast, userFacingDbError } from "@scripts/core/ui-feedback";
import { getSessionUserId } from "@scripts/core/auth-session";
import { loadPrefs, updatePrefs, type ProjectEvidenceLayout } from "@scripts/core/prefs";
import { getProjectDbId } from "@scripts/projects/project-detail/helpers";
import { refreshProjectDetailPage } from "@scripts/projects/project-detail/refresh-ui";

function currentEvidenceLayout(): ProjectEvidenceLayout {
  const v = loadPrefs().projectEvidenceLayout;
  return v === "grid" || v === "list" || v === "large" ? v : "large";
}
import { removeEmbedThumbnailIfOwn, uploadEmbedThumbnail } from "@scripts/projects/project-detail/embed-thumbnail";

async function insertProjectEmbed(
  supabase: any,
  projectSlug: string,
  result: {
    kind: "iframe" | "link";
    title: string;
    url: string;
    showInPublic: boolean;
    thumbnailUrl: string | null;
    thumbnailFile?: File | null;
  },
  feedback: HTMLElement | null,
): Promise<boolean> {
  const projectDbId = await getProjectDbId(supabase, projectSlug);
  if (!projectDbId) {
    if (feedback) {
      feedback.textContent = "No se encontró el proyecto en Supabase.";
      feedback.className = "text-sm text-red-600";
    }
    return false;
  }

  const countRes = await supabase
    .from("project_embeds")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectDbId);

  if (countRes.error) {
    if (feedback) {
      feedback.textContent = `Error al calcular orden: ${countRes.error.message}`;
      feedback.className = "text-sm text-red-600";
    }
    return false;
  }

  const sortOrder = countRes.count ?? 0;

  const kind = coerceEvidenceDisplayKind(result.url, result.kind);
  const thumbFromUrl = result.thumbnailFile ? null : result.thumbnailUrl;
  const insertRes = await supabase
    .from("project_embeds")
    .insert([
      {
        project_id: projectDbId,
        kind,
        title: result.title,
        url: result.url,
        sort_order: sortOrder,
        show_in_public: result.showInPublic,
        thumbnail_url: thumbFromUrl,
      },
    ] as any)
    .select("id")
    .single();

  if (insertRes.error) {
    const hint = userFacingDbError(insertRes.error.message, "Error al guardar evidencia.");
    if (feedback) {
      feedback.textContent = hint;
      feedback.className = "text-sm text-red-600";
    }
    showToast(hint, "error");
    return false;
  }

  const newId = (insertRes.data as { id?: string } | null)?.id;
  if (result.thumbnailFile && newId) {
    const userId = await getSessionUserId(supabase);
    if (userId) {
      const publicUrl = await uploadEmbedThumbnail(supabase, {
        userId,
        projectId: projectDbId,
        embedId: newId,
        file: result.thumbnailFile,
      });
      if (publicUrl) {
        await supabase.from("project_embeds").update({ thumbnail_url: publicUrl }).eq("id", newId).eq("project_id", projectDbId);
      } else {
        showToast("La evidencia se guardó, pero la miniatura no se pudo subir (revisa bucket embed_thumbnails o tamaño).", "warning");
      }
    }
  }

  if (feedback) {
    feedback.textContent = "Evidencia añadida correctamente.";
    feedback.className = "text-sm text-green-600";
  }
  showToast("Evidencia añadida.", "success");
  return true;
}

/** Chips de plantilla: rellenan el input rápido y disparan el hint de detección. */
export function initProjectEvidenceTemplates() {
  const urlInput = document.querySelector<HTMLInputElement>("[data-project-evidence-quick-url]");
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-project-evidence-template]");
  if (!urlInput || buttons.length === 0) return;

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      const starter = (btn.dataset.starterUrl ?? "").trim();
      if (!starter) return;
      urlInput.value = starter;
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      urlInput.focus();
      urlInput.select();
    });
  }
}

export async function initProjectEvidenceQuickAdd(supabase: any, projectSlug: string) {
  const urlInput = document.querySelector<HTMLInputElement>("[data-project-evidence-quick-url]");
  const openBtn = document.querySelector<HTMLButtonElement>("[data-project-evidence-quick-open]");
  const hint = document.querySelector<HTMLElement>("[data-project-evidence-quick-hint]");
  const feedback = document.querySelector<HTMLElement>("[data-project-embed-feedback]");
  if (!urlInput || !openBtn) return;

  const syncHint = () => {
    const det = detectEvidenceUrl(urlInput.value);
    if (hint) hint.textContent = det.hint;
  };
  urlInput.addEventListener("input", syncHint);
  syncHint();

  openBtn.addEventListener("click", async () => {
    const raw = urlInput.value.trim();
    const det = detectEvidenceUrl(raw);
    if (det.sourceKey === "empty" || det.sourceKey === "invalid") {
      if (hint) hint.textContent = det.hint;
      return;
    }
    try {
      new URL(raw);
    } catch {
      if (hint) hint.textContent = "URL no válida.";
      return;
    }

    openBtn.disabled = true;
    const result = await embedEditModal({
      title: "Añadir evidencia",
      initialKind: det.suggestedKind,
      initialTitle: "",
      initialUrl: raw,
    });
    openBtn.disabled = false;
    if (!result) return;

    const ok = await insertProjectEmbed(supabase, projectSlug, result, feedback);
    if (ok) await refreshProjectDetailPage();
  });
}

export async function initProjectEmbedAdd(supabase: any, projectSlug: string) {
  const button = document.querySelector<HTMLButtonElement>("[data-project-embed-add]");
  const feedback = document.querySelector<HTMLElement>("[data-project-embed-feedback]");
  if (!button) return;

  button.addEventListener("click", async () => {
    const result = await embedEditModal({
      title: "Añadir evidencia",
      initialKind: "iframe",
      initialTitle: "",
      initialUrl: "",
      initialShowInPublic: true,
      initialThumbnailUrl: "",
    });
    if (!result) return;

    button.disabled = true;
    if (feedback) {
      feedback.textContent = "Guardando evidencia...";
      feedback.className = "text-sm text-gray-600";
    }

    const ok = await insertProjectEmbed(supabase, projectSlug, result, feedback);
    button.disabled = false;
    if (ok) await refreshProjectDetailPage();
  });
}

export async function initProjectEmbedEdit(supabase: any, projectSlug: string) {
  const editButtons = document.querySelectorAll<HTMLButtonElement>("[data-project-embed-edit]");
  const feedback = document.querySelector<HTMLElement>("[data-project-embed-feedback]");
  if (editButtons.length === 0) return;

  for (const button of editButtons) {
    button.addEventListener("click", async () => {
      const embedId = button.dataset.embedId;
      const storedKind = (button.dataset.embedKind ?? "iframe") as "iframe" | "link";
      const initialTitle = button.dataset.embedTitle ?? "";
      const initialUrl = button.dataset.embedUrl ?? "";
      const storedShowPublic = (button.dataset.embedShowPublic ?? "1") !== "0";
      const initialThumb = (button.dataset.embedThumbnailUrl ?? "").trim();
      if (!embedId) return;

      const result = await embedEditModal({
        title: "Editar evidencia",
        initialKind: storedKind === "link" ? "link" : "iframe",
        initialTitle,
        initialUrl,
        initialShowInPublic: storedShowPublic,
        initialThumbnailUrl: initialThumb,
      });
      if (!result) return;
      const initialCoerced = coerceEvidenceDisplayKind(initialUrl, storedKind === "link" ? "link" : "iframe");
      const resultThumb = (result.thumbnailUrl ?? "").trim();
      if (
        !result.thumbnailFile &&
        result.kind === initialCoerced &&
        result.title === initialTitle &&
        result.url === initialUrl &&
        result.showInPublic === storedShowPublic &&
        resultThumb === initialThumb
      ) {
        return;
      }

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Guardando cambios...";
        feedback.className = "text-sm text-gray-600";
      }

      const projectDbId = await getProjectDbId(supabase, projectSlug);
      if (!projectDbId) {
        if (feedback) {
          feedback.textContent = "No se encontró el proyecto en Supabase.";
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      const resolvedKind = coerceEvidenceDisplayKind(result.url, result.kind);
      const userId = await getSessionUserId(supabase);
      let thumbnailUrlOut: string | null = result.thumbnailUrl;
      if (result.thumbnailFile && userId) {
        await removeEmbedThumbnailIfOwn(supabase, userId, initialThumb);
        const up = await uploadEmbedThumbnail(supabase, {
          userId,
          projectId: projectDbId,
          embedId,
          file: result.thumbnailFile,
        });
        if (up) thumbnailUrlOut = up;
      }

      const updateRes = await supabase
        .from("project_embeds")
        .update({
          kind: resolvedKind,
          title: result.title,
          url: result.url,
          show_in_public: result.showInPublic,
          thumbnail_url: thumbnailUrlOut,
        })
        .eq("id", embedId)
        .eq("project_id", projectDbId);

      if (updateRes.error) {
        const hint = userFacingDbError(updateRes.error.message, "Error al actualizar evidencia.");
        if (feedback) {
          feedback.textContent = hint;
          feedback.className = "text-sm text-red-600";
        }
        showToast(hint, "error");
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Evidencia actualizada.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Evidencia actualizada.", "success");
      await refreshProjectDetailPage();
    });
  }
}

export async function initProjectEmbedRemove(supabase: any) {
  const removeButtons = document.querySelectorAll<HTMLButtonElement>("[data-project-embed-remove]");
  if (removeButtons.length === 0) return;

  const feedback = document.querySelector<HTMLElement>("[data-project-embed-feedback]");

  for (const button of removeButtons) {
    button.addEventListener("click", async () => {
      const embedId = button.dataset.embedId;
      if (!embedId) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Eliminando evidencia...";
        feedback.className = "text-sm text-gray-600";
      }

      const deleteRes = await supabase.from("project_embeds").delete().eq("id", embedId);
      if (deleteRes.error) {
        const hint = userFacingDbError(deleteRes.error.message, "Error al eliminar evidencia.");
        if (feedback) {
          feedback.textContent = hint;
          feedback.className = "text-sm text-red-600";
        }
        showToast(hint, "error");
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Evidencia eliminada.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Evidencia eliminada.", "success");
      await refreshProjectDetailPage();
    });
  }
}

export async function initProjectEmbedMove(supabase: any, projectSlug: string) {
  const moveButtons = document.querySelectorAll<HTMLButtonElement>("[data-project-embed-move]");
  if (moveButtons.length === 0) return;

  const feedback = document.querySelector<HTMLElement>("[data-project-embed-feedback]");

  for (const button of moveButtons) {
    button.addEventListener("click", async () => {
      const embedId = button.dataset.embedId;
      const direction = button.dataset.direction as "up" | "down" | undefined;
      if (!embedId || !direction) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Reordenando evidencias...";
        feedback.className = "text-sm text-gray-600";
      }

      const projectDbId = await getProjectDbId(supabase, projectSlug);
      if (!projectDbId) {
        if (feedback) {
          feedback.textContent = "No se encontró el proyecto en Supabase.";
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      const rowsRes = await supabase
        .from("project_embeds")
        .select("id, sort_order")
        .eq("project_id", projectDbId)
        .order("sort_order", { ascending: true });

      if (rowsRes.error) {
        if (feedback) {
          feedback.textContent = `Error al leer evidencias: ${rowsRes.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      const rows = (rowsRes.data ?? []) as { id: string; sort_order: number }[];
      const index = rows.findIndex((r) => r.id === embedId);
      if (index < 0) {
        button.disabled = false;
        return;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= rows.length) {
        button.disabled = false;
        return;
      }

      const current = rows[index];
      const target = rows[targetIndex];

      // Índice único (project_id, sort_order): un swap en dos updates deja un duplicado momentáneo.
      // 1) Mover "current" a un sort_order libre (max+1). 2) "target" → sort de current. 3) "current" → sort de target.
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1);
      const tempOrder = maxOrder + 1;

      const step1 = await supabase
        .from("project_embeds")
        .update({ sort_order: tempOrder })
        .eq("id", current.id)
        .eq("project_id", projectDbId);
      if (step1.error) {
        if (feedback) {
          feedback.textContent = `Error al mover: ${step1.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      const step2 = await supabase
        .from("project_embeds")
        .update({ sort_order: current.sort_order })
        .eq("id", target.id)
        .eq("project_id", projectDbId);
      if (step2.error) {
        if (feedback) {
          feedback.textContent = `Error al mover: ${step2.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      const step3 = await supabase
        .from("project_embeds")
        .update({ sort_order: target.sort_order })
        .eq("id", current.id)
        .eq("project_id", projectDbId);
      if (step3.error) {
        if (feedback) {
          feedback.textContent = `Error al mover: ${step3.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Orden actualizado.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Orden actualizado.", "success");
      await refreshProjectDetailPage();
    });
  }
}

function isProjectEvidenceLayout(v: string | null): v is ProjectEvidenceLayout {
  return v === "large" || v === "grid" || v === "list";
}

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function escapeHtmlTitle(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmbedTitleInner(raw: string): string {
  const t = raw.trim();
  const ph = tt("projects.evidenceTitlePlaceholder", "Especificar título…");
  if (t) return `<span class="embed-title-text">${escapeHtmlTitle(t)}</span>`;
  return `<span class="embed-title-placeholder text-gray-400 dark:text-gray-500 italic font-normal">${escapeHtmlTitle(ph)}</span>`;
}

let embedInlineTitleListener = false;

/** Clic en el título → edición inline (sin abrir el modal). */
export function initEmbedInlineTitleEdit(supabase: any) {
  if (embedInlineTitleListener) return;
  embedInlineTitleListener = true;

  document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-embed-inline-title]");
    if (!el || el.dataset.embedInlineDisabled === "1") return;
    if ((e.target as HTMLElement).closest("a[href]")) return;
    if (el.querySelector("[data-embed-inline-title-input]")) return;
    const mount = el.closest("[data-project-csr-mount]");
    if (!mount || mount.querySelector("[data-project-view=\"missing-project-param\"]")) return;
    e.preventDefault();
    const embedId = el.dataset.embedId?.trim();
    if (!embedId) return;
    const slug =
      mount.querySelector<HTMLElement>("[data-project-detail-slug]")?.getAttribute("data-project-detail-slug")?.trim() ?? "";
    if (!slug) return;

    const current = (el.getAttribute("data-embed-title") ?? "").trim();

    const input = document.createElement("input");
    input.type = "text";
    input.setAttribute("data-embed-inline-title-input", "");
    input.className =
      "w-full min-w-0 max-w-full rounded border border-indigo-400/80 dark:border-indigo-600/80 px-2 py-1 text-sm font-semibold bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100";
    input.value = current;
    input.placeholder = tt("projects.evidenceTitlePlaceholder", "Especificar título…");
    input.setAttribute("aria-label", tt("projects.evidenceTitleLabel", "Título"));

    el.textContent = "";
    el.appendChild(input);
    input.focus();
    input.select();

    let gone = false;

    const restore = (rawTitle: string) => {
      el.innerHTML = renderEmbedTitleInner(rawTitle);
    };

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        gone = true;
        input.remove();
        restore(current);
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        input.blur();
      }
    });

    input.addEventListener("blur", () => {
      if (gone) return;
      void (async () => {
        const next = input.value.trim();
        if (next === current) {
          input.remove();
          restore(current);
          return;
        }
        input.disabled = true;
        const projectDbId = await getProjectDbId(supabase, slug);
        if (!projectDbId) {
          input.remove();
          restore(current);
          showToast("No se pudo guardar el título.", "error");
          return;
        }
        const { error } = await supabase
          .from("project_embeds")
          .update({ title: next })
          .eq("id", embedId)
          .eq("project_id", projectDbId);
        input.remove();
        if (error) {
          showToast(userFacingDbError(error.message, "No se pudo guardar el título."), "error");
          restore(current);
          return;
        }
        el.setAttribute("data-embed-title", next);
        showToast("Título actualizado.", "success");
        await refreshProjectDetailPage();
      })();
    });
  });
}

export function initProjectEvidenceLayoutToggle() {
  const group = document.querySelector<HTMLElement>("[data-project-evidence-layout-toggle]");
  if (!group || group.dataset.skillatlasBound === "1") return;
  group.dataset.skillatlasBound = "1";

  /**
   * El markup de cada evidencia depende del modo (lista = sin iframe; grandes/cuadrícula = iframe).
   * Solo cambiar `data-layout` en el `<ol>` no regenera ese cuerpo: hay que rehidratar el detalle.
   */
  group.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-evidence-layout]");
    if (!btn) return;
    const v = btn.getAttribute("data-evidence-layout");
    if (!v || !isProjectEvidenceLayout(v)) return;
    if (v === currentEvidenceLayout()) return;
    updatePrefs({ projectEvidenceLayout: v });
    void refreshProjectDetailPage();
  });
}
