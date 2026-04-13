import { describe, expect, it } from "vitest";
import { analyzeCvForAts } from "./cv-ats-check";

describe("analyzeCvForAts", () => {
  it("flags missing email and summary", () => {
    const r = analyzeCvForAts({ experiences: [{ role: "Dev", company: "ACME", start: "2020", end: "2021", bullets: "- x" }] }, "classic");
    expect(r.warn.some((k) => k.includes("noEmail"))).toBe(true);
    expect(r.warn.some((k) => k.includes("noSummary"))).toBe(true);
  });

  it("warns on sidebar template", () => {
    const r = analyzeCvForAts({ email: "a@b.co", summary: "x".repeat(90), experiences: [] }, "sidebar");
    expect(r.warn.some((k) => k.includes("sidebarLayout"))).toBe(true);
  });
});
