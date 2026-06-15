import { describe, expect, it } from "vitest";
import { educationBulletLines, educationProseDetails, linesToBullets } from "./cv-bullets";

describe("educationBulletLines / educationProseDetails", () => {
  it("uses details lines as bullets when bullets empty (legacy)", () => {
    expect(educationBulletLines({ details: "A\n- B" })).toEqual(["A", "B"]);
    expect(educationProseDetails({ details: "A\n- B" })).toBe("");
  });

  it("prefers bullets field and exposes prose from details", () => {
    expect(educationBulletLines({ bullets: "One\nTwo", details: "Prose note" })).toEqual(["One", "Two"]);
    expect(educationProseDetails({ bullets: "One", details: "Prose note" })).toBe("Prose note");
  });

  it("linesToBullets strips leading dashes", () => {
    expect(linesToBullets("- x")).toEqual(["x"]);
  });
});
