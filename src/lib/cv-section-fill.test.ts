import { describe, expect, it } from "vitest";
import { countFilledCvDocumentSections, isCvDocumentSectionFilled } from "./cv-section-fill";

describe("cv-section-fill", () => {
  it("counts only visible sections with data", () => {
    const profile = {
      cvSectionVisibility: { experience: true, education: false },
      experiences: [{ company: "Acme" }],
      education: [{ school: "X" }],
    };
    expect(isCvDocumentSectionFilled("experience", profile, { selectedProjectCount: 0, technologyGroupCount: 0 })).toBe(true);
    expect(isCvDocumentSectionFilled("education", profile, { selectedProjectCount: 0, technologyGroupCount: 0 })).toBe(false);
    expect(countFilledCvDocumentSections(profile, { selectedProjectCount: 0, technologyGroupCount: 0 })).toBe(1);
  });

  it("treats projects as filled only when selection has projects", () => {
    const profile = { cvSectionVisibility: { projects: true } };
    expect(isCvDocumentSectionFilled("projects", profile, { selectedProjectCount: 0, technologyGroupCount: 0 })).toBe(false);
    expect(isCvDocumentSectionFilled("projects", profile, { selectedProjectCount: 2, technologyGroupCount: 0 })).toBe(true);
  });
});
