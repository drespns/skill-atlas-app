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
  notes: string;
  tags: string[];
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
    chartMoneyMode: "mixed",
    eurPerUsd: DEFAULT_EUR_PER_USD,
    period: "12m",
    chartFilterCategoryId: "",
    paychecks: [],
    incomeMonthOverrides: [],
    incomeAdhoc: [],
    plannedExpenses: [],
    plannedExpenseMonthOverrides: [],
  };
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
            notes: String(s?.notes ?? ""),
            tags: parseTags(s?.tags),
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
  };
}

/** Acepta estado v1 (legacy) o v2 y devuelve siempre v2 normalizado. */
export function normalizeExpenseTrackerState(raw: unknown): ExpenseTrackerState {
  const base = defaultExpenseTrackerState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as any;
  if (o.v === 1) return upgradeV1ToV2(o);
  if (o.v !== 2) return base;

  const categories: ExpenseCategory[] = Array.isArray(o.categories)
    ? validateCategoryTree(
        o.categories.map((c: any) => parseCategory(c)).filter((c: ExpenseCategory) => c.id),
      )
    : base.categories;
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
            notes: String(s?.notes ?? ""),
            tags: parseTags(s?.tags),
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

  return {
    v: 2,
    categories,
    expenses,
    subscriptions,
    reminders,
    tagBank,
    syncToAccount: Boolean(o.syncToAccount),
    cloudE2E: Boolean(o.cloudE2E),
    chartMoneyMode,
    eurPerUsd: clampEurPerUsd(Number(o.eurPerUsd)),
    period,
    chartFilterCategoryId,
    paychecks,
    incomeMonthOverrides: incomeOverridesClean,
    incomeAdhoc,
    plannedExpenses,
    plannedExpenseMonthOverrides: plannedOverridesClean,
  };
}

export function loadExpenseTrackerFromStorage(): ExpenseTrackerState {
  const raw = safeParse(
    typeof localStorage !== "undefined" ? localStorage.getItem(EXPENSE_TRACKER_STORAGE_KEY) : null,
  );
  return normalizeExpenseTrackerState(raw);
}

export function saveExpenseTrackerToStorage(state: ExpenseTrackerState) {
  try {
    localStorage.setItem(EXPENSE_TRACKER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
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

export function subscriptionToMonthlyAmount(s: SubscriptionRow): number {
  if (!s.active || s.amount <= 0) return 0;
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

export function filterExpensesByPeriod(expenses: ExpenseRow[], filter: PeriodFilter): ExpenseRow[] {
  const start = periodStartIso(filter);
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

/** Cobro recurrente activo en el mes calendario `YYYY-MM` (límites por mes del ISO). */
export function paycheckActiveInMonth(p: PaycheckEntry, monthKey: string): boolean {
  const fromM = p.validFrom?.slice(0, 7) ?? "";
  const untilM = p.validUntil?.slice(0, 7) ?? "";
  if (fromM && monthKey < fromM) return false;
  if (untilM && monthKey > untilM) return false;
  return true;
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
export function subscriptionMonthlyBurnByCurrency(state: ExpenseTrackerState): { eur: number; usd: number } {
  let eur = 0;
  let usd = 0;
  for (const s of state.subscriptions) {
    if (!s.active) continue;
    const m = subscriptionToMonthlyAmount(s);
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

export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Recordatorios con fecha = hoy y notifyBrowser. */
export function remindersDueToday(state: ExpenseTrackerState): ExpenseReminder[] {
  const t = new Date().toISOString().slice(0, 10);
  return state.reminders.filter((r) => r.date === t && r.notifyBrowser);
}
