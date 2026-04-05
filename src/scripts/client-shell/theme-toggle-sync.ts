/** Sincroniza `aria-pressed` del botón de tema con la clase `.dark` efectiva en `<html>`. */
export function syncThemeToggleAria() {
  const themeBtn = document.querySelector<HTMLElement>("[data-theme-toggle]");
  if (!themeBtn) return;
  themeBtn.setAttribute(
    "aria-pressed",
    document.documentElement.classList.contains("dark") ? "true" : "false",
  );
}
