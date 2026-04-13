import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { lookupRegistryPackage } from "../../lib/server/registry-lookup";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function env(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return json({ error: "Missing Authorization bearer token." }, 401);

  const supabaseUrl = env("PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = env("PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Missing Supabase env vars." }, 500);

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user?.id) return json({ error: "Invalid session." }, 401);

  let body: { query?: string } | null = null;
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    body = null;
  }
  const query = String(body?.query ?? "").trim();
  if (!query) return json({ error: "Missing query." }, 400);

  try {
    const result = await lookupRegistryPackage(query);
    if ("error" in result) return json({ error: result.error }, 404);
    return json({ ok: true, ...result });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "Tiempo de espera al consultar el registro." : "No se pudo consultar el registro.";
    return json({ error: msg }, 502);
  }
};
