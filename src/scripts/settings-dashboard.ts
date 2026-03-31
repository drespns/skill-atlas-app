import "gridstack/dist/gridstack.min.css";
import { GridStack } from "gridstack";
import { loadPrefs, updatePrefs, type SettingsLayoutItemV1, type SettingsSectionId } from "./prefs";

const DASHBOARD_SEL = "[data-settings-dashboard]";
const ITEM_SEL = ".grid-stack-item";

const mq = typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)") : null;

function currentCols() {
  const cols = loadPrefs().settingsGridColumns ?? 2;
  if (!mq) return cols;
  return mq.matches ? cols : 1;
}

function defaultLayout(cols: number): SettingsLayoutItemV1[] {
  // Simple starting point; users can freely rearrange.
  return [
    { id: "prefs", x: 0, y: 0, w: Math.max(1, Math.min(cols, 2)), h: 8 },
    { id: "shortcuts", x: 0, y: 8, w: Math.max(1, Math.min(cols, 1)), h: 7 },
    { id: "portfolio", x: 0, y: 15, w: cols, h: 10 },
  ];
}

function readLayout(grid: GridStack): SettingsLayoutItemV1[] {
  const out: SettingsLayoutItemV1[] = [];
  const nodes = grid.engine.nodes ?? [];
  for (const n of nodes) {
    const id = (n.el?.getAttribute("data-gs-id") ?? "") as SettingsSectionId;
    if (id !== "prefs" && id !== "shortcuts" && id !== "portfolio") continue;
    out.push({ id, x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? 1, h: n.h ?? 1 });
  }
  return out;
}

function enforcePortfolioFullWidth(grid: GridStack, cols: number) {
  const el = grid.el?.querySelector<HTMLElement>(`${ITEM_SEL}[data-gs-id="portfolio"]`);
  if (!el) return;
  // Prevent width resize; allow moving + height resize.
  el.setAttribute("data-gs-min-w", String(cols));
  el.setAttribute("data-gs-max-w", String(cols));
  grid.update(el, { x: 0, w: cols });
}

function initSettingsDashboard() {
  const wrap = document.querySelector<HTMLElement>(DASHBOARD_SEL);
  if (!wrap) return;
  if (wrap.dataset.bound === "1") return;
  wrap.dataset.bound = "1";

  const cols = currentCols();

  const grid = GridStack.init(
    {
      column: cols,
      margin: 16,
      float: true,
      handle: "[data-settings-drag-handle]",
      draggable: { handle: "[data-settings-drag-handle]" },
      resizable: { handles: "all" },
    },
    wrap,
  );

  const prefs = loadPrefs();
  const layout = prefs.settingsLayoutV1 ?? defaultLayout(cols);
  grid.load(layout as any);

  enforcePortfolioFullWidth(grid, cols);

  let t: number | null = null;
  const persist = () => {
    const colsNow = currentCols();
    enforcePortfolioFullWidth(grid, colsNow);
    const next = readLayout(grid).map((it) => (it.id === "portfolio" ? { ...it, x: 0, w: colsNow } : it));
    updatePrefs({ settingsLayoutV1: next });
  };

  const persistDebounced = () => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(persist, 250);
  };

  grid.on("dragstop", persistDebounced);
  grid.on("resizestop", persistDebounced);
  grid.on("change", persistDebounced);

  const apply = () => {
    const c = currentCols();
    grid.column(c);
    enforcePortfolioFullWidth(grid, c);
    persistDebounced();
  };

  mq?.addEventListener("change", apply);

  window.skillatlas = window.skillatlas ?? {};
  window.skillatlas.applySettingsDashboard = apply;
}

const boot = () => initSettingsDashboard();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);
