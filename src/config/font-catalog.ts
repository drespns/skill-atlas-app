/**
 * Catálogo de fuentes para prefs (`font`). Las entradas con `googleQuery` cargan hoja de Google Fonts en runtime.
 */
export type FontCatalogEntry = {
  id: string;
  /** Valor de `font-family` (nombre entre comillas si hace falta). */
  stack: string;
  /** Parámetro `family` para `fonts.googleapis.com/css2?family=…` (sin URL-encode de `&`). */
  googleQuery?: string;
  /** Agrupa el selector en Ajustes. */
  category: "builtin" | "sans" | "serif" | "mono" | "display";
};

export const FONT_CATALOG: FontCatalogEntry[] = [
  { id: "system", stack: "var(--font-system)", category: "builtin" },
  { id: "serif", stack: "var(--font-serif)", category: "builtin" },
  { id: "mono", stack: "var(--font-mono)", category: "builtin" },
  {
    id: "inter",
    category: "sans",
    stack: '"Inter", var(--font-system)',
    googleQuery: "Inter:wght@400;500;600;700",
  },
  {
    id: "roboto",
    stack: '"Roboto", var(--font-system)',
    googleQuery: "Roboto:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "open-sans",
    stack: '"Open Sans", var(--font-system)',
    googleQuery: "Open+Sans:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "lato",
    stack: '"Lato", var(--font-system)',
    googleQuery: "Lato:wght@400;700",
    category: "sans",
  },
  {
    id: "poppins",
    stack: '"Poppins", var(--font-system)',
    googleQuery: "Poppins:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "nunito",
    stack: '"Nunito", var(--font-system)',
    googleQuery: "Nunito:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "nunito-sans",
    stack: '"Nunito Sans", var(--font-system)',
    googleQuery: "Nunito+Sans:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "work-sans",
    stack: '"Work Sans", var(--font-system)',
    googleQuery: "Work+Sans:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "source-sans-3",
    stack: '"Source Sans 3", var(--font-system)',
    googleQuery: "Source+Sans+3:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "dm-sans",
    stack: '"DM Sans", var(--font-system)',
    googleQuery: "DM+Sans:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "manrope",
    stack: '"Manrope", var(--font-system)',
    googleQuery: "Manrope:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "outfit",
    stack: '"Outfit", var(--font-system)',
    googleQuery: "Outfit:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "plus-jakarta-sans",
    stack: '"Plus Jakarta Sans", var(--font-system)',
    googleQuery: "Plus+Jakarta+Sans:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "montserrat",
    stack: '"Montserrat", var(--font-system)',
    googleQuery: "Montserrat:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "raleway",
    stack: '"Raleway", var(--font-system)',
    googleQuery: "Raleway:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "rubik",
    stack: '"Rubik", var(--font-system)',
    googleQuery: "Rubik:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "ubuntu",
    stack: '"Ubuntu", var(--font-system)',
    googleQuery: "Ubuntu:wght@400;500;700",
    category: "sans",
  },
  {
    id: "sen",
    stack: '"Sen", var(--font-system)',
    googleQuery: "Sen:wght@400;500;600;700",
    category: "sans",
  },
  {
    id: "sekuya",
    stack: '"Sekuya", var(--font-system)',
    googleQuery: "Sekuya:wght@400",
    category: "sans",
  },
  {
    id: "merriweather",
    stack: '"Merriweather", var(--font-serif)',
    googleQuery: "Merriweather:wght@400;700",
    category: "serif",
  },
  {
    id: "lora",
    stack: '"Lora", var(--font-serif)',
    googleQuery: "Lora:wght@400;500;600;700",
    category: "serif",
  },
  {
    id: "source-serif-4",
    stack: '"Source Serif 4", var(--font-serif)',
    googleQuery: "Source+Serif+4:wght@400;500;600;700",
    category: "serif",
  },
  {
    id: "playfair-display",
    stack: '"Playfair Display", var(--font-serif)',
    googleQuery: "Playfair+Display:wght@400;500;600;700",
    category: "serif",
  },
  {
    id: "libre-baskerville",
    stack: '"Libre Baskerville", var(--font-serif)',
    googleQuery: "Libre+Baskerville:wght@400;700",
    category: "serif",
  },
  {
    id: "fira-code",
    stack: '"Fira Code", var(--font-mono)',
    googleQuery: "Fira+Code:wght@400;500;600;700",
    category: "mono",
  },
  {
    id: "jetbrains-mono",
    stack: '"JetBrains Mono", var(--font-mono)',
    googleQuery: "JetBrains+Mono:wght@400;500;600;700",
    category: "mono",
  },
  {
    id: "ibm-plex-mono",
    stack: '"IBM Plex Mono", var(--font-mono)',
    googleQuery: "IBM+Plex+Mono:wght@400;500;600;700",
    category: "mono",
  },
  {
    id: "space-mono",
    stack: '"Space Mono", var(--font-mono)',
    googleQuery: "Space+Mono:wght@400;700",
    category: "mono",
  },
  {
    id: "sedgwick-ave-display",
    stack: '"Sedgwick Ave Display", var(--font-system)',
    googleQuery: "Sedgwick+Ave+Display:wght@400",
    category: "display",
  },
  {
    id: "sedgwick-ave",
    stack: '"Sedgwick Ave", var(--font-system)',
    googleQuery: "Sedgwick+Ave:wght@400",
    category: "display",
  },
];

const FONT_BY_ID = new Map(FONT_CATALOG.map((e) => [e.id, e]));

export function getFontEntry(id: string): FontCatalogEntry {
  return FONT_BY_ID.get(id) ?? FONT_BY_ID.get("system")!;
}

export function isValidFontId(v: string): boolean {
  return FONT_BY_ID.has(v);
}

/** Normaliza prefs antiguas y valores desconocidos. */
export function normalizeFontId(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "system";
  const id = raw.trim();
  if (isValidFontId(id)) return id;
  const legacy: Record<string, string> = {
    inter: "inter",
    mono: "mono",
    serif: "serif",
    system: "system",
  };
  return legacy[id] ?? "system";
}

export const FONT_GOOGLE_LINK_ID = "skillatlas-google-font";

/** Id para el `<link>` que carga todas las familias del catálogo (previsualización en el selector de Ajustes). */
export const FONT_GOOGLE_CATALOG_PREVIEW_LINK_ID = "skillatlas-google-font-catalog-preview";

/**
 * Una sola petición CSS con todas las familias del catálogo (Google Fonts) para que el desplegable
 * pueda pintar cada opción con su `font-family`.
 */
export function googleFontsCatalogPreviewHref(): string {
  const families = FONT_CATALOG.map((e) => e.googleQuery).filter((q): q is string => Boolean(q));
  if (families.length === 0) return "";
  const q = families.map((f) => `family=${encodeURIComponent(f)}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/** Valor `style` del `<option>` para previsualizar la fuente (comillas simples en nombres para no romper el atributo HTML). */
export function fontOptionStyle(entry: FontCatalogEntry): string {
  return `font-family: ${entry.stack.replace(/"/g, "'")}`;
}

const FONT_LABEL_OVERRIDES: Record<string, string> = {
  system: "Sistema",
  serif: "Serif (sistema)",
  mono: "Monospace (sistema)",
  "open-sans": "Open Sans",
  "dm-sans": "DM Sans",
  "nunito-sans": "Nunito Sans",
  "work-sans": "Work Sans",
  "source-sans-3": "Source Sans 3",
  "plus-jakarta-sans": "Plus Jakarta Sans",
  "ibm-plex-mono": "IBM Plex Mono",
  "jetbrains-mono": "JetBrains Mono",
  "fira-code": "Fira Code",
  "space-mono": "Space Mono",
  "source-serif-4": "Source Serif 4",
  "playfair-display": "Playfair Display",
  "libre-baskerville": "Libre Baskerville",
  sekuya: "Sekuya",
  sen: "Sen",
  "sedgwick-ave-display": "Sedgwick Ave Display",
  "sedgwick-ave": "Sedgwick Ave",
};

/** Texto en el selector de Ajustes (español / nombres propios). */
export function fontDisplayLabel(entry: FontCatalogEntry): string {
  if (FONT_LABEL_OVERRIDES[entry.id]) return FONT_LABEL_OVERRIDES[entry.id]!;
  return entry.id
    .split("-")
    .map((w) => (w === "3" || w === "4" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Aplica fuente global: hoja opcional de Google Fonts + `--app-font-family`. */
export function applyFontToDocument(fontId: string): void {
  const entry = getFontEntry(fontId);
  const root = document.documentElement;
  root.dataset.font = fontId;

  const href =
    entry.googleQuery != null
      ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(entry.googleQuery)}&display=swap`
      : null;

  let link = document.getElementById(FONT_GOOGLE_LINK_ID) as HTMLLinkElement | null;
  if (href) {
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_GOOGLE_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  } else {
    link?.remove();
  }

  root.style.setProperty("--app-font-family", entry.stack);
}
