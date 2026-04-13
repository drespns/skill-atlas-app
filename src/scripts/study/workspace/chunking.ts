import type { Source, StudyChunkRow, SupabaseLike } from "./types";

function normalizeChunkText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(body: string): string[] {
  const normalized = normalizeChunkText(body);
  if (!normalized) return [];

  const maxChars = 1200;
  const overlap = 180;
  const hardCapChunks = 240;

  const paras = normalized
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let cur = "";

  for (const p of paras) {
    const next = cur ? cur + "\n\n" + p : p;
    if (next.length <= maxChars) {
      cur = next;
      continue;
    }

    if (cur.trim()) chunks.push(cur.trim());
    cur = p;

    while (cur.length > maxChars) {
      const slice = cur.slice(0, maxChars);
      const cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "), slice.lastIndexOf("\n"));
      const end = cut > 300 ? cut + 1 : maxChars;
      const part = cur.slice(0, end).trim();
      if (part) chunks.push(part);
      const back = part.slice(Math.max(0, part.length - overlap));
      cur = (back + " " + cur.slice(end)).trim();
      if (chunks.length >= hardCapChunks) return chunks.slice(0, hardCapChunks);
    }

    if (chunks.length >= hardCapChunks) return chunks.slice(0, hardCapChunks);
  }

  if (cur.trim()) chunks.push(cur.trim());
  return chunks.slice(0, hardCapChunks);
}

export function chunkCodeText(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const maxLines = 48;
  const out: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    cur.push(line);
    if (cur.length >= maxLines) {
      out.push(cur.join("\n"));
      cur = [];
      if (out.length >= 120) return out;
    }
  }
  if (cur.length) out.push(cur.join("\n"));
  return out.slice(0, 120);
}

export async function replaceChunksForSource(
  sb: SupabaseLike,
  userId: string,
  studySpaceId: string,
  sourceId: string,
  body?: string,
  sourceKind?: Source["kind"],
) {
  const chunks =
    typeof body === "string" ? (sourceKind === "code" ? chunkCodeText(body) : chunkText(body)) : [];
  try {
    await sb.from("study_chunks").delete().eq("user_id", userId).eq("source_id", sourceId);
    if (chunks.length === 0) return;

    const rows: StudyChunkRow[] = chunks.map((c, idx) => ({
      user_id: userId,
      study_space_id: studySpaceId,
      source_id: sourceId,
      chunk_index: idx,
      body: c,
    }));
    await sb.from("study_chunks").insert(rows as any);
  } catch {
    /* schema o columna study_space_id no aplicada */
  }
}
