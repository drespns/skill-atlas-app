import type { CvManualAssignment } from "./cv-manual-import-map";
import { manualTargetMarkClass, normalizeManualAssignments } from "./cv-manual-import-map";

/** Superficie seleccionable: mismos rangos que el texto fuente vía data-s / data-e en cada trozo. */
export function renderManualImportSurface(
  el: HTMLElement,
  text: string,
  assignments: CvManualAssignment[],
  emptyHint: string,
): void {
  el.replaceChildren();
  const doc = el.ownerDocument;
  if (!text.trim()) {
    const p = doc.createElement("p");
    p.className = "m-0 text-sm text-gray-500 dark:text-gray-400 pointer-events-none select-none";
    p.textContent = emptyHint;
    el.appendChild(p);
    return;
  }

  const norm = normalizeManualAssignments(text, assignments);
  const cov: (number | null)[] = new Array(text.length).fill(null);
  for (let ai = 0; ai < norm.length; ai++) {
    const a = norm[ai]!;
    for (let p = a.start; p < a.end; p++) cov[p] = ai;
  }

  let i = 0;
  while (i < text.length) {
    const idx = cov[i];
    let j = i + 1;
    while (j < text.length && cov[j] === idx) j++;
    const slice = text.slice(i, j);
    if (idx === null) {
      const span = doc.createElement("span");
      span.dataset.s = String(i);
      span.dataset.e = String(j);
      span.appendChild(doc.createTextNode(slice));
      el.appendChild(span);
    } else {
      const mark = doc.createElement("mark");
      mark.dataset.s = String(i);
      mark.dataset.e = String(j);
      mark.className = `${manualTargetMarkClass(norm[idx]!.target)} rounded-sm`;
      mark.appendChild(doc.createTextNode(slice));
      el.appendChild(mark);
    }
    i = j;
  }
}

function offsetInSegment(surface: HTMLElement, container: Node, offset: number): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const parent = container.parentElement;
    if (!parent || !surface.contains(parent)) return null;
    const seg = parent.closest("[data-s][data-e]") as HTMLElement | null;
    if (!seg?.dataset.s || !seg.dataset.e) return null;
    const s = parseInt(seg.dataset.s, 10);
    const e = parseInt(seg.dataset.e, 10);
    const len = container.textContent?.length ?? 0;
    const o = Math.min(Math.max(0, offset), len);
    const abs = s + o;
    return Math.min(Math.max(s, abs), e);
  }
  if (container.nodeType === Node.ELEMENT_NODE) {
    const el = container as HTMLElement;
    if (el === surface) {
      if (offset >= el.childNodes.length) {
        const last = el.lastElementChild as HTMLElement | null;
        if (last?.dataset.e) return parseInt(last.dataset.e, 10);
        return null;
      }
      const ch = el.childNodes[offset];
      if (!ch) return null;
      if (ch.nodeType === Node.TEXT_NODE) return offsetInSegment(surface, ch, 0);
      if (ch.nodeType === Node.ELEMENT_NODE) {
        const h = ch as HTMLElement;
        if (h.dataset.s !== undefined) return parseInt(h.dataset.s, 10);
      }
      return null;
    }
    if (el.hasAttribute("data-s") && el.hasAttribute("data-e")) {
      if (offset === 0) return parseInt(el.dataset.s!, 10);
      if (offset >= el.childNodes.length) return parseInt(el.dataset.e!, 10);
      const ch = el.childNodes[offset];
      if (ch?.nodeType === Node.TEXT_NODE) return offsetInSegment(surface, ch, 0);
    }
  }
  return null;
}

export function getSurfaceSelectionSourceOffsets(surface: HTMLElement | null): { start: number; end: number } | null {
  if (!surface) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!surface.contains(range.commonAncestorContainer)) return null;

  const a = offsetInSegment(surface, range.startContainer, range.startOffset);
  const b = offsetInSegment(surface, range.endContainer, range.endOffset);
  if (a === null || b === null) return null;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

export function getSurfaceSelectionClientRect(surface: HTMLElement | null): DOMRect | null {
  if (!surface) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!surface.contains(range.commonAncestorContainer)) return null;
  const br = range.getBoundingClientRect();
  if (br.width < 1 && br.height < 1) return null;
  return br;
}

/** Rect at the focus end of the selection (caret side), for anchoring UI while extending multi-line ranges. */
export function getSurfaceSelectionEndCaretRect(surface: HTMLElement | null): DOMRect | null {
  if (!surface) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!surface.contains(range.commonAncestorContainer)) return null;
  const endRange = range.cloneRange();
  endRange.collapse(false);
  const br = endRange.getBoundingClientRect();
  if (br.width > 0 && br.height > 0) return br;
  const rects = range.getClientRects();
  if (rects.length > 0) {
    const last = rects[rects.length - 1]!;
    return new DOMRect(last.left, last.top, Math.max(last.width, 2), last.height);
  }
  if (br.height > 0) return new DOMRect(br.left, br.top, Math.max(br.width, 2), br.height);
  return new DOMRect(br.left, br.top, 2, 18);
}
