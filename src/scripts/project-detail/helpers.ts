export async function getProjectDbId(supabase: any, projectSlug: string) {
  const projectRes = await supabase.from("projects").select("id").eq("slug", projectSlug).maybeSingle();
  const row = projectRes.data as { id: string } | null;
  if (projectRes.error || !row) return null;
  return row.id;
}

export async function getTechnologyDbId(supabase: any, technologySlug: string) {
  const res = await supabase
    .from("technologies")
    .select("id")
    .eq("slug", technologySlug)
    .maybeSingle();
  const row = res.data as { id: string } | null;
  if (res.error || !row) return null;
  return row.id;
}
