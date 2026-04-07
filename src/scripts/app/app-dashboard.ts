import i18next from "i18next";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getRecentActivity, type RecentActivityEntry } from "@scripts/app/recent-activity";
import { getTechnologyIconSrc } from "@config/icons";
import { getCatalogEntryForSlug } from "@scripts/technologies/technology-detail/concept-seeds";
import { mapGitHubLanguagesToTechSlugs } from "@scripts/core/github-repo-analyzer";

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function t(key: string, opts?: Record<string, string | number>) {
  return String(i18next.t(key, { ...(opts ?? {}) }));
}

function setTextAll(sel: string, value: string) {
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    el.textContent = value;
  });
}

function setList(sel: string, items: { href: string; label: string }[]) {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  el.innerHTML = items
    .map(
      (it) =>
        `<a class="block rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900/40 no-underline" href="${escHtml(it.href)}">${escHtml(it.label)}</a>`,
    )
    .join("");
}

function setHtml(sel: string, html: string) {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  el.innerHTML = html;
}

function formatVisited(at: number): string {
  const lng = i18next.language?.startsWith("en") ? "en" : "es";
  const diff = Date.now() - at;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("dashboard.recent.justNow");
  if (minutes < 60) return t("dashboard.recent.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("dashboard.recent.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 14) return t("dashboard.recent.daysAgo", { count: days });
  return new Date(at).toLocaleDateString(lng === "en" ? "en" : "es");
}

function hrefForRecent(e: RecentActivityEntry): string {
  if (e.kind === "project") return `/projects/view?project=${encodeURIComponent(e.slug)}`;
  return `/technologies/view?tech=${encodeURIComponent(e.slug)}`;
}

function renderRecentList(mountSel: string, entries: RecentActivityEntry[], emptyKey: string) {
  const el = document.querySelector<HTMLElement>(mountSel);
  if (!el) return;
  if (entries.length === 0) {
    el.innerHTML = `<p class="m-0 text-sm text-gray-500 dark:text-gray-400">${escHtml(t(emptyKey))}</p>`;
    return;
  }
  el.innerHTML = entries
    .map((e) => {
      const href = escHtml(hrefForRecent(e));
      const label = escHtml(e.label);
      const when = escHtml(formatVisited(e.at));
      return `<a class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900/40 no-underline min-w-0" href="${href}"><span class="min-w-0 truncate">${label}</span><span class="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">${when}</span></a>`;
    })
    .join("");
}

function renderRecentSections() {
  renderRecentList("[data-dashboard-recent-projects]", getRecentActivity("project", 6), "dashboard.recent.emptyProjects");
  renderRecentList("[data-dashboard-recent-tech]", getRecentActivity("tech", 6), "dashboard.recent.emptyTech");
}

async function hydrateTechUsage(supabase: any, userId: string) {
  const mount = document.querySelector<HTMLElement>("[data-dashboard-tech-usage]");
  if (!mount) return;

  const fmtPct = (p: number) => {
    const n = Number.isFinite(p) ? p : 0;
    const s = (n * 100).toFixed(1).replace(/\.0$/, "");
    return `${s}%`;
  };

  const weightsBySlug = new Map<string, number>();
  let hasGithubWeights = false;
  const githubEntries: { projectSlug: string; repoUrl: string }[] = [];

  const scopeKey = "skillatlas_dashboard_github_scope_v1";
  let githubScope: "all" | string = "all";
  try {
    const saved = localStorage.getItem(scopeKey);
    if (saved && saved !== "all") githubScope = saved;
  } catch {
    // ignore
  }

  // Collect per-project GitHub weights from localStorage (best effort).
  // IMPORTANT: no depende de listar proyectos en Supabase (puede fallar por schema/RLS/columnas).
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("skillatlas_github_weights_v1:")) continue;
      const projectSlug = k.slice("skillatlas_github_weights_v1:".length).trim();
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as any;
      const repoUrl = String(parsed?.repoUrl ?? "").trim();

      // Si cambia el mapeo (p.ej. Astro), recalculamos a partir de `pctByLanguage` para no obligar a "reimportar".
      try {
        const pctByLanguage = parsed?.pctByLanguage;
        if (pctByLanguage && typeof pctByLanguage === "object") {
          const recomputed = mapGitHubLanguagesToTechSlugs(pctByLanguage as Record<string, number>);
          const prev = parsed?.techWeights;
          const prevStr = prev && typeof prev === "object" ? JSON.stringify(prev) : "";
          const nextStr = JSON.stringify(recomputed);
          if (nextStr && nextStr !== prevStr) {
            parsed.techWeights = recomputed;
            localStorage.setItem(k, JSON.stringify(parsed));
          }
        }
      } catch {
        // ignore
      }

      const techWeights = parsed?.techWeights ?? null;
      if (!techWeights || typeof techWeights !== "object") continue;

      hasGithubWeights = true;
      if (projectSlug) githubEntries.push({ projectSlug, repoUrl });
      if (githubScope !== "all" && projectSlug !== githubScope) continue;
      for (const [techSlug, pct] of Object.entries(techWeights)) {
        const n = typeof pct === "number" ? pct : Number(pct);
        if (!Number.isFinite(n) || n <= 0) continue;
        weightsBySlug.set(String(techSlug), (weightsBySlug.get(String(techSlug)) ?? 0) + n);
      }
    }
  } catch {
    // ignore
  }

  // Count per technology = number of distinct projects that include it.
  const res = await supabase
    .from("project_technologies")
    .select("technology_id, technologies!inner(slug,name), projects!inner(user_id)")
    .eq("projects.user_id", userId);

  if (res.error) {
    mount.innerHTML = `<p class="m-0 text-sm text-red-600">${escHtml(res.error.message)}</p>`;
    return;
  }

  const bySlug = new Map<string, { slug: string; name: string; count: number }>();
  for (const row of (res.data ?? []) as any[]) {
    const tech = row?.technologies;
    const slug = String(tech?.slug ?? "").trim();
    const name = String(tech?.name ?? slug).trim() || slug;
    if (!slug) continue;
    const prev = bySlug.get(slug);
    bySlug.set(slug, { slug, name, count: (prev?.count ?? 0) + 1 });
  }

  const top = [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")).slice(0, 12);
  if (top.length === 0) {
    mount.innerHTML = `<p class="m-0 text-sm text-gray-600 dark:text-gray-400">Aún no hay tecnologías asociadas a proyectos.</p>`;
    return;
  }

  const modeKey = "skillatlas_dashboard_stack_mode_v1";
  let mode: "projects" | "github" = "projects";
  try {
    const saved = localStorage.getItem(modeKey);
    if (saved === "github" && hasGithubWeights) mode = "github";
  } catch {
    // ignore
  }

  const header = `<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
    <div class="flex flex-wrap gap-2 text-xs font-semibold">
      <button type="button" data-stack-mode="projects" class="rounded-full border px-3 py-1 ${mode === "projects" ? "bg-gray-100 dark:bg-gray-900" : "bg-white/70 dark:bg-gray-950/50"}">Por proyectos</button>
      ${
        hasGithubWeights
          ? `<button type="button" data-stack-mode="github" class="rounded-full border px-3 py-1 ${mode === "github" ? "bg-gray-100 dark:bg-gray-900" : "bg-white/70 dark:bg-gray-950/50"}">Por GitHub (lenguajes)</button>`
          : ""
      }
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2">
      ${
        hasGithubWeights
          ? `<label class="inline-flex items-center gap-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
              GitHub
              <select data-github-scope class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/70 px-2 py-1 text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                <option value="all"${githubScope === "all" ? " selected" : ""}>Todos los proyectos</option>
                ${[...new Map(githubEntries.map((e) => [e.projectSlug, e])).values()]
                  .sort((a, b) => a.projectSlug.localeCompare(b.projectSlug, "es"))
                  .map((e) => `<option value="${escHtml(e.projectSlug)}"${githubScope === e.projectSlug ? " selected" : ""}>${escHtml(e.projectSlug)}</option>`)
                  .join("")}
              </select>
            </label>`
          : ""
      }
      <p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">${hasGithubWeights ? "Pondera por % de lenguajes del repo." : "Tip: importa stack desde GitHub en proyectos para activar ponderación."}</p>
    </div>
  </div>`;

  const rowsSource =
    mode === "github" && hasGithubWeights
      ? [...bySlug.values()]
          .map((t) => ({ ...t, weight: weightsBySlug.get(t.slug) ?? 0 }))
          .filter((t) => t.weight > 0)
          .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, "es"))
          .slice(0, 12)
      : top.map((t) => ({ ...t, weight: 0 }));

  const max = mode === "github" && hasGithubWeights ? Math.max(...rowsSource.map((t) => t.weight)) : Math.max(...rowsSource.map((t) => t.count));

  const body = rowsSource
    .map((t) => {
      const entry = getCatalogEntryForSlug(t.slug);
      const kind = entry?.kind ?? "technology";
      const kindLabel =
        kind === "framework" ? "Framework" : kind === "library" ? "Librería" : kind === "package" ? "Paquete" : "Tecnología";
      const kindTone =
        kind === "framework"
          ? "bg-violet-100/80 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200"
          : kind === "library"
            ? "bg-sky-100/80 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200"
            : kind === "package"
              ? "bg-amber-100/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
              : "bg-gray-100/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200";
      const iconSrc = getTechnologyIconSrc({ id: t.slug, name: t.name });
      const val = mode === "github" && hasGithubWeights ? t.weight : t.count;
      const pct = max > 0 ? Math.round((val / max) * 100) : 0;
      const right = mode === "github" && hasGithubWeights ? fmtPct(val) : String(t.count);
      return `<a href="/technologies/view?tech=${encodeURIComponent(t.slug)}" class="block rounded-xl border border-gray-200/70 dark:border-gray-800/80 bg-white/60 dark:bg-gray-950/40 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/40 no-underline">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 min-w-0">
              ${iconSrc ? `<img src="${escHtml(iconSrc)}" alt="" class="h-5 w-5 shrink-0" loading="lazy" />` : ""}
              <span class="font-semibold text-gray-900 dark:text-gray-100 truncate">${escHtml(t.name)}</span>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindTone}">${kindLabel}</span>
            </div>
            <div class="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
              <div class="h-2 rounded-full bg-indigo-500/80" style="width:${pct}%;"></div>
            </div>
          </div>
          <span class="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">${right}</span>
        </div>
      </a>`;
    })
    .join("");

  mount.innerHTML = header + body;

  mount.querySelectorAll<HTMLButtonElement>("[data-stack-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-stack-mode");
      if (v !== "projects" && v !== "github") return;
      try {
        localStorage.setItem(modeKey, v);
      } catch {
        // ignore
      }
      void hydrateTechUsage(supabase, userId);
    });
  });

  mount.querySelector<HTMLSelectElement>("[data-github-scope]")?.addEventListener("change", (ev) => {
    const sel = ev.currentTarget as HTMLSelectElement;
    const v = (sel.value ?? "all").trim() || "all";
    try {
      localStorage.setItem(scopeKey, v);
    } catch {
      // ignore
    }
    void hydrateTechUsage(supabase, userId);
  });
}

function forceNavigateFromDynamicLists() {
  const handler = (ev: MouseEvent) => {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const t = ev.target as HTMLElement | null;
    const a = t?.closest?.("a") as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/projects/") && !href.startsWith("/technologies/")) return;
    ev.preventDefault();
    window.location.href = href;
  };
  document.querySelector("[data-dashboard-projects-list]")?.addEventListener("click", handler);
  document.querySelector("[data-dashboard-technologies-list]")?.addEventListener("click", handler);
}

async function hydrateDashboard() {
  if (!document.querySelector("[data-dashboard-root]")) return;

  forceNavigateFromDynamicLists();
  renderRecentSections();

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const hint = `<p class="m-0 text-sm text-gray-600 dark:text-gray-400">${escHtml(t("dashboard.mockHydrateHint"))}</p>`;
    setHtml("[data-dashboard-projects-list]", hint);
    setHtml("[data-dashboard-technologies-list]", hint);
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    const hint = `<p class="m-0 text-sm text-gray-600 dark:text-gray-400">${escHtml(t("dashboard.signedOutListHint"))}</p>`;
    setHtml("[data-dashboard-projects-list]", hint);
    setHtml("[data-dashboard-technologies-list]", hint);
    return;
  }

  await hydrateTechUsage(supabase, user.id);

  const [conceptsCountRes, projectsCountRes, techCountRes] = await Promise.all([
    supabase.from("concepts").select("slug", { count: "exact", head: true }),
    supabase.from("projects").select("slug", { count: "exact", head: true }),
    supabase.from("technologies").select("slug", { count: "exact", head: true }),
  ]);

  const conceptsCount = conceptsCountRes.count ?? null;
  const projectsCount = projectsCountRes.count ?? null;
  const techCount = techCountRes.count ?? null;

  if (conceptsCount !== null) setTextAll("[data-dashboard-count-concepts]", String(conceptsCount));
  if (projectsCount !== null) setTextAll("[data-dashboard-count-projects]", String(projectsCount));
  if (techCount !== null) setTextAll("[data-dashboard-count-technologies]", String(techCount));

  const [projectsRes, techRes] = await Promise.all([
    supabase.from("projects").select("slug,title").order("title").limit(8),
    supabase.from("technologies").select("slug,name").order("name").limit(8),
  ]);

  const projects =
    (projectsRes.data ?? [])
      .filter((p: any) => typeof p?.slug === "string" && typeof p?.title === "string")
      .map((p: any) => ({ href: `/projects/view?project=${encodeURIComponent(p.slug)}`, label: p.title })) ?? [];
  const technologies =
    (techRes.data ?? [])
      .filter((t: any) => typeof t?.slug === "string" && typeof t?.name === "string")
      .map((t: any) => ({ href: `/technologies/view?tech=${encodeURIComponent(t.slug)}`, label: t.name })) ?? [];

  setList("[data-dashboard-projects-list]", projects);
  setList("[data-dashboard-technologies-list]", technologies);

  renderRecentSections();
}

function scheduleAppDashboard() {
  void hydrateDashboard();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleAppDashboard);
} else {
  scheduleAppDashboard();
}

document.addEventListener("astro:page-load", scheduleAppDashboard);
document.addEventListener("astro:after-swap", scheduleAppDashboard);

window.addEventListener("skillatlas:auth-nav-updated", scheduleAppDashboard);
