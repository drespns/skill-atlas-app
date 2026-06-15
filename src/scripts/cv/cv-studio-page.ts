import i18next from "i18next";
import {
  buildCvDocumentsPrefsPatch,
  loadPrefs,
  migrateCvDocumentsIntoPrefs,
  updatePrefs,
  type CvDocumentSlotV1,
} from "@scripts/core/prefs";
import { normalizeCvDocumentSectionOrder, type CvDocumentSectionId } from "@lib/cv-document-section-order";
import { cvStudioSectionLabel } from "@lib/cv-studio-section-labels";
import { notifyCvEmbedPrefsSyncedExternally } from "@lib/cv-studio-prefs-channel";
import { showToast } from "@scripts/core/ui-feedback";

function tt(key: string, fb: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fb;
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function reorderStrings(arr: string[], from: number, to: number): string[] | null {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return null;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function dropRowFromPoint(root: HTMLElement, cx: number, cy: number, sel: string): HTMLElement | null {
  for (const node of document.elementsFromPoint(cx, cy)) {
    if (!(node instanceof HTMLElement)) continue;
    const row = node.closest<HTMLElement>(sel);
    if (row && root.contains(row)) return row;
  }
  return null;
}

function bootCvStudio() {
  const root = document.querySelector<HTMLElement>("[data-cv-studio-root]");
  const list = document.querySelector<HTMLElement>("[data-cv-studio-section-order]");
  if (!root || !list) return;

  let prefs = migrateCvDocumentsIntoPrefs(loadPrefs());
  let documents = prefs.cvDocuments ?? [];
  const activeId = prefs.cvActiveDocumentId ?? documents[0]?.id ?? "";
  let slotIdx = documents.findIndex((d) => d.id === activeId);

  const readOrder = (): CvDocumentSectionId[] =>
    normalizeCvDocumentSectionOrder(documents[slotIdx]?.cvProfile?.cvDocumentSectionOrder) as CvDocumentSectionId[];

  const persistOrder = (order: string[]) => {
    if (slotIdx < 0 || !documents[slotIdx]) return;
    const slot = documents[slotIdx]!;
    const nextDocs: CvDocumentSlotV1[] = [...documents];
    nextDocs[slotIdx] = {
      ...slot,
      cvProfile: {
        ...slot.cvProfile,
        cvDocumentSectionOrder: order,
      },
    };
    documents = nextDocs;
    prefs = updatePrefs(buildCvDocumentsPrefsPatch(nextDocs, activeId));
    showToast(tt("cv.studioOrderSaved", "Orden guardado."), "success");
    notifyCvEmbedPrefsSyncedExternally();
  };

  const renderList = () => {
    const order = readOrder();
    const dragHint = tt("cv.studioDragHandleHint", "Arrastra el asa para reordenar las secciones del PDF.");
    if (slotIdx < 0) {
      list.innerHTML = `<li class="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">${escHtml(
        tt("cv.studioOrderNoDoc", "No hay un CV activo en preferencias."),
      )}</li>`;
      return;
    }
    list.innerHTML = order
      .map((id, idx) => {
        const lbl = cvStudioSectionLabel(id, tt);
        return `<li data-cv-studio-sec-row="${idx}" class="flex items-center gap-2 rounded-lg border border-gray-200/90 bg-white/90 px-2 py-2 text-sm dark:border-gray-800 dark:bg-gray-950/60">
          <div data-cv-studio-sec-handle draggable="true" tabindex="-1" title="${escAttr(dragHint)}" aria-label="${escAttr(dragHint)}" class="flex w-8 shrink-0 cursor-grab touch-none select-none flex-col items-center justify-center rounded border border-gray-200/80 bg-gray-50 py-1.5 text-[11px] text-gray-400 dark:border-gray-800 dark:bg-gray-900/50 active:cursor-grabbing">⋮⋮</div>
          <span class="min-w-0 flex-1 font-medium text-gray-800 dark:text-gray-200">${escHtml(lbl)}</span>
        </li>`;
      })
      .join("");
  };

  if (list.dataset.studioSecBound !== "1") {
    list.dataset.studioSecBound = "1";
    list.addEventListener("dragstart", (e) => {
      const h = (e.target as HTMLElement).closest<HTMLElement>("[data-cv-studio-sec-handle]");
      if (!h || !list.contains(h)) return;
      const row = h.closest<HTMLElement>("[data-cv-studio-sec-row]");
      if (!row) return;
      const dt = e.dataTransfer;
      if (dt) {
        dt.setData("text/plain", `cvstud:${row.getAttribute("data-cv-studio-sec-row") ?? ""}`);
        dt.effectAllowed = "move";
      }
      row.classList.add("opacity-60");
    });
    list.addEventListener("dragend", (e) => {
      const h = (e.target as HTMLElement).closest<HTMLElement>("[data-cv-studio-sec-handle]");
      const row =
        h?.closest<HTMLElement>("[data-cv-studio-sec-row]") ?? (e.target as HTMLElement).closest<HTMLElement>("[data-cv-studio-sec-row]");
      row?.classList.remove("opacity-60");
      list.querySelectorAll("[data-cv-studio-sec-row]").forEach((el) => el.classList.remove("ring-2", "ring-indigo-400/40"));
    });
    list.addEventListener("dragover", (e) => {
      if (!list.contains(e.target as Node)) return;
      e.preventDefault();
      const dt = e.dataTransfer;
      if (dt) dt.dropEffect = "move";
      const row =
        (e.target as HTMLElement).closest<HTMLElement>("[data-cv-studio-sec-row]") ??
        dropRowFromPoint(list, e.clientX, e.clientY, "[data-cv-studio-sec-row]");
      list.querySelectorAll("[data-cv-studio-sec-row]").forEach((el) => el.classList.remove("ring-2", "ring-indigo-400/40"));
      if (row && list.contains(row)) row.classList.add("ring-2", "ring-indigo-400/40");
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      let row = (e.target as HTMLElement).closest<HTMLElement>("[data-cv-studio-sec-row]");
      if (!row || !list.contains(row)) row = dropRowFromPoint(list, e.clientX, e.clientY, "[data-cv-studio-sec-row]");
      if (!row || !list.contains(row)) return;
      row.classList.remove("ring-2", "ring-indigo-400/40");
      const raw = e.dataTransfer?.getData("text/plain") ?? "";
      if (!raw.startsWith("cvstud:")) return;
      const from = Number(raw.slice(7));
      const to = Number(row.getAttribute("data-cv-studio-sec-row"));
      const cur = readOrder();
      const next = reorderStrings(cur as string[], from, to);
      if (!next) return;
      persistOrder(next);
      renderList();
    });
  }

  slotIdx = documents.findIndex((d) => d.id === activeId);
  const hint = document.querySelector<HTMLElement>("[data-cv-studio-order-hint]");
  if (hint) {
    hint.textContent =
      slotIdx < 0
        ? tt("cv.studioOrderNoDoc", "No hay un CV activo en preferencias.")
        : tt("cv.studioOrderHint", "Los cambios se guardan en este navegador y se reflejan al recargar el documento en vivo.");
  }
  renderList();
}

function waitI18nThenBoot() {
  const tick = () => {
    if (!i18next.isInitialized) {
      requestAnimationFrame(tick);
      return;
    }
    bootCvStudio();
  };
  tick();
}

waitI18nThenBoot();

document.addEventListener("astro:after-swap", () => {
  if (document.querySelector("[data-cv-studio-root]")) waitI18nThenBoot();
});
