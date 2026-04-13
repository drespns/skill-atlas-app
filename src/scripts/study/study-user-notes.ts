/** CRUD para `study_user_notes` (fase /study: notas persistentes). */

export type StudyUserNoteRow = {
  id: string;
  title: string;
  body: string;
  /** Null/empty = nota en texto plano; valor = etiqueta de lenguaje (p. ej. typescript). */
  code_language: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export function isStudyUserNotesMissingTable(err: unknown): boolean {
  const code = String((err as { code?: string })?.code ?? "");
  const msg = String((err as { message?: string })?.message ?? "");
  if (code === "42P01" || /relation.*does not exist/i.test(msg)) return true;
  if (/study_user_notes/i.test(msg) && /does not exist/i.test(msg)) return true;
  return false;
}

export async function fetchStudyUserNotes(
  sb: { from: (t: string) => any },
  userId: string,
  studySpaceId: string,
): Promise<StudyUserNoteRow[]> {
  let res = await sb
    .from("study_user_notes")
    .select("id,title,body,code_language,sort_order,created_at,updated_at")
    .eq("user_id", userId)
    .eq("study_space_id", studySpaceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const errMsg = String((res as { error?: { message?: string } })?.error?.message ?? "");
  if (res.error && /code_language|PGRST204|schema cache/i.test(errMsg)) {
    res = await sb
      .from("study_user_notes")
      .select("id,title,body,sort_order,created_at,updated_at")
      .eq("user_id", userId)
      .eq("study_space_id", studySpaceId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
  }
  if (res.error) throw res.error;
  return ((res.data ?? []) as any[]).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    code_language: typeof r.code_language === "string" && r.code_language.trim() ? r.code_language.trim() : null,
    sort_order: Number(r.sort_order ?? 0),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function insertStudyUserNote(
  sb: { from: (t: string) => any },
  userId: string,
  studySpaceId: string,
  patch: { title?: string; body?: string; sort_order?: number; code_language?: string | null },
): Promise<StudyUserNoteRow> {
  const row: Record<string, unknown> = {
    user_id: userId,
    study_space_id: studySpaceId,
    title: patch.title ?? "",
    body: patch.body ?? "",
    sort_order: typeof patch.sort_order === "number" ? patch.sort_order : 0,
  };
  if (patch.code_language !== undefined) {
    row.code_language = patch.code_language && String(patch.code_language).trim() ? String(patch.code_language).trim() : null;
  }
  const res = await sb.from("study_user_notes").insert(row as any).select("id,title,body,code_language,sort_order,created_at,updated_at").single();
  if (res.error) throw res.error;
  const r = res.data as any;
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    code_language: typeof r.code_language === "string" && r.code_language.trim() ? r.code_language.trim() : null,
    sort_order: Number(r.sort_order ?? 0),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function updateStudyUserNote(
  sb: { from: (t: string) => any },
  userId: string,
  studySpaceId: string,
  id: string,
  patch: { title?: string; body?: string; sort_order?: number; code_language?: string | null },
): Promise<void> {
  const upd: Record<string, unknown> = {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
  };
  if (patch.code_language !== undefined) {
    upd.code_language = patch.code_language && String(patch.code_language).trim() ? String(patch.code_language).trim() : null;
  }
  const res = await sb
    .from("study_user_notes")
    .update(upd as any)
    .eq("user_id", userId)
    .eq("study_space_id", studySpaceId)
    .eq("id", id);
  if (res.error) throw res.error;
}

export async function deleteStudyUserNote(
  sb: { from: (t: string) => any },
  userId: string,
  studySpaceId: string,
  id: string,
): Promise<void> {
  const res = await sb.from("study_user_notes").delete().eq("user_id", userId).eq("study_space_id", studySpaceId).eq("id", id);
  if (res.error) throw res.error;
}
