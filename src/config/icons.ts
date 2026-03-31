/**
 * Icon mapping for technologies (CSR lists, cards).
 *
 * Conventions:
 * - Keys: lowercase id, slug, or normalized display name.
 * - Values: paths under `public/icons` (file names must match repo assets).
 * - Add new stacks under the closest category block; keep keys alphabetized within each block.
 */

const programmingLanguages: Record<string, string> = {
  c: "/icons/C.svg",
  javascript: "/icons/JavaScript.svg",
  js: "/icons/JavaScript.svg",
  python: "/icons/Python.svg",
  r: "/icons/R.svg",
  scala: "/icons/Scala.svg",
  typescript: "/icons/TypeScript.svg",
  ts: "/icons/TypeScript.svg",
  java: "/icons/Java.svg",
  go: "/icons/Go.svg",
  rust: "/icons/Rust.svg",
};

const webAndFrontend: Record<string, string> = {
  angular: "/icons/Angular.svg",
  "angularjs": "/icons/AngularJS.svg",
  astro: "/icons/Astro.svg",
  bootstrap: "/icons/Bootstrap.svg",
  css: "/icons/CSS3.svg",
  html: "/icons/HTML5.svg",
  node: "/icons/Node.js.svg",
  "node.js": "/icons/Node.js.svg",
  nodejs: "/icons/Node.js.svg",
  react: "/icons/React.svg",
  tailwind: "/icons/Tailwind CSS.svg",
  vite: "/icons/Vite.js.svg",
};

const dataScienceAndMl: Record<string, string> = {
  jupyter: "/icons/Jupyter.svg",
  kaggle: "/icons/Kaggle.svg",
  keras: "/icons/Keras.svg",
  numpy: "/icons/NumPy.svg",
  pandas: "/icons/Pandas.svg",
  tensorflow: "/icons/TensorFlow.svg",
  "scikit-learn": "/icons/scikit-learn.svg",
  sklearn: "/icons/scikit-learn.svg",
};

const bigDataAndStreaming: Record<string, string> = {
  hadoop: "/icons/Apache Hadoop.svg",
  kafka: "/icons/Apache Kafka.svg",
  "apache kafka": "/icons/Apache Kafka.svg",
  airflow: "/icons/Apache Airflow.svg",
  "apache airflow": "/icons/Apache Airflow.svg",
  pyspark: "/icons/Apache Spark.svg",
  spark: "/icons/Apache Spark.svg",
  "apache spark": "/icons/Apache Spark.svg",
};

const databasesAndStores: Record<string, string> = {
  cassandra: "/icons/Apache Cassandra.svg",
  "apache cassandra": "/icons/Apache Cassandra.svg",
  clickhouse: "/icons/Clickhouse.svg",
  dynamodb: "/icons/AWS DynamoDB.svg",
  "amazon dynamodb": "/icons/AWS DynamoDB.svg",
  mongodb: "/icons/MongoDB.svg",
  mongo: "/icons/MongoDB.svg",
  mysql: "/icons/MySQL.svg",
  postgres: "/icons/PostgresSQL.svg",
  postgresql: "/icons/PostgresSQL.svg",
  sql: "/icons/SQL.svg",
  sqlite: "/icons/SQLite.svg",
  "sql server": "/icons/SQL Server.svg",
  mssql: "/icons/SQL Server.svg",
  tsql: "/icons/SQL Server.svg",
  oracle: "/icons/oracle-database.svg",
  "oracle database": "/icons/oracle-database.svg",
  redis: "/icons/Redis.svg",
};

/** Warehouses, lakehouse, transformation */
const dataEngineering: Record<string, string> = {
  databricks: "/icons/Databricks.svg",
  dbt: "/icons/Dbt.svg",
  snowflake: "/icons/Snowflake.svg",
  bigquery: "/icons/BigQuery.svg",
  redshift: "/icons/AWS Redshift.svg",
  athena: "/icons/AWS Athena.svg",
  glue: "/icons/AWS Glue.svg",
  synapse: "/icons/Azure Synapse.svg",
};

const biAndAnalytics: Record<string, string> = {
  excel: "/icons/Microsoft_Office_Excel_2025.svg",
  "microsoft excel": "/icons/Microsoft_Office_Excel_2025.svg",
  powerbi: "/icons/PowerBI.svg",
  "power bi": "/icons/PowerBI.svg",
  "power-bi": "/icons/PowerBI.svg",
  qlik: "/icons/Qlik.svg",
  "qlik sense": "/icons/Qlik.svg",
  "qlik-sense": "/icons/Qlik.svg",
  tableau: "/icons/Tableau.svg",
  superset: "/icons/Apache Superset.svg",
  "apache superset": "/icons/Apache Superset.svg",
  "apache-superset": "/icons/Apache Superset.svg",
};

const cloudPlatforms: Record<string, string> = {
  aws: "/icons/AWS.svg",
  azure: "/icons/Azure.svg",
  "microsoft azure": "/icons/Azure.svg",
  gcp: "/icons/Google Cloud.svg",
  "google cloud": "/icons/Google Cloud.svg",
  "google cloud (gcp)": "/icons/Google Cloud.svg",
};

const devOpsAndDelivery: Record<string, string> = {
  ansible: "/icons/Ansible.svg",
  docker: "/icons/Docker.svg",
  git: "/icons/Git.svg",
  github: "/icons/GitHub.svg",
  "github actions": "/icons/GitHub Actions.svg",
  jenkins: "/icons/Jenkins.svg",
  kubernetes: "/icons/Kubernetes.svg",
  terraform: "/icons/Terraform.svg",
  vercel: "/icons/Vercel.svg",
};

const toolsAndOther: Record<string, string> = {
  "after effects": "/icons/After Effects.svg",
  dbeaver: "/icons/DBeaver.svg",
  fastapi: "/icons/FastAPI.svg",
  figma: "/icons/Figma.svg",
  linux: "/icons/Linux.svg",
  markdown: "/icons/Markdown.svg",
  powershell: "/icons/Powershell.svg",
  selenium: "/icons/Selenium.svg",
  unity: "/icons/Unity.svg",
  wordpress: "/icons/WordPress.svg",
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
