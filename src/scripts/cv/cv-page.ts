import i18next from "i18next";
import { getHelpStackItem, HELP_STACK_ITEMS } from "@config/help-stack";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import { loadPrefs, updatePrefs } from "@scripts/core/prefs";
import { showToast } from "@scripts/core/ui-feedback";
import {
  CV_LINK_SLOT_COUNT,
  buildCvSocialChipsHtml,
  migrateCvLinksToSlots,
  slotsToPersistedLinks,
  type CvSocialLinkDisplay,
} from "@lib/cv-contact-html";
import { clampCvPrintMaxPages, cvPrintTypographicScale } from "@lib/cv-print-scale";
import { applyCvDocumentSectionOrder, normalizeCvDocumentSectionOrder } from "@lib/cv-document-section-order";
import { parseEducationBlocksFromPaste, parseExperienceBlocksFromPaste } from "@lib/cv-paste-import";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

if (!(globalThis as unknown as { __skillatlasCvPrintCleanup?: boolean }).__skillatlasCvPrintCleanup) {
  (globalThis as unknown as { __skillatlasCvPrintCleanup?: boolean }).__skillatlasCvPrintCleanup = true;
  document.addEventListener("astro:after-swap", () => {
    queueMicrotask(() => {
      if (!document.querySelector("[data-cv-mount]")) document.body.classList.remove("cv-print-mode");
    });
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  role: string | null;
  outcome: string | null;
};

type CvProfile = {
  headline?: string;
  location?: string;
  email?: string;
  links?: { label: string; url: string }[];
  cvLinkSlots?: string[];
  socialLinkDisplay?: CvSocialLinkDisplay;
  cvTemplate?: "classic" | "minimal";
  cvSectionVisibility?: Record<string, boolean>;
  cvDocumentSectionOrder?: string[];
  summary?: string;
  showHelpStack?: boolean;
  highlights?: string;
  showPhoto?: boolean;
  experiences?: CvExperience[];
  education?: CvEducation[];
  certifications?: { name?: string; issuer?: string; year?: string; url?: string }[];
  languages?: { name?: string; level?: string }[];
  /** Objetivo de extensión al imprimir (1–6); ajusta escala tipográfica. */
  cvPrintMaxPages?: number;
};

type CvExperience = {
  company?: string;
  role?: string;
  location?: string;
  start?: string;
  end?: string;
  bullets?: string;
};

type CvEducation = {
  school?: string;
  degree?: string;
  location?: string;
  start?: string;
  end?: string;
  details?: string;
};

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function normalizeEmail(raw: string): string {
  return raw.trim();
}

function isProbablyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function initPrintThemeLock() {
  if ((window as any).__skillatlasCvPrintThemeLock === true) return;
  (window as any).__skillatlasCvPrintThemeLock = true;
  let hadDark = false;
  const before = () => {
    hadDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  };
  const after = () => {
    if (hadDark) document.documentElement.classList.add("dark");
  };
  window.addEventListener("beforeprint", before);
  window.addEventListener("afterprint", after);
}

function linesToBullets(raw: string): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^-+\s*/, ""));
}

async function boot() {
  const mount = document.querySelector("[data-cv-mount]");
  if (!mount) {
    document.body.classList.remove("cv-print-mode");
    return;
  }

  document.body.classList.add("cv-print-mode");
  initPrintThemeLock();

  if (mount.dataset.bound === "1") return;
  mount.dataset.bound = "1";

  const loadingEl = document.querySelector<HTMLElement>("[data-cv-loading]");
  const errEl = document.querySelector<HTMLElement>("[data-cv-error]");
  const editorEl = document.querySelector<HTMLElement>("[data-cv-editor]");
  const listEl = document.querySelector<HTMLElement>("[data-cv-project-list]");
  const docEl = document.querySelector<HTMLElement>("[data-cv-document]");
  const docSectionsHost = docEl?.querySelector<HTMLElement>("[data-cv-doc-sections]") ?? null;
  const docName = document.querySelector<HTMLElement>("[data-cv-doc-name]");
  const docHeadline = document.querySelector<HTMLElement>("[data-cv-doc-headline]");
  const docContact = document.querySelector<HTMLElement>("[data-cv-doc-contact]");
  const docBio = document.querySelector<HTMLElement>("[data-cv-doc-bio]");
  const docHelpStack = document.querySelector<HTMLElement>("[data-cv-doc-helpstack]");
  const docProjects = document.querySelector<HTMLElement>("[data-cv-doc-projects]");
  const docHighlightsSection = document.querySelector<HTMLElement>("[data-cv-doc-highlights-section]");
  const docHighlights = document.querySelector<HTMLElement>("[data-cv-doc-highlights]");
  const docPhoto = document.querySelector<HTMLImageElement>("[data-cv-doc-photo]");
  const docExperienceSection = document.querySelector<HTMLElement>("[data-cv-doc-experience-section]");
  const docExperience = document.querySelector<HTMLElement>("[data-cv-doc-experience]");
  const docEducationSection = document.querySelector<HTMLElement>("[data-cv-doc-education-section]");
  const docEducation = document.querySelector<HTMLElement>("[data-cv-doc-education]");
  const docProjectsSection = document.querySelector<HTMLElement>("[data-cv-doc-projects-section]");
  const docCertSection = document.querySelector<HTMLElement>("[data-cv-doc-certifications-section]");
  const docCert = document.querySelector<HTMLElement>("[data-cv-doc-certifications]");
  const docLangSection = document.querySelector<HTMLElement>("[data-cv-doc-languages-section]");
  const docLang = document.querySelector<HTMLElement>("[data-cv-doc-languages]");
  const printBtn = document.querySelector<HTMLButtonElement>("[data-cv-print]");
  const selAll = document.querySelector<HTMLButtonElement>("[data-cv-select-all]");
  const selNone = document.querySelector<HTMLButtonElement>("[data-cv-select-none]");
  const expAddBtn = document.querySelector<HTMLButtonElement>("[data-cv-exp-add]");
  const eduAddBtn = document.querySelector<HTMLButtonElement>("[data-cv-edu-add]");
  const expList = document.querySelector<HTMLElement>("[data-cv-exp-list]");
  const eduList = document.querySelector<HTMLElement>("[data-cv-edu-list]");
  const certList = document.querySelector<HTMLElement>("[data-cv-cert-list]");
  const langList = document.querySelector<HTMLElement>("[data-cv-lang-list]");
  const certAddBtn = document.querySelector<HTMLButtonElement>("[data-cv-cert-add]");
  const langAddBtn = document.querySelector<HTMLButtonElement>("[data-cv-lang-add]");
  const socialDisplaySelect = document.querySelector<HTMLSelectElement>("[data-cv-social-display]");
  const templateSelect = document.querySelector<HTMLSelectElement>("[data-cv-template]");
  const printMaxPagesSelect = document.querySelector<HTMLSelectElement>("[data-cv-print-max-pages]");
  const headlineInput = document.querySelector<HTMLInputElement>("[data-cv-headline]");
  const locationInput = document.querySelector<HTMLInputElement>("[data-cv-location]");
  const emailInput = document.querySelector<HTMLInputElement>("[data-cv-email]");
  const linkInputs = document.querySelectorAll<HTMLInputElement>("input[data-cv-link-url]");
  const summaryInput = document.querySelector<HTMLTextAreaElement>("[data-cv-summary]");
  const showHelpStackCb = document.querySelector<HTMLInputElement>("[data-cv-show-helpstack]");
  const highlightsInput = document.querySelector<HTMLTextAreaElement>("[data-cv-highlights]");
  const fullNameInput = document.querySelector<HTMLInputElement>("[data-cv-full-name]");
  const publicBioInput = document.querySelector<HTMLTextAreaElement>("[data-cv-public-bio]");
  const avatarFileInput = document.querySelector<HTMLInputElement>("[data-cv-avatar-file]");
  const showPhotoCb = document.querySelector<HTMLInputElement>("[data-cv-show-photo]");
  const photoUseLinkedinBtn = document.querySelector<HTMLButtonElement>("[data-cv-photo-use-linkedin]");
  const photoUseUploadedBtn = document.querySelector<HTMLButtonElement>("[data-cv-photo-use-uploaded]");

  const cvShareWrap = document.querySelector<HTMLElement>("[data-cv-share]");
  const cvShareEnabledCb = document.querySelector<HTMLInputElement>("[data-cv-share-enabled]");
  const cvShareUrlInput = document.querySelector<HTMLInputElement>("[data-cv-share-url]");
  const cvShareCopyBtn = document.querySelector<HTMLButtonElement>("[data-cv-share-copy]");
  const cvShareRotateBtn = document.querySelector<HTMLButtonElement>("[data-cv-share-rotate]");

  const previewOpenBtn = document.querySelector<HTMLButtonElement>("[data-cv-preview-open]");
  const previewModal = document.querySelector<HTMLElement>("[data-cv-preview-modal]");
  const previewCloseBtn = document.querySelector<HTMLButtonElement>("[data-cv-preview-close]");
  const previewBody = document.querySelector<HTMLElement>("[data-cv-preview-body]");
  const previewSectionList = document.querySelector<HTMLElement>("[data-cv-preview-section-list]");
  const previewTemplateSelect = document.querySelector<HTMLSelectElement>("[data-cv-preview-template]");
  const importPaste = document.querySelector<HTMLTextAreaElement>("[data-cv-import-paste]");
  const importExpBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-experience]");
  const importEduBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-education]");
  const importDetails = document.querySelector<HTMLDetailsElement>("[data-cv-import-details]");
  const kickerBadge = document.querySelector<HTMLElement>("[data-cv-kicker-badge]");
  const kickerPulse = document.querySelector<HTMLElement>("[data-cv-kicker-pulse]");
  const importPdfInput = document.querySelector<HTMLInputElement>("[data-cv-import-pdf-input]");
  const importPdfOpen = document.querySelector<HTMLButtonElement>("[data-cv-import-pdf-open]");
  const docHost = document.querySelector<HTMLElement>("[data-cv-doc-host]");

  if (!loadingEl || !listEl || !docEl || !docName || !docBio || !docProjects) return;

  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;
  if (!supabase || !userId) {
    loadingEl.classList.add("hidden");
    if (errEl) {
      errEl.textContent = tt("cv.needSession", "Inicia sesión para ver tu CV.");
      errEl.classList.remove("hidden");
    }
    return;
  }

  loadingEl.textContent = tt("cv.loading", "Cargando…");

  const [projRes, techRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title, description, role, outcome")
      .eq("user_id", userId)
      .order("title"),
    supabase.from("technologies").select("id, name").eq("user_id", userId),
  ]);

  loadingEl.classList.add("hidden");

  if (projRes.error) {
    if (errEl) {
      errEl.textContent = projRes.error.message ?? tt("cv.loadError", "No se pudieron cargar los proyectos.");
      errEl.classList.remove("hidden");
    }
    return;
  }

  const projects = (projRes.data ?? []) as ProjectRow[];

  // Profile + help stack (tolerate missing column help_stack)
  let displayName = tt("cv.defaultName", "Sin nombre");
  let bio = "";
  let helpStackKeys: string[] = [];
  let avatarPath: string | null = null;
  let avatarSignedUrl: string | null = null;
  let cvShareEnabled: boolean | null = null;
  let cvShareToken: string | null = null;
  const profFull = await supabase
    .from("portfolio_profiles")
    .select("display_name, bio, help_stack, avatar_url, cv_share_enabled, cv_share_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (profFull.error && /column|help_stack|cv_share_/i.test(profFull.error.message ?? "")) {
    const profBasic = await supabase
      .from("portfolio_profiles")
      .select("display_name, bio")
      .eq("user_id", userId)
      .maybeSingle();
    displayName = (profBasic.data?.display_name ?? "").trim() || displayName;
    bio = (profBasic.data?.bio ?? "").trim();
  } else {
    displayName = (profFull.data?.display_name ?? "").trim() || displayName;
    bio = (profFull.data?.bio ?? "").trim();
    const hsRaw = (profFull.data as any)?.help_stack;
    if (Array.isArray(hsRaw)) {
      helpStackKeys = hsRaw.filter((x: unknown): x is string => typeof x === "string");
    }
    const a = (profFull.data as any)?.avatar_url;
    avatarPath = typeof a === "string" && a ? a : null;

    const se = (profFull.data as any)?.cv_share_enabled;
    const st = (profFull.data as any)?.cv_share_token;
    cvShareEnabled = typeof se === "boolean" ? se : null;
    cvShareToken = typeof st === "string" && st ? st : null;
  }

  const applyHeaderKicker = () => {
    const pub = Boolean(cvShareEnabled);
    if (!kickerBadge) return;
    kickerBadge.textContent = pub ? tt("cv.kickerPublicWord", "público") : tt("cv.kickerPrivateWord", "privado");
    kickerBadge.className = pub
      ? "font-semibold text-emerald-600 dark:text-emerald-400"
      : "font-semibold text-rose-600 dark:text-rose-400";
    kickerPulse?.classList.toggle("hidden", !pub);
  };

  if (avatarPath) {
    const signed = await supabase.storage.from("portfolio_avatars").createSignedUrl(avatarPath, 60 * 60);
    avatarSignedUrl = signed.data?.signedUrl ?? null;
  }

  // Provider avatar fallback (LinkedIn/GitHub)
  const { data: sess } = await supabase.auth.getSession();
  const meta = (sess.session?.user?.user_metadata ?? {}) as Record<string, any>;
  const linkedinAvatar = typeof meta.picture === "string" && meta.picture ? meta.picture : null;
  const githubAvatar = typeof meta.avatar_url === "string" && meta.avatar_url ? meta.avatar_url : null;

  const updateShareUrl = () => {
    if (!cvShareUrlInput) return;
    if (!cvShareToken) {
      cvShareUrlInput.value = "";
      return;
    }
    cvShareUrlInput.value = `${window.location.origin}/cv/p/${cvShareToken}`;
  };

  if (cvShareWrap && cvShareEnabledCb && cvShareUrlInput && cvShareCopyBtn && cvShareRotateBtn) {
    // If columns exist (we have a value or token), show block. Otherwise keep hidden.
    const supported = cvShareEnabled !== null || Boolean(cvShareToken);
    if (supported) {
      cvShareWrap.classList.remove("hidden");
      cvShareEnabledCb.checked = Boolean(cvShareEnabled);
      updateShareUrl();

      cvShareEnabledCb.addEventListener("change", async () => {
        try {
          const nextEnabled = Boolean(cvShareEnabledCb.checked);
          // Ensure token exists client-side (DB uniqueness protects collisions; retry once on conflict).
          const nextToken = cvShareToken ?? crypto.randomUUID();
          const up1 = await supabase
            .from("portfolio_profiles")
            .upsert({ user_id: userId, cv_share_enabled: nextEnabled, cv_share_token: nextToken } as any, {
              onConflict: "user_id",
            })
            .select("cv_share_enabled, cv_share_token")
            .maybeSingle();
          if (up1.error) {
            // Likely missing columns or token conflict
            if (/duplicate key|unique/i.test(up1.error.message ?? "")) {
              const retryToken = crypto.randomUUID();
              const up2 = await supabase
                .from("portfolio_profiles")
                .upsert({ user_id: userId, cv_share_enabled: nextEnabled, cv_share_token: retryToken } as any, {
                  onConflict: "user_id",
                })
                .select("cv_share_enabled, cv_share_token")
                .maybeSingle();
              if (up2.error) throw up2.error;
              cvShareEnabled = typeof (up2.data as any)?.cv_share_enabled === "boolean" ? (up2.data as any).cv_share_enabled : nextEnabled;
              cvShareToken = typeof (up2.data as any)?.cv_share_token === "string" ? (up2.data as any).cv_share_token : retryToken;
            } else {
              throw up1.error;
            }
          } else {
            cvShareEnabled = typeof (up1.data as any)?.cv_share_enabled === "boolean" ? (up1.data as any).cv_share_enabled : nextEnabled;
            cvShareToken = typeof (up1.data as any)?.cv_share_token === "string" ? (up1.data as any).cv_share_token : nextToken;
          }
          updateShareUrl();
          applyHeaderKicker();
          showToast(nextEnabled ? tt("cv.publicShareEnabledToast", "Enlace público activado.") : tt("cv.publicShareDisabledToast", "Enlace público desactivado."), "success");
        } catch (e: any) {
          showToast(e?.message ?? tt("cv.publicShareSaveError", "No se pudo guardar."), "error");
          cvShareEnabledCb.checked = Boolean(cvShareEnabled);
        }
      });

      cvShareCopyBtn.addEventListener("click", async () => {
        const url = cvShareUrlInput.value.trim();
        if (!url) {
          showToast(tt("cv.publicShareNoUrl", "Activa el enlace para poder copiarlo."), "warning");
          return;
        }
        await navigator.clipboard.writeText(url);
        showToast(tt("cv.publicShareCopied", "Enlace copiado."), "success");
      });

      cvShareRotateBtn.addEventListener("click", async () => {
        try {
          const next = crypto.randomUUID();
          const up = await supabase
            .from("portfolio_profiles")
            .upsert({ user_id: userId, cv_share_token: next } as any, { onConflict: "user_id" })
            .select("cv_share_token")
            .maybeSingle();
          if (up.error) throw up.error;
          const got = (up.data as any)?.cv_share_token;
          cvShareToken = typeof got === "string" && got ? got : next;
          updateShareUrl();
          showToast(tt("cv.publicShareRotated", "Enlace regenerado."), "success");
        } catch (e: any) {
          showToast(e?.message ?? tt("cv.publicShareRotateError", "No se pudo regenerar."), "error");
        }
      });
    }
  }

  applyHeaderKicker();

  const techName = new Map<string, string>();
  for (const t of techRes.data ?? []) {
    if (t?.id && typeof t.name === "string") techName.set(t.id, t.name);
  }

  const techsByProject = new Map<string, string[]>();
  const projectIdBySlug = new Map<string, string>();
  const projectIds = projects.map((p) => p.id).filter(Boolean);
  for (const p of projects) projectIdBySlug.set(p.slug, p.id);

  const ptRes =
    projectIds.length > 0
      ? await supabase.from("project_technologies").select("project_id, technology_id").in("project_id", projectIds)
      : { data: [], error: null as any };

  for (const r of (ptRes.data ?? []) as any[]) {
    const pid = r.project_id as string | undefined;
    const tid = r.technology_id as string | undefined;
    if (!pid || !tid) continue;
    const name = techName.get(tid);
    if (!name) continue;
    const list = techsByProject.get(pid) ?? [];
    list.push(name);
    techsByProject.set(pid, list);
  }

  let prefs = loadPrefs();
  const defaultOrder = projects.map((p) => p.slug);
  let selectedSlugs = new Set<string>();
  let selectedOrder: string[] = [];
  let cvProfile: CvProfile = (prefs as any).cvProfile ?? {};
  cvProfile = {
    showHelpStack: true,
    showPhoto: true,
    experiences: [],
    education: [],
    certifications: [],
    languages: [],
    socialLinkDisplay: "both",
    cvTemplate: "classic",
    cvSectionVisibility: {},
    cvPrintMaxPages: 3,
    ...cvProfile,
  };
  if (!cvProfile.photoSource) {
    cvProfile.photoSource = avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider";
  }

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
  ];

  const applyProfileToInputs = () => {
    if (fullNameInput) fullNameInput.value = displayName;
    if (publicBioInput) publicBioInput.value = bio;
    if (headlineInput) headlineInput.value = (cvProfile.headline ?? "").toString();
    if (locationInput) locationInput.value = (cvProfile.location ?? "").toString();
    if (emailInput) emailInput.value = (cvProfile.email ?? "").toString();
    if (summaryInput) summaryInput.value = (cvProfile.summary ?? "").toString();
    if (showHelpStackCb) showHelpStackCb.checked = Boolean(cvProfile.showHelpStack ?? true);
    if (highlightsInput) highlightsInput.value = (cvProfile.highlights ?? "").toString();
    if (showPhotoCb) showPhotoCb.checked = Boolean(cvProfile.showPhoto ?? true);
    if (photoUseLinkedinBtn) photoUseLinkedinBtn.classList.add("hidden");
    if (photoUseUploadedBtn) photoUseUploadedBtn.classList.add("hidden");
    if (photoUseLinkedinBtn && linkedinAvatar) photoUseLinkedinBtn.classList.remove("hidden");
    if (photoUseUploadedBtn && avatarSignedUrl) photoUseUploadedBtn.classList.remove("hidden");
    const slots = getCvLinkSlots();
    linkInputs.forEach((inp) => {
      const idx = Number(inp.dataset.cvLinkUrl ?? "0");
      inp.value = slots[idx] ?? "";
    });
    if (socialDisplaySelect) socialDisplaySelect.value = cvProfile.socialLinkDisplay ?? "both";
    if (templateSelect) templateSelect.value = cvProfile.cvTemplate === "minimal" ? "minimal" : "classic";
    if (previewTemplateSelect) previewTemplateSelect.value = cvProfile.cvTemplate === "minimal" ? "minimal" : "classic";
    if (printMaxPagesSelect) printMaxPagesSelect.value = String(clampCvPrintMaxPages(cvProfile.cvPrintMaxPages));
    document.querySelectorAll<HTMLInputElement>("input[data-cv-sec-show]").forEach((cb) => {
      const k = cb.dataset.cvSecShow ?? "";
      if (!k) return;
      const vis = cvProfile.cvSectionVisibility ?? {};
      cb.checked = (vis as Record<string, boolean>)[k] !== false;
    });
  };

  const persistProfile = () => {
    prefs = updatePrefs({ cvProfile } as any);
  };

  const saveBaseProfile = async (patch: { display_name?: string; bio?: string; avatar_url?: string | null }) => {
    const row: Record<string, unknown> = { user_id: userId, ...patch };
    const res = await supabase.from("portfolio_profiles").upsert(row, { onConflict: "user_id" });
    if (res.error) {
      showToast(res.error.message ?? "No se pudo guardar.", "error");
      return false;
    }
    return true;
  };

  const uploadAvatar = async (file: File) => {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
    const path = `${userId}/avatar.${safeExt}`;
    const up = await supabase.storage.from("portfolio_avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || undefined,
    });
    if (up.error) {
      showToast(up.error.message ?? "No se pudo subir la imagen.", "error");
      return null;
    }
    const ok = await saveBaseProfile({ avatar_url: path });
    if (!ok) return null;
    const signed = await supabase.storage.from("portfolio_avatars").createSignedUrl(path, 60 * 60);
    avatarPath = path;
    avatarSignedUrl = signed.data?.signedUrl ?? null;
    showToast(tt("cv.photoSaved", "Foto guardada."), "success");
    return path;
  };

  const renderExperienceEditor = () => {
    if (!expList) return;
    const exp = Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [];
    expList.innerHTML = exp
      .map((x, idx) => {
        const company = esc((x.company ?? "").toString());
        const role = esc((x.role ?? "").toString());
        const location = esc((x.location ?? "").toString());
        const start = esc((x.start ?? "").toString());
        const end = esc((x.end ?? "").toString());
        const bullets = esc((x.bullets ?? "").toString());
        return `<div class="rounded-xl border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 p-4 space-y-3" data-cv-exp-row="${idx}">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100" data-cv-exp-title>${role || company || esc(tt("cv.newExperience", "Nueva experiencia"))}</p>
            <button type="button" class="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline" data-cv-exp-del="${idx}">${esc(tt("cv.remove", "Quitar"))}</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.expRole", "Rol"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-exp-field="role" data-idx="${idx}" value="${role}" />
            </label>
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.expCompany", "Empresa"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-exp-field="company" data-idx="${idx}" value="${company}" />
            </label>
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.expLocation", "Ubicación"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-exp-field="location" data-idx="${idx}" value="${location}" />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.expStart", "Inicio"))}</span>
                <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-exp-field="start" data-idx="${idx}" value="${start}" placeholder="2024" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.expEnd", "Fin"))}</span>
                <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-exp-field="end" data-idx="${idx}" value="${end}" placeholder="${esc(tt("cv.present", "Actual"))}" />
              </label>
            </div>
            <label class="space-y-1 md:col-span-2">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.expBullets", "Bullets"))}</span>
              <textarea rows="4" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-exp-field="bullets" data-idx="${idx}">${bullets}</textarea>
            </label>
          </div>
        </div>`;
      })
      .join("");
  };

  const renderEducationEditor = () => {
    if (!eduList) return;
    const edu = Array.isArray(cvProfile.education) ? cvProfile.education : [];
    eduList.innerHTML = edu
      .map((x, idx) => {
        const school = esc((x.school ?? "").toString());
        const degree = esc((x.degree ?? "").toString());
        const location = esc((x.location ?? "").toString());
        const start = esc((x.start ?? "").toString());
        const end = esc((x.end ?? "").toString());
        const details = esc((x.details ?? "").toString());
        return `<div class="rounded-xl border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 p-4 space-y-3" data-cv-edu-row="${idx}">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100" data-cv-edu-title>${degree || school || esc(tt("cv.newEducation", "Nueva educación"))}</p>
            <button type="button" class="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline" data-cv-edu-del="${idx}">${esc(tt("cv.remove", "Quitar"))}</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.eduDegree", "Título"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-edu-field="degree" data-idx="${idx}" value="${degree}" />
            </label>
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.eduSchool", "Centro"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-edu-field="school" data-idx="${idx}" value="${school}" />
            </label>
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.eduLocation", "Ubicación"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-edu-field="location" data-idx="${idx}" value="${location}" />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.eduStart", "Inicio"))}</span>
                <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-edu-field="start" data-idx="${idx}" value="${start}" placeholder="2020" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.eduEnd", "Fin"))}</span>
                <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-edu-field="end" data-idx="${idx}" value="${end}" placeholder="2024" />
              </label>
            </div>
            <label class="space-y-1 md:col-span-2">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.eduDetails", "Detalles"))}</span>
              <textarea rows="3" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-edu-field="details" data-idx="${idx}">${details}</textarea>
            </label>
          </div>
        </div>`;
      })
      .join("");
  };

  const renderCertificationEditor = () => {
    if (!certList) return;
    const certs = Array.isArray(cvProfile.certifications) ? cvProfile.certifications : [];
    certList.innerHTML = certs
      .map((x, idx) => {
        const name = esc((x.name ?? "").toString());
        const issuer = esc((x.issuer ?? "").toString());
        const year = esc((x.year ?? "").toString());
        const url = esc((x.url ?? "").toString());
        return `<div class="rounded-xl border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 p-4 space-y-3" data-cv-cert-row="${idx}">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100" data-cv-cert-title>${name || issuer || esc(tt("cv.newCert", "Nueva certificación"))}</p>
            <button type="button" class="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline" data-cv-cert-del="${idx}">${esc(tt("cv.remove", "Quitar"))}</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="space-y-1 md:col-span-2">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.certName", "Nombre"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-cert-field="name" data-idx="${idx}" value="${name}" />
            </label>
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.certIssuer", "Emisor"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-cert-field="issuer" data-idx="${idx}" value="${issuer}" />
            </label>
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.certYear", "Año"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-cert-field="year" data-idx="${idx}" value="${year}" placeholder="2024" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.certUrl", "URL"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-cert-field="url" data-idx="${idx}" value="${url}" placeholder="https://…" />
            </label>
          </div>
        </div>`;
      })
      .join("");
  };

  const renderLanguageEditor = () => {
    if (!langList) return;
    const langs = Array.isArray(cvProfile.languages) ? cvProfile.languages : [];
    langList.innerHTML = langs
      .map((x, idx) => {
        const name = esc((x.name ?? "").toString());
        const level = esc((x.level ?? "").toString());
        return `<div class="rounded-xl border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 p-4 space-y-3" data-cv-lang-row="${idx}">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100" data-cv-lang-title>${name || esc(tt("cv.newLanguage", "Idioma"))}</p>
            <button type="button" class="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline" data-cv-lang-del="${idx}">${esc(tt("cv.remove", "Quitar"))}</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.langName", "Idioma"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-lang-field="name" data-idx="${idx}" value="${name}" />
            </label>
            <label class="space-y-1">
              <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.langLevel", "Nivel"))}</span>
              <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-lang-field="level" data-idx="${idx}" value="${level}" placeholder="C1 / fluido" />
            </label>
          </div>
        </div>`;
      })
      .join("");
  };

  const updateCertRowTitle = (idx: number) => {
    if (!certList) return;
    const row = certList.querySelector(`[data-cv-cert-row="${idx}"]`);
    const title = row?.querySelector("[data-cv-cert-title]");
    if (!title) return;
    const certs = Array.isArray(cvProfile.certifications) ? cvProfile.certifications : [];
    const n = (certs[idx]?.name ?? "").trim();
    const i = (certs[idx]?.issuer ?? "").trim();
    title.textContent = n || i || tt("cv.newCert", "Nueva certificación");
  };

  const updateLangRowTitle = (idx: number) => {
    if (!langList) return;
    const row = langList.querySelector(`[data-cv-lang-row="${idx}"]`);
    const title = row?.querySelector("[data-cv-lang-title]");
    if (!title) return;
    const langs = Array.isArray(cvProfile.languages) ? cvProfile.languages : [];
    const n = (langs[idx]?.name ?? "").trim();
    title.textContent = n || tt("cv.newLanguage", "Idioma");
  };

  const updateExpRowTitle = (idx: number) => {
    if (!expList) return;
    const row = expList.querySelector(`[data-cv-exp-row="${idx}"]`);
    const title = row?.querySelector("[data-cv-exp-title]");
    if (!title) return;
    const exp = Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [];
    const r = (exp[idx]?.role ?? "").trim();
    const c = (exp[idx]?.company ?? "").trim();
    title.textContent = r || c || tt("cv.newExperience", "Nueva experiencia");
  };

  const updateEduRowTitle = (idx: number) => {
    if (!eduList) return;
    const row = eduList.querySelector(`[data-cv-edu-row="${idx}"]`);
    const title = row?.querySelector("[data-cv-edu-title]");
    if (!title) return;
    const edu = Array.isArray(cvProfile.education) ? cvProfile.education : [];
    const d = (edu[idx]?.degree ?? "").trim();
    const s = (edu[idx]?.school ?? "").trim();
    title.textContent = d || s || tt("cv.newEducation", "Nueva educación");
  };

  const applySelectionFromPrefs = () => {
    const raw = prefs.cvProjectSlugs;
    selectedSlugs.clear();
    if (raw === undefined) {
      selectedOrder = [...defaultOrder];
      for (const s of selectedOrder) selectedSlugs.add(s);
      return;
    }
    const allowed = new Set(defaultOrder);
    selectedOrder = raw.filter((s) => allowed.has(s));
    for (const s of selectedOrder) selectedSlugs.add(s);
  };

  applySelectionFromPrefs();

  const persistSelection = () => {
    // Keep order consistent with selection
    selectedOrder = selectedOrder.filter((s) => selectedSlugs.has(s));
    for (const s of selectedSlugs) if (!selectedOrder.includes(s)) selectedOrder.push(s);

    const allSelected = selectedOrder.length === defaultOrder.length;
    const isDefaultOrder =
      allSelected && selectedOrder.every((s, i) => s === defaultOrder[i]);

    prefs = updatePrefs({ cvProjectSlugs: isDefaultOrder ? undefined : selectedOrder });
  };

  const renderDocument = () => {
    docName.textContent = displayName;
    const headline = (cvProfile.headline ?? "").trim();
    const location = (cvProfile.location ?? "").trim();
    const email = normalizeEmail((cvProfile.email ?? "").trim());
    const summary = (cvProfile.summary ?? "").trim();
    const showHelp = cvProfile.showHelpStack ?? true;
    const vis = cvProfile.cvSectionVisibility ?? {};
    const showBlock = (key: string) => (vis as Record<string, boolean>)[key] !== false;

    if (docEl) {
      docEl.classList.remove("cv-template-classic", "cv-template-minimal");
      docEl.classList.add(cvProfile.cvTemplate === "minimal" ? "cv-template-minimal" : "cv-template-classic");
      const maxP = clampCvPrintMaxPages(cvProfile.cvPrintMaxPages);
      docEl.style.setProperty("--cv-print-scale", String(cvPrintTypographicScale(maxP)));
      docEl.dataset.cvPrintMaxPages = String(maxP);
    }

    if (docHeadline) {
      docHeadline.textContent = headline;
      docHeadline.classList.toggle("hidden", !headline);
    }
    if (docContact) {
      const chips: string[] = [];
      if (location) chips.push(`<span class="inline-flex items-center gap-1"><span class="text-gray-400">📍</span> ${esc(location)}</span>`);
      if (email && isProbablyEmail(email)) {
        chips.push(`<a class="no-underline hover:underline" href="mailto:${esc(email)}">${esc(email)}</a>`);
      }
      const slots = getCvLinkSlots();
      const mode = (cvProfile.socialLinkDisplay ?? "both") as CvSocialLinkDisplay;
      chips.push(...buildCvSocialChipsHtml({ slots, slotLabels: slotLabels(), display: mode, esc }));
      docContact.innerHTML = chips.length > 0 ? chips.join(`<span class="text-gray-300 dark:text-gray-700">•</span>`) : "";
      docContact.classList.toggle("hidden", chips.length === 0);
    }

    const finalSummary = summary || bio || tt("cv.noBio", "");
    docBio.textContent = finalSummary;
    docBio.classList.toggle("hidden", !finalSummary);

    if (docHelpStack) {
      const allowed = new Set(HELP_STACK_ITEMS.map((i) => i.key));
      const uniq = Array.from(new Set(helpStackKeys)).filter((k) => allowed.has(k));
      const visible = showHelp && uniq.length > 0;
      docHelpStack.classList.toggle("hidden", !visible);
      docHelpStack.classList.toggle("flex", visible);
      if (visible) {
        docHelpStack.innerHTML = uniq
          .map((k) => {
            const it = getHelpStackItem(k);
            if (!it) return "";
            return `<span class="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200">
              <img src="${esc(it.icon)}" alt="" class="h-4 w-4" loading="lazy" decoding="async" />
              ${esc(it.label)}
            </span>`;
          })
          .join("");
      } else {
        docHelpStack.innerHTML = "";
      }
    }

    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    const chosen = selectedOrder.map((s) => bySlug.get(s)).filter(Boolean) as ProjectRow[];
    if (docProjectsSection) {
      docProjectsSection.classList.toggle("hidden", chosen.length === 0 || !showBlock("projects"));
    }
    if (chosen.length === 0) {
      docProjects.innerHTML = `<p class="m-0 text-sm text-gray-500 dark:text-gray-400">${esc(tt("cv.noProjectsSelected", "No hay proyectos seleccionados."))}</p>`;
    } else {
      docProjects.innerHTML = chosen
        .map((p) => {
          const pid = projectIdBySlug.get(p.slug);
          const techLabels = pid ? (techsByProject.get(pid) ?? []).sort((a, b) => a.localeCompare(b, "es")) : [];
          const techHtml =
            techLabels.length > 0
              ? `<p class="m-0 mt-2 flex flex-wrap gap-1.5">${techLabels
                  .map(
                    (n) =>
                      `<span class="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">${esc(n)}</span>`,
                  )
                  .join("")}</p>`
              : "";
          const role = (p.role ?? "").trim();
          const outcome = (p.outcome ?? "").trim();
          const meta =
            role || outcome
              ? `<p class="m-0 mt-2 text-sm text-gray-600 dark:text-gray-400"><span class="font-semibold text-gray-800 dark:text-gray-200">${esc(role || "—")}</span>${role && outcome ? " · " : ""}${esc(outcome)}</p>`
              : "";
          return `<section class="cv-doc-project">
            <h4 class="m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">${esc(p.title)}</h4>
            ${meta}
            ${(p.description ?? "").trim() ? `<p class="m-0 mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">${esc((p.description ?? "").trim())}</p>` : ""}
            ${techHtml}
          </section>`;
        })
        .join("");
    }

    // Highlights (experience / achievements)
    const lines = linesToBullets(cvProfile.highlights ?? "");
    if (docHighlightsSection && docHighlights) {
      const show = lines.length > 0 && showBlock("highlights");
      docHighlightsSection.classList.toggle("hidden", !show);
      docHighlights.innerHTML = show ? lines.map((s) => `<li>${esc(s)}</li>`).join("") : "";
    }

    // Photo (prefer uploaded; else LinkedIn; else provider)
    if (docPhoto) {
      const source = cvProfile.photoSource ?? (avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider");
      const url =
        source === "uploaded"
          ? avatarSignedUrl
          : source === "linkedin"
            ? linkedinAvatar
            : githubAvatar ?? linkedinAvatar;
      const show = Boolean(cvProfile.showPhoto ?? true) && Boolean(url);
      docPhoto.classList.toggle("hidden", !show);
      if (show && url) docPhoto.src = url;
      else docPhoto.removeAttribute("src");
    }

    // Experience
    if (docExperienceSection && docExperience) {
      const exp = Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [];
      const show = exp.length > 0 && showBlock("experience");
      docExperienceSection.classList.toggle("hidden", !show);
      docExperience.innerHTML = show
        ? exp
            .map((x) => {
              const company = (x.company ?? "").trim();
              const role = (x.role ?? "").trim();
              const loc = (x.location ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const when = [start, end].filter(Boolean).join(" – ");
              const bullets = linesToBullets(x.bullets ?? "");
              const bulletsHtml =
                bullets.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">${bullets
                      .map((b) => `<li>${esc(b)}</li>`)
                      .join("")}</ul>`
                  : "";
              return `<section class="cv-doc-project">
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">${esc(role || company || tt("cv.untitled", "—"))}</p>
                    <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${esc([company, loc].filter(Boolean).join(" · "))}</p>
                  </div>
                  <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400">${esc(when)}</p>
                </div>
                ${bulletsHtml}
              </section>`;
            })
            .join("")
        : "";
    }

    // Education
    if (docEducationSection && docEducation) {
      const edu = Array.isArray(cvProfile.education) ? cvProfile.education : [];
      const show = edu.length > 0 && showBlock("education");
      docEducationSection.classList.toggle("hidden", !show);
      docEducation.innerHTML = show
        ? edu
            .map((x) => {
              const school = (x.school ?? "").trim();
              const degree = (x.degree ?? "").trim();
              const loc = (x.location ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const when = [start, end].filter(Boolean).join(" – ");
              const details = linesToBullets(x.details ?? "");
              const detailsHtml =
                details.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">${details
                      .map((b) => `<li>${esc(b)}</li>`)
                      .join("")}</ul>`
                  : "";
              return `<section class="cv-doc-project">
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">${esc(degree || school || tt("cv.untitled", "—"))}</p>
                    <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${esc([school, loc].filter(Boolean).join(" · "))}</p>
                  </div>
                  <p class="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400">${esc(when)}</p>
                </div>
                ${detailsHtml}
              </section>`;
            })
            .join("")
        : "";
    }

    // Certifications
    if (docCertSection && docCert) {
      const certs = Array.isArray(cvProfile.certifications) ? cvProfile.certifications : [];
      const show = certs.length > 0 && showBlock("certifications");
      docCertSection.classList.toggle("hidden", !show);
      docCert.innerHTML = show
        ? certs
            .map((c) => {
              const name = (c.name ?? "").trim();
              const issuer = (c.issuer ?? "").trim();
              const year = (c.year ?? "").trim();
              const url = normalizeUrl((c.url ?? "").trim());
              const title = name || issuer || tt("cv.untitled", "—");
              const sub = [issuer, year].filter(Boolean).join(" · ");
              const link = url
                ? ` <a class="text-sm font-medium no-underline hover:underline" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(tt("cv.certLink", "Enlace"))}</a>`
                : "";
              return `<section class="cv-doc-project">
                <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">${esc(title)}</p>
                ${sub ? `<p class="m-0 mt-1 text-sm text-gray-600 dark:text-gray-400">${esc(sub)}</p>` : ""}
                ${link}
              </section>`;
            })
            .join("")
        : "";
    }

    // Languages
    if (docLangSection && docLang) {
      const langs = Array.isArray(cvProfile.languages) ? cvProfile.languages : [];
      const show = langs.length > 0 && showBlock("languages");
      docLangSection.classList.toggle("hidden", !show);
      docLang.innerHTML = show
        ? `<ul class="m-0 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">${langs
            .map((l) => {
              const name = (l.name ?? "").trim();
              const level = (l.level ?? "").trim();
              const line = [name, level].filter(Boolean).join(" — ");
              return line ? `<li>${esc(line)}</li>` : "";
            })
            .filter(Boolean)
            .join("")}</ul>`
        : "";
    }

    applyCvDocumentSectionOrder(docSectionsHost, cvProfile.cvDocumentSectionOrder);

    docEl?.classList.remove("hidden");
  };

  const sectionRailLabel = (id: string) => {
    const map: Record<string, string> = {
      experience: tt("cv.docExperienceHeading", "Experiencia"),
      education: tt("cv.docEducationHeading", "Educación"),
      certifications: tt("cv.docCertificationsHeading", "Certificaciones"),
      languages: tt("cv.docLanguagesHeading", "Idiomas"),
      projects: tt("cv.docProjectsHeading", "Proyectos"),
      highlights: tt("cv.docHighlightsHeading", "Logros"),
    };
    return map[id] ?? id;
  };

  const refreshPreviewSectionRail = () => {
    if (!previewSectionList) return;
    const order = normalizeCvDocumentSectionOrder(cvProfile.cvDocumentSectionOrder);
    previewSectionList.innerHTML = order
      .map(
        (id) =>
          `<li data-cv-preview-sec-row="${esc(id)}" draggable="true" class="flex items-center gap-2 rounded-lg border border-gray-200/70 dark:border-gray-800 bg-white/60 dark:bg-gray-950/40 px-2 py-1.5 text-xs text-gray-800 dark:text-gray-200 cursor-grab active:cursor-grabbing select-none"><span class="text-gray-400 shrink-0">⋮⋮</span><span class="min-w-0 flex-1">${esc(sectionRailLabel(id))}</span></li>`,
      )
      .join("");
  };

  const bindPreviewSectionRail = () => {
    if (!previewSectionList || previewSectionList.dataset.cvSecBound === "1") return;
    previewSectionList.dataset.cvSecBound = "1";
    previewSectionList.addEventListener("dragstart", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("li[data-cv-preview-sec-row]");
      if (!row || !previewSectionList.contains(row)) return;
      const id = row.getAttribute("data-cv-preview-sec-row") ?? "";
      e.dataTransfer?.setData("text/plain", `cvsec:${id}`);
      row.classList.add("opacity-70");
    });
    previewSectionList.addEventListener("dragend", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("li[data-cv-preview-sec-row]");
      row?.classList.remove("opacity-70");
    });
    previewSectionList.addEventListener("dragover", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("li[data-cv-preview-sec-row]");
      if (!row || !previewSectionList.contains(row)) return;
      e.preventDefault();
      row.classList.add("ring-2", "ring-indigo-400/40", "dark:ring-indigo-300/25");
    });
    previewSectionList.addEventListener("dragleave", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("li[data-cv-preview-sec-row]");
      row?.classList.remove("ring-2", "ring-indigo-400/40", "dark:ring-indigo-300/25");
    });
    previewSectionList.addEventListener("drop", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("li[data-cv-preview-sec-row]");
      if (!row || !previewSectionList.contains(row)) return;
      e.preventDefault();
      row.classList.remove("ring-2", "ring-indigo-400/40", "dark:ring-indigo-300/25");
      const from = (e.dataTransfer?.getData("text/plain") ?? "").replace(/^cvsec:/, "");
      const to = row.getAttribute("data-cv-preview-sec-row") ?? "";
      if (!from || !to || from === to) return;
      const cur = [...normalizeCvDocumentSectionOrder(cvProfile.cvDocumentSectionOrder)];
      const fromIdx = cur.indexOf(from);
      const toIdx = cur.indexOf(to);
      if (fromIdx < 0 || toIdx < 0) return;
      cur.splice(fromIdx, 1);
      cur.splice(toIdx, 0, from);
      cvProfile = { ...cvProfile, cvDocumentSectionOrder: cur };
      persistProfile();
      renderDocument();
      refreshPreviewSectionRail();
    });
  };

  const renderList = () => {
    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    const visibleOrder =
      selectedOrder.length > 0 ? selectedOrder : defaultOrder.filter((s) => selectedSlugs.has(s));

    listEl.innerHTML = visibleOrder
      .map((slug) => {
        const p = bySlug.get(slug);
        if (!p) return "";
        const on = selectedSlugs.has(p.slug);
        return `<li data-cv-row="${esc(p.slug)}" draggable="true"
          class="flex items-start gap-3 rounded-lg border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 px-3 py-2">
          <button type="button" aria-label="Arrastrar" title="Arrastrar"
            class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-grab active:cursor-grabbing select-none"
            data-cv-drag="${esc(p.slug)}">⋮⋮</button>
          <input type="checkbox" class="mt-1 rounded border-gray-300 dark:border-gray-600" data-cv-pick="${esc(p.slug)}" ${on ? "checked" : ""} />
          <div class="min-w-0 flex-1">
            <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">${esc(p.title)}</p>
            <p class="m-0 text-xs text-gray-500 dark:text-gray-400">/${esc(p.slug)}</p>
          </div>
        </li>`;
      })
      .join("");

    listEl.querySelectorAll<HTMLInputElement>("input[data-cv-pick]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const slug = inp.dataset.cvPick ?? "";
        if (!slug) return;
        if (inp.checked) selectedSlugs.add(slug);
        else selectedSlugs.delete(slug);
        persistSelection();
        renderList();
        renderDocument();
      });
    });

    // Drag & drop reorder (selected list)
    listEl.querySelectorAll<HTMLElement>("li[data-cv-row]").forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        const slug = row.getAttribute("data-cv-row") ?? "";
        if (!slug) return;
        e.dataTransfer?.setData("text/plain", slug);
        e.dataTransfer?.setDragImage(row, 12, 12);
        row.classList.add("opacity-70");
      });
      row.addEventListener("dragend", () => row.classList.remove("opacity-70"));
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.classList.add("ring-2", "ring-indigo-400/40", "dark:ring-indigo-300/25");
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("ring-2", "ring-indigo-400/40", "dark:ring-indigo-300/25");
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("ring-2", "ring-indigo-400/40", "dark:ring-indigo-300/25");
        const from = e.dataTransfer?.getData("text/plain") ?? "";
        const to = row.getAttribute("data-cv-row") ?? "";
        if (!from || !to || from === to) return;
        const cur = [...selectedOrder];
        const fromIdx = cur.indexOf(from);
        const toIdx = cur.indexOf(to);
        if (fromIdx < 0 || toIdx < 0) return;
        cur.splice(fromIdx, 1);
        cur.splice(toIdx, 0, from);
        selectedOrder = cur;
        persistSelection();
        renderList();
        renderDocument();
      });
    });
    editorEl?.classList.remove("hidden");
  };

  bindPreviewSectionRail();
  renderList();
  applyProfileToInputs();
  renderExperienceEditor();
  renderEducationEditor();
  renderCertificationEditor();
  renderLanguageEditor();
  renderDocument();

  const bindProfileInput = () => {
    let t: number | null = null;
    const schedule = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        persistProfile();
        renderDocument();
      }, 200);
    };

    headlineInput?.addEventListener("input", () => {
      cvProfile = { ...cvProfile, headline: headlineInput.value.trim() };
      schedule();
    });
    locationInput?.addEventListener("input", () => {
      cvProfile = { ...cvProfile, location: locationInput.value.trim() };
      schedule();
    });
    emailInput?.addEventListener("input", () => {
      cvProfile = { ...cvProfile, email: emailInput.value.trim() };
      schedule();
    });
    summaryInput?.addEventListener("input", () => {
      cvProfile = { ...cvProfile, summary: summaryInput.value.trim() };
      schedule();
    });
    showHelpStackCb?.addEventListener("change", () => {
      cvProfile = { ...cvProfile, showHelpStack: Boolean(showHelpStackCb.checked) };
      schedule();
    });
    showPhotoCb?.addEventListener("change", () => {
      cvProfile = { ...cvProfile, showPhoto: Boolean(showPhotoCb.checked) };
      schedule();
    });
    highlightsInput?.addEventListener("input", () => {
      cvProfile = { ...cvProfile, highlights: highlightsInput.value };
      schedule();
    });

    // Base profile (Ajustes) sync
    fullNameInput?.addEventListener("blur", async () => {
      const next = fullNameInput.value.trim();
      if (!next) return;
      const ok = await saveBaseProfile({ display_name: next });
      if (ok) {
        displayName = next;
        showToast(tt("cv.savedToSettings", "Guardado en Ajustes."), "success");
        renderDocument();
      }
    });
    publicBioInput?.addEventListener("blur", async () => {
      const next = publicBioInput.value.trim();
      const ok = await saveBaseProfile({ bio: next });
      if (ok) {
        bio = next;
        showToast(tt("cv.savedToSettings", "Guardado en Ajustes."), "success");
        renderDocument();
      }
    });

    avatarFileInput?.addEventListener("change", async () => {
      const f = avatarFileInput.files?.[0] ?? null;
      if (!f) return;
      await uploadAvatar(f);
      renderDocument();
    });

    // Delegated Experience/Education bindings
    expList?.addEventListener("input", (e) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      const field = (el as any)?.dataset?.cvExpField as string | undefined;
      const idx = Number((el as any)?.dataset?.idx ?? "");
      if (!el || !field || !Number.isFinite(idx)) return;
      const exp = Array.isArray(cvProfile.experiences) ? [...cvProfile.experiences] : [];
      const row = { ...(exp[idx] ?? {}) } as any;
      row[field] = el.value;
      exp[idx] = row;
      cvProfile = { ...cvProfile, experiences: exp };
      schedule();
      updateExpRowTitle(idx);
    });
    expList?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement | null)?.closest("[data-cv-exp-del]") as HTMLElement | null;
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-cv-exp-del") ?? "");
      if (!Number.isFinite(idx)) return;
      const exp = Array.isArray(cvProfile.experiences) ? [...cvProfile.experiences] : [];
      exp.splice(idx, 1);
      cvProfile = { ...cvProfile, experiences: exp };
      schedule();
      renderExperienceEditor();
      renderDocument();
    });

    eduList?.addEventListener("input", (e) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      const field = (el as any)?.dataset?.cvEduField as string | undefined;
      const idx = Number((el as any)?.dataset?.idx ?? "");
      if (!el || !field || !Number.isFinite(idx)) return;
      const edu = Array.isArray(cvProfile.education) ? [...cvProfile.education] : [];
      const row = { ...(edu[idx] ?? {}) } as any;
      row[field] = el.value;
      edu[idx] = row;
      cvProfile = { ...cvProfile, education: edu };
      schedule();
      updateEduRowTitle(idx);
    });
    eduList?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement | null)?.closest("[data-cv-edu-del]") as HTMLElement | null;
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-cv-edu-del") ?? "");
      if (!Number.isFinite(idx)) return;
      const edu = Array.isArray(cvProfile.education) ? [...cvProfile.education] : [];
      edu.splice(idx, 1);
      cvProfile = { ...cvProfile, education: edu };
      schedule();
      renderEducationEditor();
      renderDocument();
    });
    linkInputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        const urls = Array.from(linkInputs).map((x) => x.value.trim());
        const labels = slotLabels();
        const nextSlots = Array.from({ length: CV_LINK_SLOT_COUNT }, (_, i) => urls[i] ?? "");
        cvProfile.cvLinkSlots = nextSlots;
        cvProfile.links = slotsToPersistedLinks(nextSlots, labels);
        schedule();
      });
    });

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "ArrowRight") return;
        const el = e.target as HTMLElement | null;
        if (!el?.matches?.("input[data-cv-link-url]")) return;
        const input = el as HTMLInputElement;
        const ph = input.placeholder?.trim() ?? "";
        if (!/^https?:\/\//i.test(ph)) return;
        const v = input.value;
        if (v !== "" && !ph.startsWith(v)) return;
        e.preventDefault();
        input.value = ph;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
      true,
    );

    socialDisplaySelect?.addEventListener("change", () => {
      const v = socialDisplaySelect.value as CvSocialLinkDisplay;
      if (v === "url" || v === "icon" || v === "both") {
        cvProfile.socialLinkDisplay = v;
        schedule();
      }
    });

    templateSelect?.addEventListener("change", () => {
      cvProfile.cvTemplate = templateSelect.value === "minimal" ? "minimal" : "classic";
      if (previewTemplateSelect) previewTemplateSelect.value = cvProfile.cvTemplate === "minimal" ? "minimal" : "classic";
      schedule();
    });

    printMaxPagesSelect?.addEventListener("change", () => {
      const n = Number(printMaxPagesSelect.value);
      cvProfile = {
        ...cvProfile,
        cvPrintMaxPages: clampCvPrintMaxPages(Number.isFinite(n) ? n : 3),
      };
      schedule();
    });

    document.querySelectorAll<HTMLInputElement>("input[data-cv-sec-show]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const k = cb.dataset.cvSecShow ?? "";
        if (!k) return;
        cvProfile.cvSectionVisibility = { ...(cvProfile.cvSectionVisibility ?? {}), [k]: cb.checked };
        schedule();
      });
    });

    certList?.addEventListener("input", (e) => {
      const el = e.target as HTMLInputElement | null;
      const field = (el as any)?.dataset?.cvCertField as string | undefined;
      const idx = Number((el as any)?.dataset?.idx ?? "");
      if (!el || !field || !Number.isFinite(idx)) return;
      const certs = Array.isArray(cvProfile.certifications) ? [...cvProfile.certifications] : [];
      const row = { ...(certs[idx] ?? {}) } as any;
      row[field] = el.value;
      certs[idx] = row;
      cvProfile = { ...cvProfile, certifications: certs };
      schedule();
      updateCertRowTitle(idx);
    });
    certList?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement | null)?.closest("[data-cv-cert-del]") as HTMLElement | null;
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-cv-cert-del") ?? "");
      if (!Number.isFinite(idx)) return;
      const certs = Array.isArray(cvProfile.certifications) ? [...cvProfile.certifications] : [];
      certs.splice(idx, 1);
      cvProfile = { ...cvProfile, certifications: certs };
      schedule();
      renderCertificationEditor();
      renderDocument();
    });

    langList?.addEventListener("input", (e) => {
      const el = e.target as HTMLInputElement | null;
      const field = (el as any)?.dataset?.cvLangField as string | undefined;
      const idx = Number((el as any)?.dataset?.idx ?? "");
      if (!el || !field || !Number.isFinite(idx)) return;
      const langs = Array.isArray(cvProfile.languages) ? [...cvProfile.languages] : [];
      const row = { ...(langs[idx] ?? {}) } as any;
      row[field] = el.value;
      langs[idx] = row;
      cvProfile = { ...cvProfile, languages: langs };
      schedule();
      updateLangRowTitle(idx);
    });
    langList?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement | null)?.closest("[data-cv-lang-del]") as HTMLElement | null;
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-cv-lang-del") ?? "");
      if (!Number.isFinite(idx)) return;
      const langs = Array.isArray(cvProfile.languages) ? [...cvProfile.languages] : [];
      langs.splice(idx, 1);
      cvProfile = { ...cvProfile, languages: langs };
      schedule();
      renderLanguageEditor();
      renderDocument();
    });
  };

  bindProfileInput();

  previewTemplateSelect?.addEventListener("change", () => {
    const v = previewTemplateSelect.value === "minimal" ? "minimal" : "classic";
    cvProfile = { ...cvProfile, cvTemplate: v };
    if (templateSelect) templateSelect.value = v;
    persistProfile();
    renderDocument();
  });

  importExpBtn?.addEventListener("click", () => {
    const raw = importPaste?.value?.trim() ?? "";
    if (!raw) {
      showToast(tt("cv.importEmptyToast", "Pega texto antes de importar."), "info");
      return;
    }
    const rows = parseExperienceBlocksFromPaste(raw);
    if (rows.length === 0) {
      showToast(tt("cv.importParseFailedToast", "No se detectaron bloques válidos."), "error");
      return;
    }
    const exp = [...(Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [])];
    for (const r of rows) exp.push({ ...r });
    cvProfile = { ...cvProfile, experiences: exp };
    persistProfile();
    renderExperienceEditor();
    renderDocument();
    showToast(tt("cv.importToastExperience", "Bloques añadidos a experiencia."), "success");
  });

  importEduBtn?.addEventListener("click", () => {
    const raw = importPaste?.value?.trim() ?? "";
    if (!raw) {
      showToast(tt("cv.importEmptyToast", "Pega texto antes de importar."), "info");
      return;
    }
    const rows = parseEducationBlocksFromPaste(raw);
    if (rows.length === 0) {
      showToast(tt("cv.importParseFailedToast", "No se detectaron bloques válidos."), "error");
      return;
    }
    const edu = [...(Array.isArray(cvProfile.education) ? cvProfile.education : [])];
    for (const r of rows) edu.push({ ...r });
    cvProfile = { ...cvProfile, education: edu };
    persistProfile();
    renderEducationEditor();
    renderDocument();
    showToast(tt("cv.importToastEducation", "Bloques añadidos a educación."), "success");
  });

  importPdfOpen?.addEventListener("click", () => importPdfInput?.click());
  importPdfInput?.addEventListener("change", async () => {
    const file = importPdfInput.files?.[0];
    importPdfInput.value = "";
    if (!file) return;
    try {
      const { extractTextFromPdfFile } = await import("@lib/cv-pdf-text");
      const text = await extractTextFromPdfFile(file);
      if (!text.trim()) {
        showToast(tt("cv.importPdfEmptyText", "No se extrajo texto del PDF."), "warning");
        return;
      }
      if (importPaste) {
        importPaste.value = (importPaste.value ? `${importPaste.value}\n\n` : "") + text;
      }
      if (importDetails) importDetails.open = true;
      showToast(tt("cv.importPdfToast", "Texto extraído del PDF. Revísalo y usa los botones de importación."), "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      showToast(msg || tt("cv.importPdfError", "No se pudo leer el PDF."), "error");
    }
  });

  // Photo source toggles (CV-only; does not overwrite uploaded avatar)
  photoUseLinkedinBtn?.addEventListener("click", () => {
    if (!linkedinAvatar) return;
    cvProfile = { ...cvProfile, photoSource: "linkedin", showPhoto: true };
    persistProfile();
    applyProfileToInputs();
    renderDocument();
  });
  photoUseUploadedBtn?.addEventListener("click", () => {
    if (!avatarSignedUrl) return;
    cvProfile = { ...cvProfile, photoSource: "uploaded", showPhoto: true };
    persistProfile();
    applyProfileToInputs();
    renderDocument();
  });

  // Preview modal (moves the document into a full-screen dialog)
  const openPreview = () => {
    if (!previewModal || !previewBody || !docEl) return;
    previewBody.innerHTML = "";
    previewBody.appendChild(docEl);
    if (previewTemplateSelect) previewTemplateSelect.value = cvProfile.cvTemplate === "minimal" ? "minimal" : "classic";
    refreshPreviewSectionRail();
    previewModal.classList.remove("hidden");
    previewModal.classList.add("flex");
    document.body.style.overflow = "hidden";
  };
  const closePreview = () => {
    if (!previewModal || !docHost || !docEl) return;
    previewModal.classList.add("hidden");
    previewModal.classList.remove("flex");
    docHost.appendChild(docEl);
    document.body.style.overflow = "";
  };
  previewOpenBtn?.addEventListener("click", openPreview);
  previewCloseBtn?.addEventListener("click", closePreview);
  previewModal?.addEventListener("click", (e) => {
    if (e.target === previewModal) closePreview();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!previewModal || previewModal.classList.contains("hidden")) return;
    closePreview();
  });

  expAddBtn?.addEventListener("click", () => {
    const exp = Array.isArray(cvProfile.experiences) ? [...cvProfile.experiences] : [];
    exp.push({ role: "", company: "", location: "", start: "", end: "", bullets: "" });
    cvProfile = { ...cvProfile, experiences: exp };
    persistProfile();
    renderExperienceEditor();
    renderDocument();
  });
  eduAddBtn?.addEventListener("click", () => {
    const edu = Array.isArray(cvProfile.education) ? [...cvProfile.education] : [];
    edu.push({ degree: "", school: "", location: "", start: "", end: "", details: "" });
    cvProfile = { ...cvProfile, education: edu };
    persistProfile();
    renderEducationEditor();
    renderDocument();
  });

  certAddBtn?.addEventListener("click", () => {
    const certs = Array.isArray(cvProfile.certifications) ? [...cvProfile.certifications] : [];
    certs.push({ name: "", issuer: "", year: "", url: "" });
    cvProfile = { ...cvProfile, certifications: certs };
    persistProfile();
    renderCertificationEditor();
    renderDocument();
  });
  langAddBtn?.addEventListener("click", () => {
    const langs = Array.isArray(cvProfile.languages) ? [...cvProfile.languages] : [];
    langs.push({ name: "", level: "" });
    cvProfile = { ...cvProfile, languages: langs };
    persistProfile();
    renderLanguageEditor();
    renderDocument();
  });

  selAll?.addEventListener("click", () => {
    for (const p of projects) selectedSlugs.add(p.slug);
    persistSelection();
    renderList();
    renderDocument();
  });
  selNone?.addEventListener("click", () => {
    selectedSlugs.clear();
    persistSelection();
    renderList();
    renderDocument();
  });

  printBtn?.addEventListener("click", () => window.print());
}

const start = () => void boot();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
document.addEventListener("astro:page-load", start as any);
document.addEventListener("astro:after-swap", start as any);
