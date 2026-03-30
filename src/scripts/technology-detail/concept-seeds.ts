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
  fivetran: "fivetran",
  stitch: "stitch",
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
  elasticsearch: "elasticsearch",
  opensearch: "opensearch",
  clickhouse: "clickhouse",
  cassandra: "cassandra",
  dynamodb: "dynamodb",
  // DWH cloud
  bigquery: "bigquery",
  bq: "bigquery",
  redshift: "redshift",
  synapse: "synapse",
  "azure-synapse": "synapse",
  fabric: "fabric",
  "microsoft-fabric": "fabric",
  athena: "athena",
  glue: "glue",
  // BI & visualización
  tableau: "tableau",
  "power-bi": "power-bi",
  powerbi: "power-bi",
  looker: "looker",
  lookml: "looker",
  "qlik-sense": "qlik-sense",
  qlik: "qlik-sense",
  metabase: "metabase",
  superset: "superset",
  "apache-superset": "superset",
  excel: "excel",
  // Libs data science / DE Python
  pandas: "pandas",
  numpy: "numpy",
  polars: "polars",
  pyspark: "pyspark",
  pydantic: "pydantic",
  // Web / APIs ligado a cloud
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
  fivetran: "Fivetran",
  stitch: "Stitch",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  "sql-server": "SQL Server",
  oracle: "Oracle Database",
  mongodb: "MongoDB",
  redis: "Redis",
  elasticsearch: "Elasticsearch",
  opensearch: "OpenSearch",
  clickhouse: "ClickHouse",
  cassandra: "Apache Cassandra",
  dynamodb: "Amazon DynamoDB",
  bigquery: "BigQuery",
  redshift: "Amazon Redshift",
  synapse: "Azure Synapse",
  fabric: "Microsoft Fabric",
  athena: "Amazon Athena",
  glue: "AWS Glue",
  tableau: "Tableau",
  "power-bi": "Power BI",
  looker: "Looker",
  "qlik-sense": "Qlik Sense",
  metabase: "Metabase",
  superset: "Apache Superset",
  excel: "Microsoft Excel",
  pandas: "pandas",
  numpy: "NumPy",
  polars: "Polars",
  pyspark: "PySpark",
  pydantic: "Pydantic",
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
