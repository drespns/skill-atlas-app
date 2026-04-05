export function initLayoutVars() {
  const header = document.querySelector<HTMLElement>("[data-app-header]");
  if (!header) return;

  const apply = () => {
    const h = header.offsetHeight;
    document.documentElement.style.setProperty("--app-header-h", `${h}px`);
  };

  apply();
  window.addEventListener("resize", apply);
}
