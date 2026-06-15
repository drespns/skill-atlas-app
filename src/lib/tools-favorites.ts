/**
 * Metadatos del hub `/tools`: ids alineados con `src/pages/tools/index.astro`.
 * `titleKey` → `src/i18n/*.json` (mismo prefijo que el popover de cabecera).
 */
export const TOOL_HUB_ENTRIES = [
  { id: "expense-tracker", titleKey: "tools.expenseTrackerTitle" },
  { id: "habits", titleKey: "tools.habitsTitle" },
  { id: "convert", titleKey: "tools.convertTitle" },
  { id: "readme-preview", titleKey: "tools.readmePreviewTitle" },
  { id: "bio-builder", titleKey: "tools.bioBuilderTitle" },
  { id: "title-normalize", titleKey: "tools.titleNormalizeTitle" },
  { id: "interview-prep", titleKey: "tools.interviewPrepTitle" },
  { id: "pomodoro", titleKey: "tools.pomodoroTitle" },
  { id: "talk-timer", titleKey: "tools.talkTimerTitle" },
  { id: "text-diff", titleKey: "tools.textDiffTitle" },
  { id: "playground", titleKey: "tools.playgroundTitle" },
  { id: "json-format", titleKey: "tools.jsonFormatTitle" },
  { id: "code-snippet-html", titleKey: "tools.codeSnippetHtmlTitle" },
  { id: "salary-estimate", titleKey: "tools.salaryEstimateTitle" },
  { id: "gitignore-builder", titleKey: "tools.gitignoreBuilderTitle" },
  { id: "cron", titleKey: "tools.cronTitle" },
  { id: "qr-generator", titleKey: "tools.qrGeneratorTitle" },
] as const;

export type ToolHubId = (typeof TOOL_HUB_ENTRIES)[number]["id"];

export const TOOL_HUB_IDS = TOOL_HUB_ENTRIES.map((e) => e.id) as readonly ToolHubId[];

const HUB_ID_SET = new Set<string>(TOOL_HUB_IDS);

const TITLE_KEY_BY_ID: Record<string, string> = Object.fromEntries(TOOL_HUB_ENTRIES.map((e) => [e.id, e.titleKey]));

const MAX_FAVORITES = 12;

/** Normaliza lista de favoritos: solo ids conocidos, sin duplicados, orden conservado. */
export function normalizeFavoriteToolIds(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id || !HUB_ID_SET.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out.length > 0 ? out : undefined;
}

export function isFavoriteToolId(id: string): boolean {
  return HUB_ID_SET.has(id);
}

export function toggleFavoriteToolId(current: string[] | undefined, id: string): string[] {
  if (!isFavoriteToolId(id)) return current ?? [];
  const cur = [...(current ?? [])];
  const i = cur.indexOf(id);
  if (i >= 0) {
    cur.splice(i, 1);
    return cur;
  }
  if (cur.length >= MAX_FAVORITES) return cur;
  cur.push(id);
  return cur;
}

export function toolHubTitleKey(id: string): string | undefined {
  return TITLE_KEY_BY_ID[id];
}

export function toolHubHref(id: string): string {
  return `/tools/${id}`;
}
