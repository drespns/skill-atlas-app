import { getSupabaseBrowserClient } from "./client-supabase";

const CHECKLIST_KEY = "skillatlas_fab_checklist_v1";

type CheckKey = "tech" | "project" | "cv" | "portfolio";

type FabPane = "shortcuts" | "checklist" | "ai";

function readChecks(): Record<CheckKey, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? "{}") as Record<string, boolean>;
    return {
      tech: Boolean(raw.tech),
      project: Boolean(raw.project),
      cv: Boolean(raw.cv),
      portfolio: Boolean(raw.portfolio),
    };
  } catch {
    return { tech: false, project: false, cv: false, portfolio: false };
  }
}

function writeChecks(next: Record<CheckKey, boolean>) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
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

function setTriggerExpanded(
  root: HTMLElement,
  pane: FabPane,
  shortcutsBtn: HTMLButtonElement | null,
  checklistBtn: HTMLButtonElement | null,
  aiBtn: HTMLButtonElement | null,
) {
  shortcutsBtn?.setAttribute("aria-expanded", pane === "shortcuts" ? "true" : "false");
  checklistBtn?.setAttribute("aria-expanded", pane === "checklist" ? "true" : "false");
  aiBtn?.setAttribute("aria-expanded", pane === "ai" ? "true" : "false");
}

function openFabPanel(root: HTMLElement, pane: FabPane) {
  const backdrop = root.querySelector<HTMLElement>("[data-fab-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-fab-panel]");
  const shortcutsBtn = root.querySelector<HTMLButtonElement>("[data-fab-shortcuts]");
  const checklistBtn = root.querySelector<HTMLButtonElement>("[data-fab-checklist]");
  const aiBtn = root.querySelector<HTMLButtonElement>("[data-fab-ai]");
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

  setTriggerExpanded(root, pane, shortcutsBtn, checklistBtn, aiBtn);

  const closeBtn = root.querySelector<HTMLButtonElement>("[data-fab-close]");
  window.setTimeout(() => closeBtn?.focus(), prefersReducedMotion() ? 0 : 50);
}

function closeFabPanel(root: HTMLElement) {
  const backdrop = root.querySelector<HTMLElement>("[data-fab-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-fab-panel]");
  const shortcutsBtn = root.querySelector<HTMLButtonElement>("[data-fab-shortcuts]");
  const checklistBtn = root.querySelector<HTMLButtonElement>("[data-fab-checklist]");
  const aiBtn = root.querySelector<HTMLButtonElement>("[data-fab-ai]");
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

  shortcutsBtn?.setAttribute("aria-expanded", "false");
  checklistBtn?.setAttribute("aria-expanded", "false");
  aiBtn?.setAttribute("aria-expanded", "false");
}

function syncChecklistInputs(root: HTMLElement) {
  const c = readChecks();
  root.querySelectorAll<HTMLInputElement>("input[data-fab-check]").forEach((input) => {
    const k = input.getAttribute("data-fab-check") as CheckKey | null;
    if (k && k in c) input.checked = c[k];
  });
}

function bindFabRoot(root: HTMLElement) {
  const backdrop = root.querySelector<HTMLElement>("[data-fab-backdrop]");
  const panel = root.querySelector<HTMLElement>("[data-fab-panel]");
  const shortcutsBtn = root.querySelector<HTMLButtonElement>("[data-fab-shortcuts]");
  const checklistBtn = root.querySelector<HTMLButtonElement>("[data-fab-checklist]");
  const aiBtn = root.querySelector<HTMLButtonElement>("[data-fab-ai]");
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-fab-close]");
  const openPaletteBtn = root.querySelector<HTMLButtonElement>("[data-fab-open-palette]");
  const tabRow = root.querySelector<HTMLElement>("[data-fab-tab-row]");

  const toggleFromBubble = (pane: FabPane) => {
    const open = panel && !panel.hidden;
    if (open && root.dataset.fabActivePane === pane) closeFabPanel(root);
    else openFabPanel(root, pane);
  };

  shortcutsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFromBubble("shortcuts");
  });

  checklistBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFromBubble("checklist");
  });

  aiBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFromBubble("ai");
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
      if (t !== "shortcuts" && t !== "checklist" && t !== "ai") return;
      const pane = t as FabPane;
      setFabTab(root, pane);
      setTriggerExpanded(root, pane, shortcutsBtn, checklistBtn, aiBtn);
    });
  });

  root.querySelectorAll<HTMLInputElement>("input[data-fab-check]").forEach((input) => {
    input.addEventListener("change", () => {
      if (root.dataset.fabGuest === "1") return;
      const k = input.getAttribute("data-fab-check") as CheckKey | null;
      if (!k) return;
      const next = readChecks();
      next[k] = input.checked;
      writeChecks(next);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!panel || panel.hidden) return;
    const pane = root.dataset.fabActivePane as FabPane | undefined;
    closeFabPanel(root);
    if (pane === "checklist") checklistBtn?.focus();
    else if (pane === "ai") aiBtn?.focus();
    else shortcutsBtn?.focus();
  });

  const applyLayout = (authed: boolean) => {
    if (authed) delete root.dataset.fabGuest;
    else root.dataset.fabGuest = "1";

    const guestBanner = root.querySelector<HTMLElement>("[data-fab-checklist-guest-callout]");
    const authedIntro = root.querySelector<HTMLElement>("[data-fab-checklist-intro-authed]");
    guestBanner?.classList.toggle("hidden", authed);
    authedIntro?.classList.toggle("hidden", !authed);

    root.querySelectorAll<HTMLInputElement>("input[data-fab-check]").forEach((input) => {
      input.disabled = !authed;
      input.setAttribute("aria-disabled", String(!authed));
    });

    root.querySelectorAll<HTMLElement>("[data-fab-check-row]").forEach((row) => {
      row.classList.toggle("opacity-60", !authed);
      row.classList.toggle("cursor-not-allowed", !authed);
      row.classList.toggle("cursor-pointer", authed);
    });

    checklistBtn?.classList.remove("hidden");
    if (tabRow) {
      tabRow.classList.remove("hidden");
      tabRow.classList.add("flex");
    }
  };

  (root as HTMLElement & { __fabApplyLayout?: (a: boolean) => void }).__fabApplyLayout = applyLayout;
}

async function syncFabBubbles() {
  const root = document.querySelector<HTMLElement>("[data-fab-root]");
  if (!root) return;

  if (root.dataset.fabBound !== "1") {
    root.dataset.fabBound = "1";
    bindFabRoot(root);
    syncChecklistInputs(root);
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

  syncChecklistInputs(root);
}

function bootFabBubbles() {
  void syncFabBubbles();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootFabBubbles);
else bootFabBubbles();

document.addEventListener("astro:page-load", bootFabBubbles);
document.addEventListener("astro:after-swap", bootFabBubbles);

window.addEventListener("skillatlas:auth-nav-updated", () => void syncFabBubbles());
