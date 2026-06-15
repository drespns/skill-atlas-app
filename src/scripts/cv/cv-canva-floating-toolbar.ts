import i18next from "i18next";
import type { CvHeroFontKey, CvStudioCanvasLayoutV1 } from "@lib/cv-studio-layout";
import {
  cycleActiveSocialLinkDisplay,
  patchActiveCanvasLayout,
} from "@scripts/cv/cv-canva-inline-edit";

function tt(key: string, fb: string): string {
  try {
    if (!i18next.isInitialized) return fb;
    const v = i18next.t(key);
    return typeof v === "string" && v.length > 0 && v !== key ? v : fb;
  } catch {
    return fb;
  }
}

/**
 * Barra de formato fija (estilo Canva): bajo los ajustes del documento; no cubre la selección.
 */
export function setupCvCanvaFormatToolbar(opts: { docPanel: HTMLElement; formatBarHost: HTMLElement }) {
  const { docPanel, formatBarHost } = opts;
  if (formatBarHost.dataset.cvCanvaFormatToolbar === "1") return;
  formatBarHost.dataset.cvCanvaFormatToolbar = "1";

  formatBarHost.setAttribute("role", "region");
  formatBarHost.setAttribute("aria-label", tt("cv.canvaFormatToolbarAria", "Text formatting"));

  const idle = document.createElement("p");
  idle.className =
    "m-0 flex min-h-9 items-center px-2 text-center text-xs text-gray-500 dark:text-gray-400 sm:text-left";
  idle.textContent = tt("cv.canvaFormatToolbarIdle", "Click text in the résumé to format.");

  const bar = document.createElement("div");
  bar.className = "hidden min-h-9 flex-col gap-1";
  bar.setAttribute("role", "toolbar");

  const row = document.createElement("div");
  row.className = "flex flex-wrap items-center justify-center gap-0.5 sm:justify-start";

  const mkIconBtn = (title: string, inner: string, cmd: "bold" | "italic" | "underline") => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = title;
    b.className =
      "cv-canva-fmt-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-gray-800 transition hover:bg-gray-100 active:scale-95 dark:text-gray-100 dark:hover:bg-gray-800";
    b.innerHTML = inner;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => exec(cmd));
    return b;
  };

  const mkTextBtn = (label: string, title: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = title;
    b.textContent = label;
    b.className =
      "h-8 min-w-[2rem] shrink-0 rounded-lg px-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-100 dark:hover:bg-gray-800";
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", onClick);
    return b;
  };

  const btnMinus = mkTextBtn("A−", "Reducir tamaño del texto", () => nudgeHeroFont(-0.125));
  const btnPlus = mkTextBtn("A+", "Aumentar tamaño del texto", () => nudgeHeroFont(0.125));
  const btnBold = mkIconBtn("Negrita", "<span class='font-bold'>B</span>", "bold");
  const btnItalic = mkIconBtn("Cursiva", "<span class='italic'>I</span>", "italic");
  const btnUnderline = mkIconBtn("Subrayado", "<span class='underline'>U</span>", "underline");

  row.append(btnMinus, btnPlus, btnBold, btnItalic, btnUnderline);

  const heroRow = document.createElement("div");
  heroRow.className =
    "hidden flex-wrap items-center justify-center gap-1 border-t border-gray-200/80 pt-1 dark:border-gray-700/80 sm:justify-start";

  const mkHeroMini = (label: string, title: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = title;
    b.textContent = label;
    b.className =
      "rounded-md border border-gray-200/90 bg-gray-50/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700";
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", onClick);
    return b;
  };

  heroRow.append(
    mkHeroMini("Icono", "Cómo se muestran los enlaces del titular", () => cycleActiveSocialLinkDisplay()),
    mkHeroMini("−", "Iconos más pequeños", () => nudgeIconScale(-10)),
    mkHeroMini("+", "Iconos más grandes", () => nudgeIconScale(10)),
  );

  bar.append(row, heroRow);
  formatBarHost.append(idle, bar);

  let focusedCell: HTMLElement | null = null;

  const showIdle = () => {
    idle.classList.remove("hidden");
    bar.classList.add("hidden");
    focusedCell = null;
    heroRow.classList.add("hidden");
  };

  const showTools = () => {
    idle.classList.add("hidden");
    bar.classList.remove("hidden");
  };

  const syncFmtBtnActive = (btn: HTMLButtonElement, active: boolean) => {
    btn.classList.toggle("bg-indigo-100", active);
    btn.classList.toggle("text-indigo-900", active);
    btn.classList.toggle("dark:bg-indigo-900/55", active);
    btn.classList.toggle("dark:text-indigo-100", active);
  };

  const exec = (cmd: "bold" | "italic" | "underline") => {
    try {
      document.execCommand(cmd, false);
    } catch {
      /* ignore */
    }
    queueMicrotask(() => syncCommandStates());
  };

  const heroFontKeyFromEl = (el: HTMLElement): CvHeroFontKey | null => {
    const k = el.closest<HTMLElement>("[data-cv-hero-font-key]")?.dataset.cvHeroFontKey;
    if (k === "displayName" || k === "headline" || k === "cvTargetRole" || k === "summary" || k === "workPrefs") return k;
    const edit = el.dataset.cvCanvaEdit;
    if (edit === "displayName") return "displayName";
    if (edit === "headline") return "headline";
    if (edit === "cvTargetRole") return "cvTargetRole";
    if (edit === "summary") return "summary";
    return null;
  };

  const nudgeHeroFont = (delta: number) => {
    const el = focusedCell;
    if (!el) return;
    const key = heroFontKeyFromEl(el);
    if (!key) return;
    const rootRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const curRem = parseFloat(getComputedStyle(el).fontSize) / rootRem;
    if (!Number.isFinite(curRem)) return;
    patchActiveCanvasLayout((lay) => ({
      ...lay,
      heroFontRem: {
        ...(lay.heroFontRem ?? {}),
        [key]: Math.round(Math.min(2.75, Math.max(0.7, curRem + delta)) * 1000) / 1000,
      },
    }));
    queueMicrotask(() => syncCommandStates());
  };

  const nudgeIconScale = (delta: number) => {
    patchActiveCanvasLayout((lay) => {
      const cur = lay.heroContactIconScalePct ?? 100;
      const next = Math.min(160, Math.max(70, Math.round(cur + delta)));
      const out: CvStudioCanvasLayoutV1 = { ...lay, heroContactIconScalePct: next };
      if (next === 100) delete out.heroContactIconScalePct;
      return out;
    });
  };

  const isOurEditable = (n: Node | null): n is HTMLElement => {
    const el = n as HTMLElement | null;
    if (!el?.isContentEditable) return false;
    return docPanel.contains(el) && !!(el.closest("[data-cv-canva-edit]") || el.closest("[data-cv-canva-entity]"));
  };

  const syncCommandStates = () => {
    if (!focusedCell || bar.classList.contains("hidden")) return;
    const ae = document.activeElement;
    const sel = document.getSelection();
    const anchor = sel?.anchorNode;
    const anchorEl =
      anchor?.nodeType === Node.TEXT_NODE ? (anchor.parentElement as HTMLElement | null) : (anchor as HTMLElement | null);
    const inOurEdit =
      (ae && docPanel.contains(ae) && isOurEditable(ae)) || (!!anchorEl && focusedCell.contains(anchorEl));
    if (!inOurEdit) return;
    try {
      syncFmtBtnActive(btnBold, document.queryCommandState("bold"));
      syncFmtBtnActive(btnItalic, document.queryCommandState("italic"));
      syncFmtBtnActive(btnUnderline, document.queryCommandState("underline"));
    } catch {
      /* ignore */
    }
  };

  const updateHeroFontButtons = () => {
    const el = focusedCell;
    const ok = !!(el && heroFontKeyFromEl(el));
    btnMinus.disabled = !ok;
    btnPlus.disabled = !ok;
  };

  const applyHeroChromeVisibility = (cell: HTMLElement) => {
    const inHero = !!cell.closest('[data-cv-weight="hero"]');
    heroRow.classList.toggle("hidden", !inHero);
    updateHeroFontButtons();
  };

  const hide = () => {
    showIdle();
  };

  const syncFromFocus = (target: HTMLElement | null) => {
    const cell =
      target?.closest<HTMLElement>("[data-cv-canva-edit], .cv-canva-cell[data-cv-canva-entity]") ?? null;
    if (!cell || !docPanel.contains(cell)) {
      hide();
      return;
    }
    focusedCell = cell;
    showTools();
    applyHeroChromeVisibility(cell);
    syncCommandStates();
    updateHeroFontButtons();
  };

  document.addEventListener(
    "selectionchange",
    () => {
      if (!focusedCell || bar.classList.contains("hidden")) return;
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.focusNode;
      if (!node || !focusedCell.contains(node)) return;
      syncCommandStates();
    },
    { passive: true },
  );

  docPanel.addEventListener(
    "focusin",
    (e) => {
      const t = e.target as HTMLElement;
      if (formatBarHost.contains(t)) return;
      syncFromFocus(t);
    },
    true,
  );

  docPanel.addEventListener(
    "focusout",
    () => {
      queueMicrotask(() => {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && formatBarHost.contains(ae)) return;
        if (ae && docPanel.contains(ae) && isOurEditable(ae)) return;
        hide();
      });
    },
    true,
  );

  document.addEventListener(
    "focusin",
    (e) => {
      const t = e.target as HTMLElement;
      if (!docPanel.contains(t) && !formatBarHost.contains(t)) hide();
    },
    true,
  );
}
