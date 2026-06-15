import "flatpickr/dist/flatpickr.min.css";
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
  subscriptionCountsInTotals,
  scheduleSubscriptionCancel,
  validateCategoryTree,
  computePatrimonioSnapshot,
  computeInvestmentTotalInvested,
  monthsForRecurringEntry,
  monthsForRecurringRange,
  totalIncomeInPeriod,
  totalExpensesInPeriod,
  formatIbanDisplay,
  formatEurEs,
  defaultWealthAccountId,
  parseCardColor,
  effectivePaycheckAmount,
  paycheckActiveInMonth,
  recurringChargeDate,
  investmentPortfolioTotals,
  investmentCurrentValue,
  investmentGainLossAmount,
  type ExpenseAttachment,
  type ExpenseRow,
  type ExpenseTrackerState,
  type IncomeAdhocRow,
  type IncomeMonthOverride,
  type PaycheckEntry,
  type PlannedExpenseEntry,
  type PlannedExpenseMonthOverride,
  type SubscriptionRow,
  type InvestmentHolding,
  type WealthAccount,
  type WealthTransfer,
} from "@lib/tools-expense-tracker";
import { initExpenseDatePickers } from "./expense-tracker-dates";
import { layoutTreemap } from "@lib/treemap-layout";
import { isExpenseEncryptedEnvelope, openExpenseEnvelope, sealExpenseState } from "@lib/tools-expense-tracker-crypto";
import type { EncryptedExpenseEnvelope } from "@lib/tools-expense-tracker-crypto";
import { loadClientState, scheduleSaveClientState } from "@scripts/core/user-client-state";
import {
  renderInvestmentSection,
  renderPaycheckCards,
  renderPlannedCards,
} from "./expense-tracker-recurring-ui";

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
  if (currency === "EUR") return formatEurEs(n);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function fmtCompact(n: number, currency: "EUR" | "USD") {
  if (currency === "EUR") return formatEurEs(n, true);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function fmtEur(n: number) {
  return formatEurEs(n);
}

function fmtEurCompact(n: number) {
  return formatEurEs(n, true);
}

function fmtNumEs(n: number) {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

function amountInEur(amount: number, currency: "EUR" | "USD", fx: number) {
  return currency === "EUR" ? amount : convertAmount(amount, "USD", "EUR", fx);
}

let plannedSortDesc = true;
let paycheckSortDesc = true;
let editingPlannedId: string | null = null;
let editingPaycheckId: string | null = null;
let editingInvId: string | null = null;

let state: ExpenseTrackerState = defaultExpenseTrackerState();
const chartInstances: echarts.ECharts[] = [];
let resizeObserver: ResizeObserver | null = null;
let editingSubId: string | null = null;

/** Frase solo en memoria de esta pestaña; no va a disco ni servidor. */
let e2eSessionPassphrase: string | null = null;
/** Copia remota cifrada pendiente de descifrar (bloquea subidas para no pisar el sobre). */
let pendingEncryptedRemote: EncryptedExpenseEnvelope | null = null;

const ET_FIELD = "et-field w-full min-w-0 text-sm";
const ET_FIELD_MONO = ET_FIELD;

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

let subsTreemapRo: ResizeObserver | null = null;

function cardGradientStyle(color?: string): { className: string; style: string } {
  const c = parseCardColor(color) ?? "#6366f1";
  return {
    className: "border shadow-md",
    style: `border-color:${c}99;background:linear-gradient(135deg,${c}66 0%,${c}38 42%,${c}1a 100%)`,
  };
}

function eurDelta(amount: number, currency: ExpenseCurrency): number {
  return convertAmount(Math.max(0, amount), currency, "EUR", state.eurPerUsd);
}

function adjustWealthBalance(accountId: string | undefined, deltaEur: number) {
  if (!accountId || !Number.isFinite(deltaEur) || deltaEur === 0) return;
  const idx = (state.wealthAccounts ?? []).findIndex((a) => a.id === accountId);
  if (idx < 0) return;
  const row = { ...state.wealthAccounts![idx]! };
  row.balance = Math.round((row.balance + deltaEur) * 100) / 100;
  state.wealthAccounts![idx] = row;
}

function expenseAccountEffect(row: ExpenseRow | null, sign: 1 | -1) {
  if (!row || row.confirmed === false || row.amount <= 0) return;
  const id = row.wealthAccountId ?? defaultWealthAccountId(state.wealthAccounts ?? [], "expense");
  adjustWealthBalance(id, sign * -eurDelta(row.amount, row.currency));
}

function incomeAccountEffect(row: IncomeAdhocRow | null, sign: 1 | -1) {
  if (!row || row.confirmed === false || row.amount <= 0) return;
  const id = row.wealthAccountId ?? defaultWealthAccountId(state.wealthAccounts ?? [], "income");
  adjustWealthBalance(id, sign * eurDelta(row.amount, row.currency));
}

function syncExpenseAccounts(prev: ExpenseRow | null, next: ExpenseRow | null) {
  expenseAccountEffect(prev, -1);
  expenseAccountEffect(next, 1);
}

function syncIncomeAccounts(prev: IncomeAdhocRow | null, next: IncomeAdhocRow | null) {
  incomeAccountEffect(prev, -1);
  incomeAccountEffect(next, 1);
}

function fillWealthAccountSelect(
  sel: HTMLSelectElement,
  selectedId?: string,
  role: "expense" | "income" = "expense",
) {
  sel.innerHTML = "";
  const accounts = state.wealthAccounts ?? [];
  if (!accounts.length) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "Sin cuentas";
    sel.appendChild(o);
    return;
  }
  for (const a of accounts) {
    const o = document.createElement("option");
    o.value = a.id;
    const mask = a.ibanPrefix ? ` · ${formatIbanDisplay(a.ibanPrefix).slice(0, 7)}…` : "";
    o.textContent = `${a.name}${mask}`;
    sel.appendChild(o);
  }
  if (selectedId && accounts.some((a) => a.id === selectedId)) sel.value = selectedId;
  else {
    const def = defaultWealthAccountId(accounts, role);
    if (def) sel.value = def;
  }
}

function formatMonthLabel(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  if (!y || !m) return mk;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function renderPatrimonioKpi(root: HTMLElement) {
  const elTotal = root.querySelector<HTMLElement>("[data-et-kpi-patrimonio-total]");
  const elBreak = root.querySelector<HTMLElement>("[data-et-kpi-patrimonio-breakdown]");
  if (!elTotal || !elBreak) return;
  const snap = computePatrimonioSnapshot(state);
  elTotal.textContent = fmtEurCompact(snap.total);
  elBreak.innerHTML = "";
  const invLabel = snap.realMode ? "Inversiones (capital)" : "Inversiones (valor est.)";
  for (const a of snap.accounts) {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-2 text-gray-700 dark:text-gray-300";
    const name = document.createElement("span");
    name.className = "truncate";
    const mask = a.ibanPrefix ? ` ${formatIbanDisplay(a.ibanPrefix)}` : "";
    name.textContent = `${a.name}${mask}`;
    const val = document.createElement("span");
    val.className = "et-amount font-semibold shrink-0";
    val.textContent = fmtEurCompact(a.balance);
    row.append(name, val);
    elBreak.appendChild(row);
  }
  if (snap.investmentsPart > 0) {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-2 text-violet-800 dark:text-violet-200 font-medium";
    row.innerHTML = `<span>${invLabel}</span><span class="et-amount font-semibold shrink-0">${fmtEurCompact(snap.investmentsPart)}</span>`;
    elBreak.appendChild(row);
  }
  if (!snap.accounts.length && snap.investmentsPart <= 0) {
    const hint = document.createElement("p");
    hint.className = "m-0 text-xs text-gray-500 dark:text-gray-400";
    hint.textContent = "Configura cuentas arriba o añade inversiones.";
    elBreak.appendChild(hint);
  }
}

function updateWealthBalanceDisplays(root: HTMLElement) {
  for (const a of state.wealthAccounts ?? []) {
    const el = root.querySelector<HTMLElement>(`[data-wealth-balance-display="${a.id}"]`);
    if (el) el.textContent = fmtEur(a.balance);
  }
  renderPatrimonioKpi(root);
}

function updatePatrimonioModeLabel(root: HTMLElement) {
  const lab = root.querySelector<HTMLElement>("[data-et-patrimonio-mode-label]");
  if (lab) lab.textContent = state.patrimonioRealMode ? "Real" : "Valor estimado";
}

function renderWealthAccounts(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>("[data-et-wealth-list]");
  const empty = root.querySelector<HTMLElement>("[data-et-wealth-empty]");
  if (!list) return;
  const accounts = state.wealthAccounts ?? [];
  list.innerHTML = "";
  if (empty) empty.classList.toggle("hidden", accounts.length > 0);
  for (const a of accounts) {
    const tracked = Boolean(a.isDefaultExpense || a.isDefaultIncome);
    const row = document.createElement("div");
    row.className =
      "rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-950/50 p-3 space-y-2";
    row.dataset.wealthId = a.id;

    const top = document.createElement("div");
    top.className = "flex flex-wrap items-end gap-2 sm:gap-3";
    const nameLab = document.createElement("label");
    nameLab.className = "flex-1 min-w-[8rem] space-y-1";
    nameLab.innerHTML = `<span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Nombre</span>`;
    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.value = a.name;
    nameIn.dataset.wealthName = a.id;
    nameIn.className = "et-field w-full text-sm py-2";
    nameLab.appendChild(nameIn);

    const ibanLab = document.createElement("label");
    ibanLab.className = "w-20 space-y-1";
    ibanLab.innerHTML = `<span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">IBAN</span>`;
    const ibanIn = document.createElement("input");
    ibanIn.type = "text";
    ibanIn.maxLength = 4;
    ibanIn.value = a.ibanPrefix ?? "";
    ibanIn.placeholder = "ES79";
    ibanIn.dataset.wealthIban = a.id;
    ibanIn.className = "et-field w-full text-sm py-2 uppercase tracking-wide";
    ibanLab.appendChild(ibanIn);

    const del = document.createElement("button");
    del.type = "button";
    del.dataset.wealthDelete = a.id;
    del.className = "et-btn-secondary text-xs py-2 px-2.5 text-red-600 dark:text-red-400";
    del.textContent = "Quitar";
    top.append(nameLab, ibanLab, del);

    const mask = document.createElement("p");
    mask.className = "m-0 text-xs tracking-wider text-gray-500 dark:text-gray-400";
    mask.dataset.wealthIbanMask = a.id;
    mask.textContent = formatIbanDisplay(a.ibanPrefix);

    const roles = document.createElement("div");
    roles.className = "flex flex-wrap gap-3 text-xs";
    const expLab = document.createElement("label");
    expLab.className = "inline-flex items-center gap-1.5 cursor-pointer";
    const expCb = document.createElement("input");
    expCb.type = "radio";
    expCb.name = "et-wealth-default-expense";
    expCb.checked = Boolean(a.isDefaultExpense);
    expCb.dataset.wealthDefaultExpense = a.id;
    expLab.append(expCb, document.createTextNode("Cuenta de gastos"));
    const incLab = document.createElement("label");
    incLab.className = "inline-flex items-center gap-1.5 cursor-pointer";
    const incCb = document.createElement("input");
    incCb.type = "radio";
    incCb.name = "et-wealth-default-income";
    incCb.checked = Boolean(a.isDefaultIncome);
    incCb.dataset.wealthDefaultIncome = a.id;
    incLab.append(incCb, document.createTextNode("Cuenta de ingresos"));

    const balRow = document.createElement("div");
    balRow.className = "flex flex-wrap items-end gap-2";
    if (tracked) {
      const disp = document.createElement("div");
      disp.className = "flex-1 min-w-[10rem]";
      disp.innerHTML = `<span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Saldo actual (auto)</span>`;
      const val = document.createElement("p");
      val.className = "m-0 mt-1 text-lg font-bold et-amount text-gray-900 dark:text-gray-50";
      val.dataset.wealthBalanceDisplay = a.id;
      val.textContent = fmtEur(a.balance);
      disp.appendChild(val);
      const recon = document.createElement("button");
      recon.type = "button";
      recon.dataset.wealthReconcile = a.id;
      recon.className = "et-btn-secondary text-xs py-2";
      recon.textContent = "Reconciliar saldo";
      balRow.append(disp, recon);
    } else {
      const balLab = document.createElement("label");
      balLab.className = "flex-1 min-w-[10rem] space-y-1";
      balLab.innerHTML = `<span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Saldo (€)</span>`;
      const balIn = document.createElement("input");
      balIn.type = "number";
      balIn.step = "0.01";
      balIn.value = String(a.balance);
      balIn.dataset.wealthBalance = a.id;
      balIn.className = "et-field w-full text-sm py-2 et-amount";
      balLab.appendChild(balIn);
      balRow.appendChild(balLab);
    }

    roles.append(expLab, incLab);
    row.append(top, mask, roles, balRow);
    list.appendChild(row);
  }
  const transfers = [...(state.wealthTransfers ?? [])]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 6);
  if (transfers.length) {
    const box = document.createElement("div");
    box.className =
      "rounded-xl border border-dashed border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/15 p-3 space-y-1.5";
    const title = document.createElement("p");
    title.className = "m-0 text-[11px] font-semibold uppercase tracking-wide text-indigo-800/90 dark:text-indigo-300/90";
    title.textContent = "Últimos traspasos (nómina ↔ tarjeta)";
    box.appendChild(title);
    const acctName = (id: string) => accounts.find((x) => x.id === id)?.name ?? "Cuenta";
    for (const t of transfers) {
      const line = document.createElement("p");
      line.className = "m-0 text-xs text-gray-700 dark:text-gray-300";
      const note = t.note ? ` · ${t.note}` : "";
      line.textContent = `${t.date.slice(0, 10)} · ${acctName(t.fromAccountId)} → ${acctName(t.toAccountId)} · ${fmtEur(t.amount)}${note}`;
      box.appendChild(line);
    }
    list.appendChild(box);
  }
  renderPatrimonioKpi(root);
}

function renderKpis(root: HTMLElement) {
  const elSubs = root.querySelector<HTMLElement>("[data-et-kpi-subs]");
  const elExp = root.querySelector<HTMLElement>("[data-et-kpi-expenses]");
  const elIncPeriod = root.querySelector<HTMLElement>("[data-et-kpi-income-period]");
  const elInc = root.querySelector<HTMLElement>("[data-et-kpi-income]");
  const elBal = root.querySelector<HTMLElement>("[data-et-kpi-balance]");
  if (!elSubs || !elExp) return;

  const fx = state.eurPerUsd;
  const today = new Date().toISOString().slice(0, 10);
  let subEur = 0;
  for (const s of state.subscriptions) {
    const m = subscriptionToMonthlyAmount(s, today);
    subEur += amountInEur(m, s.currency, fx);
  }

  elSubs.textContent = `${fmtEurCompact(subEur)} / mes equiv.`;
  elExp.textContent = fmtEurCompact(totalExpensesInPeriod(state, state.period));
  if (elIncPeriod) elIncPeriod.textContent = fmtEurCompact(totalIncomeInPeriod(state, state.period));

  const curMonth = today.slice(0, 7);
  const exM = state.expenses.filter((e) => e.date.startsWith(curMonth) && e.confirmed !== false);
  let expMEur = 0;
  for (const e of exM) {
    expMEur += amountInEur(Math.max(0, e.amount), e.currency, fx);
  }
  const burn = subscriptionMonthlyBurnByCurrency(state);
  const planM = monthlyPlannedOutflowSeries(state, [curMonth], "unify_eur", fx);
  const outMEur = expMEur + amountInEur(burn.eur, "EUR", fx) + amountInEur(burn.usd, "USD", fx) + (planM.seriesUnified[0] ?? 0);
  const incS = monthlyIncomeSeries(state, [curMonth], "unify_eur", fx);
  const incEur = incS.seriesUnified[0] ?? 0;
  if (elInc) elInc.textContent = fmtEurCompact(incEur);
  if (elBal) elBal.textContent = fmtEurCompact(incEur - outMEur);
  renderPatrimonioKpi(root);

  const elYi = root.querySelector<HTMLElement>("[data-et-kpi-year-income]");
  const elYo = root.querySelector<HTMLElement>("[data-et-kpi-year-out]");
  const elYn = root.querySelector<HTMLElement>("[data-et-kpi-year-net]");
  if (elYi && elYo && elYn) {
    const year = new Date().getFullYear();
    const ys = buildNaturalYearOutInSeries(year);
    const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    const incUni = sum(ys.incUni);
    const outUni = sum(ys.outUni);
    elYi.textContent = fmtEurCompact(incUni);
    elYo.textContent = fmtEurCompact(outUni);
    elYn.textContent = fmtEurCompact(incUni - outUni);
  }
}

function buildSubTreemapCard(
  s: SubscriptionRow,
  fx: number,
  today: string,
  w: number,
): HTMLElement {
  const counts = subscriptionCountsInTotals(s, today);
  const scheduled = Boolean(s.cancelEffectiveDate?.trim());
  const faded = !counts || !s.active || scheduled;

  const wrap = document.createElement("div");
  wrap.className = "et-sub-treemap-card";
  wrap.dataset.subTileId = s.id;

  const card = document.createElement("article");
  card.dataset.subId = s.id;
  const grad = cardGradientStyle(s.cardColor);
  card.className =
    `relative text-left rounded-xl p-2.5 sm:p-3 h-full flex flex-col overflow-hidden ${grad.className}` +
    (faded ? " et-sub-bento-card--faded opacity-75" : "");
  card.style.cssText = grad.style;

  const cycleLabel =
    s.cycle === "weekly"
      ? "Semanal"
      : s.cycle === "monthly"
        ? "Mensual"
        : s.cycle === "quarterly"
          ? "Trimestral"
          : "Anual";
  const monthly = subscriptionToMonthlyAmount(s);
  const monthlyEur = amountInEur(monthly, s.currency, fx);
  const nextIso = subscriptionNextChargeIso(s);

  const head = document.createElement("div");
  head.className = "flex items-start justify-between gap-1 mb-1 min-h-0";
  const status = document.createElement("p");
  status.className = "m-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 line-clamp-2";
  if (!s.active) status.textContent = "Pausada";
  else if (scheduled && counts) status.textContent = `Cancela ${s.cancelEffectiveDate?.slice(0, 10) ?? ""}`;
  else if (scheduled) status.textContent = "Cancelada";
  else status.textContent = cycleLabel;

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.dataset.subCancel = s.id;
  cancelBtn.className =
    "shrink-0 text-[9px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer z-10";
  if (!s.active) cancelBtn.textContent = "On";
  else if (scheduled) cancelBtn.textContent = "↩";
  else cancelBtn.textContent = "×";
  head.append(status, cancelBtn);

  const name = document.createElement("p");
  name.className =
    "m-0 font-semibold tracking-tight text-gray-900 dark:text-gray-50 truncate " +
    (w > 0.22 ? "text-sm sm:text-base" : "text-xs sm:text-sm");
  name.textContent = s.name;

  const price = document.createElement("p");
  price.className =
    "m-0 mt-auto pt-1 font-bold text-gray-800 dark:text-gray-100 et-amount truncate " +
    (w > 0.18 ? "text-sm sm:text-base" : "text-xs");
  price.textContent = `${fmtEur(monthlyEur)}/mes`;

  const meta = document.createElement("p");
  meta.className = "m-0 text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 truncate";
  const from = s.billingStartDate?.trim();
  if (scheduled && counts && s.cancelEffectiveDate) {
    meta.textContent = `Último cobro ${s.cancelEffectiveDate.slice(0, 10)}`;
  } else if (from && nextIso && counts) meta.textContent = `Próx. ${nextIso}`;
  else if (from) meta.textContent = `Desde ${from.slice(0, 10)}`;
  else meta.textContent = "Sin fecha inicio";

  const editHit = document.createElement("button");
  editHit.type = "button";
  editHit.dataset.subId = s.id;
  editHit.className = "absolute inset-0 rounded-xl cursor-pointer";
  editHit.setAttribute("aria-label", `Editar ${s.name}`);

  card.append(head, name, price, meta, editHit);
  wrap.appendChild(card);
  return wrap;
}

function layoutSubsTreemap(strip: HTMLElement) {
  const fx = state.eurPerUsd;
  const subs = [...state.subscriptions];
  const gap = 6;
  const width = Math.max(strip.clientWidth, 320);
  const height = Math.max(280, Math.min(420, width * 0.42));

  strip.style.height = `${height}px`;
  strip.innerHTML = "";

  if (!subs.length) {
    strip.style.height = "auto";
    strip.style.minHeight = "6rem";
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-500 dark:text-gray-400 px-4 py-8 text-center";
    empty.textContent = "Aún no hay suscripciones. Usa «Nueva suscripción» para empezar.";
    strip.appendChild(empty);
    return;
  }

  const today = todayIso();
  const weights = subs.map((s) => {
    const m = subscriptionToMonthlyAmount(s);
    return amountInEur(m, s.currency, fx) || 0.01;
  });
  const items = subs.map((s, i) => ({ id: s.id, value: weights[i]! }));
  const rects = layoutTreemap(items, width, height);

  for (const rect of rects) {
    const s = subs.find((x) => x.id === rect.id);
    if (!s) continue;
    const el = buildSubTreemapCard(s, fx, today, rect.w / width);
    el.style.left = `${rect.x + gap / 2}px`;
    el.style.top = `${rect.y + gap / 2}px`;
    el.style.width = `${Math.max(0, rect.w - gap)}px`;
    el.style.height = `${Math.max(0, rect.h - gap)}px`;
    strip.appendChild(el);
  }
}

function renderSubs(root: HTMLElement) {
  const strip = root.querySelector<HTMLElement>("[data-et-subs-strip]");
  if (!strip) return;

  if (!subsTreemapRo) {
    subsTreemapRo = new ResizeObserver(() => layoutSubsTreemap(strip));
    subsTreemapRo.observe(strip);
  }
  layoutSubsTreemap(strip);
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
  updateWealthBalanceDisplays(root);
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

    const tdCat = document.createElement("td");
    tdCat.className = "px-2 py-1.5";
    const selCat = document.createElement("select");
    selCat.className = `${ET_FIELD} min-w-[8rem] py-1.5`;
    selCat.dataset.etExpId = row.id;
    selCat.dataset.etExpField = "category";
    fillCategorySelect(selCat);
    selCat.value = row.categoryId;
    selCat.addEventListener("change", () => patchExpense(row.id, { categoryId: selCat.value }, "category"));

    const tdAcct = document.createElement("td");
    tdAcct.className = "px-2 py-1.5";
    const selAcct = document.createElement("select");
    selAcct.className = `${ET_FIELD} min-w-[7rem] py-1.5`;
    selAcct.dataset.etExpId = row.id;
    selAcct.dataset.etExpField = "wealthAccount";
    fillWealthAccountSelect(selAcct, row.wealthAccountId, "expense");
    selAcct.addEventListener("change", () =>
      patchExpense(row.id, { wealthAccountId: selAcct.value || undefined }, "wealthAccount"),
    );

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

    tdCat.appendChild(selCat);
    tdAcct.appendChild(selAcct);
    tdDel.appendChild(del);
    tr.append(tdDate, tdLabel, tdAmt, tdCat, tdAcct, tdTags, tdAtt, tdNotes, tdState, tdDel);
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
  updateWealthBalanceDisplays(root);
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

    const tdCat = document.createElement("td");
    tdCat.className = "px-2 py-1.5";
    const selCat = document.createElement("select");
    selCat.className = `${ET_FIELD} min-w-[8rem] py-1.5`;
    selCat.dataset.etIncId = row.id;
    selCat.dataset.etIncField = "category";
    fillCategorySelect(selCat);
    selCat.value = row.categoryId;
    selCat.addEventListener("change", () => patchIncome(row.id, { categoryId: selCat.value }, "category"));

    const tdAcct = document.createElement("td");
    tdAcct.className = "px-2 py-1.5";
    const selAcct = document.createElement("select");
    selAcct.className = `${ET_FIELD} min-w-[7rem] py-1.5`;
    selAcct.dataset.etIncId = row.id;
    selAcct.dataset.etIncField = "wealthAccount";
    fillWealthAccountSelect(selAcct, row.wealthAccountId, "income");
    selAcct.addEventListener("change", () =>
      patchIncome(row.id, { wealthAccountId: selAcct.value || undefined }, "wealthAccount"),
    );

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

    tdCat.appendChild(selCat);
    tdAcct.appendChild(selAcct);
    tdDel.appendChild(del);
    tr.append(tdDate, tdLabel, tdAmt, tdCat, tdAcct, tdTags, tdAtt, tdNotes, tdState, tdDel);
    body.appendChild(tr);
  }
}

function patchIncome(id: string, patch: Partial<IncomeAdhocRow>, refocusField?: string) {
  const list = [...(state.incomeAdhoc ?? [])];
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const prev = list[idx]!;
  const next: IncomeAdhocRow = {
    ...prev,
    ...patch,
    tags: patch.tags ?? prev.tags ?? [],
    attachments: patch.attachments ?? prev.attachments ?? [],
  };
  syncIncomeAccounts(prev, next);
  list[idx] = next;
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
  const row = (state.incomeAdhoc ?? []).find((e) => e.id === id);
  if (row) incomeAccountEffect(row, -1);
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
    wealthAccountId: defaultWealthAccountId(state.wealthAccounts ?? [], "income"),
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
  const next: ExpenseRow = {
    ...prev,
    ...patch,
    tags: patch.tags ?? prev.tags ?? [],
    attachments: patch.attachments ?? prev.attachments ?? [],
  };
  syncExpenseAccounts(prev, next);
  state.expenses[idx] = next;
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
  const row = state.expenses.find((e) => e.id === id);
  if (row) expenseAccountEffect(row, -1);
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
    wealthAccountId: defaultWealthAccountId(state.wealthAccounts ?? [], "expense"),
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
  renderPaycheckCards(root, recurringUiDeps(root), paycheckSortDesc);
}

function renderPlannedExpenses(root: HTMLElement) {
  renderPlannedCards(root, recurringUiDeps(root), plannedSortDesc);
}

function renderInvestments(root: HTMLElement) {
  renderInvestmentSection(root, recurringUiDeps(root));
}

function recurringUiDeps(_root: HTMLElement) {
  return {
    state,
    fmtEur,
    fmtEurCompact,
    amountInEur,
    todayIso,
    makeId,
    openPaycheckDialog,
    openPlannedDialog,
    openInvestmentDialog,
  };
}

function renderMonthOverrideList(
  root: HTMLElement,
  kind: "paycheck" | "planned",
  entryId: string | null,
  validFrom: string,
  validUntil: string,
  dayOfMonth: number,
  typicalAmount?: number,
) {
  const sel =
    kind === "paycheck" ? "[data-et-paycheck-month-list]" : "[data-et-planned-month-list]";
  const list = root.querySelector<HTMLElement>(sel);
  if (!list) return;
  list.innerHTML = "";
  if (!entryId) {
    const hint = document.createElement("p");
    hint.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400";
    hint.textContent = "Guarda primero el registro para fijar ajustes por mes.";
    list.appendChild(hint);
    return;
  }
  const months = monthsForRecurringEntry({ dayOfMonth, validFrom, validUntil });
  if (!months.length) {
    const hint = document.createElement("p");
    hint.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400";
    hint.textContent = "Ningún mes coincide con el rango y el día del mes.";
    list.appendChild(hint);
    return;
  }
  const overrides =
    kind === "paycheck"
      ? (state.incomeMonthOverrides ?? []).filter((o) => o.paycheckId === entryId)
      : (state.plannedExpenseMonthOverrides ?? []).filter((o) => o.plannedExpenseId === entryId);
  const byMonth = new Map(overrides.map((o) => [o.month, o]));
  const base = typicalAmount != null && typicalAmount > 0 ? typicalAmount : undefined;

  for (const mk of months) {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2";
    const lab = document.createElement("span");
    lab.className = "text-[11px] text-gray-600 dark:text-gray-400 w-[8.5rem] shrink-0 capitalize";
    lab.textContent = formatMonthLabel(mk);
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.01";
    inp.min = "0";
    inp.dataset.monthOverride = mk;
    inp.className = "et-field flex-1 text-sm py-1.5 et-amount";
    const ov = byMonth.get(mk);
    if (ov) inp.value = String(ov.amount);
    else if (base != null) inp.placeholder = String(base);
    row.append(lab, inp);
    list.appendChild(row);
  }
}

function collectMonthOverridesFromDialog(
  root: HTMLElement,
  kind: "paycheck" | "planned",
  entryId: string,
): IncomeMonthOverride[] | PlannedExpenseMonthOverride[] {
  const sel =
    kind === "paycheck" ? "[data-et-paycheck-month-list]" : "[data-et-planned-month-list]";
  const list = root.querySelector<HTMLElement>(sel);
  if (!list) return [];
  const out: Array<IncomeMonthOverride | PlannedExpenseMonthOverride> = [];
  list.querySelectorAll<HTMLInputElement>("input[data-month-override]").forEach((inp) => {
    const month = inp.dataset.monthOverride ?? "";
    const raw = inp.value.trim();
    if (!month || !raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return;
    if (kind === "paycheck") {
      out.push({
        id: makeId(),
        paycheckId: entryId,
        month,
        amount,
        currency: "EUR",
      });
    } else {
      out.push({
        id: makeId(),
        plannedExpenseId: entryId,
        month,
        amount,
        currency: "EUR",
      });
    }
  });
  return out as IncomeMonthOverride[] | PlannedExpenseMonthOverride[];
}

function bindMonthOverrideRefresh(root: HTMLElement, kind: "paycheck" | "planned", entryId: string | null) {
  const fromSel = kind === "paycheck" ? "[data-et-paycheck-from]" : "[data-et-planned-from]";
  const untilSel = kind === "paycheck" ? "[data-et-paycheck-until]" : "[data-et-planned-until]";
  const amtSel = kind === "paycheck" ? "[data-et-paycheck-amount]" : "[data-et-planned-amount]";
  const refresh = () => {
    const from = (root.querySelector<HTMLInputElement>(fromSel)?.value ?? "").slice(0, 10);
    const until = (root.querySelector<HTMLInputElement>(untilSel)?.value ?? "").slice(0, 10);
    const amt = Number(root.querySelector<HTMLInputElement>(amtSel)?.value);
    const dayRaw = Number(root.querySelector<HTMLInputElement>(daySel)?.value);
    const dayOfMonth = Number.isFinite(dayRaw) ? Math.min(31, Math.max(1, Math.floor(dayRaw))) : 1;
    renderMonthOverrideList(
      root,
      kind,
      entryId,
      from,
      until,
      dayOfMonth,
      Number.isFinite(amt) ? amt : undefined,
    );
  };
  const daySel = kind === "paycheck" ? "[data-et-paycheck-day]" : "[data-et-planned-day]";
  root.querySelector<HTMLInputElement>(fromSel)?.addEventListener("change", refresh);
  root.querySelector<HTMLInputElement>(untilSel)?.addEventListener("change", refresh);
  root.querySelector<HTMLInputElement>(amtSel)?.addEventListener("input", refresh);
  root.querySelector<HTMLInputElement>(daySel)?.addEventListener("change", refresh);
}

function updateInvTotalDisplay(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-et-inv-total-display]");
  if (!el) return;
  const avg = Number(root.querySelector<HTMLInputElement>("[data-et-inv-avg]")?.value);
  const qty = Number(root.querySelector<HTMLInputElement>("[data-et-inv-qty]")?.value);
  if (!Number.isFinite(avg) || !Number.isFinite(qty) || qty <= 0) {
    el.textContent = "—";
    return;
  }
  el.textContent = fmtEur(computeInvestmentTotalInvested(avg, qty));
}

function openPaycheckDialog(root: HTMLElement, p?: PaycheckEntry | null) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-paycheck]");
  const title = root.querySelector<HTMLElement>("[data-et-paycheck-dialog-title]");
  const idEl = root.querySelector<HTMLInputElement>("[data-et-paycheck-id]");
  if (!dlg || !title || !idEl) return;
  editingPaycheckId = p?.id ?? null;
  title.textContent = p ? "Editar ingreso previsto" : "Nuevo ingreso previsto";
  if (!p?.id && !idEl.value) idEl.value = makeId();
  const entryId = p?.id ?? idEl.value;
  idEl.value = entryId;
  (root.querySelector("[data-et-paycheck-title]") as HTMLInputElement).value = p?.title ?? "";
  (root.querySelector("[data-et-paycheck-amount]") as HTMLInputElement).value =
    p?.typicalAmount != null ? String(p.typicalAmount) : "";
  (root.querySelector("[data-et-paycheck-min]") as HTMLInputElement).value =
    p?.amountMin != null ? String(p.amountMin) : "";
  (root.querySelector("[data-et-paycheck-max]") as HTMLInputElement).value =
    p?.amountMax != null ? String(p.amountMax) : "";
  (root.querySelector("[data-et-paycheck-day]") as HTMLInputElement).value = String(p?.dayOfMonth ?? 1);
  (root.querySelector("[data-et-paycheck-window]") as HTMLInputElement).value =
    p?.windowBefore != null ? String(p.windowBefore) : "";
  (root.querySelector("[data-et-paycheck-from]") as HTMLInputElement).value = (p?.validFrom ?? "").slice(0, 10);
  (root.querySelector("[data-et-paycheck-until]") as HTMLInputElement).value = (p?.validUntil ?? "").slice(0, 10);
  (root.querySelector("[data-et-paycheck-note]") as HTMLInputElement).value = p?.note ?? "";
  root.querySelector("[data-et-paycheck-delete]")?.classList.toggle("invisible", !p);
  const from = (p?.validFrom ?? "").slice(0, 10);
  const until = (p?.validUntil ?? "").slice(0, 10);
  const dayOfMonth = p?.dayOfMonth ?? 1;
  renderMonthOverrideList(root, "paycheck", entryId, from, until, dayOfMonth, p?.typicalAmount);
  bindMonthOverrideRefresh(root, "paycheck", entryId);
  dlg.showModal();
}

function savePaycheckFromDialog(root: HTMLElement) {
  const idEl = root.querySelector<HTMLInputElement>("[data-et-paycheck-id]");
  const title = root.querySelector<HTMLInputElement>("[data-et-paycheck-title]")?.value?.trim() ?? "";
  const dayRaw = Number(root.querySelector<HTMLInputElement>("[data-et-paycheck-day]")?.value);
  const winRaw = root.querySelector<HTMLInputElement>("[data-et-paycheck-window]")?.value;
  const note = root.querySelector<HTMLInputElement>("[data-et-paycheck-note]")?.value?.trim() ?? "";
  const amt = Number(root.querySelector<HTMLInputElement>("[data-et-paycheck-amount]")?.value);
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
    id: idEl?.value || makeId(),
    title,
    dayOfMonth,
    windowBefore,
    note: note || undefined,
    typicalAmount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
    currency: "EUR",
    amountMin:
      minV != null && minV !== "" && Number.isFinite(Number(minV)) ? Math.max(0, Number(minV)) : undefined,
    amountMax:
      maxV != null && maxV !== "" && Number.isFinite(Number(maxV)) ? Math.max(0, Number(maxV)) : undefined,
    validFrom: from.length === 10 ? from : undefined,
    validUntil: until.length === 10 ? until : undefined,
  };
  const idx = (state.paychecks ?? []).findIndex((x) => x.id === row.id);
  if (idx >= 0) state.paychecks![idx] = row;
  else state.paychecks = [...(state.paychecks ?? []), row].slice(0, 24);
  const newOverrides = collectMonthOverridesFromDialog(root, "paycheck", row.id) as IncomeMonthOverride[];
  state.incomeMonthOverrides = [
    ...(state.incomeMonthOverrides ?? []).filter((o) => o.paycheckId !== row.id),
    ...newOverrides,
  ];
  root.querySelector<HTMLDialogElement>("[data-et-dlg-paycheck]")?.close();
  persist();
  renderAll(root);
}

function deletePaycheckFromDialog(root: HTMLElement) {
  void (async () => {
    if (!editingPaycheckId) return;
    if (!(await showConfirmDialog(root, "¿Eliminar este ingreso previsto?", "Eliminar"))) return;
    state.paychecks = (state.paychecks ?? []).filter((x) => x.id !== editingPaycheckId);
    state.incomeMonthOverrides = (state.incomeMonthOverrides ?? []).filter((o) => o.paycheckId !== editingPaycheckId);
    root.querySelector<HTMLDialogElement>("[data-et-dlg-paycheck]")?.close();
    persist();
    renderAll(root);
  })();
}

function openPlannedDialog(root: HTMLElement, p?: PlannedExpenseEntry | null) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-planned]");
  const title = root.querySelector<HTMLElement>("[data-et-planned-dialog-title]");
  const idEl = root.querySelector<HTMLInputElement>("[data-et-planned-id]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-planned-category]");
  if (!dlg || !title || !idEl || !catEl) return;
  editingPlannedId = p?.id ?? null;
  title.textContent = p ? "Editar gasto previsto" : "Nuevo gasto previsto";
  if (!p?.id && !idEl.value) idEl.value = makeId();
  const entryId = p?.id ?? idEl.value;
  idEl.value = entryId;
  fillCategorySelect(catEl);
  (root.querySelector("[data-et-planned-title]") as HTMLInputElement).value = p?.title ?? "";
  (root.querySelector("[data-et-planned-amount]") as HTMLInputElement).value =
    p?.typicalAmount != null ? String(p.typicalAmount) : "";
  catEl.value = p?.categoryId ?? state.categories[0]!.id;
  (root.querySelector("[data-et-planned-min]") as HTMLInputElement).value =
    p?.amountMin != null ? String(p.amountMin) : "";
  (root.querySelector("[data-et-planned-max]") as HTMLInputElement).value =
    p?.amountMax != null ? String(p.amountMax) : "";
  (root.querySelector("[data-et-planned-day]") as HTMLInputElement).value = String(p?.dayOfMonth ?? 1);
  (root.querySelector("[data-et-planned-window]") as HTMLInputElement).value =
    p?.windowBefore != null ? String(p.windowBefore) : "";
  (root.querySelector("[data-et-planned-from]") as HTMLInputElement).value = (p?.validFrom ?? "").slice(0, 10);
  (root.querySelector("[data-et-planned-until]") as HTMLInputElement).value = (p?.validUntil ?? "").slice(0, 10);
  (root.querySelector("[data-et-planned-note]") as HTMLInputElement).value = p?.note ?? "";
  root.querySelector("[data-et-planned-delete]")?.classList.toggle("invisible", !p);
  const from = (p?.validFrom ?? "").slice(0, 10);
  const until = (p?.validUntil ?? "").slice(0, 10);
  const dayOfMonth = p?.dayOfMonth ?? 1;
  renderMonthOverrideList(root, "planned", entryId, from, until, dayOfMonth, p?.typicalAmount);
  bindMonthOverrideRefresh(root, "planned", entryId);
  dlg.showModal();
}

function savePlannedFromDialog(root: HTMLElement) {
  const idEl = root.querySelector<HTMLInputElement>("[data-et-planned-id]");
  const title = root.querySelector<HTMLInputElement>("[data-et-planned-title]")?.value?.trim() ?? "";
  const dayRaw = Number(root.querySelector<HTMLInputElement>("[data-et-planned-day]")?.value);
  const winRaw = root.querySelector<HTMLInputElement>("[data-et-planned-window]")?.value;
  const note = root.querySelector<HTMLInputElement>("[data-et-planned-note]")?.value?.trim() ?? "";
  const amt = Number(root.querySelector<HTMLInputElement>("[data-et-planned-amount]")?.value);
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
    id: idEl?.value || makeId(),
    title,
    dayOfMonth,
    windowBefore,
    note: note || undefined,
    typicalAmount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
    currency: "EUR",
    categoryId: catId,
    amountMin:
      minV != null && minV !== "" && Number.isFinite(Number(minV)) ? Math.max(0, Number(minV)) : undefined,
    amountMax:
      maxV != null && maxV !== "" && Number.isFinite(Number(maxV)) ? Math.max(0, Number(maxV)) : undefined,
    validFrom: from.length === 10 ? from : undefined,
    validUntil: until.length === 10 ? until : undefined,
  };
  const idx = (state.plannedExpenses ?? []).findIndex((x) => x.id === row.id);
  if (idx >= 0) state.plannedExpenses![idx] = row;
  else state.plannedExpenses = [...(state.plannedExpenses ?? []), row].slice(0, 24);
  const newOverrides = collectMonthOverridesFromDialog(root, "planned", row.id) as PlannedExpenseMonthOverride[];
  state.plannedExpenseMonthOverrides = [
    ...(state.plannedExpenseMonthOverrides ?? []).filter((o) => o.plannedExpenseId !== row.id),
    ...newOverrides,
  ];
  root.querySelector<HTMLDialogElement>("[data-et-dlg-planned]")?.close();
  persist();
  renderAll(root);
}

function deletePlannedFromDialog(root: HTMLElement) {
  void (async () => {
    if (!editingPlannedId) return;
    if (!(await showConfirmDialog(root, "¿Eliminar este gasto previsto?", "Eliminar"))) return;
    state.plannedExpenses = (state.plannedExpenses ?? []).filter((x) => x.id !== editingPlannedId);
    state.plannedExpenseMonthOverrides = (state.plannedExpenseMonthOverrides ?? []).filter(
      (o) => o.plannedExpenseId !== editingPlannedId,
    );
    root.querySelector<HTMLDialogElement>("[data-et-dlg-planned]")?.close();
    persist();
    renderAll(root);
  })();
}

function openInvestmentDialog(root: HTMLElement, h?: InvestmentHolding | null) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-investment]");
  const title = root.querySelector<HTMLElement>("[data-et-inv-dialog-title]");
  const idEl = root.querySelector<HTMLInputElement>("[data-et-inv-id]");
  if (!dlg || !title || !idEl) return;
  editingInvId = h?.id ?? null;
  title.textContent = h ? "Editar posición" : "Nueva posición";
  idEl.value = h?.id ?? "";
  (root.querySelector("[data-et-inv-name]") as HTMLInputElement).value = h?.name ?? "";
  (root.querySelector("[data-et-inv-type]") as HTMLSelectElement).value = h?.type ?? "stocks";
  (root.querySelector("[data-et-inv-platform]") as HTMLInputElement).value =
    h?.platform === "—" ? "" : (h?.platform ?? "");
  (root.querySelector("[data-et-inv-avg]") as HTMLInputElement).value =
    h?.avgBuyPrice != null ? String(h.avgBuyPrice) : "";
  (root.querySelector("[data-et-inv-qty]") as HTMLInputElement).value =
    h?.quantity != null ? String(h.quantity) : "";
  (root.querySelector("[data-et-inv-pnl]") as HTMLInputElement).value = h != null ? String(h.gainLossPct) : "";
  (root.querySelector("[data-et-inv-notes]") as HTMLTextAreaElement).value = h?.notes ?? "";
  const colorEl = root.querySelector<HTMLInputElement>("[data-et-inv-color]");
  if (colorEl) colorEl.value = parseCardColor(h?.cardColor) ?? "#8b5cf6";
  root.querySelector("[data-et-inv-delete]")?.classList.toggle("invisible", !h);
  updateInvTotalDisplay(root);
  const avgEl = root.querySelector<HTMLInputElement>("[data-et-inv-avg]");
  const qtyEl = root.querySelector<HTMLInputElement>("[data-et-inv-qty]");
  const onInvCalc = () => updateInvTotalDisplay(root);
  avgEl?.removeEventListener("input", onInvCalc);
  qtyEl?.removeEventListener("input", onInvCalc);
  avgEl?.addEventListener("input", onInvCalc);
  qtyEl?.addEventListener("input", onInvCalc);
  dlg.showModal();
}

function saveInvestmentFromDialog(root: HTMLElement) {
  const idEl = root.querySelector<HTMLInputElement>("[data-et-inv-id]");
  const name = root.querySelector<HTMLInputElement>("[data-et-inv-name]")?.value?.trim() ?? "";
  const typeRaw = root.querySelector<HTMLSelectElement>("[data-et-inv-type]")?.value ?? "other";
  const platform = root.querySelector<HTMLInputElement>("[data-et-inv-platform]")?.value?.trim() || "—";
  const avg = Number(root.querySelector<HTMLInputElement>("[data-et-inv-avg]")?.value);
  const qtyRaw = root.querySelector<HTMLInputElement>("[data-et-inv-qty]")?.value;
  const pnl = Number(root.querySelector<HTMLInputElement>("[data-et-inv-pnl]")?.value);
  const notes = root.querySelector<HTMLTextAreaElement>("[data-et-inv-notes]")?.value?.trim() ?? "";
  const cardColor = parseCardColor(root.querySelector<HTMLInputElement>("[data-et-inv-color]")?.value);
  if (!name) return;
  const quantity =
    qtyRaw != null && qtyRaw !== "" && Number.isFinite(Number(qtyRaw)) ? Math.max(0, Number(qtyRaw)) : 0;
  if (quantity <= 0) return;
  const avgBuyPrice = Number.isFinite(avg) && avg >= 0 ? avg : 0;
  const row: InvestmentHolding = {
    id: idEl?.value || makeId(),
    name,
    type: (["stocks", "ipo", "etf", "metals", "crypto", "bonds", "other"] as const).includes(typeRaw as any)
      ? (typeRaw as InvestmentHolding["type"])
      : "other",
    platform,
    avgBuyPrice,
    quantity,
    totalInvested: computeInvestmentTotalInvested(avgBuyPrice, quantity),
    gainLossPct: Number.isFinite(pnl) ? pnl : 0,
    notes: notes || undefined,
    cardColor,
  };
  const list = [...(state.investments ?? [])];
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  state.investments = list.slice(0, 48);
  root.querySelector<HTMLDialogElement>("[data-et-dlg-investment]")?.close();
  persist();
  renderAll(root);
}

function deleteInvestmentFromDialog(root: HTMLElement) {
  void (async () => {
    if (!editingInvId) return;
    if (!(await showConfirmDialog(root, "¿Eliminar esta posición?", "Eliminar"))) return;
    state.investments = (state.investments ?? []).filter((x) => x.id !== editingInvId);
    root.querySelector<HTMLDialogElement>("[data-et-dlg-investment]")?.close();
    persist();
    renderAll(root);
  })();
}

async function receivePaycheckToday(root: HTMLElement) {
  const today = todayIso();
  const mk = today.slice(0, 7);
  const paychecks = (state.paychecks ?? []).filter((p) => paycheckActiveInMonth(p, mk));
  if (!paychecks.length) {
    await showAlertDialog(
      root,
      "No hay nóminas activas este mes. Configúrala en la sección de ingresos previstos.",
    );
    return;
  }
  const paycheck =
    paychecks.length === 1
      ? paychecks[0]!
      : [...paychecks].sort((a, b) => (b.typicalAmount ?? 0) - (a.typicalAmount ?? 0))[0]!;
  const { amount, currency } = effectivePaycheckAmount(paycheck, mk, state.incomeMonthOverrides ?? []);
  if (amount <= 0) {
    await showAlertDialog(root, "El importe de la nómina este mes es 0 €.");
    return;
  }
  const row: IncomeAdhocRow = {
    id: makeId(),
    date: today,
    label: paycheck.title?.trim() || "Nómina",
    amount,
    currency,
    categoryId: state.categories[0]?.id ?? "cat_other",
    notes: paycheck.note?.trim() || undefined,
    tags: ["nómina"],
    attachments: [],
    confirmed: true,
    wealthAccountId: defaultWealthAccountId(state.wealthAccounts ?? [], "income"),
  };
  incomeAccountEffect(row, 1);
  state.incomeAdhoc = [...(state.incomeAdhoc ?? []), row].slice(0, 500);
  persist();
  renderAll(root);
}

function fillTransferAccountSelect(sel: HTMLSelectElement, selectedId?: string) {
  sel.innerHTML = "";
  const accounts = state.wealthAccounts ?? [];
  for (const a of accounts) {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = a.name;
    sel.appendChild(o);
  }
  if (selectedId && accounts.some((a) => a.id === selectedId)) sel.value = selectedId;
}

function openTransferDialog(root: HTMLElement) {
  const accounts = state.wealthAccounts ?? [];
  if (accounts.length < 2) {
    void showAlertDialog(root, "Necesitas al menos dos cuentas para registrar un traspaso.");
    return;
  }
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-transfer]");
  const fromSel = root.querySelector<HTMLSelectElement>("[data-et-transfer-from]");
  const toSel = root.querySelector<HTMLSelectElement>("[data-et-transfer-to]");
  const amtEl = root.querySelector<HTMLInputElement>("[data-et-transfer-amount]");
  const dateEl = root.querySelector<HTMLInputElement>("[data-et-transfer-date]");
  const noteEl = root.querySelector<HTMLInputElement>("[data-et-transfer-note]");
  if (!dlg || !fromSel || !toSel || !amtEl || !dateEl || !noteEl) return;
  const incomeId = defaultWealthAccountId(accounts, "income");
  const expenseId = defaultWealthAccountId(accounts, "expense");
  fillTransferAccountSelect(fromSel, incomeId ?? accounts[0]?.id);
  fillTransferAccountSelect(toSel, expenseId ?? accounts[1]?.id ?? accounts[0]?.id);
  amtEl.value = "";
  dateEl.value = todayIso();
  noteEl.value = "";
  dlg.showModal();
  initExpenseDatePickers(root);
}

function saveTransferFromDialog(root: HTMLElement) {
  const fromSel = root.querySelector<HTMLSelectElement>("[data-et-transfer-from]");
  const toSel = root.querySelector<HTMLSelectElement>("[data-et-transfer-to]");
  const amtEl = root.querySelector<HTMLInputElement>("[data-et-transfer-amount]");
  const dateEl = root.querySelector<HTMLInputElement>("[data-et-transfer-date]");
  const noteEl = root.querySelector<HTMLInputElement>("[data-et-transfer-note]");
  if (!fromSel || !toSel || !amtEl || !dateEl) return;
  const fromId = fromSel.value;
  const toId = toSel.value;
  const amount = Number(amtEl.value);
  const date = dateEl.value.slice(0, 10);
  if (!fromId || !toId || fromId === toId) {
    void showAlertDialog(root, "Elige dos cuentas distintas.");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    void showAlertDialog(root, "Indica un importe mayor que 0.");
    return;
  }
  if (date.length !== 10) {
    void showAlertDialog(root, "Indica una fecha válida.");
    return;
  }
  const rounded = Math.round(amount * 100) / 100;
  adjustWealthBalance(fromId, -rounded);
  adjustWealthBalance(toId, rounded);
  const transfer: WealthTransfer = {
    id: makeId(),
    date,
    fromAccountId: fromId,
    toAccountId: toId,
    amount: rounded,
    note: noteEl?.value?.trim() || undefined,
  };
  state.wealthTransfers = [...(state.wealthTransfers ?? []), transfer].slice(0, 500);
  root.querySelector<HTMLDialogElement>("[data-et-dlg-transfer]")?.close();
  persist();
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
    yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
              lines.push(`${r.marker ?? ""} ${r.seriesName ?? ""}: ${Number.isFinite(v) ? fmtEur(v) : ""}`);
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
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
      xAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
      xAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
      xAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
        yAxis: { type: "value", splitLine: { lineStyle: { color: borderSubtle() } }, axisLabel: { color: textMuted(), formatter: (v: number) => fmtNumEs(v) } },
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
  const cycleEl = root.querySelector<HTMLSelectElement>("[data-et-sub-cycle]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-sub-category]");
  const billEl = root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]");
  const activeEl = root.querySelector<HTMLInputElement>("[data-et-sub-active]");
  const tagsEl = root.querySelector<HTMLInputElement>("[data-et-sub-tags]");
  const notesEl = root.querySelector<HTMLTextAreaElement>("[data-et-sub-notes]");
  const delBtn = root.querySelector<HTMLButtonElement>("[data-et-sub-delete]");
  if (!dlg || !title || !idEl || !nameEl || !amountEl || !cycleEl || !catEl || !billEl || !activeEl || !tagsEl || !notesEl || !delBtn) return;

  editingSubId = sub?.id ?? null;
  title.textContent = sub ? "Editar suscripción" : "Nueva suscripción";
  idEl.value = sub?.id ?? "";
  nameEl.value = sub?.name ?? "";
  amountEl.value = String(sub?.amount ?? "");
  cycleEl.value = sub?.cycle ?? "monthly";
  fillCategorySelect(catEl);
  catEl.value = sub?.categoryId ?? state.categories[0]!.id;
  billEl.value = (sub?.billingStartDate || "").slice(0, 10);
  activeEl.checked = sub?.active !== false;
  tagsEl.value = (sub?.tags ?? []).join(", ");
  notesEl.value = sub?.notes ?? "";
  const colorEl = root.querySelector<HTMLInputElement>("[data-et-sub-color]");
  if (colorEl) colorEl.value = parseCardColor(sub?.cardColor) ?? "#6366f1";
  delBtn.classList.toggle("invisible", !sub);
  dlg.showModal();
  requestAnimationFrame(() => window.dispatchEvent(new Event("skillatlas:select-popovers-refresh")));
}

function saveSubFromDialog(root: HTMLElement) {
  const idEl = root.querySelector<HTMLInputElement>("[data-et-sub-id]");
  const nameEl = root.querySelector<HTMLInputElement>("[data-et-sub-name]");
  const amountEl = root.querySelector<HTMLInputElement>("[data-et-sub-amount]");
  const cycleEl = root.querySelector<HTMLSelectElement>("[data-et-sub-cycle]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-sub-category]");
  const billEl = root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]");
  const activeEl = root.querySelector<HTMLInputElement>("[data-et-sub-active]");
  const tagsEl = root.querySelector<HTMLInputElement>("[data-et-sub-tags]");
  const notesEl = root.querySelector<HTMLTextAreaElement>("[data-et-sub-notes]");
  if (!idEl || !nameEl || !amountEl || !cycleEl || !catEl || !billEl || !activeEl || !tagsEl || !notesEl) return;
  const name = nameEl.value.trim();
  const amount = Number(amountEl.value);
  if (!name || !Number.isFinite(amount)) return;
  const prev = state.subscriptions.find((s) => s.id === idEl.value);
  const cycRaw = cycleEl.value;
  const cycle = (["weekly", "monthly", "quarterly", "yearly"] as const).includes(cycRaw as any)
    ? (cycRaw as SubscriptionRow["cycle"])
    : "monthly";
  const tags = parseTags(tagsEl.value);
  pushTagBankFrom(tags);
  const cardColor = parseCardColor(root.querySelector<HTMLInputElement>("[data-et-sub-color]")?.value);
  const billingRaw = billEl.value.slice(0, 10);
  const billingStartDate = billingRaw.length === 10 ? billingRaw : undefined;
  const row: SubscriptionRow = {
    id: idEl.value || makeId(),
    name,
    amount,
    currency: "EUR",
    cycle,
    categoryId: catEl.value,
    billingStartDate,
    nextBilling: "",
    active: activeEl.checked,
    cancelEffectiveDate: activeEl.checked ? prev?.cancelEffectiveDate : undefined,
    notes: notesEl.value.trim(),
    tags,
    cardColor,
  };
  row.nextBilling = subscriptionNextChargeIso(row);
  if (!activeEl.checked) {
    row.cancelEffectiveDate = undefined;
  } else if (prev?.cancelEffectiveDate) {
    row.cancelEffectiveDate = row.nextBilling.slice(0, 10);
  }
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
  if (dot) {
    const active = state.syncToAccount || state.cloudE2E || pendingEncryptedRemote != null;
    const urgent = pendingEncryptedRemote != null;
    const color = urgent
      ? "bg-amber-500 ring-2 ring-amber-300/80 dark:bg-amber-400"
      : state.syncToAccount
        ? "bg-emerald-500 ring-2 ring-emerald-300/70 dark:bg-emerald-400"
        : "bg-amber-400 dark:bg-amber-500";
    const vis = active || !state.syncToAccount ? "opacity-100" : "opacity-0";
    dot.className = `relative inline-flex h-2 w-2 shrink-0 rounded-full ${color} ${vis}`;
  }
  const syncLabel = root.querySelector<HTMLElement>("[data-et-sync-label]");
  syncLabel?.setAttribute("data-sync-on", state.syncToAccount ? "true" : "false");
  updateSyncStripChrome(root);
}

function updateSyncStripChrome(root: HTMLElement) {
  const strip = root.querySelector<HTMLElement>("[data-et-sync-strip]");
  const stripToggle = root.querySelector<HTMLInputElement>("[data-et-sync-strip-toggle]");
  const hint = root.querySelector<HTMLElement>("[data-et-sync-strip-hint]");
  const title = root.querySelector<HTMLElement>("[data-et-sync-strip-title]");
  if (stripToggle) stripToggle.checked = state.syncToAccount;
  if (!strip) return;
  strip.setAttribute("data-sync-on", state.syncToAccount ? "true" : "false");
  strip.setAttribute("data-sync-off", state.syncToAccount ? "false" : "true");
  if (title) {
    title.textContent = state.syncToAccount
      ? "Copia en Supabase activa"
      : "Solo en este navegador (sin copia en la nube)";
  }
  if (hint) {
    hint.textContent = state.syncToAccount
      ? "Los cambios se guardan en tu cuenta. Borrados y altas se sincronizan al recargar en otro dispositivo con la misma sesión."
      : "Los datos solo viven aquí. Si borras gastos pero tenías una copia antigua en Supabase, pueden reaparecer al activar la sincronización.";
  }
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
  state.chartMoneyMode = "unify_eur";
  const sync = root.querySelector<HTMLInputElement>("[data-et-sync]");
  const syncStrip = root.querySelector<HTMLInputElement>("[data-et-sync-strip-toggle]");
  const cloudE2e = root.querySelector<HTMLInputElement>("[data-et-cloud-e2e]");
  const period = root.querySelector<HTMLSelectElement>("[data-et-period]");
  if (sync) sync.checked = state.syncToAccount;
  if (syncStrip) syncStrip.checked = state.syncToAccount;
  if (cloudE2e) cloudE2e.checked = state.cloudE2E;
  if (period) period.value = state.period;
  const patReal = root.querySelector<HTMLInputElement>("[data-et-patrimonio-real]");
  if (patReal) patReal.checked = Boolean(state.patrimonioRealMode);
  updatePatrimonioModeLabel(root);
  if (syncChartCategoryFilterSelect(root)) persist();
  updateE2eUnlockBanner(root);
  updateE2ePassphraseHint(root);
  updateSyncPopoverChrome(root);
  ensureMonthFilterInputs(root);

  const plannedSortBtn = root.querySelector<HTMLButtonElement>("[data-et-planned-sort]");
  if (plannedSortBtn) plannedSortBtn.textContent = plannedSortDesc ? "Orden: importe ↓" : "Orden: importe ↑";
  const paycheckSortBtn = root.querySelector<HTMLButtonElement>("[data-et-paycheck-sort]");
  if (paycheckSortBtn) paycheckSortBtn.textContent = paycheckSortDesc ? "Orden: importe ↓" : "Orden: importe ↑";

  renderKpis(root);
  renderWealthAccounts(root);
  renderSubs(root);
  renderInvestments(root);
  renderPlannedExpenses(root);
  renderPaychecks(root);
  renderExpenseTable(root);
  renderIncomeTable(root);
  renderReminders(root);
  renderReminderBanner(root);
  renderCharts(root);
  flashBrowserReminders(root);
  requestAnimationFrame(() => {
    initExpenseDatePickers(root);
    window.dispatchEvent(new Event("skillatlas:select-popovers-refresh"));
  });
}

function bindStripClicks(root: HTMLElement) {
  const strip = root.querySelector<HTMLElement>("[data-et-subs-strip]");
  if (!strip || strip.dataset.stripBound === "1") return;
  strip.dataset.stripBound = "1";
  strip.addEventListener("click", (e) => {
    const cancelBtn = (e.target as HTMLElement).closest("button[data-sub-cancel]");
    if (cancelBtn) {
      e.stopPropagation();
      e.preventDefault();
      const id = cancelBtn.getAttribute("data-sub-cancel");
      const idx = state.subscriptions.findIndex((x) => x.id === id);
      if (idx < 0) return;
      const s = state.subscriptions[idx]!;
      if (!s.active) {
        state.subscriptions[idx] = { ...s, active: true, cancelEffectiveDate: undefined };
      } else if (s.cancelEffectiveDate) {
        state.subscriptions[idx] = { ...s, cancelEffectiveDate: undefined };
      } else {
        state.subscriptions[idx] = scheduleSubscriptionCancel(s);
      }
      persist();
      renderAll(root);
      return;
    }
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

  const setSync = (on: boolean) => {
    state.syncToAccount = on;
    persist();
    renderAll(root);
  };

  root.querySelector<HTMLInputElement>("[data-et-sync]")?.addEventListener("change", (e) => {
    setSync((e.target as HTMLInputElement).checked);
  });

  root.querySelector<HTMLInputElement>("[data-et-sync-strip-toggle]")?.addEventListener("change", (e) => {
    setSync((e.target as HTMLInputElement).checked);
  });

  root.querySelector<HTMLButtonElement>("[data-et-wealth-transfer]")?.addEventListener("click", () =>
    openTransferDialog(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-transfer-save]")?.addEventListener("click", () =>
    saveTransferFromDialog(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-transfer-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-transfer]")?.close(),
  );

  root.querySelector<HTMLButtonElement>("[data-et-wealth-add]")?.addEventListener("click", () => {
    state.wealthAccounts = [
      ...(state.wealthAccounts ?? []),
      { id: makeId(), name: "Cuenta", balance: 0 },
    ].slice(0, 24);
    persist();
    renderWealthAccounts(root);
  });

  root.querySelector<HTMLElement>("[data-et-wealth-list]")?.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    const id = t.dataset.wealthName || t.dataset.wealthBalance || t.dataset.wealthIban;
    if (!id) return;
    const idx = (state.wealthAccounts ?? []).findIndex((a) => a.id === id);
    if (idx < 0) return;
    const row = { ...state.wealthAccounts![idx]! };
    if (t instanceof HTMLInputElement && t.dataset.wealthName) row.name = t.value.trim() || "Cuenta";
    if (t instanceof HTMLInputElement && t.dataset.wealthBalance) {
      const n = Number(t.value);
      row.balance = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
    }
    if (t instanceof HTMLInputElement && t.dataset.wealthIban) {
      row.ibanPrefix = t.value.trim().toUpperCase().slice(0, 4) || undefined;
      state.wealthAccounts![idx] = row;
      persist();
      const mask = root.querySelector<HTMLElement>(`[data-wealth-iban-mask="${id}"]`);
      if (mask) mask.textContent = formatIbanDisplay(row.ibanPrefix);
      return;
    }
    state.wealthAccounts![idx] = row;
    persist();
    renderPatrimonioKpi(root);
  });

  root.querySelector<HTMLElement>("[data-et-wealth-list]")?.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.wealthDefaultExpense) {
      const id = t.dataset.wealthDefaultExpense;
      state.wealthAccounts = (state.wealthAccounts ?? []).map((a) => ({
        ...a,
        isDefaultExpense: a.id === id,
      }));
      persist();
      renderWealthAccounts(root);
      return;
    }
    if (t.dataset.wealthDefaultIncome) {
      const id = t.dataset.wealthDefaultIncome;
      state.wealthAccounts = (state.wealthAccounts ?? []).map((a) => ({
        ...a,
        isDefaultIncome: a.id === id,
      }));
      persist();
      renderWealthAccounts(root);
    }
  });

  root.querySelector<HTMLElement>("[data-et-wealth-list]")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-wealth-delete]");
    if (btn) return;
    const recon = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-wealth-reconcile]");
    if (!recon) return;
    const id = recon.dataset.wealthReconcile;
    if (!id) return;
    const acc = (state.wealthAccounts ?? []).find((a) => a.id === id);
    if (!acc) return;
    const raw = window.prompt(`Saldo real en «${acc.name}» (€):`, String(acc.balance));
    if (raw == null) return;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    const idx = state.wealthAccounts!.findIndex((a) => a.id === id);
    if (idx < 0) return;
    state.wealthAccounts![idx] = { ...state.wealthAccounts![idx]!, balance: Math.round(n * 100) / 100 };
    persist();
    renderWealthAccounts(root);
  });

  root.querySelector<HTMLElement>("[data-et-wealth-list]")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-wealth-delete]");
    if (!btn) return;
    const id = btn.dataset.wealthDelete;
    if (!id) return;
    state.wealthAccounts = (state.wealthAccounts ?? []).filter((a) => a.id !== id);
    persist();
    renderWealthAccounts(root);
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

  root.querySelector<HTMLSelectElement>("[data-et-period]")?.addEventListener("change", (e) => {
    state.period = (e.target as HTMLSelectElement).value as ExpenseTrackerState["period"];
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLInputElement>("[data-et-patrimonio-real]")?.addEventListener("change", (e) => {
    state.patrimonioRealMode = (e.target as HTMLInputElement).checked;
    persist();
    updatePatrimonioModeLabel(root);
    renderPatrimonioKpi(root);
  });

  root.querySelector<HTMLButtonElement>("[data-et-paycheck-received]")?.addEventListener("click", () => {
    void receivePaycheckToday(root);
  });

  root.querySelector<HTMLSelectElement>("[data-et-chart-cat-filter]")?.addEventListener("change", (e) => {
    state.chartFilterCategoryId = (e.target as HTMLSelectElement).value;
    persist();
    renderAll(root);
  });

  root.querySelector<HTMLButtonElement>("[data-et-open-paycheck-modal]")?.addEventListener("click", () =>
    openPaycheckDialog(root, null),
  );
  root.querySelector<HTMLButtonElement>("[data-et-open-planned-modal]")?.addEventListener("click", () =>
    openPlannedDialog(root, null),
  );
  root.querySelector<HTMLButtonElement>("[data-et-open-inv-modal]")?.addEventListener("click", () =>
    openInvestmentDialog(root, null),
  );
  root.querySelector<HTMLButtonElement>("[data-et-paycheck-sort]")?.addEventListener("click", () => {
    paycheckSortDesc = !paycheckSortDesc;
    renderPaychecks(root);
  });
  root.querySelector<HTMLButtonElement>("[data-et-planned-sort]")?.addEventListener("click", () => {
    plannedSortDesc = !plannedSortDesc;
    renderPlannedExpenses(root);
  });

  root.querySelector<HTMLButtonElement>("[data-et-paycheck-save]")?.addEventListener("click", () =>
    savePaycheckFromDialog(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-paycheck-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-paycheck]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-paycheck-delete]")?.addEventListener("click", () =>
    deletePaycheckFromDialog(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-planned-save]")?.addEventListener("click", () =>
    savePlannedFromDialog(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-planned-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-planned]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-planned-delete]")?.addEventListener("click", () =>
    deletePlannedFromDialog(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-inv-save]")?.addEventListener("click", () =>
    saveInvestmentFromDialog(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-inv-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-investment]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-inv-delete]")?.addEventListener("click", () =>
    deleteInvestmentFromDialog(root),
  );

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
