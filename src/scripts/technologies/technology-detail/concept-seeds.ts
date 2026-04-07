/**
 * Slugs de tecnología con plantilla en `public/static/concept-seeds/<fichero>.md`.
 * Varias etiquetas pueden apuntar al mismo fichero (alias).
 */
const SLUG_TO_SEED_FILE: Record<string, string> = {
  // Lenguajes core
  python: "python",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  sql: "sql",
  scala: "scala",
  java: "java",
  r: "r-lang",
  "r-lang": "r-lang",
  go: "go",
  golang: "go",
  rust: "rust",
  // Cloud & infra
  aws: "aws",
  azure: "azure",
  gcp: "gcp",
  "google-cloud": "gcp",
  docker: "docker",
  kubernetes: "kubernetes",
  k8s: "kubernetes",
  terraform: "terraform",
  ansible: "ansible",
  linux: "linux",
  git: "git",
  github: "git",
  // Data platforms & lakehouse
  snowflake: "snowflake",
  databricks: "databricks",
  spark: "spark",
  "apache-spark": "spark",
  kafka: "kafka",
  "apache-kafka": "kafka",
  airflow: "airflow",
  "apache-airflow": "airflow",
  dbt: "dbt",
  // (fivetran/stitch eliminados: sin SVG en `public/icons`)
  // Bases analíticas y OLTP
  postgres: "postgres",
  postgresql: "postgres",
  mysql: "mysql",
  mariadb: "mysql",
  "sql-server": "sql-server",
  mssql: "sql-server",
  tsql: "sql-server",
  oracle: "oracle",
  mongodb: "mongodb",
  mongo: "mongodb",
  redis: "redis",
  // (elasticsearch/opensearch eliminados: sin SVG en `public/icons`)
  clickhouse: "clickhouse",
  cassandra: "cassandra",
  dynamodb: "dynamodb",
  // DWH cloud
  bigquery: "bigquery",
  bq: "bigquery",
  redshift: "redshift",
  synapse: "synapse",
  "azure-synapse": "synapse",
  // (fabric eliminado: sin SVG en `public/icons`)
  athena: "athena",
  glue: "glue",
  // BI & visualización
  tableau: "tableau",
  "power-bi": "power-bi",
  powerbi: "power-bi",
  // (looker eliminado: sin SVG en `public/icons`)
  "qlik-sense": "qlik-sense",
  qlik: "qlik-sense",
  // (metabase eliminado: sin SVG en `public/icons`)
  superset: "superset",
  "apache-superset": "superset",
  excel: "excel",
  // Libs data science / DE Python
  pandas: "pandas",
  numpy: "numpy",
  scipy: "scipy",
  matplotlib: "matplotlib",
  seaborn: "seaborn",
  sklearn: "scikit-learn",
  "scikit-learn": "scikit-learn",
  tensorflow: "tensorflow",
  torch: "pytorch",
  pytorch: "pytorch",
  // (polars eliminado: sin SVG en `public/icons`)
  pyspark: "pyspark",
  // (pydantic eliminado: sin SVG en `public/icons`)
  // Web / APIs ligado a cloud
  html: "html",
  css: "css",
  react: "react",
  next: "nextjs",
  nextjs: "nextjs",
  django: "django",
  flask: "flask",
  d3: "d3",
  "d3.js": "d3",
  echarts: "echarts",
  "apache-echarts": "echarts",
  three: "threejs",
  "three.js": "threejs",
  threejs: "threejs",
  node: "node",
  nodejs: "node",
  express: "node",
  fastapi: "fastapi",
};

const SEED_DISPLAY_LABELS: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  sql: "SQL",
  scala: "Scala",
  java: "Java",
  "r-lang": "R",
  go: "Go",
  rust: "Rust",
  aws: "AWS",
  azure: "Microsoft Azure",
  gcp: "Google Cloud (GCP)",
  docker: "Docker",
  kubernetes: "Kubernetes",
  terraform: "Terraform",
  ansible: "Ansible",
  linux: "Linux",
  git: "Git",
  snowflake: "Snowflake",
  databricks: "Databricks",
  spark: "Apache Spark",
  kafka: "Apache Kafka",
  airflow: "Apache Airflow",
  dbt: "dbt",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  "sql-server": "SQL Server",
  oracle: "Oracle Database",
  mongodb: "MongoDB",
  redis: "Redis",
  clickhouse: "ClickHouse",
  cassandra: "Apache Cassandra",
  dynamodb: "Amazon DynamoDB",
  bigquery: "BigQuery",
  redshift: "Amazon Redshift",
  synapse: "Azure Synapse",
  athena: "Amazon Athena",
  glue: "AWS Glue",
  tableau: "Tableau",
  "power-bi": "Power BI",
  "qlik-sense": "Qlik Sense",
  superset: "Apache Superset",
  excel: "Microsoft Excel",
  pandas: "pandas",
  numpy: "NumPy",
  scipy: "SciPy",
  matplotlib: "Matplotlib",
  seaborn: "Seaborn",
  "scikit-learn": "scikit-learn",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",
  pyspark: "PySpark",
  html: "HTML",
  css: "CSS",
  react: "React",
  nextjs: "Next.js",
  django: "Django",
  flask: "Flask",
  d3: "D3.js",
  echarts: "Apache ECharts",
  threejs: "Three.js",
  node: "Node.js",
  fastapi: "FastAPI",
};

export type SeedCatalogEntry = { slug: string; label: string };

export type SeedKind = "technology" | "framework" | "library" | "package";

export type TechnologyCatalogEntry = SeedCatalogEntry & { kind: SeedKind; hasSeed: boolean };

import { GENERATED_ICON_CATALOG } from "./generated-icons-catalog";

const SEED_KIND_BY_SLUG: Record<string, SeedKind> = {
  // Lenguajes core
  python: "technology",
  javascript: "technology",
  typescript: "technology",
  sql: "technology",
  scala: "technology",
  java: "technology",
  "r-lang": "technology",
  go: "technology",
  rust: "technology",
  // Cloud & infra
  aws: "technology",
  azure: "technology",
  gcp: "technology",
  docker: "technology",
  kubernetes: "technology",
  terraform: "technology",
  ansible: "technology",
  linux: "technology",
  git: "technology",
  // Data platforms
  snowflake: "technology",
  databricks: "technology",
  spark: "technology",
  kafka: "technology",
  airflow: "technology",
  dbt: "technology",
  // Databases
  postgres: "technology",
  mysql: "technology",
  "sql-server": "technology",
  oracle: "technology",
  mongodb: "technology",
  redis: "technology",
  clickhouse: "technology",
  cassandra: "technology",
  dynamodb: "technology",
  bigquery: "technology",
  redshift: "technology",
  synapse: "technology",
  athena: "technology",
  glue: "technology",
  // BI
  tableau: "technology",
  "power-bi": "technology",
  "qlik-sense": "technology",
  superset: "technology",
  excel: "technology",
  // Subtecnologías (libs)
  pandas: "library",
  numpy: "library",
  scipy: "library",
  matplotlib: "library",
  seaborn: "library",
  "scikit-learn": "library",
  tensorflow: "library",
  pytorch: "library",
  pyspark: "library",
  // Web / APIs
  html: "technology",
  css: "technology",
  node: "technology",
  react: "framework",
  nextjs: "framework",
  django: "framework",
  flask: "framework",
  fastapi: "framework",
  d3: "library",
  echarts: "library",
  threejs: "library",
};

const EXTRA_CATALOG: TechnologyCatalogEntry[] = [
  // Frameworks (web)
  { slug: "vue", label: "Vue", kind: "framework", hasSeed: false },
  { slug: "svelte", label: "Svelte", kind: "framework", hasSeed: false },
  { slug: "angular", label: "Angular", kind: "framework", hasSeed: false },
  { slug: "nestjs", label: "NestJS", kind: "framework", hasSeed: false },
  { slug: "express", label: "Express", kind: "framework", hasSeed: false },
  { slug: "fastify", label: "Fastify", kind: "framework", hasSeed: false },

  // JS libs / paquetes
  { slug: "react-three-fiber", label: "React Three Fiber", kind: "library", hasSeed: false },
  { slug: "zustand", label: "Zustand", kind: "library", hasSeed: false },
  { slug: "redux", label: "Redux", kind: "library", hasSeed: false },
  { slug: "tanstack-query", label: "TanStack Query", kind: "library", hasSeed: false },
  { slug: "threejs-editor", label: "Three.js Editor", kind: "package", hasSeed: false },

  // Python libs / paquetes (data/ML)
  { slug: "polars", label: "Polars", kind: "library", hasSeed: false },
  { slug: "statsmodels", label: "statsmodels", kind: "library", hasSeed: false },
  { slug: "xgboost", label: "XGBoost", kind: "library", hasSeed: false },
  { slug: "lightgbm", label: "LightGBM", kind: "library", hasSeed: false },
  { slug: "catboost", label: "CatBoost", kind: "library", hasSeed: false },
  { slug: "keras", label: "Keras", kind: "library", hasSeed: false },
  { slug: "opencv", label: "OpenCV", kind: "library", hasSeed: false },
  { slug: "spacy", label: "spaCy", kind: "library", hasSeed: false },
  { slug: "nltk", label: "NLTK", kind: "library", hasSeed: false },
  { slug: "transformers", label: "Transformers", kind: "library", hasSeed: false },

  // Python libs / paquetes (web/dev)
  { slug: "pydantic", label: "Pydantic", kind: "library", hasSeed: false },
  { slug: "sqlalchemy", label: "SQLAlchemy", kind: "library", hasSeed: false },
  { slug: "alembic", label: "Alembic", kind: "library", hasSeed: false },
  { slug: "pytest", label: "pytest", kind: "library", hasSeed: false },
  { slug: "requests", label: "Requests", kind: "library", hasSeed: false },
  { slug: "beautifulsoup", label: "Beautiful Soup", kind: "library", hasSeed: false },
  { slug: "selenium", label: "Selenium", kind: "library", hasSeed: false },

  // Data storage/eng
  { slug: "duckdb", label: "DuckDB", kind: "technology", hasSeed: false },
  { slug: "sqlite", label: "SQLite", kind: "technology", hasSeed: false },

  // Tools / 3D / misc
  { slug: "blender", label: "Blender", kind: "technology", hasSeed: false },
  { slug: "unity", label: "Unity", kind: "technology", hasSeed: false },

  // Node / DB libs
  { slug: "mongoose", label: "Mongoose", kind: "library", hasSeed: false },
];

/** Catálogo único (un ítem por plantilla) para picker al crear tecnología. */
export function getSeedCatalogEntries(): (SeedCatalogEntry & { kind: SeedKind })[] {
  const files = new Set(Object.values(SLUG_TO_SEED_FILE));
  const out: (SeedCatalogEntry & { kind: SeedKind })[] = [];
  for (const file of files) {
    const label = SEED_DISPLAY_LABELS[file] ?? titleCaseSlug(file);
    const kind = SEED_KIND_BY_SLUG[file] ?? "technology";
    out.push({ slug: file, label, kind });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return out;
}

/** Catálogo para el picker de creación: seeds + extras sin plantilla todavía. */
export function getTechnologyCatalogEntries(): TechnologyCatalogEntry[] {
  const seeds = getSeedCatalogEntries().map((e) => ({ ...e, hasSeed: true }));
  const fromIcons: TechnologyCatalogEntry[] = (GENERATED_ICON_CATALOG ?? []).map((e) => {
    // Heurística de tipo por slug/label: si no se conoce, cae a "technology".
    const slug = e.slug;
    const label = e.label;
    const low = `${slug} ${label}`.toLowerCase();
    const kind: SeedKind =
      /(react|next|vue|svelte|angular|django|flask|fastapi|nestjs|express|fastify)/.test(low) ? "framework" : "technology";
    return { slug, label, kind, hasSeed: false };
  });
  const merged = new Map<string, TechnologyCatalogEntry>();
  for (const it of [...seeds, ...fromIcons, ...EXTRA_CATALOG]) merged.set(it.slug, it);
  return [...merged.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function getCatalogEntryForSlug(slug: string): TechnologyCatalogEntry | null {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  // Use file-level slug (after aliasing) when possible.
  const normalized = SLUG_TO_SEED_FILE[key] ?? key;
  const all = getTechnologyCatalogEntries();
  return all.find((e) => e.slug === normalized) ?? null;
}

function titleCaseSlug(file: string) {
  return file
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function hasConceptSeed(slug: string): boolean {
  const key = slug.trim().toLowerCase();
  return key in SLUG_TO_SEED_FILE;
}

export function conceptSeedPublicPath(slug: string): string {
  const key = slug.trim().toLowerCase();
  const file = SLUG_TO_SEED_FILE[key] ?? key;
  return `/static/concept-seeds/${file}.md`;
}
