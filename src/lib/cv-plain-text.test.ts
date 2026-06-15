import { describe, expect, it } from "vitest";
import { buildCvPlainTextDocument } from "./cv-plain-text";
import type { CvPlainTextLabels } from "./cv-plain-text";

const labels = (): CvPlainTextLabels => ({
  docExperienceHeading: "Experience",
  docEducationHeading: "Education",
  docComplementaryEducationHeading: "Complementary",
  docCertificationsHeading: "Certifications",
  docLanguagesHeading: "Languages",
  docTechnologiesHeading: "Technologies",
  docProjectsHeading: "Projects",
  docHighlightsHeading: "Highlights",
  docPublicationsHeading: "Publications",
  docAwardsHeading: "Awards",
  docVolunteeringHeading: "Volunteering",
  docInterestsHeading: "Interests",
  docCoverHeading: "Letters",
  certLink: "Link",
  pubLink: "Link",
  awardLink: "Link",
  projectsMoreLabel: "Also",
  coverWords: "words",
  present: "Present",
  untitled: "—",
});

describe("buildCvPlainTextDocument", () => {
  it("includes target role and summary in header", () => {
    const text = buildCvPlainTextDocument({
      profile: {
        headline: "Engineer",
        cvTargetRole: "Senior Backend",
        summary: "Long enough summary for testing purposes here.",
        cvSectionVisibility: { summary: true },
      },
      displayName: "Ada Lovelace",
      resolvedSummary: "Long enough summary for testing purposes here.",
      contactLines: ["ada@example.com"],
      helpStackLabels: [],
      projectsPayload: null,
      technologyLabels: [],
      labels: labels(),
    });
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Senior Backend");
    expect(text).toContain("Engineer");
    expect(text).toContain("Long enough summary");
    expect(text).toContain("ada@example.com");
  });

  it("renders technologies section when visible and non-empty", () => {
    const text = buildCvPlainTextDocument({
      profile: {
        cvSectionVisibility: { technologies: true },
      },
      displayName: "Test",
      resolvedSummary: "",
      contactLines: [],
      helpStackLabels: [],
      projectsPayload: null,
      technologyLabels: ["TypeScript", "PostgreSQL"],
      labels: labels(),
    });
    expect(text).toContain("Technologies");
    expect(text).toContain("TypeScript");
    expect(text).toContain("PostgreSQL");
  });

  it("renders technology role blocks when technologyBlocks is set", () => {
    const text = buildCvPlainTextDocument({
      profile: {
        cvSectionVisibility: { technologies: true },
      },
      displayName: "Test",
      resolvedSummary: "",
      contactLines: [],
      helpStackLabels: [],
      projectsPayload: null,
      technologyLabels: [],
      technologyBlocks: [
        { title: "Data Engineer", labels: ["PySpark", "Databricks"] },
        { title: "Web", labels: ["Astro", "TypeScript"] },
      ],
      labels: labels(),
    });
    expect(text).toContain("Technologies");
    expect(text).toContain("Data Engineer");
    expect(text).toContain("PySpark");
    expect(text).toContain("Web");
    expect(text).toContain("Astro");
  });
});
