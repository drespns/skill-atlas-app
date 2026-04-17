import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  EXPENSE_TRACKER_CLIENT_SCOPE,
  applyExpenseImportMerge,
  applyExpenseImportReplace,
  buildCategoryTotals,
  convertAmount,
  defaultExpenseTrackerState,
  downloadBlobFile,
  downloadTextFile,
  expenseTrackerFromCsv,
  expenseTrackerToCsv,
  expenseTrackerToJsonSnapshot,
  filterExpensesByPeriod,
  loadExpenseTrackerFromStorage,
  formatCategoryPath,
  mergeExpenseTrackerRemoteLocal,
  monthlyExpenseSeries,
  monthlyIncomeSeries,
  monthlyPlannedOutflowSeries,
  normalizeExpenseTrackerState,
  normalizeHttpsUrl,
  parseTags,
  periodStartIso,
  remindersDueToday,
  saveExpenseTrackerToStorage,
  expenseMatchesChartCategoryFilter,
  subscriptionMonthlyBurnByCurrency,
  subscriptionNextChargeIso,
  subscriptionToMonthlyAmount,
  validateCategoryTree,
  type ExpenseAttachment,
  type ExpenseRow,
  type ExpenseTrackerState,
  type IncomeAdhocRow,
  type PaycheckEntry,
  type PlannedExpenseEntry,
  type SubscriptionRow,
} from "@lib/tools-expense-tracker";
import { isExpenseEncryptedEnvelope, openExpenseEnvelope, sealExpenseState } from "@lib/tools-expense-tracker-crypto";
import type { EncryptedExpenseEnvelope } from "@lib/tools-expense-tracker-crypto";
import { loadClientState, scheduleSaveClientState } from "@scripts/core/user-client-state";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

function isDark() {
  return document.documentElement.classList.contains("dark");
}

function textPrimary() {
  return isDark() ? "#e5e7eb" : "#1f2937";
}

function textMuted() {
  return isDark() ? "#9ca3af" : "#6b7280";
}

function borderSubtle() {
  return isDark() ? "#374151" : "#e5e7eb";
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `et_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(n: number, currency: "EUR" | "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function fmtCompact(n: number, currency: "EUR" | "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

let state: ExpenseTrackerState = defaultExpenseTrackerState();
const chartInstances: echarts.ECharts[] = [];
let resizeObserver: ResizeObserver | null = null;
let editingSubId: string | null = null;

/** Frase solo en memoria de esta pestaña; no va a disco ni servidor. */
let e2eSessionPassphrase: string | null = null;
/** Copia remota cifrada pendiente de descifrar (bloquea subidas para no pisar el sobre). */
let pendingEncryptedRemote: EncryptedExpenseEnvelope | null = null;

const ET_FIELD = "et-field w-full min-w-0 text-sm";
const ET_FIELD_MONO = `${ET_FIELD} font-mono`;

type ImportMode = "merge" | "replace";
let alertResolver: (() => void) | null = null;
let confirmResolver: ((ok: boolean) => void) | null = null;
let importModeResolver: ((mode: ImportMode | null) => void) | null = null;
let linkResolver: ((v: { title: string; url: string } | null) => void) | null = null;
let catResolver: ((v: { name: string; parentId: string | null } | null) => void) | null = null;
let e2eSetResolver: ((ok: boolean) => void) | null = null;
let e2eUnlockResolver: ((pass: string | null) => void) | null = null;

let syncPopoverDocAc: AbortController | null = null;

function disposeCharts() {
  for (const c of chartInstances) c.dispose();
  chartInstances.length = 0;
  resizeObserver?.disconnect();
  resizeObserver = null;
}

function pushChart(el: HTMLElement | null, opt: echarts.EChartsCoreOption) {
  if (!el) return;
  const inst = echarts.init(el, undefined, { renderer: "canvas" });
  inst.setOption(opt);
  chartInstances.push(inst);
  return inst;
}

function cloudSaveBlocked() {
  return pendingEncryptedRemote != null;
}

function persist() {
  saveExpenseTrackerToStorage(state);
  if (!state.syncToAccount || cloudSaveBlocked()) return;
  if (state.cloudE2E) {
    if (!e2eSessionPassphrase) return;
    void sealExpenseState(state, e2eSessionPassphrase).then(
      (env) => scheduleSaveClientState(EXPENSE_TRACKER_CLIENT_SCOPE, env, 0),
      () => {},
    );
  } else {
    scheduleSaveClientState(EXPENSE_TRACKER_CLIENT_SCOPE, state, 0);
  }
}

function bindExpenseDialogs(root: HTMLElement) {
  const dlgAlert = root.querySelector<HTMLDialogElement>("[data-et-dlg-alert]");
  if (dlgAlert) {
    dlgAlert.querySelector("[data-et-dlg-alert-ok]")?.addEventListener("click", () => {
      dlgAlert.close();
      alertResolver?.();
      alertResolver = null;
    });
    dlgAlert.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      dlgAlert.close();
      alertResolver?.();
      alertResolver = null;
    });
  }

  const dlgConfirm = root.querySelector<HTMLDialogElement>("[data-et-dlg-confirm]");
  if (dlgConfirm) {
    dlgConfirm.querySelector("[data-et-dlg-confirm-ok]")?.addEventListener("click", () => {
      dlgConfirm.close();
      confirmResolver?.(true);
      confirmResolver = null;
    });
    dlgConfirm.querySelector("[data-et-dlg-confirm-cancel]")?.addEventListener("click", () => {
      dlgConfirm.close();
      confirmResolver?.(false);
      confirmResolver = null;
    });
    dlgConfirm.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      dlgConfirm.close();
      confirmResolver?.(false);
      confirmResolver = null;
    });
  }

  const dlgImport = root.querySelector<HTMLDialogElement>("[data-et-dlg-import]");
  if (dlgImport) {
    dlgImport.querySelector("[data-et-dlg-import-merge]")?.addEventListener("click", () => {
      dlgImport.close();
      importModeResolver?.("merge");
      importModeResolver = null;
    });
    dlgImport.querySelector("[data-et-dlg-import-replace]")?.addEventListener("click", () => {
      dlgImport.close();
      importModeResolver?.("replace");
      importModeResolver = null;
    });
    dlgImport.querySelector("[data-et-dlg-import-cancel]")?.addEventListener("click", () => {
      dlgImport.close();
      importModeResolver?.(null);
      importModeResolver = null;
    });
    dlgImport.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      dlgImport.close();
      importModeResolver?.(null);
      importModeResolver = null;
    });
  }

  const dlgLink = root.querySelector<HTMLDialogElement>("[data-et-dlg-link]");
  if (dlgLink) {
    const tEl = dlgLink.querySelector<HTMLInputElement>("[data-et-dlg-link-title]");
    const uEl = dlgLink.querySelector<HTMLInputElement>("[data-et-dlg-link-url]");
    dlgLink.querySelector("[data-et-dlg-link-save]")?.addEventListener("click", () => {
      const title = tEl?.value?.trim() ?? "";
      const urlRaw = uEl?.value?.trim() ?? "";
      const url = normalizeHttpsUrl(urlRaw);
      if (!url) {
        void showAlertDialog(root, "La URL debe ser https:// válida.");
        return;
      }
      dlgLink.close();
      linkResolver?.({ title: title || "Enlace", url });
      linkResolver = null;
    });
    dlgLink.querySelector("[data-et-dlg-link-cancel]")?.addEventListener("click", () => {
      dlgLink.close();
      linkResolver?.(null);
      linkResolver = null;
    });
    dlgLink.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      dlgLink.close();
      linkResolver?.(null);
      linkResolver = null;
    });
  }

  const dlgCat = root.querySelector<HTMLDialogElement>("[data-et-dlg-category]");
  if (dlgCat) {
    dlgCat.querySelector("[data-et-dlg-cat-save]")?.addEventListener("click", () => {
      const name = dlgCat.querySelector<HTMLInputElement>("[data-et-dlg-cat-name]")?.value?.trim() ?? "";
      const parentSel = dlgCat.querySelector<HTMLSelectElement>("[data-et-dlg-cat-parent]");
      const parentId = parentSel?.value ? parentSel.value : null;
      if (!name) return;
      dlgCat.close();
      catResolver?.({ name, parentId });
      catResolver = null;
    });
    dlgCat.querySelector("[data-et-dlg-cat-cancel]")?.addEventListener("click", () => {
      dlgCat.close();
      catResolver?.(null);
      catResolver = null;
    });
    dlgCat.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      dlgCat.close();
      catResolver?.(null);
      catResolver = null;
    });
  }

  const dlgE2eSet = root.querySelector<HTMLDialogElement>("[data-et-dlg-e2e-set]");
  if (dlgE2eSet) {
    dlgE2eSet.querySelector("[data-et-dlg-e2e-set-save]")?.addEventListener("click", () => {
      const p1 = dlgE2eSet.querySelector<HTMLInputElement>("[data-et-dlg-e2e-p1]")?.value ?? "";
      const p2 = dlgE2eSet.querySelector<HTMLInputElement>("[data-et-dlg-e2e-p2]")?.value ?? "";
      if (p1.length < 8) {
        void showAlertDialog(root, "Usa al menos 8 caracteres para la frase.");
        return;
      }
      if (p1 !== p2) {
        void showAlertDialog(root, "Las dos frases no coinciden.");
        return;
      }
      e2eSessionPassphrase = p1;
      dlgE2eSet.close();
      closeSyncPopoverPanel(root);
      e2eSetResolver?.(true);
      e2eSetResolver = null;
    });
    dlgE2eSet.querySelector("[data-et-dlg-e2e-set-cancel]")?.addEventListener("click", () => {
      dlgE2eSet.close();
      e2eSetResolver?.(false);
      e2eSetResolver = null;
    });
    dlgE2eSet.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      dlgE2eSet.close();
      e2eSetResolver?.(false);
      e2eSetResolver = null;
    });
  }

  const dlgUnlock = root.querySelector<HTMLDialogElement>("[data-et-dlg-e2e-unlock]");
  if (dlgUnlock) {
    dlgUnlock.querySelector("[data-et-dlg-e2e-unlock-go]")?.addEventListener("click", () => {
      const p = dlgUnlock.querySelector<HTMLInputElement>("[data-et-dlg-e2e-unlock-pass]")?.value ?? "";
      dlgUnlock.close();
      e2eUnlockResolver?.(p || null);
      e2eUnlockResolver = null;
    });
    dlgUnlock.querySelector("[data-et-dlg-e2e-unlock-cancel]")?.addEventListener("click", () => {
      dlgUnlock.close();
      e2eUnlockResolver?.(null);
      e2eUnlockResolver = null;
    });
    dlgUnlock.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      dlgUnlock.close();
      e2eUnlockResolver?.(null);
      e2eUnlockResolver = null;
    });
  }
}

function showAlertDialog(root: HTMLElement, msg: string): Promise<void> {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-alert]");
  const p = root.querySelector<HTMLElement>("[data-et-dlg-alert-msg]");
  if (!dlg || !p) return Promise.resolve();
  p.textContent = msg;
  return new Promise((resolve) => {
    alertResolver = resolve;
    dlg.showModal();
  });
}

function showConfirmDialog(root: HTMLElement, msg: string, okLabel = "Continuar"): Promise<boolean> {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-confirm]");
  const p = root.querySelector<HTMLElement>("[data-et-dlg-confirm-msg]");
  const okBtn = root.querySelector<HTMLElement>("[data-et-dlg-confirm-ok]");
  if (!dlg || !p || !okBtn) return Promise.resolve(false);
  p.textContent = msg;
  okBtn.textContent = okLabel;
  return new Promise((resolve) => {
    confirmResolver = resolve;
    dlg.showModal();
  });
}

function showImportModeDialog(root: HTMLElement, hint: string): Promise<ImportMode | null> {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-import]");
  const h = root.querySelector<HTMLElement>("[data-et-dlg-import-hint]");
  if (!dlg || !h) return Promise.resolve(null);
  h.textContent = hint;
  return new Promise((resolve) => {
    importModeResolver = resolve;
    dlg.showModal();
  });
}

function showLinkDialog(root: HTMLElement): Promise<{ title: string; url: string } | null> {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-link]");
  const tEl = dlg?.querySelector<HTMLInputElement>("[data-et-dlg-link-title]");
  const uEl = dlg?.querySelector<HTMLInputElement>("[data-et-dlg-link-url]");
  if (!dlg || !tEl || !uEl) return Promise.resolve(null);
  tEl.value = "";
  uEl.value = "";
  return new Promise((resolve) => {
    linkResolver = resolve;
    dlg.showModal();
    tEl.focus();
  });
}

function fillCategoryParentSelect(sel: HTMLSelectElement) {
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "— Raíz (sin padre) —";
  sel.appendChild(o0);
  const sorted = [...state.categories].sort((a, b) =>
    formatCategoryPath(state, a.id).localeCompare(formatCategoryPath(state, b.id), "es"),
  );
  for (const c of sorted) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = formatCategoryPath(state, c.id);
    sel.appendChild(o);
  }
}

function openNewCategoryDialog(root: HTMLElement): Promise<{ name: string; parentId: string | null } | null> {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-category]");
  const nameEl = dlg?.querySelector<HTMLInputElement>("[data-et-dlg-cat-name]");
  const parEl = dlg?.querySelector<HTMLSelectElement>("[data-et-dlg-cat-parent]");
  if (!dlg || !nameEl || !parEl) return Promise.resolve(null);
  nameEl.value = "";
  fillCategoryParentSelect(parEl);
  requestAnimationFrame(() => window.dispatchEvent(new Event("skillatlas:select-popovers-refresh")));
  return new Promise((resolve) => {
    catResolver = resolve;
    dlg.showModal();
    nameEl.focus();
  });
}

function openE2ePassphraseDialog(root: HTMLElement): Promise<boolean> {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-e2e-set]");
  const p1 = dlg?.querySelector<HTMLInputElement>("[data-et-dlg-e2e-p1]");
  const p2 = dlg?.querySelector<HTMLInputElement>("[data-et-dlg-e2e-p2]");
  if (!dlg || !p1 || !p2) return Promise.resolve(false);
  p1.value = "";
  p2.value = "";
  return new Promise((resolve) => {
    e2eSetResolver = resolve;
    dlg.showModal();
    p1.focus();
  });
}

function openUnlockDialog(root: HTMLElement): Promise<string | null> {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-e2e-unlock]");
  const p = dlg?.querySelector<HTMLInputElement>("[data-et-dlg-e2e-unlock-pass]");
  if (!dlg || !p) return Promise.resolve(null);
  p.value = "";
  return new Promise((resolve) => {
    e2eUnlockResolver = resolve;
    dlg.showModal();
    p.focus();
  });
}

async function tryApplyDecryptedRemote(root: HTMLElement, env: EncryptedExpenseEnvelope, pass: string) {
  try {
    const json = await openExpenseEnvelope(env, pass);
    const remoteDecrypted = normalizeExpenseTrackerState(JSON.parse(json));
    const local = loadExpenseTrackerFromStorage();
    e2eSessionPassphrase = pass;
    state = mergeExpenseTrackerRemoteLocal(remoteDecrypted, local);
    pendingEncryptedRemote = null;
    saveExpenseTrackerToStorage(state);
    renderAll(root);
    persist();
    closeSyncPopoverPanel(root);
  } catch {
    pendingEncryptedRemote = env;
    renderAll(root);
    await showAlertDialog(root, "Frase incorrecta o datos dañados.");
  }
}

function pushTagBankFrom(tags: string[]) {
  const set = new Set(state.tagBank.map((t) => t.toLowerCase()));
  for (const t of tags) {
    const x = t.trim().toLowerCase();
    if (x && !set.has(x)) {
      set.add(x);
      state.tagBank.push(x);
    }
  }
  state.tagBank = [...set].slice(0, 80);
}

function renderKpis(root: HTMLElement) {
  const elSubs = root.querySelector<HTMLElement>("[data-et-kpi-subs]");
  const elExp = root.querySelector<HTMLElement>("[data-et-kpi-expenses]");
  const elBlend = root.querySelector<HTMLElement>("[data-et-kpi-blend]");
  const elInc = root.querySelector<HTMLElement>("[data-et-kpi-income]");
  const elBal = root.querySelector<HTMLElement>("[data-et-kpi-balance]");
  if (!elSubs || !elExp || !elBlend) return;

  let subEur = 0;
  let subUsd = 0;
  for (const s of state.subscriptions) {
    if (!s.active) continue;
    const m = subscriptionToMonthlyAmount(s);
    if (s.currency === "EUR") subEur += m;
    else subUsd += m;
  }

  const ex = filterExpensesByPeriod(state.expenses, state.period).filter((e) => e.confirmed !== false);
  let expEur = 0;
  let expUsd = 0;
  for (const e of ex) {
    if (e.currency === "EUR") expEur += Math.max(0, e.amount);
    else expUsd += Math.max(0, e.amount);
  }

  const mode = state.chartMoneyMode;
  const fx = state.eurPerUsd;

  const blendLine = () => {
    if (mode === "unify_eur") {
      const t = expEur + convertAmount(expUsd, "USD", "EUR", fx) + subEur + convertAmount(subUsd, "USD", "EUR", fx);
      return `≈ ${fmtCompact(t, "EUR")} / mes ref. (subs mensual + gastos período unificados)`;
    }
    if (mode === "unify_usd") {
      const t = expUsd + convertAmount(expEur, "EUR", "USD", fx) + subUsd + convertAmount(subEur, "EUR", "USD", fx);
      return `≈ ${fmtCompact(t, "USD")} / mes ref.`;
    }
    return `${fmtCompact(subEur, "EUR")} + ${fmtCompact(subUsd, "USD")} suscripciones · ${fmtCompact(expEur, "EUR")} + ${fmtCompact(expUsd, "USD")} gastos`;
  };

  if (mode === "mixed") {
    elSubs.textContent = `${fmtCompact(subEur, "EUR")} + ${fmtCompact(subUsd, "USD")} / mes equiv.`;
    elExp.textContent = `${fmtCompact(expEur, "EUR")} + ${fmtCompact(expUsd, "USD")}`;
  } else if (mode === "unify_eur") {
    elSubs.textContent = fmtCompact(subEur + convertAmount(subUsd, "USD", "EUR", fx), "EUR");
    elExp.textContent = fmtCompact(expEur + convertAmount(expUsd, "USD", "EUR", fx), "EUR");
  } else {
    elSubs.textContent = fmtCompact(subUsd + convertAmount(subEur, "EUR", "USD", fx), "USD");
    elExp.textContent = fmtCompact(expUsd + convertAmount(expEur, "EUR", "USD", fx), "USD");
  }
  elBlend.textContent = blendLine();

  const curMonth = new Date().toISOString().slice(0, 7);
  const exM = state.expenses.filter((e) => e.date.startsWith(curMonth) && e.confirmed !== false);
  let expMEur = 0;
  let expMUsd = 0;
  for (const e of exM) {
    if (e.currency === "EUR") expMEur += Math.max(0, e.amount);
    else expMUsd += Math.max(0, e.amount);
  }
  const burn = subscriptionMonthlyBurnByCurrency(state);
  const planM = monthlyPlannedOutflowSeries(state, [curMonth], mode, fx);
  const outMEur = expMEur + burn.eur + (planM.seriesEur[0] ?? 0);
  const outMUsd = expMUsd + burn.usd + (planM.seriesUsd[0] ?? 0);
  const incS = monthlyIncomeSeries(state, [curMonth], mode, fx);
  const incEur = incS.seriesEur[0] ?? 0;
  const incUsd = incS.seriesUsd[0] ?? 0;
  if (elInc) {
    if (mode === "mixed") elInc.textContent = `${fmtCompact(incEur, "EUR")} + ${fmtCompact(incUsd, "USD")}`;
    else if (mode === "unify_eur") elInc.textContent = fmtCompact(incS.seriesUnified[0] ?? 0, "EUR");
    else elInc.textContent = fmtCompact(incS.seriesUnified[0] ?? 0, "USD");
  }
  if (elBal) {
    if (mode === "mixed") {
      elBal.textContent = `${fmtCompact(incEur - outMEur, "EUR")} / ${fmtCompact(incUsd - outMUsd, "USD")}`;
    } else if (mode === "unify_eur") {
      const outT = outMEur + convertAmount(outMUsd, "USD", "EUR", fx);
      elBal.textContent = fmtCompact((incS.seriesUnified[0] ?? 0) - outT, "EUR");
    } else {
      const outT = outMUsd + convertAmount(outMEur, "EUR", "USD", fx);
      elBal.textContent = fmtCompact((incS.seriesUnified[0] ?? 0) - outT, "USD");
    }
  }

  const elYi = root.querySelector<HTMLElement>("[data-et-kpi-year-income]");
  const elYo = root.querySelector<HTMLElement>("[data-et-kpi-year-out]");
  const elYn = root.querySelector<HTMLElement>("[data-et-kpi-year-net]");
  if (elYi && elYo && elYn) {
    const year = new Date().getFullYear();
    const ys = buildNaturalYearOutInSeries(year);
    const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    const incE = sum(ys.incEur);
    const incU = sum(ys.incUsd);
    const outE = sum(ys.outEur);
    const outU = sum(ys.outUsd);
    const incUni = sum(ys.incUni);
    const outUni = sum(ys.outUni);
    if (mode === "mixed") {
      elYi.textContent = `${fmtCompact(incE, "EUR")} + ${fmtCompact(incU, "USD")}`;
      elYo.textContent = `${fmtCompact(outE, "EUR")} + ${fmtCompact(outU, "USD")}`;
      elYn.textContent = `${fmtCompact(incE - outE, "EUR")} / ${fmtCompact(incU - outU, "USD")}`;
    } else if (mode === "unify_eur") {
      elYi.textContent = fmtCompact(incUni, "EUR");
      elYo.textContent = fmtCompact(outUni, "EUR");
      elYn.textContent = fmtCompact(incUni - outUni, "EUR");
    } else {
      elYi.textContent = fmtCompact(incUni, "USD");
      elYo.textContent = fmtCompact(outUni, "USD");
      elYn.textContent = fmtCompact(incUni - outUni, "USD");
    }
  }
}

function renderSubs(root: HTMLElement) {
  const strip = root.querySelector<HTMLElement>("[data-et-subs-strip]");
  if (!strip) return;
  strip.innerHTML = "";
  const subs = state.subscriptions;
  if (!subs.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-500 dark:text-gray-400 px-1 py-6";
    empty.textContent = "Aún no hay suscripciones. Usa «Nueva suscripción» o toca aquí después de crearlas.";
    strip.appendChild(empty);
    return;
  }
  for (const s of subs) {
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.subId = s.id;
    card.className =
      "snap-start shrink-0 w-[min(100vw-2rem,17rem)] text-left rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-950 dark:to-gray-900/60 p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-md transition-all";
    const cat = state.categories.find((c) => c.id === s.categoryId);
    const stripe = cat?.color ?? "#6366f1";
    const monthly = subscriptionToMonthlyAmount(s);
    const cycleLabel =
      s.cycle === "weekly"
        ? "Semanal"
        : s.cycle === "monthly"
          ? "Mensual"
          : s.cycle === "quarterly"
            ? "Trimestral"
            : "Anual";

    const wrap = document.createElement("div");
    wrap.className = "flex items-start gap-3";
    const bar = document.createElement("span");
    bar.className = "mt-0.5 h-10 w-1.5 rounded-full shrink-0";
    bar.style.background = stripe;
    const col = document.createElement("div");
    col.className = "min-w-0 flex-1 space-y-1";
    const p0 = document.createElement("p");
    p0.className = "m-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
    p0.textContent = `${s.active ? "Activa" : "Pausada"} · ${cycleLabel}`;
    const p1 = document.createElement("p");
    p1.className = "m-0 text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50 truncate";
    p1.textContent = s.name;
    const p2 = document.createElement("p");
    p2.className = "m-0 text-lg font-bold text-indigo-700 dark:text-indigo-300 font-mono";
    p2.textContent = `${fmtMoney(s.amount, s.currency)} · ≈ ${fmtMoney(monthly, s.currency)}/mes`;
    const p3 = document.createElement("p");
    p3.className = "m-0 text-xs text-gray-500 dark:text-gray-400 line-clamp-2";
    const nextIso = subscriptionNextChargeIso(s);
    const from = s.billingStartDate?.trim();
    const parts: string[] = [];
    if (from) parts.push(`Desde ${from.slice(0, 10)}`);
    if (nextIso) parts.push(`Próximo cobro: ${nextIso}`);
    if (!parts.length) parts.push("Indica la fecha de inicio para calcular el próximo cobro");
    p3.textContent = parts.join(" · ");
    col.append(p0, p1, p2, p3);
    if (s.tags?.length) {
      const p4 = document.createElement("p");
      p4.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400 truncate";
      p4.textContent = s.tags.slice(0, 6).join(" · ");
      col.appendChild(p4);
    }
    wrap.append(bar, col);
    card.appendChild(wrap);
    if (!s.active) card.classList.add("opacity-60");
    strip.appendChild(card);
  }
}

function fillCategorySelect(sel: HTMLSelectElement) {
  sel.innerHTML = "";
  const byId = new Map(state.categories.map((c) => [c.id, c] as const));
  const childrenOf = (pid: string) =>
    state.categories.filter((c) => c.parentId === pid).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const roots = state.categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name, "es"));

  for (const r of roots) {
    const kids = childrenOf(r.id);
    if (!kids.length) {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.name;
      sel.appendChild(o);
    } else {
      const og = document.createElement("optgroup");
      og.label = r.name;
      const gen = document.createElement("option");
      gen.value = r.id;
      gen.textContent = `${r.name} (general)`;
      og.appendChild(gen);
      for (const k of kids) {
        const o = document.createElement("option");
        o.value = k.id;
        o.textContent = k.name;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
  }
  for (const c of state.categories) {
    if (c.parentId && !byId.has(c.parentId)) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = formatCategoryPath(state, c.id);
      sel.appendChild(o);
    }
  }
}

type ExpenseFocusSnap = { expenseId: string; field: string; start?: number; end?: number };

function readExpenseFocusSnap(): ExpenseFocusSnap | null {
  const a = document.activeElement;
  if (!a || !(a instanceof HTMLElement)) return null;
  const id = a.dataset.etExpId;
  const field = a.dataset.etExpField;
  if (!id || !field) return null;
  let start: number | undefined;
  let end: number | undefined;
  if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) {
    start = a.selectionStart ?? undefined;
    end = a.selectionEnd ?? undefined;
  }
  return { expenseId: id, field, start: start ?? undefined, end: end ?? undefined };
}

function restoreExpenseFocusSnap(root: HTMLElement, snap: ExpenseFocusSnap) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const el = root.querySelector<HTMLElement>(
    `[data-et-exp-id="${esc(snap.expenseId)}"][data-et-exp-field="${esc(snap.field)}"]`,
  );
  if (!el) return;
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (snap.start != null && snap.end != null) {
      try {
        el.setSelectionRange(snap.start, snap.end);
      } catch {
        /* ignore */
      }
    }
  }
}

function refreshExpenseTableAndMoney(root: HTMLElement) {
  renderExpenseTable(root);
  refreshMoneyViews(root);
}

function defaultFilterMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readExpenseTableFilter(root: HTMLElement): { month: string; day: string } {
  const m = root.querySelector<HTMLInputElement>("[data-et-exp-filter-month]")?.value?.slice(0, 7) ?? "";
  const day = root.querySelector<HTMLSelectElement>("[data-et-exp-filter-day]")?.value ?? "";
  const month = /^\d{4}-\d{2}$/.test(m) ? m : defaultFilterMonthValue();
  return { month, day };
}

function readIncomeTableFilter(root: HTMLElement): { month: string; day: string } {
  const m = root.querySelector<HTMLInputElement>("[data-et-inc-filter-month]")?.value?.slice(0, 7) ?? "";
  const day = root.querySelector<HTMLSelectElement>("[data-et-inc-filter-day]")?.value ?? "";
  const month = /^\d{4}-\d{2}$/.test(m) ? m : defaultFilterMonthValue();
  return { month, day };
}

function dateMatchesMonthDayFilter(dateIso: string, month: string, day: string): boolean {
  if (!dateIso || dateIso.length < 7) return false;
  if (!dateIso.startsWith(month)) return false;
  if (!day) return true;
  const d = Number(day);
  if (!Number.isFinite(d) || d < 1 || d > 31) return true;
  const suf = String(d).padStart(2, "0");
  return dateIso.slice(0, 10) === `${month}-${suf}`;
}

function ensureMonthFilterInputs(root: HTMLElement) {
  const exp = root.querySelector<HTMLInputElement>("[data-et-exp-filter-month]");
  if (exp && !exp.value) exp.value = defaultFilterMonthValue();
  const inc = root.querySelector<HTMLInputElement>("[data-et-inc-filter-month]");
  if (inc && !inc.value) inc.value = defaultFilterMonthValue();
}

/** Fecha inicial de una fila nueva: hoy si cae en el mes visible; si no, día 1 de ese mes. */
function initialDateForVisibleTableMonth(
  root: HTMLElement,
  readFilter: (r: HTMLElement) => { month: string; day: string },
): string {
  const today = todayIso();
  const { month } = readFilter(root);
  return today.startsWith(month) ? today : `${month}-01`;
}

function renderExpenseTable(root: HTMLElement) {
  const body = root.querySelector<HTMLElement>("[data-et-expenses-body]");
  if (!body) return;
  body.innerHTML = "";
  const { month, day } = readExpenseTableFilter(root);
  const rows = [...state.expenses]
    .filter((e) => dateMatchesMonthDayFilter(e.date, month, day))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const row of rows) {
    const tr = document.createElement("tr");
    const booked = row.confirmed !== false;
    tr.className = booked
      ? "align-top bg-gradient-to-r from-rose-500/14 via-orange-500/10 to-transparent dark:from-rose-950/50 dark:via-orange-950/35 dark:to-transparent hover:from-rose-500/20 dark:hover:from-rose-950/60"
      : "align-top bg-slate-950/80 dark:bg-slate-950/90 ring-2 ring-cyan-400/55 ring-inset shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)] hover:ring-cyan-300/70";
    tr.dataset.expenseId = row.id;

    const tdDate = document.createElement("td");
    tdDate.className = "px-2 py-1.5";
    const inDate = document.createElement("input");
    inDate.type = "date";
    inDate.value = row.date;
    inDate.className = `${ET_FIELD_MONO} min-w-[7rem] py-1.5`;
    inDate.dataset.etExpId = row.id;
    inDate.dataset.etExpField = "date";
    inDate.addEventListener("change", () => patchExpense(row.id, { date: inDate.value }, "date"));
    tdDate.appendChild(inDate);

    const tdLabel = document.createElement("td");
    tdLabel.className = "px-2 py-1.5";
    const inLabel = document.createElement("input");
    inLabel.type = "text";
    inLabel.value = row.label;
    inLabel.className = `${ET_FIELD} min-w-[8rem] py-1.5`;
    inLabel.dataset.etExpId = row.id;
    inLabel.dataset.etExpField = "label";
    inLabel.addEventListener("change", () => patchExpense(row.id, { label: inLabel.value }, "label"));
    tdLabel.appendChild(inLabel);

    const tdAmt = document.createElement("td");
    tdAmt.className = "px-2 py-1.5";
    const inAmt = document.createElement("input");
    inAmt.type = "number";
    inAmt.step = "0.01";
    inAmt.min = "0";
    inAmt.value = String(row.amount);
    inAmt.className = `${ET_FIELD_MONO} py-1.5`;
    inAmt.dataset.etExpId = row.id;
    inAmt.dataset.etExpField = "amount";
    inAmt.addEventListener("change", () => patchExpense(row.id, { amount: Number(inAmt.value) || 0 }, "amount"));
    tdAmt.appendChild(inAmt);

    const tdCur = document.createElement("td");
    tdCur.className = "px-2 py-1.5";
    const selCur = document.createElement("select");
    selCur.className = `${ET_FIELD_MONO} py-1.5`;
    selCur.dataset.etExpId = row.id;
    selCur.dataset.etExpField = "currency";
    for (const c of ["EUR", "USD"] as const) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      if (row.currency === c) o.selected = true;
      selCur.appendChild(o);
    }
    selCur.addEventListener("change", () => patchExpense(row.id, { currency: selCur.value as "EUR" | "USD" }, "currency"));

    const tdCat = document.createElement("td");
    tdCat.className = "px-2 py-1.5";
    const selCat = document.createElement("select");
    selCat.className = `${ET_FIELD} min-w-[8rem] py-1.5`;
    selCat.dataset.etExpId = row.id;
    selCat.dataset.etExpField = "category";
    fillCategorySelect(selCat);
    selCat.value = row.categoryId;
    selCat.addEventListener("change", () => patchExpense(row.id, { categoryId: selCat.value }, "category"));

    const tdTags = document.createElement("td");
    tdTags.className = "px-2 py-1.5";
    const inTags = document.createElement("input");
    inTags.type = "text";
    inTags.value = row.tags.join(", ");
    inTags.placeholder = "tag1, tag2";
    inTags.className = `${ET_FIELD} py-1.5`;
    inTags.dataset.etExpId = row.id;
    inTags.dataset.etExpField = "tags";
    inTags.addEventListener("change", () => {
      const tags = parseTags(inTags.value);
      patchExpense(row.id, { tags }, "tags");
      pushTagBankFrom(tags);
    });

    const tdAtt = document.createElement("td");
    tdAtt.className = "px-2 py-1.5 space-y-1";
    const attWrap = document.createElement("div");
    attWrap.className = "flex flex-col gap-1 max-w-[14rem]";
    for (const a of row.attachments) {
      const rowL = document.createElement("div");
      rowL.className = "flex items-center gap-1 min-w-0";
      const link = document.createElement("a");
      link.href = a.url;
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      link.className = "text-xs font-medium text-indigo-600 dark:text-indigo-300 truncate hover:underline";
      link.textContent = a.title || "enlace";
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "×";
      rm.className = "shrink-0 text-xs text-gray-500 hover:text-red-600 cursor-pointer";
      rm.addEventListener("click", async () => {
        if (!(await showConfirmDialog(root, "¿Quitar este enlace del gasto?", "Quitar"))) return;
        patchExpense(row.id, { attachments: row.attachments.filter((x) => x.id !== a.id) });
      });
      rowL.append(link, rm);
      attWrap.appendChild(rowL);
    }
    const addL = document.createElement("button");
    addL.type = "button";
    addL.textContent = "+ HTTPS";
    addL.className =
      "text-xs font-semibold rounded border border-dashed border-gray-300 dark:border-gray-600 px-2 py-0.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900";
    addL.addEventListener("click", async () => {
      const res = await showLinkDialog(root);
      if (!res) return;
      const url = normalizeHttpsUrl(res.url);
      if (!url) {
        await showAlertDialog(root, "La URL debe empezar por https://");
        return;
      }
      const att: ExpenseAttachment = { id: makeId(), title: res.title.trim() || "Enlace", url };
      patchExpense(row.id, { attachments: [...row.attachments, att] });
    });
    attWrap.appendChild(addL);
    tdAtt.appendChild(attWrap);

    const tdNotes = document.createElement("td");
    tdNotes.className = "px-2 py-1.5";
    const inNotes = document.createElement("input");
    inNotes.type = "text";
    inNotes.value = row.notes;
    inNotes.placeholder = "…";
    inNotes.className = `${ET_FIELD} py-1.5`;
    inNotes.dataset.etExpId = row.id;
    inNotes.dataset.etExpField = "notes";
    inNotes.addEventListener("change", () => patchExpense(row.id, { notes: inNotes.value }, "notes"));

    const tdState = document.createElement("td");
    tdState.className = "px-2 py-1.5 align-middle";
    if (booked) {
      const badge = document.createElement("span");
      badge.className =
        "inline-flex items-center rounded-full border border-rose-200/90 dark:border-rose-800/70 bg-rose-50/90 dark:bg-rose-950/40 px-2 py-0.5 text-[11px] font-semibold text-rose-800 dark:text-rose-200";
      badge.textContent = "Confirmado";
      tdState.appendChild(badge);
    } else {
      const conf = document.createElement("button");
      conf.type = "button";
      conf.textContent = "Confirmar";
      conf.className =
        "rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer";
      conf.addEventListener("click", () => patchExpense(row.id, { confirmed: true }, "label"));
      tdState.appendChild(conf);
    }

    const tdDel = document.createElement("td");
    tdDel.className = "px-2 py-1.5 text-right";
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Quitar";
    del.className =
      "rounded-md border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 px-2 py-1 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer";
    del.addEventListener("click", async () => {
      if (!(await showConfirmDialog(root, "¿Seguro que quieres quitar este gasto?", "Quitar"))) return;
      removeExpense(row.id);
    });

    tdCur.appendChild(selCur);
    tdCat.appendChild(selCat);
    tdDel.appendChild(del);
    tr.append(tdDate, tdLabel, tdAmt, tdCur, tdCat, tdTags, tdAtt, tdNotes, tdState, tdDel);
    body.appendChild(tr);
  }
}

type IncomeFocusSnap = { incomeId: string; field: string; start?: number; end?: number };

function readIncomeFocusSnap(): IncomeFocusSnap | null {
  const a = document.activeElement;
  if (!a || !(a instanceof HTMLElement)) return null;
  const id = a.dataset.etIncId;
  const field = a.dataset.etIncField;
  if (!id || !field) return null;
  let start: number | undefined;
  let end: number | undefined;
  if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) {
    start = a.selectionStart ?? undefined;
    end = a.selectionEnd ?? undefined;
  }
  return { incomeId: id, field, start: start ?? undefined, end: end ?? undefined };
}

function restoreIncomeFocusSnap(root: HTMLElement, snap: IncomeFocusSnap) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const el = root.querySelector<HTMLElement>(
    `[data-et-inc-id="${esc(snap.incomeId)}"][data-et-inc-field="${esc(snap.field)}"]`,
  );
  if (!el) return;
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (snap.start != null && snap.end != null) {
      try {
        el.setSelectionRange(snap.start, snap.end);
      } catch {
        /* ignore */
      }
    }
  }
}

function refreshIncomeTableAndMoney(root: HTMLElement) {
  renderIncomeTable(root);
  refreshMoneyViews(root);
}

function renderIncomeTable(root: HTMLElement) {
  const body = root.querySelector<HTMLElement>("[data-et-income-body]");
  if (!body) return;
  body.innerHTML = "";
  const { month, day } = readIncomeTableFilter(root);
  const list = state.incomeAdhoc ?? [];
  const rows = [...list]
    .filter((e) => dateMatchesMonthDayFilter(e.date, month, day))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const row of rows) {
    const tr = document.createElement("tr");
    const booked = row.confirmed !== false;
    tr.className = booked
      ? "align-top bg-gradient-to-r from-emerald-500/16 via-teal-500/10 to-transparent dark:from-emerald-950/45 dark:via-teal-950/30 dark:to-transparent hover:from-emerald-500/22 dark:hover:from-emerald-950/55"
      : "align-top bg-slate-950/80 dark:bg-slate-950/90 ring-2 ring-cyan-400/55 ring-inset shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)] hover:ring-cyan-300/70";
    tr.dataset.incomeRowId = row.id;

    const tdDate = document.createElement("td");
    tdDate.className = "px-2 py-1.5";
    const inDate = document.createElement("input");
    inDate.type = "date";
    inDate.value = row.date;
    inDate.className = `${ET_FIELD_MONO} min-w-[7rem] py-1.5`;
    inDate.dataset.etIncId = row.id;
    inDate.dataset.etIncField = "date";
    inDate.addEventListener("change", () => patchIncome(row.id, { date: inDate.value }, "date"));
    tdDate.appendChild(inDate);

    const tdLabel = document.createElement("td");
    tdLabel.className = "px-2 py-1.5";
    const inLabel = document.createElement("input");
    inLabel.type = "text";
    inLabel.value = row.label;
    inLabel.className = `${ET_FIELD} min-w-[8rem] py-1.5`;
    inLabel.dataset.etIncId = row.id;
    inLabel.dataset.etIncField = "label";
    inLabel.addEventListener("change", () => patchIncome(row.id, { label: inLabel.value }, "label"));
    tdLabel.appendChild(inLabel);

    const tdAmt = document.createElement("td");
    tdAmt.className = "px-2 py-1.5";
    const inAmt = document.createElement("input");
    inAmt.type = "number";
    inAmt.step = "0.01";
    inAmt.min = "0";
    inAmt.value = String(row.amount);
    inAmt.className = `${ET_FIELD_MONO} py-1.5`;
    inAmt.dataset.etIncId = row.id;
    inAmt.dataset.etIncField = "amount";
    inAmt.addEventListener("change", () => patchIncome(row.id, { amount: Number(inAmt.value) || 0 }, "amount"));
    tdAmt.appendChild(inAmt);

    const tdCur = document.createElement("td");
    tdCur.className = "px-2 py-1.5";
    const selCur = document.createElement("select");
    selCur.className = `${ET_FIELD_MONO} py-1.5`;
    selCur.dataset.etIncId = row.id;
    selCur.dataset.etIncField = "currency";
    for (const c of ["EUR", "USD"] as const) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      if (row.currency === c) o.selected = true;
      selCur.appendChild(o);
    }
    selCur.addEventListener("change", () => patchIncome(row.id, { currency: selCur.value as "EUR" | "USD" }, "currency"));

    const tdCat = document.createElement("td");
    tdCat.className = "px-2 py-1.5";
    const selCat = document.createElement("select");
    selCat.className = `${ET_FIELD} min-w-[8rem] py-1.5`;
    selCat.dataset.etIncId = row.id;
    selCat.dataset.etIncField = "category";
    fillCategorySelect(selCat);
    selCat.value = row.categoryId;
    selCat.addEventListener("change", () => patchIncome(row.id, { categoryId: selCat.value }, "category"));

    const tags = row.tags ?? [];
    const tdTags = document.createElement("td");
    tdTags.className = "px-2 py-1.5";
    const inTags = document.createElement("input");
    inTags.type = "text";
    inTags.value = tags.join(", ");
    inTags.placeholder = "tag1, tag2";
    inTags.className = `${ET_FIELD} py-1.5`;
    inTags.dataset.etIncId = row.id;
    inTags.dataset.etIncField = "tags";
    inTags.addEventListener("change", () => {
      const t = parseTags(inTags.value);
      patchIncome(row.id, { tags: t }, "tags");
      pushTagBankFrom(t);
    });

    const atts = row.attachments ?? [];
    const tdAtt = document.createElement("td");
    tdAtt.className = "px-2 py-1.5 space-y-1";
    const attWrap = document.createElement("div");
    attWrap.className = "flex flex-col gap-1 max-w-[14rem]";
    for (const a of atts) {
      const rowL = document.createElement("div");
      rowL.className = "flex items-center gap-1 min-w-0";
      const link = document.createElement("a");
      link.href = a.url;
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      link.className = "text-xs font-medium text-indigo-600 dark:text-indigo-300 truncate hover:underline";
      link.textContent = a.title || "enlace";
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "×";
      rm.className = "shrink-0 text-xs text-gray-500 hover:text-red-600 cursor-pointer";
      rm.addEventListener("click", async () => {
        if (!(await showConfirmDialog(root, "¿Quitar este enlace del ingreso?", "Quitar"))) return;
        patchIncome(row.id, { attachments: atts.filter((x) => x.id !== a.id) });
      });
      rowL.append(link, rm);
      attWrap.appendChild(rowL);
    }
    const addL = document.createElement("button");
    addL.type = "button";
    addL.textContent = "+ HTTPS";
    addL.className =
      "text-xs font-semibold rounded border border-dashed border-gray-300 dark:border-gray-600 px-2 py-0.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900";
    addL.addEventListener("click", async () => {
      const res = await showLinkDialog(root);
      if (!res) return;
      const url = normalizeHttpsUrl(res.url);
      if (!url) {
        await showAlertDialog(root, "La URL debe empezar por https://");
        return;
      }
      const att: ExpenseAttachment = { id: makeId(), title: res.title.trim() || "Enlace", url };
      patchIncome(row.id, { attachments: [...atts, att] });
    });
    attWrap.appendChild(addL);
    tdAtt.appendChild(attWrap);

    const tdNotes = document.createElement("td");
    tdNotes.className = "px-2 py-1.5";
    const inNotes = document.createElement("input");
    inNotes.type = "text";
    inNotes.value = row.notes ?? "";
    inNotes.placeholder = "…";
    inNotes.className = `${ET_FIELD} py-1.5`;
    inNotes.dataset.etIncId = row.id;
    inNotes.dataset.etIncField = "notes";
    inNotes.addEventListener("change", () => patchIncome(row.id, { notes: inNotes.value }, "notes"));

    const tdState = document.createElement("td");
    tdState.className = "px-2 py-1.5 align-middle";
    if (booked) {
      const badge = document.createElement("span");
      badge.className =
        "inline-flex items-center rounded-full border border-emerald-200/90 dark:border-emerald-800/70 bg-emerald-50/90 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-100";
      badge.textContent = "Confirmado";
      tdState.appendChild(badge);
    } else {
      const conf = document.createElement("button");
      conf.type = "button";
      conf.textContent = "Confirmar";
      conf.className =
        "rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer";
      conf.addEventListener("click", () => patchIncome(row.id, { confirmed: true }, "label"));
      tdState.appendChild(conf);
    }

    const tdDel = document.createElement("td");
    tdDel.className = "px-2 py-1.5 text-right";
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Quitar";
    del.className =
      "rounded-md border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 px-2 py-1 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer";
    del.addEventListener("click", async () => {
      if (!(await showConfirmDialog(root, "¿Seguro que quieres quitar este ingreso?", "Quitar"))) return;
      removeIncome(row.id);
    });

    tdCur.appendChild(selCur);
    tdCat.appendChild(selCat);
    tdDel.appendChild(del);
    tr.append(tdDate, tdLabel, tdAmt, tdCur, tdCat, tdTags, tdAtt, tdNotes, tdState, tdDel);
    body.appendChild(tr);
  }
}

function patchIncome(id: string, patch: Partial<IncomeAdhocRow>, refocusField?: string) {
  const list = [...(state.incomeAdhoc ?? [])];
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const prev = list[idx]!;
  list[idx] = {
    ...prev,
    ...patch,
    tags: patch.tags ?? prev.tags ?? [],
    attachments: patch.attachments ?? prev.attachments ?? [],
  };
  state.incomeAdhoc = list;
  if (patch.tags) pushTagBankFrom(patch.tags);
  const root = document.querySelector<HTMLElement>("[data-tools-expense-page]");
  if (!root) {
    persist();
    return;
  }
  const snap: IncomeFocusSnap | null = refocusField ? { incomeId: id, field: refocusField } : readIncomeFocusSnap();
  persist();
  refreshIncomeTableAndMoney(root);
  if (snap?.incomeId === id) {
    queueMicrotask(() => restoreIncomeFocusSnap(root, snap));
  }
}

function removeIncome(id: string) {
  state.incomeAdhoc = (state.incomeAdhoc ?? []).filter((e) => e.id !== id);
  persist();
  const root = document.querySelector<HTMLElement>("[data-tools-expense-page]");
  if (root) refreshIncomeTableAndMoney(root);
}

function addIncome() {
  const root = document.querySelector<HTMLElement>("[data-tools-expense-page]");
  const cat = state.categories[0]?.id ?? "cat_other";
  const id = makeId();
  const row: IncomeAdhocRow = {
    id,
    date: root ? initialDateForVisibleTableMonth(root, readIncomeTableFilter) : todayIso(),
    label: "Nuevo ingreso",
    amount: 0,
    currency: "EUR",
    categoryId: cat,
    notes: "",
    tags: [],
    attachments: [],
    confirmed: false,
  };
  state.incomeAdhoc = [...(state.incomeAdhoc ?? []), row].slice(0, 500);
  if (!root) {
    persist();
    return;
  }
  persist();
  refreshIncomeTableAndMoney(root);
  queueMicrotask(() => {
    const el = root.querySelector<HTMLInputElement>(`[data-et-inc-id="${id}"][data-et-inc-field="label"]`);
    el?.focus();
    el?.select();
  });
}

function patchExpense(id: string, patch: Partial<ExpenseRow>, refocusField?: string) {
  const idx = state.expenses.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const prev = state.expenses[idx]!;
  state.expenses[idx] = {
    ...prev,
    ...patch,
    tags: patch.tags ?? prev.tags ?? [],
    attachments: patch.attachments ?? prev.attachments ?? [],
  };
  if (patch.tags) pushTagBankFrom(patch.tags);
  const root = document.querySelector<HTMLElement>("[data-tools-expense-page]");
  if (!root) {
    persist();
    return;
  }
  const snap: ExpenseFocusSnap | null = refocusField ? { expenseId: id, field: refocusField } : readExpenseFocusSnap();
  persist();
  refreshExpenseTableAndMoney(root);
  if (snap?.expenseId === id) {
    queueMicrotask(() => restoreExpenseFocusSnap(root, snap));
  }
}

function removeExpense(id: string) {
  state.expenses = state.expenses.filter((e) => e.id !== id);
  persist();
  renderAll(document.querySelector<HTMLElement>("[data-tools-expense-page]")!);
}

function addExpense() {
  const root = document.querySelector<HTMLElement>("[data-tools-expense-page]");
  const cat = state.categories[0]?.id ?? "cat_other";
  const id = makeId();
  state.expenses.push({
    id,
    date: root ? initialDateForVisibleTableMonth(root, readExpenseTableFilter) : todayIso(),
    label: "Nuevo gasto",
    amount: 0,
    currency: "EUR",
    categoryId: cat,
    notes: "",
    tags: [],
    attachments: [],
    confirmed: false,
  });
  if (!root) {
    persist();
    return;
  }
  persist();
  refreshExpenseTableAndMoney(root);
  queueMicrotask(() => {
    const el = root.querySelector<HTMLInputElement>(`[data-et-exp-id="${id}"][data-et-exp-field="label"]`);
    el?.focus();
    el?.select();
  });
}

function renderReminders(root: HTMLElement) {
  const ul = root.querySelector<HTMLElement>("[data-et-reminders-list]");
  if (!ul) return;
  ul.innerHTML = "";
  const sorted = [...state.reminders].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const r of sorted) {
    const li = document.createElement("li");
    li.className =
      "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 px-3 py-2";
    const left = document.createElement("div");
    left.className = "min-w-0 space-y-0.5";
    const t1 = document.createElement("p");
    t1.className = "m-0 text-sm font-semibold text-gray-900 dark:text-gray-50";
    t1.textContent = r.title;
    const t2 = document.createElement("p");
    t2.className = "m-0 text-xs text-gray-500 dark:text-gray-400";
    t2.textContent = `${r.date}${r.notifyBrowser ? " · notificar" : ""}${r.note ? ` — ${r.note}` : ""}`;
    left.append(t1, t2);
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Eliminar";
    del.className = "text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer";
    del.addEventListener("click", async () => {
      if (!(await showConfirmDialog(root, "¿Seguro que quieres eliminar este recordatorio?", "Eliminar"))) return;
      state.reminders = state.reminders.filter((x) => x.id !== r.id);
      persist();
      renderAll(root);
    });
    li.append(left, del);
    ul.appendChild(li);
  }
}

function addReminderFromForm(root: HTMLElement) {
  const d = root.querySelector<HTMLInputElement>("[data-et-reminder-date]")?.value?.slice(0, 10);
  const title = root.querySelector<HTMLInputElement>("[data-et-reminder-title]")?.value?.trim();
  const note = root.querySelector<HTMLInputElement>("[data-et-reminder-note]")?.value?.trim() ?? "";
  const notify = root.querySelector<HTMLInputElement>("[data-et-reminder-notify]")?.checked ?? false;
  if (!d || !title) return;
  state.reminders.push({ id: makeId(), title, date: d, note, notifyBrowser: notify });
  persist();
  root.querySelector<HTMLInputElement>("[data-et-reminder-title]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-reminder-note]")!.value = "";
  renderAll(root);
}

function renderReminderBanner(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-et-remind-banner]");
  if (!el) return;
  const due = remindersDueToday(state);
  if (!due.length) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  el.textContent = `Hoy: ${due.map((r) => r.title).join(" · ")}`;
}

function refreshMoneyViews(root: HTMLElement) {
  renderKpis(root);
  renderCharts(root);
}

function flashBrowserReminders(root: HTMLElement) {
  renderReminderBanner(root);
  if (typeof Notification === "undefined") return;
  const due = remindersDueToday(state).filter((r) => r.notifyBrowser);
  if (!due.length) return;
  if (Notification.permission !== "granted") return;
  for (const r of due) {
    const key = `skillatlas_et_notified_${r.id}_${r.date}`;
    try {
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
      new Notification(r.title, { body: r.note || "Recordatorio SkillAtlas", silent: false });
    } catch {
      // ignore
    }
  }
}

function syncChartCategoryFilterSelect(root: HTMLElement): boolean {
  const sel = root.querySelector<HTMLSelectElement>("[data-et-chart-cat-filter]");
  if (!sel) return false;
  let cleared = false;
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "Todas las categorías";
  sel.appendChild(o0);
  const sorted = [...state.categories].sort((a, b) =>
    formatCategoryPath(state, a.id).localeCompare(formatCategoryPath(state, b.id), "es"),
  );
  for (const c of sorted) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = formatCategoryPath(state, c.id);
    sel.appendChild(o);
  }
  if (state.chartFilterCategoryId && !state.categories.some((c) => c.id === state.chartFilterCategoryId)) {
    state.chartFilterCategoryId = "";
    cleared = true;
  }
  sel.value = state.chartFilterCategoryId;
  return cleared;
}

function upsertPaycheckMonthOverride(paycheckId: string, month: string, amount: number, currency: "EUR" | "USD") {
  const list = [...(state.incomeMonthOverrides ?? [])];
  const i = list.findIndex((o) => o.paycheckId === paycheckId && o.month === month);
  if (!Number.isFinite(amount) || amount <= 0) {
    if (i >= 0) list.splice(i, 1);
  } else if (i >= 0) {
    const prev = list[i]!;
    list[i] = { ...prev, amount, currency };
  } else {
    list.push({ id: makeId(), paycheckId, month, amount, currency });
  }
  state.incomeMonthOverrides = list.slice(0, 400);
}

function bindPaycheckInlineEditors(root: HTMLElement) {
  if (root.dataset.etPcEdBound === "1") return;
  root.dataset.etPcEdBound = "1";
  root.addEventListener("change", (ev) => {
    const el = ev.target as HTMLSelectElement;
    if (el?.dataset?.etPcSel !== "currency") return;
    const pid = el.dataset.etPcId;
    if (!pid) return;
    const idx = state.paychecks.findIndex((x) => x.id === pid);
    if (idx < 0) return;
    const cur = state.paychecks[idx]!;
    const v = el.value === "USD" ? "USD" : "EUR";
    state.paychecks[idx] = { ...cur, currency: v };
    persist();
    refreshMoneyViews(root);
  });
  root.addEventListener(
    "blur",
    (ev) => {
      const el = ev.target as HTMLInputElement;
      if (!el) return;
      if (el.dataset.etPcOv === "1") {
        const pid = el.dataset.etPcId;
        if (!pid) return;
        const sel = root.querySelector<HTMLSelectElement>(`select[data-et-pc-ov-sel="1"][data-et-pc-id="${pid}"]`);
        const month = sel?.value ?? el.dataset.etPcMonth;
        const cur = (el.dataset.etPcCur as "EUR" | "USD") || "EUR";
        if (!month) return;
        upsertPaycheckMonthOverride(pid, month, Number(el.value), cur);
        persist();
        refreshMoneyViews(root);
        return;
      }
      if (!el.dataset.etPcField) return;
      const pid = el.dataset.etPcId;
      if (!pid) return;
      const idx = state.paychecks.findIndex((x) => x.id === pid);
      if (idx < 0) return;
      const cur = state.paychecks[idx]!;
      const f = el.dataset.etPcField as keyof PaycheckEntry;
      let patch: Partial<PaycheckEntry> = {};
      if (f === "title") patch.title = el.value.trim() || cur.title;
      else if (f === "typicalAmount") patch.typicalAmount = Math.max(0, Number(el.value) || 0);
      else if (f === "amountMin") patch.amountMin = el.value === "" ? undefined : Math.max(0, Number(el.value) || 0);
      else if (f === "amountMax") patch.amountMax = el.value === "" ? undefined : Math.max(0, Number(el.value) || 0);
      else if (f === "validFrom") patch.validFrom = el.value.length === 10 ? el.value : undefined;
      else if (f === "validUntil") patch.validUntil = el.value.length === 10 ? el.value : undefined;
      else if (f === "dayOfMonth") {
        const d = Math.min(31, Math.max(1, Math.floor(Number(el.value) || 1)));
        patch.dayOfMonth = d;
      } else if (f === "windowBefore") {
        patch.windowBefore =
          el.value === "" ? undefined : Math.min(15, Math.max(0, Math.floor(Number(el.value) || 0)));
      } else if (f === "note") patch.note = el.value.trim() || undefined;
      state.paychecks[idx] = { ...cur, ...patch };
      persist();
      refreshMoneyViews(root);
    },
    true,
  );
}

function upsertPlannedMonthOverride(plannedExpenseId: string, month: string, amount: number, currency: "EUR" | "USD") {
  const list = [...(state.plannedExpenseMonthOverrides ?? [])];
  const i = list.findIndex((o) => o.plannedExpenseId === plannedExpenseId && o.month === month);
  if (!Number.isFinite(amount) || amount <= 0) {
    if (i >= 0) list.splice(i, 1);
  } else if (i >= 0) {
    const prev = list[i]!;
    list[i] = { ...prev, amount, currency };
  } else {
    list.push({ id: makeId(), plannedExpenseId, month, amount, currency });
  }
  state.plannedExpenseMonthOverrides = list.slice(0, 400);
}

function bindPlannedInlineEditors(root: HTMLElement) {
  if (root.dataset.etPrEdBound === "1") return;
  root.dataset.etPrEdBound = "1";
  root.addEventListener("change", (ev) => {
    const el = ev.target as HTMLSelectElement;
    if (el?.dataset?.etPrSel === "currency") {
      const pid = el.dataset.etPrId;
      if (!pid) return;
      const idx = (state.plannedExpenses ?? []).findIndex((x) => x.id === pid);
      if (idx < 0) return;
      const cur = state.plannedExpenses[idx]!;
      state.plannedExpenses[idx] = { ...cur, currency: el.value === "USD" ? "USD" : "EUR" };
      persist();
      refreshMoneyViews(root);
      return;
    }
    if (el?.dataset?.etPrSel === "category") {
      const pid = el.dataset.etPrId;
      if (!pid) return;
      const idx = (state.plannedExpenses ?? []).findIndex((x) => x.id === pid);
      if (idx < 0) return;
      const cur = state.plannedExpenses[idx]!;
      state.plannedExpenses[idx] = { ...cur, categoryId: el.value };
      persist();
      refreshMoneyViews(root);
    }
  });
  root.addEventListener(
    "blur",
    (ev) => {
      const el = ev.target as HTMLInputElement;
      if (!el) return;
      if (el.dataset.etPrOv === "1") {
        const pid = el.dataset.etPrId;
        if (!pid) return;
        const sel = root.querySelector<HTMLSelectElement>(`select[data-et-pr-ov-sel="1"][data-et-pr-id="${pid}"]`);
        const month = sel?.value ?? el.dataset.etPrMonth;
        const curC = (el.dataset.etPrCur as "EUR" | "USD") || "EUR";
        if (!month) return;
        upsertPlannedMonthOverride(pid, month, Number(el.value), curC);
        persist();
        refreshMoneyViews(root);
        return;
      }
      if (!el.dataset.etPrField) return;
      const pid = el.dataset.etPrId;
      if (!pid) return;
      const idx = (state.plannedExpenses ?? []).findIndex((x) => x.id === pid);
      if (idx < 0) return;
      const cur = state.plannedExpenses[idx]!;
      const f = el.dataset.etPrField as keyof PlannedExpenseEntry;
      let patch: Partial<PlannedExpenseEntry> = {};
      if (f === "title") patch.title = el.value.trim() || cur.title;
      else if (f === "typicalAmount") patch.typicalAmount = Math.max(0, Number(el.value) || 0);
      else if (f === "amountMin") patch.amountMin = el.value === "" ? undefined : Math.max(0, Number(el.value) || 0);
      else if (f === "amountMax") patch.amountMax = el.value === "" ? undefined : Math.max(0, Number(el.value) || 0);
      else if (f === "validFrom") patch.validFrom = el.value.length === 10 ? el.value : undefined;
      else if (f === "validUntil") patch.validUntil = el.value.length === 10 ? el.value : undefined;
      else if (f === "dayOfMonth") {
        patch.dayOfMonth = Math.min(31, Math.max(1, Math.floor(Number(el.value) || 1)));
      } else if (f === "windowBefore") {
        patch.windowBefore =
          el.value === "" ? undefined : Math.min(15, Math.max(0, Math.floor(Number(el.value) || 0)));
      } else if (f === "note") patch.note = el.value.trim() || undefined;
      state.plannedExpenses[idx] = { ...cur, ...patch };
      persist();
      refreshMoneyViews(root);
    },
    true,
  );
}

function renderPaychecks(root: HTMLElement) {
  const wrap = root.querySelector<HTMLElement>("[data-et-paychecks-list]");
  if (!wrap) return;
  wrap.innerHTML = "";
  const list = state.paychecks ?? [];
  const curMonth = new Date().toISOString().slice(0, 7);
  const monthChoices = rollingMonthKeys(24);
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 py-2 col-span-full";
    empty.textContent = "Aún no hay cobros previstos. Rellena el formulario y pulsa Añadir.";
    wrap.appendChild(empty);
    return;
  }
  for (const p of list) {
    const card = document.createElement("article");
    card.className =
      "rounded-xl border border-teal-200/70 dark:border-teal-900/50 bg-white/90 dark:bg-gray-950/70 p-2.5 sm:p-3 shadow-sm space-y-2 min-w-0 w-full";
    const head = document.createElement("div");
    head.className = "flex items-center justify-between gap-2 flex-wrap";
    const titleInp = document.createElement("input");
    titleInp.type = "text";
    titleInp.value = p.title;
    titleInp.className = `${ET_FIELD} text-sm font-semibold text-gray-900 dark:text-gray-50`;
    titleInp.dataset.etPcField = "title";
    titleInp.dataset.etPcId = p.id;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Quitar";
    del.className =
      "text-xs font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0 cursor-pointer";
    del.addEventListener("click", async () => {
      if (!(await showConfirmDialog(root, "¿Seguro? Se eliminará el cobro previsto y sus ajustes por mes.", "Quitar")))
        return;
      state.paychecks = (state.paychecks ?? []).filter((x) => x.id !== p.id);
      state.incomeMonthOverrides = (state.incomeMonthOverrides ?? []).filter((o) => o.paycheckId !== p.id);
      persist();
      renderAll(root);
    });
    head.append(titleInp, del);

    const grid = document.createElement("div");
    grid.className =
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-2 gap-y-1.5 text-[11px] leading-tight";

    const addNum = (label: string, field: keyof PaycheckEntry, val: number | undefined, step: string) => {
      const lab = document.createElement("label");
      lab.className = "space-y-0.5 min-w-0";
      const sp = document.createElement("span");
      sp.className = "font-semibold text-gray-500 dark:text-gray-400 text-[11px]";
      sp.textContent = label;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = step;
      inp.min = "0";
      inp.value = val != null && Number.isFinite(val) ? String(val) : "";
      inp.className = `${ET_FIELD_MONO} text-xs py-1`;
      inp.dataset.etPcField = String(field);
      inp.dataset.etPcId = p.id;
      lab.append(sp, inp);
      grid.appendChild(lab);
    };

    addNum("Importe habitual", "typicalAmount", p.typicalAmount, "0.01");
    const labCur = document.createElement("label");
    labCur.className = "space-y-0.5";
    const labCurSpan = document.createElement("span");
    labCurSpan.className = "font-semibold text-gray-500 dark:text-gray-400 text-[11px]";
    labCurSpan.textContent = "Moneda";
    const sel = document.createElement("select");
    sel.className = `${ET_FIELD} text-xs py-1`;
    sel.dataset.etPcSel = "currency";
    sel.dataset.etPcId = p.id;
    for (const c of ["EUR", "USD"] as const) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      if ((p.currency ?? "EUR") === c) o.selected = true;
      sel.appendChild(o);
    }
    labCur.append(labCurSpan, sel);

    addNum("Mín.", "amountMin", p.amountMin, "0.01");
    addNum("Máx.", "amountMax", p.amountMax, "0.01");

    const labDay = document.createElement("label");
    labDay.className = "space-y-0.5";
    labDay.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Día mes</span>`;
    const inDay = document.createElement("input");
    inDay.type = "number";
    inDay.min = "1";
    inDay.max = "31";
    inDay.value = String(p.dayOfMonth);
    inDay.className = `${ET_FIELD_MONO} text-xs py-1`;
    inDay.dataset.etPcField = "dayOfMonth";
    inDay.dataset.etPcId = p.id;
    labDay.appendChild(inDay);

    const labWin = document.createElement("label");
    labWin.className = "space-y-0.5";
    labWin.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Ventana</span>`;
    const inWin = document.createElement("input");
    inWin.type = "number";
    inWin.min = "0";
    inWin.max = "15";
    inWin.value = p.windowBefore != null ? String(p.windowBefore) : "";
    inWin.className = `${ET_FIELD_MONO} text-xs py-1`;
    inWin.dataset.etPcField = "windowBefore";
    inWin.dataset.etPcId = p.id;
    labWin.appendChild(inWin);

    const labFrom = document.createElement("label");
    labFrom.className = "space-y-0.5 col-span-2 sm:col-span-1";
    labFrom.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Desde</span>`;
    const inFrom = document.createElement("input");
    inFrom.type = "date";
    inFrom.value = (p.validFrom || "").slice(0, 10);
    inFrom.className = `${ET_FIELD_MONO} text-xs py-1`;
    inFrom.dataset.etPcField = "validFrom";
    inFrom.dataset.etPcId = p.id;
    labFrom.appendChild(inFrom);

    const labUntil = document.createElement("label");
    labUntil.className = "space-y-0.5 col-span-2 sm:col-span-1";
    labUntil.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Hasta</span>`;
    const inUntil = document.createElement("input");
    inUntil.type = "date";
    inUntil.value = (p.validUntil || "").slice(0, 10);
    inUntil.className = `${ET_FIELD_MONO} text-xs py-1`;
    inUntil.dataset.etPcField = "validUntil";
    inUntil.dataset.etPcId = p.id;
    labUntil.appendChild(inUntil);

    grid.append(labCur, labDay, labWin, labFrom, labUntil);

    const noteLab = document.createElement("label");
    noteLab.className = "block space-y-0.5 col-span-full";
    noteLab.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400 text-xs">Nota</span>`;
    const noteIn = document.createElement("input");
    noteIn.type = "text";
    noteIn.value = p.note ?? "";
    noteIn.className = `${ET_FIELD} py-1 text-xs`;
    noteIn.dataset.etPcField = "note";
    noteIn.dataset.etPcId = p.id;
    noteLab.appendChild(noteIn);

    const ovLab = document.createElement("div");
    ovLab.className =
      "flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-teal-300/80 dark:border-teal-800/60 px-2 py-1.5 bg-teal-50/50 dark:bg-teal-950/20";
    const selM = document.createElement("select");
    selM.className = `${ET_FIELD} text-xs py-1 min-w-[8rem]`;
    selM.dataset.etPcOvSel = "1";
    selM.dataset.etPcId = p.id;
    for (const mk of monthChoices) {
      const o = document.createElement("option");
      o.value = mk;
      o.textContent = mk;
      selM.appendChild(o);
    }
    selM.value = monthChoices.includes(curMonth) ? curMonth : monthChoices[0]!;
    const ovIn = document.createElement("input");
    ovIn.type = "number";
    ovIn.step = "0.01";
    ovIn.min = "0";
    ovIn.placeholder = "Ajuste mes";
    ovIn.className = `${ET_FIELD_MONO} text-xs py-1 w-24`;
    ovIn.dataset.etPcOv = "1";
    ovIn.dataset.etPcId = p.id;
    const syncOvFromMonth = () => {
      const mk = selM.value;
      const hit = state.incomeMonthOverrides?.find((o) => o.paycheckId === p.id && o.month === mk);
      ovIn.value = hit ? String(hit.amount) : "";
      ovIn.dataset.etPcCur = hit?.currency ?? p.currency ?? "EUR";
    };
    selM.addEventListener("change", syncOvFromMonth);
    syncOvFromMonth();
    const ovCap = document.createElement("span");
    ovCap.className = "text-[10px] font-semibold text-teal-900 dark:text-teal-100 w-full sm:w-auto";
    ovCap.textContent = "Ajuste por mes";
    ovLab.append(ovCap, selM, ovIn);

    const hint = document.createElement("p");
    hint.className = "m-0 text-[10px] text-gray-500 dark:text-gray-400 leading-snug";
    const rng =
      p.amountMin != null || p.amountMax != null
        ? `Rango orientativo: ${p.amountMin ?? "—"} … ${p.amountMax ?? "—"} ${p.currency ?? "EUR"}. `
        : "";
    hint.textContent =
      `${rng}Elige mes e importe; al salir del campo se guarda (vacío = quitar ajuste). Desde/Hasta del cobro limitan en qué meses cuenta.`;

    card.append(head, grid, noteLab, ovLab, hint);
    wrap.appendChild(card);
  }
}

function addPaycheckFromForm(root: HTMLElement) {
  const title = root.querySelector<HTMLInputElement>("[data-et-paycheck-title]")?.value?.trim() ?? "";
  const dayRaw = Number(root.querySelector<HTMLInputElement>("[data-et-paycheck-day]")?.value);
  const winRaw = root.querySelector<HTMLInputElement>("[data-et-paycheck-window]")?.value;
  const note = root.querySelector<HTMLInputElement>("[data-et-paycheck-note]")?.value?.trim() ?? "";
  const amt = Number(root.querySelector<HTMLInputElement>("[data-et-paycheck-amount]")?.value);
  const curRaw = root.querySelector<HTMLSelectElement>("[data-et-paycheck-currency]")?.value;
  const minV = root.querySelector<HTMLInputElement>("[data-et-paycheck-min]")?.value;
  const maxV = root.querySelector<HTMLInputElement>("[data-et-paycheck-max]")?.value;
  const from = root.querySelector<HTMLInputElement>("[data-et-paycheck-from]")?.value?.slice(0, 10) ?? "";
  const until = root.querySelector<HTMLInputElement>("[data-et-paycheck-until]")?.value?.slice(0, 10) ?? "";
  if (!title) return;
  const dayOfMonth = Number.isFinite(dayRaw) ? Math.min(31, Math.max(1, Math.floor(dayRaw))) : 1;
  let windowBefore: number | undefined;
  if (winRaw != null && winRaw !== "") {
    const w = Number(winRaw);
    if (Number.isFinite(w)) windowBefore = Math.min(15, Math.max(0, Math.floor(w)));
  }
  const row: PaycheckEntry = {
    id: makeId(),
    title,
    dayOfMonth,
    windowBefore,
    note: note || undefined,
    typicalAmount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
    currency: curRaw === "USD" ? "USD" : "EUR",
    amountMin:
      minV != null && minV !== "" && Number.isFinite(Number(minV)) ? Math.max(0, Number(minV)) : undefined,
    amountMax:
      maxV != null && maxV !== "" && Number.isFinite(Number(maxV)) ? Math.max(0, Number(maxV)) : undefined,
    validFrom: from.length === 10 ? from : undefined,
    validUntil: until.length === 10 ? until : undefined,
  };
  state.paychecks = [...(state.paychecks ?? []), row].slice(0, 24);
  persist();
  root.querySelector<HTMLInputElement>("[data-et-paycheck-title]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-paycheck-note]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-paycheck-amount]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-paycheck-min]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-paycheck-max]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-paycheck-from]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-paycheck-until]")!.value = "";
  renderAll(root);
}

function renderPlannedExpenses(root: HTMLElement) {
  const wrap = root.querySelector<HTMLElement>("[data-et-planned-list]");
  if (!wrap) return;
  wrap.innerHTML = "";
  const list = state.plannedExpenses ?? [];
  const curMonth = new Date().toISOString().slice(0, 7);
  const monthChoices = rollingMonthKeys(24);
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 py-2 col-span-full";
    empty.textContent = "Aún no hay gastos previstos. Rellena el formulario y pulsa Añadir.";
    wrap.appendChild(empty);
    return;
  }
  for (const p of list) {
    const card = document.createElement("article");
    card.className =
      "rounded-xl border border-rose-200/70 dark:border-rose-900/50 bg-white/90 dark:bg-gray-950/70 p-2.5 sm:p-3 shadow-sm space-y-2 min-w-0 w-full";
    const head = document.createElement("div");
    head.className = "flex items-center justify-between gap-2 flex-wrap";
    const titleInp = document.createElement("input");
    titleInp.type = "text";
    titleInp.value = p.title;
    titleInp.className = `${ET_FIELD} text-sm font-semibold text-gray-900 dark:text-gray-50`;
    titleInp.dataset.etPrField = "title";
    titleInp.dataset.etPrId = p.id;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Quitar";
    del.className =
      "text-xs font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0 cursor-pointer";
    del.addEventListener("click", async () => {
      if (
        !(await showConfirmDialog(root, "¿Seguro? Se eliminará el gasto previsto y sus ajustes por mes.", "Quitar"))
      )
        return;
      state.plannedExpenses = (state.plannedExpenses ?? []).filter((x) => x.id !== p.id);
      state.plannedExpenseMonthOverrides = (state.plannedExpenseMonthOverrides ?? []).filter(
        (o) => o.plannedExpenseId !== p.id,
      );
      persist();
      renderAll(root);
    });
    head.append(titleInp, del);

    const grid = document.createElement("div");
    grid.className =
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-2 gap-y-1.5 text-[11px] leading-tight";

    const addNum = (label: string, field: keyof PlannedExpenseEntry, val: number | undefined, step: string) => {
      if (field === "categoryId") return;
      const lab = document.createElement("label");
      lab.className = "space-y-0.5 min-w-0";
      const sp = document.createElement("span");
      sp.className = "font-semibold text-gray-500 dark:text-gray-400 text-[11px]";
      sp.textContent = label;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = step;
      inp.min = "0";
      inp.value = val != null && Number.isFinite(val) ? String(val) : "";
      inp.className = `${ET_FIELD_MONO} text-xs py-1`;
      inp.dataset.etPrField = String(field);
      inp.dataset.etPrId = p.id;
      lab.append(sp, inp);
      grid.appendChild(lab);
    };

    addNum("Importe habitual", "typicalAmount", p.typicalAmount, "0.01");
    const labCur = document.createElement("label");
    labCur.className = "space-y-0.5";
    const labCurSpan = document.createElement("span");
    labCurSpan.className = "font-semibold text-gray-500 dark:text-gray-400 text-[11px]";
    labCurSpan.textContent = "Moneda";
    const sel = document.createElement("select");
    sel.className = `${ET_FIELD} text-xs py-1`;
    sel.dataset.etPrSel = "currency";
    sel.dataset.etPrId = p.id;
    for (const c of ["EUR", "USD"] as const) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      if ((p.currency ?? "EUR") === c) o.selected = true;
      sel.appendChild(o);
    }
    labCur.append(labCurSpan, sel);

    const labCat = document.createElement("label");
    labCat.className = "space-y-0.5 col-span-full sm:col-span-2 lg:col-span-3";
    const labCatSp = document.createElement("span");
    labCatSp.className = "font-semibold text-gray-500 dark:text-gray-400 text-[11px]";
    labCatSp.textContent = "Categoría";
    const selCat = document.createElement("select");
    selCat.className = `${ET_FIELD} text-xs py-1`;
    selCat.dataset.etPrSel = "category";
    selCat.dataset.etPrId = p.id;
    fillCategorySelect(selCat);
    selCat.value = p.categoryId;
    labCat.append(labCatSp, selCat);

    addNum("Mín.", "amountMin", p.amountMin, "0.01");
    addNum("Máx.", "amountMax", p.amountMax, "0.01");

    const labDay = document.createElement("label");
    labDay.className = "space-y-0.5";
    labDay.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Día mes</span>`;
    const inDay = document.createElement("input");
    inDay.type = "number";
    inDay.min = "1";
    inDay.max = "31";
    inDay.value = String(p.dayOfMonth);
    inDay.className = `${ET_FIELD_MONO} text-xs py-1`;
    inDay.dataset.etPrField = "dayOfMonth";
    inDay.dataset.etPrId = p.id;
    labDay.appendChild(inDay);

    const labWin = document.createElement("label");
    labWin.className = "space-y-0.5";
    labWin.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Ventana</span>`;
    const inWin = document.createElement("input");
    inWin.type = "number";
    inWin.min = "0";
    inWin.max = "15";
    inWin.value = p.windowBefore != null ? String(p.windowBefore) : "";
    inWin.className = `${ET_FIELD_MONO} text-xs py-1`;
    inWin.dataset.etPrField = "windowBefore";
    inWin.dataset.etPrId = p.id;
    labWin.appendChild(inWin);

    const labFrom = document.createElement("label");
    labFrom.className = "space-y-0.5 col-span-2 sm:col-span-1";
    labFrom.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Desde</span>`;
    const inFrom = document.createElement("input");
    inFrom.type = "date";
    inFrom.value = (p.validFrom || "").slice(0, 10);
    inFrom.className = `${ET_FIELD_MONO} text-xs py-1`;
    inFrom.dataset.etPrField = "validFrom";
    inFrom.dataset.etPrId = p.id;
    labFrom.appendChild(inFrom);

    const labUntil = document.createElement("label");
    labUntil.className = "space-y-0.5 col-span-2 sm:col-span-1";
    labUntil.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400">Hasta</span>`;
    const inUntil = document.createElement("input");
    inUntil.type = "date";
    inUntil.value = (p.validUntil || "").slice(0, 10);
    inUntil.className = `${ET_FIELD_MONO} text-xs py-1`;
    inUntil.dataset.etPrField = "validUntil";
    inUntil.dataset.etPrId = p.id;
    labUntil.appendChild(inUntil);

    grid.append(labCur, labCat, labDay, labWin, labFrom, labUntil);

    const noteLab = document.createElement("label");
    noteLab.className = "block space-y-0.5 col-span-full";
    noteLab.innerHTML = `<span class="font-semibold text-gray-500 dark:text-gray-400 text-xs">Nota</span>`;
    const noteIn = document.createElement("input");
    noteIn.type = "text";
    noteIn.value = p.note ?? "";
    noteIn.className = `${ET_FIELD} py-1 text-xs`;
    noteIn.dataset.etPrField = "note";
    noteIn.dataset.etPrId = p.id;
    noteLab.appendChild(noteIn);

    const ovLab = document.createElement("div");
    ovLab.className =
      "flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-rose-300/80 dark:border-rose-800/60 px-2 py-1.5 bg-rose-50/50 dark:bg-rose-950/20";
    const selM = document.createElement("select");
    selM.className = `${ET_FIELD} text-xs py-1 min-w-[8rem]`;
    selM.dataset.etPrOvSel = "1";
    selM.dataset.etPrId = p.id;
    for (const mk of monthChoices) {
      const o = document.createElement("option");
      o.value = mk;
      o.textContent = mk;
      selM.appendChild(o);
    }
    selM.value = monthChoices.includes(curMonth) ? curMonth : monthChoices[0]!;
    const ovIn = document.createElement("input");
    ovIn.type = "number";
    ovIn.step = "0.01";
    ovIn.min = "0";
    ovIn.placeholder = "Ajuste mes";
    ovIn.className = `${ET_FIELD_MONO} text-xs py-1 w-24`;
    ovIn.dataset.etPrOv = "1";
    ovIn.dataset.etPrId = p.id;
    const syncPrOv = () => {
      const mk = selM.value;
      const hit = state.plannedExpenseMonthOverrides?.find((o) => o.plannedExpenseId === p.id && o.month === mk);
      ovIn.value = hit ? String(hit.amount) : "";
      ovIn.dataset.etPrCur = hit?.currency ?? p.currency ?? "EUR";
    };
    selM.addEventListener("change", syncPrOv);
    syncPrOv();
    const ovCap = document.createElement("span");
    ovCap.className = "text-[10px] font-semibold text-rose-900 dark:text-rose-100 w-full sm:w-auto";
    ovCap.textContent = "Ajuste por mes";
    ovLab.append(ovCap, selM, ovIn);

    const hint = document.createElement("p");
    hint.className = "m-0 text-[10px] text-gray-500 dark:text-gray-400 leading-snug";
    const rng =
      p.amountMin != null || p.amountMax != null
        ? `Rango orientativo: ${p.amountMin ?? "—"} … ${p.amountMax ?? "—"} ${p.currency ?? "EUR"}. `
        : "";
    hint.textContent =
      `${rng}Elige mes e importe; al salir del campo se guarda (vacío = quitar ajuste). Desde/Hasta del previsto limitan en qué meses cuenta.`;

    card.append(head, grid, noteLab, ovLab, hint);
    wrap.appendChild(card);
  }
}

function addPlannedFromForm(root: HTMLElement) {
  const title = root.querySelector<HTMLInputElement>("[data-et-planned-title]")?.value?.trim() ?? "";
  const dayRaw = Number(root.querySelector<HTMLInputElement>("[data-et-planned-day]")?.value);
  const winRaw = root.querySelector<HTMLInputElement>("[data-et-planned-window]")?.value;
  const note = root.querySelector<HTMLInputElement>("[data-et-planned-note]")?.value?.trim() ?? "";
  const amt = Number(root.querySelector<HTMLInputElement>("[data-et-planned-amount]")?.value);
  const curRaw = root.querySelector<HTMLSelectElement>("[data-et-planned-currency]")?.value;
  const catId = root.querySelector<HTMLSelectElement>("[data-et-planned-category]")?.value ?? state.categories[0]!.id;
  const minV = root.querySelector<HTMLInputElement>("[data-et-planned-min]")?.value;
  const maxV = root.querySelector<HTMLInputElement>("[data-et-planned-max]")?.value;
  const from = root.querySelector<HTMLInputElement>("[data-et-planned-from]")?.value?.slice(0, 10) ?? "";
  const until = root.querySelector<HTMLInputElement>("[data-et-planned-until]")?.value?.slice(0, 10) ?? "";
  if (!title) return;
  const dayOfMonth = Number.isFinite(dayRaw) ? Math.min(31, Math.max(1, Math.floor(dayRaw))) : 1;
  let windowBefore: number | undefined;
  if (winRaw != null && winRaw !== "") {
    const w = Number(winRaw);
    if (Number.isFinite(w)) windowBefore = Math.min(15, Math.max(0, Math.floor(w)));
  }
  const row: PlannedExpenseEntry = {
    id: makeId(),
    title,
    dayOfMonth,
    windowBefore,
    note: note || undefined,
    typicalAmount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
    currency: curRaw === "USD" ? "USD" : "EUR",
    categoryId: catId,
    amountMin:
      minV != null && minV !== "" && Number.isFinite(Number(minV)) ? Math.max(0, Number(minV)) : undefined,
    amountMax:
      maxV != null && maxV !== "" && Number.isFinite(Number(maxV)) ? Math.max(0, Number(maxV)) : undefined,
    validFrom: from.length === 10 ? from : undefined,
    validUntil: until.length === 10 ? until : undefined,
  };
  state.plannedExpenses = [...(state.plannedExpenses ?? []), row].slice(0, 24);
  persist();
  root.querySelector<HTMLInputElement>("[data-et-planned-title]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-planned-note]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-planned-amount]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-planned-min]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-planned-max]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-planned-from]")!.value = "";
  root.querySelector<HTMLInputElement>("[data-et-planned-until]")!.value = "";
  renderAll(root);
}

function tagTotalsForChart(
  expenses: ExpenseRow[],
  mode: ExpenseTrackerState["chartMoneyMode"],
  fx: number,
): { name: string; value: number }[] {
  const map = new Map<string, { eur: number; usd: number }>();
  for (const e of expenses) {
    const tags = e.tags.length ? e.tags : ["(sin etiqueta)"];
    const n = tags.length;
    const shareEur = e.currency === "EUR" ? Math.max(0, e.amount) / n : 0;
    const shareUsd = e.currency === "USD" ? Math.max(0, e.amount) / n : 0;
    for (const raw of tags) {
      const t = (raw || "").trim() || "(sin etiqueta)";
      const cur = map.get(t) ?? { eur: 0, usd: 0 };
      cur.eur += shareEur;
      cur.usd += shareUsd;
      map.set(t, cur);
    }
  }
  return [...map.entries()]
    .map(([name, { eur, usd }]) => {
      let value = 0;
      if (mode === "unify_eur") value = eur + convertAmount(usd, "USD", "EUR", fx);
      else if (mode === "unify_usd") value = usd + convertAmount(eur, "EUR", "USD", fx);
      else value = eur + usd;
      return { name, value: Math.round(value * 100) / 100 };
    })
    .sort((a, b) => a.value - b.value)
    .slice(-12);
}

function monthKeysRange(lo: string, hi: string): string[] {
  const out: string[] = [];
  let y = Number(lo.slice(0, 4));
  let m = Number(lo.slice(5, 7));
  const ty = Number(hi.slice(0, 4));
  const tm = Number(hi.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Últimos `count` meses calendario (actual primero), para ajustes por mes. */
function rollingMonthKeys(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  const y = d.getFullYear();
  const m0 = d.getMonth();
  for (let i = 0; i < count; i++) {
    const dt = new Date(y, m0 - i, 1);
    const yy = dt.getFullYear();
    const mm = dt.getMonth() + 1;
    out.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return out;
}

function naturalYearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

/** Misma lógica que el gráfico anual: gastos confirmados del año + burn + previstos vs ingresos. */
function buildNaturalYearOutInSeries(year: number): {
  months: string[];
  outEur: number[];
  outUsd: number[];
  outUni: number[];
  incEur: number[];
  incUsd: number[];
  incUni: number[];
} {
  const months = naturalYearMonthKeys(year);
  const prefix = String(year);
  const exYear = state.expenses.filter((e) => e.date.startsWith(prefix) && e.confirmed !== false);
  const mode = state.chartMoneyMode;
  const fx = state.eurPerUsd;
  const sparse = monthlyExpenseSeries(exYear, fx, mode, undefined);
  const padded = padExpenseSeriesToMonths(
    months,
    sparse.months,
    sparse.seriesEur,
    sparse.seriesUsd,
    sparse.seriesUnified,
  );
  const seriesEurPad = [...padded.seriesEur];
  const seriesUsdPad = [...padded.seriesUsd];
  let seriesUniPad = [...padded.seriesUnified];
  const burn = subscriptionMonthlyBurnByCurrency(state);
  const plannedSer = monthlyPlannedOutflowSeries(state, months, mode, fx);
  for (let i = 0; i < months.length; i++) {
    seriesEurPad[i] = (seriesEurPad[i] ?? 0) + burn.eur + (plannedSer.seriesEur[i] ?? 0);
    seriesUsdPad[i] = (seriesUsdPad[i] ?? 0) + burn.usd + (plannedSer.seriesUsd[i] ?? 0);
  }
  if (mode === "unify_eur") {
    seriesUniPad = months.map((_, i) =>
      (seriesEurPad[i] ?? 0) + convertAmount(seriesUsdPad[i] ?? 0, "USD", "EUR", fx),
    );
  } else if (mode === "unify_usd") {
    seriesUniPad = months.map((_, i) =>
      (seriesUsdPad[i] ?? 0) + convertAmount(seriesEurPad[i] ?? 0, "EUR", "USD", fx),
    );
  }
  const inc = monthlyIncomeSeries(state, months, mode, fx);
  return {
    months,
    outEur: seriesEurPad,
    outUsd: seriesUsdPad,
    outUni: seriesUniPad,
    incEur: [...inc.seriesEur],
    incUsd: [...inc.seriesUsd],
    incUni: [...inc.seriesUnified],
  };
}

/** Meses del eje X: período seleccionado + meses con datos (gastos / ingresos / cobros). */
function chartTimelineMonthKeys(): string[] {
  const endKey = new Date().toISOString().slice(0, 7);
  const keys = new Set<string>();
  const startIso = periodStartIso(state.period);
  if (startIso) {
    const startKey = startIso.slice(0, 7);
    for (const k of monthKeysRange(startKey, endKey)) keys.add(k);
  }
  const ex = filterExpensesByPeriod(state.expenses, state.period);
  for (const e of ex) keys.add(e.date.slice(0, 7));
  for (const row of state.incomeAdhoc ?? []) {
    if (row.confirmed === false) continue;
    if (!startIso || row.date >= startIso) keys.add(row.date.slice(0, 7));
  }
  for (const p of state.paychecks ?? []) {
    let lo = p.validFrom?.slice(0, 7);
    if (!lo) lo = startIso ? startIso.slice(0, 7) : "2000-01";
    let hi = p.validUntil?.slice(0, 7) ?? endKey;
    if (hi > endKey) hi = endKey;
    if (startIso) {
      const sk = startIso.slice(0, 7);
      if (lo < sk) lo = sk;
    }
    if (lo > hi) continue;
    for (const k of monthKeysRange(lo, hi)) {
      if (!startIso || k >= startIso.slice(0, 7)) keys.add(k);
    }
  }
  for (const p of state.plannedExpenses ?? []) {
    let lo = p.validFrom?.slice(0, 7);
    if (!lo) lo = startIso ? startIso.slice(0, 7) : "2000-01";
    let hi = p.validUntil?.slice(0, 7) ?? endKey;
    if (hi > endKey) hi = endKey;
    if (startIso) {
      const sk = startIso.slice(0, 7);
      if (lo < sk) lo = sk;
    }
    if (lo > hi) continue;
    for (const k of monthKeysRange(lo, hi)) {
      if (!startIso || k >= startIso.slice(0, 7)) keys.add(k);
    }
  }
  const sorted = [...keys].sort();
  if (sorted.length) return sorted;
  return [endKey];
}

function padExpenseSeriesToMonths(
  monthsFull: string[],
  monthsSparse: string[],
  seriesEur: number[],
  seriesUsd: number[],
  seriesUnified: number[],
): { seriesEur: number[]; seriesUsd: number[]; seriesUnified: number[] } {
  const idx = new Map(monthsSparse.map((m, i) => [m, i] as const));
  const pick = (arr: number[]) =>
    monthsFull.map((m) => {
      const j = idx.get(m);
      return j === undefined ? 0 : arr[j] ?? 0;
    });
  return { seriesEur: pick(seriesEur), seriesUsd: pick(seriesUsd), seriesUnified: pick(seriesUnified) };
}

function renderCharts(root: HTMLElement) {
  disposeCharts();
  const elLine = root.querySelector<HTMLElement>("[data-et-chart-line]");
  const elBar = root.querySelector<HTMLElement>("[data-et-chart-bar]");
  const elPieEur = root.querySelector<HTMLElement>("[data-et-chart-pie-eur]");
  const elPieUsd = root.querySelector<HTMLElement>("[data-et-chart-pie-usd]");
  const elTags = root.querySelector<HTMLElement>("[data-et-chart-tags]");
  const elDow = root.querySelector<HTMLElement>("[data-et-chart-dow]");
  const elBalance = root.querySelector<HTMLElement>("[data-et-chart-balance]");
  const rowPies = root.querySelector<HTMLElement>("[data-et-chart-pies-row]");
  if (!elLine || !elBar || !elPieEur || !elPieUsd) return;

  const ex = filterExpensesByPeriod(state.expenses, state.period);
  const chartFid = state.chartFilterCategoryId?.trim() || "";
  const exBooked = (e: ExpenseRow) => e.confirmed !== false;
  const exChart = chartFid
    ? ex.filter((e) => exBooked(e) && expenseMatchesChartCategoryFilter(state, e.categoryId, chartFid))
    : ex.filter(exBooked);
  const totals = buildCategoryTotals(state, ex.filter(exBooked));
  const catMeta = state.categories
    .filter((c) => !c.parentId)
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));

  const mode = state.chartMoneyMode;
  const fx = state.eurPerUsd;

  elPieEur.classList.toggle("hidden", mode === "unify_usd");
  elPieUsd.classList.toggle("hidden", mode === "unify_eur");
  rowPies?.classList.toggle("lg:grid-cols-1", mode !== "mixed");
  rowPies?.classList.toggle("lg:grid-cols-2", mode === "mixed");

  const filterLabel = chartFid ? formatCategoryPath(state, chartFid) : "";
  const monthsFull = chartTimelineMonthKeys();
  const expenseSparse = monthlyExpenseSeries(
    ex,
    fx,
    mode,
    chartFid ? { categoryFilterId: chartFid, state } : undefined,
  );
  const padded = padExpenseSeriesToMonths(
    monthsFull,
    expenseSparse.months,
    expenseSparse.seriesEur,
    expenseSparse.seriesUsd,
    expenseSparse.seriesUnified,
  );
  const seriesEurPad = [...padded.seriesEur];
  const seriesUsdPad = [...padded.seriesUsd];
  let seriesUnifiedPad = [...padded.seriesUnified];
  const burn = subscriptionMonthlyBurnByCurrency(state);
  const plannedSer = monthlyPlannedOutflowSeries(state, monthsFull, mode, fx);
  for (let i = 0; i < monthsFull.length; i++) {
    seriesEurPad[i] = (seriesEurPad[i] ?? 0) + burn.eur + (plannedSer.seriesEur[i] ?? 0);
    seriesUsdPad[i] = (seriesUsdPad[i] ?? 0) + burn.usd + (plannedSer.seriesUsd[i] ?? 0);
  }
  if (mode === "unify_eur") {
    seriesUnifiedPad = monthsFull.map((_, i) =>
      (seriesEurPad[i] ?? 0) + convertAmount(seriesUsdPad[i] ?? 0, "USD", "EUR", fx),
    );
  } else if (mode === "unify_usd") {
    seriesUnifiedPad = monthsFull.map((_, i) =>
      (seriesUsdPad[i] ?? 0) + convertAmount(seriesEurPad[i] ?? 0, "EUR", "USD", fx),
    );
  }
  const inc = monthlyIncomeSeries(state, monthsFull, mode, fx);

  const lineOpt: echarts.EChartsCoreOption = {
    title: {
      text: filterLabel
        ? `Salidas e ingresos por mes · ${filterLabel}`
        : "Salidas e ingresos por mes (gastos confirmados + suscripciones + previstos)",
      left: 0,
      top: 4,
      textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
    },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: textMuted() } },
    grid: { left: 48, right: 16, top: 44, bottom: 48 },
    xAxis: {
      type: "category",
      data: monthsFull,
      axisLabel: { color: textMuted(), rotate: monthsFull.length > 14 ? 32 : 0 },
    },
    yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
    series:
      mode === "mixed"
        ? [
            { name: "Salidas EUR", type: "line", smooth: true, data: seriesEurPad, itemStyle: { color: "#22c55e" } },
            { name: "Salidas USD", type: "line", smooth: true, data: seriesUsdPad, itemStyle: { color: "#38bdf8" } },
            {
              name: "Ingresos EUR",
              type: "line",
              smooth: true,
              data: inc.seriesEur,
              itemStyle: { color: "#a3e635" },
              lineStyle: { type: "dashed" },
            },
            {
              name: "Ingresos USD",
              type: "line",
              smooth: true,
              data: inc.seriesUsd,
              itemStyle: { color: "#fde047" },
              lineStyle: { type: "dashed" },
            },
          ]
        : [
            {
              name: mode === "unify_eur" ? "Salidas (€)" : "Salidas ($)",
              type: "line",
              smooth: true,
              areaStyle: { opacity: 0.1 },
              data: seriesUnifiedPad,
              itemStyle: { color: "#6366f1" },
            },
            {
              name: mode === "unify_eur" ? "Ingresos (€)" : "Ingresos ($)",
              type: "line",
              smooth: true,
              data: inc.seriesUnified,
              itemStyle: { color: "#34d399" },
              lineStyle: { type: "dashed" },
            },
          ],
  };
  const lineHasData = monthsFull.some(
    (_, i) =>
      seriesEurPad[i]! > 0 ||
      seriesUsdPad[i]! > 0 ||
      seriesUnifiedPad[i]! > 0 ||
      inc.seriesEur[i]! > 0 ||
      inc.seriesUsd[i]! > 0 ||
      inc.seriesUnified[i]! > 0,
  );
  pushChart(elLine, lineHasData ? lineOpt : { ...lineOpt, graphic: emptyGraphic("Sin datos en el período") });

  if (elBalance) {
    let balanceOpt: echarts.EChartsCoreOption;
    if (mode === "mixed") {
      const netE = monthsFull.map((_, i) => inc.seriesEur[i]! - seriesEurPad[i]!);
      const netU = monthsFull.map((_, i) => inc.seriesUsd[i]! - seriesUsdPad[i]!);
      balanceOpt = {
        title: {
          text: filterLabel ? `Balance mensual · ${filterLabel}` : "Balance mensual (ingresos − gastos)",
          left: 0,
          top: 4,
          textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
        },
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, textStyle: { color: textMuted() } },
        grid: { left: 48, right: 16, top: 44, bottom: 40 },
        xAxis: {
          type: "category",
          data: monthsFull,
          axisLabel: { color: textMuted(), rotate: monthsFull.length > 14 ? 32 : 0 },
        },
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
        series: [
          {
            name: "Neto EUR",
            type: "line",
            smooth: true,
            data: netE,
            areaStyle: { opacity: 0.12 },
            itemStyle: { color: "#22c55e" },
          },
          {
            name: "Neto USD",
            type: "line",
            smooth: true,
            data: netU,
            areaStyle: { opacity: 0.12 },
            itemStyle: { color: "#38bdf8" },
          },
        ],
      };
    } else {
      const net = monthsFull.map((_, i) => inc.seriesUnified[i]! - seriesUnifiedPad[i]!);
      const labelInc = mode === "unify_eur" ? "Ingresos (€)" : "Ingresos ($)";
      const labelExp = mode === "unify_eur" ? "Gastos (€)" : "Gastos ($)";
      const labelNet = mode === "unify_eur" ? "Neto (€)" : "Neto ($)";
      balanceOpt = {
        title: {
          text: filterLabel ? `Ingresos vs gastos · ${filterLabel}` : "Ingresos vs gastos y neto",
          left: 0,
          top: 4,
          textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
        },
        tooltip: {
          trigger: "axis",
          formatter: (params: unknown) => {
            const rows = Array.isArray(params) ? params : [params];
            if (!rows.length) return "";
            const ax = (rows[0] as { axisValue?: string }).axisValue ?? "";
            const lines = [ax];
            for (const r of rows as { seriesName?: string; value?: number; marker?: string }[]) {
              const v = Number(r.value);
              lines.push(`${r.marker ?? ""} ${r.seriesName ?? ""}: ${Number.isFinite(v) ? v.toFixed(0) : ""}`);
            }
            const i = monthsFull.indexOf(ax);
            if (i >= 0 && inc.seriesUnified[i]! > 0) {
              const rate = ((net[i]! / inc.seriesUnified[i]!) * 100).toFixed(1);
              lines.push(`Tasa ahorro (neto/ingreso): ${rate}%`);
            }
            return lines.join("<br/>");
          },
        },
        legend: { bottom: 0, textStyle: { color: textMuted() } },
        grid: { left: 48, right: 16, top: 44, bottom: 40 },
        xAxis: {
          type: "category",
          data: monthsFull,
          axisLabel: { color: textMuted(), rotate: monthsFull.length > 14 ? 32 : 0 },
        },
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
        series: [
          {
            name: labelInc,
            type: "bar",
            data: inc.seriesUnified,
            itemStyle: { color: "#34d399", borderRadius: [6, 6, 0, 0] },
          },
          {
            name: labelExp,
            type: "bar",
            data: seriesUnifiedPad,
            itemStyle: { color: "#fb923c", borderRadius: [6, 6, 0, 0] },
          },
          {
            name: labelNet,
            type: "line",
            smooth: true,
            data: net,
            itemStyle: { color: "#a855f7" },
            z: 10,
          },
        ],
      };
    }
    const balHas = monthsFull.some(
      (_, i) =>
        seriesUnifiedPad[i]! > 0 ||
        seriesEurPad[i]! > 0 ||
        seriesUsdPad[i]! > 0 ||
        inc.seriesUnified[i]! > 0 ||
        inc.seriesEur[i]! > 0 ||
        inc.seriesUsd[i]! > 0,
    );
    pushChart(elBalance, balHas ? balanceOpt : { ...balanceOpt, graphic: emptyGraphic("Sin ingresos ni gastos en el período") });
  }

  const catNames = catMeta.map((c) => c.name);
  if (mode === "mixed") {
    const eurData = catMeta.map((c) => totals[c.id]?.eurNative ?? 0);
    const usdData = catMeta.map((c) => totals[c.id]?.usdNative ?? 0);
    const barOpt: echarts.EChartsCoreOption = {
      title: {
        text: "Por categoría (EUR + USD)",
        left: 0,
        top: 4,
        textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
      },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { bottom: 0, textStyle: { color: textMuted() } },
      grid: { left: 120, right: 24, top: 44, bottom: 40 },
      xAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
      yAxis: { type: "category", data: catNames, axisLabel: { color: textMuted() } },
      series: [
        { name: "EUR", type: "bar", stack: "t", data: eurData, itemStyle: { color: "#34d399", borderRadius: [0, 4, 4, 0] } },
        { name: "USD", type: "bar", stack: "t", data: usdData, itemStyle: { color: "#60a5fa", borderRadius: [0, 4, 4, 0] } },
      ],
    };
    const sum = eurData.reduce((a, b) => a + b, 0) + usdData.reduce((a, b) => a + b, 0);
    pushChart(elBar, sum > 0 ? barOpt : { ...barOpt, graphic: emptyGraphic("Añade gastos o suscripciones") });
  } else {
    const data = catMeta.map((c) => totals[c.id]?.unified ?? 0);
    const barOpt: echarts.EChartsCoreOption = {
      title: {
        text: mode === "unify_eur" ? "Por categoría (€)" : "Por categoría ($)",
        left: 0,
        top: 4,
        textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
      },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 120, right: 24, top: 44, bottom: 16 },
      xAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
      yAxis: { type: "category", data: catNames, axisLabel: { color: textMuted() } },
      series: [
        {
          type: "bar",
          data: data.map((v, i) => ({ value: v, itemStyle: { color: catMeta[i]!.color } })),
          itemStyle: { borderRadius: [0, 6, 6, 0] },
        },
      ],
    };
    const sum = data.reduce((a, b) => a + b, 0);
    pushChart(elBar, sum > 0 ? barOpt : { ...barOpt, graphic: emptyGraphic("Añade datos o revisa el tipo de cambio") });
  }

  const pieFrom = (el: HTMLElement, title: string, data: { name: string; value: number; itemStyle: { color: string } }[]) => {
    const sum = data.reduce((a, b) => a + b.value, 0);
    const opt: echarts.EChartsCoreOption = {
      title: { text: title, left: "center", top: 6, textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() } },
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      series: [
        {
          type: "pie",
          radius: ["42%", "68%"],
          center: ["50%", "54%"],
          data,
          label: { color: textMuted(), fontSize: 11 },
          itemStyle: { borderColor: isDark() ? "#020617" : "#fff", borderWidth: 2 },
        },
      ],
    };
    pushChart(el, sum > 0 ? opt : { ...opt, graphic: emptyGraphic("Sin importes en esta moneda") });
  };

  if (mode === "mixed") {
    const dataEur = catMeta
      .map((c) => {
        const t = totals[c.id];
        const v = (t?.eurNative ?? 0) + convertAmount(t?.usdNative ?? 0, "USD", "EUR", fx);
        return { name: c.name, value: Math.round(v * 100) / 100, itemStyle: { color: c.color } };
      })
      .filter((d) => d.value > 0);
    const dataUsd = catMeta
      .map((c) => {
        const t = totals[c.id];
        const v = (t?.usdNative ?? 0) + convertAmount(t?.eurNative ?? 0, "EUR", "USD", fx);
        return { name: c.name, value: Math.round(v * 100) / 100, itemStyle: { color: c.color } };
      })
      .filter((d) => d.value > 0);
    pieFrom(elPieEur, "Mixto · equivalente € por categoría", dataEur);
    pieFrom(elPieUsd, "Mixto · equivalente $ por categoría", dataUsd);
  } else if (mode === "unify_eur") {
    const data = catMeta
      .map((c) => ({
        name: c.name,
        value: Math.round((totals[c.id]?.unified ?? 0) * 100) / 100,
        itemStyle: { color: c.color },
      }))
      .filter((d) => d.value > 0);
    pieFrom(elPieEur, "Distribución (€)", data);
    elPieUsd.innerHTML = "";
  } else {
    const data = catMeta
      .map((c) => ({
        name: c.name,
        value: Math.round((totals[c.id]?.unified ?? 0) * 100) / 100,
        itemStyle: { color: c.color },
      }))
      .filter((d) => d.value > 0);
    pieFrom(elPieUsd, "Distribución ($)", data);
    elPieEur.innerHTML = "";
  }

  if (elTags) {
    const tagRows = tagTotalsForChart(exChart, mode, fx);
    const tagsOpt: echarts.EChartsCoreOption = {
      title: {
        text: chartFid ? "Etiquetas (categoría filtrada)" : "Top etiquetas (reparto si hay varias en un gasto)",
        left: 0,
        top: 4,
        textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
      },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true },
      xAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
      yAxis: {
        type: "category",
        data: tagRows.map((r) => r.name),
        axisLabel: { color: textMuted(), width: 110, overflow: "truncate" },
        inverse: true,
      },
      series: [
        {
          type: "bar",
          data: tagRows.map((r) => r.value),
          itemStyle: { color: "#818cf8", borderRadius: [0, 4, 4, 0] },
        },
      ],
    };
    pushChart(elTags, tagRows.length ? tagsOpt : { ...tagsOpt, graphic: emptyGraphic("Sin datos en el período") });
  }

  if (elDow) {
    const dlabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const eurD = new Array(7).fill(0) as number[];
    const usdD = new Array(7).fill(0) as number[];
    const uniD = new Array(7).fill(0) as number[];
    for (const e of exChart) {
      const wd = new Date(`${e.date}T12:00:00`).getDay();
      const a = Math.max(0, e.amount);
      if (mode === "mixed") {
        if (e.currency === "EUR") eurD[wd] += a;
        else usdD[wd] += a;
      } else if (mode === "unify_eur") {
        uniD[wd] += e.currency === "EUR" ? a : convertAmount(a, "USD", "EUR", fx);
      } else {
        uniD[wd] += e.currency === "USD" ? a : convertAmount(a, "EUR", "USD", fx);
      }
    }
    let dowOpt: echarts.EChartsCoreOption;
    if (mode === "mixed") {
      dowOpt = {
        title: {
          text: chartFid ? "Por día de semana (filtrado)" : "Por día de la semana",
          left: 0,
          top: 4,
          textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
        },
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, textStyle: { color: textMuted() } },
        grid: { left: 36, right: 12, top: 44, bottom: 40 },
        xAxis: { type: "category", data: dlabels, axisLabel: { color: textMuted() } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
        series: [
          { name: "EUR", type: "bar", data: eurD, itemStyle: { color: "#34d399" } },
          { name: "USD", type: "bar", data: usdD, itemStyle: { color: "#60a5fa" } },
        ],
      };
    } else {
      dowOpt = {
        title: {
          text:
            (chartFid ? "Por día de semana (filtrado) · " : "Por día de la semana · ") +
            (mode === "unify_eur" ? "€" : "$"),
          left: 0,
          top: 4,
          textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
        },
        tooltip: { trigger: "axis" },
        grid: { left: 36, right: 12, top: 44, bottom: 8 },
        xAxis: { type: "category", data: dlabels, axisLabel: { color: textMuted() } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
        series: [{ type: "bar", data: uniD, itemStyle: { color: "#6366f1" } }],
      };
    }
    const dowSum =
      mode === "mixed"
        ? eurD.reduce((x, y) => x + y, 0) + usdD.reduce((x, y) => x + y, 0)
        : uniD.reduce((x, y) => x + y, 0);
    pushChart(elDow, dowSum > 0 ? dowOpt : { ...dowOpt, graphic: emptyGraphic("Sin datos en el período") });
  }

  const elYearProj = root.querySelector<HTMLElement>("[data-et-chart-year-proj]");
  if (elYearProj) {
    const year = new Date().getFullYear();
    const ys = buildNaturalYearOutInSeries(year);
    const monthsY = ys.months;
    const monthShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthLabels = monthsY.map((m) => {
      const mo = Number(m.slice(5, 7));
      return monthShort[mo - 1] ?? m;
    });
    const yearHas = monthsY.some(
      (_, i) =>
        (ys.outEur[i] ?? 0) > 0 ||
        (ys.outUsd[i] ?? 0) > 0 ||
        (ys.outUni[i] ?? 0) > 0 ||
        (ys.incEur[i] ?? 0) > 0 ||
        (ys.incUsd[i] ?? 0) > 0 ||
        (ys.incUni[i] ?? 0) > 0,
    );
    let yearOpt: echarts.EChartsCoreOption;
    if (mode === "mixed") {
      yearOpt = {
        title: {
          text: `Proyección ${year} (salidas e ingresos por mes; sin filtro de categoría)`,
          left: 0,
          top: 4,
          textStyle: { fontSize: 12, fontWeight: 600, color: textPrimary() },
        },
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, textStyle: { color: textMuted() } },
        grid: { left: 48, right: 16, top: 48, bottom: 48 },
        xAxis: { type: "category", data: monthLabels, axisLabel: { color: textMuted() } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
        series: [
          { name: "Salidas EUR", type: "line", smooth: true, data: ys.outEur, itemStyle: { color: "#fb7185" } },
          { name: "Salidas USD", type: "line", smooth: true, data: ys.outUsd, itemStyle: { color: "#f97316" } },
          {
            name: "Ingresos EUR",
            type: "line",
            smooth: true,
            data: ys.incEur,
            itemStyle: { color: "#a3e635" },
            lineStyle: { type: "dashed" },
          },
          {
            name: "Ingresos USD",
            type: "line",
            smooth: true,
            data: ys.incUsd,
            itemStyle: { color: "#fde047" },
            lineStyle: { type: "dashed" },
          },
        ],
      };
    } else {
      yearOpt = {
        title: {
          text: `Proyección ${year} (${mode === "unify_eur" ? "todo en €" : "todo en $"})`,
          left: 0,
          top: 4,
          textStyle: { fontSize: 12, fontWeight: 600, color: textPrimary() },
        },
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, textStyle: { color: textMuted() } },
        grid: { left: 48, right: 16, top: 48, bottom: 48 },
        xAxis: { type: "category", data: monthLabels, axisLabel: { color: textMuted() } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted() } },
        series: [
          {
            name: mode === "unify_eur" ? "Salidas (€)" : "Salidas ($)",
            type: "line",
            smooth: true,
            areaStyle: { opacity: 0.1 },
            data: ys.outUni,
            itemStyle: { color: "#818cf8" },
          },
          {
            name: mode === "unify_eur" ? "Ingresos (€)" : "Ingresos ($)",
            type: "line",
            smooth: true,
            data: ys.incUni,
            itemStyle: { color: "#34d399" },
            lineStyle: { type: "dashed" },
          },
        ],
      };
    }
    pushChart(elYearProj, yearHas ? yearOpt : { ...yearOpt, graphic: emptyGraphic(`Sin datos para ${year}`) });
  }

  resizeObserver = new ResizeObserver(() => {
    for (const c of chartInstances) c.resize();
  });
  [elLine, elBar, elBalance, elPieEur, elPieUsd, elTags, elDow, elYearProj].forEach((el) => el && resizeObserver!.observe(el));
}

function emptyGraphic(text: string) {
  return {
    type: "text",
    left: "center",
    top: "middle",
    style: { text, fill: textMuted(), fontSize: 13 },
  };
}

function openSubDialog(root: HTMLElement, sub: SubscriptionRow | null) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]");
  const title = root.querySelector<HTMLElement>("[data-et-sub-dialog-title]");
  const idEl = root.querySelector<HTMLInputElement>("[data-et-sub-id]");
  const nameEl = root.querySelector<HTMLInputElement>("[data-et-sub-name]");
  const amountEl = root.querySelector<HTMLInputElement>("[data-et-sub-amount]");
  const curEl = root.querySelector<HTMLSelectElement>("[data-et-sub-currency]");
  const cycleEl = root.querySelector<HTMLSelectElement>("[data-et-sub-cycle]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-sub-category]");
  const billEl = root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]");
  const activeEl = root.querySelector<HTMLInputElement>("[data-et-sub-active]");
  const tagsEl = root.querySelector<HTMLInputElement>("[data-et-sub-tags]");
  const notesEl = root.querySelector<HTMLTextAreaElement>("[data-et-sub-notes]");
  const delBtn = root.querySelector<HTMLButtonElement>("[data-et-sub-delete]");
  if (!dlg || !title || !idEl || !nameEl || !amountEl || !curEl || !cycleEl || !catEl || !billEl || !activeEl || !tagsEl || !notesEl || !delBtn) return;

  editingSubId = sub?.id ?? null;
  title.textContent = sub ? "Editar suscripción" : "Nueva suscripción";
  idEl.value = sub?.id ?? "";
  nameEl.value = sub?.name ?? "";
  amountEl.value = String(sub?.amount ?? "");
  curEl.value = sub?.currency ?? "EUR";
  cycleEl.value = sub?.cycle ?? "monthly";
  fillCategorySelect(catEl);
  catEl.value = sub?.categoryId ?? state.categories[0]!.id;
  billEl.value = (sub?.billingStartDate || "").slice(0, 10);
  activeEl.checked = sub?.active !== false;
  tagsEl.value = (sub?.tags ?? []).join(", ");
  notesEl.value = sub?.notes ?? "";
  delBtn.classList.toggle("invisible", !sub);
  dlg.showModal();
  requestAnimationFrame(() => window.dispatchEvent(new Event("skillatlas:select-popovers-refresh")));
}

function saveSubFromDialog(root: HTMLElement) {
  const idEl = root.querySelector<HTMLInputElement>("[data-et-sub-id]");
  const nameEl = root.querySelector<HTMLInputElement>("[data-et-sub-name]");
  const amountEl = root.querySelector<HTMLInputElement>("[data-et-sub-amount]");
  const curEl = root.querySelector<HTMLSelectElement>("[data-et-sub-currency]");
  const cycleEl = root.querySelector<HTMLSelectElement>("[data-et-sub-cycle]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-sub-category]");
  const billEl = root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]");
  const activeEl = root.querySelector<HTMLInputElement>("[data-et-sub-active]");
  const tagsEl = root.querySelector<HTMLInputElement>("[data-et-sub-tags]");
  const notesEl = root.querySelector<HTMLTextAreaElement>("[data-et-sub-notes]");
  if (!idEl || !nameEl || !amountEl || !curEl || !cycleEl || !catEl || !billEl || !activeEl || !tagsEl || !notesEl) return;
  const name = nameEl.value.trim();
  const amount = Number(amountEl.value);
  if (!name || !Number.isFinite(amount)) return;
  const cycRaw = cycleEl.value;
  const cycle = (["weekly", "monthly", "quarterly", "yearly"] as const).includes(cycRaw as any)
    ? (cycRaw as SubscriptionRow["cycle"])
    : "monthly";
  const tags = parseTags(tagsEl.value);
  pushTagBankFrom(tags);
  const billingRaw = billEl.value.slice(0, 10);
  const billingStartDate = billingRaw.length === 10 ? billingRaw : undefined;
  const row: SubscriptionRow = {
    id: idEl.value || makeId(),
    name,
    amount,
    currency: curEl.value === "USD" ? "USD" : "EUR",
    cycle,
    categoryId: catEl.value,
    billingStartDate,
    nextBilling: "",
    active: activeEl.checked,
    notes: notesEl.value.trim(),
    tags,
  };
  row.nextBilling = subscriptionNextChargeIso(row);
  const idx = state.subscriptions.findIndex((s) => s.id === row.id);
  if (idx >= 0) state.subscriptions[idx] = row;
  else state.subscriptions.push(row);
  root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close();
  persist();
  renderAll(root);
}

function deleteSubFromDialog(root: HTMLElement) {
  void (async () => {
    if (!editingSubId) return;
    if (!(await showConfirmDialog(root, "¿Seguro que quieres eliminar esta suscripción?", "Eliminar"))) return;
    state.subscriptions = state.subscriptions.filter((s) => s.id !== editingSubId);
    root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close();
    persist();
    renderAll(root);
  })();
}

function refreshChartsOnly() {
  const r = document.querySelector<HTMLElement>("[data-tools-expense-page]");
  if (r?.dataset.etBound === "1") renderCharts(r);
}

function ensureExpenseChartThemeBridge() {
  if (document.documentElement.dataset.expenseChartThemeBridge === "1") return;
  document.documentElement.dataset.expenseChartThemeBridge = "1";
  let t = 0;
  const schedule = () => {
    window.cancelAnimationFrame(t);
    t = window.requestAnimationFrame(() => refreshChartsOnly());
  };
  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("skillatlas:prefs-updated", schedule);
}

function updateFxHint(root: HTMLElement) {
  const hint = root.querySelector<HTMLElement>("[data-et-fx-hint]");
  if (!hint) return;
  const r = state.eurPerUsd;
  if (!Number.isFinite(r) || r <= 0) {
    hint.textContent = "";
    return;
  }
  const usdPerEur = 1 / r;
  hint.textContent = `Referencia inversa: 1 EUR ≈ ${usdPerEur.toFixed(4)} USD`;
}

function updateE2eUnlockBanner(root: HTMLElement) {
  const wrap = root.querySelector<HTMLElement>("[data-et-e2e-unlock-banner]");
  const txt = root.querySelector<HTMLElement>("[data-et-e2e-unlock-text]");
  const outside = root.querySelector<HTMLElement>("[data-et-e2e-outside-hint]");
  if (!wrap || !txt) return;
  if (pendingEncryptedRemote) {
    wrap.classList.remove("hidden");
    txt.textContent =
      "Hay una copia en tu cuenta protegida con frase. Introduce la misma frase que usaste al guardarla para fusionarla con esta hoja. Hasta entonces no enviamos cambios a la nube, para no sobrescribir esa copia.";
    outside?.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
    txt.textContent = "";
    outside?.classList.add("hidden");
  }
}

function updateSyncPopoverChrome(root: HTMLElement) {
  const dot = root.querySelector<HTMLElement>("[data-et-sync-status-dot]");
  if (!dot) return;
  const active = state.syncToAccount || state.cloudE2E || pendingEncryptedRemote != null;
  const urgent = pendingEncryptedRemote != null;
  const color = urgent
    ? "bg-amber-500 ring-2 ring-amber-300/80 dark:bg-amber-400"
    : "bg-indigo-400 dark:bg-indigo-500";
  const vis = active ? "opacity-100" : "opacity-0";
  dot.className = `relative inline-flex h-2 w-2 shrink-0 rounded-full ${color} ${vis}`;
}

function closeSyncPopoverPanel(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>("[data-et-sync-popover]");
  const btn = root.querySelector<HTMLButtonElement>("[data-et-sync-popover-toggle]");
  if (!panel || !btn) return;
  panel.classList.add("hidden");
  panel.classList.remove("block");
  btn.setAttribute("aria-expanded", "false");
}

function bindSyncPopover(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>("[data-et-sync-host]");
  const btn = root.querySelector<HTMLButtonElement>("[data-et-sync-popover-toggle]");
  const panel = root.querySelector<HTMLElement>("[data-et-sync-popover]");
  if (!host || !btn || !panel || host.dataset.syncPopoverBound === "1") return;
  host.dataset.syncPopoverBound = "1";

  syncPopoverDocAc?.abort();
  syncPopoverDocAc = new AbortController();
  const { signal } = syncPopoverDocAc;

  const close = () => closeSyncPopoverPanel(root);
  const open = () => {
    panel.classList.remove("hidden");
    panel.classList.add("block");
    btn.setAttribute("aria-expanded", "true");
  };

  btn.addEventListener(
    "click",
    (ev) => {
      ev.stopPropagation();
      if (panel.classList.contains("hidden")) open();
      else close();
    },
    { signal },
  );

  root.querySelector<HTMLButtonElement>("[data-et-sync-open-popover]")?.addEventListener(
    "click",
    (ev) => {
      ev.preventDefault();
      open();
    },
    { signal },
  );

  const onDocClick = (ev: MouseEvent) => {
    if (!host.contains(ev.target as Node)) close();
  };
  document.addEventListener("click", onDocClick, { signal });

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape" && !panel.classList.contains("hidden")) close();
  };
  document.addEventListener("keydown", onKey, { signal });
}

function updateE2ePassphraseHint(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-et-e2e-pass-hint]");
  if (!el) return;
  const show = state.syncToAccount && state.cloudE2E && !e2eSessionPassphrase;
  el.classList.toggle("hidden", !show);
}

function renderAll(root: HTMLElement) {
  bindPaycheckInlineEditors(root);
  bindPlannedInlineEditors(root);
  const sync = root.querySelector<HTMLInputElement>("[data-et-sync]");
  const cloudE2e = root.querySelector<HTMLInputElement>("[data-et-cloud-e2e]");
  const fx = root.querySelector<HTMLInputElement>("[data-et-fx]");
  const mode = root.querySelector<HTMLSelectElement>("[data-et-chart-mode]");
  const period = root.querySelector<HTMLSelectElement>("[data-et-period]");
  if (sync) sync.checked = state.syncToAccount;
  if (cloudE2e) cloudE2e.checked = state.cloudE2E;
  if (fx) fx.value = String(state.eurPerUsd);
  if (mode) mode.value = state.chartMoneyMode;
  if (period) period.value = state.period;
  if (syncChartCategoryFilterSelect(root)) persist();
  const plannedCat = root.querySelector<HTMLSelectElement>("[data-et-planned-category]");
  if (plannedCat) {
    const prev = plannedCat.value;
    fillCategorySelect(plannedCat);
    plannedCat.value = state.categories.some((c) => c.id === prev) ? prev : (state.categories[0]?.id ?? prev);
  }
  updateFxHint(root);
  updateE2eUnlockBanner(root);
  updateE2ePassphraseHint(root);
  updateSyncPopoverChrome(root);
  ensureMonthFilterInputs(root);

  renderKpis(root);
  renderSubs(root);
  renderExpenseTable(root);
  renderIncomeTable(root);
  renderReminders(root);
  renderReminderBanner(root);
  renderPaychecks(root);
  renderPlannedExpenses(root);
  renderCharts(root);
  flashBrowserReminders(root);
  requestAnimationFrame(() => window.dispatchEvent(new Event("skillatlas:select-popovers-refresh")));
}

function bindStripClicks(root: HTMLElement) {
  const strip = root.querySelector<HTMLElement>("[data-et-subs-strip]");
  if (!strip || strip.dataset.stripBound === "1") return;
  strip.dataset.stripBound = "1";
  strip.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-sub-id]");
    if (!btn) return;
    const id = btn.getAttribute("data-sub-id");
    const s = state.subscriptions.find((x) => x.id === id);
    if (s) openSubDialog(root, s);
  });
}

function maybePushFirstSync(remoteNorm: ExpenseTrackerState, local: ExpenseTrackerState) {
  const remoteEmpty =
    remoteNorm.expenses.length === 0 &&
    remoteNorm.subscriptions.length === 0 &&
    (remoteNorm.reminders?.length ?? 0) === 0;
  if (state.syncToAccount && !cloudSaveBlocked() && remoteEmpty && (local.expenses.length > 0 || local.subscriptions.length > 0)) {
    persist();
  }
}

function wire(root: HTMLElement) {
  if (root.dataset.etDialogsBound !== "1") {
    root.dataset.etDialogsBound = "1";
    bindExpenseDialogs(root);
  }
  if (root.dataset.etBound === "1") return;

  root.querySelector<HTMLInputElement>("[data-et-sync]")?.addEventListener("change", (e) => {
    state.syncToAccount = (e.target as HTMLInputElement).checked;
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLInputElement>("[data-et-cloud-e2e]")?.addEventListener("change", async (e) => {
    const on = (e.target as HTMLInputElement).checked;
    if (on && !e2eSessionPassphrase) {
      const ok = await openE2ePassphraseDialog(root);
      if (!ok) {
        (e.target as HTMLInputElement).checked = false;
        state.cloudE2E = false;
        persist();
        renderAll(root);
        return;
      }
    }
    state.cloudE2E = on;
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLButtonElement>("[data-et-e2e-passphrase]")?.addEventListener("click", async () => {
    const ok = await openE2ePassphraseDialog(root);
    if (ok) {
      persist();
      renderAll(root);
      closeSyncPopoverPanel(root);
    }
  });

  root.querySelector<HTMLButtonElement>("[data-et-e2e-unlock-btn]")?.addEventListener("click", async () => {
    if (!pendingEncryptedRemote) return;
    const pass = await openUnlockDialog(root);
    if (!pass) return;
    await tryApplyDecryptedRemote(root, pendingEncryptedRemote, pass);
  });

  root.querySelector<HTMLInputElement>("[data-et-fx]")?.addEventListener("change", (e) => {
    state.eurPerUsd = Number((e.target as HTMLInputElement).value) || state.eurPerUsd;
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLSelectElement>("[data-et-chart-mode]")?.addEventListener("change", (e) => {
    state.chartMoneyMode = (e.target as HTMLSelectElement).value as ExpenseTrackerState["chartMoneyMode"];
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLSelectElement>("[data-et-period]")?.addEventListener("change", (e) => {
    state.period = (e.target as HTMLSelectElement).value as ExpenseTrackerState["period"];
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLSelectElement>("[data-et-chart-cat-filter]")?.addEventListener("change", (e) => {
    state.chartFilterCategoryId = (e.target as HTMLSelectElement).value;
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLButtonElement>("[data-et-paycheck-add]")?.addEventListener("click", () => addPaycheckFromForm(root));
  root.querySelector<HTMLButtonElement>("[data-et-planned-add]")?.addEventListener("click", () => addPlannedFromForm(root));

  root.querySelector<HTMLButtonElement>("[data-et-export-csv]")?.addEventListener("click", () => {
    const csv = expenseTrackerToCsv(state);
    downloadTextFile(`skillatlas-gastos-${todayIso()}.csv`, csv, "text/csv;charset=utf-8");
  });

  root.querySelector<HTMLButtonElement>("[data-et-export-json]")?.addEventListener("click", () => {
    downloadTextFile(`skillatlas-gastos-${todayIso()}.json`, expenseTrackerToJsonSnapshot(state), "application/json;charset=utf-8");
  });

  root.querySelector<HTMLButtonElement>("[data-et-export-xlsx]")?.addEventListener("click", async () => {
    try {
      const { exportExpenseTrackerXlsx } = await import("./expense-tracker-xlsx");
      const blob = await exportExpenseTrackerXlsx(state);
      downloadBlobFile(`skillatlas-gastos-${todayIso()}.xlsx`, blob);
    } catch {
      await showAlertDialog(root, "No se pudo generar el XLSX.");
    }
  });

  const inCsv = root.querySelector<HTMLInputElement>("[data-et-file-csv]");
  root.querySelector<HTMLButtonElement>("[data-et-import-csv]")?.addEventListener("click", () => inCsv?.click());
  inCsv?.addEventListener("change", async () => {
    const f = inCsv.files?.[0];
    inCsv.value = "";
    if (!f) return;
    const ok = await showConfirmDialog(root, "¿Añadir las filas del CSV al cuaderno actual?", "Importar");
    if (!ok) return;
    try {
      const text = await f.text();
      state = expenseTrackerFromCsv(state, text);
      persist();
      renderAll(root);
    } catch {
      await showAlertDialog(root, "CSV no válido.");
    }
  });

  const inJson = root.querySelector<HTMLInputElement>("[data-et-file-json]");
  root.querySelector<HTMLButtonElement>("[data-et-import-json]")?.addEventListener("click", () => inJson?.click());
  inJson?.addEventListener("change", async () => {
    const f = inJson.files?.[0];
    inJson.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      const imported = normalizeExpenseTrackerState(JSON.parse(text));
      const mode = await showImportModeDialog(
        root,
        "Elige cómo combinar el archivo con tu cuaderno: «Fusionar» mezcla por id; «Sustituir» reemplaza gastos, suscripciones y recordatorios (se mantienen sync, tipo de cambio y vistas).",
      );
      if (!mode) return;
      state = mode === "merge" ? applyExpenseImportMerge(state, imported) : applyExpenseImportReplace(state, imported);
      persist();
      renderAll(root);
    } catch {
      await showAlertDialog(root, "JSON no válido.");
    }
  });

  const inXlsx = root.querySelector<HTMLInputElement>("[data-et-file-xlsx]");
  root.querySelector<HTMLButtonElement>("[data-et-import-xlsx]")?.addEventListener("click", () => inXlsx?.click());
  inXlsx?.addEventListener("change", async () => {
    const f = inXlsx.files?.[0];
    inXlsx.value = "";
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const { importExpenseTrackerXlsx } = await import("./expense-tracker-xlsx");
      const imported = await importExpenseTrackerXlsx(buf);
      if (!imported) {
        await showAlertDialog(root, "No se pudo leer el XLSX.");
        return;
      }
      const mode = await showImportModeDialog(
        root,
        "Mismas reglas que JSON: «Fusionar» por id o «Sustituir» datos del cuaderno (se mantienen preferencias de vista y sync).",
      );
      if (!mode) return;
      state = mode === "merge" ? applyExpenseImportMerge(state, imported) : applyExpenseImportReplace(state, imported);
      persist();
      renderAll(root);
    } catch {
      await showAlertDialog(root, "XLSX no válido.");
    }
  });

  if (root.dataset.etAddExpenseBound !== "1") {
    root.dataset.etAddExpenseBound = "1";
    root.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement | null)?.closest("[data-et-add-expense]");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      addExpense();
      queueMicrotask(() => {
        root.querySelector<HTMLElement>("[data-et-expenses-anchor]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  if (root.dataset.etAddIncomeBound !== "1") {
    root.dataset.etAddIncomeBound = "1";
    root.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement | null)?.closest("[data-et-add-income]");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      addIncome();
      queueMicrotask(() => {
        root.querySelector<HTMLElement>("[data-et-income-anchor]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  if (root.dataset.etTableFiltersBound !== "1") {
    root.dataset.etTableFiltersBound = "1";
    const onFilter = () => {
      renderExpenseTable(root);
      renderIncomeTable(root);
    };
    root.querySelector<HTMLInputElement>("[data-et-exp-filter-month]")?.addEventListener("change", onFilter);
    root.querySelector<HTMLSelectElement>("[data-et-exp-filter-day]")?.addEventListener("change", onFilter);
    root.querySelector<HTMLInputElement>("[data-et-inc-filter-month]")?.addEventListener("change", onFilter);
    root.querySelector<HTMLSelectElement>("[data-et-inc-filter-day]")?.addEventListener("change", onFilter);
  }

  root.querySelector<HTMLButtonElement>("[data-et-add-category]")?.addEventListener("click", async () => {
    const res = await openNewCategoryDialog(root);
    if (!res?.name?.trim()) return;
    const colors = ["#6366f1", "#0ea5e9", "#22c55e", "#f97316", "#ec4899", "#eab308", "#a855f7", "#14b8a6"];
    const color = colors[state.categories.length % colors.length]!;
    state.categories.push({
      id: makeId(),
      name: res.name.trim(),
      color,
      parentId: res.parentId,
    });
    state.categories = validateCategoryTree(state.categories);
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLButtonElement>("[data-et-open-sub-modal]")?.addEventListener("click", () => openSubDialog(root, null));

  root.querySelector<HTMLButtonElement>("[data-et-sub-close]")?.addEventListener("click", () => {
    root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close();
  });
  root.querySelector<HTMLButtonElement>("[data-et-sub-cancel]")?.addEventListener("click", () => {
    root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close();
  });
  root.querySelector<HTMLButtonElement>("[data-et-sub-save]")?.addEventListener("click", () => saveSubFromDialog(root));
  root.querySelector<HTMLButtonElement>("[data-et-sub-delete]")?.addEventListener("click", () => deleteSubFromDialog(root));

  root.querySelector<HTMLButtonElement>("[data-et-reminder-add]")?.addEventListener("click", () => addReminderFromForm(root));
  root.querySelector<HTMLButtonElement>("[data-et-reminder-notify-perm]")?.addEventListener("click", async () => {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
  });

  root.dataset.etBound = "1";
  state = loadExpenseTrackerFromStorage();
  bindStripClicks(root);
  ensureExpenseChartThemeBridge();
  renderAll(root);

  void (async () => {
    const local = loadExpenseTrackerFromStorage();
    const remoteRaw = await loadClientState<unknown>(EXPENSE_TRACKER_CLIENT_SCOPE, {});

    if (isExpenseEncryptedEnvelope(remoteRaw)) {
      if (e2eSessionPassphrase) {
        try {
          const json = await openExpenseEnvelope(remoteRaw, e2eSessionPassphrase);
          const remoteDecrypted = normalizeExpenseTrackerState(JSON.parse(json));
          pendingEncryptedRemote = null;
          state = mergeExpenseTrackerRemoteLocal(remoteDecrypted, local);
          saveExpenseTrackerToStorage(state);
          renderAll(root);
          maybePushFirstSync(remoteDecrypted, local);
          return;
        } catch {
          pendingEncryptedRemote = remoteRaw;
          state = local;
          saveExpenseTrackerToStorage(state);
          renderAll(root);
          return;
        }
      }
      pendingEncryptedRemote = remoteRaw;
      state = local;
      saveExpenseTrackerToStorage(state);
      renderAll(root);
      return;
    }

    pendingEncryptedRemote = null;
    const remoteNorm = normalizeExpenseTrackerState(remoteRaw);
    state = mergeExpenseTrackerRemoteLocal(remoteNorm, local);
    saveExpenseTrackerToStorage(state);
    renderAll(root);
    maybePushFirstSync(remoteNorm, local);
  })();
}

function boot() {
  const root = document.querySelector<HTMLElement>("[data-tools-expense-page]");
  if (!root) return;
  bindSyncPopover(root);
  if (root.dataset.etBound === "1") {
    state = loadExpenseTrackerFromStorage();
    renderAll(root);
    return;
  }
  wire(root);
}

function onLeave() {
  disposeCharts();
  syncPopoverDocAc?.abort();
  syncPopoverDocAc = null;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);
document.addEventListener("astro:before-swap", onLeave as any);
