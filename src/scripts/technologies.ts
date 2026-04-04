import { getTechnologyIconSrc } from "../config/icons";
import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";
import i18next from "i18next";
import { confirmModal, showToast } from "./ui-feedback";
import { loadPrefs } from "./prefs";
import { getSeedCatalogEntries } from "./technology-detail/concept-seeds";

declare global {
  interface Window {
    skillatlas?: {
      bootstrapTechnologiesGrid?: () => Promise<void>;
      clearTechnologiesCache?: () => void;
      applySettingsDashboard?: () => void;
      setUiLang?: (lng: "es" | "en") => Promise<void>;
    };
  }
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function initTechnologyForm() {
  const form = document.querySelector<HTMLFormElement>("[data-tech-form]");
  if (!form || form.dataset.skillatlasBound === "1") return;
  form.dataset.skillatlasBound = "1";

  const nameInput = form.querySelector<HTMLInputElement>("[data-tech-name-input]");
  const submitBtn = form.querySelector<HTMLButtonElement>("[type='submit']");
  const feedback = form.querySelector<HTMLElement>("[data-tech-feedback]");
  const seedWrap = form.querySelector<HTMLElement>("[data-tech-seed-wrap]");
  const seedSuggestions = form.querySelector<HTMLUListElement>("[data-tech-seed-suggestions]");
  if (!nameInput || !submitBtn || !feedback) return;

  const seedCatalog = getSeedCatalogEntries();
  let pickedSlug: string | null = null;
  let catalogLabelLock: string | null = null;

  const renderSeedSuggestions = (q: string) => {
    if (!seedSuggestions) return;
    const ql = q.trim().toLowerCase();
    const hits = !ql
      ? [...seedCatalog].sort((a, b) => a.label.localeCompare(b.label, "es"))
      : seedCatalog
          .filter((e) => e.label.toLowerCase().includes(ql) || e.slug.includes(ql))
          .sort((a, b) => a.label.localeCompare(b.label, "es"));
    if (hits.length === 0) {
      seedSuggestions.classList.add("hidden");
      seedSuggestions.innerHTML = "";
      return;
    }
    seedSuggestions.innerHTML = hits
      .map((e) => {
        const iconSrc = getTechnologyIconSrc({ id: e.slug, name: e.label });
        const iconHtml = iconSrc
          ? `<img src="${escHtml(iconSrc)}" alt="" class="h-5 w-5 shrink-0 rounded-sm object-contain" loading="lazy" />`
          : `<span class="h-5 w-5 shrink-0 rounded-sm bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>`;
        return `<li role="option"><button type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 border-0 bg-transparent cursor-pointer flex items-start gap-2" data-seed-slug="${escHtml(e.slug)}" data-seed-label="${escHtml(e.label)}">${iconHtml}<span class="min-w-0 flex-1"><span class="font-medium text-gray-900 dark:text-gray-100">${escHtml(e.label)}</span><span class="block text-[11px] text-gray-500 dark:text-gray-400">Plantilla importación · slug <code class="text-[10px]">${escHtml(e.slug)}</code></span></span></button></li>`;
      })
      .join("");
    seedSuggestions.classList.remove("hidden");
  };

  nameInput.addEventListener("focus", () => renderSeedSuggestions(nameInput.value));
  nameInput.addEventListener("input", () => {
    if (catalogLabelLock !== null && nameInput.value.trim() !== catalogLabelLock) {
      pickedSlug = null;
      catalogLabelLock = null;
    }
    renderSeedSuggestions(nameInput.value);
  });

  seedSuggestions?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-seed-slug]");
    if (!btn) return;
    const slug = btn.dataset.seedSlug ?? "";
    const label = btn.dataset.seedLabel ?? "";
    nameInput.value = label;
    pickedSlug = slug;
    catalogLabelLock = label;
    seedSuggestions.classList.add("hidden");
    nameInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (seedWrap && !seedWrap.contains(e.target as Node)) seedSuggestions?.classList.add("hidden");
  });

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    feedback.textContent = "Faltan variables de entorno de Supabase.";
    feedback.className = "text-sm text-red-600";
    return;
  }
  const userId = await getSessionUserId(supabase);
  if (!userId) {
    feedback.textContent = "Inicia sesión en Ajustes para crear tecnologías.";
    feedback.className = "text-sm text-amber-600";
    submitBtn.disabled = true;
    nameInput.disabled = true;
    return;
  }

  // Helpful when coming from Command Palette actions (create=1)
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("create") === "1") {
      nameInput.focus();
      nameInput.select();
    }
  } catch {
    // ignore
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;

    submitBtn.disabled = true;
    feedback.textContent = "Guardando...";
    feedback.className = "text-sm text-gray-600";

    const slug = pickedSlug ?? toSlug(name);
    const dup = await supabase
      .from("technologies")
      .select("id")
      .eq("slug", slug)
      .eq("user_id", userId)
      .maybeSingle();

    if (dup.error) {
      feedback.textContent = `Error al validar duplicado: ${dup.error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }
    if (dup.data) {
      feedback.textContent = "Ya tienes una tecnología con ese nombre (mismo slug).";
      feedback.className = "text-sm text-amber-600";
      submitBtn.disabled = false;
      return;
    }

    const { error } = await supabase.from("technologies").insert({
      name,
      slug,
      icon_key: slug,
      user_id: userId,
    });

    if (error) {
      feedback.textContent =
        error.code === "23505"
          ? "Conflicto de slug en la base de datos: suele indicar un índice único global en slug (heredado). En Supabase ejecuta el script docs/sql/saas-004-drop-global-slug-constraints.sql; debe quedar solo la unicidad (user_id, slug) de saas-001."
          : `Error al guardar: ${error.message}`;
      feedback.className = "text-sm text-red-600";
      submitBtn.disabled = false;
      return;
    }

    feedback.textContent = "Tecnología creada correctamente.";
    feedback.className = "text-sm text-green-600";
    showToast("Tecnología creada correctamente.", "success");
    nameInput.value = "";
    pickedSlug = null;
    catalogLabelLock = null;
    submitBtn.disabled = false;
    if (window.skillatlas?.clearTechnologiesCache) window.skillatlas.clearTechnologiesCache();
    if (window.skillatlas?.bootstrapTechnologiesGrid) {
      await window.skillatlas.bootstrapTechnologiesGrid();
      void initTechnologyActions();
    } else {
      window.location.reload();
    }
  });
}

async function initTechnologyActions() {
  const feedback = document.querySelector<HTMLElement>("[data-tech-feedback]");
  const deleteButtons = document.querySelectorAll<HTMLButtonElement>("[data-tech-delete]");
  if (deleteButtons.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const userId = await getSessionUserId(supabase);
  if (!userId) {
    if (feedback) {
      feedback.textContent = "Inicia sesión en Ajustes para eliminar tecnologías.";
      feedback.className = "text-sm text-amber-600 m-0";
    }
    deleteButtons.forEach((btn) => (btn.disabled = true));
    return;
  }

  for (const button of deleteButtons) {
    if (button.dataset.skillatlasTechDeleteBound === "1") continue;
    button.dataset.skillatlasTechDeleteBound = "1";
    button.addEventListener("click", async () => {
      const techId = button.dataset.techId;
      const techName = button.dataset.techName ?? techId ?? "";
      if (!techId) return;

      const accepted = await confirmModal({
        title: `Eliminar "${techName}"`,
        description: "Se eliminarán también sus conceptos y relaciones.",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
        danger: true,
      });
      if (!accepted) return;

      button.disabled = true;
      if (feedback) {
        feedback.textContent = "Eliminando tecnología...";
        feedback.className = "text-sm text-gray-600 m-0";
      }

      const deleteRes = await supabase.from("technologies").delete().eq("slug", techId);
      if (deleteRes.error) {
        if (feedback) {
          feedback.textContent = `Error al eliminar: ${deleteRes.error.message}`;
          feedback.className = "text-sm text-red-600 m-0";
        }
        showToast("Error al eliminar tecnología.", "error");
        button.disabled = false;
        return;
      }

      showToast("Tecnología eliminada.", "success");
      if (feedback) {
        feedback.textContent = "";
        feedback.className = "text-sm text-gray-600 m-0";
      }
      if (window.skillatlas?.clearTechnologiesCache) window.skillatlas.clearTechnologiesCache();
      if (window.skillatlas?.bootstrapTechnologiesGrid) {
        await window.skillatlas.bootstrapTechnologiesGrid();
        void initTechnologyActions();
      } else {
        window.location.reload();
      }
    });
  }
}

async function bootstrapTechnologiesGrid() {
  const mount = document.querySelector<HTMLElement>("[data-technologies-csr-mount]");
  if (!mount) return;

  const countEl = document.querySelector<HTMLElement>("[data-technologies-count]");

  const cacheKey = (userId: string) => `skillatlas_cache_technologies_grid_v1:${userId}`;
  const readCache = (userId: string) => {
    try {
      const raw = sessionStorage.getItem(cacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts: number; html: string; countText: string };
      if (!parsed?.ts || typeof parsed.html !== "string") return null;
      if (Date.now() - parsed.ts > 2 * 60 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  };
  const writeCache = (userId: string, html: string, countText: string) => {
    try {
      sessionStorage.setItem(cacheKey(userId), JSON.stringify({ ts: Date.now(), html, countText }));
    } catch {
      // ignore
    }
  };
  const clearCache = (userId: string) => {
    try {
      sessionStorage.removeItem(cacheKey(userId));
    } catch {
      // ignore
    }
  };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    mount.innerHTML = `<p class="text-sm text-red-600 col-span-full">No hay cliente Supabase.</p>`;
    return;
  }

  const userId = await getSessionUserId(supabase);
  if (!userId) {
    mount.innerHTML = `<div class="border border-gray-200 rounded-xl p-5 bg-gray-50 col-span-full">
      <p class="m-0 text-sm text-amber-700">Inicia sesión en Ajustes para ver tus tecnologías.</p>
      <a href="/settings" class="inline-flex mt-3 rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a>
    </div>`;
    if (countEl) countEl.textContent = "0 total";
    return;
  }

  const prefs = loadPrefs();
  const view = prefs.technologiesView;

  const cached = readCache(userId);
  if (cached) {
    if (view === "list") {
      mount.className = "w-full space-y-2 min-h-[6rem]";
    } else {
      mount.className = "w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[6rem]";
    }
    mount.innerHTML = cached.html;
    if (countEl) countEl.textContent = cached.countText;
    void initTechnologyActions();
    setTimeout(() => {
      clearCache(userId);
      void bootstrapTechnologiesGrid().then(() => initTechnologyActions());
    }, 0);
    return;
  }

  const [techRes, conceptRes] = await Promise.all([
    supabase.from("technologies").select("id, slug, name").order("name"),
    supabase.from("concepts").select("technology_id"),
  ]);

  if (techRes.error) {
    mount.innerHTML = `<p class="text-sm text-red-600 col-span-full">${escHtml(techRes.error.message)}</p>`;
    return;
  }

  const techRows = (techRes.data ?? []) as { id: string; slug: string; name: string }[];
  const countByTechDbId = new Map<string, number>();
  for (const row of conceptRes.data ?? []) {
    const tid = (row as { technology_id: string }).technology_id;
    countByTechDbId.set(tid, (countByTechDbId.get(tid) ?? 0) + 1);
  }

  const countText = `${techRows.length} total`;
  if (countEl) countEl.textContent = countText;

  if (techRows.length === 0) {
    const html = `<p class="text-sm text-gray-600 col-span-full m-0">Aún no hay tecnologías.</p>`;
    mount.innerHTML = html;
    writeCache(userId, html, countText);
    return;
  }

  if (view === "list") {
    mount.className = "w-full space-y-2 min-h-[6rem]";
  } else {
    mount.className = "w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[6rem]";
  }

  const html =
    view === "list"
      ? `<div class="w-full rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
          ${techRows
            .map((tech) => {
              const conceptsCount = countByTechDbId.get(tech.id) ?? 0;
              const iconSrc = getTechnologyIconSrc({ id: tech.slug, name: tech.name });
              const iconHtml = iconSrc
                ? `<img src="${escHtml(iconSrc)}" alt="" class="h-5 w-5 shrink-0" loading="lazy" />`
                : "";
              const href = `/technologies/view?tech=${encodeURIComponent(tech.slug)}`;
              const conceptsLabel = i18next.t("technologies.concepts");
              return `<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                <div class="flex items-center justify-between gap-4">
                  <a href="${href}" class="flex items-center gap-2 min-w-0 flex-1 rounded-lg -mx-2 px-2 py-2 no-underline hover:bg-gray-50 dark:hover:bg-gray-900/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400">
                    ${iconHtml}
                    <span class="font-semibold truncate">${escHtml(tech.name)}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">${conceptsCount} ${escHtml(conceptsLabel)}</span>
                  </a>
                  <button type="button" data-tech-delete data-tech-id="${escHtml(tech.slug)}" data-tech-name="${escHtml(tech.name)}" class="inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-50 shrink-0">Eliminar</button>
                </div>
              </div>`;
            })
            .join("")}
        </div>`
      : techRows
          .map((tech) => {
            const conceptsCount = countByTechDbId.get(tech.id) ?? 0;
            const iconSrc = getTechnologyIconSrc({ id: tech.slug, name: tech.name });
            const iconHtml = iconSrc
              ? `<img src="${escHtml(iconSrc)}" alt="" class="h-5 w-5 shrink-0" loading="lazy" />`
              : "";
            const href = `/technologies/view?tech=${encodeURIComponent(tech.slug)}`;
            const viewLabel = escHtml(i18next.t("technologies.viewDetail"));
            const conceptsLabel = escHtml(i18next.t("technologies.concepts"));
            return `<article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm">
                <a href="${href}" class="flex items-baseline justify-between gap-3 min-w-0 no-underline rounded-lg -m-1 p-1 hover:bg-gray-50 dark:hover:bg-gray-900/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400">
                  <div class="flex items-center gap-2 min-w-0">${iconHtml}<h3 class="m-0 text-base font-semibold truncate text-gray-900 dark:text-gray-100">${escHtml(tech.name)}</h3></div>
                  <span class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 whitespace-nowrap shrink-0">${conceptsCount} ${conceptsLabel}</span>
                </a>
                <div class="flex flex-wrap items-center gap-2">
                  <a href="${href}" class="btn-primary no-underline flex-1 min-w-28 text-center">${viewLabel}</a>
                  <button type="button" data-tech-delete data-tech-id="${escHtml(tech.slug)}" data-tech-name="${escHtml(tech.name)}" class="inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-50">Eliminar</button>
                </div>
              </article>`;
          })
          .join("");
  mount.innerHTML = html;
  writeCache(userId, html, countText);
}

// Expose for other scripts (view toggles, post-create refresh)
window.skillatlas = window.skillatlas ?? {};
window.skillatlas.bootstrapTechnologiesGrid = async () => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const userId = await getSessionUserId(supabase);
  if (!userId) return;
  try {
    sessionStorage.removeItem(`skillatlas_cache_technologies_grid_v1:${userId}`);
  } catch {
    // ignore
  }
  await bootstrapTechnologiesGrid();
};
window.skillatlas.clearTechnologiesCache = () => {
  // best-effort clear current user's cache if session exists
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  void (async () => {
    const userId = await getSessionUserId(supabase);
    if (!userId) return;
    try {
      sessionStorage.removeItem(`skillatlas_cache_technologies_grid_v1:${userId}`);
    } catch {
      // ignore
    }
  })();
};

function bootTechnologiesPage() {
  void initTechnologyForm();
  void bootstrapTechnologiesGrid().then(() => initTechnologyActions());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTechnologiesPage);
} else {
  bootTechnologiesPage();
}

document.addEventListener("astro:page-load", bootTechnologiesPage);
document.addEventListener("astro:after-swap", bootTechnologiesPage);

