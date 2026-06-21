import { describe, expect, it } from "vitest";
import { effectivePlannedExpenseAmount } from "./state";

describe("effectivePlannedExpenseAmount", () => {
  it("returns zero for first month when down payment is set", () => {
    const p = {
      id: "p1",
      title: "Klarna",
      dayOfMonth: 17,
      categoryId: "c1",
      typicalAmount: 50,
      validFrom: "2026-06-17",
      downPayment: 307,
      paymentMode: "installments" as const,
      installmentCount: 6,
    };
    const june = effectivePlannedExpenseAmount(p, "2026-06", []);
    expect(june.amount).toBe(0);
    const july = effectivePlannedExpenseAmount(p, "2026-07", []);
    expect(july.amount).toBe(50);
  });

  it("respects explicit override on first month with down payment", () => {
    const p = {
      id: "p1",
      title: "Klarna",
      dayOfMonth: 17,
      categoryId: "c1",
      typicalAmount: 50,
      validFrom: "2026-06-17",
      downPayment: 307,
    };
    const hit = effectivePlannedExpenseAmount(p, "2026-06", [
      { id: "o1", plannedExpenseId: "p1", month: "2026-06", amount: 99, currency: "EUR" },
    ]);
    expect(hit.amount).toBe(99);
  });
});
