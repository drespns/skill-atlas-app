import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;

function ensurePdfWorker() {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  workerConfigured = true;
}

/** Extrae texto plano de un PDF en el navegador (para importación heurística). */
export async function extractTextFromPdfFile(file: File): Promise<string> {
  ensurePdfWorker();
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const line = tc.items
      .map((item) => {
        if (item && typeof item === "object" && "str" in item && typeof (item as { str: string }).str === "string") {
          return (item as { str: string }).str;
        }
        return "";
      })
      .join(" ");
    parts.push(line);
  }
  return parts.join("\n\n").replace(/\s+\n/g, "\n").trim();
}
