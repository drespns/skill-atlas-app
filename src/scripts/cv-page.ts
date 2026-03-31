import i18next from "i18next";
import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import { loadPrefs, updatePrefs } from "./prefs";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

if (!(globalThis as unknown as { __skillatlasCvPrintCleanup?: boolean }).__skillatlasCvPrintCleanup) {
  (globalThis as unknown as { __skillatlasCvPrintCleanup?: boolean }).__skillatlasCvPrintCleanup = true;
  document.addEventListener("astro:after-swap", () => {
    queueMicrotask(() => {
      if (!document.querySelector("[data-cv-mount]")) document.body.classList.remove("cv-print-mode");
    });
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ProjectRow = {
  slug: string;
  title: string;
  description: string | null;
  role: string | null;
  outcome: string | null;
};

async function boot() {
  const mount = document.querySelector("[data-cv-mount]");
  if (!mount) {
    document.body.classList.remove("cv-print-mode");
    return;
  }

  document.body.classList.add("cv-print-mode");

  if (mount.dataset.bound === "1") return;
  mount.dataset.bound = "1";

  const loadingEl = document.querySelector<HTMLElement>("[data-cv-loading]");
  const errEl = document.querySelector<HTMLElement>("[data-cv-error]");
  const editorEl = document.querySelector<HTMLElement>("[data-cv-editor]");
  const listEl = document.querySelector<HTMLElement>("[data-cv-project-list]");
  const docEl = document.querySelector<HTMLElement>("[data-cv-document]");
  const docName = document.querySelector<HTMLElement>("[data-cv-doc-name]");
  const docBio = document.querySelector<HTMLElement>("[data-cv-doc-bio]");
  const docProjects = document.querySelector<HTMLElement>("[data-cv-doc-projects]");
  const printBtn = document.querySelector<HTMLButtonElement>("[data-cv-print]");
  const selAll = document.querySelector<HTMLButtonElement>("[data-cv-select-all]");
  const selNone = document.querySelector<HTMLButtonElement>("[data-cv-select-none]");

  if (!loadingEl || !listEl || !docEl || !docName || !docBio || !docProjects) return;

  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;
  if (!supabase || !userId) {
    loadingEl.classList.add("hidden");
    if (errEl) {
      errEl.textContent = tt("cv.needSession", "Inicia sesión para ver tu CV.");
      errEl.classList.remove("hidden");
    }
    return;
  }

  loadingEl.textContent = tt("cv.loading", "Cargando…");

  const [projRes, profileRes, ptRes, techRes] = await Promise.all([
    supabase
      .from("projects")
      .select("slug, title, description, role, outcome")
      .eq("user_id", userId)
      .order("title"),
    supabase.from("portfolio_profiles").select("display_name, bio").eq("user_id", userId).maybeSingle(),
    supabase.from("project_technologies").select("project_id, technology_id"),
    supabase.from("technologies").select("id, name").eq("user_id", userId),
  ]);

  loadingEl.classList.add("hidden");

  if (projRes.error) {
    if (errEl) {
      errEl.textContent = projRes.error.message ?? tt("cv.loadError", "No se pudieron cargar los proyectos.");
      errEl.classList.remove("hidden");
    }
    return;
  }

  const projects = (projRes.data ?? []) as ProjectRow[];
  const displayName = (profileRes.data?.display_name ?? "").trim() || tt("cv.defaultName", "Sin nombre");
  const bio = (profileRes.data?.bio ?? "").trim();

  const techName = new Map<string, string>();
  for (const t of techRes.data ?? []) {
    if (t?.id && typeof t.name === "string") techName.set(t.id, t.name);
  }

  const techsByProject = new Map<string, string[]>();
  const projectIdBySlug = new Map<string, string>();
  const idRes = await supabase.from("projects").select("id, slug").eq("user_id", userId);
  if (!idRes.error && idRes.data) {
    for (const row of idRes.data) {
      if (row.slug && row.id) projectIdBySlug.set(row.slug, row.id);
    }
  }

  for (const r of ptRes.data ?? []) {
    const pid = r.project_id as string | undefined;
    const tid = r.technology_id as string | undefined;
    if (!pid || !tid) continue;
    const name = techName.get(tid);
    if (!name) continue;
    const list = techsByProject.get(pid) ?? [];
    list.push(name);
    techsByProject.set(pid, list);
  }

  let prefs = loadPrefs();
  let selectedSlugs = new Set<string>();

  const applySelectionFromPrefs = () => {
    const raw = prefs.cvProjectSlugs;
    selectedSlugs.clear();
    if (raw === undefined) {
      for (const p of projects) selectedSlugs.add(p.slug);
    } else {
      for (const s of raw) {
        if (projects.some((p) => p.slug === s)) selectedSlugs.add(s);
      }
    }
  };

  applySelectionFromPrefs();

  const persistSelection = () => {
    if (selectedSlugs.size === projects.length) {
      prefs = updatePrefs({ cvProjectSlugs: undefined });
      return;
    }
    const order = projects.filter((p) => selectedSlugs.has(p.slug)).map((p) => p.slug);
    prefs = updatePrefs({ cvProjectSlugs: order });
  };

  const renderDocument = () => {
    docName.textContent = displayName;
    docBio.textContent = bio || tt("cv.noBio", "");
    docBio.classList.toggle("hidden", !bio);

    const chosen = projects.filter((p) => selectedSlugs.has(p.slug));
    if (chosen.length === 0) {
      docProjects.innerHTML = `<p class="m-0 text-sm text-gray-500 dark:text-gray-400">${esc(tt("cv.noProjectsSelected", "No hay proyectos seleccionados."))}</p>`;
    } else {
      docProjects.innerHTML = chosen
        .map((p) => {
          const pid = projectIdBySlug.get(p.slug);
          const techLabels = pid ? (techsByProject.get(pid) ?? []).sort((a, b) => a.localeCompare(b, "es")) : [];
          const techHtml =
            techLabels.length > 0
              ? `<p class="m-0 mt-2 flex flex-wrap gap-1.5">${techLabels
                  .map(
                    (n) =>
                      `<span class="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">${esc(n)}</span>`,
                  )
                  .join("")}</p>`
              : "";
          const role = (p.role ?? "").trim();
          const outcome = (p.outcome ?? "").trim();
          const meta =
            role || outcome
              ? `<p class="m-0 mt-2 text-sm text-gray-600 dark:text-gray-400"><span class="font-semibold text-gray-800 dark:text-gray-200">${esc(role || "—")}</span>${role && outcome ? " · " : ""}${esc(outcome)}</p>`
              : "";
          return `<section class="cv-doc-project">
            <h4 class="m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">${esc(p.title)}</h4>
            ${meta}
            ${(p.description ?? "").trim() ? `<p class="m-0 mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">${esc((p.description ?? "").trim())}</p>` : ""}
            ${techHtml}
          </section>`;
        })
        .join("");
    }
    docEl.classList.remove("hidden");
  };

  const renderList = () => {
    listEl.innerHTML = projects
      .map((p) => {
        const on = selectedSlugs.has(p.slug);
        return `<li class="flex items-start gap-3 rounded-lg border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 px-3 py-2">
          <input type="checkbox" class="mt-1 rounded border-gray-300 dark:border-gray-600" data-cv-pick="${esc(p.slug)}" ${on ? "checked" : ""} />
          <div class="min-w-0 flex-1">
            <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">${esc(p.title)}</p>
            <p class="m-0 text-xs text-gray-500 dark:text-gray-400">/${esc(p.slug)}</p>
          </div>
        </li>`;
      })
      .join("");

    listEl.querySelectorAll<HTMLInputElement>("input[data-cv-pick]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const slug = inp.dataset.cvPick ?? "";
        if (!slug) return;
        if (inp.checked) selectedSlugs.add(slug);
        else selectedSlugs.delete(slug);
        persistSelection();
        renderDocument();
      });
    });
    editorEl?.classList.remove("hidden");
  };

  renderList();
  renderDocument();

  selAll?.addEventListener("click", () => {
    for (const p of projects) selectedSlugs.add(p.slug);
    persistSelection();
    renderList();
    renderDocument();
  });
  selNone?.addEventListener("click", () => {
    selectedSlugs.clear();
    persistSelection();
    renderList();
    renderDocument();
  });

  printBtn?.addEventListener("click", () => window.print());
}

const start = () => void boot();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
document.addEventListener("astro:page-load", start as any);
