import { CV_DOCUMENT_SECTION_IDS } from "@lib/cv-document-section-order";

/** Layout editable en el estudio (bloques + notas); serializable en prefs del CV activo. */
export type CvStudioStickyNoteV1 = {
  id: string;
  body: string;
  /** Posición horizontal respecto al ancho del lienzo (0–100). */
  xPct: number;
  /** Offset vertical desde la parte superior del área de página (px). */
  yPx: number;
  /** Ancho relativo del bloque de nota (22–100). */
  wPct: number;
};

/** Campos del titular cuyo ancho puede ajustarse en el lienzo Canva (% del bloque de texto). */
export type CvHeroResizeFieldId = "name" | "targetRole" | "headline" | "contact" | "prefs" | "bio";

/** Claves para tamaño de fuente local del titular (rem) en lienzo Canva. */
export type CvHeroFontKey = "displayName" | "headline" | "cvTargetRole" | "summary" | "workPrefs";

export type CvStudioCanvasLayoutV1 = {
  v: 1;
  /** Anchura por bloque (hero, techFeaturedBand, ids de sección): 55–99 (%); 100 = ignorar / ancho completo. */
  blockWidthsPct?: Partial<Record<string, number>>;
  /** Orden visual de las secciones principales en bandas (no afecta la cabecera hero). */
  sectionFlow?: "single" | "two";
  /** Escala tipográfica global del lienzo (80–120%); 100 = por defecto. */
  fontScalePct?: number;
  /** Notas libres solo en estudio (no impresión por defecto en UI). */
  stickyNotes?: CvStudioStickyNoteV1[];
  /** Escala de iconos de contacto / enlaces en el hero (70–160; 100 = por defecto). */
  heroContactIconScalePct?: number;
  /** Anchura relativa de cada franja de texto del hero (30–100 % de la columna). */
  heroFieldWidthsPct?: Partial<Record<CvHeroResizeFieldId, number>>;
  /** Tamaño de fuente local por clave (rem), p. ej. nombre o resumen. */
  heroFontRem?: Partial<Record<CvHeroFontKey, number>>;
};

export function normalizeCvStudioCanvasLayout(raw: unknown): CvStudioCanvasLayoutV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return undefined;

  const blockWidthsPct: Partial<Record<string, number>> = {};
  if (r.blockWidthsPct && typeof r.blockWidthsPct === "object") {
    for (const [k, v] of Object.entries(r.blockWidthsPct as Record<string, unknown>)) {
      const key = String(k).trim().slice(0, 48);
      const n = Number(v);
      if (!key || !Number.isFinite(n)) continue;
      const rounded = Math.min(100, Math.max(55, Math.round(n)));
      if (rounded >= 100) continue;
      blockWidthsPct[key] = rounded;
    }
  }

  let sectionFlow: "single" | "two" | undefined;
  if (r.sectionFlow === "two") sectionFlow = "two";
  else if (r.sectionFlow === "single") sectionFlow = undefined;
  const fontScaleRaw = Number(r.fontScalePct);
  const fontScalePct = Number.isFinite(fontScaleRaw) ? Math.min(120, Math.max(80, Math.round(fontScaleRaw))) : 100;

  let heroContactIconScalePct: number | undefined;
  const iconRaw = Number(r.heroContactIconScalePct);
  if (Number.isFinite(iconRaw)) {
    const rounded = Math.round(iconRaw);
    if (rounded >= 70 && rounded <= 160 && rounded !== 100) heroContactIconScalePct = rounded;
  }

  const heroFieldWidthsPct: Partial<Record<CvHeroResizeFieldId, number>> = {};
  if (r.heroFieldWidthsPct && typeof r.heroFieldWidthsPct === "object") {
    const allowed: CvHeroResizeFieldId[] = ["name", "targetRole", "headline", "contact", "prefs", "bio"];
    for (const k of allowed) {
      const n = Number((r.heroFieldWidthsPct as Record<string, unknown>)[k]);
      if (!Number.isFinite(n)) continue;
      const rounded = Math.min(100, Math.max(30, Math.round(n)));
      if (rounded < 100) heroFieldWidthsPct[k] = rounded;
    }
  }

  const heroFontRem: Partial<Record<CvHeroFontKey, number>> = {};
  if (r.heroFontRem && typeof r.heroFontRem === "object") {
    const allowedF: CvHeroFontKey[] = ["displayName", "headline", "cvTargetRole", "summary", "workPrefs"];
    for (const k of allowedF) {
      const n = Number((r.heroFontRem as Record<string, unknown>)[k]);
      if (!Number.isFinite(n)) continue;
      const v = Math.round(n * 1000) / 1000;
      if (v >= 0.7 && v <= 2.75) heroFontRem[k] = v;
    }
  }

  const stickyNotes: CvStudioStickyNoteV1[] = [];
  if (Array.isArray(r.stickyNotes)) {
    for (const x of r.stickyNotes) {
      if (!x || typeof x !== "object") continue;
      const sn = x as Record<string, unknown>;
      const id = typeof sn.id === "string" ? sn.id.trim().slice(0, 80) : "";
      const body = typeof sn.body === "string" ? sn.body.slice(0, 4000) : "";
      const xPct = Number(sn.xPct);
      const yPx = Number(sn.yPx);
      const wPct = Number(sn.wPct);
      if (!id) continue;
      stickyNotes.push({
        id,
        body,
        xPct: Number.isFinite(xPct) ? Math.min(92, Math.max(0, xPct)) : 10,
        yPx: Number.isFinite(yPx) ? Math.min(12000, Math.max(0, yPx)) : 40,
        wPct: Number.isFinite(wPct) ? Math.min(100, Math.max(22, wPct)) : 38,
      });
      if (stickyNotes.length >= 14) break;
    }
  }

  const out: CvStudioCanvasLayoutV1 = { v: 1 };
  if (Object.keys(blockWidthsPct).length > 0) out.blockWidthsPct = blockWidthsPct;
  if (stickyNotes.length > 0) out.stickyNotes = stickyNotes;
  if (sectionFlow === "two") out.sectionFlow = "two";
  if (fontScalePct !== 100) out.fontScalePct = fontScalePct;
  if (heroContactIconScalePct !== undefined) out.heroContactIconScalePct = heroContactIconScalePct;
  if (Object.keys(heroFieldWidthsPct).length > 0) out.heroFieldWidthsPct = heroFieldWidthsPct;
  if (Object.keys(heroFontRem).length > 0) out.heroFontRem = heroFontRem;

  if (
    !out.blockWidthsPct &&
    !out.stickyNotes &&
    out.sectionFlow !== "two" &&
    out.fontScalePct === undefined &&
    out.heroContactIconScalePct === undefined &&
    !out.heroFieldWidthsPct &&
    !out.heroFontRem
  )
    return undefined;
  return out;
}

/** Copia editable del layout desde el perfil (prefs). */
export function mergeCvStudioCanvasLayoutFromProfile(profile: { cvStudioCanvasLayout?: CvStudioCanvasLayoutV1 }): CvStudioCanvasLayoutV1 {
  return profile.cvStudioCanvasLayout?.v === 1
    ? (JSON.parse(JSON.stringify(profile.cvStudioCanvasLayout)) as CvStudioCanvasLayoutV1)
    : { v: 1 };
}

/** Quita `cvStudioCanvasLayout` del perfil cuando no queda nada útil persistido. */
export function compactCvStudioLayoutForPersist(lay: CvStudioCanvasLayoutV1): CvStudioCanvasLayoutV1 | undefined {
  const hasW = !!(lay.blockWidthsPct && Object.keys(lay.blockWidthsPct).length > 0);
  const hasN = !!(lay.stickyNotes && lay.stickyNotes.length > 0);
  const hasTwo = lay.sectionFlow === "two";
  const hasScale = typeof lay.fontScalePct === "number" && Number.isFinite(lay.fontScalePct) && lay.fontScalePct !== 100;
  const hasIcon =
    typeof lay.heroContactIconScalePct === "number" &&
    Number.isFinite(lay.heroContactIconScalePct) &&
    lay.heroContactIconScalePct !== 100;
  const hasHeroW = !!(lay.heroFieldWidthsPct && Object.keys(lay.heroFieldWidthsPct).length > 0);
  const hasHeroF = !!(lay.heroFontRem && Object.keys(lay.heroFontRem).length > 0);
  if (!hasW && !hasN && !hasTwo && !hasScale && !hasIcon && !hasHeroW && !hasHeroF) return undefined;
  return lay;
}

/** Aplica anchuras de bloque al DOM del documento CV (preview + impresión). */
export function applyCvStudioCanvasLayoutToDocument(docEl: HTMLElement | null, layout: CvStudioCanvasLayoutV1 | undefined): void {
  if (!docEl) return;

  const hero = docEl.querySelector<HTMLElement>('[data-cv-weight="hero"]');
  const band = docEl.querySelector<HTMLElement>("[data-cv-doc-tech-featured-band]");
  docEl.querySelectorAll<HTMLElement>("section[data-cv-section]").forEach((sec) => {
    sec.style.maxWidth = "";
    sec.style.marginInline = "";
  });
  if (hero) {
    hero.style.maxWidth = "";
    hero.style.marginInline = "";
  }
  if (band) {
    band.style.maxWidth = "";
    band.style.marginInline = "";
  }
  docEl.style.fontSize = "";

  if (hero) {
    hero.style.removeProperty("--cv-hero-contact-icon-scale");
    hero.querySelectorAll<HTMLElement>("[data-cv-hero-resize-wrap] .cv-hero-resize-inner").forEach((el) => {
      el.style.width = "";
      el.style.maxWidth = "";
    });
    hero.querySelectorAll<HTMLElement>("[data-cv-hero-font-key]").forEach((el) => {
      el.style.fontSize = "";
    });
  }

  const host = docEl.querySelector<HTMLElement>("[data-cv-doc-sections]");
  if (host) {
    if (layout?.sectionFlow === "two") {
      host.dataset.cvStudioSectionFlow = "two";
    } else {
      delete host.dataset.cvStudioSectionFlow;
    }
  }
  const scale = layout?.fontScalePct;
  if (typeof scale === "number" && Number.isFinite(scale) && scale !== 100) {
    docEl.style.fontSize = `${scale}%`;
  }

  if (hero && layout) {
    const iconS = layout.heroContactIconScalePct;
    if (typeof iconS === "number" && Number.isFinite(iconS) && iconS !== 100) {
      hero.style.setProperty("--cv-hero-contact-icon-scale", String(iconS / 100));
    }
    const widths = layout.heroFieldWidthsPct;
    if (widths) {
      const ids: CvHeroResizeFieldId[] = ["name", "targetRole", "headline", "contact", "prefs", "bio"];
      for (const id of ids) {
        const pct = widths[id];
        if (typeof pct !== "number" || !Number.isFinite(pct) || pct >= 100) continue;
        const inner = hero.querySelector<HTMLElement>(`[data-cv-hero-resize-wrap="${id}"] .cv-hero-resize-inner`);
        if (!inner) continue;
        inner.style.width = `${pct}%`;
        inner.style.maxWidth = "100%";
      }
    }
    const fonts = layout.heroFontRem;
    if (fonts) {
      for (const [k, rem] of Object.entries(fonts)) {
        if (typeof rem !== "number" || !Number.isFinite(rem)) continue;
        const el = hero.querySelector<HTMLElement>(`[data-cv-hero-font-key="${k}"]`);
        if (el) el.style.fontSize = `${rem}rem`;
      }
    }
  }

  if (!layout?.blockWidthsPct || Object.keys(layout.blockWidthsPct).length === 0) return;

  const pct = layout.blockWidthsPct;
  const apply = (el: HTMLElement | null, key: string) => {
    if (!el) return;
    const w = pct[key];
    if (typeof w !== "number" || !Number.isFinite(w) || w >= 100) return;
    el.style.maxWidth = `${w}%`;
    el.style.marginInline = "auto";
  };

  apply(hero, "hero");
  apply(band, "techFeaturedBand");
  for (const id of CV_DOCUMENT_SECTION_IDS) {
    const sec = docEl.querySelector<HTMLElement>(`section[data-cv-section="${id}"]`);
    apply(sec, id);
  }
}
