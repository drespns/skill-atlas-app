import { getTechnologyIconSrc } from "@config/icons";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import i18next from "i18next";
import { confirmModal, githubRepoTechImportModal, showToast, userFacingDbError } from "@scripts/core/ui-feedback";
import { loadPrefs } from "@scripts/core/prefs";
import { getCatalogEntryForSlug, getTechnologyCatalogEntries } from "@scripts/technologies/technology-detail/concept-seeds";
import { supportsTechnologiesKindColumn } from "@scripts/core/supabase-schema";

declare global {
  interface Window {
    skillatlas?: {
      bootstrapTechnologiesGrid?: () => Promise<void>;
      clearTechnologiesCache?: () => void;
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
  const kindSelect = form.querySelector<HTMLSelectElement>("[data-tech-kind]");
  const multiToggle = form.querySelector<HTMLInputElement>("[data-tech-multi-toggle]");
  const chipsWrap = form.querySelector<HTMLElement>("[data-tech-multi-chips]");
  const githubBtn = form.querySelector<HTMLButtonElement>("[data-tech-github-import]");
  if (!nameInput || !submitBtn || !feedback) return;

  const seedCatalog = getTechnologyCatalogEntries();
  let pickedSlug: string | null = null;
  let catalogLabelLock: string | null = null;
  let multiMode = false;
  const multiPicked: { name: string; slug: string; fromCatalog: boolean }[] = [];

  const MULTI_DRAFT_KEY = "skillatlas_technologies_multi_draft_v1";
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(MULTI_DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const p = parsed as { multiMode?: unknown; items?: unknown };
      const items = Array.isArray(p.items)
        ? (p.items as any[])
            .map((x) => ({
              name: typeof x?.name === "string" ? x.name : "",
              slug: typeof x?.slug === "string" ? x.slug : "",
              fromCatalog: Boolean(x?.fromCatalog),
            }))
            .filter((x) => x.name.trim() && x.slug.trim())
        : [];
      return { multiMode: Boolean(p.multiMode), items };
    } catch {
      return null;
    }
  };
  const saveDraft = () => {
    try {
      localStorage.setItem(MULTI_DRAFT_KEY, JSON.stringify({ multiMode, items: multiPicked }));
    } catch {
      // ignore
    }
  };
  const clearDraft = () => {
    try {
      localStorage.removeItem(MULTI_DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const setMultiMode = (next: boolean) => {
    multiMode = next;
    if (chipsWrap) chipsWrap.classList.toggle("hidden", !multiMode);
    // Evita validación HTML ("Completa este campo") cuando hay chips y el input queda vacío.
    try {
      nameInput.required = !multiMode;
    } catch {
      // ignore
    }
    if (!multiMode) {
      multiPicked.length = 0;
      renderChips();
      clearDraft();
      // conserva el comportamiento anterior: un solo pick bloquea el label.
      pickedSlug = null;
      catalogLabelLock = null;
    } else {
      // En modo múltiple, el input no representa una tecnología única.
      pickedSlug = null;
      catalogLabelLock = null;
      saveDraft();
    }
  };

  const normalizeMultiTokens = (raw: string) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const addMultiItem = (name: string, slug: string, fromCatalog: boolean) => {
    const key = slug.trim();
    if (!key) return;
    if (multiPicked.some((x) => x.slug === key)) return;
    multiPicked.push({ name, slug: key, fromCatalog });
    renderChips();
    saveDraft();
  };

  const removeMultiItem = (slug: string) => {
    const idx = multiPicked.findIndex((x) => x.slug === slug);
    if (idx >= 0) multiPicked.splice(idx, 1);
    renderChips();
    saveDraft();
  };

  const renderChips = () => {
    if (!chipsWrap) return;
    if (!multiMode) {
      chipsWrap.innerHTML = "";
      return;
    }
    if (multiPicked.length === 0) {
      chipsWrap.innerHTML =
        '<p class="m-0 text-[11px] text-gray-500 dark:text-gray-400">Selecciona varias del catálogo o añade nombres con Enter.</p>';
      return;
    }
    chipsWrap.innerHTML = multiPicked
      .map((it) => {
        const iconSrc = getTechnologyIconSrc({ id: it.slug, name: it.name });
        const iconHtml = iconSrc
          ? `<img src="${escHtml(iconSrc)}" alt="" class="h-4 w-4 shrink-0 rounded-sm object-contain" loading="lazy" />`
          : `<span class="h-4 w-4 shrink-0 rounded-sm bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>`;
        const tone = it.fromCatalog
          ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30"
          : "border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/50";
        return `<span class="inline-flex items-center gap-1.5 rounded-full border ${tone} px-2 py-1 text-xs">
          ${iconHtml}
          <span class="font-semibold text-gray-800 dark:text-gray-200">${escHtml(it.name)}</span>
          <button type="button" data-chip-remove="${escHtml(it.slug)}" class="ml-1 rounded-full px-1.5 py-0.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">×</button>
        </span>`;
      })
      .join("");
  };

  const renderSeedSuggestions = (q: string) => {
    if (!seedSuggestions) return;
    const ql = q.trim().toLowerCase();
    const kindFilter = (kindSelect?.value ?? "all") as string;
    const base = kindFilter === "all" ? seedCatalog : seedCatalog.filter((e) => e.kind === kindFilter);
    const hits = !ql
      ? [...base].sort((a, b) => a.label.localeCompare(b.label, "es"))
      : base
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
        const kind = e.kind;
        const kindLabel =
          kind === "framework"
            ? "Framework"
            : kind === "library"
              ? "Librería"
              : kind === "package"
                ? "Paquete"
                : "Tecnología";
        const kindTone =
          kind === "framework"
            ? "bg-violet-100/80 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200"
            : kind === "library"
              ? "bg-sky-100/80 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200"
              : kind === "package"
                ? "bg-amber-100/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
                : "bg-gray-100/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200";
        const secondLine = e.hasSeed
          ? `Plantilla importación · slug <code class="text-[10px]">${escHtml(e.slug)}</code>`
          : `Catálogo · slug <code class="text-[10px]">${escHtml(e.slug)}</code>`;
        return `<li role="option"><button type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 border-0 bg-transparent cursor-pointer flex items-start gap-2" data-seed-slug="${escHtml(e.slug)}" data-seed-label="${escHtml(e.label)}">${iconHtml}<span class="min-w-0 flex-1"><span class="flex flex-wrap items-center gap-2"><span class="font-medium text-gray-900 dark:text-gray-100">${escHtml(e.label)}</span><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindTone}">${kindLabel}</span></span><span class="block text-[11px] text-gray-500 dark:text-gray-400">${secondLine}</span></span></button></li>`;
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

  kindSelect?.addEventListener("change", () => renderSeedSuggestions(nameInput.value));

  seedSuggestions?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-seed-slug]");
    if (!btn) return;
    const slug = btn.dataset.seedSlug ?? "";
    const label = btn.dataset.seedLabel ?? "";
    if (multiMode) {
      addMultiItem(label, slug, true);
      nameInput.value = "";
      seedSuggestions.classList.add("hidden");
      nameInput.focus();
      return;
    }
    nameInput.value = label;
    pickedSlug = slug;
    catalogLabelLock = label;
    seedSuggestions.classList.add("hidden");
    nameInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (seedWrap && !seedWrap.contains(e.target as Node)) seedSuggestions?.classList.add("hidden");
  });

  multiToggle?.addEventListener("change", () => setMultiMode(Boolean(multiToggle.checked)));
  // Hidrata borrador (chips + toggle) tras un refresh.
  const draft = loadDraft();
  if (draft?.multiMode && multiToggle) multiToggle.checked = true;
  setMultiMode(Boolean(multiToggle?.checked));
  if (draft?.multiMode && draft.items.length > 0) {
    multiPicked.length = 0;
    multiPicked.push(...draft.items);
    renderChips();
  }

  chipsWrap?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-chip-remove]");
    if (!btn) return;
    const slug = btn.dataset.chipRemove ?? "";
    removeMultiItem(slug);
  });

  githubBtn?.addEventListener("click", async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      showToast("Faltan variables de entorno de Supabase.", "error");
      return;
    }
    const userId = await getSessionUserId(supabase);
    if (!userId) {
      showToast("Inicia sesión para importar tecnologías.", "warning");
      return;
    }

    const result = await githubRepoTechImportModal({ title: "Importar tecnologías desde GitHub" });
    if (!result || result.technologies.length === 0) return;

    githubBtn.disabled = true;
    submitBtn.disabled = true;
    feedback.textContent = "Importando tecnologías...";
    feedback.className = "text-sm text-gray-600";
    try {
      let ok = 0;
      for (const t of result.technologies) {
        const dup = await supabase.from("technologies").select("id").eq("slug", t.slug).eq("user_id", userId).maybeSingle();
        if (dup.error) continue;
        if (dup.data) continue;
        const ins = await supabase.from("technologies").insert({ name: t.name, slug: t.slug, icon_key: t.slug, user_id: userId });
        if (!ins.error) ok += 1;
      }
      showToast(ok > 0 ? `Tecnologías importadas: ${ok}.` : "No había tecnologías nuevas para crear.", ok > 0 ? "success" : "info");
      clearDraft();
      if (window.skillatlas?.clearTechnologiesCache) window.skillatlas.clearTechnologiesCache();
      if (window.skillatlas?.bootstrapTechnologiesGrid) {
        await window.skillatlas.bootstrapTechnologiesGrid();
        void initTechnologyActions();
      } else {
        window.location.reload();
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "Error inesperado.";
      feedback.textContent = `Error: ${msg}`;
      feedback.className = "text-sm text-red-600";
    } finally {
      githubBtn.disabled = false;
      submitBtn.disabled = false;
    }
  });

  nameInput.addEventListener("keydown", (e) => {
    if (!multiMode) return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    const tokens = normalizeMultiTokens(nameInput.value);
    if (tokens.length === 0) return;
    for (const t of tokens) addMultiItem(t, toSlug(t), false);
    nameInput.value = "";
    seedSuggestions?.classList.add("hidden");
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
    const singleName = nameInput.value.trim();
    if (!multiMode && !singleName) return;
    if (multiMode) {
      const tokens = normalizeMultiTokens(singleName);
      for (const t of tokens) addMultiItem(t, toSlug(t), false);
      if (multiPicked.length === 0) {
        feedback.textContent = "Añade al menos una tecnología (catálogo o nombres separados por coma).";
        feedback.className = "text-sm text-amber-600 m-0";
        nameInput.focus();
        return;
      }
    }

    submitBtn.disabled = true;
    feedback.textContent = "Guardando...";
    feedback.className = "text-sm text-gray-600";

    const createOne = async (name: string, slug: string) => {
      const dup = await supabase
        .from("technologies")
        .select("id")
        .eq("slug", slug)
        .eq("user_id", userId)
        .maybeSingle();
      if (dup.error) return { ok: false as const, reason: userFacingDbError(dup.error.message, "Error al validar duplicado.") };
      if (dup.data) return { ok: false as const, reason: "Ya tienes una tecnología con ese nombre (mismo slug)." };

      const kindFromCatalog = getCatalogEntryForSlug(slug)?.kind ?? null;
      const kindFromUi =
        (kindSelect?.value === "technology" ||
        kindSelect?.value === "framework" ||
        kindSelect?.value === "library" ||
        kindSelect?.value === "package"
          ? kindSelect.value
          : null) ?? null;
      const kind = kindFromCatalog ?? kindFromUi;
      const supportsKind = kind ? await supportsTechnologiesKindColumn(supabase) : false;
      const payload: any = { name, slug, icon_key: slug, user_id: userId };
      if (supportsKind && kind) payload.kind = kind;
      const { error } = await supabase.from("technologies").insert(payload);
      if (error) {
        return {
          ok: false as const,
          reason:
            error.code === "23505"
              ? "Conflicto de slug en la base de datos: suele indicar un índice único global en slug (heredado). En Supabase ejecuta el script docs/sql/saas-004-drop-global-slug-constraints.sql; debe quedar solo la unicidad (user_id, slug) de saas-001."
              : userFacingDbError(error.message, "Error al guardar la tecnología."),
        };
      }
      return { ok: true as const };
    };

    const targets = multiMode
      ? [...multiPicked]
      : [{ name: singleName, slug: pickedSlug ?? toSlug(singleName), fromCatalog: Boolean(pickedSlug) }];

    let okCount = 0;
    const errors: string[] = [];
    for (const t of targets) {
      feedback.textContent = multiMode ? `Guardando… (${okCount + 1}/${targets.length})` : "Guardando...";
      const res = await createOne(t.name, t.slug);
      if (res.ok) okCount += 1;
      else errors.push(`${t.name}: ${res.reason}`);
    }

    if (okCount > 0) showToast(multiMode ? `Tecnologías creadas: ${okCount}.` : "Tecnología creada correctamente.", "success");
    if (errors.length > 0) showToast(errors[0]!, "warning", 8000);

    feedback.textContent = errors.length > 0 ? `Algunas no se pudieron crear (${errors.length}).` : "Guardado.";
    feedback.className = errors.length > 0 ? "text-sm text-amber-600 m-0" : "text-sm text-green-600 m-0";

    nameInput.value = "";
    pickedSlug = null;
    catalogLabelLock = null;
    if (multiMode) {
      multiPicked.length = 0;
      renderChips();
      clearDraft();
    }
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
        const hint = userFacingDbError(deleteRes.error.message, "Error al eliminar tecnología.");
        if (feedback) {
          feedback.textContent = hint;
          feedback.className = "text-sm text-red-600 m-0";
        }
        showToast(hint, "error");
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
  const filterStackCb = document.querySelector<HTMLInputElement>("[data-tech-filter-stack]");

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
      <a href="/settings#prefs" class="inline-flex mt-3 rounded-lg border px-3 py-2 text-sm font-semibold no-underline">Ir a Ajustes</a>
    </div>`;
    if (countEl) countEl.textContent = "0 total";
    return;
  }

  const prefs = loadPrefs();
  const view = prefs.technologiesView;
  const stackFilterKey = "skillatlas_tech_filter_stack_v1";
  try {
    if (filterStackCb && filterStackCb.dataset.hydrated !== "1") {
      filterStackCb.checked = localStorage.getItem(stackFilterKey) === "1";
      filterStackCb.dataset.hydrated = "1";
      filterStackCb.addEventListener("change", () => {
        try {
          localStorage.setItem(stackFilterKey, filterStackCb.checked ? "1" : "0");
        } catch {
          // ignore
        }
        void bootstrapTechnologiesGrid().then(() => initTechnologyActions());
      });
    }
  } catch {
    // ignore
  }

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

  const [techRes, conceptRes, stackRes] = await Promise.all([
    supabase.from("technologies").select("id, slug, name").order("name"),
    supabase.from("concepts").select("technology_id"),
    filterStackCb?.checked
      ? supabase
          .from("project_technologies")
          .select("technology_id, projects!inner(user_id)")
          .eq("projects.user_id", userId)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (techRes.error) {
    mount.innerHTML = `<p class="text-sm text-red-600 col-span-full">${escHtml(techRes.error.message)}</p>`;
    return;
  }

  let techRows = (techRes.data ?? []) as { id: string; slug: string; name: string }[];
  if (filterStackCb?.checked) {
    const used = new Set<string>();
    for (const row of (stackRes.data ?? []) as any[]) {
      const tid = String(row?.technology_id ?? "").trim();
      if (tid) used.add(tid);
    }
    techRows = techRows.filter((t) => used.has(t.id));
  }
  const countByTechDbId = new Map<string, number>();
  for (const row of conceptRes.data ?? []) {
    const tid = (row as { technology_id: string }).technology_id;
    countByTechDbId.set(tid, (countByTechDbId.get(tid) ?? 0) + 1);
  }

  const countText = `${techRows.length} total${filterStackCb?.checked ? " (stack)" : ""}`;
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
              const entry = getCatalogEntryForSlug(tech.slug);
              const kind = entry?.kind ?? "technology";
              const kindLabel =
                kind === "framework" ? "Framework" : kind === "library" ? "Librería" : kind === "package" ? "Paquete" : "Tecnología";
              const kindTone =
                kind === "framework"
                  ? "bg-violet-100/80 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200"
                  : kind === "library"
                    ? "bg-sky-100/80 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200"
                    : kind === "package"
                      ? "bg-amber-100/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
                      : "bg-gray-100/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200";
              const href = `/technologies/view?tech=${encodeURIComponent(tech.slug)}`;
              const conceptsLabel = i18next.t("technologies.concepts");
              return `<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                <div class="flex items-center justify-between gap-4">
                  <a href="${href}" class="flex items-center gap-2 min-w-0 flex-1 rounded-lg -mx-2 px-2 py-2 no-underline hover:bg-gray-50 dark:hover:bg-gray-900/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400">
                    ${iconHtml}
                    <span class="font-semibold truncate">${escHtml(tech.name)}</span>
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindTone}">${kindLabel}</span>
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
            const entry = getCatalogEntryForSlug(tech.slug);
            const kind = entry?.kind ?? "technology";
            const kindLabel =
              kind === "framework" ? "Framework" : kind === "library" ? "Librería" : kind === "package" ? "Paquete" : "Tecnología";
            const kindTone =
              kind === "framework"
                ? "bg-violet-100/80 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200"
                : kind === "library"
                  ? "bg-sky-100/80 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200"
                  : kind === "package"
                    ? "bg-amber-100/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
                    : "bg-gray-100/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200";
            const href = `/technologies/view?tech=${encodeURIComponent(tech.slug)}`;
            const viewLabel = escHtml(i18next.t("technologies.viewDetail"));
            const conceptsLabel = escHtml(i18next.t("technologies.concepts"));
            const bg = iconSrc ? `style="position: relative; overflow: hidden;"` : `style="position: relative;"`;
            const bgLayer = iconSrc
              ? `<div aria-hidden="true" class="pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.10] dark:opacity-[0.12]" style="background: url('${escHtml(
                  iconSrc,
                )}') no-repeat center / contain;"></div>`
              : "";
            return `<article class="border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950 flex flex-col gap-3 shadow-sm" ${bg}>
                ${bgLayer}
                <a href="${href}" class="flex items-baseline justify-between gap-3 min-w-0 no-underline rounded-lg -m-1 p-1 hover:bg-gray-50 dark:hover:bg-gray-900/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400">
                  <div class="flex items-center gap-2 min-w-0">${iconHtml}<div class="min-w-0"><h3 class="m-0 text-base font-semibold truncate text-gray-900 dark:text-gray-100">${escHtml(
                    tech.name,
                  )}</h3><div class="mt-1 flex flex-wrap gap-1"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindTone}">${kindLabel}</span></div></div></div>
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

