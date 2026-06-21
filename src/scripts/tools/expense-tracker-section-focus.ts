/** Expande una sección por fila (grid focus) con animación y persistencia. */

const STORAGE_KEY = "skillatlas_et_section_focus";

type FocusState = Record<string, string | null>;

function readFocusState(): FocusState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FocusState;
  } catch {
    return {};
  }
}

function writeFocusState(state: FocusState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function applyRowFocus(row: HTMLElement, panelId: string | null) {
  const panels = row.querySelectorAll<HTMLElement>("[data-et-section-panel]");
  for (const panel of panels) {
    const id = panel.dataset.etSectionPanel ?? "";
    const expanded = panelId != null && id === panelId;
    panel.classList.toggle("et-section-panel--expanded", expanded);
    panel.classList.toggle("et-section-panel--dimmed", panelId != null && !expanded);
    const btn = panel.querySelector<HTMLButtonElement>("[data-et-section-expand]");
    if (btn) {
      btn.setAttribute("aria-pressed", expanded ? "true" : "false");
      btn.title = expanded ? "Restaurar tamaño" : "Ampliar sección";
    }
  }
}

export function bindSectionFocus(root: HTMLElement) {
  if (root.dataset.etSectionFocusBound === "1") return;
  root.dataset.etSectionFocusBound = "1";

  const saved = readFocusState();

  for (const row of root.querySelectorAll<HTMLElement>("[data-et-focus-row]")) {
    const rowId = row.dataset.etFocusRow ?? "";
    applyRowFocus(row, saved[rowId] ?? null);

    row.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-et-section-expand]");
      if (!btn) return;
      const panel = btn.closest<HTMLElement>("[data-et-section-panel]");
      if (!panel) return;
      const panelId = panel.dataset.etSectionPanel ?? "";
      const current = saved[rowId] ?? null;
      const next = current === panelId ? null : panelId;
      saved[rowId] = next;
      writeFocusState(saved);
      applyRowFocus(row, next);
    });
  }
}
