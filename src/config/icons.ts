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
  python: "/icons/Python.svg",
  r: "/icons/R.svg",
  scala: "/icons/Scala.svg",
  typescript: "/icons/TypeScript.svg",
};

const webAndFrontend: Record<string, string> = {
  astro: "/icons/Astro.svg",
  css: "/icons/CSS3.svg",
  html: "/icons/HTML5.svg",
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
};

const bigDataAndStreaming: Record<string, string> = {
  hadoop: "/icons/Apache Hadoop.svg",
  kafka: "/icons/Apache Kafka.svg",
  pyspark: "/icons/Apache Spark.svg",
  spark: "/icons/Apache Spark.svg",
};

const databasesAndStores: Record<string, string> = {
  mongodb: "/icons/MongoDB.svg",
  mongo: "/icons/MongoDB.svg",
  mysql: "/icons/MySQL.svg",
  postgres: "/icons/PostgresSQL.svg",
  postgresql: "/icons/PostgresSQL.svg",
  sql: "/icons/PostgresSQL.svg",
  sqlite: "/icons/SQLite.svg",
};

/** Warehouses, lakehouse, transformation */
const dataEngineering: Record<string, string> = {
  databricks: "/icons/Databricks.svg",
  dbt: "/icons/Dbt.svg",
  snowflake: "/icons/Snowflake.svg",
};

const biAndAnalytics: Record<string, string> = {
  tableau: "/icons/Tableau.svg",
};

const cloudPlatforms: Record<string, string> = {
  aws: "/icons/AWS.svg",
};

const devOpsAndDelivery: Record<string, string> = {
  docker: "/icons/Docker.svg",
  git: "/icons/Git.svg",
  github: "/icons/GitHub.svg",
  "github actions": "/icons/GitHub Actions.svg",
  jenkins: "/icons/Jenkins.svg",
  kubernetes: "/icons/Kubernetes.svg",
  vercel: "/icons/Vercel.svg",
};

const toolsAndOther: Record<string, string> = {
  "after effects": "/icons/After Effects.svg",
  dbeaver: "/icons/DBeaver.svg",
  fastapi: "/icons/FastAPI.svg",
  figma: "/icons/Figma.svg",
  markdown: "/icons/Markdown.svg",
  selenium: "/icons/Selenium.svg",
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
