import type { ExpenseCurrency, ExpenseTrackerState, PeriodFilter, PlannedExpenseEntry } from "./tools-expense-tracker";
import {
  computeCashAvailableTotal,
  monthlyIncomeSeries,
  monthlyPlannedOutflowSeries,
  subscriptionMonthlyBurnByCurrency,
  totalExpensesInPeriod,
} from "./tools-expense-tracker";

export type ScenarioKind = "one_off" | "installments" | "bundle";
export type ScenarioStatus = "idea" | "considering" | "go" | "no_go";
export type ScenarioPriority = "low" | "medium" | "high";
export type ScenarioTrafficLight = "viable" | "tight" | "risky";

export type ScenarioBundleItem = {
  id: string;
  label: string;
  amount: number;
};

export type ExpenseScenario = {
  id: string;
  title: string;
  note?: string;
  kind: ScenarioKind;
  currency?: ExpenseCurrency;
  categoryId?: string;
  status: ScenarioStatus;
  priority?: ScenarioPriority;
  amount?: number;
  targetDate?: string;
  installmentCount?: number;
  installmentAmount?: number;
  startMonth?: string;
  items?: ScenarioBundleItem[];
  createdAt?: string;
};

export type ScenarioViability = {
  scenarioId: string;
  monthlyImpact: number;
  oneOffTotal: number;
  monthlySurplus: number;
  cashAvailable: number;
  trafficLight: ScenarioTrafficLight;
  months: string[];
  baselineOutflow: number[];
  withScenarioOutflow: number[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addMonths(mk: string, offset: number): string {
  let y = Number(mk.slice(0, 4));
  let m = Number(mk.slice(5, 7));
  m += offset;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthKeysAhead(count: number, fromMk?: string): string[] {
  const base = fromMk && /^\d{4}-\d{2}$/.test(fromMk) ? fromMk : new Date().toISOString().slice(0, 7);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(addMonths(base, i));
  return out;
}

export function scenarioTotalAmount(s: ExpenseScenario): number {
  if (s.kind === "bundle") {
    return round2((s.items ?? []).reduce((sum, it) => sum + Math.max(0, it.amount), 0));
  }
  if (s.kind === "installments") {
    const n = Math.max(1, Math.floor(s.installmentCount ?? 1));
    const amt = Math.max(0, s.installmentAmount ?? 0);
    return round2(n * amt);
  }
  return round2(Math.max(0, s.amount ?? 0));
}

/** Impacto en el mes de mayor carga (cuota mensual o total one-off/bundle). */
export function scenarioPeakMonthlyImpact(s: ExpenseScenario): number {
  if (s.kind === "installments") return round2(Math.max(0, s.installmentAmount ?? 0));
  return scenarioTotalAmount(s);
}

export function parseExpenseScenarios(raw: unknown): ExpenseScenario[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const kind: ScenarioKind =
        r?.kind === "installments" || r?.kind === "bundle" || r?.kind === "one_off" ? r.kind : "one_off";
      const status: ScenarioStatus =
        r?.status === "considering" || r?.status === "go" || r?.status === "no_go" ? r.status : "idea";
      const priority: ScenarioPriority | undefined =
        r?.priority === "low" || r?.priority === "medium" || r?.priority === "high" ? r.priority : undefined;
      const items: ScenarioBundleItem[] = Array.isArray(r?.items)
        ? r.items
            .map((it: any) => ({
              id: String(it?.id || "").trim() || cryptoRandomId(),
              label: String(it?.label || "").trim() || "Partida",
              amount: Number.isFinite(Number(it?.amount)) ? Math.max(0, Number(it.amount)) : 0,
            }))
            .filter((it: ScenarioBundleItem) => it.id)
        : [];
      return {
        id: String(r?.id || "").trim() || cryptoRandomId(),
        title: String(r?.title || "").trim() || "Deseo",
        note: String(r?.note ?? "").trim() || undefined,
        kind,
        currency: r?.currency === "USD" ? "USD" : "EUR",
        categoryId: r?.categoryId ? String(r.categoryId).trim() : undefined,
        status,
        priority,
        amount: r?.amount != null && Number.isFinite(Number(r.amount)) ? Math.max(0, Number(r.amount)) : undefined,
        targetDate: String(r?.targetDate ?? "").slice(0, 10) || undefined,
        installmentCount:
          r?.installmentCount != null && Number.isFinite(Number(r.installmentCount))
            ? Math.max(1, Math.min(120, Math.floor(Number(r.installmentCount))))
            : undefined,
        installmentAmount:
          r?.installmentAmount != null && Number.isFinite(Number(r.installmentAmount))
            ? Math.max(0, Number(r.installmentAmount))
            : undefined,
        startMonth: String(r?.startMonth ?? "").slice(0, 7) || undefined,
        items: items.length ? items : undefined,
        createdAt: String(r?.createdAt ?? "").slice(0, 10) || undefined,
      } satisfies ExpenseScenario;
    })
    .filter((s) => s.id && s.title)
    .slice(0, 48);
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `sc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function currentMonthSurplus(state: ExpenseTrackerState): number {
  const today = new Date().toISOString().slice(0, 10);
  const curMonth = today.slice(0, 7);
  const fx = state.eurPerUsd;
  const expM = state.expenses.filter((e) => {
    if (!e.date.startsWith(curMonth) || e.confirmed === false) return false;
    const ts = state.trackingStartDate?.slice(0, 10);
    if (ts && ts.length === 10 && e.date < ts) return false;
    return true;
  });
  let expMEur = 0;
  for (const e of expM) {
    expMEur += e.currency === "EUR" ? Math.max(0, e.amount) : e.amount * fx;
  }
  const burn = subscriptionMonthlyBurnByCurrency(state);
  const planM = monthlyPlannedOutflowSeries(state, [curMonth], "unify_eur", fx);
  const outMEur = expMEur + burn.eur + burn.usd * fx + (planM.seriesUnified[0] ?? 0);
  const incS = monthlyIncomeSeries(state, [curMonth], "unify_eur", fx);
  const incEur = incS.seriesUnified[0] ?? 0;
  return round2(incEur - outMEur);
}

function baselineMonthlyOutflow(state: ExpenseTrackerState, months: string[]): number[] {
  const fx = state.eurPerUsd;
  const burn = subscriptionMonthlyBurnByCurrency(state);
  const planned = monthlyPlannedOutflowSeries(state, months, "unify_eur", fx);
  const today = new Date().toISOString().slice(0, 10);
  return months.map((mk) => {
    let exp = 0;
    for (const e of state.expenses) {
      if (e.confirmed === false || !e.date.startsWith(mk)) continue;
      if (e.date > today) continue;
      exp += e.currency === "EUR" ? Math.max(0, e.amount) : Math.max(0, e.amount) * fx;
    }
    return round2(exp + burn.eur + burn.usd * fx + (planned.seriesUnified[months.indexOf(mk)] ?? 0));
  });
}

function scenarioImpactByMonth(s: ExpenseScenario, months: string[]): number[] {
  const impacts = new Array(months.length).fill(0) as number[];
  if (s.kind === "installments") {
    const start = s.startMonth && months.includes(s.startMonth) ? s.startMonth : months[0]!;
    const startIdx = months.indexOf(start);
    const n = Math.max(1, Math.floor(s.installmentCount ?? 1));
    const amt = Math.max(0, s.installmentAmount ?? 0);
    for (let i = 0; i < n && startIdx + i < months.length; i++) {
      impacts[startIdx + i] = amt;
    }
    return impacts;
  }
  const total = scenarioTotalAmount(s);
  const targetMk =
    s.targetDate?.slice(0, 7) && months.includes(s.targetDate.slice(0, 7))
      ? s.targetDate.slice(0, 7)
      : s.startMonth && months.includes(s.startMonth)
        ? s.startMonth
        : months[0]!;
  const idx = months.indexOf(targetMk);
  if (idx >= 0) impacts[idx] = total;
  return impacts;
}

function classifyTraffic(
  monthlyImpact: number,
  oneOffTotal: number,
  surplus: number,
  cash: number,
  kind: ScenarioKind,
): ScenarioTrafficLight {
  if (kind === "installments") {
    if (surplus > 0 && monthlyImpact <= surplus * 0.3) return "viable";
    if (surplus > 0 && monthlyImpact <= surplus * 0.6) return "tight";
    if (monthlyImpact <= cash * 0.15) return "tight";
    return "risky";
  }
  if (oneOffTotal <= cash * 0.5 && (surplus <= 0 || oneOffTotal <= surplus * 2)) return "viable";
  if (oneOffTotal <= cash * 0.85) return "tight";
  return "risky";
}

export function scenarioMonthlyImpactSeries(
  state: ExpenseTrackerState,
  scenario: ExpenseScenario,
  monthCount = 8,
): { months: string[]; baseline: number[]; withScenario: number[] } {
  const startMk =
    scenario.startMonth ||
    scenario.targetDate?.slice(0, 7) ||
    new Date().toISOString().slice(0, 7);
  const months = monthKeysAhead(monthCount, startMk);
  const baseline = baselineMonthlyOutflow(state, months);
  const impact = scenarioImpactByMonth(scenario, months);
  const withScenario = baseline.map((b, i) => round2(b + (impact[i] ?? 0)));
  return { months, baseline, withScenario };
}

export function evaluateScenarioViability(state: ExpenseTrackerState, scenario: ExpenseScenario): ScenarioViability {
  const monthlyImpact = scenarioPeakMonthlyImpact(scenario);
  const oneOffTotal = scenarioTotalAmount(scenario);
  const monthlySurplus = currentMonthSurplus(state);
  const cashAvailable = computeCashAvailableTotal(state.wealthAccounts ?? []);
  const trafficLight = classifyTraffic(monthlyImpact, oneOffTotal, monthlySurplus, cashAvailable, scenario.kind);
  const { months, baseline, withScenario } = scenarioMonthlyImpactSeries(state, scenario, 8);
  return {
    scenarioId: scenario.id,
    monthlyImpact,
    oneOffTotal,
    monthlySurplus,
    cashAvailable,
    trafficLight,
    months,
    baselineOutflow: baseline,
    withScenarioOutflow: withScenario,
  };
}

/** Convierte un escenario promovido a gasto previsto recurrente. */
export function scenarioToPlannedExpense(
  scenario: ExpenseScenario,
  fallbackCategoryId: string,
): PlannedExpenseEntry {
  const total = scenarioTotalAmount(scenario);
  const day =
    scenario.targetDate && scenario.targetDate.length === 10
      ? Math.min(31, Math.max(1, Number(scenario.targetDate.slice(8, 10)) || 1))
      : 1;
  const from =
    scenario.startMonth && /^\d{4}-\d{2}$/.test(scenario.startMonth)
      ? `${scenario.startMonth}-01`
      : scenario.targetDate?.slice(0, 10);
  let until: string | undefined;
  if (scenario.kind === "installments" && scenario.startMonth && scenario.installmentCount) {
    const endMk = addMonths(scenario.startMonth, scenario.installmentCount - 1);
    until = `${endMk}-28`;
  } else if (scenario.targetDate) {
    until = scenario.targetDate.slice(0, 10);
  }
  return {
    id: cryptoRandomId(),
    title: scenario.title,
    dayOfMonth: day,
    note: scenario.note ? `Desde simulación: ${scenario.note}` : "Promovido desde simulación",
    typicalAmount: scenario.kind === "installments" ? scenario.installmentAmount ?? total : total,
    currency: scenario.currency ?? "EUR",
    categoryId: scenario.categoryId || fallbackCategoryId,
    validFrom: from,
    validUntil: until,
  };
}

export function compareScenarios(state: ExpenseTrackerState, ids: string[]): ScenarioViability[] {
  const map = new Map((state.scenarios ?? []).map((s) => [s.id, s]));
  return ids
    .map((id) => map.get(id))
    .filter((s): s is ExpenseScenario => Boolean(s))
    .map((s) => evaluateScenarioViability(state, s));
}
