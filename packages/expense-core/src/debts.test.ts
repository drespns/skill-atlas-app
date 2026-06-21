import { describe, expect, it } from "vitest";
import { defaultExpenseTrackerState } from "./state";
import {
  debtDeclaredTotal,
  debtInstallmentTotal,
  debtUnassignedAmount,
  linkedDebtBizumIds,
  parseExpenseDebts,
  payDebtInstallment,
  summarizeDebt,
  type ExpenseDebt,
} from "./debts";

const sampleDebt = (over: Partial<ExpenseDebt> = {}): ExpenseDebt => ({
  id: "d1",
  title: "Préstamo",
  totalAmount: 300,
  installments: [
    { id: "i1", amount: 100, dueDate: "2026-07-01", status: "pending" },
    { id: "i2", amount: 100, dueDate: "2026-08-01", status: "pending" },
  ],
  ...over,
});

function stateWithDebt(debt: ExpenseDebt) {
  const base = defaultExpenseTrackerState();
  return { ...base, debts: [debt] };
}

describe("debts totalAmount", () => {
  it("uses declared total when set", () => {
    expect(debtDeclaredTotal(sampleDebt())).toBe(300);
    expect(debtInstallmentTotal(sampleDebt())).toBe(200);
    expect(debtUnassignedAmount(sampleDebt())).toBe(100);
  });

  it("falls back to installment sum without totalAmount", () => {
    const debt = sampleDebt({ totalAmount: undefined });
    expect(debtDeclaredTotal(debt)).toBe(200);
    expect(debtUnassignedAmount(debt)).toBe(0);
  });

  it("summarizeDebt uses declared total for progress", () => {
    const sum = summarizeDebt(sampleDebt());
    expect(sum.total).toBe(300);
    expect(sum.pending).toBe(300);
    expect(sum.progressPct).toBe(0);
  });

  it("parseExpenseDebts reads totalAmount scope and bizumId", () => {
    const parsed = parseExpenseDebts([
      {
        id: "x",
        title: "T",
        totalAmount: 500,
        scope: "family",
        counterparty: "Madre",
        installments: [
          {
            id: "a",
            amount: 250,
            dueDate: "2026-06-01",
            status: "paid",
            paidDate: "2026-06-10",
            bizumId: "b1",
            paymentMethod: "linked",
          },
        ],
      },
    ]);
    expect(parsed[0]?.totalAmount).toBe(500);
    expect(parsed[0]?.scope).toBe("family");
    expect(parsed[0]?.counterparty).toBe("Madre");
    expect(parsed[0]?.installments[0]?.bizumId).toBe("b1");
    expect(parsed[0]?.installments[0]?.paymentMethod).toBe("linked");
  });
});

describe("payDebtInstallment", () => {
  it("personal debt creates expense not bizum", () => {
    const state = stateWithDebt(sampleDebt({ scope: "personal" }));
    const next = payDebtInstallment(state, "d1", "i1", () => "e1", () => "b1", {
      method: "expense",
      wealthAccountId: "acct-test",
    });
    expect(next?.expenses).toHaveLength(state.expenses.length + 1);
    expect(next?.expenses.at(-1)?.tags).toContain("deuda");
    expect(next?.wealthBizums ?? []).toHaveLength(0);
    expect(next?.debts?.[0]?.installments[0]?.paymentMethod).toBe("expense");
  });

  it("family debt with bizum creates bizum not expense", () => {
    const state = stateWithDebt(
      sampleDebt({
        scope: "family",
        counterparty: "Madre",
        installments: [{ id: "i1", amount: 40, dueDate: "2026-06-01", status: "pending" }],
      }),
    );
    const next = payDebtInstallment(state, "d1", "i1", () => "e1", () => "bz1", {
      method: "bizum",
      wealthAccountId: "acct-test",
    });
    expect(next?.expenses).toHaveLength(state.expenses.length);
    expect(next?.wealthBizums).toHaveLength(1);
    expect(next?.wealthBizums?.[0]?.id).toBe("bz1");
    expect(next?.wealthBizums?.[0]?.amount).toBe(40);
    expect(next?.debts?.[0]?.installments[0]?.bizumId).toBe("bz1");
  });

  it("linked bizum does not create new records", () => {
    const state = {
      ...stateWithDebt(
        sampleDebt({
          scope: "family",
          installments: [{ id: "i1", amount: 40, dueDate: "2026-06-01", status: "pending" }],
        }),
      ),
      wealthBizums: [
        {
          id: "existing-bz",
          date: "2026-06-05",
          direction: "sent" as const,
          accountId: "acct1",
          amount: 40,
          note: "Madre camisas",
        },
      ],
    };
    const next = payDebtInstallment(state, "d1", "i1", () => "e1", () => "new-bz", {
      method: "linked",
      existingBizumId: "existing-bz",
    });
    expect(next?.expenses).toHaveLength(state.expenses.length);
    expect(next?.wealthBizums).toHaveLength(1);
    expect(next?.debts?.[0]?.installments[0]?.paymentMethod).toBe("linked");
    expect(next?.debts?.[0]?.installments[0]?.bizumId).toBe("existing-bz");
  });

  it("rejects linking bizum already linked to another installment", () => {
    const state = {
      ...stateWithDebt(
        sampleDebt({
          id: "d1",
          installments: [
            { id: "i1", amount: 40, dueDate: "2026-06-01", status: "paid", bizumId: "existing-bz", paymentMethod: "linked" },
            { id: "i2", amount: 40, dueDate: "2026-07-01", status: "pending" },
          ],
        }),
      ),
      wealthBizums: [
        {
          id: "existing-bz",
          date: "2026-06-05",
          direction: "sent" as const,
          accountId: "acct1",
          amount: 40,
        },
      ],
    };
    expect(linkedDebtBizumIds(state).has("existing-bz")).toBe(true);
    const next = payDebtInstallment(state, "d1", "i2", () => "e1", () => "b2", {
      method: "linked",
      existingBizumId: "existing-bz",
    });
    expect(next).toBeNull();
  });
});
