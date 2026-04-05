/** Alinea `data-nav-active` con la URL actual (necesario con View Transitions: el HTML del build queda obsoleto). */
export function syncHeaderNavActive() {
  const raw = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll<HTMLAnchorElement>("[data-header-nav-link]").forEach((a) => {
    const href = (a.getAttribute("href") ?? "").replace(/\/$/, "") || "/";
    const active = href === "/" ? raw === "/" : raw === href || raw.startsWith(`${href}/`);
    a.dataset.navActive = active ? "true" : "false";
  });
  document.querySelectorAll<HTMLAnchorElement>("[data-admin-header-link]").forEach((a) => {
    const href = (a.getAttribute("href") ?? "").replace(/\/$/, "") || "/";
    const active = raw === href || raw.startsWith(`${href}/`);
    a.dataset.navActive = active ? "true" : "false";
  });
}

export function initHeaderNavIndicator() {
  const nav = document.querySelector<HTMLElement>("[data-header-nav]");
  if (!nav) return;
  if (nav.dataset.bound === "1") return;
  nav.dataset.bound = "1";
  const indicator = nav.querySelector<HTMLElement>("[data-header-nav-indicator]");
  if (!indicator) return;

  const allLinks = () =>
    Array.from(nav.querySelectorAll<HTMLAnchorElement>("[data-header-nav-link]")).filter((a) => {
      const r = a.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

  const moveTo = (a: HTMLElement | null) => {
    const links = allLinks();
    if (!a || links.length === 0) {
      indicator.style.opacity = "0";
      indicator.style.width = "0px";
      indicator.style.left = "0px";
      indicator.style.transform = "none";
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const r = a.getBoundingClientRect();
    const x = r.left - navRect.left;
    indicator.style.opacity = "1";
    indicator.style.transform = "none";
    indicator.style.left = `${Math.max(0, x)}px`;
    indicator.style.width = `${Math.max(0, r.width)}px`;
  };

  const activeLink = () => allLinks().find((a) => a.dataset.navActive === "true") ?? null;

  const attach = () => {
    const links = allLinks();
    for (const a of links) {
      if (a.dataset.navHoverBound === "1") continue;
      a.dataset.navHoverBound = "1";
      a.addEventListener("mouseenter", () => moveTo(a));
      a.addEventListener("focus", () => moveTo(a));
    }
    if (nav.dataset.navLeaveBound !== "1") {
      nav.dataset.navLeaveBound = "1";
      nav.addEventListener("mouseleave", () => moveTo(activeLink()));
    }
  };

  const refresh = () => {
    syncHeaderNavActive();
    moveTo(activeLink());
    attach();
  };

  refresh();

  const ro = new ResizeObserver(() => refresh());
  ro.observe(nav);

  window.addEventListener("skillatlas:auth-nav-updated", () => {
    refresh();
  });

  document.addEventListener("astro:page-load", () => {
    refresh();
  });
}
