/**
 * Carrusel de facetas: snap horizontal, arrastre, avance automático con barra de progreso en el punto activo.
 * Scroll solo en el carril (sin scrollIntoView → no salta la página). Los puntos extremo no son clicables.
 */
let facetsAbort: AbortController | null = null;
let facetsTickTimer: ReturnType<typeof setInterval> | null = null;

const AUTO_MS = 5500;
const TICK_MS = 80;

function reducedMotion(): boolean {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function initFacetsCarousel() {
  const root = document.querySelector("[data-landing-facets-carousel]");
  const track = document.querySelector<HTMLElement>("[data-landing-facets-track]");
  if (!root || !track) return;

  facetsAbort?.abort();
  if (facetsTickTimer != null) {
    clearInterval(facetsTickTimer);
    facetsTickTimer = null;
  }
  facetsAbort = new AbortController();
  const { signal } = facetsAbort;

  const slides = () => [...document.querySelectorAll<HTMLElement>("[data-landing-facet-slide]")];
  const dots = () => [...document.querySelectorAll<HTMLButtonElement>("[data-landing-facet-dot]")];

  const n = slides().length;
  if (n === 0) return;

  let activeIndex = -1;
  let slideStart = Date.now();
  let dragging = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let dragRaf = 0;
  let lastPointerX = 0;

  const isEdge = (i: number) => i === 0 || i === n - 1;

  const setActive = (index: number) => {
    if (index !== activeIndex) {
      activeIndex = index;
      slideStart = Date.now();
    }

    slides().forEach((el, i) => {
      const on = i === index;
      el.classList.toggle("opacity-100", on);
      el.classList.toggle("scale-100", on);
      el.classList.toggle("opacity-55", !on);
      el.classList.toggle("scale-[0.97]", !on);
      el.classList.toggle("md:opacity-50", !on);
      el.classList.toggle("md:scale-[0.96]", !on);
    });

    dots().forEach((btn, i) => {
      const on = i === index;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("w-8", on);
      btn.classList.toggle("w-2", !on);
      if (!on) {
        const fill = btn.querySelector<HTMLElement>("[data-landing-facet-dot-fill]");
        if (fill) fill.style.width = "0%";
      }
    });
  };

  /** Solo desplaza el carril; no usa scrollIntoView (evita saltos de página). */
  const scrollToIndex = (i: number) => {
    const s = slides()[i];
    if (!s) return;
    const behavior = reducedMotion() ? "auto" : "smooth";
    const targetLeft = s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2;
    const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    track.scrollTo({ left: Math.max(0, Math.min(targetLeft, maxLeft)), behavior });
  };

  const goNext = () => {
    if (n <= 1) return;
    const next = (activeIndex + 1) % n;
    scrollToIndex(next);
  };

  const onScroll = () => {
    const rect = track.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    let best = 0;
    let bestDist = Infinity;
    slides().forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const c = r.left + r.width / 2;
      const d = Math.abs(c - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  };

  const updateProgressFill = () => {
    if (reducedMotion() || n <= 1) return;
    if (dragging) return;
    const elapsed = Date.now() - slideStart;
    const pct = Math.min(100, (elapsed / AUTO_MS) * 100);
    const fill = dots()[activeIndex]?.querySelector<HTMLElement>("[data-landing-facet-dot-fill]");
    if (fill) fill.style.width = `${pct}%`;
    if (elapsed >= AUTO_MS) {
      goNext();
    }
  };

  const startTick = () => {
    if (facetsTickTimer != null) clearInterval(facetsTickTimer);
    if (reducedMotion() || n <= 1) return;
    facetsTickTimer = window.setInterval(updateProgressFill, TICK_MS);
  };

  const stopTick = () => {
    if (facetsTickTimer != null) {
      clearInterval(facetsTickTimer);
      facetsTickTimer = null;
    }
  };

  signal.addEventListener("abort", () => stopTick());

  dots().forEach((btn, i) => {
    if (isEdge(i)) return;
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        scrollToIndex(i);
      },
      { signal },
    );
  });

  track.addEventListener("scroll", onScroll, { signal, passive: true });

  track.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      dragging = true;
      track.classList.add("is-dragging");
      dragStartX = e.clientX;
      lastPointerX = e.clientX;
      dragStartScroll = track.scrollLeft;
      try {
        track.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    },
    { signal },
  );

  const applyDragScroll = () => {
    dragRaf = 0;
    if (!dragging) return;
    const dx = lastPointerX - dragStartX;
    track.scrollLeft = dragStartScroll - dx;
  };

  track.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      lastPointerX = e.clientX;
      if (dragRaf) cancelAnimationFrame(dragRaf);
      dragRaf = requestAnimationFrame(applyDragScroll);
    },
    { signal },
  );

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("is-dragging");
    if (dragRaf) {
      cancelAnimationFrame(dragRaf);
      dragRaf = 0;
    }
    slideStart = Date.now();
  };

  track.addEventListener("pointerup", endDrag, { signal });
  track.addEventListener("pointercancel", endDrag, { signal });
  track.addEventListener("lostpointercapture", endDrag, { signal });

  requestAnimationFrame(() => onScroll());
  setActive(0);
  startTick();

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") stopTick();
      else startTick();
    },
    { signal },
  );
}

function boot() {
  initFacetsCarousel();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:after-swap", boot);
