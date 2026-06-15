import i18next from "i18next";
import { normalizeFavoriteToolIds, toggleFavoriteToolId, toolHubHref, toolHubTitleKey } from "@lib/tools-favorites";
import { loadPrefs, updatePrefs } from "@scripts/core/prefs";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderFavoritesRail(root: HTMLElement) {
  const rail = root.querySelector<HTMLElement>("[data-tools-hub-favorites-rail]");
  const chips = root.querySelector<HTMLElement>("[data-tools-hub-favorites-chips]");
  if (!rail || !chips) return;
  const fav = normalizeFavoriteToolIds(loadPrefs().favoriteToolIds) ?? [];
  if (fav.length === 0) {
    rail.classList.add("hidden");
    chips.innerHTML = "";
    return;
  }
  rail.classList.remove("hidden");
  chips.innerHTML = fav
    .map((id) => {
      const href = toolHubHref(id);
      const key = toolHubTitleKey(id);
      const label = key ? tt(key, id) : id;
      return `<a href="${escHtml(href)}" class="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-3 py-1.5 text-xs font-semibold text-indigo-900 no-underline hover:bg-indigo-100/90 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-100 dark:hover:bg-indigo-900/60">${escHtml(label)}</a>`;
    })
    .join("");
}

function syncFavoriteStars(root: HTMLElement) {
  const fav = normalizeFavoriteToolIds(loadPrefs().favoriteToolIds) ?? [];
  const set = new Set(fav);
  root.querySelectorAll<HTMLButtonElement>("[data-tool-star]").forEach((btn) => {
    const id = btn.getAttribute("data-tool-id")?.trim() ?? "";
    const on = set.has(id);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      on ? tt("tools.favoriteRemoveAria", "Quitar de favoritas") : tt("tools.favoriteAddAria", "Añadir a favoritas"),
    );
    btn.dataset.favorite = on ? "1" : "0";
    btn.classList.toggle("text-amber-500", on);
    btn.classList.toggle("dark:text-amber-400", on);
    btn.classList.toggle("text-gray-400", !on);
    btn.classList.toggle("dark:text-gray-500", !on);
  });
}

function bindToolsHub(root: HTMLElement) {
  if (root.dataset.toolsHubBound === "1") return;
  root.dataset.toolsHubBound = "1";

  const onStar = (ev: Event) => {
    const t = ev.target as HTMLElement | null;
    const btn = t?.closest<HTMLButtonElement>("[data-tool-star]");
    if (!btn || !root.contains(btn)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = btn.getAttribute("data-tool-id")?.trim() ?? "";
    if (!id) return;
    const next = toggleFavoriteToolId(loadPrefs().favoriteToolIds, id);
    updatePrefs({ favoriteToolIds: next.length ? next : undefined });
    syncFavoriteStars(root);
  };

  root.addEventListener("click", onStar);
  syncFavoriteStars(root);
  renderFavoritesRail(root);

  window.addEventListener("skillatlas:prefs-updated", () => {
    syncFavoriteStars(root);
    renderFavoritesRail(root);
  });
}

function boot() {
  const root = document.querySelector<HTMLElement>("[data-tools-hub]");
  if (!root) return;
  bindToolsHub(root);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as EventListener);
document.addEventListener("astro:after-swap", boot as EventListener);
