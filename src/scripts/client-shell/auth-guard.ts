import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";

export async function initAuthGuard() {
  const guard = document.querySelector<HTMLElement>("[data-requires-auth]");
  if (!guard) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return;

  try {
    sessionStorage.setItem("skillatlas_post_login_next", window.location.pathname + window.location.search);
  } catch {
    // ignore
  }
  const url = new URL(window.location.origin + "/");
  url.searchParams.set("reason", "auth");
  window.location.href = url.toString();
}
