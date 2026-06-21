/** Bloqueo de scroll de página al abrir modales nativos (sin salto al cerrar). */

let lockCount = 0;
let savedScrollY = 0;

export function lockPageScroll() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

export function unlockPageScroll() {
  if (lockCount <= 0) return;
  lockCount--;
  if (lockCount > 0) return;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  window.scrollTo(0, savedScrollY);
}

/** Parchea showModal/close en todos los dialog bajo la página de gastos. */
export function bindExpenseDialogScrollLock(root: HTMLElement) {
  if (root.dataset.etDialogScrollLock === "1") return;
  root.dataset.etDialogScrollLock = "1";

  root.querySelectorAll<HTMLDialogElement>("dialog").forEach((dlg) => {
    if (dlg.dataset.etScrollLockPatched === "1") return;
    dlg.dataset.etScrollLockPatched = "1";

    const nativeShow = dlg.showModal.bind(dlg);
    const nativeClose = dlg.close.bind(dlg);

    dlg.showModal = () => {
      lockPageScroll();
      nativeShow();
    };

    dlg.close = (...args: Parameters<HTMLDialogElement["close"]>) => {
      nativeClose(...args);
      unlockPageScroll();
    };

    dlg.addEventListener("cancel", () => {
      queueMicrotask(() => {
        if (!dlg.open) unlockPageScroll();
      });
    });
  });
}
