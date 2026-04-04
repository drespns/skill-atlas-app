type RpcResult<T> = { data: T | null; error: string | null };

function env(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

export async function supabaseAnonRpc<T = unknown>(
  fn: string,
  args: Record<string, any>,
): Promise<RpcResult<T>> {
  const url = env("PUBLIC_SUPABASE_URL");
  const key = env("PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return { data: null, error: "Missing Supabase env vars." };

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/rpc/${encodeURIComponent(fn)}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args ?? {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, error: `RPC failed (${res.status}): ${text || res.statusText}` };
    }
    const json = (await res.json().catch(() => null)) as T | null;
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message ?? String(e) };
  }
}

