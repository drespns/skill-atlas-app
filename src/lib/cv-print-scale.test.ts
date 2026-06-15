import { describe, expect, it } from "vitest";
import { cvPrintTypographicScale } from "./cv-print-scale";

describe("cvPrintTypographicScale", () => {
  it("uses base scale for 1 page with few filled sections", () => {
    expect(cvPrintTypographicScale(1)).toBe(0.66);
    expect(cvPrintTypographicScale(1, { densityFilledSections: 5 })).toBe(0.66);
  });

  it("tightens for 1 page when many sections have content", () => {
    expect(cvPrintTypographicScale(1, { densityFilledSections: 10 })).toBeCloseTo(0.54, 5);
    expect(cvPrintTypographicScale(1, { densityFilledSections: 99 })).toBe(0.52);
  });

  it("ignores density when target is not 1 page", () => {
    expect(cvPrintTypographicScale(2, { densityFilledSections: 20 })).toBeCloseTo(0.86, 5);
  });
});
