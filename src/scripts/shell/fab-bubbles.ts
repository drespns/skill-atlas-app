import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { loadPrefs } from "@scripts/core/prefs";
import { loadClientState, scheduleSaveClientState } from "@scripts/core/user-client-state";

type FabPane = "shortcuts" | "calendar" | "curiosities" | "cvTips" | "ai";

function isFabPane(t: string | null | undefined): t is FabPane {
  return t === "shortcuts" || t === "calendar" || t === "curiosities" || t === "cvTips" || t === "ai";
}

type CalendarItem = { id: string; date: string; title: string; tag?: string };
type CalendarStateV1 = { v: 1; items: CalendarItem[] };
const CALENDAR_KEY = "skillatlas_fab_calendar_v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ym(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function tagStyle(tag: string): { ring: string; bg: string; text: string } {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // Tailwind no acepta hsl dinámico en clases; usamos inline style con una base agradable.
  return {
    ring: `hsl(${hue} 90% 55% / 0.35)`,
    bg: `hsl(${hue} 90% 55% / 0.10)`,
    text: `hsl(${hue} 70% 40% / 1)`,
  };
}

function loadCalendar(): CalendarStateV1 {
  try {
    const raw = JSON.parse(localStorage.getItem(CALENDAR_KEY) ?? "null") as any;
    const items: CalendarItem[] = Array.isArray(raw?.items)
      ? raw.items
          .map((x: any) => ({
            id: String(x?.id || ""),
            date: String(x?.date || ""),
            title: String(x?.title || ""),
            tag: x?.tag ? String(x.tag) : undefined,
          }))
          .filter((x: CalendarItem) => x.id && x.date && x.title)
      : [];
    return { v: 1, items };
  } catch {
    return { v: 1, items: [] };
  }
}

function saveCalendar(next: CalendarStateV1) {
  try {
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function makeId() {
  return `c_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function isLoginPath() {
  const p = window.location.pathname;
  return p === "/login" || p.startsWith("/login/");
}

function setFabTab(root: HTMLElement, pane: FabPane) {
  root.querySelectorAll<HTMLElement>("[data-fab-pane]").forEach((el) => {
    const name = el.getAttribute("data-fab-pane");
    el.classList.toggle("hidden", name !== pane);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-fab-tab]").forEach((btn) => {
    const t = btn.getAttribute("data-fab-tab");
    btn.setAttribute("data-active", String(t === pane));
  });
  root.dataset.fabActivePane = pane;
}

function setMainButtonExpanded(shortcutsBtn: HTMLButtonElement | null, open: boolean) {
  shortcutsBtn?.setAttribute("aria-expanded", open ? "true" : "false");
}

function openFabPanel(root: HTMLElement, pane: FabPane) {
  const backdrop = root.querySelector<HTMLElement>("[data-fab-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-fab-panel]");
  const shortcutsBtn = root.querySelector<HTMLButtonElement>("[data-fab-shortcuts]");
  if (!backdrop || !panel) return;

  setFabTab(root, pane);

  panel.hidden = false;
  backdrop.classList.remove("pointer-events-none", "opacity-0");
  backdrop.classList.add("pointer-events-auto", "opacity-100");

  if (prefersReducedMotion()) {
    panel.classList.remove("pointer-events-none", "translate-y-2", "scale-95", "opacity-0");
    panel.classList.add("pointer-events-auto", "translate-y-0", "scale-100", "opacity-100");
  } else {
    panel.classList.remove("pointer-events-none", "translate-y-2", "scale-95", "opacity-0");
    panel.classList.add("pointer-events-auto", "translate-y-0", "scale-100", "opacity-100");
  }

  setMainButtonExpanded(shortcutsBtn, true);

  const closeBtn = root.querySelector<HTMLButtonElement>("[data-fab-close]");
  window.setTimeout(() => closeBtn?.focus(), prefersReducedMotion() ? 0 : 50);
}

function closeFabPanel(root: HTMLElement) {
  const backdrop = root.querySelector<HTMLElement>("[data-fab-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-fab-panel]");
  const shortcutsBtn = root.querySelector<HTMLButtonElement>("[data-fab-shortcuts]");
  if (!backdrop || !panel) return;

  const done = () => {
    panel.hidden = true;
  };

  backdrop.classList.add("pointer-events-none", "opacity-0");
  backdrop.classList.remove("pointer-events-auto", "opacity-100");

  if (prefersReducedMotion()) {
    panel.classList.add("pointer-events-none", "translate-y-2", "scale-95", "opacity-0");
    panel.classList.remove("pointer-events-auto", "translate-y-0", "scale-100", "opacity-100");
    done();
  } else {
    panel.classList.add("pointer-events-none", "translate-y-2", "scale-95", "opacity-0");
    panel.classList.remove("pointer-events-auto", "translate-y-0", "scale-100", "opacity-100");
    window.setTimeout(done, 200);
  }

  setMainButtonExpanded(shortcutsBtn, false);
}

function renderCalendar(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>("[data-fab-calendar-list]");
  const monthEl = root.querySelector<HTMLInputElement>("[data-fab-calendar-month]");
  const tagEl = root.querySelector<HTMLSelectElement>("[data-fab-calendar-tag]");
  if (!list || !monthEl || !tagEl) return;

  if (!monthEl.value) monthEl.value = ym(new Date());
  const state = loadCalendar();
  state.items.sort((a, b) => a.date.localeCompare(b.date));

  const tags = Array.from(
    new Set(state.items.map((i) => (i.tag || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const currentTag = tagEl.value;
  tagEl.innerHTML = `<option value=\"\">Todos</option>`;
  for (const t of tags) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = `#${t}`;
    tagEl.appendChild(o);
  }
  tagEl.value = tags.includes(currentTag) ? currentTag : "";

  const month = monthEl.value;
  const filtered = state.items.filter((it) => {
    if (!it.date.startsWith(month)) return false;
    if (tagEl.value && (it.tag || "").trim() !== tagEl.value) return false;
    return true;
  });

  list.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "m-0 text-sm text-gray-600 dark:text-gray-400";
    empty.textContent = "Sin notas para este mes.";
    list.appendChild(empty);
    return;
  }
  for (const it of filtered) {
    const row = document.createElement("div");
    row.className =
      "flex items-start justify-between gap-3 rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-950/40 px-3 py-3 shadow-sm";
    const left = document.createElement("div");
    left.className = "min-w-0";
    const meta = document.createElement("div");
    meta.className = "flex flex-wrap items-center gap-2";
    const dateP = document.createElement("p");
    dateP.className = "m-0 text-xs font-semibold text-gray-500 dark:text-gray-400";
    dateP.textContent = it.date;
    meta.appendChild(dateP);
    if (it.tag) {
      const chip = document.createElement("span");
      const s = tagStyle(it.tag);
      chip.className = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1";
      chip.textContent = `#${it.tag}`;
      chip.style.backgroundColor = s.bg;
      chip.style.color = s.text;
      chip.style.boxShadow = `0 0 0 1px ${s.ring} inset`;
      meta.appendChild(chip);
    }
    const title = document.createElement("p");
    title.className = "m-0 mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100";
    title.textContent = it.title;
    left.append(meta, title);
    const del = document.createElement("button");
    del.type = "button";
    del.className =
      "shrink-0 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900";
    del.textContent = "Borrar";
    del.addEventListener("click", () => {
      const next = loadCalendar();
      next.items = next.items.filter((x) => x.id !== it.id);
      saveCalendar(next);
      renderCalendar(root);
    });
    row.append(left, del);
    list.appendChild(row);
  }
}

let fabOpenPaneDocListener = false;

function bindFabRoot(root: HTMLElement) {
  const backdrop = root.querySelector<HTMLElement>("[data-fab-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-fab-panel]");
  const shortcutsBtn = root.querySelector<HTMLButtonElement>("[data-fab-shortcuts]");
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-fab-close]");
  const openPaletteBtn = root.querySelector<HTMLButtonElement>("[data-fab-open-palette]");
  const tabRow = root.querySelector<HTMLElement>("[data-fab-tab-row]");
  const calendarForm = root.querySelector<HTMLFormElement>("[data-fab-calendar-form]");
  const calendarMonth = root.querySelector<HTMLInputElement>("[data-fab-calendar-month]");
  const calendarTag = root.querySelector<HTMLSelectElement>("[data-fab-calendar-tag]");

  shortcutsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel && !panel.hidden;
    if (open) closeFabPanel(root);
    else {
      const raw = root.dataset.fabActivePane;
      const pane: FabPane = isFabPane(raw) ? raw : "shortcuts";
      openFabPanel(root, pane);
    }
  });

  closeBtn?.addEventListener("click", () => closeFabPanel(root));

  backdrop?.addEventListener("click", () => closeFabPanel(root));

  openPaletteBtn?.addEventListener("click", () => {
    closeFabPanel(root);
    window.dispatchEvent(new Event("skillatlas:open-palette"));
  });

  root.querySelectorAll<HTMLButtonElement>("[data-fab-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-fab-tab");
      if (!isFabPane(t)) return;
      setFabTab(root, t);
    });
  });

  calendarForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(calendarForm);
    const date = String(fd.get("date") ?? "").trim();
    const title = String(fd.get("title") ?? "").trim();
    const tag = String(fd.get("tag") ?? "").trim();
    if (!date || !title) return;
    const next = loadCalendar();
    next.items.push({ id: makeId(), date, title, tag: tag || undefined });
    saveCalendar(next);
    scheduleSaveClientState("fab_calendar", next);
    calendarForm.reset();
    renderCalendar(root);
  });

  calendarMonth?.addEventListener("change", () => renderCalendar(root));
  calendarTag?.addEventListener("change", () => renderCalendar(root));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!panel || panel.hidden) return;
    closeFabPanel(root);
    shortcutsBtn?.focus();
  });

  const applyLayout = (authed: boolean) => {
    if (authed) delete root.dataset.fabGuest;
    else root.dataset.fabGuest = "1";

    // IA: por defecto solo visible fuera de sesión (y controlable por prefs en el siguiente paso).
    const prefs = loadPrefs();
    const aiTab = root.querySelector<HTMLButtonElement>("[data-fab-tab-ai]");
    const aiPane = root.querySelector<HTMLElement>("[data-fab-pane='ai']");
    const allowAi = Boolean(prefs.showFabAi);
    aiTab?.classList.toggle("hidden", !allowAi);
    aiPane?.classList.toggle("hidden", !allowAi && root.dataset.fabActivePane === "ai");
    if (!allowAi && root.dataset.fabActivePane === "ai") setFabTab(root, "shortcuts");

    const calTab = root.querySelector<HTMLButtonElement>("[data-fab-tab='calendar']");
    const curTab = root.querySelector<HTMLButtonElement>("[data-fab-tab='curiosities']");
    const allowCal = Boolean(prefs.showFabCalendar ?? true);
    const allowCur = Boolean(prefs.showFabCuriosities ?? true);
    calTab?.classList.toggle("hidden", !allowCal);
    curTab?.classList.toggle("hidden", !allowCur);
    if (!allowCal && root.dataset.fabActivePane === "calendar") setFabTab(root, "shortcuts");
    if (!allowCur && root.dataset.fabActivePane === "curiosities") setFabTab(root, "shortcuts");

    const cvTipsTab = root.querySelector<HTMLButtonElement>("[data-fab-tab='cvTips']");
    const allowCvTips = Boolean(prefs.showFabCvTips ?? true);
    cvTipsTab?.classList.toggle("hidden", !allowCvTips);
    if (!allowCvTips && root.dataset.fabActivePane === "cvTips") setFabTab(root, "shortcuts");

    const shTab = root.querySelector<HTMLButtonElement>("[data-fab-tab='shortcuts']");
    const allowShortcuts = Boolean(prefs.showFabShortcuts ?? true);
    shTab?.classList.toggle("hidden", !allowShortcuts);
    if (!allowShortcuts && root.dataset.fabActivePane === "shortcuts") setFabTab(root, "calendar");

    if (tabRow) {
      tabRow.classList.remove("hidden");
      tabRow.classList.add("flex");
    }
  };

  (root as HTMLElement & { __fabApplyLayout?: (a: boolean) => void }).__fabApplyLayout = applyLayout;

  if (!fabOpenPaneDocListener) {
    fabOpenPaneDocListener = true;
    document.addEventListener("skillatlas:open-fab-pane", ((evt: Event) => {
      const r = document.querySelector<HTMLElement>("[data-fab-root]");
      if (!r || r.dataset.fabBound !== "1") return;
      const pane = (evt as CustomEvent<{ pane?: string }>).detail?.pane;
      if (!isFabPane(pane)) return;
      const prefs = loadPrefs();
      if (pane === "cvTips" && !(prefs.showFabCvTips ?? true)) return;
      openFabPanel(r, pane);
    }) as EventListener);
  }
}

async function syncFabBubbles() {
  const root = document.querySelector<HTMLElement>("[data-fab-root]");
  if (!root) return;

  if (root.dataset.fabBound !== "1") {
    root.dataset.fabBound = "1";
    bindFabRoot(root);
    renderCalendar(root);
  }

  const extended = root as HTMLElement & { __fabApplyLayout?: (a: boolean) => void };

  if (isLoginPath()) {
    root.classList.add("hidden");
    closeFabPanel(root);
    return;
  }

  root.classList.remove("hidden");

  const supabase = getSupabaseBrowserClient();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const authed = Boolean(session?.user);
  extended.__fabApplyLayout?.(authed);

  // Remote-first hydrate (once per page lifecycle) for calendar items.
  if (authed && root.dataset.fabCalendarHydrated !== "1") {
    root.dataset.fabCalendarHydrated = "1";
    try {
      const local = loadCalendar();
      const remote = await loadClientState<CalendarStateV1>("fab_calendar", { v: 1, items: [] });
      if (remote?.items?.length) {
        // Merge by id; keep local additions if any.
        const byId = new Map<string, CalendarItem>();
        for (const it of remote.items) byId.set(it.id, it);
        for (const it of local.items) byId.set(it.id, it);
        const merged: CalendarStateV1 = { v: 1, items: Array.from(byId.values()) };
        saveCalendar(merged);
      } else {
        // If remote empty but local has items, push once.
        if (local.items.length) scheduleSaveClientState("fab_calendar", local, 0);
      }
    } catch {
      // ignore
    }
  }

  renderCalendar(root);
}

function bootFabBubbles() {
  void syncFabBubbles();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFabBubbles);
else bootFabBubbles();

document.addEventListener("astro:page-load", bootFabBubbles);
document.addEventListener("astro:after-swap", bootFabBubbles);

window.addEventListener("skillatlas:auth-nav-updated", () => void syncFabBubbles());
window.addEventListener("skillatlas:prefs-updated", () => void syncFabBubbles());
