import { getHelpStackItem, HELP_STACK_ITEMS } from "../config/help-stack";
import { detectEvidenceUrl, embedIframeSrc, evidenceSiteIconUrl } from "../lib/evidence-url";
import { getSupabaseBrowserClient } from "./client-supabase";

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

type RpcProject = {
  slug: string;
  title: string;
  description: string;
  role: string;
  outcome: string;
  technologyNames: string[];
  primaryEmbed: { kind: string; title: string; url: string } | null;
};

type RpcPayload = {
  displayName?: string;
  bio?: string;
  helpStack?: unknown;
  projects?: RpcProject[];
};

function orderHelpKeys(keys: string[]): string[] {
  const order = new Map(HELP_STACK_ITEMS.map((i, idx) => [i.key, idx]));
  return [...keys].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

function renderHelpStack(keys: string[]) {
  const wrap = document.querySelector<HTMLElement>("[data-public-portfolio-help-wrap]");
  const mount = document.querySelector<HTMLElement>("[data-public-portfolio-help-stack]");
  if (!wrap || !mount) return;
  const uniq = Array.from(new Set(keys.filter(Boolean)));
  if (uniq.length === 0) {
    wrap.classList.add("hidden");
    mount.innerHTML = "";
    return;
  }
  wrap.classList.remove("hidden");
  mount.innerHTML = orderHelpKeys(uniq)
    .map((k) => {
      const item = getHelpStackItem(k);
      if (!item) return "";
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-gray-200/90 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 px-2.5 py-1 text-xs font-medium text-gray-800 dark:text-gray-200">
        <img src="${esc(item.icon)}" alt="" class="h-5 w-5 object-contain shrink-0" loading="lazy" />
        <span>${esc(item.label)}</span>
      </span>`;
    })
    .filter(Boolean)
    .join("");
}

function initialsFromName(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  const a = (p[0]?.[0] ?? "").toUpperCase();
  const b = (p.length > 1 ? p[p.length - 1]?.[0] : p[0]?.[1] ?? "").toUpperCase();
  return (a + b).slice(0, 2) || "·";
}

function renderProjectCard(project: RpcProject) {
  const techNames = [...(project.technologyNames ?? [])].sort((a, b) => a.localeCompare(b, "es"));
  const hasStory = Boolean((project.role ?? "").trim() || (project.outcome ?? "").trim());
  const primary = project.primaryEmbed?.url
    ? {
        kind: project.primaryEmbed.kind as "iframe" | "link",
        title: (project.primaryEmbed.title ?? "").trim() || detectEvidenceUrl(project.primaryEmbed.url).sourceLabel,
        url: project.primaryEmbed.url.trim(),
      }
    : null;

  const pills = techNames
    .map((name) => {
      const hue = techHue(name);
      return `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border whitespace-nowrap" style="border-color:hsl(${hue} 72% 52% / 0.35); background-color:hsl(${hue} 72% 52% / 0.10)">
        <span class="font-semibold text-gray-900 dark:text-gray-100">${esc(name)}</span>
      </span>`;
    })
    .join("");

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

  const embedHtml = (() => {
    if (!primary) {
      return `<div class="border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400">Sin evidencia destacada.</div>`;
    }
    const det = detectEvidenceUrl(primary.url);
    const fav = evidenceSiteIconUrl(primary.url);
    const chipIcon = fav
      ? `<img src="${esc(fav)}" alt="" width="18" height="18" class="rounded ring-1 ring-gray-200/80 dark:ring-gray-700" loading="lazy" decoding="async" onerror="this.remove()" />`
      : "";
    const chip = `<div class="flex flex-wrap items-center gap-2">
      ${chipIcon}
      <span class="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/50">${esc(det.sourceLabel)}</span>
      <span class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(primary.kind === "iframe" ? "iframe" : "enlace")}</span>
    </div>`;
    const body =
      primary.kind === "iframe"
        ? `<iframe class="w-full aspect-video rounded-lg border border-gray-200/80 dark:border-gray-800" src="${esc(embedIframeSrc(primary.url))}" title="${esc(primary.title)}" loading="lazy"></iframe>`
        : `<a class="inline-flex items-center justify-center rounded-lg border border-gray-200/80 dark:border-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 no-underline" href="${esc(primary.url)}" target="_blank" rel="noreferrer">Abrir evidencia</a>`;
    return `<div class="space-y-2">${chip}<h3 class="m-0 text-sm font-semibold">${esc(primary.title)}</h3>${body}</div>`;
  })();

  return `<article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
    <div>
      <h2 class="m-0 text-base font-semibold">${esc(project.title)}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">${esc(project.description ?? "")}</p>
      ${story}
    </div>
    <div class="flex flex-wrap gap-2">${pills}</div>
    ${embedHtml}
  </article>`;
}

async function run() {
  const root = document.querySelector<HTMLElement>("[data-public-portfolio-page]");
  const token = root?.dataset.publicPortfolioToken?.trim() ?? "";
  const mount = document.querySelector<HTMLElement>("[data-public-portfolio-mount]");
  const loadingEl = document.querySelector<HTMLElement>("[data-public-portfolio-loading]");
  const nameEl = document.querySelector<HTMLElement>("[data-public-portfolio-name]");
  const bioEl = document.querySelector<HTMLElement>("[data-public-portfolio-bio]");
  const avatarImg = document.querySelector<HTMLImageElement>("[data-public-portfolio-avatar]");
  const avatarFb = document.querySelector<HTMLElement>("[data-public-portfolio-avatar-fallback]");
  const filterForm = document.querySelector<HTMLElement>("[data-public-portfolio-filter]");
  const techSelect = document.querySelector<HTMLSelectElement>("[data-public-portfolio-tech-select]");

  if (!token || !mount) return;

  const stopLoading = (msg?: string) => {
    if (loadingEl) {
      if (msg !== undefined) loadingEl.textContent = msg;
      loadingEl.classList.add("hidden");
    }
  };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<div class="col-span-full border border-red-200 dark:border-red-900/50 rounded-xl p-5">
      <p class="m-0 text-sm text-red-600 dark:text-red-300">No hay cliente Supabase configurado.</p>
    </div>`;
    stopLoading();
    return;
  }

  const { data, error } = await supabase.rpc("skillatlas_portfolio_by_share_token", { p_token: token });

  if (error) {
    mount.innerHTML = `<div class="col-span-full border border-red-200 dark:border-red-900/50 rounded-xl p-5">
      <p class="m-0 text-sm text-red-600 dark:text-red-300">${esc(error.message)}</p>
    </div>`;
    stopLoading();
    return;
  }

  if (!data) {
    mount.innerHTML = `<div class="col-span-full border border-amber-200 dark:border-amber-900/40 rounded-xl p-5 bg-amber-50/50 dark:bg-amber-950/20">
      <p class="m-0 text-sm text-amber-900 dark:text-amber-100">Este portfolio no existe o no está publicado.</p>
    </div>`;
    stopLoading();
    if (nameEl) nameEl.textContent = "Portfolio";
    document.title = "Portfolio · SkillAtlas";
    return;
  }

  const payload = data as RpcPayload;
  const displayName = (payload.displayName ?? "").trim() || "Portfolio";
  const bio = (payload.bio ?? "").trim();

  if (nameEl) nameEl.textContent = displayName;
  if (bioEl) bioEl.textContent = bio;
  document.title = `${displayName} · SkillAtlas`;

  if (avatarFb) avatarFb.textContent = initialsFromName(displayName);
  if (avatarImg) {
    avatarImg.removeAttribute("src");
    avatarImg.classList.add("hidden");
    avatarFb?.classList.remove("hidden");
  }

  // Token RPC does not include helpStack; keep it hidden.
  renderHelpStack([]);

  const projects = Array.isArray(payload.projects) ? (payload.projects as RpcProject[]) : [];
  const techNamesAll = Array.from(new Set(projects.flatMap((p) => p.technologyNames ?? []))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const selected = new URLSearchParams(window.location.search).get("tech") ?? "all";

  if (techSelect && filterForm && techNamesAll.length > 0) {
    filterForm.classList.remove("hidden");
    filterForm.removeAttribute("aria-hidden");
    techSelect.innerHTML =
      `<option value="all"${selected === "all" || selected === "" ? " selected" : ""}>Todas</option>` +
      techNamesAll
        .map((name) => `<option value="${esc(name)}"${selected === name ? " selected" : ""}>${esc(name)}</option>`)
        .join("");
    if (techSelect.dataset.skillatlasPublicFilterBound !== "1") {
      techSelect.dataset.skillatlasPublicFilterBound = "1";
      techSelect.addEventListener("change", () => {
        const next = techSelect.value;
        const url = new URL(window.location.href);
        if (!next || next === "all") url.searchParams.delete("tech");
        else url.searchParams.set("tech", next);
        window.location.href = url.toString();
      });
    }
  }

  const filtered = selected && selected !== "all" ? projects.filter((p) => (p.technologyNames ?? []).includes(selected)) : projects;

  if (filtered.length === 0) {
    mount.innerHTML = `<div class="col-span-full border border-gray-200/80 dark:border-gray-800 rounded-xl p-5">
      <p class="m-0 text-sm text-gray-600 dark:text-gray-400">No hay proyectos que coincidan con el filtro.</p>
    </div>`;
    stopLoading();
    return;
  }

  mount.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
  mount.innerHTML = filtered.map((p) => renderProjectCard(p)).join("");
  stopLoading();
}

function boot() {
  void run();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:after-swap", boot);

