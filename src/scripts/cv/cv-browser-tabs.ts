/**
 * Pestañas «CV | Cartas | Ofertas» en /cv.
 */

export type CvBrowserTabId = "cv" | "cartas" | "ofertas";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function scheduleTabShellMinHeight(shell: HTMLElement | null): void {
  if (!shell || prefersReducedMotion()) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const visible = Array.from(shell.querySelectorAll<HTMLElement>("[data-cv-tab-panel]")).find(
        (p) => !p.classList.contains("hidden"),
      );
      if (!visible) return;
      const h = visible.offsetHeight;
      const next = Math.min(Math.max(h + 56, 360), Math.floor(window.innerHeight * 0.88));
      shell.style.minHeight = `${next}px`;
    });
  });
}

export function bindCvBrowserTabs(opts: {
  onChange?: (tab: CvBrowserTabId) => void;
}): void {
  const tabs = document.querySelector<HTMLElement>("[data-cv-browser-tabs]");
  if (!tabs || tabs.dataset.cvTabsBound === "1") return;
  tabs.dataset.cvTabsBound = "1";

  const buttons = Array.from(tabs.querySelectorAll<HTMLButtonElement>("[data-cv-nav-tab]"));
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-cv-tab-panel]"));
  const shell = document.querySelector<HTMLElement>("[data-cv-tab-panels-shell]");

  const setActive = (id: CvBrowserTabId) => {
    for (const btn of buttons) {
      const t = btn.dataset.cvNavTab as CvBrowserTabId | undefined;
      const on = t === id;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("cv-folder-tab-active", on);
    }
    for (const p of panels) {
      const pid = p.dataset.cvTabPanel as CvBrowserTabId | undefined;
      const show = pid === id;
      p.classList.toggle("hidden", !show);
      p.classList.remove("cv-tab-panel--enter");
      if (show && !prefersReducedMotion()) {
        void p.offsetWidth;
        p.classList.add("cv-tab-panel--enter");
        const onEnd = (ev: AnimationEvent) => {
          if (ev.animationName !== "cv-tab-panel-in") return;
          p.removeEventListener("animationend", onEnd);
          p.classList.remove("cv-tab-panel--enter");
        };
        p.addEventListener("animationend", onEnd);
      }
    }
    scheduleTabShellMinHeight(shell);
    try {
      const hash = id === "cv" ? "" : id === "cartas" ? "cartas" : "ofertas";
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", hash ? `${base}#${hash}` : base);
    } catch {
      // ignore
    }
    opts.onChange?.(id);
  };

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      const id = btn.dataset.cvNavTab as CvBrowserTabId | undefined;
      if (!id) return;
      setActive(id);
    });
  }

  const fromHash = (): CvBrowserTabId => {
    const h = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    if (h === "cartas" || h === "letters") return "cartas";
    if (h === "ofertas" || h === "jobs") return "ofertas";
    return "cv";
  };
  setActive(fromHash());
  window.addEventListener("hashchange", () => setActive(fromHash()));
  window.addEventListener("resize", () => scheduleTabShellMinHeight(shell));
}
