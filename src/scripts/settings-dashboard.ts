import { loadPrefs, updatePrefs, type SettingsSectionId } from "./prefs";

const SECTION_SEL = "[data-settings-section]";
const DASHBOARD_SEL = "[data-settings-dashboard]";

let dashboardGridEl: HTMLElement | null = null;
const dashboardMq = typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)") : null;

function applyDashboardLayout() {
  const grid = dashboardGridEl;
  if (!grid || !dashboardMq) return;
  const cols = loadPrefs().settingsGridColumns ?? 2;
  if (dashboardMq.matches) {
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  } else {
    grid.style.gridTemplateColumns = "repeat(1, minmax(0, 1fr))";
  }
}

function reorderDom(grid: HTMLElement, order: SettingsSectionId[]) {
  const byId = new Map<string, HTMLElement>();
  grid.querySelectorAll<HTMLElement>(SECTION_SEL).forEach((el) => {
    const id = el.dataset.settingsSection;
    if (id) byId.set(id, el);
  });
  for (const id of order) {
    const el = byId.get(id);
    if (el) grid.appendChild(el);
  }
}

function readOrderFromDom(grid: HTMLElement): SettingsSectionId[] {
  const out: SettingsSectionId[] = [];
  grid.querySelectorAll<HTMLElement>(SECTION_SEL).forEach((el) => {
    const id = el.dataset.settingsSection;
    if (id === "prefs" || id === "shortcuts" || id === "portfolio") out.push(id);
  });
  return out;
}

function persistOrder(grid: HTMLElement) {
  updatePrefs({ settingsSectionOrder: readOrderFromDom(grid) });
}

function initDrag(grid: HTMLElement) {
  /** Dragstart `target` is the draggable node (the article), not the handle — use a flag set from the handle. */
  const clearDragReady = () => {
    grid.querySelectorAll<HTMLElement>(SECTION_SEL).forEach((s) => {
      delete s.dataset.settingsDragReady;
    });
  };

  document.addEventListener("pointerup", clearDragReady, true);

  grid.querySelectorAll<HTMLElement>(SECTION_SEL).forEach((section) => {
    section.setAttribute("draggable", "true");

    section.querySelector<HTMLElement>("[data-settings-drag-handle]")?.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      section.dataset.settingsDragReady = "1";
    });

    section.addEventListener("dragstart", (e) => {
      if (section.dataset.settingsDragReady !== "1") {
        e.preventDefault();
        return;
      }
      delete section.dataset.settingsDragReady;
      const dragId = section.dataset.settingsSection ?? null;
      if (dragId) e.dataTransfer?.setData("text/plain", dragId);
      e.dataTransfer!.effectAllowed = "move";
      section.classList.add("opacity-60", "ring-2", "ring-gray-300", "dark:ring-gray-600");
    });

    section.addEventListener("dragend", () => {
      section.classList.remove("opacity-60", "ring-2", "ring-gray-300", "dark:ring-gray-600");
      clearDragReady();
    });

    section.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
    });

    section.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromId = e.dataTransfer?.getData("text/plain");
      const toId = section.dataset.settingsSection;
      if (!fromId || !toId || fromId === toId) return;
      const fromEl = grid.querySelector<HTMLElement>(`${SECTION_SEL}[data-settings-section="${fromId}"]`);
      const toEl = grid.querySelector<HTMLElement>(`${SECTION_SEL}[data-settings-section="${toId}"]`);
      if (!fromEl || !toEl) return;
      const rect = toEl.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      if (before) {
        grid.insertBefore(fromEl, toEl);
      } else {
        grid.insertBefore(fromEl, toEl.nextElementSibling);
      }
      persistOrder(grid);
    });
  });
}

function initSettingsDashboard() {
  const grid = document.querySelector<HTMLElement>(DASHBOARD_SEL);
  if (!grid) return;

  dashboardGridEl = grid;

  const prefs = loadPrefs();
  reorderDom(grid, prefs.settingsSectionOrder);
  applyDashboardLayout();
  dashboardMq?.addEventListener("change", applyDashboardLayout);
  initDrag(grid);

  window.skillatlas = window.skillatlas ?? {};
  window.skillatlas.applySettingsDashboard = () => {
    const g = document.querySelector<HTMLElement>(DASHBOARD_SEL);
    if (!g) return;
    reorderDom(g, loadPrefs().settingsSectionOrder);
    applyDashboardLayout();
  };

  window.addEventListener("storage", (e) => {
    if (e.key === "skillatlas_prefs_v1") {
      const g = document.querySelector<HTMLElement>(DASHBOARD_SEL);
      if (!g) return;
      reorderDom(g, loadPrefs().settingsSectionOrder);
      applyDashboardLayout();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsDashboard);
} else {
  initSettingsDashboard();
}
