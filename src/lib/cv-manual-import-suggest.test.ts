import { describe, expect, it } from "vitest";
import { findAssignmentSpan, mergeSuggestedAssignments, suggestManualAssignmentsFromPaste } from "./cv-manual-import-suggest";

describe("findAssignmentSpan", () => {
  it("finds exact substring", () => {
    const s = "hello foo@bar.com world";
    expect(findAssignmentSpan(s, "foo@bar.com")).toEqual({ start: 6, end: 17 });
  });
});

describe("suggestManualAssignmentsFromPaste", () => {
  it("suggests email and urls from header-like text", () => {
    const text = `Nombre
DATA ANALYST
https://linkedin.com/in/x/ drespns@gmail.com
EXPERIENCIA
Dev | ACME
2020 – 2021`;
    const sug = suggestManualAssignmentsFromPaste(text);
    expect(sug.some((a) => a.target === "email")).toBe(true);
    expect(sug.some((a) => a.target.startsWith("link:"))).toBe(true);
  });
});

describe("mergeSuggestedAssignments", () => {
  it("does not add overlapping suggestions", () => {
    const text = "01234567890123456789";
    const ex = [{ start: 0, end: 5, target: "email" }];
    const su = [
      { start: 3, end: 8, target: "headline" },
      { start: 10, end: 14, target: "summary" },
    ];
    const m = mergeSuggestedAssignments(text, ex, su);
    expect(m.some((x) => x.target === "headline")).toBe(false);
    expect(m.some((x) => x.target === "summary")).toBe(true);
  });
});
