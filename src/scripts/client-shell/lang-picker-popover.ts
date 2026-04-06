import { loadPrefs, type HeaderPopoverTrigger } from "@scripts/core/prefs";
import { mapPickerOptionIdToUiLang, preferEnglishPickerId } from "@lib/lang-picker-options";
import { resolveSpanishPickerId, setSpanishPickerSessionId } from "@lib/lang-picker-infer";

export function syncLangPickerButtons() {
  const prefsLang = loadPrefs().lang;
  const activeEs = resolveSpanishPickerId();
  const activeEn = preferEnglishPickerId();

  document.querySelectorAll<HTMLButtonElement>("[data-lang-picker-option]").forEach((btn) => {
    const id = btn.dataset.langPickerOption ?? "";
    const mapped = mapPickerOptionIdToUiLang(id);
    if (mapped === null) {
      btn.disabled = true;
      btn.setAttribute("aria-pressed", "false");
      btn.classList.add("opacity-45", "grayscale");
      return;
    }
    btn.disabled = false;
    btn.classList.remove("opacity-45", "grayscale");
    let pressed = false;
    if (mapped === "en") {
      pressed = prefsLang === "en" && (id === "en" || id === "en_us") && id === activeEn;
    } else {
      pressed = prefsLang === "es" && id === activeEs;
    }
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
  });
}

function getLangTrigger(): HeaderPopoverTrigger {
  return loadPrefs().headerLangPopover ?? "hover";
}

function attachLangPopover() {
  const wrap = document.querySelector<HTMLElement>("[data-lang-wrap]");
  const popover = document.querySelector<HTMLElement>("[data-lang-popover]");
  const toggle = document.querySelector<HTMLButtonElement>("[data-lang-quick-toggle]");
  if (!wrap || !popover || !toggle) return;

  const prev = (wrap as unknown as { _langPopoverAc?: AbortController })._langPopoverAc;
  prev?.abort();
  const ac = new AbortController();
  (wrap as unknown as { _langPopoverAc?: AbortController })._langPopoverAc = ac;
  const { signal } = ac;

  const mode = getLangTrigger();
  wrap.dataset.langPopoverMode = mode;

  let hover = false;
  let timer: number | null = null;

  const show = () => {
    popover.classList.remove("hidden");
    popover.classList.add("block");
    toggle.setAttribute("aria-expanded", "true");
    syncLangPickerButtons();
  };

  const hide = () => {
    popover.classList.add("hidden");
    popover.classList.remove("block");
    toggle.setAttribute("aria-expanded", "false");
  };

  const scheduleHide = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!hover) hide();
    }, 120);
  };

  if (mode === "hover") {
    wrap.addEventListener(
      "mouseenter",
      () => {
        hover = true;
        if (timer) window.clearTimeout(timer);
        show();
      },
      { signal },
    );
    wrap.addEventListener(
      "mouseleave",
      () => {
        hover = false;
        scheduleHide();
      },
      { signal },
    );
  }

  toggle.addEventListener(
    "click",
    (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (popover.classList.contains("block")) hide();
      else show();
    },
    { signal },
  );

  popover.addEventListener(
    "click",
    (e) => {
      const opt = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-lang-picker-option]");
      if (!opt) return;
      e.preventDefault();
      const id = opt.dataset.langPickerOption ?? "";
      const lng = mapPickerOptionIdToUiLang(id);
      if (lng === null) return;
      if (lng === "es") setSpanishPickerSessionId(id);
      void window.skillatlas?.setUiLang?.(lng);
      hide();
    },
    { signal },
  );
}

export function initLangPickerPopover() {
  if (!(window as unknown as { __skillatlasLangPickerDoc?: boolean }).__skillatlasLangPickerDoc) {
    (window as unknown as { __skillatlasLangPickerDoc?: boolean }).__skillatlasLangPickerDoc = true;

    document.addEventListener("click", (e) => {
      const wrap = document.querySelector<HTMLElement>("[data-lang-wrap]");
      const popover = document.querySelector<HTMLElement>("[data-lang-popover]");
      const toggle = document.querySelector<HTMLButtonElement>("[data-lang-quick-toggle]");
      if (!wrap || !popover || !toggle) return;
      if (!popover.classList.contains("block")) return;
      if (!wrap.contains(e.target as Node)) {
        popover.classList.add("hidden");
        popover.classList.remove("block");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const popover = document.querySelector<HTMLElement>("[data-lang-popover]");
      const toggle = document.querySelector<HTMLButtonElement>("[data-lang-quick-toggle]");
      if (!popover || !toggle) return;
      if (!popover.classList.contains("block")) return;
      popover.classList.add("hidden");
      popover.classList.remove("block");
      toggle.setAttribute("aria-expanded", "false");
    });

    window.addEventListener("skillatlas:prefs-updated", () => {
      const popover = document.querySelector<HTMLElement>("[data-lang-popover]");
      if (popover?.classList.contains("block")) syncLangPickerButtons();
      attachLangPopover();
    });
    window.addEventListener("skillatlas:lang-picker-sync", syncLangPickerButtons);

    document.addEventListener("astro:after-swap", attachLangPopover);
  }

  attachLangPopover();
}
