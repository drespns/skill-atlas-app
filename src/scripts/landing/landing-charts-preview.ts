/**
 * Landing — métricas: línea 2025 (datos ficticios) + tarjetas estáticas en el markup.
 */
import i18next from "i18next";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

let inst: echarts.ECharts | null = null;
let ro: ResizeObserver | null = null;
let themeBridge = false;

function isDark() {
  return document.documentElement.classList.contains("dark");
}

function textPrimary() {
  return isDark() ? "#e5e7eb" : "#1f2937";
}

function textMuted() {
  return isDark() ? "#9ca3af" : "#6b7280";
}

function borderSubtle() {
  return isDark() ? "#374151" : "#e5e7eb";
}

function t(key: string) {
  return String(i18next.t(key));
}

function monthLabelsShort(): string[] {
  const en = (i18next.language || "es").toLowerCase().startsWith("en");
  return en
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
}

/** Serie ficticia 2025: sube en Q2, mes de vacaciones más bajo en agosto, repunte fin de año. */
function seriesSessions2025(): number[] {
  return [12, 14, 16, 19, 22, 24, 26, 18, 23, 27, 30, 34];
}

function seriesItemsTouched2025(): number[] {
  return [7, 8, 9, 11, 13, 14, 15, 10, 14, 16, 18, 21];
}

function renderTrend(el: HTMLElement) {
  inst?.dispose();
  ro?.disconnect();
  inst = echarts.init(el, undefined, { renderer: "canvas" });
  const months = monthLabelsShort();
  inst.setOption({
    title: {
      text: t("landing.chartsPreviewTrendTitle"),
      left: 0,
      top: 4,
      textStyle: { fontSize: 12, fontWeight: 600, color: textPrimary() },
    },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: textMuted(), fontSize: 11 } },
    grid: { left: 44, right: 12, top: 40, bottom: 40 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: months,
      axisLabel: { color: textMuted(), fontSize: 10 },
      axisLine: { lineStyle: { color: borderSubtle() } },
    },
    yAxis: {
      type: "value",
      min: 0,
      splitLine: { lineStyle: { color: borderSubtle(), opacity: 0.55 } },
      axisLabel: { color: textMuted(), fontSize: 10 },
    },
    series: [
      {
        name: t("landing.chartsPreviewTrendSeriesSessions"),
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: seriesSessions2025(),
        itemStyle: { color: "#8b5cf6" },
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.12, color: "#8b5cf6" },
      },
      {
        name: t("landing.chartsPreviewTrendSeriesItems"),
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: seriesItemsTouched2025(),
        itemStyle: { color: "#38bdf8" },
        lineStyle: { width: 2, type: "dashed" },
      },
    ],
  });
  ro = new ResizeObserver(() => inst?.resize());
  ro.observe(el);
}

function ensureThemeBridge() {
  if (themeBridge) return;
  themeBridge = true;
  let r = 0;
  const schedule = () => {
    window.cancelAnimationFrame(r);
    r = window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>("[data-landing-insights-chart]");
      if (!el) return;
      renderTrend(el);
    });
  };
  const mo = new MutationObserver(schedule);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("skillatlas:prefs-updated", schedule);
}

function boot() {
  const el = document.querySelector<HTMLElement>("[data-landing-insights-chart]");
  if (!el) {
    inst?.dispose();
    inst = null;
    ro?.disconnect();
    ro = null;
    return;
  }
  renderTrend(el);
  ensureThemeBridge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:after-swap", boot);
window.addEventListener("skillatlas:ui-lang-changed", boot);
