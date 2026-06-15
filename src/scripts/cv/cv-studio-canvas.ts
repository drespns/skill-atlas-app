import i18next from "i18next";
import "@scripts/cv/cv-studio-hero-inspector";
import "@scripts/cv/cv-studio-layout-toolbar";
import "@scripts/cv/cv-studio-canvas-blocks";
import { bootCvStudioInlineDocument } from "./cv-studio-document";

const ZOOM_KEY = "cvStudioCanvasZoom";
const GRID_KEY = "cvStudioCanvasGrid";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.45;
const ZOOM_STEP = 0.1;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function readStoredZoom(): number | null {
  try {
    const raw = sessionStorage.getItem(ZOOM_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n, ZOOM_MIN, ZOOM_MAX) : null;
  } catch {
    return null;
  }
}

function writeStoredZoom(z: number) {
  try {
    sessionStorage.setItem(ZOOM_KEY, String(z));
  } catch {
    /* ignore */
  }
}

function readStoredGrid(): boolean {
  try {
    return sessionStorage.getItem(GRID_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredGrid(on: boolean) {
  try {
    sessionStorage.setItem(GRID_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type CvCanvasRoot = HTMLElement & { __cvCanvasAbort?: AbortController };

function bootCvStudioCanvas() {
  const root = document.querySelector<CvCanvasRoot>("[data-cv-studio-canvas-root]");
  if (!root) return;

  const viewport = root.querySelector<HTMLElement>("[data-cv-studio-canvas-viewport]");
  const sheet = root.querySelector<HTMLElement>(".cv-studio-canvas-sheet");
  const pctEl = root.querySelector<HTMLElement>("[data-cv-studio-canvas-zoom-pct]");
  const btnIn = root.querySelector<HTMLButtonElement>("[data-cv-studio-canvas-zoom-in]");
  const btnOut = root.querySelector<HTMLButtonElement>("[data-cv-studio-canvas-zoom-out]");
  const btnGrid = root.querySelector<HTMLButtonElement>("[data-cv-studio-grid-toggle]");
  const btnFit = root.querySelector<HTMLButtonElement>("[data-cv-studio-canvas-fit]");
  if (!viewport || !sheet || !pctEl || !btnIn || !btnOut || !btnGrid || !btnFit) return;

  root.__cvCanvasAbort?.abort();
  const ac = new AbortController();
  root.__cvCanvasAbort = ac;
  const { signal } = ac;

  let zoom = readStoredZoom() ?? 1;
  zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);

  const applyZoom = (next: number) => {
    zoom = clamp(next, ZOOM_MIN, ZOOM_MAX);
    root.style.setProperty("--cv-studio-zoom", String(zoom));
    pctEl.textContent = `${Math.round(zoom * 100)}%`;
    writeStoredZoom(zoom);
  };

  let gridOn = readStoredGrid();

  const applyGrid = (on: boolean) => {
    gridOn = on;
    viewport.classList.toggle("cv-studio-canvas-viewport--grid", on);
    btnGrid.classList.toggle("ring-2", on);
    btnGrid.classList.toggle("ring-indigo-400/60", on);
    btnGrid.setAttribute("aria-pressed", on ? "true" : "false");
    writeStoredGrid(on);
  };

  applyZoom(zoom);
  applyGrid(gridOn);

  btnIn.addEventListener("click", () => applyZoom(zoom + ZOOM_STEP), { signal });
  btnOut.addEventListener("click", () => applyZoom(zoom - ZOOM_STEP), { signal });

  btnGrid.addEventListener("click", () => applyGrid(!gridOn), { signal });

  btnFit.addEventListener("click", () => {
    applyZoom(1);
    requestAnimationFrame(() => {
      const pad = 40;
      const inner = sheet.parentElement;
      const avail = (inner?.clientWidth ?? viewport.clientWidth) - pad;
      if (avail <= 0) return;
      const w = sheet.offsetWidth;
      if (w <= 0) return;
      const next = clamp(avail / w, ZOOM_MIN, ZOOM_MAX);
      applyZoom(next);
    });
  }, { signal });

  /** Captura en la raíz del lienzo: el scroll interno del documento no debe “comerse” el Ctrl+rueda. */
  root.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      applyZoom(zoom + dir * 0.06);
    },
    { signal, passive: false, capture: true },
  );
}

function i18nReadyForStudio(): boolean {
  return (
    i18next.isInitialized ||
    Boolean(typeof window !== "undefined" && (window as unknown as { skillatlas?: { refreshI18nDom?: () => void } }).skillatlas?.refreshI18nDom)
  );
}

function scheduleBootCvStudioCanvas() {
  queueMicrotask(() => {
    if (!document.querySelector("[data-cv-studio-canvas-root]")) return;
    requestAnimationFrame(() => bootCvStudioCanvas());
  });
}

function scheduleBootCvStudioInlineDoc() {
  queueMicrotask(() => {
    if (!document.querySelector("[data-cv-studio-doc-root]")) return;
    const tick = () => {
      if (!i18nReadyForStudio()) {
        requestAnimationFrame(tick);
        return;
      }
      requestAnimationFrame(() => bootCvStudioInlineDocument());
    };
    tick();
  });
}

function scheduleStudioCanvasAll() {
  scheduleBootCvStudioCanvas();
  scheduleBootCvStudioInlineDoc();
}

scheduleStudioCanvasAll();
document.addEventListener("DOMContentLoaded", scheduleStudioCanvasAll);
document.addEventListener("astro:page-load", scheduleStudioCanvasAll);
document.addEventListener("astro:after-swap", scheduleStudioCanvasAll);
