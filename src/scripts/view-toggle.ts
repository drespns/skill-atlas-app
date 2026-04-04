import { loadPrefs, updatePrefs, type DefaultView } from "./prefs";

function isDefaultView(v: string): v is DefaultView {
  return v === "cards" || v === "list";
}

function setPressed(group: HTMLElement, view: DefaultView) {
  group.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((btn) => {
    const v = btn.getAttribute("data-view");
    const pressed = v === view;
    btn.setAttribute("aria-pressed", String(pressed));
    btn.classList.toggle("bg-gray-100", pressed);
    btn.classList.toggle("dark:bg-gray-900", pressed);
  });
}

function initViewToggle() {
  const group = document.querySelector<HTMLElement>("[data-view-toggle]");
  if (!group || group.dataset.skillatlasBound === "1") return;
  const scope = group.getAttribute("data-scope"); // "projects" | "technologies"
  if (scope !== "projects" && scope !== "technologies") return;
  group.dataset.skillatlasBound = "1";

  const prefs = loadPrefs();
  const current = scope === "projects" ? prefs.projectsView : prefs.technologiesView;
  setPressed(group, current);

  group.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-view]");
    if (!btn) return;
    const v = btn.getAttribute("data-view");
    if (!v || !isDefaultView(v)) return;

    if (scope === "projects") updatePrefs({ projectsView: v });
    else updatePrefs({ technologiesView: v });

    setPressed(group, v);

    // refresh current page list without full reload
    if (scope === "projects" && window.skillatlas?.bootstrapProjectsList) await window.skillatlas.bootstrapProjectsList();
    if (scope === "technologies" && window.skillatlas?.bootstrapTechnologiesGrid)
      await window.skillatlas.bootstrapTechnologiesGrid();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initViewToggle);
} else {
  initViewToggle();
}

document.addEventListener("astro:page-load", initViewToggle);
document.addEventListener("astro:after-swap", initViewToggle);

