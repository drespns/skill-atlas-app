export type WealthAccountBrand = {
  key: string;
  label: string;
  aliases: string[];
  accent?: string;
};

/** Catálogo bancos/brokers; logos en `/static/bank-brands/{key}.svg`. */
export const WEALTH_ACCOUNT_BRAND_CATALOG: WealthAccountBrand[] = [
  { key: "bitvavo", label: "Bitvavo", aliases: ["bitvavo"], accent: "#0051FF" },
  { key: "santander", label: "Santander", aliases: ["santander"], accent: "#EC0000" },
  { key: "imagin", label: "Imagin", aliases: ["imagin", "imaginbank"], accent: "#019DF4" },
  { key: "caixabank", label: "CaixaBank", aliases: ["caixabank", "la caixa", "caixa"], accent: "#007EAE" },
  { key: "ing", label: "ING", aliases: ["ing"], accent: "#FF6200" },
  { key: "traderepublic", label: "Trade Republic", aliases: ["trade republic", "traderepublic"], accent: "#111111" },
  { key: "revolut", label: "Revolut", aliases: ["revolut"], accent: "#0075EB" },
  { key: "bbva", label: "BBVA", aliases: ["bbva"], accent: "#004481" },
  { key: "sabadell", label: "Sabadell", aliases: ["sabadell", "banco sabadell"], accent: "#006CB5" },
  { key: "openbank", label: "Openbank", aliases: ["openbank"], accent: "#002855" },
  { key: "n26", label: "N26", aliases: ["n26"], accent: "#36A18B" },
  { key: "wise", label: "Wise", aliases: ["wise", "transferwise"], accent: "#9FE870" },
  { key: "degiro", label: "DEGIRO", aliases: ["degiro"], accent: "#009FDF" },
  { key: "ibkr", label: "Interactive Brokers", aliases: ["interactive brokers", "ibkr"], accent: "#D81E05" },
  { key: "unicaja", label: "Unicaja", aliases: ["unicaja"], accent: "#008752" },
  { key: "bankinter", label: "Bankinter", aliases: ["bankinter"], accent: "#FF6600" },
  { key: "kutxabank", label: "Kutxabank", aliases: ["kutxabank"], accent: "#009639" },
  { key: "abanca", label: "Abanca", aliases: ["abanca"], accent: "#005596" },
  { key: "cajamar", label: "Cajamar", aliases: ["cajamar"], accent: "#008265" },
  { key: "myinvestor", label: "MyInvestor", aliases: ["myinvestor", "my investor"], accent: "#003366" },
];

function normalizeBrandText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function wealthAccountBrandLogoPath(key: string, ext: "svg" | "png" = "svg"): string {
  return `/static/bank-brands/${key}.${ext}`;
}

export function resolveWealthAccountBrandKey(name: string, explicit?: string): string | undefined {
  const manual = explicit?.trim();
  if (manual && WEALTH_ACCOUNT_BRAND_CATALOG.some((b) => b.key === manual)) return manual;
  const norm = normalizeBrandText(name);
  if (!norm) return undefined;
  for (const brand of WEALTH_ACCOUNT_BRAND_CATALOG) {
    if (brand.aliases.some((a) => norm === a || norm.includes(a) || a.includes(norm))) return brand.key;
  }
  return undefined;
}

export function getWealthAccountBrand(key?: string): WealthAccountBrand | undefined {
  if (!key) return undefined;
  return WEALTH_ACCOUNT_BRAND_CATALOG.find((b) => b.key === key);
}

export function wealthAccountBrandAccent(key?: string, fallback = "#6366f1"): string {
  return getWealthAccountBrand(key)?.accent ?? fallback;
}
