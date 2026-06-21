import type { ExpenseTrackerState } from "./state";
import { effectivePeriodStart, subscriptionToMonthlyAmount } from "./state";
import {
  CASHFLOW_SOURCE_LABELS,
  expandCashflowEvents,
  monthCashflowDualSnapshot,
  type CashflowEvent,
  type CashflowSource,
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

function eventsBySource(events: CashflowEvent[], direction: "in" | "out"): Map<CashflowSource, number> {
  const m = new Map<CashflowSource, number>();
  for (const e of events) {
    if (e.direction !== direction) continue;
    m.set(e.source, (m.get(e.source) ?? 0) + e.amount);
  }
  return m;
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
    direction: "in",
  });
  const bySrc = eventsBySource(events, "in");
  const lines: KpiBreakdownLine[] = [];
  for (const [src, amt] of bySrc) {
    if (amt <= 0) continue;
    lines.push({ label: CASHFLOW_SOURCE_LABELS[src], amount: amt });
  }
  return {
    title: "Ingresos del mes",
    subtitle:
      dual.remainingIn > 0.005
        ? `Realizados ${dual.actualIn.toFixed(0)} € · Quedan unos ${dual.remainingIn.toFixed(0)} € por cobrar`
        : `Realizados ${dual.actualIn.toFixed(0)} €`,
    total: dual.projectedIn,
    lines,
  };
}

export function breakdownMonthBalance(state: ExpenseTrackerState, monthKey?: string): KpiBreakdown {
  const today = new Date().toISOString().slice(0, 10);
  const mk = monthKey ?? today.slice(0, 7);
  const dual = monthCashflowDualSnapshot(state, mk, today);
  const events = expandCashflowEvents(state, { months: [mk], horizon: "projected" });
  const outBy = eventsBySource(events, "out");
  const inBy = eventsBySource(events, "in");
  const lines: KpiBreakdownLine[] = [];
  for (const [src, amt] of outBy) {
    if (amt <= 0) continue;
    lines.push({ label: CASHFLOW_SOURCE_LABELS[src], amount: -amt });
  }
  for (const [src, amt] of inBy) {
    if (amt <= 0) continue;
    lines.push({ label: CASHFLOW_SOURCE_LABELS[src], amount: amt });
  }
  lines.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return {
    title: "Balance del mes",
    subtitle: `Realizado ${dual.actualNet.toFixed(0)} € · Previsto total ${dual.projectedNet.toFixed(0)} €`,
    total: dual.projectedNet,
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
  const bySrc = eventsBySource(events, "out");
  const lines: KpiBreakdownLine[] = [];
  let total = 0;
  for (const [src, amt] of bySrc) {
    total += amt;
    lines.push({ label: CASHFLOW_SOURCE_LABELS[src], amount: amt });
  }
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
  const bySrc = eventsBySource(events, "in");
  const lines: KpiBreakdownLine[] = [];
  let total = 0;
  for (const [src, amt] of bySrc) {
    total += amt;
    lines.push({ label: CASHFLOW_SOURCE_LABELS[src], amount: amt });
  }
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
  const lines: KpiBreakdownLine[] = months.map((mk, i) => {
    const monthEv = events.filter((e) => e.monthKey === mk);
    const inc = sumEvents(monthEv, "in");
    const out = sumEvents(monthEv, "out");
    const net = inc - out;
    const amount = kind === "income" ? inc : kind === "expense" ? out : net;
    return { label: monthShort[i] ?? mk, amount };
  }).filter((l) => l.amount > 0.005);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const titles = {
    income: `Ingresos ${year}`,
    expense: `Gastos ${year}`,
    net: `Balance ${year}`,
  };
  return { title: titles[kind], total, lines };
}
