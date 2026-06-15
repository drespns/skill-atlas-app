import i18next from "i18next";
import {
  buildCvDocumentsPrefsPatch,
  loadPrefs,
  migrateCvDocumentsIntoPrefs,
  updatePrefs,
  type CvDocumentSlotV1,
  type CvProfileV1,
} from "@scripts/core/prefs";
import {
  compactCvStudioLayoutForPersist,
  mergeCvStudioCanvasLayoutFromProfile,
  type CvStudioCanvasLayoutV1,
  type CvStudioStickyNoteV1,
} from "@lib/cv-studio-layout";
import { normalizeCvDocumentSectionOrder, type CvDocumentSectionId } from "@lib/cv-document-section-order";
import { notifyCvEmbedPrefsSyncedExternally } from "@lib/cv-studio-prefs-channel";

function tt(key: string, fb: string): string {
  try {
    if (!i18next.isInitialized) return fb;
    const v = i18next.t(key);
    return typeof v === "string" && v.length > 0 && v !== key ? v : fb;
  } catch {
    return fb;
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

function getLayout(profile: CvProfileV1): CvStudioCanvasLayoutV1 {
  return mergeCvStudioCanvasLayoutFromProfile(profile);
}

function reorderSectionOrder(order: CvDocumentSectionId[], fromId: string, beforeId: string): CvDocumentSectionId[] | null {
  const fi = order.indexOf(fromId as CvDocumentSectionId);
  const bi = order.indexOf(beforeId as CvDocumentSectionId);
  if (fi < 0 || bi < 0 || fi === bi) return null;
  const next = order.filter((id) => id !== fromId);
  const insertAt = next.indexOf(beforeId as CvDocumentSectionId);
  if (insertAt < 0) return null;
  next.splice(insertAt, 0, fromId as CvDocumentSectionId);
  return next as CvDocumentSectionId[];
}

function stripChrome(panel: HTMLElement) {
  panel.querySelectorAll(".cv-studio-block-chrome").forEach((n) => n.remove());
}

function newStickyId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `sticky-${crypto.randomUUID()}`;
  } catch {
    /* ignore */
  }
  return `sticky-${Date.now().toString(36)}`;
}

function renderStickyNotes(mount: HTMLElement, notes: CvStudioStickyNoteV1[], onChange: () => void) {
  mount.innerHTML = "";
  for (const sn of notes) {
    const wrap = document.createElement("div");
    wrap.className =
      "cv-studio-sticky-note pointer-events-auto absolute z-[20] rounded-lg border border-amber-200/90 bg-amber-50/98 p-2 shadow-lg dark:border-amber-900/60 dark:bg-amber-950/90 print:hidden";
    wrap.dataset.stickyId = sn.id;
    wrap.style.left = `${sn.xPct}%`;
    wrap.style.top = `${sn.yPx}px`;
    wrap.style.width = `${sn.wPct}%`;
    wrap.style.minWidth = "120px";

    const head = document.createElement("div");
    head.className = "mb-1 flex items-center justify-between gap-1";
    const drag = document.createElement("button");
    drag.type = "button";
    drag.className =
      "cursor-grab rounded px-1 text-[11px] font-semibold text-amber-900/80 hover:bg-amber-100/80 dark:text-amber-100 dark:hover:bg-amber-900/50";
    drag.textContent = "⠿";
    drag.title = tt("cv.studioStickyDrag", "Arrastrar nota");
    const del = document.createElement("button");
    del.type = "button";
    del.className =
      "rounded px-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40";
    del.textContent = "×";
    del.title = tt("cv.studioStickyDelete", "Eliminar nota");
    head.appendChild(drag);
    head.appendChild(del);

    const ta = document.createElement("div");
    ta.className =
      "max-h-40 min-h-[3.5rem] overflow-auto rounded border border-amber-200/80 bg-white/90 px-2 py-1.5 text-[11px] leading-snug text-gray-900 outline-none dark:border-amber-900/50 dark:bg-gray-900/80 dark:text-gray-100";
    ta.contentEditable = "true";
    ta.role = "textbox";
    ta.setAttribute("aria-multiline", "true");
    ta.textContent = sn.body;
    ta.addEventListener("blur", () => {
      const cur = readActiveSlot();
      if (!cur) return;
      const p = cur.documents[cur.idx]!.cvProfile ?? {};
      const lay = getLayout(p);
      const list = [...(lay.stickyNotes ?? [])];
      const i = list.findIndex((x) => x.id === sn.id);
      if (i >= 0) {
        list[i] = { ...list[i]!, body: ta.textContent ?? "" };
        lay.stickyNotes = list;
        persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
      }
    });

    let dragLive: { startX: number; startY: number; baseXPct: number; baseYPx: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (!dragLive) return;
      const mr = mount.getBoundingClientRect();
      const dx = e.clientX - dragLive.startX;
      const dy = e.clientY - dragLive.startY;
      let xPct = dragLive.baseXPct + (dx / mr.width) * 100;
      let yPx = dragLive.baseYPx + dy;
      xPct = Math.min(88, Math.max(0, xPct));
      yPx = Math.min(12000, Math.max(0, yPx));
      wrap.style.left = `${xPct}%`;
      wrap.style.top = `${yPx}px`;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragLive) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        drag.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const mr = mount.getBoundingClientRect();
      const dl = dragLive;
      dragLive = null;
      const dx = e.clientX - dl.startX;
      const dy = e.clientY - dl.startY;
      let xPct = dl.baseXPct + (dx / mr.width) * 100;
      let yPx = dl.baseYPx + dy;
      xPct = Math.min(88, Math.max(0, xPct));
      yPx = Math.min(12000, Math.max(0, yPx));
      const cur = readActiveSlot();
      if (!cur) return;
      const p = cur.documents[cur.idx]!.cvProfile ?? {};
      const lay = getLayout(p);
      const list = [...(lay.stickyNotes ?? [])];
      const i = list.findIndex((x) => x.id === sn.id);
      if (i >= 0) {
        list[i] = { ...list[i]!, xPct, yPx };
        lay.stickyNotes = list;
        persistProfile({ ...p, cvStudioCanvasLayout: lay });
      }
      onChange();
    };
    drag.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      ta.blur();
      dragLive = { startX: e.clientX, startY: e.clientY, baseXPct: sn.xPct, baseYPx: sn.yPx };
      drag.setPointerCapture(e.pointerId);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    del.addEventListener("click", () => {
      const cur = readActiveSlot();
      if (!cur) return;
      const p = cur.documents[cur.idx]!.cvProfile ?? {};
      const lay = getLayout(p);
      lay.stickyNotes = (lay.stickyNotes ?? []).filter((x) => x.id !== sn.id);
      if (!lay.stickyNotes.length) delete lay.stickyNotes;
      persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
      onChange();
    });

    wrap.appendChild(head);
    wrap.appendChild(ta);
    mount.appendChild(wrap);
  }
}

function attachSectionChrome(panel: HTMLElement, sectionEl: HTMLElement, sectionId: CvDocumentSectionId, layout: CvStudioCanvasLayoutV1) {
  const chrome = document.createElement("div");
  chrome.className =
    "cv-studio-block-chrome print:hidden relative z-[8] mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200/90 bg-violet-50/95 px-2 py-1.5 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/80";

  const dragBtn = document.createElement("button");
  dragBtn.type = "button";
  dragBtn.className =
    "rounded border border-violet-300/60 bg-white px-1.5 py-0.5 text-[12px] leading-none text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-gray-900 dark:text-violet-100 dark:hover:bg-violet-950";
  dragBtn.textContent = "⠿";
  dragBtn.title = tt("cv.studioBlockDragSection", "Arrastrar para reordenar sección");
  dragBtn.dataset.cvStudioDragSection = sectionId;

  const lab = document.createElement("label");
  lab.className = "flex items-center gap-1.5 text-[10px] font-medium text-violet-900 dark:text-violet-100";
  lab.innerHTML = `<span>${tt("cv.studioBlockWidth", "Ancho")}</span>`;
  const range = document.createElement("input");
  range.type = "range";
  range.min = "55";
  range.max = "100";
  range.step = "1";
  const w = layout.blockWidthsPct?.[sectionId];
  range.value = String(typeof w === "number" && w < 100 ? w : 100);
  range.className = "h-1.5 w-24 accent-violet-600";
  range.addEventListener("input", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = getLayout(p);
    const v = Number(range.value);
    const bw = { ...(lay.blockWidthsPct ?? {}) };
    if (v >= 100) delete bw[sectionId];
    else bw[sectionId] = v;
    if (Object.keys(bw).length === 0) delete lay.blockWidthsPct;
    else lay.blockWidthsPct = bw;
    persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
  });
  lab.appendChild(range);

  chrome.appendChild(dragBtn);
  chrome.appendChild(lab);

  let dragFrom: string | null = null;
  dragBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragFrom = sectionId;
    dragBtn.setPointerCapture(e.pointerId);
  });
  dragBtn.addEventListener("pointerup", (e) => {
    try {
      dragBtn.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!dragFrom || dragFrom !== sectionId) return;
    const stack = document.elementsFromPoint(e.clientX, e.clientY);
    let targetSec: HTMLElement | null = null;
    for (const node of stack) {
      if (!(node instanceof Element)) continue;
      const s = node.closest<HTMLElement>("section[data-cv-section]");
      if (s && panel.contains(s)) {
        targetSec = s;
        break;
      }
    }
    const toId = targetSec?.dataset.cvSection?.trim();
    if (!toId || toId === sectionId) return;
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const order = normalizeCvDocumentSectionOrder(p.cvDocumentSectionOrder) as CvDocumentSectionId[];
    const next = reorderSectionOrder(order, sectionId, toId);
    if (!next) return;
    persistProfile({ ...p, cvDocumentSectionOrder: next });
    dragFrom = null;
  });
  dragBtn.addEventListener("pointercancel", () => {
    dragFrom = null;
  });

  sectionEl.prepend(chrome);
}

function attachWidthOnlyChrome(el: HTMLElement, key: string, layout: CvStudioCanvasLayoutV1) {
  const chrome = document.createElement("div");
  chrome.className =
    "cv-studio-block-chrome print:hidden relative z-[8] mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200/90 bg-violet-50/95 px-2 py-1.5 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/80";

  const lab = document.createElement("label");
  lab.className = "flex items-center gap-1.5 text-[10px] font-medium text-violet-900 dark:text-violet-100";
  lab.innerHTML = `<span>${tt("cv.studioBlockWidth", "Ancho")}</span>`;
  const range = document.createElement("input");
  range.type = "range";
  range.min = "55";
  range.max = "100";
  range.step = "1";
  const w = layout.blockWidthsPct?.[key];
  range.value = String(typeof w === "number" && w < 100 ? w : 100);
  range.className = "h-1.5 w-24 accent-violet-600";
  range.addEventListener("input", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = getLayout(p);
    const v = Number(range.value);
    const bw = { ...(lay.blockWidthsPct ?? {}) };
    if (v >= 100) delete bw[key];
    else bw[key] = v;
    if (Object.keys(bw).length === 0) delete lay.blockWidthsPct;
    else lay.blockWidthsPct = bw;
    persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
  });
  lab.appendChild(range);
  chrome.appendChild(lab);
  el.prepend(chrome);
}

function refreshStickyMountOnly() {
  const mount = document.querySelector<HTMLElement>("[data-cv-studio-sticky-mount]");
  if (!mount) return;
  const cur = readActiveSlot();
  if (!cur) return;
  const p = cur.documents[cur.idx]!.cvProfile ?? {};
  const lay = getLayout(p);
  const refresh = () => refreshStickyMountOnly();
  renderStickyNotes(mount, lay.stickyNotes ?? [], refresh);
}

function runStudioCanvasChromeBind() {
  const panel = document.querySelector<HTMLElement>("[data-cv-studio-doc-panel]");
  const mount = document.querySelector<HTMLElement>("[data-cv-studio-sticky-mount]");
  const root = document.querySelector<HTMLElement>("[data-cv-studio-canvas-root][data-cv-studio-layout=inline]");
  if (!root || !panel || !mount) return;

  if (!panel.classList.contains("hidden")) {
    stripChrome(panel);
    const cur = readActiveSlot();
    const doc = panel.querySelector<HTMLElement>("[data-cv-document]");
    if (!cur || !doc) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = getLayout(p);

    const hero = doc.querySelector<HTMLElement>('[data-cv-weight="hero"]');
    if (hero) attachWidthOnlyChrome(hero, "hero", lay);

    const band = doc.querySelector<HTMLElement>("[data-cv-doc-tech-featured-band]");
    if (band && !band.classList.contains("hidden")) attachWidthOnlyChrome(band, "techFeaturedBand", lay);

    doc.querySelectorAll<HTMLElement>("section[data-cv-section]").forEach((sec) => {
      const id = sec.dataset.cvSection?.trim() as CvDocumentSectionId | undefined;
      if (!id) return;
      if (sec.classList.contains("hidden")) return;
      attachSectionChrome(panel, sec, id, lay);
    });

    const refresh = () => refreshStickyMountOnly();
    renderStickyNotes(mount, lay.stickyNotes ?? [], refresh);
  }
}

type WindowWithStudioBlocks = Window & { __skillatlasCvStudioCanvasBlocks?: boolean };

function initCvStudioCanvasBlocksListenersOnce() {
  const w = window as WindowWithStudioBlocks;
  if (w.__skillatlasCvStudioCanvasBlocks) return;
  w.__skillatlasCvStudioCanvasBlocks = true;

  window.addEventListener("skillatlas:cv-studio-doc-painted", () => runStudioCanvasChromeBind());
  window.addEventListener("skillatlas:prefs-updated", () => queueMicrotask(refreshStickyMountOnly));

  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-cv-studio-add-sticky]");
    if (!btn) return;
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = getLayout(p);
    const notes = [...(lay.stickyNotes ?? [])];
    notes.push({
      id: newStickyId(),
      body: "",
      xPct: 8,
      yPx: 48,
      wPct: 42,
    });
    lay.stickyNotes = notes;
    persistProfile({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
    refreshStickyMountOnly();
  });
}

function scheduleBoot() {
  queueMicrotask(() => {
    if (!document.querySelector("[data-cv-studio-layout=inline]")) return;
    initCvStudioCanvasBlocksListenersOnce();
    runStudioCanvasChromeBind();
  });
}

scheduleBoot();
document.addEventListener("astro:page-load", scheduleBoot);
document.addEventListener("astro:after-swap", scheduleBoot);
