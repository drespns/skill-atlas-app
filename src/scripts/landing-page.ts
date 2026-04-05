/**
 * Landing: scroll reveals, flow-path draw, respects prefs + prefers-reduced-motion.
 */
function motionReduced(): boolean {
  if (document.documentElement.dataset.motion === "reduced") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

let revealObserver: IntersectionObserver | null = null;
let flowObserver: IntersectionObserver | null = null;

function boot() {
  const root = document.querySelector("[data-landing-root]");
  if (!root) {
    document.documentElement.classList.remove("landing-enhanced");
    revealObserver?.disconnect();
    revealObserver = null;
    flowObserver?.disconnect();
    flowObserver = null;
    return;
  }

  document.documentElement.classList.add("landing-enhanced");

  revealObserver?.disconnect();
  flowObserver?.disconnect();

  const reduced = motionReduced();
  const revealEls = document.querySelectorAll("[data-landing-reveal]");

  if (reduced) {
    revealEls.forEach((el) => el.classList.add("landing-reveal-visible"));
  } else {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("landing-reveal-visible");
            revealObserver?.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    revealEls.forEach((el) => revealObserver!.observe(el));
  }

  const path = document.querySelector("#landing-flow-path") as SVGPathElement | null;
  const flowWrap = document.querySelector("[data-landing-flow]");
  if (path && flowWrap) {
    path.classList.remove("landing-flow-path-drawn");
    if (reduced) {
      path.style.strokeDasharray = "";
      path.style.strokeDashoffset = "";
    } else {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      flowObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              requestAnimationFrame(() => path.classList.add("landing-flow-path-drawn"));
              flowObserver?.unobserve(e.target);
            }
          }
        },
        { threshold: 0.12 },
      );
      flowObserver.observe(flowWrap);
    }
  }
}

boot();
document.addEventListener("astro:after-swap", boot);
