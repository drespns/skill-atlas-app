/**
 * Modal de ajustes del documento CV (animación + foco + bloqueo scroll).
 */

export function bindCvSettingsModal(opts: {
  onOpen?: () => void;
  onClose?: () => void;
}): void {
  const root = document.querySelector<HTMLElement>("[data-cv-settings-modal]");
  const openBtn = document.querySelector<HTMLButtonElement>("[data-cv-settings-open]");
  const backdrop = document.querySelector<HTMLElement>("[data-cv-settings-backdrop]");
  const panel = document.querySelector<HTMLElement>("[data-cv-settings-panel]");
  const closeBtn = document.querySelector<HTMLButtonElement>("[data-cv-settings-close]");
  if (!root || !openBtn || !backdrop || !panel || !closeBtn) return;
  if (root.dataset.cvSettingsBound === "1") return;
  root.dataset.cvSettingsBound = "1";

  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const open = () => {
    opts.onOpen?.();
    root.classList.remove("hidden");
    root.classList.add("flex");
    document.body.style.overflow = "hidden";
    backdrop.classList.remove("opacity-100");
    backdrop.classList.add("opacity-0");
    panel.classList.remove("opacity-100", "scale-100", "translate-y-0");
    panel.classList.add("opacity-0", "scale-95", "translate-y-3");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.remove("opacity-0");
        backdrop.classList.add("opacity-100");
        panel.classList.remove("opacity-0", "scale-95", "translate-y-3");
        panel.classList.add("opacity-100", "scale-100", "translate-y-0");
        if (reduceMotion()) closeBtn.focus();
        else window.setTimeout(() => closeBtn.focus(), 180);
      });
    });
  };

  const close = () => {
    backdrop.classList.remove("opacity-100");
    backdrop.classList.add("opacity-0");
    panel.classList.remove("opacity-100", "scale-100", "translate-y-0");
    panel.classList.add("opacity-0", "scale-95", "translate-y-3");
    const done = () => {
      root.classList.add("hidden");
      root.classList.remove("flex");
      document.body.style.overflow = "";
      opts.onClose?.();
    };
    if (reduceMotion()) done();
    else window.setTimeout(done, 260);
  };

  openBtn.addEventListener("click", () => open());
  closeBtn.addEventListener("click", () => close());
  backdrop.addEventListener("click", () => close());
  root.addEventListener("click", (e) => {
    if (e.target === root) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (root.classList.contains("hidden")) return;
    close();
    openBtn.focus();
  });
}
