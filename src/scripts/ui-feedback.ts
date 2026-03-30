type ToastType = "success" | "error" | "info";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getToastRoot() {
  let root = document.querySelector<HTMLElement>("[data-toast-root]");
  if (!root) {
    root = document.createElement("div");
    root.setAttribute("data-toast-root", "true");
    root.className = "fixed bottom-4 right-4 z-[1000] flex flex-col gap-2";
    document.body.appendChild(root);
  }
  return root;
}

export function showToast(message: string, type: ToastType = "info") {
  const root = getToastRoot();
  const node = document.createElement("div");

  const tone =
    type === "success"
      ? "bg-green-600 text-white"
      : type === "error"
        ? "bg-red-600 text-white"
        : "bg-gray-900 text-white";

  node.className = `rounded-lg px-3 py-2 text-sm shadow-lg flex items-center gap-2 transition-all duration-200 ease-out opacity-0 translate-y-2 ${tone}`;
  node.innerHTML = `<span>${message}</span><button type="button" data-toast-close class="ml-1 text-white/90 hover:text-white">×</button>`;
  root.appendChild(node);
  requestAnimationFrame(() => {
    node.classList.remove("opacity-0", "translate-y-2");
  });

  node.querySelector("[data-toast-close]")?.addEventListener("click", () => {
    node.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => node.remove(), 180);
  });

  setTimeout(() => {
    node.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => node.remove(), 180);
  }, 6000);
}

function getModalRoot() {
  let root = document.querySelector<HTMLElement>("[data-modal-root]");
  if (!root) {
    root = document.createElement("div");
    root.setAttribute("data-modal-root", "true");
    root.className = "fixed inset-0 z-[999] hidden items-center justify-center p-4";
    document.body.appendChild(root);
  }
  return root;
}

export function confirmModal(options: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<boolean>((resolve) => {
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold">${options.title}</h3>
        ${options.description ? `<p class="m-0 text-sm text-gray-600 dark:text-gray-300">${options.description}</p>` : ""}
        <div class="flex justify-end gap-2">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">${options.cancelLabel ?? "Cancelar"}</button>
          <button data-modal-confirm type="button" class="rounded-lg px-3 py-2 text-sm font-semibold ${
            options.danger
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }">${options.confirmLabel ?? "Confirmar"}</button>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const cleanup = (value: boolean) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(false));
    root.querySelector("[data-modal-confirm]")?.addEventListener("click", () => cleanup(true));
  });
}

/** Modal con textarea amplia para pegar o editar Markdown (importación de conceptos). */
export function markdownEditorModal(options: {
  title: string;
  initialMarkdown: string;
  confirmLabel?: string;
}): Promise<string | null> {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise((resolve) => {
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold shrink-0">${escapeHtml(options.title)}</h3>
        <textarea data-modal-markdown rows="18" class="w-full min-h-[12rem] flex-1 resize-y rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 font-mono text-sm"></textarea>
        <p class="m-0 text-xs text-gray-500 dark:text-gray-400 shrink-0">Atajos: <kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">Esc</kbd> cancela si el foco está fuera del área de texto.</p>
        <div class="flex justify-end gap-2 shrink-0">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Cancelar</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">${escapeHtml(options.confirmLabel ?? "Aplicar al importador")}</button>
        </div>
      </div>
    `;
    const ta = root.querySelector<HTMLTextAreaElement>("[data-modal-markdown]");
    if (ta) ta.value = options.initialMarkdown;

    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    ta?.focus();
    ta?.setSelectionRange(ta.value.length, ta.value.length);

    const cleanup = (value: string | null) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-confirm]")?.addEventListener("click", () => cleanup(ta?.value ?? ""));
    ta?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") e.stopPropagation();
    });
  });
}

export function promptModal(options: {
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<string | null>((resolve) => {
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold">${options.title}</h3>
        <input data-modal-input type="text" value="${options.initialValue ?? ""}" placeholder="${options.placeholder ?? ""}"
          class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950" />
        <div class="flex justify-end gap-2">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-semibold hover:bg-gray-800">${options.confirmLabel ?? "Guardar"}</button>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const input = root.querySelector<HTMLInputElement>("[data-modal-input]");
    if (input) input.focus();

    const cleanup = (value: string | null) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-confirm]")?.addEventListener("click", () =>
      cleanup(input?.value ?? null),
    );
  });
}

export function technologyEditModal(options: { title?: string; initialName: string }) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<string | null>((resolve) => {
    const safeName = escapeHtml(options.initialName);
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold">${options.title ?? "Editar tecnología"}</h3>
        <input
          data-modal-name
          type="text"
          value="${safeName}"
          placeholder="Nombre de la tecnología"
          class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
        />
        <div class="flex justify-end gap-2">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-semibold hover:bg-gray-800">Guardar</button>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const nameInput = root.querySelector<HTMLInputElement>("[data-modal-name]");
    if (nameInput) nameInput.focus();

    const cleanup = (value: string | null) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-confirm]")?.addEventListener("click", () =>
      cleanup((nameInput?.value ?? "").trim() || null),
    );
  });
}

export function projectEditModal(options: {
  title?: string;
  initialTitle: string;
  initialDescription: string;
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<{ title: string; description: string } | null>((resolve) => {
    const safeTitle = escapeHtml(options.initialTitle);
    const safeDesc = escapeHtml(options.initialDescription);
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold">${options.title ?? "Editar proyecto"}</h3>
        <div class="space-y-2">
          <input
            data-modal-title
            type="text"
            value="${safeTitle}"
            placeholder="Título"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          />
          <textarea
            data-modal-description
            rows="4"
            placeholder="Descripción"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          >${safeDesc}</textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-semibold hover:bg-gray-800">Guardar</button>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const titleInput = root.querySelector<HTMLInputElement>("[data-modal-title]");
    const descInput = root.querySelector<HTMLTextAreaElement>("[data-modal-description]");
    if (titleInput) titleInput.focus();

    const cleanup = (value: { title: string; description: string } | null) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-confirm]")?.addEventListener("click", () => {
      const title = (titleInput?.value ?? "").trim();
      const description = (descInput?.value ?? "").trim();
      if (!title) return;
      cleanup({ title, description });
    });
  });
}

export function embedEditModal(options: {
  title?: string;
  initialKind: "iframe" | "link";
  initialTitle: string;
  initialUrl: string;
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<
    | {
        kind: "iframe" | "link";
        title: string;
        url: string;
      }
    | null
  >((resolve) => {
    const safeTitle = escapeHtml(options.initialTitle);
    const safeUrl = escapeHtml(options.initialUrl);
    const iframeSel = options.initialKind === "iframe" ? "selected" : "";
    const linkSel = options.initialKind === "link" ? "selected" : "";
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold">${options.title ?? "Embed"}</h3>
        <div class="space-y-2">
          <select
            data-modal-kind
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          >
            <option value="iframe" ${iframeSel}>iframe</option>
            <option value="link" ${linkSel}>link</option>
          </select>
          <input
            data-modal-title
            type="text"
            value="${safeTitle}"
            placeholder="Título del embed"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          />
          <input
            data-modal-url
            type="url"
            value="${safeUrl}"
            placeholder="https://..."
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          />
        </div>
        <div class="flex justify-end gap-2">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-semibold hover:bg-gray-800">Guardar</button>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const kindInput = root.querySelector<HTMLSelectElement>("[data-modal-kind]");
    const titleInput = root.querySelector<HTMLInputElement>("[data-modal-title]");
    const urlInput = root.querySelector<HTMLInputElement>("[data-modal-url]");
    if (titleInput) titleInput.focus();

    const cleanup = (value: any) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-confirm]")?.addEventListener("click", () => {
      const kind = (kindInput?.value ?? "iframe") as "iframe" | "link";
      const title = (titleInput?.value ?? "").trim();
      const url = (urlInput?.value ?? "").trim();
      if (!title || !url) return;
      cleanup({ kind, title, url });
    });
  });
}

export function conceptEditModal(options: {
  title?: string;
  initialTitle: string;
  initialNotes: string;
  initialProgress: "aprendido" | "practicado" | "mastered";
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<
    | {
        title: string;
        notes: string;
        progress: "aprendido" | "practicado" | "mastered";
      }
    | null
  >((resolve) => {
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold">${options.title ?? "Editar concepto"}</h3>
        <div class="space-y-2">
          <input
            data-modal-title
            type="text"
            value="${options.initialTitle}"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          />
          <textarea
            data-modal-notes
            rows="4"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          >${options.initialNotes}</textarea>
          <select
            data-modal-progress
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          >
            <option value="aprendido" ${options.initialProgress === "aprendido" ? "selected" : ""}>Aprendido</option>
            <option value="practicado" ${options.initialProgress === "practicado" ? "selected" : ""}>Practicado</option>
            <option value="mastered" ${options.initialProgress === "mastered" ? "selected" : ""}>Dominado</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-semibold hover:bg-gray-800">Guardar</button>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const titleInput = root.querySelector<HTMLInputElement>("[data-modal-title]");
    const notesInput = root.querySelector<HTMLTextAreaElement>("[data-modal-notes]");
    const progressInput = root.querySelector<HTMLSelectElement>("[data-modal-progress]");
    if (titleInput) titleInput.focus();

    const cleanup = (value: any) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-confirm]")?.addEventListener("click", () => {
      const title = (titleInput?.value ?? "").trim();
      const notes = (notesInput?.value ?? "").trim();
      const progress = (progressInput?.value ?? "aprendido") as
        | "aprendido"
        | "practicado"
        | "mastered";
      if (!title) return;
      cleanup({ title, notes, progress });
    });
  });
}

