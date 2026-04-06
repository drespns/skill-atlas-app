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
  inst.setOption({
    title: {
      text: t("landing.chartsPreviewDemoTitle"),
      left: "center",
      textStyle: { fontSize: 12, fontWeight: 600, color: textPrimary() },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      bottom: 0,
      data: [
        t("dashboard.charts.progress.aprendido"),
        t("dashboard.charts.progress.practicado"),
        t("dashboard.charts.progress.mastered"),
      ],
      textStyle: { color: textMuted(), fontSize: 10 },
    },
    grid: { left: 8, right: 8, top: 40, bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      data: ["SQL", "Python", "Tableau", "Power BI", "Spark"],
      axisLabel: { color: textMuted(), fontSize: 10 },
      axisLine: { lineStyle: { color: borderSubtle() } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: textMuted() },
      splitLine: { lineStyle: { color: borderSubtle(), opacity: 0.5 } },
    },
    series: [
      {
        name: t("dashboard.charts.progress.aprendido"),
        type: "bar",
        stack: "x",
        itemStyle: { color: "#34d399" },
        data: [4, 6, 3, 5, 2],
      },
      {
        name: t("dashboard.charts.progress.practicado"),
        type: "bar",
        stack: "x",
        itemStyle: { color: "#fbbf24" },
        data: [2, 3, 4, 2, 3],
      },
      {
        name: t("dashboard.charts.progress.mastered"),
        type: "bar",
        stack: "x",
        itemStyle: { color: "#a78bfa" },
        data: [1, 2, 1, 1, 4],
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
