import type {
  ExpenseCurrency,
  ExpenseRow,
  ExpenseTrackerState,
  PlannedExpenseEntry,
} from "./state";
import type { ExpenseScenario } from "./scenarios";
import { scenarioTotalAmount } from "./scenarios";

export type ScenarioPromoteInput = {
  title: string;
  categoryId: string;
  currency: ExpenseCurrency;
  note?: string;
  /** Pago inicial / entrada (opcional). */
  initialPayment?: number;
  initialPaymentDate?: string;
  registerInitialAsExpense?: boolean;
  /** Cuota mensual en gastos previstos. */
  monthlyAmount?: number;
  installmentCount?: number;
  startMonth?: string;
  dayOfMonth?: number;
  /** Compra única: importe y fecha. */
  oneOffAmount?: number;
  oneOffDate?: string;
  registerOneOffAsExpense?: boolean;
  registerOneOffAsPlanned?: boolean;
  /** Cuenta para el gasto de entrada (installments). */
  initialWealthAccountId?: string;
};

export type ScenarioPromoteResult = {
  planned?: PlannedExpenseEntry;
  expense?: ExpenseRow;
};

function cryptoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

/** Aplica promoción con importes reales (entrada + cuotas ajustadas). */
export function buildScenarioPromotion(
  scenario: ExpenseScenario,
  input: ScenarioPromoteInput,
  makeExpenseId: () => string,
): ScenarioPromoteResult {
  const result: ScenarioPromoteResult = {};
  const noteBase = input.note?.trim() || scenario.note?.trim();
  const promoteNote = noteBase ? `Promovido desde deseo: ${noteBase}` : "Promovido desde simulación";

  if (scenario.kind === "installments" || (input.monthlyAmount != null && input.monthlyAmount > 0)) {
    const monthly = Math.max(0, input.monthlyAmount ?? scenario.installmentAmount ?? 0);
    const count = Math.max(1, Math.floor(input.installmentCount ?? scenario.installmentCount ?? 1));
    const startMk =
      input.startMonth?.slice(0, 7) ||
      scenario.startMonth?.slice(0, 7) ||
      new Date().toISOString().slice(0, 7);
    const day = Math.min(31, Math.max(1, input.dayOfMonth ?? 1));
    const endMk = addMonths(startMk, count - 1);
    result.planned = {
      id: cryptoId(),
      title: input.title.trim() || scenario.title,
      dayOfMonth: day,
      note: promoteNote,
      typicalAmount: monthly,
      currency: input.currency,
      categoryId: input.categoryId,
      validFrom: `${startMk}-01`,
      validUntil: `${endMk}-28`,
    };
    const initial = Math.max(0, input.initialPayment ?? 0);
    if (input.registerInitialAsExpense && initial > 0) {
      const d = (input.initialPaymentDate ?? new Date().toISOString()).slice(0, 10);
      result.expense = {
        id: makeExpenseId(),
        date: d,
        label: `${input.title.trim() || scenario.title} (entrada)`,
        amount: initial,
        currency: input.currency,
        categoryId: input.categoryId,
        notes: promoteNote,
        tags: ["simulacion", "entrada"],
        attachments: [],
        confirmed: true,
        wealthAccountId: input.initialWealthAccountId,
      };
    }
    return result;
  }

  if (scenario.kind === "bundle") {
    const total = Math.max(0, input.oneOffAmount ?? scenarioTotalAmount(scenario));
    const d = (input.oneOffDate ?? scenario.targetDate ?? new Date().toISOString()).slice(0, 10);
    if (input.registerOneOffAsExpense) {
      result.expense = {
        id: makeExpenseId(),
        date: d.slice(0, 10),
        label: input.title.trim() || scenario.title,
        amount: total,
        currency: input.currency,
        categoryId: input.categoryId,
        notes: promoteNote,
        tags: ["simulacion"],
        attachments: [],
        confirmed: true,
      };
    } else if (input.registerOneOffAsPlanned !== false) {
      result.planned = {
        id: cryptoId(),
        title: input.title.trim() || scenario.title,
        dayOfMonth: Math.min(31, Math.max(1, Number(d.slice(8, 10)) || 1)),
        note: promoteNote,
        typicalAmount: total,
        currency: input.currency,
        categoryId: input.categoryId,
        validFrom: d,
        validUntil: d,
      };
    }
    return result;
  }

  const amount = Math.max(0, input.oneOffAmount ?? scenario.amount ?? scenarioTotalAmount(scenario));
  const d = (input.oneOffDate ?? scenario.targetDate ?? new Date().toISOString()).slice(0, 10);
  if (input.registerOneOffAsExpense) {
    result.expense = {
      id: makeExpenseId(),
      date: d.slice(0, 10),
      label: input.title.trim() || scenario.title,
      amount,
      currency: input.currency,
      categoryId: input.categoryId,
      notes: promoteNote,
      tags: ["simulacion"],
      attachments: [],
      confirmed: true,
    };
  } else {
    result.planned = {
      id: cryptoId(),
      title: input.title.trim() || scenario.title,
      dayOfMonth: Math.min(31, Math.max(1, Number(d.slice(8, 10)) || 1)),
      note: promoteNote,
      typicalAmount: amount,
      currency: input.currency,
      categoryId: input.categoryId,
      validFrom: d,
      validUntil: d,
    };
  }
  return result;
}

export function applyScenarioPromotionToState(
  state: ExpenseTrackerState,
  scenarioId: string,
  input: ScenarioPromoteInput,
  makeExpenseId: () => string,
): ExpenseTrackerState {
  const scenario = (state.scenarios ?? []).find((s) => s.id === scenarioId);
  if (!scenario) return state;
  const built = buildScenarioPromotion(scenario, input, makeExpenseId);
  const next: ExpenseTrackerState = { ...state };
  if (built.planned) {
    next.plannedExpenses = [...(next.plannedExpenses ?? []), built.planned];
  }
  if (built.expense) {
    next.expenses = [...next.expenses, built.expense];
  }
  next.scenarios = (next.scenarios ?? []).map((s) =>
    s.id === scenarioId ? { ...s, status: "go" as const } : s,
  );
  return next;
}

/** Valores sugeridos al abrir el modal de promoción. */
export function defaultPromoteInputFromScenario(
  scenario: ExpenseScenario,
  fallbackCategoryId: string,
): ScenarioPromoteInput {
  const base: ScenarioPromoteInput = {
    title: scenario.title,
    categoryId: scenario.categoryId || fallbackCategoryId,
    currency: scenario.currency ?? "EUR",
    note: scenario.note,
    dayOfMonth: 1,
    registerInitialAsExpense: true,
    registerOneOffAsExpense: false,
    registerOneOffAsPlanned: true,
  };
  if (scenario.kind === "installments") {
    return {
      ...base,
      monthlyAmount: scenario.installmentAmount,
      installmentCount: scenario.installmentCount,
      startMonth: scenario.startMonth,
      initialPayment: 0,
    };
  }
  if (scenario.kind === "bundle") {
    const mk = scenario.startMonth || scenario.targetDate?.slice(0, 7);
    return {
      ...base,
      oneOffAmount: scenarioTotalAmount(scenario),
      oneOffDate: mk ? `${mk}-15` : undefined,
    };
  }
  return {
    ...base,
    oneOffAmount: scenario.amount ?? scenarioTotalAmount(scenario),
    oneOffDate: scenario.targetDate,
  };
}
