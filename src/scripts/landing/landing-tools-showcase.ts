/**
 * Landing: carrusel horizontal del demo de gastos + ECharts (datos ficticios), alineado con la herramienta real.
 */
import i18next from "i18next";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

let chartInstances: echarts.ECharts[] = [];
let resizeObserver: ResizeObserver | null = null;
let sliderAbort: AbortController | null = null;
let autoSlideTimer: ReturnType<typeof setInterval> | null = null;
let themeMo: MutationObserver | null = null;

function motionReduced(): boolean {
  if (document.documentElement.dataset.motion === "reduced") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function textPrimary(): string {
  return isDark() ? "#e5e7eb" : "#1f2937";
}

function textMuted(): string {
  return isDark() ? "#9ca3af" : "#6b7280";
}

function borderSubtle(): string {
  return isDark() ? "#374151" : "#e5e7eb";
}

function t(key: string, opts?: Record<string, unknown>): string {
  return String(i18next.t(key, opts as any));
}

function monthLabelsShort(): string[] {
  const en = (i18next.language || "es").toLowerCase().startsWith("en");
  return en
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
}

function disposeCharts() {
  for (const c of chartInstances) c.dispose();
  chartInstances = [];
  resizeObserver?.disconnect();
  resizeObserver = null;
}

function scheduleChartResize() {
  window.requestAnimationFrame(() => {
    for (const c of chartInstances) c.resize();
  });
}

function renderExpenseCharts(etRoot: HTMLElement) {
  disposeCharts();
  const elBal = etRoot.querySelector<HTMLElement>("[data-landing-tools-et-chart-balance]");
  const elPie = etRoot.querySelector<HTMLElement>("[data-landing-tools-et-chart-pie]");
  const elYear = etRoot.querySelector<HTMLElement>("[data-landing-tools-et-chart-year]");
  if (!elBal || !elPie || !elYear) return;

  const DEMO_YEAR = 2025;
  const monthsBal = monthLabelsShort();
  const inc = [0, 0, 120, 280, 310, 295, 320, 300, 275, 305, 340, 380];
  const exp = [85, 90, 110, 125, 140, 135, 150, 175, 130, 145, 155, 168];
  const net = inc.map((v, i) => v - exp[i]!);

  const bal = echarts.init(elBal, undefined, { renderer: "canvas" });
  bal.setOption({
    title: {
      text: t("landing.toolsShowcaseEtChartBalanceTitle2025", { year: DEMO_YEAR }),
      left: 0,
      top: 4,
      textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
    },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: textMuted() } },
    grid: { left: 48, right: 16, top: 44, bottom: 40 },
    xAxis: {
      type: "category",
      data: monthsBal,
      axisLabel: { color: textMuted(), rotate: 28, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: borderSubtle() } },
      axisLabel: { color: textMuted() },
    },
    series: [
      {
        name: t("landing.toolsShowcaseEtLegendInc"),
        type: "bar",
        data: inc,
        itemStyle: { color: "#34d399", borderRadius: [6, 6, 0, 0] },
      },
      {
        name: t("landing.toolsShowcaseEtLegendExp"),
        type: "bar",
        data: exp,
        itemStyle: { color: "#fb923c", borderRadius: [6, 6, 0, 0] },
      },
      {
        name: t("landing.toolsShowcaseEtLegendNet"),
        type: "line",
        smooth: true,
        data: net,
        itemStyle: { color: "#a855f7" },
        z: 10,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { width: 2 },
      },
    ],
  });
  chartInstances.push(bal);

  const pieData = [
    { name: t("landing.toolsShowcaseEtCatFood"), value: 92, itemStyle: { color: "#4ade80" } },
    { name: t("landing.toolsShowcaseEtCatSoftware"), value: 48, itemStyle: { color: "#a855f7" } },
    { name: t("landing.toolsShowcaseEtCatLeisure"), value: 22, itemStyle: { color: "#fb923c" } },
    { name: t("landing.toolsShowcaseEtCatHealth"), value: 12, itemStyle: { color: "#ec4899" } },
    { name: t("landing.toolsShowcaseEtCatServices"), value: 6, itemStyle: { color: "#facc15" } },
    { name: t("landing.toolsShowcaseEtCatHousing"), value: 3, itemStyle: { color: "#3b82f6" } },
  ];
  const pie = echarts.init(elPie, undefined, { renderer: "canvas" });
  pie.setOption({
    title: {
      text: t("landing.toolsShowcaseEtChartPieTitle"),
      left: "center",
      top: 6,
      textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
    },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "54%"],
        data: pieData,
        label: { color: textMuted(), fontSize: 11 },
        labelLine: { lineStyle: { color: textMuted() } },
        itemStyle: { borderColor: isDark() ? "#020617" : "#fff", borderWidth: 2 },
      },
    ],
  });
  chartInstances.push(pie);

  const mlab = monthLabelsShort();
  const outUni = [92, 88, 105, 118, 124, 132, 128, 160, 122, 118, 125, 142];
  const incUni = [0, 0, 180, 420, 400, 410, 405, 390, 360, 370, 390, 410];
  const year = echarts.init(elYear, undefined, { renderer: "canvas" });
  year.setOption({
    title: {
      text: t("landing.toolsShowcaseEtChartProjTitle", { year: DEMO_YEAR }),
      left: 0,
      top: 4,
      textStyle: { fontSize: 12, fontWeight: 600, color: textPrimary() },
    },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: textMuted() } },
    grid: { left: 48, right: 16, top: 48, bottom: 48 },
    xAxis: { type: "category", data: mlab, axisLabel: { color: textMuted() } },
    yAxis: {
      type: "value",
      min: 0,
      max: 700,
      splitLine: { lineStyle: { color: borderSubtle() } },
      axisLabel: { color: textMuted() },
    },
    series: [
      {
        name: t("landing.toolsShowcaseEtLegendOut"),
        type: "line",
        smooth: true,
        data: outUni,
        areaStyle: { opacity: 0.12 },
        itemStyle: { color: "#818cf8" },
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2 },
      },
      {
        name: t("landing.toolsShowcaseEtLegendIn"),
        type: "line",
        smooth: true,
        data: incUni,
        itemStyle: { color: "#34d399" },
        lineStyle: { type: "dashed", width: 2 },
        symbol: "circle",
        symbolSize: 7,
      },
    ],
  });
  chartInstances.push(year);

  const host = etRoot.querySelector<HTMLElement>("[data-landing-tools-et-slider-wrap]") ?? etRoot;
  resizeObserver = new ResizeObserver(() => scheduleChartResize());
  resizeObserver.observe(host);

  scheduleChartResize();
}

function setDotVisual(dots: HTMLButtonElement[], active: number) {
  dots.forEach((btn, i) => {
    const on = i === active;
    btn.setAttribute("aria-current", on ? "true" : "false");
    const bar = btn.querySelector<HTMLElement>("span");
    if (!bar) return;
    bar.className = on
      ? "block h-2 w-8 rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
      : "block h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600 transition-all group-hover:bg-gray-400 dark:group-hover:bg-gray-500";
  });
}

function initExpenseSlider(etRoot: HTMLElement) {
  sliderAbort?.abort();
  if (autoSlideTimer != null) {
    clearInterval(autoSlideTimer);
    autoSlideTimer = null;
  }

  const track = etRoot.querySelector<HTMLElement>("[data-landing-tools-et-track]");
  const slides = [...etRoot.querySelectorAll<HTMLElement>("[data-landing-tools-et-slide]")];
  const dots = [...etRoot.querySelectorAll<HTMLButtonElement>("[data-landing-tools-et-dot]")];
  if (!track || slides.length === 0 || dots.length === 0) return;

  sliderAbort = new AbortController();
  const { signal } = sliderAbort;

  const n = slides.length;
  let active = 0;

  const slideWidth = () => track.clientWidth || 1;

  const scrollToIndex = (i: number) => {
    const idx = Math.max(0, Math.min(n - 1, i));
    const behavior = motionReduced() ? "auto" : "smooth";
    track.scrollTo({ left: idx * slideWidth(), behavior });
  };

  const readActiveFromScroll = (): number => {
    const w = slideWidth();
    return Math.round(track.scrollLeft / w);
  };

  const syncFromScroll = () => {
    const next = readActiveFromScroll();
    if (next !== active) {
      active = next;
      setDotVisual(dots, active);
      scheduleChartResize();
    }
  };

  setDotVisual(dots, 0);

  let scrollEndTimer: ReturnType<typeof setTimeout> | undefined;
  track.addEventListener("scroll", () => {
    syncFromScroll();
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(() => scheduleChartResize(), 140);
  }, { passive: true, signal });

  dots.forEach((btn, i) => {
    btn.addEventListener(
      "click",
      () => {
        scrollToIndex(i);
        active = i;
        setDotVisual(dots, active);
        scheduleChartResize();
      },
      { signal },
    );
  });

  track.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        scrollToIndex(active + 1);
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        scrollToIndex(active - 1);
      }
    },
    { signal },
  );

  if (!motionReduced() && n > 1) {
    autoSlideTimer = window.setInterval(() => {
      const next = (readActiveFromScroll() + 1) % n;
      scrollToIndex(next);
    }, 9500);
  }

  window.addEventListener(
    "resize",
    () => {
      scrollToIndex(readActiveFromScroll());
      scheduleChartResize();
    },
    { signal },
  );
}

function ensureThemeBridge(etRoot: HTMLElement) {
  if (document.documentElement.dataset.landingToolsShowcaseTheme === "1") return;
  document.documentElement.dataset.landingToolsShowcaseTheme = "1";
  let r = 0;
  const schedule = () => {
    window.cancelAnimationFrame(r);
    r = window.requestAnimationFrame(() => {
      if (!document.querySelector("[data-landing-tools-showcase]")) {
        disposeCharts();
        return;
      }
      disposeCharts();
      const root = document.querySelector<HTMLElement>("[data-landing-tools-et-root]");
      if (root) renderExpenseCharts(root);
    });
  };
  themeMo = new MutationObserver(schedule);
  themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("skillatlas:prefs-updated", schedule);
}

function boot() {
  const etRoot = document.querySelector<HTMLElement>("[data-landing-tools-et-root]");
  if (!document.querySelector("[data-landing-tools-showcase]") || !etRoot) {
    sliderAbort?.abort();
    sliderAbort = null;
    if (autoSlideTimer != null) {
      clearInterval(autoSlideTimer);
      autoSlideTimer = null;
    }
    disposeCharts();
    return;
  }

  renderExpenseCharts(etRoot);
  initExpenseSlider(etRoot);
  ensureThemeBridge(etRoot);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:after-swap", boot);
window.addEventListener("skillatlas:ui-lang-changed", boot);
