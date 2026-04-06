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

/**
 * Dominios donde no debemos usar iframe (X-Frame-Options / UX): GitHub y derivados.
 * Oleada A del roadmap portfolio/evidencias.
 */
export function evidenceUrlBlocksIframe(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const h = host.toLowerCase();
  if (h === "github.com" || h.endsWith(".github.com")) return true;
  if (h.endsWith(".github.io")) return true;
  if (h.endsWith(".githubusercontent.com")) return true;
  return false;
}

/** Fuerza «solo enlace» aunque en BD venga kind iframe (datos viejos o elección manual). */
export function coerceEvidenceDisplayKind(url: string, stored: "iframe" | "link"): "iframe" | "link" {
  if (evidenceUrlBlocksIframe(url)) return "link";
  return stored;
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
      hint: "GitHub no permite iframe fiable: siempre como enlace (también si guardaras «embebido»).",
    };
  }

  if (host.endsWith(".github.io")) {
    return {
      sourceKey: "github_pages",
      sourceLabel: "GitHub Pages",
      suggestedKind: "link",
      hint: "GitHub Pages suele bloquear iframe; mejor enlace al sitio publicado.",
    };
  }

  if (host.endsWith(".githubusercontent.com")) {
    return {
      sourceKey: "githubusercontent",
      sourceLabel: "GitHub (archivo)",
      suggestedKind: "link",
      hint: "Enlaces raw o assets de GitHub no se incrustan; usa enlace o la página del repo.",
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
      hint: "Las URLs de reproducción (watch?v=, youtu.be/…) se convierten a /embed/ automáticamente para el iframe.",
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

function isYouTubeHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "youtu.be" || h === "youtube.com" || h.endsWith(".youtube.com");
}

/** Extrae el id de vídeo de enlaces watch, youtu.be, embed, shorts o live. */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? decodeURIComponent(id.split("?")[0]) : null;
    }
    if (isYouTubeHostname(host)) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" && parts[1]) return parts[1].split("?")[0];
      if (parts[0] === "shorts" && parts[1]) return parts[1].split("?")[0];
      if (parts[0] === "live" && parts[1]) return parts[1].split("?")[0];
    }
    return null;
  } catch {
    return null;
  }
}

/** Convierte enlaces de YouTube a `https://www.youtube.com/embed/ID` (obligatorio para iframes). */
export function normalizeYouTubeEmbedUrl(url: string): string {
  const id = extractYouTubeVideoId(url);
  if (!id) return url;
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
}

/** Atributo `allow` recomendado para iframes (YouTube y otros embeds). */
export const IFRAME_EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";

export function embedIframeSrc(url: string): string {
  if (evidenceUrlBlocksIframe(url)) return url;
  const h = hostOf(url);
  if (!h) return url;
  if (h.includes("tableau")) return normalizeTableauEmbedUrl(url);
  if (h === "youtu.be" || isYouTubeHostname(h)) return normalizeYouTubeEmbedUrl(url);
  return url;
}

function isSafeHttpsForOgProxy(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Miniatura en tarjetas públicas: URL custom (HTTPS) > captura YouTube > proxy og en `/api/evidence-thumb`.
 */
export function resolveEvidenceThumbnailForDisplay(
  customThumbnail: string | null | undefined,
  evidenceUrl: string,
): string | null {
  const c = (customThumbnail ?? "").trim();
  if (c && /^https:\/\//i.test(c)) return c;
  const id = extractYouTubeVideoId(evidenceUrl);
  if (id) return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  const ev = evidenceUrl.trim();
  if (isSafeHttpsForOgProxy(ev)) {
    return `/api/evidence-thumb?url=${encodeURIComponent(ev)}`;
  }
  return null;
}

/** Icono del sitio para previews en lista/modal (sin peticiones propias al dominio del usuario). */
export function evidenceSiteIconUrl(url: string): string | null {
  const h = hostOf(url);
  if (!h) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=32`;
}
