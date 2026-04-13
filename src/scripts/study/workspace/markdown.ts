import { marked } from "marked";

export function renderMarkdownSafe(md: string): string {
  const raw = marked.parse(md, { async: false, breaks: true, gfm: true });
  const str = typeof raw === "string" ? raw : String(raw);
  const shell = document.createElement("div");
  shell.innerHTML = str;
  shell.querySelectorAll("script,iframe,object,link,meta").forEach((el) => el.remove());
  return shell.innerHTML;
}
