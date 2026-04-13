/** Últimos proyectos/tecnologías abiertos (localStorage + `user_client_state` scope `recent_activity`). */

import { loadClientState, scheduleSaveClientState } from "@scripts/core/user-client-state";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";

export const RECENT_ACTIVITY_KEY = "skillatlas_recent_activity_v1";

const MAX_STORED = 32;

export type RecentActivityKind = "project" | "tech";

export type RecentActivityEntry = {
  kind: RecentActivityKind;
  slug: string;
  label: string;
  at: number;
};

function read(): RecentActivityEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_ACTIVITY_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((x: unknown): x is RecentActivityEntry => {
      if (!x || typeof x !== "object") return false;
      const o = x as Record<string, unknown>;
      const k = o.kind;
      return (
        (k === "project" || k === "tech") &&
        typeof o.slug === "string" &&
        typeof o.label === "string" &&
        typeof o.at === "number"
      );
    });
  } catch {
    return [];
  }
}

function write(entries: RecentActivityEntry[]) {
  try {
    localStorage.setItem(RECENT_ACTIVITY_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota / private mode
  }
}

function mergeEntryLists(a: RecentActivityEntry[], b: RecentActivityEntry[]): RecentActivityEntry[] {
  const map = new Map<string, RecentActivityEntry>();
  for (const e of [...a, ...b]) {
    if (!e || (e.kind !== "project" && e.kind !== "tech")) continue;
    const slug = String(e.slug ?? "").trim();
    if (!slug) continue;
    const label = (String(e.label ?? "").trim() || slug).slice(0, 200);
    const at = typeof e.at === "number" && Number.isFinite(e.at) ? e.at : 0;
    const key = `${e.kind}:${slug}`;
    const prev = map.get(key);
    if (!prev || at > prev.at) map.set(key, { kind: e.kind, slug, label, at });
  }
  return [...map.values()].sort((x, y) => y.at - x.at).slice(0, MAX_STORED);
}

/** Tras iniciar sesión: fusiona remoto + local y persiste el unión en ambos sitios. */
export async function syncRecentActivityWithRemote(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return;

  const remote = await loadClientState<{ entries?: RecentActivityEntry[] }>("recent_activity", { entries: [] });
  const remoteList = Array.isArray(remote.entries)
    ? remote.entries.filter((e): e is RecentActivityEntry => {
        if (!e || typeof e !== "object") return false;
        const o = e as Record<string, unknown>;
        return (
          (o.kind === "project" || o.kind === "tech") &&
          typeof o.slug === "string" &&
          typeof o.label === "string" &&
          typeof o.at === "number"
        );
      })
    : [];
  const local = read();
  const merged = mergeEntryLists(local, remoteList);
  write(merged);
  scheduleSaveClientState("recent_activity", { entries: merged });
}

export function recordRecentActivity(entry: { kind: RecentActivityKind; slug: string; label: string }) {
  const slug = entry.slug.trim();
  const label = (entry.label.trim() || slug).slice(0, 200);
  if (!slug) return;
  const at = Date.now();
  let list = read().filter((e) => !(e.kind === entry.kind && e.slug === slug));
  list.unshift({ kind: entry.kind, slug, label, at });
  list = list.slice(0, MAX_STORED);
  write(list);
  scheduleSaveClientState("recent_activity", { entries: list });
}

export function getRecentActivity(kind: RecentActivityKind, limit: number): RecentActivityEntry[] {
  return read()
    .filter((e) => e.kind === kind)
    .slice(0, Math.max(0, limit));
}
