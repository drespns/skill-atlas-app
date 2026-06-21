import { describe, expect, it } from "vitest";
import { defaultExpenseTrackerState, type ExpenseTrackerState, type SubscriptionRow } from "./state";
import {
  buildMonthlyCashflowProjection,
  expandCashflowEvents,
  monthCashflowDualSnapshot,
  monthlySubscriptionOutflowSeries,
  type CashflowEvent,
} from "./cashflow-projection";
import type { ExpenseDebt } from "./debts";

function baseState(over: Partial<ExpenseTrackerState> = {}): ExpenseTrackerState {
  return { ...defaultExpenseTrackerState(), ...over };
}

function spotifyTrialSub(): SubscriptionRow {
  return {
    id: "sub-spotify",
    name: "Spotify",
    amount: 11.99,
    currency: "EUR",
    cycle: "monthly",
    categoryId: "cat_entertainment",
    nextBilling: "2026-04-01",
    billingStartDate: "2026-04-01",
    active: true,
    notes: "",
    tags: [],
    trialAmount: 0,
    trialEndsOn: "2026-04-01",
  };
}

describe("monthlySubscriptionOutflowSeries trial", () => {
  it("shows 0 during trial months and 11.99 after", () => {
    const state = baseState({ subscriptions: [spotifyTrialSub()] });
    const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
    const ser = monthlySubscriptionOutflowSeries(state, months, "unify_eur", 0.92, {
      horizon: "projected",
      asOfDate: "2026-06-15",
    });
    expect(ser.seriesEur[0]).toBe(0);
    expect(ser.seriesEur[1]).toBe(0);
    expect(ser.seriesEur[2]).toBe(0);
    expect(ser.seriesEur[3]).toBeCloseTo(11.99, 2);
    expect(ser.seriesEur[4]).toBeCloseTo(11.99, 2);
  });
});

describe("financing with down payment", () => {
  it("includes entrada in first month and cuotas after", () => {
    const state = baseState({
      plannedExpenses: [
        {
          id: "p1",
          title: "Klarna",
          dayOfMonth: 17,
          categoryId: "cat_other",
          typicalAmount: 50,
          validFrom: "2026-06-17",
          validUntil: "2026-11-17",
          downPayment: 307,
          paymentMode: "installments",
          installmentCount: 6,
        },
      ],
    });
    const months = ["2026-06", "2026-07", "2026-08"];
    const proj = buildMonthlyCashflowProjection(state, months, { horizon: "projected", asOfDate: "2026-08-01" });
    expect(proj.outUnified[0]).toBeCloseTo(307, 0);
    expect(proj.outUnified[1]).toBeCloseTo(50, 0);
    expect(proj.outUnified[2]).toBeCloseTo(50, 0);
  });
});

describe("debt installments", () => {
  const debt: ExpenseDebt = {
    id: "d-madre",
    title: "Madre",
    categoryId: "cat_other",
    currency: "EUR",
    installments: [{ id: "i1", amount: 160, dueDate: "2026-07-15", status: "pending" }],
  };

  it("shows pending installment only in due month", () => {
    const state = baseState({ debts: [debt] });
    const months = ["2026-06", "2026-07", "2026-08"];
    const proj = buildMonthlyCashflowProjection(state, months, { horizon: "projected", asOfDate: "2026-06-01" });
    expect(proj.outUnified[0]).toBe(0);
    expect(proj.outUnified[1]).toBeCloseTo(160, 0);
    expect(proj.outUnified[2]).toBe(0);
  });

  it("excludes paid installment linked to expense (no double count)", () => {
    const paidDebt: ExpenseDebt = {
      ...debt,
      installments: [
        {
          id: "i1",
          amount: 160,
          dueDate: "2026-07-15",
          status: "paid",
          paidDate: "2026-07-10",
          expenseId: "e-debt",
          paymentMethod: "expense",
        },
      ],
    };
    const state = baseState({
      debts: [paidDebt],
      expenses: [
        {
          id: "e-debt",
          date: "2026-07-10",
          label: "Pago madre",
          amount: 160,
          currency: "EUR",
          categoryId: "cat_other",
          notes: "",
          tags: ["deuda"],
          attachments: [],
          confirmed: true,
        },
      ],
    });
    const events = expandCashflowEvents(state, {
      months: ["2026-07"],
      horizon: "projected",
      asOfDate: "2026-07-20",
    });
    const debtEvents = events.filter((e) => e.source === "debt_installment");
    const expenseEvents = events.filter((e) => e.source === "expense");
    expect(debtEvents).toHaveLength(0);
    expect(expenseEvents).toHaveLength(1);
    expect(expenseEvents[0]?.amount).toBe(160);
  });
});

describe("horizon actual vs projected", () => {
  it("actual caps at asOfDate; projected includes future in month", () => {
    const state = baseState({
      plannedExpenses: [
        {
          id: "p1",
          title: "Cuota",
          dayOfMonth: 25,
          categoryId: "cat_other",
          typicalAmount: 100,
          validFrom: "2026-06-01",
          validUntil: "2026-12-01",
        },
      ],
    });
    const months = ["2026-06"];
    const actual = buildMonthlyCashflowProjection(state, months, {
      horizon: "actual",
      asOfDate: "2026-06-10",
    });
    const projected = buildMonthlyCashflowProjection(state, months, {
      horizon: "projected",
      asOfDate: "2026-06-10",
    });
    expect(actual.outUnified[0]).toBe(0);
    expect(projected.outUnified[0]).toBeCloseTo(100, 0);
  });

  it("monthCashflowDualSnapshot computes remaining", () => {
    const state = baseState({
      debts: [
        {
          id: "d1",
          title: "Madre",
          categoryId: "cat_other",
          installments: [{ id: "i1", amount: 160, dueDate: "2026-07-25", status: "pending" }],
        },
      ],
      paychecks: [
        {
          id: "pay1",
          title: "Nómina",
          dayOfMonth: 28,
          typicalAmount: 2420,
          currency: "EUR",
          validFrom: "2026-01-01",
        },
      ],
    });
    const snap = monthCashflowDualSnapshot(state, "2026-07", "2026-07-10");
    expect(snap.actualIn).toBe(0);
    expect(snap.projectedIn).toBeCloseTo(2420, 0);
    expect(snap.remainingIn).toBeCloseTo(2420, 0);
    expect(snap.remainingOut).toBeCloseTo(160, 0);
  });
});

describe("aggregateCashflowBySource", () => {
  it("groups events by source for tooltips", () => {
    const state = baseState({
      expenses: [
        {
          id: "e1",
          date: "2026-07-05",
          label: "Super",
          amount: 50,
          currency: "EUR",
          categoryId: "cat_food",
          notes: "",
          tags: [],
          attachments: [],
        },
      ],
      debts: [
        {
          id: "d1",
          title: "Madre",
          categoryId: "cat_other",
          installments: [{ id: "i1", amount: 160, dueDate: "2026-07-15", status: "pending" }],
        },
      ],
    });
    const events: CashflowEvent[] = expandCashflowEvents(state, {
      months: ["2026-07"],
      horizon: "projected",
      asOfDate: "2026-07-01",
    });
    const outEvents = events.filter((e) => e.direction === "out");
    expect(outEvents.some((e) => e.source === "expense")).toBe(true);
    expect(outEvents.some((e) => e.source === "debt_installment")).toBe(true);
  });
});
