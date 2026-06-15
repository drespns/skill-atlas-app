import i18next from "i18next";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { loadPrefs, type CvProfileV1 } from "@scripts/core/prefs";
import { CV_STUDIO_EMBED_PREFS_CHANNEL, SKILLATLAS_PREFS_STORAGE_KEY } from "@lib/cv-studio-prefs-channel";
import { readCvSlotDocumentStateFromPrefs } from "@lib/cv-document-from-prefs";
import {
  renderCvDocument,
  resolveCvDocumentDomRefs,
  type CvDocumentDomRefs,
  type CvDocumentRenderInput,
  type ProjectRow,
} from "@lib/cv-document-render";
import { CV_LINK_SLOT_COUNT, migrateCvLinksToSlots } from "@lib/cv-contact-html";
import { bindCvStudioBlockSelection, syncCvStudioBlockSelection } from "@scripts/cv/cv-studio-block-selection";

/** Último listener para refrescar nombre/bio tras guardar desde /cv/canva u otras vistas. */
let lastPortfolioPatchListener: ((ev: Event) => void) | null = null;

type CvTechKind = "technology" | "framework" | "library" | "package" | "other";

function normalizeTechKind(raw: unknown): CvTechKind {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "technology" || s === "framework" || s === "library" || s === "package") return s;
  return "other";
}

function tt(key: string, fb: string): string {
  try {
    if (!i18next.isInitialized) return fb;
    const v = i18next.t(key);
    return typeof v === "string" && v.length > 0 && v !== key ? v : fb;
  } catch {
    return fb;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bootCvStudioInlineDocument(): void {
  const canvaRoot = document.querySelector<HTMLElement>("[data-cv-canva-v2-root]");
  const root =
    (canvaRoot && canvaRoot.querySelector<HTMLElement>("[data-cv-studio-doc-root]")) ||
    document.querySelector<HTMLElement>("[data-cv-studio-doc-root]");
  if (!root) return;
  const loadingEl = root.querySelector<HTMLElement>("[data-cv-studio-doc-loading]");
  const errEl = root.querySelector<HTMLElement>("[data-cv-studio-doc-error]");
  const panel = root.querySelector<HTMLElement>("[data-cv-studio-doc-panel]");
  if (!loadingEl || !errEl || !panel) return;
  if (root.dataset.cvStudioDocBound === "1") return;
  if (root.dataset.cvStudioDocBooting === "1") return;
  root.dataset.cvStudioDocBooting = "1";

  let projects: ProjectRow[] = [];
  let displayName = tt("cv.defaultName", "Sin nombre");
  let bio = "";
  let helpStackKeys: string[] = [];
  let avatarSignedUrl: string | null = null;
  let linkedinAvatar: string | null = null;
  let githubAvatar: string | null = null;
  const techName = new Map<string, string>();
  const techKind = new Map<string, CvTechKind>();
  const techsByProject = new Map<string, string[]>();
  const techIdsByProject = new Map<string, string[]>();
  const projectIdBySlug = new Map<string, string>();
  let refs: CvDocumentDomRefs | null = null;

  let cvProfile = {} as CvProfileV1;
  let selectedOrder: string[] = [];

  const getCvLinkSlots = (): string[] => {
    if (Array.isArray(cvProfile.cvLinkSlots) && cvProfile.cvLinkSlots.length === CV_LINK_SLOT_COUNT) {
      return cvProfile.cvLinkSlots.map((x) => (typeof x === "string" ? x : ""));
    }
    return migrateCvLinksToSlots(cvProfile.links);
  };

  const slotLabels = () => [
    tt("cv.linkLabel1", "LinkedIn"),
    tt("cv.linkLabel2", "GitHub"),
    tt("cv.linkLabel3", "Portfolio"),
    tt("cv.linkLabel4", "X / Twitter"),
    tt("cv.linkLabel5", "Web / otro"),
    tt("cv.linkLabel6", "ORCID"),
    tt("cv.linkLabel7", "Google Scholar"),
  ];

  const buildInput = (): CvDocumentRenderInput => ({
    cvProfile,
    displayName,
    bio,
    helpStackKeys,
    projects,
    selectedOrder,
    projectIdBySlug,
    techsByProject,
    techIdsByProject,
    techName,
    techKind,
    avatarSignedUrl,
    linkedinAvatar,
    githubAvatar,
    tt,
    esc,
    getCvLinkSlots,
    slotLabels,
    contactChipsMode: panel.closest("[data-cv-canva-v2-root]") ? "plain" : "anchors",
  });

  const syncSlotFromPrefs = () => {
    const snap = readCvSlotDocumentStateFromPrefs(loadPrefs(), projects, avatarSignedUrl, linkedinAvatar);
    cvProfile = snap.cvProfile;
    selectedOrder = snap.selectedOrder;
  };

  const paint = () => {
    if (!refs) return;
    renderCvDocument(refs, buildInput());
    syncCvStudioBlockSelection(panel);
    window.dispatchEvent(new CustomEvent("skillatlas:cv-studio-doc-painted"));
  };

  const onPrefsExternal = () =>
    queueMicrotask(() => {
      syncSlotFromPrefs();
      paint();
    });

  const run = async () => {
    try {
    loadingEl.classList.remove("hidden");
    errEl.classList.add("hidden");
    panel.classList.add("hidden");

    const supabase = getSupabaseBrowserClient();
    const userId = supabase ? await getSessionUserId(supabase) : null;
    if (!supabase || !userId) {
      loadingEl.classList.add("hidden");
      errEl.textContent = tt("cv.studioDocNeedSession", "Inicia sesión para ver el documento.");
      errEl.classList.remove("hidden");
      root.dataset.cvStudioDocBound = "1";
      return;
    }

    const [projRes, techRes, profFull, sessRes] = await Promise.all([
      supabase
        .from("projects")
        .select("id, slug, title, description, role, outcome")
        .eq("user_id", userId)
        .order("title"),
      supabase.from("technologies").select("id, name, kind").eq("user_id", userId),
      supabase
        .from("portfolio_profiles")
        .select("display_name, bio, help_stack, avatar_url")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.auth.getSession(),
    ]);

    if (projRes.error) {
      loadingEl.classList.add("hidden");
      errEl.textContent = projRes.error.message ?? tt("cv.loadError", "No se pudieron cargar los proyectos.");
      errEl.classList.remove("hidden");
      root.dataset.cvStudioDocBound = "1";
      return;
    }

    projects = (projRes.data ?? []) as ProjectRow[];

    if (profFull.error && /column|help_stack/i.test(profFull.error.message ?? "")) {
      const profBasic = await supabase.from("portfolio_profiles").select("display_name, bio").eq("user_id", userId).maybeSingle();
      displayName = (profBasic.data?.display_name ?? "").trim() || displayName;
      bio = (profBasic.data?.bio ?? "").trim();
    } else {
      displayName = (profFull.data?.display_name ?? "").trim() || displayName;
      bio = (profFull.data?.bio ?? "").trim();
      const hsRaw = (profFull.data as { help_stack?: unknown })?.help_stack;
      if (Array.isArray(hsRaw)) {
        helpStackKeys = hsRaw.filter((x: unknown): x is string => typeof x === "string");
      }
      const a = (profFull.data as { avatar_url?: unknown })?.avatar_url;
      const avatarPath = typeof a === "string" && a ? a : null;
      if (avatarPath) {
        const signed = await supabase.storage.from("portfolio_avatars").createSignedUrl(avatarPath, 60 * 60);
        avatarSignedUrl = signed.data?.signedUrl ?? null;
      }
    }

    const sess = sessRes.data;
    const meta = (sess.session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    linkedinAvatar = typeof meta.picture === "string" && meta.picture ? meta.picture : null;
    githubAvatar = typeof meta.avatar_url === "string" && meta.avatar_url ? meta.avatar_url : null;

    techName.clear();
    techKind.clear();
    for (const t of techRes.data ?? []) {
      if (t?.id && typeof t.name === "string") {
        techName.set(t.id, t.name);
        techKind.set(t.id, normalizeTechKind((t as { kind?: unknown }).kind));
      }
    }

    techsByProject.clear();
    techIdsByProject.clear();
    projectIdBySlug.clear();
    const projectIds = projects.map((p) => p.id).filter(Boolean);
    for (const p of projects) projectIdBySlug.set(p.slug, p.id);

    const ptRes =
      projectIds.length > 0
        ? await supabase.from("project_technologies").select("project_id, technology_id").in("project_id", projectIds)
        : { data: [], error: null as unknown };

    for (const r of (ptRes.data ?? []) as { project_id?: string; technology_id?: string }[]) {
      const pid = r.project_id;
      const tid = r.technology_id;
      if (!pid || !tid) continue;
      const name = techName.get(tid);
      if (!name) continue;
      const list = techsByProject.get(pid) ?? [];
      list.push(name);
      techsByProject.set(pid, list);
      const idList = techIdsByProject.get(pid) ?? [];
      idList.push(tid);
      techIdsByProject.set(pid, idList);
    }

    syncSlotFromPrefs();
    refs = resolveCvDocumentDomRefs(panel);
    if (!refs) {
      loadingEl.classList.add("hidden");
      errEl.textContent = tt("cv.studioDocHostMissing", "No se encontró la estructura del documento.");
      errEl.classList.remove("hidden");
      root.dataset.cvStudioDocBound = "1";
      return;
    }

    paint();
    bindCvStudioBlockSelection(panel);
    loadingEl.classList.add("hidden");
    panel.classList.remove("hidden");

    if (lastPortfolioPatchListener) {
      window.removeEventListener("skillatlas:portfolio-base-saved", lastPortfolioPatchListener);
    }
    lastPortfolioPatchListener = (ev: Event) => {
      const d = (ev as CustomEvent<{ display_name?: string; bio?: string }>).detail;
      if (!d || !refs) return;
      if (typeof d.display_name === "string") {
        const v = d.display_name.trim();
        if (v) displayName = v;
      }
      if (typeof d.bio === "string") bio = d.bio;
      paint();
    };
    window.addEventListener("skillatlas:portfolio-base-saved", lastPortfolioPatchListener);

    document.addEventListener("skillatlas:prefs-updated", onPrefsExternal);
    try {
      const bc = new BroadcastChannel(CV_STUDIO_EMBED_PREFS_CHANNEL);
      bc.addEventListener("message", onPrefsExternal);
    } catch {
      /* ignore */
    }
    window.addEventListener("storage", (e) => {
      if (e.key === SKILLATLAS_PREFS_STORAGE_KEY) onPrefsExternal();
    });

    root.dataset.cvStudioDocBound = "1";
    } catch (e) {
      console.error("[cv-studio-document]", e);
      loadingEl.classList.add("hidden");
      errEl.textContent = tt("cv.studioDocLoadFailed", "No se pudo cargar el documento.");
      errEl.classList.remove("hidden");
      root.dataset.cvStudioDocBound = "1";
    } finally {
      delete root.dataset.cvStudioDocBooting;
    }
  };

  void run();
}
