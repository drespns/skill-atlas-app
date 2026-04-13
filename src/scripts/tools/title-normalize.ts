function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripEmojis(s: string): string {
  return s.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}

function titleCase(s: string): string {
  const small = new Set(["a", "an", "and", "as", "at", "but", "by", "de", "del", "en", "for", "if", "in", "la", "las", "lo", "los", "nor", "o", "of", "on", "or", "the", "to", "vs", "y"]);
  return s
    .split(/\s+/)
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i > 0 && small.has(lw)) return lw;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-title-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const inp = root.querySelector<HTMLInputElement>("[data-title-in]");
  const strip = root.querySelector<HTMLInputElement>("[data-title-strip-emoji]");
  const tc = root.querySelector<HTMLInputElement>("[data-title-case]");
  const maxLen = root.querySelector<HTMLInputElement>("[data-title-max]");
  const outNorm = root.querySelector<HTMLElement>("[data-title-out-norm]");
  const outSlug = root.querySelector<HTMLElement>("[data-title-out-slug]");

  const run = () => {
    let t = (inp?.value ?? "").trim();
    if (strip?.checked) t = stripEmojis(t);
    if (tc?.checked) t = titleCase(t);
    const mx = Math.min(120, Math.max(10, Number(maxLen?.value) || 80));
    if (t.length > mx) t = `${t.slice(0, mx - 1)}…`;
    if (outNorm) outNorm.textContent = t || "—";
    if (outSlug) outSlug.textContent = t ? slugify(t) || "—" : "—";
  };

  inp?.addEventListener("input", run);
  strip?.addEventListener("change", run);
  tc?.addEventListener("change", run);
  maxLen?.addEventListener("input", run);
  run();
}

init();
