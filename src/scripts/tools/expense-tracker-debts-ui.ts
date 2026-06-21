import {
  formatEurEs,
  type ExpenseTrackerState,
} from "@lib/tools-expense-tracker";
import {
  payDebtInstallment,
  summarizeDebt,
  type ExpenseDebt,
  type DebtInstallment,
} from "@lib/tools-expense-debts";
import { refreshExpenseDatePicker } from "./expense-tracker-dates";

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
  scrollToExpense?: (expenseId: string) => void;
  bookExpense?: (expense: import("@lib/tools-expense-tracker").ExpenseRow) => void;
};

function formatDateEs(iso: string): string {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function updateDebtTotalPreview(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  const preview = root.querySelector<HTMLElement>("[data-et-debt-total-preview]");
  if (!host || !preview) return;
  let total = 0;
  host.querySelectorAll<HTMLElement>("[data-et-debt-installment-row]").forEach((row) => {
    total += Math.max(0, Number(row.querySelector<HTMLInputElement>("[data-et-debt-inst-amount]")?.value));
  });
  preview.textContent = `Total: ${formatEurEs(total)}`;
}

function addDebtInstallmentRow(
  root: HTMLElement,
  deps: DebtUiDeps,
  inst?: Partial<DebtInstallment>,
) {
  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (!host) return;
  const row = document.createElement("div");
  row.className =
    "grid grid-cols-[1fr_6.5rem_7.5rem_auto] gap-2 items-end rounded-lg border border-gray-200/80 dark:border-gray-800/80 p-2";
  row.dataset.etDebtInstallmentRow = "";
  row.dataset.installmentRowId = inst?.id ?? deps.makeId();
  if (inst?.status === "paid") row.dataset.paid = "1";
  row.innerHTML = `
    <label class="space-y-0.5 min-w-0">
      <span class="text-[10px] font-semibold text-gray-500">Etiqueta (opc.)</span>
      <input type="text" data-et-debt-inst-label class="et-field w-full text-sm py-1.5" value="${(inst?.label ?? "").replace(/"/g, "&quot;")}" ${inst?.status === "paid" ? "disabled" : ""} />
    </label>
    <label class="space-y-0.5">
      <span class="text-[10px] font-semibold text-gray-500">€</span>
      <input type="number" step="0.01" min="0" data-et-debt-inst-amount class="et-field w-full text-sm py-1.5 font-mono" value="${inst?.amount ?? ""}" ${inst?.status === "paid" ? "disabled" : ""} />
    </label>
    <label class="space-y-0.5">
      <span class="text-[10px] font-semibold text-gray-500">Fecha</span>
      <input type="date" data-et-debt-inst-date class="et-field et-date w-full text-sm py-1.5" value="${inst?.dueDate?.slice(0, 10) ?? ""}" ${inst?.status === "paid" ? "disabled" : ""} />
    </label>
    ${inst?.status === "paid" ? `<span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 pb-2">Pagada</span>` : `<button type="button" data-et-debt-inst-remove class="et-btn-secondary text-xs py-1.5 mb-0.5">×</button>`}`;
  row.querySelector("[data-et-debt-inst-remove]")?.addEventListener("click", () => {
    row.remove();
    updateDebtTotalPreview(root);
  });
  row.querySelectorAll("input").forEach((inp) =>
    inp.addEventListener("input", () => updateDebtTotalPreview(root)),
  );
  host.appendChild(row);
  const dateEl = row.querySelector<HTMLInputElement>("[data-et-debt-inst-date]");
  if (dateEl && !inst?.status) refreshExpenseDatePicker(dateEl, dateEl.value);
  updateDebtTotalPreview(root);
}

function readDebtInstallmentsFromDialog(root: HTMLElement, deps: DebtUiDeps, existing?: ExpenseDebt): DebtInstallment[] {
  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (!host) return [];
  const paidById = new Map((existing?.installments ?? []).filter((i) => i.status === "paid").map((i) => [i.id, i]));
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
    const dueDate = row.querySelector<HTMLInputElement>("[data-et-debt-inst-date]")?.value?.slice(0, 10) ?? "";
    if (!dueDate || !(amount > 0)) return;
    rows.push({
      id,
      label: label || undefined,
      amount,
      dueDate,
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
  if (!dlg || !title || !idEl || !catEl || !delBtn) return;

  title.textContent = debt ? "Editar deuda" : "Nueva deuda";
  idEl.value = debt?.id ?? "";
  deps.fillCategorySelect(catEl);
  catEl.value = debt?.categoryId ?? deps.getState().categories[0]!.id;
  (root.querySelector("[data-et-debt-title]") as HTMLInputElement).value = debt?.title ?? "";
  (root.querySelector("[data-et-debt-note]") as HTMLInputElement).value = debt?.note ?? "";
  delBtn.classList.toggle("invisible", !debt);

  const host = root.querySelector<HTMLElement>("[data-et-debt-installments]");
  if (host) {
    host.innerHTML = "";
    const items = debt?.installments ?? [];
    if (items.length) items.forEach((it) => addDebtInstallmentRow(root, deps, it));
    else addDebtInstallmentRow(root, deps);
  }

  dlg.showModal();
}

function saveDebtFromDialog(root: HTMLElement, deps: DebtUiDeps) {
  const state = deps.getState();
  const id = root.querySelector<HTMLInputElement>("[data-et-debt-id]")?.value?.trim();
  const title = root.querySelector<HTMLInputElement>("[data-et-debt-title]")?.value?.trim() ?? "";
  if (!title) return;
  const existing = (state.debts ?? []).find((d) => d.id === id);
  const installments = readDebtInstallmentsFromDialog(root, deps, existing);
  if (!installments.length) return;

  const row: ExpenseDebt = {
    id: id || deps.makeId(),
    title,
    categoryId: root.querySelector<HTMLSelectElement>("[data-et-debt-category]")?.value,
    note: root.querySelector<HTMLInputElement>("[data-et-debt-note]")?.value?.trim() || undefined,
    currency: "EUR",
    installments,
    createdAt: existing?.createdAt ?? new Date().toISOString().slice(0, 10),
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

export function openDebtPayDialog(
  root: HTMLElement,
  deps: DebtUiDeps,
  debtId: string,
  installmentId: string,
) {
  const state = deps.getState();
  const debt = (state.debts ?? []).find((d) => d.id === debtId);
  const inst = debt?.installments.find((i) => i.id === installmentId);
  if (!debt || !inst || inst.status === "paid") return;

  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-debt-pay]");
  const summary = root.querySelector<HTMLElement>("[data-et-debt-pay-summary]");
  if (!dlg || !summary) return;

  root.querySelector<HTMLInputElement>("[data-et-debt-pay-debt-id]")!.value = debtId;
  root.querySelector<HTMLInputElement>("[data-et-debt-pay-installment-id]")!.value = installmentId;
  summary.textContent = `${debt.title}${inst.label ? ` · ${inst.label}` : ""} — ${formatEurEs(inst.amount)}`;
  const dateEl = root.querySelector<HTMLInputElement>("[data-et-debt-pay-date]")!;
  dateEl.value = new Date().toISOString().slice(0, 10);
  refreshExpenseDatePicker(dateEl, dateEl.value);
  const labelEl = root.querySelector<HTMLInputElement>("[data-et-debt-pay-label]")!;
  labelEl.value = inst.label ? `${debt.title} — ${inst.label}` : debt.title;
  const wealthSel = root.querySelector<HTMLSelectElement>("[data-et-debt-pay-wealth]")!;
  deps.fillWealthAccountSelect(wealthSel, undefined, "expense");
  dlg.showModal();
}

function confirmDebtPay(root: HTMLElement, deps: DebtUiDeps) {
  const debtId = root.querySelector<HTMLInputElement>("[data-et-debt-pay-debt-id]")?.value?.trim();
  const installmentId = root.querySelector<HTMLInputElement>("[data-et-debt-pay-installment-id]")?.value?.trim();
  if (!debtId || !installmentId) return;
  const paidDate = root.querySelector<HTMLInputElement>("[data-et-debt-pay-date]")?.value?.slice(0, 10);
  const wealthAccountId = root.querySelector<HTMLSelectElement>("[data-et-debt-pay-wealth]")?.value || undefined;
  const labelOverride = root.querySelector<HTMLInputElement>("[data-et-debt-pay-label]")?.value?.trim();

  const next = payDebtInstallment(deps.getState(), debtId, installmentId, deps.makeExpenseId, {
    paidDate,
    wealthAccountId,
    labelOverride,
  });
  if (!next) return;
  const inst = next.debts
    ?.find((d) => d.id === debtId)
    ?.installments.find((i) => i.id === installmentId);
  const expense = inst?.expenseId ? next.expenses.find((e) => e.id === inst.expenseId) : undefined;
  if (expense) deps.bookExpense?.(expense);
  deps.setState(next);
  deps.persist();
  root.querySelector<HTMLDialogElement>("[data-et-dlg-debt-pay]")?.close();
  deps.renderAll(root);
  if (inst?.expenseId && deps.scrollToExpense) deps.scrollToExpense(inst.expenseId);
}

export function renderDebtsSection(root: HTMLElement, deps: DebtUiDeps) {
  const list = root.querySelector<HTMLElement>("[data-et-debts-list]");
  if (!list) return;
  list.innerHTML = "";
  const debts = deps.getState().debts ?? [];

  if (!debts.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 col-span-full py-2";
    empty.textContent = "No hay deudas pendientes. Añade una con cuotas y fechas objetivo.";
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
    const title = document.createElement("p");
    title.className = "m-0 font-semibold text-gray-900 dark:text-gray-50";
    title.textContent = debt.title;
    const badge = document.createElement("span");
    const allPaid = sum.pending <= 0;
    badge.className = allPaid
      ? "shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
      : "shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
    badge.textContent = allPaid ? "Liquidada" : `Pendiente ${formatEurEs(sum.pending)}`;
    head.append(title, badge);

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
      left.innerHTML = `<p class="m-0 font-medium text-gray-800 dark:text-gray-200 truncate">${inst.label || "Cuota"} · ${formatEurEs(inst.amount)}</p>
        <p class="m-0 text-[10px] text-gray-500">${formatDateEs(inst.dueDate)}${inst.status === "paid" && inst.paidDate ? ` · Pagado ${formatDateEs(inst.paidDate)}` : ""}</p>`;
      li.appendChild(left);
      if (inst.status === "paid") {
        const link = document.createElement("button");
        link.type = "button";
        link.className = "text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0";
        link.textContent = inst.expenseId ? "Ver gasto" : "Pagada";
        if (inst.expenseId) {
          link.addEventListener("click", () => deps.scrollToExpense?.(inst.expenseId!));
        }
        li.appendChild(link);
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
}
