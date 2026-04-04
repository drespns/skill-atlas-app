import i18next from "i18next";
import { showToast } from "./ui-feedback";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

const STORAGE_KEY = "skillatlas_study_workspace_v1";

type Source = {
  id: string;
  title: string;
  kind: "note" | "link";
  url?: string;
  body?: string;
  createdAt: string;
};

type State = {
  sources: Source[];
  /** IDs included as "context" for future RAG */
  activeIds: string[];
  sessionNotes: string;
};

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sources: [], activeIds: [], sessionNotes: "" };
    const p = JSON.parse(raw) as Partial<State>;
    const sources = Array.isArray(p.sources) ? p.sources : [];
    const activeIds = Array.isArray(p.activeIds) ? p.activeIds : [];
    const sessionNotes = typeof p.sessionNotes === "string" ? p.sessionNotes : "";
    return { sources, activeIds, sessionNotes };
  } catch {
    return { sources: [], activeIds: [], sessionNotes: "" };
  }
}

function saveState(s: State) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function init() {
  const root = document.querySelector("[data-study-root]");
  if (!root) return;
  if (root.dataset.studyBound === "1") return;
  root.dataset.studyBound = "1";

  const listEl = document.querySelector<HTMLElement>("[data-study-sources]");
  const addBtn = document.querySelector<HTMLButtonElement>("[data-study-add-source]");
  const panel = document.querySelector<HTMLElement>("[data-study-add-panel]");
  const titleIn = document.querySelector<HTMLInputElement>("[data-study-input-title]");
  const urlIn = document.querySelector<HTMLInputElement>("[data-study-input-url]");
  const noteIn = document.querySelector<HTMLTextAreaElement>("[data-study-input-note]");
  const cancelAdd = document.querySelector<HTMLButtonElement>("[data-study-cancel-add]");
  const saveAdd = document.querySelector<HTMLButtonElement>("[data-study-save-add]");
  const sessionNotes = document.querySelector<HTMLTextAreaElement>("[data-study-session-notes]");
  const badge = document.querySelector<HTMLElement>("[data-study-context-badge]");

  if (!listEl || !addBtn || !panel || !titleIn || !urlIn || !noteIn || !cancelAdd || !saveAdd || !sessionNotes || !badge) return;

  let state = loadState();
  sessionNotes.value = state.sessionNotes;

  const syncBadge = () => {
    const n = state.activeIds.length;
    const v = i18next.t("study.contextBadge", { count: n });
    badge.textContent = typeof v === "string" && v !== "study.contextBadge" ? v : `${n} en contexto`;
  };

  const render = () => {
    listEl.innerHTML = "";
    if (state.sources.length === 0) {
      listEl.innerHTML = `<p class="m-0 px-2 py-6 text-center text-xs text-gray-500 dark:text-gray-400">${esc(tt("study.emptySources", "Aún no hay fuentes. Añade un enlace o una nota."))}</p>`;
      syncBadge();
      return;
    }
    for (const s of state.sources) {
      const active = state.activeIds.includes(s.id);
      const row = document.createElement("div");
      row.className = `flex items-start gap-2 rounded-xl px-2 py-2 text-sm border ${
        active ? "border-indigo-300/80 dark:border-indigo-700/60 bg-indigo-50/50 dark:bg-indigo-950/25" : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/50"
      }`;
      const kindLabel = s.kind === "link" ? "🔗" : "📄";
      row.innerHTML = `
        <label class="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
          <input type="checkbox" class="mt-1 rounded border-gray-300 dark:border-gray-600" data-study-active="${esc(s.id)}" ${active ? "checked" : ""} />
          <span class="min-w-0 flex-1">
            <span class="font-semibold text-gray-900 dark:text-gray-100">${kindLabel} ${esc(s.title)}</span>
            ${s.kind === "link" && s.url ? `<span class="block text-[11px] text-gray-500 truncate">${esc(s.url)}</span>` : ""}
          </span>
        </label>
        <button type="button" class="shrink-0 text-xs text-red-600 dark:text-red-400 hover:underline" data-study-del="${esc(s.id)}">${esc(tt("study.delete", "Quitar"))}</button>
      `;
      listEl.appendChild(row);
    }

    listEl.querySelectorAll<HTMLInputElement>("input[data-study-active]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.studyActive ?? "";
        const set = new Set(state.activeIds);
        if (cb.checked) set.add(id);
        else set.delete(id);
        state.activeIds = Array.from(set);
        saveState(state);
        syncBadge();
        render();
      });
    });

    listEl.querySelectorAll<HTMLButtonElement>("button[data-study-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.studyDel ?? "";
        state.sources = state.sources.filter((x) => x.id !== id);
        state.activeIds = state.activeIds.filter((x) => x !== id);
        saveState(state);
        render();
      });
    });

    syncBadge();
  };

  sessionNotes.addEventListener("input", () => {
    state.sessionNotes = sessionNotes.value;
    saveState(state);
  });

  addBtn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      titleIn.value = "";
      urlIn.value = "";
      noteIn.value = "";
      titleIn.focus();
    }
  });

  cancelAdd.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  saveAdd.addEventListener("click", () => {
    const title = titleIn.value.trim();
    if (!title) {
      showToast(tt("study.needTitle", "Escribe un título."), "warning");
      return;
    }
    const url = urlIn.value.trim();
    const body = noteIn.value.trim();
    const kind: Source["kind"] = url ? "link" : "note";
    const src: Source = {
      id: crypto.randomUUID(),
      title,
      kind,
      url: url || undefined,
      body: body || undefined,
      createdAt: new Date().toISOString(),
    };
    state.sources.unshift(src);
    state.activeIds.push(src.id);
    saveState(state);
    panel.classList.add("hidden");
    titleIn.value = "";
    urlIn.value = "";
    noteIn.value = "";
    render();
    showToast(tt("study.sourceSaved", "Fuente guardada."), "success");
  });

  document.querySelectorAll<HTMLButtonElement>("[data-study-out]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.studyOut ?? "";
      showToast(tt("study.outSoon", "Generación «{{kind}}»: próxima iteración (necesita modelo).").replace("{{kind}}", kind), "success");
    });
  });

  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
document.addEventListener("astro:page-load", init);
