import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import { runTechnologyDetailInits } from "./technology-detail/runner";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function progressBadgeClass(p: string) {
  if (p === "mastered") return "bg-purple-100 text-purple-800 border-purple-200";
  if (p === "practicado") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-green-100 text-green-800 border-green-200";
}

function progressLabel(p: string) {
  if (p === "mastered") return "Dominado";
  if (p === "practicado") return "Practicado";
  return "Aprendido";
}

export async function bootstrapTechnologyDetailPage() {
  const mount = document.querySelector<HTMLElement>("[data-technology-csr-mount]");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("tech")?.trim() ?? "";
  if (!slug) {
    mount.innerHTML = `<section class="space-y-3"><p class="text-sm text-gray-600">Falta el parámetro <code>tech</code> en la URL.</p>
      <a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Tecnologías</a></section>`;
    return;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<p class="text-red-600 text-sm">No hay cliente Supabase.</p>`;
    return;
  }

  const userId = await getSessionUserId(supabase);
  if (!userId) {
    mount.innerHTML = `<section class="space-y-3"><p class="text-amber-700 text-sm">Inicia sesión en Ajustes para ver esta tecnología.</p>
      <a href="/settings" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a></section>`;
    return;
  }

  const techRes = await supabase
    .from("technologies")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (techRes.error || !techRes.data) {
    mount.innerHTML = `<section class="space-y-3"><h1 class="text-2xl font-semibold m-0">Tecnología</h1>
      <p class="text-sm text-gray-600">No se encontró la tecnología.</p>
      <div class="flex flex-wrap gap-2"><a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Volver a Tecnologías</a>
      <a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Proyectos</a></div></section>`;
    return;
  }

  const technology = techRes.data as { id: string; slug: string; name: string };

  const [conceptsRes, ptForTechRes, allTechRes, allProjectsRes, allPtRes, allPcRes] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, title, notes, progress")
      .eq("technology_id", technology.id)
      .order("title"),
    supabase.from("project_technologies").select("project_id").eq("technology_id", technology.id),
    supabase.from("technologies").select("id, slug, name"),
    supabase.from("projects").select("id, slug, title, description"),
    supabase.from("project_technologies").select("project_id, technology_id"),
    supabase.from("project_concepts").select("project_id, concept_id"),
  ]);

  const techConcepts = (conceptsRes.data ?? []) as {
    id: string;
    title: string;
    notes: string | null;
    progress: string;
  }[];

  const linkedProjectIds = new Set((ptForTechRes.data ?? []).map((r: any) => r.project_id));
  const allProjects = (allProjectsRes.data ?? []) as { id: string; slug: string; title: string; description: string | null }[];
  const relatedProjects = allProjects.filter((p) => linkedProjectIds.has(p.id));

  const allTech = (allTechRes.data ?? []) as { id: string; slug: string; name: string }[];
  const techNameById = new Map(allTech.map((t) => [t.id, t.name]));

  const conceptCountByProject = new Map<string, number>();
  for (const row of allPcRes.data ?? []) {
    const pid = (row as any).project_id as string;
    conceptCountByProject.set(pid, (conceptCountByProject.get(pid) ?? 0) + 1);
  }

  const techNamesForProject = (projectId: string) => {
    const names: string[] = [];
    for (const row of allPtRes.data ?? []) {
      const r = row as { project_id: string; technology_id: string };
      if (r.project_id !== projectId) continue;
      const n = techNameById.get(r.technology_id);
      if (n) names.push(n);
    }
    return names;
  };

  const aprend = techConcepts.filter((c) => c.progress === "aprendido").length;
  const pract = techConcepts.filter((c) => c.progress === "practicado").length;
  const dom = techConcepts.filter((c) => c.progress === "mastered").length;

  const conceptsHtml =
    techConcepts.length > 0
      ? techConcepts
          .map(
            (concept) => `<div class="flex items-start justify-between gap-4 border border-gray-200 rounded-xl p-3">
        <div class="min-w-0"><p class="m-0 font-semibold">${esc(concept.title)}</p><p class="mt-1 text-sm text-gray-600">${esc(concept.notes ?? "")}</p></div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${progressBadgeClass(concept.progress)}">${progressLabel(concept.progress)}</span>
          <button type="button" data-concept-edit data-concept-id="${esc(concept.id)}" data-concept-title="${esc(concept.title)}" data-concept-notes="${esc(concept.notes ?? "")}" data-concept-progress="${esc(concept.progress)}" class="inline-flex items-center justify-center rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold hover:bg-gray-50">Editar</button>
          <button type="button" data-concept-delete data-concept-id="${esc(concept.id)}" data-concept-title="${esc(concept.title)}" class="inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 px-2 py-1 text-xs font-semibold hover:bg-red-50">Eliminar</button>
        </div>
      </div>`,
          )
          .join("")
      : `<div class="border border-gray-200 rounded-xl p-5 bg-gray-50">
        <p class="m-0 font-semibold">Aún no tienes conceptos en esta tecnología.</p>
        <p class="mt-2 text-sm text-gray-600">En el MVP, los conceptos se crean desde aquí.</p>
        <a href="/projects" class="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 no-underline mt-3">Ver Proyectos</a>
      </div>`;

  const projectCardsHtml = relatedProjects
    .map((project) => {
      const technologyNames = techNamesForProject(project.id);
      const pills = technologyNames
        .map(
          (name) =>
            `<span class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 whitespace-nowrap">${esc(name)}</span>`,
        )
        .join("");
      const nConcepts = conceptCountByProject.get(project.id) ?? 0;
      return `<article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
      <div class="flex items-start justify-between gap-3"><div>
        <h3 class="m-0 text-base font-semibold">${esc(project.title)}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">${esc(project.description ?? "")}</p></div></div>
      <div class="flex flex-wrap gap-2">${pills}</div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs text-gray-500 dark:text-gray-400">${nConcepts} conceptos</span>
        <a class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 no-underline" href="/projects/view?project=${esc(project.slug)}">Ver proyecto</a>
      </div></article>`;
    })
    .join("");

  const projectsSectionHtml =
    relatedProjects.length > 0
      ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${projectCardsHtml}</div>`
      : `<div class="border border-gray-200 rounded-xl p-5 bg-gray-50">
        <p class="m-0 font-semibold">Todavía no hay proyectos usando ${esc(technology.name)}.</p>
        <p class="mt-2 text-sm text-gray-600">Ve a Proyectos para empezar a relacionar conceptos.</p>
        <a href="/projects" class="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 no-underline mt-3">Ir a Proyectos</a>
      </div>`;

  mount.innerHTML = `<section class="space-y-6">
    <header class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div><h1 class="m-0 text-2xl font-semibold">${esc(technology.name)}</h1>
      <p class="mt-2 text-sm text-gray-600">${techConcepts.length} conceptos · ${relatedProjects.length} proyectos</p></div>
      <div class="flex flex-wrap gap-2">
        <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-900 whitespace-nowrap">${aprend} aprend.</span>
        <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-900 whitespace-nowrap">${pract} pract.</span>
        <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-900 whitespace-nowrap">${dom} dom.</span>
      </div>
    </header>
    <section class="space-y-3">
      <h2 class="m-0 text-base font-semibold">Conceptos</h2>
      <form data-concept-form data-tech-id="${esc(technology.slug)}" class="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 space-y-3">
        <p class="m-0 text-sm font-semibold">Nuevo concepto en ${esc(technology.name)}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input name="title" type="text" placeholder="Título del concepto" class="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950" required />
          <select name="progress" class="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950">
            <option value="aprendido">Aprendido</option>
            <option value="practicado">Practicado</option>
            <option value="mastered">Dominado</option>
          </select>
        </div>
        <textarea name="notes" rows="3" placeholder="Notas del concepto" class="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950"></textarea>
        <div class="flex items-center gap-3">
          <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">Guardar concepto</button>
          <p data-concept-feedback class="text-sm text-gray-600 m-0"></p>
        </div>
      </form>
      <div class="space-y-2">${conceptsHtml}</div>
    </section>
    <section class="space-y-3">
      <h2 class="m-0 text-base font-semibold">Proyectos con esta tecnología</h2>
      ${projectsSectionHtml}
    </section>
  </section>`;

  await runTechnologyDetailInits();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootstrapTechnologyDetailPage();
  });
} else {
  void bootstrapTechnologyDetailPage();
}
