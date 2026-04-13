import type { SupabaseLike } from "./types";

export type StudySpaceRow = { id: string; title: string; sort_order: number };

export async function fetchStudySpaces(sb: SupabaseLike, userId: string): Promise<StudySpaceRow[]> {
  try {
    const res = await sb
      .from("study_spaces")
      .select("id,title,sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (res.error) return [];
    return ((res.data ?? []) as any[]).map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      sort_order: Number(r.sort_order ?? 0),
    }));
  } catch {
    return [];
  }
}

/** Crea espacio + fila de workspace vacía. */
export async function insertStudySpace(sb: SupabaseLike, userId: string, title: string): Promise<string | null> {
  try {
    const ins = await sb
      .from("study_spaces")
      .insert({ user_id: userId, title: title.trim(), sort_order: 999 })
      .select("id")
      .single();
    if (ins.error || !ins.data?.id) return null;
    const id = String(ins.data.id);
    await sb.from("study_workspaces").insert({
      study_space_id: id,
      active_ids: [],
      session_notes: "",
      linked_project_id: null,
    } as any);
    return id;
  } catch {
    return null;
  }
}

export async function updateStudySpaceTitle(sb: SupabaseLike, userId: string, spaceId: string, title: string): Promise<boolean> {
  try {
    const res = await sb
      .from("study_spaces")
      .update({ title: title.trim() })
      .eq("id", spaceId)
      .eq("user_id", userId);
    return !res.error;
  } catch {
    return false;
  }
}

/** Garantiza al menos un espacio (y workspace) para el usuario. */
export async function ensureDefaultStudySpace(sb: SupabaseLike, userId: string): Promise<string | null> {
  const list = await fetchStudySpaces(sb, userId);
  if (list.length > 0) return list[0]!.id;
  return insertStudySpace(sb, userId, "");
}
