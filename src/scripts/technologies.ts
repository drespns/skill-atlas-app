import { getSupabaseBrowserClient } from "./client-supabase";
import { confirmModal, showToast, technologyEditModal } from "./ui-feedback";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function initTechnologyForm() {
  const form = document.querySelector<HTMLFormElement>("[data-tech-form]");
  if (!form) return;

  const nameInput = form.querySelector<HTMLInputElement>("[name='name']");
  const submitBtn = form.querySelector<HTMLButtonElement>("[type='submit']");
  const feedback = form.querySelector<HTMLElement>("[data-tech-feedback]");
  if (!nameInput || !submitBtn || !feedback) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    feedback.textContent = "Faltan variables de entorno de Supabase.";
    feedback.className = "text-sm text-red-600";
    return;
  }
  const sessionRes = await supabase.auth.getSession();
  if (!sessionRes.data.session) {
    feedback.textContent = "Inicia sesión en Ajustes para crear tecnologías.";
    feedback.className = "text-sm text-amber-600";
    submitBtn.disabled = true;
    nameInput.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;

    submitBtn.disabled = true;
    feedback.textContent = "Guardando...";
    feedback.className = "text-sm text-gray-600";

    const slug = toSlug(name);
    const { error } = await supabase.from("technologies").insert({
      name,
      slug,
      icon_key: slug,
    });

    if (error) {
      feedback.textContent =
        error.code === "23505"
          ? "Ya existe una tecnología con ese nombre/slug."
          : `Error al guardar: ${error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Tecnología creada correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Tecnología creada correctamente.", "success");
    window.location.reload();
  });
}

async function initTechnologyActions() {
  const feedback = document.querySelector<HTMLElement>("[data-tech-feedback]");
  const editButtons = document.querySelectorAll<HTMLButtonElement>("[data-tech-edit]");
  const deleteButtons = document.querySelectorAll<HTMLButtonElement>("[data-tech-delete]");
  if (editButtons.length === 0 && deleteButtons.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const sessionRes = await supabase.auth.getSession();
  if (!sessionRes.data.session) {
    if (feedback) {
      feedback.textContent = "Inicia sesión en Ajustes para editar o eliminar tecnologías.";
      feedback.className = "text-sm text-amber-600 m-0";
    }
    editButtons.forEach((btn) => (btn.disabled = true));
    deleteButtons.forEach((btn) => (btn.disabled = true));
    return;
  }

  for (const button of editButtons) {
    button.addEventListener("click", async () => {
      const techId = button.dataset.techId;
      const currentName = button.dataset.techName ?? "";
      if (!techId) return;

      const nextName = (
        await technologyEditModal({
          title: "Editar tecnología",
          initialName: currentName,
        })
      )?.trim();
      if (!nextName || nextName === currentName) return;
      const nextSlug = toSlug(nextName);

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Actualizando tecnología...";
        feedback.className = "text-sm text-gray-600 m-0";
      }

      const updateRes = await supabase
        .from("technologies")
        .update({ name: nextName, slug: nextSlug, icon_key: nextSlug })
        .eq("slug", techId);

      if (updateRes.error) {
        if (feedback) {
          feedback.textContent = `Error al actualizar: ${updateRes.error.message}`;
          feedback.className = "text-sm text-red-600 m-0";
        }
        showToast("Error al actualizar tecnología.", "error");
        button.disabled = false;
        return;
      }

      showToast("Tecnología actualizada correctamente.", "success");
      window.location.reload();
    });
  }

  for (const button of deleteButtons) {
    button.addEventListener("click", async () => {
      const techId = button.dataset.techId;
      const techName = button.dataset.techName ?? techId ?? "";
      if (!techId) return;

      const accepted = await confirmModal({
        title: `Eliminar "${techName}"`,
        description: "Se eliminarán también sus conceptos y relaciones.",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
        danger: true,
      });
      if (!accepted) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Eliminando tecnología...";
        feedback.className = "text-sm text-gray-600 m-0";
      }

      const deleteRes = await supabase.from("technologies").delete().eq("slug", techId);
      if (deleteRes.error) {
        if (feedback) {
          feedback.textContent = `Error al eliminar: ${deleteRes.error.message}`;
          feedback.className = "text-sm text-red-600 m-0";
        }
        showToast("Error al eliminar tecnología.", "error");
        button.disabled = false;
        return;
      }

      showToast("Tecnología eliminada.", "success");
      window.location.reload();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initTechnologyForm();
    void initTechnologyActions();
  });
} else {
  void initTechnologyForm();
  void initTechnologyActions();
}

