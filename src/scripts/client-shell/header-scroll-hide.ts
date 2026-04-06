let scrollCleanup: (() => void) | null = null;

function shouldReduceHeaderMotion(): boolean {
  return (
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );
}

export function initHeaderScrollAutoHide() {
  scrollCleanup?.();
  scrollCleanup = null;

  const header = document.querySelector<HTMLElement>("[data-app-header]");
  if (!header) return;

  if (shouldReduceHeaderMotion()) {
    header.classList.remove("is-header-hidden");
    return;
  }

  let lastY = window.scrollY;
  const threshold = 12;
  const delta = 8;

  const onScroll = () => {
    const y = window.scrollY;
    const dy = y - lastY;
    if (y < threshold) {
      header.classList.remove("is-header-hidden");
    } else if (dy > delta) {
      header.classList.add("is-header-hidden");
    } else if (dy < -delta) {
      header.classList.remove("is-header-hidden");
    }
    lastY = y;
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  scrollCleanup = () => window.removeEventListener("scroll", onScroll);
}

export function initHeaderScrollAutoHideDelegation() {
  if ((window as unknown as { __skillatlasHeaderScroll?: boolean }).__skillatlasHeaderScroll) return;
  (window as unknown as { __skillatlasHeaderScroll?: boolean }).__skillatlasHeaderScroll = true;

  const boot = () => initHeaderScrollAutoHide();
  boot();
  window.addEventListener("skillatlas:prefs-updated", boot);
  document.addEventListener("astro:page-load", boot as any);
  document.addEventListener("astro:after-swap", boot as any);
}
