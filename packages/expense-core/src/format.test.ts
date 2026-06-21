import { describe, expect, it } from "vitest";
import { formatEurEs, mergeExpenseTrackerRemoteLocal, normalizeExpenseTrackerState } from "./state";

describe("formatEurEs", () => {
  it("groups thousands from 1000", () => {
    expect(formatEurEs(1800)).toContain("1.800");
    expect(formatEurEs(9849.22)).toContain("9.849,22");
  });
});

describe("normalizeExpenseTrackerState", () => {
  it("defaults debts and scenarios", () => {
    const s = normalizeExpenseTrackerState(null);
    expect(s.debts).toEqual([]);
    expect(s.scenarios).toEqual([]);
  });
});

describe("mergeExpenseTrackerRemoteLocal", () => {
  it("merges expenses by id", () => {
    const base = normalizeExpenseTrackerState(null);
    const local = {
      ...base,
      expenses: [{ ...base.expenses[0], id: "local1", label: "Local", amount: 10, date: "2026-06-01" } as any],
    };
    const remote = {
      ...base,
      expenses: [{ ...base.expenses[0], id: "remote1", label: "Remote", amount: 20, date: "2026-06-02" } as any],
    };
    const merged = mergeExpenseTrackerRemoteLocal(remote, local);
    expect(merged.expenses.some((e) => e.id === "local1")).toBe(true);
    expect(merged.expenses.some((e) => e.id === "remote1")).toBe(true);
  });
});
