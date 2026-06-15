const SELECTED_CLASS = "cv-studio-block--selected";
const SELECTED_DATASET = "cvStudioSelectedBlock";

function selectableSelector(): string {
  return "[data-cv-studio-selectable], section[data-cv-section]";
}

function blockId(el: HTMLElement): string {
  return el.getAttribute("data-cv-studio-selectable") ?? el.getAttribute("data-cv-section") ?? "";
}

function findSelectableFromEvent(target: EventTarget | null, panel: HTMLElement): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest("a, button, input, select, textarea, label")) return null;
  const block = target.closest<HTMLElement>(selectableSelector());
  if (!block || !panel.contains(block)) return null;
  return block;
}

function clearSelectionVisual(panel: HTMLElement): void {
  panel.querySelectorAll(`.${SELECTED_CLASS}`).forEach((n) => n.classList.remove(SELECTED_CLASS));
}

function emitBlockSelection(blockId: string | null): void {
  window.dispatchEvent(new CustomEvent("skillatlas:cv-studio-block-selected", { detail: { blockId } }));
}

function clearSelection(panel: HTMLElement): void {
  clearSelectionVisual(panel);
  delete panel.dataset[SELECTED_DATASET];
  emitBlockSelection(null);
}

function applySelection(panel: HTMLElement, el: HTMLElement): void {
  clearSelectionVisual(panel);
  el.classList.add(SELECTED_CLASS);
  const id = blockId(el);
  if (id) panel.dataset[SELECTED_DATASET] = id;
  else delete panel.dataset[SELECTED_DATASET];
  emitBlockSelection(id || null);
}

/** Reaplica el borde de foco tras un `renderCvDocument` (DOM sustituido dentro de secciones). */
export function syncCvStudioBlockSelection(panel: HTMLElement): void {
  clearSelectionVisual(panel);
  const id = panel.dataset[SELECTED_DATASET];
  if (!id) return;
  const el =
    panel.querySelector<HTMLElement>(`[data-cv-studio-selectable="${CSS.escape(id)}"]`) ??
    panel.querySelector<HTMLElement>(`section[data-cv-section="${CSS.escape(id)}"]`);
  if (el) el.classList.add(SELECTED_CLASS);
}

export function clearCvStudioBlockSelection(panel: HTMLElement): void {
  clearSelection(panel);
}

export function bindCvStudioBlockSelection(panel: HTMLElement): void {
  if (panel.dataset.cvStudioBlocksBound === "1") return;
  panel.dataset.cvStudioBlocksBound = "1";

  const onClickCapture = (e: MouseEvent) => {
    const block = findSelectableFromEvent(e.target, panel);
    if (block) {
      applySelection(panel, block);
      return;
    }
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.closest("a, button, input, select, textarea")) return;
    if (t.closest("[data-cv-document]")) clearSelection(panel);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (!panel.isConnected) return;
    clearSelection(panel);
  };

  panel.addEventListener("click", onClickCapture, true);
  document.addEventListener("keydown", onKeyDown);
}
