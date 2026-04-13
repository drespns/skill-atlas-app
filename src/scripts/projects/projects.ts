import { publicStorageObjectUrl } from "@lib/supabase-public-storage-url";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { showToast } from "@scripts/core/ui-feedback";
import i18next from "i18next";
import { loadPrefs } from "@scripts/core/prefs";

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

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function normalizeProjectTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function projectStatusLabel(raw: string | null | undefined): string {
  const s = String(raw ?? "in_progress").trim();
  if (s === "draft") return tt("projects.statusDraft", "Borrador");
  if (s === "portfolio_visible") return tt("projects.statusPortfolioVisible", "Visible en portfolio");
  if (s === "archived") return tt("projects.statusArchived", "Archivado");
  return tt("projects.statusInProgress", "En proceso");
}

function projectStatusBadgeHtml(status: string | null | undefined): string {
  return `<span class="inline-flex rounded-full border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-0.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-100">${escHtml(projectStatusLabel(status))}</span>`;
}

function projectDateRangeHtml(ds: string | null | undefined, de: string | null | undefined): string {
  const a = ds ? String(ds).slice(0, 10) : "";
  const b = de ? String(de).slice(0, 10) : "";
  if (!a && !b) return "";
  const arrow = tt("projects.metaDateArrow", "→");
  return `<span class="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">${escHtml(`${a || "…"} ${arrow} ${b || "…"}`)}</span>`;
}

function projectCustomTagsHtml(tags: string[]): string {
  if (tags.length === 0) return "";
  return tags
    .map(
      (t) =>
        `<span class="inline-flex rounded-full border border-violet-200/85 dark:border-violet-800/55 bg-violet-50/75 dark:bg-violet-950/40 px-2 py-0.5 text-[11px] font-medium text-violet-900 dark:text-violet-100">${escHtml(t)}</span>`,
    )
    .join("");
}

/** URL pública del bucket `project_covers` (misma lógica que portfolio / detalle). */
function projectCoverPublicUrl(path: string | null | undefined): string {
  const p = (path ?? "").trim();
  if (!p) return "";
  return publicStorageObjectUrl("project_covers", p);
}

/** `url('…')` en atributo HTML (comillas simples escapadas). */
function cssUrlInStyleAttr(u: string): string {
  return u.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function initProjectForm() {
  const form = document.querySelector<HTMLFormElement>("[data-project-form]");
  if (!form || form.dataset.skillatlasBound === "1") return;
  form.dataset.skillatlasBound = "1";

  const titleInput = form.querySelector<HTMLInputElement>("[name='title']");
  const descInput = form.querySelector<HTMLTextAreaElement>("[name='description']");
  const roleInput = form.querySelector<HTMLInputElement>("[name='role']");
  const outcomeInput = form.querySelector<HTMLInputElement>("[name='outcome']");
  const statusSelect = form.querySelector<HTMLSelectElement>("[name='status']");
  const tagsInput = form.querySelector<HTMLInputElement>("[name='tags']");
  const dateStartInput = form.querySelector<HTMLInputElement>("[name='date_start']");
  const dateEndInput = form.querySelector<HTMLInputElement>("[name='date_end']");
  const feedback = form.querySelector<HTMLElement>("[data-project-feedback]");
  const submitButtons = Array.from(form.querySelectorAll<HTMLButtonElement>("button[type='submit']"));
  if (!titleInput || !descInput || !feedback || submitButtons.length === 0) return;

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
    submitButtons.forEach((b) => {
      b.disabled = true;
    });
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
    const sub = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const openAfterSave = sub?.dataset?.projectSaveOpen === "1";

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const role = (roleInput?.value ?? "").trim();
    const outcome = (outcomeInput?.value ?? "").trim();
    const rawStatus = (statusSelect?.value ?? "in_progress").trim();
    const status =
      rawStatus === "draft" ||
      rawStatus === "in_progress" ||
      rawStatus === "portfolio_visible" ||
      rawStatus === "archived"
        ? rawStatus
        : "in_progress";
    const tags = (tagsInput?.value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const dateStart = (dateStartInput?.value ?? "").trim() || null;
    const dateEnd = (dateEndInput?.value ?? "").trim() || null;
    if (!title) return;

    if (dateStart && dateEnd && dateEnd < dateStart) {
      const msg = String(
        i18next.t("projects.editDateOrderError", {
          defaultValue: "La fecha de fin debe ser posterior o igual al inicio.",
        }),
      );
      feedback.textContent = msg;
      feedback.className = "text-sm text-amber-600";
      showToast(msg, "warning");
      return;
    }

    submitButtons.forEach((b) => {
      b.disabled = true;
    });
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
      submitButtons.forEach((b) => {
        b.disabled = false;
      });
      return;
    }
    if (duplicate.data) {
      feedback.textContent = "Ya existe un proyecto con ese título/slug.";
      feedback.className = "text-sm text-amber-600";
      submitButtons.forEach((b) => {
        b.disabled = false;
      });
      return;
    }

    const insertRes = await supabase.from("projects").insert([
      {
        slug,
        title,
        description,
        role,
        outcome,
        user_id: userId,
        status,
        tags,
        date_start: dateStart,
        date_end: dateEnd,
      },
    ] as any);
    if (insertRes.error) {
      feedback.textContent = `Error al guardar: ${insertRes.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitButtons.forEach((b) => {
        b.disabled = false;
      });
      return;
    }

    showToast("Proyecto creado correctamente.", "success");
    if (openAfterSave) {
      if (window.skillatlas?.clearProjectsCache) window.skillatlas.clearProjectsCache();
      window.location.assign(`/projects/view?project=${encodeURIComponent(slug)}`);
      return;
    }

    feedback.textContent = "Proyecto creado correctamente.";
    feedback.className = "text-sm text-green-600";
    titleInput.value = "";
    descInput.value = "";
    if (roleInput) roleInput.value = "";
    if (outcomeInput) outcomeInput.value = "";
    if (statusSelect) statusSelect.value = "in_progress";
    if (tagsInput) tagsInput.value = "";
    if (dateStartInput) dateStartInput.value = "";
    if (dateEndInput) dateEndInput.value = "";
    submitButtons.forEach((b) => {
      b.disabled = false;
    });
    if (window.skillatlas?.clearProjectsCache) window.skillatlas.clearProjectsCache();
    if (window.skillatlas?.bootstrapProjectsList) {
      await window.skillatlas.bootstrapProjectsList();
    } else {
      window.location.reload();
    }
  });
}

async function bootstrapProjectsList(opts?: { bypassCache?: boolean }) {
  const mount = document.querySelector<HTMLElement>("[data-projects-csr-mount]");
  if (!mount) return;

  const countEl = document.querySelector<HTMLElement>("[data-projects-count]");

  const cacheKey = (userId: string) => `skillatlas_cache_projects_list_v3:${userId}`;
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
      <a href="/settings#prefs" class="inline-flex mt-3 rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a>
    </div>`;
    if (countEl) countEl.textContent = "0 proyectos";
    return;
  }

  const prefs = loadPrefs();
  const view = prefs.projectsView;

  const cached = opts?.bypassCache ? null : readCache(userId);
  if (cached) {
    if (view === "list") {
      mount.className = "w-full space-y-2";
    } else {
      mount.className = "w-full grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[8rem]";
    }
    mount.innerHTML = cached.html;
    if (countEl) countEl.textContent = cached.countText;
    // Refresh in background once (avoid recursive cache loop).
    if (mount.dataset.projectsBgRefresh !== "1") {
      mount.dataset.projectsBgRefresh = "1";
      setTimeout(() => {
        void bootstrapProjectsList({ bypassCache: true });
        try {
          delete mount.dataset.projectsBgRefresh;
        } catch {
          // ignore
        }
      }, 0);
    }
    return;
  }

  const [projRes, ptRes, techRes, pcRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title, description, role, outcome, status, tags, date_start, date_end, cover_image_path")
      .order("title"),
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
    status?: string | null;
    tags?: unknown;
    date_start?: string | null;
    date_end?: string | null;
    cover_image_path?: string | null;
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
      <p class="m-0 font-semibold">${escHtml(tt("projects.emptyTitle", "You don't have any projects yet."))}</p>
      <p class="mt-2 text-sm text-gray-600">${escHtml(tt("projects.emptyBody", "Create your first project from here."))}</p>
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
              const customTags = normalizeProjectTags(project.tags);
              const nConcepts = conceptCountByProject.get(project.id) ?? 0;
              const href = `/projects/view?project=${encodeURIComponent(project.slug)}`;
              const techLabel = technologyNames.slice(0, 3).map(escHtml).join(" · ");
              const more = Math.max(0, technologyNames.length - 3);
              const techSummary = techLabel ? `${techLabel}${more ? ` · +${more}` : ""}` : "";
              const roleLine = (project.role ?? "").trim();
              const coverUrl = projectCoverPublicUrl(project.cover_image_path);
              const dateMeta = projectDateRangeHtml(project.date_start, project.date_end);
              const tagPills = projectCustomTagsHtml(customTags);
              const metaRow = `<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">${projectStatusBadgeHtml(project.status)}${dateMeta}</div>`;
              const tagsRow = tagPills
                ? `<div class="mt-1.5 flex flex-wrap gap-1.5">${tagPills}</div>`
                : "";
              const thumbBlock = coverUrl
                ? `<div class="project-list-row__thumb border border-gray-200/85 dark:border-gray-800/90 bg-white dark:bg-gray-950 relative"><img src="${escHtml(coverUrl)}" alt="" width="160" height="120" class="absolute inset-0 h-full w-full object-contain bg-white/95 dark:bg-gray-950/50" loading="lazy" decoding="async" /></div>`
                : `<div class="project-list-row__thumb project-list-row__thumb--accent border border-gray-200/80 dark:border-gray-800/80" aria-hidden="true"></div>`;
              return `<a href="${href}" class="flex no-underline items-stretch gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition-colors">
                ${thumbBlock}
                <div class="min-w-0 flex-1">
                    <p class="m-0 font-semibold text-gray-900 dark:text-gray-100 leading-snug">${escHtml(project.title)}</p>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">${escHtml(project.description ?? "")}</p>
                    ${metaRow}
                    ${
                      roleLine
                        ? `<p class="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 truncate">${escHtml(roleLine)}</p>`
                        : ""
                    }
                    ${tagsRow}
                    ${
                      techSummary
                        ? `<p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400 truncate" title="${escHtml(technologyNames.join(", "))}">${techSummary}</p>`
                        : ""
                    }
                  </div>
                <div class="shrink-0 text-right pt-0.5 self-start">
                    <span class="inline-flex text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">${nConcepts} conceptos</span>
                  </div>
              </a>`;
            })
            .join("")}
        </div>`
      : projects
          .map((project) => {
            const technologyNames = techSlugsByProject.get(project.id) ?? [];
            const customTags = normalizeProjectTags(project.tags);
            const pills = technologyNames
              .map(
                (name) =>
                  `<span class="text-xs px-2 py-1 rounded-full border border-gray-200/90 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 text-gray-900 dark:text-gray-100 whitespace-nowrap">${escHtml(name)}</span>`,
              )
              .join("");
            const nConcepts = conceptCountByProject.get(project.id) ?? 0;
            const href = `/projects/view?project=${encodeURIComponent(project.slug)}`;
            const roleLine = (project.role ?? "").trim();
            const coverUrl = projectCoverPublicUrl(project.cover_image_path);
            const dateMeta = projectDateRangeHtml(project.date_start, project.date_end);
            const tagPills = projectCustomTagsHtml(customTags);
            const metaRow = `<div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">${projectStatusBadgeHtml(project.status)}${dateMeta}</div>`;
            const tagsRow = tagPills
              ? `<div class="mt-2 flex flex-wrap gap-1.5"><span class="text-[10px] font-bold uppercase tracking-wider text-violet-600/90 dark:text-violet-400/90 self-center mr-0.5">${escHtml(tt("projects.listTagsKicker", "Etiquetas"))}</span>${tagPills}</div>`
              : "";
            const stackRow = pills
              ? `<div class="mt-2 space-y-1.5"><p class="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">${escHtml(tt("projects.listStackKicker", "Stack"))}</p><div class="flex flex-wrap gap-2">${pills}</div></div>`
              : "";
            const cardCoverMod = coverUrl ? "project-list-card--has-cover" : "project-list-card--accent-fallback";
            const coverBgStyle = coverUrl
              ? ` style="background-image:url('${cssUrlInStyleAttr(coverUrl)}')"`
              : "";
            return `<article class="project-list-card border border-gray-200/80 dark:border-gray-800 rounded-xl ${cardCoverMod} shadow-sm ring-1 ring-black/3 dark:ring-white/4">
              <div class="project-list-card__bg"${coverBgStyle} aria-hidden="true"></div>
              <div class="project-list-card__body p-4 sm:p-5">
              <div class="space-y-2 min-w-0">
                <h3 class="m-0 text-base font-semibold text-gray-900 dark:text-gray-50 leading-snug">${escHtml(project.title)}</h3>
                <p class="m-0 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">${escHtml(project.description ?? "")}</p>
                ${metaRow}
                ${
                  roleLine
                    ? `<p class="m-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">${escHtml(roleLine)}</p>`
                    : ""
                }
                ${tagsRow}
                ${stackRow}
              </div>
              <div class="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-gray-200/70 dark:border-gray-700/80">
                <span class="text-xs text-gray-500 dark:text-gray-400">${nConcepts} conceptos</span>
                <a class="btn-primary no-underline shrink-0" href="${href}">${escHtml(tt("projects.listOpenProject", "Ver proyecto"))}</a>
              </div>
              </div>
            </article>`;
          })
          .join("");
  mount.innerHTML = html;
  writeCache(userId, html, countText);
}

function forceNavigateFromProjectsList() {
  const mount = document.querySelector<HTMLElement>("[data-projects-csr-mount]");
  if (!mount) return;
  if (mount.dataset.forceNavBound === "1") return;
  mount.dataset.forceNavBound = "1";

  // View Transitions / router can occasionally "eat" these dynamic links.
  // Use capture to run before any bubbling preventDefault/stopPropagation.
  mount.addEventListener(
    "click",
    (ev) => {
      if (ev.defaultPrevented) return;
      if (ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const t = ev.target as HTMLElement | null;
      const a = t?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/projects/view")) return;
      ev.preventDefault();
      window.location.href = href;
    },
    { capture: true },
  );
}

window.skillatlas = window.skillatlas ?? {};
window.skillatlas.bootstrapProjectsList = async () => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const userId = await getSessionUserId(supabase);
  if (!userId) return;
  try {
    sessionStorage.removeItem(`skillatlas_cache_projects_list_v3:${userId}`);
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
      sessionStorage.removeItem(`skillatlas_cache_projects_list_v3:${userId}`);
    } catch {
      // ignore
    }
  })();
};

function bootProjectsPage() {
  forceNavigateFromProjectsList();
  void initProjectForm();
  void bootstrapProjectsList();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootProjectsPage);
} else {
  bootProjectsPage();
}

document.addEventListener("astro:page-load", bootProjectsPage);
document.addEventListener("astro:after-swap", bootProjectsPage);

