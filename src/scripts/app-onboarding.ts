import { showToast } from "./ui-feedback";

function init() {
  const btns = document.querySelectorAll<HTMLButtonElement>("[data-onboarding-start]");
  const v2Btn = document.querySelector<HTMLButtonElement>("[data-onboarding-v2-start]");
  const guard = document.querySelector<HTMLElement>("[data-requires-auth]");
  if (btns.length === 0 && !v2Btn) return;

  // If the page is not authed, the guard is shown by client.ts and we keep this button disabled.
  // (In practice /app is protected anyway.)
  const notAuthed = Boolean(guard && !guard.classList.contains("hidden"));

  btns.forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    if (notAuthed) btn.disabled = true;
    btn.addEventListener("click", () => {
      window.dispatchEvent(new Event("skillatlas:onboarding-start"));
      showToast("Onboarding reiniciado.", "success");
    });
  });

  if (v2Btn && v2Btn.dataset.bound !== "1") {
    v2Btn.dataset.bound = "1";
    if (notAuthed) v2Btn.disabled = true;
    v2Btn.addEventListener("click", () => {
      window.dispatchEvent(new Event("skillatlas:onboarding-v2-start"));
      showToast("Onboarding avanzado iniciado.", "success");
    });
  }
}

const boot = () => init();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

