const LANG_ES_PICKER_SESSION_KEY = "skillatlas_lang_es_picker";

/** Id de fila del picker (`lang-picker-options`) para variantes de español. */
export function inferSpanishPickerId(): string {
  try {
    const nav = (navigator.language || "").toLowerCase();
    if (nav === "es-es" || nav.endsWith("-es")) return "es";
    if (nav === "es-mx" || nav.endsWith("-mx")) return "es_mx";
    if (nav === "es-ar" || nav.endsWith("-ar")) return "es_ar";
    if (nav === "es-cl" || nav.endsWith("-cl")) return "es_cl";
    if (nav === "es-ec" || nav.endsWith("-ec")) return "es_ec";
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz === "string") {
      if (tz === "Europe/Madrid") return "es";
      if (tz === "America/Mexico_City") return "es_mx";
      if (tz === "America/Argentina/Buenos_Aires") return "es_ar";
      if (tz === "America/Santiago") return "es_cl";
      if (tz === "America/Guayaquil") return "es_ec";
    }
  } catch {
    // ignore
  }
  return "es_mx";
}

/** Variante ES activa: sesión (si el usuario eligió una fila) o inferencia. */
export function resolveSpanishPickerId(): string {
  try {
    const v = sessionStorage.getItem(LANG_ES_PICKER_SESSION_KEY);
    if (v && /^es($|_)/.test(v)) return v;
  } catch {
    // ignore
  }
  return inferSpanishPickerId();
}

export function setSpanishPickerSessionId(id: string): void {
  if (!/^es($|_)/.test(id)) return;
  try {
    sessionStorage.setItem(LANG_ES_PICKER_SESSION_KEY, id);
  } catch {
    // ignore
  }
}

export function clearSpanishPickerSession(): void {
  try {
    sessionStorage.removeItem(LANG_ES_PICKER_SESSION_KEY);
  } catch {
    // ignore
  }
}
