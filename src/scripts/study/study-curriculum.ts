import { loadClientState, scheduleSaveClientState } from "@scripts/core/user-client-state";

export type CurriculumTopicStatus = "todo" | "doing" | "done";

export type CurriculumTopic = {
  id: string;
  title: string;
  status: CurriculumTopicStatus;
};

export type CurriculumBlock = {
  id: string;
  title: string;
  topics: CurriculumTopic[];
};

const CURRICULUM_V1 = "skillatlas_study_curriculum_v1";
const CURRICULUM_V2 = "skillatlas_study_curriculum_v2";

let curriculumSpaceId: string | null = null;

export function setStudyCurriculumSpaceContext(studySpaceId: string | null) {
  curriculumSpaceId = studySpaceId;
}

function spaceKey(): string {
  return curriculumSpaceId ?? "__guest__";
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function readAllBySpace(): Record<string, CurriculumBlock[]> {
  try {
    const v2 = localStorage.getItem(CURRICULUM_V2);
    if (v2) {
      const p = JSON.parse(v2) as { bySpaceId?: Record<string, unknown[]> };
      const m = p?.bySpaceId && typeof p.bySpaceId === "object" ? p.bySpaceId : {};
      const out: Record<string, CurriculumBlock[]> = {};
      for (const [k, v] of Object.entries(m)) {
        out[k] = Array.isArray(v) ? normalizeBlocks(v as unknown[]) : [];
      }
      return out;
    }
    const v1 = localStorage.getItem(CURRICULUM_V1);
    if (v1) {
      const p = JSON.parse(v1) as unknown;
      const blocks = Array.isArray(p) ? normalizeBlocks(p as unknown[]) : [];
      return blocks.length ? { __legacy__: blocks } : {};
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeAllBySpace(by: Record<string, CurriculumBlock[]>) {
  localStorage.setItem(CURRICULUM_V2, JSON.stringify({ v: 2, bySpaceId: by }));
}

function readLocal(): CurriculumBlock[] {
  const all = readAllBySpace();
  return all[spaceKey()] ?? [];
}

function writeLocal(blocks: CurriculumBlock[]) {
  const key = spaceKey();
  const all = readAllBySpace();
  all[key] = blocks;
  writeAllBySpace(all);
}

function normalizeBlocks(raw: unknown[]): CurriculumBlock[] {
  const out: CurriculumBlock[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const id = typeof (b as any).id === "string" ? (b as any).id : newId();
    const title = typeof (b as any).title === "string" ? (b as any).title : "";
    const topicsIn = Array.isArray((b as any).topics) ? (b as any).topics : [];
    const topics: CurriculumTopic[] = [];
    for (const t of topicsIn) {
      if (!t || typeof t !== "object") continue;
      const tid = typeof (t as any).id === "string" ? (t as any).id : newId();
      const ttitle = typeof (t as any).title === "string" ? (t as any).title : "";
      const st = (t as any).status;
      const status: CurriculumTopicStatus =
        st === "doing" || st === "done" || st === "todo" ? st : "todo";
      topics.push({ id: tid, title: ttitle, status });
    }
    out.push({ id, title, topics });
  }
  return out;
}

export function loadCurriculumLocal(): CurriculumBlock[] {
  return readLocal();
}

type RemoteCurriculum = { v?: number; blocks?: CurriculumBlock[]; bySpaceId?: Record<string, CurriculumBlock[]> };

function normalizeRemoteCurriculum(remote: RemoteCurriculum, fallbackKey: string): Record<string, CurriculumBlock[]> {
  if (remote.v === 2 && remote.bySpaceId && typeof remote.bySpaceId === "object") {
    const out: Record<string, CurriculumBlock[]> = {};
    for (const [k, v] of Object.entries(remote.bySpaceId)) {
      out[k] = Array.isArray(v) ? normalizeBlocks(v as unknown[]) : [];
    }
    return out;
  }
  const legacy = Array.isArray(remote.blocks) ? normalizeBlocks(remote.blocks as unknown[]) : [];
  return legacy.length ? { [fallbackKey]: legacy } : {};
}

export async function hydrateCurriculumFromRemote(signedIn: boolean, studySpaceId: string | null): Promise<CurriculumBlock[]> {
  setStudyCurriculumSpaceContext(studySpaceId);
  const key = studySpaceId ?? "__guest__";
  const localAll = readAllBySpace();
  if (!signedIn) return localAll[key] ?? [];

  const remote = await loadClientState<RemoteCurriculum>("study_curriculum", {});
  const fromRemote = normalizeRemoteCurriculum(remote, key);
  const merged: Record<string, CurriculumBlock[]> = { ...localAll };
  for (const [k, v] of Object.entries(fromRemote)) {
    if (v.length > 0) merged[k] = v;
  }
  for (const [k, v] of Object.entries(localAll)) {
    if (!merged[k]?.length && v.length > 0) merged[k] = v;
  }
  writeAllBySpace(merged);
  scheduleSaveClientState("study_curriculum", { v: 2, bySpaceId: merged });
  return merged[key] ?? [];
}

export function persistCurriculum(blocks: CurriculumBlock[]) {
  writeLocal(blocks);
  const all = readAllBySpace();
  scheduleSaveClientState("study_curriculum", { v: 2, bySpaceId: all });
}

/** Progreso del temario (topics con status `done` vs total). */
export function summarizeCurriculumProgress(blocks: CurriculumBlock[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const b of blocks) {
    for (const t of b.topics) {
      total += 1;
      if (t.status === "done") done += 1;
    }
  }
  return { total, done };
}

export function curriculumBlocksFromRemote(data: unknown, studySpaceId?: string | null): CurriculumBlock[] {
  if (!data || typeof data !== "object") return [];
  const o = data as { v?: number; blocks?: unknown; bySpaceId?: Record<string, unknown[]> };
  if (o.v === 2 && o.bySpaceId && typeof o.bySpaceId === "object") {
    const key = studySpaceId ?? "__guest__";
    const raw = o.bySpaceId[key];
    return Array.isArray(raw) ? normalizeBlocks(raw as unknown[]) : [];
  }
  const raw = o.blocks;
  return Array.isArray(raw) ? normalizeBlocks(raw as unknown[]) : [];
}

const nextStatus = (s: CurriculumTopicStatus): CurriculumTopicStatus => {
  if (s === "todo") return "doing";
  if (s === "doing") return "done";
  return "todo";
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function wireStudyCurriculumUi(
  root: HTMLElement | null,
  options: {
    tt: (key: string, fb: string) => string;
    initialBlocks: CurriculumBlock[];
    onChange?: (blocks: CurriculumBlock[]) => void;
  },
) {
  if (!root) return { setBlocks: (_b: CurriculumBlock[]) => {} };

  const blocksWrap = root.querySelector<HTMLElement>("[data-study-curriculum-blocks]");
  if (!blocksWrap) return { setBlocks: (_b: CurriculumBlock[]) => {} };

  let blocks = options.initialBlocks;

  const statusClass = (s: CurriculumTopicStatus) => {
    if (s === "done") return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100";
    if (s === "doing") return "bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100";
    return "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200";
  };

  const statusLabel = (s: CurriculumTopicStatus) => {
    if (s === "done") return options.tt("study.curriculumStatusDone", "Done");
    if (s === "doing") return options.tt("study.curriculumStatusDoing", "In progress");
    return options.tt("study.curriculumStatusTodo", "Pending");
  };

  const render = () => {
    if (blocks.length === 0) {
      blocksWrap.innerHTML = `<p class="m-0 text-xs text-gray-500 dark:text-gray-400">${esc(
        options.tt("study.curriculumEmpty", "Add a block (e.g. SQL, Python) and break it into topics."),
      )}</p>`;
      return;
    }
    blocksWrap.innerHTML = blocks
      .map((b) => {
        const topicsHtml =
          b.topics.length === 0
            ? `<p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">${esc(
                options.tt("study.curriculumNoTopics", "No topics yet — add one."),
              )}</p>`
            : b.topics
                .map(
                  (t) => `
          <div class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200/80 dark:border-gray-800 bg-white/60 dark:bg-gray-950/40 px-2 py-1.5" data-ctopic-wrap="${esc(t.id)}">
            <input type="text" data-ctopic-title="${esc(t.id)}" value="${esc(t.title)}" class="min-w-[8rem] flex-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1" />
            <button type="button" data-ctopic-status="${esc(t.id)}" class="text-[11px] font-semibold rounded-md px-2 py-1 ${statusClass(t.status)}">${esc(statusLabel(t.status))}</button>
            <button type="button" data-ctopic-del="${esc(t.id)}" class="text-[11px] text-red-600 dark:text-red-400 hover:underline">${esc(
              options.tt("study.delete", "Remove"),
            )}</button>
          </div>`,
                )
                .join("");
        return `
        <div class="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-950/50 p-3 space-y-2" data-cblock="${esc(b.id)}">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <input type="text" data-cblock-title="${esc(b.id)}" value="${esc(b.title)}" class="min-w-[10rem] flex-1 text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5" placeholder="${esc(
              options.tt("study.curriculumBlockPlaceholder", "Block title"),
            )}" />
            <button type="button" data-cblock-del="${esc(b.id)}" class="text-[11px] text-red-600 dark:text-red-400 hover:underline shrink-0">${esc(
              options.tt("study.curriculumRemoveBlock", "Remove block"),
            )}</button>
          </div>
          <div class="space-y-1.5" data-cblock-topics="${esc(b.id)}">${topicsHtml}</div>
          <button type="button" data-cblock-add-topic="${esc(b.id)}" class="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">${esc(
            options.tt("study.curriculumAddTopic", "+ Topic"),
          )}</button>
        </div>`;
      })
      .join("");
  };

  const push = () => {
    options.onChange?.(blocks);
    persistCurriculum(blocks);
    render();
  };

  root.addEventListener("click", (ev) => {
    const el = ev.target as HTMLElement | null;
    const addBlock = el?.closest?.("[data-study-curriculum-add-block]") as HTMLElement | null;
    if (addBlock) {
      blocks = [...blocks, { id: newId(), title: "", topics: [] }];
      push();
      return;
    }
    const addTopicBtn = el?.closest?.("[data-cblock-add-topic]") as HTMLElement | null;
    if (addTopicBtn) {
      const bid = addTopicBtn.getAttribute("data-cblock-add-topic") ?? "";
      const b = blocks.find((x) => x.id === bid);
      if (b) {
        b.topics = [...b.topics, { id: newId(), title: "", status: "todo" }];
        push();
      }
      return;
    }
    const delBlock = el?.closest?.("[data-cblock-del]") as HTMLElement | null;
    if (delBlock) {
      const bid = delBlock.getAttribute("data-cblock-del") ?? "";
      blocks = blocks.filter((x) => x.id !== bid);
      push();
      return;
    }
    const delTopic = el?.closest?.("[data-ctopic-del]") as HTMLElement | null;
    if (delTopic) {
      const tid = delTopic.getAttribute("data-ctopic-del") ?? "";
      blocks = blocks.map((b) => ({
        ...b,
        topics: b.topics.filter((t) => t.id !== tid),
      }));
      push();
      return;
    }
    const stBtn = el?.closest?.("[data-ctopic-status]") as HTMLElement | null;
    if (stBtn) {
      const tid = stBtn.getAttribute("data-ctopic-status") ?? "";
      blocks = blocks.map((b) => ({
        ...b,
        topics: b.topics.map((t) => (t.id === tid ? { ...t, status: nextStatus(t.status) } : t)),
      }));
      push();
    }
  });

  root.addEventListener(
    "blur",
    (ev) => {
      const el = ev.target as HTMLElement | null;
      const ti = el as HTMLInputElement | null;
      if (!ti || ti.tagName !== "INPUT") return;
      if (ti.matches("[data-cblock-title]")) {
        const bid = ti.getAttribute("data-cblock-title") ?? "";
        const b = blocks.find((x) => x.id === bid);
        if (b) b.title = ti.value;
        push();
        return;
      }
      if (ti.matches("[data-ctopic-title]")) {
        const tid = ti.getAttribute("data-ctopic-title") ?? "";
        blocks = blocks.map((b) => ({
          ...b,
          topics: b.topics.map((t) => (t.id === tid ? { ...t, title: ti.value } : t)),
        }));
        push();
      }
    },
    true,
  );

  render();

  return {
    setBlocks(next: CurriculumBlock[]) {
      blocks = next;
      render();
    },
  };
}
