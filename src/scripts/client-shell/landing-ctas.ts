import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";

export function updateLandingCtas(isAuthed: boolean) {
  const requestAccess = document.querySelector<HTMLElement>("[data-landing-request-access]");
  const haveInvite = document.querySelector<HTMLElement>("[data-landing-have-invite]");
  const openApp = document.querySelector<HTMLElement>("[data-landing-open-app]");
  const demo = document.querySelector<HTMLElement>("[data-landing-demo]");

  if (requestAccess) {
    requestAccess.classList.toggle("hidden", isAuthed);
    requestAccess.classList.toggle("inline-flex", !isAuthed);
  }
  if (haveInvite) {
    haveInvite.classList.toggle("hidden", isAuthed);
    haveInvite.classList.toggle("inline-flex", !isAuthed);
  }

  if (openApp) {
    openApp.classList.toggle("hidden", !isAuthed);
    openApp.classList.toggle("inline-flex", isAuthed);
  }

  if (demo) {
    demo.classList.remove("hidden");
    demo.classList.add("inline-flex");
  }
}

export async function initLandingCtas() {
  const hasAny =
    Boolean(document.querySelector("[data-landing-request-access]")) ||
    Boolean(document.querySelector("[data-landing-have-invite]")) ||
    Boolean(document.querySelector("[data-landing-open-app]")) ||
    Boolean(document.querySelector("[data-landing-demo]"));
  if (!hasAny) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const render = async () => {
    const { data } = await supabase.auth.getSession();
    updateLandingCtas(Boolean(data.session?.user));
  };

  await render();
  supabase.auth.onAuthStateChange(() => {
    void render();
  });
}
