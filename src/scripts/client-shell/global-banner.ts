/** Debe coincidir con `max-h-*` del banner en `AppGlobalBanner.astro`. */
const BANNER_MAX_OPEN = "max-h-28";

function applyGlobalBannerOpen(root: HTMLElement, glow: HTMLElement | null) {
  root.dataset.bannerState = "open";
  root.classList.remove("max-h-0", "max-h-24", "opacity-0", "-translate-y-2", "pointer-events-none");
  root.classList.add(BANNER_MAX_OPEN, "opacity-100", "translate-y-0", "pointer-events-auto");
  glow?.classList.remove("opacity-0");
  glow?.classList.add("opacity-100");
}

function applyGlobalBannerClosed(root: HTMLElement, glow: HTMLElement | null) {
  root.dataset.bannerState = "closed";
  root.classList.add("max-h-0", "opacity-0", "-translate-y-2", "pointer-events-none");
  root.classList.remove(BANNER_MAX_OPEN, "max-h-24", "opacity-100", "translate-y-0", "pointer-events-auto");
  glow?.classList.add("opacity-0");
  glow?.classList.remove("opacity-100");
}

/** Sincroniza el banner con localStorage (sin await). Debe ejecutarse lo antes posible tras cada navegación. */
export function syncGlobalBannerFromStorage() {
  const root = document.querySelector<HTMLElement>("[data-global-banner]");
  if (!root) return;

  const bannerId = root.dataset.bannerId ?? "";
  const storageKey = `skillatlas_banner_dismissed:${bannerId || "default"}`;
  const glow = document.querySelector<HTMLElement>("[data-banner-glow]");

  document.documentElement.dataset.saBannerHydrated = "0";

  let dismissed = false;
  try {
    dismissed = localStorage.getItem(storageKey) === "1";
  } catch {
    dismissed = false;
  }

  document.documentElement.dataset.saBannerDismissed = dismissed ? "1" : "0";

  if (!dismissed) applyGlobalBannerOpen(root, glow);
  else applyGlobalBannerClosed(root, glow);

  requestAnimationFrame(() => {
    document.documentElement.dataset.saBannerHydrated = "1";
  });
}

let globalBannerCloseDelegationBound = false;

export function initGlobalBannerCloseDelegationOnce() {
  if (globalBannerCloseDelegationBound) return;
  globalBannerCloseDelegationBound = true;

  document.addEventListener("click", (ev: MouseEvent) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    const closeBtn = t.closest<HTMLButtonElement>("[data-banner-close]");
    if (!closeBtn) return;
    const root = closeBtn.closest<HTMLElement>("[data-global-banner]");
    if (!root) return;
    const bannerId = root.dataset.bannerId ?? "";
    const storageKey = `skillatlas_banner_dismissed:${bannerId || "default"}`;
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    document.documentElement.dataset.saBannerDismissed = "1";
    const glow = document.querySelector<HTMLElement>("[data-banner-glow]");
    applyGlobalBannerClosed(root, glow);
  });
}
