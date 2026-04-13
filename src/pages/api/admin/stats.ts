import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

/**
 * Métricas de Auth para admins: requiere JWT de sesión + fila en `admin_users`.
 * Lista usuarios solo si existe `SUPABASE_SERVICE_ROLE_KEY` en el servidor (p. ej. Vercel).
 */
export const GET: APIRoute = async ({ request }) => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (!url || !anon) return json({ ok: false, code: "misconfigured" }, 500);
  if (!token) return json({ ok: false, code: "no_session" }, 401);

  const authClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) return json({ ok: false, code: "invalid_session" }, 401);

  if (!serviceKey) {
    return json(
      {
        ok: true,
        configured: false,
        hint: "Define SUPABASE_SERVICE_ROLE_KEY en el servidor para listar usuarios de Auth (solo lectura admin).",
      },
      200,
    );
  }

  const adminSb = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: adminRow, error: adminErr } = await adminSb
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminErr || !adminRow?.user_id) return json({ ok: false, code: "forbidden" }, 403);

  const { data: listData, error: listErr } = await adminSb.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (listErr) return json({ ok: false, code: "list_failed", message: listErr.message }, 500);

  const users = (listData.users ?? []).map((u) => {
    const meta = u.app_metadata as Record<string, unknown> | undefined;
    const provider = typeof meta?.provider === "string" ? meta.provider : "email";
    return {
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      provider,
    };
  });

  return json({ ok: true, configured: true, total: users.length, users }, 200);
};
