export type ProgressState = "aprendido" | "practicado" | "mastered";

export type Technology = {
  id: string;
  name: string;
};

export type Concept = {
  id: string;
  technologyId: string;
  title: string;
  progress: ProgressState;
  notes: string;
};

export type ProjectEmbed =
  | {
      id: string;
      kind: "iframe";
      title: string;
      url: string;
    }
  | {
      id: string;
      kind: "link";
      title: string;
      url: string;
    };

export type Project = {
  id: string;
  title: string;
  description: string;
  technologyIds: string[];
  conceptIds: string[];
  embeds: ProjectEmbed[];
  updatedAtISO: string;
};

export const profile = {
  publicName: "Skill Atlas (MVP)",
  bio: "Portfolio de ejemplo: tecnologías, conceptos y proyectos conectados.",
};

export const technologies: Technology[] = [
  { id: "sql", name: "SQL" },
  { id: "pyspark", name: "PySpark" },
  { id: "dax", name: "DAX" },
  { id: "python", name: "Python" },
];

export const concepts: Concept[] = [
  {
    id: "sql-joins",
    technologyId: "sql",
    title: "Joins (INNER/LEFT/FULL)",
    progress: "mastered",
    notes: "Patrones típicos y cuándo usar cada uno.",
  },
  {
    id: "sql-window",
    technologyId: "sql",
    title: "Funciones Window",
    progress: "practicado",
    notes: "ROW_NUMBER, RANK, y agregaciones con OVER().",
  },
  {
    id: "pyspark-df",
    technologyId: "pyspark",
    title: "DataFrames & Transformaciones",
    progress: "aprendido",
    notes: "select/filter/groupBy y buenas prácticas.",
  },
  {
    id: "dax-measures",
    technologyId: "dax",
    title: "Medidas (Measures) en DAX",
    progress: "practicado",
    notes: "CALCULATE, contexto de filtro, y ejemplos.",
  },
  {
    id: "python-ml",
    technologyId: "python",
    title: "ML básico: entrenamiento y evaluación",
    progress: "aprendido",
    notes: "Métricas, splits, y pipelines simples.",
  },
];

export const projects: Project[] = [
  {
    id: "proj-analytics",
    title: "Analytics Notebook & Dashboards",
    description: "Conexión entre SQL, PySpark y una historia visual para explicar hallazgos.",
    technologyIds: ["sql", "pyspark"],
    conceptIds: ["sql-joins", "sql-window", "pyspark-df"],
    embeds: [
      {
        id: "embed-tableau-1",
        kind: "iframe",
        title: "Tableau Public (mock)",
        url: "https://public.tableau.com/views/RegionalSampleWorkbook/Stocks",
      },
      {
        id: "embed-github-1",
        kind: "link",
        title: "Repositorio (mock)",
        url: "https://github.com/",
      },
    ],
    updatedAtISO: "2026-03-20T10:00:00.000Z",
  },
  {
    id: "proj-bi",
    title: "BI con DAX",
    description: "Proyecto enfocado en medidas y contexto de evaluación en Power BI.",
    technologyIds: ["dax"],
    conceptIds: ["dax-measures"],
    embeds: [
      {
        id: "embed-link-1",
        kind: "link",
        title: "Demo / Documento (mock)",
        url: "https://www.example.com/",
      },
    ],
    updatedAtISO: "2026-03-12T18:00:00.000Z",
  },
];

export function getTechnologyById(id: string) {
  return technologies.find((t) => t.id === id);
}

export function getConceptsByTechnology(technologyId: string) {
  return concepts.filter((c) => c.technologyId === technologyId);
}

export function getProjectsByTechnology(technologyId: string) {
  return projects.filter((p) => p.technologyIds.includes(technologyId));
}

export function getConceptById(id: string) {
  return concepts.find((c) => c.id === id);
}

export function getProjectById(id: string) {
  return projects.find((p) => p.id === id);
}

