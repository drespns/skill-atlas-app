import { describe, expect, it } from "vitest";
import {
  debtDeclaredTotal,
  debtInstallmentTotal,
  debtUnassignedAmount,
  parseExpenseDebts,
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

  it("parseExpenseDebts reads totalAmount", () => {
    const parsed = parseExpenseDebts([
      {
        id: "x",
        title: "T",
        totalAmount: 500,
        installments: [{ id: "a", amount: 250, dueDate: "2026-06-01", status: "pending" }],
      },
    ]);
    expect(parsed[0]?.totalAmount).toBe(500);
  });
});
