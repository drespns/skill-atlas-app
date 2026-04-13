import i18next from "i18next";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { runTechnologyDetailInits } from "@scripts/technologies/technology-detail/runner";
import {
  conceptsListHtml,
  esc,
  statCounts,
  summaryText,
} from "@scripts/technologies/technology-detail/concept-list-html";
import { hasConceptSeed } from "@scripts/technologies/technology-detail/concept-seeds";
import { recordRecentActivity } from "@scripts/app/recent-activity";

function escAttr(s: string | null | undefined) {
  return esc((s ?? "").replace(/\r\n|\r|\n/g, " "));
}

export async function bootstrapTechnologyDetailPage() {
  const mount = document.querySelector<HTMLElement>("[data-technology-csr-mount]");
  if (!mount) return;

  const timeoutId = window.setTimeout(() => {
    const slugT = new URLSearchParams(window.location.search).get("tech")?.trim() ?? "";
    mount.innerHTML = `<section class="space-y-2" data-technology-detail-slug="${escAttr(slugT)}"><h1 class="text-2xl font-semibold m-0">Tecnología</h1>
      <p class="text-sm text-red-600 dark:text-red-400 m-0">Tiempo de espera agotado al cargar el detalle.</p>
      <p class="text-xs text-gray-600 dark:text-gray-400 m-0">Prueba a recargar y, si persiste, revisa la consola.</p>
      <a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Tecnologías</a>
    </section>`;
    console.error("bootstrapTechnologyDetailPage: timeout exceeded");
  }, 15000);

  let slug = "";
  try {
    const params = new URLSearchParams(window.location.search);
    slug = params.get("tech")?.trim() ?? "";
    if (!slug) {
      mount.innerHTML = `<section class="space-y-3" data-technology-view="missing-tech-param"><p class="text-sm text-gray-600 dark:text-gray-300">Falta el parámetro <code>tech</code> en la URL.</p>
      <a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Tecnologías</a></section>`;
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      mount.innerHTML = `<section class="space-y-3" data-technology-detail-slug="${escAttr(slug)}"><p class="text-red-600 dark:text-red-400 text-sm m-0">No hay cliente Supabase.</p></section>`;
      return;
    }

    const userId = await getSessionUserId(supabase);
    if (!userId) {
      mount.innerHTML = `<section class="space-y-3" data-technology-detail-slug="${escAttr(slug)}"><p class="text-amber-700 dark:text-amber-400 text-sm">Inicia sesión en Ajustes para ver esta tecnología.</p>
      <a href="/settings#prefs" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a></section>`;
      return;
    }

    const techRes = await supabase
      .from("technologies")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();

    if (techRes.error || !techRes.data) {
      mount.innerHTML = `<section class="space-y-3" data-technology-detail-slug="${escAttr(slug)}"><h1 class="text-2xl font-semibold m-0">Tecnología</h1>
      <p class="text-sm text-gray-600 dark:text-gray-300">No se encontró la tecnología.</p>
      <div class="flex flex-wrap gap-2"><a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Volver a Tecnologías</a>
      <a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Proyectos</a></div></section>`;
      return;
    }

    const technology = techRes.data as { id: string; slug: string; name: string };

    recordRecentActivity({ kind: "tech", slug: technology.slug, label: technology.name });

  const [conceptsRes, ptForTechRes, allTechRes, allProjectsRes, allPtRes, allPcRes, studyTechLinkRes] = await Promise.all([
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
    supabase
      .from("study_workspace_technologies")
      .select("technology_id")
      .eq("user_id", userId)
      .eq("technology_id", technology.id)
      .maybeSingle(),
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

  const { aprend, pract, dom } = statCounts(techConcepts);

  const conceptsHtml = conceptsListHtml(techConcepts);
  const conceptCount = techConcepts.length;
  const seedSlug = technology.slug;
  const showSeedImport = hasConceptSeed(seedSlug);
  const importSourceId = `concept-import-src-${seedSlug.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

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
      : `<div class="border border-gray-200 dark:border-gray-800 rounded-xl p-5 bg-gray-50 dark:bg-gray-900/40">
        <p class="m-0 font-semibold">Todavía no hay proyectos usando ${esc(technology.name)}.</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">Ve a Proyectos para empezar a relacionar conceptos.</p>
        <a href="/projects" class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 no-underline mt-3">Ir a Proyectos</a>
      </div>`;

  const studyTechBanner = document.querySelector<HTMLElement>("[data-technology-study-banner]");
  if (studyTechBanner) {
    const row = studyTechLinkRes.error ? null : studyTechLinkRes.data;
    const linked = Boolean(row && (row as { technology_id?: string }).technology_id === technology.id);
    if (linked) {
      studyTechBanner.classList.remove("hidden");
      studyTechBanner.className =
        "rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/25 px-4 py-3 text-sm text-amber-950 dark:text-amber-100";
      const body = String(
        i18next.t("technologyDetail.studyBannerBody", {
          defaultValue: "Esta tecnología está en tu espacio de estudio (vínculos SkillAtlas).",
        }),
      );
      const cta = String(
        i18next.t("technologyDetail.studyBannerCta", { defaultValue: "Ir a Estudio" }),
      );
      studyTechBanner.innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p class="m-0">${esc(body)}</p>
        <a href="/study" class="inline-flex shrink-0 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white no-underline hover:bg-amber-800">${esc(cta)}</a>
      </div>`;
    } else {
      studyTechBanner.classList.add("hidden");
      studyTechBanner.innerHTML = "";
    }
  }

  mount.innerHTML = `<section class="space-y-6" data-technology-page data-technology-id="${esc(technology.id)}" data-technology-detail-slug="${escAttr(technology.slug)}" data-related-project-count="${relatedProjects.length}">
    <header class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div><h1 class="m-0 text-2xl font-semibold">${esc(technology.name)}</h1>
      <p data-tech-summary class="mt-2 text-sm text-gray-600 dark:text-gray-300">${esc(summaryText(techConcepts, relatedProjects.length))}</p></div>
      <div class="flex flex-wrap gap-2">
        <span data-tech-stat-aprend class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 whitespace-nowrap">${aprend} aprend.</span>
        <span data-tech-stat-pract class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 whitespace-nowrap">${pract} pract.</span>
        <span data-tech-stat-dom class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 whitespace-nowrap">${dom} dom.</span>
      </div>
    </header>
    <section class="space-y-5" aria-labelledby="tech-concepts-heading">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="tech-concepts-heading" class="m-0 text-lg font-semibold">Conceptos</h2>
        <p class="m-0 text-xs text-gray-500 dark:text-gray-400">${conceptCount} en esta tecnología · revisa la lista y añade o importa abajo</p>
      </div>
      <div data-concept-list class="space-y-2">${conceptsHtml}</div>
      <form data-concept-form data-tech-id="${esc(technology.slug)}" class="rounded-xl border border-gray-200/80 dark:border-gray-800 p-4 bg-white dark:bg-gray-950 space-y-3 shadow-sm">
        <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">Añadir concepto</p>
        <p class="m-0 text-xs text-gray-500 dark:text-gray-400 -mt-1">Un concepto nuevo solo para ${esc(technology.name)}.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input name="title" type="text" placeholder="Título del concepto" class="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950" required />
          <select name="progress" class="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950">
            <option value="aprendido">Aprendido</option>
            <option value="practicado">Practicado</option>
            <option value="mastered">Dominado</option>
          </select>
        </div>
        <textarea name="notes" rows="3" placeholder="Notas del concepto" class="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950"></textarea>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">Guardar concepto</button>
          <p data-concept-feedback class="text-sm text-gray-600 dark:text-gray-300 m-0"></p>
        </div>
      </form>
      <section data-concept-import data-technology-id="${esc(technology.id)}" data-technology-slug="${esc(technology.slug)}" data-technology-name="${esc(technology.name)}" class="space-y-3 m-0">
      <details class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
        <summary class="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 flex flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <span>Importar varios conceptos</span>
          <span class="text-xs font-normal text-gray-500 dark:text-gray-400">${showSeedImport ? "SkillAtlas por defecto · modal de revisión" : "texto, URL o modal de revisión"}</span>
        </summary>
        <div class="border-t border-gray-200 dark:border-gray-800 px-4 pb-4 pt-3 space-y-3">
        <p class="m-0 text-xs text-gray-600 dark:text-gray-400">Lo más directo es el <strong class="font-semibold text-gray-800 dark:text-gray-200">catálogo SkillAtlas</strong> cuando existe para esta tecnología: se carga solo y puedes elegir qué importar o hacerlo todo de una vez. El Markdown manual queda en un bloque avanzado.</p>
        <div class="space-y-1 max-w-lg">
          <label for="${escAttr(importSourceId)}" class="block text-xs font-semibold text-gray-700 dark:text-gray-300">Origen</label>
          <select id="${escAttr(importSourceId)}" data-import-source class="w-full text-sm border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950">
            ${
              showSeedImport
                ? `<option value="seed" selected>Catálogo sugerido (SkillAtlas)</option>
            <option value="text">Texto o Markdown propio</option>`
                : `<option value="text" selected>Texto o Markdown propio</option>`
            }
            <option value="url">URL (archivo .md o texto plano)</option>
          </select>
        </div>
        ${
          showSeedImport
            ? `<div data-import-seed-panel class="rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2.5 space-y-2">
          <p class="m-0 text-xs text-emerald-900 dark:text-emerald-200/90">Plantilla mantenida en el proyecto para <strong>${esc(technology.name)}</strong>. Si algo falla o quieres empezar de cero, vuelve a cargarla.</p>
          <button type="button" data-import-load-seed class="inline-flex items-center justify-center rounded-lg bg-emerald-700 dark:bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500">Recargar plantilla SkillAtlas</button>
        </div>`
            : ""
        }
        <div data-import-panel-text class="space-y-2">
          <details class="rounded-lg border border-gray-200/80 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/30 px-3 py-2">
            <summary class="cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300 list-none [&::-webkit-details-marker]:hidden">Editar Markdown a mano (avanzado)</summary>
            <div class="mt-2 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" data-import-expand-text class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900">Editor amplio</button>
                <span class="text-[11px] text-gray-500 dark:text-gray-400">Atajos tipo IDE: Alt+flechas mueven línea; Shift+Alt+flechas duplican.</span>
              </div>
              <textarea data-import-text rows="5" placeholder="## Core&#10;- RDD&#10;- Lazy evaluation" class="w-full text-sm border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950 font-mono"></textarea>
            </div>
          </details>
        </div>
        <div data-import-panel-url hidden class="space-y-2">
          <input data-import-url type="url" inputmode="url" placeholder="https://ejemplo.com/doc.md" class="w-full text-sm border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950" />
        </div>
        <div class="space-y-2">
          <div class="flex flex-wrap gap-2">
            <button type="button" data-import-choose class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">Revisar e importar…</button>
            <button type="button" data-import-quick class="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900">Importar todo lo nuevo</button>
          </div>
          <p class="m-0 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">«Revisar e importar» analiza el origen y abre un modal para marcar conceptos. «Importar todo lo nuevo» crea en bloque los que falten sin abrir el modal.</p>
        </div>
        <p data-import-feedback class="text-sm text-gray-600 dark:text-gray-300 m-0 min-h-5"></p>
        </div>
      </details>
      <dialog data-import-review-dialog class="concept-import-review-dialog rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 shadow-2xl">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <header class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <h3 class="m-0 text-base font-semibold">Elegir conceptos</h3>
            <button type="button" data-import-review-dialog-close class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-lg leading-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900" aria-label="Cerrar">×</button>
          </header>
          <div data-import-review-body class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"></div>
          <footer class="flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-800 px-4 py-3 shrink-0">
            <button type="button" data-import-select-nondup class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-900">Solo marcar no duplicados</button>
            <button type="button" data-import-selected disabled class="inline-flex items-center justify-center rounded-lg bg-green-700 dark:bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 dark:hover:bg-green-500 disabled:opacity-50">Importar seleccionados</button>
          </footer>
        </div>
      </dialog>
      </section>
    </section>
    <section class="space-y-3">
      <h2 class="m-0 text-base font-semibold">Proyectos con esta tecnología</h2>
      ${projectsSectionHtml}
    </section>
  </section>`;

    await runTechnologyDetailInits();
  } catch (err) {
    console.error("bootstrapTechnologyDetailPage error", err);
    const slugErr =
      slug || new URLSearchParams(window.location.search).get("tech")?.trim() || "";
    mount.innerHTML = `<section class="space-y-3" data-technology-detail-slug="${escAttr(slugErr)}"><h1 class="text-2xl font-semibold m-0">Tecnología</h1>
      <p class="text-sm text-red-600 dark:text-red-400">Error cargando el detalle de la tecnología.</p>
      <a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Tecnologías</a>
    </section>`;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

window.skillatlas = window.skillatlas ?? {};
window.skillatlas.bootstrapTechnologyDetailPage = bootstrapTechnologyDetailPage;

let technologyViewBootLock = false;

function renderedTechnologySlugInMount(mount: HTMLElement): string {
  return (
    mount
      .querySelector<HTMLElement>("[data-technology-detail-slug]")
      ?.getAttribute("data-technology-detail-slug")
      ?.trim() ?? ""
  );
}

function queueTechnologyViewBootstrapOnce() {
  if (technologyViewBootLock) return;
  technologyViewBootLock = true;
  void (async () => {
    try {
      await bootstrapTechnologyDetailPage();
    } finally {
      technologyViewBootLock = false;
    }
  })();
}

function scheduleTechnologyViewBootstrap() {
  const mount = document.querySelector<HTMLElement>("[data-technology-csr-mount]");
  if (!mount) return;

  const slug = new URLSearchParams(window.location.search).get("tech")?.trim() ?? "";
  if (!slug) {
    if (mount.querySelector("[data-technology-view=\"missing-tech-param\"]")) return;
    queueTechnologyViewBootstrapOnce();
    return;
  }

  const renderedSlug = renderedTechnologySlugInMount(mount);
  if (renderedSlug === slug) return;

  queueTechnologyViewBootstrapOnce();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleTechnologyViewBootstrap);
} else {
  scheduleTechnologyViewBootstrap();
}

document.addEventListener("astro:page-load", scheduleTechnologyViewBootstrap);
document.addEventListener("astro:after-swap", scheduleTechnologyViewBootstrap);
