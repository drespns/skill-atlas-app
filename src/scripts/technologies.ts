import { getTechnologyIconSrc } from "../config/icons";
import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import { confirmModal, showToast, technologyEditModal } from "./ui-feedback";

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  const userId = await getSessionUserId(supabase);
  if (!userId) {
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
    const dup = await supabase
      .from("technologies")
      .select("id")
      .eq("slug", slug)
      .eq("user_id", userId)
      .maybeSingle();

    if (dup.error) {
      feedback.textContent = `Error al validar duplicado: ${dup.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }
    if (dup.data) {
      feedback.textContent = "Ya tienes una tecnología con ese nombre (mismo slug).";
      feedback.className = "text-sm text-amber-600";
      submitBtn.disabled = false;
      return;
    }

    const { error } = await supabase.from("technologies").insert({
      name,
      slug,
      icon_key: slug,
      user_id: userId,
    });

    if (error) {
      feedback.textContent =
        error.code === "23505"
          ? "Conflicto de slug en la base de datos: suele indicar un índice único global en slug (heredado). En Supabase ejecuta el script docs/sql/saas-004-drop-global-slug-constraints.sql; debe quedar solo la unicidad (user_id, slug) de saas-001."
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
  const userId = await getSessionUserId(supabase);
  if (!userId) {
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

async function bootstrapTechnologiesGrid() {
  const mount = document.querySelector<HTMLElement>("[data-technologies-csr-mount]");
  if (!mount) return;

  const countEl = document.querySelector<HTMLElement>("[data-technologies-count]");

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<p class="text-sm text-red-600 col-span-full">No hay cliente Supabase.</p>`;
    return;
  }

  const userId = await getSessionUserId(supabase);
  if (!userId) {
    mount.innerHTML = `<div class="border border-gray-200 rounded-xl p-5 bg-gray-50 col-span-full">
      <p class="m-0 text-sm text-amber-700">Inicia sesión en Ajustes para ver tus tecnologías.</p>
      <a href="/settings" class="inline-flex mt-3 rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a>
    </div>`;
    if (countEl) countEl.textContent = "0 total";
    return;
  }

  const [techRes, conceptRes] = await Promise.all([
    supabase.from("technologies").select("id, slug, name").order("name"),
    supabase.from("concepts").select("technology_id"),
  ]);

  if (techRes.error) {
    mount.innerHTML = `<p class="text-sm text-red-600 col-span-full">${escHtml(techRes.error.message)}</p>`;
    return;
  }

  const techRows = (techRes.data ?? []) as { id: string; slug: string; name: string }[];
  const countByTechDbId = new Map<string, number>();
  for (const row of conceptRes.data ?? []) {
    const tid = (row as { technology_id: string }).technology_id;
    countByTechDbId.set(tid, (countByTechDbId.get(tid) ?? 0) + 1);
  }

  if (countEl) {
    countEl.textContent = `${techRows.length} total`;
  }

  if (techRows.length === 0) {
    mount.innerHTML = `<p class="text-sm text-gray-600 col-span-full m-0">Aún no hay tecnologías.</p>`;
    return;
  }

  mount.innerHTML = techRows
    .map((tech) => {
      const conceptsCount = countByTechDbId.get(tech.id) ?? 0;
      const iconSrc = getTechnologyIconSrc({ id: tech.slug, name: tech.name });
      const iconHtml = iconSrc
        ? `<img src="${escHtml(iconSrc)}" alt="" class="h-5 w-5 shrink-0" loading="lazy" />`
        : "";
      const href = `/technologies/view?tech=${encodeURIComponent(tech.slug)}`;
      return `<div class="space-y-2">
        <article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
          <div class="flex items-baseline justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">${iconHtml}<h3 class="m-0 text-base font-semibold truncate">${escHtml(tech.name)}</h3></div>
            <span class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 whitespace-nowrap">${conceptsCount} conceptos</span>
          </div>
          <a href="${href}" class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 no-underline">Ver</a>
        </article>
        <div class="flex items-center gap-2">
          <button type="button" data-tech-edit data-tech-id="${escHtml(tech.slug)}" data-tech-name="${escHtml(tech.name)}" class="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50">Editar</button>
          <button type="button" data-tech-delete data-tech-id="${escHtml(tech.slug)}" data-tech-name="${escHtml(tech.name)}" class="inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-50">Eliminar</button>
        </div>
      </div>`;
    })
    .join("");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initTechnologyForm();
    void bootstrapTechnologiesGrid().then(() => initTechnologyActions());
  });
} else {
  void initTechnologyForm();
  void bootstrapTechnologiesGrid().then(() => initTechnologyActions());
}

