type Habit = { id: string; name: string };

type HabitsStateV1 = {
  v: 1;
  habits: Habit[];
  /** YYYY-MM -> { habitId -> days bitset string "1010..." indexed from 1 } */
  checksByMonth: Record<string, Record<string, string>>;
};

import { loadPrefs } from "@scripts/core/prefs";
import { loadClientState, scheduleSaveClientState } from "@scripts/core/user-client-state";
import { appendPaintSvgLayer } from "@scripts/tools/habits-paint-svg";

const STORAGE_KEY = "skillatlas_tools_habits_v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ym(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function daysInMonth(year: number, month1: number) {
  return new Date(year, month1, 0).getDate();
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadState(): HabitsStateV1 {
  const base: HabitsStateV1 = { v: 1, habits: [], checksByMonth: {} };
  const raw = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!raw || typeof raw !== "object") return base;
  const o = raw as any;
  if (o.v !== 1) return base;
  const habits: Habit[] = Array.isArray(o.habits)
    ? o.habits
        .map((h: any) => ({ id: String(h?.id || ""), name: String(h?.name || "") }))
        .filter((h: Habit) => h.id && h.name)
    : [];
  const checksByMonth =
    o.checksByMonth && typeof o.checksByMonth === "object" ? (o.checksByMonth as HabitsStateV1["checksByMonth"]) : {};
  return { v: 1, habits, checksByMonth };
}

function saveState(next: HabitsStateV1) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function makeId() {
  return `h_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function ensureMonthBits(state: HabitsStateV1, month: string, habitId: string, dayCount: number) {
  state.checksByMonth[month] ??= {};
  const prev = state.checksByMonth[month]![habitId];
  const targetLen = dayCount + 1; // index 0 unused
  if (typeof prev === "string" && prev.length >= targetLen) return;
  const base = typeof prev === "string" ? prev : "";
  const out = new Array(targetLen).fill("0");
  for (let i = 0; i < Math.min(base.length, targetLen); i++) out[i] = base[i] === "1" ? "1" : "0";
  state.checksByMonth[month]![habitId] = out.join("");
}

function setBit(state: HabitsStateV1, month: string, habitId: string, day: number, value: boolean) {
  const bits = state.checksByMonth[month]?.[habitId];
  if (!bits) return;
  const a = bits.split("");
  a[day] = value ? "1" : "0";
  state.checksByMonth[month]![habitId] = a.join("");
}

function getBit(state: HabitsStateV1, month: string, habitId: string, day: number): boolean {
  const bits = state.checksByMonth[month]?.[habitId];
  if (!bits) return false;
  return bits[day] === "1";
}

function updateDebug(root: HTMLElement, state: HabitsStateV1, month: string, markStyle: string) {
  const dbg = root.querySelector<HTMLElement>("[data-habits-debug]");
  if (!dbg) return;
  const sp = new URLSearchParams(location.search);
  const enabled = sp.get("debug") === "1" || localStorage.getItem("skillatlas_debug_habits") === "1";
  dbg.classList.toggle("hidden", !enabled);
  if (!enabled) return;

  const totalHabits = state.habits.length;
  const marked = root.querySelectorAll(".habit-cell--on").length;
  const paint = root.querySelectorAll(".habit-cell--paint").length;
  const fill = root.querySelectorAll(".habit-cell--fill").length;
  const check = root.querySelectorAll(".habit-cell--check").length;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--app-accent-hsl").trim();

  const sample = root.querySelector<HTMLButtonElement>(".habit-cell--on") ?? root.querySelector<HTMLButtonElement>(".habit-cell");
  const sampleBg = sample ? getComputedStyle(sample).backgroundColor : "(none)";
  const sampleBorder = sample ? getComputedStyle(sample).borderColor : "(none)";

  dbg.textContent =
    `debug=1 | month=${month} | markStyle=${markStyle} | accentHsl="${accent || "(empty)"}" | ` +
    `habits=${totalHabits} | marked=${marked} (paint=${paint}, fill=${fill}, check=${check}) | ` +
    `sample.bg=${sampleBg} | sample.border=${sampleBorder}`;
}

function renderGrid(
  state: HabitsStateV1,
  month: string,
  headRow: HTMLTableRowElement,
  body: HTMLTableSectionElement,
  markStyle: "paint" | "fill" | "check",
) {
  const [yS, mS] = month.split("-");
  const year = Number(yS);
  const month1 = Number(mS);
  const dayCount = daysInMonth(year, month1);

  // head
  headRow.innerHTML = "";
  const th0 = document.createElement("th");
  th0.className = "text-left p-2.5 border-b border-gray-200 dark:border-gray-800 min-w-52";
  th0.textContent = "Hábito";
  headRow.appendChild(th0);
  for (let d = 1; d <= dayCount; d++) {
    const th = document.createElement("th");
    th.className = "p-2 border-b border-gray-200 dark:border-gray-800 text-center whitespace-nowrap";
    th.textContent = String(d);
    headRow.appendChild(th);
  }

  // body
  body.innerHTML = "";
  for (const h of state.habits) {
    ensureMonthBits(state, month, h.id, dayCount);
    const tr = document.createElement("tr");
    tr.dataset.habitId = h.id;

    const nameTd = document.createElement("td");
    nameTd.className = "p-2.5 border-b border-gray-100 dark:border-gray-800";
    const wrap = document.createElement("div");
    wrap.className = "flex items-center justify-between gap-2";
    const name = document.createElement("span");
    name.className = "font-semibold text-gray-900 dark:text-gray-100 truncate";
    name.textContent = h.name;
    const del = document.createElement("button");
    del.type = "button";
    del.className =
      "shrink-0 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900";
    del.textContent = "Eliminar";
    del.addEventListener("click", () => {
      const next = loadState();
      next.habits = next.habits.filter((x) => x.id !== h.id);
      // keep checks in case it gets re-added; no GC in MVP
      saveState(next);
      render(next);
    });
    wrap.append(name, del);
    nameTd.appendChild(wrap);
    tr.appendChild(nameTd);

    for (let d = 1; d <= dayCount; d++) {
      const td = document.createElement("td");
      td.className = "border-b border-gray-100 dark:border-gray-800 p-1.5";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.day = String(d);
      btn.className =
        "habit-cell h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-950/60 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors";
      const checked = getBit(state, month, h.id, d);
      if (checked) {
        btn.classList.add("habit-cell--on");
        if (markStyle === "check") {
          btn.textContent = "✓";
          btn.classList.add("habit-cell--check");
        } else {
          btn.textContent = "";
          if (markStyle === "fill") {
            btn.classList.add("habit-cell--fill");
          } else {
            btn.classList.add("habit-cell--paint");
            appendPaintSvgLayer(btn);
          }
        }
      } else {
        btn.textContent = "";
      }
      td.appendChild(btn);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  saveState(state);
}

let lastAnchor: { habitId: string; day: number; value: boolean } | null = null;
let lastPainted: { habitId: string; day: number } | null = null;

function bindGridInteractions(root: HTMLElement) {
  const table = root.querySelector<HTMLTableElement>("[data-habits-grid]");
  const monthInput = root.querySelector<HTMLInputElement>("[data-habits-month]");
  if (!table || !monthInput) return;
  if (table.dataset.bound === "1") return;
  table.dataset.bound = "1";

  table.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest("button[data-day]") as HTMLButtonElement | null;
    if (!btn) return;
    const tr = btn.closest("tr") as HTMLTableRowElement | null;
    const habitId = tr?.dataset.habitId;
    const day = Number(btn.dataset.day || "0");
    if (!habitId || !day) return;

    const month = monthInput.value || ym(new Date());
    const next = loadState();
    const [yS, mS] = month.split("-");
    const dayCount = daysInMonth(Number(yS), Number(mS));
    ensureMonthBits(next, month, habitId, dayCount);

    const current = getBit(next, month, habitId, day);
    const newValue = !current;

    if ((e as MouseEvent).shiftKey && lastAnchor && lastAnchor.habitId === habitId) {
      const a = Math.min(lastAnchor.day, day);
      const b = Math.max(lastAnchor.day, day);
      for (let d = a; d <= b; d++) setBit(next, month, habitId, d, lastAnchor.value);
    } else {
      setBit(next, month, habitId, day, newValue);
      lastAnchor = { habitId, day, value: newValue };
      if (newValue) lastPainted = { habitId, day };
      else lastPainted = null;
    }

    saveState(next);
    scheduleSaveClientState("tools_habits", next);
    render(next);
  });
}

function render(state: HabitsStateV1) {
  const root = document.querySelector<HTMLElement>("[data-tools-habits-page]");
  if (!root) return;
  const monthInput = root.querySelector<HTMLInputElement>("[data-habits-month]");
  const headRow = root.querySelector<HTMLTableRowElement>("[data-habits-grid-head-row]");
  const body = root.querySelector<HTMLTableSectionElement>("[data-habits-grid-body]");
  if (!monthInput || !headRow || !body) return;

  const month = monthInput.value || ym(new Date());
  monthInput.value = month;

  const rawStyle = document.documentElement.dataset.habitsMarkStyle;
  const markStyle = ((rawStyle === "fill" || rawStyle === "check" || rawStyle === "paint"
    ? rawStyle
    : loadPrefs().habitsMarkStyle ?? "paint") as "paint" | "fill" | "check");
  root.dataset.habitsMarkStyle = markStyle;

  renderGrid(state, month, headRow, body, markStyle);
  bindGridInteractions(root);
  updateDebug(root, state, month, markStyle);

  // Animación “pintar”: solo para la última celda marcada.
  const motionReduced = document.documentElement.dataset.motion === "reduced";
  if (!motionReduced && markStyle === "paint" && lastPainted) {
    const btn = root.querySelector<HTMLButtonElement>(
      `tr[data-habit-id="${CSS.escape(lastPainted.habitId)}"] button[data-day="${lastPainted.day}"]`,
    );
    if (btn) {
      btn.classList.remove("habit-cell--animate");
      // fuerza reflow mínimo para reiniciar animación si el usuario marca rápido
      void btn.offsetHeight;
      btn.classList.add("habit-cell--animate");
      window.setTimeout(() => btn.classList.remove("habit-cell--animate"), 900);
    }
    lastPainted = null;
  }
}

function boot() {
  const root = document.querySelector<HTMLElement>("[data-tools-habits-page]");
  if (!root) return;

  const monthInput = root.querySelector<HTMLInputElement>("[data-habits-month]");
  const addForm = root.querySelector<HTMLFormElement>("[data-habits-add-form]");
  if (!monthInput || !addForm) return;

  // Listeners + hydrate remoto solo una vez por nodo (View Transitions puede reutilizar el mismo root).
  if (root.dataset.habitsBound !== "1") {
    root.dataset.habitsBound = "1";
    if (!monthInput.value) monthInput.value = ym(new Date());

    // Remote-first hydrate once (tools require auth, but tolerate offline).
    void (async () => {
      try {
        const remote = await loadClientState<HabitsStateV1>("tools_habits", { v: 1, habits: [], checksByMonth: {} });
        const local = loadState();
        const merged: HabitsStateV1 = {
          v: 1,
          habits: [...remote.habits, ...local.habits].reduce<Habit[]>((acc, h) => {
            if (!acc.some((x) => x.id === h.id)) acc.push(h);
            return acc;
          }, []),
          checksByMonth: { ...(remote.checksByMonth ?? {}), ...(local.checksByMonth ?? {}) },
        };
        saveState(merged);
        render(merged);
        if ((remote.habits?.length ?? 0) === 0 && (remote.checksByMonth && Object.keys(remote.checksByMonth).length === 0)) {
          scheduleSaveClientState("tools_habits", local, 0);
        }
      } catch {
        // ignore
      }
    })();

    monthInput.addEventListener("change", () => render(loadState()));

    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(addForm);
      const name = String(fd.get("name") ?? "").trim();
      if (!name) return;
      const next = loadState();
      next.habits.push({ id: makeId(), name });
      saveState(next);
      scheduleSaveClientState("tools_habits", next);
      const input = addForm.querySelector<HTMLInputElement>("input[name='name']");
      if (input) {
        input.value = "";
        input.focus();
      }
      render(next);
    });
  }

  // Siempre re-render al entrar en la página (prefs / markStyle pueden haber cambiado en otra ruta).
  render(loadState());
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

// Apply mark-style changes live from /settings.
document.addEventListener("skillatlas:prefs-updated" as any, () => {
  try {
    render(loadState());
  } catch {
    // ignore
  }
});

