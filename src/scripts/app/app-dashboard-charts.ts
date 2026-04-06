let intersectionObserver: IntersectionObserver | null = null;
let chartsBootScheduled = false;
let chartsLoaded = false;

function teardownChartsIfLeavingApp() {
  if (document.querySelector("[data-dashboard-charts-root]")) return;
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  chartsBootScheduled = false;
  chartsLoaded = false;
  void import("./app-dashboard-charts-core")
    .then((m) => m.disposeDashboardVisuals())
    .catch(() => {});
}

function bootChartsWhenVisible() {
  teardownChartsIfLeavingApp();
  const root = document.querySelector("[data-dashboard-charts-root]");
  if (!root) return;

  const run = () => {
    if (chartsLoaded) return;
    chartsLoaded = true;
    void import("./app-dashboard-charts-core")
      .then((m) => m.runDashboardVisuals())
      .catch(() => {
        chartsLoaded = false;
      });
  };

  if (chartsBootScheduled) return;
  chartsBootScheduled = true;

  if (typeof IntersectionObserver === "undefined") {
    run();
    return;
  }

  intersectionObserver?.disconnect();
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        run();
        intersectionObserver?.disconnect();
        intersectionObserver = null;
      }
    },
    { root: null, rootMargin: "140px 0px", threshold: 0 },
  );
  intersectionObserver.observe(root);
}

function schedule() {
  chartsBootScheduled = false;
  chartsLoaded = false;
  teardownChartsIfLeavingApp();
  if (!document.querySelector("[data-dashboard-charts-root]")) return;
  bootChartsWhenVisible();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", schedule);
} else {
  schedule();
}

document.addEventListener("astro:page-load", schedule);
document.addEventListener("astro:after-swap", schedule);
window.addEventListener("skillatlas:auth-nav-updated", () => {
  chartsLoaded = false;
  void import("./app-dashboard-charts-core")
    .then((m) => m.disposeDashboardVisuals())
    .catch(() => {});
  schedule();
});
