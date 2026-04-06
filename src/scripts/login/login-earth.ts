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
    mount.classList.add("flex", "items-center", "justify-center");
    mount.innerHTML = `<p class="text-xs text-gray-500 dark:text-gray-400 px-3 text-center">No se pudo cargar el modelo 3D en este navegador.</p>`;
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

  const schedule = () => {
    requestIdle(() => void startEarthWhenReady(mount), 2800);
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
