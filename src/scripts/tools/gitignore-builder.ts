import { GITIGNORE_PARTS } from "@lib/tools-gitignore-parts";

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-gitignore-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const host = root.querySelector<HTMLElement>("[data-gi-checks]");
  const out = root.querySelector<HTMLTextAreaElement>("[data-gi-out]");
  const btnCopy = root.querySelector<HTMLButtonElement>("[data-gi-copy]");
  const btnDl = root.querySelector<HTMLButtonElement>("[data-gi-dl]");

  if (host) {
    for (const p of GITIGNORE_PARTS) {
      const lab = document.createElement("label");
      lab.className = "flex items-start gap-2 rounded-lg border border-gray-200/80 dark:border-gray-800 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "mt-0.5 accent-indigo-600";
      cb.dataset.giId = p.id;
      cb.addEventListener("change", build);
      const span = document.createElement("span");
      span.className = "text-sm text-gray-800 dark:text-gray-200";
      span.textContent = p.label;
      lab.append(cb, span);
      host.appendChild(lab);
    }
  }

  function build() {
    if (!out) return;
    const selected = GITIGNORE_PARTS.filter((p) => {
      const el = host?.querySelector<HTMLInputElement>(`[data-gi-id="${p.id}"]`);
      return el?.checked;
    });
    const header = `# Generated with SkillAtlas · ${new Date().toISOString().slice(0, 10)}\n\n`;
    out.value = header + selected.map((p) => p.body.trim()).join("\n\n");
  }

  root.querySelector<HTMLButtonElement>("[data-gi-build]")?.addEventListener("click", build);

  btnCopy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(out?.value ?? "");
    } catch {
      /* ignore */
    }
  });

  btnDl?.addEventListener("click", () => {
    const blob = new Blob([out?.value ?? ""], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = ".gitignore";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  build();
}

init();
