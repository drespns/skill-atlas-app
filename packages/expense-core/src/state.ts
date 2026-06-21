/** Modelo y utilidades para la herramienta Gastos + Suscripciones (`/tools/expense-tracker`). */

export const EXPENSE_TRACKER_STORAGE_KEY = "skillatlas_tools_expense_tracker_v1";

export type ExpenseCurrency = "EUR" | "USD";

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";

/** Cómo agregar importes en gráficos y KPIs. */
export type ChartMoneyMode = "mixed" | "unify_eur" | "unify_usd";

export type PeriodFilter = "all" | "12m" | "90d" | "30d" | "6m" | "ytd";

export type ExpenseCategory = {
  id: string;
  name: string;
  color: string;
  /** Si existe, es subcategoría (p. ej. «HBO» bajo «Software y nube»). */
  parentId: string | null;
};

/** Adjunto como enlace HTTPS (sin binarios en servidor en esta iteración). */
export type ExpenseAttachment = { id: string; title: string; url: string };

export type ExpenseRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: ExpenseCurrency;
  categoryId: string;
  notes: string;
  /** Etiquetas libres (minúsculas recomendadas). */
  tags: string[];
  attachments: ExpenseAttachment[];
  /**
   * Si false, el gasto es borrador (no cuenta en KPIs ni gráficos hasta confirmar).
   * Ausente o true = confirmado (comportamiento histórico).
   */
  confirmed?: boolean;
  /** Cuenta de patrimonio a la que imputar el movimiento (resta al confirmar). */
  wealthAccountId?: string;
};

export type SubscriptionRow = {
  id: string;
  name: string;
  amount: number;
  currency: ExpenseCurrency;
  cycle: BillingCycle;
  categoryId: string;
  /** YYYY-MM-DD próximo cobro (legacy o rellenado al guardar desde billingStartDate). */
  nextBilling: string;
  /** YYYY-MM-DD desde cuándo / 1.er cargo; si existe, se calcula el próximo cobro por ciclo. */
  billingStartDate?: string;
  active: boolean;
  /**
   * YYYY-MM-DD: deja de contar en totales/gráficos desde esta fecha (p. ej. día de cobro al cancelar).
   * La tarjeta sigue visible; hasta esa fecha aún cuenta como activa.
   */
  cancelEffectiveDate?: string;
  notes: string;
  tags: string[];
  /** Color de tarjeta (#RRGGBB). */
  cardColor?: string;
};

export type InvestmentAssetType =
  | "stocks"
  | "ipo"
  | "etf"
  | "metals"
  | "crypto"
  | "bonds"
  | "other";

/** Cuenta de liquidez (banco, broker cash…) para el bloque Patrimonio. */
export type WealthAccount = {
  id: string;
  name: string;
  /** Saldo en EUR (efectivo / cuenta corriente). */
  balance: number;
  /** Primeros dígitos visibles (p. ej. ES79). */
  ibanPrefix?: string;
  /** Gastos confirmados restan de esta cuenta por defecto. */
  isDefaultExpense?: boolean;
  /** Ingresos confirmados y cobros suman aquí por defecto. */
  isDefaultIncome?: boolean;
  /** Efectivo disponible para comprar activos (Trade Republic, etc.). */
  isDefaultInvestment?: boolean;
  /** Saldo en la fecha de inicio del registro (punto de partida). */
  openingBalance?: number;
};

/** Traspaso interno entre cuentas de patrimonio (no es gasto ni ingreso). */
export type WealthTransfer = {
  id: string;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
};

export type WealthBizumDirection = "sent" | "received";

/** Bizum u otro pago P2P: ajusta una sola cuenta (enviado resta, recibido suma). */
export type WealthBizum = {
  id: string;
  date: string;
  direction: WealthBizumDirection;
  accountId: string;
  amount: number;
  /** Persona o concepto (opc.) */
  note?: string;
};

/** Posición manual (sin precio en tiempo real; rendimiento % actualizado a mano). */
export type InvestmentHolding = {
  id: string;
  /** Nombre del activo (p. ej. XRP, Apple). */
  name: string;
  type: InvestmentAssetType;
  /** Entidad / broker (p. ej. Trade Republic). */
  platform: string;
  /** Precio medio de compra por unidad (EUR). */
  avgBuyPrice: number;
  /** Cantidad de unidades (acciones, monedas…). */
  quantity: number;
  /** Capital desembolsado (EUR); se deriva de precio × cantidad al guardar. */
  totalInvested: number;
  /** Rendimiento % respecto al total invertido (negativo = pérdida). */
  gainLossPct: number;
  notes?: string;
  /** Color de tarjeta (#RRGGBB). */
  cardColor?: string;
};

/** Cobro recurrente esperado (p. ej. nómina): día del mes y nota opcional. */
export type PaycheckEntry = {
  id: string;
  title: string;
  /** 1–31 */
  dayOfMonth: number;
  /** Días antes del día como ventana (“cobro entre el 24 y el 26”). */
  windowBefore?: number;
  note?: string;
  /** Importe habitual por cobro (editable; overrides por mes opcionales). */
  typicalAmount?: number;
  currency?: ExpenseCurrency;
  /** Si el cobro varía, rango orientativo (opcional). */
  amountMin?: number;
  amountMax?: number;
  /** YYYY-MM-DD: cobro previsto desde esta fecha (inclusive). */
  validFrom?: string;
  /** YYYY-MM-DD: fin previsto (p. ej. baja del paro), inclusive. */
  validUntil?: string;
};

/** Importe real o ajustado para un cobro en un mes concreto (YYYY-MM). */
export type IncomeMonthOverride = {
  id: string;
  paycheckId: string;
  month: string;
  amount: number;
  currency: ExpenseCurrency;
};

/** Ingreso puntual (tabla «Ingresos»; mismo esquema operativo que un gasto pero suma en balance). */
export type IncomeAdhocRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: ExpenseCurrency;
  categoryId: string;
  notes: string;
  tags: string[];
  attachments: ExpenseAttachment[];
  /** false = borrador (no cuenta en KPIs/gráficos hasta confirmar). */
  confirmed?: boolean;
  wealthAccountId?: string;
};

/** Gasto recurrente previsto (alquiler, cuota fija…): misma forma que cobro pero con categoría. */
export type PlannedExpenseEntry = {
  id: string;
  title: string;
  dayOfMonth: number;
  windowBefore?: number;
  note?: string;
  typicalAmount?: number;
  currency?: ExpenseCurrency;
  categoryId: string;
  amountMin?: number;
  amountMax?: number;
  validFrom?: string;
  validUntil?: string;
};

/** Ajuste de importe previsto en un mes concreto (YYYY-MM). */
export type PlannedExpenseMonthOverride = {
  id: string;
  plannedExpenseId: string;
  month: string;
  amount: number;
  currency: ExpenseCurrency;
};

import type { ExpenseScenario, ScenarioKind, ScenarioStatus, ScenarioPriority, ScenarioBundleItem } from "./scenarios";
import type { ExpenseDebt } from "./debts";
import { parseExpenseDebts } from "./debts";

export type ExpenseReminder = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  /** Si true, se intenta `Notification` del navegador el día indicado. */
  notifyBrowser: boolean;
  expenseId?: string;
};

export type ExpenseTrackerState = {
  v: 2;
  categories: ExpenseCategory[];
  expenses: ExpenseRow[];
  subscriptions: SubscriptionRow[];
  reminders: ExpenseReminder[];
  /** Sugerencias de autocompletado (opcional). */
  tagBank: string[];
  /** Si es true y hay sesión, se hace upsert en `user_client_state` (scope dedicado). */
  syncToAccount: boolean;
  /**
   * Si true, en la nube solo se guarda un blob cifrado (AES-GCM + PBKDF2); la frase no sale del dispositivo.
   * No es «cero conocimiento» respecto al proveedor de hosting, pero nadie sin la frase puede leer el contenido.
   */
  cloudE2E: boolean;
  chartMoneyMode: ChartMoneyMode;
  /** 1 USD equivale a X EUR (editable; p. ej. 0,92). */
  eurPerUsd: number;
  period: PeriodFilter;
  /** Filtro solo para gráficos de evolución (id de categoría raíz o vacío = todas). */
  chartFilterCategoryId: string;
  paychecks: PaycheckEntry[];
  incomeMonthOverrides: IncomeMonthOverride[];
  incomeAdhoc: IncomeAdhocRow[];
  plannedExpenses: PlannedExpenseEntry[];
  plannedExpenseMonthOverrides: PlannedExpenseMonthOverride[];
  investments: InvestmentHolding[];
  /** Cuentas de liquidez (patrimonio en efectivo). */
  wealthAccounts: WealthAccount[];
  /** Historial de traspasos entre cuentas. */
  wealthTransfers?: WealthTransfer[];
  /** Bizums y pagos P2P (una cuenta). */
  wealthBizums?: WealthBizum[];
  /** Si true, patrimonio = efectivo + capital invertido (sin P/L). Si false, incluye valor de mercado estimado. */
  patrimonioRealMode?: boolean;
  /** Solo se contabilizan movimientos en KPIs/gráficos desde esta fecha (YYYY-MM-DD). */
  trackingStartDate?: string;
  /** Simulaciones / deseos (no cuentan en KPIs hasta promover). */
  scenarios?: ExpenseScenario[];
  /** Deudas pendientes (cuotas con fechas; al pagar → gasto confirmado). */
  debts?: ExpenseDebt[];
};

export const EXPENSE_TRACKER_CLIENT_SCOPE = "tools_expense_tracker" as const;

const DEFAULT_EUR_PER_USD = 0.92;

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "cat_housing", name: "Vivienda", color: "#6366f1", parentId: null },
  { id: "cat_transport", name: "Transporte", color: "#0ea5e9", parentId: null },
  { id: "cat_food", name: "Alimentación", color: "#22c55e", parentId: null },
  { id: "cat_software", name: "Software y nube", color: "#a855f7", parentId: null },
  { id: "cat_entertainment", name: "Ocio", color: "#f97316", parentId: null },
  { id: "cat_health", name: "Salud", color: "#ec4899", parentId: null },
  { id: "cat_services", name: "Servicios", color: "#eab308", parentId: null },
  { id: "cat_other", name: "Otros", color: "#64748b", parentId: null },
];

/** Categorías legacy retiradas: traspasos y bizums van por cuentas, no por gastos. */
export const EXCLUDED_WEALTH_CATEGORY_IDS = ["cat_transfer", "cat_bizum"] as const;

const EXCLUDED_WEALTH_CATEGORY_SET = new Set<string>(EXCLUDED_WEALTH_CATEGORY_IDS);

export function sanitizeExpenseCategories(categories: ExpenseCategory[]): ExpenseCategory[] {
  const filtered = categories.filter((c) => !EXCLUDED_WEALTH_CATEGORY_SET.has(c.id));
  const validated = validateCategoryTree(filtered);
  if (validated.length) return validated;
  return DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c }));
}

export function migrateExcludedCategoryReferences(
  data: Pick<ExpenseTrackerState, "expenses" | "subscriptions" | "plannedExpenses" | "incomeAdhoc">,
): Pick<ExpenseTrackerState, "expenses" | "subscriptions" | "plannedExpenses" | "incomeAdhoc"> {
  const fallback = "cat_other";
  const fix = (cid: string) => (EXCLUDED_WEALTH_CATEGORY_SET.has(cid) ? fallback : cid);
  return {
    expenses: data.expenses.map((e) => ({ ...e, categoryId: fix(e.categoryId) })),
    subscriptions: data.subscriptions.map((s) => ({ ...s, categoryId: fix(s.categoryId) })),
    plannedExpenses: (data.plannedExpenses ?? []).map((p) => ({ ...p, categoryId: fix(p.categoryId) })),
    incomeAdhoc: (data.incomeAdhoc ?? []).map((r) => ({ ...r, categoryId: fix(r.categoryId) })),
  };
}

export function countCategoryUsage(state: ExpenseTrackerState, categoryId: string): number {
  let n = 0;
  n += state.expenses.filter((e) => e.categoryId === categoryId).length;
  n += state.subscriptions.filter((s) => s.categoryId === categoryId).length;
  n += (state.plannedExpenses ?? []).filter((p) => p.categoryId === categoryId).length;
  n += (state.incomeAdhoc ?? []).filter((r) => r.categoryId === categoryId).length;
  return n;
}

export function reassignCategoryReferences(state: ExpenseTrackerState, fromId: string, toId: string): void {
  if (fromId === toId) return;
  state.expenses = state.expenses.map((e) => (e.categoryId === fromId ? { ...e, categoryId: toId } : e));
  state.subscriptions = state.subscriptions.map((s) => (s.categoryId === fromId ? { ...s, categoryId: toId } : s));
  state.plannedExpenses = (state.plannedExpenses ?? []).map((p) =>
    p.categoryId === fromId ? { ...p, categoryId: toId } : p,
  );
  state.incomeAdhoc = (state.incomeAdhoc ?? []).map((r) =>
    r.categoryId === fromId ? { ...r, categoryId: toId } : r,
  );
}

/** Totales de bizums enviados (restan) y recibidos (suman) en un rango de fechas. */
export function computeBizumTotalsForPeriod(
  bizums: WealthBizum[],
  fromIso: string | null,
  untilIso: string = new Date().toISOString().slice(0, 10),
): { sent: number; received: number } {
  let sent = 0;
  let received = 0;
  for (const b of bizums) {
    const d = b.date.slice(0, 10);
    if (fromIso && d < fromIso) continue;
    if (d > untilIso) continue;
    if (b.direction === "sent") sent += b.amount;
    else received += b.amount;
  }
  return { sent: roundMoney(sent), received: roundMoney(received) };
}

export function defaultExpenseTrackerState(): ExpenseTrackerState {
  return {
    v: 2,
    categories: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c })),
    expenses: [],
    subscriptions: [],
    reminders: [],
    tagBank: [],
    syncToAccount: false,
    cloudE2E: false,
    chartMoneyMode: "unify_eur",
    eurPerUsd: DEFAULT_EUR_PER_USD,
    period: "12m",
    chartFilterCategoryId: "",
    paychecks: [],
    incomeMonthOverrides: [],
    incomeAdhoc: [],
    plannedExpenses: [],
    plannedExpenseMonthOverrides: [],
    investments: [],
    wealthAccounts: [],
    wealthTransfers: [],
    wealthBizums: [],
    patrimonioRealMode: false,
    scenarios: [],
    debts: [],
  };
}

const INVESTMENT_TYPES: InvestmentAssetType[] = ["stocks", "ipo", "etf", "metals", "crypto", "bonds", "other"];

export function parseInvestmentType(raw: unknown): InvestmentAssetType {
  const t = String(raw ?? "").trim() as InvestmentAssetType;
  return INVESTMENT_TYPES.includes(t) ? t : "other";
}

export function investmentTypeLabel(type: InvestmentAssetType): string {
  switch (type) {
    case "stocks":
      return "Acciones";
    case "ipo":
      return "OPV";
    case "etf":
      return "ETF";
    case "metals":
      return "Metales";
    case "crypto":
      return "Cripto";
    case "bonds":
      return "Bonos";
    default:
      return "Otros";
  }
}

/** Valor actual estimado a partir del total invertido y el % P/L manual. */
export function investmentCurrentValue(h: InvestmentHolding): number {
  const base = Math.max(0, h.totalInvested);
  const pct = Number.isFinite(h.gainLossPct) ? h.gainLossPct : 0;
  return Math.round(base * (1 + pct / 100) * 100) / 100;
}

export function investmentGainLossAmount(h: InvestmentHolding): number {
  return Math.round((investmentCurrentValue(h) - Math.max(0, h.totalInvested)) * 100) / 100;
}

export function investmentPortfolioTotals(holdings: InvestmentHolding[]): {
  invested: number;
  current: number;
  gainLoss: number;
} {
  let invested = 0;
  let current = 0;
  for (const h of holdings) {
    invested += Math.max(0, h.totalInvested);
    current += investmentCurrentValue(h);
  }
  return {
    invested: Math.round(invested * 100) / 100,
    current: Math.round(current * 100) / 100,
    gainLoss: Math.round((current - invested) * 100) / 100,
  };
}

/** Total invertido = precio medio × cantidad. */
export function computeInvestmentTotalInvested(avgBuyPrice: number, quantity: number): number {
  if (!Number.isFinite(avgBuyPrice) || !Number.isFinite(quantity)) return 0;
  return Math.round(Math.max(0, avgBuyPrice) * Math.max(0, quantity) * 100) / 100;
}

function parseWealthAccounts(raw: unknown): WealthAccount[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const bal = Number(r?.balance);
      const prefix = String(r?.ibanPrefix ?? "").trim().toUpperCase().slice(0, 4);
      return {
        id: String(r?.id || "").trim(),
        name: String(r?.name || "").trim() || "Cuenta",
        balance: Number.isFinite(bal) ? Math.round(bal * 100) / 100 : 0,
        ibanPrefix: prefix || undefined,
        isDefaultExpense: Boolean(r?.isDefaultExpense),
        isDefaultIncome: Boolean(r?.isDefaultIncome),
        isDefaultInvestment: Boolean(r?.isDefaultInvestment),
        openingBalance:
          r?.openingBalance != null && Number.isFinite(Number(r.openingBalance))
            ? Math.round(Number(r.openingBalance) * 100) / 100
            : undefined,
      };
    })
    .filter((a: WealthAccount) => a.id)
    .slice(0, 24);
}

export function formatIbanDisplay(prefix?: string): string {
  const p = String(prefix ?? "").trim().toUpperCase().slice(0, 4);
  if (!p) return "**** **** **** ****";
  return `${p} **** **** **** ****`;
}

/** Importes en EUR con locale es-ES (miles con punto, decimales con coma). */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Formato numérico es-ES con separador de miles desde 1.000 (Intl solo agrupa desde 10.000). */
function formatNumberEsEs(amount: number, decimals: number): string {
  const n = roundMoney(amount);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart !== undefined ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

export function formatEurEs(amount: number, compact = false): string {
  const decimals = compact ? 0 : 2;
  return `${formatNumberEsEs(amount, decimals)}\u00a0€`;
}

/** Número es-ES para ejes/tooltips de gráficos (2 decimales, miles con punto). */
export function formatChartNumberEs(amount: number): string {
  return formatNumberEsEs(amount, 2);
}

function parseWealthTransfers(raw: unknown): WealthTransfer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const amt = Number(r?.amount);
      const date = String(r?.date ?? "").slice(0, 10);
      return {
        id: String(r?.id || "").trim(),
        date: date.length === 10 ? date : "",
        fromAccountId: String(r?.fromAccountId || "").trim(),
        toAccountId: String(r?.toAccountId || "").trim(),
        amount: Number.isFinite(amt) ? Math.round(Math.max(0, amt) * 100) / 100 : 0,
        note: String(r?.note ?? "").trim() || undefined,
      };
    })
    .filter((t: WealthTransfer) => t.id && t.date && t.fromAccountId && t.toAccountId && t.amount > 0)
    .slice(0, 500);
}

function parseWealthBizums(raw: unknown): WealthBizum[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const amt = Number(r?.amount);
      const date = String(r?.date ?? "").slice(0, 10);
      const dirRaw = String(r?.direction ?? "").trim();
      const direction: WealthBizumDirection | null =
        dirRaw === "received" ? "received" : dirRaw === "sent" ? "sent" : null;
      return {
        id: String(r?.id || "").trim(),
        date: date.length === 10 ? date : "",
        direction,
        accountId: String(r?.accountId || "").trim(),
        amount: Number.isFinite(amt) ? Math.round(Math.max(0, amt) * 100) / 100 : 0,
        note: String(r?.note ?? "").trim() || undefined,
      };
    })
    .filter((b) => b.id && b.date && b.accountId && b.amount > 0 && b.direction)
    .map((b) => ({ ...b, direction: b.direction as WealthBizumDirection }))
    .slice(0, 500);
}

export function parseCardColor(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : undefined;
}

export function defaultWealthAccountId(
  accounts: WealthAccount[],
  role: "expense" | "income" | "investment",
): string | undefined {
  const flag =
    role === "expense" ? "isDefaultExpense" : role === "income" ? "isDefaultIncome" : "isDefaultInvestment";
  return accounts.find((a) => a[flag])?.id ?? (role === "investment" ? undefined : accounts[0]?.id);
}

export function trackingStartIso(state: Pick<ExpenseTrackerState, "trackingStartDate">): string | null {
  const t = state.trackingStartDate?.trim().slice(0, 10);
  return t && t.length === 10 ? t : null;
}

/** Combina inicio de período con fecha de registro (la más reciente gana). */
export function effectivePeriodStart(state: ExpenseTrackerState, filter: PeriodFilter): string | null {
  const p = periodStartIso(filter);
  const t = trackingStartIso(state);
  if (p && t) return p > t ? p : t;
  return p ?? t;
}

export function mergeDefaultCategories(categories: ExpenseCategory[]): ExpenseCategory[] {
  const clean = sanitizeExpenseCategories(categories);
  const ids = new Set(clean.map((c) => c.id));
  const merged = [...clean];
  for (const d of DEFAULT_EXPENSE_CATEGORIES) {
    if (!ids.has(d.id)) merged.push({ ...d });
  }
  return sanitizeExpenseCategories(validateCategoryTree(merged));
}

export type PatrimonioSnapshot = {
  accountsTotal: number;
  investmentsPart: number;
  total: number;
  accounts: WealthAccount[];
  realMode: boolean;
};

export function computePatrimonioSnapshot(
  state: Pick<ExpenseTrackerState, "wealthAccounts" | "investments" | "patrimonioRealMode">,
): PatrimonioSnapshot {
  const accounts = state.wealthAccounts ?? [];
  const accountsTotal = computeCashAvailableTotal(accounts);
  const inv = investmentPortfolioTotals(state.investments ?? []);
  const realMode = Boolean(state.patrimonioRealMode);
  const investmentsPart = realMode ? inv.invested : inv.current;
  return {
    accountsTotal,
    investmentsPart,
    total: Math.round((accountsTotal + investmentsPart) * 100) / 100,
    accounts,
    realMode,
  };
}

/** Suma de saldos en cuentas (sin inversiones). */
export function computeCashAvailableTotal(accounts: WealthAccount[]): number {
  return Math.round(accounts.reduce((s, a) => s + a.balance, 0) * 100) / 100;
}

function eachMonthKeyFromTo(startIso: string, endIso: string): string[] {
  const fromMk = startIso.slice(0, 7);
  const toMk = endIso.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(fromMk) || !/^\d{4}-\d{2}$/.test(toMk)) return [];
  const out: string[] = [];
  let y = Number(fromMk.slice(0, 4));
  let m = Number(fromMk.slice(5, 7));
  const ty = Number(toMk.slice(0, 4));
  const tm = Number(toMk.slice(5, 7));
  while ((y < ty || (y === ty && m <= tm)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function hasConfirmedIncomeOnDate(state: ExpenseTrackerState, date: string): boolean {
  return (state.incomeAdhoc ?? []).some((r) => r.confirmed !== false && r.date.slice(0, 10) === date);
}

function hasConfirmedExpenseOnDate(state: ExpenseTrackerState, date: string): boolean {
  return state.expenses.some((e) => e.confirmed !== false && e.date.slice(0, 10) === date);
}

/**
 * Neto EUR que ha entrado/salido de la cuenta desde fromDate (inclusive) hasta untilDate (inclusive):
 * gastos/ingresos confirmados, traspasos, bizums y previstos activos en rango (sin duplicar día ya confirmado).
 */
export function wealthMovementNetForAccount(
  state: ExpenseTrackerState,
  accountId: string,
  fromDate: string,
  untilDate: string = new Date().toISOString().slice(0, 10),
): number {
  const from = fromDate.slice(0, 10);
  const until = untilDate.slice(0, 10);
  if (from.length !== 10 || until.length !== 10 || from > until) return 0;

  const fx = state.eurPerUsd;
  const accounts = state.wealthAccounts ?? [];
  let net = 0;

  for (const e of state.expenses) {
    if (e.confirmed === false) continue;
    const d = e.date.slice(0, 10);
    if (d < from || d > until) continue;
    const aid = e.wealthAccountId ?? defaultWealthAccountId(accounts, "expense");
    if (aid !== accountId) continue;
    net -= convertAmount(Math.max(0, e.amount), e.currency, "EUR", fx);
  }

  for (const row of state.incomeAdhoc ?? []) {
    if (row.confirmed === false) continue;
    const d = row.date.slice(0, 10);
    if (d < from || d > until) continue;
    const aid = row.wealthAccountId ?? defaultWealthAccountId(accounts, "income");
    if (aid !== accountId) continue;
    net += convertAmount(Math.max(0, row.amount), row.currency, "EUR", fx);
  }

  for (const t of state.wealthTransfers ?? []) {
    const d = t.date.slice(0, 10);
    if (d < from || d > until) continue;
    if (t.fromAccountId === accountId) net -= t.amount;
    if (t.toAccountId === accountId) net += t.amount;
  }

  for (const b of state.wealthBizums ?? []) {
    const d = b.date.slice(0, 10);
    if (d < from || d > until) continue;
    if (b.accountId !== accountId) continue;
    net += b.direction === "received" ? b.amount : -b.amount;
  }

  const incomeDefault = defaultWealthAccountId(accounts, "income");
  const expenseDefault = defaultWealthAccountId(accounts, "expense");
  const paycheckOverrides = state.incomeMonthOverrides ?? [];
  const plannedOverrides = state.plannedExpenseMonthOverrides ?? [];

  for (const mk of eachMonthKeyFromTo(from, until)) {
    for (const p of state.paychecks ?? []) {
      if (!paycheckActiveInMonth(p, mk)) continue;
      const charge = recurringChargeDate(p.dayOfMonth, mk);
      if (charge < from || charge > until) continue;
      if (hasConfirmedIncomeOnDate(state, charge)) continue;
      const target = incomeDefault;
      if (target !== accountId) continue;
      const { amount, currency } = effectivePaycheckAmount(p, mk, paycheckOverrides);
      if (amount > 0) net += convertAmount(amount, currency, "EUR", fx);
    }
    for (const p of state.plannedExpenses ?? []) {
      if (!plannedExpenseActiveInMonth(p, mk)) continue;
      const charge = recurringChargeDate(p.dayOfMonth, mk);
      if (charge < from || charge > until) continue;
      if (hasConfirmedExpenseOnDate(state, charge)) continue;
      const target = expenseDefault;
      if (target !== accountId) continue;
      const { amount, currency } = effectivePlannedExpenseAmount(p, mk, plannedOverrides);
      if (amount > 0) net -= convertAmount(amount, currency, "EUR", fx);
    }
  }

  return roundMoney(net);
}

/** Saldo actual = saldo inicial en trackingStartDate + movimientos desde esa fecha. */
export function computeBalanceFromOpening(
  state: ExpenseTrackerState,
  accountId: string,
  openingBalance: number,
  trackingStartDate: string,
): number {
  const net = wealthMovementNetForAccount(state, accountId, trackingStartDate);
  return roundMoney(openingBalance + net);
}

/** Por defecto nómina/ingresos → tarjeta/gastos (por flags o nombre). */
export function resolveTransferDefaultAccounts(accounts: WealthAccount[]): {
  fromId?: string;
  toId?: string;
} {
  if (!accounts.length) return {};
  const tarjeta = accounts.find((a) => /tarjeta/i.test(a.name));
  const nomina =
    accounts.find((a) => a.isDefaultIncome) ??
    accounts.find((a) => /n[oó]mina/i.test(a.name)) ??
    accounts.find((a) => /imagin/i.test(a.name) && !/tarjeta/i.test(a.name));
  const gastos =
    accounts.find((a) => a.isDefaultExpense) ??
    tarjeta ??
    accounts.find((a) => a.id !== nomina?.id);
  return {
    fromId: nomina?.id ?? accounts[0]?.id,
    toId: gastos?.id ?? accounts.find((a) => a.id !== nomina?.id)?.id ?? accounts[1]?.id,
  };
}

function mergeWealthAccounts(remote: WealthAccount[], local: WealthAccount[]): WealthAccount[] {
  const byId = new Map<string, WealthAccount>();
  for (const a of remote) {
    if (a.id) byId.set(a.id, { ...a });
  }
  for (const a of local) {
    if (!a.id) continue;
    const prev = byId.get(a.id);
    if (!prev) {
      byId.set(a.id, { ...a });
      continue;
    }
    byId.set(a.id, {
      ...prev,
      ...a,
      name: a.name.trim() ? a.name : prev.name,
      balance: a.balance,
      openingBalance: a.openingBalance ?? prev.openingBalance,
      ibanPrefix: a.ibanPrefix ?? prev.ibanPrefix,
      isDefaultExpense: a.isDefaultExpense ?? prev.isDefaultExpense,
      isDefaultIncome: a.isDefaultIncome ?? prev.isDefaultIncome,
      isDefaultInvestment: a.isDefaultInvestment ?? prev.isDefaultInvestment,
    });
  }
  return [...byId.values()].slice(0, 24);
}

export function daysInMonthKey(monthKey: string): number {
  const y = Number(monthKey.slice(0, 4));
  const m = Number(monthKey.slice(5, 7));
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}

export type RecurringDateRange = {
  dayOfMonth: number;
  validFrom?: string;
  validUntil?: string;
};

/** Fecha ISO del cobro/gasto previsto en ese mes (respeta día del mes). */
export function recurringChargeDate(dayOfMonth: number, monthKey: string): string {
  const dim = daysInMonthKey(monthKey);
  const d = Math.min(Math.max(1, Math.floor(dayOfMonth) || 1), dim);
  return `${monthKey}-${String(d).padStart(2, "0")}`;
}

/** ¿El cobro/gasto previsto cae dentro del rango de fechas en ese mes? */
export function recurringActiveInMonth(entry: RecurringDateRange, monthKey: string): boolean {
  const charge = recurringChargeDate(entry.dayOfMonth, monthKey);
  const from = entry.validFrom?.trim().slice(0, 10);
  const until = entry.validUntil?.trim().slice(0, 10);
  if (from && charge < from) return false;
  if (until && charge > until) return false;
  return true;
}

/** Meses YYYY-MM con al menos un cobro/gasto previsto activo. */
export function monthsForRecurringEntry(entry: RecurringDateRange, maxMonths = 36): string[] {
  const today = new Date().toISOString().slice(0, 10);
  let startMk = entry.validFrom?.trim().slice(0, 7) || today.slice(0, 7);
  let endMk: string;
  if (entry.validUntil?.trim().slice(0, 7)) {
    endMk = entry.validUntil.trim().slice(0, 7);
  } else {
    const d = new Date();
    d.setMonth(d.getMonth() + 24);
    endMk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (!/^\d{4}-\d{2}$/.test(startMk)) startMk = today.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(endMk)) endMk = startMk;
  if (startMk > endMk) return recurringActiveInMonth(entry, startMk) ? [startMk] : [];
  const out: string[] = [];
  let y = Number(startMk.slice(0, 4));
  let m = Number(startMk.slice(5, 7));
  const ty = Number(endMk.slice(0, 4));
  const tm = Number(endMk.slice(5, 7));
  while ((y < ty || (y === ty && m <= tm)) && out.length < maxMonths) {
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    if (recurringActiveInMonth(entry, mk)) out.push(mk);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** @deprecated Usar monthsForRecurringEntry con dayOfMonth. */
export function monthsForRecurringRange(validFrom?: string, validUntil?: string, maxMonths = 36): string[] {
  return monthsForRecurringEntry({ dayOfMonth: 1, validFrom, validUntil }, maxMonths);
}

export function totalIncomeInPeriod(state: ExpenseTrackerState, filter: PeriodFilter): number {
  const start = effectivePeriodStart(state, filter);
  const fx = state.eurPerUsd;
  let total = 0;
  for (const row of state.incomeAdhoc ?? []) {
    if (row.confirmed === false) continue;
    if (start && row.date < start) continue;
    total += convertAmount(Math.max(0, row.amount), row.currency, "EUR", fx);
  }
  const today = new Date().toISOString().slice(0, 10);
  const endMk = today.slice(0, 7);
  let startMk = start ? start.slice(0, 7) : "1970-01";
  let y = Number(startMk.slice(0, 4));
  let m = Number(startMk.slice(5, 7));
  const ty = Number(endMk.slice(0, 4));
  const tm = Number(endMk.slice(5, 7));
  const overrides = state.incomeMonthOverrides ?? [];
  while (y < ty || (y === ty && m <= tm)) {
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    for (const p of state.paychecks ?? []) {
      if (!paycheckActiveInMonth(p, mk)) continue;
      const charge = recurringChargeDate(p.dayOfMonth, mk);
      if (start && charge < start) continue;
      if (charge > today) continue;
      const { amount, currency } = effectivePaycheckAmount(p, mk, overrides);
      if (amount > 0) total += convertAmount(amount, currency, "EUR", fx);
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return Math.round(total * 100) / 100;
}

function lastDayIsoOfMonth(monthKey: string): string {
  const dim = daysInMonthKey(monthKey);
  return `${monthKey}-${String(dim).padStart(2, "0")}`;
}

/** Fracción del mes (0–1) que cae dentro de [periodStart, periodEnd]. */
function monthOverlapFraction(monthKey: string, periodStart: string | null, periodEnd: string): number {
  const monthStart = `${monthKey}-01`;
  const monthEnd = lastDayIsoOfMonth(monthKey);
  const winStart = periodStart && periodStart > monthStart ? periodStart : monthStart;
  const winEnd = periodEnd < monthEnd ? periodEnd : monthEnd;
  if (winStart > winEnd) return 0;
  const dim = daysInMonthKey(monthKey);
  const toDay = (iso: string) => {
    const [y, mo, d] = iso.split("-").map(Number);
    return Date.UTC(y!, mo! - 1, d!);
  };
  const days = Math.floor((toDay(winEnd) - toDay(winStart)) / 86_400_000) + 1;
  return Math.max(0, Math.min(1, days / dim));
}

/** Gastos del período: confirmados + suscripciones (prorrateadas) + previstos con cobro en rango. */
export function totalExpensesInPeriod(state: ExpenseTrackerState, filter: PeriodFilter): number {
  const start = effectivePeriodStart(state, filter);
  const fx = state.eurPerUsd;
  const today = new Date().toISOString().slice(0, 10);
  let total = 0;

  for (const row of state.expenses) {
    if (row.confirmed === false) continue;
    if (start && row.date < start) continue;
    if (row.date > today) continue;
    total += convertAmount(Math.max(0, row.amount), row.currency, "EUR", fx);
  }

  const endMk = today.slice(0, 7);
  let startMk = start ? start.slice(0, 7) : endMk;
  if (!/^\d{4}-\d{2}$/.test(startMk)) startMk = endMk;
  let y = Number(startMk.slice(0, 4));
  let m = Number(startMk.slice(5, 7));
  const ty = Number(endMk.slice(0, 4));
  const tm = Number(endMk.slice(5, 7));
  const planOverrides = state.plannedExpenseMonthOverrides ?? [];

  while (y < ty || (y === ty && m <= tm)) {
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    const frac = monthOverlapFraction(mk, start, today);
    if (frac > 0) {
      const refDate = mk === endMk ? today : lastDayIsoOfMonth(mk);
      let burnEur = 0;
      let burnUsd = 0;
      for (const s of state.subscriptions) {
        if (!subscriptionCountsInTotals(s, refDate)) continue;
        const monthly = subscriptionToMonthlyAmount(s, refDate);
        if (monthly <= 0) continue;
        if (s.currency === "EUR") burnEur += monthly * frac;
        else burnUsd += monthly * frac;
      }
      total += burnEur + convertAmount(burnUsd, "USD", "EUR", fx);
    }

    for (const p of state.plannedExpenses ?? []) {
      if (!plannedExpenseActiveInMonth(p, mk)) continue;
      const charge = recurringChargeDate(p.dayOfMonth, mk);
      if (start && charge < start) continue;
      if (charge > today) continue;
      const { amount, currency } = effectivePlannedExpenseAmount(p, mk, planOverrides);
      if (amount > 0) total += convertAmount(amount, currency, "EUR", fx);
    }

    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return Math.round(total * 100) / 100;
}

/** Solo gastos confirmados (sin suscripciones ni previstos) en el período. */
export function discretionaryExpensesInPeriod(state: ExpenseTrackerState, filter: PeriodFilter): number {
  const start = effectivePeriodStart(state, filter);
  const fx = state.eurPerUsd;
  const today = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const row of state.expenses) {
    if (row.confirmed === false) continue;
    if (start && row.date < start) continue;
    if (row.date > today) continue;
    total += convertAmount(Math.max(0, row.amount), row.currency, "EUR", fx);
  }
  return Math.round(total * 100) / 100;
}

export type PeriodMarginSnapshot = {
  income: number;
  expenses: number;
  net: number;
  /** (ingresos − gastos) / ingresos × 100; 0 si no hay ingresos. */
  marginPct: number;
};

export function periodMarginSnapshot(state: ExpenseTrackerState, filter: PeriodFilter = state.period): PeriodMarginSnapshot {
  const income = totalIncomeInPeriod(state, filter);
  const expenses = totalExpensesInPeriod(state, filter);
  const net = Math.round((income - expenses) * 100) / 100;
  const marginPct = income > 0 ? Math.round((net / income) * 1000) / 10 : 0;
  return { income, expenses, net, marginPct };
}

export type FixedDiscretionarySplit = {
  fixed: number;
  discretionary: number;
};

/** Fijos = suscripciones prorrateadas + gastos previstos; discrecional = gastos confirmados. */
export function periodFixedDiscretionarySplit(
  state: ExpenseTrackerState,
  filter: PeriodFilter = state.period,
): FixedDiscretionarySplit {
  const total = totalExpensesInPeriod(state, filter);
  const discretionary = discretionaryExpensesInPeriod(state, filter);
  const fixed = Math.round(Math.max(0, total - discretionary) * 100) / 100;
  return { fixed, discretionary };
}

/** ¿La suscripción cuenta en KPIs y gráficos en la fecha de referencia? */
export function subscriptionCountsInTotals(s: SubscriptionRow, refDate?: string): boolean {
  if (!s.active) return false;
  const today = (refDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cancel = s.cancelEffectiveDate?.trim().slice(0, 10);
  if (cancel && cancel.length === 10 && today > cancel) return false;
  return true;
}

/** Programa cancelación: deja de contar desde el próximo día de cobro. */
export function scheduleSubscriptionCancel(s: SubscriptionRow): SubscriptionRow {
  const next = subscriptionNextChargeIso(s);
  return {
    ...s,
    cancelEffectiveDate: next.length === 10 ? next : new Date().toISOString().slice(0, 10),
  };
}

function parseInvestmentHoldings(raw: unknown): InvestmentHolding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const qtyRaw = Number(r?.quantity);
      const avg = Number(r?.avgBuyPrice);
      const inv = Number(r?.totalInvested);
      const pct = Number(r?.gainLossPct);
      let quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 0;
      const avgBuyPrice = Number.isFinite(avg) && avg >= 0 ? avg : 0;
      if (quantity <= 0 && inv > 0 && avgBuyPrice > 0) quantity = inv / avgBuyPrice;
      const totalInvested =
        quantity > 0 && avgBuyPrice >= 0
          ? computeInvestmentTotalInvested(avgBuyPrice, quantity)
          : Number.isFinite(inv) && inv >= 0
            ? inv
            : 0;
      return {
        id: String(r?.id || "").trim(),
        name: String(r?.name || "").trim() || "Activo",
        type: parseInvestmentType(r?.type),
        platform: String(r?.platform || "").trim() || "—",
        avgBuyPrice,
        quantity: quantity > 0 ? quantity : 1,
        totalInvested,
        gainLossPct: Number.isFinite(pct) ? pct : 0,
        notes: String(r?.notes ?? "").trim() || undefined,
        cardColor: parseCardColor(r?.cardColor),
      };
    })
    .filter((h: InvestmentHolding) => h.id)
    .slice(0, 48);
}

function parseDebtsField(raw: unknown): ExpenseDebt[] {
  return parseExpenseDebts(raw);
}

function parseScenariosField(raw: unknown): ExpenseScenario[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const kind: ScenarioKind =
        r?.kind === "installments" || r?.kind === "bundle" || r?.kind === "one_off" ? r.kind : "one_off";
      const status: ScenarioStatus =
        r?.status === "considering" || r?.status === "go" || r?.status === "no_go" ? r.status : "idea";
      const priority: ScenarioPriority | undefined =
        r?.priority === "low" || r?.priority === "medium" || r?.priority === "high" ? r.priority : undefined;
      const items: ScenarioBundleItem[] = Array.isArray(r?.items)
        ? r.items
            .map((it: any) => ({
              id: String(it?.id || "").trim() || `si_${Math.random().toString(36).slice(2, 9)}`,
              label: String(it?.label || "").trim() || "Partida",
              amount: Number.isFinite(Number(it?.amount)) ? Math.max(0, Number(it.amount)) : 0,
            }))
            .filter((it: ScenarioBundleItem) => it.id)
        : [];
      return {
        id: String(r?.id || "").trim() || `sc_${Math.random().toString(36).slice(2, 9)}`,
        title: String(r?.title || "").trim() || "Deseo",
        note: String(r?.note ?? "").trim() || undefined,
        kind,
        currency: r?.currency === "USD" ? "USD" : "EUR",
        categoryId: r?.categoryId ? String(r.categoryId).trim() : undefined,
        status,
        priority,
        amount: r?.amount != null && Number.isFinite(Number(r.amount)) ? Math.max(0, Number(r.amount)) : undefined,
        targetDate: String(r?.targetDate ?? "").slice(0, 10) || undefined,
        installmentCount:
          r?.installmentCount != null && Number.isFinite(Number(r.installmentCount))
            ? Math.max(1, Math.min(120, Math.floor(Number(r.installmentCount))))
            : undefined,
        installmentAmount:
          r?.installmentAmount != null && Number.isFinite(Number(r.installmentAmount))
            ? Math.max(0, Number(r.installmentAmount))
            : undefined,
        startMonth: String(r?.startMonth ?? "").slice(0, 7) || undefined,
        items: items.length ? items : undefined,
        createdAt: String(r?.createdAt ?? "").slice(0, 10) || undefined,
      } satisfies ExpenseScenario;
    })
    .filter((s) => s.id && s.title)
    .slice(0, 48);
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clampEurPerUsd(n: number) {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_EUR_PER_USD;
  return Math.min(5, Math.max(0.2, n));
}

export function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((t) => String(t ?? "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 24);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 24);
  }
  return [];
}

function parseAttachments(raw: unknown): ExpenseAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: ExpenseAttachment[] = [];
  for (const a of raw) {
    const id = String((a as any)?.id || "").trim();
    const title = String((a as any)?.title || "").trim() || "Enlace";
    const url = normalizeHttpsUrl(String((a as any)?.url || ""));
    if (!id || !url) continue;
    out.push({ id, title, url });
  }
  return out.slice(0, 12);
}

export function normalizeHttpsUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseCategory(raw: any): ExpenseCategory {
  const pid = raw?.parentId != null && String(raw.parentId).trim() ? String(raw.parentId).trim() : null;
  return {
    id: String(raw?.id || ""),
    name: String(raw?.name || "").trim() || "Sin nombre",
    color: typeof raw?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.color) ? raw.color : "#64748b",
    parentId: pid,
  };
}

/** Corrige `parentId` inexistente o ciclos triviales (nodo → sí mismo). */
export function validateCategoryTree(list: ExpenseCategory[]): ExpenseCategory[] {
  const ids = new Set(list.map((c) => c.id));
  return list.map((c) => {
    let p = c.parentId;
    if (!p || p === c.id || !ids.has(p)) p = null;
    return { ...c, parentId: p };
  });
}

/** Categoría raíz para agregar importes en gráficos (subcategorías se suman al padre). */
export function rollupCategoryId(state: ExpenseTrackerState, categoryId: string): string {
  const byId = new Map(state.categories.map((c) => [c.id, c] as const));
  let cur = byId.get(categoryId);
  if (!cur) return categoryId;
  const seen = new Set<string>();
  while (cur?.parentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    const p = byId.get(cur.parentId);
    if (!p) break;
    cur = p;
  }
  return cur?.id ?? categoryId;
}

/** La categoría y todas sus subcategorías (por niveles). */
export function categorySubtreeIds(state: ExpenseTrackerState, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of state.categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return ids;
}

/** Si el gasto pertenece al subárbol de la categoría seleccionada en el filtro de gráficos. */
export function expenseMatchesChartCategoryFilter(
  state: ExpenseTrackerState,
  expenseCategoryId: string,
  filterCategoryId: string,
): boolean {
  const fid = filterCategoryId.trim();
  if (!fid) return true;
  return categorySubtreeIds(state, fid).has(expenseCategoryId);
}

export function formatCategoryPath(state: ExpenseTrackerState, categoryId: string): string {
  const byId = new Map(state.categories.map((c) => [c.id, c] as const));
  const chain: string[] = [];
  let cur = byId.get(categoryId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.join(" · ") || categoryId;
}

function parseReminders(raw: unknown): ExpenseReminder[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => ({
      id: String(r?.id || "").trim(),
      title: String(r?.title || "").trim() || "Recordatorio",
      date: String(r?.date || "").slice(0, 10),
      note: String(r?.note ?? ""),
      notifyBrowser: Boolean(r?.notifyBrowser),
      expenseId: r?.expenseId ? String(r.expenseId) : undefined,
    }))
    .filter((r: ExpenseReminder) => r.id && r.date)
    .slice(0, 200);
}

function upgradeV1ToV2(o: any): ExpenseTrackerState {
  const base = defaultExpenseTrackerState();
  const categories: ExpenseCategory[] = Array.isArray(o.categories)
    ? validateCategoryTree(
        o.categories.map((c: any) => parseCategory(c)).filter((c: ExpenseCategory) => c.id),
      )
    : base.categories;
  const fallbackCat = categories[0]?.id ?? DEFAULT_EXPENSE_CATEGORIES[0]!.id;

  const expenses: ExpenseRow[] = Array.isArray(o.expenses)
    ? o.expenses
        .map((e: any) => {
          const cid = String(e?.categoryId || fallbackCat);
          return {
            id: String(e?.id || ""),
            date: String(e?.date || "").slice(0, 10),
            label: String(e?.label || "").trim() || "Gasto",
            amount: Number.isFinite(Number(e?.amount)) ? Number(e.amount) : 0,
            currency: e?.currency === "USD" ? "USD" : "EUR",
            categoryId: categories.some((c) => c.id === cid) ? cid : fallbackCat,
            notes: String(e?.notes ?? ""),
            tags: parseTags(e?.tags),
            attachments: parseAttachments(e?.attachments),
            confirmed: e?.confirmed === false ? false : true,
            wealthAccountId: e?.wealthAccountId ? String(e.wealthAccountId).trim() : undefined,
          };
        })
        .filter((e: ExpenseRow) => e.id && e.date)
    : [];

  const subscriptions: SubscriptionRow[] = Array.isArray(o.subscriptions)
    ? o.subscriptions
        .map((s: any) => {
          const cid = String(s?.categoryId || fallbackCat);
          const billingStart = String(s?.billingStartDate ?? "").slice(0, 10);
          return {
            id: String(s?.id || ""),
            name: String(s?.name || "").trim() || "Suscripción",
            amount: Number.isFinite(Number(s?.amount)) ? Number(s.amount) : 0,
            currency: s?.currency === "USD" ? "USD" : "EUR",
            cycle: (["weekly", "monthly", "quarterly", "yearly"] as const).includes(s?.cycle) ? s.cycle : "monthly",
            categoryId: categories.some((c) => c.id === cid) ? cid : fallbackCat,
            nextBilling: String(s?.nextBilling || "").slice(0, 10),
            billingStartDate: billingStart.length === 10 ? billingStart : undefined,
            active: Boolean(s?.active),
            cancelEffectiveDate: String(s?.cancelEffectiveDate ?? "").slice(0, 10) || undefined,
            notes: String(s?.notes ?? ""),
            tags: parseTags(s?.tags),
            cardColor: parseCardColor(s?.cardColor),
          };
        })
        .filter((s: SubscriptionRow) => s.id)
    : [];

  const chartMoneyMode: ChartMoneyMode =
    o.chartMoneyMode === "unify_eur" || o.chartMoneyMode === "unify_usd" || o.chartMoneyMode === "mixed"
      ? o.chartMoneyMode
      : "mixed";
  const periodRaw = String(o.period ?? "");
  const period: PeriodFilter =
    periodRaw === "all" ||
    periodRaw === "12m" ||
    periodRaw === "90d" ||
    periodRaw === "30d" ||
    periodRaw === "6m" ||
    periodRaw === "ytd"
      ? (periodRaw as PeriodFilter)
      : "12m";

  return {
    v: 2,
    categories: categories.length ? categories : base.categories,
    expenses,
    subscriptions,
    reminders: [],
    tagBank: [],
    syncToAccount: Boolean(o.syncToAccount),
    cloudE2E: false,
    chartMoneyMode,
    eurPerUsd: clampEurPerUsd(Number(o.eurPerUsd)),
    period,
    chartFilterCategoryId: "",
    paychecks: [],
    incomeMonthOverrides: [],
    incomeAdhoc: [],
    plannedExpenses: [],
    plannedExpenseMonthOverrides: [],
    investments: [],
    wealthAccounts: [],
    scenarios: [],
    debts: [],
  };
}

/** Acepta estado v1 (legacy) o v2 y devuelve siempre v2 normalizado. */
export function normalizeExpenseTrackerState(raw: unknown): ExpenseTrackerState {
  const base = defaultExpenseTrackerState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as any;
  if (o.v === 1) return upgradeV1ToV2(o);
  if (o.v !== 2) return base;

  const categories: ExpenseCategory[] = mergeDefaultCategories(
    Array.isArray(o.categories)
      ? validateCategoryTree(
          o.categories.map((c: any) => parseCategory(c)).filter((c: ExpenseCategory) => c.id),
        )
      : base.categories,
  );
  if (!categories.length) return { ...base, categories: base.categories };
  const fallbackCat = categories[0]!.id;

  const expenses: ExpenseRow[] = Array.isArray(o.expenses)
    ? o.expenses
        .map((e: any) => {
          const cid = String(e?.categoryId || fallbackCat);
          return {
            id: String(e?.id || ""),
            date: String(e?.date || "").slice(0, 10),
            label: String(e?.label || "").trim() || "Gasto",
            amount: Number.isFinite(Number(e?.amount)) ? Number(e.amount) : 0,
            currency: e?.currency === "USD" ? "USD" : "EUR",
            categoryId: categories.some((c) => c.id === cid) ? cid : fallbackCat,
            notes: String(e?.notes ?? ""),
            tags: parseTags(e?.tags),
            attachments: parseAttachments(e?.attachments),
            confirmed: e?.confirmed === false ? false : true,
            wealthAccountId: e?.wealthAccountId ? String(e.wealthAccountId).trim() : undefined,
          };
        })
        .filter((e: ExpenseRow) => e.id && e.date)
    : [];

  const subscriptions: SubscriptionRow[] = Array.isArray(o.subscriptions)
    ? o.subscriptions
        .map((s: any) => {
          const cid = String(s?.categoryId || fallbackCat);
          const billingStart = String(s?.billingStartDate ?? "").slice(0, 10);
          return {
            id: String(s?.id || ""),
            name: String(s?.name || "").trim() || "Suscripción",
            amount: Number.isFinite(Number(s?.amount)) ? Number(s.amount) : 0,
            currency: s?.currency === "USD" ? "USD" : "EUR",
            cycle: (["weekly", "monthly", "quarterly", "yearly"] as const).includes(s?.cycle) ? s.cycle : "monthly",
            categoryId: categories.some((c) => c.id === cid) ? cid : fallbackCat,
            nextBilling: String(s?.nextBilling || "").slice(0, 10),
            billingStartDate: billingStart.length === 10 ? billingStart : undefined,
            active: Boolean(s?.active),
            cancelEffectiveDate: String(s?.cancelEffectiveDate ?? "").slice(0, 10) || undefined,
            notes: String(s?.notes ?? ""),
            tags: parseTags(s?.tags),
            cardColor: parseCardColor(s?.cardColor),
          };
        })
        .filter((s: SubscriptionRow) => s.id)
    : [];

  const reminders = parseReminders(o.reminders);
  let tagBank: string[] = [];
  if (Array.isArray(o.tagBank)) {
    const raw: string[] = o.tagBank
      .map((t: unknown) => String(t).trim().toLowerCase())
      .filter((t: string) => t.length > 0);
    tagBank = [...new Set(raw)].slice(0, 80);
  }

  const chartMoneyMode: ChartMoneyMode =
    o.chartMoneyMode === "unify_eur" || o.chartMoneyMode === "unify_usd" || o.chartMoneyMode === "mixed"
      ? o.chartMoneyMode
      : "mixed";
  const periodRaw = String(o.period ?? "");
  const period: PeriodFilter =
    periodRaw === "all" ||
    periodRaw === "12m" ||
    periodRaw === "90d" ||
    periodRaw === "30d" ||
    periodRaw === "6m" ||
    periodRaw === "ytd"
      ? (periodRaw as PeriodFilter)
      : "12m";

  let chartFilterCategoryId =
    typeof o.chartFilterCategoryId === "string" && o.chartFilterCategoryId.trim()
      ? String(o.chartFilterCategoryId).trim()
      : "";
  if (chartFilterCategoryId && !categories.some((c) => c.id === chartFilterCategoryId)) {
    chartFilterCategoryId = "";
  }

  const paychecks: PaycheckEntry[] = Array.isArray(o.paychecks)
    ? o.paychecks
        .map((p: any) => {
          const day = Number(p?.dayOfMonth);
          const dm = Number.isFinite(day) ? Math.min(31, Math.max(1, Math.floor(day))) : 1;
          const vf = String(p?.validFrom ?? "").slice(0, 10);
          const vu = String(p?.validUntil ?? "").slice(0, 10);
          const typ = Number(p?.typicalAmount);
          const amin = Number(p?.amountMin);
          const amax = Number(p?.amountMax);
          return {
            id: String(p?.id || "").trim() || "",
            title: String(p?.title || "").trim() || "Cobro",
            dayOfMonth: dm,
            windowBefore:
              p?.windowBefore != null && Number.isFinite(Number(p.windowBefore))
                ? Math.min(15, Math.max(0, Math.floor(Number(p.windowBefore))))
                : undefined,
            note: String(p?.note ?? ""),
            typicalAmount: Number.isFinite(typ) && typ >= 0 ? typ : undefined,
            currency: p?.currency === "USD" ? "USD" : p?.currency === "EUR" ? "EUR" : undefined,
            amountMin: Number.isFinite(amin) && amin >= 0 ? amin : undefined,
            amountMax: Number.isFinite(amax) && amax >= 0 ? amax : undefined,
            validFrom: vf.length === 10 ? vf : undefined,
            validUntil: vu.length === 10 ? vu : undefined,
          };
        })
        .filter((p: PaycheckEntry) => p.id)
        .slice(0, 24)
    : [];

  const incomeMonthOverrides: IncomeMonthOverride[] = Array.isArray(o.incomeMonthOverrides)
    ? o.incomeMonthOverrides
        .map((r: any) => {
          const month = String(r?.month ?? "").slice(0, 7);
          const amt = Number(r?.amount);
          return {
            id: String(r?.id || "").trim() || "",
            paycheckId: String(r?.paycheckId || "").trim(),
            month: /^\d{4}-\d{2}$/.test(month) ? month : "",
            amount: Number.isFinite(amt) ? Math.max(0, amt) : 0,
            currency: r?.currency === "USD" ? "USD" : "EUR",
          };
        })
        .filter((r: IncomeMonthOverride) => r.id && r.paycheckId && r.month)
        .slice(0, 400)
    : [];

  const incomeAdhoc: IncomeAdhocRow[] = Array.isArray(o.incomeAdhoc)
    ? o.incomeAdhoc
        .map((r: any) => {
          const cid = String(r?.categoryId || fallbackCat);
          const notesRaw = String(r?.notes ?? r?.note ?? "");
          return {
            id: String(r?.id || "").trim() || "",
            date: String(r?.date || "").slice(0, 10),
            label: String(r?.label || "").trim() || "Ingreso",
            amount: Number.isFinite(Number(r?.amount)) ? Math.max(0, Number(r.amount)) : 0,
            currency: r?.currency === "USD" ? "USD" : "EUR",
            categoryId: categories.some((c) => c.id === cid) ? cid : fallbackCat,
            notes: notesRaw,
            tags: parseTags(r?.tags),
            attachments: parseAttachments(r?.attachments),
            confirmed: r?.confirmed === false ? false : true,
            wealthAccountId: r?.wealthAccountId ? String(r.wealthAccountId).trim() : undefined,
          };
        })
        .filter((r: IncomeAdhocRow) => r.id && r.date)
        .slice(0, 500)
    : [];

  const plannedExpenses: PlannedExpenseEntry[] = Array.isArray(o.plannedExpenses)
    ? o.plannedExpenses
        .map((p: any) => {
          const day = Number(p?.dayOfMonth);
          const dm = Number.isFinite(day) ? Math.min(31, Math.max(1, Math.floor(day))) : 1;
          const vf = String(p?.validFrom ?? "").slice(0, 10);
          const vu = String(p?.validUntil ?? "").slice(0, 10);
          const typ = Number(p?.typicalAmount);
          const amin = Number(p?.amountMin);
          const amax = Number(p?.amountMax);
          const cid = String(p?.categoryId || fallbackCat);
          return {
            id: String(p?.id || "").trim() || "",
            title: String(p?.title || "").trim() || "Gasto previsto",
            dayOfMonth: dm,
            windowBefore:
              p?.windowBefore != null && Number.isFinite(Number(p.windowBefore))
                ? Math.min(15, Math.max(0, Math.floor(Number(p.windowBefore))))
                : undefined,
            note: String(p?.note ?? ""),
            typicalAmount: Number.isFinite(typ) && typ >= 0 ? typ : undefined,
            currency: p?.currency === "USD" ? "USD" : p?.currency === "EUR" ? "EUR" : undefined,
            categoryId: categories.some((c) => c.id === cid) ? cid : fallbackCat,
            amountMin: Number.isFinite(amin) && amin >= 0 ? amin : undefined,
            amountMax: Number.isFinite(amax) && amax >= 0 ? amax : undefined,
            validFrom: vf.length === 10 ? vf : undefined,
            validUntil: vu.length === 10 ? vu : undefined,
          };
        })
        .filter((p: PlannedExpenseEntry) => p.id)
        .slice(0, 24)
    : [];

  const plannedExpenseMonthOverrides: PlannedExpenseMonthOverride[] = Array.isArray(o.plannedExpenseMonthOverrides)
    ? o.plannedExpenseMonthOverrides
        .map((r: any) => {
          const month = String(r?.month ?? "").slice(0, 7);
          const amt = Number(r?.amount);
          return {
            id: String(r?.id || "").trim() || "",
            plannedExpenseId: String(r?.plannedExpenseId || "").trim(),
            month: /^\d{4}-\d{2}$/.test(month) ? month : "",
            amount: Number.isFinite(amt) ? Math.max(0, amt) : 0,
            currency: r?.currency === "USD" ? "USD" : "EUR",
          };
        })
        .filter((r: PlannedExpenseMonthOverride) => r.id && r.plannedExpenseId && r.month)
        .slice(0, 400)
    : [];

  const pcIds = new Set(paychecks.map((p) => p.id));
  const incomeOverridesClean = incomeMonthOverrides.filter((r) => pcIds.has(r.paycheckId));
  const planIds = new Set(plannedExpenses.map((p) => p.id));
  const plannedOverridesClean = plannedExpenseMonthOverrides.filter((r) => planIds.has(r.plannedExpenseId));
  const investments = parseInvestmentHoldings(o.investments);
  const wealthAccounts = parseWealthAccounts(o.wealthAccounts);
  const wealthTransfers = parseWealthTransfers(o.wealthTransfers);
  const wealthBizums = parseWealthBizums(o.wealthBizums);
  const scenarios = parseScenariosField(o.scenarios);
  const debts = parseDebtsField(o.debts);

  const migratedRefs = migrateExcludedCategoryReferences({
    expenses,
    subscriptions,
    plannedExpenses,
    incomeAdhoc,
  });

  return {
    v: 2,
    categories,
    expenses: migratedRefs.expenses,
    subscriptions: migratedRefs.subscriptions,
    reminders,
    tagBank,
    syncToAccount: Boolean(o.syncToAccount),
    cloudE2E: Boolean(o.cloudE2E),
    chartMoneyMode: "unify_eur",
    eurPerUsd: clampEurPerUsd(Number(o.eurPerUsd)),
    period,
    chartFilterCategoryId,
    paychecks,
    incomeMonthOverrides: incomeOverridesClean,
    incomeAdhoc: migratedRefs.incomeAdhoc,
    plannedExpenses: migratedRefs.plannedExpenses,
    plannedExpenseMonthOverrides: plannedOverridesClean,
    investments,
    wealthAccounts,
    wealthTransfers,
    wealthBizums,
    patrimonioRealMode: Boolean(o.patrimonioRealMode),
    trackingStartDate: String(o.trackingStartDate ?? "").slice(0, 10) || undefined,
    scenarios,
    debts,
  };
}

function mergeRows<T extends { id: string }>(a: T[], b: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of [...a, ...b]) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function mergeTagBanks(a: string[], b: string[]) {
  return [...new Set([...a, ...b].map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 80);
}

/**
 * Filas: ids remotos primero; el local añade filas que no existan en remoto (mismo criterio que hábitos).
 * Preferencias (sync, tipo de cambio, modo gráfico, período): se mantienen desde **local** (dispositivo).
 */
export function mergeExpenseTrackerRemoteLocal(remote: ExpenseTrackerState, local: ExpenseTrackerState): ExpenseTrackerState {
  const catIds = new Set<string>();
  const categories = [...remote.categories, ...local.categories].filter((c) => {
    if (!c.id || catIds.has(c.id)) return false;
    catIds.add(c.id);
    return true;
  });
  const fallbackCat = categories[0]?.id ?? DEFAULT_EXPENSE_CATEGORIES[0]!.id;

  const expenses = mergeRows(remote.expenses, local.expenses).map((e) => ({
    ...e,
    categoryId: categories.some((c) => c.id === e.categoryId) ? e.categoryId : fallbackCat,
    tags: Array.isArray(e.tags) ? e.tags : [],
    attachments: Array.isArray(e.attachments) ? e.attachments : [],
  }));
  const subscriptions = mergeRows(remote.subscriptions, local.subscriptions).map((s) => ({
    ...s,
    categoryId: categories.some((c) => c.id === s.categoryId) ? s.categoryId : fallbackCat,
    tags: Array.isArray(s.tags) ? s.tags : [],
    cancelEffectiveDate: s.cancelEffectiveDate?.slice(0, 10) || undefined,
  }));
  const reminders = mergeRows(remote.reminders, local.reminders);
  const tagBank = mergeTagBanks(remote.tagBank ?? [], local.tagBank ?? []);

  return normalizeExpenseTrackerState({
    v: 2,
    categories: categories.length ? categories : DEFAULT_EXPENSE_CATEGORIES,
    expenses,
    subscriptions,
    reminders,
    tagBank,
    syncToAccount: local.syncToAccount,
    cloudE2E: local.cloudE2E,
    chartMoneyMode: local.chartMoneyMode,
    eurPerUsd: local.eurPerUsd,
    period: local.period,
    chartFilterCategoryId: local.chartFilterCategoryId ?? "",
    paychecks: mergeRows(remote.paychecks ?? [], local.paychecks ?? []),
    incomeMonthOverrides: mergeRows(remote.incomeMonthOverrides ?? [], local.incomeMonthOverrides ?? []),
    incomeAdhoc: mergeRows(remote.incomeAdhoc ?? [], local.incomeAdhoc ?? []).map((r) => ({
      ...r,
      categoryId: categories.some((c) => c.id === r.categoryId) ? r.categoryId : fallbackCat,
      tags: Array.isArray(r.tags) ? r.tags : [],
      attachments: Array.isArray(r.attachments) ? r.attachments : [],
      notes: r.notes ?? (r as { note?: string }).note ?? "",
    })),
    plannedExpenses: mergeRows(remote.plannedExpenses ?? [], local.plannedExpenses ?? []),
    plannedExpenseMonthOverrides: mergeRows(
      remote.plannedExpenseMonthOverrides ?? [],
      local.plannedExpenseMonthOverrides ?? [],
    ),
    investments: mergeRows(remote.investments ?? [], local.investments ?? []),
    wealthAccounts: mergeWealthAccounts(remote.wealthAccounts ?? [], local.wealthAccounts ?? []),
    wealthTransfers: mergeRows(remote.wealthTransfers ?? [], local.wealthTransfers ?? []),
    wealthBizums: mergeRows(remote.wealthBizums ?? [], local.wealthBizums ?? []),
    patrimonioRealMode: local.patrimonioRealMode,
    trackingStartDate: local.trackingStartDate ?? remote.trackingStartDate,
    scenarios: mergeRows(remote.scenarios ?? [], local.scenarios ?? []),
    debts: mergeRows(remote.debts ?? [], local.debts ?? []),
  });
}

/** Sustituye datos importados manteniendo preferencias de UI/sync del estado actual. */
export function applyExpenseImportReplace(current: ExpenseTrackerState, imported: ExpenseTrackerState): ExpenseTrackerState {
  return normalizeExpenseTrackerState({
    v: 2,
    categories: imported.categories.length ? imported.categories : current.categories,
    expenses: imported.expenses,
    subscriptions: imported.subscriptions,
    reminders: imported.reminders,
    tagBank: mergeTagBanks(imported.tagBank, current.tagBank),
    syncToAccount: current.syncToAccount,
    cloudE2E: current.cloudE2E,
    chartMoneyMode: current.chartMoneyMode,
    eurPerUsd: current.eurPerUsd,
    period: current.period,
    chartFilterCategoryId: current.chartFilterCategoryId ?? "",
    paychecks: imported.paychecks ?? [],
    incomeMonthOverrides: imported.incomeMonthOverrides ?? [],
    incomeAdhoc: imported.incomeAdhoc ?? [],
    plannedExpenses: imported.plannedExpenses ?? [],
    plannedExpenseMonthOverrides: imported.plannedExpenseMonthOverrides ?? [],
    investments: imported.investments ?? [],
    wealthAccounts: imported.wealthAccounts ?? [],
    wealthTransfers: imported.wealthTransfers ?? [],
    wealthBizums: imported.wealthBizums ?? [],
    trackingStartDate: imported.trackingStartDate ?? current.trackingStartDate,
    patrimonioRealMode: imported.patrimonioRealMode ?? current.patrimonioRealMode,
    scenarios: imported.scenarios ?? [],
    debts: imported.debts ?? [],
  });
}

/** Fusiona por id (remoto primero en sentido “import como remoto”). */
export function applyExpenseImportMerge(current: ExpenseTrackerState, imported: ExpenseTrackerState): ExpenseTrackerState {
  return mergeExpenseTrackerRemoteLocal(imported, current);
}

function parseYmd(iso: string): Date | null {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function advanceBillingDate(d: Date, cycle: BillingCycle): Date {
  const x = new Date(d);
  if (cycle === "weekly") x.setDate(x.getDate() + 7);
  else if (cycle === "monthly") x.setMonth(x.getMonth() + 1);
  else if (cycle === "quarterly") x.setMonth(x.getMonth() + 3);
  else if (cycle === "yearly") x.setFullYear(x.getFullYear() + 1);
  return x;
}

/**
 * Próximo cobro ISO (YYYY-MM-DD) desde billingStartDate + ciclo, o legacy nextBilling si no hay inicio.
 */
export function subscriptionNextChargeIso(s: SubscriptionRow): string {
  const start = s.billingStartDate?.trim();
  if (start && start.length >= 10) {
    const anchor = parseYmd(start);
    if (!anchor) return (s.nextBilling || "").slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let cur = new Date(anchor);
    cur.setHours(12, 0, 0, 0);
    if (cur >= today) return cur.toISOString().slice(0, 10);
    let guard = 0;
    while (cur < today && guard < 5000) {
      cur = advanceBillingDate(cur, s.cycle);
      guard++;
    }
    return cur.toISOString().slice(0, 10);
  }
  return (s.nextBilling || "").slice(0, 10);
}

export function subscriptionToMonthlyAmount(s: SubscriptionRow, refDate?: string): number {
  if (!subscriptionCountsInTotals(s, refDate) || s.amount <= 0) return 0;
  switch (s.cycle) {
    case "weekly":
      return (s.amount * 52) / 12;
    case "monthly":
      return s.amount;
    case "quarterly":
      return s.amount / 3;
    case "yearly":
      return s.amount / 12;
    default:
      return s.amount;
  }
}

export function periodStartIso(filter: PeriodFilter): string | null {
  const now = new Date();
  if (filter === "all") return null;
  const d = new Date(now);
  if (filter === "12m") d.setFullYear(d.getFullYear() - 1);
  if (filter === "90d") d.setDate(d.getDate() - 90);
  if (filter === "30d") d.setDate(d.getDate() - 30);
  if (filter === "6m") d.setMonth(d.getMonth() - 6);
  if (filter === "ytd") {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString().slice(0, 10);
}

export function filterExpensesByPeriod(
  expenses: ExpenseRow[],
  filter: PeriodFilter,
  trackingStart?: string,
): ExpenseRow[] {
  const p = periodStartIso(filter);
  const t = trackingStart?.trim().slice(0, 10);
  const start = p && t && t.length === 10 ? (p > t ? p : t) : p ?? (t && t.length === 10 ? t : null);
  if (!start) return [...expenses];
  return expenses.filter((e) => e.date >= start);
}

export function convertAmount(amount: number, from: ExpenseCurrency, to: ExpenseCurrency, eurPerUsd: number): number {
  if (from === to) return amount;
  if (from === "EUR" && to === "USD") return amount / eurPerUsd;
  if (from === "USD" && to === "EUR") return amount * eurPerUsd;
  return amount;
}

export type CategoryTotals = Record<
  string,
  {
    eurNative: number;
    usdNative: number;
    unified: number;
  }
>;

export function buildCategoryTotals(state: ExpenseTrackerState, expensesFiltered: ExpenseRow[]): CategoryTotals {
  const out: CategoryTotals = {};
  for (const c of state.categories) {
    out[c.id] = { eurNative: 0, usdNative: 0, unified: 0 };
  }
  const eurPerUsd = state.eurPerUsd;

  const add = (categoryId: string, amount: number, currency: ExpenseCurrency) => {
    const rollupId = rollupCategoryId(state, categoryId);
    const bucket = out[rollupId] ?? (out[rollupId] = { eurNative: 0, usdNative: 0, unified: 0 });
    if (currency === "EUR") bucket.eurNative += amount;
    else bucket.usdNative += amount;

    if (state.chartMoneyMode === "unify_eur") {
      bucket.unified += convertAmount(amount, currency, "EUR", eurPerUsd);
    } else if (state.chartMoneyMode === "unify_usd") {
      bucket.unified += convertAmount(amount, currency, "USD", eurPerUsd);
    } else {
      bucket.unified = 0;
    }
  };

  for (const e of expensesFiltered) {
    if (e.confirmed === false) continue;
    add(e.categoryId, Math.max(0, e.amount), e.currency);
  }
  for (const s of state.subscriptions) {
    const m = subscriptionToMonthlyAmount(s);
    if (m <= 0) continue;
    add(s.categoryId, m, s.currency);
  }
  return out;
}

export function monthlyExpenseSeries(
  expensesFiltered: ExpenseRow[],
  eurPerUsd: number,
  mode: ChartMoneyMode,
  opts?: { categoryFilterId?: string | null; categoryRootId?: string | null; state?: ExpenseTrackerState },
): { months: string[]; seriesEur: number[]; seriesUsd: number[]; seriesUnified: number[] } {
  const fid = (opts?.categoryFilterId ?? opts?.categoryRootId)?.trim() || null;
  const st = opts?.state;
  const map = new Map<string, { eur: number; usd: number }>();
  for (const e of expensesFiltered) {
    if (e.confirmed === false) continue;
    if (fid && st && !expenseMatchesChartCategoryFilter(st, e.categoryId, fid)) continue;
    const key = e.date.slice(0, 7);
    if (!key || key.length !== 7) continue;
    const cur = map.get(key) ?? { eur: 0, usd: 0 };
    if (e.currency === "EUR") cur.eur += Math.max(0, e.amount);
    else cur.usd += Math.max(0, e.amount);
    map.set(key, cur);
  }
  const months = [...map.keys()].sort();
  const seriesEur = months.map((m) => map.get(m)!.eur);
  const seriesUsd = months.map((m) => map.get(m)!.usd);
  const seriesUnified = months.map((m) => {
    const { eur, usd } = map.get(m)!;
    if (mode === "unify_eur") return eur + convertAmount(usd, "USD", "EUR", eurPerUsd);
    if (mode === "unify_usd") return usd + convertAmount(eur, "EUR", "USD", eurPerUsd);
    return eur + usd;
  });
  return { months, seriesEur, seriesUsd, seriesUnified };
}

/** Cobro recurrente activo en el mes calendario `YYYY-MM` (respeta día del mes y validUntil). */
export function paycheckActiveInMonth(p: PaycheckEntry, monthKey: string): boolean {
  return recurringActiveInMonth(p, monthKey);
}

export function effectivePaycheckAmount(
  p: PaycheckEntry,
  monthKey: string,
  overrides: IncomeMonthOverride[],
): { amount: number; currency: ExpenseCurrency } {
  const cur: ExpenseCurrency = p.currency === "USD" ? "USD" : "EUR";
  const hit = overrides.find((o) => o.paycheckId === p.id && o.month === monthKey);
  if (hit) return { amount: Math.max(0, hit.amount), currency: hit.currency };
  return { amount: Math.max(0, p.typicalAmount ?? 0), currency: cur };
}

/** Ingresos previstos por mes (cobros recurrentes + ingresos puntuales). */
export function monthlyIncomeSeries(
  state: ExpenseTrackerState,
  months: string[],
  mode: ChartMoneyMode,
  eurPerUsd: number,
): { seriesEur: number[]; seriesUsd: number[]; seriesUnified: number[] } {
  const overrides = state.incomeMonthOverrides ?? [];
  const adhoc = state.incomeAdhoc ?? [];
  const seriesEur = months.map(() => 0);
  const seriesUsd = months.map(() => 0);

  for (let i = 0; i < months.length; i++) {
    const mk = months[i]!;
    for (const p of state.paychecks ?? []) {
      if (!paycheckActiveInMonth(p, mk)) continue;
      const { amount, currency } = effectivePaycheckAmount(p, mk, overrides);
      if (amount <= 0) continue;
      if (currency === "EUR") seriesEur[i]! += amount;
      else seriesUsd[i]! += amount;
    }
    for (const row of adhoc) {
      if (row.confirmed === false) continue;
      if (!row.date.startsWith(mk)) continue;
      const a = Math.max(0, row.amount);
      if (row.currency === "EUR") seriesEur[i]! += a;
      else seriesUsd[i]! += a;
    }
  }

  const seriesUnified = months.map((_, i) => {
    const eur = seriesEur[i]!;
    const usd = seriesUsd[i]!;
    if (mode === "unify_eur") return eur + convertAmount(usd, "USD", "EUR", eurPerUsd);
    if (mode === "unify_usd") return usd + convertAmount(eur, "EUR", "USD", eurPerUsd);
    return eur + usd;
  });

  return { seriesEur, seriesUsd, seriesUnified };
}

/** Equiv. mensual de suscripciones activas (para KPI y series mensuales). */
export function subscriptionMonthlyBurnByCurrency(state: ExpenseTrackerState, refDate?: string): { eur: number; usd: number } {
  let eur = 0;
  let usd = 0;
  for (const s of state.subscriptions) {
    if (!subscriptionCountsInTotals(s, refDate)) continue;
    const m = subscriptionToMonthlyAmount(s, refDate);
    if (m <= 0) continue;
    if (s.currency === "EUR") eur += m;
    else usd += m;
  }
  return { eur, usd };
}

export function plannedExpenseActiveInMonth(p: PlannedExpenseEntry, monthKey: string): boolean {
  return paycheckActiveInMonth(p as PaycheckEntry, monthKey);
}

export function effectivePlannedExpenseAmount(
  p: PlannedExpenseEntry,
  monthKey: string,
  overrides: PlannedExpenseMonthOverride[],
): { amount: number; currency: ExpenseCurrency } {
  const cur: ExpenseCurrency = p.currency === "USD" ? "USD" : "EUR";
  const hit = overrides.find((o) => o.plannedExpenseId === p.id && o.month === monthKey);
  if (hit) return { amount: Math.max(0, hit.amount), currency: hit.currency };
  return { amount: Math.max(0, p.typicalAmount ?? 0), currency: cur };
}

/** Gastos recurrentes previstos por mes (importe habitual + overrides). */
export function monthlyPlannedOutflowSeries(
  state: ExpenseTrackerState,
  months: string[],
  mode: ChartMoneyMode,
  eurPerUsd: number,
): { seriesEur: number[]; seriesUsd: number[]; seriesUnified: number[] } {
  const overrides = state.plannedExpenseMonthOverrides ?? [];
  const rows = state.plannedExpenses ?? [];
  const seriesEur = months.map(() => 0);
  const seriesUsd = months.map(() => 0);

  for (let i = 0; i < months.length; i++) {
    const mk = months[i]!;
    for (const p of rows) {
      if (!plannedExpenseActiveInMonth(p, mk)) continue;
      const { amount, currency } = effectivePlannedExpenseAmount(p, mk, overrides);
      if (amount <= 0) continue;
      if (currency === "EUR") seriesEur[i]! += amount;
      else seriesUsd[i]! += amount;
    }
  }

  const seriesUnified = months.map((_, i) => {
    const eur = seriesEur[i]!;
    const usd = seriesUsd[i]!;
    if (mode === "unify_eur") return eur + convertAmount(usd, "USD", "EUR", eurPerUsd);
    if (mode === "unify_usd") return usd + convertAmount(eur, "EUR", "USD", eurPerUsd);
    return eur + usd;
  });

  return { seriesEur, seriesUsd, seriesUnified };
}

function csvEscape(cell: string) {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

/** CSV con BOM UTF-8 para abrir bien en Excel. */
export function expenseTrackerToCsv(state: ExpenseTrackerState): string {
  const sep = ",";
  const catName = (id: string) => formatCategoryPath(state, id);
  const lines: string[] = [];
  lines.push(
    ["tipo", "fecha_o_ciclo", "concepto", "importe", "moneda", "categoria", "etiquetas", "adjuntos", "notas"].join(sep),
  );

  for (const e of state.expenses) {
    const att = e.attachments.map((a) => `${a.title}|${a.url}`).join("; ");
    lines.push(
      [
        "gasto",
        e.date,
        csvEscape(e.label),
        String(e.amount),
        e.currency,
        csvEscape(catName(e.categoryId)),
        csvEscape(e.tags.join("; ")),
        csvEscape(att),
        csvEscape(e.notes),
      ].join(sep),
    );
  }
  for (const row of state.incomeAdhoc ?? []) {
    const att = (row.attachments ?? []).map((a) => `${a.title}|${a.url}`).join("; ");
    lines.push(
      [
        "ingreso",
        row.date,
        csvEscape(row.label),
        String(row.amount),
        row.currency,
        csvEscape(catName(row.categoryId)),
        csvEscape((row.tags ?? []).join("; ")),
        csvEscape(att),
        csvEscape(row.notes ?? ""),
      ].join(sep),
    );
  }
  for (const s of state.subscriptions) {
    lines.push(
      [
        "suscripcion",
        s.cycle,
        csvEscape(s.name),
        String(s.amount),
        s.currency,
        csvEscape(catName(s.categoryId)),
        csvEscape(s.tags.join("; ")),
        "",
        csvEscape(`${s.active ? "activa" : "pausada"}; próx.: ${s.nextBilling}; ${s.notes}`.trim()),
      ].join(sep),
    );
  }

  const body = lines.join("\r\n");
  return `\ufeff${body}`;
}

/** Parsea una línea CSV simple (comillas dobles). */
export function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === sep) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectCsvSep(headerLine: string): string {
  if (headerLine.split(";").length > headerLine.split(",").length) return ";";
  return ",";
}

/** Resuelve categoría por nombre plano o ruta «Padre / Hijo» (también «Padre · Hijo»). */
export function resolveCategoryIdByLabel(state: ExpenseTrackerState, label: string): string {
  const raw = label.trim();
  if (!raw) return state.categories[0]!.id;
  const t = raw.toLowerCase();
  const parts = raw.split(/\s*[/·]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const pName = parts[0]!.toLowerCase();
    const cName = parts[1]!.toLowerCase();
    const parent = state.categories.find((c) => !c.parentId && c.name.trim().toLowerCase() === pName);
    if (parent) {
      const child = state.categories.find((c) => c.parentId === parent.id && c.name.trim().toLowerCase() === cName);
      if (child) return child.id;
    }
  }
  const hit = state.categories.find((c) => c.name.trim().toLowerCase() === t);
  return hit?.id ?? state.categories[0]!.id;
}

/** Importa filas CSV exportadas por esta app (también tolera cabecera antigua sin etiquetas/adjuntos). */
export function expenseTrackerFromCsv(state: ExpenseTrackerState, csvText: string): ExpenseTrackerState {
  const text = csvText.replace(/^\ufeff/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return state;
  const sep = detectCsvSep(lines[0]!);
  const head = parseCsvLine(lines[0]!, sep).map((h) => h.toLowerCase().trim());
  const idx = (name: string) => head.indexOf(name);
  const iTipo = idx("tipo");
  const iFecha = idx("fecha_o_ciclo");
  const iConcepto = idx("concepto");
  const iImporte = idx("importe");
  const iMoneda = idx("moneda");
  const iCat = idx("categoria");
  const iTags = idx("etiquetas");
  const iAtt = idx("adjuntos");
  const iNotes = idx("notas");
  const hasHeader = iTipo >= 0;
  const next = normalizeExpenseTrackerState({
    ...state,
    expenses: [...state.expenses],
    subscriptions: [...state.subscriptions],
  });
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const cell = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i]! : "").trim();

  for (const line of dataLines) {
    const cells = parseCsvLine(line, sep);
    if (!cells.length) continue;
    const tipo = (cell(cells, Math.max(0, iTipo)) || cells[0] || "").toLowerCase();
    if (tipo === "gasto") {
      const date = cell(cells, iFecha >= 0 ? iFecha : 1).slice(0, 10);
      const label = cell(cells, iConcepto >= 0 ? iConcepto : 2) || "Gasto";
      const amount = Number((cell(cells, iImporte >= 0 ? iImporte : 3) || "0").replace(",", ".")) || 0;
      const currency = cell(cells, iMoneda >= 0 ? iMoneda : 4) === "USD" ? "USD" : "EUR";
      const catNameCell = cell(cells, iCat >= 0 ? iCat : 5);
      const tagsCell = iTags >= 0 ? cell(cells, iTags) : "";
      const attCell = iAtt >= 0 ? cell(cells, iAtt) : "";
      const notesCell = iNotes >= 0 ? cell(cells, iNotes) : cell(cells, 6);
      if (!date) continue;
      const categoryId = resolveCategoryIdByLabel(next, catNameCell);
      const tags = parseTags(tagsCell.replace(/\|/g, ","));
      const attachments: ExpenseAttachment[] = [];
      if (attCell) {
        for (const part of attCell.split(";")) {
          const p = part.trim();
          if (!p) continue;
          const pipe = p.indexOf("|");
          const title = pipe >= 0 ? p.slice(0, pipe).trim() : "Enlace";
          const urlRaw = pipe >= 0 ? p.slice(pipe + 1).trim() : p;
          const url = normalizeHttpsUrl(urlRaw);
          if (!url) continue;
          attachments.push({ id: `att_${Math.random().toString(16).slice(2)}`, title: title || "Enlace", url });
        }
      }
      next.expenses.push({
        id: `imp_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
        date,
        label,
        amount,
        currency,
        categoryId,
        notes: notesCell,
        tags,
        attachments,
        confirmed: true,
      });
    } else if (tipo === "ingreso") {
      const date = cell(cells, iFecha >= 0 ? iFecha : 1).slice(0, 10);
      const label = cell(cells, iConcepto >= 0 ? iConcepto : 2) || "Ingreso";
      const amount = Number((cell(cells, iImporte >= 0 ? iImporte : 3) || "0").replace(",", ".")) || 0;
      const currency = cell(cells, iMoneda >= 0 ? iMoneda : 4) === "USD" ? "USD" : "EUR";
      const catNameCell = cell(cells, iCat >= 0 ? iCat : 5);
      const tagsCell = iTags >= 0 ? cell(cells, iTags) : "";
      const attCell = iAtt >= 0 ? cell(cells, iAtt) : "";
      const notesCell = iNotes >= 0 ? cell(cells, iNotes) : cell(cells, 6);
      if (!date) continue;
      const categoryId = resolveCategoryIdByLabel(next, catNameCell);
      const tags = parseTags(tagsCell.replace(/\|/g, ","));
      const attachments: ExpenseAttachment[] = [];
      if (attCell) {
        for (const part of attCell.split(";")) {
          const p = part.trim();
          if (!p) continue;
          const pipe = p.indexOf("|");
          const title = pipe >= 0 ? p.slice(0, pipe).trim() : "Enlace";
          const urlRaw = pipe >= 0 ? p.slice(pipe + 1).trim() : p;
          const url = normalizeHttpsUrl(urlRaw);
          if (!url) continue;
          attachments.push({ id: `att_${Math.random().toString(16).slice(2)}`, title: title || "Enlace", url });
        }
      }
      next.incomeAdhoc!.push({
        id: `imp_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
        date,
        label,
        amount,
        currency,
        categoryId,
        notes: notesCell,
        tags,
        attachments,
        confirmed: true,
      });
    } else if (tipo === "suscripcion") {
      const cycleRaw = cell(cells, iFecha >= 0 ? iFecha : 1);
      const cycle = (["weekly", "monthly", "quarterly", "yearly"] as const).includes(cycleRaw as any)
        ? (cycleRaw as SubscriptionRow["cycle"])
        : "monthly";
      const name = cell(cells, iConcepto >= 0 ? iConcepto : 2) || "Suscripción";
      const amount = Number((cell(cells, iImporte >= 0 ? iImporte : 3) || "0").replace(",", ".")) || 0;
      const currency = cell(cells, iMoneda >= 0 ? iMoneda : 4) === "USD" ? "USD" : "EUR";
      const catNameCell = cell(cells, iCat >= 0 ? iCat : 5);
      const tagsCell = iTags >= 0 ? cell(cells, iTags) : "";
      const notesCell = iNotes >= 0 ? cell(cells, iNotes) : cell(cells, 6);
      const categoryId = resolveCategoryIdByLabel(next, catNameCell);
      next.subscriptions.push({
        id: `imp_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
        name,
        amount,
        currency,
        cycle,
        categoryId,
        nextBilling: "",
        active: true,
        notes: notesCell,
        tags: parseTags(tagsCell.replace(/\|/g, ",")),
      });
    }
  }
  return normalizeExpenseTrackerState(next);
}

export function expenseTrackerToJsonSnapshot(state: ExpenseTrackerState): string {
  return JSON.stringify(state, null, 2);
}

/** Recordatorios con fecha = hoy y notifyBrowser. */
export function remindersDueToday(state: ExpenseTrackerState): ExpenseReminder[] {
  const t = new Date().toISOString().slice(0, 10);
  return state.reminders.filter((r) => r.date === t && r.notifyBrowser);
}
