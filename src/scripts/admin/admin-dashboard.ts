import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { isSkillAtlasAdmin } from "@scripts/core/admin-role";

type StatsUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
};

type StatsResponse =
  | { ok: true; configured: false; hint?: string }
  | { ok: true; configured: true; total: number; users: StatsUser[] }
  | { ok: false; code: string; message?: string };

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#039;"));
}

function fmt(dt: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

async function run() {
  const mount = document.querySelector<HTMLElement>("[data-admin-dashboard]");
  if (!mount) return;
  if (mount.dataset.bound === "1") return;
  mount.dataset.bound = "1";

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<p class="m-0 text-sm text-rose-700 dark:text-rose-300">No se pudo inicializar el panel.</p>`;
    return;
  }

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  const token = data.session?.access_token ?? "";
  if (!user || !token) return;

  const isAdmin = await isSkillAtlasAdmin(supabase, user.id);
  if (!isAdmin) {
    mount.classList.add("hidden");
    return;
  }

  mount.innerHTML = `<p class="m-0 text-sm text-gray-600 dark:text-gray-400">Cargando métricas…</p>`;

  let res: Response;
  try {
    res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    mount.innerHTML = `<p class="m-0 text-sm text-rose-700 dark:text-rose-300">Error de red al cargar métricas.</p>`;
    return;
  }

  let body: StatsResponse;
  try {
    body = (await res.json()) as StatsResponse;
  } catch {
    mount.innerHTML = `<p class="m-0 text-sm text-rose-700 dark:text-rose-300">Respuesta inválida del servidor.</p>`;
    return;
  }

  if (!body.ok) {
    mount.innerHTML = `<p class="m-0 text-sm text-rose-700 dark:text-rose-300">No se pudieron cargar las métricas (${esc(body.code)}).</p>`;
    return;
  }

  if (!body.configured) {
    mount.innerHTML = `
      <div class="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 p-4 space-y-2">
        <p class="m-0 text-sm font-semibold text-amber-950 dark:text-amber-100">Métricas de usuarios (pendiente de configurar)</p>
        <p class="m-0 text-sm text-amber-900/90 dark:text-amber-200/90">${esc(body.hint ?? "Añade SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor (p. ej. Vercel). No la expongas al cliente ni la commitees.")}</p>
      </div>`;
    return;
  }

  const rows = body.users ?? [];
  mount.innerHTML = `
    <div class="space-y-3">
      <p class="m-0 text-sm text-gray-600 dark:text-gray-400">
        Usuarios en Auth (primera página, hasta ${body.total} mostrados). Datos no sensibles más allá del email.
      </p>
      <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-gray-50 dark:bg-gray-900/80 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <tr>
              <th class="px-3 py-2 font-semibold">Email</th>
              <th class="px-3 py-2 font-semibold">Registro</th>
              <th class="px-3 py-2 font-semibold">Último login</th>
              <th class="px-3 py-2 font-semibold">Provider</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200/80 dark:divide-gray-800">
            ${rows
              .map(
                (u) => `
              <tr class="bg-white/80 dark:bg-gray-950/60">
                <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 wrap-break-word">${esc(u.email || "—")}</td>
                <td class="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">${esc(fmt(u.created_at))}</td>
                <td class="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">${esc(fmt(u.last_sign_in_at))}</td>
                <td class="px-3 py-2 text-gray-600 dark:text-gray-400">${esc(u.provider)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`;

}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void run());
else void run();

document.addEventListener("astro:page-load", () => void run());
document.addEventListener("astro:after-swap", () => void run());
