import i18next from "i18next";
import * as echarts from "echarts/core";
import { BarChart, PieChart, GaugeChart, TreemapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";

echarts.use([
  BarChart,
  PieChart,
  GaugeChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

type ProgressKey = "aprendido" | "practicado" | "mastered";

function t(key: string, opts?: Record<string, string | number>) {
  return String(i18next.t(key, { ...(opts ?? {}) }));
}

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

const PROGRESS_KEYS: ProgressKey[] = ["aprendido", "practicado", "mastered"];

const PROGRESS_COLORS: Record<ProgressKey, string> = {
  aprendido: "#34d399",
  practicado: "#fbbf24",
  mastered: "#a78bfa",
};

let chartInstances: echarts.ECharts[] = [];
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;
let themeChartsObsBound = false;
let lastChartsDark = false;

function disposeChartInstancesOnly() {
  for (const c of chartInstances) {
    c.dispose();
  }
  chartInstances = [];
  resizeObserver?.disconnect();
  resizeObserver = null;
}

/** Al salir de /app: gráficos + observer de tema. */
export function disposeDashboardVisuals() {
  disposeChartInstancesOnly();
  themeObserver?.disconnect();
  themeObserver = null;
  themeChartsObsBound = false;
}

function pushChart(el: HTMLElement, opt: echarts.EChartsCoreOption) {
  const inst = echarts.init(el, undefined, { renderer: "canvas" });
  inst.setOption(opt);
  chartInstances.push(inst);
  return inst;
}

function baseTitle(text: string) {
  return {
    text,
    left: 0,
    top: 0,
    textStyle: { fontSize: 13, fontWeight: 600, color: textPrimary() },
  };
}

function emptyOption(title: string, sub: string): echarts.EChartsCoreOption {
  return {
    title: { ...baseTitle(title), subtext: sub, subtextStyle: { color: textMuted(), fontSize: 11 } },
    graphic: {
      type: "text",
      left: "center",
      top: "middle",
      style: { text: t("dashboard.charts.emptyData"), fill: textMuted(), fontSize: 13 },
    },
  };
}

function setKpiText(sel: string, text: string) {
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    el.textContent = text;
  });
}

function showKpiRoot(show: boolean) {
  document.querySelectorAll<HTMLElement>("[data-dashboard-kpi-root]").forEach((el) => {
    el.classList.toggle("hidden", !show);
  });
}

export async function runDashboardVisuals() {
  const root = document.querySelector("[data-dashboard-charts-root]");
  const elStack = document.querySelector<HTMLElement>("[data-dashboard-chart-stacked]");
  const elPie = document.querySelector<HTMLElement>("[data-dashboard-chart-pie]");
  const elGauge = document.querySelector<HTMLElement>("[data-dashboard-chart-gauge]");
  const elProjects = document.querySelector<HTMLElement>("[data-dashboard-chart-projects]");
  const elTreemap = document.querySelector<HTMLElement>("[data-dashboard-chart-treemap]");
  const elCoverage = document.querySelector<HTMLElement>("[data-dashboard-chart-coverage]");
  const elEmpty = document.querySelector<HTMLElement>("[data-dashboard-charts-empty]");
  const elWrap = document.querySelector<HTMLElement>("[data-dashboard-charts-wrap]");

  if (!root || !elStack || !elPie || !elGauge || !elProjects || !elTreemap || !elCoverage) return;

  disposeChartInstancesOnly();

  const supabase = getSupabaseBrowserClient();
  const { data: sess } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const user = sess?.session?.user;

  if (!supabase || !user) {
    showKpiRoot(false);
    if (elWrap) elWrap.classList.add("hidden");
    if (elEmpty) {
      elEmpty.classList.remove("hidden");
      elEmpty.textContent = t("dashboard.charts.needSession");
    }
    return;
  }

  showKpiRoot(true);
  if (elEmpty) {
    elEmpty.classList.add("hidden");
    elEmpty.textContent = "";
  }
  if (elWrap) elWrap.classList.remove("hidden");

  const [conceptsRes, techRes, ptRes, embedRes, pcRes] = await Promise.all([
    supabase.from("concepts").select("id, technology_id, progress"),
    supabase.from("technologies").select("id, name, slug"),
    supabase.from("project_technologies").select("technology_id, project_id"),
    supabase.from("project_embeds").select("project_id"),
    supabase.from("project_concepts").select("concept_id"),
  ]);

  const concepts = (conceptsRes.data ?? []) as { id: string; technology_id: string; progress: string }[];
  const techRows = (techRes.data ?? []) as { id: string; name: string; slug: string }[];
  const ptRows = (ptRes.data ?? []) as { technology_id: string; project_id: string }[];
  const embedRows = (embedRes.data ?? []) as { project_id: string }[];
  const pcRows = (pcRes.data ?? []) as { concept_id: string }[];

  const techName = new Map<string, string>();
  for (const row of techRows) {
    techName.set(row.id, row.name);
  }

  const byTech = new Map<string, Record<ProgressKey, number>>();
  for (const c of concepts) {
    const tid = c.technology_id;
    if (!tid) continue;
    const p = c.progress as ProgressKey;
    if (!PROGRESS_KEYS.includes(p)) continue;
    if (!byTech.has(tid)) {
      byTech.set(tid, { aprendido: 0, practicado: 0, mastered: 0 });
    }
    byTech.get(tid)![p] += 1;
  }

  const projectCountByTech = new Map<string, number>();
  for (const r of ptRows) {
    const tid = r.technology_id;
    if (!tid) continue;
    projectCountByTech.set(tid, (projectCountByTech.get(tid) ?? 0) + 1);
  }

  const distinctProjectIds = new Set(ptRows.map((r) => r.project_id).filter(Boolean));
  const hasProjectsData = distinctProjectIds.size > 0 || embedRows.length > 0;

  const techIds = [...new Set([...byTech.keys(), ...projectCountByTech.keys()])].filter((id) => techName.has(id));

  const sortedByConcepts = [...techIds].sort((a, b) => {
    const ta = byTech.get(a);
    const tb = byTech.get(b);
    const sa = ta ? PROGRESS_KEYS.reduce((n, k) => n + ta[k], 0) : 0;
    const sb = tb ? PROGRESS_KEYS.reduce((n, k) => n + tb[k], 0) : 0;
    return sb - sa;
  });

  const topTech = sortedByConcepts.slice(0, 14);
  const categories = topTech.map((id) => techName.get(id) ?? id);
  const canStack = topTech.length > 0;

  const globalProgress: Record<ProgressKey, number> = { aprendido: 0, practicado: 0, mastered: 0 };
  for (const c of concepts) {
    const p = c.progress as ProgressKey;
    if (PROGRESS_KEYS.includes(p)) globalProgress[p] += 1;
  }

  const hasConcepts = concepts.length > 0;
  const totalConcepts = concepts.length;
  const masteredN = globalProgress.mastered;
  const masteryPct = totalConcepts > 0 ? Math.round((100 * masteredN) / totalConcepts) : 0;

  const embedProjectIds = new Set(embedRows.map((r) => r.project_id).filter(Boolean));
  const projectsWithEvidence = embedProjectIds.size;
  const totalEmbeds = embedRows.length;

  const linkedConceptIds = new Set(pcRows.map((r) => r.concept_id).filter(Boolean));
  const linkedCount = [...linkedConceptIds].filter((id) => concepts.some((c) => c.id === id)).length;
  const soloStack = Math.max(0, totalConcepts - linkedCount);

  const emptyTechCount = techRows.filter((row) => {
    const tr = byTech.get(row.id);
    const n = tr ? PROGRESS_KEYS.reduce((s, k) => s + tr[k], 0) : 0;
    return n === 0;
  }).length;

  setKpiText("[data-dashboard-kpi-mastery-pct]", totalConcepts > 0 ? `${masteryPct}` : "—");
  setKpiText(
    "[data-dashboard-kpi-mastery-sub]",
    totalConcepts > 0 ? t("dashboard.kpi.masterySub", { mastered: masteredN, total: totalConcepts }) : t("dashboard.kpi.noConceptsYet"),
  );
  setKpiText("[data-dashboard-kpi-embeds]", String(totalEmbeds));
  setKpiText("[data-dashboard-kpi-projects-evidence]", String(projectsWithEvidence));
  setKpiText("[data-dashboard-kpi-concepts-linked]", String(linkedCount));
  setKpiText("[data-dashboard-kpi-solo-concepts]", String(soloStack));
  setKpiText("[data-dashboard-kpi-empty-techs]", String(emptyTechCount));

  const emptyTechsList = document.querySelector<HTMLElement>("[data-dashboard-kpi-empty-techs-list]");
  if (emptyTechsList) {
    const empties = techRows
      .filter((row) => {
        const tr = byTech.get(row.id);
        const n = tr ? PROGRESS_KEYS.reduce((s, k) => s + tr[k], 0) : 0;
        return n === 0;
      })
      .slice(0, 5);
    if (empties.length === 0) {
      emptyTechsList.innerHTML = `<span class="text-gray-500 dark:text-gray-400">${esc(t("dashboard.kpi.allTechsHaveConcepts"))}</span>`;
    } else {
      emptyTechsList.innerHTML = empties
        .map(
          (row) =>
            `<a class="inline-flex mr-1 mb-1 rounded-md border border-amber-200/80 dark:border-amber-800/60 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:opacity-90 no-underline" href="/technologies/view?tech=${encodeURIComponent(row.slug)}">${esc(row.name)}</a>`,
        )
        .join("");
    }
  }

  const treemapProjectData = (() => {
    const sorted = [...techIds].sort((a, b) => (projectCountByTech.get(b) ?? 0) - (projectCountByTech.get(a) ?? 0));
    return sorted
      .map((id) => ({
        name: techName.get(id) ?? id,
        value: projectCountByTech.get(id) ?? 0,
      }))
      .filter((d) => d.value > 0);
  })();

  const renderProjectCharts = () => {
    const projSorted = [...techIds].sort((a, b) => (projectCountByTech.get(b) ?? 0) - (projectCountByTech.get(a) ?? 0));
    const projCategories = projSorted.map((id) => techName.get(id) ?? id);
    const projData = projSorted.map((id) => projectCountByTech.get(id) ?? 0);
    const anyProj = projData.some((n) => n > 0);

    if (!anyProj) {
      pushChart(elProjects, emptyOption(t("dashboard.charts.projectsTitle"), t("dashboard.charts.projectsHint")));
    } else {
      pushChart(elProjects, {
        title: baseTitle(t("dashboard.charts.projectsTitle")),
        tooltip: { trigger: "axis" },
        grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
        xAxis: {
          type: "value",
          minInterval: 1,
          axisLabel: { color: textMuted() },
          splitLine: { lineStyle: { color: borderSubtle(), opacity: 0.5 } },
        },
        yAxis: {
          type: "category",
          data: projCategories,
          axisLabel: { color: textMuted(), fontSize: 10 },
          axisLine: { lineStyle: { color: borderSubtle() } },
        },
        series: [
          {
            type: "bar",
            data: projData,
            itemStyle: { color: "#8b5cf6", borderRadius: [0, 6, 6, 0] },
          },
        ],
      });
    }

    if (treemapProjectData.length === 0) {
      pushChart(elTreemap, emptyOption(t("dashboard.charts.treemapProjectsTitle"), t("dashboard.charts.treemapProjectsHint")));
    } else {
      pushChart(elTreemap, {
        title: baseTitle(t("dashboard.charts.treemapProjectsTitle")),
        tooltip: { formatter: "{b}: {c}" },
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: { show: true, fontSize: 11, color: "#fff" },
            upperLabel: { show: false },
            itemStyle: {
              borderColor: isDark() ? "#111827" : "#fff",
              borderWidth: 2,
              gapWidth: 2,
            },
            levels: [
              {
                itemStyle: {
                  borderWidth: 2,
                  gapWidth: 2,
                  borderColor: isDark() ? "#111827" : "#fff",
                },
                colorSaturation: [0.35, 0.65],
                colorMappingBy: "value",
                colorAlpha: [0.85, 1],
              },
            ],
            data: treemapProjectData,
            color: ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#14b8a6", "#22c55e", "#eab308"],
          },
        ],
      });
    }
  };

  if (!hasConcepts && !hasProjectsData) {
    pushChart(elStack, emptyOption(t("dashboard.charts.stackedTitle"), t("dashboard.charts.stackedHint")));
    pushChart(elPie, emptyOption(t("dashboard.charts.pieTitle"), t("dashboard.charts.pieHint")));
    pushChart(elGauge, emptyOption(t("dashboard.charts.gaugeTitle"), t("dashboard.charts.gaugeHint")));
    pushChart(elProjects, emptyOption(t("dashboard.charts.projectsTitle"), t("dashboard.charts.projectsHint")));
    pushChart(elTreemap, emptyOption(t("dashboard.charts.treemapProjectsTitle"), t("dashboard.charts.treemapProjectsHint")));
    pushChart(elCoverage, emptyOption(t("dashboard.charts.coverageTitle"), t("dashboard.charts.coverageHint")));
  } else if (!hasConcepts && hasProjectsData) {
    pushChart(elStack, emptyOption(t("dashboard.charts.stackedTitle"), t("dashboard.charts.stackedHint")));
    pushChart(elPie, emptyOption(t("dashboard.charts.pieTitle"), t("dashboard.charts.pieHint")));
    pushChart(elGauge, emptyOption(t("dashboard.charts.gaugeTitle"), t("dashboard.charts.gaugeHint")));
    renderProjectCharts();
    pushChart(elCoverage, emptyOption(t("dashboard.charts.coverageTitle"), t("dashboard.charts.coverageHint")));
  } else if (!canStack) {
    pushChart(elStack, emptyOption(t("dashboard.charts.stackedTitle"), t("dashboard.charts.noTechLink")));
    pushChart(elPie, {
      title: baseTitle(t("dashboard.charts.pieTitle")),
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: textMuted(), fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["40%", "68%"],
          center: ["50%", "46%"],
          itemStyle: { borderRadius: 6, borderColor: isDark() ? "#030712" : "#fff", borderWidth: 2 },
          label: { color: textPrimary(), fontSize: 11 },
          data: PROGRESS_KEYS.map((key) => ({
            name: t(`dashboard.charts.progress.${key}`),
            value: globalProgress[key],
            itemStyle: { color: PROGRESS_COLORS[key] },
          })),
        },
      ],
    });
    pushChart(
      elGauge,
      gaugeOption(masteryPct, t("dashboard.charts.gaugeAxis"), t("dashboard.charts.gaugeTitle")),
    );
    renderProjectCharts();
    pushChart(
      elCoverage,
      coverageOption(linkedCount, soloStack, t("dashboard.charts.coverageInProjects"), t("dashboard.charts.coverageSolo")),
    );
  } else {
    renderProjectCharts();

    const seriesStacked = PROGRESS_KEYS.map((key) => ({
      name: t(`dashboard.charts.progress.${key}`),
      type: "bar" as const,
      stack: "total",
      emphasis: { focus: "series" as const },
      itemStyle: { color: PROGRESS_COLORS[key] },
      data: topTech.map((tid) => byTech.get(tid)?.[key] ?? 0),
    }));

    pushChart(elStack, {
      title: baseTitle(t("dashboard.charts.stackedTitle")),
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: {
        data: PROGRESS_KEYS.map((k) => t(`dashboard.charts.progress.${k}`)),
        bottom: 0,
        textStyle: { color: textMuted(), fontSize: 11 },
      },
      grid: { left: 8, right: 12, top: 36, bottom: 52, containLabel: true },
      xAxis: {
        type: "category",
        data: categories,
        axisLabel: { color: textMuted(), rotate: categories.some((c) => c.length > 10) ? 28 : 0, fontSize: 10 },
        axisLine: { lineStyle: { color: borderSubtle() } },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: textMuted() },
        splitLine: { lineStyle: { color: borderSubtle(), opacity: 0.5 } },
      },
      series: seriesStacked,
    });

    pushChart(elPie, {
      title: baseTitle(t("dashboard.charts.pieTitle")),
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: textMuted(), fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["40%", "68%"],
          center: ["50%", "46%"],
          itemStyle: { borderRadius: 6, borderColor: isDark() ? "#030712" : "#fff", borderWidth: 2 },
          label: { color: textPrimary(), fontSize: 11 },
          data: PROGRESS_KEYS.map((key) => ({
            name: t(`dashboard.charts.progress.${key}`),
            value: globalProgress[key],
            itemStyle: { color: PROGRESS_COLORS[key] },
          })),
        },
      ],
    });

    pushChart(elGauge, gaugeOption(masteryPct, t("dashboard.charts.gaugeAxis"), t("dashboard.charts.gaugeTitle")));

    pushChart(
      elCoverage,
      coverageOption(linkedCount, soloStack, t("dashboard.charts.coverageInProjects"), t("dashboard.charts.coverageSolo")),
    );
  }

  const observeEls = [elProjects, elTreemap, elStack, elPie, elGauge, elCoverage].filter(Boolean) as HTMLElement[];
  const onResize = () => {
    for (const c of chartInstances) c.resize();
  };
  resizeObserver = new ResizeObserver(onResize);
  observeEls.forEach((el) => resizeObserver!.observe(el));

  lastChartsDark = isDark();
  if (!themeChartsObsBound) {
    themeChartsObsBound = true;
    themeObserver = new MutationObserver(() => {
      const d = isDark();
      if (d === lastChartsDark) return;
      lastChartsDark = d;
      disposeChartInstancesOnly();
      void runDashboardVisuals();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gaugeOption(value: number, name: string, title: string): echarts.EChartsCoreOption {
  return {
    title: baseTitle(title),
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 5,
        center: ["50%", "58%"],
        radius: "88%",
        axisLine: {
          lineStyle: {
            width: 10,
            color: [
              [0.35, "#34d399"],
              [0.7, "#fbbf24"],
              [1, "#a78bfa"],
            ],
          },
        },
        pointer: { length: "55%", width: 4, itemStyle: { color: textPrimary() } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: textMuted(), distance: -36, fontSize: 9 },
        anchor: { show: true, size: 12, itemStyle: { color: textPrimary() } },
        title: { show: true, offsetCenter: [0, "72%"], fontSize: 11, color: textMuted() },
        detail: {
          valueAnimation: true,
          fontSize: 22,
          fontWeight: 700,
          color: textPrimary(),
          offsetCenter: [0, "38%"],
          formatter: "{value}%",
        },
        data: [{ value, name }],
      },
    ],
  };
}

function coverageOption(
  inProjects: number,
  solo: number,
  labelIn: string,
  labelSolo: string,
): echarts.EChartsCoreOption {
  return {
    title: baseTitle(t("dashboard.charts.coverageTitle")),
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 12, top: 36, bottom: 28, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: textMuted() },
      splitLine: { lineStyle: { color: borderSubtle(), opacity: 0.5 } },
    },
    yAxis: {
      type: "category",
      data: [labelIn, labelSolo],
      axisLabel: { color: textMuted(), fontSize: 11 },
      axisLine: { lineStyle: { color: borderSubtle() } },
    },
    series: [
      {
        type: "bar",
        data: [
          { value: inProjects, itemStyle: { color: "#6366f1", borderRadius: [0, 6, 6, 0] } },
          { value: solo, itemStyle: { color: "#94a3b8", borderRadius: [0, 6, 6, 0] } },
        ],
      },
    ],
  };
}
