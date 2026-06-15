/** UI tarjetas + modales para ingresos/gastos previstos e inversiones (expense-tracker). */

import {
  effectivePaycheckAmount,
  effectivePlannedExpenseAmount,
  formatCategoryPath,
  investmentCurrentValue,
  investmentGainLossAmount,
  investmentPortfolioTotals,
  investmentTypeLabel,
  parseCardColor,
  paycheckActiveInMonth,
  plannedExpenseActiveInMonth,
  type ExpenseTrackerState,
  type InvestmentHolding,
  type PaycheckEntry,
  type PlannedExpenseEntry,
} from "@lib/tools-expense-tracker";

export type RecurringUiDeps = {
  state: ExpenseTrackerState;
  fmtEur: (n: number) => string;
  fmtEurCompact: (n: number) => string;
  amountInEur: (amount: number, currency: "EUR" | "USD", fx: number) => number;
  todayIso: () => string;
  makeId: () => string;
  openPaycheckDialog: (root: HTMLElement, p?: PaycheckEntry | null) => void;
  openPlannedDialog: (root: HTMLElement, p?: PlannedExpenseEntry | null) => void;
  openInvestmentDialog: (root: HTMLElement, h?: InvestmentHolding | null) => void;
};

function recurringEnded(validUntil?: string, today: string): boolean {
  const vu = validUntil?.trim().slice(0, 10);
  return Boolean(vu && vu.length === 10 && today > vu);
}

function paycheckAmountEur(deps: RecurringUiDeps, p: PaycheckEntry): number {
  const fx = deps.state.eurPerUsd;
  return deps.amountInEur(p.typicalAmount ?? 0, p.currency ?? "EUR", fx);
}

function plannedAmountEur(deps: RecurringUiDeps, p: PlannedExpenseEntry): number {
  const fx = deps.state.eurPerUsd;
  return deps.amountInEur(p.typicalAmount ?? 0, p.currency ?? "EUR", fx);
}

function makeRecurringCard(
  opts: {
    title: string;
    amount: string;
    badge?: string;
    meta: string;
    ended: boolean;
    tone: "rose" | "teal";
    onClick: () => void;
  },
): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  const border =
    opts.tone === "rose"
      ? "border-rose-200/70 dark:border-rose-900/50"
      : "border-teal-200/70 dark:border-teal-900/50";
  card.className =
    `et-recurring-card text-left rounded-2xl border ${border} bg-white/90 dark:bg-gray-950/70 p-4 shadow-sm space-y-2 w-full` +
    (opts.ended ? " opacity-70 grayscale-[0.4]" : "");
  const badge = document.createElement("p");
  badge.className = "m-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
  badge.textContent = opts.badge ?? (opts.ended ? "Finalizado (referencia)" : "Activo en calendario");
  const h = document.createElement("p");
  h.className = "m-0 text-base font-semibold text-gray-900 dark:text-gray-50 truncate";
  h.textContent = opts.title;
  const amt = document.createElement("p");
  amt.className = "m-0 text-lg font-bold font-mono text-gray-800 dark:text-gray-100";
  amt.textContent = opts.amount;
  const meta = document.createElement("p");
  meta.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2";
  meta.textContent = opts.meta;
  card.append(badge, h, amt, meta);
  card.addEventListener("click", opts.onClick);
  return card;
}

export function renderPaycheckCards(root: HTMLElement, deps: RecurringUiDeps, sortDesc: boolean) {
  const wrap = root.querySelector<HTMLElement>("[data-et-paychecks-list]");
  if (!wrap) return;
  wrap.innerHTML = "";
  const today = deps.todayIso();
  const curMonth = today.slice(0, 7);
  let list = [...(deps.state.paychecks ?? [])];
  list.sort((a, b) => {
    const da = paycheckAmountEur(deps, a);
    const db = paycheckAmountEur(deps, b);
    return sortDesc ? db - da : da - db;
  });
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 py-2 col-span-full";
    empty.textContent = "Sin ingresos previstos. Pulsa «Añadir» para crear uno.";
    wrap.appendChild(empty);
    return;
  }
  for (const p of list) {
    const ended = recurringEnded(p.validUntil, today);
    const activeNow = paycheckActiveInMonth(p, curMonth);
    const amt = effectivePaycheckAmount(p, curMonth, deps.state.incomeMonthOverrides ?? []);
    const metaParts = [`Día ${p.dayOfMonth}`];
    if (p.validFrom) metaParts.push(`desde ${p.validFrom.slice(0, 10)}`);
    if (p.validUntil) metaParts.push(`hasta ${p.validUntil.slice(0, 10)}`);
    if (p.note) metaParts.push(p.note);
    wrap.appendChild(
      makeRecurringCard({
        title: p.title,
        amount: fmtEurLabel(deps, amt.amount, amt.currency),
        badge: ended ? "Finalizado · solo referencia" : activeNow ? "Cuenta este mes" : "Fuera de vigencia",
        meta: metaParts.join(" · "),
        ended,
        tone: "teal",
        onClick: () => deps.openPaycheckDialog(root, p),
      }),
    );
  }
}

export function renderPlannedCards(root: HTMLElement, deps: RecurringUiDeps, sortDesc: boolean) {
  const wrap = root.querySelector<HTMLElement>("[data-et-planned-list]");
  if (!wrap) return;
  wrap.innerHTML = "";
  const today = deps.todayIso();
  const curMonth = today.slice(0, 7);
  let list = [...(deps.state.plannedExpenses ?? [])];
  list.sort((a, b) => {
    const da = plannedAmountEur(deps, a);
    const db = plannedAmountEur(deps, b);
    return sortDesc ? db - da : da - db;
  });
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 py-2 col-span-full";
    empty.textContent = "Sin gastos previstos. Pulsa «Añadir» para crear uno.";
    wrap.appendChild(empty);
    return;
  }
  for (const p of list) {
    const ended = recurringEnded(p.validUntil, today);
    const activeNow = plannedExpenseActiveInMonth(p, curMonth);
    const amt = effectivePlannedExpenseAmount(p, curMonth, deps.state.plannedExpenseMonthOverrides ?? []);
    const cat = formatCategoryPath(deps.state, p.categoryId);
    const metaParts = [cat, `Día ${p.dayOfMonth}`];
    if (p.validFrom) metaParts.push(`desde ${p.validFrom.slice(0, 10)}`);
    if (p.validUntil) metaParts.push(`hasta ${p.validUntil.slice(0, 10)}`);
    wrap.appendChild(
      makeRecurringCard({
        title: p.title,
        amount: fmtEurLabel(deps, amt.amount, amt.currency),
        badge: ended ? "Finalizado · solo referencia" : activeNow ? "Cuenta este mes" : "Fuera de vigencia",
        meta: metaParts.join(" · "),
        ended,
        tone: "rose",
        onClick: () => deps.openPlannedDialog(root, p),
      }),
    );
  }
}

function fmtEurLabel(deps: RecurringUiDeps, amount: number, currency: "EUR" | "USD") {
  return deps.fmtEur(deps.amountInEur(amount, currency, deps.state.eurPerUsd));
}

export function renderInvestmentSection(root: HTMLElement, deps: RecurringUiDeps) {
  const grid = root.querySelector<HTMLElement>("[data-et-investments-grid]");
  const elInv = root.querySelector<HTMLElement>("[data-et-inv-kpi-invested]");
  const elCur = root.querySelector<HTMLElement>("[data-et-inv-kpi-current]");
  const elPnl = root.querySelector<HTMLElement>("[data-et-inv-kpi-pnl]");
  if (!grid) return;
  grid.innerHTML = "";
  const holdings = deps.state.investments ?? [];
  const totals = investmentPortfolioTotals(holdings);
  if (elInv) elInv.textContent = deps.fmtEurCompact(totals.invested);
  if (elCur) elCur.textContent = deps.fmtEurCompact(totals.current);
  if (elPnl) {
    const sign = totals.gainLoss >= 0 ? "+" : "";
    elPnl.textContent = `${sign}${deps.fmtEurCompact(totals.gainLoss)}`;
    elPnl.classList.toggle("text-emerald-600", totals.gainLoss >= 0);
    elPnl.classList.toggle("dark:text-emerald-400", totals.gainLoss >= 0);
    elPnl.classList.toggle("text-rose-600", totals.gainLoss < 0);
    elPnl.classList.toggle("dark:text-rose-400", totals.gainLoss < 0);
  }
  if (!holdings.length) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-600 dark:text-gray-400 col-span-full py-2";
    empty.textContent = "Aún no hay posiciones. Añade activos con cantidad y rendimiento % manual.";
    grid.appendChild(empty);
    return;
  }
  const sorted = [...holdings].sort(
    (a, b) => investmentCurrentValue(b) - investmentCurrentValue(a),
  );
  for (const h of sorted) {
    const card = document.createElement("button");
    card.type = "button";
    const c = parseCardColor(h.cardColor) ?? "#8b5cf6";
    card.className =
      "et-recurring-card text-left rounded-2xl border shadow-sm p-4 space-y-2 w-full";
    card.style.borderColor = `${c}55`;
    card.style.background = `linear-gradient(135deg,${c}28,${c}10,transparent)`;
    const type = document.createElement("p");
    type.className = "m-0 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300";
    type.textContent = `${investmentTypeLabel(h.type)} · ${h.platform}`;
    const name = document.createElement("p");
    name.className = "m-0 text-base font-semibold text-gray-900 dark:text-gray-50";
    name.textContent = h.name;
    const val = document.createElement("p");
    val.className = "m-0 text-lg font-bold font-mono text-gray-800 dark:text-gray-100";
    val.textContent = deps.fmtEur(investmentCurrentValue(h));
    const sub = document.createElement("p");
    sub.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400";
    const pnl = investmentGainLossAmount(h);
    const sign = pnl >= 0 ? "+" : "";
    const qty = ` · ${h.quantity} u.`;
    sub.textContent = `Invertido ${deps.fmtEur(h.totalInvested)}${qty} · Rend. ${sign}${h.gainLossPct.toFixed(1)}% (${sign}${deps.fmtEur(pnl)})`;
    card.append(type, name, val, sub);
    card.addEventListener("click", () => deps.openInvestmentDialog(root, h));
    grid.appendChild(card);
  }
}
