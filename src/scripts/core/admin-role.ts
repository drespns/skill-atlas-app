import type { SupabaseClient } from "@supabase/supabase-js";

const mem = new Map<string, boolean>();

export async function isSkillAtlasAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const key = `v1:${userId}`;
  if (mem.has(key)) return mem.get(key)!;

  try {
    const raw = sessionStorage.getItem(`skillatlas_is_admin:${userId}`);
    if (raw === "1") {
      mem.set(key, true);
      return true;
    }
    if (raw === "0") {
      mem.set(key, false);
      return false;
    }
  } catch {
    // ignore
  }

  const res = await supabase.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  const ok = Boolean(res.data?.user_id);
  mem.set(key, ok);
  try {
    sessionStorage.setItem(`skillatlas_is_admin:${userId}`, ok ? "1" : "0");
  } catch {
    // ignore
  }
  return ok;
}
