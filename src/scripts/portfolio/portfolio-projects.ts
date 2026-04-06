import { detectEvidenceUrl } from "@lib/evidence-url";
import {
  applyPortfolioPresentationToRoot,
  featuredSlugsFromRpc,
  normalizePublicAccentHex,
  normalizePublicDensity,
  normalizePublicHeaderStyle,
  normalizePublicTheme,
  sortProjectsByFeaturedSlugs,
} from "@lib/portfolio-presentation";
import {
  effectiveEmbedCap,
  effectivePublicLayout,
  GUEST_PREFS_PREVIEW_KEY,
  motionEnabledForGuest,
  normalizeOwnerEmbedLimit,
  normalizeOwnerLayout,
  patchPublicPortfolioGuestPrefs,
  publicPortfolioMountGridClass,
  readPublicPortfolioGuestPrefs,
  type PublicPortfolioGuestPrefs,
} from "@lib/public-portfolio-guest-prefs";
import { renderPortfolioVisitorCard } from "@lib/public-portfolio-project-card";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import i18next from "i18next";

function tt(key: string, fallback: string, opts?: Record<string, unknown>) {
  const v = i18next.t(key, (opts ?? {}) as any);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type DbProject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  role: string | null;
  outcome: string | null;
  cover_image_path?: string | null;
};

type DbTech = { id: string; slug: string; name: string };
type DbEmbed = {
  id: string;
  project_id: string;
  kind: "iframe" | "link";
  title: string | null;
  url: string | null;
  sort_order: number;
  show_in_public?: boolean | null;
  thumbnail_url?: string | null;
};

function readSelectedTechsFromUrl(): Set<string> {
  const params = new URLSearchParams(window.location.search);
  return new Set(
    params
      .getAll("tech")
      .map((t) => t.trim())
      .filter(Boolean),
  );
}

function updatePortfolioTechSummary(el: HTMLElement, selected: Set<string>) {
  if (selected.size === 0) {
    el.textContent = tt("portfolio.allTechnologies", "Todas");
  } else if (selected.size === 1) {
    el.textContent = [...selected][0];
  } else {
    el.textContent = tt("portfolio.techFilterSummaryN", `${selected.size} tecnologías`, { count: selected.size });
  }
}

function initPortfolioTechFilterPopover(techNamesAll: string[]) {
  const root = document.querySelector<HTMLElement>("[data-portfolio-tech-filter-root]");
  if (!root) return;

  const trigger = root.querySelector<HTMLButtonElement>("[data-portfolio-tech-trigger]");
  const panel = root.querySelector<HTMLElement>("[data-portfolio-tech-panel]");
  const list = root.querySelector<HTMLElement>("[data-portfolio-tech-checkboxes]");
  const applyBtn = root.querySelector<HTMLButtonElement>("[data-portfolio-tech-apply]");
  const clearBtn = root.querySelector<HTMLButtonElement>("[data-portfolio-tech-clear]");
  const summary = root.querySelector<HTMLElement>("[data-portfolio-tech-summary]");
  if (!trigger || !panel || !list || !applyBtn || !clearBtn || !summary) return;

  panel.setAttribute("aria-label", tt("portfolio.techFilterPanelLabel", "Filtro por tecnología"));

  const selected = readSelectedTechsFromUrl();
  updatePortfolioTechSummary(summary, selected);

  if (techNamesAll.length === 0) {
    list.innerHTML = `<p class="m-0 text-xs text-gray-500 dark:text-gray-400">${esc(tt("portfolio.techFilterNoTechs", "No hay tecnologías en el portfolio."))}</p>`;
    trigger.disabled = true;
    summary.textContent = "—";
    return;
  }

  trigger.disabled = false;

  list.innerHTML = techNamesAll
    .map(
      (name) =>
        `<label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm select-none hover:bg-gray-50 dark:hover:bg-gray-900/60">
        <input type="checkbox" value="${esc(name)}" data-portfolio-tech-cb class="rounded border-gray-300 dark:border-gray-600" ${selected.has(name) ? "checked" : ""} />
        <span class="text-gray-900 dark:text-gray-100">${esc(name)}</span>
      </label>`,
    )
    .join("");

  const closePanel = () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const openPanel = () => {
    const s = readSelectedTechsFromUrl();
    list.querySelectorAll<HTMLInputElement>("input[data-portfolio-tech-cb]").forEach((cb) => {
      cb.checked = s.has(cb.value);
    });
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };

  if (root.dataset.skillatlasTechFilterInit !== "1") {
    root.dataset.skillatlasTechFilterInit = "1";

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
    });

    clearBtn.addEventListener("click", () => {
      list.querySelectorAll<HTMLInputElement>("input[data-portfolio-tech-cb]").forEach((cb) => {
        cb.checked = false;
      });
    });

    applyBtn.addEventListener("click", () => {
      const chosen = new Set<string>();
      list.querySelectorAll<HTMLInputElement>("input[data-portfolio-tech-cb]:checked").forEach((cb) => chosen.add(cb.value));
      const url = new URL(window.location.href);
      url.searchParams.delete("tech");
      for (const t of chosen) url.searchParams.append("tech", t);
      window.location.href = url.toString();
    });

    document.addEventListener("click", (e) => {
      if (panel.hidden) return;
      if (!root.contains(e.target as Node)) closePanel();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) closePanel();
    });
  }
}

function syncPreviewGuestControls(
  prefs: PublicPortfolioGuestPrefs,
  layoutSel: HTMLSelectElement,
  capSel: HTMLSelectElement,
  motionCb: HTMLInputElement,
  ownerLimit: number,
) {
  layoutSel.value = prefs.layout === "grid" || prefs.layout === "list" ? prefs.layout : "inherit";
  if (prefs.embedCap === 1 || prefs.embedCap === 2 || prefs.embedCap === 3 || prefs.embedCap === 4 || prefs.embedCap === 5) {
    capSel.value = String(Math.min(prefs.embedCap, ownerLimit));
  } else {
    capSel.value = "inherit";
  }
  motionCb.checked = Boolean(prefs.reducedMotion);
}

function fillPreviewLayoutSelect(layoutSel: HTMLSelectElement) {
  const inherit = String(
    i18next.t("portfolio.preview.viewInherit", { defaultValue: "Predeterminado (Ajustes)" }),
  );
  const grid = String(i18next.t("portfolio.public.viewGrid", { defaultValue: "Cuadrícula" }));
  const list = String(i18next.t("portfolio.public.viewList", { defaultValue: "Lista" }));
  layoutSel.innerHTML = `<option value="inherit">${esc(inherit)}</option><option value="grid">${esc(grid)}</option><option value="list">${esc(list)}</option>`;
}

function fillPreviewEmbedCap(capSel: HTMLSelectElement, ownerLimit: number) {
  const inheritLabel = String(i18next.t("portfolio.public.embedCapInherit", { defaultValue: "Predeterminado del autor" }));
  let opts = `<option value="inherit">${esc(inheritLabel)}</option>`;
  for (let n = 1; n <= ownerLimit; n++) {
    opts += `<option value="${n}">${n}</option>`;
  }
  capSel.innerHTML = opts;
}

async function run() {
  const mount = document.querySelector<HTMLElement>("[data-portfolio-projects-csr-mount]");
  const loadingEl = document.querySelector<HTMLElement>("[data-portfolio-loading]");
  if (!mount) return;

  if (loadingEl) {
    loadingEl.classList.remove("hidden");
    loadingEl.textContent = "Cargando proyectos con tu sesión…";
  }

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

  const [projRes, ptRes, techRes, embRes, profRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title, description, role, outcome, cover_image_path")
      .eq("user_id", userId)
      .order("title"),
    supabase.from("project_technologies").select("project_id, technology_id"),
    supabase.from("technologies").select("id, slug, name").eq("user_id", userId).order("name"),
    supabase
      .from("project_embeds")
      .select("id, project_id, kind, title, url, sort_order, show_in_public, thumbnail_url")
      .order("sort_order", { ascending: true }),
    supabase
      .from("portfolio_profiles")
      .select(
        "public_layout, public_embeds_limit, public_theme, public_density, public_accent_hex, public_header_style, featured_project_slugs",
      )
      .eq("user_id", userId)
      .maybeSingle(),
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

  let ownerLayout: "grid" | "list" = "grid";
  let ownerEmbedLimit = 3;
  let ownerTheme = normalizePublicTheme(undefined);
  let ownerPresDensity = normalizePublicDensity(undefined);
  let ownerAccent: string | null = null;
  let ownerHeaderStyle = normalizePublicHeaderStyle(undefined);
  let featuredSlugs: string[] = [];
  const profMsg = profRes.error?.message ?? "";
  if (!profRes.error && profRes.data) {
    const row = profRes.data as {
      public_layout?: string | null;
      public_embeds_limit?: number | null;
      public_theme?: string | null;
      public_density?: string | null;
      public_accent_hex?: string | null;
      public_header_style?: string | null;
      featured_project_slugs?: unknown;
    };
    ownerLayout = normalizeOwnerLayout(row.public_layout);
    ownerEmbedLimit = normalizeOwnerEmbedLimit(row.public_embeds_limit);
    ownerTheme = normalizePublicTheme(row.public_theme);
    ownerPresDensity = normalizePublicDensity(row.public_density);
    ownerAccent = normalizePublicAccentHex(row.public_accent_hex);
    ownerHeaderStyle = normalizePublicHeaderStyle(row.public_header_style);
    featuredSlugs = featuredSlugsFromRpc(row.featured_project_slugs);
  } else if (profMsg && /public_layout|public_embeds|public_theme|featured_project|42703|column/i.test(profMsg)) {
    /* saas-013/014 no aplicada: defaults */
  }

  const projectsOrdered = sortProjectsByFeaturedSlugs(projects, featuredSlugs);

  const techNamesAll = Array.from(new Set(techs.map((t) => t.name))).sort((a, b) => a.localeCompare(b, "es"));
  const selectedTechs = readSelectedTechsFromUrl();

  const filtered =
    selectedTechs.size === 0
      ? projectsOrdered
      : projectsOrdered.filter((p) => {
          const names = techNamesByProject.get(p.id) ?? [];
          return names.some((n) => selectedTechs.has(n));
        });

  initPortfolioTechFilterPopover(techNamesAll);

  if (filtered.length === 0) {
    const isFilterEmpty = projects.length > 0 && selectedTechs.size > 0;
    mount.innerHTML = `<div class="col-span-full border border-gray-200/80 dark:border-gray-800 rounded-xl p-5 bg-white/60 dark:bg-gray-950/40">
      <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${
        isFilterEmpty
          ? esc(tt("portfolio.techFilterNoMatch", "Ningún proyecto coincide con el filtro."))
          : "Aún no hay proyectos para mostrar."
      }</p>
      ${
        isFilterEmpty
          ? `<a href="/portfolio" class="inline-flex mt-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold no-underline">${esc(tt("portfolio.allTechnologies", "Todas"))}</a>`
          : `<a href="/projects?create=1" class="inline-flex mt-3 rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 no-underline">Crear proyecto</a>`
      }
    </div>`;
    stopLoading();
    const previewControls = document.querySelector<HTMLElement>("[data-portfolio-preview-controls]");
    if (previewControls) previewControls.classList.add("hidden");
    return;
  }

  const previewRoot = document.querySelector<HTMLElement>("[data-portfolio-preview-page]");
  const previewControls = document.querySelector<HTMLElement>("[data-portfolio-preview-controls]");
  const layoutSel = document.querySelector<HTMLSelectElement>("[data-portfolio-preview-layout]");
  const capSel = document.querySelector<HTMLSelectElement>("[data-portfolio-preview-embed-cap]");
  const motionCb = document.querySelector<HTMLInputElement>("[data-portfolio-preview-reduced-motion]");
  const guestPrefs0 = readPublicPortfolioGuestPrefs(GUEST_PREFS_PREVIEW_KEY);

  const paintPreview = () => {
    const prefs = readPublicPortfolioGuestPrefs(GUEST_PREFS_PREVIEW_KEY);
    const layout = effectivePublicLayout(ownerLayout, prefs);
    const cap = effectiveEmbedCap(ownerEmbedLimit, prefs);
    const motionOn = motionEnabledForGuest(prefs);
    if (previewRoot) {
      previewRoot.classList.toggle("portfolio-motion-on", motionOn);
      previewRoot.classList.toggle("portfolio-motion-off", !motionOn);
      applyPortfolioPresentationToRoot(previewRoot, {
        theme: ownerTheme,
        density: ownerPresDensity,
        accentHex: ownerAccent,
        headerStyle: ownerHeaderStyle,
      });
    }
    mount.className = `${publicPortfolioMountGridClass(layout)} min-h-32`;
    mount.innerHTML = filtered
      .map((p, idx) => {
        const techNames = (techNamesByProject.get(p.id) ?? []).slice().sort((a, b) => a.localeCompare(b, "es"));
        const allEmb = embedsByProject.get(p.id) ?? [];
        const publicEmb = allEmb.filter((e) => e.show_in_public !== false && (e.url ?? "").trim());
        const sliced = publicEmb.slice(0, cap);
        const embedsForCard = sliced
          .map((e) => {
            const url = (e.url ?? "").trim();
            if (!url) return null;
            const thumb = (e.thumbnail_url ?? "").trim() || null;
            return {
              kind: e.kind,
              title: (e.title ?? "").trim() || detectEvidenceUrl(url).sourceLabel,
              url,
              thumbnailUrl: thumb,
            };
          })
          .filter(Boolean) as { kind: string; title: string; url: string; thumbnailUrl: string | null }[];
        const primary = publicEmb[0]
          ? {
              kind: publicEmb[0].kind,
              title: (publicEmb[0].title ?? "").trim() || detectEvidenceUrl(publicEmb[0].url ?? "").sourceLabel,
              url: (publicEmb[0].url ?? "").trim(),
              thumbnailUrl: (publicEmb[0].thumbnail_url ?? "").trim() || null,
            }
          : null;
        const safePrimary = primary && primary.url ? primary : null;
        return renderPortfolioVisitorCard(
          {
            title: p.title,
            description: p.description,
            role: p.role,
            outcome: p.outcome,
            technologyNames: techNames,
            coverImagePath: (p.cover_image_path ?? "").trim() || null,
            embeds: embedsForCard,
            primaryEmbed: safePrimary,
          },
          {
            variant: "preview",
            projectSlug: p.slug,
            layout,
            density: ownerPresDensity,
            cardIndex: idx,
            motionStagger: motionOn,
            totalEmbedCount: publicEmb.length,
          },
        );
      })
      .join("");
  };

  if (previewControls && layoutSel && capSel && motionCb) {
    previewControls.classList.remove("hidden");
    fillPreviewLayoutSelect(layoutSel);
    fillPreviewEmbedCap(capSel, ownerEmbedLimit);
    syncPreviewGuestControls(guestPrefs0, layoutSel, capSel, motionCb, ownerEmbedLimit);
    const onPreviewUiChange = () => {
      const layoutVal = layoutSel.value;
      const capVal = capSel.value;
      patchPublicPortfolioGuestPrefs(GUEST_PREFS_PREVIEW_KEY, {
        layout: layoutVal === "inherit" ? "inherit" : (layoutVal as "grid" | "list"),
        embedCap: capVal === "inherit" ? "inherit" : (Number(capVal) as 1 | 2 | 3 | 4 | 5),
        reducedMotion: motionCb.checked ? true : false,
      });
      paintPreview();
      syncPreviewGuestControls(readPublicPortfolioGuestPrefs(GUEST_PREFS_PREVIEW_KEY), layoutSel, capSel, motionCb, ownerEmbedLimit);
    };
    if (previewControls.dataset.skillatlasPreviewControlsBound !== "1") {
      previewControls.dataset.skillatlasPreviewControlsBound = "1";
      layoutSel.addEventListener("change", onPreviewUiChange);
      capSel.addEventListener("change", onPreviewUiChange);
      motionCb.addEventListener("change", onPreviewUiChange);
    }
  }

  paintPreview();
  stopLoading();
}

function schedulePortfolioProjects() {
  if (!document.querySelector<HTMLElement>("[data-portfolio-projects-csr-mount]")) return;
  void run();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", schedulePortfolioProjects);
} else {
  schedulePortfolioProjects();
}

document.addEventListener("astro:page-load", schedulePortfolioProjects);
document.addEventListener("astro:after-swap", schedulePortfolioProjects);

