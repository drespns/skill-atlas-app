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
  lua: "lua",
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
  "apache-cassandra": "cassandra",
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
  /** Mismo producto que plantilla `excel`; evita duplicado con el nombre del SVG en disco */
  "microsoft-office-excel-2025": "excel",
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
  html5: "html",
  css: "css",
  css3: "css",
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
  hadoop: "hadoop",
  "apache-hadoop": "hadoop",
  // C / C# (slugs del catálogo generado)
  c: "c",
  csharp: "csharp",
  "c-sharp": "csharp",
  "c#": "csharp",
  "c-csharp": "csharp",
  // AWS nombres con prefijo en SVGs
  "aws-athena": "athena",
  "aws-dynamodb": "dynamodb",
  "aws-glue": "glue",
  "aws-redshift": "redshift",
  "aws-kinesis": "aws-kinesis",
  "oracle-database": "oracle",
  // Next / Nest / Vite (slugs con guion en disco)
  "next-js": "nextjs",
  "nest-js": "nestjs",
  "vite-js": "vite",
  tailwind: "tailwind",
  "tailwind-css": "tailwind",
  // Frontend y frameworks del catálogo SVG
  angular: "angular",
  angularjs: "angularjs",
  astro: "astro",
  svelte: "svelte",
  bootstrap: "bootstrap",
  spring: "spring",
  streamlit: "streamlit",
  sqlite: "sqlite",
  supabase: "supabase",
  vercel: "vercel",
  cloudflare: "cloudflare",
  jenkins: "jenkins",
  npm: "npm",
  keras: "keras",
  selenium: "selenium",
  redux: "redux",
  github: "github",
  "github-actions": "github-actions",
  "adobe-photoshop": "adobe-photoshop",
  "adobe-premiere-pro": "adobe-premiere-pro",
  "after-effects": "after-effects",
  blender: "blender",
  unity: "unity",
  "unreal-engine": "unreal-engine",
  dbeaver: "dbeaver",
  jupyter: "jupyter",
  kaggle: "kaggle",
  latex: "latex",
  markdown: "markdown",
  pyscript: "pyscript",
  powershell: "powershell",
  swift: "swift",
  wordpress: "wordpress",
  "mongoose-js": "mongoose-js",
  mongoose: "mongoose-js",
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
  github: "GitHub",
  c: "C",
  csharp: "C#",
  nestjs: "NestJS",
  vite: "Vite",
  tailwind: "Tailwind CSS",
  angular: "Angular",
  angularjs: "AngularJS",
  astro: "Astro",
  svelte: "Svelte",
  bootstrap: "Bootstrap",
  spring: "Spring",
  streamlit: "Streamlit",
  sqlite: "SQLite",
  supabase: "Supabase",
  vercel: "Vercel",
  cloudflare: "Cloudflare",
  jenkins: "Jenkins",
  npm: "npm",
  keras: "Keras",
  selenium: "Selenium",
  redux: "Redux",
  "github-actions": "GitHub Actions",
  "aws-kinesis": "Amazon Kinesis",
  "adobe-photoshop": "Adobe Photoshop",
  "adobe-premiere-pro": "Adobe Premiere Pro",
  "after-effects": "Adobe After Effects",
  blender: "Blender",
  unity: "Unity",
  "unreal-engine": "Unreal Engine",
  dbeaver: "DBeaver",
  jupyter: "Jupyter",
  kaggle: "Kaggle",
  latex: "LaTeX",
  lua: "Lua",
  markdown: "Markdown",
  pyscript: "PyScript",
  powershell: "PowerShell",
  swift: "Swift",
  wordpress: "WordPress",
  "mongoose-js": "Mongoose.js",
};

export type SeedCatalogEntry = { slug: string; label: string };

export type SeedKind = "technology" | "framework" | "library" | "package";

export type TechnologyCatalogEntry = SeedCatalogEntry & { kind: SeedKind; hasSeed: boolean; iconPath?: string };

import { GENERATED_ICON_CATALOG } from "./generated-icons-catalog";

/** Variantes de slug en DB / UI → slug canónico del catálogo (SVG). */
const CATALOG_SLUG_ALIASES: Record<string, string> = {
  tailwind: "tailwind-css",
  tailwindcss: "tailwind-css",
  "three-js": "threejs",
  "three.js": "threejs",
  csharp: "c-csharp",
  "c-sharp": "c-csharp",
};

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
  c: "technology",
  csharp: "technology",
  github: "technology",
  "github-actions": "technology",
  angular: "framework",
  angularjs: "framework",
  astro: "framework",
  svelte: "framework",
  bootstrap: "framework",
  nestjs: "framework",
  tailwind: "framework",
  spring: "framework",
  streamlit: "framework",
  vite: "framework",
  keras: "library",
  redux: "library",
  selenium: "library",
  "mongoose-js": "library",
  supabase: "technology",
  vercel: "technology",
  cloudflare: "technology",
  jenkins: "technology",
  sqlite: "technology",
  npm: "package",
  "aws-kinesis": "technology",
  "adobe-photoshop": "technology",
  "adobe-premiere-pro": "technology",
  "after-effects": "technology",
  blender: "technology",
  unity: "technology",
  "unreal-engine": "technology",
  dbeaver: "technology",
  jupyter: "technology",
  kaggle: "technology",
  latex: "technology",
  lua: "technology",
  markdown: "technology",
  pyscript: "technology",
  powershell: "technology",
  swift: "technology",
  wordpress: "technology",
};

const EXTRA_CATALOG: TechnologyCatalogEntry[] = [
  { slug: "vue", label: "Vue", kind: "framework", hasSeed: false },
  { slug: "fastify", label: "Fastify", kind: "framework", hasSeed: false },
  { slug: "express", label: "Express", kind: "framework", hasSeed: false },

  { slug: "react-three-fiber", label: "React Three Fiber", kind: "library", hasSeed: false },
  { slug: "zustand", label: "Zustand", kind: "library", hasSeed: false },
  { slug: "tanstack-query", label: "TanStack Query", kind: "library", hasSeed: false },

  { slug: "polars", label: "Polars", kind: "library", hasSeed: false },
  { slug: "statsmodels", label: "statsmodels", kind: "library", hasSeed: false },
  { slug: "xgboost", label: "XGBoost", kind: "library", hasSeed: false },
  { slug: "lightgbm", label: "LightGBM", kind: "library", hasSeed: false },
  { slug: "catboost", label: "CatBoost", kind: "library", hasSeed: false },
  { slug: "opencv", label: "OpenCV", kind: "library", hasSeed: false },
  { slug: "spacy", label: "spaCy", kind: "library", hasSeed: false },
  { slug: "nltk", label: "NLTK", kind: "library", hasSeed: false },
  { slug: "transformers", label: "Transformers", kind: "library", hasSeed: false },

  { slug: "pydantic", label: "Pydantic", kind: "library", hasSeed: false },
  { slug: "sqlalchemy", label: "SQLAlchemy", kind: "library", hasSeed: false },
  { slug: "alembic", label: "Alembic", kind: "library", hasSeed: false },
  { slug: "pytest", label: "pytest", kind: "library", hasSeed: false },
  { slug: "requests", label: "Requests", kind: "library", hasSeed: false },
  { slug: "beautifulsoup", label: "Beautiful Soup", kind: "library", hasSeed: false },

  { slug: "duckdb", label: "DuckDB", kind: "technology", hasSeed: false },
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
  const normalizeIconSlug = (slugRaw: string): string => {
    const slug = slugRaw.trim().toLowerCase();
    if (!slug) return "";
    const stripped = slug
      .replace(/(--dark|--light)$/, "")
      .replace(/-(dark|light)$/, "")
      .replace(/-(color|coloured|colored)$/, "")
      .replace(/-(logo-icon|logo-wordmark|logo|wordmark|icon)$/, "");
    return SLUG_TO_SEED_FILE[stripped] ?? stripped;
  };

  const fromIcons: TechnologyCatalogEntry[] = (GENERATED_ICON_CATALOG ?? []).map((e) => {
    const slug = normalizeIconSlug(e.slug);
    const label = e.label;
    const low = `${slug} ${label}`.toLowerCase();
    const kindFromFile = (e as any).kind as SeedKind | undefined;
    const iconPath = typeof (e as any).iconPath === "string" ? ((e as any).iconPath as string) : undefined;
    const kind: SeedKind =
      kindFromFile ??
      (/(react|next|vue|svelte|angular|django|flask|fastapi|nestjs|express|fastify|astro|tailwind)/.test(low)
        ? "framework"
        : "technology");
    return { slug, label, kind, hasSeed: false, iconPath };
  });
  const merged = new Map<string, TechnologyCatalogEntry>();
  for (const it of seeds) merged.set(it.slug, { ...it });
  for (const it of EXTRA_CATALOG) merged.set(it.slug, { ...it });
  // SVG: añade iconPath; si ya había plantilla (seed) u extra con el mismo slug, conserva etiqueta/tipo de plantilla y marca hasSeed.
  for (const it of fromIcons) {
    const prev = merged.get(it.slug);
    if (!prev) {
      merged.set(it.slug, it);
      continue;
    }
    merged.set(it.slug, {
      slug: it.slug,
      hasSeed: prev.hasSeed,
      label: prev.label,
      kind: prev.hasSeed ? prev.kind : it.kind,
      iconPath: it.iconPath ?? prev.iconPath,
    });
  }
  return [...merged.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Resuelve icono/tipo del catálogo. Si `SLUG_TO_SEED_FILE` apunta a otro .md pero existe fila con este slug propio en el catálogo generado, se usa esa fila (p. ej. github vs git). */
export function getCatalogEntryForSlug(slug: string): TechnologyCatalogEntry | null {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  const all = getTechnologyCatalogEntries();
  if (CATALOG_SLUG_ALIASES[key]) {
    const n = CATALOG_SLUG_ALIASES[key]!;
    return all.find((e) => e.slug === n) ?? null;
  }
  const seedTarget = SLUG_TO_SEED_FILE[key];
  if (seedTarget !== undefined && seedTarget !== key && all.some((e) => e.slug === key)) {
    return all.find((e) => e.slug === key) ?? null;
  }
  const normalized = seedTarget ?? key;
  return all.find((e) => e.slug === normalized) ?? null;
}

/** Si el slug en DB no coincide con el catálogo, reintenta con el nombre mostrado (p. ej. Tailwind CSS → tailwind-css). */
export function getCatalogEntryForTech(slug: string, name: string): TechnologyCatalogEntry | null {
  const fromSlug = getCatalogEntryForSlug(slug);
  if (fromSlug) return fromSlug;
  const n = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return n ? getCatalogEntryForSlug(n) : null;
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
