function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-salary-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const gross = root.querySelector<HTMLInputElement>("[data-sal-gross]");
  const tax = root.querySelector<HTMLInputElement>("[data-sal-tax]");
  const taxVal = root.querySelector<HTMLElement>("[data-sal-tax-val]");
  const period = root.querySelector<HTMLSelectElement>("[data-sal-period]");
  const outNet = root.querySelector<HTMLElement>("[data-sal-net]");
  const outYear = root.querySelector<HTMLElement>("[data-sal-year]");

  const run = () => {
    const g = Number((gross?.value ?? "").replace(",", ".")) || 0;
    const t = Math.min(80, Math.max(0, Number(tax?.value) || 0));
    if (taxVal) taxVal.textContent = String(t);
    const monthlyGross = period?.value === "year" ? g / 12 : g;
    const netMonthly = monthlyGross * (1 - t / 100);
    const netAnnual = netMonthly * 12;
    if (outNet) outNet.textContent = fmt(netMonthly);
    if (outYear) outYear.textContent = fmt(netAnnual);
  };

  gross?.addEventListener("input", run);
  tax?.addEventListener("input", run);
  period?.addEventListener("change", run);
  run();
}

init();
