import { EVIDENCE_QUICK_TEMPLATES } from "@config/evidence-templates";
import {
  detectEvidenceUrl,
  embedIframeSrc,
  evidenceSiteIconUrl,
  IFRAME_EMBED_ALLOW,
} from "@lib/evidence-url";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { runProjectDetailInits } from "@scripts/projects/project-detail/runner";
import { loadPrefs } from "@scripts/core/prefs";
import { recordRecentActivity } from "@scripts/app/recent-activity";

function esc(s: string | null | undefined) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Atributos HTML: sin saltos de línea. */
function escAttr(s: string | null | undefined) {
  return esc((s ?? "").replace(/\r\n|\r|\n/g, " "));
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

function hashHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function techDotHtml(techSlug: string) {
  const hue = hashHue(techSlug);
  return `<span class="inline-flex h-2.5 w-2.5 rounded-full ring-1 ring-gray-200/70 dark:ring-gray-700/70" style="background-color:hsl(${hue} 72% 52% / 0.9)"></span>`;
}

function techMarker(techSlug: string) {
  const markers = ["■", "●", "◆", "▲", "▼", "▶", "◀", "⬣"];
  return markers[hashHue(techSlug) % markers.length];
}

export async function bootstrapProjectDetailPage() {
  const mount = document.querySelector<HTMLElement>("[data-project-csr-mount]");
  if (!mount) return;

  // Evita que la UI se quede eterna si alguna consulta queda colgada.
  const timeoutId = window.setTimeout(() => {
    const slugT = new URLSearchParams(window.location.search).get("project")?.trim() ?? "";
    mount.innerHTML = `<section class="space-y-2" data-project-detail-slug="${escAttr(slugT)}"><h1 class="text-2xl font-semibold m-0">Proyecto</h1>
      <p class="text-sm text-red-600 m-0">Tiempo de espera agotado al cargar el detalle.</p>
      <p class="text-xs text-gray-600 m-0">Prueba a recargar y, si persiste, revisa datos (especialmente evidencias) y la consola.</p>
      <a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Proyectos</a>
    </section>`;
    console.error("bootstrapProjectDetailPage: timeout exceeded");
  }, 15000);

  let slug = "";
  try {
    const params = new URLSearchParams(window.location.search);
    slug = params.get("project")?.trim() ?? "";
    if (!slug) {
      mount.innerHTML = `<section class="space-y-3" data-project-view="missing-project-param"><p class="text-sm text-gray-600">Falta el parámetro <code>project</code> en la URL.</p>
        <a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Proyectos</a></section>`;
      return;
    }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<section class="space-y-3" data-project-detail-slug="${escAttr(slug)}"><p class="text-red-600 text-sm m-0">No hay cliente Supabase.</p></section>`;
    return;
  }

  const userId = await getSessionUserId(supabase);
  if (!userId) {
    mount.innerHTML = `<section class="space-y-3" data-project-detail-slug="${escAttr(slug)}"><p class="text-amber-700 text-sm">Inicia sesión en Ajustes para ver este proyecto.</p>
      <a href="/settings" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a></section>`;
    return;
  }

  const projRes = await supabase
    .from("projects")
    .select("id, slug, title, description, role, outcome")
    .eq("slug", slug)
    .maybeSingle();

  if (projRes.error || !projRes.data) {
    mount.innerHTML = `<section class="space-y-3" data-project-detail-slug="${escAttr(slug)}"><h1 class="text-2xl font-semibold m-0">Proyecto</h1>
      <p class="text-sm text-gray-600">No se encontró el proyecto.</p>
      <div class="flex flex-wrap gap-2"><a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Volver a Proyectos</a>
      <a href="/technologies" class="inline-flex rounded-lg border px-3 py-2 text-sm no-underline">Tecnologías</a></div></section>`;
    return;
  }

  const project = projRes.data as {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    role: string | null;
    outcome: string | null;
  };

  recordRecentActivity({ kind: "project", slug: project.slug, label: project.title });

  const role = (project.role ?? "").trim();
  const outcome = (project.outcome ?? "").trim();

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

  const techIdToName = new Map(allTechRows.map((t) => [t.id, t.name]));

  const availableConcepts = conceptRows.filter(
    (c) => linkedTechIds.has(c.technology_id) && !linkedConceptIds.has(c.id),
  );

  const relatedConcepts = conceptRows.filter((c) => linkedConceptIds.has(c.id));

  const techPillsHtml = linkedTechs
    .map((t) => {
      const hue = hashHue(t.slug);
      return `<div class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 bg-white/60 dark:bg-gray-950/50" style="border-color:hsl(${hue} 72% 52% / 0.35); background-color:hsl(${hue} 72% 52% / 0.10)">
        ${techDotHtml(t.slug)}
        <span class="text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">${esc(t.name)}</span>
        <button type="button" data-project-tech-remove data-tech-id="${esc(t.slug)}" class="text-xs rounded-full border border-gray-200/80 dark:border-gray-800 px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-900" title="Quitar ${esc(t.name)}">×</button>
      </div>`;
    })
    .join("");

  const techDatalistOptions =
    availableTechs.length > 0
      ? availableTechs.map((t) => `<option value="${esc(t.slug)}">${esc(t.name)}</option>`).join("")
      : "";

  const conceptsByTech = new Map<string, typeof availableConcepts>();
  for (const c of availableConcepts) {
    const list = conceptsByTech.get(c.technology_id) ?? [];
    list.push(c);
    conceptsByTech.set(c.technology_id, list);
  }
  const conceptOptions =
    availableConcepts.length > 0
      ? Array.from(conceptsByTech.entries())
          .sort((a, b) => {
            const an = techIdToName.get(a[0]) ?? "";
            const bn = techIdToName.get(b[0]) ?? "";
            return an.localeCompare(bn);
          })
          .map(([techId, list]) => {
            const techName = techIdToName.get(techId) ?? "Tecnología";
            const techSlug = allTechRows.find((t) => t.id === techId)?.slug ?? "";
            // Nota: <option> no soporta HTML bien en todos los browsers; por eso metemos un marcador textual.
            const prefix = techSlug ? `${techMarker(techSlug)} ` : "";
            const inner = list
              .map((c) => `<option value="${esc(c.id)}">${esc(prefix + c.title)}</option>`)
              .join("");
            return `<optgroup label="${esc(techName)}">${inner}</optgroup>`;
          })
          .join("")
      : `<option value="">No hay conceptos disponibles</option>`;

  const evidenceLayout = loadPrefs().projectEvidenceLayout === "grid" ? "grid" : "large";

  const templateChipsHtml = EVIDENCE_QUICK_TEMPLATES.map(
    (t) =>
      `<button type="button" data-project-evidence-template data-starter-url="${escAttr(t.starterUrl)}" title="Rellenar ejemplo (${escAttr(t.label)}); sustituye las partes en mayúsculas" class="inline-flex rounded-full border border-emerald-200/90 dark:border-emerald-800/80 bg-white dark:bg-gray-950 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40">${esc(t.label)}</button>`,
  ).join("");

  const embedsHtml = embeds
    .map((embed, idx) => {
      // Robustez: en datos viejos o mal migrados puede venir `url`/`title` como `null`.
      const embedUrl = embed.url ?? "";
      const embedTitle = embed.title ?? "";
      const embedKind = embed.kind === "iframe" ? "iframe" : "link";

      const det = detectEvidenceUrl(embedUrl);
      const kindLabel = embedKind === "iframe" ? "iframe" : "enlace";
      const iconSrc = evidenceSiteIconUrl(embedUrl);
      const iconHtml = iconSrc
        ? `<img src="${esc(iconSrc)}" alt="" width="24" height="24" class="rounded shrink-0 ring-1 ring-gray-200/80 dark:ring-gray-700 mt-0.5" loading="lazy" decoding="async" data-evidence-favicon onerror="this.remove()" />`
        : "";
      const iframe =
        embedKind === "iframe"
          ? `<iframe class="project-embed-iframe w-full aspect-video rounded-lg border border-gray-200/80 dark:border-gray-800" src="${esc(embedIframeSrc(embedUrl))}" title="${esc(embedTitle)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="${escAttr(IFRAME_EMBED_ALLOW)}" allowfullscreen></iframe>`
          : `<a class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline" href="${esc(embedUrl)}" target="_blank" rel="noreferrer">Abrir enlace</a>`;
      return `<li class="project-embeds-list__item list-none space-y-2 min-w-0">
        <div class="flex flex-wrap items-start gap-3 min-w-0">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200">${idx + 1}</span>
          <article class="min-w-0 flex-1 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
            <div class="flex flex-wrap items-start gap-2 gap-y-1">
              ${iconHtml}
              <div class="flex flex-wrap items-center gap-2 gap-y-1 min-w-0">
              <span class="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/50">${esc(det.sourceLabel)}</span>
              <span class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(kindLabel)}</span>
              </div>
            </div>
            <h3 class="m-0 text-sm font-semibold">${esc(embedTitle)}</h3>
            ${iframe}
          </article>
        </div>
        <div class="project-embeds-actions flex flex-wrap items-center gap-2 pl-11">
          <button type="button" data-project-embed-edit data-embed-id="${esc(embed.id)}" data-embed-kind="${esc(embedKind)}" data-embed-title="${esc(embedTitle)}" data-embed-url="${esc(embedUrl)}" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Editar</button>
          <button type="button" data-project-embed-remove data-embed-id="${esc(embed.id)}" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Eliminar</button>
          <button type="button" data-project-embed-move data-embed-id="${esc(embed.id)}" data-direction="up" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50" ${idx === 0 ? "disabled" : ""}>Subir</button>
          <button type="button" data-project-embed-move data-embed-id="${esc(embed.id)}" data-direction="down" class="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50" ${idx === embeds.length - 1 ? "disabled" : ""}>Bajar</button>
        </div>
      </li>`;
    })
    .join("");

  const evidenceLayoutToggleHtml = `<div class="inline-flex items-center rounded-lg border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-950/70 p-0.5 gap-0.5 shadow-sm" data-project-evidence-layout-toggle role="group" aria-label="Vista de evidencias">
    <button type="button" data-evidence-layout="large" aria-pressed="${evidenceLayout === "large" ? "true" : "false"}" class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-gray-900 ${evidenceLayout === "large" ? "bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-inner" : "text-gray-600 dark:text-gray-400"}">Grandes</button>
    <button type="button" data-evidence-layout="grid" aria-pressed="${evidenceLayout === "grid" ? "true" : "false"}" class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-gray-900 ${evidenceLayout === "grid" ? "bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-inner" : "text-gray-600 dark:text-gray-400"}">Cuadrícula</button>
  </div>`;

  const relatedHtml = relatedConcepts
    .map((c) => {
      const tn = techIdToName.get(c.technology_id) ?? "";
      const pc = progressBadgeClass(c.progress);
      const pl = progressLabel(c.progress);
      return `<div class="flex items-start justify-between gap-3 min-w-0 border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-white/50 dark:bg-gray-950/50">
        <div class="min-w-0 flex-1 overflow-hidden pr-1">
          <p class="m-0 font-semibold text-gray-900 dark:text-gray-100 break-words">${esc(c.title)}</p>
          <p class="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate" title="${escAttr(tn)}">${esc(tn)}</p>
        </div>
        <span class="inline-flex shrink-0 items-center self-start rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${pc}">${pl}</span>
      </div>`;
    })
    .join("");

  const emptyEvidence =
    embeds.length === 0
      ? `<p class="m-0 text-sm text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2">Aún no hay evidencias. Pega una URL arriba o usa el formulario completo.</p>`
      : "";

  const relatedListModal =
    relatedConcepts.length > 0
      ? relatedHtml
      : `<p class="m-0 text-xs text-gray-500 dark:text-gray-400">Ningún concepto vinculado todavía.</p>`;

  const techStackBlock = `<div class="space-y-3 pt-2 border-t border-dashed border-gray-200/80 dark:border-gray-800/80">
      <div class="flex flex-wrap gap-2">${linkedTechs.length > 0 ? techPillsHtml : `<p class="m-0 text-xs text-gray-500 dark:text-gray-400">Aún no has asociado tecnologías.</p>`}</div>
      <div class="flex flex-wrap items-center gap-2 gap-y-2">
        <button type="button" data-project-tech-picker-open class="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-950/90 px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">+ Añadir tecnología</button>
        ${
          allTechRows.length === 0
            ? `<span class="text-xs text-amber-700 dark:text-amber-200">Crea tecnologías desde la sección Tecnologías o al asociar aquí.</span>`
            : ""
        }
        ${
          availableTechs.length === 0 && linkedTechs.length > 0 && allTechRows.length > 0
            ? `<span class="text-xs text-gray-500 dark:text-gray-400">Todas tus tecnologías están ya en este proyecto.</span>`
            : ""
        }
      </div>
      <form data-project-tech-form class="m-0 p-0 block">
        <p data-project-tech-feedback class="text-xs text-gray-600 dark:text-gray-400 m-0 min-h-4"></p>
      </form>
      <div class="pt-2 mt-1 border-t border-gray-200/60 dark:border-gray-800/60 space-y-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Conceptos relacionados</span>
          <button type="button" data-project-concepts-modal-open class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Gestionar</button>
        </div>
        <p class="m-0 text-[11px] leading-snug text-gray-500 dark:text-gray-400">${relatedConcepts.length} vinculados${availableConcepts.length ? ` · ${availableConcepts.length} disponibles para añadir` : ""}</p>
      </div>
    </div>`;

  const conceptsDialogHtml = `<dialog data-project-concepts-dialog class="project-concepts-dialog rounded-2xl border border-gray-200/90 dark:border-gray-700/90 bg-white dark:bg-gray-950 p-0 text-gray-900 dark:text-gray-100 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
      <div data-project-concepts-dialog-inner class="project-concepts-dialog__inner flex flex-col gap-4 p-5 sm:p-6">
        <header class="flex items-start justify-between gap-4 min-w-0 border-b border-gray-100 dark:border-gray-800/80 pb-4">
          <div class="min-w-0 flex-1 space-y-1">
            <h2 class="m-0 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">Conceptos del proyecto</h2>
            <p class="m-0 text-xs text-gray-500 dark:text-gray-400 leading-snug">Vincula conceptos de las tecnologías ya asociadas al proyecto.</p>
          </div>
          <button type="button" data-project-concepts-dialog-close class="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200/80 dark:border-gray-700 text-base leading-none text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors" aria-label="Cerrar">×</button>
        </header>
        <div class="space-y-2 min-w-0" data-project-concepts-modal-list>${relatedListModal}</div>
        <form data-project-concept-form data-project-id="${esc(project.slug)}" class="m-0 min-w-0 space-y-3 rounded-xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/80 dark:bg-gray-900/40 p-4">
          <p class="m-0 text-sm font-semibold text-gray-800 dark:text-gray-200">Añadir concepto</p>
          <p class="m-0 text-xs text-gray-500 dark:text-gray-400 -mt-1">Solo aparecen conceptos de las tecnologías del proyecto.</p>
          <div class="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-stretch">
            <select name="conceptId" class="min-w-0 w-full flex-1 max-w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100" required>${conceptOptions}</select>
            <button type="submit" class="inline-flex shrink-0 justify-center rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-gray-900 sm:w-auto ${availableConcepts.length === 0 ? "opacity-60 cursor-not-allowed" : ""}" ${availableConcepts.length === 0 ? "disabled" : ""}>Asociar</button>
          </div>
          <p data-project-concept-feedback class="text-xs text-gray-600 dark:text-gray-400 m-0 min-h-4"></p>
        </form>
      </div>
    </dialog>`;

  mount.innerHTML = `<section class="space-y-6" data-project-id="${esc(project.slug)}" data-project-detail-slug="${escAttr(project.slug)}" data-project-title="${esc(project.title)}" data-project-description="${esc(project.description ?? "")}" data-project-role="${escAttr(role)}" data-project-outcome="${escAttr(outcome)}">
    <header class="space-y-3">
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div class="min-w-0 flex-1 space-y-2">
          <h1 class="m-0 text-2xl font-semibold">${esc(project.title)}</h1>
          <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${esc(project.description ?? "")}</p>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 m-0 pt-1 text-sm">
            <div>
              <dt class="font-semibold text-gray-800 dark:text-gray-200">Rol</dt>
              <dd class="m-0 mt-1 text-gray-600 dark:text-gray-400">${role ? esc(role) : "—"}</dd>
            </div>
            <div>
              <dt class="font-semibold text-gray-800 dark:text-gray-200">Resultado / impacto</dt>
              <dd class="m-0 mt-1 text-gray-600 dark:text-gray-400">${outcome ? esc(outcome) : "—"}</dd>
            </div>
          </dl>
          ${techStackBlock}
        </div>
        <div class="flex flex-col items-stretch gap-2 lg:w-64">
          <a href="/projects" class="inline-flex justify-center rounded-lg border bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold no-underline">Volver a Proyectos</a>
          <button type="button" data-project-edit-open class="inline-flex justify-center rounded-lg border bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold">Editar historia</button>
          <button type="button" data-project-delete class="inline-flex justify-center rounded-lg border border-red-200/90 dark:border-red-900/40 text-red-700 dark:text-red-300 px-3 py-2 text-sm font-semibold hover:bg-red-50/60 dark:hover:bg-red-950/30">Eliminar proyecto</button>
          <p data-project-edit-feedback class="text-xs text-gray-600 dark:text-gray-400 m-0 min-h-4"></p>
        </div>
      </div>
    </header>

    <section class="space-y-4" aria-labelledby="project-evidence-heading">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0 space-y-1">
          <h2 id="project-evidence-heading" class="m-0 text-lg font-semibold">Evidencias</h2>
          <span class="text-xs text-gray-500 dark:text-gray-400">${embeds.length} en la lista · reordenar con Subir/Bajar</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          ${evidenceLayoutToggleHtml}
        </div>
      </div>
      <p class="m-0 text-sm text-gray-600 dark:text-gray-400 max-w-3xl">Lo central del proyecto: enlaces y vistas embebidas. Detectamos el tipo de URL para sugerir iframe o enlace.</p>

      <div class="rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2">
        <p class="m-0 text-xs font-semibold text-emerald-900 dark:text-emerald-200">Añadir evidencia desde URL</p>
        <p class="m-0 text-[11px] text-gray-600 dark:text-gray-400">Plantillas: rellenan un ejemplo; sustituye <span class="font-mono text-[10px]">USUARIO</span>, <span class="font-mono text-[10px]">VIDEO_ID</span>, etc.</p>
        <div class="flex flex-wrap gap-1.5">${templateChipsHtml}</div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input type="url" data-project-evidence-quick-url placeholder="https://…" class="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
          <button type="button" data-project-evidence-quick-open class="inline-flex justify-center rounded-lg bg-emerald-700 dark:bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 shrink-0">Revisar y añadir</button>
        </div>
        <p data-project-evidence-quick-hint class="text-xs text-gray-600 dark:text-gray-400 m-0 min-h-4"></p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p data-project-embed-feedback class="text-sm text-gray-600 m-0"></p>
        <button type="button" data-project-embed-add class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Añadir evidencia (formulario completo)</button>
      </div>
      ${emptyEvidence}
      <ol class="project-embeds-list m-0 p-0 list-none" data-project-embeds-list data-layout="${evidenceLayout}">${embedsHtml || ""}</ol>
    </section>

    ${conceptsDialogHtml}
  </section>`;

    await runProjectDetailInits(supabase, project.slug);
  } catch (err) {
    console.error("bootstrapProjectDetailPage error", err);
    const slugErr =
      slug ||
      new URLSearchParams(window.location.search).get("project")?.trim() ||
      "";
    mount.innerHTML = `<section class="space-y-3" data-project-detail-slug="${escAttr(slugErr)}"><h1 class="text-2xl font-semibold m-0">Proyecto</h1>
      <p class="text-sm text-red-600">Error cargando el detalle del proyecto.</p>
      <p class="text-xs text-gray-600">Si esto afecta a una evidencia, revisa los datos en Supabase (url/title) y la consola del navegador.</p>
      <a href="/projects" class="inline-flex rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Volver a Proyectos</a>
    </section>`;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// Registro para mutaciones (embeds, etc.) sin recargar toda la página.
window.skillatlas = window.skillatlas ?? {};
window.skillatlas.bootstrapProjectDetailPage = bootstrapProjectDetailPage;

// El módulo solo se evalúa una vez; con View Transitions hay que volver a bootstrap en cada navegación.
let projectViewBootLock = false;

function renderedProjectSlugInMount(mount: HTMLElement): string {
  const byDetail = mount.querySelector<HTMLElement>("[data-project-detail-slug]");
  const fromDetail = byDetail?.getAttribute("data-project-detail-slug")?.trim();
  if (fromDetail) return fromDetail;

  const byId = mount.querySelector<HTMLElement>("section[data-project-id]");
  return byId?.getAttribute("data-project-id")?.trim() ?? "";
}

function queueProjectViewBootstrapOnce() {
  if (projectViewBootLock) return;
  projectViewBootLock = true;
  void (async () => {
    try {
      await bootstrapProjectDetailPage();
    } finally {
      projectViewBootLock = false;
    }
  })();
}

function scheduleProjectViewBootstrap() {
  const mount = document.querySelector<HTMLElement>("[data-project-csr-mount]");
  if (!mount) return;

  const slug = new URLSearchParams(window.location.search).get("project")?.trim() ?? "";
  if (!slug) {
    if (mount.querySelector("[data-project-view=\"missing-project-param\"]")) return;
    queueProjectViewBootstrapOnce();
    return;
  }

  const renderedSlug = renderedProjectSlugInMount(mount);
  if (renderedSlug === slug) return;

  queueProjectViewBootstrapOnce();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleProjectViewBootstrap);
} else {
  scheduleProjectViewBootstrap();
}

document.addEventListener("astro:page-load", scheduleProjectViewBootstrap);
document.addEventListener("astro:after-swap", scheduleProjectViewBootstrap);
