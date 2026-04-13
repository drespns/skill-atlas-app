function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 660;
    g.gain.value = 0.1;
    o.start();
    window.setTimeout(() => {
      o.stop();
      ctx.close();
    }, 220);
  } catch {
    /* ignore */
  }
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-talk-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const display = root.querySelector<HTMLElement>("[data-talk-display]");
  const status = root.querySelector<HTMLElement>("[data-talk-status]");
  const custom = root.querySelector<HTMLInputElement>("[data-talk-custom]");
  const btnStart = root.querySelector<HTMLButtonElement>("[data-talk-start]");
  const btnPause = root.querySelector<HTMLButtonElement>("[data-talk-pause]");
  const btnReset = root.querySelector<HTMLButtonElement>("[data-talk-reset]");

  let totalSec = 5 * 60;
  let remaining = totalSec;
  let timer: number | null = null;
  let warned2 = false;
  let warned1 = false;

  const paint = () => {
    if (display) display.textContent = fmt(remaining);
  };

  const stop = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const setPreset = (min: number) => {
    stop();
    totalSec = min * 60;
    remaining = totalSec;
    warned2 = false;
    warned1 = false;
    if (status) status.textContent = "";
    paint();
  };

  root.querySelectorAll<HTMLButtonElement>("[data-talk-preset]").forEach((b) => {
    b.addEventListener("click", () => {
      const m = Number(b.getAttribute("data-talk-preset")) || 5;
      setPreset(m);
    });
  });

  custom?.addEventListener("change", () => {
    const m = Math.min(120, Math.max(1, Number(custom.value) || 5));
    custom.value = String(m);
    setPreset(m);
  });

  btnStart?.addEventListener("click", () => {
    if (timer !== null) return;
    if (status) status.textContent = "";
    timer = window.setInterval(() => {
      remaining--;
      if (remaining === 120 && !warned2) {
        warned2 = true;
        beep();
        if (status) status.textContent = "2 min";
      }
      if (remaining === 60 && !warned1) {
        warned1 = true;
        beep();
        if (status) status.textContent = "1 min";
      }
      if (remaining <= 0) {
        stop();
        remaining = 0;
        paint();
        beep();
        window.setTimeout(beep, 350);
        if (status) status.textContent = "¡Tiempo!";
        return;
      }
      paint();
    }, 1000);
  });

  btnPause?.addEventListener("click", () => stop());

  btnReset?.addEventListener("click", () => {
    stop();
    remaining = totalSec;
    warned2 = false;
    warned1 = false;
    if (status) status.textContent = "";
    paint();
  });

  setPreset(5);
}

init();
