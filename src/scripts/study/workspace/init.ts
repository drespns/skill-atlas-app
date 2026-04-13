import i18next from "i18next";
import { showToast } from "@scripts/core/ui-feedback";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { extractTextFromPdfFile } from "@lib/cv-pdf-text";
import {
  loadDossiers,
  saveDossiers,
  hydrateDossiersFromRemote,
  setStudyDossierSpaceContext,
  dossierToMarkdown,
  type Dossier,
  type DossierChunkRef,
  type StudySourceLite,
} from "../dossier-store";
import { loadClientState, saveClientState } from "@scripts/core/user-client-state";
import { esc, bestSnippet, highlightHtml } from "../study-text";
import {
  deleteStudyUserNote,
  fetchStudyUserNotes,
  insertStudyUserNote,
  isStudyUserNotesMissingTable,
  updateStudyUserNote,
  type StudyUserNoteRow,
} from "../study-user-notes";
import { wireStudyChatUi } from "../study-chat-ui";
import { hydrateCurriculumFromRemote, setStudyCurriculumSpaceContext, wireStudyCurriculumUi } from "../study-curriculum";
import { renderMarkdownSafe } from "./markdown";
import { buildUserNoteCodeLanguageSelectHtml } from "./user-note-html";
import { loadWorkspaceState, saveWorkspaceState, studyWorkspaceStorageKey } from "./local-state";
import type { Source, State } from "./types";
import {
  loadFromSupabase,
  upsertWorkspace,
  upsertSource,
  deleteSource,
  maybeMigrateLocalToSupabase,
} from "./study-db";
import { replaceChunksForSource } from "./chunking";
import { mountStudyCodeEditor, type StudyCodeEditorHandle } from "./code-editor";
import { wireStudySkillAtlasLinks } from "./skillatlas-links";
import {
  fetchStudySpaces,
  insertStudySpace,
  ensureDefaultStudySpace,
  updateStudySpaceTitle,
} from "./study-spaces";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-study-root]");
  if (!root) return;
  if (root.dataset.studyBound === "1") return;
  root.dataset.studyBound = "1";

  const listEl = document.querySelector<HTMLElement>("[data-study-sources]");
  const folderDialog = document.querySelector<HTMLDialogElement>("[data-study-folder-dialog]");
  const folderNameInput = document.querySelector<HTMLInputElement>("[data-study-folder-name-input]");
  const folderCancelBtn = document.querySelector<HTMLButtonElement>("[data-study-folder-cancel]");
  const folderSubmitBtn = document.querySelector<HTMLButtonElement>("[data-study-folder-submit]");
  const conceptsDialog = document.querySelector<HTMLDialogElement>("[data-study-concepts-dialog]");
  const conceptsDialogBody = document.querySelector<HTMLElement>("[data-study-concepts-dialog-body]");
  const conceptsDialogClose = document.querySelector<HTMLButtonElement>("[data-study-concepts-dialog-close]");
  const addBtn = document.querySelector<HTMLButtonElement>("[data-study-add-source]");
  const uploadBtn = document.querySelector<HTMLButtonElement>("[data-study-upload-open]");
  const fileInput = document.querySelector<HTMLInputElement>("[data-study-file-input]");
  const panel = document.querySelector<HTMLElement>("[data-study-add-panel]");
  const titleIn = document.querySelector<HTMLInputElement>("[data-study-input-title]");
  const urlIn = document.querySelector<HTMLInputElement>("[data-study-input-url]");
  const noteIn = document.querySelector<HTMLTextAreaElement>("[data-study-input-note]");
  const sourceKindRadios = document.querySelectorAll<HTMLInputElement>("[data-study-source-kind]");
  const addUrlRow = document.querySelector<HTMLElement>("[data-study-add-url-row]");
  const addCodeRow = document.querySelector<HTMLElement>("[data-study-add-code-row]");
  const codeLangSel = document.querySelector<HTMLSelectElement>("[data-study-input-code-lang]");
  const composeHost = document.querySelector<HTMLElement>("[data-study-code-compose]");
  const dockEmptyEl = document.querySelector<HTMLElement>("[data-study-work-dock-empty]");
  const dockActiveEl = document.querySelector<HTMLElement>("[data-study-work-dock-active]");
  const dockTitleIn = document.querySelector<HTMLInputElement>("[data-study-dock-title]");
  const dockLangSel = document.querySelector<HTMLSelectElement>("[data-study-dock-lang]");
  const dockEditorHost = document.querySelector<HTMLElement>("[data-study-dock-editor]");
  const dockCopyBtn = document.querySelector<HTMLButtonElement>("[data-study-dock-copy]");
  const dockCloseBtn = document.querySelector<HTMLButtonElement>("[data-study-dock-close]");
  const dockSaveBtn = document.querySelector<HTMLButtonElement>("[data-study-dock-save]");
  const cancelAdd = document.querySelector<HTMLButtonElement>("[data-study-cancel-add]");
  const saveAdd = document.querySelector<HTMLButtonElement>("[data-study-save-add]");
  const sessionNotes = document.querySelector<HTMLTextAreaElement>("[data-study-session-notes]");
  const badge = document.querySelector<HTMLElement>("[data-study-context-badge]");
  const searchIn = document.querySelector<HTMLInputElement>("[data-study-search]");
  const searchScope = document.querySelector<HTMLSelectElement>("[data-study-search-scope]");
  const searchStatus = document.querySelector<HTMLElement>("[data-study-search-status]");
  const searchResults = document.querySelector<HTMLElement>("[data-study-search-results]");
  const dossierForm = document.querySelector<HTMLFormElement>("[data-study-dossier-form]");
  const dossierInput = document.querySelector<HTMLTextAreaElement>("[data-study-dossier-input]");
  const dossierStatus = document.querySelector<HTMLElement>("[data-study-dossier-status]");
  const dossierResults = document.querySelector<HTMLElement>("[data-study-dossier-results]");
  const dossierSave = document.querySelector<HTMLButtonElement>("[data-study-dossier-save]");
  const dossierSelection = document.querySelector<HTMLElement>("[data-study-dossier-selection]");
  const dossiersEl = document.querySelector<HTMLElement>("[data-study-dossiers]");
  const titleModal = document.querySelector<HTMLDialogElement>("[data-study-dossier-title-modal]");
  const titleInModal = document.querySelector<HTMLInputElement>("[data-study-dossier-title-input]");
  const dossierViewModal = document.querySelector<HTMLDialogElement>("[data-study-dossier-view-modal]");
  const dossierViewTitle = document.querySelector<HTMLElement>("[data-study-dossier-view-title]");
  const dossierViewSub = document.querySelector<HTMLElement>("[data-study-dossier-view-sub]");
  const dossierViewBody = document.querySelector<HTMLElement>("[data-study-dossier-view-body]");
  const dossierViewCopy = document.querySelector<HTMLButtonElement>("[data-study-dossier-copy]");
  const dossierViewExport = document.querySelector<HTMLButtonElement>("[data-study-dossier-export]");
  const dossierViewReapply = document.querySelector<HTMLButtonElement>("[data-study-dossier-reapply]");
  const spaceSelect = document.querySelector<HTMLSelectElement>("[data-study-space-select]");
  const newSpaceBtn = document.querySelector<HTMLButtonElement>("[data-study-space-new]");
  const newSpaceDialog = document.querySelector<HTMLDialogElement>("[data-study-new-space-dialog]");
  const newSpaceTitleIn = document.querySelector<HTMLInputElement>("[data-study-new-space-title]");
  const newSpaceCancel = document.querySelector<HTMLButtonElement>("[data-study-new-space-cancel]");
  const newSpaceSubmit = document.querySelector<HTMLButtonElement>("[data-study-new-space-submit]");

  if (
    !listEl ||
    !addBtn ||
    !panel ||
    !titleIn ||
    !urlIn ||
    !noteIn ||
    !cancelAdd ||
    !saveAdd ||
    !sessionNotes ||
    !badge ||
    !uploadBtn ||
    !fileInput ||
    !searchIn ||
    !searchScope ||
    !searchStatus ||
    !searchResults ||
    !dossierForm ||
    !dossierInput ||
    !dossierStatus ||
    !dossierResults ||
    !dossierSave ||
    !dossierSelection ||
    !dossiersEl ||
    !titleModal ||
    !titleInModal ||
    !dossierViewModal ||
    !dossierViewTitle ||
    !dossierViewSub ||
    !dossierViewBody ||
    !dossierViewCopy ||
    !dossierViewExport ||
    !dossierViewReapply
  )
    return;

  const sb = getSupabaseBrowserClient();
  let userId: string | null = null;
  let activeStudySpaceId: string | null = null;
  let technologyNameById = new Map<string, string>();
  let technologySlugById = new Map<string, string>();

  const refreshTechnologyNames = async () => {
    if (!sb || !userId) {
      technologyNameById = new Map();
      technologySlugById = new Map();
      return;
    }
    try {
      const r = await sb.from("technologies").select("id,name,slug").eq("user_id", userId);
      technologyNameById = new Map(
        (r.data ?? []).map((t: { id: string; name: string }) => [
          String(t.id),
          (String(t.name ?? "").trim() || String(t.id)).trim(),
        ]),
      );
      technologySlugById = new Map(
        (r.data ?? []).map((t: { id: string; slug?: string }) => [
          String(t.id),
          String(t.slug ?? "").trim() || String(t.id),
        ]),
      );
    } catch {
      technologyNameById = new Map();
      technologySlugById = new Map();
    }
  };

  let studyConceptsForFolders: { id: string; title: string; technology_id: string }[] = [];
  let lastStudyConceptFetchKey: string | null = null;

  const conceptFolderKey = (conceptId: string) => `c:${conceptId}`;

  async function refreshStudyConceptsForFolders(): Promise<void> {
    const key = [...state.linkedTechnologyIds].sort().join(",");
    if (key === lastStudyConceptFetchKey) return;
    lastStudyConceptFetchKey = key;
    if (!sb || !userId || state.linkedTechnologyIds.length === 0) {
      studyConceptsForFolders = [];
      return;
    }
    try {
      const r = await sb
        .from("concepts")
        .select("id,title,technology_id")
        .eq("user_id", userId)
        .in("technology_id", state.linkedTechnologyIds)
        .order("title")
        .limit(250);
      studyConceptsForFolders = (r.data ?? []) as { id: string; title: string; technology_id: string }[];
    } catch {
      studyConceptsForFolders = [];
    }
  }

  let studySpacesCache: Awaited<ReturnType<typeof fetchStudySpaces>> = [];
  const getStorageKey = () => studyWorkspaceStorageKey(activeStudySpaceId);
  let state = loadWorkspaceState(getStorageKey());
  sessionNotes.value = state.sessionNotes;
  let dossiers = loadDossiers();
  const goalIn = document.querySelector<HTMLInputElement>("[data-study-goal]");
  const goalSaveBtn = document.querySelector<HTMLButtonElement>("[data-study-goal-save]");
  const activeTitleEl = document.querySelector<HTMLElement>("[data-study-active-title]");
  const setupDialog = document.querySelector<HTMLDialogElement>("[data-study-setup-dialog]");
  let goalPersistTimer: number | null = null;

  const persistStudyGoalPrefs = async (): Promise<boolean> => {
    if (!goalIn) return false;
    const label = goalIn.value.trim();
    const prefs = await loadClientState<Record<string, unknown>>("study_prefs", {});
    if (sb && userId && activeStudySpaceId) {
      const ok = await updateStudySpaceTitle(sb, userId, activeStudySpaceId, label);
      if (ok) await saveClientState("study_prefs", { ...prefs, activeStudySpaceId });
      return ok;
    }
    return saveClientState("study_prefs", { ...prefs, goalLabel: label });
  };

  const scheduleStudyGoalPersist = () => {
    if (goalPersistTimer != null) window.clearTimeout(goalPersistTimer);
    goalPersistTimer = window.setTimeout(() => {
      goalPersistTimer = null;
      void persistStudyGoalPrefs();
    }, 500);
  };

  const setGoalActionsBusy = (busy: boolean) => {
    if (goalSaveBtn) {
      goalSaveBtn.disabled = busy;
      goalSaveBtn.setAttribute("aria-busy", busy ? "true" : "false");
    }
  };

  const updateStudyActiveTitle = () => {
    if (!activeTitleEl) return;
    const raw = goalIn?.value?.trim() ?? "";
    activeTitleEl.textContent = raw || tt("study.activeStudyUntitled", "Sin nombre");
  };

  const openStudySetup = () => {
    if (!setupDialog) return;
    syncSetupJumpActive("goal");
    setupDialog.showModal();
    try {
      window.dispatchEvent(new Event("skillatlas:select-popovers-refresh"));
    } catch {
      /* ignore */
    }
  };

  const closeStudySetup = () => setupDialog?.close();

  document.querySelector<HTMLButtonElement>("[data-study-open-setup]")?.addEventListener("click", () => openStudySetup());

  setupDialog?.addEventListener("click", (ev) => {
    if (ev.target === setupDialog) closeStudySetup();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-study-setup-close], [data-study-setup-close-footer]").forEach((btn) => {
    btn.addEventListener("click", () => closeStudySetup());
  });

  document.querySelectorAll<HTMLButtonElement>("[data-study-setup-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.studySetupJump ?? "";
      const id =
        k === "goal"
          ? "study-setup-step-goal"
          : k === "skillatlas"
            ? "study-setup-step-skillatlas"
            : k === "curriculum"
              ? "study-setup-step-curriculum"
              : "";
      if (k === "goal" || k === "skillatlas" || k === "curriculum") syncSetupJumpActive(k);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelector<HTMLButtonElement>("[data-study-setup-done]")?.addEventListener("click", async () => {
    if (goalPersistTimer != null) {
      window.clearTimeout(goalPersistTimer);
      goalPersistTimer = null;
    }
    if (sb && (await getSessionUserId(sb))) {
      setGoalActionsBusy(true);
      const ok = await persistStudyGoalPrefs();
      setGoalActionsBusy(false);
      if (ok) {
        updateStudyActiveTitle();
        showToast(tt("study.setupDoneToast", "Contexto guardado. Ya puedes trabajar con fuentes y notas."), "success");
      } else {
        showToast(tt("study.goalSaveErrorToast", "No se pudo guardar el objetivo. Revisa la conexión o inténtalo de nuevo."), "error");
      }
    } else {
      updateStudyActiveTitle();
    }
    closeStudySetup();
    scrollToStudyAnchor("study-step-sources");
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>("[data-study-upload-open]")?.focus();
    }, 400);
  });

  const scrollToStudyAnchor = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const escAttrOption = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");

  const fillSpaceSelect = () => {
    if (!spaceSelect) return;
    spaceSelect.innerHTML = studySpacesCache
      .map(
        (s) =>
          `<option value="${escAttrOption(s.id)}">${escAttrOption(
            s.title.trim() || tt("study.activeStudyUntitled", "Sin nombre"),
          )}</option>`,
      )
      .join("");
    if (activeStudySpaceId) spaceSelect.value = activeStudySpaceId;
    spaceSelect.disabled = studySpacesCache.length === 0;
  };

  spaceSelect?.addEventListener("change", async () => {
    const v = spaceSelect?.value?.trim() ?? "";
    if (!v || v === activeStudySpaceId) return;
    const prefs = await loadClientState<Record<string, unknown>>("study_prefs", {});
    await saveClientState("study_prefs", { ...prefs, activeStudySpaceId: v });
    window.location.reload();
  });

  const syncSetupJumpActive = (key: "goal" | "skillatlas" | "curriculum") => {
    document.querySelectorAll<HTMLButtonElement>("[data-study-setup-jump]").forEach((b) => {
      const k = b.dataset.studySetupJump ?? "";
      const on = k === key;
      if (on) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
      b.classList.toggle("border-indigo-500", on);
      b.classList.toggle("bg-indigo-50", on);
      b.classList.toggle("dark:border-indigo-500", on);
      b.classList.toggle("dark:bg-indigo-950/40", on);
    });
  };

  const openNewSpaceDialog = () => {
    if (!newSpaceDialog || !newSpaceTitleIn) return;
    const defTitle = tt("study.newSpaceDefaultTitle", "Nuevo estudio");
    newSpaceTitleIn.value = defTitle;
    newSpaceDialog.showModal();
    window.setTimeout(() => {
      newSpaceTitleIn.focus();
      newSpaceTitleIn.select();
    }, 0);
  };

  const closeNewSpaceDialog = () => newSpaceDialog?.close();

  newSpaceBtn?.addEventListener("click", async () => {
    if (!sb || !(await getSessionUserId(sb))) {
      showToast(tt("study.searchNeedSession", "Inicia sesión."), "warning");
      return;
    }
    if (!newSpaceDialog || !newSpaceTitleIn) {
      const uid = await getSessionUserId(sb);
      if (!uid || !sb) return;
      const defTitle = tt("study.newSpaceDefaultTitle", "Nuevo estudio");
      const name = window.prompt(tt("study.newSpacePrompt", "Nombre del nuevo estudio"), defTitle);
      if (name === null) return;
      const id = await insertStudySpace(sb, uid, name.trim() || defTitle);
      if (!id) {
        showToast(tt("study.newSpaceError", "No se pudo crear el estudio."), "error");
        return;
      }
      const prefs = await loadClientState<Record<string, unknown>>("study_prefs", {});
      await saveClientState("study_prefs", { ...prefs, activeStudySpaceId: id });
      window.location.reload();
      return;
    }
    openNewSpaceDialog();
  });

  newSpaceCancel?.addEventListener("click", () => closeNewSpaceDialog());

  newSpaceDialog?.addEventListener("click", (ev) => {
    if (ev.target === newSpaceDialog) closeNewSpaceDialog();
  });

  newSpaceTitleIn?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      newSpaceSubmit?.click();
    }
  });

  newSpaceSubmit?.addEventListener("click", async () => {
    if (!sb || !newSpaceTitleIn) return;
    const uid = await getSessionUserId(sb);
    if (!uid) {
      showToast(tt("study.searchNeedSession", "Inicia sesión."), "warning");
      return;
    }
    const defTitle = tt("study.newSpaceDefaultTitle", "Nuevo estudio");
    const name = newSpaceTitleIn.value.trim() || defTitle;
    newSpaceSubmit.disabled = true;
    const id = await insertStudySpace(sb, uid, name);
    newSpaceSubmit.disabled = false;
    if (!id) {
      showToast(tt("study.newSpaceError", "No se pudo crear el estudio."), "error");
      return;
    }
    closeNewSpaceDialog();
    const prefs = await loadClientState<Record<string, unknown>>("study_prefs", {});
    await saveClientState("study_prefs", { ...prefs, activeStudySpaceId: id });
    window.location.reload();
  });

  const userNotesPanel = document.querySelector<HTMLElement>("[data-study-user-notes-panel]");
  const userNotesList = document.querySelector<HTMLElement>("[data-study-user-notes-list]");
  const userNoteAddBtn = document.querySelector<HTMLButtonElement>("[data-study-user-note-add]");
  let userNoteRows: StudyUserNoteRow[] = [];
  let userNotesAvailable = true;
  const noteSaveTimers = new Map<string, number>();

  let pendingUploadMeta: { title?: string; url?: string } | null = null;
  let addPanelCodeEditor: StudyCodeEditorHandle | null = null;
  let dockCodeEditor: StudyCodeEditorHandle | null = null;
  let lastDockMountedId: string | null = null;

  const tearDownAddPanelEditor = (preserveIntoNote: boolean) => {
    if (!addPanelCodeEditor) return;
    if (preserveIntoNote && noteIn) noteIn.value = addPanelCodeEditor.getDoc();
    addPanelCodeEditor.destroy();
    addPanelCodeEditor = null;
  };

  const ensureAddPanelEditor = () => {
    if (!composeHost) return;
    if (addPanelCodeEditor) return;
    const lang = (codeLangSel?.value ?? "typescript").trim() || "typescript";
    const initial = noteIn?.value ?? "";
    addPanelCodeEditor = mountStudyCodeEditor(composeHost, {
      doc: initial,
      language: lang,
      minHeight: "200px",
      placeholder: tt("study.placeholderNote", ""),
    });
  };

  const tearDownDockEditor = () => {
    if (dockCodeEditor) {
      dockCodeEditor.destroy();
      dockCodeEditor = null;
    }
  };

  const mountDockEditor = (doc: string, language: string) => {
    if (!dockEditorHost) return;
    tearDownDockEditor();
    dockCodeEditor = mountStudyCodeEditor(dockEditorHost, {
      doc,
      language: language.trim() || "plaintext",
      minHeight: "min(30vh, 260px)",
    });
  };

  const syncDockUi = () => {
    if (!dockEmptyEl || !dockActiveEl || !dockEditorHost) return;
    const id = state.focusedCodeSourceId ?? null;
    const src = id ? state.sources.find((s) => s.id === id && s.kind === "code") : undefined;

    if (!src) {
      if (id) {
        state.focusedCodeSourceId = null;
        saveWorkspaceState(getStorageKey(), state);
      }
      lastDockMountedId = null;
      tearDownDockEditor();
      dockEmptyEl.classList.remove("hidden");
      dockActiveEl.classList.add("hidden");
      return;
    }

    dockEmptyEl.classList.add("hidden");
    dockActiveEl.classList.remove("hidden");

    if (dockTitleIn) dockTitleIn.value = src.title;
    if (dockLangSel) dockLangSel.value = (src.codeLanguage ?? "typescript").trim() || "typescript";

    if (lastDockMountedId !== src.id) {
      mountDockEditor(src.body ?? "", dockLangSel?.value ?? "typescript");
      lastDockMountedId = src.id;
    }
  };

  const blurCodeDock = () => {
    state.focusedCodeSourceId = null;
    saveWorkspaceState(getStorageKey(), state);
    lastDockMountedId = null;
    tearDownDockEditor();
    render();
  };

  let searchTimer: number | null = null;

  const openFileSource = async (sourceId: string) => {
    if (!sb || !userId) return;
    const hit = state.sources.find((x) => x.id === sourceId);
    if (!hit?.filePath) return;
    try {
      const res = await sb.storage.from("study_files").createSignedUrl(hit.filePath, 60);
      const url = res?.data?.signedUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

  let dossierLastHits: Array<{ sourceId: string; chunkIndex: number; body: string }> = [];
  const selectedRefs = new Set<string>();

  const flashSourceRow = (sourceId: string) => {
    if (!listEl || !sourceId) return;
    const row = listEl.querySelector<HTMLElement>(`[data-study-source-row="${CSS.escape(sourceId)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    row.classList.add(
      "ring-2",
      "ring-amber-400",
      "dark:ring-amber-500",
      "ring-offset-2",
      "ring-offset-white",
      "dark:ring-offset-gray-950",
    );
    window.setTimeout(() => {
      row.classList.remove(
        "ring-2",
        "ring-amber-400",
        "dark:ring-amber-500",
        "ring-offset-2",
        "ring-offset-white",
        "dark:ring-offset-gray-950",
      );
    }, 2200);
  };

  const highlight = (text: string, q: string) => highlightHtml(text, q);

  const syncDossierSelectionUi = () => {
    const n = selectedRefs.size;
    dossierSave.disabled = n === 0;
    dossierSelection.textContent =
      n === 0
        ? tt("study.dossierSelectionHint", "Selecciona fragmentos para guardarlos.")
        : tt("study.dossierSelectionCount", "{{n}} seleccionados").replace("{{n}}", String(n));
  };

  const renderDossiersPanel = () => {
    if (dossiers.length === 0) {
      dossiersEl.innerHTML = `<div class="text-[11px] text-gray-500 dark:text-gray-400">${esc(tt("study.dossiersEmpty", "Aún no has guardado dossiers."))}</div>`;
      return;
    }
    dossiersEl.innerHTML = dossiers
      .slice(0, 12)
      .map((d) => {
        const dt = new Date(d.createdAt);
        const when = Number.isFinite(dt.getTime()) ? dt.toLocaleDateString() : "";
        return `
          <div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/60 dark:bg-gray-950/40 px-3 py-2">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title="${esc(d.title)}">${esc(d.title)}</div>
                <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">${esc(d.query)}${when ? ` · ${esc(when)}` : ""}</div>
              </div>
              <button type="button" class="text-[11px] text-red-600 dark:text-red-400 hover:underline" data-dossier-del="${esc(d.id)}">${esc(
                tt("study.delete", "Quitar"),
              )}</button>
            </div>
            <div class="mt-2 flex items-center justify-between gap-2">
              <button type="button" class="text-[11px] text-indigo-700 dark:text-indigo-300 hover:underline" data-dossier-open="${esc(
                d.id,
              )}">${esc(tt("common.view", "Ver"))}</button>
              <span class="text-[11px] text-gray-500 dark:text-gray-400">${esc(String(d.chunks?.length ?? 0))}</span>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const sourcesLite = (): StudySourceLite[] =>
    state.sources.map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
      url: s.url,
      fileName: s.fileName,
      codeLanguage: s.kind === "code" ? s.codeLanguage : undefined,
    }));

  const getSelectedAddSourceKind = (): "note" | "link" | "code" => {
    for (const r of sourceKindRadios) {
      if (r.checked && (r.value === "link" || r.value === "code")) return r.value;
    }
    return "note";
  };

  const syncAddPanelKindUi = () => {
    const k = getSelectedAddSourceKind();
    if (addUrlRow) addUrlRow.classList.toggle("hidden", k !== "link");
    if (addCodeRow) addCodeRow.classList.toggle("hidden", k !== "code");
    if (k === "code") {
      tearDownAddPanelEditor(false);
      if (composeHost) {
        composeHost.classList.remove("hidden");
        composeHost.removeAttribute("aria-hidden");
      }
      if (noteIn) {
        noteIn.classList.add("hidden");
        noteIn.setAttribute("aria-hidden", "true");
      }
      window.requestAnimationFrame(() => ensureAddPanelEditor());
    } else {
      tearDownAddPanelEditor(true);
      if (composeHost) {
        composeHost.classList.add("hidden");
        composeHost.setAttribute("aria-hidden", "true");
      }
      if (noteIn) {
        noteIn.classList.remove("hidden");
        noteIn.removeAttribute("aria-hidden");
        noteIn.rows = 3;
      }
    }
  };

  const sourceHitMetaLine = (src: Source | undefined): string => {
    if (!src) return "";
    let meta = "";
    if (src.kind === "link" && src.url) meta = src.url;
    else if (src.kind === "file" && src.fileName) meta = src.fileName;
    else if (src.kind === "code")
      meta = src.codeLanguage?.trim() ? src.codeLanguage.trim() : tt("study.sourceKindCode", "Code");
    return meta ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">${esc(meta)}</div>` : "";
  };

  sourceKindRadios.forEach((r) => r.addEventListener("change", syncAddPanelKindUi));
  codeLangSel?.addEventListener("change", () => {
    if (getSelectedAddSourceKind() !== "code" || !composeHost) return;
    const doc = addPanelCodeEditor?.getDoc() ?? noteIn?.value ?? "";
    tearDownAddPanelEditor(false);
    const lang = (codeLangSel?.value ?? "typescript").trim() || "typescript";
    addPanelCodeEditor = mountStudyCodeEditor(composeHost, {
      doc,
      language: lang,
      minHeight: "200px",
      placeholder: tt("study.placeholderNote", ""),
    });
  });
  syncAddPanelKindUi();

  const renderDossierView = (d: Dossier) => {
    const byId = new Map(state.sources.map((s) => [s.id, s]));
    dossierViewTitle.textContent = d.title;
    dossierViewSub.textContent = `${d.query} · ${d.scope === "all" ? tt("study.searchScopeAll", "Todas mis fuentes") : tt("study.searchScopeContext", "En contexto")}`;
    dossierViewBody.innerHTML = d.chunks
      .map((c, idx) => {
        const src = byId.get(c.sourceId);
        const title = src?.title ?? "Fuente";
        const metaLine = sourceHitMetaLine(src);
        const openBtn =
          src?.kind === "link" && src.url
            ? `<a class="shrink-0 text-xs text-indigo-700 dark:text-indigo-300 hover:underline" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(
                tt("study.open", "Abrir"),
              )}</a>`
            : src?.kind === "file"
              ? `<button type="button" class="shrink-0 text-xs text-indigo-700 dark:text-indigo-300 hover:underline" data-study-open="${esc(c.sourceId)}">${esc(
                  tt("study.open", "Abrir"),
                )}</button>`
              : "";
        return `
          <div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 px-3 py-2">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 min-w-0 truncate">[${idx + 1}] ${esc(title)} <span class="text-[11px] text-gray-500 dark:text-gray-400">#${c.chunkIndex + 1}</span></div>
                ${metaLine}
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:underline" data-dossier-note data-dossier-note-source="${esc(
                  c.sourceId,
                )}" data-dossier-note-chunk-index="${esc(String(c.chunkIndex))}">${esc(tt("study.addToNotes", "Añadir a notas"))}</button>
                ${openBtn}
              </div>
            </div>
            <div class="mt-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${esc(c.excerpt)}</div>
          </div>
        `;
      })
      .join("");
  };

  const renderDossierResults = (hits: Array<{ sourceId: string; chunkIndex: number; body: string }>, q: string) => {
    dossierLastHits = hits;
    if (hits.length === 0) {
      dossierResults.innerHTML = `<div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/60 dark:bg-gray-950/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">${esc(
        tt("study.searchEmpty", "Sin resultados."),
      )}</div>`;
      return;
    }
    const byId = new Map(state.sources.map((s) => [s.id, s]));
    dossierResults.innerHTML = hits
      .map((h, idx) => {
        const src = byId.get(h.sourceId);
        const title = src?.title ?? "Fuente";
        const metaLine = sourceHitMetaLine(src);
        const refKey = `${h.sourceId}:${h.chunkIndex}`;
        const checked = selectedRefs.has(refKey) ? "checked" : "";
        const openBtn =
          src?.kind === "link" && src.url
            ? `<a class="shrink-0 text-xs text-indigo-700 dark:text-indigo-300 hover:underline" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(
                tt("study.open", "Abrir"),
              )}</a>`
            : src?.kind === "file"
              ? `<button type="button" class="shrink-0 text-xs text-indigo-700 dark:text-indigo-300 hover:underline" data-study-open="${esc(h.sourceId)}">${esc(
                  tt("study.open", "Abrir"),
                )}</button>`
              : "";
        return `
          <div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 px-3 py-2">
            <div class="flex items-start justify-between gap-3">
              <label class="min-w-0 flex items-start gap-2 cursor-pointer">
                <input type="checkbox" class="mt-1 rounded border-gray-300 dark:border-gray-600" data-dossier-pick="${esc(refKey)}" ${checked} />
                <div class="min-w-0">
                  <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 min-w-0 truncate">[${idx + 1}] ${esc(title)} <span class="text-[11px] text-gray-500 dark:text-gray-400">#${h.chunkIndex + 1}</span></div>
                  ${metaLine}
                </div>
              </label>
              ${openBtn}
            </div>
            <div class="mt-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${highlight(bestSnippet(h.body, q, 520), q)}</div>
            <div class="mt-2 flex items-center justify-between gap-3">
              <button type="button" class="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:underline" data-dossier-expand="${esc(
              refKey,
            )}">
              <span>${esc(tt("study.moreContext", "Ver más contexto"))}</span>
              <span class="text-gray-400">\u25BE</span>
            </button>
              <button type="button" class="text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:underline" data-dossier-note="${esc(
                refKey,
              )}">${esc(tt("study.addToNotes", "Añadir a notas"))}</button>
            </div>
            <div class="mt-1 hidden text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" data-dossier-expanded="${esc(
              refKey,
            )}">${highlight(h.body.slice(0, 1200), q)}</div>
          </div>
        `;
      })
      .join("");
    syncDossierSelectionUi();
  };

  const renderSearchResults = (hits: Array<{ sourceId: string; body: string; chunkIndex: number }>) => {
    const byId = new Map(state.sources.map((s) => [s.id, s]));
    if (hits.length === 0) {
      searchResults.innerHTML = `<div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/60 dark:bg-gray-950/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">${esc(
        tt("study.searchEmpty", "Sin resultados."),
      )}</div>`;
      return;
    }
    searchResults.innerHTML = hits
      .slice(0, 8)
      .map((h) => {
        const src = byId.get(h.sourceId);
        const title = src?.title ?? "Fuente";
        const metaLine = sourceHitMetaLine(src);
        const openBtn =
          src?.kind === "link" && src.url
            ? `<a class="shrink-0 text-xs text-indigo-700 dark:text-indigo-300 hover:underline" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(
                tt("study.open", "Abrir"),
              )}</a>`
            : src?.kind === "file"
              ? `<button type="button" class="shrink-0 text-xs text-indigo-700 dark:text-indigo-300 hover:underline" data-study-open="${esc(h.sourceId)}">${esc(
                  tt("study.open", "Abrir"),
                )}</button>`
              : "";
        return `
          <div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 px-3 py-2">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 min-w-0 truncate">${esc(title)} <span class="text-[11px] text-gray-500 dark:text-gray-400">#${h.chunkIndex + 1}</span></div>
                ${metaLine}
              </div>
              ${openBtn}
            </div>
            <div class="mt-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${esc(h.body).slice(0, 420)}</div>
          </div>
        `;
      })
      .join("");
  };

  const runSearch = async () => {
    const q = searchIn.value.trim();
    if (!q) {
      searchStatus.textContent = "";
      searchResults.innerHTML = "";
      return;
    }
    if (!sb || !userId) {
      showToast(tt("study.searchNeedSession", "Inicia sesión para buscar en tus fuentes."), "warning");
      return;
    }
    try {
      const scopeMode = (searchScope.value || "context") as "context" | "all";
      const scopeIds =
        scopeMode === "all" ? state.sources.map((s) => s.id) : state.activeIds.length > 0 ? state.activeIds : state.sources.map((s) => s.id);

      searchStatus.textContent = tt("study.searching", "Buscando…");
      let qChunks = sb
        .from("study_chunks")
        .select("source_id,chunk_index,body")
        .eq("user_id", userId)
        .in("source_id", scopeIds);
      if (activeStudySpaceId) qChunks = qChunks.eq("study_space_id", activeStudySpaceId);
      const res = await qChunks
        // Match index config (tsvector built with 'simple') to avoid stopword surprises (e.g. "having").
        .textSearch("tsv", q, { type: "websearch", config: "simple" })
        .limit(8);
      const rows = (res?.data ?? []) as Array<{ source_id: string; chunk_index: number; body: string }>;
      renderSearchResults(rows.map((r) => ({ sourceId: r.source_id, chunkIndex: r.chunk_index, body: r.body })));
      searchStatus.textContent = "";
    } catch {
      // ignore (schema may not exist yet)
      searchStatus.textContent = "";
    }
  };

  const runDossier = async (message: string) => {
    const q = message.trim();
    if (!q) return;
    if (!sb || !userId) {
      showToast(tt("study.searchNeedSession", "Inicia sesión para buscar en tus fuentes."), "warning");
      return;
    }
    try {
      const scopeMode = (searchScope.value || "context") as "context" | "all";
      const scopeIds =
        scopeMode === "all" ? state.sources.map((s) => s.id) : state.activeIds.length > 0 ? state.activeIds : [];
      if (scopeMode === "context" && scopeIds.length === 0) {
        showToast(tt("study.dossierNeedContext", "Marca al menos una fuente en contexto."), "warning");
        return;
      }

      dossierStatus.textContent = tt("study.searching", "Buscando…");
      selectedRefs.clear();
      syncDossierSelectionUi();
      let q0 = sb
        .from("study_chunks")
        .select("source_id,chunk_index,body")
        .eq("user_id", userId)
        .textSearch("tsv", q, { type: "websearch", config: "simple" })
        .limit(12);
      if (activeStudySpaceId) q0 = q0.eq("study_space_id", activeStudySpaceId);
      const res = scopeMode === "all" ? await q0 : await q0.in("source_id", scopeIds);
      const rows = (res?.data ?? []) as Array<{ source_id: string; chunk_index: number; body: string }>;
      renderDossierResults(rows.map((r) => ({ sourceId: r.source_id, chunkIndex: r.chunk_index, body: r.body })), q);
    } catch {
      dossierResults.innerHTML = "";
    } finally {
      dossierStatus.textContent = "";
    }
  };

  const syncBadge = () => {
    const n = state.activeIds.length;
    const v = i18next.t("study.contextBadge", { count: n });
    badge.textContent = typeof v === "string" && v !== "study.contextBadge" ? v : `${n} en contexto`;
  };

  const buildSourceRowEl = (s: Source, folderDnD: boolean): HTMLElement => {
    const active = state.activeIds.includes(s.id);
    const isFocused = state.focusedCodeSourceId === s.id;
    const row = document.createElement("div");
    row.dataset.studySourceRow = s.id;
    row.className = `flex flex-wrap items-start gap-2 rounded-xl px-2 py-2 text-sm border ${
      active ? "border-indigo-300/80 dark:border-indigo-700/60 bg-indigo-50/50 dark:bg-indigo-950/25" : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/50"
    } ${isFocused ? "ring-2 ring-indigo-400/85 dark:ring-indigo-500/75 ring-inset" : ""}`;
    const kindLabel =
      s.kind === "link" ? "\u{1F517}" : s.kind === "file" ? "\u{1F4CE}" : s.kind === "code" ? "\u{1F4BB}" : "\u{1F4C4}";
    const cbId = `study-src-cb-${s.id}`;
    const dragHint = esc(tt("study.sourceDragHandle", "Arrastrar a otra carpeta"));
    const dragHandle =
      folderDnD
        ? `<span class="codicon codicon-gripper shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 select-none px-0.5 mt-0.5 text-base" draggable="true" data-study-drag-handle role="button" tabindex="0" title="${dragHint}" aria-label="${dragHint}"></span>`
        : "";
    const codeTitleBtn =
      s.kind === "code"
        ? `<button type="button" class="w-full text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60" data-study-code-focus="${esc(
            s.id,
          )}" title="${esc(tt("study.workDockOpenHint", "Abrir en el panel central"))}">
            <span class="block font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">${kindLabel} ${esc(s.title)}</span>
            <span class="block text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">${esc(s.codeLanguage || "plaintext")}</span>
          </button>`
        : `<label for="${esc(cbId)}" class="block cursor-pointer">
            <span class="block font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2" title="${esc(s.title)}">${kindLabel} ${esc(s.title)}</span>
            ${s.kind === "link" && s.url ? `<span class="block text-[11px] text-gray-500 truncate">${esc(s.url)}</span>` : ""}
            ${s.kind === "file" && s.fileName ? `<span class="block text-[11px] text-gray-500 truncate">${esc(s.fileName)}</span>` : ""}
            ${s.kind === "note" ? `<span class="block text-[11px] text-gray-500 dark:text-gray-400 truncate">${esc(tt("study.sourceKindNote", "Nota"))}</span>` : ""}
          </label>`;
    row.innerHTML = `
      <div class="flex items-start gap-2 min-w-0 flex-1 basis-[min(100%,12rem)]">
        ${dragHandle}
        <input type="checkbox" id="${esc(cbId)}" class="mt-1 shrink-0 rounded border-gray-300 dark:border-gray-600" data-study-active="${esc(s.id)}" ${active ? "checked" : ""} />
        <div class="min-w-0 flex-1">${codeTitleBtn}</div>
      </div>
      ${s.kind === "file" ? `<button type="button" class="shrink-0 text-xs text-indigo-700 dark:text-indigo-300 hover:underline self-start" data-study-open="${esc(s.id)}">${esc(tt("study.open", "Abrir"))}</button>` : ""}
      <button type="button" class="shrink-0 text-xs text-red-600 dark:text-red-400 hover:underline self-start" data-study-del="${esc(s.id)}">${esc(tt("study.delete", "Quitar"))}</button>
    `;
    return row;
  };

  const appendSourcesToolbar = () => {
    const linked = state.linkedTechnologyIds;
    const customFolders = state.customStudyFolders;
    if (linked.length === 0 && customFolders.length === 0) return;
    const bar = document.createElement("div");
    bar.className =
      "study-sources-toolbar flex flex-wrap items-center gap-2 mb-2 px-1 pb-2 border-b border-gray-200/70 dark:border-gray-800/80";
    bar.dataset.studySourcesToolbar = "1";
    const folderLbl = esc(tt("study.toolbarAddFolder", "Añadir carpeta"));
    const conceptsLbl = esc(tt("study.toolbarConcepts", "Conceptos"));
    bar.innerHTML = `
      <button type="button" data-study-toolbar-new-folder
        class="inline-flex items-center gap-1 text-[11px] font-semibold rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/30 px-2 py-1.5 text-violet-900 dark:text-violet-100 hover:bg-violet-50 dark:hover:bg-violet-950/45">
        <span class="codicon codicon-new-folder text-sm" aria-hidden="true"></span>
        <span>${folderLbl}</span>
      </button>
      ${
        linked.length > 0
          ? `<button type="button" data-study-toolbar-concepts
        class="inline-flex items-center gap-1 text-[11px] font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/25 px-2 py-1.5 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/35">
        <span class="codicon codicon-book text-sm" aria-hidden="true"></span>
        <span>${conceptsLbl}</span>
      </button>`
          : ""
      }`;
    listEl.appendChild(bar);
  };

  const renderInner = () => {
    listEl.innerHTML = "";
    const folderDnD = true;
    const linked = state.linkedTechnologyIds;
    const customFolders = state.customStudyFolders;
    const validConceptFolders = new Set(studyConceptsForFolders.map((c) => conceptFolderKey(c.id)));
    const useFolderGroups = linked.length > 0 || customFolders.length > 0 || studyConceptsForFolders.length > 0;

    if (state.sources.length === 0) {
      state.focusedCodeSourceId = null;
      lastDockMountedId = null;
      tearDownDockEditor();
      if (useFolderGroups) {
        appendSourcesToolbar();
        const folders = state.sourceFolderById;
        const validCustom = new Set(customFolders.map((f) => f.id));
        const bucket = (sid: string) => {
          const f = folders[sid] ?? "";
          if (!f) return "__general__";
          if (validConceptFolders.has(f)) return f;
          if (linked.includes(f)) return f;
          if (validCustom.has(f)) return f;
          return "__general__";
        };
        const grouped = new Map<string, Source[]>();
        for (const tid of linked) grouped.set(tid, []);
        for (const cf of customFolders) grouped.set(cf.id, []);
        for (const c of studyConceptsForFolders) grouped.set(conceptFolderKey(c.id), []);
        grouped.set("__general__", []);
        for (const s of state.sources) {
          const b = bucket(s.id);
          (grouped.get(b) ?? grouped.get("__general__")!).push(s);
        }
        const appendGroup = (title: string, key: string, sources: Source[], opts?: { deletable?: boolean }) => {
          const showIfEmpty = Boolean(opts?.deletable);
          if (sources.length === 0 && !showIfEmpty) return;
          const det = document.createElement("details");
          det.className =
            "rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/50 dark:bg-gray-950/35 px-2 py-1 mb-2 open:[&>summary]:mb-1";
          det.open = true;
          det.dataset.studySourceGroup = key;
          const sum = document.createElement("summary");
          sum.className =
            "cursor-pointer text-[11px] font-semibold text-gray-800 dark:text-gray-200 py-1.5 list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden";
          const delBtn =
            opts?.deletable && key !== "__general__"
              ? `<button type="button" class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10" data-study-delete-custom-folder="${esc(
                  key,
                )}" title="${esc(tt("study.deleteCustomFolderTitle", "Eliminar carpeta"))}">×</button>`
              : "";
          sum.innerHTML = `<span class="inline-flex items-center gap-1.5 min-w-0 flex-1"><span class="codicon codicon-folder shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true"></span><span class="truncate">${esc(
            title,
          )}</span></span><span class="shrink-0 inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><span>${sources.length}</span>${delBtn}</span>`;
          det.appendChild(sum);
          const inner = document.createElement("div");
          inner.className =
            "study-source-drop-zone space-y-1 pl-0.5 pb-1 min-h-[2.25rem] rounded-lg border border-dashed border-transparent transition-colors";
          inner.dataset.studyDropFolder = key;
          det.appendChild(inner);
          listEl.appendChild(det);
        };
        const appendTechWithConcepts = (tid: string, techName: string, techRootSources: Source[]) => {
          const conceptsHere = studyConceptsForFolders
            .filter((c) => c.technology_id === tid)
            .sort((a, b) => a.title.localeCompare(b.title, "es"));
          let subTotal = 0;
          for (const c of conceptsHere) subTotal += grouped.get(conceptFolderKey(c.id))?.length ?? 0;
          const total = techRootSources.length + subTotal;
          const det = document.createElement("details");
          det.className =
            "rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/50 dark:bg-gray-950/35 px-2 py-1 mb-2 open:[&>summary]:mb-1";
          det.open = true;
          det.dataset.studySourceGroup = tid;
          const sum = document.createElement("summary");
          sum.className =
            "cursor-pointer text-[11px] font-semibold text-gray-800 dark:text-gray-200 py-1.5 list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden";
          sum.innerHTML = `<span class="inline-flex items-center gap-1.5 min-w-0 flex-1"><span class="codicon codicon-folder shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true"></span><span class="truncate">${esc(
            techName,
          )}</span></span><span class="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">${total}</span>`;
          det.appendChild(sum);
          const body = document.createElement("div");
          body.className = "pl-1 space-y-2 pb-1";
          const techDrop = document.createElement("div");
          techDrop.className =
            "study-source-drop-zone space-y-1 min-h-[1.5rem] rounded-lg border border-dashed border-transparent transition-colors";
          techDrop.dataset.studyDropFolder = tid;
          for (const s of techRootSources) techDrop.appendChild(buildSourceRowEl(s, folderDnD));
          body.appendChild(techDrop);
          for (const c of conceptsHere) {
            const ck = conceptFolderKey(c.id);
            const subSrc = grouped.get(ck) ?? [];
            const sub = document.createElement("details");
            sub.className =
              "rounded-lg border border-indigo-200/40 dark:border-indigo-900/35 bg-indigo-50/20 dark:bg-indigo-950/15 px-1.5 py-0.5";
            sub.open = true;
            const subSum = document.createElement("summary");
            subSum.className =
              "cursor-pointer text-[10px] font-semibold text-indigo-900 dark:text-indigo-200 py-1 list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden";
            subSum.innerHTML = `<span class="inline-flex items-center gap-1 min-w-0"><span class="codicon codicon-symbol-class shrink-0 opacity-80" aria-hidden="true"></span><span class="truncate">${esc(
              c.title || "—",
            )}</span></span><span class="shrink-0 text-[10px] text-indigo-600/80 dark:text-indigo-300/80">${subSrc.length}</span>`;
            sub.appendChild(subSum);
            const subDrop = document.createElement("div");
            subDrop.className =
              "study-source-drop-zone space-y-1 pl-0.5 pb-1 min-h-[1.25rem] rounded-md border border-dashed border-transparent transition-colors";
            subDrop.dataset.studyDropFolder = ck;
            for (const s of subSrc) subDrop.appendChild(buildSourceRowEl(s, folderDnD));
            sub.appendChild(subDrop);
            body.appendChild(sub);
          }
          det.appendChild(body);
          listEl.appendChild(det);
        };
        for (const tid of linked) {
          appendTechWithConcepts(tid, technologyNameById.get(tid) ?? tid, grouped.get(tid) ?? []);
        }
        for (const cf of customFolders) {
          appendGroup(cf.label, cf.id, grouped.get(cf.id) ?? [], { deletable: true });
        }
        appendGroup(tt("study.sourceFolderGeneral", "General"), "__general__", grouped.get("__general__") ?? []);
        listEl.insertAdjacentHTML(
          "beforeend",
          `<p class="m-0 px-2 py-4 text-center text-xs text-gray-500 dark:text-gray-400">${esc(tt("study.emptySourcesInFolders", "Aún no hay fuentes. Usa «+ Añadir» o «Subir» arriba."))}</p>`,
        );
      } else {
        listEl.innerHTML = `<p class="m-0 px-2 py-6 text-center text-xs text-gray-500 dark:text-gray-400">${esc(tt("study.emptySources", "Aún no hay fuentes. Añade un enlace o una nota."))}</p>`;
      }
      saveWorkspaceState(getStorageKey(), state);
      syncBadge();
      syncDockUi();
      return;
    }

    if (useFolderGroups) appendSourcesToolbar();

    if (!useFolderGroups) {
      for (const s of state.sources) listEl.appendChild(buildSourceRowEl(s, false));
    } else {
      const folders = state.sourceFolderById;
      const validCustom = new Set(customFolders.map((f) => f.id));
      const bucket = (sid: string) => {
        const f = folders[sid] ?? "";
        if (!f) return "__general__";
        if (validConceptFolders.has(f)) return f;
        if (linked.includes(f)) return f;
        if (validCustom.has(f)) return f;
        return "__general__";
      };
      const grouped = new Map<string, Source[]>();
      for (const tid of linked) grouped.set(tid, []);
      for (const cf of customFolders) grouped.set(cf.id, []);
      for (const c of studyConceptsForFolders) grouped.set(conceptFolderKey(c.id), []);
      grouped.set("__general__", []);
      for (const s of state.sources) {
        const b = bucket(s.id);
        (grouped.get(b) ?? grouped.get("__general__")!).push(s);
      }
      const appendGroup = (title: string, key: string, sources: Source[], opts?: { deletable?: boolean }) => {
        const showIfEmpty = Boolean(opts?.deletable);
        if (sources.length === 0 && !showIfEmpty) return;
        const det = document.createElement("details");
        det.className =
          "rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/50 dark:bg-gray-950/35 px-2 py-1 mb-2 open:[&>summary]:mb-1";
        det.open = true;
        det.dataset.studySourceGroup = key;
        const sum = document.createElement("summary");
        sum.className =
          "cursor-pointer text-[11px] font-semibold text-gray-800 dark:text-gray-200 py-1.5 list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden";
        const delBtn =
          opts?.deletable && key !== "__general__"
            ? `<button type="button" class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10" data-study-delete-custom-folder="${esc(
                key,
              )}" title="${esc(tt("study.deleteCustomFolderTitle", "Eliminar carpeta"))}">×</button>`
            : "";
        sum.innerHTML = `<span class="inline-flex items-center gap-1.5 min-w-0 flex-1"><span class="codicon codicon-folder shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true"></span><span class="truncate">${esc(
          title,
        )}</span></span><span class="shrink-0 inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><span>${sources.length}</span>${delBtn}</span>`;
        det.appendChild(sum);
        const inner = document.createElement("div");
        inner.className =
          "study-source-drop-zone space-y-1 pl-0.5 pb-1 min-h-[2.25rem] rounded-lg border border-dashed border-transparent transition-colors";
        inner.dataset.studyDropFolder = key;
        for (const s of sources) inner.appendChild(buildSourceRowEl(s, folderDnD));
        det.appendChild(inner);
        listEl.appendChild(det);
      };
      const appendTechWithConcepts = (tid: string, techName: string, techRootSources: Source[]) => {
        const conceptsHere = studyConceptsForFolders
          .filter((c) => c.technology_id === tid)
          .sort((a, b) => a.title.localeCompare(b.title, "es"));
        let subTotal = 0;
        for (const c of conceptsHere) subTotal += grouped.get(conceptFolderKey(c.id))?.length ?? 0;
        const total = techRootSources.length + subTotal;
        const det = document.createElement("details");
        det.className =
          "rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white/50 dark:bg-gray-950/35 px-2 py-1 mb-2 open:[&>summary]:mb-1";
        det.open = true;
        det.dataset.studySourceGroup = tid;
        const sum = document.createElement("summary");
        sum.className =
          "cursor-pointer text-[11px] font-semibold text-gray-800 dark:text-gray-200 py-1.5 list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden";
        sum.innerHTML = `<span class="inline-flex items-center gap-1.5 min-w-0 flex-1"><span class="codicon codicon-folder shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true"></span><span class="truncate">${esc(
          techName,
        )}</span></span><span class="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">${total}</span>`;
        det.appendChild(sum);
        const body = document.createElement("div");
        body.className = "pl-1 space-y-2 pb-1";
        const techDrop = document.createElement("div");
        techDrop.className =
          "study-source-drop-zone space-y-1 min-h-[1.5rem] rounded-lg border border-dashed border-transparent transition-colors";
        techDrop.dataset.studyDropFolder = tid;
        for (const s of techRootSources) techDrop.appendChild(buildSourceRowEl(s, folderDnD));
        body.appendChild(techDrop);
        for (const c of conceptsHere) {
          const ck = conceptFolderKey(c.id);
          const subSrc = grouped.get(ck) ?? [];
          const sub = document.createElement("details");
          sub.className =
            "rounded-lg border border-indigo-200/40 dark:border-indigo-900/35 bg-indigo-50/20 dark:bg-indigo-950/15 px-1.5 py-0.5";
          sub.open = true;
          const subSum = document.createElement("summary");
          subSum.className =
            "cursor-pointer text-[10px] font-semibold text-indigo-900 dark:text-indigo-200 py-1 list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden";
          subSum.innerHTML = `<span class="inline-flex items-center gap-1 min-w-0"><span class="codicon codicon-symbol-class shrink-0 opacity-80" aria-hidden="true"></span><span class="truncate">${esc(
            c.title || "—",
          )}</span></span><span class="shrink-0 text-[10px] text-indigo-600/80 dark:text-indigo-300/80">${subSrc.length}</span>`;
          sub.appendChild(subSum);
          const subDrop = document.createElement("div");
          subDrop.className =
            "study-source-drop-zone space-y-1 pl-0.5 pb-1 min-h-[1.25rem] rounded-md border border-dashed border-transparent transition-colors";
          subDrop.dataset.studyDropFolder = ck;
          for (const s of subSrc) subDrop.appendChild(buildSourceRowEl(s, folderDnD));
          sub.appendChild(subDrop);
          body.appendChild(sub);
        }
        det.appendChild(body);
        listEl.appendChild(det);
      };
      for (const tid of linked) {
        appendTechWithConcepts(tid, technologyNameById.get(tid) ?? tid, grouped.get(tid) ?? []);
      }
      for (const cf of customFolders) {
        appendGroup(cf.label, cf.id, grouped.get(cf.id) ?? [], { deletable: true });
      }
      appendGroup(tt("study.sourceFolderGeneral", "General"), "__general__", grouped.get("__general__") ?? []);
    }

    listEl.querySelectorAll<HTMLInputElement>("input[data-study-active]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.studyActive ?? "";
        const set = new Set(state.activeIds);
        if (cb.checked) set.add(id);
        else set.delete(id);
        state.activeIds = Array.from(set);
        saveWorkspaceState(getStorageKey(), state);
        if (sb && userId && activeStudySpaceId) void upsertWorkspace(sb, activeStudySpaceId, state);
        syncBadge();
        render();
      });
    });

    listEl.querySelectorAll<HTMLButtonElement>("button[data-study-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.studyDel ?? "";
        const hit = state.sources.find((x) => x.id === id);
        if (state.focusedCodeSourceId === id) {
          state.focusedCodeSourceId = null;
          lastDockMountedId = null;
          tearDownDockEditor();
        }
        state.sources = state.sources.filter((x) => x.id !== id);
        state.activeIds = state.activeIds.filter((x) => x !== id);
        if (state.sourceFolderById[id] !== undefined) {
          const { [id]: _drop, ...rest } = state.sourceFolderById;
          state.sourceFolderById = rest;
        }
        saveWorkspaceState(getStorageKey(), state);
        if (sb && userId && activeStudySpaceId) void deleteSource(sb, userId, activeStudySpaceId, id);
        if (sb && userId && hit?.kind === "file" && hit.filePath) {
          try {
            void sb.storage.from("study_files").remove([hit.filePath]);
          } catch {
            // ignore
          }
        }
        if (sb && userId && activeStudySpaceId) void upsertWorkspace(sb, activeStudySpaceId, state);
        render();
      });
    });

    listEl.querySelectorAll<HTMLButtonElement>("button[data-study-open]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.studyOpen ?? "";
        await openFileSource(id);
      });
    });

    syncBadge();
    syncDockUi();
  };

  const render = () => {
    void (async () => {
      await refreshStudyConceptsForFolders();
      renderInner();
    })();
  };

  const openStudyFolderDialog = () => {
    if (!folderDialog) return;
    if (folderNameInput) folderNameInput.value = "";
    folderDialog.showModal();
    window.setTimeout(() => folderNameInput?.focus(), 50);
  };

  const closeStudyFolderDialog = () => folderDialog?.close();

  const submitStudyFolderDialog = () => {
    const name = (folderNameInput?.value ?? "").trim();
    if (!name) {
      showToast(tt("study.folderModalNeedName", "Escribe un nombre para la carpeta."), "warning");
      return;
    }
    const id = `cf_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    state.customStudyFolders = [...state.customStudyFolders, { id, label: name }];
    saveWorkspaceState(getStorageKey(), state);
    closeStudyFolderDialog();
    render();
    showToast(tt("study.customFolderCreated", "Carpeta creada."), "success");
  };

  folderCancelBtn?.addEventListener("click", () => closeStudyFolderDialog());
  folderSubmitBtn?.addEventListener("click", () => submitStudyFolderDialog());
  folderDialog?.addEventListener("click", (e) => {
    if (e.target === folderDialog) closeStudyFolderDialog();
  });
  folderNameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitStudyFolderDialog();
    }
  });

  let studyConceptsDialogBusy = false;

  const fillStudyConceptsDialog = async () => {
    if (!conceptsDialogBody) return;
    const ids = state.linkedTechnologyIds;
    if (ids.length === 0) {
      conceptsDialogBody.innerHTML = `<p class="m-0 text-xs text-gray-600 dark:text-gray-400">${esc(
        tt("study.linkedConceptsNeedTech", "Enlaza al menos una tecnología en «Contexto del estudio»."),
      )}</p>`;
      return;
    }
    await refreshStudyConceptsForFolders();
    const countByTech = new Map<string, number>();
    for (const c of studyConceptsForFolders) {
      countByTech.set(c.technology_id, (countByTech.get(c.technology_id) ?? 0) + 1);
    }
    const parts: string[] = [];
    for (const tid of ids) {
      const name = technologyNameById.get(tid) ?? tid;
      const slug = technologySlugById.get(tid) ?? "";
      const n = countByTech.get(tid) ?? 0;
      const url = slug ? `/technologies/view?tech=${encodeURIComponent(slug)}` : "/technologies";
      const openLbl = esc(tt("study.conceptsModalOpenTech", "Abrir tecnología →"));
      const createLbl = esc(tt("study.conceptsModalCreateHint", "Crea conceptos o importa el catálogo desde el detalle."));
      parts.push(`<div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/60 dark:bg-gray-950/40 p-3 space-y-1.5">
        <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">${esc(name)}</p>
        <p class="m-0 text-xs text-gray-600 dark:text-gray-400">${esc(
          (() => {
            const t = i18next.t("study.conceptsModalCount", { count: n });
            return typeof t === "string" && t !== "study.conceptsModalCount" ? t : `${n}`;
          })(),
        )}</p>
        <p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">${createLbl}</p>
        <p class="m-0"><a class="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline" href="${esc(url)}">${openLbl}</a></p>
      </div>`);
    }
    conceptsDialogBody.innerHTML =
      parts.join("") ||
      `<p class="m-0 text-xs text-gray-600 dark:text-gray-400">${esc(tt("study.conceptsModalEmpty", "Sin tecnologías enlazadas."))}</p>`;
  };

  const openStudyConceptsDialog = () => {
    if (!conceptsDialog || !conceptsDialogBody) return;
    if (studyConceptsDialogBusy) return;
    studyConceptsDialogBusy = true;
    void (async () => {
      try {
        if (conceptsDialog.open) conceptsDialog.close();
        conceptsDialogBody.innerHTML = `<p class="m-0 text-xs text-gray-500 dark:text-gray-400">${esc(
          tt("study.conceptsModalLoading", "Cargando…"),
        )}</p>`;
        conceptsDialog.showModal();
        await fillStudyConceptsDialog();
      } catch {
        conceptsDialogBody.innerHTML = `<p class="m-0 text-xs text-rose-600 dark:text-rose-400">${esc(
          tt("study.linkedConceptsError", "No se pudieron cargar los conceptos."),
        )}</p>`;
      } finally {
        studyConceptsDialogBusy = false;
      }
    })();
  };

  conceptsDialogClose?.addEventListener("click", () => conceptsDialog?.close());
  conceptsDialog?.addEventListener("click", (e) => {
    if (e.target === conceptsDialog) conceptsDialog.close();
  });

  listEl.addEventListener("click", (ev) => {
    const toolbarFolder = (ev.target as HTMLElement | null)?.closest?.("[data-study-toolbar-new-folder]");
    if (toolbarFolder) {
      ev.preventDefault();
      openStudyFolderDialog();
      return;
    }
    const toolbarConcepts = (ev.target as HTMLElement | null)?.closest?.("[data-study-toolbar-concepts]");
    if (toolbarConcepts) {
      ev.preventDefault();
      openStudyConceptsDialog();
      return;
    }
    const delFolder = (ev.target as HTMLElement | null)?.closest?.("button[data-study-delete-custom-folder]") as HTMLButtonElement | null;
    if (delFolder) {
      ev.preventDefault();
      const fid = delFolder.dataset.studyDeleteCustomFolder ?? "";
      if (!fid) return;
      if (!window.confirm(tt("study.confirmDeleteCustomFolder", "¿Eliminar esta carpeta? Las fuentes pasarán a General."))) return;
      const restFolders: Record<string, string> = { ...state.sourceFolderById };
      for (const sid of Object.keys(restFolders)) {
        if (restFolders[sid] === fid) delete restFolders[sid];
      }
      state.customStudyFolders = state.customStudyFolders.filter((f) => f.id !== fid);
      state.sourceFolderById = restFolders;
      saveWorkspaceState(getStorageKey(), state);
      render();
      showToast(tt("study.customFolderDeleted", "Carpeta eliminada."), "success");
      return;
    }
    const t = ev.target as HTMLElement | null;
    const focusBtn = t?.closest?.("button[data-study-code-focus]") as HTMLButtonElement | null;
    if (!focusBtn) return;
    ev.preventDefault();
    const id = focusBtn.dataset.studyCodeFocus ?? "";
    if (!id) return;
    state.focusedCodeSourceId = id;
    saveWorkspaceState(getStorageKey(), state);
    lastDockMountedId = null;
    render();
  });

  const dropZoneHighlight = (el: HTMLElement | null, on: boolean) => {
    if (!el || !el.dataset.studyDropFolder) return;
    el.classList.toggle("border-indigo-400/70", on);
    el.classList.toggle("dark:border-indigo-500/50", on);
    el.classList.toggle("bg-indigo-50/40", on);
    el.classList.toggle("dark:bg-indigo-950/25", on);
  };

  listEl.addEventListener("dragstart", (e) => {
    const h = (e.target as HTMLElement | null)?.closest?.("[data-study-drag-handle]");
    if (!h) return;
    const row = (h as HTMLElement).closest<HTMLElement>("[data-study-source-row]");
    const id = row?.dataset.studySourceRow ?? "";
    if (!id || !e.dataTransfer) return;
    e.dataTransfer.setData("application/x-skillatlas-source", id);
    e.dataTransfer.effectAllowed = "move";
  });

  listEl.addEventListener("dragover", (e) => {
    const z = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-study-drop-folder]");
    if (!z || !e.dataTransfer) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  listEl.addEventListener("dragenter", (e) => {
    const z = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-study-drop-folder]");
    if (!z) return;
    e.preventDefault();
    dropZoneHighlight(z, true);
  });

  listEl.addEventListener("dragleave", (e) => {
    const z = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-study-drop-folder]");
    if (!z) return;
    const rel = e.relatedTarget as Node | null;
    if (rel && z.contains(rel)) return;
    dropZoneHighlight(z, false);
  });

  listEl.addEventListener("drop", (e) => {
    const z = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-study-drop-folder]");
    if (!z) return;
    e.preventDefault();
    dropZoneHighlight(z, false);
    const sourceId =
      e.dataTransfer?.getData("application/x-skillatlas-source") || e.dataTransfer?.getData("text/plain") || "";
    if (!sourceId) return;
    let folder = z.dataset.studyDropFolder ?? "";
    if (folder === "__general__") folder = "";
    const validConceptDrop = new Set(studyConceptsForFolders.map((c) => conceptFolderKey(c.id)));
    if (
      folder &&
      !state.linkedTechnologyIds.includes(folder) &&
      !state.customStudyFolders.some((f) => f.id === folder) &&
      !validConceptDrop.has(folder)
    )
      return;
    const prev = state.sourceFolderById[sourceId] ?? "";
    if (prev === folder) return;
    state.sourceFolderById = { ...state.sourceFolderById, [sourceId]: folder };
    saveWorkspaceState(getStorageKey(), state);
    render();
    showToast(tt("study.sourceMovedFolder", "Fuente movida."), "success");
  });

  dockCloseBtn?.addEventListener("click", () => blurCodeDock());

  dockCopyBtn?.addEventListener("click", async () => {
    const text = dockCodeEditor?.getDoc() ?? "";
    try {
      await navigator.clipboard.writeText(text);
      showToast(tt("study.codeWorkbenchCopied", "Copiado al portapapeles."), "success");
    } catch {
      showToast(tt("study.codeWorkbenchCopyError", "No se pudo copiar."), "error");
    }
  });

  dockLangSel?.addEventListener("change", () => {
    const id = state.focusedCodeSourceId;
    if (!id || !dockEditorHost) return;
    const doc = dockCodeEditor?.getDoc() ?? "";
    mountDockEditor(doc, dockLangSel.value);
    lastDockMountedId = id;
  });

  dockSaveBtn?.addEventListener("click", async () => {
    const id = state.focusedCodeSourceId;
    if (!id) return;
    const src = state.sources.find((x) => x.id === id);
    if (!src || src.kind !== "code") return;
    const title = (dockTitleIn?.value ?? "").trim();
    if (!title) {
      showToast(tt("study.needTitle", "Escribe un título."), "warning");
      return;
    }
    const lang = (dockLangSel?.value ?? "plaintext").trim() || "plaintext";
    const body = (dockCodeEditor?.getDoc() ?? "").trim();
    if (!body) {
      showToast(tt("study.needCodeBody", "Escribe el código o pégalo aquí."), "warning");
      return;
    }
    src.title = title;
    src.codeLanguage = lang;
    src.body = body;
    saveWorkspaceState(getStorageKey(), state);
    if (sb && userId && activeStudySpaceId) {
      await upsertSource(sb, userId, activeStudySpaceId, src);
      await replaceChunksForSource(sb, userId, activeStudySpaceId, src.id, src.body, src.kind);
      void upsertWorkspace(sb, activeStudySpaceId, state);
    }
    lastDockMountedId = null;
    render();
    showToast(tt("study.sourceSaved", "Fuente guardada."), "success");
  });

  sessionNotes.addEventListener("input", () => {
    state.sessionNotes = sessionNotes.value;
    saveWorkspaceState(getStorageKey(), state);
    if (sb && userId && activeStudySpaceId) void upsertWorkspace(sb, activeStudySpaceId, state);
  });

  addBtn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      tearDownAddPanelEditor(false);
      titleIn.value = "";
      urlIn.value = "";
      noteIn.value = "";
      sourceKindRadios.forEach((r) => {
        r.checked = r.value === "note";
      });
      if (codeLangSel) codeLangSel.value = "typescript";
      syncAddPanelKindUi();
      titleIn.focus();
    } else {
      tearDownAddPanelEditor(false);
    }
  });

  uploadBtn.addEventListener("click", () => {
    // If user filled "add" panel, treat it as metadata for the next upload.
    const t = titleIn.value.trim();
    const u = urlIn.value.trim();
    pendingUploadMeta = t || u ? { title: t || undefined, url: u || undefined } : null;
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0] ?? null;
    fileInput.value = "";
    if (!file) return;
    if (!sb) {
      showToast(tt("study.needSupabase", "Falta Supabase para subir archivos."), "warning");
      return;
    }
    if (!userId) {
      showToast(tt("study.needSession", "Inicia sesión para subir archivos."), "warning");
      return;
    }

    const maxMb = 12;
    if (file.size > maxMb * 1024 * 1024) {
      showToast(tt("study.fileTooLarge", "Archivo demasiado grande.").replace("{{mb}}", String(maxMb)), "warning");
      return;
    }

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^\w.\-()\s]/g, "_").slice(0, 120);
    const path = `${userId}/${id}/${safeName}`;

    try {
      const up = await sb.storage.from("study_files").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (up.error) throw up.error;

      // Phase 3: best-effort text extraction (stored into `body`).
      let extracted = "";
      try {
        const nameLow = file.name.toLowerCase();
        const isPdf = file.type === "application/pdf" || nameLow.endsWith(".pdf");
        const isText =
          file.type.startsWith("text/") || nameLow.endsWith(".txt") || nameLow.endsWith(".md") || nameLow.endsWith(".markdown");
        if (isPdf) extracted = await extractTextFromPdfFile(file);
        else if (isText) extracted = await file.text();
        // Soft limit to keep rows reasonable (RAG/chunking will come later).
        if (extracted.length > 200_000) extracted = extracted.slice(0, 200_000);
        extracted = extracted.trim();
      } catch {
        extracted = "";
      }

      const src: Source = {
        id,
        title: (pendingUploadMeta?.title ?? "").trim() || safeName.replace(/\.(pdf|txt|md)$/i, ""),
        kind: "file",
        url: (pendingUploadMeta?.url ?? "").trim() || undefined,
        filePath: path,
        fileName: file.name,
        fileMime: file.type || undefined,
        fileSize: file.size,
        body: extracted || undefined,
        createdAt: new Date().toISOString(),
      };
      pendingUploadMeta = null;
      state.sources.unshift(src);
      state.activeIds.push(src.id);
      saveWorkspaceState(getStorageKey(), state);
      if (activeStudySpaceId) {
        await upsertSource(sb, userId, activeStudySpaceId, src);
        await replaceChunksForSource(sb, userId, activeStudySpaceId, src.id, src.body, src.kind);
        await upsertWorkspace(sb, activeStudySpaceId, state);
      }
      render();
      showToast(tt("study.fileUploaded", "Archivo subido."), "success");
    } catch {
      showToast(tt("study.fileUploadError", "No se pudo subir el archivo."), "error");
    }
  });

  cancelAdd.addEventListener("click", () => {
    tearDownAddPanelEditor(false);
    panel.classList.add("hidden");
  });

  saveAdd.addEventListener("click", () => {
    const title = titleIn.value.trim();
    if (!title) {
      showToast(tt("study.needTitle", "Escribe un título."), "warning");
      return;
    }
    const addKind = getSelectedAddSourceKind();
    let src: Source;
    if (addKind === "link") {
      const url = urlIn.value.trim();
      if (!url) {
        showToast(tt("study.needUrl", "Pega la URL del enlace."), "warning");
        return;
      }
      const body = noteIn.value.trim() || undefined;
      src = {
        id: crypto.randomUUID(),
        title,
        kind: "link",
        url,
        body,
        createdAt: new Date().toISOString(),
      };
    } else if (addKind === "code") {
      const body = (addPanelCodeEditor?.getDoc() ?? noteIn.value ?? "").trim();
      if (!body) {
        showToast(tt("study.needCodeBody", "Escribe el código o pégalo aquí."), "warning");
        return;
      }
      const lang = (codeLangSel?.value ?? "plaintext").trim() || "plaintext";
      src = {
        id: crypto.randomUUID(),
        title,
        kind: "code",
        body,
        codeLanguage: lang,
        createdAt: new Date().toISOString(),
      };
    } else {
      const body = noteIn.value.trim() || undefined;
      src = {
        id: crypto.randomUUID(),
        title,
        kind: "note",
        body,
        createdAt: new Date().toISOString(),
      };
    }
    state.sources.unshift(src);
    state.activeIds.push(src.id);
    if (src.kind === "code") {
      state.focusedCodeSourceId = src.id;
      lastDockMountedId = null;
    }
    saveWorkspaceState(getStorageKey(), state);
    if (sb && userId && activeStudySpaceId) {
      void upsertSource(sb, userId, activeStudySpaceId, src);
      void replaceChunksForSource(sb, userId, activeStudySpaceId, src.id, src.body, src.kind);
      void upsertWorkspace(sb, activeStudySpaceId, state);
    }
    panel.classList.add("hidden");
    tearDownAddPanelEditor(false);
    titleIn.value = "";
    urlIn.value = "";
    noteIn.value = "";
    sourceKindRadios.forEach((r) => {
      r.checked = r.value === "note";
    });
    if (codeLangSel) codeLangSel.value = "typescript";
    syncAddPanelKindUi();
    render();
    showToast(tt("study.sourceSaved", "Fuente guardada."), "success");
  });

  searchIn.addEventListener("input", () => {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void runSearch(), 180);
  });

  searchScope.addEventListener("change", () => {
    void runSearch();
  });

  // Dynamic search results need their own click handling.
  searchResults.addEventListener("click", (ev) => {
    const el = ev.target as HTMLElement | null;
    const btn = el?.closest?.("button[data-study-open]") as HTMLButtonElement | null;
    if (!btn) return;
    const id = btn.dataset.studyOpen ?? "";
    void openFileSource(id);
  });

  dossierForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    void runDossier(dossierInput.value);
  });

  dossierResults.addEventListener("change", (ev) => {
    const el = ev.target as HTMLElement | null;
    const cb = el?.closest?.("input[data-dossier-pick]") as HTMLInputElement | null;
    if (!cb) return;
    const key = cb.dataset.dossierPick ?? "";
    if (!key) return;
    if (cb.checked) selectedRefs.add(key);
    else selectedRefs.delete(key);
    syncDossierSelectionUi();
  });

  dossierResults.addEventListener("click", (ev) => {
    const el = ev.target as HTMLElement | null;
    const openBtn = el?.closest?.("button[data-study-open]") as HTMLButtonElement | null;
    if (openBtn) {
      const id = openBtn.dataset.studyOpen ?? "";
      void openFileSource(id);
      return;
    }
    const noteBtn = el?.closest?.("button[data-dossier-note]") as HTMLButtonElement | null;
    if (noteBtn) {
      const key = noteBtn.dataset.dossierNote ?? "";
      const [sourceId, chunkIndexStr] = key.split(":");
      const chunkIndex = Number(chunkIndexStr);
      const hit = dossierLastHits.find((h) => h.sourceId === sourceId && h.chunkIndex === chunkIndex);
      if (!hit) return;
      const byId = new Map(state.sources.map((s) => [s.id, s]));
      const src = byId.get(sourceId);
      const label = src?.title ? `${src.title} #${chunkIndex + 1}` : `Fuente #${chunkIndex + 1}`;
      const toAdd = `- ${label}\n  ${hit.body.slice(0, 600).trim().replace(/\n/g, "\n  ")}\n`;
      const cur = sessionNotes.value || "";
      sessionNotes.value = (cur.trim() ? cur.trimEnd() + "\n\n" : "") + toAdd;
      state.sessionNotes = sessionNotes.value;
      saveWorkspaceState(getStorageKey(), state);
      if (sb && userId && activeStudySpaceId) void upsertWorkspace(sb, activeStudySpaceId, state);
      showToast(tt("study.noteAdded", "Añadido a notas."), "success");
      return;
    }
    const expBtn = el?.closest?.("button[data-dossier-expand]") as HTMLButtonElement | null;
    if (expBtn) {
      const key = expBtn.dataset.dossierExpand ?? "";
      const box = dossierResults.querySelector<HTMLElement>(`[data-dossier-expanded="${CSS.escape(key)}"]`);
      if (!box) return;
      const isHidden = box.classList.contains("hidden");
      box.classList.toggle("hidden");
      expBtn.innerHTML = isHidden
        ? `${esc(tt("study.lessContext", "Ver menos"))} <span class="text-gray-400">\u25B4</span>`
        : `${esc(tt("study.moreContext", "Ver más contexto"))} <span class="text-gray-400">\u25BE</span>`;
    }
  });

  dossierSave.addEventListener("click", () => {
    if (selectedRefs.size === 0) return;
    const q = dossierInput.value.trim();
    const titleDefault = q.slice(0, 40) || tt("study.dossierDefaultTitle", "Dossier");
    titleInModal.value = titleDefault;
    titleModal.showModal();
    titleInModal.focus();
    titleInModal.select();

    const onClose = () => {
      titleModal.removeEventListener("close", onClose);
      if (titleModal.returnValue !== "ok") return;
      const title = titleInModal.value.trim();
      if (!title) return;
      const scopeMode = (searchScope.value || "context") as "context" | "all";
      const selected = Array.from(selectedRefs);
      const chunks: DossierChunkRef[] = [];
      for (const key of selected) {
        const [sourceId, chunkIndexStr] = key.split(":");
        const chunkIndex = Number(chunkIndexStr);
        const hit = dossierLastHits.find((h) => h.sourceId === sourceId && h.chunkIndex === chunkIndex);
        if (!hit) continue;
        chunks.push({ sourceId, chunkIndex, excerpt: hit.body.slice(0, 600) });
      }
      const d: Dossier = {
        id: crypto.randomUUID(),
        title,
        query: q,
        scope: scopeMode,
        createdAt: new Date().toISOString(),
        chunks,
      };
      dossiers = [d, ...dossiers].slice(0, 50);
      saveDossiers(dossiers);
      renderDossiersPanel();
      showToast(tt("study.dossierSaved", "Dossier guardado."), "success");
    };
    titleModal.addEventListener("close", onClose);
  });

  dossiersEl.addEventListener("click", (ev) => {
    const el = ev.target as HTMLElement | null;
    const delBtn = el?.closest?.("button[data-dossier-del]") as HTMLButtonElement | null;
    if (delBtn) {
      const id = delBtn.dataset.dossierDel ?? "";
      dossiers = dossiers.filter((d) => d.id !== id);
      saveDossiers(dossiers);
      renderDossiersPanel();
      return;
    }
    const openBtn = el?.closest?.("button[data-dossier-open]") as HTMLButtonElement | null;
    if (openBtn) {
      const id = openBtn.dataset.dossierOpen ?? "";
      const d = dossiers.find((x) => x.id === id);
      if (!d) return;
      renderDossierView(d);
      (dossierViewModal as any).dataset.dossierId = d.id;
      dossierViewModal.showModal();
    }
  });

  dossierViewBody.addEventListener("click", (ev) => {
    const el = ev.target as HTMLElement | null;
    const openBtn = el?.closest?.("button[data-study-open]") as HTMLButtonElement | null;
    if (openBtn) {
      const id = openBtn.dataset.studyOpen ?? "";
      void openFileSource(id);
      return;
    }
    const noteBtn = el?.closest?.("button[data-dossier-note]") as HTMLButtonElement | null;
    if (!noteBtn) return;
    const sourceId = noteBtn.dataset.dossierNoteSource ?? "";
    const chunkIndex = Number(noteBtn.dataset.dossierNoteChunkIndex ?? "");
    if (!sourceId || !Number.isFinite(chunkIndex)) return;
    const dId = (dossierViewModal as any).dataset.dossierId as string | undefined;
    const d = dId ? dossiers.find((x) => x.id === dId) : null;
    const ref = d?.chunks.find((c) => c.sourceId === sourceId && c.chunkIndex === chunkIndex);
    if (!ref) return;
    const byId = new Map(state.sources.map((s) => [s.id, s]));
    const src = byId.get(sourceId);
    const label = src?.title ? `${src.title} #${chunkIndex + 1}` : `Fuente #${chunkIndex + 1}`;
    const toAdd = `- ${label}\n  ${ref.excerpt.trim().replace(/\n/g, "\n  ")}\n`;
    const cur = sessionNotes.value || "";
    sessionNotes.value = (cur.trim() ? cur.trimEnd() + "\n\n" : "") + toAdd;
    state.sessionNotes = sessionNotes.value;
    saveWorkspaceState(getStorageKey(), state);
    if (sb && userId && activeStudySpaceId) void upsertWorkspace(sb, activeStudySpaceId, state);
    showToast(tt("study.noteAdded", "Añadido a notas."), "success");
  });

  dossierViewCopy.addEventListener("click", async () => {
    const id = (dossierViewModal as any).dataset.dossierId as string | undefined;
    const d = id ? dossiers.find((x) => x.id === id) : null;
    if (!d) return;
    const md = dossierToMarkdown(d, sourcesLite());
    try {
      await navigator.clipboard.writeText(md);
      showToast(tt("study.dossierCopied", "Copiado."), "success");
    } catch {
      showToast(tt("study.dossierCopyError", "No se pudo copiar."), "warning");
    }
  });

  dossierViewExport.addEventListener("click", () => {
    const id = (dossierViewModal as any).dataset.dossierId as string | undefined;
    const d = id ? dossiers.find((x) => x.id === id) : null;
    if (!d) return;
    const md = dossierToMarkdown(d, sourcesLite());
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = d.title.replace(/[^\w.\-()\s]/g, "_").slice(0, 80) || "dossier";
    a.download = `${safe}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  dossierViewReapply.addEventListener("click", () => {
    const id = (dossierViewModal as any).dataset.dossierId as string | undefined;
    const d = id ? dossiers.find((x) => x.id === id) : null;
    if (!d) return;
    dossierViewModal.close();
    dossierInput.value = d.query;
    selectedRefs.clear();
    for (const c of d.chunks ?? []) selectedRefs.add(`${c.sourceId}:${c.chunkIndex}`);
    void runDossier(d.query);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-study-out]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.studyOut ?? "";
      showToast(tt("study.outSoon", "Generación «{{kind}}»: próxima iteración (necesita modelo).").replace("{{kind}}", kind), "success");
    });
  });

  const updateUserNoteMarkdownPreview = (wrap: HTMLElement) => {
    const bodyTa = wrap.querySelector<HTMLTextAreaElement>("[data-user-note-body]");
    const prev = wrap.querySelector<HTMLElement>("[data-user-note-preview]");
    if (!bodyTa || !prev) return;
    const md = bodyTa.value ?? "";
    if (!md.trim()) {
      prev.innerHTML = `<span class="text-gray-500 dark:text-gray-400 italic text-[10px]">${esc(
        tt("study.userNotesPreviewEmpty", "Escribe Markdown en el cuerpo…"),
      )}</span>`;
      return;
    }
    try {
      prev.innerHTML = renderMarkdownSafe(md);
    } catch {
      prev.textContent = md;
    }
  };

  const renderUserNotes = () => {
    if (!userNotesList || !userNotesPanel) return;
    if (!userNotesAvailable) {
      userNotesPanel.classList.add("hidden");
      return;
    }
    userNotesPanel.classList.remove("hidden");
    if (userNoteRows.length === 0) {
      userNotesList.innerHTML = `<p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">${esc(tt("study.userNotesEmpty", "Aún no hay notas guardadas."))}</p>`;
      return;
    }
    userNotesList.innerHTML = userNoteRows
      .map(
        (n) => `
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 space-y-1.5" data-user-note-id="${esc(n.id)}">
      <div class="flex justify-between gap-2 items-start">
        <input type="text" data-user-note-title class="w-full text-xs rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-2 py-1" value="${esc(n.title)}" />
        <button type="button" data-user-note-delete class="text-[11px] text-red-600 dark:text-red-400 shrink-0 hover:underline">${esc(tt("study.userNotesDelete", "Eliminar"))}</button>
      </div>
      <label class="block text-[11px] font-semibold text-gray-600 dark:text-gray-400">
        <span>${esc(tt("study.userNotesCodeLanguage", "Language"))}</span>
        <select data-user-note-code-lang class="mt-1 w-full text-xs rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-2 py-1">${buildUserNoteCodeLanguageSelectHtml(n.code_language)}</select>
      </label>
      <textarea rows="${n.code_language ? 10 : 6}" data-user-note-body class="w-full text-xs rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-2 py-1.5 font-mono">${esc(n.body)}</textarea>
      <details class="rounded border border-gray-200/70 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-2 py-1">
        <summary class="text-[10px] font-semibold cursor-pointer text-gray-600 dark:text-gray-400 select-none list-none [&::-webkit-details-marker]:hidden">${esc(
          tt("study.userNotesPreviewToggle", "Vista previa (Markdown)"),
        )}</summary>
        <div class="study-note-md-preview mt-2 border-t border-gray-200/60 dark:border-gray-700 pt-2 text-xs" data-user-note-preview></div>
      </details>
    </div>`,
      )
      .join("");
    userNotesList.querySelectorAll<HTMLElement>("[data-user-note-id]").forEach((w) => updateUserNoteMarkdownPreview(w));
  };

  const scheduleNoteSave = (id: string, title: string, body: string, code_language: string | null) => {
    const prev = noteSaveTimers.get(id);
    if (prev) window.clearTimeout(prev);
    noteSaveTimers.set(
      id,
      window.setTimeout(async () => {
        noteSaveTimers.delete(id);
        if (!sb || !userId) return;
        try {
          if (!activeStudySpaceId) return;
          await updateStudyUserNote(sb, userId, activeStudySpaceId, id, { title, body, code_language });
        } catch {
          showToast(tt("study.userNotesSaveError", "No se pudo guardar la nota."), "warning");
        }
      }, 450),
    );
  };

  const readNoteRowPatch = (wrap: HTMLElement) => {
    const titleInp = wrap.querySelector<HTMLInputElement>("[data-user-note-title]");
    const bodyTa = wrap.querySelector<HTMLTextAreaElement>("[data-user-note-body]");
    const langSel = wrap.querySelector<HTMLSelectElement>("[data-user-note-code-lang]");
    const id = wrap.dataset.userNoteId ?? "";
    const rawLang = langSel?.value?.trim() ?? "";
    const code_language = rawLang === "" ? null : rawLang;
    return { id, title: titleInp?.value ?? "", body: bodyTa?.value ?? "", code_language, bodyTa };
  };

  const loadUserNotes = async () => {
    if (!sb || !userId || !activeStudySpaceId || !userNotesList || !userNotesPanel) return;
    try {
      userNoteRows = await fetchStudyUserNotes(sb, userId, activeStudySpaceId);
      userNotesAvailable = true;
      renderUserNotes();
    } catch (e) {
      if (isStudyUserNotesMissingTable(e)) {
        userNotesAvailable = false;
        userNotesPanel.classList.add("hidden");
        return;
      }
      userNotesAvailable = false;
      userNotesPanel.classList.remove("hidden");
      userNotesList.innerHTML = `<p class="m-0 text-[11px] text-amber-800 dark:text-amber-200">${esc(tt("study.userNotesLoadError", "No se pudieron cargar las notas guardadas."))}</p>`;
    }
  };

  userNotesList?.addEventListener("input", (ev) => {
    const wrap = (ev.target as HTMLElement).closest<HTMLElement>("[data-user-note-id]");
    if (!wrap) return;
    const { id, title, body, code_language } = readNoteRowPatch(wrap);
    if (!id) return;
    if ((ev.target as HTMLElement).matches("textarea[data-user-note-body]")) updateUserNoteMarkdownPreview(wrap);
    scheduleNoteSave(id, title, body, code_language);
  });

  userNotesList?.addEventListener("change", (ev) => {
    const t = ev.target as HTMLElement;
    if (!t.matches("select[data-user-note-code-lang]")) return;
    const wrap = t.closest<HTMLElement>("[data-user-note-id]");
    if (!wrap) return;
    const { id, title, body, code_language, bodyTa } = readNoteRowPatch(wrap);
    if (!id) return;
    updateUserNoteMarkdownPreview(wrap);
    if (bodyTa) bodyTa.rows = code_language ? 10 : 6;
    const row = userNoteRows.find((x) => x.id === id);
    if (row) row.code_language = code_language;
    scheduleNoteSave(id, title, body, code_language);
  });

  userNotesList?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-user-note-delete]");
    if (!btn || !sb || !userId || !activeStudySpaceId) return;
    const wrap = btn.closest<HTMLElement>("[data-user-note-id]");
    const id = wrap?.dataset.userNoteId ?? "";
    if (!id) return;
    void (async () => {
      try {
        await deleteStudyUserNote(sb, userId, activeStudySpaceId, id);
        userNoteRows = userNoteRows.filter((x) => x.id !== id);
        renderUserNotes();
      } catch {
        showToast(tt("study.userNotesDeleteError", "No se pudo eliminar la nota."), "warning");
      }
    })();
  });

  const chatMessages = document.querySelector<HTMLElement>("[data-study-chat-messages]");
  const chatForm = document.querySelector<HTMLFormElement>("[data-study-chat-form]");
  const chatInput = document.querySelector<HTMLTextAreaElement>("[data-study-chat-input]");
  const chatSend = document.querySelector<HTMLButtonElement>("[data-study-chat-send]");
  const chatDisabledMsg = document.querySelector<HTMLElement>("[data-study-chat-disabled-msg]");
  const chatHint = document.querySelector<HTMLElement>("[data-study-chat-hint]");
  const citeFocus = document.querySelector<HTMLElement>("[data-study-cite-focus]");
  const citeTitle = document.querySelector<HTMLElement>("[data-study-cite-title]");
  const citeMeta = document.querySelector<HTMLElement>("[data-study-cite-meta]");
  const citeBody = document.querySelector<HTMLElement>("[data-study-cite-body]");
  const citeSourceBtn = document.querySelector<HTMLButtonElement>("[data-study-cite-source]");
  const citeHighlightBtn = document.querySelector<HTMLButtonElement>("[data-study-cite-highlight]");

  if (
    chatMessages &&
    chatForm &&
    chatInput &&
    chatSend &&
    chatDisabledMsg &&
    chatHint &&
    citeFocus &&
    citeTitle &&
    citeMeta &&
    citeBody &&
    citeSourceBtn &&
    citeHighlightBtn
  ) {
    wireStudyChatUi(
      {
        messages: chatMessages,
        form: chatForm,
        input: chatInput,
        send: chatSend,
        disabledMsg: chatDisabledMsg,
        hint: chatHint,
        citeFocus,
        citeTitle,
        citeMeta,
        citeBody,
        citeSourceBtn: citeSourceBtn,
        citeHighlightBtn: citeHighlightBtn,
      },
      {
        chatEnabled: root.dataset.studyChatEnabled === "1",
        getSupabase: () => sb,
        getUserId: () => userId,
        getScope: () => (searchScope.value || "context") as "context" | "all",
        getContextSourceIds: () => state.activeIds,
        getAllSourceIds: () => state.sources.map((s) => s.id),
        openFileSource,
        flashSourceRow,
      },
    );
  }

  userNoteAddBtn?.addEventListener("click", async () => {
    if (!sb || !userId || !activeStudySpaceId) {
      showToast(tt("study.searchNeedSession", "Inicia sesión para usar notas guardadas."), "warning");
      return;
    }
    try {
      const n = await insertStudyUserNote(sb, userId, activeStudySpaceId, {
        title: "",
        body: "",
        sort_order: userNoteRows.length,
        code_language: null,
      });
      userNoteRows.push(n);
      renderUserNotes();
    } catch (e) {
      if (isStudyUserNotesMissingTable(e)) {
        userNotesAvailable = false;
        userNotesPanel?.classList.add("hidden");
        showToast(tt("study.userNotesNeedSql", "Saved notes are not available right now. Please try again later."), "warning");
        return;
      }
      showToast(tt("study.userNotesAddError", "No se pudo crear la nota."), "warning");
    }
  });

  void (async () => {
    const croot = document.querySelector<HTMLElement>("[data-study-curriculum]");
    const guestBootstrap = async () => {
      setStudyDossierSpaceContext(null);
      setStudyCurriculumSpaceContext(null);
      dossiers = await hydrateDossiersFromRemote(false, null);
      renderDossiersPanel();
      if (croot) {
        const blocks = await hydrateCurriculumFromRemote(false, null);
        wireStudyCurriculumUi(croot, { tt, initialBlocks: blocks });
      }
    };

    if (!sb) {
      await guestBootstrap();
      return;
    }

    const uid = await getSessionUserId(sb);
    if (!uid) {
      await guestBootstrap();
      return;
    }

    userId = uid;
    await refreshTechnologyNames();
    studySpacesCache = await fetchStudySpaces(sb, uid);
    if (studySpacesCache.length === 0) {
      await ensureDefaultStudySpace(sb, uid);
      studySpacesCache = await fetchStudySpaces(sb, uid);
    }

    const prefs = await loadClientState<{
      activeStudySpaceId?: string;
      goalLabel?: string;
    }>("study_prefs", {});

    const prefId = typeof prefs.activeStudySpaceId === "string" ? prefs.activeStudySpaceId.trim() : "";
    activeStudySpaceId =
      prefId && studySpacesCache.some((s) => s.id === prefId)
        ? prefId
        : studySpacesCache[0]?.id ?? null;

    if (!activeStudySpaceId) {
      await guestBootstrap();
      return;
    }

    setStudyDossierSpaceContext(activeStudySpaceId);
    setStudyCurriculumSpaceContext(activeStudySpaceId);
    await saveClientState("study_prefs", { ...prefs, activeStudySpaceId });

    state = loadWorkspaceState(getStorageKey());
    sessionNotes.value = state.sessionNotes;

    await maybeMigrateLocalToSupabase(sb, uid, activeStudySpaceId);
    const remote = await loadFromSupabase(sb, uid, activeStudySpaceId);
    if (remote) {
      const prevFocus = state.focusedCodeSourceId ?? null;
      const prevFolders = { ...state.sourceFolderById };
      const prevCustom = [...state.customStudyFolders];
      state = remote;
      lastStudyConceptFetchKey = null;
      const mergedCustom = [...prevCustom];
      const seenC = new Set(mergedCustom.map((f) => f.id));
      for (const f of state.customStudyFolders) {
        if (!seenC.has(f.id)) {
          seenC.add(f.id);
          mergedCustom.push(f);
        }
      }
      const customIds = new Set(mergedCustom.map((f) => f.id));
      const nextFolders: Record<string, string> = {};
      for (const s of state.sources) {
        const v = prevFolders[s.id];
        const conceptFolder = typeof v === "string" && v.startsWith("c:") && v.length > 2;
        if (
          typeof v === "string" &&
          (v === "" || state.linkedTechnologyIds.includes(v) || customIds.has(v) || conceptFolder)
        ) {
          nextFolders[s.id] = v;
        }
      }
      const nextFocus =
        prevFocus && state.sources.some((s) => s.id === prevFocus && s.kind === "code") ? prevFocus : null;
      state = {
        ...state,
        customStudyFolders: mergedCustom,
        sourceFolderById: nextFolders,
        focusedCodeSourceId: nextFocus,
      };
      lastDockMountedId = null;
      saveWorkspaceState(getStorageKey(), state);
      sessionNotes.value = state.sessionNotes;
      await refreshTechnologyNames();
      render();
    }

    const spRow = studySpacesCache.find((s) => s.id === activeStudySpaceId);
    if (goalIn) {
      goalIn.value = (spRow?.title ?? "").trim();
      if (!goalIn.value.trim() && typeof prefs.goalLabel === "string" && prefs.goalLabel.trim()) {
        goalIn.value = prefs.goalLabel.trim();
        await updateStudySpaceTitle(sb, uid, activeStudySpaceId, goalIn.value);
        const { goalLabel: _drop, ...rest } = prefs;
        await saveClientState("study_prefs", { ...rest, activeStudySpaceId });
      }
    }

    fillSpaceSelect();

    dossiers = await hydrateDossiersFromRemote(true, activeStudySpaceId);
    renderDossiersPanel();

    updateStudyActiveTitle();
    await loadUserNotes();
    await wireStudySkillAtlasLinks(
      sb,
      uid,
      () => activeStudySpaceId,
      () => state,
      (next) => {
        state = next;
        saveWorkspaceState(getStorageKey(), state);
        void refreshTechnologyNames().then(() => render());
      },
      tt,
    );

    if (croot) {
      const blocks = await hydrateCurriculumFromRemote(true, activeStudySpaceId);
      wireStudyCurriculumUi(croot, { tt, initialBlocks: blocks });
    }

    if (goalIn && !goalIn.value.trim()) {
      requestAnimationFrame(() => requestAnimationFrame(() => openStudySetup()));
    }
  })();

  if (goalIn) {
    goalIn.addEventListener("input", () => updateStudyActiveTitle());
    goalIn.addEventListener("change", scheduleStudyGoalPersist);
    goalIn.addEventListener("blur", scheduleStudyGoalPersist);
  }

  goalSaveBtn?.addEventListener("click", async () => {
    if (!sb || !(await getSessionUserId(sb))) {
      showToast(tt("study.goalNeedSessionToast", "Inicia sesión para guardar el objetivo en tu cuenta."), "warning");
      return;
    }
    if (goalPersistTimer != null) {
      window.clearTimeout(goalPersistTimer);
      goalPersistTimer = null;
    }
    setGoalActionsBusy(true);
    const ok = await persistStudyGoalPrefs();
    setGoalActionsBusy(false);
    if (ok) {
      updateStudyActiveTitle();
      showToast(tt("study.goalSavedToast", "Objetivo guardado."), "success");
    } else showToast(tt("study.goalSaveErrorToast", "No se pudo guardar el objetivo. Revisa la conexión o inténtalo de nuevo."), "error");
  });

  renderDossiersPanel();
  render();
  updateStudyActiveTitle();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);

