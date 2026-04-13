import { esc } from "../study-text";
import type { SupabaseLike } from "./types";

type LinkedConceptRow = {
  id: string;
  title: string;
  technology_id: string;
  technologies: { name: string; slug: string } | null;
};

export async function renderLinkedConceptsPanel(
  sb: SupabaseLike,
  userId: string,
  techIds: string[],
  ttFn: (key: string, fallback: string) => string,
) {
  const root = document.querySelector<HTMLElement>("[data-study-linked-concepts]");
  const body = document.querySelector<HTMLElement>("[data-study-linked-concepts-body]");
  if (!root || !body) return;
  if (!sb || !userId) {
    root.classList.add("hidden");
    return;
  }
  root.classList.remove("hidden");
  if (techIds.length === 0) {
    body.innerHTML = `<p class="m-0 text-[11px] text-gray-600 dark:text-gray-400">${esc(
      ttFn("study.linkedConceptsNeedTech", "Enlaza al menos una tecnología arriba para ver aquí sus conceptos."),
    )}</p>`;
    return;
  }
  try {
    const { data, error } = await sb
      .from("concepts")
      .select("id, title, technology_id, technologies(name, slug)")
      .eq("user_id", userId)
      .in("technology_id", techIds)
      .order("title")
      .limit(150);
    if (error) throw error;
    const rows = (data ?? []) as LinkedConceptRow[];
    if (rows.length === 0) {
      body.innerHTML = `<p class="m-0 text-[11px] text-gray-600 dark:text-gray-400">${esc(
        ttFn(
          "study.linkedConceptsEmpty",
          "Aún no hay conceptos en esas tecnologías. Créalos o importa el catálogo sugerido desde Tecnologías.",
        ),
      )}</p>`;
      return;
    }
    const groups = new Map<string, { name: string; slug: string; items: { id: string; title: string }[] }>();
    for (const r of rows) {
      const t = r.technologies;
      const slug = String(t?.slug ?? "").trim();
      const name = String(t?.name ?? slug).trim() || slug;
      if (!slug) continue;
      const key = r.technology_id;
      if (!groups.has(key)) groups.set(key, { name, slug, items: [] });
      groups.get(key)!.items.push({ id: r.id, title: String(r.title ?? "").trim() || "—" });
    }
    const parts: string[] = [];
    for (const g of groups.values()) {
      const techUrl = `/technologies/view?tech=${encodeURIComponent(g.slug)}`;
      const lines = g.items
        .slice(0, 40)
        .map(
          (c) =>
            `<li class="leading-snug"><a class="text-indigo-700 dark:text-indigo-300 hover:underline" href="${esc(techUrl)}">${esc(c.title)}</a></li>`,
        )
        .join("");
      const more =
        g.items.length > 40
          ? `<p class="m-0 mt-1 text-[10px] text-gray-500">${esc(ttFn("study.linkedConceptsTruncated", "Mostrando 40 de muchos; abre la tecnología para ver todos."))}</p>`
          : "";
      parts.push(`<div class="rounded-lg border border-indigo-200/40 dark:border-indigo-900/40 bg-white/50 dark:bg-gray-950/40 px-2 py-2">
        <p class="m-0 mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(g.name)}</p>
        <ul class="m-0 pl-4 space-y-0.5 list-disc">${lines}</ul>
        ${more}
        <p class="m-0 mt-1.5"><a class="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 hover:underline" href="${esc(techUrl)}">${esc(
          ttFn("study.linkedConceptsOpenTech", "Abrir tecnología en SkillAtlas →"),
        )}</a></p>
      </div>`);
    }
    body.innerHTML =
      parts.join("") ||
      `<p class="m-0 text-[11px] text-gray-600 dark:text-gray-400">${esc(ttFn("study.linkedConceptsEmpty", "Sin conceptos."))}</p>`;
  } catch {
    body.innerHTML = `<p class="m-0 text-[11px] text-amber-800 dark:text-amber-200">${esc(
      ttFn("study.linkedConceptsError", "No se pudieron cargar los conceptos (revisa sesión o esquema)."),
    )}</p>`;
  }
}
