import { describe, expect, it } from "vitest";
import {
  extractUrlsForCvSlots,
  filterFalsePositiveExperienceRows,
  mergeLanguagesSplitFromCertificationsSection,
  normalizeCvPasteForHeuristics,
  parseCertificationsFromPaste,
  parseEducationBlocksFromPaste,
  parseExperienceBlocksFromPaste,
  parseLanguagesFromPaste,
  preprocessCvPasteForImport,
  splitCvPasteBySections,
} from "./cv-paste-import";

describe("splitCvPasteBySections", () => {
  it("detects experience and education blocks", () => {
    const raw = `Nombre Apellido
email@test.com

Experiencia

Developer en ACME S.L.
Madrid
ene 2020 – mar 2022
- Ship feature

Educación

Grado en Informática
Universidad Complutense
2015 – 2019
`;
    const s = splitCvPasteBySections(raw);
    expect(s.sawExperienceHeader).toBe(true);
    expect(s.sawEducationHeader).toBe(true);
    expect(s.experience).toContain("Developer en ACME");
    expect(s.experience).not.toContain("Grado en Informática");
    expect(s.education).toContain("Grado en Informática");
  });

  it("detects certifications, languages, technologies and FORMACIÓN", () => {
    const raw = `EXPERIENCIA
Dev | ACME
2020 – 2021

CERTIFICACIONES
- AWS Certified Cloud Practitioner – en preparación

IDIOMAS
Inglés - B2 | Japonés (N5)

TECNOLOGÍAS
Python SQL

FORMACIÓN
2024-2026 - UNIVERSIDAD VIU
Máster en Big Data
`;
    const s = splitCvPasteBySections(raw);
    expect(s.sawCertificationsHeader).toBe(true);
    expect(s.sawLanguagesHeader).toBe(true);
    expect(s.sawTechnologiesHeader).toBe(true);
    expect(s.sawEducationHeader).toBe(true);
    expect(s.certifications).toMatch(/AWS/);
    expect(s.languages).toMatch(/Inglés/);
    expect(s.technologies).toMatch(/Python/);
    expect(s.education).toMatch(/Máster/);
  });

  it("recognizes English headers", () => {
    const raw = `John Doe

Work experience

Engineer at Globex Inc
Jan 2021 – Dec 2022

Education

BSc Computer Science
State University
2012 – 2016
`;
    const s = splitCvPasteBySections(raw);
    expect(s.sawExperienceHeader).toBe(true);
    expect(s.sawEducationHeader).toBe(true);
    expect(s.experience).toMatch(/Globex/);
    expect(s.education).toMatch(/BSc/);
  });

  it("stops IDIOMAS when header/contact leaks after languages (PDF tail)", () => {
    const raw = `IDIOMAS
Inglés — B2 (preparación)
Japonés (Iniciación, objetivo N5)
https://www.linkedin.com/in/example
+34 600 000 000
Graduado en Matemáticas especializado en análisis de datos y mucho texto para superar el umbral de detección de biografía pegada al final del PDF sin querer.`;
    const s = splitCvPasteBySections(raw);
    expect(s.languages).toMatch(/Inglés/);
    expect(s.languages).toMatch(/Japonés/);
    expect(s.languages).not.toMatch(/linkedin/i);
    expect(s.languages).not.toMatch(/Graduado en Matemáticas/);
  });
});

describe("filterFalsePositiveExperienceRows", () => {
  it("removes degree-like rows with school-shaped company", () => {
    const rows = [
      { role: "Grado en Física", company: "Universidad Nacional", bullets: "" },
      { role: "Developer", company: "ACME S.L.", bullets: "Did things" },
    ];
    const f = filterFalsePositiveExperienceRows(rows as any);
    expect(f).toHaveLength(1);
    expect(f[0]!.role).toBe("Developer");
  });
});

describe("parseExperienceBlocksFromPaste", () => {
  it("parses role, company on next line, dates, bullets (PDF-like lines)", () => {
    const raw = `Senior Developer
ACME TECH S.L.
2020 – presente
- Led migration
- Mentoring`;
    const norm = normalizeCvPasteForHeuristics(raw);
    const rows = parseExperienceBlocksFromPaste(norm);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0]!;
    expect(r.role).toMatch(/Senior Developer/i);
    expect(r.company).toMatch(/ACME/);
    expect(r.bullets).toMatch(/Led migration/);
  });

  it("treats middle-dot · bullets as list items (no space after ·)", () => {
    const raw = `Data Analyst | ACME S.L.
2020 – 2021
· Led dashboards
· Automated SQL pipelines`;
    const norm = normalizeCvPasteForHeuristics(preprocessCvPasteForImport(raw));
    const rows = parseExperienceBlocksFromPaste(norm);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0]!;
    expect(r.bullets).toMatch(/Led dashboards/);
    expect(r.bullets).toMatch(/Automated SQL/);
  });
});

describe("parseEducationBlocksFromPaste", () => {
  it("parses degree and school on separate lines", () => {
    const raw = `PhD Computer Science
Universidad Complutense de Madrid
2019 – 2020
- Tesis sobre NLP`;
    const norm = normalizeCvPasteForHeuristics(raw);
    const rows = parseEducationBlocksFromPaste(norm);
    expect(rows.length).toBe(1);
    expect(rows[0]!.degree).toMatch(/PhD/);
    expect(rows[0]!.school).toMatch(/Complutense/i);
  });

  it("moves a trailing year-only line into dates, not location blob", () => {
    const raw = `Máster en Big Data
UNIVERSIDAD INTERNACIONAL DE VALENCIA
Experto en Programación en Python
2024-2026`;
    const norm = normalizeCvPasteForHeuristics(raw);
    const rows = parseEducationBlocksFromPaste(norm);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0]!;
    expect(`${r.start ?? ""}-${r.end ?? ""}`.replace(/\s/g, "")).toMatch(/2024/);
    expect(r.location ?? "").not.toMatch(/2024-2026/);
  });
});

describe("mergeLanguagesSplitFromCertificationsSection", () => {
  it("moves IDIOMAS tail out of certifications text", () => {
    const split = {
      preamble: "",
      experience: "",
      education: "",
      certifications: "- AWS Certified\n- PL-300\nIDIOMAS Inglés – B2 | Japonés N5",
      languages: "",
      technologies: "",
      sawExperienceHeader: true,
      sawEducationHeader: false,
      sawCertificationsHeader: true,
      sawLanguagesHeader: false,
      sawTechnologiesHeader: false,
    };
    const m = mergeLanguagesSplitFromCertificationsSection(split);
    expect(m.certifications).not.toMatch(/IDIOMAS/i);
    expect(m.languages).toMatch(/Inglés/i);
    expect(m.sawLanguagesHeader).toBe(true);
  });
});

describe("parseExperienceBlocksFromPaste (dates)", () => {
  it("does not use a standalone month+year line as job title", () => {
    const raw = `ENERO 2026 (8 MESES)

ANALISTA JUNIOR | SERVICIOS OPINIÓN S.L.
MAYO 2025 – ENERO 2026
- KPIs y reporting`;
    const norm = normalizeCvPasteForHeuristics(preprocessCvPasteForImport(raw));
    const rows = parseExperienceBlocksFromPaste(norm);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows.find((x) => (x.role ?? "").includes("ANALISTA")) ?? rows[0]!;
    expect(String(r.role ?? "")).toMatch(/ANALISTA/i);
    expect(String(r.role ?? "")).not.toMatch(/^ENERO\s+2026$/i);
  });
});

describe("parseCertificationsFromPaste / parseLanguagesFromPaste", () => {
  it("parses bullet certs and pipe-separated languages", () => {
    expect(parseCertificationsFromPaste("- Microsoft PL-300 – en preparación")).toHaveLength(1);
    expect(parseLanguagesFromPaste("IDIOMAS: Inglés - B2 | Japonés N5")).toHaveLength(2);
  });

  it("skips language-only bullet lines", () => {
    const rows = parseCertificationsFromPaste("- IDIOMAS Inglés – B2 (preparación)");
    expect(rows.length).toBe(0);
  });

  it("parses languages on separate lines without pipes", () => {
    const langs = parseLanguagesFromPaste("Inglés - B2\nJaponés (Iniciación)");
    expect(langs.length).toBe(2);
    expect(langs[0]!.name).toMatch(/Inglés/i);
  });
});

describe("extractUrlsForCvSlots", () => {
  it("maps LinkedIn and GitHub into first slots", () => {
    const text = `Contacto
https://www.linkedin.com/in/foo/
https://github.com/foo/`;
    const slots = extractUrlsForCvSlots(text);
    expect(slots[0]).toMatch(/linkedin\.com/i);
    expect(slots[1]).toMatch(/github\.com/i);
  });
});

describe("preprocessCvPasteForImport", () => {
  it("splits ALL CAPS role | company job lines", () => {
    const raw = `ANALISTA JUNIOR | SERVICIOS OPINIÓN S.L. MAYO 2025 – ENERO 2026 ANALISTA BECARIO | MISMA EMPRESA 2024`;
    const p = preprocessCvPasteForImport(raw);
    expect(p.split("\n").filter((l) => /\|\s*\S+/.test(l)).length).toBeGreaterThanOrEqual(2);
  });
});

describe("normalizeCvPasteForHeuristics", () => {
  it("inserts paragraph breaks before new job-like lines", () => {
    const raw = `Job A en Co One
2020 – 2021
Job B en Co Two
2022 – actual`;
    const n = normalizeCvPasteForHeuristics(raw);
    expect(n).toContain("\n\n");
    const exp = parseExperienceBlocksFromPaste(n);
    expect(exp.length).toBeGreaterThanOrEqual(2);
  });
});
