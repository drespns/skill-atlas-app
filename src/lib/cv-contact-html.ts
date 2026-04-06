/** Huecos fijos de enlaces en el editor del CV (orden editorial). */
export const CV_LINK_SLOT_COUNT = 5;

export const CV_LINK_SLOT_ICON_PATHS = [
  "/icons/login/linkedin-icon.svg",
  "/icons/GitHub.svg",
  "/favicon.svg",
  "/icons/link-external.svg",
  "/icons/link-external.svg",
] as const;

export type CvSocialLinkDisplay = "url" | "icon" | "both";

export function normalizeCvUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/**
 * Migra el array `links` antiguo (sin huecos fijos) a 5 URLs por índice.
 */
export function migrateCvLinksToSlots(legacy: { label: string; url: string }[] | undefined): string[] {
  const out = Array.from({ length: CV_LINK_SLOT_COUNT }, () => "");
  if (!legacy?.length) return out;
  for (const x of legacy) {
    const url = (x.url || "").trim();
    const lab = (x.label || "").toLowerCase();
    if (!url) continue;
    if (lab.includes("linkedin") || /linkedin\.com/i.test(url)) out[0] = url;
    else if (lab.includes("github") || /github\.com/i.test(url)) out[1] = url;
    else if (lab.includes("portfolio") || /skillatlas\.app/i.test(url)) out[2] = url;
    else if (lab.includes("twitter") || lab.includes("x.com") || /(^|\.)x\.com\//i.test(url) || /twitter\.com/i.test(url))
      out[3] = url;
    else {
      const i = out.findIndex((s) => !s);
      if (i >= 0) out[i] = url;
    }
  }
  return out;
}

export function slotsToPersistedLinks(
  slots: string[],
  labels: string[],
): { label: string; url: string }[] {
  return slots
    .map((url, i) => ({ label: labels[i] ?? `Link ${i + 1}`, url: (url || "").trim() }))
    .filter((x) => x.url.length > 0);
}

export function buildCvSocialChipsHtml(opts: {
  slots: string[];
  slotLabels: string[];
  display: CvSocialLinkDisplay;
  esc: (s: string) => string;
}): string[] {
  const { slots, slotLabels, display, esc } = opts;
  const chips: string[] = [];
  for (let i = 0; i < Math.min(slots.length, CV_LINK_SLOT_COUNT); i++) {
    const url = normalizeCvUrl(slots[i] ?? "");
    if (!url) continue;
    const label = (slotLabels[i] || "").trim() || url;
    const icon = CV_LINK_SLOT_ICON_PATHS[i] ?? "/icons/link-external.svg";
    if (display === "icon") {
      chips.push(
        `<a class="inline-flex items-center align-middle cv-social-link" href="${esc(url)}" target="_blank" rel="noreferrer" title="${esc(url)}"><img src="${esc(icon)}" alt="" class="h-4 w-4 shrink-0" width="16" height="16" loading="lazy" decoding="async" /></a>`,
      );
    } else if (display === "url") {
      chips.push(
        `<a class="no-underline hover:underline cv-social-link" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`,
      );
    } else {
      chips.push(
        `<a class="inline-flex items-center gap-1.5 no-underline hover:underline cv-social-link" href="${esc(url)}" target="_blank" rel="noreferrer"><img src="${esc(icon)}" alt="" class="h-4 w-4 shrink-0" width="16" height="16" loading="lazy" decoding="async" />${esc(label)}</a>`,
      );
    }
  }
  return chips;
}
