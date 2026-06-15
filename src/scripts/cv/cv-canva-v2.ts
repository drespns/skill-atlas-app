import i18next from "i18next";
import { CV_TEMPLATE_IDS, normalizeCvTemplateId } from "@lib/cv-templates";
import { cvStudioSectionLabel } from "@lib/cv-studio-section-labels";
import { clampCvPrintMaxPages } from "@lib/cv-print-scale";
import { normalizeCvDocumentSectionOrder, type CvDocumentSectionId } from "@lib/cv-document-section-order";
import {
  compactCvStudioLayoutForPersist,
  mergeCvStudioCanvasLayoutFromProfile,
  type CvStudioCanvasLayoutV1,
} from "@lib/cv-studio-layout";
import {
  buildCvDocumentsPrefsPatch,
  loadPrefs,
  migrateCvDocumentsIntoPrefs,
  updatePrefs,
  type CvDocumentSlotV1,
  type CvProfileV1,
} from "@scripts/core/prefs";
import { notifyCvEmbedPrefsSyncedExternally } from "@lib/cv-studio-prefs-channel";
import { bootCvStudioInlineDocument } from "@scripts/cv/cv-studio-document";
import { setupCvCanvaInlineEdit } from "@scripts/cv/cv-canva-inline-edit";
import { setupCvCanvaFormatToolbar } from "@scripts/cv/cv-canva-floating-toolbar";
import { setupCvCanvaHeroFieldResize } from "@scripts/cv/cv-canva-hero-field-resize";

const MM_TO_CSS_PX = 96 / 25.4;
const A4_HEIGHT_MM = 297;
const SELECTED_CLASS = "cv-studio-block--selected";
const CANVA_ZOOM_KEY = "cvCanvaV2Zoom";
const CANVA_ZOOM_MIN = 0.35;
const CANVA_ZOOM_MAX = 1.55;
const CANVA_ZOOM_BTN_STEP = 0.1;
const WIDTH_MIN_PCT = 55;
const WIDTH_MAX_PCT = 100;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function readStoredCanvaZoom(): number | null {
  try {
    const raw = sessionStorage.getItem(CANVA_ZOOM_KEY);
    if (raw == null) return null;
    const z = Number(raw);
    return Number.isFinite(z) ? clamp(z, CANVA_ZOOM_MIN, CANVA_ZOOM_MAX) : null;
  } catch {
    return null;
  }
}

function writeStoredCanvaZoom(z: number) {
  try {
    sessionStorage.setItem(CANVA_ZOOM_KEY, String(z));
  } catch {
    /* ignore */
  }
}

function tt(key: string, fb: string, opts?: Record<string, unknown>): string {
  const interpolateFallback = () => {
    if (!opts) return fb;
    let out = fb;
    for (const [k, v] of Object.entries(opts)) out = out.replaceAll(`{{${k}}}`, String(v));
    return out;
  };
  try {
    if (!i18next.isInitialized) return interpolateFallback();
    const v = i18next.t(key, opts);
    return typeof v === "string" && v.length > 0 && v !== key ? v : interpolateFallback();
  } catch {
    return interpolateFallback();
  }
}

function readActiveSlot(): { documents: CvDocumentSlotV1[]; activeId: string; idx: number } | null {
  const prefs = migrateCvDocumentsIntoPrefs(loadPrefs());
  const documents = (prefs.cvDocuments ?? []).map((d) => ({
    ...d,
    cvProfile: JSON.parse(JSON.stringify(d.cvProfile ?? {})) as CvProfileV1,
  }));
  const activeId = prefs.cvActiveDocumentId ?? documents[0]?.id ?? "";
  const idx = documents.findIndex((d) => d.id === activeId);
  if (idx < 0 || !documents[idx]) return null;
  return { documents, activeId, idx };
}

function persistProfile(nextProfile: CvProfileV1) {
  const cur = readActiveSlot();
  if (!cur) return;
  const next = [...cur.documents];
  next[cur.idx] = { ...next[cur.idx]!, cvProfile: nextProfile };
  updatePrefs(buildCvDocumentsPrefsPatch(next, cur.activeId));
  notifyCvEmbedPrefsSyncedExternally();
}

function templateLabelKey(id: string): string {
  const map: Record<string, string> = {
    classic: "cv.templateClassic",
    minimal: "cv.templateMinimal",
    modern: "cv.templateModern",
    compact: "cv.templateCompact",
    mono: "cv.templateMono",
    sidebar: "cv.templateSidebar",
    serif: "cv.templateSerif",
    atlas: "cv.templateAtlas",
    contrast: "cv.templateContrast",
    focus: "cv.templateFocus",
  };
  return map[id] ?? "cv.templateClassic";
}

function blockId(el: HTMLElement): string {
  return el.getAttribute("data-cv-studio-selectable") ?? el.getAttribute("data-cv-section") ?? "";
}

function blockLabel(id: string): string {
  if (id === "hero") return tt("cv.studioHeroHeadlineLabel", "Cabecera");
  if (id === "techFeaturedBand") return tt("cv.docTechnologiesHeading", "Tecnologías");
  return cvStudioSectionLabel(id as CvDocumentSectionId, tt);
}

function enumerateBlocks(doc: HTMLElement): Array<{ id: string; el: HTMLElement }> {
  const out: Array<{ id: string; el: HTMLElement }> = [];
  const hero = doc.querySelector<HTMLElement>('[data-cv-studio-selectable="hero"]');
  if (hero) out.push({ id: "hero", el: hero });
  const band = doc.querySelector<HTMLElement>('[data-cv-studio-selectable="techFeaturedBand"]');
  if (band && !band.classList.contains("hidden")) out.push({ id: "techFeaturedBand", el: band });
  doc.querySelectorAll<HTMLElement>("section[data-cv-section]").forEach((sec) => {
    const id = sec.dataset.cvSection?.trim();
    if (!id || sec.classList.contains("hidden")) return;
    out.push({ id, el: sec });
  });
  return out;
}

function updatePagesReadout(readout: HTMLElement | null, doc: HTMLElement | null) {
  if (!readout) return;
  if (!doc) {
    readout.textContent = "—";
    return;
  }
  const h = Math.max(doc.scrollHeight, doc.getBoundingClientRect().height);
  const n = Math.max(1, Math.ceil(h / (A4_HEIGHT_MM * MM_TO_CSS_PX)));
  readout.textContent = tt("cv.studioPagesReadout", "~{{n}} páginas (aprox.). El PDF final puede variar un poco según el navegador.", { n });
}

function mmCss(n: number): number {
  return n * MM_TO_CSS_PX;
}

/** Guías A4 en el wrap de páginas (misma lógica que el estudio inline). */
function paintPageGuidesInRoot(root: HTMLElement, doc: HTMLElement | null) {
  const wrap = root.querySelector<HTMLElement>("[data-cv-studio-pages-wrap]");
  const guides = wrap?.querySelector<HTMLElement>("[data-cv-studio-page-guides]");
  if (!guides) return;
  if (!doc) {
    guides.style.height = "";
    guides.innerHTML = "";
    return;
  }
  const h = Math.max(doc.scrollHeight, doc.getBoundingClientRect().height);
  const pagePx = mmCss(A4_HEIGHT_MM);
  const pageCount = Math.max(1, Math.ceil(h / pagePx));
  guides.style.height = `${h}px`;
  guides.innerHTML = "";
  for (let i = 1; i < pageCount; i++) {
    const y = i * pagePx;
    if (y >= h - 1) break;
    const line = document.createElement("div");
    line.className = "cv-studio-page-guide-line";
    line.style.top = `${y}px`;
    guides.appendChild(line);
  }
}

function widthResizeSide(handle: string): "e" | "w" {
  const h = handle.trim().toLowerCase();
  if (h === "e" || h === "ne" || h === "se") return "e";
  return "w";
}

function bootCvCanvaV2() {
  const root = document.querySelector<HTMLElement>("[data-cv-canva-v2-root]");
  if (!root || root.dataset.cvCanvaV2Bound === "1") return;
  /** Evita doble registro; no marcar `cvCanvaV2Bound` hasta pasar todas las comprobaciones del DOM. */
  if (root.dataset.cvCanvaV2Booting === "1") return;
  root.dataset.cvCanvaV2Booting = "1";

  const templateSel = root.querySelector<HTMLSelectElement>("[data-cv-canva-template]");
  const pagesSel = root.querySelector<HTMLSelectElement>("[data-cv-canva-pages]");
  const flowSel = root.querySelector<HTMLSelectElement>("[data-cv-canva-flow]");
  const resetBtn = root.querySelector<HTMLButtonElement>("[data-cv-canva-reset]");
  const layersEl = root.querySelector<HTMLElement>("[data-cv-canva-layers]");
  const selLabel = root.querySelector<HTMLElement>("[data-cv-canva-selected-label]");
  const widthRange = root.querySelector<HTMLInputElement>("[data-cv-canva-width]");
  const widthReadout = root.querySelector<HTMLElement>("[data-cv-canva-width-readout]");
  const scaleRange = root.querySelector<HTMLInputElement>("[data-cv-canva-font-scale]");
  const scaleReadout = root.querySelector<HTMLElement>("[data-cv-canva-font-scale-readout]");
  const pagesReadout = root.querySelector<HTMLElement>("[data-cv-canva-pages-readout]");
  const docPanel = root.querySelector<HTMLElement>("[data-cv-studio-doc-panel]");
  const formatBarHost = root.querySelector<HTMLElement>("[data-cv-canva-format-toolbar-host]");
  const workspace = root.querySelector<HTMLElement>("[data-cv-canva-workspace]");
  const zoomWrap = root.querySelector<HTMLElement>("[data-cv-canva-zoom-wrap]");
  const zoomPctEl = root.querySelector<HTMLElement>("[data-cv-canva-zoom-pct]");
  const selFrame = root.querySelector<HTMLElement>("[data-cv-canva-selection-frame]");
  const btnFitZoom = root.querySelector<HTMLButtonElement>("[data-cv-canva-fit-zoom]");
  const btnZoomIn = root.querySelector<HTMLButtonElement>("[data-cv-canva-zoom-in]");
  const btnZoomOut = root.querySelector<HTMLButtonElement>("[data-cv-canva-zoom-out]");
  const zoomBar = root.querySelector<HTMLElement>("[data-cv-canva-zoom-bar]");
  if (
    !templateSel ||
    !pagesSel ||
    !flowSel ||
    !layersEl ||
    !selLabel ||
    !widthRange ||
    !widthReadout ||
    !scaleRange ||
    !scaleReadout ||
    !docPanel ||
    !formatBarHost ||
    !workspace ||
    !zoomWrap ||
    !zoomPctEl ||
    !selFrame
  ) {
    delete root.dataset.cvCanvaV2Booting;
    return;
  }

  root.dataset.cvCanvaV2Bound = "1";

  templateSel.innerHTML = "";
  for (const id of CV_TEMPLATE_IDS) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = tt(templateLabelKey(id), id);
    templateSel.appendChild(opt);
  }
  pagesSel.innerHTML = "";
  for (let p = 1; p <= 6; p++) {
    const opt = document.createElement("option");
    opt.value = String(p);
    opt.textContent = tt("cv.studioPrintPagesOption", "{{n}} página(s) objetivo", { n: p });
    pagesSel.appendChild(opt);
  }

  let selectedBlockId: string | null = null;
  let canvasZoom = clamp(readStoredCanvaZoom() ?? 1, CANVA_ZOOM_MIN, CANVA_ZOOM_MAX);

  const applyCanvasZoom = (next: number) => {
    canvasZoom = clamp(next, CANVA_ZOOM_MIN, CANVA_ZOOM_MAX);
    zoomWrap.style.setProperty("--cv-canva-zoom", String(canvasZoom));
    zoomPctEl.textContent = `${Math.round(canvasZoom * 100)}%`;
    writeStoredCanvaZoom(canvasZoom);
    queueMicrotask(() => syncSelectionFrame());
  };

  applyCanvasZoom(canvasZoom);

  if (zoomBar) zoomBar.title = tt("cv.studioCanvasWheelHint", "Ctrl (o ⌘) + rueda: zoom en el lienzo.");

  const fitZoomToWorkspace = () => {
    requestAnimationFrame(() => {
      const innerRow = zoomWrap.parentElement;
      const pad = 40;
      const avail = (innerRow?.clientWidth ?? workspace.clientWidth) - pad;
      const layoutW = zoomWrap.offsetWidth;
      if (avail <= 0 || layoutW <= 0) return;
      applyCanvasZoom(clamp(avail / layoutW, CANVA_ZOOM_MIN, CANVA_ZOOM_MAX));
    });
  };

  btnZoomIn?.addEventListener("click", () => applyCanvasZoom(canvasZoom + CANVA_ZOOM_BTN_STEP));
  btnZoomOut?.addEventListener("click", () => applyCanvasZoom(canvasZoom - CANVA_ZOOM_BTN_STEP));
  btnFitZoom?.addEventListener("click", () => fitZoomToWorkspace());

  const getSelectedBlockEl = (): HTMLElement | null => {
    if (!selectedBlockId) return null;
    return (
      docPanel.querySelector<HTMLElement>(`[data-cv-studio-selectable="${CSS.escape(selectedBlockId)}"]`) ??
      docPanel.querySelector<HTMLElement>(`section[data-cv-section="${CSS.escape(selectedBlockId)}"]`)
    );
  };

  const syncSelectionFrame = () => {
    if (!selFrame) return;
    const block = getSelectedBlockEl();
    if (!block || !selectedBlockId) {
      selFrame.classList.add("hidden");
      return;
    }
    const ws = workspace;
    const br = block.getBoundingClientRect();
    const wr = ws.getBoundingClientRect();
    selFrame.classList.remove("hidden");
    selFrame.style.top = `${br.top - wr.top + ws.scrollTop}px`;
    selFrame.style.left = `${br.left - wr.left + ws.scrollLeft}px`;
    selFrame.style.width = `${br.width}px`;
    selFrame.style.height = `${br.height}px`;
  };

  const clearSelectionVisual = () => {
    docPanel.querySelectorAll(`.${SELECTED_CLASS}`).forEach((n) => n.classList.remove(SELECTED_CLASS));
  };

  const selectBlock = (id: string | null) => {
    selectedBlockId = id;
    clearSelectionVisual();
    if (!id) {
      selLabel.textContent = "Selecciona un bloque.";
      widthRange.disabled = true;
      widthReadout.textContent = "—";
      syncSelectionFrame();
      return;
    }
    const block =
      docPanel.querySelector<HTMLElement>(`[data-cv-studio-selectable="${CSS.escape(id)}"]`) ??
      docPanel.querySelector<HTMLElement>(`section[data-cv-section="${CSS.escape(id)}"]`);
    if (block) block.classList.add(SELECTED_CLASS);
    selLabel.textContent = blockLabel(id);
    const cur = readActiveSlot();
    const lay = cur ? mergeCvStudioCanvasLayoutFromProfile(cur.documents[cur.idx]!.cvProfile ?? {}) : { v: 1 as const };
    const w = lay.blockWidthsPct?.[id];
    widthRange.disabled = false;
    widthRange.value = String(typeof w === "number" ? w : 100);
    widthReadout.textContent = `${widthRange.value}%`;
    syncSelectionFrame();
  };

  const refreshFromPrefs = () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    templateSel.value = normalizeCvTemplateId(p.cvTemplate);
    pagesSel.value = String(clampCvPrintMaxPages(p.cvPrintMaxPages));
    const lay = mergeCvStudioCanvasLayoutFromProfile(p);
    flowSel.value = lay.sectionFlow === "two" ? "two" : "single";
    const scale = typeof lay.fontScalePct === "number" ? lay.fontScalePct : 100;
    scaleRange.value = String(scale);
    scaleReadout.textContent = `${scale}%`;
  };

  const refreshLayers = () => {
    const doc = docPanel.querySelector<HTMLElement>("[data-cv-document]");
    if (!doc) {
      layersEl.innerHTML = "";
      updatePagesReadout(pagesReadout, null);
      paintPageGuidesInRoot(root, null);
      syncSelectionFrame();
      return;
    }
    const blocks = enumerateBlocks(doc);
    layersEl.innerHTML = blocks
      .map(
        (b, i) =>
          `<li draggable="true" data-cv-canva-layer="${b.id}" class="list-none rounded-lg border border-gray-200/90 bg-white/95 px-2 py-1.5 text-xs font-medium text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 ${selectedBlockId === b.id ? "ring-2 ring-indigo-400/50" : ""}"><span class="text-gray-400 me-1">⋮⋮</span>${String(i + 1).padStart(2, "0")} · ${blockLabel(
            b.id,
          )}</li>`,
      )
      .join("");
    updatePagesReadout(pagesReadout, doc);
    paintPageGuidesInRoot(root, doc);
    syncSelectionFrame();
  };

  const applySectionOrder = (fromId: string, toId: string) => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const order = normalizeCvDocumentSectionOrder(p.cvDocumentSectionOrder) as CvDocumentSectionId[];
    const fi = order.indexOf(fromId as CvDocumentSectionId);
    const ti = order.indexOf(toId as CvDocumentSectionId);
    if (fi < 0 || ti < 0 || fi === ti) return;
    const next = order.filter((id) => id !== fromId);
    const insertAt = next.indexOf(toId as CvDocumentSectionId);
    next.splice(insertAt, 0, fromId as CvDocumentSectionId);
    persistProfile({ ...p, cvDocumentSectionOrder: next });
  };

  layersEl.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-cv-canva-layer]");
    if (!row) return;
    selectBlock(row.dataset.cvCanvaLayer ?? null);
    refreshLayers();
  });

  layersEl.addEventListener("dragstart", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-cv-canva-layer]");
    if (!row) return;
    e.dataTransfer?.setData("text/plain", row.dataset.cvCanvaLayer ?? "");
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  });
  layersEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  });
  layersEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const fromId = e.dataTransfer?.getData("text/plain") ?? "";
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-cv-canva-layer]");
    const toId = row?.dataset.cvCanvaLayer ?? "";
    if (!fromId || !toId) return;
    applySectionOrder(fromId, toId);
  });

  docPanel.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-cv-canva-edit]") || t.closest("[data-cv-canva-entity]")) return;
    const block = t.closest<HTMLElement>("[data-cv-studio-selectable], section[data-cv-section]");
    if (!block || !docPanel.contains(block)) return;
    selectBlock(blockId(block) || null);
    refreshLayers();
  });

  /** Ctrl/⌘ + rueda: zoom del lienzo (misma idea que el estudio clásico). */
  root.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const t = e.target as Node;
      if (!workspace.contains(t) && t !== workspace) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      applyCanvasZoom(canvasZoom + dir * 0.06);
    },
    { passive: false, capture: true },
  );

  window.addEventListener("scroll", () => syncSelectionFrame(), { passive: true, capture: true });

  const docForRo = () => docPanel.querySelector<HTMLElement>("[data-cv-document]");

  window.addEventListener("resize", () => {
    syncSelectionFrame();
    const d = docForRo();
    if (d) paintPageGuidesInRoot(root, d);
  });
  const ro = new ResizeObserver(() => {
    syncSelectionFrame();
    const d = docForRo();
    if (d) paintPageGuidesInRoot(root, d);
  });
  queueMicrotask(() => {
    const d = docForRo();
    if (d) ro.observe(d);
  });

  /** Arrastre horizontal en handles E/W → mismo modelo que el slider de ancho. */
  let widthDrag: { startX: number; startPct: number; side: "e" | "w" } | null = null;

  const applyWidthPct = (pct: number) => {
    if (!selectedBlockId) return;
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = mergeCvStudioCanvasLayoutFromProfile(p);
    const v = Math.round(clamp(pct, WIDTH_MIN_PCT, WIDTH_MAX_PCT));
    const bw = { ...(lay.blockWidthsPct ?? {}) };
    if (v >= 100) delete bw[selectedBlockId];
    else bw[selectedBlockId] = v;
    if (Object.keys(bw).length === 0) delete lay.blockWidthsPct;
    else lay.blockWidthsPct = bw;
    widthRange.value = String(v);
    widthReadout.textContent = `${v}%`;
    persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
    const d0 = docForRo();
    if (d0) paintPageGuidesInRoot(root, d0);
    syncSelectionFrame();
  };

  selFrame.querySelectorAll<HTMLButtonElement>("[data-cv-canva-handle]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      if (!selectedBlockId) return;
      e.preventDefault();
      e.stopPropagation();
      const cur = readActiveSlot();
      if (!cur) return;
      const p = cur.documents[cur.idx]!.cvProfile ?? {};
      const lay = mergeCvStudioCanvasLayoutFromProfile(p);
      const w0 = lay.blockWidthsPct?.[selectedBlockId];
      const startPct = typeof w0 === "number" ? w0 : 100;
      const side = widthResizeSide(btn.getAttribute("data-cv-canva-handle") ?? "e");
      widthDrag = { startX: e.clientX, startPct, side };

      const onMove = (ev: PointerEvent) => {
        if (!widthDrag || !selectedBlockId) return;
        const docEl = docPanel.querySelector<HTMLElement>("[data-cv-document]");
        const dw = docEl?.getBoundingClientRect().width ?? docEl?.clientWidth ?? 1;
        const dx = ev.clientX - widthDrag.startX;
        const deltaPct = (dx / Math.max(1, dw)) * 100;
        const next =
          widthDrag.side === "e" ? widthDrag.startPct + deltaPct : widthDrag.startPct - deltaPct;
        applyWidthPct(next);
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        widthDrag = null;
        refreshLayers();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !selectedBlockId) return;
    selectBlock(null);
    refreshLayers();
    syncSelectionFrame();
  });

  widthRange.addEventListener("input", () => {
    if (!selectedBlockId) return;
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = mergeCvStudioCanvasLayoutFromProfile(p);
    const v = Number(widthRange.value);
    const bw = { ...(lay.blockWidthsPct ?? {}) };
    if (v >= 100) delete bw[selectedBlockId];
    else bw[selectedBlockId] = v;
    if (Object.keys(bw).length === 0) delete lay.blockWidthsPct;
    else lay.blockWidthsPct = bw;
    widthReadout.textContent = `${v}%`;
    persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
    const d1 = docForRo();
    if (d1) paintPageGuidesInRoot(root, d1);
    syncSelectionFrame();
  });

  scaleRange.addEventListener("input", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = mergeCvStudioCanvasLayoutFromProfile(p);
    const v = Math.min(120, Math.max(80, Math.round(Number(scaleRange.value))));
    scaleReadout.textContent = `${v}%`;
    if (v === 100) delete lay.fontScalePct;
    else lay.fontScalePct = v;
    persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
    const d = docForRo();
    if (d) paintPageGuidesInRoot(root, d);
    syncSelectionFrame();
  });

  templateSel.addEventListener("change", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    persistProfile({ ...p, cvTemplate: normalizeCvTemplateId(templateSel.value) });
  });
  pagesSel.addEventListener("change", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    persistProfile({ ...p, cvPrintMaxPages: clampCvPrintMaxPages(Number(pagesSel.value)) });
  });
  flowSel.addEventListener("change", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = mergeCvStudioCanvasLayoutFromProfile(p);
    if (flowSel.value === "two") lay.sectionFlow = "two";
    else delete lay.sectionFlow;
    persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
  });
  resetBtn?.addEventListener("click", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    persistProfile({ ...p, cvStudioCanvasLayout: undefined });
    selectedBlockId = null;
    selectBlock(null);
  });

  window.addEventListener("skillatlas:cv-studio-doc-painted", () => {
    ro.disconnect();
    const d = docForRo();
    if (d) {
      ro.observe(d);
      d.dataset.cvDocCanvaHeroChrome = "1";
    }
    refreshFromPrefs();
    refreshLayers();
    if (selectedBlockId) selectBlock(selectedBlockId);
    paintPageGuidesInRoot(root, d);
    syncSelectionFrame();
    setupCvCanvaInlineEdit(docPanel);
    setupCvCanvaHeroFieldResize(docPanel);
  });
  window.addEventListener("skillatlas:prefs-updated", () => {
    queueMicrotask(() => {
      refreshFromPrefs();
      refreshLayers();
      const d = docForRo();
      if (d) paintPageGuidesInRoot(root, d);
      syncSelectionFrame();
    });
  });

  refreshFromPrefs();
  setupCvCanvaFormatToolbar({ docPanel, formatBarHost });
  void bootCvStudioInlineDocument();
  delete root.dataset.cvCanvaV2Booting;
}

function scheduleBoot() {
  queueMicrotask(() => {
    if (!document.querySelector("[data-cv-canva-v2-root]")) return;
    bootCvCanvaV2();
  });
}

scheduleBoot();
document.addEventListener("astro:page-load", scheduleBoot);
document.addEventListener("astro:after-swap", scheduleBoot);
