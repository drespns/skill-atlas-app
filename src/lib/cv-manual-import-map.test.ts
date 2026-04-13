import { describe, expect, it } from "vitest";
import {
  applyCvManualImport,
  buildManualHighlightHtml,
  bumpManualImportTargetIfOccupied,
  escHtml,
  manualImportEducationRowIndexKey,
  manualImportExperienceRowIndexKey,
  mergeAssignmentSlices,
} from "./cv-manual-import-map";

describe("manualImportExperienceRowIndexKey", () => {
  it("returns the same index for exist and new", () => {
    expect(manualImportExperienceRowIndexKey("exp:exist:0:role")).toBe("0");
    expect(manualImportExperienceRowIndexKey("exp:new:0:company")).toBe("0");
    expect(manualImportExperienceRowIndexKey("exp:new:2:end")).toBe("2");
    expect(manualImportExperienceRowIndexKey("headline")).toBeNull();
  });
});

describe("bumpManualImportTargetIfOccupied", () => {
  it("advances to next exist row when same field is taken", () => {
    const as = [{ start: 0, end: 1, target: "exp:exist:0:role" }];
    expect(bumpManualImportTargetIfOccupied("exp:exist:0:role", as, { expLen: 2, eduLen: 0, certLen: 0, langLen: 0 })).toBe(
      "exp:exist:1:role",
    );
  });

  it("treats exist and new with same index as one slot for collision", () => {
    const as = [{ start: 0, end: 1, target: "exp:new:0:company" }];
    expect(bumpManualImportTargetIfOccupied("exp:exist:0:company", as, { expLen: 1, eduLen: 0, certLen: 0, langLen: 0 })).toBe(
      "exp:new:1:company",
    );
  });
});

describe("manualImportEducationRowIndexKey", () => {
  it("returns the same index for exist and new", () => {
    expect(manualImportEducationRowIndexKey("edu:exist:1:degree")).toBe("1");
    expect(manualImportEducationRowIndexKey("edu:new:1:school")).toBe("1");
    expect(manualImportEducationRowIndexKey("summary")).toBeNull();
  });
});

describe("normalizeManualAssignments + highlight", () => {
  it("escapes HTML in plain segments", () => {
    expect(escHtml("<b>")).toBe("&lt;b&gt;");
  });

  it("overlapping spans: later assignment wins", () => {
    const text = "0123456789";
    const html = buildManualHighlightHtml(text, [
      { start: 0, end: 6, target: "summary" },
      { start: 3, end: 8, target: "headline" },
    ]);
    expect(html).toContain("012");
    expect(html).toContain("mark");
    expect(html).not.toContain("<b>");
  });

  it("mergeAssignmentSlices joins bullets with newlines", () => {
    const text = "A\n\nB";
    const m = mergeAssignmentSlices(text, [
      { start: 0, end: 1, target: "exp:new:0:bullets" },
      { start: 3, end: 4, target: "exp:new:0:bullets" },
    ]);
    expect(m.get("exp:new:0:bullets")).toBe("A\nB");
  });

  it("mergeAssignmentSlices uses valueOverride when set", () => {
    const text = "ORIGINAL";
    const m = mergeAssignmentSlices(text, [{ start: 0, end: 8, target: "headline", valueOverride: "  Edited title  " }]);
    expect(m.get("headline")).toBe("Edited title");
  });
});

describe("applyCvManualImport", () => {
  it("fills headline and new experience buckets", () => {
    const text = ["DATA ANALYST", "ANALISTA | ACME", "MAYO 2025 – ENERO 2026"].join("\n");
    const profile = { experiences: [] as any[] };
    const i0 = 0;
    const i1 = text.indexOf("ANALISTA");
    const i2 = text.indexOf("MAYO");
    const r = applyCvManualImport(
      text,
      [
        { start: i0, end: i0 + "DATA ANALYST".length, target: "headline" },
        { start: i1, end: i1 + "ANALISTA | ACME".length, target: "exp:new:0:role" },
        { start: i2, end: text.length, target: "exp:new:0:start" },
      ],
      profile,
    );
    expect(r.profile.headline).toMatch(/DATA ANALYST/);
    expect(r.profile.experiences).toHaveLength(1);
    expect(r.profile.experiences![0]!.role).toMatch(/ANALISTA/);
    expect(r.errors.length).toBe(0);
  });

  it("patches existing experience row", () => {
    const profile = {
      experiences: [{ role: "Old", company: "X", start: "", end: "", bullets: "" }],
    };
    const text = "New role text";
    const r = applyCvManualImport(text, [{ start: 0, end: text.length, target: "exp:exist:0:role" }], profile as any);
    expect(r.profile.experiences![0]!.role).toBe("New role text");
  });

  it("extracts email and first URL for link slot", () => {
    const text = "contact me foo@bar.com and https://linkedin.com/in/x/";
    const r = applyCvManualImport(
      text,
      [
        { start: 0, end: text.length, target: "email" },
        { start: 0, end: text.length, target: "link:0" },
      ],
      {},
    );
    expect(r.profile.email).toMatch(/foo@bar\.com/);
    expect(r.profile.cvLinkSlots?.[0]).toMatch(/linkedin\.com/);
  });

  it("sets summary when empty; flags pending when already set", () => {
    const t1 = applyCvManualImport("Hello bio", [{ start: 0, end: 9, target: "summary" }], {});
    expect(t1.profile.summary).toBe("Hello bio");
    expect(t1.summaryPendingReplace).toBeUndefined();

    const t2 = applyCvManualImport(
      "New bio",
      [{ start: 0, end: 7, target: "summary" }],
      { summary: "Old" },
    );
    expect(t2.profile.summary).toBe("Old");
    expect(t2.summaryPendingReplace).toBe("New bio");
  });
});
