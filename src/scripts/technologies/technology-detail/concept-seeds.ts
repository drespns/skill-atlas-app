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
  // (polars eliminado: sin SVG en `public/icons`)
  pyspark: "pyspark",
  // (pydantic eliminado: sin SVG en `public/icons`)
  // Web / APIs ligado a cloud
  html: "html",
  css: "css",
  react: "react",
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
  pyspark: "PySpark",
  html: "HTML",
  css: "CSS",
  react: "React",
  node: "Node.js",
  fastapi: "FastAPI",
};

export type SeedCatalogEntry = { slug: string; label: string };

/** Catálogo único (un ítem por plantilla) para picker al crear tecnología. */
export function getSeedCatalogEntries(): SeedCatalogEntry[] {
  const files = new Set(Object.values(SLUG_TO_SEED_FILE));
  const out: SeedCatalogEntry[] = [];
  for (const file of files) {
    const label = SEED_DISPLAY_LABELS[file] ?? titleCaseSlug(file);
    out.push({ slug: file, label });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return out;
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
