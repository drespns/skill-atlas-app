/**
 * HTML de tarjeta de proyecto para portfolio **visitante** (público o preview autenticado).
 * Orden visual: título → stack tecnológico → historia (rol/impacto) → descripción → evidencia(s).
 */

import { getTechnologyIconSrc } from "../config/icons";
import { publicStorageObjectUrl } from "./supabase-public-storage-url";
import {
  coerceEvidenceDisplayKind,
  detectEvidenceUrl,
  embedIframeSrc,
  evidenceSiteIconUrl,
  IFRAME_EMBED_ALLOW,
  resolveEvidenceThumbnailForDisplay,
} from "./evidence-url";
import i18next from "i18next";

export type PortfolioEmbed = { kind: string; title: string; url: string; thumbnailUrl?: string | null };

export type PortfolioCardProject = {
  title: string;
  description?: string | null;
  role?: string | null;
  outcome?: string | null;
  technologyNames: string[];
  /** Ruta en bucket `project_covers` (RPC `coverImagePath`). */
  coverImagePath?: string | null;
  /** Lista ya recortada al límite efectivo (preferido sobre primaryEmbed). */
  embeds?: PortfolioEmbed[];
  primaryEmbed?: { kind: string; title: string; url: string; thumbnailUrl?: string | null } | null;
  /** Valores alineados con `projects.status` (saas-018). */
  status?: string | null;
  tags?: string[] | null;
  dateStart?: string | null;
  dateEnd?: string | null;
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tr(key: string, def: string, opts?: Record<string, string | number>) {
  const r = i18next.t(key, { defaultValue: def, ...(opts ?? {}) } as Record<string, unknown>);
  return typeof r === "string" && r.length > 0 ? r : def;
}

function projectStatusLabel(code: string): string {
  switch (code) {
    case "draft":
      return tr("projects.statusDraft", "Borrador");
    case "in_progress":
      return tr("projects.statusInProgress", "En proceso");
    case "portfolio_visible":
      return tr("projects.statusPortfolioVisible", "Visible en portfolio");
    case "archived":
      return tr("projects.statusArchived", "Archivado");
    default:
      return code;
  }
}

function techHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function normalizeEmbed(e: PortfolioEmbed | { kind: string; title: string; url: string } | null | undefined): {
  kind: "iframe" | "link";
  title: string;
  url: string;
  thumbnailUrl: string | null;
} | null {
  if (!e?.url) return null;
  const url = String(e.url).trim();
  if (!url) return null;
  const stored = e.kind === "iframe" ? "iframe" : "link";
  const kind = coerceEvidenceDisplayKind(url, stored);
  const title =
    String(e.title ?? "").trim() || detectEvidenceUrl(url).sourceLabel;
  const thumbRaw =
    e && typeof (e as PortfolioEmbed).thumbnailUrl === "string"
      ? (e as PortfolioEmbed).thumbnailUrl!.trim()
      : "";
  return { kind, title, url, thumbnailUrl: thumbRaw || null };
}

function renderOneEvidenceBlock(
  primary: { kind: "iframe" | "link"; title: string; url: string; thumbnailUrl: string | null },
  options: { variant: "public" | "preview"; showHeading: boolean; index: number },
): string {
  const det = detectEvidenceUrl(primary.url);
  const fav = evidenceSiteIconUrl(primary.url);
  const chipIcon = fav
    ? `<img src="${esc(fav)}" alt="" width="18" height="18" class="rounded ring-1 ring-gray-200/80 dark:ring-gray-700 shrink-0" loading="lazy" decoding="async" onerror="this.remove()" />`
    : "";
  const kindLabel =
    primary.kind === "iframe"
      ? tr("portfolio.public.kindIframe", "Vista incrustada")
      : tr("portfolio.public.kindLink", "Enlace");
  const idxLabel =
    options.showHeading && options.index > 0
      ? `<span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">${esc(tr("portfolio.public.evidenceN", "Evidencia {{n}}", { n: options.index + 1 }))}</span>`
      : "";
  const chip = `<div class="flex flex-wrap items-center gap-2 mb-2">
      ${chipIcon}
      <span class="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/50">${esc(det.sourceLabel)}</span>
      <span class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(kindLabel)}</span>
      ${idxLabel}
    </div>`;
  const thumbSrc = resolveEvidenceThumbnailForDisplay(primary.thumbnailUrl, primary.url);
  const thumbBlock = thumbSrc
    ? `<div class="evidence-thumb-wrap mb-2 overflow-hidden rounded-lg border border-gray-200/80 dark:border-gray-800 bg-gray-100 dark:bg-gray-900/50 max-h-52">
        <img src="${esc(thumbSrc)}" alt="" width="640" height="360" class="w-full h-auto max-h-52 object-cover" loading="lazy" decoding="async" onerror="this.parentElement?.remove()" />
      </div>`
    : "";
  const body =
    primary.kind === "iframe"
      ? `<iframe class="w-full max-w-full aspect-video rounded-xl border border-gray-200/80 dark:border-gray-800 min-h-[12rem]" src="${esc(embedIframeSrc(primary.url))}" title="${esc(primary.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="${esc(IFRAME_EMBED_ALLOW)}" allowfullscreen></iframe>`
      : `<a class="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-xl border-2 border-gray-200/90 dark:border-gray-700 bg-white dark:bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 no-underline active:scale-[0.99] transition-transform" href="${esc(primary.url)}" target="_blank" rel="noreferrer">${esc(tr("portfolio.public.openEvidence", "Abrir evidencia"))}</a>`;
  return `<div class="min-w-0 space-y-2 rounded-xl border border-gray-100 dark:border-gray-800/90 bg-gray-50/40 dark:bg-gray-900/25 p-3 sm:p-3.5">${chip}${thumbBlock}<h3 class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words">${esc(primary.title)}</h3>${body}</div>`;
}

export type PortfolioVisitorCardOptions = {
  variant: "public" | "preview";
  /** Solo preview: enlace a detalle CSR */
  projectSlug?: string;
  /** Número total de evidencias en el proyecto (preview o hint público) */
  totalEmbedCount?: number;
  layout?: "grid" | "list";
  /** Espaciado interior (Ajustes / RPC saas-014) */
  density?: "comfortable" | "compact";
  cardIndex?: number;
  /** Si false, no añade animación de entrada */
  motionStagger?: boolean;
};

export function renderPortfolioVisitorCard(
  project: PortfolioCardProject,
  options: PortfolioVisitorCardOptions,
): string {
  const techNames = [...(project.technologyNames ?? [])].sort((a, b) => a.localeCompare(b, "es"));
  const role = (project.role ?? "").trim();
  const outcome = (project.outcome ?? "").trim();
  const hasStory = Boolean(role || outcome);
  const desc = (project.description ?? "").trim();

  const rawStatus = String(project.status ?? "").trim();
  const statusOk =
    rawStatus === "draft" ||
    rawStatus === "in_progress" ||
    rawStatus === "portfolio_visible" ||
    rawStatus === "archived"
      ? rawStatus
      : "";
  const tagList = Array.isArray(project.tags)
    ? project.tags.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  const ds = (project.dateStart ?? "").trim().slice(0, 10);
  const de = (project.dateEnd ?? "").trim().slice(0, 10);
  const metaRow =
    statusOk || tagList.length > 0 || ds || de
      ? `<div class="flex flex-wrap items-center gap-2">
      ${
        statusOk
          ? `<span class="inline-flex rounded-full border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-100">${esc(projectStatusLabel(statusOk))}</span>`
          : ""
      }
      ${tagList
        .map(
          (tg) =>
            `<span class="inline-flex rounded-full border border-gray-200/80 dark:border-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-200">${esc(tg)}</span>`,
        )
        .join("")}
      ${
        ds || de
          ? `<span class="text-[11px] text-gray-500 dark:text-gray-400">${esc(`${ds || "…"} ${tr("projects.metaDateArrow", "→")} ${de || "…"}`)}</span>`
          : ""
      }
    </div>`
      : "";

  const coverPath = (project.coverImagePath ?? "").trim();
  const coverUrl = coverPath ? publicStorageObjectUrl("project_covers", coverPath) : "";
  const coverBlock = coverUrl
    ? `<div class="portfolio-visitor-card__cover -mx-4 -mt-4 sm:-mx-5 sm:-mt-5 mb-1 overflow-hidden rounded-t-2xl border-b border-gray-200/80 dark:border-gray-800 bg-gray-100 dark:bg-gray-900/50 max-h-56">
        <img src="${esc(coverUrl)}" alt="" width="960" height="540" class="w-full h-auto max-h-56 object-cover" loading="lazy" decoding="async" />
      </div>`
    : "";

  const embedList: PortfolioEmbed[] = (() => {
    if (project.embeds && project.embeds.length > 0) {
      return project.embeds.filter((e) => e && String(e.url ?? "").trim());
    }
    const p = normalizeEmbed(project.primaryEmbed as PortfolioEmbed | null);
    return p ? [{ kind: p.kind, title: p.title, url: p.url, thumbnailUrl: p.thumbnailUrl }] : [];
  })();

  const normalizedEmbeds = embedList.map((e) => normalizeEmbed(e)).filter(Boolean) as {
    kind: "iframe" | "link";
    title: string;
    url: string;
    thumbnailUrl: string | null;
  }[];

  const totalHint =
    options.totalEmbedCount ??
    (options.variant === "preview" ? normalizedEmbeds.length : normalizedEmbeds.length);

  const pills = techNames
    .map((name) => {
      const hue = techHue(name);
      const iconSrc = getTechnologyIconSrc({ id: name.toLowerCase().replace(/\s+/g, "-"), name });
      const icon = iconSrc
        ? `<img src="${esc(iconSrc)}" alt="" class="h-4 w-4 object-contain shrink-0" loading="lazy" decoding="async" />`
        : "";
      return `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border max-w-full min-w-0" style="border-color:hsl(${hue} 72% 52% / 0.35); background-color:hsl(${hue} 72% 52% / 0.10)">
        ${icon}
        <span class="font-semibold text-gray-900 dark:text-gray-100 truncate">${esc(name)}</span>
      </span>`;
    })
    .join("");

  const stackBlock =
    techNames.length > 0
      ? `<div class="min-w-0">
      <p class="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">${esc(tr("portfolio.public.techLabel", "Stack"))}</p>
      <div class="flex flex-wrap gap-2">${pills}</div>
    </div>`
      : "";

  const storyBlock = hasStory
    ? `<section class="rounded-xl bg-gray-50/90 dark:bg-gray-900/45 border border-gray-200/80 dark:border-gray-800 p-3.5 sm:p-4" aria-label="${esc(tr("portfolio.public.storyLabel", "Historia"))}">
      <p class="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">${esc(tr("portfolio.public.storyLabel", "Historia"))}</p>
      <dl class="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3 text-sm">
        <div class="min-w-0">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(tr("portfolio.public.role", "Rol"))}</dt>
          <dd class="m-0 mt-1 text-gray-800 dark:text-gray-200 leading-snug break-words">${esc(role || "—")}</dd>
        </div>
        <div class="min-w-0">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(tr("portfolio.public.outcome", "Resultado / impacto"))}</dt>
          <dd class="m-0 mt-1 text-gray-800 dark:text-gray-200 leading-snug break-words">${esc(outcome || "—")}</dd>
        </div>
      </dl>
    </section>`
    : "";

  const descBlock = desc
    ? `<div class="text-sm sm:text-[0.9375rem] leading-relaxed text-gray-600 dark:text-gray-300 break-words">${esc(desc)}</div>`
    : "";

  const evidenceInner = (() => {
    if (normalizedEmbeds.length === 0) {
      const emptyMsg =
        options.variant === "preview"
          ? tr(
              "portfolio.public.noEvidenceOwner",
              "Aún no hay evidencias. Añade una en el detalle del proyecto.",
            )
          : tr("portfolio.public.noEvidence", "Sin evidencia destacada.");
      return `<div class="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30 px-4 py-3.5 text-sm text-gray-600 dark:text-gray-400">${esc(emptyMsg)}</div>`;
    }
    const countHint =
      options.variant === "preview" && totalHint > 1
        ? `<div class="mb-2"><span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">${esc(tr("portfolio.public.evidenceCount", "{{count}} evidencias", { count: totalHint }))}</span></div>`
        : options.variant === "public" && totalHint > normalizedEmbeds.length
          ? `<div class="mb-2"><span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">${esc(tr("portfolio.public.evidenceShowing", "Mostrando {{shown}} de {{total}}", { shown: normalizedEmbeds.length, total: totalHint }))}</span></div>`
          : "";
    const blocks = normalizedEmbeds
      .map((emb, i) =>
        renderOneEvidenceBlock(emb, {
          variant: options.variant,
          showHeading: normalizedEmbeds.length > 1,
          index: i,
        }),
      )
      .join(`<div class="h-3" aria-hidden="true"></div>`);
    return `${countHint}<div class="min-w-0 space-y-0">${blocks}</div>`;
  })();

  const evidenceSection = `<section class="min-w-0 pt-1 border-t border-gray-100 dark:border-gray-800/90" aria-label="${esc(tr("portfolio.public.evidenceHeading", "Evidencia"))}">
    <p class="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">${esc(tr("portfolio.public.evidenceHeading", "Evidencia"))}</p>
    ${evidenceInner}
  </section>`;

  const previewFooter =
    options.variant === "preview" && options.projectSlug
      ? `<div class="flex items-center justify-end border-t border-gray-100 dark:border-gray-800 px-4 py-3 sm:px-5 bg-gray-50/40 dark:bg-gray-900/30">
      <a href="/projects/view?project=${encodeURIComponent(options.projectSlug)}" class="inline-flex min-h-10 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 no-underline">${esc(tr("portfolio.public.viewInApp", "Ver en la app"))}</a>
    </div>`
      : "";

  const layoutClass = options.layout === "list" ? " portfolio-visitor-card--list" : "";
  const densityClass = options.density === "compact" ? " portfolio-visitor-card--density-compact" : "";
  const idx = options.cardIndex ?? 0;
  const motionClass = options.motionStagger ? " portfolio-visitor-card--motion" : "";
  const motionStyle = options.motionStagger
    ? ` style="animation-delay:${Math.min(idx, 12) * 0.045}s"`
    : "";

  return `<article class="portfolio-visitor-card flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm ring-1 ring-black/5 dark:ring-white/10 min-w-0${layoutClass}${densityClass}${motionClass}"${motionStyle}>
    <div class="portfolio-visitor-card__body flex flex-col gap-4 p-4 sm:p-5 min-w-0">
      ${coverBlock}
      <h2 class="portfolio-visitor-card__title m-0 text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 text-balance break-words leading-snug">${esc(project.title)}</h2>
      ${metaRow}
      ${stackBlock}
      ${storyBlock}
      ${descBlock}
      ${evidenceSection}
    </div>
    ${previewFooter}
  </article>`;
}
