import { getSupabaseBrowserClient } from "./client-supabase";
import { isSkillAtlasAdmin } from "./admin-role";
import { showToast } from "./ui-feedback";

type AccessRequestStatus = "pending" | "invited" | "rejected";

type AccessRequestRow = {
  id: number;
  created_at: string;
  email: string;
  full_name: string | null;
  message: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  source: string | null;
  user_agent: string | null;
  status: AccessRequestStatus | string;
  handled_at: string | null;
  handled_by: string | null;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#039;"));
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function statusPill(status: string) {
  const s = status || "pending";
  const cls =
    s === "invited"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
      : s === "rejected"
        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
  const label = s === "invited" ? "Invitado" : s === "rejected" ? "Rechazado" : "Pendiente";
  return `<span class="text-xs px-2 py-1 rounded-full border ${cls}">${label}</span>`;
}

function renderList(rows: AccessRequestRow[]) {
  if (rows.length === 0) {
    return `<p class="m-0 text-sm text-gray-600 dark:text-gray-400">No hay solicitudes aún.</p>`;
  }

  return `
    <div class="space-y-3">
      ${rows
        .map((r) => {
          const name = r.full_name ? esc(r.full_name) : "—";
          const msg = r.message ? esc(r.message) : "—";
          const li = r.linkedin_url ? `<a class="font-semibold underline underline-offset-2" href="${esc(r.linkedin_url)}" target="_blank" rel="noreferrer">LinkedIn</a>` : "";
          const gh = r.github_url ? `<a class="font-semibold underline underline-offset-2" href="${esc(r.github_url)}" target="_blank" rel="noreferrer">GitHub</a>` : "";
          const links = [li, gh].filter(Boolean).join(`<span class="text-gray-400 dark:text-gray-500"> · </span>`);
          const handled = r.handled_at ? `Gestionado: ${esc(fmt(r.handled_at))}` : "Sin gestionar";
          return `
            <article class="rounded-xl border border-gray-200/70 dark:border-gray-800/80 bg-white/70 dark:bg-gray-950/50 p-4">
              <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div class="space-y-2 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    ${statusPill(String(r.status ?? "pending"))}
                    <span class="text-xs text-gray-500 dark:text-gray-400">#${r.id}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">${esc(fmt(r.created_at))}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">${esc(handled)}</span>
                  </div>
                  <p class="m-0 text-sm">
                    <span class="font-semibold">${esc(r.email)}</span>
                    <span class="text-gray-500 dark:text-gray-400">· ${name}</span>
                  </p>
                  <p class="m-0 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap wrap-break-word">${msg}</p>
                  ${links ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-400">${links}</p>` : ""}
                </div>

                <div class="flex flex-wrap gap-2 shrink-0">
                  <button
                    class="inline-flex items-center justify-center rounded-lg border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900"
                    data-admin-action="pending"
                    data-admin-id="${r.id}"
                    type="button"
                  >
                    Pendiente
                  </button>
                  <button
                    class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                    data-admin-action="invited"
                    data-admin-id="${r.id}"
                    type="button"
                  >
                    Marcar invitado
                  </button>
                  <button
                    class="inline-flex items-center justify-center rounded-lg border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    data-admin-action="rejected"
                    data-admin-id="${r.id}"
                    type="button"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

async function run() {
  const mount = document.querySelector<HTMLElement>("[data-admin-access-requests]");
  const denied = document.querySelector<HTMLElement>("[data-admin-denied]");
  if (!mount) return;
  if (mount.dataset.bound === "1") return;
  mount.dataset.bound = "1";

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<p class="m-0 text-sm text-rose-700 dark:text-rose-300 font-semibold">No se pudo inicializar el panel.</p>`;
    return;
  }

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  if (!user) return; // auth guard will redirect

  const isAdmin = await isSkillAtlasAdmin(supabase, user.id);
  if (!isAdmin) {
    denied?.classList.remove("hidden");
    mount.classList.add("hidden");
    return;
  }

  const load = async () => {
    const res = await supabase
      .from("access_requests")
      .select(
        "id, created_at, email, full_name, message, linkedin_url, github_url, source, user_agent, status, handled_at, handled_by"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (res.error) {
      mount.innerHTML = `<p class="m-0 text-sm text-rose-700 dark:text-rose-300 font-semibold">No se pudo cargar.</p>`;
      showToast("No se pudieron cargar las solicitudes.", "error");
      return;
    }

    mount.innerHTML = renderList((res.data ?? []) as AccessRequestRow[]);
  };

  const setStatus = async (id: number, status: AccessRequestStatus) => {
    const payload = {
      status,
      handled_at: new Date().toISOString(),
      handled_by: user.id,
    };
    const res = await supabase.from("access_requests").update(payload).eq("id", id);
    if (res.error) {
      showToast("No se pudo actualizar.", "error");
      return;
    }
    showToast("Actualizado.", "success");
    await load();
  };

  mount.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement | null)?.closest?.<HTMLButtonElement>("[data-admin-action]");
    if (!btn) return;
    const id = Number(btn.dataset.adminId ?? "");
    const action = (btn.dataset.adminAction ?? "") as AccessRequestStatus;
    if (!id || (action !== "pending" && action !== "invited" && action !== "rejected")) return;
    btn.disabled = true;
    try {
      await setStatus(id, action);
    } finally {
      btn.disabled = false;
    }
  });

  await load();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void run());
else void run();

document.addEventListener("astro:page-load", () => void run());
document.addEventListener("astro:after-swap", () => void run());

