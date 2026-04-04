import { getTechnologyIconSrc } from "../config/icons";
import {
  detectEvidenceUrl,
  embedIframeSrc,
  evidenceSiteIconUrl,
  IFRAME_EMBED_ALLOW,
} from "../lib/evidence-url";
import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function techHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

type DbProject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  role: string | null;
  outcome: string | null;
};

type DbTech = { id: string; slug: string; name: string };
type DbEmbed = { id: string; project_id: string; kind: "iframe" | "link"; title: string | null; url: string | null; sort_order: number };

function renderCard(options: {
  project: DbProject;
  techNames: string[];
  primaryEmbed: { kind: "iframe" | "link"; title: string; url: string } | null;
  embedCount: number;
}) {
  const { project, techNames, primaryEmbed, embedCount } = options;
  const hasStory = Boolean((project.role ?? "").trim() || (project.outcome ?? "").trim());

  const pills = techNames
    .map((name) => {
      const hue = techHue(name);
      const iconSrc = getTechnologyIconSrc({ id: name.toLowerCase(), name });
      const icon = iconSrc
        ? `<img src="${esc(iconSrc)}" alt="" class="h-4 w-4 object-contain" loading="lazy" decoding="async" />`
        : "";
      return `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border whitespace-nowrap" style="border-color:hsl(${hue} 72% 52% / 0.35); background-color:hsl(${hue} 72% 52% / 0.10)">
        ${icon}
        <span class="font-semibold text-gray-900 dark:text-gray-100">${esc(name)}</span>
      </span>`;
    })
    .join("");

  const embedHtml = (() => {
    if (!primaryEmbed) {
      return `<div class="border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400">
        Aún no hay evidencias. Añade una en el detalle del proyecto.
      </div>`;
    }
    const det = detectEvidenceUrl(primaryEmbed.url);
    const fav = evidenceSiteIconUrl(primaryEmbed.url);
    const chipIcon = fav
      ? `<img src="${esc(fav)}" alt="" width="18" height="18" class="rounded ring-1 ring-gray-200/80 dark:ring-gray-700" loading="lazy" decoding="async" onerror="this.remove()" />`
      : "";
    const chip = `<div class="flex flex-wrap items-center gap-2">
      ${chipIcon}
      <span class="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/50">${esc(det.sourceLabel)}</span>
      <span class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(primaryEmbed.kind === "iframe" ? "iframe" : "enlace")}</span>
      <span class="text-[10px] text-gray-500 dark:text-gray-400">Evidencias: ${embedCount}</span>
    </div>`;

    const body =
      primaryEmbed.kind === "iframe"
        ? `<iframe class="w-full aspect-video rounded-lg border border-gray-200/80 dark:border-gray-800" src="${esc(embedIframeSrc(primaryEmbed.url))}" title="${esc(primaryEmbed.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="${esc(IFRAME_EMBED_ALLOW)}" allowfullscreen></iframe>`
        : `<a class="inline-flex items-center justify-center rounded-lg border border-gray-200/80 dark:border-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 no-underline" href="${esc(primaryEmbed.url)}" target="_blank" rel="noreferrer">Abrir evidencia</a>`;

    return `<div class="space-y-2">${chip}<h3 class="m-0 text-sm font-semibold">${esc(primaryEmbed.title)}</h3>${body}</div>`;
  })();

  const story = hasStory
    ? `<dl class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt class="font-semibold text-gray-800 dark:text-gray-200">Rol</dt>
          <dd class="m-0 mt-1 text-gray-600 dark:text-gray-400">${esc((project.role ?? "").trim() || "—")}</dd>
        </div>
        <div>
          <dt class="font-semibold text-gray-800 dark:text-gray-200">Resultado / impacto</dt>
          <dd class="m-0 mt-1 text-gray-600 dark:text-gray-400 line-clamp-2">${esc((project.outcome ?? "").trim() || "—")}</dd>
        </div>
      </dl>`
    : "";

  return `<article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
    <div>
      <h2 class="m-0 text-base font-semibold">${esc(project.title)}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">${esc(project.description ?? "")}</p>
      ${story}
    </div>
    <div class="flex flex-wrap gap-2">${pills}</div>
    ${embedHtml}
    <div class="flex items-center justify-end">
      <a href="/projects/view?project=${encodeURIComponent(project.slug)}" class="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 no-underline">Ver detalle</a>
    </div>
  </article>`;
}

async function run() {
  const mount = document.querySelector<HTMLElement>("[data-portfolio-projects-csr-mount]");
  const techSelect = document.querySelector<HTMLSelectElement>("[data-portfolio-tech-select]");
  const loadingEl = document.querySelector<HTMLElement>("[data-portfolio-loading]");
  if (!mount) return;

  const stopLoading = () => {
    if (!loadingEl) return;
    loadingEl.textContent = "";
    loadingEl.classList.add("hidden");
  };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<div class="col-span-full border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 bg-white/60 dark:bg-gray-950/40">
      <p class="m-0 text-sm text-red-600">No hay cliente Supabase.</p>
    </div>`;
    stopLoading();
    return;
  }

  const userId = await getSessionUserId(supabase);
  if (!userId) {
    mount.innerHTML = `<div class="col-span-full border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 bg-white/60 dark:bg-gray-950/40">
      <p class="m-0 text-sm text-amber-700 dark:text-amber-300">Inicia sesión para ver tu portfolio.</p>
      <a href="/settings" class="inline-flex mt-3 rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a>
    </div>`;
    stopLoading();
    return;
  }

  const [projRes, ptRes, techRes, embRes] = await Promise.all([
    supabase.from("projects").select("id, slug, title, description, role, outcome").eq("user_id", userId).order("title"),
    supabase.from("project_technologies").select("project_id, technology_id"),
    supabase.from("technologies").select("id, slug, name").eq("user_id", userId).order("name"),
    supabase.from("project_embeds").select("id, project_id, kind, title, url, sort_order").order("sort_order", { ascending: true }),
  ]);

  if (projRes.error) {
    mount.innerHTML = `<div class="col-span-full border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 bg-white/60 dark:bg-gray-950/40">
      <p class="m-0 text-sm text-red-600">${esc(projRes.error.message)}</p>
    </div>`;
    stopLoading();
    return;
  }

  const projects = (projRes.data ?? []) as DbProject[];
  const techs = (techRes.data ?? []) as DbTech[];
  const techById = new Map(techs.map((t) => [t.id, t]));

  const techNamesByProject = new Map<string, string[]>();
  for (const row of ptRes.data ?? []) {
    const r = row as any as { project_id: string; technology_id: string };
    const t = techById.get(r.technology_id);
    if (!t) continue;
    const cur = techNamesByProject.get(r.project_id) ?? [];
    cur.push(t.name);
    techNamesByProject.set(r.project_id, cur);
  }

  const embeds = (embRes.data ?? []) as DbEmbed[];
  const embedsByProject = new Map<string, DbEmbed[]>();
  for (const e of embeds) {
    const cur = embedsByProject.get(e.project_id) ?? [];
    cur.push(e);
    embedsByProject.set(e.project_id, cur);
  }

  const techNamesAll = Array.from(new Set(techs.map((t) => t.name))).sort((a, b) => a.localeCompare(b, "es"));
  const selected = new URLSearchParams(window.location.search).get("tech") ?? "all";

  if (techSelect) {
    techSelect.innerHTML =
      `<option value="all"${selected === "all" || selected === "" ? " selected" : ""}>Todas</option>` +
      techNamesAll
        .map((name) => `<option value="${esc(name)}"${selected === name ? " selected" : ""}>${esc(name)}</option>`)
        .join("");
    techSelect.disabled = false;
    techSelect.addEventListener("change", () => {
      const next = techSelect.value;
      const url = new URL(window.location.href);
      if (!next || next === "all") url.searchParams.delete("tech");
      else url.searchParams.set("tech", next);
      window.location.href = url.toString();
    });
    const form = document.querySelector<HTMLFormElement>("[data-portfolio-filter]");
    form?.querySelector<HTMLButtonElement>("[type=submit]")?.setAttribute("disabled", "true");
  }

  const filtered =
    selected && selected !== "all"
      ? projects.filter((p) => (techNamesByProject.get(p.id) ?? []).includes(selected))
      : projects;

  if (filtered.length === 0) {
    mount.innerHTML = `<div class="col-span-full border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 bg-white/60 dark:bg-gray-950/40">
      <p class="m-0 text-sm text-gray-600 dark:text-gray-400">Aún no hay proyectos para mostrar.</p>
      <a href="/projects?create=1" class="inline-flex mt-3 rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 no-underline">Crear proyecto</a>
    </div>`;
    stopLoading();
    return;
  }

  mount.innerHTML = filtered
    .map((p) => {
      const techNames = (techNamesByProject.get(p.id) ?? []).slice().sort((a, b) => a.localeCompare(b, "es"));
      const allEmb = embedsByProject.get(p.id) ?? [];
      const primary = allEmb[0]
        ? { kind: allEmb[0].kind, title: (allEmb[0].title ?? "").trim() || detectEvidenceUrl(allEmb[0].url ?? "").sourceLabel, url: (allEmb[0].url ?? "").trim() }
        : null;
      const safePrimary = primary && primary.url ? primary : null;
      return renderCard({ project: p, techNames, primaryEmbed: safePrimary, embedCount: allEmb.length });
    })
    .join("");

  stopLoading();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void run());
} else {
  void run();
}

