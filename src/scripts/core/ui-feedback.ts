import { getTechnologyIconSrc } from "@config/icons";
import { coerceEvidenceDisplayKind, detectEvidenceUrl, evidenceSiteIconUrl } from "@lib/evidence-url";
import i18next from "i18next";
import { analyzeGitHubRepoTechnologies, parseGitHubRepoUrl, type DetectedTechnology } from "@scripts/core/github-repo-analyzer";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

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
  node.innerHTML = `<span class="min-w-0 flex-1 wrap-break-word">${escapeHtml(message)}</span><button type="button" data-toast-close class="ml-1 shrink-0 text-white/90 hover:text-white" aria-label="Cerrar aviso">×</button>`;
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
  | { kind: "pickMany"; slugs: string[] }
  | { kind: "create"; name: string; slug: string; importMode: "none" | "default" | "junior" };

export type GitHubRepoTechImportResult = {
  repoUrl: string;
  technologies: { slug: string; name: string }[];
};

export function githubRepoTechImportModal(options: { title?: string; initialRepoUrl?: string }) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<GitHubRepoTechImportResult | null>((resolve) => {
    const cleanup = (value: GitHubRepoTechImportResult | null) => {
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
          <h3 class="m-0 text-base font-semibold">${escapeHtml(options.title ?? "Importar stack desde GitHub")}</h3>
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Cerrar</button>
        </div>
        <p class="m-0 text-xs text-gray-600 dark:text-gray-400">
          Pega la URL del repositorio (público). Leeremos manifests típicos (package.json, requirements.txt, go.mod…).
        </p>
        <div class="flex flex-col sm:flex-row gap-2">
          <input data-gh-repo-url type="url" placeholder="https://github.com/owner/repo" class="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm" value="${escapeHtml(
            (options.initialRepoUrl ?? "").trim(),
          )}" />
          <button type="button" data-gh-analyze class="inline-flex justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shrink-0">Analizar</button>
        </div>
        <p data-gh-feedback class="m-0 text-xs text-gray-600 dark:text-gray-400 min-h-4"></p>
        <div class="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div data-gh-list class="p-3 max-h-80 overflow-auto"></div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <label class="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 select-none">
            <input type="checkbox" data-gh-select-all class="accent-indigo-600" checked />
            Seleccionar todo
          </label>
          <button type="button" data-gh-apply class="rounded-lg bg-emerald-700 dark:bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" disabled>Aplicar</button>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const urlInput = root.querySelector<HTMLInputElement>("[data-gh-repo-url]");
    const analyzeBtn = root.querySelector<HTMLButtonElement>("[data-gh-analyze]");
    const feedback = root.querySelector<HTMLElement>("[data-gh-feedback]");
    const list = root.querySelector<HTMLElement>("[data-gh-list]");
    const applyBtn = root.querySelector<HTMLButtonElement>("[data-gh-apply]");
    const selectAll = root.querySelector<HTMLInputElement>("[data-gh-select-all]");

    let lastRepoUrl = (options.initialRepoUrl ?? "").trim();
    let detected: DetectedTechnology[] = [];

    const render = () => {
      if (!list) return;
      if (detected.length === 0) {
        list.innerHTML = `<p class="m-0 text-sm text-gray-600 dark:text-gray-400">Sin resultados todavía.</p>`;
        if (applyBtn) applyBtn.disabled = true;
        return;
      }
      const rows = detected
        .map((t) => {
          const reasons = t.reasons.slice(0, 3).map(escapeHtml).join(" · ");
          return `<label class="flex items-start gap-3 px-1 py-2 text-sm cursor-pointer">
            <input type="checkbox" data-gh-tech="${escapeHtml(t.slug)}" class="mt-1 accent-indigo-600" checked />
            <span class="min-w-0 flex-1">
              <span class="font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(t.name)}</span>
              <span class="block text-[11px] text-gray-500 dark:text-gray-400">${reasons}</span>
            </span>
            <span class="text-[11px] font-mono text-gray-500 dark:text-gray-400">${Math.round(t.confidence * 100)}%</span>
          </label>`;
        })
        .join("");
      list.innerHTML = rows;
      if (applyBtn) applyBtn.disabled = false;
    };

    const syncSelectAll = () => {
      if (!selectAll) return;
      const boxes = root.querySelectorAll<HTMLInputElement>("[data-gh-tech]");
      const checked = Array.from(boxes).filter((b) => b.checked).length;
      selectAll.checked = boxes.length > 0 && checked === boxes.length;
      if (applyBtn) applyBtn.disabled = checked === 0;
    };

    selectAll?.addEventListener("change", () => {
      const boxes = root.querySelectorAll<HTMLInputElement>("[data-gh-tech]");
      boxes.forEach((b) => (b.checked = Boolean(selectAll.checked)));
      syncSelectAll();
    });
    root.addEventListener("change", (e) => {
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLInputElement && t.hasAttribute("data-gh-tech")) syncSelectAll();
    });

    const analyze = async () => {
      const repoUrl = (urlInput?.value ?? "").trim();
      lastRepoUrl = repoUrl;
      if (!repoUrl) return;
      const parsed = parseGitHubRepoUrl(repoUrl);
      if (!parsed) {
        if (feedback) feedback.textContent = "URL de GitHub no válida. Usa formato https://github.com/owner/repo";
        return;
      }
      if (feedback) feedback.textContent = "Analizando…";
      if (analyzeBtn) analyzeBtn.disabled = true;
      if (applyBtn) applyBtn.disabled = true;
      detected = [];
      render();
      try {
        detected = await analyzeGitHubRepoTechnologies(parsed);
        if (feedback) feedback.textContent = detected.length > 0 ? `Detectadas ${detected.length} tecnologías.` : "No se detectaron tecnologías.";
        render();
        syncSelectAll();
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : "Error inesperado.";
        if (feedback) feedback.textContent = `Error: ${escapeHtml(msg)} (¿repo privado o rate limit de GitHub?)`;
      } finally {
        if (analyzeBtn) analyzeBtn.disabled = false;
      }
    };

    analyzeBtn?.addEventListener("click", () => void analyze());
    urlInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void analyze();
      }
    });

    applyBtn?.addEventListener("click", () => {
      const boxes = root.querySelectorAll<HTMLInputElement>("[data-gh-tech]");
      const picked = Array.from(boxes)
        .filter((b) => b.checked)
        .map((b) => b.getAttribute("data-gh-tech") || "")
        .filter(Boolean);
      const technologies = detected
        .filter((t) => picked.includes(t.slug))
        .map((t) => ({ slug: t.slug, name: t.name }));
      if (technologies.length === 0) {
        cleanup(null);
        return;
      }
      cleanup({ repoUrl: lastRepoUrl, technologies });
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
            <div class="flex flex-wrap items-center justify-between gap-2">
              <label class="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 select-none">
                <input type="checkbox" class="accent-indigo-600" data-tech-pick-multi />
                Modo múltiple
              </label>
              <button type="button" data-tech-pick-confirm class="hidden rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-xs font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">
                Añadir seleccionadas
              </button>
            </div>
            <input data-tech-pick-search type="search" placeholder="Buscar (Tableau, Python, CSS…)" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm" />
            <div data-tech-pick-chips class="hidden flex-wrap gap-2"></div>
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
    const multiToggle = root.querySelector<HTMLInputElement>("[data-tech-pick-multi]");
    const pickConfirmBtn = root.querySelector<HTMLButtonElement>("[data-tech-pick-confirm]");
    const pickChipsWrap = root.querySelector<HTMLElement>("[data-tech-pick-chips]");
    const nameInput = root.querySelector<HTMLInputElement>("[data-tech-create-name]");
    const seedList = root.querySelector<HTMLUListElement>("[data-tech-seed-suggestions]");
    const createBtn = root.querySelector<HTMLButtonElement>("[data-tech-create-confirm]");
    const createFeedback = root.querySelector<HTMLElement>("[data-tech-create-feedback]");

    let pickedSeedSlug: string | null = null;
    let seedLabelLock: string | null = null;
    let pickMultiMode = false;
    const picked = new Map<string, { slug: string; name: string }>();

    const renderPickChips = () => {
      if (!pickChipsWrap) return;
      if (!pickMultiMode) {
        pickChipsWrap.innerHTML = "";
        return;
      }
      const items = [...picked.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
      if (items.length === 0) {
        pickChipsWrap.innerHTML =
          '<p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">Selecciona varias del listado.</p>';
        return;
      }
      pickChipsWrap.innerHTML = items
        .map((it) => {
          const iconSrc = getTechnologyIconSrc({ id: it.slug, name: it.name });
          const iconHtml = iconSrc
            ? `<img src="${escapeHtml(iconSrc)}" alt="" class="h-4 w-4 shrink-0 rounded-sm object-contain" loading="lazy" />`
            : `<span class="h-4 w-4 shrink-0 rounded-sm bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>`;
          return `<span class="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-2 py-1 text-xs">
            ${iconHtml}
            <span class="font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(it.name)}</span>
            <button type="button" data-pick-chip-remove="${escapeHtml(it.slug)}" class="ml-1 rounded-full px-1.5 py-0.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">×</button>
          </span>`;
        })
        .join("");
    };

    const setPickMultiMode = (next: boolean) => {
      pickMultiMode = next;
      if (pickConfirmBtn) pickConfirmBtn.classList.toggle("hidden", !pickMultiMode);
      if (pickChipsWrap) pickChipsWrap.classList.toggle("hidden", !pickMultiMode);
      if (!pickMultiMode) {
        picked.clear();
        renderPickChips();
      }
      renderPickList(search?.value ?? "");
    };

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
          const selected = picked.has(t.slug);
          const selBadge = pickMultiMode && selected ? `<span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-200">✓</span>` : "";
          const rowTone = pickMultiMode
            ? selected
              ? "bg-indigo-50/60 dark:bg-indigo-950/25 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/35"
              : "hover:bg-gray-100 dark:hover:bg-gray-900"
            : "hover:bg-gray-100 dark:hover:bg-gray-900";
          return `<li class="list-none">
            <button type="button" data-pick-slug="${escapeHtml(t.slug)}" class="w-full text-left px-3 py-2 text-sm ${rowTone} border-0 bg-transparent cursor-pointer flex items-start gap-2">
              ${iconHtml}
              <span class="min-w-0 flex-1">
                <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(t.name)}</span>
                <span class="block text-[11px] text-gray-500 dark:text-gray-400">slug <code class="text-[10px]">${escapeHtml(t.slug)}</code></span>
              </span>
              ${selBadge}
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
    renderPickChips();

    search?.addEventListener("input", () => renderPickList(search.value));
    search?.addEventListener("focus", () => renderPickList(search.value));

    multiToggle?.addEventListener("change", () => setPickMultiMode(Boolean(multiToggle.checked)));
    setPickMultiMode(Boolean(multiToggle?.checked));

    pickChipsWrap?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-pick-chip-remove]");
      if (!btn) return;
      const slug = btn.dataset.pickChipRemove ?? "";
      picked.delete(slug);
      renderPickChips();
      renderPickList(search?.value ?? "");
    });

    pickConfirmBtn?.addEventListener("click", () => {
      const slugs = [...picked.keys()];
      if (slugs.length === 0) {
        cleanup(null);
        return;
      }
      cleanup({ kind: "pickMany", slugs });
    });

    listEl?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-pick-slug]");
      if (!btn) return;
      const slug = (btn.dataset.pickSlug ?? "").trim();
      if (!slug) return;
      if (!pickMultiMode) {
        cleanup({ kind: "pick", slug });
        return;
      }
      const tech = options.technologies.find((t) => t.slug === slug);
      if (!tech) return;
      if (picked.has(slug)) picked.delete(slug);
      else picked.set(slug, { slug, name: tech.name });
      renderPickChips();
      renderPickList(search?.value ?? "");
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

function textareaCurrentLineBounds(text: string, caret: number): { start: number; end: number; lineIndex: number } {
  const before = text.slice(0, Math.min(caret, text.length));
  const start = before.lastIndexOf("\n") + 1;
  const nextNl = text.indexOf("\n", start);
  const end = nextNl === -1 ? text.length : nextNl;
  const lineIndex = (before.match(/\n/g) ?? []).length;
  return { start, end, lineIndex };
}

/** Alt+↑/↓ mover línea; Shift+Alt+↑/↓ duplicar línea (estilo IDE). */
function attachMarkdownLineShortcuts(ta: HTMLTextAreaElement) {
  ta.addEventListener("keydown", (e) => {
    if (!e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const v = ta.value;
    const caret = ta.selectionStart;
    const { start, end, lineIndex } = textareaCurrentLineBounds(v, caret);
    const line = v.slice(start, end);
    const lines = v.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    if (e.shiftKey) {
      e.preventDefault();
      if (e.key === "ArrowDown") {
        const insert = `\n${line}`;
        ta.value = v.slice(0, end) + insert + v.slice(end);
        const pos = end + insert.length;
        ta.setSelectionRange(pos, pos);
      } else {
        const insert = `${line}\n`;
        ta.value = v.slice(0, start) + insert + v.slice(start);
        const pos = start + line.length + 1;
        ta.setSelectionRange(pos, pos);
      }
      return;
    }

    const dir = e.key === "ArrowUp" ? -1 : 1;
    const j = lineIndex + dir;
    if (j < 0 || j >= lines.length) return;
    e.preventDefault();
    [lines[lineIndex], lines[j]] = [lines[j], lines[lineIndex]];
    const newVal = lines.join("\n");
    ta.value = newVal;
    const newStart = lines.slice(0, j).join("\n").length + (j > 0 ? 1 : 0);
    const offset = Math.min(Math.max(0, caret - start), line.length);
    const pos = newStart + offset;
    ta.setSelectionRange(pos, pos);
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
        <p class="m-0 text-xs text-gray-500 dark:text-gray-400 shrink-0 leading-relaxed">Atajos en el editor: <kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">Alt</kbd>+<kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">↑</kbd>/<kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">↓</kbd> mover línea · <kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">Shift</kbd>+<kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">Alt</kbd>+<kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">↑</kbd>/<kbd class="px-1 rounded border border-gray-300 dark:border-gray-600 text-[10px]">↓</kbd> duplicar línea.</p>
        <div class="flex justify-end gap-2 shrink-0">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Cancelar</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200">${escapeHtml(options.confirmLabel ?? "Aplicar al importador")}</button>
        </div>
      </div>
    `;
    const ta = root.querySelector<HTMLTextAreaElement>("[data-modal-markdown]");
    if (ta) ta.value = options.initialMarkdown;
    if (ta) attachMarkdownLineShortcuts(ta);

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

export type ProjectEditStatus = "draft" | "in_progress" | "portfolio_visible" | "archived";

export function projectEditModal(options: {
  title?: string;
  initialTitle: string;
  initialDescription: string;
  initialRole: string;
  initialOutcome: string;
  initialStatus?: ProjectEditStatus;
  initialTags?: string[];
  initialDateStart?: string | null;
  initialDateEnd?: string | null;
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<{
    title: string;
    description: string;
    role: string;
    outcome: string;
    status: ProjectEditStatus;
    tags: string[];
    dateStart: string | null;
    dateEnd: string | null;
  } | null>((resolve) => {
    const safeTitle = escapeHtml(options.initialTitle);
    const safeDesc = escapeHtml(options.initialDescription);
    const safeRole = escapeHtml(options.initialRole);
    const safeOutcome = escapeHtml(options.initialOutcome);
    const st = options.initialStatus ?? "in_progress";
    const tagsJoined = escapeHtml((options.initialTags ?? []).join(", "));
    const ds = (options.initialDateStart ?? "").trim();
    const de = (options.initialDateEnd ?? "").trim();
    const safeDs = escapeHtml(ds);
    const safeDe = escapeHtml(de);
    const sel = (v: ProjectEditStatus) => (st === v ? "selected" : "");
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3 opacity-0 scale-[0.98] transition-all duration-200 max-h-[90vh] overflow-y-auto">
        <h3 class="m-0 text-base font-semibold">${options.title ?? "Editar proyecto"}</h3>
        <div class="space-y-2">
          <input
            data-modal-title
            type="text"
            value="${safeTitle}"
            placeholder="${escapeHtml(tt("projects.editTitlePlaceholder", "Título"))}"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          />
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.editStatusLabel", "Estado"))}</span>
            <select data-modal-status class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm">
              <option value="draft" ${sel("draft")}>${escapeHtml(tt("projects.statusDraft", "Borrador"))}</option>
              <option value="in_progress" ${sel("in_progress")}>${escapeHtml(tt("projects.statusInProgress", "En proceso"))}</option>
              <option value="portfolio_visible" ${sel("portfolio_visible")}>${escapeHtml(tt("projects.statusPortfolioVisible", "Visible en portfolio"))}</option>
              <option value="archived" ${sel("archived")}>${escapeHtml(tt("projects.statusArchived", "Archivado"))}</option>
            </select>
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.editTagsLabel", "Etiquetas (separadas por coma)"))}</span>
            <input data-modal-tags type="text" value="${tagsJoined}" placeholder="${escapeHtml(tt("projects.editTagsPlaceholder", "master, trabajo, personal…"))}" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm" />
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label class="block space-y-1">
              <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.editDateStartLabel", "Inicio"))}</span>
              <input data-modal-date-start type="date" value="${safeDs}" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm" />
            </label>
            <label class="block space-y-1">
              <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.editDateEndLabel", "Fin"))}</span>
              <input data-modal-date-end type="date" value="${safeDe}" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm" />
            </label>
          </div>
          <textarea
            data-modal-description
            rows="3"
            placeholder="${escapeHtml(tt("projects.editDescPlaceholder", "Descripción (historia)"))}"
            class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
          >${safeDesc}</textarea>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.editRoleLabel", "Rol"))}</span>
            <input
              data-modal-role
              type="text"
              value="${safeRole}"
              placeholder="${escapeHtml(tt("projects.editRolePlaceholder", "p. ej. Data analyst, Tech lead"))}"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.editOutcomeLabel", "Resultado / impacto"))}</span>
            <textarea
              data-modal-outcome
              rows="2"
              placeholder="${escapeHtml(tt("projects.editOutcomePlaceholder", "Qué se logró o qué demuestra el proyecto"))}"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm"
            >${safeOutcome}</textarea>
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">${escapeHtml(tt("common.cancel", "Cancelar"))}</button>
          <button data-modal-confirm type="button" class="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-semibold hover:bg-gray-800">${escapeHtml(tt("common.save", "Guardar"))}</button>
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
    const statusInput = root.querySelector<HTMLSelectElement>("[data-modal-status]");
    const tagsInput = root.querySelector<HTMLInputElement>("[data-modal-tags]");
    const dateStartInput = root.querySelector<HTMLInputElement>("[data-modal-date-start]");
    const dateEndInput = root.querySelector<HTMLInputElement>("[data-modal-date-end]");
    if (titleInput) titleInput.focus();

    const cleanup = (
      value: {
        title: string;
        description: string;
        role: string;
        outcome: string;
        status: ProjectEditStatus;
        tags: string[];
        dateStart: string | null;
        dateEnd: string | null;
      } | null,
    ) => {
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
      const statusRaw = (statusInput?.value ?? "in_progress").trim() as ProjectEditStatus;
      const status: ProjectEditStatus =
        statusRaw === "draft" ||
        statusRaw === "in_progress" ||
        statusRaw === "portfolio_visible" ||
        statusRaw === "archived"
          ? statusRaw
          : "in_progress";
      const tagsRaw = (tagsInput?.value ?? "")
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = Array.from(new Set(tagsRaw)).slice(0, 24);
      const d1 = (dateStartInput?.value ?? "").trim();
      const d2 = (dateEndInput?.value ?? "").trim();
      if (d1 && d2 && d2 < d1) {
        showToast(tt("projects.editDateOrderError", "La fecha de fin debe ser posterior o igual al inicio."), "warning");
        return;
      }
      cleanup({
        title,
        description,
        role,
        outcome,
        status,
        tags,
        dateStart: d1 || null,
        dateEnd: d2 || null,
      });
    });
  });
}

/** PR1: quitar tecnología del proyecto vs eliminarla del catálogo global. */
export function projectTechRemoveModal(options: { technologyName: string }) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<"unlink" | "delete_global" | null>((resolve) => {
    const name = escapeHtml(options.technologyName);
    root.innerHTML = `
      <div data-modal-overlay class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200"></div>
      <div data-modal-panel class="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-4 opacity-0 scale-[0.98] transition-all duration-200">
        <h3 class="m-0 text-base font-semibold">${escapeHtml(tt("projects.techRemoveTitle", "Tecnología en este proyecto"))}</h3>
        <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.techRemoveIntro", "Elige una acción para la tecnología"))} <strong>${name}</strong>.</p>
        <div class="flex flex-col gap-2">
          <button type="button" data-modal-unlink class="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-left text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">
            <span class="block">${escapeHtml(tt("projects.techRemoveUnlink", "Quitar solo de este proyecto"))}</span>
            <span class="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">${escapeHtml(tt("projects.techRemoveUnlinkHint", "La tecnología sigue en tu catálogo y en otros proyectos."))}</span>
          </button>
          <button type="button" data-modal-delete-global class="w-full rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2.5 text-left text-sm font-semibold text-red-900 dark:text-red-200 hover:bg-red-100/80 dark:hover:bg-red-950/50">
            <span class="block">${escapeHtml(tt("projects.techRemoveGlobal", "Eliminar del catálogo"))}</span>
            <span class="block text-xs font-normal opacity-90 mt-0.5">${escapeHtml(tt("projects.techRemoveGlobalHint", "Borra la tecnología, sus conceptos y enlaces en todos los proyectos."))}</span>
          </button>
        </div>
        <div class="flex justify-end">
          <button data-modal-cancel type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">${escapeHtml(tt("common.cancel", "Cancelar"))}</button>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      root.querySelector("[data-modal-overlay]")?.classList.remove("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.remove("opacity-0", "scale-[0.98]");
    });

    const cleanup = (v: "unlink" | "delete_global" | null) => {
      root.querySelector("[data-modal-overlay]")?.classList.add("opacity-0");
      root.querySelector("[data-modal-panel]")?.classList.add("opacity-0", "scale-[0.98]");
      setTimeout(() => {
        root.classList.add("hidden");
        root.classList.remove("flex");
        root.innerHTML = "";
        resolve(v);
      }, 180);
    };

    root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-overlay]")?.addEventListener("click", () => cleanup(null));
    root.querySelector("[data-modal-unlink]")?.addEventListener("click", () => cleanup("unlink"));
    root.querySelector("[data-modal-delete-global]")?.addEventListener("click", () => cleanup("delete_global"));
  });
}

export function embedEditModal(options: {
  title?: string;
  initialKind: "iframe" | "link";
  initialTitle: string;
  initialUrl: string;
  initialShowInPublic?: boolean;
  initialThumbnailUrl?: string;
}) {
  const root = getModalRoot();
  root.classList.remove("hidden");
  root.classList.add("flex");

  return new Promise<
    | {
        kind: "iframe" | "link";
        title: string;
        url: string;
        showInPublic: boolean;
        thumbnailUrl: string | null;
        thumbnailFile: File | null;
      }
    | null
  >((resolve) => {
    const phTitle = escapeHtml(tt("projects.evidenceTitlePlaceholder", "Especificar título…"));
    const safeTitle = escapeHtml(options.initialTitle);
    const safeUrl = escapeHtml(options.initialUrl);
    const safeThumb = escapeHtml((options.initialThumbnailUrl ?? "").trim());
    const iframeSel = options.initialKind === "iframe" ? "selected" : "";
    const linkSel = options.initialKind === "link" ? "selected" : "";
    const showPubChecked = options.initialShowInPublic !== false ? "checked" : "";
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
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.evidenceTitleLabel", "Título"))}</span>
            <input
              data-modal-title
              type="text"
              value="${safeTitle}"
              placeholder="${phTitle}"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950"
            />
          </label>
          <label class="flex items-start gap-2.5 cursor-pointer rounded-lg border border-gray-100 dark:border-gray-800/80 px-2 py-2">
            <input type="checkbox" data-modal-show-public class="mt-0.5 rounded border-gray-300 dark:border-gray-600" ${showPubChecked} />
            <span class="text-xs text-gray-700 dark:text-gray-300 leading-snug">Visible en portfolio y CV público. Desmarcado: solo en la app.</span>
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.evidenceThumbUrlLabel", "Miniatura por URL (opcional, HTTPS)"))}</span>
            <input
              data-modal-thumbnail-url
              type="url"
              value="${safeThumb}"
              placeholder="${escapeHtml(tt("projects.evidenceThumbUrlPlaceholder", "Vacío → YouTube automático u Open Graph"))}"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-950 text-sm"
            />
          </label>
          <div class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(tt("projects.evidenceThumbUploadLabel", "Subir miniatura"))}</span>
              <span class="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">${escapeHtml(tt("projects.evidenceThumbProBadge", "Pro"))}</span>
            </div>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 m-0">${escapeHtml(tt("projects.evidenceThumbUploadHint", "Sustituye la URL si subes archivo. Máx. 8 MB; se comprime en el navegador."))}</p>
            <input
              data-modal-thumbnail-file
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              class="block w-full max-w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 dark:file:bg-gray-800"
            />
          </div>
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
      const title = titleRaw;
      const safeKind = coerceEvidenceDisplayKind(url, kind);
      const showInPublic = root.querySelector<HTMLInputElement>("[data-modal-show-public]")?.checked !== false;
      const thumbRaw = (root.querySelector<HTMLInputElement>("[data-modal-thumbnail-url]")?.value ?? "").trim();
      const thumbFile = root.querySelector<HTMLInputElement>("[data-modal-thumbnail-file]")?.files?.[0] ?? null;
      let thumbnailUrl: string | null = null;
      if (!thumbFile && thumbRaw) {
        try {
          const u = new URL(thumbRaw);
          if (u.protocol === "https:") thumbnailUrl = thumbRaw;
        } catch {
          /* invalid */
        }
      }
      cleanup({ kind: safeKind, title, url, showInPublic, thumbnailUrl, thumbnailFile: thumbFile });
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

