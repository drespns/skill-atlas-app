import type { ExpenseCategory, ExpenseRow, ExpenseTrackerState, IncomeAdhocRow } from "./state";
import { convertAmount, formatEurEs } from "./state";

export type MobileTransactionKind = "expense" | "income";

export type MobileTransaction = {
  id: string;
  kind: MobileTransactionKind;
  date: string;
  label: string;
  amount: number;
  categoryId: string;
  confirmed: boolean;
  wealthAccountId?: string;
};

export type CategorySlice = {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  pct: number;
};

export function currentMonthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

function eurAmount(amount: number, currency: "EUR" | "USD", fx: number): number {
  return currency === "EUR" ? amount : convertAmount(amount, "USD", "EUR", fx);
}

export function listTransactionsForMonth(state: ExpenseTrackerState, monthKey: string): MobileTransaction[] {
  const fx = state.eurPerUsd;
  const out: MobileTransaction[] = [];
  for (const e of state.expenses) {
    if (!e.date.startsWith(monthKey) || e.confirmed === false) continue;
    out.push({
      id: e.id,
      kind: "expense",
      date: e.date.slice(0, 10),
      label: e.label,
      amount: eurAmount(e.amount, e.currency, fx),
      categoryId: e.categoryId,
      confirmed: true,
      wealthAccountId: e.wealthAccountId,
    });
  }
  for (const i of state.incomeAdhoc ?? []) {
    if (!i.date.startsWith(monthKey) || i.confirmed === false) continue;
    out.push({
      id: i.id,
      kind: "income",
      date: i.date.slice(0, 10),
      label: i.label,
      amount: eurAmount(i.amount, i.currency, fx),
      categoryId: i.categoryId,
      confirmed: true,
      wealthAccountId: i.wealthAccountId,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function groupTransactionsByDay(txs: MobileTransaction[]): Map<string, MobileTransaction[]> {
  const map = new Map<string, MobileTransaction[]>();
  for (const t of txs) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return map;
}

function categoryLabel(categories: ExpenseCategory[], id: string): { name: string; color: string } {
  const c = categories.find((x) => x.id === id);
  return { name: c?.name ?? "Otros", color: c?.color ?? "#94a3b8" };
}

export function expenseCategoryBreakdown(state: ExpenseTrackerState, monthKey: string): CategorySlice[] {
  const fx = state.eurPerUsd;
  const totals = new Map<string, number>();
  let sum = 0;
  for (const e of state.expenses) {
    if (!e.date.startsWith(monthKey) || e.confirmed === false) continue;
    const amt = eurAmount(e.amount, e.currency, fx);
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + amt);
    sum += amt;
  }
  const slices: CategorySlice[] = [];
  for (const [categoryId, amount] of totals) {
    const { name, color } = categoryLabel(state.categories, categoryId);
    slices.push({
      categoryId,
      name,
      color,
      amount,
      pct: sum > 0 ? (amount / sum) * 100 : 0,
    });
  }
  return slices.sort((a, b) => b.amount - a.amount);
}

export function monthExpenseIncomeTotals(state: ExpenseTrackerState, monthKey: string) {
  const txs = listTransactionsForMonth(state, monthKey);
  let expenses = 0;
  let income = 0;
  for (const t of txs) {
    if (t.kind === "expense") expenses += t.amount;
    else income += t.amount;
  }
  return { expenses, income, balance: income - expenses };
}

export { formatEurEs };

export function addQuickExpense(
  state: ExpenseTrackerState,
  input: {
    id: string;
    label: string;
    amount: number;
    categoryId: string;
    date?: string;
    notes?: string;
    wealthAccountId?: string;
  },
): ExpenseTrackerState {
  const row: ExpenseRow = {
    id: input.id,
    date: (input.date ?? new Date().toISOString()).slice(0, 10),
    label: input.label.trim() || "Gasto",
    amount: Math.max(0, input.amount),
    currency: "EUR",
    categoryId: input.categoryId,
    notes: input.notes?.trim() ?? "",
    tags: [],
    attachments: [],
    confirmed: true,
    wealthAccountId: input.wealthAccountId,
  };
  return { ...state, expenses: [...state.expenses, row] };
}

export function addQuickIncome(
  state: ExpenseTrackerState,
  input: {
    id: string;
    label: string;
    amount: number;
    categoryId: string;
    date?: string;
    notes?: string;
    wealthAccountId?: string;
  },
): ExpenseTrackerState {
  const row: IncomeAdhocRow = {
    id: input.id,
    date: (input.date ?? new Date().toISOString()).slice(0, 10),
    label: input.label.trim() || "Ingreso",
    amount: Math.max(0, input.amount),
    currency: "EUR",
    categoryId: input.categoryId,
    notes: input.notes?.trim() ?? "",
    tags: [],
    attachments: [],
    confirmed: true,
    wealthAccountId: input.wealthAccountId,
  };
  return { ...state, incomeAdhoc: [...(state.incomeAdhoc ?? []), row] };
}
