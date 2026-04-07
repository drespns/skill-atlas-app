export function initCommandPaletteTrigger() {
  const btn = document.querySelector<HTMLButtonElement>("[data-command-palette-trigger]");
  if (!btn) return;
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => window.dispatchEvent(new Event("skillatlas:open-palette")));

  // Ajusta el texto del atajo en atributos (placeholder/aria/title quedan en i18n sin shortcut).
  try {
    const isApple = document.documentElement.dataset.platform === "apple";
    const shortcut = isApple ? "⌘K" : "Ctrl+K";
    const aria = btn.getAttribute("aria-label") || btn.getAttribute("title");
    if (aria && !aria.includes(shortcut)) {
      const next = `${aria} (${shortcut})`;
      btn.setAttribute("aria-label", next);
      btn.setAttribute("title", next);
    }
  } catch {
    // ignore
  }
}
