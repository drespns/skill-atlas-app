import i18next from "i18next";
import { getSupabaseBrowserClient } from "./client-supabase";
import { getRecentActivity, type RecentActivityEntry } from "./recent-activity";

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

async function hydrateDashboard() {
  if (!document.querySelector("[data-dashboard-root]")) return;

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
