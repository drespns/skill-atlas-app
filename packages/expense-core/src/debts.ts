import type { ExpenseCurrency, ExpenseRow, ExpenseTrackerState } from "./state";

export type DebtInstallmentStatus = "pending" | "paid";

export type DebtInstallment = {
  id: string;
  label?: string;
  amount: number;
  /** Fecha objetivo de pago (YYYY-MM-DD). */
  dueDate: string;
  status: DebtInstallmentStatus;
  paidDate?: string;
  /** Gasto confirmado vinculado al marcar pagado. */
  expenseId?: string;
};

export type ExpenseDebt = {
  id: string;
  title: string;
  note?: string;
  categoryId?: string;
  currency?: ExpenseCurrency;
  installments: DebtInstallment[];
  createdAt?: string;
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

export function debtInstallmentTotal(debt: ExpenseDebt): number {
  return round2((debt.installments ?? []).reduce((s, it) => s + Math.max(0, it.amount), 0));
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
  const total = debtInstallmentTotal(debt);
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
            }))
            .filter((it: DebtInstallment) => it.id && it.dueDate.length === 10 && it.amount > 0)
        : [];
      return {
        id: String(r?.id || "").trim() || cryptoId(),
        title: String(r?.title || "").trim() || "Deuda",
        note: String(r?.note ?? "").trim() || undefined,
        categoryId: r?.categoryId ? String(r.categoryId).trim() : undefined,
        currency: r?.currency === "USD" ? "USD" : "EUR",
        installments,
        createdAt: String(r?.createdAt ?? "").slice(0, 10) || undefined,
      } satisfies ExpenseDebt;
    })
    .filter((d) => d.id && d.title && d.installments.length)
    .slice(0, 48);
}

export type PayDebtInstallmentInput = {
  paidDate?: string;
  wealthAccountId?: string;
  labelOverride?: string;
};

/** Marca una cuota como pagada y crea el gasto confirmado vinculado. */
export function payDebtInstallment(
  state: ExpenseTrackerState,
  debtId: string,
  installmentId: string,
  makeExpenseId: () => string,
  input: PayDebtInstallmentInput = {},
): ExpenseTrackerState | null {
  const debtIdx = (state.debts ?? []).findIndex((d) => d.id === debtId);
  if (debtIdx < 0) return null;
  const debt = state.debts![debtIdx]!;
  const instIdx = debt.installments.findIndex((it) => it.id === installmentId);
  if (instIdx < 0) return null;
  const inst = debt.installments[instIdx]!;
  if (inst.status === "paid") return null;

  const paidDate = (input.paidDate ?? new Date().toISOString()).slice(0, 10);
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

  const updatedInstallments = debt.installments.map((it, i) =>
    i === instIdx
      ? { ...it, status: "paid" as const, paidDate, expenseId }
      : it,
  );
  const updatedDebt: ExpenseDebt = { ...debt, installments: updatedInstallments };
  const debts = [...(state.debts ?? [])];
  debts[debtIdx] = updatedDebt;

  return {
    ...state,
    debts,
    expenses: [...state.expenses, expense],
  };
}
