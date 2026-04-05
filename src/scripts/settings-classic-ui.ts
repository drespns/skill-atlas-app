import i18next from "i18next";
import {
  loadPrefs,
  migrateSettingsPanelHashFragment,
  updatePrefs,
  type SettingsPanelId,
  type SettingsSidebarSide,
} from "./prefs";

function sidebarLabel(side: SettingsSidebarSide): string {
  const key = side === "right" ? "settings.classic.sidebarRight" : "settings.classic.sidebarLeft";
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : side === "right" ? "Barra: derecha" : "Barra: izquierda";
}

const DEFAULT_PANEL_ID = "prefs";

function prefersReducedMotion(): boolean {
  if (document.documentElement.dataset.motion === "reduced") return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function panelIds(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-settings-panel]"))
    .map((el) => el.id)
    .filter(Boolean);
}

function resolvePanelId(panelsRoot: HTMLElement, requested: string): SettingsPanelId {
  const ids = panelIds(panelsRoot);
  const migrated = migrateSettingsPanelHashFragment(requested) ?? requested;
  return (ids.includes(migrated) ? migrated : DEFAULT_PANEL_ID) as SettingsPanelId;
}

/** Sin animación: actualiza DOM, hash opcional, prefs opcional. */
function showPanelImmediate(
  panelsRoot: HTMLElement,
  id: SettingsPanelId,
  nav: HTMLElement | null,
  opts: { syncHash: boolean; persistPrefs: boolean },
) {
  const resolved = resolvePanelId(panelsRoot, id);

  panelsRoot.querySelectorAll<HTMLElement>("[data-settings-panel]").forEach((el) => {
    const on = el.id === resolved;
    el.classList.toggle("hidden", !on);
    el.toggleAttribute("hidden", !on);
    el.setAttribute("aria-hidden", on ? "false" : "true");
  });

  nav?.querySelectorAll<HTMLAnchorElement>("a[data-settings-nav-link]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    const target = href.startsWith("#") ? href.slice(1) : "";
    const on = target === resolved;
    link.dataset.active = on ? "true" : "false";
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (opts.syncHash) {
    const next = `#${resolved}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }

  if (opts.persistPrefs) {
    updatePrefs({ settingsActiveSection: resolved });
  }
}

function clearPanelsRootMotionStyles(panelsRoot: HTMLElement) {
  panelsRoot.classList.remove("settings-panels-root--is-leaving", "settings-panels-root--is-entering");
  panelsRoot.style.minHeight = "";
  panelsRoot.style.transition = "";
}

function transitionToPanel(
  panelsRoot: HTMLElement,
  nav: HTMLElement | null,
  nextId: string,
  opts: { syncHash: boolean; persistPrefs: boolean },
) {
  const resolved = resolvePanelId(panelsRoot, nextId);

  if (prefersReducedMotion()) {
    showPanelImmediate(panelsRoot, resolved, nav, opts);
    return;
  }

  const currentVisible = panelsRoot.querySelector<HTMLElement>('[data-settings-panel]:not([hidden])');
  if (currentVisible?.id === resolved) {
    showPanelImmediate(panelsRoot, resolved, nav, opts);
    return;
  }

  clearPanelsRootMotionStyles(panelsRoot);

  const startH = Math.ceil(panelsRoot.getBoundingClientRect().height);
  if (startH > 0) {
    panelsRoot.style.minHeight = `${startH}px`;
  }

  panelsRoot.classList.add("settings-panels-root--is-leaving");

  window.setTimeout(() => {
    showPanelImmediate(panelsRoot, resolved, nav, opts);

    panelsRoot.classList.remove("settings-panels-root--is-leaving");
    void panelsRoot.offsetHeight;
    panelsRoot.classList.add("settings-panels-root--is-entering");

    requestAnimationFrame(() => {
      const el = document.getElementById(resolved);
      const targetH = el ? Math.ceil(el.offsetHeight) : startH;
      panelsRoot.style.transition = "min-height 0.45s cubic-bezier(0.25, 0.85, 0.35, 1)";
      panelsRoot.style.minHeight = `${Math.max(targetH, 120)}px`;
    });

    const finishMinHeight = () => {
      panelsRoot.style.minHeight = "";
      panelsRoot.style.transition = "";
    };

    let cleaned = false;
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "min-height") return;
      panelsRoot.removeEventListener("transitionend", onEnd);
      cleaned = true;
      finishMinHeight();
    };
    panelsRoot.addEventListener("transitionend", onEnd);

    window.setTimeout(() => {
      panelsRoot.classList.remove("settings-panels-root--is-entering");
    }, 420);

    window.setTimeout(() => {
      if (!cleaned) {
        panelsRoot.removeEventListener("transitionend", onEnd);
        finishMinHeight();
      }
    }, 600);
  }, 130);
}

function readHashPanel(): string | null {
  const h = window.location.hash.replace(/^#/, "").trim();
  if (!h) return null;
  const next = migrateSettingsPanelHashFragment(h);
  if (!next) return null;
  if (next !== h) {
    history.replaceState(null, "", `#${next}`);
  }
  return next;
}

function applySidebarLayout() {
  const p = loadPrefs();
  const row = document.querySelector<HTMLElement>("[data-settings-classic-row]");
  if (row) {
    row.classList.toggle("lg:flex-row-reverse", p.settingsSidebarSide === "right");
  }
  document.documentElement.dataset.settingsSidebarSide = p.settingsSidebarSide;

  const sideBtn = document.querySelector<HTMLButtonElement>("[data-settings-sidebar-toggle]");
  if (sideBtn) {
    const isRight = p.settingsSidebarSide === "right";
    sideBtn.setAttribute("aria-pressed", isRight.toString());
    const label = sideBtn.querySelector("[data-settings-sidebar-toggle-label]");
    if (label) label.textContent = sidebarLabel(p.settingsSidebarSide);
  }
}

function initSettingsShell() {
  const root = document.querySelector<HTMLElement>("[data-settings-page-root]");
  if (!root || root.dataset.settingsShellBound === "1") return;
  root.dataset.settingsShellBound = "1";

  const nav = document.querySelector<HTMLElement>("[data-settings-classic-nav]");
  const panelsRoot = root.querySelector<HTMLElement>("[data-settings-panels-root]");
  if (!panelsRoot) return;

  const initialId = (): SettingsPanelId => {
    const ids = new Set(panelIds(panelsRoot));
    const hash = readHashPanel();
    if (hash && ids.has(hash)) return hash as SettingsPanelId;
    const saved = loadPrefs().settingsActiveSection;
    if (saved && ids.has(saved)) return saved;
    return DEFAULT_PANEL_ID as SettingsPanelId;
  };

  const activate = (id: string, opts: { syncHash: boolean; persistPrefs: boolean; animate: boolean }) => {
    if (opts.animate) {
      transitionToPanel(panelsRoot, nav, id, {
        syncHash: opts.syncHash,
        persistPrefs: opts.persistPrefs,
      });
    } else {
      showPanelImmediate(panelsRoot, resolvePanelId(panelsRoot, id), nav, {
        syncHash: opts.syncHash,
        persistPrefs: opts.persistPrefs,
      });
    }
  };

  applySidebarLayout();
  activate(initialId(), { syncHash: false, persistPrefs: false, animate: false });

  const hash = readHashPanel();
  if (hash && panelIds(panelsRoot).includes(hash)) {
    const cur = loadPrefs().settingsActiveSection;
    if (cur !== hash) {
      updatePrefs({ settingsActiveSection: hash as SettingsPanelId });
    }
  }

  nav?.querySelectorAll<HTMLAnchorElement>("a[data-settings-nav-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href?.startsWith("#")) return;
      e.preventDefault();
      const id = href.slice(1);
      activate(id, { syncHash: true, persistPrefs: true, animate: true });
    });
  });

  document.querySelector<HTMLButtonElement>("[data-settings-sidebar-toggle]")?.addEventListener("click", () => {
    const cur = loadPrefs().settingsSidebarSide;
    const next: SettingsSidebarSide = cur === "left" ? "right" : "left";
    updatePrefs({ settingsSidebarSide: next });
    applySidebarLayout();
  });

  window.addEventListener("hashchange", () => {
    const h = readHashPanel();
    if (h && panelIds(panelsRoot).includes(h)) {
      activate(h, { syncHash: false, persistPrefs: true, animate: true });
      return;
    }
    if (!h) {
      const saved = loadPrefs().settingsActiveSection;
      if (saved && panelIds(panelsRoot).includes(saved)) {
        activate(saved, { syncHash: false, persistPrefs: false, animate: true });
      }
    }
  });

  window.addEventListener("skillatlas:prefs-updated", () => applySidebarLayout());
  window.addEventListener("skillatlas:ui-lang-changed", () => applySidebarLayout());

  window.addEventListener("skillatlas:settings-panel", ((e: Event) => {
    const ce = e as CustomEvent<{ id?: string }>;
    const id = ce.detail?.id;
    if (typeof id !== "string") return;
    const migrated = migrateSettingsPanelHashFragment(id) ?? id;
    clearPanelsRootMotionStyles(panelsRoot);
    showPanelImmediate(panelsRoot, resolvePanelId(panelsRoot, migrated), nav, {
      syncHash: true,
      persistPrefs: false,
    });
  }) as EventListener);
}

const boot = () => initSettingsShell();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);
