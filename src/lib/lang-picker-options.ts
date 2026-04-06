/**
 * Opciones mostradas en el modal de idioma (cabecera).
 * `flag` es el nombre de archivo en `public/icons/flags/` (sin `.svg`).
 */
export type LangPickerOption = {
  id: string;
  flag: string;
  label: string;
};

/** Orden fijo: variantes de español, luego inglés y otras lenguas con bandera disponible. */
export const LANG_PICKER_OPTIONS: LangPickerOption[] = [
  { id: "es", flag: "Spain", label: "Español (España)" },
  { id: "es_mx", flag: "Mexico", label: "Español (México)" },
  { id: "es_ar", flag: "Argentina", label: "Español (Argentina)" },
  { id: "es_cl", flag: "Chile", label: "Español (Chile)" },
  { id: "es_ec", flag: "Ecuador", label: "Español (Ecuador)" },
  { id: "en", flag: "United_Kingdom", label: "English (UK)" },
  { id: "en_us", flag: "United_States", label: "English (US)" },
  { id: "fr", flag: "France", label: "Français" },
  { id: "de", flag: "Germany", label: "Deutsch" },
  { id: "it", flag: "Italy", label: "Italiano" },
  { id: "pt", flag: "Portugal", label: "Português (Portugal)" },
  { id: "pt_br", flag: "Brazil", label: "Português (Brasil)" },
];

/** `null` = fila aún no traducida (deshabilitada en el picker). */
export function mapPickerOptionIdToUiLang(id: string): "es" | "en" | null {
  if (id === "en" || id === "en_us") return "en";
  if (id === "es" || id.startsWith("es_")) return "es";
  return null;
}

/** Fila EN “activa” para estado visual (UK vs US). */
export function preferEnglishPickerId(): "en" | "en_us" {
  try {
    const nav = (navigator.language || "").toLowerCase();
    if (nav === "en-us" || nav.endsWith("-us")) return "en_us";
  } catch {
    // ignore
  }
  return "en";
}
