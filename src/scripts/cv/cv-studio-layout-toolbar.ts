import i18next from "i18next";
import {
  buildCvDocumentsPrefsPatch,
  loadPrefs,
  migrateCvDocumentsIntoPrefs,
  updatePrefs,
  type CvDocumentSlotV1,
  type CvProfileV1,
} from "@scripts/core/prefs";
import { clampCvPrintMaxPages } from "@lib/cv-print-scale";
import { CV_TEMPLATE_IDS, normalizeCvTemplateId } from "@lib/cv-templates";
import { notifyCvEmbedPrefsSyncedExternally } from "@lib/cv-studio-prefs-channel";
import { compactCvStudioLayoutForPersist, mergeCvStudioCanvasLayoutFromProfile } from "@lib/cv-studio-layout";

const MM_TO_CSS_PX = 96 / 25.4;
const A4_HEIGHT_MM = 297;

function mm(n: number): number {
  return n * MM_TO_CSS_PX;
}

function tt(key: string, fb: string, opts?: Record<string, unknown>): string {
  const applyFb = () => {
    if (!opts) return fb;
    let out = fb;
    for (const [k, v] of Object.entries(opts)) out = out.replaceAll(`{{${k}}}`, String(v));
    return out;
  };
  try {
    if (!i18next.isInitialized) return applyFb();
    const v = i18next.t(key, opts);
    return typeof v === "string" && v.length > 0 && v !== key ? v : applyFb();
  } catch {
    return applyFb();
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

function populateTemplateSelect(sel: HTMLSelectElement) {
  sel.innerHTML = "";
  for (const id of CV_TEMPLATE_IDS) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = tt(templateLabelKey(id), id);
    sel.appendChild(opt);
  }
}

function updatePageGuides(wrap: HTMLElement, doc: HTMLElement) {
  const guides = wrap.querySelector<HTMLElement>("[data-cv-studio-page-guides]");
  if (!guides) return;

  const h = Math.max(doc.scrollHeight, doc.getBoundingClientRect().height);
  const pagePx = mm(A4_HEIGHT_MM);
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

function updatePagesReadout(el: HTMLElement | null, doc: HTMLElement | null) {
  if (!el) return;
  if (!doc) {
    el.textContent = tt("cv.studioPagesReadoutEmpty", "\u2014");
    return;
  }
  const h = Math.max(doc.scrollHeight, doc.getBoundingClientRect().height);
  const pagePx = mm(A4_HEIGHT_MM);
  const n = Math.max(1, Math.ceil(h / pagePx));
  el.textContent = tt("cv.studioPagesReadout", "~{{n}} páginas (aprox.). El PDF final puede variar un poco según el navegador.", { n });
}

function bootCvStudioLayoutToolbar() {
  const bar = document.querySelector<HTMLElement>("[data-cv-studio-maquette-bar]");
  const panel = document.querySelector<HTMLElement>("[data-cv-studio-doc-panel]");
  const wrap = document.querySelector<HTMLElement>("[data-cv-studio-pages-wrap]");
  const templateSel = document.querySelector<HTMLSelectElement>("[data-cv-studio-template]");
  const densitySel = document.querySelector<HTMLSelectElement>("[data-cv-studio-print-pages]");
  const flowSel = document.querySelector<HTMLSelectElement>("[data-cv-studio-section-flow]");
  const resetBtn = document.querySelector<HTMLButtonElement>("[data-cv-studio-reset-layout]");
  const readout = document.querySelector<HTMLElement>("[data-cv-studio-pages-readout]");
  if (!bar || !panel || !wrap || !templateSel || !densitySel || !flowSel) return;
  if (bar.dataset.cvStudioMaquetteBound === "1") return;
  bar.dataset.cvStudioMaquetteBound = "1";

  populateTemplateSelect(templateSel);

  densitySel.innerHTML = "";
  for (let p = 1; p <= 6; p++) {
    const opt = document.createElement("option");
    opt.value = String(p);
    opt.textContent = tt("cv.studioPrintPagesOption", "{{n}} página(s) objetivo", { n: p });
    densitySel.appendChild(opt);
  }

  let docObs: ResizeObserver | null = null;

  const attachDoc = (doc: HTMLElement) => {
    updatePageGuides(wrap, doc);
    updatePagesReadout(readout, doc);
    docObs?.disconnect();
    docObs = new ResizeObserver(() => {
      updatePageGuides(wrap, doc);
      updatePagesReadout(readout, doc);
    });
    docObs.observe(doc);
  };

  const findDoc = () => panel.querySelector<HTMLElement>("[data-cv-document]");

  const refreshDocBinding = () => {
    const doc = findDoc();
    if (doc) attachDoc(doc);
    else {
      docObs?.disconnect();
      docObs = null;
      updatePagesReadout(readout, null);
      const guides = wrap.querySelector<HTMLElement>("[data-cv-studio-page-guides]");
      if (guides) guides.innerHTML = "";
    }
  };

  const syncSelectsFromPrefs = () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    templateSel.value = normalizeCvTemplateId(p.cvTemplate);
    densitySel.value = String(clampCvPrintMaxPages(p.cvPrintMaxPages));
    flowSel.value = p.cvStudioCanvasLayout?.sectionFlow === "two" ? "two" : "single";
  };

  const pushPrefs = (nextProfile: CvProfileV1) => {
    const cur = readActiveSlot();
    if (!cur) return;
    const next = [...cur.documents];
    next[cur.idx] = { ...next[cur.idx]!, cvProfile: nextProfile };
    updatePrefs(buildCvDocumentsPrefsPatch(next, cur.activeId));
    notifyCvEmbedPrefsSyncedExternally();
  };

  templateSel.addEventListener("change", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    pushPrefs({ ...p, cvTemplate: normalizeCvTemplateId(templateSel.value) });
  });

  densitySel.addEventListener("change", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    pushPrefs({ ...p, cvPrintMaxPages: clampCvPrintMaxPages(Number(densitySel.value)) });
  });

  flowSel.addEventListener("change", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    const lay = mergeCvStudioCanvasLayoutFromProfile(p);
    if (flowSel.value === "two") lay.sectionFlow = "two";
    else delete lay.sectionFlow;
    pushPrefs({ ...p, cvStudioCanvasLayout: compactCvStudioLayoutForPersist(lay) });
  });

  resetBtn?.addEventListener("click", () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    pushPrefs({ ...p, cvStudioCanvasLayout: undefined });
  });

  window.addEventListener("skillatlas:prefs-updated", () => {
    syncSelectsFromPrefs();
    queueMicrotask(() => {
      const doc = findDoc();
      if (doc) {
        updatePageGuides(wrap, doc);
        updatePagesReadout(readout, doc);
      }
    });
  });

  syncSelectsFromPrefs();

  /** Mutaciones solo de guías / notas / chrome del estudio no deben disparar rebinding (evita bucles). */
  const mutationShouldRefreshDocBinding = (records: MutationRecord[]): boolean =>
    records.some((r) => {
      const raw = r.target;
      const el =
        raw.nodeType === Node.ELEMENT_NODE
          ? (raw as Element)
          : raw.parentElement && raw.parentElement instanceof Element
            ? raw.parentElement
            : null;
      if (!el) return true;
      if (el.closest("[data-cv-studio-page-guides]")) return false;
      if (el.closest("[data-cv-studio-sticky-mount]")) return false;
      if (el.closest(".cv-studio-block-chrome")) return false;
      if (el.closest(".cv-studio-sticky-note")) return false;
      return true;
    });

  let refreshMoScheduled = false;
  const scheduleDocRefreshFromMo = () => {
    if (refreshMoScheduled) return;
    refreshMoScheduled = true;
    queueMicrotask(() => {
      refreshMoScheduled = false;
      refreshDocBinding();
    });
  };

  const mo = new MutationObserver((records) => {
    if (!mutationShouldRefreshDocBinding(records)) return;
    scheduleDocRefreshFromMo();
  });
  mo.observe(panel, { childList: true, subtree: true });
  refreshDocBinding();

  window.addEventListener(
    "skillatlas:lang-picker-sync",
    () => {
      populateTemplateSelect(templateSel);
      syncSelectsFromPrefs();
      let o = 1;
      for (const opt of densitySel.options) {
        opt.textContent = tt("cv.studioPrintPagesOption", "{{n}} página(s) objetivo", { n: o });
        o++;
      }
      const doc = findDoc();
      updatePagesReadout(readout, doc);
    },
    { passive: true },
  );
}

function scheduleBoot() {
  queueMicrotask(() => {
    if (!document.querySelector("[data-cv-studio-maquette-bar]")) return;
    bootCvStudioLayoutToolbar();
  });
}

scheduleBoot();
document.addEventListener("astro:page-load", scheduleBoot);
document.addEventListener("astro:after-swap", scheduleBoot);
