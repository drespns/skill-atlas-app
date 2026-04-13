import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;

function ensurePdfWorker() {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  workerConfigured = true;
}

type TextPiece = { str: string; x: number; y: number };

function collectTextPieces(items: unknown[]): TextPiece[] {
  const out: TextPiece[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const ti = item as { str?: string; transform?: number[] };
    const s = typeof ti.str === "string" ? ti.str : "";
    if (!s) continue;
    const tr = ti.transform;
    if (!Array.isArray(tr) || tr.length < 6) continue;
    const x = tr[4]!;
    const y = tr[5]!;
    out.push({ str: s, x, y });
  }
  return out;
}

/**
 * Agrupa fragmentos en líneas leyendo de arriba abajo (coords PDF: y crece hacia arriba).
 * Tolerancia en Y para compensar fuentes de distinto tamaño en la misma línea visual.
 */
function piecesToLines(pieces: TextPiece[], yTolerance = 3): string[] {
  if (pieces.length === 0) return [];
  const sorted = [...pieces].sort((a, b) => {
    if (Math.abs(a.y - b.y) > yTolerance) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: string[] = [];
  let bucket: TextPiece[] = [];
  let bucketY = sorted[0]!.y;

  const flushBucket = () => {
    if (bucket.length === 0) return;
    bucket.sort((a, b) => a.x - b.x);
    let line = "";
    for (const p of bucket) {
      const needsSpace = line.length > 0 && !/\s$/.test(line) && !/^\s/.test(p.str);
      line += (needsSpace ? " " : "") + p.str;
    }
    const cleaned = line.replace(/\u00ad/g, "").replace(/[ \t]+/g, " ").trim();
    if (cleaned) lines.push(cleaned);
    bucket = [];
  };

  for (const p of sorted) {
    if (bucket.length === 0) {
      bucketY = p.y;
      bucket.push(p);
      continue;
    }
    if (Math.abs(p.y - bucketY) <= yTolerance) {
      bucket.push(p);
    } else {
      flushBucket();
      bucketY = p.y;
      bucket.push(p);
    }
  }
  flushBucket();
  return lines;
}

/** Extrae texto plano de un PDF en el navegador (para importación heurística). */
export async function extractTextFromPdfFile(file: File): Promise<string> {
  ensurePdfWorker();
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const pieces = collectTextPieces(tc.items as unknown[]);
    const lines = piecesToLines(pieces);
    if (lines.length > 0) pageTexts.push(lines.join("\n"));
  }
  return pageTexts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
