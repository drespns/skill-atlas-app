import { describe, expect, it } from "vitest";
import { defaultExpenseTrackerState } from "./state";
import { breakdownMonthIncome } from "./kpi-breakdown";

describe("breakdownMonthIncome", () => {
  it("lists ad-hoc income lines with unified amounts", () => {
    const state = {
      ...defaultExpenseTrackerState(),
      incomeAdhoc: [
        {
          id: "inc1",
          date: "2026-06-10",
          label: "Freelance cliente A",
          amount: 620,
          currency: "EUR" as const,
          categoryId: "cat_other",
          confirmed: true,
        },
      ],
    };
    const bd = breakdownMonthIncome(state, "2026-06");
    expect(bd.total).toBeCloseTo(620, 0);
    expect(bd.lines.length).toBeGreaterThan(0);
    expect(bd.lines[0]?.label).toContain("Freelance");
    expect(bd.lines[0]?.amount).toBeCloseTo(620, 0);
  });
});
