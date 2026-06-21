import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  compareScenarios,
  evaluateScenarioViability,
  scenarioMonthlyImpactSeries,
  scenarioTotalAmount,
  type ExpenseScenario,
  type ExpenseTrackerState,
  type ScenarioKind,
  type ScenarioTrafficLight,
  formatEurEs,
} from "@lib/tools-expense-tracker";
import {
  applyScenarioPromotionToState,
  defaultPromoteInputFromScenario,
  type ScenarioPromoteInput,
} from "@lib/tools-expense-scenario-promote";
import { initExpenseMonthPickers, refreshExpenseDatePicker, showExpenseDialog } from "./expense-tracker-dates";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const scenarioCharts = new Map<string, echarts.ECharts>();

export type ScenarioUiDeps = {
  getState: () => ExpenseTrackerState;
  setState: (s: ExpenseTrackerState) => void;
  persist: () => void;
  renderAll: (root: HTMLElement) => void;
  showConfirmDialog: (root: HTMLElement, msg: string, okLabel?: string) => Promise<boolean>;
  fillCategorySelect: (sel: HTMLSelectElement) => void;
  fillWealthAccountSelect: (sel: HTMLSelectElement, selectedId?: string, role?: "expense" | "income") => void;
  makeId: () => string;
  makeExpenseId: () => string;
  bookExpense?: (expense: ExpenseTrackerState["expenses"][number]) => void;
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
      subtext: "Compara lo que ya sales al mes vs. si añades este plan",
      subtextStyle: { fontSize: 9, lineHeight: 14 },
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [params];
        const first = rows[0] as { axisValue?: string; dataIndex?: number } | undefined;
        const idx = first?.dataIndex ?? 0;
        const month = series.months[idx]?.slice(5) ?? first?.axisValue ?? "";
        const base = series.baseline[idx] ?? 0;
        const withPlan = series.withScenario[idx] ?? 0;
        const delta = withPlan - base;
        const deltaStr = delta >= 0 ? `+${formatEurEs(delta)}` : formatEurEs(delta);
        let html = `<strong>${month}</strong><br/>`;
        for (const p of rows as { seriesName?: string; value?: number; marker?: string }[]) {
          html += `${p.marker ?? ""} ${p.seriesName ?? ""}: <strong>${formatEurEs(Number(p.value))}</strong><br/>`;
        }
        html += `<span style="opacity:0.85">Diferencia: ${deltaStr}</span>`;
        return html;
      },
    },
    legend: {
      bottom: 2,
      left: "center",
      itemWidth: 10,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { fontSize: 9 },
    },
    grid: { left: 48, right: 12, top: 44, bottom: 48 },
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
        name: "Sin este plan",
        type: "line",
        smooth: true,
        data: series.baseline,
        showSymbol: false,
        lineStyle: { type: "dashed", color: "#94a3b8" },
        itemStyle: { color: "#94a3b8" },
      },
      {
        name: "Con este plan",
        type: "line",
        smooth: true,
        data: series.withScenario,
        showSymbol: false,
        lineStyle: { color: "#8b5cf6" },
        itemStyle: { color: "#8b5cf6" },
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
  showExpenseDialog(dlg);
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
  openScenarioPromoteDialog(root, deps, scenarioId);
}

function syncScenarioPromotePanels(root: HTMLElement) {
  const kind = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-kind]")?.value;
  const isInstallments = kind === "installments";
  root.querySelector("[data-et-scenario-promote-panel-installments]")?.classList.toggle("hidden", !isInstallments);
  root.querySelector("[data-et-scenario-promote-panel-oneoff]")?.classList.toggle("hidden", isInstallments);
}

function updateScenarioPromotePreview(root: HTMLElement) {
  const preview = root.querySelector<HTMLElement>("[data-et-scenario-promote-preview]");
  if (!preview) return;
  const total = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-total]")?.value);
  const initial = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-initial]")?.value);
  const months = Math.max(1, Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-months]")?.value) || 1);
  const monthly = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-monthly]")?.value);
  if (total > 0 && initial >= 0) {
    const rest = Math.max(0, total - initial);
    preview.textContent = `Restante ${formatEurEs(rest)} en ${months} meses ≈ ${formatEurEs(rest / months)}/mes${monthly > 0 ? ` · Cuota indicada: ${formatEurEs(monthly)}` : ""}`;
  } else if (monthly > 0) {
    preview.textContent = `Cuota mensual: ${formatEurEs(monthly)} × ${months} meses = ${formatEurEs(monthly * months)}`;
  } else {
    preview.textContent = "";
  }
}

function recalcScenarioPromoteMonthly(root: HTMLElement) {
  const total = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-total]")?.value);
  const initial = Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-initial]")?.value);
  const months = Math.max(1, Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-months]")?.value) || 1);
  if (!(total > 0)) return;
  const rest = Math.max(0, total - (initial > 0 ? initial : 0));
  const monthly = Math.round((rest / months) * 100) / 100;
  const monthlyEl = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-monthly]");
  if (monthlyEl) monthlyEl.value = String(monthly);
  updateScenarioPromotePreview(root);
}

export function openScenarioPromoteDialog(root: HTMLElement, deps: ScenarioUiDeps, scenarioId: string) {
  const state = deps.getState();
  const scenario = (state.scenarios ?? []).find((s) => s.id === scenarioId);
  if (!scenario) return;
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-dlg-scenario-promote]");
  if (!dlg) return;

  const defaults = defaultPromoteInputFromScenario(scenario, state.categories[0]!.id);
  root.querySelector<HTMLInputElement>("[data-et-scenario-promote-id]")!.value = scenarioId;
  root.querySelector<HTMLInputElement>("[data-et-scenario-promote-kind]")!.value =
    scenario.kind === "installments" ? "installments" : "one_off";
  (root.querySelector("[data-et-scenario-promote-title]") as HTMLInputElement).value = defaults.title ?? scenario.title;
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-scenario-promote-category]")!;
  deps.fillCategorySelect(catEl);
  catEl.value = defaults.categoryId;
  (root.querySelector("[data-et-scenario-promote-note]") as HTMLInputElement).value = defaults.note ?? "";
  (root.querySelector("[data-et-scenario-promote-monthly]") as HTMLInputElement).value =
    defaults.monthlyAmount != null ? String(defaults.monthlyAmount) : "";
  (root.querySelector("[data-et-scenario-promote-months]") as HTMLInputElement).value =
    String(defaults.installmentCount ?? 12);
  (root.querySelector("[data-et-scenario-promote-start-month]") as HTMLInputElement).value =
    defaults.startMonth ?? new Date().toISOString().slice(0, 7);
  (root.querySelector("[data-et-scenario-promote-day]") as HTMLInputElement).value = String(defaults.dayOfMonth ?? 1);
  (root.querySelector("[data-et-scenario-promote-total]") as HTMLInputElement).value = String(scenarioTotalAmount(scenario));
  (root.querySelector("[data-et-scenario-promote-initial]") as HTMLInputElement).value = "0";
  const initialDateEl = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-initial-date]")!;
  initialDateEl.value = new Date().toISOString().slice(0, 10);
  (root.querySelector("[data-et-scenario-promote-oneoff-amount]") as HTMLInputElement).value =
    defaults.oneOffAmount != null ? String(defaults.oneOffAmount) : "";
  (root.querySelector("[data-et-scenario-promote-oneoff-date]") as HTMLInputElement).value =
    defaults.oneOffDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const registerInitial = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-register-initial]")!;
  registerInitial.checked = true;
  deps.fillWealthAccountSelect(root.querySelector<HTMLSelectElement>("[data-et-scenario-promote-wealth]")!, undefined, "expense");

  syncScenarioPromotePanels(root);
  updateScenarioPromotePreview(root);
  showExpenseDialog(dlg);
  refreshExpenseDatePicker(initialDateEl, initialDateEl.value);
  const oneOffDate = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-oneoff-date]");
  if (oneOffDate) refreshExpenseDatePicker(oneOffDate, oneOffDate.value);
  initExpenseMonthPickers(root);
}

function readScenarioPromoteInput(root: HTMLElement, scenario: ExpenseScenario): ScenarioPromoteInput {
  const title = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-title]")?.value?.trim() ?? scenario.title;
  const categoryId = root.querySelector<HTMLSelectElement>("[data-et-scenario-promote-category]")?.value ?? "";
  const note = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-note]")?.value?.trim() || undefined;
  const kind = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-kind]")?.value;

  if (kind === "installments" || scenario.kind === "installments") {
    return {
      title,
      categoryId,
      currency: "EUR",
      note,
      monthlyAmount: Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-monthly]")?.value),
      installmentCount: Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-months]")?.value),
      startMonth: root.querySelector<HTMLInputElement>("[data-et-scenario-promote-start-month]")?.value?.slice(0, 7),
      dayOfMonth: Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-day]")?.value),
      initialPayment: Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-initial]")?.value),
      initialPaymentDate: root.querySelector<HTMLInputElement>("[data-et-scenario-promote-initial-date]")?.value?.slice(0, 10),
      registerInitialAsExpense: root.querySelector<HTMLInputElement>("[data-et-scenario-promote-register-initial]")?.checked ?? false,
      initialWealthAccountId: root.querySelector<HTMLSelectElement>("[data-et-scenario-promote-wealth]")?.value || undefined,
    };
  }

  const mode = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-oneoff-mode]:checked")?.value;
  return {
    title,
    categoryId,
    currency: "EUR",
    note,
    oneOffAmount: Number(root.querySelector<HTMLInputElement>("[data-et-scenario-promote-oneoff-amount]")?.value),
    oneOffDate: root.querySelector<HTMLInputElement>("[data-et-scenario-promote-oneoff-date]")?.value?.slice(0, 10),
    registerOneOffAsExpense: mode === "expense",
    registerOneOffAsPlanned: mode !== "expense",
  };
}

function saveScenarioPromote(root: HTMLElement, deps: ScenarioUiDeps) {
  const scenarioId = root.querySelector<HTMLInputElement>("[data-et-scenario-promote-id]")?.value?.trim();
  if (!scenarioId) return;
  const state = deps.getState();
  const scenario = (state.scenarios ?? []).find((s) => s.id === scenarioId);
  if (!scenario) return;
  const input = readScenarioPromoteInput(root, scenario);
  const prevCount = state.expenses.length;
  const next = applyScenarioPromotionToState(state, scenarioId, input, deps.makeExpenseId);
  if (next.expenses.length > prevCount) {
    for (const exp of next.expenses.slice(prevCount)) deps.bookExpense?.(exp);
  }
  deps.setState(next);
  deps.persist();
  root.querySelector<HTMLDialogElement>("[data-et-dlg-scenario-promote]")?.close();
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
    chartEl.className = "min-h-[188px] w-full";
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
  root.querySelector<HTMLButtonElement>("[data-et-scenario-promote-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-dlg-scenario-promote]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-scenario-promote-save]")?.addEventListener("click", () =>
    saveScenarioPromote(root, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-scenario-promote-recalc]")?.addEventListener("click", () =>
    recalcScenarioPromoteMonthly(root),
  );
  root.querySelectorAll<HTMLInputElement>(
    "[data-et-scenario-promote-total], [data-et-scenario-promote-initial], [data-et-scenario-promote-months], [data-et-scenario-promote-monthly]",
  ).forEach((el) => el.addEventListener("input", () => updateScenarioPromotePreview(root)));
}
