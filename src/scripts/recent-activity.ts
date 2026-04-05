/** Últimos proyectos/tecnologías abiertos en este navegador (localStorage). */

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

export function recordRecentActivity(entry: { kind: RecentActivityKind; slug: string; label: string }) {
  const slug = entry.slug.trim();
  const label = (entry.label.trim() || slug).slice(0, 200);
  if (!slug) return;
  const at = Date.now();
  let list = read().filter((e) => !(e.kind === entry.kind && e.slug === slug));
  list.unshift({ kind: entry.kind, slug, label, at });
  list = list.slice(0, MAX_STORED);
  write(list);
}

export function getRecentActivity(kind: RecentActivityKind, limit: number): RecentActivityEntry[] {
  return read()
    .filter((e) => e.kind === kind)
    .slice(0, Math.max(0, limit));
}
