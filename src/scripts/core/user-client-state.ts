import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";

export type ClientStateScope =
  | "fab_calendar"
  | "tools_habits"
  | "study_workspace"
  | "study_dossiers"
  | "study_prefs"
  | "study_curriculum"
  | "recent_activity";

type Row = { user_id: string; scope: string; data: any; updated_at?: string };

export async function loadClientState<T>(scope: ClientStateScope, fallback: T): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return fallback;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return fallback;
    const res = await supabase.from("user_client_state").select("data").eq("user_id", userId).eq("scope", scope).maybeSingle();
    const d = (res as any)?.data?.data;
    return d && typeof d === "object" ? (d as T) : fallback;
  } catch {
    return fallback;
  }
}

let saveTimers = new Map<string, number>();

export function scheduleSaveClientState(scope: ClientStateScope, data: unknown, delayMs = 450) {
  const key = scope;
  const prev = saveTimers.get(key);
  if (prev) window.clearTimeout(prev);
  const t = window.setTimeout(() => void saveClientState(scope, data), delayMs);
  saveTimers.set(key, t);
}

export async function saveClientState(scope: ClientStateScope, data: unknown): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id;
    if (!userId) return false;
    const row: Row = { user_id: userId, scope, data };
    const { error } = await supabase.from("user_client_state").upsert(row, { onConflict: "user_id,scope" });
    return !error;
  } catch {
    return false;
  }
}

