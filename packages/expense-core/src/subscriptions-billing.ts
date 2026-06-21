import type { SubscriptionRow } from "./state";

export type SubscriptionBillingPhase = "trial" | "regular";

export type SubscriptionBillingSnapshot = {
  phase: SubscriptionBillingPhase;
  /** Importe del ciclo actual (trial o regular). */
  cycleAmount: number;
  /** Próximo cobro relevante (fin de prueba o siguiente cargo). */
  nextChargeIso: string;
  /** Fecha en la que empieza el precio regular (fin de prueba). */
  regularStartsOn?: string;
};

function parseYmd(iso: string): Date | null {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function advanceBillingDate(from: Date, cycle: SubscriptionRow["cycle"]): Date {
  const x = new Date(from);
  x.setHours(12, 0, 0, 0);
  if (cycle === "weekly") x.setDate(x.getDate() + 7);
  else if (cycle === "monthly") x.setMonth(x.getMonth() + 1);
  else if (cycle === "quarterly") x.setMonth(x.getMonth() + 3);
  else if (cycle === "yearly") x.setFullYear(x.getFullYear() + 1);
  return x;
}

function nextChargeFromAnchor(s: SubscriptionRow, anchorIso: string, refDate?: string): string {
  const anchor = parseYmd(anchorIso);
  if (!anchor) return (s.nextBilling || "").slice(0, 10);
  const today = parseYmd(refDate ?? new Date().toISOString().slice(0, 10)) ?? new Date();
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

export function isSubscriptionInTrial(s: SubscriptionRow, refDate?: string): boolean {
  const today = (refDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const end = s.trialEndsOn?.trim().slice(0, 10);
  return Boolean(end && end.length === 10 && today < end);
}

export function subscriptionBillingSnapshot(s: SubscriptionRow, refDate?: string): SubscriptionBillingSnapshot {
  const today = (refDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const trialEnd = s.trialEndsOn?.trim().slice(0, 10);
  if (trialEnd && trialEnd.length === 10 && today < trialEnd) {
    return {
      phase: "trial",
      cycleAmount: s.trialAmount ?? 0,
      nextChargeIso: trialEnd,
      regularStartsOn: trialEnd,
    };
  }
  const anchor =
    (trialEnd && today >= trialEnd ? trialEnd : undefined) ??
    s.billingStartDate?.trim().slice(0, 10) ??
    "";
  const nextChargeIso = anchor.length === 10 ? nextChargeFromAnchor(s, anchor, today) : (s.nextBilling || "").slice(0, 10);
  return {
    phase: "regular",
    cycleAmount: s.amount,
    nextChargeIso,
    regularStartsOn: trialEnd && today >= trialEnd ? trialEnd : undefined,
  };
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addMonthsToIso(iso: string, months: number): string {
  const d = parseYmd(iso);
  if (!d) return iso.slice(0, 10);
  d.setMonth(d.getMonth() + months);
  return formatLocalYmd(d);
}
