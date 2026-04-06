import i18next from "i18next";
import { coerceEvidenceDisplayKind } from "@lib/evidence-url";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { loadPrefs, updatePrefs } from "@scripts/core/prefs";
import { showToast } from "@scripts/core/ui-feedback";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const QA_STORAGE_KEY = "skillatlas_qa_v1";

type QaItem = { id: string; labelKey: string; labelFallback: string; href?: string };

const QA_ITEMS: QaItem[] = [
  { id: "auth-login", labelKey: "settings.qa.itemAuthLogin", labelFallback: "Login/logout + sesión expirada", href: "/login" },
  { id: "crud-tech", labelKey: "settings.qa.itemCrudTech", labelFallback: "CRUD Tecnologías/Conceptos", href: "/technologies" },
  { id: "crud-proj", labelKey: "settings.qa.itemCrudProj", labelFallback: "CRUD Proyectos/Embeds", href: "/projects" },
  { id: "share-portfolio-slug", labelKey: "settings.qa.itemShareSlug", labelFallback: "Portfolio público por slug (/portfolio/<slug>)", href: "/settings" },
  { id: "share-portfolio-token", labelKey: "settings.qa.itemShareToken", labelFallback: "Portfolio público por token (/p/<token>)", href: "/settings" },
  { id: "share-cv-token", labelKey: "settings.qa.itemShareCv", labelFallback: "CV público por token (/cv/p/<token>)", href: "/settings" },
  { id: "prefs-cv", labelKey: "settings.qa.itemPrefsCv", labelFallback: "Prefs CV: selección/orden + cvProfile", href: "/cv" },
  { id: "prefs-settings", labelKey: "settings.qa.itemPrefsSettings", labelFallback: "Ajustes: navegación lateral + preferencias", href: "/settings" },
];

function readState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(QA_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeState(next: Record<string, boolean>) {
  try {
    localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function mdLink(label: string, href?: string): string {
  return href ? `[${label}](${href})` : label;
}

async function seedDemoData(feedbackEl?: HTMLElement) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    showToast(tt("settings.qa.noSupabase", "No hay cliente Supabase configurado."), "error");
    return;
  }
  const userId = await getSessionUserId(supabase);
  if (!userId) {
    showToast(tt("settings.qa.needSession", "Inicia sesión para crear datos de prueba."), "error");
    return;
  }

  const say = (msg: string) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.className = "m-0 text-xs text-gray-600 dark:text-gray-400 min-h-4";
  };

  say(tt("settings.qa.seeding", "Creando datos de prueba…"));

  // Technologies
  const techSeeds = [
    { slug: "qa-supabase", name: "Supabase" },
    { slug: "qa-astro", name: "Astro" },
    { slug: "qa-tailwind", name: "Tailwind CSS" },
  ];

  const techIdBySlug = new Map<string, string>();
  for (const t of techSeeds) {
    const existing = await supabase.from("technologies").select("id").eq("user_id", userId).eq("slug", t.slug).maybeSingle();
    if (existing.data?.id) {
      techIdBySlug.set(t.slug, existing.data.id);
      continue;
    }
    const ins = await supabase
      .from("technologies")
      .insert({ user_id: userId, slug: t.slug, name: t.name, icon_key: t.slug } as any)
      .select("id")
      .maybeSingle();
    if (ins.error) throw ins.error;
    if (ins.data?.id) techIdBySlug.set(t.slug, ins.data.id);
  }

  // Concepts
  const conceptSeeds: { techSlug: string; title: string; progress: number; notes: string }[] = [
    { techSlug: "qa-supabase", title: "RLS (Row Level Security)", progress: 60, notes: "Policies + auth.uid()" },
    { techSlug: "qa-astro", title: "View Transitions", progress: 40, notes: "Client navigation states" },
    { techSlug: "qa-tailwind", title: "Print styles", progress: 70, notes: "A4 + light theme lock" },
  ];

  for (const c of conceptSeeds) {
    const technology_id = techIdBySlug.get(c.techSlug);
    if (!technology_id) continue;
    const existing = await supabase
      .from("concepts")
      .select("id")
      .eq("user_id", userId)
      .eq("technology_id", technology_id)
      .ilike("title", c.title)
      .maybeSingle();
    if (existing.data?.id) continue;
    const ins = await supabase
      .from("concepts")
      .insert({ user_id: userId, technology_id, title: c.title, progress: c.progress, notes: c.notes } as any);
    if (ins.error) throw ins.error;
  }

  // Projects
  const projectSeeds = [
    {
      slug: "qa-portfolio-share",
      title: "QA: Public sharing",
      description: "Proyecto demo para probar enlaces públicos y OG previews.",
      role: "Full‑stack",
      outcome: "Verificar slugs, tokens y renders públicos.",
      techSlugs: ["qa-supabase", "qa-astro"],
      embed: { kind: "link" as const, title: "Demo link", url: "https://example.com" },
    },
    {
      slug: "qa-cv-builder",
      title: "QA: CV builder",
      description: "Proyecto demo para probar editor de CV e impresión.",
      role: "Frontend",
      outcome: "Validar preview modal y print en claro.",
      techSlugs: ["qa-astro", "qa-tailwind"],
      embed: { kind: "link" as const, title: "Docs", url: "https://astro.build" },
    },
  ];

  for (const p of projectSeeds) {
    const existing = await supabase.from("projects").select("id").eq("user_id", userId).eq("slug", p.slug).maybeSingle();
    const projectId = existing.data?.id;
    const pid =
      projectId ??
      (await (async () => {
        const ins = await supabase
          .from("projects")
          .insert([{ user_id: userId, slug: p.slug, title: p.title, description: p.description, role: p.role, outcome: p.outcome }] as any)
          .select("id")
          .maybeSingle();
        if (ins.error) throw ins.error;
        return ins.data?.id as string | undefined;
      })());
    if (!pid) continue;

    // Link technologies
    for (const ts of p.techSlugs) {
      const technology_id = techIdBySlug.get(ts);
      if (!technology_id) continue;
      const linkExists = await supabase
        .from("project_technologies")
        .select("project_id")
        .eq("project_id", pid)
        .eq("technology_id", technology_id)
        .maybeSingle();
      if (linkExists.data) continue;
      const link = await supabase.from("project_technologies").insert([{ project_id: pid, technology_id }] as any);
      if (link.error) throw link.error;
    }

    // Ensure at least one embed
    const embedCount = await supabase
      .from("project_embeds")
      .select("id", { count: "exact", head: true })
      .eq("project_id", pid);
    if (embedCount.error) throw embedCount.error;
    if ((embedCount.count ?? 0) === 0) {
      const kind = coerceEvidenceDisplayKind(p.embed.url, p.embed.kind);
      const emb = await supabase.from("project_embeds").insert([
        {
          project_id: pid,
          kind,
          title: p.embed.title,
          url: p.embed.url,
          sort_order: 0,
          show_in_public: true,
          thumbnail_url: null,
        },
      ] as any);
      if (emb.error) throw emb.error;
    }
  }

  say(tt("settings.qa.seedDone", "Datos de prueba listos."));
  showToast(tt("settings.qa.seedDoneToast", "Datos de prueba creados."), "success");
}

function init() {
  const mounts = document.querySelectorAll<HTMLElement>('[data-settings-section="qa"]');
  if (mounts.length === 0) return;

  let lastError: { message: string; where?: string } | null = null;

  const allToggles = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>("[data-qa-tester-mode]"));
  const allPanels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-qa-panel]"));

  const applyMode = () => {
    const on = Boolean(loadPrefs().qaTesterMode);
    allToggles().forEach((t) => {
      t.checked = on;
    });
    allPanels().forEach((p) => {
      p.classList.toggle("hidden", !on);
    });
  };

  const renderChecklist = () => {
    const state = readState();
    document.querySelectorAll<HTMLElement>("[data-qa-checklist]").forEach((cl) => {
      cl.innerHTML = QA_ITEMS.map((it) => {
        const label = tt(it.labelKey, it.labelFallback);
        const checked = Boolean(state[it.id]);
        const link = it.href
          ? `<a class="text-indigo-700 dark:text-indigo-300 hover:underline no-underline" href="${esc(it.href)}">${esc(label)}</a>`
          : `<span>${esc(label)}</span>`;
        return `<label class="flex items-start gap-2 cursor-pointer rounded-lg border border-gray-200/70 dark:border-gray-800 bg-white/60 dark:bg-gray-950/40 px-3 py-2">
        <input type="checkbox" data-qa-item="${esc(it.id)}" class="rounded border-gray-300 dark:border-gray-600 mt-0.5" ${checked ? "checked" : ""} />
        <span class="text-sm text-gray-900 dark:text-gray-100">${link}</span>
      </label>`;
      }).join("");
    });
  };

  mounts.forEach((mount) => {
    if (mount.dataset.qaBound === "1") return;
    mount.dataset.qaBound = "1";

    const toggle = mount.querySelector<HTMLInputElement>("[data-qa-tester-mode]");
    const checklist = mount.querySelector<HTMLElement>("[data-qa-checklist]");
    const copyChecklistBtn = mount.querySelector<HTMLButtonElement>("[data-qa-copy-checklist]");
    const seedBtn = mount.querySelector<HTMLButtonElement>("[data-qa-seed]");
    const copyDebugBtn = mount.querySelector<HTMLButtonElement>("[data-qa-copy-debug]");
    const feedback = mount.querySelector<HTMLElement>("[data-qa-feedback]");

    if (!toggle || !checklist || !copyChecklistBtn || !seedBtn || !copyDebugBtn) return;

    toggle.addEventListener("change", () => {
      updatePrefs({ qaTesterMode: Boolean(toggle.checked) });
      applyMode();
      showToast(
        toggle.checked
          ? tt("settings.qa.enabledToast", "Modo tester activado.")
          : tt("settings.qa.disabledToast", "Modo tester desactivado."),
        "success",
      );
    });

    checklist.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement | null;
      if (!t || t.type !== "checkbox") return;
      const id = t.dataset.qaItem;
      if (!id) return;
      const state = readState();
      state[id] = Boolean(t.checked);
      writeState(state);
      renderChecklist();
    });

    copyChecklistBtn.addEventListener("click", async () => {
      const state = readState();
      const lines = QA_ITEMS.map((it) => {
        const label = tt(it.labelKey, it.labelFallback);
        const done = Boolean(state[it.id]);
        return `- [${done ? "x" : " "}] ${mdLink(label, it.href)}`;
      });
      const text = `${tt("settings.qa.copyHeader", "Checklist QA")}\n\n${lines.join("\n")}\n`;
      await navigator.clipboard.writeText(text);
      showToast(tt("settings.qa.copiedToast", "Checklist copiada."), "success");
    });

    seedBtn.addEventListener("click", async () => {
      try {
        seedBtn.disabled = true;
        document.querySelectorAll<HTMLButtonElement>("[data-qa-seed]").forEach((b) => {
          b.disabled = true;
        });
        await seedDemoData(feedback ?? undefined);
      } catch (e: any) {
        lastError = { where: "seed", message: e?.message ?? String(e) };
        document.querySelectorAll<HTMLElement>("[data-qa-feedback]").forEach((el) => {
          el.textContent = lastError!.message;
          el.className = "m-0 text-xs text-red-600 dark:text-red-400 min-h-4";
        });
        showToast(tt("settings.qa.seedErrorToast", "Error creando datos de prueba."), "error");
      } finally {
        document.querySelectorAll<HTMLButtonElement>("[data-qa-seed]").forEach((b) => {
          b.disabled = false;
        });
      }
    });

    copyDebugBtn.addEventListener("click", async () => {
      const supabase = getSupabaseBrowserClient();
      let userId: string | null = null;
      if (supabase) {
        try {
          userId = await getSessionUserId(supabase);
        } catch {
          userId = null;
        }
      }
      const prefs = loadPrefs();
      const payload = {
        at: new Date().toISOString(),
        path: window.location.pathname,
        href: window.location.href,
        userId,
        dataSource: (import.meta as any).env?.PUBLIC_DATA_SOURCE ?? "unknown",
        prefs: { qaTesterMode: prefs.qaTesterMode, lang: prefs.lang, themeMode: prefs.themeMode },
        lastError,
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showToast(tt("settings.qa.debugCopiedToast", "Debug info copiada."), "success");
    });
  });

  renderChecklist();
  applyMode();
  window.addEventListener("skillatlas:prefs-updated", () => applyMode());
}

const boot = () => init();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

