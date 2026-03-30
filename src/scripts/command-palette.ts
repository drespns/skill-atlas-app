import { getSupabaseBrowserClient } from "./client-supabase";
import { getSessionUserId } from "./auth-session";

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  href: string;
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function initCommandPalette() {
  const root = document.querySelector<HTMLElement>("[data-command-palette]");
  if (!root) return;
  const dialog = root.querySelector<HTMLElement>("[data-command-palette-dialog]");
  const input = root.querySelector<HTMLInputElement>("[data-command-palette-input]");
  const list = root.querySelector<HTMLElement>("[data-command-palette-list]");
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-command-palette-close]");
  if (!dialog || !input || !list || !closeBtn) return;

  let open = false;
  let allItems: PaletteItem[] = [];
  let filtered: PaletteItem[] = [];
  let activeIndex = 0;

  const staticItems: PaletteItem[] = [
    { id: "go-app", label: "Abrir app", href: "/app", hint: "/app" },
    { id: "go-technologies", label: "Tecnologías", href: "/technologies", hint: "/technologies" },
    { id: "go-projects", label: "Proyectos", href: "/projects", hint: "/projects" },
    { id: "new-technology", label: "Crear tecnología", href: "/technologies?create=1", hint: "Acción" },
    { id: "new-project", label: "Crear proyecto", href: "/projects?create=1", hint: "Acción" },
    { id: "go-settings", label: "Ajustes", href: "/settings", hint: "/settings" },
    { id: "go-login", label: "Login", href: "/login", hint: "/login" },
  ];

  const cacheKey = (userId: string) => `skillatlas_cache_palette_v1:${userId}`;
  const readCache = (userId: string) => {
    try {
      const raw = sessionStorage.getItem(cacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts: number; items: PaletteItem[] };
      if (!parsed?.ts || !Array.isArray(parsed.items)) return null;
      if (Date.now() - parsed.ts > 5 * 60 * 1000) return null;
      return parsed.items;
    } catch {
      return null;
    }
  };
  const writeCache = (userId: string, items: PaletteItem[]) => {
    try {
      sessionStorage.setItem(cacheKey(userId), JSON.stringify({ ts: Date.now(), items }));
    } catch {
      // ignore
    }
  };

  const render = () => {
    const q = input.value.trim().toLowerCase();
    filtered = q
      ? allItems.filter((it) => (it.label + " " + (it.hint ?? "")).toLowerCase().includes(q))
      : allItems;
    activeIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));

    if (filtered.length === 0) {
      list.innerHTML = `<p class="m-0 text-sm text-gray-600 dark:text-gray-300 px-3 py-2">Sin resultados</p>`;
      return;
    }

    list.innerHTML = filtered
      .map((it, idx) => {
        const active = idx === activeIndex;
        return `<button type="button" data-palette-item="${esc(it.id)}"
          class="w-full text-left px-3 py-2 rounded-lg ${active ? "bg-gray-100 dark:bg-gray-900" : "hover:bg-gray-50 dark:hover:bg-gray-900/50"}">
          <div class="flex items-center justify-between gap-3">
            <span class="font-semibold">${esc(it.label)}</span>
            ${it.hint ? `<span class="text-xs text-gray-500 dark:text-gray-400">${esc(it.hint)}</span>` : ""}
          </div>
        </button>`;
      })
      .join("");

    list.querySelectorAll<HTMLButtonElement>("[data-palette-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-palette-item");
        const item = filtered.find((x) => x.id === id);
        if (!item) return;
        window.location.href = item.href;
      });
    });
  };

  const openPalette = async () => {
    if (open) return;
    open = true;
    root.classList.remove("hidden");
    root.classList.add("flex");
    input.value = "";
    activeIndex = 0;

    allItems = [...staticItems];

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const userId = await getSessionUserId(supabase);
      if (userId) {
        const cached = readCache(userId);
        if (cached) {
          allItems = [...staticItems, ...cached];
          render();
          // background refresh
          setTimeout(() => void hydrateFromSupabase(supabase, userId), 0);
        } else {
          await hydrateFromSupabase(supabase, userId);
        }
      }
    }

    render();
    input.focus();
    input.select();
  };

  const closePalette = () => {
    if (!open) return;
    open = false;
    root.classList.add("hidden");
    root.classList.remove("flex");
  };

  const hydrateFromSupabase = async (supabase: any, userId: string) => {
    const [techRes, projRes] = await Promise.all([
      supabase.from("technologies").select("slug, name").order("name").limit(50),
      supabase.from("projects").select("slug, title").order("title").limit(50),
    ]);
    const items: PaletteItem[] = [];
    for (const t of techRes.data ?? []) {
      items.push({
        id: `tech:${t.slug}`,
        label: t.name,
        hint: "Tecnología",
        href: `/technologies/view?tech=${encodeURIComponent(t.slug)}`,
      });
    }
    for (const p of projRes.data ?? []) {
      items.push({
        id: `proj:${p.slug}`,
        label: p.title,
        hint: "Proyecto",
        href: `/projects/view?project=${encodeURIComponent(p.slug)}`,
      });
    }
    writeCache(userId, items);
    allItems = [...staticItems, ...items];
    render();
  };

  document.addEventListener("keydown", (e) => {
    const isK = e.key.toLowerCase() === "k";
    const isEscape = e.key === "Escape";

    if ((e.ctrlKey || e.metaKey) && isK) {
      e.preventDefault();
      void openPalette();
      return;
    }
    if (open && isEscape) {
      e.preventDefault();
      closePalette();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) window.location.href = item.href;
    }
  });

  window.addEventListener("skillatlas:open-palette", () => {
    void openPalette();
  });

  input.addEventListener("input", () => render());

  closeBtn.addEventListener("click", closePalette);
  root.addEventListener("click", (e) => {
    if (e.target === root) closePalette();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCommandPalette);
} else {
  initCommandPalette();
}

