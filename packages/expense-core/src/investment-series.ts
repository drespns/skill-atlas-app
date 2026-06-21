import type { ExpenseTrackerState, InvestmentHolding } from "./state";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Importe inicial (sin compras parciales registradas). */
export function investmentInitialAmount(h: InvestmentHolding): number {
  const purchases = h.purchases ?? [];
  const extra = purchases.reduce((s, p) => s + Math.max(0, p.amount), 0);
  return round2(Math.max(0, h.totalInvested - extra));
}

/** Serie mensual de desembolsos en inversiones (EUR). */
export function monthlyInvestmentOutflowSeries(
  state: ExpenseTrackerState,
  months: string[],
): number[] {
  const series = months.map(() => 0);
  const idx = new Map(months.map((m, i) => [m, i] as const));
  const fallback = state.trackingStartDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  for (const h of state.investments ?? []) {
    const initial = investmentInitialAmount(h);
    if (initial > 0) {
      const acquired = (h.acquiredOn?.trim().slice(0, 10) || fallback).slice(0, 7);
      const i = idx.get(acquired);
      if (i != null) series[i]! += initial;
    }
    for (const p of h.purchases ?? []) {
      const mk = p.date.slice(0, 7);
      const i = idx.get(mk);
      if (i != null) series[i]! += Math.max(0, p.amount);
    }
  }

  return series.map(round2);
}

/** Años con actividad de caja o inversiones (para selector histórico). */
export function yearsWithFinancialActivity(state: ExpenseTrackerState): number[] {
  const years = new Set<number>();
  const add = (iso?: string) => {
    const y = Number(iso?.slice(0, 4));
    if (y >= 2000 && y <= 2100) years.add(y);
  };
  for (const e of state.expenses) add(e.date);
  for (const row of state.incomeAdhoc ?? []) add(row.date);
  for (const p of state.paychecks ?? []) add(p.validFrom);
  for (const p of state.plannedExpenses ?? []) add(p.validFrom);
  for (const debt of state.debts ?? []) {
    for (const inst of debt.installments ?? []) add(inst.dueDate);
  }
  for (const h of state.investments ?? []) {
    add(h.acquiredOn);
    for (const p of h.purchases ?? []) add(p.date);
  }
  return [...years].sort((a, b) => b - a);
}
