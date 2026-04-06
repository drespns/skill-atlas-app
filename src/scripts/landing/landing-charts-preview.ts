import i18next from "i18next";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

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

let inst: echarts.ECharts | null = null;
let ro: ResizeObserver | null = null;

function t(key: string) {
  return String(i18next.t(key));
}

function renderDemo(el: HTMLElement) {
  inst?.dispose();
  ro?.disconnect();
  inst = echarts.init(el, undefined, { renderer: "canvas" });
  /** Barras horizontales: proyectos por tecnología (demo ficticio), alineado con el foco del dashboard. */
  inst.setOption({
    title: {
      text: t("landing.chartsPreviewDemoTitle"),
      left: "center",
      textStyle: { fontSize: 12, fontWeight: 600, color: textPrimary() },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: textMuted(), fontSize: 10 },
      splitLine: { lineStyle: { color: borderSubtle(), opacity: 0.5 } },
    },
    yAxis: {
      type: "category",
      data: ["SQL", "Python", "Tableau", "Power BI", "Spark"],
      axisLabel: { color: textMuted(), fontSize: 10 },
      axisLine: { lineStyle: { color: borderSubtle() } },
    },
    series: [
      {
        name: t("dashboard.charts.projectsTitle"),
        type: "bar",
        data: [3, 5, 2, 4, 3],
        itemStyle: { color: "#8b5cf6", borderRadius: [0, 6, 6, 0] },
      },
    ],
  });
  ro = new ResizeObserver(() => inst?.resize());
  ro.observe(el);
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
  renderDemo(el);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:after-swap", boot);
