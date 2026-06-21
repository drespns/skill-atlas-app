/** Modal nativo: amplía una sección recurrente al click en el header. */

type SectionModalState = {
  panel: HTMLElement;
  bodyHost: HTMLElement;
  body: HTMLElement | null;
};

let active: SectionModalState | null = null;

export function bindSectionModal(root: HTMLElement) {
  const dlg = root.querySelector<HTMLDialogElement>("[data-et-section-modal]");
  const modalBody = root.querySelector<HTMLElement>("[data-et-section-modal-body]");
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-et-section-modal-close]");
  if (!dlg || !modalBody) return;

  const close = () => {
    if (!active) {
      dlg.close();
      return;
    }
    const { panel, bodyHost, body } = active;
    if (body && bodyHost) bodyHost.appendChild(body);
    active = null;
    dlg.close();
    const titleEl = root.querySelector<HTMLElement>("[data-et-section-modal-title]");
    const iconEl = root.querySelector<HTMLElement>("[data-et-section-modal-icon]");
    if (titleEl) titleEl.textContent = "";
    if (iconEl) iconEl.innerHTML = "";
  };

  closeBtn?.addEventListener("click", close);
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close();
  });

  for (const panel of root.querySelectorAll<HTMLElement>("[data-et-section-panel]")) {
    const sectionId = panel.dataset.etSectionPanel;
    if (!sectionId) continue;
    const header = panel.querySelector<HTMLElement>("[data-et-section-header]");
    const body = panel.querySelector<HTMLElement>("[data-et-section-body]");
    if (!header || !body) continue;

    header.classList.add("cursor-pointer");
    header.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [data-et-no-section-modal]")) {
        return;
      }
      const title = panel.querySelector("h2")?.textContent?.trim() ?? "";
      const iconHtml = panel.querySelector(".et-section-icon")?.innerHTML ?? "";
      const titleEl = root.querySelector<HTMLElement>("[data-et-section-modal-title]");
      const iconEl = root.querySelector<HTMLElement>("[data-et-section-modal-icon]");
      if (titleEl) titleEl.textContent = title;
      if (iconEl) iconEl.innerHTML = iconHtml;

      const bodyHost = body.parentElement;
      if (!bodyHost) return;
      active = { panel, bodyHost, body };
      modalBody.appendChild(body);
      dlg.showModal();
    });
  }
}
