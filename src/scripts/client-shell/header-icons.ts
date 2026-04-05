import { loadPrefs } from "@scripts/core/prefs";

export function refreshHeaderIconsFromPrefs() {
  const wrap = document.querySelector<HTMLElement>("[data-header-icons]");
  if (!wrap) return;
  const show = loadPrefs().showHeaderIcons;
  wrap.classList.toggle("hidden", !show);
  wrap.classList.toggle("flex", Boolean(show));
}

export function initHeaderIconVisibility() {
  refreshHeaderIconsFromPrefs();
}
