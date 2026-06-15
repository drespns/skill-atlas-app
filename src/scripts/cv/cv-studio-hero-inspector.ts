import i18next from "i18next";
import {
  buildCvDocumentsPrefsPatch,
  loadPrefs,
  migrateCvDocumentsIntoPrefs,
  updatePrefs,
  type CvDocumentSlotV1,
  type CvProfileV1,
} from "@scripts/core/prefs";
import { notifyCvEmbedPrefsSyncedExternally } from "@lib/cv-studio-prefs-channel";
import { showToast } from "@scripts/core/ui-feedback";
import { clearCvStudioBlockSelection } from "@scripts/cv/cv-studio-block-selection";

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

function bootCvStudioHeroInspector() {
  const root = document.querySelector<HTMLElement>("[data-cv-studio-inspector-root]");
  if (!root || root.dataset.cvStudioInspectorBound === "1") return;
  root.dataset.cvStudioInspectorBound = "1";

  const heroEl = document.querySelector<HTMLElement>("[data-cv-studio-hero-editor]");
  const hintEl = document.querySelector<HTMLElement>("[data-cv-studio-block-edit-hint]");
  const headlineInp = document.querySelector<HTMLInputElement>("[data-cv-studio-hero-headline]");
  const roleInp = document.querySelector<HTMLInputElement>("[data-cv-studio-hero-target-role]");
  const summaryTa = document.querySelector<HTMLTextAreaElement>("[data-cv-studio-hero-summary]");
  const waInp = document.querySelector<HTMLInputElement>("[data-cv-studio-hero-work-arrangement]");
  const wbInp = document.querySelector<HTMLInputElement>("[data-cv-studio-hero-work-authorization]");
  const saveBtn = document.querySelector<HTMLButtonElement>("[data-cv-studio-hero-save]");
  const dismissBtn = document.querySelector<HTMLButtonElement>("[data-cv-studio-inspector-dismiss]");
  const docPanel = document.querySelector<HTMLElement>("[data-cv-studio-doc-panel]");
  if (!heroEl || !hintEl || !headlineInp || !roleInp || !summaryTa || !waInp || !wbInp || !saveBtn || !dismissBtn) return;

  const populateHero = () => {
    const cur = readActiveSlot();
    if (!cur) return;
    const p = cur.documents[cur.idx]!.cvProfile ?? {};
    headlineInp.value = (p.headline ?? "").trim();
    roleInp.value = (p.cvTargetRole ?? "").trim();
    summaryTa.value = (p.summary ?? "").trim();
    waInp.value = (p.cvWorkArrangement ?? "").trim();
    wbInp.value = (p.cvWorkAuthorization ?? "").trim();
  };

  const hideAll = () => {
    root.classList.add("hidden");
    heroEl.classList.add("hidden");
    hintEl.classList.add("hidden");
  };

  const showHero = () => {
    root.classList.remove("hidden");
    populateHero();
    heroEl.classList.remove("hidden");
    hintEl.classList.add("hidden");
  };

  const showHint = () => {
    root.classList.remove("hidden");
    heroEl.classList.add("hidden");
    hintEl.classList.remove("hidden");
  };

  const onBlock = (e: Event) => {
    const ce = e as CustomEvent<{ blockId?: string | null }>;
    const id = ce.detail?.blockId ?? null;
    if (!id) {
      hideAll();
      return;
    }
    if (id === "hero") {
      showHero();
      return;
    }
    showHint();
  };

  window.addEventListener("skillatlas:cv-studio-block-selected", onBlock as EventListener);

  dismissBtn.addEventListener("click", () => {
    if (docPanel) clearCvStudioBlockSelection(docPanel);
  });

  saveBtn.addEventListener("click", async () => {
    const cur = readActiveSlot();
    if (!cur) {
      showToast(tt("cv.studioHeroNoSlot", "No hay un CV activo en preferencias."), "info");
      return;
    }
    saveBtn.disabled = true;
    try {
      const next = [...cur.documents];
      const slot = next[cur.idx]!;
      const cvProfile: CvProfileV1 = {
        ...(slot.cvProfile ?? {}),
        headline: headlineInp.value.trim(),
        cvTargetRole: roleInp.value.trim(),
        summary: summaryTa.value.trim(),
        cvWorkArrangement: waInp.value.trim(),
        cvWorkAuthorization: wbInp.value.trim(),
      };
      next[cur.idx] = { ...slot, cvProfile };
      updatePrefs(buildCvDocumentsPrefsPatch(next, cur.activeId));
      notifyCvEmbedPrefsSyncedExternally();
      showToast(tt("cv.studioHeroSaved", "Cambios guardados."), "success");
      populateHero();
    } catch (err) {
      console.error("[cv-studio-hero-inspector]", err);
      showToast(tt("cv.studioHeroSaveError", "No se pudo guardar."), "error");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function scheduleBoot() {
  queueMicrotask(() => {
    if (!document.querySelector("[data-cv-studio-inspector-root]")) return;
    bootCvStudioHeroInspector();
  });
}

scheduleBoot();
document.addEventListener("astro:page-load", scheduleBoot);
document.addEventListener("astro:after-swap", scheduleBoot);
