export type SubscriptionBrand = {
  key: string;
  label: string;
  /** Aliases normalizados (minúsculas, sin acentos) para auto-detectar desde el nombre. */
  aliases: string[];
  /** Color de acento por defecto (#RRGGBB). */
  accent?: string;
};

/** Catálogo curado; el logo vive en `/static/subscription-brands/{key}.svg` (o .png). */
export const SUBSCRIPTION_BRAND_CATALOG: SubscriptionBrand[] = [
  { key: "spotify", label: "Spotify", aliases: ["spotify", "spotify premium", "spotify individual", "spotify familiar"], accent: "#1DB954" },
  { key: "movistar-plus", label: "Movistar+", aliases: ["movistar+", "movistar plus", "movistar"], accent: "#019DF4" },
  { key: "netflix", label: "Netflix", aliases: ["netflix"], accent: "#E50914" },
  { key: "disney-plus", label: "Disney+", aliases: ["disney+", "disney plus"], accent: "#113CCF" },
  { key: "amazon-prime", label: "Prime Video", aliases: ["prime video", "amazon prime", "prime"], accent: "#00A8E1" },
  { key: "youtube-premium", label: "YouTube Premium", aliases: ["youtube premium", "youtube", "yt premium"], accent: "#FF0000" },
  { key: "apple-one", label: "Apple One", aliases: ["apple one", "icloud", "apple icloud", "apple music"], accent: "#555555" },
  { key: "chatgpt", label: "ChatGPT", aliases: ["chatgpt", "openai", "chatgpt plus"], accent: "#10A37F" },
  { key: "adobe", label: "Adobe", aliases: ["adobe", "creative cloud", "adobe cc"], accent: "#FF0000" },
  { key: "github", label: "GitHub", aliases: ["github"], accent: "#24292F" },
  { key: "microsoft-365", label: "Microsoft 365", aliases: ["microsoft 365", "office 365", "microsoft office"], accent: "#D83B01" },
  { key: "hbo-max", label: "Max", aliases: ["max", "hbo max", "hbo"], accent: "#B535F6" },
  { key: "crunchyroll", label: "Crunchyroll", aliases: ["crunchyroll"], accent: "#F47521" },
  { key: "dazn", label: "DAZN", aliases: ["dazn"], accent: "#F8F8F5" },
  { key: "dropbox", label: "Dropbox", aliases: ["dropbox"], accent: "#0061FF" },
  { key: "notion", label: "Notion", aliases: ["notion"], accent: "#000000" },
  { key: "cursor", label: "Cursor", aliases: ["cursor", "cursor pro", "cursor ai"], accent: "#000000" },
];

function normalizeBrandText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\+/g, "+")
    .replace(/\s+/g, " ");
}

export function subscriptionBrandLogoPath(key: string, ext: "svg" | "png" | "webp" = "svg"): string {
  return `/static/subscription-brands/${key}.${ext}`;
}

export function resolveSubscriptionBrandKey(name: string, explicit?: string): string | undefined {
  const manual = explicit?.trim();
  if (manual && SUBSCRIPTION_BRAND_CATALOG.some((b) => b.key === manual)) return manual;
  const norm = normalizeBrandText(name);
  if (!norm) return undefined;
  for (const brand of SUBSCRIPTION_BRAND_CATALOG) {
    if (brand.aliases.some((a) => norm === a || norm.includes(a) || a.includes(norm))) return brand.key;
  }
  return undefined;
}

export function getSubscriptionBrand(key?: string): SubscriptionBrand | undefined {
  if (!key) return undefined;
  return SUBSCRIPTION_BRAND_CATALOG.find((b) => b.key === key);
}

export function subscriptionBrandAccent(key?: string, fallback = "#6366f1"): string {
  return getSubscriptionBrand(key)?.accent ?? fallback;
}
