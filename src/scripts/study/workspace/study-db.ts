import { loadWorkspaceState, studyWorkspaceStorageKey } from "./local-state";
import type { Source, State, SupabaseLike } from "./types";

export function toDbSource(s: Source, userId: string, studySpaceId: string) {
  return {
    id: s.id,
    user_id: userId,
    study_space_id: studySpaceId,
    title: s.title,
    kind: s.kind,
    url: s.url ?? null,
    body: s.body ?? null,
    code_language: s.kind === "code" ? (s.codeLanguage ?? "").trim() || null : null,
    file_path: s.filePath ?? null,
    file_name: s.fileName ?? null,
    file_mime: s.fileMime ?? null,
    file_size: typeof s.fileSize === "number" ? s.fileSize : null,
    created_at: s.createdAt,
  };
}

export function fromDbSource(row: any): Source | null {
  const id = String(row?.id ?? "").trim();
  const title = String(row?.title ?? "").trim();
  const kind = String(row?.kind ?? "").trim() as Source["kind"];
  if (!id || !title || (kind !== "note" && kind !== "link" && kind !== "file" && kind !== "code")) return null;
  const url = typeof row?.url === "string" ? row.url : undefined;
  const body = typeof row?.body === "string" ? row.body : undefined;
  const codeLanguage = typeof row?.code_language === "string" ? row.code_language.trim() : "";
  const filePath = typeof row?.file_path === "string" ? row.file_path : undefined;
  const fileName = typeof row?.file_name === "string" ? row.file_name : undefined;
  const fileMime = typeof row?.file_mime === "string" ? row.file_mime : undefined;
  const fileSize = typeof row?.file_size === "number" ? row.file_size : Number(row?.file_size);
  const createdAt = String(row?.created_at ?? row?.createdAt ?? new Date().toISOString());
  return {
    id,
    title,
    kind,
    url: url || undefined,
    body: body || undefined,
    codeLanguage: kind === "code" && codeLanguage ? codeLanguage : undefined,
    filePath: filePath || undefined,
    fileName: fileName || undefined,
    fileMime: fileMime || undefined,
    fileSize: Number.isFinite(fileSize) ? fileSize : undefined,
    createdAt,
  };
}

export async function loadFromSupabase(sb: SupabaseLike, userId: string, studySpaceId: string): Promise<State | null> {
  try {
    let wsRes = await sb
      .from("study_workspaces")
      .select("active_ids, session_notes, linked_project_id")
      .eq("study_space_id", studySpaceId)
      .maybeSingle();
    if (wsRes.error && String(wsRes.error.code ?? "") !== "PGRST116") {
      wsRes = await sb
        .from("study_workspaces")
        .select("active_ids, session_notes")
        .eq("study_space_id", studySpaceId)
        .maybeSingle();
    }
    const [srcRes, techLinkRes] = await Promise.all([
      sb
        .from("study_sources")
        .select("id,title,kind,url,body,code_language,file_path,file_name,file_mime,file_size,created_at")
        .eq("user_id", userId)
        .eq("study_space_id", studySpaceId)
        .order("created_at", { ascending: false }),
      sb.from("study_space_technologies").select("technology_id").eq("study_space_id", studySpaceId),
    ]);
    if (wsRes.error && String(wsRes.error.code ?? "") !== "PGRST116") return null;
    if (srcRes.error) return null;
    const ws = wsRes.data ?? null;
    const activeIds = Array.isArray(ws?.active_ids) ? ws.active_ids.filter((x: any) => typeof x === "string") : [];
    const sessionNotes = typeof ws?.session_notes === "string" ? ws.session_notes : "";
    const lpRaw = (ws as any)?.linked_project_id;
    const linkedProjectId = typeof lpRaw === "string" && lpRaw.trim() ? lpRaw.trim() : null;
    const linkedTechnologyIds = techLinkRes.error
      ? []
      : (techLinkRes.data ?? []).map((r: any) => r.technology_id).filter((x: unknown) => typeof x === "string");
    const sources = (srcRes.data ?? []).map(fromDbSource).filter(Boolean) as Source[];
    return { sources, activeIds, sessionNotes, linkedProjectId, linkedTechnologyIds, sourceFolderById: {}, customStudyFolders: [] };
  } catch {
    return null;
  }
}

export async function upsertWorkspace(sb: SupabaseLike, studySpaceId: string, state: State) {
  await sb
    .from("study_workspaces")
    .upsert(
      [
        {
          study_space_id: studySpaceId,
          active_ids: state.activeIds,
          session_notes: state.sessionNotes,
          linked_project_id: state.linkedProjectId,
        },
      ] as any,
      { onConflict: "study_space_id" },
    );
}

export async function replaceStudySpaceTechnologies(sb: SupabaseLike, studySpaceId: string, technologyIds: string[]) {
  try {
    await sb.from("study_space_technologies").delete().eq("study_space_id", studySpaceId);
    const uq = [...new Set(technologyIds.filter(Boolean))];
    if (uq.length === 0) return;
    await sb
      .from("study_space_technologies")
      .insert(uq.map((technology_id) => ({ study_space_id: studySpaceId, technology_id })) as any);
  } catch {
    /* tabla no aplicada */
  }
}

export async function upsertSource(sb: SupabaseLike, userId: string, studySpaceId: string, s: Source) {
  await sb.from("study_sources").upsert([toDbSource(s, userId, studySpaceId)] as any, { onConflict: "id" });
}

export async function deleteSource(sb: SupabaseLike, userId: string, studySpaceId: string, id: string) {
  await sb.from("study_sources").delete().eq("user_id", userId).eq("study_space_id", studySpaceId).eq("id", id);
}

export async function maybeMigrateLocalToSupabase(sb: SupabaseLike, userId: string, studySpaceId: string) {
  try {
    const existing = await sb
      .from("study_sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("study_space_id", studySpaceId);
    if ((existing.count ?? 0) > 0) return;
  } catch {
    return;
  }
  const local = loadWorkspaceState(studyWorkspaceStorageKey(studySpaceId));
  if (local.sources.length === 0 && local.sessionNotes.trim() === "" && local.activeIds.length === 0) return;
  try {
    for (const s of local.sources) await upsertSource(sb, userId, studySpaceId, s);
    await upsertWorkspace(sb, studySpaceId, local);
  } catch {
    /* ignore */
  }
}
