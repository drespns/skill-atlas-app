import { diffLines, type Change } from "diff";
import i18next from "i18next";

type ViewMode = "split" | "unified";

function tt(key: string, fallback: string, opts?: Record<string, string | number>): string {
  const v = i18next.t(key, { defaultValue: fallback, ...(opts ?? {}) } as Record<string, unknown>);
  return typeof v === "string" ? v : fallback;
}

function normalizeNl(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

function splitChunkLines(value: string): string[] {
  if (value === "") return [];
  return value.split("\n");
}

type RowKind = "eq" | "del" | "ins" | "pad";

interface DiffRow {
  L: string;
  R: string;
  lk: RowKind;
  rk: RowKind;
  /** Número de línea en A (vacío si no aplica). */
  nL: string;
  /** Número de línea en B (vacío si no aplica). */
  nR: string;
}

function buildSplitRows(parts: Change[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let lineA = 1;
  let lineB = 1;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const nxt = parts[i + 1];
    if (p.removed && nxt?.added) {
      const ls = splitChunkLines(p.value);
      const rs = splitChunkLines(nxt.value);
      const m = Math.max(ls.length, rs.length);
      for (let k = 0; k < m; k++) {
        const hasL = k < ls.length;
        const hasR = k < rs.length;
        rows.push({
          L: ls[k] ?? "",
          R: rs[k] ?? "",
          lk: hasL ? "del" : "pad",
          rk: hasR ? "ins" : "pad",
          nL: hasL ? String(lineA++) : "",
          nR: hasR ? String(lineB++) : "",
        });
      }
      i++;
      continue;
    }
    if (p.removed) {
      for (const L of splitChunkLines(p.value)) {
        rows.push({ L, R: "", lk: "del", rk: "pad", nL: String(lineA++), nR: "" });
      }
      continue;
    }
    if (p.added) {
      for (const R of splitChunkLines(p.value)) {
        rows.push({ L: "", R, lk: "pad", rk: "ins", nL: "", nR: String(lineB++) });
      }
      continue;
    }
    for (const line of splitChunkLines(p.value)) {
      rows.push({
        L: line,
        R: line,
        lk: "eq",
        rk: "eq",
        nL: String(lineA++),
        nR: String(lineB++),
      });
    }
  }
  return rows;
}

function countChangeLines(parts: Change[]): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const p of parts) {
    if (p.added) add += splitChunkLines(p.value).length;
    else if (p.removed) del += splitChunkLines(p.value).length;
  }
  return { add, del };
}

function cellClass(kind: RowKind, edge: "inner" | "last"): string {
  const divide = edge === "inner" ? "border-r border-gray-200/70 dark:border-gray-700/60" : "";
  const base = `px-2 py-0.5 align-top whitespace-pre-wrap break-words border-b border-gray-100/80 dark:border-gray-800/80 min-h-[1.35rem] ${divide}`.trim();
  if (kind === "pad") return `${base} bg-gray-50/40 dark:bg-gray-900/25 text-transparent select-none`;
  if (kind === "eq") return `${base} text-gray-700 dark:text-gray-300`;
  if (kind === "del") return `${base} bg-rose-100/90 dark:bg-rose-950/35 text-rose-950 dark:text-rose-100`;
  return `${base} bg-emerald-100/90 dark:bg-emerald-950/35 text-emerald-950 dark:text-emerald-100`;
}

function gutterClass(): string {
  return "px-1.5 sm:px-2 py-0.5 align-top text-right tabular-nums text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 bg-gray-50/95 dark:bg-gray-900/75 border-b border-gray-100/80 dark:border-gray-800/80 border-r border-gray-200/70 dark:border-gray-700/60 select-none min-h-[1.35rem]";
}

function renderUnified(parts: Change[], mount: HTMLElement, hideEqual: boolean) {
  const list = hideEqual ? parts.filter((p) => p.added || p.removed) : parts;
  mount.replaceChildren();
  const pre = document.createElement("pre");
  pre.className =
    "m-0 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 text-xs font-mono overflow-auto max-h-[min(32rem,70vh)] whitespace-pre-wrap break-words";
  for (const p of list) {
    const span = document.createElement("span");
    if (p.added) {
      span.className =
        "bg-emerald-200/80 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100";
      span.textContent = `+ ${p.value}`;
    } else if (p.removed) {
      span.className = "bg-rose-200/80 dark:bg-rose-900/40 text-rose-950 dark:text-rose-100";
      span.textContent = `- ${p.value}`;
    } else {
      span.className = "text-gray-600 dark:text-gray-400";
      span.textContent = `  ${p.value}`;
    }
    pre.appendChild(span);
  }
  mount.appendChild(pre);
}

function renderSplit(rows: DiffRow[], grid: HTMLElement, hideEqual: boolean) {
  grid.replaceChildren();
  const filtered = hideEqual ? rows.filter((r) => !(r.lk === "eq" && r.rk === "eq")) : rows;
  for (const r of filtered) {
    const gL = document.createElement("div");
    gL.className = gutterClass();
    gL.textContent = r.nL || "\u00a0";

    const cL = document.createElement("div");
    cL.className = cellClass(r.lk, "inner");
    cL.textContent = r.lk === "pad" && r.L === "" ? "\u00a0" : r.L;

    const gR = document.createElement("div");
    gR.className = gutterClass();
    gR.textContent = r.nR || "\u00a0";

    const cR = document.createElement("div");
    cR.className = cellClass(r.rk, "last");
    cR.textContent = r.rk === "pad" && r.R === "" ? "\u00a0" : r.R;

    grid.appendChild(gL);
    grid.appendChild(cL);
    grid.appendChild(gR);
    grid.appendChild(cR);
  }
}

function setViewButtons(mode: ViewMode, btnSplit: HTMLButtonElement, btnUnified: HTMLButtonElement) {
  const onSplit = mode === "split";
  btnSplit.className = onSplit
    ? "et-btn-accent text-xs sm:text-sm"
    : "et-btn-secondary text-xs sm:text-sm";
  btnUnified.className = !onSplit
    ? "et-btn-accent text-xs sm:text-sm"
    : "et-btn-secondary text-xs sm:text-sm";
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-diff-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const a = root.querySelector<HTMLTextAreaElement>("[data-diff-a]");
  const b = root.querySelector<HTMLTextAreaElement>("[data-diff-b]");
  const btn = root.querySelector<HTMLButtonElement>("[data-diff-run]");
  const btnSplit = root.querySelector<HTMLButtonElement>("[data-diff-view-split]");
  const btnUnified = root.querySelector<HTMLButtonElement>("[data-diff-view-unified]");
  const hideEq = root.querySelector<HTMLInputElement>("[data-diff-hide-equal]");
  const splitRoot = root.querySelector<HTMLElement>("[data-diff-split-root]");
  const splitGrid = root.querySelector<HTMLElement>("[data-diff-split-grid]");
  const unifiedRoot = root.querySelector<HTMLElement>("[data-diff-unified-root]");
  const statsEl = root.querySelector<HTMLElement>("[data-diff-stats]");

  if (!splitRoot || !splitGrid || !unifiedRoot || !btnSplit || !btnUnified) return;

  let mode: ViewMode = "split";
  let lastParts: Change[] = [];
  let lastRows: DiffRow[] = [];
  let hasResult = false;

  const paint = () => {
    if (!hasResult) {
      splitRoot.classList.add("hidden");
      unifiedRoot.classList.add("hidden");
      return;
    }
    const hide = !!hideEq?.checked;
    if (mode === "split") {
      splitRoot.classList.remove("hidden");
      unifiedRoot.classList.add("hidden");
      renderSplit(lastRows, splitGrid, hide);
    } else {
      splitRoot.classList.add("hidden");
      unifiedRoot.classList.remove("hidden");
      renderUnified(lastParts, unifiedRoot, hide);
    }
  };

  const run = () => {
    const parts = diffLines(normalizeNl(a?.value ?? ""), normalizeNl(b?.value ?? ""));
    lastParts = parts;
    lastRows = buildSplitRows(parts);
    hasResult = true;
    if (statsEl) {
      const { add, del } = countChangeLines(parts);
      statsEl.textContent = tt("tools.textDiffStats", "Añadidas: +{{add}} · Eliminadas: −{{del}}", {
        add,
        del,
      });
      statsEl.classList.remove("hidden");
    }
    paint();
  };

  btn?.addEventListener("click", run);

  btnSplit.addEventListener("click", () => {
    mode = "split";
    setViewButtons(mode, btnSplit, btnUnified);
    paint();
  });
  btnUnified.addEventListener("click", () => {
    mode = "unified";
    setViewButtons(mode, btnSplit, btnUnified);
    paint();
  });
  hideEq?.addEventListener("change", paint);

  setViewButtons(mode, btnSplit, btnUnified);
}

init();
