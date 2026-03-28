import { embedEditModal, showToast } from "../ui-feedback";
import { getProjectDbId } from "./helpers";

export async function initProjectEmbedAdd(supabase: any, projectSlug: string) {
  const button = document.querySelector<HTMLButtonElement>("[data-project-embed-add]");
  const feedback = document.querySelector<HTMLElement>("[data-project-embed-feedback]");
  if (!button) return;

  button.addEventListener("click", async () => {
    const result = await embedEditModal({
      title: "Añadir embed",
      initialKind: "iframe",
      initialTitle: "",
      initialUrl: "",
    });
    if (!result) return;

    button.disabled = true;
    if (feedback) {
      feedback.textContent = "Guardando embed...";
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

    const countRes = await supabase
      .from("project_embeds")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectDbId);

    if (countRes.error) {
      if (feedback) {
        feedback.textContent = `Error al calcular orden: ${countRes.error.message}`;
        feedback.className = "text-sm text-red-600";
      }
      button.disabled = false;
      return;
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
      if (feedback) {
        feedback.textContent = `Error al guardar embed: ${insertRes.error.message}`;
        feedback.className = "text-sm text-red-600";
      }
      showToast("Error al guardar embed.", "error");
      button.disabled = false;
      return;
    }

    if (feedback) {
      feedback.textContent = "Embed añadido correctamente.";
      feedback.className = "text-sm text-green-600";
    }
    showToast("Embed añadido.", "success");
    window.location.reload();
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
        title: "Editar embed",
        initialKind: kind === "link" ? "link" : "iframe",
        initialTitle,
        initialUrl,
      });
      if (!result) return;
      if (
        result.kind === kind &&
        result.title === initialTitle &&
        result.url === initialUrl
      ) {
        return;
      }

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Guardando cambios del embed...";
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
        if (feedback) {
          feedback.textContent = `Error al actualizar embed: ${updateRes.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        showToast("Error al actualizar embed.", "error");
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Embed actualizado.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Embed actualizado.", "success");
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
        feedback.textContent = "Eliminando embed...";
        feedback.className = "text-sm text-gray-600";
      }

      const deleteRes = await supabase.from("project_embeds").delete().eq("id", embedId);
      if (deleteRes.error) {
        if (feedback) {
          feedback.textContent = `Error al eliminar embed: ${deleteRes.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Embed eliminado correctamente.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Embed eliminado.", "success");
      window.location.reload();
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
        feedback.textContent = "Reordenando embeds...";
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
          feedback.textContent = `Error al leer embeds: ${rowsRes.error.message}`;
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

      const firstUpdate = await supabase
        .from("project_embeds")
        .update({ sort_order: target.sort_order })
        .eq("id", current.id);
      if (firstUpdate.error) {
        if (feedback) {
          feedback.textContent = `Error al mover embed: ${firstUpdate.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      const secondUpdate = await supabase
        .from("project_embeds")
        .update({ sort_order: current.sort_order })
        .eq("id", target.id);
      if (secondUpdate.error) {
        if (feedback) {
          feedback.textContent = `Error al mover embed: ${secondUpdate.error.message}`;
          feedback.className = "text-sm text-red-600";
        }
        button.disabled = false;
        return;
      }

      if (feedback) {
        feedback.textContent = "Orden actualizado.";
        feedback.className = "text-sm text-green-600";
      }
      showToast("Orden de embeds actualizado.", "success");
      window.location.reload();
    });
  }
}
