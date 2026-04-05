import { getTechnologyIconSrc } from "@config/icons";
import { detectEvidenceUrl, evidenceSiteIconUrl } from "@lib/evidence-url";

export type ToastType = "success" | "error" | "info" | "warning";

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

/** Short Spanish copy for noisy Supabase/Postgres errors; falls back when the raw message is empty or looks like raw SQL. */
export function userFacingDbError(raw: string | undefined | null, fallback: string): string {
  const msg = (raw ?? "").trim();
  if (!msg) return fallback;
  const m = msg.toLowerCase();
  if (m.includes("jwt") || m.includes("invalid claim") || m.includes("session")) {
    return "La sesión caducó o no es válida. Vuelve a iniciar sesión.";
  }
  if (
    m.includes("row-level security") ||
    m.includes("new row violates row-level security") ||
    m.includes("permission denied") ||
    m.includes("42501")
  ) {
    return "No se pudo completar la acción por permisos o sesión. Comprueba que sigas conectado.";
  }
  if (m.includes("duplicate key") || m.includes("unique constraint") || m.includes("23505")) {
    return "Ese valor ya existe. Prueba con otro nombre o identificador.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return "Error de red. Comprueba la conexión e inténtalo de nuevo.";
  }
  if (msg.length > 200 || /relation ".*" does not exist|syntax error/i.test(m)) {
    return fallback;
  }
  return msg.length <= 160 ? msg : `${msg.slice(0, 157)}…`;
}

export function showToast(message: string, type: ToastType = "info", durationMs: number = type === "error" ? 8000 : 6000) {
  const root = getToastRoot();
  const node = document.createElement("div");

  const tone =
    type === "success"
      ? "bg-green-600 text-white"
      : type === "error"
        ? "bg-red-600 text-white"
        : type === "warning"
          ? "bg-amber-600 text-white"
          : "bg-gray-900 text-white";

  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.className = `rounded-lg px-3 py-2 text-sm shadow-lg flex items-center gap-2 transition-all duration-200 ease-out opacity-0 translate-y-2 max-w-[min(24rem,calc(100vw-2rem))] ${tone}`;
  node.innerHTML = `<span class="min-w-0 flex-1 break-words">${escapeHtml(message)}</span><button type="button" data-toast-close class="ml-1 shrink-0 text-white/90 hover:text-white" aria-label="Cerrar aviso">×</button>`;
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
  }, durationMs);
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

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type TechnologyPickerResult =
  | { kind: "pick"; slug: string }
  | { kind: "create"; name: string; slug: string; importMode: "none" | "default" | "junior" };

export function technologyPickerModal(options: {
  title?: string;
  technologies: { slug: string; name: string }[];
  seedCatalog: { slug: string; label: string }[];
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<TechnologyPickerResult | null>((resolve) => {
    const cleanup = (value: TechnologyPickerResult | null) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(value);
      }, 180);
    };

    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-2xl rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="m-0 text-base font-semibold">${escapeHtml(options.title ?? "Añadir tecnología")}</h3>
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Cerrar</button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <section class="space-y-2">
            <p class="m-0 text-xs font-semibold text-gray-700 dark:text-gray-300">Seleccionar existente</p>
            <input data-tech-pick-search type="search" placeholder="Buscar (Tableau, Python, CSS…)" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm" />
            <div class="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <ul data-tech-pick-list class="max-h-72 overflow-auto m-0 p-0 divide-y divide-gray-200/70 dark:divide-gray-800"></ul>
            </div>
            <p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">Puedes buscar por nombre o por slug.</p>
          </section>

          <section class="space-y-2">
            <p class="m-0 text-xs font-semibold text-gray-700 dark:text-gray-300">Crear nueva</p>
            <div data-tech-create-wrap class="space-y-2">
              <input data-tech-create-name type="text" placeholder="Nombre (p. ej. Tableau)" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm" />
              <div class="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <ul data-tech-seed-suggestions class="max-h-40 overflow-auto m-0 p-0 divide-y divide-gray-200/70 dark:divide-gray-800"></ul>
              </div>
              <div class="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-2">
                <p class="m-0 text-xs font-semibold text-emerald-900 dark:text-emerald-200">¿Importar conceptos ahora?</p>
                <label class="flex items-center gap-2 text-xs"><input type="radio" name="importMode" value="none" checked /> No, lo hago luego</label>
                <label class="flex items-center gap-2 text-xs"><input type="radio" name="importMode" value="default" /> Sí, catálogo sugerido (todos los niveles)</label>
                <label class="flex items-center gap-2 text-xs"><input type="radio" name="importMode" value="junior" /> Sí, catálogo sugerido (filtrar junior después)</label>
                <p class="m-0 text-[11px] text-emerald-900/80 dark:text-emerald-200/80">Abriremos la tecnología para que uses «Cargar catálogo sugerido» y (si quieres) filtres por nivel.</p>
              </div>
              <button data-tech-create-confirm type="button" class="inline-flex items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">Crear</button>
              <p data-tech-create-feedback class="m-0 text-xs text-gray-600 dark:text-gray-400 min-h-4"></p>
            </div>
          </section>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const search = root.querySelector<HTMLInputElement>("[data-tech-pick-search]");
    const listEl = root.querySelector<HTMLUListElement>("[data-tech-pick-list]");
    const nameInput = root.querySelector<HTMLInputElement>("[data-tech-create-name]");
    const seedList = root.querySelector<HTMLUListElement>("[data-tech-seed-suggestions]");
    const createBtn = root.querySelector<HTMLButtonElement>("[data-tech-create-confirm]");
    const createFeedback = root.querySelector<HTMLElement>("[data-tech-create-feedback]");

    let pickedSeedSlug: string | null = null;
    let seedLabelLock: string | null = null;

    const renderPickList = (q: string) => {
      if (!listEl) return;
      const ql = q.trim().toLowerCase();
      const hits =
        !ql
          ? [...options.technologies].sort((a, b) => a.name.localeCompare(b.name, "es"))
          : options.technologies
              .filter((t) => t.name.toLowerCase().includes(ql) || t.slug.includes(ql))
              .sort((a, b) => a.name.localeCompare(b.name, "es"));
      if (hits.length === 0) {
        listEl.innerHTML = `<li class="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 list-none">No hay resultados.</li>`;
        return;
      }
      listEl.innerHTML = hits
        .map((t) => {
          const iconSrc = getTechnologyIconSrc({ id: t.slug, name: t.name });
          const iconHtml = iconSrc
            ? `<img src="${escapeHtml(iconSrc)}" alt="" class="h-5 w-5 shrink-0 rounded-sm object-contain" loading="lazy" />`
            : `<span class="h-5 w-5 shrink-0 rounded-sm bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>`;
          return `<li class="list-none">
            <button type="button" data-pick-slug="${escapeHtml(t.slug)}" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 border-0 bg-transparent cursor-pointer flex items-start gap-2">
              ${iconHtml}
              <span class="min-w-0 flex-1">
                <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(t.name)}</span>
                <span class="block text-[11px] text-gray-500 dark:text-gray-400">slug <code class="text-[10px]">${escapeHtml(t.slug)}</code></span>
              </span>
            </button>
          </li>`;
        })
        .join("");
    };

    const renderSeedSuggestions = (q: string) => {
      if (!seedList) return;
      const ql = q.trim().toLowerCase();
      const hits =
        !ql
          ? [...options.seedCatalog].sort((a, b) => a.label.localeCompare(b.label, "es"))
          : options.seedCatalog
              .filter((e) => e.label.toLowerCase().includes(ql) || e.slug.includes(ql))
              .sort((a, b) => a.label.localeCompare(b.label, "es"));
      if (hits.length === 0) {
        seedList.innerHTML = `<li class="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 list-none">Sin sugerencias.</li>`;
        return;
      }
      seedList.innerHTML = hits
        .map((e) => {
          const iconSrc = getTechnologyIconSrc({ id: e.slug, name: e.label });
          const iconHtml = iconSrc
            ? `<img src="${escapeHtml(iconSrc)}" alt="" class="h-5 w-5 shrink-0 rounded-sm object-contain" loading="lazy" />`
            : `<span class="h-5 w-5 shrink-0 rounded-sm bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>`;
          return `<li class="list-none">
            <button type="button" data-seed-slug="${escapeHtml(e.slug)}" data-seed-label="${escapeHtml(e.label)}" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 border-0 bg-transparent cursor-pointer flex items-start gap-2">
              ${iconHtml}
              <span class="min-w-0 flex-1">
                <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(e.label)}</span>
                <span class="block text-[11px] text-gray-500 dark:text-gray-400">Plantilla importación · slug <code class="text-[10px]">${escapeHtml(e.slug)}</code></span>
              </span>
            </button>
          </li>`;
        })
        .join("");
    };

    renderPickList("");
    renderSeedSuggestions("");

    search?.addEventListener("input", () => renderPickList(search.value));
    search?.addEventListener("focus", () => renderPickList(search.value));

    listEl?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-pick-slug]");
      if (!btn) return;
      const slug = (btn.dataset.pickSlug ?? "").trim();
      if (!slug) return;
      cleanup({ kind: "pick", slug });
    });

    nameInput?.addEventListener("input", () => {
      if (seedLabelLock !== null && nameInput.value.trim() !== seedLabelLock) {
        pickedSeedSlug = null;
        seedLabelLock = null;
      }
      renderSeedSuggestions(nameInput.value);
    });
    nameInput?.addEventListener("focus", () => renderSeedSuggestions(nameInput.value));

    seedList?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-seed-slug]");
      if (!btn || !nameInput) return;
      const slug = btn.dataset.seedSlug ?? "";
      const label = btn.dataset.seedLabel ?? "";
      nameInput.value = label;
      pickedSeedSlug = slug;
      seedLabelLock = label;
      nameInput.focus();
    });

    createBtn?.addEventListener("click", () => {
      const name = (nameInput?.value ?? "").trim();
      if (!name) {
        if (createFeedback) createFeedback.textContent = "Escribe un nombre.";
        return;
      }
      const slug = pickedSeedSlug ?? toSlug(name);
      const mode =
        (root.querySelector<HTMLInputElement>("input[name=importMode]:checked")?.value as
          | "none"
          | "default"
          | "junior") ?? "none";
      cleanup({ kind: "create", name, slug, importMode: mode });
    });

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-overlay]")?.addEventListener("click", () => cleanup(null));
    document.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "Escape") cleanup(null);
      },
      { once: true },
    );
  });
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
        <textarea data-modal-markdown rows="18" class="w-full min-h-48 flex-1 resize-y rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 font-mono text-sm"></textarea>
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
  initialRole: string;
  initialOutcome: string;
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<{ title: string; description: string; role: string; outcome: string } | null>((resolve) => {
    const safeTitle = escapeHtml(options.initialTitle);
    const safeDesc = escapeHtml(options.initialDescription);
    const safeRole = escapeHtml(options.initialRole);
    const safeOutcome = escapeHtml(options.initialOutcome);
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200 max-h-[90vh] overflow-y-auto">
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
            rows="3"
            placeholder="Descripción (historia)"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          >${safeDesc}</textarea>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">Rol</span>
            <input
              data-modal-role
              type="text"
              value="${safeRole}"
              placeholder="p. ej. Data analyst, Tech lead"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">Resultado / impacto</span>
            <textarea
              data-modal-outcome
              rows="2"
              placeholder="Qué se logró o qué demuestra el proyecto"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm"
            >${safeOutcome}</textarea>
          </label>
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
    const roleInput = root.querySelector<HTMLInputElement>("[data-modal-role]");
    const outcomeInput = root.querySelector<HTMLTextAreaElement>("[data-modal-outcome]");
    if (titleInput) titleInput.focus();

    const cleanup = (value: { title: string; description: string; role: string; outcome: string } | null) => {
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
      const role = (roleInput?.value ?? "").trim();
      const outcome = (outcomeInput?.value ?? "").trim();
      if (!title) return;
      cleanup({ title, description, role, outcome });
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
        <h3 class="m-0 text-base font-semibold">${options.title ?? "Evidencia"}</h3>
        <div class="space-y-2">
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">URL</span>
            <input
              data-modal-url
              type="url"
              value="${safeUrl}"
              placeholder="https://..."
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
            />
          </label>
          <div class="flex gap-2 items-start min-h-10">
            <img data-modal-favicon alt="" width="28" height="28" class="hidden rounded shrink-0 ring-1 ring-gray-200/80 dark:ring-gray-700 mt-0.5" loading="lazy" decoding="async" />
            <p data-modal-detect-hint class="text-xs text-gray-600 dark:text-gray-400 m-0 flex-1"></p>
          </div>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">Mostrar como</span>
            <select
              data-modal-kind
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
            >
              <option value="iframe" ${iframeSel}>Vista embebida (iframe)</option>
              <option value="link" ${linkSel}>Solo enlace</option>
            </select>
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">Título</span>
            <input
              data-modal-title
              type="text"
              value="${safeTitle}"
              placeholder="Si lo dejas vacío, usamos el tipo detectado (p. ej. GitHub)"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
            />
          </label>
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
    const hintEl = root.querySelector<HTMLElement>("[data-modal-detect-hint]");
    const favEl = root.querySelector<HTMLImageElement>("[data-modal-favicon]");

    const syncFromUrl = () => {
      const raw = (urlInput?.value ?? "").trim();
      const det = detectEvidenceUrl(raw);
      if (hintEl) hintEl.textContent = det.hint;
      if (kindInput && det.sourceKey !== "invalid" && det.sourceKey !== "empty") {
        kindInput.value = det.suggestedKind;
      }
      if (favEl) {
        const icon = evidenceSiteIconUrl(raw);
        if (icon && det.sourceKey !== "empty" && det.sourceKey !== "invalid") {
          favEl.onerror = () => favEl.classList.add("hidden");
          favEl.src = icon;
          favEl.classList.remove("hidden");
        } else {
          favEl.removeAttribute("src");
          favEl.classList.add("hidden");
        }
      }
    };

    urlInput?.addEventListener("input", syncFromUrl);
    syncFromUrl();
    if (urlInput) urlInput.focus();

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
      const url = (urlInput?.value ?? "").trim();
      if (!url) return;
      try {
        new URL(url);
      } catch {
        return;
      }
      const det = detectEvidenceUrl(url);
      if (det.sourceKey === "invalid") return;
      const titleRaw = (titleInput?.value ?? "").trim();
      const title = titleRaw || det.sourceLabel;
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

