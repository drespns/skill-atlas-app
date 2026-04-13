/**
 * Scans `public/icons/{technologies,frameworks,libraries,packages}` and writes
 * `generated-icons-catalog.ts` (slug, kind, label, icon path). Run via `npm run build`
 * (prebuild) or `node scripts/gen-tech-catalog.mjs`. Extra spellings / DB slugs belong in
 * `src/config/icons.ts` and catalog merge logic in `concept-seeds.ts`, not here.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const iconsRoot = path.join(root, "public", "icons");
const scanDirs = ["technologies", "frameworks", "libraries", "packages"];
const outFile = path.join(
  root,
  "src",
  "scripts",
  "technologies",
  "technology-detail",
  "generated-icons-catalog.ts",
);

function toSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalizeSlug(slug, filename = "") {
  const fileLower = String(filename || "").toLowerCase();
  // Supabase: wordmarks must not steal slug "supabase" (icon should).
  if (fileLower.includes("supabase") && fileLower.includes("wordmark")) {
    if (fileLower.includes("--dark")) return "supabase-wordmark-dark";
    if (fileLower.includes("--light")) return "supabase-wordmark-light";
    return "supabase-wordmark";
  }

  let s = toSlug(slug);
  if (s === "csharp" || s === "c-sharp") s = "c-csharp";

  // Remove common icon variants to avoid duplicates.
  s = s
    .replace(/(--dark|--light)$/, "")
    .replace(/-(dark|light)$/, "")
    .replace(/-(color|coloured|colored)$/, "")
    .replace(/-(logo|icon)$/, "")
    .replace(/-(logo-icon)$/, "")
    .replace(/-(logo-wordmark)$/, "")
    .replace(/-(wordmark)$/, "")
    .replace(/-+$/, "");

  // Known alias-like normalizations to match app slugs.
  if (s === "powerbi") s = "power-bi";
  if (s === "postgresql" || s === "postgressql") s = "postgres";
  if (s === "node-js") s = "node";
  if (s === "three-js") s = "threejs";
  if (s === "d3-js") s = "d3";
  if (s === "scikit-learn") s = "scikit-learn";
  if (s === "css3") s = "css";
  if (s === "html5") s = "html";
  if (s === "apache-hadoop") s = "hadoop";
  if (s === "apache-kafka") s = "kafka";
  if (s === "apache-spark") s = "spark";
  if (s === "apache-airflow") s = "airflow";
  if (s === "apache-superset") s = "superset";
  if (s === "supabase-logo") s = "supabase";

  return s;
}

function labelFromFilename(filename) {
  const base = filename.replace(/\.svg$/i, "");
  return base;
}

function safeReadIcons() {
  try {
    const out = [];
    for (const dir of scanDirs) {
      const full = path.join(iconsRoot, dir);
      if (!fs.existsSync(full)) continue;
      const files = fs
        .readdirSync(full)
        .filter((f) => f.toLowerCase().endsWith(".svg"))
        .map((f) => `${dir}/${f}`);
      out.push(...files);
    }
    return out.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

const files = safeReadIcons();
const IGNORE_SLUGS = new Set(["link-external", "mcp"]);

function scoreCandidate(rawLabel) {
  const low = String(rawLabel || "").toLowerCase();
  let score = 0;
  if (low.includes("color")) score += 4;
  if (low.includes("wordmark")) score += 4;
  if (low.includes("logo")) score += 2;
  score += Math.min(6, Math.floor(low.length / 20));
  return score;
}

function kindFromPath(relPath) {
  const dir = String(relPath || "").split("/")[0];
  if (dir === "frameworks") return "framework";
  if (dir === "libraries") return "library";
  if (dir === "packages") return "package";
  return "technology";
}

const chosen = new Map();
for (const f of files) {
  const filename = f.split("/").pop() || f;
  const label = labelFromFilename(filename);
  const rawSlug = toSlug(label);
  const slug = canonicalizeSlug(rawSlug, filename);
  if (!slug || IGNORE_SLUGS.has(slug)) continue;
  const prev = chosen.get(slug);
  const cur = { slug, label, kind: kindFromPath(f), iconPath: `/icons/${f}` };
  if (!prev) {
    chosen.set(slug, cur);
    continue;
  }
  // Prefer "cleaner" names (no -color/wordmark) when duplicates exist.
  const prevScore = scoreCandidate(prev.label);
  const curScore = scoreCandidate(cur.label);
  if (curScore < prevScore) chosen.set(slug, cur);
}

const entries = Array.from(chosen.values()).sort((a, b) => a.label.localeCompare(b.label));

const content = `// AUTO-GENERATED. Do not edit by hand.
// Source: public/icons/{technologies,frameworks,libraries,packages}/*.svg

export type GeneratedIconCatalogEntry = { slug: string; label: string; kind: "technology" | "framework" | "library" | "package"; iconPath: string };

export const GENERATED_ICON_CATALOG: GeneratedIconCatalogEntry[] = ${JSON.stringify(entries, null, 2)};
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content, "utf8");

console.log(`Generated ${entries.length} entries -> ${path.relative(root, outFile)}`);

