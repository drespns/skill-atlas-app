/**
 * Toggle mensual / anual en /pricing.
 * Delegación de clics en document (View Transitions).
 * Precios se reformatean al cambiar idioma vía `skillatlas:ui-lang-changed`.
 */
function fmtEur(amount: number) {
  const lng = document.documentElement.lang?.toLowerCase().startsWith("en") ? "en-GB" : "es-ES";
  return new Intl.NumberFormat(lng, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function setBillingSegmentStyle(btn: HTMLButtonElement | null, selected: boolean) {
  if (!btn) return;
  const base =
    "rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 min-w-[6.25rem] motion-reduce:transition-none";
  if (selected) {
    btn.className =
      `${base} relative z-10 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ` +
      `shadow-sm ` +
      `ring-2 ring-indigo-500 dark:ring-indigo-400 ` +
      `border border-indigo-500/60 dark:border-indigo-400/55`;
  } else {
    btn.className =
      `${base} relative z-0 bg-transparent text-gray-500 dark:text-gray-400 ` +
      `shadow-none ring-0 border border-transparent ` +
      `hover:bg-white/60 dark:hover:bg-gray-800/60 hover:text-gray-800 dark:hover:text-gray-200`;
  }
}

function apply(root: HTMLElement, period: "month" | "year") {
  root.dataset.billing = period;

  const btnMonth = root.querySelector<HTMLButtonElement>('[data-pricing-period="month"]');
  const btnYear = root.querySelector<HTMLButtonElement>('[data-pricing-period="year"]');
  const cards = root.querySelectorAll<HTMLElement>("[data-pricing-card]");

  btnMonth?.setAttribute("aria-pressed", period === "month" ? "true" : "false");
  btnYear?.setAttribute("aria-pressed", period === "year" ? "true" : "false");

  setBillingSegmentStyle(btnMonth, period === "month");
  setBillingSegmentStyle(btnYear, period === "year");

  for (const card of cards) {
    const m = Number(card.getAttribute("data-price-month") ?? "0");
    const y = Number(card.getAttribute("data-price-year") ?? "0");
    const amountEl = card.querySelector<HTMLElement>("[data-pricing-amount]");
    if (amountEl) {
      if (period === "month") {
        amountEl.textContent = fmtEur(m);
      } else {
        amountEl.textContent = m === 0 && y === 0 ? fmtEur(0) : fmtEur(y);
      }
    }
    card.querySelectorAll<HTMLElement>("[data-show-on]").forEach((el) => {
      const on = el.getAttribute("data-show-on");
      el.classList.toggle("hidden", on !== period);
    });
  }
}

function billingFromDataset(root: HTMLElement): "month" | "year" {
  return root.dataset.billing === "year" ? "year" : "month";
}

function onDocClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-pricing-period]");
  if (!btn) return;
  const root = btn.closest<HTMLElement>("[data-pricing-page]");
  if (!root) return;
  const p = btn.getAttribute("data-pricing-period");
  if (p !== "month" && p !== "year") return;
  apply(root, p);
}

if (!(window as unknown as { __skillatlasPricingDocClick?: boolean }).__skillatlasPricingDocClick) {
  (window as unknown as { __skillatlasPricingDocClick?: boolean }).__skillatlasPricingDocClick = true;
  document.addEventListener("click", onDocClick);
}

if (!(window as unknown as { __skillatlasPricingLang?: boolean }).__skillatlasPricingLang) {
  (window as unknown as { __skillatlasPricingLang?: boolean }).__skillatlasPricingLang = true;
  window.addEventListener("skillatlas:ui-lang-changed", () => {
    document.querySelectorAll<HTMLElement>("[data-pricing-page]").forEach((root) => {
      apply(root, billingFromDataset(root));
    });
  });
}

function boot() {
  document.querySelectorAll<HTMLElement>("[data-pricing-page]").forEach((root) => {
    if (!root.dataset.billing) root.dataset.billing = "month";
    apply(root, billingFromDataset(root));
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot());
else boot();

document.addEventListener("astro:page-load", () => boot());
document.addEventListener("astro:after-swap", () => boot());
