import i18next from "i18next";
import { showToast } from "@scripts/core/ui-feedback";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function init() {
  const btns = document.querySelectorAll<HTMLButtonElement>("[data-guided-tour-start]");
  const guard = document.querySelector<HTMLElement>("[data-requires-auth]");
  if (btns.length === 0) return;

  const notAuthed = Boolean(guard && !guard.classList.contains("hidden"));

  btns.forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    if (notAuthed) btn.disabled = true;
    btn.addEventListener("click", () => {
      window.dispatchEvent(new Event("skillatlas:guided-tour-start"));
      showToast(tt("guidedTour.openedFromDashboard", "Recorrido abierto."), "success");
    });
  });
}

const boot = () => init();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);
