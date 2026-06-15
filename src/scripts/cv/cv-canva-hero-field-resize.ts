import type { CvHeroResizeFieldId } from "@lib/cv-studio-layout";
import { patchActiveCanvasLayout } from "@scripts/cv/cv-canva-inline-edit";

let heroResizeObserver: ResizeObserver | null = null;

/**
 * Persiste anchuras de franjas del titular (hero) tras redimensionar con el asa nativo.
 * Se vuelve a registrar tras cada repintado del documento.
 */
export function setupCvCanvaHeroFieldResize(docPanel: HTMLElement) {
  const doc = docPanel.querySelector<HTMLElement>("[data-cv-document]");
  if (!doc || doc.dataset.cvDocCanvaHeroChrome !== "1") return;

  const col = doc.querySelector<HTMLElement>("[data-cv-hero-text-column]");
  if (!col) return;

  heroResizeObserver?.disconnect();
  heroResizeObserver = null;

  let t: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    const wCol = col.clientWidth;
    if (wCol < 80) return;
    const inners = doc.querySelectorAll<HTMLElement>("[data-cv-hero-resize-wrap] .cv-hero-resize-inner");
    for (const inner of inners) {
      // `overflow: auto` + barra de desplazamiento puede encoger `clientWidth` y crear un bucle al persistir %.
      if (inner.scrollWidth > inner.clientWidth + 4) return;
    }
    patchActiveCanvasLayout((lay) => {
      const nextWidths: Partial<Record<CvHeroResizeFieldId, number>> = { ...(lay.heroFieldWidthsPct ?? {}) };
      doc.querySelectorAll<HTMLElement>("[data-cv-hero-resize-wrap]").forEach((wrap) => {
        const id = wrap.dataset.cvHeroResizeWrap as CvHeroResizeFieldId | undefined;
        const inner = wrap.querySelector<HTMLElement>(".cv-hero-resize-inner");
        if (!id || !inner) return;
        const pct = Math.round((inner.getBoundingClientRect().width / wCol) * 100);
        if (pct >= 98) delete nextWidths[id];
        else if (pct >= 28 && pct < 98) nextWidths[id] = pct;
      });
      return { ...lay, heroFieldWidthsPct: Object.keys(nextWidths).length > 0 ? nextWidths : undefined };
    });
  };

  const schedule = () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      flush();
    }, 400);
  };

  const ro = new ResizeObserver(() => schedule());
  heroResizeObserver = ro;
  doc.querySelectorAll<HTMLElement>(".cv-hero-resize-inner").forEach((el) => ro.observe(el));
}
