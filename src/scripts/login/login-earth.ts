const EARTH_DESKTOP_MQ = "(min-width: 768px)";

function requestIdle(cb: () => void, timeoutMs: number) {
  const ric = window.requestIdleCallback;
  if (typeof ric === "function") {
    ric(() => cb(), { timeout: timeoutMs });
    return;
  }
  window.setTimeout(cb, 120);
}

/**
 * Carga Three.js y texturas solo en viewport md+ y tras idle (menos trabajo en LCP).
 * Timeout más largo en la home de entrada para no competir con login/charts.
 */
async function startEarthWhenReady(mount: HTMLElement) {
  if (!window.matchMedia(EARTH_DESKTOP_MQ).matches) return;
  if (mount.querySelector("canvas")) return;

  const canvas = document.createElement("canvas");
  canvas.className = "block w-full h-full";
  mount.appendChild(canvas);

  let cleanup: null | (() => void) = null;
  try {
    const { mountLoginEarthScene } = await import("./login-earth-scene");
    cleanup = mountLoginEarthScene(canvas, mount);
  } catch (e) {
    canvas.remove();
    // Silencioso en entry: el degradado de fondo basta
    mount.replaceChildren();
    // eslint-disable-next-line no-console
    console.error(e);
    return;
  }

  window.addEventListener(
    "beforeunload",
    () => {
      cleanup?.();
    },
    { once: true },
  );
}

function initLoginEarth() {
  const mount = document.querySelector<HTMLElement>("[data-login-earth]");
  if (!mount) return;

  const isEntry = Boolean(document.querySelector("[data-finanzas-entry]"));
  const idleTimeout = isEntry ? 4200 : 2800;

  const schedule = () => {
    requestIdle(() => void startEarthWhenReady(mount), idleTimeout);
  };

  if (window.matchMedia(EARTH_DESKTOP_MQ).matches) {
    schedule();
  } else {
    window.matchMedia(EARTH_DESKTOP_MQ).addEventListener(
      "change",
      (e) => {
        if (e.matches) schedule();
      },
      { once: true },
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initLoginEarth());
} else {
  initLoginEarth();
}
