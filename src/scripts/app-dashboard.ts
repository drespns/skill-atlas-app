import { getSupabaseBrowserClient } from "./client-supabase";

function setTextAll(sel: string, value: string) {
  const els = document.querySelectorAll<HTMLElement>(sel);
  if (els.length === 0) return;
  els.forEach((el) => {
    el.textContent = value;
  });
}

function setList(sel: string, items: { href: string; label: string }[]) {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  el.innerHTML = items
    .map(
      (it) =>
        `<a class="block rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900/40 no-underline" href="${it.href}">${it.label}</a>`,
    )
    .join("");
}

async function hydrateDashboard() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  // Counts
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

  // Lists (limit for quick overview)
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void hydrateDashboard());
} else {
  void hydrateDashboard();
}

