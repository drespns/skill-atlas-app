import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const iconsDir = path.join(root, "public", "icons");
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

function labelFromFilename(filename) {
  const base = filename.replace(/\.svg$/i, "");
  return base;
}

function safeReadIcons() {
  try {
    return fs
      .readdirSync(iconsDir)
      .filter((f) => f.toLowerCase().endsWith(".svg"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

const files = safeReadIcons();
const entries = files.map((f) => {
  const label = labelFromFilename(f);
  const slug = toSlug(label);
  return { slug, label };
});

const content = `// AUTO-GENERATED. Do not edit by hand.
// Source: public/icons/*.svg

export type GeneratedIconCatalogEntry = { slug: string; label: string };

export const GENERATED_ICON_CATALOG: GeneratedIconCatalogEntry[] = ${JSON.stringify(entries, null, 2)};
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content, "utf8");

console.log(`Generated ${entries.length} entries -> ${path.relative(root, outFile)}`);

