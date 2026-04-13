export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function tokensFromQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9_áéíóúüñ]+/i)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3)
    .slice(0, 8);
}

export function highlightHtml(text: string, q: string): string {
  const tks = tokensFromQuery(q);
  let out = esc(text);
  for (const tk of tks) {
    const re = new RegExp(`(${tk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    out = out.replace(re, '<mark class="bg-amber-200/60 dark:bg-amber-400/20 rounded px-0.5">$1</mark>');
  }
  return out;
}

export function bestSnippet(text: string, q: string, maxLen: number): string {
  const raw = String(text || "");
  if (!raw) return "";
  const tks = tokensFromQuery(q);
  if (tks.length === 0) return raw.slice(0, maxLen);
  const low = raw.toLowerCase();
  let pos = -1;
  for (const tk of tks) {
    const p = low.indexOf(tk.toLowerCase());
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  if (pos < 0) return raw.slice(0, maxLen);
  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, pos - half);
  const end = Math.min(raw.length, start + maxLen);
  const s = raw.slice(start, end);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < raw.length ? "…" : "";
  return prefix + s + suffix;
}

