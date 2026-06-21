import {
  EXPENSE_TRACKER_CLIENT_SCOPE,
  isExpenseEncryptedEnvelope,
  mergeExpenseTrackerRemoteLocal,
  normalizeExpenseTrackerState,
  openExpenseEnvelope,
  sealExpenseState,
  type ExpenseTrackerState,
} from "@skill-atlas/expense-core";
import { getSupabase } from "./supabase";
import { loadExpenseLocal, saveExpenseLocal } from "./expense-storage";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "locked" | "error";

let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchRemoteRaw(): Promise<unknown> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) return {};
  const res = await supabase
    .from("user_client_state")
    .select("data")
    .eq("user_id", userId)
    .eq("scope", EXPENSE_TRACKER_CLIENT_SCOPE)
    .maybeSingle();
  return (res.data as { data?: unknown } | null)?.data ?? {};
}

async function pushRemote(payload: unknown): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) return false;
  const { error } = await supabase.from("user_client_state").upsert(
    { user_id: userId, scope: EXPENSE_TRACKER_CLIENT_SCOPE, data: payload },
    { onConflict: "user_id,scope" },
  );
  return !error;
}

export async function hydrateExpenseState(e2ePassphrase: string | null): Promise<{
  state: ExpenseTrackerState;
  status: SyncStatus;
  needsUnlock: boolean;
}> {
  const local = await loadExpenseLocal();
  let remoteRaw: unknown;
  try {
    remoteRaw = await fetchRemoteRaw();
  } catch {
    return { state: local, status: "offline", needsUnlock: false };
  }

  if (isExpenseEncryptedEnvelope(remoteRaw)) {
    if (!e2ePassphrase) {
      return { state: local, status: "locked", needsUnlock: true };
    }
    try {
      const json = await openExpenseEnvelope(remoteRaw, e2ePassphrase);
      const remote = normalizeExpenseTrackerState(JSON.parse(json));
      const merged = mergeExpenseTrackerRemoteLocal(remote, local);
      await saveExpenseLocal(merged);
      return { state: merged, status: "synced", needsUnlock: false };
    } catch {
      return { state: local, status: "error", needsUnlock: true };
    }
  }

  const remote = normalizeExpenseTrackerState(remoteRaw);
  const merged = mergeExpenseTrackerRemoteLocal(remote, local);
  await saveExpenseLocal(merged);
  return { state: merged, status: "synced", needsUnlock: false };
}

export function scheduleExpenseCloudSave(
  state: ExpenseTrackerState,
  e2ePassphrase: string | null,
  onStatus: (s: SyncStatus) => void,
  delayMs = 600,
) {
  if (!state.syncToAccount) {
    onStatus("idle");
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  onStatus("syncing");
  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        let payload: unknown = state;
        if (state.cloudE2E) {
          if (!e2ePassphrase) {
            onStatus("locked");
            return;
          }
          payload = await sealExpenseState(state, e2ePassphrase);
        }
        const ok = await pushRemote(payload);
        onStatus(ok ? "synced" : "error");
      } catch {
        onStatus("offline");
      }
    })();
  }, delayMs);
}

export async function persistExpenseState(
  state: ExpenseTrackerState,
  e2ePassphrase: string | null,
  onStatus: (s: SyncStatus) => void,
): Promise<void> {
  await saveExpenseLocal(state);
  scheduleExpenseCloudSave(state, e2ePassphrase, onStatus, 0);
}
