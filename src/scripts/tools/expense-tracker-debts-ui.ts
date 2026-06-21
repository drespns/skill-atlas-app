import {
  formatEurEs,
  type ExpenseTrackerState,
  type WealthBizum,
} from "@lib/tools-expense-tracker";
import {
  payDebtInstallment,
  summarizeDebt,
  debtDeclaredTotal,
  isInstallmentPaymentLinked,
  type ExpenseDebt,
  type DebtInstallment,
  type DebtPaymentMethod,
  type DebtScope,
} from "@lib/tools-expense-debts";
import {
  initExpenseDatePickers,
  readDateFieldValue,
  refreshExpenseDatePicker,
  showExpenseDialog,
} from "./expense-tracker-dates";

export type DebtUiDeps = {
  getState: () => ExpenseTrackerState;
  setState: (s: ExpenseTrackerState) => void;
  persist: () => void;
  renderAll: (root: HTMLElement) => void;
  showConfirmDialog: (root: HTMLElement, msg: string, okLabel?: string) => Promise<boolean>;
  fillCategorySelect: (sel: HTMLSelectElement) => void;
  fillWealthAccountSelect: (sel: HTMLSelectElement, selectedId?: string, role?: "expense" | "income") => void;
  makeId: () => string;
  makeExpenseId: () => string;
  makeBizumId: () => string;
  listLinkableBizums: (amount: number) => WealthBizum[];
  scrollToExpense?: (expenseId: string) => void;
  openBizumDialog?: (bizumId: string) => void;
  bookExpense?: (expense: import("@lib/tools-expense-tracker").ExpenseRow) => void;
  bookBizum?: (bizum: WealthBizum) => void;
};

function formatDateEs(iso: string): string {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function readDebtTotalInput(root: HTMLElement): number {
  const v = Number(root.querySelector<HTMLInputElement>("[data-et-debt-total]")?.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function readDebtScope(root: HTMLElement): DebtScope {
  const checked = root.querySelector<HTMLInputElement>("[data-et-debt-scope]:checked");
  return checked?.value === "family" ? "family" : "personal";
}

function syncDebtScopeFields(root: HTMLElement) {
  const scope = readDebtScope(root);
  const wrap = root.querySelector<HTMLElement>("[data-et-debt-counterparty-wrap]");
  const hint = root.querySelector<HTMLElement>("[data-et-debt-plan-hint]");
  wrap?.classList.toggle("hidden", scope !== "family");
  if (hint) {
    hint.textContent =
      scope === "family"
        ? "Deudas familiares: al pagar usa Bizum (no dupliques en Gastos). Puedes añadir cuotas ya pagadas y vincular el Bizum después."
        : "Indica cuándo estimas pagar cada cuota. Al marcar «Pagado», elige gasto confirmado o Bizum.";
  }
}

function readDebtPayMethod(root: HTMLElement): DebtPaymentMethod {
  const checked = root.querySelector<HTMLInputElement>("[data-et-debt-pay-method]:checked");
  const v = checked?.value;
  if (v === "expense" || v === "bizum" || v === "linked") return v;
  return "bizum";
}

function syncDebtPayDialog(root: HTMLElement, debt: ExpenseDebt, inst: DebtInstallment) {
  const scope = debt.scope ?? "personal";
  const method = readDebtPayMethod(root);
  const expenseWrap = root.querySelector<HTMLElement>("[data-et-debt-pay-method-expense-wrap]");
  expenseWrap?.classList.toggle("hidden", scope === "family");

  const linkWrap = root.querySelector<HTMLElement>("[data-et-debt-pay-link-wrap]");
  const dateWrap = root.querySelector<HTMLElement>("[data-et-debt-pay-date-wrap]");
  const wealthWrap = root.querySelector<HTMLElement>("[data-et-debt-pay-wealth-wrap]");
  const bizumNoteWrap = root.querySelector<HTMLElement>("[data-et-debt-pay-bizum-note-wrap]");
  const labelWrap = root.querySelector<HTMLElement>("[data-et-debt-pay-label-wrap]");
  const confirmBtn = root.querySelector<HTMLButtonElement>("[data-et-debt-pay-confirm]");

  const isLinked = method === "linked";
  const isBizum = method === "bizum";
  const isExpense = method === "expense";

  linkWrap?.classList.toggle("hidden", !isLinked);
  dateWrap?.classList.toggle("hidden", isLinked);
  wealthWrap?.classList.toggle("hidden", isLinked);
  bizumNoteWrap?.classList.toggle("hidden", !isBizum);
  labelWrap?.classList.toggle("hidden", !isExpense);

  if (confirmBtn) {
    if (isExpense) confirmBtn.textContent = "Pagado → Gastos";
    else if (isLinked) confirmBtn.textContent = "Vincular Bizum";
    else confirmBtn.textContent = "Registrar Bizum";
  }
}

function sumAllInstallmentAmounts(root: HTMLElement): number {
  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (!host) return 0;
  let total = 0;
  host.querySelectorAll<HTMLElement>("[data-et-debt-installment-row]").forEach((row) => {
    total += Math.max(0, Number(row.querySelector<HTMLInputElement>("[data-et-debt-inst-amount]")?.value));
  });
  return total;
}

function updateDebtTotalPreview(root: HTMLElement) {
  const declared = readDebtTotalInput(root);
  const assigned = sumAllInstallmentAmounts(root);
  const unassigned = Math.max(0, declared - assigned);

  const totalEl = root.querySelector<HTMLElement>("[data-et-debt-total-preview]");
  const assignedEl = root.querySelector<HTMLElement>("[data-et-debt-assigned-preview]");
  const unassignedEl = root.querySelector<HTMLElement>("[data-et-debt-unassigned-preview]");
  if (totalEl) totalEl.textContent = `Total deuda: ${formatEurEs(declared)}`;
  if (assignedEl) assignedEl.textContent = `Repartido en cuotas: ${formatEurEs(assigned)}`;
  if (unassignedEl) {
    unassignedEl.textContent = `Pendiente por asignar: ${formatEurEs(unassigned)}`;
    unassignedEl.classList.toggle("text-amber-700", unassigned > 0.009);
    unassignedEl.classList.toggle("dark:text-amber-300", unassigned > 0.009);
    unassignedEl.classList.toggle("font-semibold", unassigned > 0.009);
    unassignedEl.classList.toggle("text-gray-600", unassigned <= 0.009);
    unassignedEl.classList.toggle("dark:text-gray-400", unassigned <= 0.009);
  }
}

function refreshDebtDialogDatePickers(root: HTMLElement) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-debt]");
  if (dlg) queueMicrotask(() => initExpenseDatePickers(dlg));
}

function splitDebtInstallmentsEqually(root: HTMLElement) {
  const total = readDebtTotalInput(root);
  if (!(total > 0)) return;
  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (!host) return;
  const pendingRows = [...host.querySelectorAll<HTMLElement>("[data-et-debt-installment-row]")].filter(
    (row) => row.dataset.paid !== "1" && row.dataset.prepaid !== "1",
  );
  if (!pendingRows.length) return;
  const per = Math.round((total / pendingRows.length) * 100) / 100;
  let remainder = Math.round((total - per * pendingRows.length) * 100) / 100;
  pendingRows.forEach((row, idx) => {
    const amountEl = row.querySelector<HTMLInputElement>("[data-et-debt-inst-amount]");
    if (!amountEl) return;
    const extra = idx === pendingRows.length - 1 ? remainder : 0;
    amountEl.value = String(Math.round((per + extra) * 100) / 100);
  });
  updateDebtTotalPreview(root);
}

function addDebtInstallmentRow(
  root: HTMLElement,
  deps: DebtUiDeps,
  inst?: Partial<DebtInstallment>,
  opts?: { prepaid?: boolean },
) {
  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (!host) return;
  const isLockedPaid = inst?.status === "paid" && isInstallmentPaymentLinked(inst as DebtInstallment);
  const isPrepaid = opts?.prepaid || (inst?.status === "paid" && !isInstallmentPaymentLinked(inst as DebtInstallment));
  const row = document.createElement("div");
  row.className =
    "grid grid-cols-[7.5rem_6.5rem_1fr_auto] gap-2 items-end rounded-lg border border-gray-200/80 dark:border-gray-800/80 p-2";
  row.dataset.etDebtInstallmentRow = "";
  row.dataset.installmentRowId = inst?.id ?? deps.makeId();
  if (isLockedPaid) row.dataset.paid = "1";
  if (isPrepaid) row.dataset.prepaid = "1";
  const dateLabel = isPrepaid || isLockedPaid ? "Fecha pago" : "Fecha estimada";
  const disabled = isLockedPaid ? "disabled" : "";
  row.innerHTML = `
    <label class="space-y-0.5">
      <span class="text-[10px] font-semibold text-gray-500">${dateLabel}</span>
      <input type="date" data-et-debt-inst-date class="et-field et-date w-full text-sm py-1.5" value="${(isPrepaid ? inst?.paidDate ?? inst?.dueDate : inst?.dueDate)?.slice(0, 10) ?? ""}" ${disabled} />
    </label>
    <label class="space-y-0.5">
      <span class="text-[10px] font-semibold text-gray-500">Importe €</span>
      <input type="number" step="0.01" min="0" data-et-debt-inst-amount class="et-field w-full text-sm py-1.5 font-mono" value="${inst?.amount ?? ""}" ${disabled} />
    </label>
    <label class="space-y-0.5 min-w-0">
      <span class="text-[10px] font-semibold text-gray-500">Etiqueta (opc.)</span>
      <input type="text" data-et-debt-inst-label class="et-field w-full text-sm py-1.5" value="${(inst?.label ?? "").replace(/"/g, "&quot;")}" ${disabled} />
    </label>
    ${
      isLockedPaid
        ? `<span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 pb-2">Pagada</span>`
        : isPrepaid
          ? `<button type="button" data-et-debt-inst-remove class="et-btn-secondary text-xs py-1.5 mb-0.5">×</button>`
          : `<button type="button" data-et-debt-inst-remove class="et-btn-secondary text-xs py-1.5 mb-0.5">×</button>`
    }`;
  row.querySelector("[data-et-debt-inst-remove]")?.addEventListener("click", () => {
    row.remove();
    updateDebtTotalPreview(root);
  });
  row.querySelectorAll("input").forEach((inp) =>
    inp.addEventListener("input", () => updateDebtTotalPreview(root)),
  );
  host.appendChild(row);
  const dateEl = row.querySelector<HTMLInputElement>("[data-et-debt-inst-date]");
  if (dateEl && !isLockedPaid) refreshExpenseDatePicker(dateEl, dateEl.value);
  updateDebtTotalPreview(root);
}

function readDebtInstallmentsFromDialog(root: HTMLElement, deps: DebtUiDeps, existing?: ExpenseDebt): DebtInstallment[] {
  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (!host) return [];
  const paidById = new Map((existing?.installments ?? []).filter((i) => i.status === "paid" && isInstallmentPaymentLinked(i)).map((i) => [i.id, i]));
  const rows: DebtInstallment[] = [];
  host.querySelectorAll<HTMLElement>("[data-et-debt-installment-row]").forEach((row) => {
    const id = row.dataset.installmentRowId || deps.makeId();
    const prev = paidById.get(id);
    if (prev) {
      rows.push(prev);
      return;
    }
    const label = row.querySelector<HTMLInputElement>("[data-et-debt-inst-label]")?.value?.trim();
    const amount = Number(row.querySelector<HTMLInputElement>("[data-et-debt-inst-amount]")?.value);
    const dateRaw = readDateFieldValue(row.querySelector<HTMLInputElement>("[data-et-debt-inst-date]"));
    if (!dateRaw || !(amount > 0)) return;
    if (row.dataset.prepaid === "1") {
      rows.push({
        id,
        label: label || undefined,
        amount,
        dueDate: dateRaw,
        status: "paid",
        paidDate: dateRaw,
      });
      return;
    }
    rows.push({
      id,
      label: label || undefined,
      amount,
      dueDate: dateRaw,
      status: "pending",
    });
  });
  return rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

export function openDebtDialog(root: HTMLElement, deps: DebtUiDeps, debt: ExpenseDebt | null) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-debt]");
  const title = root.querySelector<HTMLElement>("[data-et-debt-dialog-title]");
  const idEl = root.querySelector<HTMLInputElement>("[data-et-debt-id]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-debt-category]");
  const delBtn = root.querySelector<HTMLButtonElement>("[data-et-debt-delete]");
  const totalEl = root.querySelector<HTMLInputElement>("[data-et-debt-total]");
  if (!dlg || !title || !idEl || !catEl || !delBtn || !totalEl) return;

  title.textContent = debt ? "Editar deuda" : "Nueva deuda";
  idEl.value = debt?.id ?? "";
  deps.fillCategorySelect(catEl);
  catEl.value = debt?.categoryId ?? deps.getState().categories[0]!.id;
  (root.querySelector("[data-et-debt-title]") as HTMLInputElement).value = debt?.title ?? "";
  (root.querySelector("[data-et-debt-note]") as HTMLInputElement).value = debt?.note ?? "";
  (root.querySelector("[data-et-debt-counterparty]") as HTMLInputElement).value = debt?.counterparty ?? "";
  const scopeVal = debt?.scope ?? "personal";
  root.querySelectorAll<HTMLInputElement>("[data-et-debt-scope]").forEach((r) => {
    r.checked = r.value === scopeVal;
  });
  syncDebtScopeFields(root);
  delBtn.classList.toggle("invisible", !debt);

  const declared = debt ? debtDeclaredTotal(debt) : 0;
  totalEl.value = declared > 0 ? String(declared) : "";

  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (host) {
    host.innerHTML = "";
    const items = debt?.installments ?? [];
    if (items.length) {
      items.forEach((it) => {
        const prepaid = it.status === "paid" && !isInstallmentPaymentLinked(it);
        addDebtInstallmentRow(root, deps, it, { prepaid });
      });
    } else addDebtInstallmentRow(root, deps);
  }

  updateDebtTotalPreview(root);
  showExpenseDialog(dlg);
  refreshDebtDialogDatePickers(root);
}

function saveDebtFromDialog(root: HTMLElement, deps: DebtUiDeps) {
  const state = deps.getState();
  const id = root.querySelector<HTMLInputElement>("[data-et-debt-id]")?.value?.trim();
  const title = root.querySelector<HTMLInputElement>("[data-et-debt-title]")?.value?.trim() ?? "";
  if (!title) return;
  const totalAmount = readDebtTotalInput(root);
  if (!(totalAmount > 0)) return;
  const existing = (state.debts ?? []).find((d) => d.id === id);
  const installments = readDebtInstallmentsFromDialog(root, deps, existing);
  if (!installments.length) return;
  const scope = readDebtScope(root);
  const counterparty =
    scope === "family"
      ? root.querySelector<HTMLInputElement>("[data-et-debt-counterparty]")?.value?.trim() || undefined
      : undefined;

  const row: ExpenseDebt = {
    id: id || deps.makeId(),
    title,
    categoryId: root.querySelector<HTMLSelectElement>("[data-et-debt-category]")?.value,
    note: root.querySelector<HTMLInputElement>("[data-et-debt-note]")?.value?.trim() || undefined,
    currency: "EUR",
    totalAmount,
    installments,
    createdAt: existing?.createdAt ?? new Date().toISOString().slice(0, 10),
    scope,
    counterparty,
  };

  const list = [...(state.debts ?? [])];
  const idx = list.findIndex((d) => d.id === row.id);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  deps.setState({ ...state, debts: list });
  deps.persist();
  root.querySelector<HTMLDialogElement>("[data-et-dlg-debt]")?.close();
  deps.renderAll(root);
}

async function deleteDebtFromDialog(root: HTMLElement, deps: DebtUiDeps) {
  const id = root.querySelector<HTMLInputElement>("[data-et-debt-id]")?.value?.trim();
  if (!id) return;
  if (!(await deps.showConfirmDialog(root, "¿Eliminar esta deuda y sus cuotas?", "Eliminar"))) return;
  const state = deps.getState();
  deps.setState({ ...state, debts: (state.debts ?? []).filter((d) => d.id !== id) });
  deps.persist();
  root.querySelector<HTMLDialogElement>("[data-et-dlg-debt]")?.close();
  deps.renderAll(root);
}

function fillLinkableBizumSelect(root: HTMLElement, deps: DebtUiDeps, amount: number) {
  const sel = root.querySelector<HTMLSelectElement>("[data-et-debt-pay-link-bizum]");
  if (!sel) return;
  const items = deps.listLinkableBizums(amount);
  sel.innerHTML = "";
  if (!items.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay bizums disponibles (últimos 30 días)";
    sel.appendChild(opt);
    return;
  }
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Elige un bizum…";
  sel.appendChild(placeholder);
  for (const b of items) {
    const opt = document.createElement("option");
    opt.value = b.id;
    const note = b.note ? ` · ${b.note}` : "";
    opt.textContent = `${formatDateEs(b.date)} · ${formatEurEs(b.amount)}${note}`;
    sel.appendChild(opt);
  }
}

export function openDebtPayDialog(
  root: HTMLElement,
  deps: DebtUiDeps,
  debtId: string,
  installmentId: string,
) {
  const state = deps.getState();
  const debt = (state.debts ?? []).find((d) => d.id === debtId);
  const inst = debt?.installments.find((i) => i.id === installmentId);
  if (!debt || !inst) return;
  const canPay = inst.status === "pending" || (inst.status === "paid" && !isInstallmentPaymentLinked(inst));
  if (!canPay) return;

  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-debt-pay]");
  const summary = root.querySelector<HTMLElement>("[data-et-debt-pay-summary]");
  if (!dlg || !summary) return;

  root.querySelector<HTMLInputElement>("[data-et-debt-pay-debt-id]")!.value = debtId;
  root.querySelector<HTMLInputElement>("[data-et-debt-pay-installment-id]")!.value = installmentId;
  summary.textContent = `${debt.title}${inst.label ? ` · ${inst.label}` : ""} — ${formatEurEs(inst.amount)}`;

  const scope = debt.scope ?? "personal";
  const defaultMethod: DebtPaymentMethod = scope === "family" ? "bizum" : "expense";
  root.querySelectorAll<HTMLInputElement>("[data-et-debt-pay-method]").forEach((r) => {
    r.checked = r.value === defaultMethod;
  });

  const dateEl = root.querySelector<HTMLInputElement>("[data-et-debt-pay-date]")!;
  dateEl.value = inst.paidDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const labelEl = root.querySelector<HTMLInputElement>("[data-et-debt-pay-label]")!;
  labelEl.value = inst.label ? `${debt.title} — ${inst.label}` : debt.title;
  const bizumNoteEl = root.querySelector<HTMLInputElement>("[data-et-debt-pay-bizum-note]")!;
  bizumNoteEl.value = debt.counterparty || debt.title;

  const wealthSel = root.querySelector<HTMLSelectElement>("[data-et-debt-pay-wealth]")!;
  deps.fillWealthAccountSelect(wealthSel, undefined, "expense");
  fillLinkableBizumSelect(root, deps, inst.amount);
  syncDebtPayDialog(root, debt, inst);

  showExpenseDialog(dlg);
}

function confirmDebtPay(root: HTMLElement, deps: DebtUiDeps) {
  const debtId = root.querySelector<HTMLInputElement>("[data-et-debt-pay-debt-id]")?.value?.trim();
  const installmentId = root.querySelector<HTMLInputElement>("[data-et-debt-pay-installment-id]")?.value?.trim();
  if (!debtId || !installmentId) return;

  const state = deps.getState();
  const debt = (state.debts ?? []).find((d) => d.id === debtId);
  const inst = debt?.installments.find((i) => i.id === installmentId);
  if (!debt || !inst) return;

  let method = readDebtPayMethod(root);
  if ((debt.scope ?? "personal") === "family" && method === "expense") method = "bizum";

  const paidDate = readDateFieldValue(root.querySelector<HTMLInputElement>("[data-et-debt-pay-date]"));
  const wealthAccountId = root.querySelector<HTMLSelectElement>("[data-et-debt-pay-wealth]")?.value || undefined;
  const labelOverride = root.querySelector<HTMLInputElement>("[data-et-debt-pay-label]")?.value?.trim();
  const counterpartyNote = root.querySelector<HTMLInputElement>("[data-et-debt-pay-bizum-note]")?.value?.trim();
  const existingBizumId = root.querySelector<HTMLSelectElement>("[data-et-debt-pay-link-bizum]")?.value?.trim();

  if (method === "linked" && !existingBizumId) return;
  if ((method === "bizum" || method === "expense") && !wealthAccountId) return;

  const prevBizumsLen = (state.wealthBizums ?? []).length;

  const next = payDebtInstallment(deps.getState(), debtId, installmentId, deps.makeExpenseId, deps.makeBizumId, {
    paidDate,
    method,
    wealthAccountId,
    labelOverride,
    counterpartyNote,
    existingBizumId: method === "linked" ? existingBizumId : undefined,
  });
  if (!next) return;

  const updatedInst = next.debts?.find((d) => d.id === debtId)?.installments.find((i) => i.id === installmentId);

  if (method === "expense" && updatedInst?.expenseId) {
    const expense = next.expenses.find((e) => e.id === updatedInst.expenseId);
    if (expense) deps.bookExpense?.(expense);
  } else if (method === "bizum" && (next.wealthBizums ?? []).length > prevBizumsLen) {
    const bizum = next.wealthBizums!.at(-1)!;
    deps.bookBizum?.(bizum);
  }

  deps.setState(next);
  deps.persist();
  root.querySelector<HTMLDialogElement>("[data-et-dlg-debt-pay]")?.close();
  deps.renderAll(root);

  if (updatedInst?.expenseId && deps.scrollToExpense) deps.scrollToExpense(updatedInst.expenseId);
  else if (updatedInst?.bizumId && deps.openBizumDialog) deps.openBizumDialog(updatedInst.bizumId);
}

function paymentMethodLabel(inst: DebtInstallment): string {
  if (inst.paymentMethod === "linked") return "Bizum vinculado";
  if (inst.paymentMethod === "bizum") return "Bizum";
  if (inst.paymentMethod === "expense") return "Gasto";
  return "";
}

export function renderDebtsSection(root: HTMLElement, deps: DebtUiDeps) {
  const list = root.querySelector<HTMLElement>("[data-et-debts-list]");
  if (!list) return;
  list.innerHTML = "";
  const debts = deps.getState().debts ?? [];

  if (!debts.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 col-span-full py-2";
    empty.textContent = "No hay deudas pendientes. Añade el importe total y planifica las cuotas con fechas.";
    list.appendChild(empty);
    return;
  }

  for (const debt of debts) {
    const sum = summarizeDebt(debt);
    const card = document.createElement("article");
    card.className =
      "rounded-2xl border border-amber-200/60 dark:border-amber-800/45 bg-white/85 dark:bg-gray-950/55 shadow-sm p-3 space-y-2 flex flex-col";

    const head = document.createElement("div");
    head.className = "flex items-start justify-between gap-2";
    const titleWrap = document.createElement("div");
    titleWrap.className = "min-w-0";
    const title = document.createElement("p");
    title.className = "m-0 font-semibold text-gray-900 dark:text-gray-50 truncate";
    title.textContent = debt.title;
    titleWrap.appendChild(title);
    if (debt.scope === "family") {
      const sub = document.createElement("p");
      sub.className = "m-0 text-[10px] text-violet-700 dark:text-violet-300 font-medium";
      sub.textContent = debt.counterparty ? `Familiar · ${debt.counterparty}` : "Familiar";
      titleWrap.appendChild(sub);
    }
    const badges = document.createElement("div");
    badges.className = "flex flex-col items-end gap-1 shrink-0";
    if (debt.scope === "family") {
      const famBadge = document.createElement("span");
      famBadge.className =
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200";
      famBadge.textContent = "Familia";
      badges.appendChild(famBadge);
    }
    const statusBadge = document.createElement("span");
    const allPaid = sum.pending <= 0;
    statusBadge.className = allPaid
      ? "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
      : "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
    statusBadge.textContent = allPaid ? "Liquidada" : `Pendiente ${formatEurEs(sum.pending)}`;
    badges.appendChild(statusBadge);
    head.append(titleWrap, badges);

    const progress = document.createElement("div");
    progress.className = "space-y-1";
    progress.innerHTML = `
      <div class="h-1.5 rounded-full bg-gray-200/80 dark:bg-gray-800 overflow-hidden">
        <div class="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all" style="width:${Math.min(100, sum.progressPct)}%"></div>
      </div>
      <p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">${formatEurEs(sum.paid)} de ${formatEurEs(sum.total)} pagado${sum.nextDue ? ` · Próxima: ${formatDateEs(sum.nextDue)}` : ""}</p>`;

    const instList = document.createElement("ul");
    instList.className = "m-0 p-0 list-none space-y-1.5 text-xs";
    for (const inst of debt.installments) {
      const li = document.createElement("li");
      li.className =
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200/70 dark:border-gray-800/70 px-2 py-1.5";
      const left = document.createElement("div");
      left.className = "min-w-0";
      const methodLbl = inst.status === "paid" ? paymentMethodLabel(inst) : "";
      left.innerHTML = `<p class="m-0 font-medium text-gray-800 dark:text-gray-200 truncate">${inst.label || "Cuota"} · ${formatEurEs(inst.amount)}</p>
        <p class="m-0 text-[10px] text-gray-500">${formatDateEs(inst.dueDate)}${inst.status === "paid" && inst.paidDate ? ` · Pagado ${formatDateEs(inst.paidDate)}` : ""}${methodLbl ? ` · ${methodLbl}` : ""}</p>`;
      li.appendChild(left);

      if (inst.status === "paid" && isInstallmentPaymentLinked(inst)) {
        const link = document.createElement("button");
        link.type = "button";
        link.className = "text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0";
        if (inst.expenseId) {
          link.textContent = "Ver gasto";
          link.addEventListener("click", () => deps.scrollToExpense?.(inst.expenseId!));
        } else if (inst.bizumId) {
          link.textContent = "Ver bizum";
          link.addEventListener("click", () => deps.openBizumDialog?.(inst.bizumId!));
        } else {
          link.textContent = "Pagada";
        }
        li.appendChild(link);
      } else if (inst.status === "paid" && !isInstallmentPaymentLinked(inst)) {
        const linkBtn = document.createElement("button");
        linkBtn.type = "button";
        linkBtn.className = "et-btn-secondary text-[10px] py-1 px-2 shrink-0";
        linkBtn.textContent = "Vincular pago";
        linkBtn.addEventListener("click", () => openDebtPayDialog(root, deps, debt.id, inst.id));
        li.appendChild(linkBtn);
      } else {
        const payBtn = document.createElement("button");
        payBtn.type = "button";
        payBtn.className = "et-btn-accent text-[10px] py-1 px-2 shrink-0";
        payBtn.textContent = "Pagado";
        payBtn.addEventListener("click", () => openDebtPayDialog(root, deps, debt.id, inst.id));
        li.appendChild(payBtn);
      }
      instList.appendChild(li);
    }

    const actions = document.createElement("div");
    actions.className = "flex gap-1.5 pt-1 mt-auto";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "et-btn-secondary text-[11px] py-1";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => openDebtDialog(root, deps, debt));
    actions.appendChild(editBtn);

    card.append(head, progress, instList, actions);
    list.appendChild(card);
  }
}

export function bindDebtsUi(root: HTMLElement, deps: DebtUiDeps) {
  if (root.dataset.etDebtsBound === "1") return;
  root.dataset.etDebtsBound = "1";

  root.querySelector<HTMLButtonElement>("[data-et-open-debt-modal]")?.addEventListener("click", () =>
    openDebtDialog(root, deps, null),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-installment-add]")?.addEventListener("click", () =>
    addDebtInstallmentRow(root, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-installment-add-paid]")?.addEventListener("click", () =>
    addDebtInstallmentRow(root, deps, undefined, { prepaid: true }),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-installment-split]")?.addEventListener("click", () =>
    splitDebtInstallmentsEqually(root),
  );
  root.querySelectorAll<HTMLInputElement>("[data-et-debt-scope]").forEach((r) =>
    r.addEventListener("change", () => syncDebtScopeFields(root)),
  );
  root.querySelector<HTMLInputElement>("[data-et-debt-total]")?.addEventListener("input", () =>
    updateDebtTotalPreview(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-save]")?.addEventListener("click", () =>
    saveDebtFromDialog(root, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-debt]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-delete]")?.addEventListener("click", () =>
    deleteDebtFromDialog(root, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-pay-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-debt-pay]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-debt-pay-confirm]")?.addEventListener("click", () =>
    confirmDebtPay(root, deps),
  );
  root.querySelectorAll<HTMLInputElement>("[data-et-debt-pay-method]").forEach((r) =>
    r.addEventListener("change", () => {
      const debtId = root.querySelector<HTMLInputElement>("[data-et-debt-pay-debt-id]")?.value;
      const instId = root.querySelector<HTMLInputElement>("[data-et-debt-pay-installment-id]")?.value;
      const debt = deps.getState().debts?.find((d) => d.id === debtId);
      const inst = debt?.installments.find((i) => i.id === instId);
      if (debt && inst) syncDebtPayDialog(root, debt, inst);
    }),
  );
}
