import { getHelpStackItem, HELP_STACK_ITEMS } from "@config/help-stack";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { hydratePortfolioPublicProfile, readStoredPublicProfile } from "@scripts/core/public-profile-local";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function orderHelpKeys(keys: string[]): string[] {
  const order = new Map(HELP_STACK_ITEMS.map((i, idx) => [i.key, idx]));
  return [...keys].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

function renderHelpStack(keys: string[]) {
  const wrap = document.querySelector<HTMLElement>("[data-portfolio-help-wrap]");
  const mount = document.querySelector<HTMLElement>("[data-portfolio-help-stack]");
  if (!wrap || !mount) return;
  const uniq = Array.from(new Set(keys.filter(Boolean)));
  if (uniq.length === 0) {
    wrap.classList.add("hidden");
    mount.innerHTML = "";
    return;
  }
  wrap.classList.remove("hidden");
  mount.innerHTML = orderHelpKeys(uniq)
    .map((k) => {
      const item = getHelpStackItem(k);
      if (!item) return "";
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-gray-200/90 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 px-2.5 py-1 text-xs font-medium text-gray-800 dark:text-gray-200">
        <img src="${esc(item.icon)}" alt="" class="h-5 w-5 object-contain shrink-0" loading="lazy" />
        <span>${esc(item.label)}</span>
      </span>`;
    })
    .filter(Boolean)
    .join("");
}

async function run() {
  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;
  const nameEl = document.querySelector<HTMLElement>("[data-portfolio-public-name]");
  const bioEl = document.querySelector<HTMLElement>("[data-portfolio-public-bio]");
  const avatarImg = document.querySelector<HTMLImageElement>("[data-portfolio-avatar]");
  const avatarFallback = document.querySelector<HTMLElement>("[data-portfolio-avatar-fallback]");

  let helpKeys: string[] = [];

  const setAvatar = (url: string | null) => {
    if (!avatarImg) return;
    if (url) {
      avatarImg.src = url;
      avatarImg.classList.remove("hidden");
      avatarFallback?.classList.add("hidden");
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.classList.add("hidden");
      avatarFallback?.classList.remove("hidden");
    }
  };

  const signedAvatarUrl = async (path: string) => {
    if (!supabase) return null;
    try {
      const res = await supabase.storage.from("portfolio_avatars").createSignedUrl(path, 60 * 60);
      return res.data?.signedUrl ?? null;
    } catch {
      return null;
    }
  };

  if (supabase && userId) {
    let res = await supabase
      .from("portfolio_profiles")
      .select("display_name, bio, help_stack, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (res.error && /help_stack|column/i.test(res.error.message ?? "")) {
      res = await supabase.from("portfolio_profiles").select("display_name, bio").eq("user_id", userId).maybeSingle();
    }

    if (!res.error && res.data) {
      const data = res.data as {
        display_name?: string | null;
        bio?: string | null;
        help_stack?: unknown;
        avatar_url?: string | null;
      };
      if (nameEl) nameEl.textContent = (data.display_name ?? "").trim() || (nameEl.textContent ?? "");
      if (bioEl && data.bio !== undefined && data.bio !== null) bioEl.textContent = data.bio;

      if (typeof data.avatar_url === "string" && data.avatar_url) {
        // Prefer stored avatar_url (can be a public URL or a storage path: "userId/xxx.png")
        const url = data.avatar_url.includes("/") && !data.avatar_url.startsWith("http")
          ? await signedAvatarUrl(data.avatar_url)
          : data.avatar_url;
        setAvatar(url);
      } else {
        // Fallback to auth provider avatar
        const { data: sessionData } = await supabase.auth.getSession();
        const meta = (sessionData.session?.user?.user_metadata ?? {}) as Record<string, any>;
        const fallbackUrl =
          (typeof meta.avatar_url === "string" && meta.avatar_url) ||
          (typeof meta.picture === "string" && meta.picture) ||
          null;
        setAvatar(fallbackUrl);
      }

      const raw = data.help_stack;
      if (Array.isArray(raw)) {
        helpKeys = raw.filter((x): x is string => typeof x === "string");
      }
      if (helpKeys.length === 0) {
        helpKeys = readStoredPublicProfile()?.helpStack ?? [];
      }
      renderHelpStack(helpKeys);
      return;
    }
  }

  hydratePortfolioPublicProfile();
  helpKeys = readStoredPublicProfile()?.helpStack ?? [];
  renderHelpStack(helpKeys);
}

function schedulePortfolioPublicProfile() {
  if (!document.querySelector("[data-portfolio-public-name]")) return;
  void run();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", schedulePortfolioPublicProfile);
} else {
  schedulePortfolioPublicProfile();
}

document.addEventListener("astro:page-load", schedulePortfolioPublicProfile);
document.addEventListener("astro:after-swap", schedulePortfolioPublicProfile);
