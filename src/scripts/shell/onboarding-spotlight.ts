import i18next from "i18next";
import { loadPrefs, updatePrefs } from "@scripts/core/prefs";
import { showToast } from "@scripts/core/ui-feedback";

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

function currentPath(): string {
  return (window.location.pathname || "/").replace(/\/$/, "") || "/";
}

function isOnRoute(target: string): boolean {
  const p = currentPath();
  const t = target.split("#")[0].replace(/\/$/, "") || "/";
  return t === "/" ? p === "/" : p === t || p.startsWith(`${t}/`);
}

type Step = {
  id: string;
  titleKey: string;
  titleFallback: string;
  bodyKey: string;
  bodyFallback: string;
  route: string;
  selector?: string;
  optional?: boolean;
  cta?: { route: string; labelKey: string; labelFallback: string };
  action?: "pasteTableauAndOpenModal" | "assist" | "openCvPreview";
};

const TABLEAU_EXAMPLE =
  "https://public.tableau.com/views/VGContest_AAPLTicker_YuriFal/AAPL?:language=es-ES&:sid=&:redirect=auth&showOnboarding=true&:display_count=n&:origin=viz_share_link";

const STEPS: Step[] = [
  {
    id: "tech_search",
    route: "/technologies",
    selector: "[data-tech-name-input]",
    titleKey: "onboardingV2.step1Title",
    titleFallback: "1/7 · Añade una tecnología",
    bodyKey: "onboardingV2.step1Body",
    bodyFallback: "Usa el buscador para crear una tecnología (por ejemplo: Tableau, Python, dbt…).",
    cta: { route: "/technologies", labelKey: "onboarding.goTechnologies", labelFallback: "Ir a Tecnologías" },
    action: "assist",
  },
  {
    id: "tech_seed_optional",
    route: "/technologies/view",
    selector: "[data-concept-import]",
    optional: true,
    titleKey: "onboardingV2.step2Title",
    titleFallback: "2/7 (opcional) · Catálogo sugerido",
    bodyKey: "onboardingV2.step2Body",
    bodyFallback:
      "En el detalle de una tecnología, puedes cargar un catálogo sugerido e importar conceptos rápidamente.",
    cta: { route: "/technologies", labelKey: "onboarding.goTechnologies", labelFallback: "Ir a Tecnologías" },
    action: "assist",
  },
  {
    id: "project_form",
    route: "/projects",
    selector: "form[data-project-form]",
    titleKey: "onboardingV2.step3Title",
    titleFallback: "3/7 · Crea un proyecto",
    bodyKey: "onboardingV2.step3Body",
    bodyFallback: "Rellena título, descripción y (opcional) rol e impacto para dar contexto.",
    cta: { route: "/projects", labelKey: "onboarding.goProjects", labelFallback: "Ir a Proyectos" },
    action: "assist",
  },
  {
    id: "project_embed_tableau",
    route: "/projects/view",
    selector: "[data-project-evidence-quick-url]",
    titleKey: "onboardingV2.step4Title",
    titleFallback: "4/7 · Prueba un embed (Tableau)",
    bodyKey: "onboardingV2.step4Body",
    bodyFallback:
      "Pega un enlace de Tableau Public y añádelo como iframe para ver cómo se muestra en el portfolio.",
    cta: { route: "/projects", labelKey: "onboarding.goProjects", labelFallback: "Ir a Proyectos" },
    action: "pasteTableauAndOpenModal",
  },
  {
    id: "settings_profile",
    route: "/settings#prefs",
    selector: "[data-profile-public-name]",
    titleKey: "onboardingV2.step5Title",
    titleFallback: "5/7 · Perfil y privacidad",
    bodyKey: "onboardingV2.step5Body",
    bodyFallback:
      "Completa tu nombre y bio, ajusta la privacidad de portfolio/CV y añade tu stack de ayuda.",
    cta: { route: "/settings#prefs", labelKey: "onboarding.goSettings", labelFallback: "Ir a Ajustes" },
    action: "assist",
  },
  {
    id: "portfolio_preview",
    route: "/portfolio",
    selector: "[data-portfolio-public-name]",
    titleKey: "onboardingV2.step6Title",
    titleFallback: "6/7 · Revisa tu portfolio",
    bodyKey: "onboardingV2.step6Body",
    bodyFallback: "Mira cómo se ve tu portfolio y sigue añadiendo más proyectos.",
    cta: { route: "/portfolio", labelKey: "onboarding.goPortfolio", labelFallback: "Ir a Portfolio" },
  },
  {
    id: "cv_preview",
    route: "/cv",
    selector: "[data-cv-preview-open]",
    titleKey: "onboardingV2.step7Title",
    titleFallback: "7/7 · CV y preview",
    bodyKey: "onboardingV2.step7Body",
    bodyFallback: "Abre Preview para ver tu CV completo y luego imprime/guarda como PDF.",
    cta: { route: "/cv", labelKey: "onboarding.goCv", labelFallback: "Ir a CV" },
    action: "openCvPreview",
  },
];

function ensureRoot() {
  let root = document.querySelector<HTMLElement>("[data-guided-tour-root]");
  if (!root) {
    root = document.createElement("div");
    root.dataset.guidedTourRoot = "1";
    document.body.appendChild(root);
  }
  return root;
}

function withinViewport(rect: DOMRect) {
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function scrollIntoViewIfNeeded(el: Element) {
  try {
    (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  } catch {
    // ignore
  }
}

function markCompleted(stepId: string) {
  const p = loadPrefs();
  const completed = new Set<string>(Array.isArray(p.onboardingV2?.completedIds) ? p.onboardingV2?.completedIds : []);
  completed.add(stepId);
  updatePrefs({
    onboardingV2: {
      done: false,
      step: p.onboardingV2?.step ?? 0,
      dismissed: false,
      completedIds: Array.from(completed),
    } as any,
  });
}

function setStep(n: number) {
  const p = loadPrefs();
  updatePrefs({
    onboardingV2: {
      done: false,
      step: n,
      dismissed: false,
      completedIds: p.onboardingV2?.completedIds ?? [],
    } as any,
  });
}

function finish() {
  const p = loadPrefs();
  updatePrefs({
    onboardingV2: {
      done: true,
      step: STEPS.length - 1,
      dismissed: true,
      completedIds: p.onboardingV2?.completedIds ?? [],
    } as any,
  });
}

function dismiss() {
  const p = loadPrefs();
  updatePrefs({
    onboardingV2: {
      done: false,
      step: p.onboardingV2?.step ?? 0,
      dismissed: true,
      completedIds: p.onboardingV2?.completedIds ?? [],
    } as any,
  });
}

async function pasteTableauAndOpenModal() {
  const urlInput = document.querySelector<HTMLInputElement>("[data-project-evidence-quick-url]");
  const openBtn = document.querySelector<HTMLButtonElement>("[data-project-evidence-quick-open]");
  if (!urlInput || !openBtn) return;
  urlInput.value = TABLEAU_EXAMPLE;
  urlInput.dispatchEvent(new Event("input", { bubbles: true }));
  urlInput.focus();
  urlInput.select();
  openBtn.click();

  // Wait for modal and force iframe kind.
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const kindSel = document.querySelector<HTMLSelectElement>("[data-modal-kind]");
    if (kindSel) {
      kindSel.value = "iframe";
      kindSel.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

function assistStep(stepId: string) {
  // Each step prepares the UI with realistic example data
  // but leaves the final action to the user (freedom-first).
  if (stepId === "tech_search") {
    const input = document.querySelector<HTMLInputElement>("[data-tech-name-input]");
    const form = document.querySelector<HTMLFormElement>("[data-tech-form]");
    if (!input || !form) return;
    if (input.disabled) {
      showToast(tt("onboardingV2.needSession", "Inicia sesión para poder crear datos."), "warning");
      return;
    }
    input.focus();
    input.select();
    // Hint: show suggestions if available.
    input.dispatchEvent(new Event("focus", { bubbles: true }));
    showToast(tt("onboardingV2.youDecideSaveTech", "Escribe el nombre y pulsa Guardar cuando quieras."), "success");
    return;
  }

  if (stepId === "tech_seed_optional") {
    const seedBtn = document.querySelector<HTMLButtonElement>("[data-import-load-seed]");
    if (seedBtn) {
      seedBtn.click();
      showToast(tt("onboardingV2.seedLoaded", "Catálogo cargado. Ahora genera vista previa o importa rápido."), "success");
      return;
    }
    showToast(tt("onboardingV2.noSeedHere", "En esta tecnología no hay catálogo sugerido."), "warning");
    return;
  }

  if (stepId === "project_form") {
    const form = document.querySelector<HTMLFormElement>("[data-project-form]");
    if (!form) return;
    const titleInput = form.querySelector<HTMLInputElement>("[name='title']");
    const descInput = form.querySelector<HTMLTextAreaElement>("[name='description']");
    const roleInput = form.querySelector<HTMLInputElement>("[name='role']");
    const outcomeInput = form.querySelector<HTMLInputElement>("[name='outcome']");
    if (!titleInput || !descInput) return;
    if (titleInput.disabled) {
      showToast(tt("onboardingV2.needSession", "Inicia sesión para poder crear datos."), "warning");
      return;
    }
    titleInput.value = "Dashboard de mercado (Tableau)";
    descInput.value = "Mini proyecto de ejemplo para probar evidencias y embeds en el portfolio.";
    if (roleInput) roleInput.value = "Data Analyst";
    if (outcomeInput) outcomeInput.value = "Dashboard publicado y documentado (demo).";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    descInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput.focus();
    titleInput.select();
    showToast(tt("onboardingV2.youDecideSaveProject", "Revisa el ejemplo y pulsa Guardar proyecto cuando quieras."), "success");
    return;
  }

  if (stepId === "settings_profile") {
    const nameInput = document.querySelector<HTMLInputElement>("[data-profile-public-name]");
    const bioInput = document.querySelector<HTMLTextAreaElement>("[data-profile-public-bio]");
    const saveBtn = document.querySelector<HTMLButtonElement>("[data-profile-save]");
    if (!nameInput || !bioInput || !saveBtn) return;
    nameInput.value = nameInput.value.trim() || "Tu Nombre";
    bioInput.value =
      bioInput.value.trim() ||
      "Data / Analytics · Portfolio en construcción. Me gusta construir productos y dashboards con buen storytelling.";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    bioInput.dispatchEvent(new Event("input", { bubbles: true }));

    // Suggest a small help stack selection if none chosen.
    const anyChecked = Boolean(document.querySelector("input[data-help-stack-key]:checked"));
    if (!anyChecked) {
      const candidates = ["tableau", "powerbi", "sql", "python", "dbt"];
      for (const k of candidates) {
        const cb = document.querySelector<HTMLInputElement>(`input[data-help-stack-key][data-help-stack-key="${CSS.escape(k)}"]`);
        if (cb) cb.checked = true;
      }
    }
    nameInput.focus();
    nameInput.select();
    showToast(tt("onboardingV2.youDecideSaveSettings", "Cuando lo tengas listo, pulsa Guardar perfil."), "success");
    return;
  }

  if (stepId === "cv_preview") {
    const btn = document.querySelector<HTMLButtonElement>("[data-cv-preview-open]");
    if (!btn) return;
    btn.click();
    return;
  }
}

function render(stepIdx: number) {
  const prefs = loadPrefs();
  if (prefs.onboardingV2?.done) return;

  const idx = Math.max(0, Math.min(STEPS.length - 1, stepIdx));
  const step = STEPS[idx];
  const completed = new Set<string>(Array.isArray(prefs.onboardingV2?.completedIds) ? prefs.onboardingV2?.completedIds : []);
  const doneCount = Array.from(completed).filter((id) => STEPS.some((s) => s.id === id)).length;

  const root = ensureRoot();
  root.innerHTML = "";

  const overlay = document.createElement("div");
  // Non-blocking overlay: user can interact with the highlighted UI.
  // Only the tip card should capture pointer events.
  overlay.className = "fixed inset-0 z-[1200] pointer-events-none";
  overlay.innerHTML = `
    <div data-v2-backdrop class="absolute inset-0 pointer-events-none transition-opacity duration-150 sa-guided-tour-backdrop"></div>
    <div data-v2-hole class="sa-guided-tour-hole absolute rounded-xl pointer-events-none"></div>
    <div data-v2-pill-wrap class="hidden fixed z-1201 left-3 bottom-3 pointer-events-auto items-center gap-2">
      <button
        type="button"
        data-v2-pill-open
        class="header-settings-rainbow"
        aria-label="${esc(tt("onboardingV2.open", "Abrir recorrido guiado"))}"
        title="${esc(tt("onboardingV2.open", "Abrir recorrido guiado"))}"
      >
        <span class="header-settings-rainbow__inner px-3 py-2 text-sm font-semibold whitespace-nowrap">
          ${esc(tt("onboardingV2.open", "Abrir recorrido guiado"))}
        </span>
      </button>
      <button
        type="button"
        data-v2-pill-close
        class="rounded-full border border-pink-200/80 dark:border-pink-900/40 bg-pink-50/90 dark:bg-pink-950/45 backdrop-blur px-3 py-2 text-sm font-semibold text-pink-700 dark:text-pink-200 shadow-lg hover:bg-pink-100/90 dark:hover:bg-pink-950/60"
      >
        ${esc(tt("onboardingV2.close", "Cerrar"))}
      </button>
    </div>
    <div data-v2-tip class="absolute w-[min(92vw,34rem)] rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-xl overflow-hidden pointer-events-auto">
      <div data-v2-drag-handle class="px-5 py-4 border-b border-gray-200/80 dark:border-gray-800 flex flex-col gap-3 cursor-move select-none">
        <div class="min-w-0 w-full">
          <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400">${esc(tt("onboardingV2.kicker", "Recorrido guiado"))} · ${doneCount}/${STEPS.length}</p>
          <h3 class="m-0 mt-1 text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 text-balance">${esc(tt(step.titleKey, step.titleFallback))}</h3>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2 w-full">
          <button type="button" data-v2-min class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 px-2.5 py-1.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
            ${esc(tt("onboardingV2.minimize", "Ocultar"))}
          </button>
          <button type="button" data-v2-pause-later class="inline-flex items-center justify-center rounded-lg border border-indigo-200/90 dark:border-indigo-800/80 bg-indigo-50/90 dark:bg-indigo-950/50 px-2.5 py-1.5 text-sm font-semibold text-indigo-900 dark:text-indigo-100 hover:bg-indigo-100/90 dark:hover:bg-indigo-950/70">
            ${esc(tt("guidedTour.continueLater", "Continuar más tarde"))}
          </button>
          <button type="button" data-v2-skip class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 px-2.5 py-1.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
            ${esc(tt("guidedTour.skipEnd", "Salir del recorrido"))}
          </button>
        </div>
      </div>
      <div class="px-5 py-4 space-y-3">
        <p class="m-0 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${esc(tt(step.bodyKey, step.bodyFallback))}</p>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" data-v2-mark class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
            ${esc(tt("onboarding.markDone", "Marcar como hecho"))}
          </button>
          ${
            step.action === "assist" && isOnRoute(step.route)
              ? `<button type="button" data-v2-assist class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-200">
                  ${esc(tt("onboardingV2.assist", "Rellenar ejemplo"))}
                </button>`
              : ""
          }
          ${
            step.action === "pasteTableauAndOpenModal" && isOnRoute(step.route)
              ? `<button type="button" data-v2-action class="inline-flex items-center justify-center rounded-lg bg-emerald-700 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-800">
                  ${esc(tt("onboardingV2.pasteTableau", "Pegar ejemplo Tableau (iframe)"))}
                </button>`
              : ""
          }
          ${
            step.action === "openCvPreview" && isOnRoute(step.route)
              ? `<button type="button" data-v2-cv-preview class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-200">
                  ${esc(tt("onboardingV2.openPreview", "Abrir preview"))}
                </button>`
              : ""
          }
          ${
            step.optional
              ? `<button type="button" data-v2-optional-skip class="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:underline">
                  ${esc(tt("onboardingV2.skipOptional", "Saltar (opcional)"))}
                </button>`
              : ""
          }
        </div>
      </div>
      <div class="px-5 py-4 border-t border-gray-200/80 dark:border-gray-800 flex items-center justify-between gap-3">
        <button type="button" data-v2-back class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
          ${esc(tt("onboarding.back", "Atrás"))}
        </button>
        <div class="flex items-center gap-2">
          <button type="button" data-v2-cta class="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
            ${esc(tt(step.cta?.labelKey ?? "onboardingV2.go", step.cta?.labelFallback ?? "Ir"))}
          </button>
          <button type="button" data-v2-next class="inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700">
            ${esc(tt("onboarding.next", "Siguiente"))}
          </button>
        </div>
      </div>
    </div>
  `;

  root.appendChild(overlay);

  const backdrop = overlay.querySelector<HTMLElement>("[data-v2-backdrop]")!;
  const hole = overlay.querySelector<HTMLElement>("[data-v2-hole]")!;
  const tip = overlay.querySelector<HTMLElement>("[data-v2-tip]")!;
  const pillWrap = overlay.querySelector<HTMLElement>("[data-v2-pill-wrap]")!;
  const pillOpen = overlay.querySelector<HTMLButtonElement>("[data-v2-pill-open]")!;
  const pillClose = overlay.querySelector<HTMLButtonElement>("[data-v2-pill-close]")!;
  const skipBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-skip]")!;
  const pauseLaterBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-pause-later]")!;
  const minBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-min]")!;
  const dragHandle = overlay.querySelector<HTMLElement>("[data-v2-drag-handle]")!;
  const backBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-back]")!;
  const nextBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-next]")!;
  const markBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-mark]")!;
  const ctaBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-cta]")!;
  const optionalSkip = overlay.querySelector<HTMLButtonElement>("[data-v2-optional-skip]");
  const actionBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-action]");
  const assistBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-assist]");
  const cvPreviewBtn = overlay.querySelector<HTMLButtonElement>("[data-v2-cv-preview]");

  let isMinimized = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragActive = false;

  const setMinimized = (v: boolean) => {
    isMinimized = v;
    if (isMinimized) {
      tip.classList.add("hidden");
      pillWrap.classList.remove("hidden");
      pillWrap.classList.add("flex");
      // When minimized, remove "modal" visuals so the app looks normal.
      backdrop.classList.add("opacity-0");
      hole.classList.add("hidden");
    } else {
      pillWrap.classList.add("hidden");
      pillWrap.classList.remove("flex");
      tip.classList.remove("hidden");
      backdrop.classList.remove("opacity-0");
      // Hole will be positioned by place()
    }
  };

  const pointerToClient = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const enableDrag = () => {
    if (!dragHandle) return;
    if (dragHandle.dataset.bound === "1") return;
    dragHandle.dataset.bound = "1";

    dragHandle.addEventListener("pointerdown", (e) => {
      // Only drag with primary button (mouse) or touch/pen.
      if ((e as any).button != null && (e as any).button !== 0) return;
      dragActive = true;
      const rect = tip.getBoundingClientRect();
      const p = pointerToClient(e);
      dragOffsetX = p.x - rect.left;
      dragOffsetY = p.y - rect.top;
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      e.preventDefault();
    });

    dragHandle.addEventListener("pointermove", (e) => {
      if (!dragActive || isMinimized) return;
      const p = pointerToClient(e);
      const tipW = tip.getBoundingClientRect().width;
      const tipH = tip.getBoundingClientRect().height;
      const left = clamp(p.x - dragOffsetX, 8, window.innerWidth - tipW - 8);
      const top = clamp(p.y - dragOffsetY, 8, window.innerHeight - tipH - 8);
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      // When user drags, we stop "auto place" from overwriting position.
      (tip as any).__skillatlasUserPlaced = true;
    });

    const endDrag = () => {
      dragActive = false;
    };
    dragHandle.addEventListener("pointerup", endDrag);
    dragHandle.addEventListener("pointercancel", endDrag);
  };

  const place = () => {
    // Respect user manual placement.
    if ((tip as any).__skillatlasUserPlaced === true && !isMinimized) return;
    if (isMinimized) return;
    let target: Element | null = null;
    if (step.selector && isOnRoute(step.route)) {
      target = document.querySelector(step.selector);
      // Optional step: prefer the seed button if present.
      if (step.id === "tech_seed_optional") {
        const seedBtn = document.querySelector("[data-import-load-seed]");
        if (seedBtn) target = seedBtn;
      }
    }

    if (target) {
      const rect = (target as HTMLElement).getBoundingClientRect();
      if (!withinViewport(rect)) {
        scrollIntoViewIfNeeded(target);
      }
      const r = (target as HTMLElement).getBoundingClientRect();
      const pad = 10;
      const x = Math.max(8, r.left - pad);
      const y = Math.max(8, r.top - pad);
      const w = Math.min(window.innerWidth - 16, r.width + pad * 2);
      const h = Math.min(window.innerHeight - 16, r.height + pad * 2);
      hole.style.left = `${x}px`;
      hole.style.top = `${y}px`;
      hole.style.width = `${w}px`;
      hole.style.height = `${h}px`;
      hole.classList.remove("hidden");

      const tipW = Math.min(window.innerWidth - 16, 544);
      tip.style.width = `${tipW}px`;
      const below = y + h + 14;
      const above = y - 14;
      const tipTop = below + 220 < window.innerHeight ? below : Math.max(8, above - 220);
      const tipLeft = Math.min(window.innerWidth - tipW - 8, Math.max(8, x));
      tip.style.left = `${tipLeft}px`;
      tip.style.top = `${tipTop}px`;
    } else {
      hole.classList.add("hidden");
      const tipW = Math.min(window.innerWidth - 16, 544);
      tip.style.width = `${tipW}px`;
      tip.style.left = `${Math.max(8, (window.innerWidth - tipW) / 2)}px`;
      tip.style.top = "72px";
    }
  };

  place();
  window.addEventListener("resize", place, { once: true });
  enableDrag();

  skipBtn.addEventListener("click", () => {
    finish();
    root.innerHTML = "";
  });

  pauseLaterBtn.addEventListener("click", () => {
    dismiss();
    root.innerHTML = "";
    showToast(
      tt("guidedTour.continueLaterToast", "Puedes reanudar el recorrido cuando quieras desde el dashboard: «Recorrido guiado»."),
      "info",
    );
  });

  minBtn.addEventListener("click", () => setMinimized(true));
  pillOpen.addEventListener("click", () => {
    setMinimized(false);
    place();
  });
  pillClose.addEventListener("click", () => {
    dismiss();
    root.innerHTML = "";
    showToast(
      tt("guidedTour.continueLaterToast", "Puedes reanudar el recorrido cuando quieras desde el dashboard: «Recorrido guiado»."),
      "info",
    );
  });

  backBtn.addEventListener("click", () => {
    const cur = loadPrefs().onboardingV2?.step ?? 0;
    const prev = Math.max(0, cur - 1);
    setStep(prev);
    render(prev);
  });

  nextBtn.addEventListener("click", () => {
    const cur = loadPrefs().onboardingV2?.step ?? 0;
    const nxt = Math.min(STEPS.length - 1, cur + 1);
    setStep(nxt);
    render(nxt);
  });

  markBtn.addEventListener("click", () => {
    markCompleted(step.id);
    const cur = loadPrefs().onboardingV2?.step ?? 0;
    const nxt = Math.min(STEPS.length - 1, cur + 1);
    setStep(nxt);
    render(nxt);
  });

  optionalSkip?.addEventListener("click", () => {
    markCompleted(step.id);
    const cur = loadPrefs().onboardingV2?.step ?? 0;
    const nxt = Math.min(STEPS.length - 1, cur + 1);
    setStep(nxt);
    render(nxt);
  });

  ctaBtn.addEventListener("click", () => {
    const route = step.cta?.route ?? step.route;
    if (!isOnRoute(route)) {
      window.location.href = route;
      return;
    }
    place();
  });

  actionBtn?.addEventListener("click", async () => {
    if (step.action === "pasteTableauAndOpenModal") {
      setMinimized(true);
      await pasteTableauAndOpenModal();
    }
  });

  assistBtn?.addEventListener("click", () => {
    if (step.action !== "assist") return;
    if (!isOnRoute(step.route)) return;
    setMinimized(true);
    assistStep(step.id);
  });

  cvPreviewBtn?.addEventListener("click", () => {
    if (step.action !== "openCvPreview") return;
    if (!isOnRoute(step.route)) return;
    const btn = document.querySelector<HTMLButtonElement>("[data-cv-preview-open]");
    if (!btn) return;
    setMinimized(true);
    btn.click();
  });

  // Auto-minimize when user focuses an input outside the tip (so it doesn't cover typing).
  const onFocusIn = (e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (tip.contains(t)) return;
    const tag = (t.tagName || "").toLowerCase();
    const isField = tag === "input" || tag === "textarea" || tag === "select";
    if (isField) setMinimized(true);
  };
  document.addEventListener("focusin", onFocusIn);

  // Best-effort cleanup when tip is removed.
  const obs = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      document.removeEventListener("focusin", onFocusIn);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

function shouldAutoShow(): boolean {
  const p = loadPrefs();
  if (p.onboardingV2?.done) return false;
  if (p.onboardingV2?.dismissed) return false;
  const path = currentPath();
  if (path === "/login" || path === "/pricing" || path === "/") return false;
  return true;
}

function boot() {
  if (!shouldAutoShow()) return;
  const p = loadPrefs();
  const step = Math.max(0, Math.min(STEPS.length - 1, Number(p.onboardingV2?.step ?? 0)));
  render(step);
}

function startFromBeginning() {
  updatePrefs({ onboardingV2: { done: false, step: 0, dismissed: false, completedIds: [] } as any });
  render(0);
}

/** Desde /app: si ya terminó el recorrido, empezar de cero; si no, reanudar el paso guardado. */
function openGuidedTourFromDashboard() {
  const p = loadPrefs();
  if (p.onboardingV2?.done) {
    startFromBeginning();
    return;
  }
  const step = Math.max(0, Math.min(STEPS.length - 1, Number(p.onboardingV2?.step ?? 0)));
  updatePrefs({
    onboardingV2: {
      done: false,
      dismissed: false,
      step,
      completedIds: p.onboardingV2?.completedIds ?? [],
    } as any,
  });
  render(step);
}

if ((window as any).__skillatlasGuidedTourBound !== true) {
  (window as any).__skillatlasGuidedTourBound = true;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("astro:page-load", boot as any);
  document.addEventListener("astro:after-swap", boot as any);
  window.addEventListener("skillatlas:guided-tour-start", () => openGuidedTourFromDashboard());
}

