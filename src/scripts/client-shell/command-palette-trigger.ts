export function initCommandPaletteTrigger() {
  const btn = document.querySelector<HTMLButtonElement>("[data-command-palette-trigger]");
  if (!btn) return;
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => window.dispatchEvent(new Event("skillatlas:open-palette")));
}
