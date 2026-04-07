import i18next from "i18next";
import { showToast } from "@scripts/core/ui-feedback";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";

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

type SupabaseLike = any;

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

function toDbSource(s: Source, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    title: s.title,
    kind: s.kind,
    url: s.url ?? null,
    body: s.body ?? null,
    created_at: s.createdAt,
  };
}

function fromDbSource(row: any): Source | null {
  const id = String(row?.id ?? "").trim();
  const title = String(row?.title ?? "").trim();
  const kind = String(row?.kind ?? "").trim() as Source["kind"];
  if (!id || !title || (kind !== "note" && kind !== "link")) return null;
  const url = typeof row?.url === "string" ? row.url : undefined;
  const body = typeof row?.body === "string" ? row.body : undefined;
  const createdAt = String(row?.created_at ?? row?.createdAt ?? new Date().toISOString());
  return { id, title, kind, url: url || undefined, body: body || undefined, createdAt };
}

async function loadFromSupabase(sb: SupabaseLike, userId: string): Promise<State | null> {
  try {
    const [wsRes, srcRes] = await Promise.all([
      sb.from("study_workspaces").select("active_ids, session_notes").eq("user_id", userId).maybeSingle(),
      sb.from("study_sources").select("id,title,kind,url,body,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    if (wsRes.error && String(wsRes.error.code ?? "") !== "PGRST116") return null;
    if (srcRes.error) return null;
    const ws = wsRes.data ?? null;
    const activeIds = Array.isArray(ws?.active_ids) ? ws.active_ids.filter((x: any) => typeof x === "string") : [];
    const sessionNotes = typeof ws?.session_notes === "string" ? ws.session_notes : "";
    const sources = (srcRes.data ?? []).map(fromDbSource).filter(Boolean) as Source[];
    return { sources, activeIds, sessionNotes };
  } catch {
    return null;
  }
}

async function upsertWorkspace(sb: SupabaseLike, userId: string, state: State) {
  await sb
    .from("study_workspaces")
    .upsert(
      [{ user_id: userId, active_ids: state.activeIds, session_notes: state.sessionNotes }] as any,
      { onConflict: "user_id" },
    );
}

async function upsertSource(sb: SupabaseLike, userId: string, s: Source) {
  await sb.from("study_sources").upsert([toDbSource(s, userId)] as any, { onConflict: "id" });
}

async function deleteSource(sb: SupabaseLike, userId: string, id: string) {
  await sb.from("study_sources").delete().eq("user_id", userId).eq("id", id);
}

async function maybeMigrateLocalToSupabase(sb: SupabaseLike, userId: string) {
  // If remote is empty but local has content, migrate once.
  try {
    const existing = await sb.from("study_sources").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((existing.count ?? 0) > 0) return;
  } catch {
    return;
  }
  const local = loadState();
  if (local.sources.length === 0 && local.sessionNotes.trim() === "" && local.activeIds.length === 0) return;
  try {
    for (const s of local.sources) await upsertSource(sb, userId, s);
    await upsertWorkspace(sb, userId, local);
  } catch {
    // ignore
  }
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

  const sb = getSupabaseBrowserClient();
  let userId: string | null = null;
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
        if (sb && userId) void upsertWorkspace(sb, userId, state);
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
        if (sb && userId) void deleteSource(sb, userId, id);
        if (sb && userId) void upsertWorkspace(sb, userId, state);
        render();
      });
    });

    syncBadge();
  };

  sessionNotes.addEventListener("input", () => {
    state.sessionNotes = sessionNotes.value;
    saveState(state);
    if (sb && userId) void upsertWorkspace(sb, userId, state);
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
    if (sb && userId) void upsertSource(sb, userId, src);
    if (sb && userId) void upsertWorkspace(sb, userId, state);
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

  // Hydrate from Supabase when available.
  void (async () => {
    if (!sb) return;
    const uid = await getSessionUserId(sb);
    if (!uid) return;
    userId = uid;
    await maybeMigrateLocalToSupabase(sb, uid);
    const remote = await loadFromSupabase(sb, uid);
    if (remote) {
      state = remote;
      saveState(state); // cache locally for offline
      sessionNotes.value = state.sessionNotes;
      render();
    }
  })();

  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
