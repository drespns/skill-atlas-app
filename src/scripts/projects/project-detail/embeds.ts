import { detectEvidenceUrl } from "@lib/evidence-url";
import { embedEditModal, showToast, userFacingDbError } from "@scripts/core/ui-feedback";
import { loadPrefs, updatePrefs, type ProjectEvidenceLayout } from "@scripts/core/prefs";
import { getProjectDbId } from "@scripts/projects/project-detail/helpers";
import { refreshProjectDetailPage } from "@scripts/projects/project-detail/refresh-ui";

async function insertProjectEmbed(
  supabase: any,
  projectSlug: string,
  result: { kind: "iframe" | "link"; title: string; url: string },
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

  const insertRes = await supabase.from("project_embeds").insert([
    {
      project_id: projectDbId,
      kind: result.kind,
      title: result.title,
      url: result.url,
      sort_order: sortOrder,
    },
  ] as any);

  if (insertRes.error) {
    const hint = userFacingDbError(insertRes.error.message, "Error al guardar evidencia.");
    if (feedback) {
      feedback.textContent = hint;
      feedback.className = "text-sm text-red-600";
    }
    showToast(hint, "error");
    return false;
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
      const kind = (button.dataset.embedKind ?? "iframe") as "iframe" | "link";
      const initialTitle = button.dataset.embedTitle ?? "";
      const initialUrl = button.dataset.embedUrl ?? "";
      if (!embedId) return;

      const result = await embedEditModal({
        title: "Editar evidencia",
        initialKind: kind === "link" ? "link" : "iframe",
        initialTitle,
        initialUrl,
      });
      if (!result) return;
      if (result.kind === kind && result.title === initialTitle && result.url === initialUrl) {
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

      const updateRes = await supabase
        .from("project_embeds")
        .update({
          kind: result.kind,
          title: result.title,
          url: result.url,
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
      window.location.reload();
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
  return v === "large" || v === "grid";
}

export function initProjectEvidenceLayoutToggle() {
  const group = document.querySelector<HTMLElement>("[data-project-evidence-layout-toggle]");
  const list = document.querySelector<HTMLElement>("[data-project-embeds-list]");
  if (!group || !list || group.dataset.skillatlasBound === "1") return;
  group.dataset.skillatlasBound = "1";

  const applyLayout = (layout: ProjectEvidenceLayout) => {
    list.dataset.layout = layout;
    list.setAttribute("data-layout", layout);
    group.querySelectorAll<HTMLButtonElement>("[data-evidence-layout]").forEach((btn) => {
      const v = btn.getAttribute("data-evidence-layout");
      const pressed = v === layout;
      btn.setAttribute("aria-pressed", String(pressed));
      btn.classList.toggle("bg-gray-100", pressed);
      btn.classList.toggle("dark:bg-gray-900", pressed);
      btn.classList.toggle("shadow-inner", pressed);
    });
  };

  applyLayout(loadPrefs().projectEvidenceLayout);

  group.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-evidence-layout]");
    if (!btn) return;
    const v = btn.getAttribute("data-evidence-layout");
    if (!v || !isProjectEvidenceLayout(v)) return;
    updatePrefs({ projectEvidenceLayout: v });
    applyLayout(v);
  });
}
