import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  compareScenarios,
  evaluateScenarioViability,
  scenarioMonthlyImpactSeries,
  scenarioToPlannedExpense,
  scenarioTotalAmount,
  type ExpenseScenario,
  type ExpenseTrackerState,
  type ScenarioKind,
  type ScenarioTrafficLight,
  formatEurEs,
} from "@lib/tools-expense-tracker";
import { refreshExpenseDatePicker, initExpenseMonthPickers } from "./expense-tracker-dates";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const scenarioCharts = new Map<string, echarts.ECharts>();

export type ScenarioUiDeps = {
  getState: () => ExpenseTrackerState;
  setState: (s: ExpenseTrackerState) => void;
  persist: () => void;
  renderAll: (root: HTMLElement) => void;
  showConfirmDialog: (root: HTMLElement, msg: string, okLabel?: string) => Promise<boolean>;
  fillCategorySelect: (sel: HTMLSelectElement) => void;
  makeId: () => string;
};

let scenarioCompareIds: string[] = [];

function trafficLabel(t: ScenarioTrafficLight): string {
  if (t === "viable") return "Te encaja";
  if (t === "tight") return "Justo";
  return "Complicado";
}

function trafficHint(t: ScenarioTrafficLight): string {
  if (t === "viable") return "La cuota o compra deja margen cómodo respecto a lo que ya gastas (incl. previstos).";
  if (t === "tight") return "Podrías hacerlo, pero te quedaría poco margen mensual o de efectivo.";
  return "Con tus números actuales (incl. gastos previstos) sería arriesgado.";
}

const KIND_HINTS: Record<ScenarioKind, string> = {
  one_off: "Un pago puntual en la fecha que indiques (ej. 800 € el día que compres el portátil).",
  installments: "La misma cuota cada mes durante varios meses (ej. 50 €/mes × 12 por el móvil).",
  bundle: "Varios importes que pagarías en el mismo mes: vuelos, hotel, entradas… La app los suma.",
};

function trafficClass(t: ScenarioTrafficLight): string {
  if (t === "viable") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  if (t === "tight") return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
}

function disposeScenarioCharts() {
  for (const c of scenarioCharts.values()) c.dispose();
  scenarioCharts.clear();
}

function renderScenarioMiniChart(el: HTMLElement, scenario: ExpenseScenario, state: ExpenseTrackerState) {
  const existing = scenarioCharts.get(scenario.id);
  if (existing) {
    existing.dispose();
    scenarioCharts.delete(scenario.id);
  }
  const series = scenarioMonthlyImpactSeries(state, scenario, 6);
  const inst = echarts.init(el);
  scenarioCharts.set(scenario.id, inst);
  const monthShort = series.months.map((m) => m.slice(5));
  inst.setOption({
    title: {
      text: "Salidas mensuales estimadas",
      left: 0,
      top: 0,
      textStyle: { fontSize: 10, fontWeight: 600 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => `${formatEurEs(Number(v))}`,
    },
    legend: {
      bottom: 2,
      left: "center",
      itemWidth: 10,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { fontSize: 9 },
    },
    grid: { left: 42, right: 10, top: 30, bottom: 44 },
    xAxis: {
      type: "category",
      data: monthShort,
      axisLabel: { fontSize: 9, margin: 10, interval: 0 },
    },
    yAxis: {
      type: "value",
      splitLine: { show: false },
      axisLabel: { fontSize: 9, formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v)) },
    },
    series: [
      {
        name: "Sin este deseo",
        type: "line",
        smooth: true,
        data: series.baseline,
        showSymbol: false,
        lineStyle: { type: "dashed" },
      },
      {
        name: "Con este deseo",
        type: "line",
        smooth: true,
        data: series.withScenario,
        showSymbol: false,
      },
    ],
  });
}

function syncScenarioKindPanels(root: HTMLElement) {
  const kind = root.querySelector<HTMLSelectElement>("[data-et-scenario-kind]")?.value as ScenarioKind;
  root.querySelector("[data-et-scenario-panel-one-off]")?.classList.toggle("hidden", kind !== "one_off");
  root.querySelector("[data-et-scenario-panel-installments]")?.classList.toggle("hidden", kind !== "installments");
  root.querySelector("[data-et-scenario-panel-bundle]")?.classList.toggle("hidden", kind !== "bundle");
  const hint = root.querySelector<HTMLElement>("[data-et-scenario-kind-hint]");
  if (hint) hint.textContent = KIND_HINTS[kind] ?? "";
}

function readBundleItems(root: HTMLElement, deps: ScenarioUiDeps): ExpenseScenario["items"] {
  const host = root.querySelector<HTMLElement>("[data-et-scenario-bundle-items]");
  if (!host) return [];
  const rows = host.querySelectorAll<HTMLElement>("[data-et-scenario-bundle-row]");
  const items: NonNullable<ExpenseScenario["items"]> = [];
  rows.forEach((row) => {
    const label = row.querySelector<HTMLInputElement>("[data-et-bundle-label]")?.value?.trim() ?? "";
    const amount = Number(row.querySelector<HTMLInputElement>("[data-et-bundle-amount]")?.value);
    if (!label && !amount) return;
    items.push({ id: row.dataset.bundleRowId || deps.makeId(), label: label || "Partida", amount: Math.max(0, amount) });
  });
  return items;
}

function addBundleRow(root: HTMLElement, deps: ScenarioUiDeps, label = "", amount = "") {
  const host = root.querySelector<HTMLElement>("[data-et-scenario-bundle-items]");
  if (!host) return;
  const row = document.createElement("div");
  row.className = "grid grid-cols-[1fr_6rem_auto] gap-2 items-end";
  row.dataset.etScenarioBundleRow = "";
  row.dataset.bundleRowId = deps.makeId();
  row.innerHTML = `
    <label class="space-y-1"><span class="text-[10px] font-semibold text-gray-500">Concepto</span>
    <input type="text" data-et-bundle-label class="et-field w-full text-sm py-1.5" value="${label.replace(/"/g, "&quot;")}" /></label>
    <label class="space-y-1"><span class="text-[10px] font-semibold text-gray-500">€</span>
    <input type="number" step="0.01" min="0" data-et-bundle-amount class="et-field w-full text-sm py-1.5 font-mono" value="${amount}" /></label>
    <button type="button" data-et-bundle-remove class="et-btn-secondary text-xs py-1.5 mb-0.5">×</button>`;
  row.querySelector("[data-et-bundle-remove]")?.addEventListener("click", () => row.remove());
  host.appendChild(row);
}

export function openScenarioDialog(root: HTMLElement, deps: ScenarioUiDeps, scenario: ExpenseScenario | null) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-scenario]");
  const title = root.querySelector<HTMLElement>("[data-et-scenario-dialog-title]");
  const idEl = root.querySelector<HTMLInputElement>("[data-et-scenario-id]");
  const kindEl = root.querySelector<HTMLSelectElement>("[data-et-scenario-kind]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-scenario-category]");
  const delBtn = root.querySelector<HTMLButtonElement>("[data-et-scenario-delete]");
  if (!dlg || !title || !idEl || !kindEl || !catEl || !delBtn) return;

  title.textContent = scenario ? "Editar simulación" : "Nueva simulación";
  idEl.value = scenario?.id ?? "";
  kindEl.value = scenario?.kind ?? "one_off";
  deps.fillCategorySelect(catEl);
  catEl.value = scenario?.categoryId ?? deps.getState().categories[0]!.id;
  (root.querySelector("[data-et-scenario-title]") as HTMLInputElement).value = scenario?.title ?? "";
  (root.querySelector("[data-et-scenario-amount]") as HTMLInputElement).value =
    scenario?.amount != null ? String(scenario.amount) : "";
  (root.querySelector("[data-et-scenario-target-date]") as HTMLInputElement).value = scenario?.targetDate?.slice(0, 10) ?? "";
  (root.querySelector("[data-et-scenario-installment-amount]") as HTMLInputElement).value =
    scenario?.installmentAmount != null ? String(scenario.installmentAmount) : "";
  (root.querySelector("[data-et-scenario-installment-count]") as HTMLInputElement).value =
    scenario?.installmentCount != null ? String(scenario.installmentCount) : "12";
  (root.querySelector("[data-et-scenario-start-month]") as HTMLInputElement).value = scenario?.startMonth ?? "";
  (root.querySelector("[data-et-scenario-bundle-month]") as HTMLInputElement).value =
    scenario?.startMonth ?? scenario?.targetDate?.slice(0, 7) ?? "";
  (root.querySelector("[data-et-scenario-status]") as HTMLSelectElement).value = scenario?.status ?? "idea";
  (root.querySelector("[data-et-scenario-note]") as HTMLInputElement).value = scenario?.note ?? "";
  delBtn.classList.toggle("invisible", !scenario);

  const bundleHost = root.querySelector<HTMLElement>("[data-et-scenario-bundle-items]");
  if (bundleHost) {
    bundleHost.innerHTML = "";
    const items = scenario?.items ?? [];
    if (items.length) items.forEach((it) => addBundleRow(root, deps, it.label, String(it.amount)));
    else addBundleRow(root, deps);
  }

  syncScenarioKindPanels(root);
  dlg.showModal();
  const dateEl = root.querySelector<HTMLInputElement>("[data-et-scenario-target-date]");
  if (dateEl) refreshExpenseDatePicker(dateEl, dateEl.value);
  initExpenseMonthPickers(root);
}

function saveScenarioFromDialog(root: HTMLElement, deps: ScenarioUiDeps) {
  const state = deps.getState();
  const id = root.querySelector<HTMLInputElement>("[data-et-scenario-id]")?.value?.trim();
  const kind = root.querySelector<HTMLSelectElement>("[data-et-scenario-kind]")?.value as ScenarioKind;
  const title = root.querySelector<HTMLInputElement>("[data-et-scenario-title]")?.value?.trim() ?? "";
  if (!title) return;
  const row: ExpenseScenario = {
    id: id || deps.makeId(),
    title,
    kind: kind === "installments" || kind === "bundle" ? kind : "one_off",
    categoryId: root.querySelector<HTMLSelectElement>("[data-et-scenario-category]")?.value,
    status: (root.querySelector<HTMLSelectElement>("[data-et-scenario-status]")?.value ??
      "idea") as ExpenseScenario["status"],
    note: root.querySelector<HTMLInputElement>("[data-et-scenario-note]")?.value?.trim() || undefined,
    currency: "EUR",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  if (row.kind === "one_off") {
    row.amount = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-amount]")?.value);
    row.targetDate = root.querySelector<HTMLInputElement>("[data-et-scenario-target-date]")?.value?.slice(0, 10);
  } else if (row.kind === "installments") {
    row.installmentAmount = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-installment-amount]")?.value);
    row.installmentCount = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-installment-count]")?.value);
    row.startMonth = root.querySelector<HTMLInputElement>("[data-et-scenario-start-month]")?.value?.slice(0, 7);
  } else {
    row.items = readBundleItems(root, deps);
    const mk = root.querySelector<HTMLInputElement>("[data-et-scenario-bundle-month]")?.value?.slice(0, 7);
    row.startMonth = mk;
    row.targetDate = mk ? `${mk}-15` : undefined;
  }
  const list = [...(state.scenarios ?? [])];
  const idx = list.findIndex((s) => s.id === row.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.push(row);
  deps.setState({ ...state, scenarios: list });
  deps.persist();
  root.querySelector<HTMLDialogElement>("[data-et-dlg-scenario]")?.close();
  deps.renderAll(root);
}

async function deleteScenarioFromDialog(root: HTMLElement, deps: ScenarioUiDeps) {
  const id = root.querySelector<HTMLInputElement>("[data-et-scenario-id]")?.value?.trim();
  if (!id) return;
  if (!(await deps.showConfirmDialog(root, "¿Eliminar esta simulación?", "Eliminar"))) return;
  const state = deps.getState();
  deps.setState({ ...state, scenarios: (state.scenarios ?? []).filter((s) => s.id !== id) });
  scenarioCompareIds = scenarioCompareIds.filter((x) => x !== id);
  deps.persist();
  root.querySelector<HTMLDialogElement>("[data-et-dlg-scenario]")?.close();
  deps.renderAll(root);
}

async function promoteScenario(root: HTMLElement, deps: ScenarioUiDeps, scenarioId: string) {
  const state = deps.getState();
  const scenario = (state.scenarios ?? []).find((s) => s.id === scenarioId);
  if (!scenario) return;
  if (!(await deps.showConfirmDialog(root, "¿Promover a gasto previsto? Empezará a contar en KPIs y gráficos.", "Promover")))
    return;
  const planned = scenarioToPlannedExpense(scenario, state.categories[0]!.id);
  const list = [...(state.plannedExpenses ?? []), planned];
  deps.setState({
    ...state,
    plannedExpenses: list,
    scenarios: (state.scenarios ?? []).map((s) =>
      s.id === scenarioId ? { ...s, status: "go" as const } : s,
    ),
  });
  deps.persist();
  deps.renderAll(root);
}

function toggleScenarioCompare(id: string) {
  if (scenarioCompareIds.includes(id)) {
    scenarioCompareIds = scenarioCompareIds.filter((x) => x !== id);
  } else if (scenarioCompareIds.length < 3) {
    scenarioCompareIds = [...scenarioCompareIds, id];
  }
}

function renderScenarioCompare(root: HTMLElement, state: ExpenseTrackerState) {
  const panel = root.querySelector<HTMLElement>("[data-et-scenario-compare-panel]");
  const grid = root.querySelector<HTMLElement>("[data-et-scenario-compare-grid]");
  if (!panel || !grid) return;
  if (!scenarioCompareIds.length) {
    panel.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }
  panel.classList.remove("hidden");
  grid.innerHTML = "";
  const rows = compareScenarios(state, scenarioCompareIds);
  for (const v of rows) {
    const sc = (state.scenarios ?? []).find((s) => s.id === v.scenarioId);
    if (!sc) continue;
    const card = document.createElement("div");
    card.className = "rounded-lg border border-violet-200/60 dark:border-violet-800/50 bg-white/80 dark:bg-gray-950/60 p-2 text-xs space-y-1";
    card.innerHTML = `
      <p class="m-0 font-semibold text-gray-900 dark:text-gray-50 truncate">${sc.title}</p>
      <p class="m-0"><span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${trafficClass(v.trafficLight)}">${trafficLabel(v.trafficLight)}</span></p>
      <p class="m-0 text-gray-600 dark:text-gray-400">Coste/mes: <strong>${formatEurEs(v.monthlyImpact)}</strong></p>
      <p class="m-0 text-gray-600 dark:text-gray-400">Efectivo tras el pago: <strong>${formatEurEs(Math.max(0, v.cashAvailable - v.oneOffTotal))}</strong></p>`;
    grid.appendChild(card);
  }
}

export function renderScenarioSection(root: HTMLElement, deps: ScenarioUiDeps) {
  const list = root.querySelector<HTMLElement>("[data-et-scenarios-list]");
  if (!list) return;
  disposeScenarioCharts();
  list.innerHTML = "";
  const state = deps.getState();
  const scenarios = state.scenarios ?? [];
  renderScenarioCompare(root, state);

  if (!scenarios.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 col-span-full py-2";
    empty.textContent =
      "Aún no hay simulaciones. Prueba «¿me llega el móvil a 50 €/mes?» o un viaje con vuelo + hotel.";
    list.appendChild(empty);
    return;
  }

  for (const sc of scenarios) {
    const v = evaluateScenarioViability(state, sc);
    const card = document.createElement("article");
    card.className =
      "rounded-2xl border border-violet-200/60 dark:border-violet-800/45 bg-white/85 dark:bg-gray-950/55 shadow-sm p-3 space-y-2 flex flex-col";
    const head = document.createElement("div");
    head.className = "flex items-start justify-between gap-2";
    const title = document.createElement("p");
    title.className = "m-0 font-semibold text-gray-900 dark:text-gray-50";
    title.textContent = sc.title;
    const badge = document.createElement("span");
    badge.className = `shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${trafficClass(v.trafficLight)}`;
    badge.textContent = trafficLabel(v.trafficLight);
    badge.title = trafficHint(v.trafficLight);
    head.append(title, badge);

    const sub = document.createElement("p");
    sub.className = "m-0 text-sm et-amount text-violet-800 dark:text-violet-200";
    if (sc.kind === "installments") {
      sub.textContent = `${formatEurEs(sc.installmentAmount ?? 0)}/mes durante ${sc.installmentCount ?? 0} meses · Total ${formatEurEs(scenarioTotalAmount(sc))}`;
    } else if (sc.kind === "bundle") {
      const n = sc.items?.length ?? 0;
      sub.textContent = `${formatEurEs(scenarioTotalAmount(sc))} en un mes · ${n} concepto${n === 1 ? "" : "s"}`;
    } else {
      sub.textContent = `Pago único de ${formatEurEs(scenarioTotalAmount(sc))}`;
    }

    const meta = document.createElement("p");
    meta.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed";
    meta.textContent = `Margen mensual (ingresos − gastos, suscripciones y previstos): ${formatEurEs(v.monthlySurplus)} · Efectivo en cuentas: ${formatEurEs(v.cashAvailable)}`;

    const chartEl = document.createElement("div");
    chartEl.className = "min-h-[168px] w-full";
    chartEl.dataset.etScenarioChart = sc.id;

    const actions = document.createElement("div");
    actions.className = "flex flex-wrap gap-1.5 pt-1 mt-auto";
    const mkBtn = (label: string, cls: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    };
    const compareBtn = mkBtn(
      scenarioCompareIds.includes(sc.id) ? "✓ Comparar" : "Comparar",
      `et-btn-secondary text-[11px] py-1 ${scenarioCompareIds.includes(sc.id) ? "ring-2 ring-violet-400" : ""}`,
      () => {
        toggleScenarioCompare(sc.id);
        renderScenarioSection(root, deps);
      },
    );
    actions.append(
      mkBtn("Editar", "et-btn-secondary text-[11px] py-1", () => openScenarioDialog(root, deps, sc)),
      compareBtn,
      mkBtn("Promover a previsto", "et-btn-accent text-[11px] py-1", () => promoteScenario(root, deps, sc.id)),
    );

    card.append(head, sub, meta, chartEl, actions);
    list.appendChild(card);
    requestAnimationFrame(() => renderScenarioMiniChart(chartEl, sc, state));
  }
}

export function bindScenarioUi(root: HTMLElement, deps: ScenarioUiDeps) {
  if (root.dataset.etScenarioBound === "1") return;
  root.dataset.etScenarioBound = "1";

  root.querySelector<HTMLButtonElement>("[data-et-open-scenario-modal]")?.addEventListener("click", () =>
    openScenarioDialog(root, deps, null),
  );
  root.querySelector<HTMLSelectElement>("[data-et-scenario-kind]")?.addEventListener("change", () =>
    syncScenarioKindPanels(root),
  );
  root.querySelector<HTMLButtonElement>("[data-et-scenario-bundle-add]")?.addEventListener("click", () =>
    addBundleRow(root, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-scenario-save]")?.addEventListener("click", () =>
    saveScenarioFromDialog(root, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-scenario-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-scenario]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-scenario-delete]")?.addEventListener("click", () =>
    deleteScenarioFromDialog(root, deps),
  );
}
