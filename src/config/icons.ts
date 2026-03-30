/**
 * Centralized icon mapping.
 *
 * Keys are normalized technology names/ids in lowercase.
 * Values are paths under `public/icons`.
 */
export const iconByKey: Record<string, string> = {
  // Data / Python
  python: "/icons/Python.svg",
  pandas: "/icons/Pandas.svg",
  numpy: "/icons/NumPy.svg",
  tensorflow: "/icons/TensorFlow.svg",
  keras: "/icons/Keras.svg",

  // Big data
  pyspark: "/icons/Apache Spark.svg",
  spark: "/icons/Apache Spark.svg",
  kafka: "/icons/Apache Kafka.svg",

  // DB
  sql: "/icons/PostgresSQL.svg",
  postgres: "/icons/PostgresSQL.svg",
  postgresql: "/icons/PostgresSQL.svg",
  mysql: "/icons/MySQL.svg",
  sqlite: "/icons/SQLite.svg",
  mongodb: "/icons/MongoDB.svg",

  // Front / tooling
  astro: "/icons/Astro.svg",
  react: "/icons/React.svg",
  typescript: "/icons/TypeScript.svg",
  javascript: "/icons/JavaScript.svg",
  html: "/icons/HTML5.svg",
  css: "/icons/CSS3.svg",
  tailwind: "/icons/Tailwind CSS.svg",
  docker: "/icons/Docker.svg",
  kubernetes: "/icons/Kubernetes.svg",
  aws: "/icons/AWS.svg",
  git: "/icons/Git.svg",
  github: "/icons/GitHub.svg",
  "github actions": "/icons/GitHub Actions.svg",

  // Other
  jupyter: "/icons/Jupyter.svg",
  tableau: "/icons/tableau-icon-svgrepo-com.svg",
  kaggle: "/icons/Kaggle.svg",
  fastapi: "/icons/FastAPI.svg",
  markdown: "/icons/Markdown.svg",
  scala: "/icons/Scala.svg",
  r: "/icons/R.svg",
  c: "/icons/C.svg",
  vercel: "/icons/Vercel.svg",
  jenkins: "/icons/Jenkins.svg",
  wordpress: "/icons/WordPress.svg",
  "after effects": "/icons/After Effects.svg",
  dbeaver: "/icons/DBeaver.svg",
};

/**
 * Returns an icon by a generic key (id, name, alias).
 */
export function getIconSrc(input?: string | null) {
  if (!input) return "";
  const key = String(input).trim().toLowerCase();
  return iconByKey[key] || "";
}

/**
 * Resolves the best icon for a technology object.
 *
 * Resolution order:
 * 1) `tech.id`
 * 2) `tech.name`
 */
export function getTechnologyIconSrc(tech: { id?: string; name?: string }) {
  const byId = getIconSrc(tech.id);
  if (byId) return byId;

  const byName = getIconSrc(tech.name);
  if (byName) return byName;

  // Important: do NOT guess a file name under /icons.
  // Missing files trigger repeated 404s and visual flicker in CSR lists.
  return "";
}

