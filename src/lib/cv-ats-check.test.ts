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

  it("signals target role present and notes when missing", () => {
    const ok = analyzeCvForAts(
      {
        email: "a@b.co",
        summary: "y".repeat(85),
        cvTargetRole: "Lead Dev",
        experiences: [{ role: "Dev", company: "Co", start: "2020", end: "2022", bullets: "- x" }],
      },
      "classic",
    );
    expect(ok.ok.some((k) => k.includes("targetRole"))).toBe(true);

    const miss = analyzeCvForAts({ email: "a@b.co", summary: "y".repeat(85), experiences: [{ role: "Dev", company: "Co", start: "2020", end: "2022", bullets: "- x" }] }, "classic");
    expect(miss.info.some((k) => k.includes("noTargetRole"))).toBe(true);
  });

  it("warns when technologies visible but empty count", () => {
    const r = analyzeCvForAts({ email: "a@b.co", summary: "z".repeat(85), experiences: [{ role: "Dev", company: "Co", bullets: "-" }], atsTechnologiesVisible: true, atsTechnologiesCount: 0 }, "classic");
    expect(r.warn.some((k) => k.includes("technologiesEmptyVisible"))).toBe(true);
  });

  it("warns when bullets have no metrics and when repeated", () => {
    const r = analyzeCvForAts(
      {
        email: "a@b.co",
        summary: "z".repeat(120),
        experiences: [
          {
            role: "Dev",
            company: "Co",
            start: "2021",
            end: "2024",
            bullets: "- Mejoré procesos internos\n- Mejoré procesos internos\n- Coordiné despliegues",
          },
        ],
      },
      "classic",
    );
    expect(r.warn.some((k) => k.includes("expNoMetrics"))).toBe(true);
    expect(r.warn.some((k) => k.includes("repeatedBullets"))).toBe(true);
  });

  it("warns when summary is too long", () => {
    const r = analyzeCvForAts(
      {
        email: "a@b.co",
        summary: "x".repeat(1300),
        experiences: [{ role: "Dev", company: "Co", start: "2020", end: "2022", bullets: "- Increased conversion 22%" }],
      },
      "classic",
    );
    expect(r.warn.some((k) => k.includes("longSummary"))).toBe(true);
  });

  it("flags target role keywords when missing in content", () => {
    const r = analyzeCvForAts(
      {
        email: "a@b.co",
        summary: "Backend profile with APIs and data pipelines.",
        cvTargetRole: "Frontend React Engineer",
        experiences: [{ role: "Backend Engineer", company: "Co", start: "2020", end: "2022", bullets: "- Built APIs\n- Improved ETL" }],
      },
      "classic",
    );
    expect(r.warn.some((k) => k.includes("targetRoleKeywordsMissing"))).toBe(true);
  });

  it("flags weak result orientation in experience bullets", () => {
    const r = analyzeCvForAts(
      {
        email: "a@b.co",
        summary: "y".repeat(100),
        experiences: [{ role: "Dev", company: "Co", bullets: "- Worked on backlog\n- Collaborated with team\n- Maintained services" }],
      },
      "classic",
    );
    expect(r.warn.some((k) => k.includes("expResultsWeak"))).toBe(true);
  });

  it("marks ATS positives when bullets show outcomes and metrics", () => {
    const r = analyzeCvForAts(
      {
        email: "a@b.co",
        summary: "y".repeat(100),
        cvTargetRole: "Data Platform Engineer",
        highlights: "Data platform and warehouse ownership.",
        experiences: [
          {
            role: "Data Engineer",
            company: "Co",
            bullets:
              "- Reduced ETL runtime by 35%\n- Improved data quality checks and lowered incidents\n- Increased dashboard refresh reliability to 99.9%",
          },
        ],
      },
      "classic",
    );
    expect(r.ok.some((k) => k.includes("expResultsSignal"))).toBe(true);
  });
});
