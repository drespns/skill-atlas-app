import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { confirmModal, markdownEditorModal, showToast } from "@scripts/core/ui-feedback";
import { initConceptActions } from "@scripts/technologies/technology-detail/concept-actions";
import {
  conceptsListHtml,
  esc,
  statCounts,
  summaryText,
  type TechConceptRow,
} from "@scripts/technologies/technology-detail/concept-list-html";
import { conceptSeedPublicPath, hasConceptSeed } from "@scripts/technologies/technology-detail/concept-seeds";

/** Hook for future AI-assisted enrichment; v1 returns candidates unchanged. */
export type ImportContext = {
  technologyName: string;
  technologySlug: string;
  userId: string;
};

/** Nivel sugerido para agrupar la vista previa (marcadores HTML en el .md o `mid` por defecto). */
export type ConceptTier = "iniciacion" | "junior" | "mid" | "senior";

export const TIER_ORDER: ConceptTier[] = ["iniciacion", "junior", "mid", "senior"];

export const TIER_LABELS_ES: Record<ConceptTier, string> = {
  iniciacion: "Iniciación",
  junior: "Principiante (Junior)",
  mid: "Intermedio (Mid)",
  senior: "Avanzado (Senior)",
};

export type ImportCandidate = {
  id: string;
  title: string;
  category: string;
  tag: string;
  tier: ConceptTier;
  notes: string;
  duplicateOfExisting: boolean;
};

export type ImportEnricher = (
  candidates: ImportCandidate[],
  ctx: ImportContext,
) => Promise<ImportCandidate[]>;

export const defaultImportEnricher: ImportEnricher = async (candidates) => candidates;

export const IMPORT_QUALITY = {
  titleMinChars: 2,
  titleMaxChars: 80,
  maxWords: 8,
  /** Treat as sentence/paragraph if at least this many commas */
  maxCommas: 2,
  /** Reject if multiple sentences (heuristic) */
  rejectMultipleSentences: true,
} as const;

export type QualityRejectReason =
  | "too_short"
  | "too_long"
  | "too_many_words"
  | "too_many_commas"
  | "looks_like_paragraph";

export type ParseStats = {
  rawLines: number;
  rejectedByQuality: number;
  reasons: Partial<Record<QualityRejectReason, number>>;
};

function normalizeTitle(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function wordCount(s: string) {
  return normalizeTitle(s)
    .split(/\s+/)
    .filter(Boolean).length;
}

export function assessTitleQuality(title: string): { ok: true } | { ok: false; reason: QualityRejectReason } {
  const t = normalizeTitle(title);
  if (t.length < IMPORT_QUALITY.titleMinChars) return { ok: false, reason: "too_short" };
  if (t.length > IMPORT_QUALITY.titleMaxChars) return { ok: false, reason: "too_long" };
  const wc = wordCount(t);
  if (wc > IMPORT_QUALITY.maxWords) return { ok: false, reason: "too_many_words" };
  const commas = (t.match(/,/g) ?? []).length;
  if (commas > IMPORT_QUALITY.maxCommas) return { ok: false, reason: "too_many_commas" };
  if (IMPORT_QUALITY.rejectMultipleSentences) {
    const sentenceEnds = (t.match(/[.!?](?:\s|$)/g) ?? []).length;
    if (sentenceEnds >= 1 && t.length > 45) return { ok: false, reason: "looks_like_paragraph" };
  }
  return { ok: true };
}

/** Strip fenced code blocks so bullets inside docs don't become concepts */
export function stripCodeFences(text: string) {
  return text.replace(/```[\s\S]*?```/g, "\n");
}

type ParsedLine =
  | { kind: "heading"; level: number; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "tier"; tier: ConceptTier };

const TIER_ALIASES: Record<string, ConceptTier> = {
  iniciacion: "iniciacion",
  inicio: "iniciacion",
  basics: "iniciacion",
  beginner: "iniciacion",
  junior: "junior",
  principiante: "junior",
  mid: "mid",
  intermedio: "mid",
  intermediate: "mid",
  senior: "senior",
  avanzado: "senior",
  advanced: "senior",
};

export function normalizeTierKeyword(raw: string): ConceptTier {
  const k = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return TIER_ALIASES[k] ?? "mid";
}

export function parseDocumentToLines(text: string): ParsedLine[] {
  const cleaned = stripCodeFences(text);
  const lines = cleaned.split(/\r?\n/);
  const out: ParsedLine[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const tierM = line.match(/^<!--\s*skillatlas-tier:\s*(.+?)\s*-->\s*$/i);
    if (tierM) {
      out.push({ kind: "tier", tier: normalizeTierKeyword(tierM[1]) });
      continue;
    }
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      out.push({ kind: "heading", level: hm[1].length, text: hm[2].trim() });
      continue;
    }
    const bm = line.match(/^[-*•]\s+(.+)$/);
    if (bm) {
      out.push({ kind: "bullet", text: bm[1].trim() });
      continue;
    }
    const nm = line.match(/^\d+\.\s+(.+)$/);
    if (nm) {
      out.push({ kind: "bullet", text: nm[1].trim() });
    }
  }
  return out;
}

function categoryFromHeading(level: number, text: string): string {
  if (level <= 1) return text || "General";
  return text || "General";
}

function tagSlug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function buildConceptNotes(category: string, tier: ConceptTier) {
  const parts: string[] = [];
  if (category && category !== "General") parts.push(`[cat:${category}]`);
  parts.push(`[tier:${tier}]`);
  return parts.join("");
}

export function linesToImportCandidates(parsed: ParsedLine[]): {
  candidates: Omit<ImportCandidate, "id" | "duplicateOfExisting">[];
  stats: ParseStats;
} {
  let currentCategory = "General";
  let currentTag = "";
  let currentTier: ConceptTier = "mid";
  const candidates: Omit<ImportCandidate, "id" | "duplicateOfExisting">[] = [];
  const reasons: Partial<Record<QualityRejectReason, number>> = {};
  let rejectedByQuality = 0;
  let rawLines = 0;

  for (const row of parsed) {
    if (row.kind === "tier") {
      currentTier = row.tier;
      continue;
    }
    if (row.kind === "heading") {
      currentCategory = categoryFromHeading(row.level, row.text);
      currentTag = tagSlug(row.text) || "general";
      continue;
    }
    rawLines++;
    const title = normalizeTitle(row.text);
    if (!title) continue;
    const q = assessTitleQuality(title);
    if (!q.ok) {
      rejectedByQuality++;
      reasons[q.reason] = (reasons[q.reason] ?? 0) + 1;
      continue;
    }
    candidates.push({
      title,
      category: currentCategory,
      tag: currentTag,
      tier: currentTier,
      notes: buildConceptNotes(currentCategory, currentTier),
    });
  }

  return {
    candidates,
    stats: { rawLines, rejectedByQuality, reasons },
  };
}

function uid() {
  return `c-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchUrlText(url: string): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) {
      return { ok: false, message: "Solo se permiten URLs http(s)." };
    }
    const res = await fetch(url, { method: "GET", mode: "cors", credentials: "omit" });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const text = await res.text();
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de red";
    return {
      ok: false,
      message: `${msg}. Si es CORS, copia el texto en la pestaña «Texto».`,
    };
  }
}

function markDuplicates(candidates: ImportCandidate[], existingLower: Set<string>) {
  return candidates.map((c) => ({
    ...c,
    duplicateOfExisting: existingLower.has(c.title.trim().toLowerCase()),
  }));
}

async function persistRefreshDom(supabase: SupabaseClient, technologyId: string) {
  const root = document.querySelector<HTMLElement>("[data-technology-page]");
  const listEl = document.querySelector<HTMLElement>("[data-concept-list]");
  if (!root || !listEl) return;

  const conceptsRes = await supabase
    .from("concepts")
    .select("id, title, notes, progress")
    .eq("technology_id", technologyId)
    .order("title");

  const techConcepts = (conceptsRes.data ?? []) as TechConceptRow[];
  listEl.innerHTML = conceptsListHtml(techConcepts);

  const relatedN = Number(root.dataset.relatedProjectCount ?? "0");
  const summaryEl = root.querySelector<HTMLElement>("[data-tech-summary]");
  if (summaryEl) {
    summaryEl.textContent = summaryText(techConcepts, relatedN);
  }
  const { aprend, pract, dom } = statCounts(techConcepts);
  const s1 = root.querySelector("[data-tech-stat-aprend]");
  const s2 = root.querySelector("[data-tech-stat-pract]");
  const s3 = root.querySelector("[data-tech-stat-dom]");
  if (s1) s1.textContent = `${aprend} aprend.`;
  if (s2) s2.textContent = `${pract} pract.`;
  if (s3) s3.textContent = `${dom} dom.`;

  await initConceptActions();
}

async function insertConcepts(
  supabase: SupabaseClient,
  userId: string,
  technologyId: string,
  rows: { title: string; notes: string }[],
) {
  if (rows.length === 0) return { error: null as string | null };
  const payload = rows.map((r) => ({
    technology_id: technologyId,
    title: r.title,
    notes: r.notes || null,
    progress: "aprendido" as const,
    user_id: userId,
  }));
  const res = await supabase.from("concepts").insert(payload);
  if (res.error) return { error: res.error.message };
  return { error: null };
}

function groupCandidatesByTierThenCategory(candidates: ImportCandidate[], tierFilter: ConceptTier | "all") {
  const base = tierFilter === "all" ? candidates : candidates.filter((c) => c.tier === tierFilter);
  const byTier = new Map<ConceptTier, Map<string, ImportCandidate[]>>();
  for (const t of TIER_ORDER) byTier.set(t, new Map());
  for (const c of base) {
    const tier = c.tier ?? "mid";
    const catMap = byTier.get(tier)!;
    const cat = c.category || "General";
    const arr = catMap.get(cat) ?? [];
    arr.push(c);
    catMap.set(cat, arr);
  }
  return TIER_ORDER.map((tier) => {
    const catMap = byTier.get(tier)!;
    const categories = [...catMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, items]) => [cat, items] as [string, ImportCandidate[]]);
    return { tier, categories };
  }).filter((block) => block.categories.some(([, items]) => items.length > 0));
}

/** Atenúa nivel/sección cuando todos los checkboxes visibles del bloque están desmarcados. */
function syncReviewBlockMutedState(reviewBodyRoot: HTMLElement | null) {
  if (!reviewBodyRoot) return;
  reviewBodyRoot.querySelectorAll<HTMLDetailsElement>("details[data-import-category-block]").forEach((det) => {
    const cbs = det.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-import-candidate-id]");
    const anyChecked = [...cbs].some((cb) => cb.checked);
    det.classList.toggle("concept-import-review-muted", cbs.length > 0 && !anyChecked);
  });
  reviewBodyRoot.querySelectorAll<HTMLDetailsElement>("details[data-import-tier-root]").forEach((det) => {
    const cbs = det.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-import-candidate-id]");
    const anyChecked = [...cbs].some((cb) => cb.checked);
    det.classList.toggle("concept-import-review-muted", cbs.length > 0 && !anyChecked);
  });
}

function renderCategoryBlock(cat: string, items: ImportCandidate[], filt: string) {
  const visible = filt ? items.filter((i) => i.title.toLowerCase().includes(filt)) : items;
  if (visible.length === 0) return "";
  const rows = visible
    .map((c) => {
      const dup = c.duplicateOfExisting
        ? '<span class="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded px-1 py-0.5">Duplicado</span>'
        : "";
      const tag = c.tag
        ? `<span class="text-[10px] text-gray-500 dark:text-gray-400">${esc(c.tag)}</span>`
        : "";
      return `<label class="flex items-start gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer">
            <input type="checkbox" data-import-candidate-id="${esc(c.id)}" class="mt-1 rounded border-gray-300 dark:border-gray-600" ${c.duplicateOfExisting ? "" : "checked"} />
            <div class="min-w-0 flex-1 space-y-1">
              <input type="text" value="${esc(c.title)}" data-import-title="${esc(c.id)}" class="w-full text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-950" />
              <div class="flex flex-wrap items-center gap-2">${dup}${tag}</div>
            </div>
          </label>`;
    })
    .join("");
  const catBtn =
    visible.length > 0
      ? `<span class="inline-flex flex-wrap gap-1 shrink-0" data-import-cat-actions>
        <button type="button" data-import-cat-select class="text-[10px] font-semibold rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 hover:opacity-90">✓ Sección</button>
        <button type="button" data-import-cat-clear class="text-[10px] font-semibold rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800">✗ Sección</button>
      </span>`
      : "";
  return `<details data-import-category-block class="concept-import-review-details border border-gray-200/90 dark:border-gray-800 rounded-lg bg-white/60 dark:bg-gray-950/40 transition-[background-color,border-color,opacity] duration-150">
        <summary class="list-none flex flex-wrap items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
          <span class="flex min-w-0 flex-1 items-center gap-2">
            <span class="concept-import-review-chevron" aria-hidden="true">▸</span>
            <span class="min-w-0 text-sm font-semibold text-gray-900 dark:text-gray-100">${esc(cat)} <span class="font-normal text-gray-500 dark:text-gray-400">(${visible.length})</span></span>
          </span>
          ${catBtn}
        </summary>
        <div class="px-3 pb-2" data-import-category-body>${rows}</div>
      </details>`;
}

function renderReviewHtml(
  candidates: ImportCandidate[],
  stats: ParseStats,
  filter: string,
  tierFilter: ConceptTier | "all",
) {
  const filt = filter.trim().toLowerCase();
  const reasonLabels: Record<QualityRejectReason, string> = {
    too_short: "demasiado cortos",
    too_long: "demasiado largos",
    too_many_words: "demasiadas palabras",
    too_many_commas: "demasiadas comas",
    looks_like_paragraph: "parecen párrafo",
  };
  const reasonParts = (Object.entries(stats.reasons) as [QualityRejectReason, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${reasonLabels[k]}`);
  const statsLine =
    stats.rejectedByQuality > 0
      ? `<p class="m-0 text-xs text-amber-700 dark:text-amber-400">Omitidos por calidad: <strong>${stats.rejectedByQuality}</strong>${reasonParts.length ? ` (${reasonParts.join(", ")})` : ""}.</p>`
      : `<p class="m-0 text-xs text-gray-500 dark:text-gray-400">Nada omitido por filtros de calidad.</p>`;

  const tierBlocks = groupCandidatesByTierThenCategory(candidates, tierFilter);
  const blocksHtml = tierBlocks
    .map(({ tier, categories }) => {
      const inner = categories.map(([cat, items]) => renderCategoryBlock(cat, items, filt)).join("");
      if (!inner) return "";
      const tierCount = categories.reduce((n, [, items]) => {
        const vis = filt ? items.filter((i) => i.title.toLowerCase().includes(filt)) : items;
        return n + vis.length;
      }, 0);
      const tierBtn =
        tierCount > 0
          ? `<span class="inline-flex flex-wrap gap-1 shrink-0">
        <button type="button" data-import-tier-select class="text-[10px] font-semibold rounded-md border border-violet-400 dark:border-violet-700 bg-violet-100/80 dark:bg-violet-900/40 text-violet-950 dark:text-violet-100 px-2 py-0.5 hover:opacity-90">✓ Nivel</button>
        <button type="button" data-import-tier-clear class="text-[10px] font-semibold rounded-md border border-violet-300 dark:border-violet-800 bg-white/70 dark:bg-violet-950/30 px-2 py-0.5 hover:opacity-90">✗ Nivel</button>
      </span>`
          : "";
      return `<details data-import-tier-root="${tier}" class="concept-import-review-details border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-violet-50/40 dark:bg-violet-950/20 space-y-2 p-2 transition-[background-color,border-color,opacity] duration-150">
        <summary class="list-none flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
          <span class="flex min-w-0 flex-1 items-center gap-2">
            <span class="concept-import-review-chevron" aria-hidden="true">▸</span>
            <span class="min-w-0 text-sm font-bold text-violet-900 dark:text-violet-100">${esc(TIER_LABELS_ES[tier])} <span class="font-normal opacity-80">(${tierCount})</span></span>
          </span>
          ${tierBtn}
        </summary>
        <div class="space-y-2 pl-1">${inner}</div>
      </details>`;
    })
    .join("");

  const sel = (v: string, cur: string) => (v === cur ? " selected" : "");
  const tierSelect = `<label class="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
      <span>Nivel</span>
      <select data-import-tier-filter class="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-950 min-w-[11rem]">
        <option value="all"${sel("all", tierFilter)}>Todos los niveles</option>
        <option value="iniciacion"${sel("iniciacion", tierFilter)}>${esc(TIER_LABELS_ES.iniciacion)}</option>
        <option value="junior"${sel("junior", tierFilter)}>${esc(TIER_LABELS_ES.junior)}</option>
        <option value="mid"${sel("mid", tierFilter)}>${esc(TIER_LABELS_ES.mid)}</option>
        <option value="senior"${sel("senior", tierFilter)}>${esc(TIER_LABELS_ES.senior)}</option>
      </select>
    </label>`;

  const bulkBar = `<div class="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <span class="font-medium text-gray-500 dark:text-gray-400">Selección rápida</span>
      <button type="button" data-import-global-select class="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 font-semibold text-emerald-900 dark:text-emerald-200 hover:opacity-90">Todos visibles</button>
      <button type="button" data-import-global-clear class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-1 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800">Ninguno</button>
    </div>`;

  return `<div class="space-y-3">
    ${statsLine}
    <div class="flex flex-col gap-2">
    <div class="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
      <input type="search" data-import-filter placeholder="Filtrar por texto…" class="flex-1 min-w-48 text-sm border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-white dark:bg-gray-950" value="${esc(filter)}" />
      ${tierSelect}
    </div>
    ${bulkBar}
    </div>
    <details class="concept-import-review-details rounded-lg border border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 px-2 py-1.5">
      <summary class="cursor-pointer select-none text-[11px] text-gray-500 dark:text-gray-400 list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span class="concept-import-review-chevron text-[9px]" aria-hidden="true">▸</span>
        <span>Nota avanzada: niveles vía Markdown</span>
      </summary>
      <p class="m-0 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">Opcional: <code class="text-[10px]">&lt;!-- skillatlas-tier: junior --&gt;</code> antes de un <code class="text-[10px]">##</code>. Sin marca, todo va a «${esc(TIER_LABELS_ES.mid)}».</p>
    </details>
    <div class="space-y-3">${blocksHtml || `<p class="text-sm text-gray-600 dark:text-gray-400">No hay candidatos visibles con este filtro.</p>`}</div>
  </div>`;
}

export async function initConceptImport() {
  const rootEl = document.querySelector<HTMLElement>("[data-concept-import]");
  if (!rootEl) return;
  const root = rootEl;

  const technologyId = root.dataset.technologyId ?? "";
  const technologySlug = root.dataset.technologySlug ?? "";
  const technologyName = root.dataset.technologyName ?? "";
  if (!technologyId || !technologySlug) return;

  const feedback = root.querySelector<HTMLElement>("[data-import-feedback]");
  const urlInput = root.querySelector<HTMLInputElement>("[data-import-url]");
  const textArea = root.querySelector<HTMLTextAreaElement>("[data-import-text]");
  const sourceSelect = root.querySelector<HTMLSelectElement>("[data-import-source]");
  const btnChoose = root.querySelector<HTMLButtonElement>("[data-import-choose]");
  const btnQuick = root.querySelector<HTMLButtonElement>("[data-import-quick]");
  const btnLoadSeed = root.querySelector<HTMLButtonElement>("[data-import-load-seed]");
  const btnExpandText = root.querySelector<HTMLButtonElement>("[data-import-expand-text]");
  const reviewDialog = root.querySelector<HTMLDialogElement>("[data-import-review-dialog]");
  const reviewBody = root.querySelector<HTMLElement>("[data-import-review-body]");
  const btnImportSel = root.querySelector<HTMLButtonElement>("[data-import-selected]");
  const btnSelectNonDup = root.querySelector<HTMLButtonElement>("[data-import-select-nondup]");
  const enricher: ImportEnricher = defaultImportEnricher;

  const applyImportSource = (mode: "text" | "url" | "seed") => {
    const panelUrl = root.querySelector<HTMLElement>("[data-import-panel-url]");
    const panelText = root.querySelector<HTMLElement>("[data-import-panel-text]");
    const seedPanel = root.querySelector<HTMLElement>("[data-import-seed-panel]");
    if (mode === "url") {
      panelUrl?.removeAttribute("hidden");
      panelText?.setAttribute("hidden", "true");
      seedPanel?.setAttribute("hidden", "true");
    } else if (mode === "seed") {
      panelUrl?.setAttribute("hidden", "true");
      panelText?.setAttribute("hidden", "true");
      seedPanel?.removeAttribute("hidden");
    } else {
      panelUrl?.setAttribute("hidden", "true");
      panelText?.removeAttribute("hidden");
      seedPanel?.setAttribute("hidden", "true");
    }
  };

  let latestCandidates: ImportCandidate[] = [];
  let latestStats: ParseStats = { rawLines: 0, rejectedByQuality: 0, reasons: {} };
  let filterText = "";
  let reviewTierFilter: ConceptTier | "all" = "all";

  const supabaseClient = getSupabaseBrowserClient();
  if (!supabaseClient) {
    if (feedback) {
      feedback.textContent = "No hay cliente Supabase.";
      feedback.className = "text-sm text-red-600 dark:text-red-400";
    }
    return;
  }
  const supabase = supabaseClient;

  const userIdRaw = await getSessionUserId(supabase);
  if (!userIdRaw) {
    if (feedback) {
      feedback.textContent = "Inicia sesión para importar conceptos.";
      feedback.className = "text-sm text-amber-600 dark:text-amber-400";
    }
    btnChoose?.setAttribute("disabled", "true");
    btnQuick?.setAttribute("disabled", "true");
    btnLoadSeed?.setAttribute("disabled", "true");
    btnExpandText?.setAttribute("disabled", "true");
    sourceSelect?.setAttribute("disabled", "true");
    return;
  }
  const userId = userIdRaw;

  function openReviewDialog() {
    if (!reviewDialog || latestCandidates.length === 0) return;
    rerenderReview();
    const importDetails = root.querySelector("details");
    importDetails?.setAttribute("open", "");
    try {
      if (typeof reviewDialog.showModal === "function") {
        reviewDialog.showModal();
      } else {
        showToast("Tu navegador no soporta el modal de revisión.", "error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo abrir el modal de revisión.";
      showToast(msg, "error");
    }
  }

  function closeReviewDialog() {
    reviewDialog?.close();
  }

  async function loadExistingTitleSet() {
    const res = await supabase
      .from("concepts")
      .select("title")
      .eq("technology_id", technologyId);
    const set = new Set<string>();
    for (const row of res.data ?? []) {
      set.add(String((row as { title: string }).title).trim().toLowerCase());
    }
    return set;
  }

  async function buildCandidatesFromInputs(): Promise<boolean> {
    if (feedback) {
      feedback.textContent = "";
      feedback.className = "text-sm text-gray-600 dark:text-gray-300";
    }

    let body = "";
    const srcVal = sourceSelect?.value ?? "text";
    const mode = srcVal === "url" ? "url" : "text";

    if (mode === "url") {
      const url = urlInput?.value.trim() ?? "";
      if (!url) {
        if (feedback) {
          feedback.textContent = "Pega una URL.";
          feedback.className = "text-sm text-amber-600";
        }
        return false;
      }
      if (feedback) feedback.textContent = "Descargando…";
      const fetched = await fetchUrlText(url);
      if (!fetched.ok) {
        if (feedback) {
          feedback.textContent = fetched.message;
          feedback.className = "text-sm text-red-600 dark:text-red-400";
        }
        return false;
      }
      body = fetched.text;
    } else {
      body = textArea?.value.trim() ?? "";
      if (!body) {
        if (feedback) {
          feedback.textContent =
            srcVal === "seed"
              ? "Espera a que cargue el catálogo SkillAtlas, recarga la plantilla o cambia el origen."
              : "Pega Markdown con ## y listas, o elige URL.";
          feedback.className = "text-sm text-amber-600 dark:text-amber-400";
        }
        return false;
      }
    }

    const parsed = parseDocumentToLines(body);
    const { candidates: base, stats } = linesToImportCandidates(parsed);
    const withIds: ImportCandidate[] = base.map((c) => ({
      ...c,
      id: uid(),
      duplicateOfExisting: false,
    }));

    const existing = await loadExistingTitleSet();
    latestStats = stats;
    const ctx: ImportContext = { technologyName, technologySlug, userId };
    latestCandidates = await enricher(withIds, ctx);
    latestCandidates = markDuplicates(latestCandidates, existing);

    if (feedback) {
      feedback.textContent = `${latestCandidates.length} candidatos · ${stats.rejectedByQuality} omitidos por calidad · ${latestCandidates.filter((c) => c.duplicateOfExisting).length} ya existen`;
      feedback.className = "text-sm text-gray-600 dark:text-gray-300";
    }

    filterText = "";
    reviewTierFilter = "all";
    if (reviewBody) {
      if (latestCandidates.length > 0) {
        rerenderReview();
      } else {
        reviewBody.innerHTML = "";
      }
    }
    btnImportSel?.toggleAttribute("disabled", latestCandidates.length === 0);
    return latestCandidates.length > 0;
  }

  function rerenderReview() {
    if (!reviewBody) return;
    reviewBody.innerHTML = renderReviewHtml(latestCandidates, latestStats, filterText, reviewTierFilter);
    bindReviewListeners();
    syncReviewBlockMutedState(reviewBody);
  }

  function bindReviewListeners() {
    const filterInput = reviewBody?.querySelector<HTMLInputElement>("[data-import-filter]");
    const tierSel = reviewBody?.querySelector<HTMLSelectElement>("[data-import-tier-filter]");
    filterInput?.addEventListener("input", () => {
      filterText = filterInput.value;
      rerenderReview();
    });
    tierSel?.addEventListener("change", () => {
      const v = tierSel.value;
      reviewTierFilter = v === "all" ? "all" : (v as ConceptTier);
      rerenderReview();
    });
  }

  function bindBulkReviewListeners() {
    if (!reviewDialog) return;
    if (reviewDialog.dataset.saBulkBound === "1") return;
    reviewDialog.dataset.saBulkBound = "1";
    reviewDialog.addEventListener("click", (e) => {
      const el = e.target as HTMLElement;
      const btn = el.closest<HTMLButtonElement>(
        "[data-import-cat-select],[data-import-cat-clear],[data-import-tier-select],[data-import-tier-clear],[data-import-global-select],[data-import-global-clear]",
      );
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.hasAttribute("data-import-cat-select") || btn.hasAttribute("data-import-cat-clear")) {
        const details = btn.closest("details[data-import-category-block]");
        if (!details) return;
        const check = btn.hasAttribute("data-import-cat-select");
        details.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-import-candidate-id]").forEach((cb) => {
          cb.checked = check;
        });
        syncReviewBlockMutedState(reviewBody);
        return;
      }
      if (btn.hasAttribute("data-import-tier-select") || btn.hasAttribute("data-import-tier-clear")) {
        const tierRoot = btn.closest("details[data-import-tier-root]");
        if (!tierRoot) return;
        const check = btn.hasAttribute("data-import-tier-select");
        tierRoot.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-import-candidate-id]").forEach((cb) => {
          cb.checked = check;
        });
        syncReviewBlockMutedState(reviewBody);
        return;
      }
      if (btn.hasAttribute("data-import-global-select") || btn.hasAttribute("data-import-global-clear")) {
        const check = btn.hasAttribute("data-import-global-select");
        reviewBody?.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-import-candidate-id]").forEach((cb) => {
          cb.checked = check;
        });
        syncReviewBlockMutedState(reviewBody);
      }
    });
  }

  bindBulkReviewListeners();

  if (reviewDialog && reviewDialog.dataset.saReviewCheckboxBound !== "1") {
    reviewDialog.dataset.saReviewCheckboxBound = "1";
    reviewDialog.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.type !== "checkbox") return;
      if (!t.hasAttribute("data-import-candidate-id")) return;
      syncReviewBlockMutedState(reviewBody);
    });
  }

  btnExpandText?.addEventListener("click", async () => {
    const next = await markdownEditorModal({
      title: "Texto Markdown del import",
      initialMarkdown: textArea?.value ?? "",
      confirmLabel: "Aplicar",
    });
    if (next === null) return;
    if (textArea) textArea.value = next;
    showToast("Texto actualizado.", "info");
  });

  btnLoadSeed?.addEventListener("click", async () => {
    if (!hasConceptSeed(technologySlug)) return;
    btnLoadSeed.disabled = true;
    try {
      const path = conceptSeedPublicPath(technologySlug);
      const res = await fetch(path);
      if (!res.ok) {
        showToast(`No se pudo cargar la plantilla (${res.status}).`, "error");
        return;
      }
      const text = await res.text();
      if (textArea) textArea.value = text;
      if (feedback) {
        feedback.textContent =
          "Plantilla lista. Usa «Revisar e importar…» para el modal, o «Importar todo lo nuevo» para crear de una vez.";
        feedback.className = "text-sm text-emerald-900 dark:text-emerald-200/90";
      }
      showToast("Plantilla SkillAtlas cargada.", "success");
    } finally {
      btnLoadSeed.disabled = false;
    }
  });

  sourceSelect?.addEventListener("change", () => {
    const v = sourceSelect.value;
    if (v === "url" || v === "seed") applyImportSource(v);
    else applyImportSource("text");
  });
  applyImportSource(
    sourceSelect?.value === "url" ? "url" : sourceSelect?.value === "seed" ? "seed" : "text",
  );

  reviewDialog?.querySelector<HTMLButtonElement>("[data-import-review-dialog-close]")?.addEventListener("click", () => {
    closeReviewDialog();
  });
  reviewDialog?.addEventListener("click", (e) => {
    if (e.target === reviewDialog) closeReviewDialog();
  });

  btnChoose?.addEventListener("click", async () => {
    btnChoose.disabled = true;
    try {
      const ok = await buildCandidatesFromInputs();
      if (ok) openReviewDialog();
    } finally {
      btnChoose.disabled = false;
    }
  });

  btnQuick?.addEventListener("click", async () => {
    btnQuick.disabled = true;
    try {
      const ok = await buildCandidatesFromInputs();
      if (!ok) return;
      const toImport = latestCandidates.filter((c) => !c.duplicateOfExisting);
      if (toImport.length === 0) {
        showToast("No hay candidatos nuevos para importar.", "info");
        return;
      }
      const accepted = await confirmModal({
        title: "Importar sin abrir la lista",
        description: `Se crearán ${toImport.length} conceptos nuevos de una vez (los que ya existan con el mismo título se saltan). Es la opción rápida frente a «Revisar e importar…».`,
        confirmLabel: "Sí, importar ahora",
        danger: false,
      });
      if (!accepted) return;
      const ins = await insertConcepts(
        supabase,
        userId,
        technologyId,
        toImport.map((c) => ({ title: c.title, notes: c.notes })),
      );
      if (ins.error) {
        showToast(ins.error, "error");
        return;
      }
      showToast(`${toImport.length} conceptos creados.`, "success");
      latestCandidates = [];
      closeReviewDialog();
      if (reviewBody) reviewBody.innerHTML = "";
      if (feedback) feedback.textContent = "";
      await persistRefreshDom(supabase, technologyId);
    } finally {
      btnQuick.disabled = false;
    }
  });

  btnSelectNonDup?.addEventListener("click", () => {
    reviewDialog?.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-import-candidate-id]").forEach((cb) => {
      const id = cb.dataset.importCandidateId;
      const c = latestCandidates.find((x) => x.id === id);
      cb.checked = !(c?.duplicateOfExisting ?? false);
    });
    syncReviewBlockMutedState(reviewBody);
  });

  btnImportSel?.addEventListener("click", async () => {
    if (!reviewDialog) return;
    const selected: { title: string; notes: string }[] = [];
    for (const c of latestCandidates) {
      const cb = reviewDialog.querySelector<HTMLInputElement>(`input[type=checkbox][data-import-candidate-id="${c.id}"]`);
      if (!cb?.checked) continue;
      const titleInput = reviewDialog.querySelector<HTMLInputElement>(`[data-import-title="${c.id}"]`);
      const title = titleInput?.value.trim() ?? c.title;
      if (!title) continue;
      const q = assessTitleQuality(title);
      if (!q.ok) continue;
      selected.push({ title, notes: c.notes });
    }
    if (selected.length === 0) {
      showToast("Selecciona al menos un candidato válido.", "info");
      return;
    }

    const existing = await loadExistingTitleSet();
    const deduped = selected.filter((r) => !existing.has(r.title.trim().toLowerCase()));
    if (deduped.length < selected.length) {
      const ok = await confirmModal({
        title: "Algunos títulos ya existen",
        description: `Se omitirán ${selected.length - deduped.length} filas duplicadas. ¿Continuar con ${deduped.length}?`,
        confirmLabel: "Sí, importar",
      });
      if (!ok) return;
    }
    if (deduped.length === 0) {
      showToast("Nada nuevo que importar.", "info");
      return;
    }

    btnImportSel.disabled = true;
    const ins = await insertConcepts(supabase, userId, technologyId, deduped);
    btnImportSel.disabled = false;
    if (ins.error) {
      showToast(ins.error, "error");
      return;
    }
    showToast(`${deduped.length} conceptos creados.`, "success");
    latestCandidates = [];
    closeReviewDialog();
    if (reviewBody) reviewBody.innerHTML = "";
    if (feedback) feedback.textContent = "";
    await persistRefreshDom(supabase, technologyId);
  });

  async function autoLoadSeedAndParse() {
    if (!hasConceptSeed(technologySlug)) return;
    if (sourceSelect?.value !== "seed") return;
    if (textArea?.value.trim()) return;
    try {
      const path = conceptSeedPublicPath(technologySlug);
      const res = await fetch(path);
      if (!res.ok) return;
      const text = await res.text();
      if (textArea) textArea.value = text;
      if (feedback) {
        feedback.textContent =
          "Catálogo SkillAtlas cargado. Pulsa «Revisar e importar…» para el modal o «Importar todo lo nuevo» para ir directo.";
        feedback.className = "text-sm text-emerald-900 dark:text-emerald-200/90";
      }
    } catch {
      /* ignore */
    }
  }

  void autoLoadSeedAndParse();
}
