import type { ExpenseCurrency, ExpenseRow, ExpenseTrackerState, WealthBizum } from "./state";

export type DebtInstallmentStatus = "pending" | "paid";

export type DebtScope = "personal" | "family";

export type DebtPaymentMethod = "expense" | "bizum" | "linked";

export type DebtInstallment = {
  id: string;
  label?: string;
  amount: number;
  /** Fecha objetivo de pago (YYYY-MM-DD). */
  dueDate: string;
  status: DebtInstallmentStatus;
  paidDate?: string;
  /** Gasto confirmado vinculado (method expense). */
  expenseId?: string;
  /** Bizum vinculado (method bizum o linked). */
  bizumId?: string;
  paymentMethod?: DebtPaymentMethod;
};

export type ExpenseDebt = {
  id: string;
  title: string;
  note?: string;
  categoryId?: string;
  currency?: ExpenseCurrency;
  /** Importe total declarado de la deuda (puede diferir de la suma de cuotas mientras se planifica). */
  totalAmount?: number;
  installments: DebtInstallment[];
  createdAt?: string;
  /** Personal (dentista, tienda) vs familiar (madre, pareja…). */
  scope?: DebtScope;
  /** Contraparte en deudas familiares. */
  counterparty?: string;
};

export type DebtSummary = {
  debtId: string;
  total: number;
  paid: number;
  pending: number;
  nextDue?: string;
  progressPct: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `db_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseDebtScope(raw: unknown): DebtScope {
  return raw === "family" ? "family" : "personal";
}

function parsePaymentMethod(raw: unknown): DebtPaymentMethod | undefined {
  if (raw === "expense" || raw === "bizum" || raw === "linked") return raw;
  return undefined;
}

export function debtInstallmentTotal(debt: ExpenseDebt): number {
  return round2((debt.installments ?? []).reduce((s, it) => s + Math.max(0, it.amount), 0));
}

/** Total declarado de la deuda; cae a suma de cuotas si no hay totalAmount. */
export function debtDeclaredTotal(debt: ExpenseDebt): number {
  const declared = debt.totalAmount;
  if (declared != null && Number.isFinite(declared) && declared > 0) return round2(declared);
  return debtInstallmentTotal(debt);
}

export function debtInstallmentsAssigned(debt: ExpenseDebt): number {
  return debtInstallmentTotal(debt);
}

export function debtUnassignedAmount(debt: ExpenseDebt): number {
  return round2(Math.max(0, debtDeclaredTotal(debt) - debtInstallmentTotal(debt)));
}

export function debtPaidAmount(debt: ExpenseDebt): number {
  return round2(
    (debt.installments ?? [])
      .filter((it) => it.status === "paid")
      .reduce((s, it) => s + Math.max(0, it.amount), 0),
  );
}

export function debtPendingAmount(debt: ExpenseDebt): number {
  return round2(Math.max(0, debtInstallmentTotal(debt) - debtPaidAmount(debt)));
}

export function summarizeDebt(debt: ExpenseDebt): DebtSummary {
  const total = debtDeclaredTotal(debt);
  const paid = debtPaidAmount(debt);
  const pending = round2(Math.max(0, total - paid));
  const next = (debt.installments ?? [])
    .filter((it) => it.status === "pending" && it.dueDate)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0]?.dueDate;
  return {
    debtId: debt.id,
    total,
    paid,
    pending,
    nextDue: next,
    progressPct: total > 0 ? round2((paid / total) * 100) : 0,
  };
}

/** Bizum IDs ya vinculados a alguna cuota de deuda. */
export function linkedDebtBizumIds(state: ExpenseTrackerState): Set<string> {
  const ids = new Set<string>();
  for (const debt of state.debts ?? []) {
    for (const inst of debt.installments) {
      if (inst.bizumId) ids.add(inst.bizumId);
    }
  }
  return ids;
}

export function isInstallmentPaymentLinked(inst: DebtInstallment): boolean {
  return Boolean(inst.expenseId || inst.bizumId || inst.paymentMethod);
}

export function parseExpenseDebts(raw: unknown): ExpenseDebt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const installments: DebtInstallment[] = Array.isArray(r?.installments)
        ? r.installments
            .map((it: any) => ({
              id: String(it?.id || "").trim() || cryptoId(),
              label: String(it?.label ?? "").trim() || undefined,
              amount: Number.isFinite(Number(it?.amount)) ? Math.max(0, Number(it.amount)) : 0,
              dueDate: String(it?.dueDate ?? "").slice(0, 10),
              status: it?.status === "paid" ? "paid" : "pending",
              paidDate: String(it?.paidDate ?? "").slice(0, 10) || undefined,
              expenseId: it?.expenseId ? String(it.expenseId).trim() : undefined,
              bizumId: it?.bizumId ? String(it.bizumId).trim() : undefined,
              paymentMethod: parsePaymentMethod(it?.paymentMethod),
            }))
            .filter((it: DebtInstallment) => it.id && it.dueDate.length === 10 && it.amount > 0)
        : [];
      const parsedTotal = Number(r?.totalAmount);
      const totalAmount =
        Number.isFinite(parsedTotal) && parsedTotal > 0 ? round2(parsedTotal) : undefined;
      const counterparty = String(r?.counterparty ?? "").trim() || undefined;
      return {
        id: String(r?.id || "").trim() || cryptoId(),
        title: String(r?.title || "").trim() || "Deuda",
        note: String(r?.note ?? "").trim() || undefined,
        categoryId: r?.categoryId ? String(r.categoryId).trim() : undefined,
        currency: r?.currency === "USD" ? "USD" : "EUR",
        totalAmount,
        installments,
        createdAt: String(r?.createdAt ?? "").slice(0, 10) || undefined,
        scope: parseDebtScope(r?.scope),
        counterparty,
      } satisfies ExpenseDebt;
    })
    .filter((d) => d.id && d.title && d.installments.length)
    .slice(0, 48);
}

export type PayDebtInstallmentInput = {
  paidDate?: string;
  method: DebtPaymentMethod;
  wealthAccountId?: string;
  labelOverride?: string;
  counterpartyNote?: string;
  /** Requerido si method === 'linked'. */
  existingBizumId?: string;
};

function defaultPaymentMethodForDebt(debt: ExpenseDebt, requested?: DebtPaymentMethod): DebtPaymentMethod {
  if (requested) return requested;
  return debt.scope === "family" ? "bizum" : "expense";
}

function bizumNoteForDebt(debt: ExpenseDebt, inst: DebtInstallment, input: PayDebtInstallmentInput): string {
  const parts = [
    input.counterpartyNote?.trim(),
    debt.counterparty?.trim(),
    inst.label ? `${debt.title} — ${inst.label}` : debt.title,
  ].filter(Boolean);
  return parts[0] ?? debt.title;
}

function patchInstallmentPaid(
  inst: DebtInstallment,
  paidDate: string,
  patch: Pick<DebtInstallment, "expenseId" | "bizumId" | "paymentMethod">,
): DebtInstallment {
  return {
    ...inst,
    status: "paid",
    paidDate,
    expenseId: patch.expenseId,
    bizumId: patch.bizumId,
    paymentMethod: patch.paymentMethod,
  };
}

/** Marca una cuota como pagada según el método (gasto, bizum nuevo o bizum existente). */
export function payDebtInstallment(
  state: ExpenseTrackerState,
  debtId: string,
  installmentId: string,
  makeExpenseId: () => string,
  makeBizumId: () => string,
  input: PayDebtInstallmentInput,
): ExpenseTrackerState | null {
  const debtIdx = (state.debts ?? []).findIndex((d) => d.id === debtId);
  if (debtIdx < 0) return null;
  const debt = state.debts![debtIdx]!;
  const instIdx = debt.installments.findIndex((it) => it.id === installmentId);
  if (instIdx < 0) return null;
  const inst = debt.installments[instIdx]!;
  const isRelink = inst.status === "paid" && !isInstallmentPaymentLinked(inst);
  if (inst.status === "paid" && !isRelink) return null;

  const method = defaultPaymentMethodForDebt(debt, input.method);
  const paidDate = (input.paidDate ?? new Date().toISOString()).slice(0, 10);

  let expenses = state.expenses;
  let wealthBizums = state.wealthBizums ?? [];
  let installmentPatch: Pick<DebtInstallment, "expenseId" | "bizumId" | "paymentMethod"> = {};

  if (method === "expense") {
    const expenseId = makeExpenseId();
    const categoryId = debt.categoryId || state.categories[0]!.id;
    const label =
      input.labelOverride?.trim() ||
      (inst.label ? `${debt.title} — ${inst.label}` : debt.title);
    const expense: ExpenseRow = {
      id: expenseId,
      date: paidDate,
      label,
      amount: inst.amount,
      currency: debt.currency ?? "EUR",
      categoryId,
      notes: debt.note ? `Deuda: ${debt.note}` : "Pago de deuda pendiente",
      tags: ["deuda"],
      attachments: [],
      confirmed: true,
      wealthAccountId: input.wealthAccountId,
    };
    expenses = [...state.expenses, expense];
    installmentPatch = { expenseId, paymentMethod: "expense" };
  } else if (method === "bizum") {
    const bizumId = makeBizumId();
    const accountId = input.wealthAccountId;
    if (!accountId) return null;
    const bizum: WealthBizum = {
      id: bizumId,
      date: paidDate,
      direction: "sent",
      accountId,
      amount: inst.amount,
      note: bizumNoteForDebt(debt, inst, input),
    };
    wealthBizums = [...wealthBizums, bizum].slice(0, 500);
    installmentPatch = { bizumId, paymentMethod: "bizum" };
  } else if (method === "linked") {
    const bizumId = input.existingBizumId?.trim();
    if (!bizumId) return null;
    const linked = linkedDebtBizumIds(state);
    if (linked.has(bizumId)) return null;
    const bizum = (state.wealthBizums ?? []).find((b) => b.id === bizumId);
    if (!bizum || bizum.direction !== "sent") return null;
    installmentPatch = { bizumId, paymentMethod: "linked" };
  } else {
    return null;
  }

  const updatedInstallments = debt.installments.map((it, i) =>
    i === instIdx ? patchInstallmentPaid(inst, paidDate, installmentPatch) : it,
  );
  const updatedDebt: ExpenseDebt = { ...debt, installments: updatedInstallments };
  const debts = [...(state.debts ?? [])];
  debts[debtIdx] = updatedDebt;

  return {
    ...state,
    debts,
    expenses,
    wealthBizums,
  };
}
