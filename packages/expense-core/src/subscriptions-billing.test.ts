import { describe, expect, it } from "vitest";
import { addMonthsToIso } from "./subscriptions-billing";

describe("addMonthsToIso", () => {
  it("adds months in local calendar without UTC drift", () => {
    expect(addMonthsToIso("2026-06-01", 2)).toBe("2026-08-01");
    expect(addMonthsToIso("2026-06-17", 2)).toBe("2026-08-17");
  });

  it("handles year rollover", () => {
    expect(addMonthsToIso("2026-11-15", 2)).toBe("2027-01-15");
  });
});
