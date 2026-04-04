import type { APIRoute } from "astro";
import { supabaseAnonRpc } from "../../lib/server-supabase-rpc";

export const prerender = false;

type RpcProject = { title?: string; technologyNames?: string[] };
type RpcPayload = { displayName?: string; bio?: string; projects?: RpcProject[] } | null;

function safeText(raw: unknown, fallback = ""): string {
  return typeof raw === "string" ? raw.trim() : fallback;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function topTechs(projects: RpcProject[]): string[] {
  const counts = new Map<string, number>();
  for (const p of projects) {
    for (const t of p.technologyNames ?? []) {
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, 3)
    .map(([k]) => k);
}

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug")?.trim() ?? "";
  const token = url.searchParams.get("token")?.trim() ?? "";

  const payloadRes =
    slug
      ? await supabaseAnonRpc<RpcPayload>("skillatlas_portfolio_by_public_slug", { p_slug: slug })
      : token
        ? await supabaseAnonRpc<RpcPayload>("skillatlas_portfolio_by_share_token", { p_token: token })
        : { data: null, error: null };

  const payload = (payloadRes.data ?? null) as any;
  const displayName = safeText(payload?.displayName, "Portfolio");
  const bio = safeText(payload?.bio, "");
  const projects = Array.isArray(payload?.projects) ? (payload.projects as RpcProject[]) : [];
  const techs = topTechs(projects);
  const projTitles = projects
    .map((p) => safeText(p?.title, ""))
    .filter(Boolean)
    .slice(0, 2);

  const desc = (bio || (projTitles.length ? projTitles.join(" · ") : "SkillAtlas public portfolio")).slice(0, 160);

  const width = 1200;
  const height = 630;

  const chips = techs
    .map((t, i) => {
      const x = 64 + i * 220;
      const y = 480;
      return `<g>
        <rect x="${x}" y="${y}" rx="999" ry="999" width="200" height="52" fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.35)" />
        <text x="${x + 18}" y="${y + 34}" font-size="22" fill="#E0E7FF" font-weight="700">${esc(t)}</text>
      </g>`;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1220"/>
      <stop offset="45%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0B1220"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="
        1 0 0 0 0
        0 1 0 0 0
        0 0 1 0 0
        0 0 0 0.6 0" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="1040" cy="120" r="180" fill="rgba(99,102,241,0.18)" filter="url(#soft)"/>
  <circle cx="160" cy="560" r="220" fill="rgba(16,185,129,0.14)" filter="url(#soft)"/>

  <text x="64" y="96" font-size="18" fill="rgba(249,250,251,0.85)" font-weight="600">SkillAtlas</text>
  <text x="64" y="178" font-size="64" fill="#F9FAFB" font-weight="800" letter-spacing="-1">${esc(displayName)}</text>
  <text x="64" y="232" font-size="26" fill="rgba(249,250,251,0.9)">${esc(desc)}</text>

  ${chips}

  <text x="64" y="586" font-size="18" fill="rgba(249,250,251,0.9)">${esc(projects.length ? `${projects.length} proyectos` : "Portfolio")}</text>
  <text x="1050" y="586" font-size="18" fill="rgba(249,250,251,0.85)">skillatlas.app</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};

