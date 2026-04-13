import { loadClientState, scheduleSaveClientState } from "@scripts/core/user-client-state";

export type StudySourceLite = {
  id: string;
  title: string;
  kind: "note" | "link" | "file" | "code";
  url?: string;
  fileName?: string;
  codeLanguage?: string;
};

export type DossierChunkRef = {
  sourceId: string;
  chunkIndex: number;
  excerpt: string;
};

export type Dossier = {
  id: string;
  title: string;
  query: string;
  scope: "context" | "all";
  createdAt: string;
  chunks: DossierChunkRef[];
};

const DOSSIERS_V1 = "skillatlas_study_dossiers_v1";
const DOSSIERS_V2 = "skillatlas_study_dossiers_v2";

let dossierSpaceId: string | null = null;

export function setStudyDossierSpaceContext(studySpaceId: string | null) {
  dossierSpaceId = studySpaceId;
}

function spaceKey(): string {
  return dossierSpaceId ?? "__guest__";
}

function filterDossiers(arr: unknown): Dossier[] {
  return Array.isArray(arr) ? (arr as Dossier[]).filter((d) => d && typeof d.id === "string") : [];
}

function readAllBySpace(): Record<string, Dossier[]> {
  try {
    const v2 = localStorage.getItem(DOSSIERS_V2);
    if (v2) {
      const p = JSON.parse(v2) as { bySpaceId?: Record<string, Dossier[]> };
      const m = p?.bySpaceId && typeof p.bySpaceId === "object" ? p.bySpaceId : {};
      const out: Record<string, Dossier[]> = {};
      for (const [k, v] of Object.entries(m)) {
        out[k] = filterDossiers(v);
      }
      return out;
    }
    const v1 = localStorage.getItem(DOSSIERS_V1);
    if (v1) {
      const arr = filterDossiers(JSON.parse(v1));
      return arr.length ? { __legacy__: arr } : {};
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeAllBySpace(by: Record<string, Dossier[]>) {
  localStorage.setItem(DOSSIERS_V2, JSON.stringify({ v: 2, bySpaceId: by }));
}

/** Sync read from browser cache (instant). */
export function loadDossiers(): Dossier[] {
  const all = readAllBySpace();
  return all[spaceKey()] ?? [];
}

type RemoteDossiers = { v?: number; dossiers?: Dossier[]; bySpaceId?: Record<string, Dossier[]> };

function normalizeRemote(remote: RemoteDossiers, fallbackKey: string): Record<string, Dossier[]> {
  if (remote.v === 2 && remote.bySpaceId && typeof remote.bySpaceId === "object") {
    const out: Record<string, Dossier[]> = {};
    for (const [k, v] of Object.entries(remote.bySpaceId)) {
      out[k] = filterDossiers(v);
    }
    return out;
  }
  const legacy = filterDossiers(remote.dossiers);
  return legacy.length ? { [fallbackKey]: legacy } : {};
}

/**
 * Tras iniciar sesión: fusiona remoto + local por espacio de estudio (`study_space_id`).
 */
export async function hydrateDossiersFromRemote(signedIn: boolean, studySpaceId: string | null): Promise<Dossier[]> {
  setStudyDossierSpaceContext(studySpaceId);
  const key = studySpaceId ?? "__guest__";
  const localAll = readAllBySpace();
  if (!signedIn) return localAll[key] ?? [];

  const remote = await loadClientState<RemoteDossiers>("study_dossiers", {});
  const fromRemote = normalizeRemote(remote, key);
  const merged: Record<string, Dossier[]> = { ...localAll };
  for (const [k, v] of Object.entries(fromRemote)) {
    if (v.length > 0) merged[k] = v;
  }
  for (const [k, v] of Object.entries(localAll)) {
    if (!merged[k]?.length && v.length > 0) merged[k] = v;
  }
  writeAllBySpace(merged);
  scheduleSaveClientState("study_dossiers", { v: 2, bySpaceId: merged });
  return merged[key] ?? [];
}

export function saveDossiers(d: Dossier[]) {
  const key = spaceKey();
  const all = readAllBySpace();
  all[key] = d;
  writeAllBySpace(all);
  scheduleSaveClientState("study_dossiers", { v: 2, bySpaceId: all });
}

export function dossierToMarkdown(d: Dossier, sources: StudySourceLite[]): string {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const lines: string[] = [];
  lines.push(`# ${d.title}`);
  lines.push("");
  lines.push(`- Query: ${d.query}`);
  lines.push(`- Scope: ${d.scope}`);
  lines.push(`- Created: ${d.createdAt}`);
  lines.push("");
  lines.push("## Evidence");
  lines.push("");
  d.chunks.forEach((c, i) => {
    const src = byId.get(c.sourceId);
    const label = `[${i + 1}]`;
    const title = src?.title ?? "Fuente";
    const meta =
      src?.kind === "link" && src.url
        ? src.url
        : src?.kind === "file" && src.fileName
          ? src.fileName
          : src?.kind === "code" && src.codeLanguage
            ? src.codeLanguage
            : src?.kind === "code"
              ? "code"
              : "";
    lines.push(`### ${label} ${title} (#${c.chunkIndex + 1})`);
    if (meta) lines.push(`- ${meta}`);
    lines.push("");
    lines.push(c.excerpt.trim());
    lines.push("");
  });
  return lines.join("\n").trim() + "\n";
}
