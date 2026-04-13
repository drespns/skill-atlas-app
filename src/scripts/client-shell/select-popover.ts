type SelectItem = {
  value: string;
  label: string;
  disabled: boolean;
};

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function readItems(select: HTMLSelectElement): SelectItem[] {
  const out: SelectItem[] = [];
  select.querySelectorAll("option").forEach((o) => {
    out.push({
      value: o.value,
      label: o.textContent?.trim() || o.value,
      disabled: Boolean(o.disabled),
    });
  });
  return out;
}

function renderList(list: HTMLElement, items: SelectItem[], selected: string, q: string) {
  const ql = q.trim().toLowerCase();
  const hits = !ql ? items : items.filter((it) => it.label.toLowerCase().includes(ql) || it.value.toLowerCase().includes(ql));
  if (hits.length === 0) {
    list.innerHTML = `<li class="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 list-none">No hay resultados.</li>`;
    return;
  }
  list.innerHTML = hits
    .map((it, idx) => {
      const isSelected = it.value === selected;
      const disabled = it.disabled;
      const base =
        "w-full text-left px-3 py-2 text-sm border-0 bg-transparent flex items-center gap-2";
      const tone = disabled
        ? "opacity-50 cursor-not-allowed"
        : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900";
      const active = isSelected ? "bg-gray-100 dark:bg-gray-900" : "";
      return `<li role="option" aria-selected="${isSelected ? "true" : "false"}" class="list-none">
        <button type="button"
          data-select-item="${esc(it.value)}"
          data-select-idx="${idx}"
          ${disabled ? "disabled" : ""}
          class="${base} ${tone} ${active}">
          <span class="min-w-0 truncate ${isSelected ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-800 dark:text-gray-200"}">${esc(it.label)}</span>
          ${isSelected ? '<span class="ml-auto text-xs font-bold text-gray-500 dark:text-gray-400">✓</span>' : ""}
        </button>
      </li>`;
    })
    .join("");
}

function setOpen(wrap: HTMLElement, open: boolean) {
  const panel = wrap.querySelector<HTMLElement>("[data-select-panel]");
  const trigger = wrap.querySelector<HTMLButtonElement>("[data-select-trigger]");
  if (!panel || !trigger) return;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
  panel.classList.toggle("hidden", !open);
  if (open) {
    const search = wrap.querySelector<HTMLInputElement>("[data-select-search]");
    if (search) {
      search.focus();
      search.select();
    }
  }
}

function updateTriggerLabel(wrap: HTMLElement, select: HTMLSelectElement, placeholder: string) {
  const label = wrap.querySelector<HTMLElement>("[data-select-trigger-label]");
  if (!label) return;
  const v = select.value;
  const opt = select.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(v)}"]`);
  label.textContent = opt?.textContent?.trim() || placeholder;
  label.classList.toggle("text-gray-500", !opt);
}

export function initSelectPopovers() {
  // Auto-enhance any native <select> not yet wrapped.
  document.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
    if (select.closest("[data-select-popover]")) return;
    if (select.classList.contains("sr-only")) return;
    if ((select as any).dataset?.selectNative === "1") return;
    // Skip if explicitly opted out
    if ((select as any).dataset?.selectSkip === "1") return;
    // Multi-select needs native UI (Ctrl/Cmd-click); popover is single-value only.
    if (select.multiple) return;

    const parent = select.parentElement;
    if (!parent) return;
    // Capture anchor BEFORE moving the select into the wrapper.
    const anchor = select.nextSibling;

    const wrap = document.createElement("div");
    wrap.setAttribute("data-select-popover", "");
    wrap.setAttribute("data-placeholder", "Selecciona…");

    // Hide native select but keep it in DOM for forms/scripts.
    select.classList.add("sr-only");
    select.setAttribute("data-select-native", "1");

    const rel = document.createElement("div");
    rel.className = "relative";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("data-select-trigger", "");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    // Try to keep the sizing intent from the select.
    const baseTriggerClass =
      "w-full inline-flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900";
    trigger.className = baseTriggerClass;

    const label = document.createElement("span");
    label.className = "min-w-0 truncate";
    label.setAttribute("data-select-trigger-label", "");
    label.textContent = "Selecciona…";
    const caret = document.createElement("span");
    caret.className = "shrink-0 opacity-70";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "▾";
    trigger.append(label, caret);

    const panel = document.createElement("div");
    panel.className =
      "hidden absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 shadow-lg";
    panel.setAttribute("data-select-panel", "");
    const ul = document.createElement("ul");
    ul.className = "max-h-72 overflow-auto m-0 p-0 divide-y divide-gray-200/70 dark:divide-gray-800";
    ul.setAttribute("data-select-list", "");
    ul.setAttribute("role", "listbox");
    panel.appendChild(ul);

    rel.append(trigger, panel);
    wrap.appendChild(select);
    wrap.appendChild(rel);

    try {
      if (anchor && anchor.parentNode === parent) parent.insertBefore(wrap, anchor);
      else parent.appendChild(wrap);
    } catch {
      // Fallback: if DOM is mid-swap, avoid crashing the whole page.
      try {
        parent.appendChild(wrap);
      } catch {
        // ignore
      }
    }
  });

  document.querySelectorAll<HTMLElement>("[data-select-popover]").forEach((wrap) => {
    const select = wrap.querySelector<HTMLSelectElement>("[data-select-native]");
    const trigger = wrap.querySelector<HTMLButtonElement>("[data-select-trigger]");
    const panel = wrap.querySelector<HTMLElement>("[data-select-panel]");
    const list = wrap.querySelector<HTMLElement>("[data-select-list]");
    const search = wrap.querySelector<HTMLInputElement>("[data-select-search]");
    if (!select || !trigger || !panel || !list) return;

    const placeholder = wrap.getAttribute("data-placeholder") || "Selecciona…";
    const state = wrap as HTMLElement & {
      __selectPopoverRender?: () => void;
      __selectPopoverIsOpen?: () => boolean;
    };

    // If already bound, just refresh label/list.
    if (wrap.dataset.selectBound === "1" && state.__selectPopoverRender) {
      state.__selectPopoverRender();
      return;
    }

    wrap.dataset.selectBound = "1";

    let items = readItems(select);
    let open = false;

    const render = () => {
      items = readItems(select);
      renderList(list, items, select.value, search?.value ?? "");
      updateTriggerLabel(wrap, select, placeholder);
    };
    state.__selectPopoverRender = render;
    state.__selectPopoverIsOpen = () => open;

    const close = () => {
      open = false;
      setOpen(wrap, false);
    };

    const openNow = () => {
      open = true;
      setOpen(wrap, true);
      render();
    };

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      if (open) close();
      else openNow();
    });

    select.addEventListener("change", () => render());

    list.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-select-item]");
      if (!btn || btn.disabled) return;
      const v = btn.getAttribute("data-select-item") || "";
      if (!v) return;
      select.value = v;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      close();
      trigger.focus();
    });

    search?.addEventListener("input", () => render());

    document.addEventListener("click", (e) => {
      if (!open) return;
      if (!wrap.contains(e.target as Node)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!open) return;
      if (!wrap.contains(document.activeElement)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        trigger.focus();
      }
    });

    // Reduce-motion: avoid any fancy transitions if later added
    if (prefersReducedMotion()) wrap.dataset.motion = "reduced";

    render();
  });
}

const boot = () => initSelectPopovers();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

// When prefs hydrate/merge, <select>.value may change programmatically without firing `change`.
if ((window as any).__skillatlasSelectPopoverRefreshBound !== true) {
  (window as any).__skillatlasSelectPopoverRefreshBound = true;
  window.addEventListener("skillatlas:prefs-updated", () => initSelectPopovers());
  window.addEventListener("skillatlas:select-popovers-refresh", () => initSelectPopovers());
}

