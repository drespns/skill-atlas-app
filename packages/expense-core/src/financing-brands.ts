export type FinancingBrand = {
  key: string;
  label: string;
  aliases: string[];
  accent?: string;
};

/** Catálogo BNPL / financiación; logos en `/static/financing-brands/{key}.svg`. */
export const FINANCING_BRAND_CATALOG: FinancingBrand[] = [
  { key: "klarna", label: "Klarna", aliases: ["klarna"], accent: "#FFB3C7" },
  { key: "sequra", label: "Sequra", aliases: ["sequra"], accent: "#00D4AA" },
  { key: "paypal", label: "PayPal", aliases: ["paypal", "pay pal"], accent: "#003087" },
];

function normalizeBrandText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function financingBrandLogoPath(key: string, ext: "svg" | "png" = "svg"): string {
  return `/static/financing-brands/${key}.${ext}`;
}

export function resolveFinancingBrandKey(name: string, explicit?: string): string | undefined {
  const manual = explicit?.trim();
  if (manual && FINANCING_BRAND_CATALOG.some((b) => b.key === manual)) return manual;
  const norm = normalizeBrandText(name);
  if (!norm) return undefined;
  for (const brand of FINANCING_BRAND_CATALOG) {
    if (brand.aliases.some((a) => norm === a || norm.includes(a) || a.includes(norm))) return brand.key;
  }
  return undefined;
}

export function getFinancingBrand(key?: string): FinancingBrand | undefined {
  if (!key) return undefined;
  return FINANCING_BRAND_CATALOG.find((b) => b.key === key);
}

export function financingBrandAccent(key?: string, fallback = "#6366f1"): string {
  return getFinancingBrand(key)?.accent ?? fallback;
}
