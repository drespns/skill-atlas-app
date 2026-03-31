import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import { showToast } from "./ui-feedback";
import { loadPrefs } from "./prefs";

declare global {
  interface Window {
    skillatlas?: {
      bootstrapProjectsList?: () => Promise<void>;
      clearProjectsCache?: () => void;
    };
  }
}

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
  const roleInput = form.querySelector<HTMLInputElement>("[name='role']");
  const outcomeInput = form.querySelector<HTMLInputElement>("[name='outcome']");
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

  // Helpful when coming from Command Palette actions (create=1)
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("create") === "1") {
      titleInput.focus();
      titleInput.select();
    }
  } catch {
    // ignore
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const role = (roleInput?.value ?? "").trim();
    const outcome = (outcomeInput?.value ?? "").trim();
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
      .insert([{ slug, title, description, role, outcome, user_id: userId }] as any);
    if (insertRes.error) {
      feedback.textContent = `Error al guardar: ${insertRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Proyecto creado correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Proyecto creado correctamente.", "success");
    titleInput.value = "";
    descInput.value = "";
    if (roleInput) roleInput.value = "";
    if (outcomeInput) outcomeInput.value = "";
    submitBtn.disabled = false;
    if (window.skillatlas?.clearProjectsCache) window.skillatlas.clearProjectsCache();
    if (window.skillatlas?.bootstrapProjectsList) {
      await window.skillatlas.bootstrapProjectsList();
    } else {
      window.location.reload();
    }
  });
}

async function bootstrapProjectsList() {
  const mount = document.querySelector<HTMLElement>("[data-projects-csr-mount]");
  if (!mount) return;

  const countEl = document.querySelector<HTMLElement>("[data-projects-count]");

  const cacheKey = (userId: string) => `skillatlas_cache_projects_list_v1:${userId}`;
  const readCache = (userId: string) => {
    try {
      const raw = sessionStorage.getItem(cacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts: number; html: string; countText: string };
      if (!parsed?.ts || typeof parsed.html !== "string") return null;
      // 2 min TTL (enough to avoid flicker while navigating)
      if (Date.now() - parsed.ts > 2 * 60 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  };
  const writeCache = (userId: string, html: string, countText: string) => {
    try {
      sessionStorage.setItem(cacheKey(userId), JSON.stringify({ ts: Date.now(), html, countText }));
    } catch {
      // ignore
    }
  };
  const clearCache = (userId: string) => {
    try {
      sessionStorage.removeItem(cacheKey(userId));
    } catch {
      // ignore
    }
  };

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

  const prefs = loadPrefs();
  const view = prefs.projectsView;

  const cached = readCache(userId);
  if (cached) {
    if (view === "list") {
      mount.className = "w-full space-y-2";
    } else {
      mount.className = "w-full grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[8rem]";
    }
    mount.innerHTML = cached.html;
    if (countEl) countEl.textContent = cached.countText;
    // Refresh in background
    setTimeout(() => {
      void bootstrapProjectsList();
    }, 0);
    return;
  }

  const [projRes, ptRes, techRes, pcRes] = await Promise.all([
    supabase.from("projects").select("id, slug, title, description, role, outcome").order("title"),
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
    role: string | null;
    outcome: string | null;
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

  const countText = `${projects.length} proyectos`;
  if (countEl) countEl.textContent = countText;

  if (projects.length === 0) {
    const html = `<div class="border border-gray-200 rounded-xl p-5 bg-gray-50 col-span-full">
      <p class="m-0 font-semibold">Aún no tienes proyectos.</p>
      <p class="mt-2 text-sm text-gray-600">En el MVP puedes empezar desde aquí.</p>
    </div>`;
    mount.innerHTML = html;
    writeCache(userId, html, countText);
    return;
  }

  if (view === "list") {
    mount.className = "w-full space-y-2";
  } else {
    mount.className = "w-full grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[8rem]";
  }

  const html =
    view === "list"
      ? `<div class="w-full rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
          ${(projects ?? [])
            .map((project) => {
              const technologyNames = techSlugsByProject.get(project.id) ?? [];
              const nConcepts = conceptCountByProject.get(project.id) ?? 0;
              const href = `/projects/view?project=${encodeURIComponent(project.slug)}`;
              const techLabel = technologyNames.slice(0, 3).map(escHtml).join(" · ");
              const more = Math.max(0, technologyNames.length - 3);
              const techSummary = techLabel ? `${techLabel}${more ? ` · +${more}` : ""}` : "";
              const roleLine = (project.role ?? "").trim();
              return `<a href="${href}" class="block no-underline px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="m-0 font-semibold truncate">${escHtml(project.title)}</p>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">${escHtml(project.description ?? "")}</p>
                    ${
                      roleLine
                        ? `<p class="mt-1 text-xs text-emerald-700 dark:text-emerald-300 truncate">${escHtml(roleLine)}</p>`
                        : ""
                    }
                    ${
                      techSummary
                        ? `<p class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">${techSummary}</p>`
                        : ""
                    }
                  </div>
                  <div class="shrink-0 text-right">
                    <span class="text-xs text-gray-500 dark:text-gray-400">${nConcepts} conceptos</span>
                  </div>
                </div>
              </a>`;
            })
            .join("")}
        </div>`
      : projects
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
            const roleLine = (project.role ?? "").trim();
            return `<article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
              <div class="flex items-start justify-between gap-3"><div>
                <h3 class="m-0 text-base font-semibold">${escHtml(project.title)}</h3>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">${escHtml(project.description ?? "")}</p>
                ${
                  roleLine
                    ? `<p class="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">${escHtml(roleLine)}</p>`
                    : ""
                }</div></div>
              <div class="flex flex-wrap gap-2">${pills}</div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs text-gray-500 dark:text-gray-400">${nConcepts} conceptos</span>
                <a class="btn-primary no-underline" href="${href}">Ver proyecto</a>
              </div>
            </article>`;
          })
          .join("");
  mount.innerHTML = html;
  writeCache(userId, html, countText);
}

window.skillatlas = window.skillatlas ?? {};
window.skillatlas.bootstrapProjectsList = async () => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const userId = await getSessionUserId(supabase);
  if (!userId) return;
  try {
    sessionStorage.removeItem(`skillatlas_cache_projects_list_v1:${userId}`);
  } catch {
    // ignore
  }
  await bootstrapProjectsList();
};
window.skillatlas.clearProjectsCache = () => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  void (async () => {
    const userId = await getSessionUserId(supabase);
    if (!userId) return;
    try {
      sessionStorage.removeItem(`skillatlas_cache_projects_list_v1:${userId}`);
    } catch {
      // ignore
    }
  })();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initProjectForm();
    void bootstrapProjectsList();
  });
} else {
  void initProjectForm();
  void bootstrapProjectsList();
}

