/**
 * Solo servidor (API route): obtiene la primera og:image o twitter:image de una URL pública.
 * Mitiga SSRF con lista de hostnames bloqueados.
 */

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal" || h.endsWith(".internal")) return true;
  if (h === "0.0.0.0") return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(v4);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h.includes(":")) {
    const x = h.replace(/^\[|\]$/g, "");
    if (x === "::1" || x.startsWith("fe80:") || x.startsWith("fc") || x.startsWith("fd")) return true;
  }
  return false;
}

function extractMetaImage(html: string): string | null {
  const chunk = html.length > 600_000 ? html.slice(0, 600_000) : html;
  const og =
    chunk.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
    chunk.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (og?.[1]) return decodeBasicEntities(og[1].trim());
  const tw =
    chunk.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ??
    chunk.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
  if (tw?.[1]) return decodeBasicEntities(tw[1].trim());
  return null;
}

function absolutizeImageUrl(pageUrl: string, raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    if (t.startsWith("//")) return new URL(`https:${t}`).href;
    const u = new URL(t, pageUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (isBlockedHostname(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

export async function fetchOpenGraphImageUrl(targetUrl: string): Promise<string | null> {
  let page: URL;
  try {
    page = new URL(targetUrl.trim());
  } catch {
    return null;
  }
  if (page.protocol !== "https:" && page.protocol !== "http:") return null;
  if (isBlockedHostname(page.hostname)) return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(page.href, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "SkillAtlasEvidenceThumb/1.0 (portfolio preview)",
      },
    });
  } catch {
    clearTimeout(t);
    return null;
  }
  clearTimeout(t);

  if (!res.ok || !res.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    return null;
  }

  const html = await res.text().catch(() => "");
  const rel = extractMetaImage(html);
  if (!rel) return null;
  return absolutizeImageUrl(page.href, rel);
}
