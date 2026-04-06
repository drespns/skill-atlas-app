/**
 * Mock data source for the MVP.
 *
 * This file simulates what later will live in Supabase tables.
 * Keep it simple and deterministic to unblock UI development.
 */

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

export type ProjectEmbed = {
  id: string;
  kind: "iframe" | "link";
  title: string;
  url: string;
  /** Por defecto true: visible en portfolio/CV público. */
  showInPublic?: boolean;
  /** Miniatura opcional (HTTPS) para vista pública. */
  thumbnailUrl?: string | null;
};

/** Alineado con columna `projects.status` (saas-018). */
export type ProjectStatus = "draft" | "in_progress" | "portfolio_visible" | "archived";

export type Project = {
  id: string;
  title: string;
  description: string;
  /** Rol o responsabilidad en el proyecto (historia). */
  role: string;
  /** Resultado o impacto (historia). */
  outcome: string;
  technologyIds: string[];
  conceptIds: string[];
  embeds: ProjectEmbed[];
  /** Ruta en Storage `project_covers` (Supabase); opcional. */
  coverImagePath?: string | null;
  updatedAtISO: string;
  status?: ProjectStatus;
  tags?: string[];
  dateStart?: string | null;
  dateEnd?: string | null;
};

// Public profile shown in `/portfolio` and `/settings`
export const profile = {
  publicName: "Skill Atlas (MVP)",
  bio: "Portfolio de ejemplo: tecnologías, conceptos y proyectos conectados.",
};

// Root repo link used in the header shortcut
export const repoUrl = "https://github.com/drespns/skill-atlas-app";

// Master list of technologies (parent entities)
export const technologies: Technology[] = [
  { id: "sql", name: "SQL" },
  { id: "pyspark", name: "PySpark" },
  { id: "python", name: "Python" },
  { id: "javascript", name: "JavaScript" },
  { id: "tailwind", name: "Tailwind" },
  { id: "astro", name: "Astro" },
  { id: "docker", name: "Docker" },
];

// Concepts belong to one technology (1:N)
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

// Projects can reference many technologies and many concepts (N:N)
export const projects: Project[] = [
  {
    id: "proj-analytics",
    title: "Analytics Notebook & Dashboards",
    description: "Conexión entre SQL, PySpark y una historia visual para explicar hallazgos.",
    role: "Data analyst / storytelling",
    outcome: "Dashboard reproducible y narrativa alineada con negocio.",
    technologyIds: ["sql", "pyspark"],
    conceptIds: ["sql-joins", "sql-window", "pyspark-df"],
    embeds: [
      {
        id: "embed-tableau-1",
        kind: "iframe",
        title: "Tableau Public (mock)",
        url: "https://public.tableau.com/views/volumen_agua_captacion/Informe?:language=es-ES&:sid=&:redirect=auth&:display_count=n&:origin=viz_share_link",
        showInPublic: false,
      },
      {
        id: "embed-github-1",
        kind: "link",
        title: "Repositorio (mock)",
        url: "https://github.com/drespns/skill-atlas-app",
        showInPublic: true,
      },
    ],
    updatedAtISO: "2026-03-20T10:00:00.000Z",
  },
  {
    id: "proj-bi",
    title: "BI con DAX",
    description: "Proyecto enfocado en medidas y contexto de evaluación en Power BI.",
    role: "Modelado y medidas",
    outcome: "Modelo semántico reutilizable y medidas validadas con negocio.",
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

/**
 * Simple in-memory "queries"
 * (later replaced by Supabase SQL queries).
 */
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

