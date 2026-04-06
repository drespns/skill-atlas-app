import { compressImageForProjectCover } from "@lib/browser/image-compress";
import { publicStorageObjectUrl } from "@lib/supabase-public-storage-url";
import { showToast } from "@scripts/core/ui-feedback";
import { refreshProjectDetailPage } from "@scripts/projects/project-detail/refresh-ui";

const BUCKET = "project_covers";

function extForMime(m: "image/webp" | "image/jpeg"): string {
  return m === "image/webp" ? "webp" : "jpg";
}

export function initProjectCoverUpload(
  supabase: any,
  opts: {
    projectSlug: string;
    projectId: string;
    userId: string;
    currentPath: string | null;
  },
) {
  const input = document.querySelector<HTMLInputElement>("[data-project-cover-file]");
  const removeBtn = document.querySelector<HTMLButtonElement>("[data-project-cover-remove]");
  const preview = document.querySelector<HTMLImageElement>("[data-project-cover-preview]");
  const placeholder = document.querySelector<HTMLElement>("[data-project-cover-placeholder]");
  const feedback = document.querySelector<HTMLElement>("[data-project-cover-feedback]");
  if (!input || !preview) return;

  const setPreviewFromPath = (path: string | null) => {
    if (path) {
      const url = publicStorageObjectUrl(BUCKET, path);
      if (url) {
        preview.src = url;
        preview.classList.remove("hidden");
        placeholder?.classList.add("hidden");
      }
    } else {
      preview.removeAttribute("src");
      preview.classList.add("hidden");
      placeholder?.classList.remove("hidden");
    }
    if (removeBtn) removeBtn.classList.toggle("hidden", !path);
  };

  setPreviewFromPath(opts.currentPath);

  if (input.dataset.skillatlasCoverBound === "1") return;
  input.dataset.skillatlasCoverBound = "1";

  input.addEventListener("change", async () => {
    const file = input.files?.[0] ?? null;
    input.value = "";
    if (!file) return;

    if (feedback) {
      feedback.textContent = "Comprimiendo y subiendo…";
      feedback.className = "text-xs text-gray-600 dark:text-gray-400 m-0";
    }

    let blob: Blob;
    let mime: "image/webp" | "image/jpeg";
    try {
      const r = await compressImageForProjectCover(file);
      blob = r.blob;
      mime = r.outMime;
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "No se pudo procesar la imagen.";
      if (feedback) {
        feedback.textContent = msg;
        feedback.className = "text-xs text-red-600 m-0";
      }
      showToast(msg, "error");
      return;
    }

    const ext = extForMime(mime);
    const path = `${opts.userId}/${opts.projectId}/cover.${ext}`;

    if (opts.currentPath && opts.currentPath !== path) {
      await supabase.storage.from(BUCKET).remove([opts.currentPath]).catch(() => {});
    }

    const up = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: mime,
      cacheControl: "31536000",
    });

    if (up.error) {
      const msg = up.error.message ?? "Error al subir.";
      if (feedback) {
        feedback.textContent = msg;
        feedback.className = "text-xs text-red-600 m-0";
      }
      showToast(msg, "error");
      return;
    }

    const upd = await supabase
      .from("projects")
      .update({ cover_image_path: path })
      .eq("id", opts.projectId)
      .eq("user_id", opts.userId);

    if (upd.error) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      const msg = upd.error.message ?? "Error al guardar.";
      if (feedback) {
        feedback.textContent = msg;
        feedback.className = "text-xs text-red-600 m-0";
      }
      showToast(msg, "error");
      return;
    }

    if (feedback) {
      feedback.textContent = "Portada actualizada.";
      feedback.className = "text-xs text-green-600 dark:text-green-400 m-0";
    }
    showToast("Portada del proyecto guardada.", "success");
    setPreviewFromPath(path);
    await refreshProjectDetailPage();
  });

  removeBtn?.addEventListener("click", async () => {
    const pathNow =
      document.querySelector<HTMLElement>("[data-project-cover-path]")?.getAttribute("data-project-cover-path")?.trim() ||
      opts.currentPath ||
      "";
    if (!pathNow) return;
    removeBtn.disabled = true;
    if (feedback) {
      feedback.textContent = "Quitando portada…";
      feedback.className = "text-xs text-gray-600 m-0";
    }
    const rm = await supabase.storage.from(BUCKET).remove([pathNow]);
    if (rm.error) {
      if (feedback) {
        feedback.textContent = rm.error.message ?? "Error al borrar archivo.";
        feedback.className = "text-xs text-red-600 m-0";
      }
      removeBtn.disabled = false;
      return;
    }
    const upd = await supabase
      .from("projects")
      .update({ cover_image_path: null })
      .eq("id", opts.projectId)
      .eq("user_id", opts.userId);
    removeBtn.disabled = false;
    if (upd.error) {
      if (feedback) {
        feedback.textContent = upd.error.message ?? "Error al actualizar.";
        feedback.className = "text-xs text-red-600 m-0";
      }
      return;
    }
    if (feedback) {
      feedback.textContent = "Portada eliminada.";
      feedback.className = "text-xs text-green-600 dark:text-green-400 m-0";
    }
    showToast("Portada eliminada.", "success");
    setPreviewFromPath(null);
    await refreshProjectDetailPage();
  });
}
