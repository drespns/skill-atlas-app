import { diffLines } from "diff";

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-diff-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const a = root.querySelector<HTMLTextAreaElement>("[data-diff-a]");
  const b = root.querySelector<HTMLTextAreaElement>("[data-diff-b]");
  const out = root.querySelector<HTMLElement>("[data-diff-out]");
  const btn = root.querySelector<HTMLButtonElement>("[data-diff-run]");

  const run = () => {
    if (!out) return;
    const parts = diffLines((a?.value ?? "").replace(/\r\n/g, "\n"), (b?.value ?? "").replace(/\r\n/g, "\n"));
    out.replaceChildren();
    const pre = document.createElement("pre");
    pre.className =
      "m-0 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 text-xs font-mono overflow-auto max-h-[32rem] whitespace-pre-wrap break-words";
    for (const p of parts) {
      const span = document.createElement("span");
      if (p.added) {
        span.className = "bg-emerald-200/80 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100";
        span.textContent = `+ ${p.value}`;
      } else if (p.removed) {
        span.className = "bg-rose-200/80 dark:bg-rose-900/40 text-rose-950 dark:text-rose-100";
        span.textContent = `- ${p.value}`;
      } else {
        span.className = "text-gray-600 dark:text-gray-400";
        span.textContent = `  ${p.value}`;
      }
      pre.appendChild(span);
    }
    out.appendChild(pre);
  };

  btn?.addEventListener("click", run);
}

init();
