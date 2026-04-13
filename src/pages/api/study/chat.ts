import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { getOpenAiConfig, openAiRespondText } from "../../../lib/server/openai";

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function env(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

function boolEnv(name: string): boolean {
  const v = env(name).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

type ChatRequest = {
  message: string;
  scope: "context" | "all";
  sourceIds: string[];
};

export const POST: APIRoute = async ({ request }) => {
  // Safety: keep chat disabled unless explicitly enabled.
  if (!boolEnv("STUDY_CHAT_ENABLED")) {
    return json({ error: "Study chat is disabled." }, 404);
  }

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return json({ error: "Missing Authorization bearer token." }, 401);

  const supabaseUrl = env("PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = env("PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Missing Supabase env vars." }, 500);

  let body: ChatRequest | null = null;
  try {
    body = (await request.json().catch(() => null)) as ChatRequest | null;
  } catch {
    body = null;
  }
  const message = String(body?.message ?? "").trim();
  const scope = (body?.scope === "all" ? "all" : "context") as ChatRequest["scope"];
  const sourceIdsRaw = Array.isArray(body?.sourceIds) ? body!.sourceIds : [];
  const sourceIds = sourceIdsRaw.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 50);
  if (!message) return json({ error: "Missing message." }, 400);
  if (scope === "context" && sourceIds.length === 0) return json({ error: "No sources in context." }, 400);

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Determine user_id from token (RLS relies on auth.uid()).
  const { data: authData, error: authErr } = await sb.auth.getUser();
  const userId = authData?.user?.id ?? "";
  if (authErr || !userId) return json({ error: "Unauthorized." }, 401);

  // Retrieve chunks with FTS.
  const chunkQuery = sb
    .from("study_chunks")
    .select("source_id,chunk_index,body")
    .eq("user_id", userId)
    .textSearch("tsv", message, { type: "websearch", config: "simple" })
    .limit(12);

  const chunkRes =
    scope === "all" ? await chunkQuery : await chunkQuery.in("source_id", sourceIds);

  if (chunkRes.error) return json({ error: "Retrieval failed." }, 500);
  const rows = (chunkRes.data ?? []) as Array<{ source_id: string; chunk_index: number; body: string }>;

  // Fetch source metadata for citations.
  const uniqueSourceIds = Array.from(new Set(rows.map((r) => r.source_id))).slice(0, 50);
  const srcRes = await sb
    .from("study_sources")
    .select("id,title,kind,url,file_name")
    .eq("user_id", userId)
    .in("id", uniqueSourceIds);
  const srcById = new Map<string, any>((srcRes.data ?? []).map((r: any) => [String(r.id), r]));

  const citations = rows.map((r, idx) => {
    const src = srcById.get(String(r.source_id));
    const fullBody = String(r.body || "");
    return {
      cite: idx + 1,
      sourceId: String(r.source_id),
      chunkIndex: r.chunk_index,
      title: typeof src?.title === "string" ? src.title : "Fuente",
      kind: typeof src?.kind === "string" ? src.kind : null,
      url: typeof src?.url === "string" ? src.url : null,
      fileName: typeof src?.file_name === "string" ? src.file_name : null,
      excerpt: fullBody.slice(0, 480),
      /** Fragmento completo del chunk (tope) para resaltar en cliente sin segunda query */
      body: fullBody.slice(0, 4000),
    };
  });

  const contextLines = citations
    .map((c) => {
      const label = `${c.cite}. ${c.title} (#${c.chunkIndex + 1})`;
      return `[[${c.cite}]] ${label}\n${c.excerpt}`;
    })
    .join("\n\n---\n\n");

  const { apiKey, model } = getOpenAiConfig();
  if (!apiKey) {
    return json(
      {
        error: "Missing OPENAI_API_KEY.",
        citations,
      },
      500,
    );
  }

  const prompt = [
    "Eres un asistente de estudio. Responde SOLO usando el CONTEXTO proporcionado.",
    "Reglas:",
    "- Si la respuesta no está en el contexto, dilo y sugiere qué fuente falta.",
    "- Incluye citas inline como [[n]] al final de cada frase relevante.",
    "- Sé claro y directo. Evita inventar.",
    "",
    `PREGUNTA: ${message}`,
    "",
    "CONTEXTO:",
    contextLines || "(vacío)",
  ].join("\n");

  const out = await openAiRespondText({ apiKey, model, input: prompt });
  if (out.error) return json({ error: out.error, citations }, 500);

  return json({
    answer: out.text,
    citations,
  });
};

