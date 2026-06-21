/** Persistencia y descargas solo para navegador (web). */

import {
  EXPENSE_TRACKER_STORAGE_KEY,
  normalizeExpenseTrackerState,
  type ExpenseTrackerState,
} from "@skill-atlas/expense-core";

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadExpenseTrackerFromStorage(): ExpenseTrackerState {
  const raw = safeParse(
    typeof localStorage !== "undefined" ? localStorage.getItem(EXPENSE_TRACKER_STORAGE_KEY) : null,
  );
  return normalizeExpenseTrackerState(raw);
}

export function saveExpenseTrackerToStorage(state: ExpenseTrackerState) {
  try {
    localStorage.setItem(EXPENSE_TRACKER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
