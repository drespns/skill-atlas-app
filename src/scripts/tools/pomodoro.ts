const LS = "skillatlas_tools_pomodoro_v1";

type Stats = { date: string; completed: number };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) {
      const p = JSON.parse(raw) as Stats;
      if (p && p.date === todayKey()) return p;
    }
  } catch {
    /* ignore */
  }
  return { date: todayKey(), completed: 0 };
}

function saveStats(s: Stats) {
  localStorage.setItem(LS, JSON.stringify(s));
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.start();
    window.setTimeout(() => {
      o.stop();
      ctx.close();
    }, 180);
  } catch {
    /* ignore */
  }
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-pomodoro-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const display = root.querySelector<HTMLElement>("[data-pomo-display]");
  const phaseEl = root.querySelector<HTMLElement>("[data-pomo-phase]");
  const statEl = root.querySelector<HTMLElement>("[data-pomo-stat]");
  const workIn = root.querySelector<HTMLInputElement>("[data-pomo-work]");
  const breakIn = root.querySelector<HTMLInputElement>("[data-pomo-break]");
  const btnStart = root.querySelector<HTMLButtonElement>("[data-pomo-start]");
  const btnPause = root.querySelector<HTMLButtonElement>("[data-pomo-pause]");
  const btnReset = root.querySelector<HTMLButtonElement>("[data-pomo-reset]");

  let stats = loadStats();
  let phase: "work" | "break" = "work";
  let remainingMs = 25 * 60 * 1000;
  let timer: number | null = null;
  let lastTick = 0;

  const workMs = () => Math.max(1, Number(workIn?.value) || 25) * 60 * 1000;
  const breakMs = () => Math.max(1, Number(breakIn?.value) || 5) * 60 * 1000;

  const fmt = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  const paint = () => {
    if (display) display.textContent = fmt(remainingMs);
    if (phaseEl) phaseEl.textContent = phase === "work" ? "Enfoque" : "Descanso";
    if (statEl) statEl.textContent = `Pomodoros hoy: ${stats.completed}`;
  };

  const refreshStats = () => {
    stats = loadStats();
    if (stats.date !== todayKey()) {
      stats = { date: todayKey(), completed: 0 };
      saveStats(stats);
    }
    paint();
  };

  const tick = (now: number) => {
    if (!lastTick) lastTick = now;
    const dt = now - lastTick;
    lastTick = now;
    remainingMs -= dt;
    if (remainingMs <= 0) {
      beep();
      if (phase === "work") {
        stats.completed++;
        saveStats(stats);
        phase = "break";
        remainingMs = breakMs();
      } else {
        phase = "work";
        remainingMs = workMs();
      }
      lastTick = 0;
    }
    paint();
    timer = window.requestAnimationFrame(tick);
  };

  const stopTimer = () => {
    if (timer !== null) {
      cancelAnimationFrame(timer);
      timer = null;
    }
    lastTick = 0;
  };

  btnStart?.addEventListener("click", () => {
    if (timer !== null) return;
    lastTick = 0;
    timer = window.requestAnimationFrame(tick);
  });

  btnPause?.addEventListener("click", () => {
    stopTimer();
  });

  btnReset?.addEventListener("click", () => {
    stopTimer();
    phase = "work";
    remainingMs = workMs();
    paint();
  });

  workIn?.addEventListener("change", () => {
    if (phase === "work" && timer === null) remainingMs = workMs();
    paint();
  });
  breakIn?.addEventListener("change", () => {
    if (phase === "break" && timer === null) remainingMs = breakMs();
    paint();
  });

  remainingMs = workMs();
  refreshStats();
  paint();
}

init();
