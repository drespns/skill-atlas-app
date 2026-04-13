import i18next from "i18next";
import { esc } from "../study-text";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

const STUDY_CODE_LANG_SELECT_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["typescript", "TypeScript"],
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["sql", "SQL"],
  ["bash", "Bash / shell"],
  ["json", "JSON"],
  ["html", "HTML"],
  ["css", "CSS"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["java", "Java"],
  ["csharp", "C#"],
  ["cpp", "C / C++"],
  ["plaintext", "Plain text"],
];

export function buildUserNoteCodeLanguageSelectHtml(selectedRaw: string | null | undefined): string {
  const dbVal = String(selectedRaw ?? "").trim();
  let html = `<option value=""${dbVal === "" ? " selected" : ""}>${esc(tt("study.codeLangPlain", "Plain text"))}</option>`;
  for (const [v, label] of STUDY_CODE_LANG_SELECT_OPTIONS) {
    html += `<option value="${esc(v)}"${dbVal === v ? " selected" : ""}>${esc(label)}</option>`;
  }
  return html;
}
