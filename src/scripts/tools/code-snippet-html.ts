function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-snippet-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const code = root.querySelector<HTMLTextAreaElement>("[data-snippet-code]");
  const lang = root.querySelector<HTMLSelectElement>("[data-snippet-lang]");
  const preClass = root.querySelector<HTMLInputElement>("[data-snippet-pre-class]");
  const out = root.querySelector<HTMLTextAreaElement>("[data-snippet-out]");
  const btn = root.querySelector<HTMLButtonElement>("[data-snippet-gen]");
  const copy = root.querySelector<HTMLButtonElement>("[data-snippet-copy]");

  const run = () => {
    const raw = code?.value ?? "";
    const l = (lang?.value ?? "text").trim() || "text";
    const pc = (preClass?.value ?? "").trim();
    const inner = esc(raw);
    const codeClass = l === "text" ? "" : ` class="language-${l}"`;
    const preCls = pc ? ` class="${esc(pc)}"` : "";
    const html = `<pre${preCls}><code${codeClass}>${inner}</code></pre>`;
    if (out) out.value = html;
  };

  btn?.addEventListener("click", run);
  copy?.addEventListener("click", async () => {
    const t = out?.value ?? "";
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      /* ignore */
    }
  });
}

init();
