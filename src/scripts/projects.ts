import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import { showToast } from "./ui-feedback";

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

async function initProjectForm() {
  const form = document.querySelector<HTMLFormElement>("[data-project-form]");
  if (!form) return;

  const titleInput = form.querySelector<HTMLInputElement>("[name='title']");
  const descInput = form.querySelector<HTMLTextAreaElement>("[name='description']");
  const feedback = form.querySelector<HTMLElement>("[data-project-feedback]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[type='submit']");
  if (!titleInput || !descInput || !feedback || !submitBtn) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    feedback.textContent = "Faltan variables de entorno de Supabase.";
    feedback.className = "text-sm text-red-600";
    return;
  }
  const userId = await getSessionUserId(supabase);
  if (!userId) {
    feedback.textContent = "Inicia sesión en Ajustes para crear proyectos.";
    feedback.className = "text-sm text-amber-600";
    submitBtn.disabled = true;
    titleInput.disabled = true;
    descInput.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    if (!title) return;

    submitBtn.disabled = true;
    feedback.textContent = "Guardando proyecto...";
    feedback.className = "text-sm text-gray-600";

    const slug = toSlug(title);
    const duplicate = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .eq("user_id", userId)
      .maybeSingle();
    if (duplicate.error) {
      feedback.textContent = `Error validando duplicado: ${duplicate.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }
    if (duplicate.data) {
      feedback.textContent = "Ya existe un proyecto con ese título/slug.";
      feedback.className = "text-sm text-amber-600";
      submitBtn.disabled = false;
      return;
    }

    const insertRes = await supabase
      .from("projects")
      .insert([{ slug, title, description, user_id: userId }] as any);
    if (insertRes.error) {
      feedback.textContent = `Error al guardar: ${insertRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Proyecto creado correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Proyecto creado correctamente.", "success");
    window.location.reload();
  });
}

async function bootstrapProjectsList() {
  const mount = document.querySelector<HTMLElement>("[data-projects-csr-mount]");
  if (!mount) return;

  const countEl = document.querySelector<HTMLElement>("[data-projects-count]");

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<p class="text-sm text-red-600 col-span-full">No hay cliente Supabase.</p>`;
    return;
  }

  const userId = await getSessionUserId(supabase);
  if (!userId) {
    mount.innerHTML = `<div class="border border-gray-200 rounded-xl p-5 bg-gray-50 col-span-full">
      <p class="m-0 text-sm text-amber-700">Inicia sesión en Ajustes para ver tus proyectos.</p>
      <a href="/settings" class="inline-flex mt-3 rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a>
    </div>`;
    if (countEl) countEl.textContent = "0 proyectos";
    return;
  }

  const [projRes, ptRes, techRes, pcRes] = await Promise.all([
    supabase.from("projects").select("id, slug, title, description").order("title"),
    supabase.from("project_technologies").select("project_id, technology_id"),
    supabase.from("technologies").select("id, slug, name"),
    supabase.from("project_concepts").select("project_id"),
  ]);

  if (projRes.error) {
    mount.innerHTML = `<p class="text-sm text-red-600 col-span-full">${escHtml(projRes.error.message)}</p>`;
    return;
  }

  const projects = (projRes.data ?? []) as {
    id: string;
    slug: string;
    title: string;
    description: string | null;
  }[];
  const techRows = (techRes.data ?? []) as { id: string; slug: string; name: string }[];
  const techNameById = new Map(techRows.map((t) => [t.id, t.name]));

  const techSlugsByProject = new Map<string, string[]>();
  for (const row of ptRes.data ?? []) {
    const r = row as { project_id: string; technology_id: string };
    const name = techNameById.get(r.technology_id);
    if (!name) continue;
    const list = techSlugsByProject.get(r.project_id) ?? [];
    list.push(name);
    techSlugsByProject.set(r.project_id, list);
  }

  const conceptCountByProject = new Map<string, number>();
  for (const row of pcRes.data ?? []) {
    const pid = (row as { project_id: string }).project_id;
    conceptCountByProject.set(pid, (conceptCountByProject.get(pid) ?? 0) + 1);
  }

  if (countEl) {
    countEl.textContent = `${projects.length} proyectos`;
  }

  if (projects.length === 0) {
    mount.innerHTML = `<div class="border border-gray-200 rounded-xl p-5 bg-gray-50 col-span-full">
      <p class="m-0 font-semibold">Aún no tienes proyectos.</p>
      <p class="mt-2 text-sm text-gray-600">En el MVP puedes empezar desde aquí.</p>
    </div>`;
    return;
  }

  mount.innerHTML = projects
    .map((project) => {
      const technologyNames = techSlugsByProject.get(project.id) ?? [];
      const pills = technologyNames
        .map(
          (name) =>
            `<span class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 whitespace-nowrap">${escHtml(name)}</span>`,
        )
        .join("");
      const nConcepts = conceptCountByProject.get(project.id) ?? 0;
      const href = `/projects/view?project=${encodeURIComponent(project.slug)}`;
      return `<article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div>
          <h3 class="m-0 text-base font-semibold">${escHtml(project.title)}</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">${escHtml(project.description ?? "")}</p></div></div>
        <div class="flex flex-wrap gap-2">${pills}</div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-gray-500 dark:text-gray-400">${nConcepts} conceptos</span>
          <a class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 no-underline" href="${href}">Ver proyecto</a>
        </div>
      </article>`;
    })
    .join("");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initProjectForm();
    void bootstrapProjectsList();
  });
} else {
  void initProjectForm();
  void bootstrapProjectsList();
}

