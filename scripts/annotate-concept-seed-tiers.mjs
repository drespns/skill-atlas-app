/**
 * Inserta `<!-- skillatlas-tier: … -->` antes de cada bloque `##` en los seeds.
 * Omite ficheros que ya contienen `skillatlas-tier` (p. ej. python.md curado).
 * Reparto por cuartiles del índice de sección: iniciacion → junior → mid → senior.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, "../public/static/concept-seeds");
const TIERS = ["iniciacion", "junior", "mid", "senior"];

function tierForSection(sectionIndex, totalHeadings) {
  if (totalHeadings <= 0) return "mid";
  const idx = Math.min(3, Math.floor((sectionIndex * 4) / totalHeadings));
  return TIERS[idx];
}

function annotateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (raw.includes("skillatlas-tier")) {
    return { skipped: true, reason: "already has tier markers" };
  }
  const lines = raw.split(/\r?\n/);
  const headingIdx = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) headingIdx.push(i);
  }
  if (headingIdx.length === 0) return { skipped: true, reason: "no ## headings" };
  const n = headingIdx.length;
  const out = [];
  let lastTier = null;
  let hi = 0;
  for (let i = 0; i < lines.length; i++) {
    if (hi < headingIdx.length && headingIdx[hi] === i) {
      const tier = tierForSection(hi, n);
      if (tier !== lastTier) {
        out.push(`<!-- skillatlas-tier: ${tier} -->`);
        lastTier = tier;
      }
      hi++;
    }
    out.push(lines[i]);
  }
  fs.writeFileSync(filePath, out.join("\n").replace(/\n+$/, "\n"), "utf8");
  return { skipped: false, headings: n };
}

const files = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith(".md")).sort();
for (const f of files) {
  const r = annotateFile(path.join(SEED_DIR, f));
  console.log(f, r);
}
