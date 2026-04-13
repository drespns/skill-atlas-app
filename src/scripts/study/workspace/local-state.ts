import type { State } from "./types";

const STORAGE_PREFIX = "skillatlas_study_workspace_v1";

export function studyWorkspaceStorageKey(spaceId: string | null): string {
  return spaceId ? `${STORAGE_PREFIX}:${spaceId}` : STORAGE_PREFIX;
}

export function normalizeState(p: Partial<State> | null | undefined): State {
  const sources = Array.isArray(p?.sources) ? p!.sources! : [];
  const activeIds = Array.isArray(p?.activeIds) ? p!.activeIds!.filter((x) => typeof x === "string") : [];
  const sessionNotes = typeof p?.sessionNotes === "string" ? p.sessionNotes : "";
  const lp = p?.linkedProjectId;
  const linkedProjectId = typeof lp === "string" && lp.trim() ? lp.trim() : null;
  const lt = p?.linkedTechnologyIds;
  const linkedTechnologyIds = Array.isArray(lt) ? lt.filter((x) => typeof x === "string") : [];
  const fc = p?.focusedCodeSourceId;
  const focusedCodeSourceId = typeof fc === "string" && fc.trim() ? fc.trim() : null;
  const sf = p?.sourceFolderById;
  const sourceFolderById: Record<string, string> =
    sf && typeof sf === "object" && !Array.isArray(sf)
      ? Object.fromEntries(
          Object.entries(sf as Record<string, unknown>).filter(
            ([k, v]) => typeof k === "string" && typeof v === "string",
          ) as [string, string][],
        )
      : {};
  const cfRaw = p?.customStudyFolders;
  const customStudyFolders: Array<{ id: string; label: string }> = Array.isArray(cfRaw)
    ? cfRaw
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const o = x as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id.trim() : "";
          const label = typeof o.label === "string" ? o.label.trim() : "";
          if (!id || !label) return null;
          return { id, label };
        })
        .filter((x): x is { id: string; label: string } => Boolean(x))
    : [];
  const seen = new Set<string>();
  const uniqFolders = customStudyFolders.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  return {
    sources,
    activeIds,
    sessionNotes,
    linkedProjectId,
    linkedTechnologyIds,
    focusedCodeSourceId,
    sourceFolderById,
    customStudyFolders: uniqFolders,
  };
}

export function loadWorkspaceState(storageKey: string): State {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return normalizeState(null);
    const p = JSON.parse(raw) as Partial<State>;
    return normalizeState(p);
  } catch {
    return normalizeState(null);
  }
}

export function saveWorkspaceState(storageKey: string, s: State) {
  localStorage.setItem(storageKey, JSON.stringify(s));
}
