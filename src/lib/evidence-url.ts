/**
 * Heurísticas para detectar el tipo de URL de una evidencia (preview + sugerencia iframe/link).
 * No sustituye la elección del usuario; solo orienta la UX.
 */

export type EvidenceUrlDetection = {
  /** Clave estable para tests / lógica */
  sourceKey: string;
  /** Etiqueta legible (ES) para chips y modales */
  sourceLabel: string;
  suggestedKind: "iframe" | "link";
  /** Texto corto bajo el campo URL */
  hint: string;
};

function hostOf(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function detectEvidenceUrl(raw: string): EvidenceUrlDetection {
  const t = raw.trim();
  if (!t) {
    return {
      sourceKey: "empty",
      sourceLabel: "Sin URL",
      suggestedKind: "link",
      hint: "Pega una URL pública (Tableau Public, GitHub, Power BI en la web, etc.).",
    };
  }

  const host = hostOf(t);
  if (!host) {
    return {
      sourceKey: "invalid",
      sourceLabel: "URL no válida",
      suggestedKind: "link",
      hint: "Introduce una URL completa que empiece por https://",
    };
  }

  if (host === "github.com" || host.endsWith(".github.com")) {
    return {
      sourceKey: "github",
      sourceLabel: "GitHub",
      suggestedKind: "link",
      hint: "Los repos suelen mostrarse mejor como enlace; el visitante abre GitHub en otra pestaña.",
    };
  }

  if (host.includes("tableau") || host === "public.tableau.com") {
    return {
      sourceKey: "tableau",
      sourceLabel: "Tableau",
      suggestedKind: "iframe",
      hint: "Tableau Public suele permitir iframe; si falla, cambia a «solo enlace».",
    };
  }

  if (host.includes("powerbi.com") || host.includes("app.powerbi.com")) {
    return {
      sourceKey: "powerbi",
      sourceLabel: "Power BI",
      suggestedKind: "iframe",
      hint: "El embed depende de permisos en el servicio; si no carga, usa enlace.",
    };
  }

  if (host.includes("lookerstudio.google.com") || host === "datastudio.google.com") {
    return {
      sourceKey: "looker",
      sourceLabel: "Looker Studio",
      suggestedKind: "iframe",
      hint: "Looker Studio a menudo permite informe embebido; revisa permisos de publicación.",
    };
  }

  if (host === "youtube.com" || host === "www.youtube.com" || host === "youtu.be") {
    return {
      sourceKey: "youtube",
      sourceLabel: "YouTube",
      suggestedKind: "iframe",
      hint: "Para vídeos, a veces conviene el enlace directo si el iframe da problemas.",
    };
  }

  if (host === "notion.so" || host.endsWith(".notion.so")) {
    return {
      sourceKey: "notion",
      sourceLabel: "Notion",
      suggestedKind: "link",
      hint: "Notion rara vez permite iframe público estable; suele ir mejor como enlace.",
    };
  }

  if (host === "observablehq.com" || host.endsWith(".observablehq.com")) {
    return {
      sourceKey: "observable",
      sourceLabel: "Observable",
      suggestedKind: "iframe",
      hint: "Notebook Observable: prueba iframe; si el sitio bloquea embed, usa enlace.",
    };
  }

  return {
    sourceKey: "generic",
    sourceLabel: "Enlace web",
    suggestedKind: "link",
    hint: "Origen no reconocido: por defecto «enlace». Cambia a iframe solo si sabes que el sitio lo permite.",
  };
}

/** Normaliza URL para iframes de Tableau Public (parámetros embed). */
export function normalizeTableauEmbedUrl(url: string): string {
  let next = url.replaceAll("&:redirect=auth", "").replaceAll("&:origin=viz_share_link", "");
  if (!next.includes(":showVizHome=no")) next += "&:showVizHome=no";
  if (!next.includes(":embed=yes")) next += "&:embed=yes";
  return next;
}

export function embedIframeSrc(url: string): string {
  const h = hostOf(url);
  if (h?.includes("tableau")) return normalizeTableauEmbedUrl(url);
  return url;
}

/** Icono del sitio para previews en lista/modal (sin peticiones propias al dominio del usuario). */
export function evidenceSiteIconUrl(url: string): string | null {
  const h = hostOf(url);
  if (!h) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=32`;
}
