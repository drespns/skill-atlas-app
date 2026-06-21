import type { ExpenseTrackerState } from "@lib/tools-expense-tracker";
import {
  breakdownActiveSubscriptions,
  breakdownMonthBalance,
  breakdownMonthIncome,
  breakdownNaturalYear,
  breakdownPeriodExpenses,
  breakdownPeriodIncome,
  type KpiBreakdown,
} from "@lib/tools-expense-tracker";
import { formatEurEs } from "@lib/tools-expense-tracker";

export type KpiDetailKey =
  | "subs"
  | "month-income"
  | "month-balance"
  | "period-expenses"
  | "period-income"
  | "year-income"
  | "year-expense"
  | "year-net";

type KpiPopoverDeps = {
  getState: () => ExpenseTrackerState;
  fmtEurCompact: (n: number) => string;
};

let openKey: KpiDetailKey | null = null;
let yearArg = new Date().getFullYear();

function buildBreakdown(key: KpiDetailKey, deps: KpiPopoverDeps): KpiBreakdown {
  const state = deps.getState();
  switch (key) {
    case "subs":
      return breakdownActiveSubscriptions(state);
    case "month-income":
      return breakdownMonthIncome(state);
    case "month-balance":
      return breakdownMonthBalance(state);
    case "period-expenses":
      return breakdownPeriodExpenses(state);
    case "period-income":
      return breakdownPeriodIncome(state);
    case "year-income":
      return breakdownNaturalYear(state, yearArg, "income");
    case "year-expense":
      return breakdownNaturalYear(state, yearArg, "expense");
    case "year-net":
      return breakdownNaturalYear(state, yearArg, "net");
    default:
      return { title: "Detalle", total: 0, lines: [] };
  }
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const pad = 8;
  const w = popover.offsetWidth || 320;
  let left = rect.left;
  let top = rect.bottom + pad;
  if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
  if (left < pad) left = pad;
  const h = popover.offsetHeight || 200;
  if (top + h > window.innerHeight - pad) top = rect.top - h - pad;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function renderBreakdownBody(body: HTMLElement, bd: KpiBreakdown) {
  body.innerHTML = "";
  if (!bd.lines.length) {
    const empty = document.createElement("p");
    empty.className = "m-0 text-xs text-gray-500 dark:text-gray-400";
    empty.textContent = "No hay partidas en este periodo.";
    body.appendChild(empty);
    return;
  }
  for (const line of bd.lines) {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-3 text-sm";
    const lab = document.createElement("span");
    lab.className = "truncate text-gray-700 dark:text-gray-300";
    lab.textContent = line.detail ? `${line.label} · ${line.detail}` : line.label;
    const val = document.createElement("span");
    val.className = "et-amount font-semibold shrink-0 tabular-nums";
    const signed = line.amount < 0 ? `−${formatEurEs(Math.abs(line.amount))}` : formatEurEs(line.amount);
    val.textContent = signed;
    row.append(lab, val);
    body.appendChild(row);
  }
}

export function closeKpiDetailPopover(root: HTMLElement) {
  const popover = root.querySelector<HTMLElement>("[data-et-kpi-detail-popover]");
  if (!popover) return;
  popover.classList.add("hidden");
  openKey = null;
  root.querySelectorAll<HTMLElement>("[data-et-kpi-card][aria-expanded='true']").forEach((el) => {
    el.setAttribute("aria-expanded", "false");
  });
}

export function openKpiDetailPopover(root: HTMLElement, key: KpiDetailKey, anchor: HTMLElement, deps: KpiPopoverDeps, year?: number) {
  const popover = root.querySelector<HTMLElement>("[data-et-kpi-detail-popover]");
  if (!popover) return;
  if (year != null) yearArg = year;
  openKey = key;
  const bd = buildBreakdown(key, deps);
  const title = popover.querySelector<HTMLElement>("[data-et-kpi-detail-title]");
  const subtitle = popover.querySelector<HTMLElement>("[data-et-kpi-detail-subtitle]");
  const total = popover.querySelector<HTMLElement>("[data-et-kpi-detail-total]");
  const body = popover.querySelector<HTMLElement>("[data-et-kpi-detail-body]");
  if (title) title.textContent = bd.title;
  if (subtitle) {
    subtitle.textContent = bd.subtitle ?? "";
    subtitle.classList.toggle("hidden", !bd.subtitle);
  }
  if (total) total.textContent = deps.fmtEurCompact(bd.total);
  if (body) renderBreakdownBody(body, bd);
  popover.classList.remove("hidden");
  requestAnimationFrame(() => positionPopover(popover, anchor));
  root.querySelectorAll<HTMLElement>("[data-et-kpi-card]").forEach((el) => {
    el.setAttribute("aria-expanded", el === anchor ? "true" : "false");
  });
}

export function bindKpiDetailPopovers(root: HTMLElement, deps: KpiPopoverDeps) {
  if (root.dataset.etKpiPopoverBound === "1") return;
  root.dataset.etKpiPopoverBound = "1";

  const popover = root.querySelector<HTMLElement>("[data-et-kpi-detail-popover]");
  popover?.querySelector("[data-et-kpi-detail-close]")?.addEventListener("click", () => closeKpiDetailPopover(root));

  document.addEventListener(
    "pointerdown",
    (ev) => {
      if (!openKey || !popover || popover.classList.contains("hidden")) return;
      const t = ev.target as Node;
      if (popover.contains(t)) return;
      if ((t as HTMLElement).closest?.("[data-et-kpi-card]")) return;
      closeKpiDetailPopover(root);
    },
    true,
  );

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && openKey) closeKpiDetailPopover(root);
  });

  const activate = (el: HTMLElement) => {
    const key = el.dataset.etKpiCard as KpiDetailKey | undefined;
    if (!key) return;
    if (openKey === key && !popover?.classList.contains("hidden")) {
      closeKpiDetailPopover(root);
      return;
    }
    const yearRaw = el.dataset.etKpiYear;
    const year = yearRaw ? Number(yearRaw) : undefined;
    openKpiDetailPopover(root, key, el, deps, year);
  };

  for (const card of root.querySelectorAll<HTMLElement>("[data-et-kpi-card]")) {
    card.addEventListener("click", () => activate(card));
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        activate(card);
      }
    });
  }
}

export function renderYearHistoryChips(root: HTMLElement, years: number[]) {
  const host = root.querySelector<HTMLElement>("[data-et-year-history-chips]");
  if (!host) return;
  const current = new Date().getFullYear();
  host.innerHTML = "";
  for (const y of years) {
    if (y >= current) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "rounded-lg border border-violet-300/60 dark:border-violet-800/60 bg-violet-50/80 dark:bg-violet-950/40 px-2.5 py-1 text-xs font-semibold text-violet-900 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-950/70";
    btn.textContent = String(y);
    btn.dataset.etYearHistoryBtn = String(y);
    host.appendChild(btn);
  }
}
