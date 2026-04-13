import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const iconsRoot = path.join(root, "public", "icons");

const KEEP_DIRS = new Set(["flags", "login"]);
const TARGET_DIRS = ["technologies", "frameworks", "libraries", "packages", "tools"];

function toSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalizeSlug(slug) {
  let s = toSlug(slug);
  s = s
    .replace(/(--dark|--light)$/, "")
    .replace(/-(dark|light)$/, "")
    .replace(/-(color|coloured|colored)$/, "")
    .replace(/-(logo-icon|logo-wordmark|logo|wordmark|icon)$/, "")
    .replace(/-+$/, "");
  if (s === "powerbi") s = "power-bi";
  if (s === "postgresql" || s === "postgressql") s = "postgres";
  if (s === "node-js") s = "node";
  if (s === "three-js") s = "threejs";
  if (s === "d3-js") s = "d3";
  return s;
}

// Tools/help-stack + non-tech icons that should never appear as technologies.
const TOOL_SLUGS = new Set([
  "cursor",
  "opencode",
  "githubcopilot",
  "openai",
  "claude",
  "claude-color",
  "anthropic",
  "gemini",
  "gemini-color",
  "perplexity",
  "perplexity-color",
  "notion",
  "figma",
  "figma-color",
  "mcp",
  "ollama",
  "lmstudio",
  "colab",
  "colab-color",
  "deepl",
  "deepl-color",
  "midjourney",
  "codex",
  "codex-color",
  "railway",
  "nanobanana",
  "nanobanana-color",
  "link-external",
]);

const FRAMEWORK_SLUGS = new Set([
  "react",
  "angular",
  "angularjs",
  "svelte",
  "vue",
  "nextjs",
  "django",
  "flask",
  "fastapi",
  "bootstrap",
  "tailwind",
  "streamlit",
]);

const LIBRARY_SLUGS = new Set([
  "numpy",
  "pandas",
  "scikit-learn",
  "sklearn",
  "tensorflow",
  "keras",
  "matplotlib",
  "threejs",
  "d3",
  "echarts",
  "redux",
  "selenium",
]);

function targetFolderFor(slug) {
  const s = canonicalizeSlug(slug);
  if (!s) return "technologies";
  if (TOOL_SLUGS.has(s)) return "tools";
  if (FRAMEWORK_SLUGS.has(s)) return "frameworks";
  if (LIBRARY_SLUGS.has(s)) return "libraries";
  return "technologies";
}

function listRootSvgs() {
  return fs
    .readdirSync(iconsRoot, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".svg"))
    .map((d) => d.name);
}

function ensureDirs() {
  for (const dir of TARGET_DIRS) fs.mkdirSync(path.join(iconsRoot, dir), { recursive: true });
}

ensureDirs();

const files = listRootSvgs();
let moved = 0;
for (const f of files) {
  const base = f.replace(/\.svg$/i, "");
  const rawSlug = toSlug(base);
  const can = canonicalizeSlug(rawSlug);
  if (!can) continue;
  const folder = targetFolderFor(can);
  const from = path.join(iconsRoot, f);
  const to = path.join(iconsRoot, folder, f);
  if (from === to) continue;
  if (fs.existsSync(to)) {
    // Keep existing destination; skip.
    continue;
  }
  fs.renameSync(from, to);
  moved++;
}

console.log(`Moved ${moved} icons into category folders.`);

