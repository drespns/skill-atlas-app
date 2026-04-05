export function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function progressBadgeClass(p: string) {
  if (p === "mastered") return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800";
  if (p === "practicado") return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800";
  return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800";
}

export function progressLabel(p: string) {
  if (p === "mastered") return "Dominado";
  if (p === "practicado") return "Practicado";
  return "Aprendido";
}

export type TechConceptRow = {
  id: string;
  title: string;
  notes: string | null;
  progress: string;
};

export function conceptRowHtml(concept: TechConceptRow) {
  return `<div class="flex items-start justify-between gap-4 border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-white dark:bg-gray-950">
        <div class="min-w-0"><p class="m-0 font-semibold">${esc(concept.title)}</p><p class="mt-1 text-sm text-gray-600 dark:text-gray-300">${esc(concept.notes ?? "")}</p></div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${progressBadgeClass(concept.progress)}">${progressLabel(concept.progress)}</span>
          <button type="button" data-concept-edit data-concept-id="${esc(concept.id)}" data-concept-title="${esc(concept.title)}" data-concept-notes="${esc(concept.notes ?? "")}" data-concept-progress="${esc(concept.progress)}" class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Editar</button>
          <button type="button" data-concept-delete data-concept-id="${esc(concept.id)}" data-concept-title="${esc(concept.title)}" class="inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-2 py-1 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40">Eliminar</button>
        </div>
      </div>`;
}

export function conceptsListHtml(techConcepts: TechConceptRow[]) {
  if (techConcepts.length === 0) {
    return `<div class="border border-gray-200 dark:border-gray-800 rounded-xl p-5 bg-gray-50 dark:bg-gray-900/40">
        <p class="m-0 font-semibold">Aún no tienes conceptos en esta tecnología.</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">Crea conceptos manualmente o usa la importación inferior.</p>
        <a href="/projects" class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 no-underline mt-3">Ver Proyectos</a>
      </div>`;
  }
  return techConcepts.map(conceptRowHtml).join("");
}

export function summaryText(techConcepts: TechConceptRow[], relatedProjectCount: number) {
  return `${techConcepts.length} conceptos · ${relatedProjectCount} proyectos`;
}

export function statCounts(techConcepts: TechConceptRow[]) {
  return {
    aprend: techConcepts.filter((c) => c.progress === "aprendido").length,
    pract: techConcepts.filter((c) => c.progress === "practicado").length,
    dom: techConcepts.filter((c) => c.progress === "mastered").length,
  };
}
