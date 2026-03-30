import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import { runProjectDetailInits } from "./project-detail/runner";

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

function tableauEmbedUrl(url: string) {
  let next = url.replaceAll("&:redirect=auth", "").replaceAll("&:origin=viz_share_link", "");
  if (!next.includes(":showVizHome=no")) next += "&:showVizHome=no";
  if (!next.includes(":embed=yes")) next += "&:embed=yes";
  return next;
}

export async function bootstrapProjectDetailPage() {
  const mount = document.querySelector<HTMLElement>("[data-project-csr-mount]");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("project")?.trim() ?? "";
  if (!slug) {
    mount.innerHTML = `<section class="space-y-3"><p class="text-sm text-gray-600">Falta el parámetro <code>project</code> en la URL.</p>
      <a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Proyectos</a></section>`;
    return;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<p class="text-red-600 text-sm">No hay cliente Supabase.</p>`;
    return;
  }

  const userId = await getSessionUserId(supabase);
  if (!userId) {
    mount.innerHTML = `<section class="space-y-3"><p class="text-amber-700 text-sm">Inicia sesión en Ajustes para ver este proyecto.</p>
      <a href="/settings" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a></section>`;
    return;
  }

  const projRes = await supabase
    .from("projects")
    .select("id, slug, title, description")
    .eq("slug", slug)
    .maybeSingle();

  if (projRes.error || !projRes.data) {
    mount.innerHTML = `<section class="space-y-3"><h1 class="text-2xl font-semibold m-0">Proyecto</h1>
      <p class="text-sm text-gray-600">No se encontró el proyecto.</p>
      <div class="flex flex-wrap gap-2"><a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Volver a Proyectos</a>
      <a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Tecnologías</a></div></section>`;
    return;
  }

  const project = projRes.data as { id: string; slug: string; title: string; description: string | null };

  const [ptRes, pcRes, embRes, allTechRes, allConceptRes] = await Promise.all([
    supabase.from("project_technologies").select("technology_id").eq("project_id", project.id),
    supabase.from("project_concepts").select("concept_id").eq("project_id", project.id),
    supabase
      .from("project_embeds")
      .select("id, kind, title, url, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    supabase.from("technologies").select("id, slug, name").order("name"),
    supabase.from("concepts").select("id, technology_id, title, progress, notes").order("title"),
  ]);

  const linkedTechIds = new Set((ptRes.data ?? []).map((r: any) => r.technology_id));
  const linkedConceptIds = new Set((pcRes.data ?? []).map((r: any) => r.concept_id));
  const embeds = (embRes.data ?? []) as {
    id: string;
    kind: string;
    title: string;
    url: string;
    sort_order: number;
  }[];

  const allTechRows = (allTechRes.data ?? []) as { id: string; slug: string; name: string }[];
  const linkedTechs = allTechRows.filter((t) => linkedTechIds.has(t.id));
  const availableTechs = allTechRows.filter((t) => !linkedTechIds.has(t.id));

  const conceptRows = (allConceptRes.data ?? []) as {
    id: string;
    technology_id: string;
    title: string;
    progress: string;
    notes: string | null;
  }[];

  const techIdToSlug = new Map(allTechRows.map((t) => [t.id, t.slug]));
  const techIdToName = new Map(allTechRows.map((t) => [t.id, t.name]));

  const availableConcepts = conceptRows.filter(
    (c) => linkedTechIds.has(c.technology_id) && !linkedConceptIds.has(c.id),
  );

  const relatedConcepts = conceptRows.filter((c) => linkedConceptIds.has(c.id));

  const techPillsHtml = linkedTechs
    .map(
      (t) => `<div class="inline-flex items-center gap-1">
      <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-900 whitespace-nowrap">${esc(t.name)}</span>
      <button type="button" data-project-tech-remove data-tech-id="${esc(t.slug)}" class="text-xs rounded-full border border-gray-200 px-2 py-0.5 hover:bg-gray-50" title="Quitar ${esc(t.name)}">×</button>
    </div>`,
    )
    .join("");

  const techOptions =
    availableTechs.length > 0
      ? availableTechs.map((t) => `<option value="${esc(t.slug)}">${esc(t.name)}</option>`).join("")
      : `<option value="">No hay tecnologías disponibles</option>`;

  const conceptOptions =
    availableConcepts.length > 0
      ? availableConcepts.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("")
      : `<option value="">No hay conceptos disponibles</option>`;

  const embedsHtml = embeds
    .map((embed, idx) => {
      const iframe =
        embed.kind === "iframe"
          ? `<iframe class="w-full aspect-video rounded-lg border border-gray-200/80 dark:border-gray-800" src="${esc(tableauEmbedUrl(embed.url))}" title="${esc(embed.title)}" loading="lazy"></iframe>`
          : `<a class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline" href="${esc(embed.url)}" target="_blank" rel="noreferrer">Abrir enlace</a>`;
      return `<div class="space-y-2">
        <article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
          <h3 class="m-0 text-sm font-semibold">${esc(embed.title)}</h3>${iframe}
        </article>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" data-project-embed-edit data-embed-id="${esc(embed.id)}" data-embed-kind="${esc(embed.kind)}" data-embed-title="${esc(embed.title)}" data-embed-url="${esc(embed.url)}" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50">Editar embed</button>
          <button type="button" data-project-embed-remove data-embed-id="${esc(embed.id)}" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50">Eliminar embed</button>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" data-project-embed-move data-embed-id="${esc(embed.id)}" data-direction="up" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50" ${idx === 0 ? "disabled" : ""}>Subir</button>
          <button type="button" data-project-embed-move data-embed-id="${esc(embed.id)}" data-direction="down" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50" ${idx === embeds.length - 1 ? "disabled" : ""}>Bajar</button>
        </div>
      </div>`;
    })
    .join("");

  const relatedHtml = relatedConcepts
    .map((c) => {
      const tn = techIdToName.get(c.technology_id) ?? "";
      const pc = progressBadgeClass(c.progress);
      const pl = progressLabel(c.progress);
      return `<div class="flex items-start justify-between gap-4 border border-gray-200 rounded-xl p-3">
        <div class="min-w-0"><p class="m-0 font-semibold">${esc(c.title)}</p><p class="mt-1 text-xs text-gray-600">${esc(tn)}</p></div>
        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pc}">${pl}</span>
      </div>`;
    })
    .join("");

  mount.innerHTML = `<section class="space-y-6" data-project-id="${esc(project.slug)}" data-project-title="${esc(project.title)}" data-project-description="${esc(project.description ?? "")}">
    <header class="space-y-3">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div><h1 class="m-0 text-2xl font-semibold">${esc(project.title)}</h1>
        <p class="mt-2 text-sm text-gray-600">${esc(project.description ?? "")}</p></div>
        <div class="flex flex-wrap gap-2">${techPillsHtml}</div>
      </div>
      <a href="/projects" class="inline-flex rounded-lg border bg-white px-3 py-2 text-sm font-semibold no-underline">Volver a Proyectos</a>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-project-edit-open class="inline-flex rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Editar proyecto</button>
        <button type="button" data-project-delete class="inline-flex rounded-lg border border-red-200 text-red-700 px-3 py-2 text-sm font-semibold">Eliminar proyecto</button>
        <p data-project-edit-feedback class="text-sm text-gray-600 m-0 w-full md:w-auto md:self-center"></p>
      </div>
    </header>
    <section class="space-y-3">
      <h2 class="m-0 text-base font-semibold">Tecnologías del proyecto</h2>
      <form data-project-tech-form class="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 space-y-3">
        <div class="flex flex-col md:flex-row gap-2">
          <select name="technologyId" class="flex-1 border rounded-lg px-3 py-2 bg-white dark:bg-gray-950" required>${techOptions}</select>
          <button type="submit" class="inline-flex rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 ${availableTechs.length === 0 ? "opacity-60" : ""}" ${availableTechs.length === 0 ? "disabled" : ""}>Asociar tecnología</button>
        </div>
        <p data-project-tech-feedback class="text-sm text-gray-600 m-0"></p>
      </form>
    </section>
    <section class="space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 class="m-0 text-base font-semibold">Embeds</h2>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" data-project-embed-add class="inline-flex rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900">Añadir embed</button>
          <p data-project-embed-feedback class="text-sm text-gray-600 m-0"></p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${embedsHtml}</div>
    </section>
    <section class="space-y-3">
      <h2 class="m-0 text-base font-semibold">Conceptos relacionados</h2>
      <form data-project-concept-form data-project-id="${esc(project.slug)}" class="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 space-y-3">
        <p class="m-0 text-sm font-semibold">Añadir concepto (filtrado por tecnologías del proyecto)</p>
        <div class="flex flex-col md:flex-row gap-2">
          <select name="conceptId" class="flex-1 border rounded-lg px-3 py-2 bg-white dark:bg-gray-950" required>${conceptOptions}</select>
          <button type="submit" class="inline-flex rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 ${availableConcepts.length === 0 ? "opacity-60" : ""}" ${availableConcepts.length === 0 ? "disabled" : ""}>Asociar</button>
        </div>
        <p data-project-concept-feedback class="text-sm text-gray-600 m-0"></p>
      </form>
      <div class="space-y-2">${relatedHtml}</div>
    </section>
  </section>`;

  await runProjectDetailInits(supabase, project.slug);
}
