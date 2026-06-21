import type { ExpenseTrackerState } from "./state";
import { effectivePeriodStart, subscriptionToMonthlyAmount } from "./state";
import {
  CASHFLOW_SOURCE_LABELS,
  expandCashflowEvents,
  monthCashflowDualSnapshot,
  type CashflowEvent,
  type CashflowSource,
  type ChartMoneyMode,
} from "./cashflow-projection";

export type KpiBreakdownLine = {
  label: string;
  amount: number;
  detail?: string;
};

export type KpiBreakdown = {
  title: string;
  subtitle?: string;
  total: number;
  lines: KpiBreakdownLine[];
};

function sumEvents(events: CashflowEvent[], direction: "in" | "out"): number {
  return events.filter((e) => e.direction === direction).reduce((s, e) => s + e.amount, 0);
}

function kpiDisplayMode(state: ExpenseTrackerState): ChartMoneyMode {
  const m = state.chartMoneyMode;
  return m === "mixed" ? "unify_eur" : m;
}

function toDisplayEur(amount: number, currency: "EUR" | "USD", state: ExpenseTrackerState): number {
  const mode = kpiDisplayMode(state);
  const fx = state.eurPerUsd;
  if (mode === "unify_eur") return currency === "EUR" ? amount : amount * fx;
  if (mode === "unify_usd") return currency === "USD" ? amount : amount / fx;
  return currency === "EUR" ? amount : amount * fx;
}

function incomeEventLines(state: ExpenseTrackerState, events: CashflowEvent[], asOf: string): KpiBreakdownLine[] {
  const lines: KpiBreakdownLine[] = [];
  for (const ev of events) {
    if (ev.direction !== "in") continue;
    const amt = toDisplayEur(ev.amount, ev.currency, state);
    if (amt <= 0.005) continue;
    const pending = ev.chargeDate > asOf;
    lines.push({
      label: ev.label?.trim() || CASHFLOW_SOURCE_LABELS[ev.source],
      amount: amt,
      detail: pending ? "previsto" : "cobrado",
    });
  }
  lines.sort((a, b) => {
    const pa = a.detail === "previsto" ? 1 : 0;
    const pb = b.detail === "previsto" ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return b.amount - a.amount;
  });
  return lines;
}

function outflowEventLines(state: ExpenseTrackerState, events: CashflowEvent[], asOf: string): KpiBreakdownLine[] {
  const lines: KpiBreakdownLine[] = [];
  for (const ev of events) {
    if (ev.direction !== "out") continue;
    const amt = toDisplayEur(ev.amount, ev.currency, state);
    if (amt <= 0.005) continue;
    const pending = ev.chargeDate > asOf;
    lines.push({
      label: ev.label?.trim() || CASHFLOW_SOURCE_LABELS[ev.source],
      amount: -amt,
      detail: pending ? "previsto" : CASHFLOW_SOURCE_LABELS[ev.source],
    });
  }
  lines.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return lines;
}

export function breakdownActiveSubscriptions(
  state: ExpenseTrackerState,
  refDate?: string,
): KpiBreakdown {
  const today = (refDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const lines: KpiBreakdownLine[] = [];
  let total = 0;
  for (const s of state.subscriptions) {
    const m = subscriptionToMonthlyAmount(s, today);
    if (m <= 0) continue;
    total += m;
    lines.push({
      label: s.name,
      amount: m,
      detail: s.cycle === "monthly" ? "mensual" : `ciclo ${s.cycle}`,
    });
  }
  lines.sort((a, b) => b.amount - a.amount);
  return {
    title: "Suscripciones activas",
    subtitle: "Coste mensual equivalente por servicio",
    total,
    lines,
  };
}

export function breakdownMonthIncome(state: ExpenseTrackerState, monthKey?: string): KpiBreakdown {
  const today = new Date().toISOString().slice(0, 10);
  const mk = monthKey ?? today.slice(0, 7);
  const dual = monthCashflowDualSnapshot(state, mk, today);
  const events = expandCashflowEvents(state, {
    months: [mk],
    horizon: "projected",
    asOfDate: today,
    direction: "in",
  });
  const lines = incomeEventLines(state, events, today);
  const subtitleParts: string[] = [`Cobrado ${Math.round(dual.actualIn)} €`];
  if (dual.remainingIn > 0.005) subtitleParts.push(`Quedan unos ${Math.round(dual.remainingIn)} € por cobrar`);
  return {
    title: "Ingresos del mes",
    subtitle: subtitleParts.join(" · "),
    total: dual.actualIn,
    lines,
  };
}

export function breakdownMonthBalance(state: ExpenseTrackerState, monthKey?: string): KpiBreakdown {
  const today = new Date().toISOString().slice(0, 10);
  const mk = monthKey ?? today.slice(0, 7);
  const dual = monthCashflowDualSnapshot(state, mk, today);
  const events = expandCashflowEvents(state, {
    months: [mk],
    horizon: "projected",
    asOfDate: today,
  });
  const lines = [...outflowEventLines(state, events, today), ...incomeEventLines(state, events, today)];
  return {
    title: "Balance del mes",
    subtitle: `Realizado ${Math.round(dual.actualNet)} € · Previsto total ${Math.round(dual.projectedNet)} €`,
    total: dual.actualNet,
    lines,
  };
}

export function breakdownPeriodExpenses(state: ExpenseTrackerState): KpiBreakdown {
  const start = effectivePeriodStart(state, state.period);
  const today = new Date().toISOString().slice(0, 10);
  const startMk = start?.slice(0, 7) ?? "1970-01";
  const endMk = today.slice(0, 7);
  const months: string[] = [];
  let y = Number(startMk.slice(0, 4));
  let m = Number(startMk.slice(5, 7));
  const ty = Number(endMk.slice(0, 4));
  const tm = Number(endMk.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const events = expandCashflowEvents(state, {
    months,
    horizon: "actual",
    asOfDate: today,
    periodStart: start,
    direction: "out",
  });
  const lines = outflowEventLines(state, events, today).map((l) => ({ ...l, amount: Math.abs(l.amount) }));
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { title: "Gastos del período", total, lines };
}

export function breakdownPeriodIncome(state: ExpenseTrackerState): KpiBreakdown {
  const start = effectivePeriodStart(state, state.period);
  const today = new Date().toISOString().slice(0, 10);
  const startMk = start?.slice(0, 7) ?? "1970-01";
  const endMk = today.slice(0, 7);
  const months: string[] = [];
  let y = Number(startMk.slice(0, 4));
  let m = Number(startMk.slice(5, 7));
  const ty = Number(endMk.slice(0, 4));
  const tm = Number(endMk.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const events = expandCashflowEvents(state, {
    months,
    horizon: "actual",
    asOfDate: today,
    periodStart: start,
    direction: "in",
  });
  const lines = incomeEventLines(state, events, today);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { title: "Ingresos del período", total, lines };
}

export function breakdownNaturalYear(
  state: ExpenseTrackerState,
  year: number,
  kind: "income" | "expense" | "net",
): KpiBreakdown {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const events = expandCashflowEvents(state, { months, horizon: "projected" });
  const monthShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const lines: KpiBreakdownLine[] = months
    .map((mk, i) => {
      const monthEv = events.filter((e) => e.monthKey === mk);
      const inc = sumEvents(monthEv, "in");
      const out = sumEvents(monthEv, "out");
      const net = inc - out;
      const amount = kind === "income" ? inc : kind === "expense" ? out : net;
      return { label: monthShort[i] ?? mk, amount };
    })
    .filter((l) => l.amount > 0.005);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const titles = {
    income: `Ingresos ${year}`,
    expense: `Gastos ${year}`,
    net: `Balance ${year}`,
  };
  return { title: titles[kind], total, lines };
}
