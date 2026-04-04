import i18next from "i18next";
import { loadPrefs, updatePrefs } from "./prefs";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Step = {
  id: string;
  route: string;
  titleKey: string;
  titleFallback: string;
  bodyKey: string;
  bodyFallback: string;
  ctaRoute: string;
  ctaKey: string;
  ctaFallback: string;
};

const STEPS: Step[] = [
  {
    id: "technologies",
    route: "/technologies",
    titleKey: "onboarding.step1Title",
    titleFallback: "1/5 · Crea tu primera tecnología",
    bodyKey: "onboarding.step1Body",
    bodyFallback: "Empieza creando una tecnología y añade conceptos desde su detalle.",
    ctaRoute: "/technologies",
    ctaKey: "onboarding.goTechnologies",
    ctaFallback: "Ir a Tecnologías",
  },
  {
    id: "projects",
    route: "/projects",
    titleKey: "onboarding.step2Title",
    titleFallback: "2/5 · Crea un proyecto",
    bodyKey: "onboarding.step2Body",
    bodyFallback: "Crea un proyecto y asócialo a tecnologías (y luego conceptos).",
    ctaRoute: "/projects",
    ctaKey: "onboarding.goProjects",
    ctaFallback: "Ir a Proyectos",
  },
  {
    id: "settings",
    route: "/settings",
    titleKey: "onboarding.step3Title",
    titleFallback: "3/5 · Ajusta tu perfil",
    bodyKey: "onboarding.step3Body",
    bodyFallback: "Completa tu nombre, bio, avatar y configura enlaces públicos.",
    ctaRoute: "/settings",
    ctaKey: "onboarding.goSettings",
    ctaFallback: "Ir a Ajustes",
  },
  {
    id: "portfolio",
    route: "/portfolio",
    titleKey: "onboarding.step4Title",
    titleFallback: "4/5 · Publica tu portfolio",
    bodyKey: "onboarding.step4Body",
    bodyFallback: "Activa tu URL pública (slug o token) y prueba el enlace en incógnito.",
    ctaRoute: "/portfolio",
    ctaKey: "onboarding.goPortfolio",
    ctaFallback: "Ir a Portfolio",
  },
  {
    id: "cv",
    route: "/cv",
    titleKey: "onboarding.step5Title",
    titleFallback: "5/5 · Construye tu CV",
    bodyKey: "onboarding.step5Body",
    bodyFallback: "Completa tu CV, previsualiza y exporta con imprimir/PDF.",
    ctaRoute: "/cv",
    ctaKey: "onboarding.goCv",
    ctaFallback: "Ir a CV",
  },
];

function currentPath(): string {
  return (window.location.pathname || "/").replace(/\/$/, "") || "/";
}

function isOnRoute(target: string): boolean {
  const p = currentPath();
  const t = target.replace(/\/$/, "") || "/";
  return t === "/" ? p === "/" : p === t || p.startsWith(`${t}/`);
}

function ensureRoot() {
  let root = document.querySelector<HTMLElement>("[data-onboarding-root]");
  if (!root) {
    root = document.createElement("div");
    root.dataset.onboardingRoot = "1";
    document.body.appendChild(root);
  }
  return root;
}

function render(stepIdx: number) {
  const prefs = loadPrefs();
  const done = Boolean(prefs.onboardingV1?.done);
  if (done) return;

  const s = STEPS[Math.max(0, Math.min(STEPS.length - 1, stepIdx))];
  const completed = new Set<string>(Array.isArray(prefs.onboardingV1?.completedIds) ? prefs.onboardingV1?.completedIds : []);
  const completedCount = Array.from(completed).filter((id) => STEPS.some((x) => x.id === id)).length;
  const isCompleted = completed.has(s.id);
  const root = ensureRoot();

  root.innerHTML = `
    <div class="fixed inset-0 z-1100 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div class="w-full max-w-xl rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200/80 dark:border-gray-800 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400">${esc(tt("onboarding.kicker", "Primeros pasos"))}</p>
            <h3 class="m-0 mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">${esc(tt(s.titleKey, s.titleFallback))}</h3>
            <p class="m-0 mt-1 text-xs text-gray-500 dark:text-gray-400">${esc(tt("onboarding.progress", "Progreso:"))} ${completedCount}/${STEPS.length}</p>
          </div>
          <button type="button" data-onboarding-skip class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 px-2.5 py-1.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
            ${esc(tt("onboarding.skip", "Saltar"))}
          </button>
        </div>
        <div class="px-5 py-4 space-y-4">
          <p class="m-0 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${esc(tt(s.bodyKey, s.bodyFallback))}</p>

          <div class="rounded-xl border border-gray-200/70 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/20 p-3 text-sm text-gray-700 dark:text-gray-200 flex flex-wrap items-center justify-between gap-3">
            <span>${esc(tt("onboarding.currentPage", "Página actual:"))} <span class="font-mono text-xs">${esc(currentPath())}</span></span>
            <button type="button" data-onboarding-cta class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-semibold hover:opacity-90">
              ${esc(tt(s.ctaKey, s.ctaFallback))}
            </button>
          </div>
        </div>
        <div class="px-5 py-4 border-t border-gray-200/80 dark:border-gray-800 flex items-center justify-between gap-3">
          <button type="button" data-onboarding-back class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
            ${esc(tt("onboarding.back", "Atrás"))}
          </button>
          <div class="flex items-center gap-2">
            <button type="button" data-onboarding-done class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
              ${esc(isCompleted ? tt("onboarding.markUndone", "Desmarcar") : tt("onboarding.markDone", "Marcar como hecho"))}
            </button>
            <button type="button" data-onboarding-next class="inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700">
              ${esc(tt("onboarding.next", "Siguiente"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const skipBtn = root.querySelector<HTMLButtonElement>("[data-onboarding-skip]");
  const backBtn = root.querySelector<HTMLButtonElement>("[data-onboarding-back]");
  const nextBtn = root.querySelector<HTMLButtonElement>("[data-onboarding-next]");
  const doneBtn = root.querySelector<HTMLButtonElement>("[data-onboarding-done]");
  const ctaBtn = root.querySelector<HTMLButtonElement>("[data-onboarding-cta]");

  const setStep = (n: number) =>
    updatePrefs({
      onboardingV1: {
        done: false,
        step: n,
        completedIds: Array.from(completed),
      } as any,
    });
  const finish = () =>
    updatePrefs({
      onboardingV1: { done: true, step: STEPS.length - 1, completedIds: Array.from(completed) } as any,
    });
  const toggleCompleted = (id: string) => {
    if (completed.has(id)) completed.delete(id);
    else completed.add(id);
    updatePrefs({ onboardingV1: { done: false, step: loadPrefs().onboardingV1?.step ?? 0, completedIds: Array.from(completed) } as any });
  };

  skipBtn?.addEventListener("click", () => {
    finish();
    root.innerHTML = "";
  });

  backBtn?.addEventListener("click", () => {
    const cur = loadPrefs().onboardingV1?.step ?? 0;
    const prev = Math.max(0, cur - 1);
    setStep(prev);
    render(prev);
  });

  nextBtn?.addEventListener("click", () => {
    const cur = loadPrefs().onboardingV1?.step ?? 0;
    const nxt = Math.min(STEPS.length - 1, cur + 1);
    setStep(nxt);
    render(nxt);
  });

  doneBtn?.addEventListener("click", () => {
    const cur = loadPrefs().onboardingV1?.step ?? 0;
    const step = STEPS[Math.max(0, Math.min(STEPS.length - 1, cur))];
    if (step) toggleCompleted(step.id);
    // Re-render same step to reflect completed state.
    render(cur);
  });

  ctaBtn?.addEventListener("click", () => {
    if (!isOnRoute(s.ctaRoute)) {
      window.location.href = s.ctaRoute;
      return;
    }
    // Already on the target page: just advance.
    nextBtn?.click();
  });
}

function shouldShow(): boolean {
  const p = loadPrefs();
  const done = Boolean(p.onboardingV1?.done);
  if (done) return false;
  // Avoid showing on login/pricing/landing by default.
  const path = currentPath();
  if (path === "/login" || path === "/pricing" || path === "/") return false;
  return true;
}

function boot() {
  if (!shouldShow()) return;
  const p = loadPrefs();
  const step = Math.max(0, Math.min(STEPS.length - 1, Number(p.onboardingV1?.step ?? 0)));
  render(step);
}

function startFromBeginning() {
  updatePrefs({ onboardingV1: { done: false, step: 0, completedIds: [] } as any });
  render(0);
}

if ((window as any).__skillatlasOnboardingBound !== true) {
  (window as any).__skillatlasOnboardingBound = true;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("astro:page-load", boot as any);
  document.addEventListener("astro:after-swap", boot as any);
  window.addEventListener("skillatlas:onboarding-start", () => startFromBeginning());
}

