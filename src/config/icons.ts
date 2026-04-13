/**
 * Icon mapping for technologies (CSR lists, cards).
 *
 * Conventions:
 * - Keys: lowercase id, slug, or normalized display name.
 * - Values: paths under `public/icons` (file names must match repo assets).
 * - Add new stacks under the closest category block; keep keys alphabetized within each block.
 * - Several keys may point to the same SVG so `getTechnologyIconSrc` resolves DB slugs and labels
 *   that differ in spelling (e.g. `powerbi`, `power bi`, `power-bi`).
 */

const tech = (file: string) => `/icons/technologies/${file}`;
const fw = (file: string) => `/icons/frameworks/${file}`;
const lib = (file: string) => `/icons/libraries/${file}`;
const pkg = (file: string) => `/icons/packages/${file}`;

const programmingLanguages: Record<string, string> = {
  c: tech("C.svg"),
  csharp: tech("CSharp.svg"),
  "c#": tech("CSharp.svg"),
  "c-sharp": tech("CSharp.svg"),
  "c-csharp": tech("CSharp.svg"),
  javascript: tech("JavaScript.svg"),
  js: tech("JavaScript.svg"),
  python: tech("Python.svg"),
  r: tech("R.svg"),
  scala: tech("Scala.svg"),
  typescript: tech("TypeScript.svg"),
  ts: tech("TypeScript.svg"),
  java: tech("Java.svg"),
  go: tech("Go.svg"),
  rust: tech("Rust.svg"),
};

const webAndFrontend: Record<string, string> = {
  angular: fw("Angular.svg"),
  angularjs: fw("AngularJS.svg"),
  astro: tech("Astro.svg"),
  bootstrap: fw("Bootstrap.svg"),
  css: tech("CSS3.svg"),
  html: tech("HTML5.svg"),
  node: tech("Node.js.svg"),
  "node.js": tech("Node.js.svg"),
  nodejs: tech("Node.js.svg"),
  react: fw("React.svg"),
  tailwind: fw("Tailwind CSS.svg"),
  tailwindcss: fw("Tailwind CSS.svg"),
  "tailwind-css": fw("Tailwind CSS.svg"),
  threejs: lib("Three.js.svg"),
  "three-js": lib("Three.js.svg"),
  "three.js": lib("Three.js.svg"),
  vite: tech("Vite.js.svg"),
};

const dataScienceAndMl: Record<string, string> = {
  jupyter: tech("Jupyter.svg"),
  kaggle: tech("Kaggle.svg"),
  keras: lib("Keras.svg"),
  numpy: lib("NumPy.svg"),
  pandas: lib("Pandas.svg"),
  scipy: tech("Python.svg"),
  matplotlib: lib("Matplotlib.svg"),
  seaborn: tech("Python.svg"),
  tensorflow: lib("TensorFlow.svg"),
  "scikit-learn": lib("scikit-learn.svg"),
  sklearn: lib("scikit-learn.svg"),
};

const bigDataAndStreaming: Record<string, string> = {
  hadoop: tech("Apache Hadoop.svg"),
  kafka: tech("Apache Kafka.svg"),
  "apache kafka": tech("Apache Kafka.svg"),
  airflow: tech("Apache Airflow.svg"),
  "apache airflow": tech("Apache Airflow.svg"),
  pyspark: tech("Apache Spark.svg"),
  spark: tech("Apache Spark.svg"),
  "apache spark": tech("Apache Spark.svg"),
};

const databasesAndStores: Record<string, string> = {
  cassandra: tech("Apache Cassandra.svg"),
  "apache cassandra": tech("Apache Cassandra.svg"),
  clickhouse: tech("Clickhouse.svg"),
  dynamodb: tech("AWS DynamoDB.svg"),
  "amazon dynamodb": tech("AWS DynamoDB.svg"),
  mongodb: tech("MongoDB.svg"),
  mongo: tech("MongoDB.svg"),
  mysql: tech("MySQL.svg"),
  postgres: tech("PostgresSQL.svg"),
  postgresql: tech("PostgresSQL.svg"),
  sql: tech("SQL.svg"),
  sqlite: tech("SQLite.svg"),
  "sql server": tech("SQL Server.svg"),
  mssql: tech("SQL Server.svg"),
  tsql: tech("SQL Server.svg"),
  oracle: tech("oracle-database.svg"),
  "oracle database": tech("oracle-database.svg"),
  redis: tech("Redis.svg"),
};

/** Warehouses, lakehouse, transformation */
const dataEngineering: Record<string, string> = {
  databricks: tech("Databricks.svg"),
  dbt: tech("Dbt.svg"),
  snowflake: tech("Snowflake.svg"),
  bigquery: tech("BigQuery.svg"),
  redshift: tech("AWS Redshift.svg"),
  athena: tech("AWS Athena.svg"),
  glue: tech("AWS Glue.svg"),
  synapse: tech("Azure Synapse.svg"),
};

const biAndAnalytics: Record<string, string> = {
  excel: tech("Microsoft_Office_Excel_2025.svg"),
  "microsoft excel": tech("Microsoft_Office_Excel_2025.svg"),
  powerbi: tech("PowerBI.svg"),
  "power bi": tech("PowerBI.svg"),
  "power-bi": tech("PowerBI.svg"),
  qlik: tech("Qlik.svg"),
  "qlik sense": tech("Qlik.svg"),
  "qlik-sense": tech("Qlik.svg"),
  tableau: tech("Tableau.svg"),
  superset: tech("Apache Superset.svg"),
  "apache superset": tech("Apache Superset.svg"),
  "apache-superset": tech("Apache Superset.svg"),
};

const cloudPlatforms: Record<string, string> = {
  supabase: tech("supabase-logo-icon.svg"),
  aws: tech("AWS.svg"),
  azure: tech("Azure.svg"),
  "microsoft azure": tech("Azure.svg"),
  gcp: tech("Google Cloud.svg"),
  "google cloud": tech("Google Cloud.svg"),
  "google cloud (gcp)": tech("Google Cloud.svg"),
};

const devOpsAndDelivery: Record<string, string> = {
  ansible: tech("Ansible.svg"),
  docker: tech("Docker.svg"),
  git: tech("Git.svg"),
  github: tech("GitHub.svg"),
  "github actions": tech("GitHub Actions.svg"),
  jenkins: tech("Jenkins.svg"),
  kubernetes: tech("Kubernetes.svg"),
  terraform: tech("Terraform.svg"),
  vercel: tech("Vercel.svg"),
};

const toolsAndOther: Record<string, string> = {
  "after effects": tech("After Effects.svg"),
  blender: tech("Blender.svg"),
  dbeaver: tech("DBeaver.svg"),
  fastapi: fw("FastAPI.svg"),
  figma: tech("Figma.svg"),
  linux: tech("Linux.svg"),
  markdown: tech("Markdown.svg"),
  powershell: tech("Powershell.svg"),
  selenium: lib("Selenium.svg"),
  unity: tech("Unity.svg"),
  wordpress: tech("WordPress.svg"),
};

export const iconByKey: Record<string, string> = {
  ...programmingLanguages,
  ...webAndFrontend,
  ...dataScienceAndMl,
  ...bigDataAndStreaming,
  ...databasesAndStores,
  ...dataEngineering,
  ...biAndAnalytics,
  ...cloudPlatforms,
  ...devOpsAndDelivery,
  ...toolsAndOther,
};

/** Encode each path segment so spaces/special chars work in `img[src]` and CSS `url()`. */
export function encodePublicIconPath(p: string): string {
  const t = String(p ?? "").trim();
  if (!t) return "";
  if (!t.startsWith("/")) return encodeURI(t);
  return (
    "/" +
    t
      .split("/")
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join("/")
  );
}

export function getIconSrc(input?: string | null) {
  if (!input) return "";
  const key = String(input).trim().toLowerCase();
  return iconByKey[key] || "";
}

export function getTechnologyIconSrc(tech: { id?: string; name?: string }) {
  const byId = getIconSrc(tech.id);
  if (byId) return byId;

  const byName = getIconSrc(tech.name);
  if (byName) return byName;

  return "";
}
