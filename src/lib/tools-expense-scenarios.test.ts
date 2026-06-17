import { describe, expect, it } from "vitest";
import {
  defaultExpenseTrackerState,
  periodFixedDiscretionarySplit,
  periodMarginSnapshot,
} from "./tools-expense-tracker";
import {
  compareScenarios,
  evaluateScenarioViability,
  parseExpenseScenarios,
  scenarioMonthlyImpactSeries,
  scenarioToPlannedExpense,
  scenarioTotalAmount,
  type ExpenseScenario,
} from "./tools-expense-scenarios";

function baseState() {
  const s = defaultExpenseTrackerState();
  const catId = s.categories[0]!.id;
  s.wealthAccounts = [{ id: "w1", name: "Cuenta", balance: 5000 }];
  s.paychecks = [
    {
      id: "p1",
      title: "Nómina",
      dayOfMonth: 1,
      typicalAmount: 3000,
      currency: "EUR",
    },
  ];
  return { state: s, catId };
}

describe("parseExpenseScenarios", () => {
  it("parses valid rows and assigns default title when missing", () => {
    const rows = parseExpenseScenarios([
      { id: "a", title: "Móvil", kind: "installments", installmentAmount: 50, installmentCount: 12, status: "idea" },
      { title: "" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.kind).toBe("installments");
    expect(rows[1]!.title).toBe("Deseo");
  });
});

describe("scenarioTotalAmount", () => {
  it("sums bundle items", () => {
    const sc: ExpenseScenario = {
      id: "b1",
      title: "Viaje",
      kind: "bundle",
      status: "idea",
      items: [
        { id: "i1", label: "Vuelo", amount: 400 },
        { id: "i2", label: "Hotel", amount: 600 },
      ],
    };
    expect(scenarioTotalAmount(sc)).toBe(1000);
  });

  it("multiplies installments", () => {
    const sc: ExpenseScenario = {
      id: "i1",
      title: "Cuotas",
      kind: "installments",
      status: "idea",
      installmentAmount: 100,
      installmentCount: 10,
    };
    expect(scenarioTotalAmount(sc)).toBe(1000);
  });
});

describe("evaluateScenarioViability", () => {
  it("marks small installment as viable with high surplus", () => {
    const { state, catId } = baseState();
    const scenario: ExpenseScenario = {
      id: "s1",
      title: "Cuota baja",
      kind: "installments",
      status: "considering",
      installmentAmount: 50,
      installmentCount: 12,
      startMonth: new Date().toISOString().slice(0, 7),
      categoryId: catId,
    };
    const v = evaluateScenarioViability(state, scenario);
    expect(v.monthlyImpact).toBe(50);
    expect(v.trafficLight).toBe("viable");
    expect(v.cashAvailable).toBeGreaterThan(0);
  });

  it("marks expensive one-off as risky when cash is low", () => {
    const { state, catId } = baseState();
    state.wealthAccounts[0]!.balance = 200;
    const scenario: ExpenseScenario = {
      id: "s2",
      title: "Compra grande",
      kind: "one_off",
      status: "idea",
      amount: 1500,
      targetDate: new Date().toISOString().slice(0, 10),
      categoryId: catId,
    };
    const v = evaluateScenarioViability(state, scenario);
    expect(v.trafficLight).toBe("risky");
  });
});

describe("scenarioMonthlyImpactSeries", () => {
  it("adds installment impact only in active months", () => {
    const { state } = baseState();
    const start = "2026-01";
    const scenario: ExpenseScenario = {
      id: "s3",
      title: "3 cuotas",
      kind: "installments",
      status: "idea",
      installmentAmount: 100,
      installmentCount: 3,
      startMonth: start,
    };
    const series = scenarioMonthlyImpactSeries(state, scenario, 6);
    expect(series.months[0]).toBe(start);
    const delta = series.withScenario.map((v, i) => v - (series.baseline[i] ?? 0));
    expect(delta.filter((d) => d === 100)).toHaveLength(3);
  });
});

describe("compareScenarios", () => {
  it("returns viability in selection order", () => {
    const { state, catId } = baseState();
    state.scenarios = [
      { id: "a", title: "A", kind: "one_off", status: "idea", amount: 100, categoryId: catId },
      { id: "b", title: "B", kind: "one_off", status: "idea", amount: 200, categoryId: catId },
    ];
    const rows = compareScenarios(state, ["b", "a"]);
    expect(rows.map((r) => r.scenarioId)).toEqual(["b", "a"]);
    expect(rows[0]!.oneOffTotal).toBe(200);
  });
});

describe("scenarioToPlannedExpense", () => {
  it("maps installments to recurring planned entry", () => {
    const scenario: ExpenseScenario = {
      id: "s4",
      title: "Financiación",
      kind: "installments",
      status: "go",
      installmentAmount: 75,
      installmentCount: 24,
      startMonth: "2026-03",
      categoryId: "cat-x",
    };
    const planned = scenarioToPlannedExpense(scenario, "fallback");
    expect(planned.typicalAmount).toBe(75);
    expect(planned.categoryId).toBe("cat-x");
    expect(planned.validFrom).toBe("2026-03-01");
    expect(planned.validUntil).toBe("2028-02-28");
  });
});

describe("periodMarginSnapshot", () => {
  it("computes margin ratio when income exists", () => {
    const { state } = baseState();
    const snap = periodMarginSnapshot(state, "12m");
    expect(snap.income).toBeGreaterThan(0);
    expect(snap.marginPct).toBeGreaterThanOrEqual(-100);
    expect(snap.marginPct).toBeLessThanOrEqual(100);
  });
});

describe("periodFixedDiscretionarySplit", () => {
  it("splits fixed vs discretionary within period", () => {
    const { state, catId } = baseState();
    const today = new Date().toISOString().slice(0, 10);
    state.expenses.push({
      id: "e1",
      date: today,
      label: "Variable",
      amount: 80,
      currency: "EUR",
      categoryId: catId,
      notes: "",
      tags: [],
      attachments: [],
      confirmed: true,
    });
    const split = periodFixedDiscretionarySplit(state, "12m");
    expect(split.fixed + split.discretionary).toBeGreaterThanOrEqual(split.discretionary);
    expect(split.discretionary).toBeGreaterThanOrEqual(80);
  });
});
