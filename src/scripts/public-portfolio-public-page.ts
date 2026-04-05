import { getHelpStackItem, HELP_STACK_ITEMS } from "../config/help-stack";
import {
  effectiveEmbedCap,
  effectivePublicLayout,
  guestPrefsKeyForSlug,
  guestPrefsKeyForToken,
  motionEnabledForGuest,
  normalizeOwnerEmbedLimit,
  normalizeOwnerLayout,
  patchPublicPortfolioGuestPrefs,
  publicPortfolioMountGridClass,
  readPublicPortfolioGuestPrefs,
  type PublicPortfolioGuestPrefs,
} from "../lib/public-portfolio-guest-prefs";
import {
  applyPortfolioPresentationToRoot,
  normalizePublicAccentHex,
  normalizePublicDensity,
  normalizePublicHeaderStyle,
  normalizePublicTheme,
} from "../lib/portfolio-presentation";
import { renderPortfolioVisitorCard } from "../lib/public-portfolio-project-card";
import { getSupabaseBrowserClient } from "./client-supabase";
import i18next from "i18next";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RpcPublicProject = {
  slug: string;
  title: string;
  description: string;
  role: string;
  outcome: string;
  technologyNames: string[];
  primaryEmbed: { kind: string; title: string; url: string } | null;
  embeds?: { kind: string; title: string; url: string }[];
};

export type RpcPublicPayload = {
  displayName?: string;
  bio?: string;
  helpStack?: unknown;
  publicLayout?: string;
  publicEmbedsLimit?: number;
  heroCtaLabel?: string | null;
  heroCtaUrl?: string | null;
  publicTheme?: string;
  publicDensity?: string;
  publicAccentHex?: string | null;
  publicHeaderStyle?: string;
  projects?: RpcPublicProject[];
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

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeEmbedsForProject(p: RpcPublicProject, cap: number): { kind: string; title: string; url: string }[] {
  const raw = Array.isArray(p.embeds) ? p.embeds : [];
  const list =
    raw.length > 0
      ? raw
      : p.primaryEmbed?.url
        ? [p.primaryEmbed]
        : [];
  const out: { kind: string; title: string; url: string }[] = [];
  for (const e of list) {
    if (!e?.url || typeof e.url !== "string") continue;
    const url = e.url.trim();
    if (!url) continue;
    out.push({
      kind: typeof e.kind === "string" ? e.kind : "link",
      title: typeof e.title === "string" ? e.title : "",
      url,
    });
    if (out.length >= cap) break;
  }
  return out;
}

function applyHeroCta(label: string, url: string, headerStyle: "default" | "cta_prominent") {
  const wrap = document.querySelector<HTMLElement>("[data-public-portfolio-hero-cta]");
  const link = document.querySelector<HTMLAnchorElement>("[data-public-portfolio-hero-cta-link]");
  if (!wrap || !link) return;
  const cleanLabel = label.trim();
  const cleanUrl = url.trim();
  wrap.classList.toggle("portfolio-hero-cta--prominent", headerStyle === "cta_prominent");
  if (!cleanLabel || !cleanUrl || !isHttpUrl(cleanUrl)) {
    wrap.classList.add("hidden");
    link.removeAttribute("href");
    link.textContent = "";
    return;
  }
  wrap.classList.remove("hidden");
  link.href = cleanUrl;
  link.textContent = cleanLabel;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
}

function syncControlsFromPrefs(
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

function fillEmbedCapOptions(capSel: HTMLSelectElement, ownerLimit: number) {
  const inheritLabel = String(i18next.t("portfolio.public.embedCapInherit", { defaultValue: "Predeterminado del autor" }));
  let opts = `<option value="inherit">${esc(inheritLabel)}</option>`;
  for (let n = 1; n <= ownerLimit; n++) {
    opts += `<option value="${n}">${n}</option>`;
  }
  capSel.innerHTML = opts;
}

function fillLayoutSelect(layoutSel: HTMLSelectElement, inheritLabelKey: string, inheritDefault: string) {
  const inherit = String(i18next.t(inheritLabelKey, { defaultValue: inheritDefault }));
  const grid = String(i18next.t("portfolio.public.viewGrid", { defaultValue: "Cuadrícula" }));
  const list = String(i18next.t("portfolio.public.viewList", { defaultValue: "Lista" }));
  layoutSel.innerHTML = `<option value="inherit">${esc(inherit)}</option><option value="grid">${esc(grid)}</option><option value="list">${esc(list)}</option>`;
}

export type InitPublicPortfolioPageOpts =
  | { mode: "slug"; slug: string }
  | { mode: "token"; token: string };

export async function initPublicPortfolioPage(opts: InitPublicPortfolioPageOpts) {
  const root = document.querySelector<HTMLElement>("[data-public-portfolio-page]");
  const mount = document.querySelector<HTMLElement>("[data-public-portfolio-mount]");
  const loadingEl = document.querySelector<HTMLElement>("[data-public-portfolio-loading]");
  const nameEl = document.querySelector<HTMLElement>("[data-public-portfolio-name]");
  const bioEl = document.querySelector<HTMLElement>("[data-public-portfolio-bio]");
  const avatarImg = document.querySelector<HTMLImageElement>("[data-public-portfolio-avatar]");
  const avatarFb = document.querySelector<HTMLElement>("[data-public-portfolio-avatar-fallback]");
  const filterForm = document.querySelector<HTMLElement>("[data-public-portfolio-filter]");
  const techSelect = document.querySelector<HTMLSelectElement>("[data-public-portfolio-tech-select]");
  const controls = document.querySelector<HTMLElement>("[data-public-portfolio-controls]");
  const layoutSel = document.querySelector<HTMLSelectElement>("[data-public-portfolio-layout]");
  const capSel = document.querySelector<HTMLSelectElement>("[data-public-portfolio-embed-cap]");
  const motionCb = document.querySelector<HTMLInputElement>("[data-public-portfolio-reduced-motion]");

  const slug = opts.mode === "slug" ? opts.slug.trim() : "";
  const token = opts.mode === "token" ? opts.token.trim() : "";
  const scopeKey = opts.mode === "slug" ? guestPrefsKeyForSlug(slug) : guestPrefsKeyForToken(token);

  if ((!slug && opts.mode === "slug") || (!token && opts.mode === "token") || !mount) return;

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

  const rpcRes =
    opts.mode === "slug"
      ? await supabase.rpc("skillatlas_portfolio_by_public_slug", { p_slug: slug })
      : await supabase.rpc("skillatlas_portfolio_by_share_token", { p_token: token });

  const { data, error } = rpcRes;

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

  const payload = data as RpcPublicPayload;
  const displayName = (payload.displayName ?? "").trim() || "Portfolio";
  const bio = (payload.bio ?? "").trim();
  const ownerLayout = normalizeOwnerLayout(payload.publicLayout);
  const ownerEmbedLimit = normalizeOwnerEmbedLimit(payload.publicEmbedsLimit);
  const heroLabel = typeof payload.heroCtaLabel === "string" ? payload.heroCtaLabel : "";
  const heroUrl = typeof payload.heroCtaUrl === "string" ? payload.heroCtaUrl : "";
  const ownerTheme = normalizePublicTheme(payload.publicTheme);
  const ownerDensity = normalizePublicDensity(payload.publicDensity);
  const ownerAccent = normalizePublicAccentHex(payload.publicAccentHex);
  const ownerHeaderStyle = normalizePublicHeaderStyle(payload.publicHeaderStyle);

  applyPortfolioPresentationToRoot(root, {
    theme: ownerTheme,
    density: ownerDensity,
    accentHex: ownerAccent,
    headerStyle: ownerHeaderStyle,
  });

  if (nameEl) nameEl.textContent = displayName;
  if (bioEl) bioEl.textContent = bio;
  document.title = `${displayName} · SkillAtlas`;

  if (avatarFb) avatarFb.textContent = initialsFromName(displayName);
  if (avatarImg) {
    avatarImg.removeAttribute("src");
    avatarImg.classList.add("hidden");
    avatarFb?.classList.remove("hidden");
  }

  applyHeroCta(heroLabel, heroUrl, ownerHeaderStyle);

  const rawHs = payload.helpStack;
  const helpKeys = Array.isArray(rawHs) ? rawHs.filter((x): x is string => typeof x === "string") : [];
  renderHelpStack(helpKeys);

  const projects = Array.isArray(payload.projects) ? (payload.projects as RpcPublicProject[]) : [];
  const techNamesAll = Array.from(new Set(projects.flatMap((p) => p.technologyNames ?? []))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const selected = new URLSearchParams(window.location.search).get("tech") ?? "all";

  if (techSelect && filterForm && techNamesAll.length > 0) {
    filterForm.classList.remove("hidden");
    filterForm.removeAttribute("aria-hidden");
    const allLabel = String(i18next.t("portfolio.allTechnologies", { defaultValue: "Todas" }));
    techSelect.innerHTML =
      `<option value="all"${selected === "all" || selected === "" ? " selected" : ""}>${esc(allLabel)}</option>` +
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

  const filtered =
    selected && selected !== "all"
      ? projects.filter((p) => (p.technologyNames ?? []).includes(selected))
      : projects;

  if (filtered.length === 0) {
    const msg = String(i18next.t("portfolio.techFilterNoMatch", { defaultValue: "Ningún proyecto coincide con el filtro." }));
    mount.innerHTML = `<div class="col-span-full border border-gray-200/80 dark:border-gray-800 rounded-xl p-5">
      <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${esc(msg)}</p>
    </div>`;
    stopLoading();
    if (controls) controls.classList.add("hidden");
    return;
  }

  const guestPrefs = readPublicPortfolioGuestPrefs(scopeKey);

  const paint = () => {
    const prefs = readPublicPortfolioGuestPrefs(scopeKey);
    const layout = effectivePublicLayout(ownerLayout, prefs);
    const cap = effectiveEmbedCap(ownerEmbedLimit, prefs);
    const motionOn = motionEnabledForGuest(prefs);

    if (root) {
      root.classList.toggle("portfolio-motion-on", motionOn);
      root.classList.toggle("portfolio-motion-off", !motionOn);
    }

    mount.className = publicPortfolioMountGridClass(layout);
    mount.innerHTML = filtered
      .map((p, idx) => {
        const serverEmbedsCount =
          Array.isArray(p.embeds) && p.embeds.length > 0
            ? p.embeds.length
            : p.primaryEmbed?.url
              ? 1
              : 0;
        const embeds = normalizeEmbedsForProject(p, cap);
        return renderPortfolioVisitorCard(
          {
            title: p.title,
            description: p.description,
            role: p.role,
            outcome: p.outcome,
            technologyNames: p.technologyNames ?? [],
            embeds,
            primaryEmbed: p.primaryEmbed,
          },
          {
            variant: "public",
            layout,
            density: ownerDensity,
            cardIndex: idx,
            motionStagger: motionOn,
            totalEmbedCount: serverEmbedsCount,
          },
        );
      })
      .join("");
  };

  if (controls && layoutSel && capSel && motionCb) {
    controls.classList.remove("hidden");
    fillLayoutSelect(
      layoutSel,
      "portfolio.public.viewInherit",
      "Predeterminado del autor",
    );
    fillEmbedCapOptions(capSel, ownerEmbedLimit);
    syncControlsFromPrefs(guestPrefs, layoutSel, capSel, motionCb, ownerEmbedLimit);

    const onChange = () => {
      const layoutVal = layoutSel.value;
      const capVal = capSel.value;
      patchPublicPortfolioGuestPrefs(scopeKey, {
        layout: layoutVal === "inherit" ? "inherit" : (layoutVal as "grid" | "list"),
        embedCap: capVal === "inherit" ? "inherit" : (Number(capVal) as 1 | 2 | 3 | 4 | 5),
        reducedMotion: motionCb.checked ? true : false,
      });
      paint();
      syncControlsFromPrefs(readPublicPortfolioGuestPrefs(scopeKey), layoutSel, capSel, motionCb, ownerEmbedLimit);
    };

    if (controls.dataset.skillatlasPublicControlsBound !== "1") {
      controls.dataset.skillatlasPublicControlsBound = "1";
      layoutSel.addEventListener("change", onChange);
      capSel.addEventListener("change", onChange);
      motionCb.addEventListener("change", onChange);
    }
  }

  paint();
  stopLoading();
}
