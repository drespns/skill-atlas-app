import { layoutTreemap } from "@lib/treemap-layout";
import {
  SUBSCRIPTION_BRAND_CATALOG,
  addMonthsToIso,
  formatEurEs,
  getSubscriptionBrand,
  parseCardColor,
  resolveSubscriptionBrandKey,
  scheduleSubscriptionCancel,
  subscriptionBillingSnapshot,
  subscriptionBrandAccent,
  subscriptionBrandLogoPath,
  subscriptionCountsInTotals,
  subscriptionNextChargeIso,
  subscriptionToMonthlyAmount,
  type ExpenseCurrency,
  type ExpenseTrackerState,
  type SubscriptionRow,
} from "@lib/tools-expense-tracker";
import {
  initExpenseDatePickers,
  readDateFieldValue,
  refreshExpenseDatePicker,
  showExpenseDialog,
} from "./expense-tracker-dates";

export type SubUiDeps = {
  getState: () => ExpenseTrackerState;
  setState: (s: ExpenseTrackerState) => void;
  persist: () => void;
  renderAll: (root: HTMLElement) => void;
  showConfirmDialog: (root: HTMLElement, msg: string, okLabel?: string) => Promise<boolean>;
  fillCategorySelect: (sel: HTMLSelectElement) => void;
  makeId: () => string;
  parseTags: (raw: string) => string[];
  pushTagBankFrom: (tags: string[]) => void;
  amountInEur: (amount: number, currency: ExpenseCurrency, fx: number) => number;
  todayIso: () => string;
};

let editingSubId: string | null = null;
let subsTreemapObserver: ResizeObserver | null = null;

type SubCardOpts = { compact?: boolean; smallTile?: boolean };

function formatDateLongEs(iso: string): string {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(`${s}T12:00:00`);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function cycleLabelEs(cycle: SubscriptionRow["cycle"]): string {
  if (cycle === "weekly") return "semana";
  if (cycle === "monthly") return "mes";
  if (cycle === "quarterly") return "trimestre";
  return "año";
}

function appendBrandLogo(container: HTMLElement, brandKey?: string, name?: string, compact = false) {
  const wrap = document.createElement("div");
  wrap.className =
    "et-sub-brand-logo shrink-0 rounded-lg overflow-hidden border border-white/20 dark:border-gray-700/60 bg-white/90 dark:bg-gray-900/90 flex items-center justify-center shadow-sm " +
    (compact ? "w-8 h-8" : "w-11 h-11 sm:w-12 sm:h-12 rounded-xl");

  if (brandKey) {
    const img = document.createElement("img");
    img.alt = getSubscriptionBrand(brandKey)?.label ?? name ?? "";
    img.className = "w-full h-full object-contain p-1.5";
    img.src = subscriptionBrandLogoPath(brandKey, "svg");
    img.addEventListener("error", () => {
      if (!img.dataset.fallback) {
        img.dataset.fallback = "1";
        img.src = subscriptionBrandLogoPath(brandKey, "png");
        return;
      }
      img.remove();
      const initials = document.createElement("span");
      initials.className = "text-sm font-bold text-gray-700 dark:text-gray-200";
      initials.textContent = (name ?? "?").slice(0, 2).toUpperCase();
      wrap.appendChild(initials);
    });
    wrap.appendChild(img);
  } else {
    const initials = document.createElement("span");
    initials.className = "text-sm font-bold text-gray-700 dark:text-gray-200";
    initials.textContent = (name ?? "?").slice(0, 2).toUpperCase();
    wrap.appendChild(initials);
  }
  container.appendChild(wrap);
}

function buildBillingTimeline(s: SubscriptionRow, today: string): HTMLElement {
  const snap = subscriptionBillingSnapshot(s, today);
  const timeline = document.createElement("div");
  timeline.className = "et-sub-timeline space-y-2 mt-3";

  const mkNode = (title: string, detail: string, active: boolean) => {
    const row = document.createElement("div");
    row.className = "flex gap-2.5 items-start";
    row.innerHTML = `
      <div class="flex flex-col items-center shrink-0 pt-0.5">
        <span class="et-sub-timeline-dot ${active ? "et-sub-timeline-dot--active" : ""}"></span>
        <span class="et-sub-timeline-line"></span>
      </div>
      <div class="min-w-0 pb-1">
        <p class="m-0 text-xs font-semibold text-gray-900 dark:text-gray-50">${title}</p>
        <p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">${detail}</p>
      </div>`;
    return row;
  };

  if (snap.phase === "trial") {
    const trialAmt = snap.cycleAmount;
    timeline.appendChild(
      mkNode(
        `Ahora: ${formatEurEs(trialAmt)}`,
        snap.regularStartsOn
          ? `Periodo de prueba hasta ${formatDateLongEs(snap.regularStartsOn)}`
          : "Periodo de prueba activo",
        true,
      ),
    );
    timeline.appendChild(
      mkNode(
        `A partir del ${formatDateLongEs(snap.regularStartsOn ?? snap.nextChargeIso)}`,
        `${formatEurEs(s.amount)}/${cycleLabelEs(s.cycle)}`,
        false,
      ),
    );
  } else {
    timeline.appendChild(
      mkNode(
        `Próximo cobro: ${formatDateLongEs(snap.nextChargeIso)}`,
        `${formatEurEs(snap.cycleAmount)}/${cycleLabelEs(s.cycle)}`,
        true,
      ),
    );
    if (s.billingStartDate) {
      timeline.appendChild(
        mkNode(`Desde ${formatDateLongEs(s.billingStartDate)}`, `Ciclo ${cycleLabelEs(s.cycle)}`, false),
      );
    }
  }

  const lastLine = timeline.querySelector(".et-sub-timeline-line:last-of-type");
  lastLine?.remove();
  return timeline;
}

function buildSubCard(s: SubscriptionRow, deps: SubUiDeps, today: string, opts?: SubCardOpts): HTMLElement {
  const compact = opts?.compact ?? false;
  const smallTile = opts?.smallTile ?? false;
  const state = deps.getState();
  const fx = state.eurPerUsd;
  const counts = subscriptionCountsInTotals(s, today);
  const scheduled = Boolean(s.cancelEffectiveDate?.trim());
  const faded = !counts || !s.active || scheduled;
  const snap = subscriptionBillingSnapshot(s, today);
  const monthly = subscriptionToMonthlyAmount(s, today);
  const monthlyEur = deps.amountInEur(monthly, s.currency, fx);
  const accent = s.cardColor ?? subscriptionBrandAccent(s.brandKey, "#6366f1");

  const card = document.createElement("article");
  card.className =
    "et-sub-card group relative rounded-xl border border-gray-200/90 dark:border-gray-800/80 bg-white/90 dark:bg-gray-950/70 shadow-sm overflow-hidden flex flex-col h-full min-h-0" +
    (faded ? " opacity-80" : "");
  card.dataset.subId = s.id;
  card.style.setProperty("--et-sub-accent", accent);

  const accentBar = document.createElement("div");
  accentBar.className = "h-1 w-full shrink-0";
  accentBar.style.background = accent;

  const body = document.createElement("div");
  body.className = (compact ? "p-2.5" : "p-4") + " flex flex-col flex-1 min-h-0";

  const head = document.createElement("div");
  head.className = "flex items-start gap-2";
  const logoCol = document.createElement("div");
  appendBrandLogo(logoCol, s.brandKey, s.name, compact);

  const metaCol = document.createElement("div");
  metaCol.className = "min-w-0 flex-1";
  const statusRow = document.createElement("div");
  statusRow.className = "flex flex-wrap items-center gap-1.5 mb-1";
  const badge = document.createElement("span");
  badge.className = "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (!s.active) {
    badge.className += " bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    badge.textContent = "Pausada";
  } else if (snap.phase === "trial") {
    badge.className += " bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    badge.textContent = "Prueba";
  } else if (scheduled && counts) {
    badge.className += " bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
    badge.textContent = `Cancela ${formatDateLongEs(s.cancelEffectiveDate!)}`;
  } else {
    badge.className += " bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200";
    badge.textContent = snap.phase === "trial" ? "Prueba" : "Activa";
  }
  statusRow.appendChild(badge);

  const title = document.createElement("h3");
  title.className =
    "m-0 font-semibold text-gray-900 dark:text-gray-50 truncate " + (compact ? "text-sm" : "text-base");
  title.textContent = s.name;

  const priceRow = document.createElement("div");
  priceRow.className = "flex items-baseline justify-between gap-2 mt-0.5";
  const priceMain = document.createElement("p");
  priceMain.className =
    "m-0 font-bold et-amount text-gray-900 dark:text-gray-50 " + (compact ? "text-base" : "text-xl");
  if (snap.phase === "trial") {
    priceMain.textContent = formatEurEs(snap.cycleAmount);
    const priceSub = document.createElement("p");
    priceSub.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400 text-right";
    priceSub.textContent = `Luego ${formatEurEs(s.amount)}/${cycleLabelEs(s.cycle)}`;
    priceRow.append(priceMain, priceSub);
  } else {
    priceMain.textContent = `${formatEurEs(snap.cycleAmount)}/${cycleLabelEs(s.cycle)}`;
    const priceSub = document.createElement("p");
    priceSub.className = "m-0 text-[11px] text-gray-500 dark:text-gray-400 text-right";
    priceSub.textContent = `≈ ${formatEurEs(monthlyEur)}/mes`;
    priceRow.append(priceMain, priceSub);
  }

  metaCol.append(statusRow, title, priceRow);
  if (smallTile) {
    const next = document.createElement("p");
    next.className = "m-0 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 truncate";
    next.textContent = `Próx. ${formatDateLongEs(snap.nextChargeIso)}`;
    metaCol.appendChild(next);
  }
  head.append(logoCol, metaCol);

  const timeline = smallTile ? null : buildBillingTimeline(s, today);
  if (timeline && s.reminderDaysBefore != null && s.reminderDaysBefore > 0) {
    const rem = document.createElement("p");
    rem.className = "m-0 mt-2 text-[10px] text-gray-500 dark:text-gray-400";
    rem.textContent = `Recordatorio ${s.reminderDaysBefore} días antes del cobro`;
    timeline.appendChild(rem);
  }

  const actions = document.createElement("div");
  actions.className =
    "flex items-center justify-between gap-2 mt-auto border-t border-gray-100 dark:border-gray-800/80 " +
    (compact ? "pt-2" : "pt-3");
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.dataset.subCancel = s.id;
  cancelBtn.className = "text-xs font-semibold text-gray-600 dark:text-gray-300 hover:underline";
  if (!s.active) cancelBtn.textContent = "Reactivar";
  else if (scheduled) cancelBtn.textContent = "Deshacer cancelación";
  else cancelBtn.textContent = "Cancelar suscripción";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.dataset.subEdit = s.id;
  editBtn.className = "et-btn-secondary text-xs py-1.5 px-2.5";
  editBtn.textContent = "Editar";

  actions.append(cancelBtn, editBtn);
  if (timeline) body.append(head, timeline, actions);
  else body.append(head, actions);
  card.append(accentBar, body);
  return card;
}

function paintSubsTreemap(
  strip: HTMLElement,
  sorted: SubscriptionRow[],
  deps: SubUiDeps,
  today: string,
) {
  strip.querySelectorAll(".et-sub-treemap-card").forEach((el) => el.remove());
  const w = strip.clientWidth;
  const h = strip.clientHeight || 224;
  if (w < 16 || h < 16) return;

  const fx = deps.getState().eurPerUsd;
  const items = sorted.map((s) => ({
    id: s.id,
    value: deps.amountInEur(subscriptionToMonthlyAmount(s, today), s.currency, fx),
    sub: s,
  }));

  const rects = layoutTreemap(
    items.map((i) => ({ id: i.id, value: i.value })),
    w,
    h,
  );
  const totalArea = w * h;

  for (const rect of rects) {
    const item = items.find((i) => i.id === rect.id);
    if (!item) continue;
    const areaRatio = (rect.w * rect.h) / totalArea;
    const wrap = document.createElement("div");
    wrap.className = "et-sub-treemap-card";
    wrap.style.left = `${(rect.x / w) * 100}%`;
    wrap.style.top = `${(rect.y / h) * 100}%`;
    wrap.style.width = `${(rect.w / w) * 100}%`;
    wrap.style.height = `${(rect.h / h) * 100}%`;
    wrap.appendChild(
      buildSubCard(item.sub, deps, today, { compact: true, smallTile: areaRatio < 0.14 }),
    );
    strip.appendChild(wrap);
  }
}

export function renderSubs(root: HTMLElement, deps: SubUiDeps) {
  const strip = root.querySelector<HTMLElement>("[data-et-subs-strip]");
  if (!strip) return;
  strip.innerHTML = "";
  const subs = deps.getState().subscriptions;
  const today = deps.todayIso();

  if (!subs.length) {
    strip.className = "relative w-full min-h-[8rem] flex items-center justify-center";
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-500 dark:text-gray-400 px-4 py-6 text-center max-w-md";
    empty.textContent =
      "Aún no hay suscripciones. Añade Spotify, Movistar+ u otras con logo, periodo de prueba y fecha de cobro.";
    strip.appendChild(empty);
    return;
  }

  strip.className = "relative w-full min-h-[14rem] sm:min-h-[16rem] overflow-hidden";

  const sorted = [...subs].sort((a, b) => {
    const ma = subscriptionToMonthlyAmount(a, today);
    const mb = subscriptionToMonthlyAmount(b, today);
    return mb - ma;
  });

  paintSubsTreemap(strip, sorted, deps, today);
  subsTreemapObserver?.disconnect();
  subsTreemapObserver = new ResizeObserver(() => paintSubsTreemap(strip, sorted, deps, today));
  subsTreemapObserver.observe(strip);
}

function renderBrandPicker(root: HTMLElement, selected?: string) {
  const host = root.querySelector<HTMLElement>("[data-et-sub-brand-grid]");
  const hidden = root.querySelector<HTMLInputElement>("[data-et-sub-brand-key]");
  if (!host || !hidden) return;
  host.innerHTML = "";
  hidden.value = selected ?? "";

  const autoBtn = document.createElement("button");
  autoBtn.type = "button";
  autoBtn.className = "et-sub-brand-pick et-sub-brand-pick--auto" + (!selected ? " et-sub-brand-pick--on" : "");
  autoBtn.dataset.brandKey = "";
  autoBtn.textContent = "Auto";
  autoBtn.title = "Detectar desde el nombre";
  host.appendChild(autoBtn);

  for (const brand of SUBSCRIPTION_BRAND_CATALOG) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "et-sub-brand-pick" + (selected === brand.key ? " et-sub-brand-pick--on" : "");
    btn.dataset.brandKey = brand.key;
    btn.title = brand.label;
    const img = document.createElement("img");
    img.src = subscriptionBrandLogoPath(brand.key, "svg");
    img.alt = brand.label;
    img.className = "w-6 h-6 object-contain";
    img.addEventListener("error", () => {
      img.src = subscriptionBrandLogoPath(brand.key, "png");
    });
    btn.appendChild(img);
    host.appendChild(btn);
  }
}

function updateSubDialogPreview(root: HTMLElement, deps: SubUiDeps) {
  const preview = root.querySelector<HTMLElement>("[data-et-sub-billing-preview]");
  if (!preview) return;

  const name = root.querySelector<HTMLInputElement>("[data-et-sub-name]")?.value?.trim() ?? "";
  const amount = Number(root.querySelector<HTMLInputElement>("[data-et-sub-amount]")?.value);
  const cycle = root.querySelector<HTMLSelectElement>("[data-et-sub-cycle]")?.value as SubscriptionRow["cycle"];
  const billingStart = readDateFieldValue(root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]"));
  const trialEnabled = root.querySelector<HTMLInputElement>("[data-et-sub-trial-enabled]")?.checked;
  const trialAmount = Number(root.querySelector<HTMLInputElement>("[data-et-sub-trial-amount]")?.value);
  const trialEnd = readDateFieldValue(root.querySelector<HTMLInputElement>("[data-et-sub-trial-ends]"));
  const brandManual = root.querySelector<HTMLInputElement>("[data-et-sub-brand-key]")?.value?.trim();

  const draft: SubscriptionRow = {
    id: "preview",
    name: name || "Suscripción",
    amount: Number.isFinite(amount) ? amount : 0,
    currency: "EUR",
    cycle: cycle ?? "monthly",
    categoryId: deps.getState().categories[0]!.id,
    nextBilling: "",
    billingStartDate: billingStart.length === 10 ? billingStart : undefined,
    active: true,
    notes: "",
    tags: [],
    brandKey: brandManual || resolveSubscriptionBrandKey(name),
    trialAmount: trialEnabled && Number.isFinite(trialAmount) ? trialAmount : undefined,
    trialEndsOn: trialEnabled && trialEnd.length === 10 ? trialEnd : undefined,
  };

  preview.innerHTML = "";
  preview.appendChild(buildBillingTimeline(draft, deps.todayIso()));
}

function syncTrialFieldsVisibility(root: HTMLElement) {
  const enabled = root.querySelector<HTMLInputElement>("[data-et-sub-trial-enabled]")?.checked;
  root.querySelector<HTMLElement>("[data-et-sub-trial-fields]")?.classList.toggle("hidden", !enabled);
}

export function openSubDialog(root: HTMLElement, deps: SubUiDeps, sub: SubscriptionRow | null) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]");
  const title = root.querySelector<HTMLElement>("[data-et-sub-dialog-title]");
  const idEl = root.querySelector<HTMLInputElement>("[data-et-sub-id]");
  const nameEl = root.querySelector<HTMLInputElement>("[data-et-sub-name]");
  const amountEl = root.querySelector<HTMLInputElement>("[data-et-sub-amount]");
  const cycleEl = root.querySelector<HTMLSelectElement>("[data-et-sub-cycle]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-sub-category]");
  const billEl = root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]");
  const activeEl = root.querySelector<HTMLInputElement>("[data-et-sub-active]");
  const tagsEl = root.querySelector<HTMLInputElement>("[data-et-sub-tags]");
  const notesEl = root.querySelector<HTMLTextAreaElement>("[data-et-sub-notes]");
  const delBtn = root.querySelector<HTMLButtonElement>("[data-et-sub-delete]");
  const trialEnabledEl = root.querySelector<HTMLInputElement>("[data-et-sub-trial-enabled]");
  const trialAmountEl = root.querySelector<HTMLInputElement>("[data-et-sub-trial-amount]");
  const trialEndsEl = root.querySelector<HTMLInputElement>("[data-et-sub-trial-ends]");
  const reminderEl = root.querySelector<HTMLInputElement>("[data-et-sub-reminder-days]");
  if (!dlg || !title || !idEl || !nameEl || !amountEl || !cycleEl || !catEl || !billEl || !activeEl || !tagsEl || !notesEl || !delBtn) return;

  editingSubId = sub?.id ?? null;
  title.textContent = sub ? "Editar suscripción" : "Nueva suscripción";
  idEl.value = sub?.id ?? "";
  nameEl.value = sub?.name ?? "";
  amountEl.value = String(sub?.amount ?? "");
  cycleEl.value = sub?.cycle ?? "monthly";
  deps.fillCategorySelect(catEl);
  catEl.value = sub?.categoryId ?? deps.getState().categories[0]!.id;
  billEl.value = (sub?.billingStartDate || deps.todayIso()).slice(0, 10);
  activeEl.checked = sub?.active !== false;
  tagsEl.value = (sub?.tags ?? []).join(", ");
  notesEl.value = sub?.notes ?? "";
  if (trialEnabledEl) trialEnabledEl.checked = Boolean(sub?.trialEndsOn);
  if (trialAmountEl) trialAmountEl.value = sub?.trialAmount != null ? String(sub.trialAmount) : "0";
  if (trialEndsEl) trialEndsEl.value = (sub?.trialEndsOn ?? "").slice(0, 10);
  if (reminderEl) reminderEl.value = sub?.reminderDaysBefore != null ? String(sub.reminderDaysBefore) : "7";
  const colorEl = root.querySelector<HTMLInputElement>("[data-et-sub-color]");
  const brandKey = sub?.brandKey ?? resolveSubscriptionBrandKey(sub?.name ?? "");
  if (colorEl) colorEl.value = parseCardColor(sub?.cardColor) ?? subscriptionBrandAccent(brandKey, "#6366f1");
  renderBrandPicker(root, brandKey);
  delBtn.classList.toggle("invisible", !sub);
  syncTrialFieldsVisibility(root);
  updateSubDialogPreview(root, deps);
  showExpenseDialog(dlg);
  queueMicrotask(() => {
    refreshExpenseDatePicker(billEl, billEl.value);
    if (trialEndsEl) refreshExpenseDatePicker(trialEndsEl, trialEndsEl.value);
  });
  requestAnimationFrame(() => window.dispatchEvent(new Event("skillatlas:select-popovers-refresh")));
}

function saveSubFromDialog(root: HTMLElement, deps: SubUiDeps) {
  const idEl = root.querySelector<HTMLInputElement>("[data-et-sub-id]");
  const nameEl = root.querySelector<HTMLInputElement>("[data-et-sub-name]");
  const amountEl = root.querySelector<HTMLInputElement>("[data-et-sub-amount]");
  const cycleEl = root.querySelector<HTMLSelectElement>("[data-et-sub-cycle]");
  const catEl = root.querySelector<HTMLSelectElement>("[data-et-sub-category]");
  const billEl = root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]");
  const activeEl = root.querySelector<HTMLInputElement>("[data-et-sub-active]");
  const tagsEl = root.querySelector<HTMLInputElement>("[data-et-sub-tags]");
  const notesEl = root.querySelector<HTMLTextAreaElement>("[data-et-sub-notes]");
  if (!idEl || !nameEl || !amountEl || !cycleEl || !catEl || !billEl || !activeEl || !tagsEl || !notesEl) return;
  const name = nameEl.value.trim();
  const amount = Number(amountEl.value);
  if (!name || !Number.isFinite(amount)) return;

  const state = deps.getState();
  const prev = state.subscriptions.find((s) => s.id === idEl.value);
  const cycRaw = cycleEl.value;
  const cycle = (["weekly", "monthly", "quarterly", "yearly"] as const).includes(cycRaw as SubscriptionRow["cycle"])
    ? (cycRaw as SubscriptionRow["cycle"])
    : "monthly";
  const tags = deps.parseTags(tagsEl.value);
  deps.pushTagBankFrom(tags);
  const cardColor = parseCardColor(root.querySelector<HTMLInputElement>("[data-et-sub-color]")?.value);
  const billingRaw = readDateFieldValue(billEl);
  const billingStartDate = billingRaw.length === 10 ? billingRaw : undefined;
  const trialEnabled = root.querySelector<HTMLInputElement>("[data-et-sub-trial-enabled]")?.checked;
  const trialAmountRaw = Number(root.querySelector<HTMLInputElement>("[data-et-sub-trial-amount]")?.value);
  const trialEndRaw = readDateFieldValue(root.querySelector<HTMLInputElement>("[data-et-sub-trial-ends]"));
  const reminderRaw = Number(root.querySelector<HTMLInputElement>("[data-et-sub-reminder-days]")?.value);
  const brandManual = root.querySelector<HTMLInputElement>("[data-et-sub-brand-key]")?.value?.trim();

  const row: SubscriptionRow = {
    id: idEl.value || deps.makeId(),
    name,
    amount,
    currency: "EUR",
    cycle,
    categoryId: catEl.value,
    billingStartDate,
    nextBilling: "",
    active: activeEl.checked,
    cancelEffectiveDate: activeEl.checked ? prev?.cancelEffectiveDate : undefined,
    notes: notesEl.value.trim(),
    tags,
    cardColor,
    brandKey: brandManual || resolveSubscriptionBrandKey(name),
    trialAmount:
      trialEnabled && trialEndRaw.length === 10 && Number.isFinite(trialAmountRaw) ? Math.max(0, trialAmountRaw) : undefined,
    trialEndsOn: trialEnabled && trialEndRaw.length === 10 ? trialEndRaw : undefined,
    reminderDaysBefore:
      Number.isFinite(reminderRaw) && reminderRaw >= 0 ? Math.min(60, Math.floor(reminderRaw)) : undefined,
  };
  row.nextBilling = subscriptionNextChargeIso(row);
  if (!activeEl.checked) {
    row.cancelEffectiveDate = undefined;
  } else if (prev?.cancelEffectiveDate) {
    row.cancelEffectiveDate = row.nextBilling.slice(0, 10);
  }

  const list = [...state.subscriptions];
  const idx = list.findIndex((s) => s.id === row.id);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  deps.setState({ ...state, subscriptions: list });
  root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close();
  deps.persist();
  deps.renderAll(root);
}

function deleteSubFromDialog(root: HTMLElement, deps: SubUiDeps) {
  void (async () => {
    if (!editingSubId) return;
    if (!(await deps.showConfirmDialog(root, "¿Seguro que quieres eliminar esta suscripción?", "Eliminar"))) return;
    const state = deps.getState();
    deps.setState({ ...state, subscriptions: state.subscriptions.filter((s) => s.id !== editingSubId) });
    root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close();
    deps.persist();
    deps.renderAll(root);
  })();
}

function applyTrialDuration(root: HTMLElement, months: number, deps: SubUiDeps) {
  const trialEnabled = root.querySelector<HTMLInputElement>("[data-et-sub-trial-enabled]");
  const trialEnds = root.querySelector<HTMLInputElement>("[data-et-sub-trial-ends]");
  const billEl = root.querySelector<HTMLInputElement>("[data-et-sub-billing-start]");
  if (!trialEnabled || !trialEnds || !billEl) return;
  trialEnabled.checked = true;
  syncTrialFieldsVisibility(root);
  const start = readDateFieldValue(billEl) || deps.todayIso();
  const end = addMonthsToIso(start, months);
  trialEnds.value = end;
  refreshExpenseDatePicker(trialEnds, end);
  updateSubDialogPreview(root, deps);
}

export function bindSubsUi(root: HTMLElement, deps: SubUiDeps) {
  const strip = root.querySelector<HTMLElement>("[data-et-subs-strip]");
  if (strip && strip.dataset.stripBound !== "1") {
    strip.dataset.stripBound = "1";
    strip.addEventListener("click", (e) => {
      const cancelBtn = (e.target as HTMLElement).closest("button[data-sub-cancel]");
      if (cancelBtn) {
        e.stopPropagation();
        const id = cancelBtn.getAttribute("data-sub-cancel");
        const state = deps.getState();
        const idx = state.subscriptions.findIndex((x) => x.id === id);
        if (idx < 0) return;
        const s = state.subscriptions[idx]!;
        const next =
          !s.active
            ? { ...s, active: true, cancelEffectiveDate: undefined }
            : s.cancelEffectiveDate
              ? { ...s, cancelEffectiveDate: undefined }
              : scheduleSubscriptionCancel(s);
        const list = [...state.subscriptions];
        list[idx] = next;
        deps.setState({ ...state, subscriptions: list });
        deps.persist();
        deps.renderAll(root);
        return;
      }
      const editBtn = (e.target as HTMLElement).closest("button[data-sub-edit]");
      if (!editBtn) return;
      const id = editBtn.getAttribute("data-sub-edit");
      const s = deps.getState().subscriptions.find((x) => x.id === id);
      if (s) openSubDialog(root, deps, s);
    });
  }

  if (root.dataset.etSubsDialogBound === "1") return;
  root.dataset.etSubsDialogBound = "1";

  root.querySelectorAll<HTMLButtonElement>("[data-et-open-sub-modal]").forEach((btn) =>
    btn.addEventListener("click", () => openSubDialog(root, deps, null)),
  );
  root.querySelector<HTMLButtonElement>("[data-et-sub-close]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-sub-cancel]")?.addEventListener("click", () =>
    root.querySelector<HTMLDialogElement>("[data-et-sub-dialog]")?.close(),
  );
  root.querySelector<HTMLButtonElement>("[data-et-sub-save]")?.addEventListener("click", () =>
    saveSubFromDialog(root, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-sub-delete]")?.addEventListener("click", () =>
    deleteSubFromDialog(root, deps),
  );

  const form = root.querySelector<HTMLElement>("[data-et-sub-form]");
  form?.addEventListener("input", () => updateSubDialogPreview(root, deps));
  form?.addEventListener("change", () => updateSubDialogPreview(root, deps));

  root.querySelector<HTMLInputElement>("[data-et-sub-trial-enabled]")?.addEventListener("change", () => {
    syncTrialFieldsVisibility(root);
    updateSubDialogPreview(root, deps);
  });

  root.querySelector<HTMLInputElement>("[data-et-sub-name]")?.addEventListener("input", () => {
    const manual = root.querySelector<HTMLInputElement>("[data-et-sub-brand-key]")?.value?.trim();
    if (!manual) {
      const name = root.querySelector<HTMLInputElement>("[data-et-sub-name]")?.value ?? "";
      const key = resolveSubscriptionBrandKey(name);
      const colorEl = root.querySelector<HTMLInputElement>("[data-et-sub-color]");
      if (key && colorEl && !root.querySelector<HTMLInputElement>("[data-et-sub-id]")?.value) {
        colorEl.value = subscriptionBrandAccent(key, colorEl.value);
      }
    }
  });

  root.querySelector<HTMLElement>("[data-et-sub-brand-grid]")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".et-sub-brand-pick");
    if (!btn) return;
    const key = btn.dataset.brandKey ?? "";
    root.querySelector<HTMLInputElement>("[data-et-sub-brand-key]")!.value = key;
    root.querySelectorAll(".et-sub-brand-pick").forEach((el) => el.classList.remove("et-sub-brand-pick--on"));
    btn.classList.add("et-sub-brand-pick--on");
    if (key) {
      const colorEl = root.querySelector<HTMLInputElement>("[data-et-sub-color]");
      if (colorEl) colorEl.value = subscriptionBrandAccent(key, colorEl.value);
    }
    updateSubDialogPreview(root, deps);
  });

  root.querySelector<HTMLButtonElement>("[data-et-sub-trial-1m]")?.addEventListener("click", () =>
    applyTrialDuration(root, 1, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-sub-trial-3m]")?.addEventListener("click", () =>
    applyTrialDuration(root, 3, deps),
  );
  root.querySelector<HTMLButtonElement>("[data-et-sub-trial-6m]")?.addEventListener("click", () =>
    applyTrialDuration(root, 6, deps),
  );
}
