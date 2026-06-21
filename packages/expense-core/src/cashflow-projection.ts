/**
 * Motor unificado de proyección de caja para expense tracker.
 * Expande cada sección del estado a eventos atómicos y agrega por mes / fuente / categoría.
 */

import { subscriptionBillingSnapshot } from "./subscriptions-billing";
import type { ExpenseDebt } from "./debts";
import type {
  BillingCycle,
  ChartMoneyMode,
  ExpenseCurrency,
  ExpenseRow,
  ExpenseTrackerState,
  IncomeMonthOverride,
  PaycheckEntry,
  PlannedExpenseEntry,
  PlannedExpenseMonthOverride,
  SubscriptionRow,
} from "./state";
import { convertAmount, daysInMonthKey, recurringActiveInMonth, recurringChargeDate, rollupCategoryId } from "./state";

export type CashflowDirection = "in" | "out";

export type CashflowSource =
  | "expense"
  | "subscription"
  | "planned"
  | "planned_down_payment"
  | "debt_installment"
  | "paycheck"
  | "income_adhoc";

/** actual = solo cargos con chargeDate ≤ asOfDate; projected = todos los programados en rango. */
export type CashflowHorizon = "actual" | "projected";

export type CashflowEvent = {
  source: CashflowSource;
  sourceId: string;
  direction: CashflowDirection;
  monthKey: string;
  chargeDate: string;
  amount: number;
  currency: ExpenseCurrency;
  label: string;
  categoryId?: string;
};

export type CashflowProjectionOptions = {
  mode?: ChartMoneyMode;
  eurPerUsd?: number;
  horizon?: CashflowHorizon;
  asOfDate?: string;
  periodStart?: string | null;
  categoryFilterId?: string | null;
  /** Si se define, solo se emiten eventos en estos meses. */
  months?: string[];
  direction?: CashflowDirection | "both";
};

export type MonthlyCashflowSeries = {
  months: string[];
  outEur: number[];
  outUsd: number[];
  outUnified: number[];
  inEur: number[];
  inUsd: number[];
  inUnified: number[];
};

export type CashflowSourceBreakdown = Partial<Record<CashflowSource, number>>;

function lastDayIsoOfMonth(monthKey: string): string {
  const dim = daysInMonthKey(monthKey);
  return `${monthKey}-${String(dim).padStart(2, "0")}`;
}

function subscriptionCountsInTotals(s: SubscriptionRow, refDate?: string): boolean {
  if (!s.active) return false;
  const today = (refDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cancel = s.cancelEffectiveDate?.trim().slice(0, 10);
  if (cancel && cancel.length === 10 && today > cancel) return false;
  return true;
}

function subscriptionToMonthlyAmount(s: SubscriptionRow, refDate?: string): number {
  if (!subscriptionCountsInTotals(s, refDate)) return 0;
  const snap = subscriptionBillingSnapshot(s, refDate);
  const amt = Math.max(0, snap.cycleAmount);
  if (amt <= 0) return 0;
  switch (s.cycle) {
    case "weekly":
      return (amt * 52) / 12;
    case "monthly":
      return amt;
    case "quarterly":
      return amt / 3;
    case "yearly":
      return amt / 12;
    default:
      return amt;
  }
}

function effectivePaycheckAmount(
  p: PaycheckEntry,
  monthKey: string,
  overrides: IncomeMonthOverride[],
): { amount: number; currency: ExpenseCurrency } {
  const cur: ExpenseCurrency = p.currency === "USD" ? "USD" : "EUR";
  const hit = overrides.find((o) => o.paycheckId === p.id && o.month === monthKey);
  if (hit) return { amount: Math.max(0, hit.amount), currency: hit.currency };
  return { amount: Math.max(0, p.typicalAmount ?? 0), currency: cur };
}

function plannedActiveInMonth(p: PlannedExpenseEntry, monthKey: string): boolean {
  return recurringActiveInMonth(p, monthKey);
}

/** Cuota mensual de un previsto (sin entrada; la entrada es evento aparte). */
export function effectivePlannedInstallmentAmount(
  p: PlannedExpenseEntry,
  monthKey: string,
  overrides: PlannedExpenseMonthOverride[],
): { amount: number; currency: ExpenseCurrency } {
  const cur: ExpenseCurrency = p.currency === "USD" ? "USD" : "EUR";
  const hit = overrides.find((o) => o.plannedExpenseId === p.id && o.month === monthKey);
  if (hit) return { amount: Math.max(0, hit.amount), currency: hit.currency };
  const firstMk = p.validFrom?.trim().slice(0, 7);
  if (p.downPayment != null && p.downPayment > 0 && firstMk && monthKey === firstMk) {
    return { amount: 0, currency: cur };
  }
  return { amount: Math.max(0, p.typicalAmount ?? 0), currency: cur };
}

function matchesCategoryFilter(
  state: ExpenseTrackerState,
  categoryId: string | undefined,
  filterId: string | null,
): boolean {
  if (!filterId) return true;
  if (!categoryId) return false;
  const root = rollupCategoryId(state, categoryId);
  const target = rollupCategoryId(state, filterId);
  if (root === target) return true;
  const cat = state.categories.find((c) => c.id === categoryId);
  return cat?.parentId === target;
}

function eventPassesHorizon(chargeDate: string, horizon: CashflowHorizon, asOfDate: string): boolean {
  if (horizon === "projected") return true;
  return chargeDate <= asOfDate;
}

function eventPassesBounds(
  chargeDate: string,
  monthKey: string,
  opts: CashflowProjectionOptions,
): boolean {
  const { periodStart, months } = opts;
  if (months?.length && !months.includes(monthKey)) return false;
  if (periodStart && chargeDate < periodStart) return false;
  return true;
}

/** Expande todas las fuentes del estado a eventos de caja atómicos. */
export function expandCashflowEvents(state: ExpenseTrackerState, opts: CashflowProjectionOptions = {}): CashflowEvent[] {
  const events: CashflowEvent[] = [];
  const horizon = opts.horizon ?? "projected";
  const asOf = (opts.asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const periodStart = opts.periodStart ?? state.trackingStartDate?.slice(0, 10) ?? null;
  const categoryFilterId = opts.categoryFilterId?.trim() || null;
  const mergedOpts: CashflowProjectionOptions = { ...opts, periodStart, horizon, asOfDate: asOf };

  const monthSet = opts.months?.length ? new Set(opts.months) : null;

  // Gastos confirmados
  for (const e of state.expenses) {
    if (e.confirmed === false) continue;
    const mk = e.date.slice(0, 7);
    if (monthSet && !monthSet.has(mk)) continue;
    if (categoryFilterId && !matchesCategoryFilter(state, e.categoryId, categoryFilterId)) continue;
    const ev: CashflowEvent = {
      source: "expense",
      sourceId: e.id,
      direction: "out",
      monthKey: mk,
      chargeDate: e.date.slice(0, 10),
      amount: Math.max(0, e.amount),
      currency: e.currency,
      label: e.label,
      categoryId: e.categoryId,
    };
    if (eventPassesHorizon(ev.chargeDate, horizon, asOf) && eventPassesBounds(ev.chargeDate, mk, mergedOpts)) {
      if ((opts.direction ?? "both") === "both" || opts.direction === "out") events.push(ev);
    }
  }

  // Suscripciones — equiv. mensual por mes calendario (trial vs regular)
  const subMonths = monthSet ? [...monthSet] : collectMonthsFromState(state, opts);
  for (const mk of subMonths) {
    const refDate = mk === asOf.slice(0, 7) && horizon === "actual" ? asOf : lastDayIsoOfMonth(mk);
    for (const s of state.subscriptions) {
      if (!subscriptionCountsInTotals(s, refDate)) continue;
      const monthly = subscriptionToMonthlyAmount(s, refDate);
      if (monthly <= 0) continue;
      if (categoryFilterId && !matchesCategoryFilter(state, s.categoryId, categoryFilterId)) continue;
      const chargeDate = recurringChargeDate(1, mk);
      const ev: CashflowEvent = {
        source: "subscription",
        sourceId: s.id,
        direction: "out",
        monthKey: mk,
        chargeDate,
        amount: monthly,
        currency: s.currency,
        label: s.name,
        categoryId: s.categoryId,
      };
      if (eventPassesHorizon(ev.chargeDate, horizon, asOf) && eventPassesBounds(ev.chargeDate, mk, mergedOpts)) {
        if ((opts.direction ?? "both") === "both" || opts.direction === "out") events.push(ev);
      }
    }
  }

  // Previstos / financiación
  const planOverrides = state.plannedExpenseMonthOverrides ?? [];
  for (const p of state.plannedExpenses ?? []) {
    const activeMonths = monthSet ? [...monthSet].filter((mk) => plannedActiveInMonth(p, mk)) : monthsForPlanned(p, subMonths);
    for (const mk of activeMonths) {
      if (categoryFilterId && !matchesCategoryFilter(state, p.categoryId, categoryFilterId)) continue;
      const chargeDate = recurringChargeDate(p.dayOfMonth, mk);
      const firstMk = p.validFrom?.trim().slice(0, 7);
      const down = p.downPayment != null && p.downPayment > 0 ? Math.max(0, p.downPayment) : 0;
      if (down > 0 && firstMk && mk === firstMk) {
        const hasOverride = planOverrides.some((o) => o.plannedExpenseId === p.id && o.month === mk);
        if (!hasOverride) {
          const evDown: CashflowEvent = {
            source: "planned_down_payment",
            sourceId: p.id,
            direction: "out",
            monthKey: mk,
            chargeDate,
            amount: down,
            currency: p.currency === "USD" ? "USD" : "EUR",
            label: `${p.title} (entrada)`,
            categoryId: p.categoryId,
          };
          if (eventPassesHorizon(evDown.chargeDate, horizon, asOf) && eventPassesBounds(evDown.chargeDate, mk, mergedOpts)) {
            if ((opts.direction ?? "both") === "both" || opts.direction === "out") events.push(evDown);
          }
        }
      }
      const { amount, currency } = effectivePlannedInstallmentAmount(p, mk, planOverrides);
      if (amount > 0) {
        const ev: CashflowEvent = {
          source: "planned",
          sourceId: p.id,
          direction: "out",
          monthKey: mk,
          chargeDate,
          amount,
          currency,
          label: p.title,
          categoryId: p.categoryId,
        };
        if (eventPassesHorizon(ev.chargeDate, horizon, asOf) && eventPassesBounds(ev.chargeDate, mk, mergedOpts)) {
          if ((opts.direction ?? "both") === "both" || opts.direction === "out") events.push(ev);
        }
      }
    }
  }

  // Deudas — cuotas pending (paid con expenseId ya están en expenses)
  for (const debt of state.debts ?? []) {
    expandDebtEvents(events, debt, state, mergedOpts, monthSet, categoryFilterId);
  }

  // Ingresos
  const paycheckOverrides = state.incomeMonthOverrides ?? [];
  const incomeMonths = monthSet ? [...monthSet] : subMonths;
  for (const mk of incomeMonths) {
    for (const p of state.paychecks ?? []) {
      if (!recurringActiveInMonth(p, mk)) continue;
      const chargeDate = recurringChargeDate(p.dayOfMonth, mk);
      const { amount, currency } = effectivePaycheckAmount(p, mk, paycheckOverrides);
      if (amount <= 0) continue;
      const ev: CashflowEvent = {
        source: "paycheck",
        sourceId: p.id,
        direction: "in",
        monthKey: mk,
        chargeDate,
        amount,
        currency,
        label: p.title,
      };
      if (eventPassesHorizon(ev.chargeDate, horizon, asOf) && eventPassesBounds(ev.chargeDate, mk, mergedOpts)) {
        if ((opts.direction ?? "both") === "both" || opts.direction === "in") events.push(ev);
      }
    }
    for (const row of state.incomeAdhoc ?? []) {
      if (row.confirmed === false) continue;
      if (!row.date.startsWith(mk)) continue;
      const ev: CashflowEvent = {
        source: "income_adhoc",
        sourceId: row.id,
        direction: "in",
        monthKey: mk,
        chargeDate: row.date.slice(0, 10),
        amount: Math.max(0, row.amount),
        currency: row.currency,
        label: row.label,
        categoryId: row.categoryId,
      };
      if (eventPassesHorizon(ev.chargeDate, horizon, asOf) && eventPassesBounds(ev.chargeDate, mk, mergedOpts)) {
        if ((opts.direction ?? "both") === "both" || opts.direction === "in") events.push(ev);
      }
    }
  }

  return events;
}

function expandDebtEvents(
  events: CashflowEvent[],
  debt: ExpenseDebt,
  state: ExpenseTrackerState,
  opts: CashflowProjectionOptions,
  monthSet: Set<string> | null,
  categoryFilterId: string | null,
): void {
  const horizon = opts.horizon ?? "projected";
  const asOf = (opts.asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cur: ExpenseCurrency = debt.currency === "USD" ? "USD" : "EUR";
  for (const inst of debt.installments ?? []) {
    if (inst.status !== "pending") continue;
    if (inst.expenseId) continue;
    const due = inst.dueDate.slice(0, 10);
    const mk = due.slice(0, 7);
    if (monthSet && !monthSet.has(mk)) continue;
    if (categoryFilterId && debt.categoryId && !matchesCategoryFilter(state, debt.categoryId, categoryFilterId)) continue;
    const label = inst.label ? `${debt.title} — ${inst.label}` : debt.title;
    const ev: CashflowEvent = {
      source: "debt_installment",
      sourceId: inst.id,
      direction: "out",
      monthKey: mk,
      chargeDate: due,
      amount: Math.max(0, inst.amount),
      currency: cur,
      label,
      categoryId: debt.categoryId,
    };
    if (eventPassesHorizon(ev.chargeDate, horizon, asOf) && eventPassesBounds(ev.chargeDate, mk, opts)) {
      if ((opts.direction ?? "both") === "both" || opts.direction === "out") events.push(ev);
    }
  }
}

function monthsForPlanned(p: PlannedExpenseEntry, fallbackMonths: string[]): string[] {
  if (fallbackMonths.length) return fallbackMonths.filter((mk) => plannedActiveInMonth(p, mk));
  const from = p.validFrom?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const until = p.validUntil?.slice(0, 7) ?? from;
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ty = Number(until.slice(0, 4));
  const tm = Number(until.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    if (plannedActiveInMonth(p, mk)) out.push(mk);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function collectMonthsFromState(state: ExpenseTrackerState, opts: CashflowProjectionOptions): string[] {
  const keys = new Set<string>();
  const today = (opts.asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  keys.add(today.slice(0, 7));
  for (const e of state.expenses) keys.add(e.date.slice(0, 7));
  for (const p of state.plannedExpenses ?? []) {
    for (const mk of monthsForPlanned(p, [])) keys.add(mk);
  }
  for (const debt of state.debts ?? []) {
    for (const inst of debt.installments ?? []) {
      if (inst.status === "pending") keys.add(inst.dueDate.slice(0, 7));
    }
  }
  return [...keys].sort();
}

function unifyAmount(amount: number, currency: ExpenseCurrency, mode: ChartMoneyMode, fx: number): number {
  if (mode === "unify_eur") return currency === "EUR" ? amount : convertAmount(amount, "USD", "EUR", fx);
  if (mode === "unify_usd") return currency === "USD" ? amount : convertAmount(amount, "EUR", "USD", fx);
  return amount;
}

/** Agrega eventos en series mensuales de salidas e ingresos. */
export function aggregateCashflowByMonth(
  events: CashflowEvent[],
  months: string[],
  mode: ChartMoneyMode,
  eurPerUsd: number,
): MonthlyCashflowSeries {
  const outEur = months.map(() => 0);
  const outUsd = months.map(() => 0);
  const inEur = months.map(() => 0);
  const inUsd = months.map(() => 0);
  const idx = new Map(months.map((m, i) => [m, i] as const));

  for (const ev of events) {
    const i = idx.get(ev.monthKey);
    if (i == null) continue;
    if (ev.direction === "out") {
      if (ev.currency === "EUR") outEur[i]! += ev.amount;
      else outUsd[i]! += ev.amount;
    } else {
      if (ev.currency === "EUR") inEur[i]! += ev.amount;
      else inUsd[i]! += ev.amount;
    }
  }

  const outUnified = months.map((_, i) => {
    const eur = outEur[i]!;
    const usd = outUsd[i]!;
    if (mode === "unify_eur") return eur + convertAmount(usd, "USD", "EUR", eurPerUsd);
    if (mode === "unify_usd") return usd + convertAmount(eur, "EUR", "USD", eurPerUsd);
    return eur + usd;
  });
  const inUnified = months.map((_, i) => {
    const eur = inEur[i]!;
    const usd = inUsd[i]!;
    if (mode === "unify_eur") return eur + convertAmount(usd, "USD", "EUR", eurPerUsd);
    if (mode === "unify_usd") return usd + convertAmount(eur, "EUR", "USD", eurPerUsd);
    return eur + usd;
  });

  return { months, outEur, outUsd, outUnified, inEur, inUsd, inUnified };
}

/** Desglose por fuente en un mes (importes unificados en EUR por defecto). */
export function aggregateCashflowBySource(
  events: CashflowEvent[],
  monthKey: string,
  mode: ChartMoneyMode = "unify_eur",
  eurPerUsd = 0.92,
): CashflowSourceBreakdown {
  const out: CashflowSourceBreakdown = {};
  for (const ev of events) {
    if (ev.monthKey !== monthKey) continue;
    const sign = ev.direction === "in" ? 1 : -1;
    const unified = sign * unifyAmount(ev.amount, ev.currency, mode, eurPerUsd);
    out[ev.source] = (out[ev.source] ?? 0) + unified;
  }
  return out;
}

export const CASHFLOW_SOURCE_LABELS: Record<CashflowSource, string> = {
  expense: "Gastos confirmados",
  subscription: "Suscripciones",
  planned: "Financiación / previstos",
  planned_down_payment: "Entrada financiación",
  debt_installment: "Deudas",
  paycheck: "Nómina / cobros",
  income_adhoc: "Ingresos puntuales",
};

/** Serie mensual de suscripciones con trial por mes (sustituye burn plano en gráficos). */
export function monthlySubscriptionOutflowSeries(
  state: ExpenseTrackerState,
  months: string[],
  mode: ChartMoneyMode,
  eurPerUsd: number,
  opts?: Pick<CashflowProjectionOptions, "horizon" | "asOfDate" | "categoryFilterId">,
): { seriesEur: number[]; seriesUsd: number[]; seriesUnified: number[] } {
  const events = expandCashflowEvents(state, {
    ...opts,
    months,
    direction: "out",
  }).filter((e) => e.source === "subscription");
  const agg = aggregateCashflowByMonth(events, months, mode, eurPerUsd);
  return { seriesEur: agg.outEur, seriesUsd: agg.outUsd, seriesUnified: agg.outUnified };
}

/** Serie mensual de cuotas de deuda pending. */
export function monthlyDebtOutflowSeries(
  state: ExpenseTrackerState,
  months: string[],
  mode: ChartMoneyMode,
  eurPerUsd: number,
  opts?: Pick<CashflowProjectionOptions, "horizon" | "asOfDate" | "categoryFilterId">,
): { seriesEur: number[]; seriesUsd: number[]; seriesUnified: number[] } {
  const events = expandCashflowEvents(state, {
    ...opts,
    months,
    direction: "out",
  }).filter((e) => e.source === "debt_installment");
  const agg = aggregateCashflowByMonth(events, months, mode, eurPerUsd);
  return { seriesEur: agg.outEur, seriesUsd: agg.outUsd, seriesUnified: agg.outUnified };
}

/** Serie mensual de previstos incluyendo entrada. */
export function monthlyPlannedOutflowSeriesFromProjection(
  state: ExpenseTrackerState,
  months: string[],
  mode: ChartMoneyMode,
  eurPerUsd: number,
  opts?: Pick<CashflowProjectionOptions, "horizon" | "asOfDate" | "categoryFilterId">,
): { seriesEur: number[]; seriesUsd: number[]; seriesUnified: number[] } {
  const events = expandCashflowEvents(state, {
    ...opts,
    months,
    direction: "out",
  }).filter((e) => e.source === "planned" || e.source === "planned_down_payment");
  const agg = aggregateCashflowByMonth(events, months, mode, eurPerUsd);
  return { seriesEur: agg.outEur, seriesUsd: agg.outUsd, seriesUnified: agg.outUnified };
}

/** Proyección completa de caja para una lista de meses. */
export function buildMonthlyCashflowProjection(
  state: ExpenseTrackerState,
  months: string[],
  opts: CashflowProjectionOptions = {},
): MonthlyCashflowSeries & { events: CashflowEvent[] } {
  const mode = opts.mode ?? state.chartMoneyMode;
  const fx = opts.eurPerUsd ?? state.eurPerUsd;
  const events = expandCashflowEvents(state, { ...opts, months, mode, eurPerUsd: fx });
  const series = aggregateCashflowByMonth(events, months, mode, fx);
  return { ...series, events };
}

export type MonthCashflowDualSnapshot = {
  monthKey: string;
  actualOut: number;
  actualIn: number;
  actualNet: number;
  projectedOut: number;
  projectedIn: number;
  projectedNet: number;
  remainingOut: number;
  remainingIn: number;
  remainingNet: number;
};

/** Realizado vs previsto restante del mes (para KPIs dual). */
export function monthCashflowDualSnapshot(
  state: ExpenseTrackerState,
  monthKey: string,
  asOfDate?: string,
): MonthCashflowDualSnapshot {
  const asOf = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const mode = state.chartMoneyMode;
  const fx = state.eurPerUsd;
  const months = [monthKey];
  const actual = buildMonthlyCashflowProjection(state, months, {
    horizon: "actual",
    asOfDate: asOf,
    mode,
    eurPerUsd: fx,
  });
  const projected = buildMonthlyCashflowProjection(state, months, {
    horizon: "projected",
    asOfDate: asOf,
    mode,
    eurPerUsd: fx,
  });
  const actualOut = actual.outUnified[0] ?? 0;
  const actualIn = actual.inUnified[0] ?? 0;
  const projectedOut = projected.outUnified[0] ?? 0;
  const projectedIn = projected.inUnified[0] ?? 0;
  return {
    monthKey,
    actualOut,
    actualIn,
    actualNet: actualIn - actualOut,
    projectedOut,
    projectedIn,
    projectedNet: projectedIn - projectedOut,
    remainingOut: Math.max(0, projectedOut - actualOut),
    remainingIn: Math.max(0, projectedIn - actualIn),
    remainingNet: projectedIn - projectedOut - (actualIn - actualOut),
  };
}

/** Totales de salidas en periodo usando horizonte actual (≤ hoy). */
export function totalOutflowInPeriodFromProjection(
  state: ExpenseTrackerState,
  periodStart: string | null,
  asOfDate?: string,
): number {
  const asOf = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const startMk = periodStart?.slice(0, 7) ?? asOf.slice(0, 7);
  const endMk = asOf.slice(0, 7);
  const months = monthKeysRange(startMk, endMk);
  const proj = buildMonthlyCashflowProjection(state, months, {
    horizon: "actual",
    asOfDate: asOf,
    periodStart,
    direction: "out",
    mode: "unify_eur",
    eurPerUsd: state.eurPerUsd,
  });
  return Math.round(proj.outUnified.reduce((a, b) => a + b, 0) * 100) / 100;
}

/** Totales de ingresos en periodo usando horizonte actual (≤ hoy). */
export function totalInflowInPeriodFromProjection(
  state: ExpenseTrackerState,
  periodStart: string | null,
  asOfDate?: string,
): number {
  const asOf = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const startMk = periodStart?.slice(0, 7) ?? asOf.slice(0, 7);
  const endMk = asOf.slice(0, 7);
  const months = monthKeysRange(startMk, endMk);
  const proj = buildMonthlyCashflowProjection(state, months, {
    horizon: "actual",
    asOfDate: asOf,
    periodStart,
    direction: "in",
    mode: "unify_eur",
    eurPerUsd: state.eurPerUsd,
  });
  return Math.round(proj.inUnified.reduce((a, b) => a + b, 0) * 100) / 100;
}

function monthKeysRange(startMk: string, endMk: string): string[] {
  const out: string[] = [];
  let y = Number(startMk.slice(0, 4));
  let m = Number(startMk.slice(5, 7));
  const ty = Number(endMk.slice(0, 4));
  const tm = Number(endMk.slice(5, 7));
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

export type CategoryTotalsProjection = Record<string, { eurNative: number; usdNative: number; unified: number }>;

/** Totales por categoría incluyendo subs, planned y deudas pending en los meses dados. */
export function buildCategoryTotalsFromProjection(
  state: ExpenseTrackerState,
  months: string[],
  expensesFiltered: ExpenseRow[],
  opts?: Pick<CashflowProjectionOptions, "horizon" | "asOfDate">,
): CategoryTotalsProjection {
  const out: CategoryTotalsProjection = {};
  for (const c of state.categories) {
    out[c.id] = { eurNative: 0, usdNative: 0, unified: 0 };
  }
  const mode = state.chartMoneyMode;
  const fx = state.eurPerUsd;

  const add = (categoryId: string, amount: number, currency: ExpenseCurrency) => {
    const rollupId = rollupCategoryId(state, categoryId);
    const bucket = out[rollupId] ?? (out[rollupId] = { eurNative: 0, usdNative: 0, unified: 0 });
    if (currency === "EUR") bucket.eurNative += amount;
    else bucket.usdNative += amount;
    if (mode === "unify_eur") bucket.unified += convertAmount(amount, currency, "EUR", fx);
    else if (mode === "unify_usd") bucket.unified += convertAmount(amount, currency, "USD", fx);
  };

  for (const e of expensesFiltered) {
    if (e.confirmed === false) continue;
    if (!months.includes(e.date.slice(0, 7))) continue;
    add(e.categoryId, Math.max(0, e.amount), e.currency);
  }

  const events = expandCashflowEvents(state, {
    ...opts,
    months,
    direction: "out",
  }).filter((e) => e.source !== "expense" && e.categoryId);

  for (const ev of events) {
    if (!ev.categoryId) continue;
    add(ev.categoryId, ev.amount, ev.currency);
  }

  return out;
}
