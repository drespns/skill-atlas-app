import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue/i18n";

export type CronLocale = "es" | "en";

export type CronAnalyzeResult =
  | { ok: true; normalized: string; human: string; next: Date[] }
  | { ok: false; normalized: string; parseError: string };

const RANDOM_EXAMPLES = [
  "0 9 * * 1-5",
  "*/15 * * * *",
  "0 0 * * 0",
  "0 */6 * * *",
  "30 14 1 * *",
  "0 0 1 */3 *",
  "@daily",
  "@hourly",
  "@weekly",
  "@monthly",
  "15,45 * * * *",
  "0 8-18/2 * * 1-5",
] as const;

export function normalizeCronInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function randomCronExample(): string {
  const i = Math.floor(Math.random() * RANDOM_EXAMPLES.length);
  return RANDOM_EXAMPLES[i]!;
}

/**
 * Analiza expresión (formato cron-parser: 5 o 6 campos, alias @daily, etc.).
 * `timeZone` IANA, p. ej. `Europe/Madrid`.
 */
export function analyzeCron(expr: string, locale: CronLocale, timeZone: string, nextCount = 16): CronAnalyzeResult {
  const normalized = normalizeCronInput(expr);
  if (!normalized) {
    return { ok: false, normalized: "", parseError: "empty" };
  }
  try {
    const iter = CronExpressionParser.parse(normalized, {
      currentDate: new Date(),
      tz: timeZone,
    });
    const taken = iter.take(Math.max(1, nextCount));
    const next = taken.map((d) => d.toDate());
    let human = "";
    try {
      human = cronstrue.toString(normalized, {
        locale: locale === "es" ? "es" : "en",
        use24HourTimeFormat: true,
        throwExceptionOnParseError: true,
      });
    } catch {
      human = "";
    }
    return { ok: true, normalized, human, next };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, normalized, parseError: msg || "invalid" };
  }
}
