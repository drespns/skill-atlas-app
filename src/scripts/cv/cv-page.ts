import i18next from "i18next";
import { getHelpStackItem, HELP_STACK_ITEMS } from "@config/help-stack";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import {
  buildCvDocumentsPrefsPatch,
  CV_DOCUMENTS_MAX,
  loadPrefs,
  migrateCvDocumentsIntoPrefs,
  newCvDocumentId,
  updatePrefs,
  CV_JOB_OFFERS_MAX,
  type AppPrefsV1,
  type CvDocumentSlotV1,
  type CvEducationV1,
  type CvExperienceV1,
  type CvJobOfferV1,
  type CvProfileV1,
} from "@scripts/core/prefs";
import { showToast } from "@scripts/core/ui-feedback";
import {
  CV_LINK_SLOT_COUNT,
  buildCvSocialChipsHtml,
  migrateCvLinksToSlots,
  slotsToPersistedLinks,
  type CvSocialLinkDisplay,
} from "@lib/cv-contact-html";
import { analyzeCvForAts } from "@lib/cv-ats-check";
import { computeAtsHeuristicScore } from "@lib/cv-ats-score";
import { formatCvDateRange } from "@lib/cv-display-format";
import { clampCvPrintMaxPages, cvPrintTypographicScale } from "@lib/cv-print-scale";
import { CV_TEMPLATE_BODY_CLASSES, normalizeCvTemplateId } from "@lib/cv-templates";
import { applyCvDocumentSectionOrder, normalizeCvDocumentSectionOrder } from "@lib/cv-document-section-order";
import {
  extractLooseCvHeaderFields,
  extractUrlsForCvSlots,
  filterFalsePositiveExperienceRows,
  mergeLanguagesSplitFromCertificationsSection,
  normalizeCvPasteForHeuristics,
  parseCertificationsFromPaste,
  parseEducationBlocksFromPaste,
  parseExperienceBlocksFromPaste,
  parseLanguagesFromPaste,
  preprocessCvPasteForImport,
  splitCvPasteBySections,
} from "@lib/cv-paste-import";
import {
  applyCvManualImport,
  bumpManualImportTargetIfOccupied,
  escHtml,
  MANUAL_IMPORT_SIDEBAR_SECTION_ORDER,
  manualAssignmentTargetIsMultiline,
  manualImportEducationRowIndexKey,
  manualImportExperienceRowIndexKey,
  manualImportSidebarSection,
  manualTargetMarkClass,
  type CvManualAssignment,
  type ManualImportSidebarSectionId,
} from "@lib/cv-manual-import-map";
import { mergeSuggestedAssignments, suggestManualAssignmentsFromPaste } from "@lib/cv-manual-import-suggest";
import {
  getSurfaceSelectionClientRect,
  getSurfaceSelectionEndCaretRect,
  getSurfaceSelectionSourceOffsets,
  renderManualImportSurface,
} from "@lib/cv-manual-import-surface";
import { bindCvBrowserTabs } from "@scripts/cv/cv-browser-tabs";
import { bindCvJobOffersKanban } from "@scripts/cv/cv-job-offers-ui";
import { bindCvScrollDocRail } from "@scripts/cv/cv-scroll-doc-rail";
import { bindCvSettingsModal } from "@scripts/cv/cv-settings-modal";

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

type CvProfile = CvProfileV1;
type CvExperience = CvExperienceV1;
type CvEducation = CvEducationV1;

function normImpKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function experienceDedupeKey(r: CvExperience): string {
  const a = normImpKey((r.role ?? "").toString());
  const b = normImpKey((r.company ?? "").toString());
  if (!a && !b) return "";
  return `${a}|${b}`;
}

function educationDedupeKey(r: CvEducation): string {
  const a = normImpKey((r.degree ?? "").toString());
  const b = normImpKey((r.school ?? "").toString());
  if (!a && !b) return "";
  return `${a}|${b}`;
}

function isDuplicateExperience(existing: CvExperience[], row: CvExperience): boolean {
  const k = experienceDedupeKey(row);
  if (!k) return false;
  return existing.some((e) => experienceDedupeKey(e) === k);
}

function isDuplicateEducation(existing: CvEducation[], row: CvEducation): boolean {
  const k = educationDedupeKey(row);
  if (!k) return false;
  return existing.some((e) => educationDedupeKey(e) === k);
}

function certDedupeKey(c: { name?: string }): string {
  return normImpKey((c.name ?? "").toString());
}

function isDuplicateCert(existing: { name?: string }[], c: { name?: string }): boolean {
  const k = certDedupeKey(c);
  if (k.length < 3) return false;
  return existing.some((x) => certDedupeKey(x) === k);
}

function langDedupeKey(l: { name?: string }): string {
  return normImpKey((l.name ?? "").toString());
}

function isDuplicateLang(existing: { name?: string }[], l: { name?: string }): boolean {
  const k = langDedupeKey(l);
  if (k.length < 2) return false;
  return existing.some((x) => langDedupeKey(x) === k);
}

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

function cvTelHref(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  if (!d) return "#";
  if (d.startsWith("00")) return `tel:+${d.slice(2)}`;
  if (d.startsWith("+")) return `tel:${d}`;
  return `tel:${d}`;
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
  const docCoverSection = document.querySelector<HTMLElement>("[data-cv-doc-cover-section]");
  const docCoverLetters = document.querySelector<HTMLElement>("[data-cv-doc-cover-letters]");
  const printBtn = document.querySelector<HTMLButtonElement>("[data-cv-print]");
  const selAll = document.querySelector<HTMLButtonElement>("[data-cv-select-all]");
  const selNone = document.querySelector<HTMLButtonElement>("[data-cv-select-none]");
  const selFeaturedOnly = document.querySelector<HTMLButtonElement>("[data-cv-select-featured-only]");
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
  const settingsModal = document.querySelector<HTMLElement>("[data-cv-settings-modal]");
  const qsSettings = <T extends HTMLElement>(sel: string) => settingsModal?.querySelector<T>(sel) ?? null;
  const printMaxPagesSelect = qsSettings<HTMLSelectElement>("[data-cv-print-max-pages]");
  const cvDateExpSel = qsSettings<HTMLSelectElement>("[data-cv-date-exp]");
  const cvDateEduSel = qsSettings<HTMLSelectElement>("[data-cv-date-edu]");
  const cvShowExpLocCb = qsSettings<HTMLInputElement>("[data-cv-show-exp-location]");
  const cvShowEduLocCb = qsSettings<HTMLInputElement>("[data-cv-show-edu-location]");
  const cvShowEduDetailsCb = qsSettings<HTMLInputElement>("[data-cv-show-edu-details]");
  const cvShowProjDescCb = qsSettings<HTMLInputElement>("[data-cv-show-proj-desc]");
  const cvShowContactLocCb = qsSettings<HTMLInputElement>("[data-cv-show-contact-location]");
  const coverTabPanel = document.querySelector<HTMLElement>('[data-cv-tab-panel="cartas"]');
  const cvCoverAddBtn = coverTabPanel?.querySelector<HTMLButtonElement>("[data-cv-cover-add]") ?? null;
  const cvCoverList = coverTabPanel?.querySelector<HTMLElement>("[data-cv-cover-list]") ?? null;
  const headlineInput = document.querySelector<HTMLInputElement>("[data-cv-headline]");
  const locationInput = document.querySelector<HTMLInputElement>("[data-cv-location]");
  const emailInput = document.querySelector<HTMLInputElement>("[data-cv-email]");
  const phoneMobileInput = document.querySelector<HTMLInputElement>("[data-cv-phone-mobile]");
  const phoneLandlineInput = document.querySelector<HTMLInputElement>("[data-cv-phone-landline]");
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
  const previewAtsBtn = document.querySelector<HTMLButtonElement>("[data-cv-preview-ats]");
  const previewAtsPanel = document.querySelector<HTMLElement>("[data-cv-preview-ats-panel]");
  const previewAtsHide = document.querySelector<HTMLButtonElement>("[data-cv-preview-ats-hide]");
  const atsOkList = document.querySelector<HTMLElement>("[data-cv-ats-ok]");
  const atsWarnList = document.querySelector<HTMLElement>("[data-cv-ats-warn]");
  const atsInfoList = document.querySelector<HTMLElement>("[data-cv-ats-info]");
  const atsScoreVal = document.querySelector<HTMLElement>("[data-cv-ats-score-val]");
  const atsScoreBar = document.querySelector<HTMLElement>("[data-cv-ats-score-bar]");
  const importModal = document.querySelector<HTMLElement>("[data-cv-import-modal]");
  const importModalPanel = document.querySelector<HTMLElement>("[data-cv-import-modal-panel]");
  const importModalClose = document.querySelector<HTMLButtonElement>("[data-cv-import-modal-close]");
  const importOpenBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-open]");
  const importPaste = document.querySelector<HTMLTextAreaElement>("[data-cv-import-paste]");
  const importApplyFormBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-apply-form]");
  const importBothBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-both]");
  const importExpBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-experience]");
  const importEduBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-education]");
  const importModalPdfInput = document.querySelector<HTMLInputElement>("[data-cv-import-modal-pdf-input]");
  const importModalPdfOpen = document.querySelector<HTMLButtonElement>("[data-cv-import-modal-pdf-open]");
  const importManualSurface = document.querySelector<HTMLElement>("[data-cv-import-manual-surface]");
  const importManualTarget = document.querySelector<HTMLSelectElement>("[data-cv-import-manual-target]");
  const importManualClear = document.querySelector<HTMLButtonElement>("[data-cv-import-manual-clear]");
  const importManualList = document.querySelector<HTMLElement>("[data-cv-import-manual-list]");
  const importManualApply = document.querySelector<HTMLButtonElement>("[data-cv-import-manual-apply]");
  const importManualSuggestBtn = document.querySelector<HTMLButtonElement>("[data-cv-import-manual-suggest]");
  const importManualPopover = document.querySelector<HTMLElement>("[data-cv-import-manual-popover]");
  const importManualPopoverBody = document.querySelector<HTMLTextAreaElement>("[data-cv-import-manual-popover-body]");
  const importManualPopoverFilter = document.querySelector<HTMLInputElement>("[data-cv-import-manual-popover-filter]");
  const importManualPopoverOptions = document.querySelector<HTMLElement>("[data-cv-import-manual-popover-options]");
  const importManualPopoverShortcuts = document.querySelector<HTMLElement>("[data-cv-import-manual-popover-shortcuts]");
  const importManualPopoverFollowDragCb = document.querySelector<HTMLInputElement>(
    "[data-cv-import-manual-popover-follow-drag]",
  );
  const CV_IMPORT_POPOVER_FOLLOW_DRAG_LS = "skillatlas.cvImportPopoverFollowDrag";
  const importConfirmModal = document.querySelector<HTMLElement>("[data-cv-import-confirm-modal]");
  const importConfirmPanel = document.querySelector<HTMLElement>("[data-cv-import-confirm-panel]");
  const importConfirmBackup = document.querySelector<HTMLButtonElement>("[data-cv-import-confirm-backup]");
  const importConfirmCancel = document.querySelector<HTMLButtonElement>("[data-cv-import-confirm-cancel]");
  const importConfirmProceed = document.querySelector<HTMLButtonElement>("[data-cv-import-confirm-proceed]");
  const backupRestoreTrigger = document.querySelector<HTMLButtonElement>("[data-cv-backup-restore-trigger]");
  const backupRestoreInput = document.querySelector<HTMLInputElement>("[data-cv-backup-restore-input]");
  const clearContentBtn = document.querySelector<HTMLButtonElement>("[data-cv-clear-content]");
  const clearModal = document.querySelector<HTMLElement>("[data-cv-clear-modal]");
  const clearModalPanel = document.querySelector<HTMLElement>("[data-cv-clear-modal-panel]");
  const clearModalCancel = document.querySelector<HTMLButtonElement>("[data-cv-clear-modal-cancel]");
  const clearModalConfirm = document.querySelector<HTMLButtonElement>("[data-cv-clear-modal-confirm]");
  const headerJsonExportBtn = document.querySelector<HTMLButtonElement>("[data-cv-header-json-export]");
  const docSelect = document.querySelector<HTMLSelectElement>("[data-cv-doc-select]");
  const docNewBtn = document.querySelector<HTMLButtonElement>("[data-cv-doc-new]");
  const docDupBtn = document.querySelector<HTMLButtonElement>("[data-cv-doc-dup]");
  const docManageBtn = document.querySelector<HTMLButtonElement>("[data-cv-doc-manage]");
  const docNameDialog = document.querySelector<HTMLDialogElement>("[data-cv-doc-name-dialog]");
  const docNameInput = document.querySelector<HTMLInputElement>("[data-cv-doc-name-input]");
  const docNameMode = document.querySelector<HTMLInputElement>("[data-cv-doc-name-mode]");
  const docNameCancel = document.querySelector<HTMLButtonElement>("[data-cv-doc-name-cancel]");
  const docNameSave = document.querySelector<HTMLButtonElement>("[data-cv-doc-name-save]");
  const docManageDialog = document.querySelector<HTMLDialogElement>("[data-cv-doc-manage-dialog]");
  const docManageName = document.querySelector<HTMLInputElement>("[data-cv-doc-manage-name]");
  const docManageTags = document.querySelector<HTMLInputElement>("[data-cv-doc-manage-tags]");
  const docManageMain = document.querySelector<HTMLInputElement>("[data-cv-doc-manage-main]");
  const docManageDelete = document.querySelector<HTMLButtonElement>("[data-cv-doc-manage-delete]");
  const docManageCancel = document.querySelector<HTMLButtonElement>("[data-cv-doc-manage-cancel]");
  const docManageSave = document.querySelector<HTMLButtonElement>("[data-cv-doc-manage-save]");
  const featuredNoneBtn = document.querySelector<HTMLButtonElement>("[data-cv-featured-none]");
  const kickerBadge = document.querySelector<HTMLElement>("[data-cv-kicker-badge]");
  const kickerPulse = document.querySelector<HTMLElement>("[data-cv-kicker-pulse]");
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

  let cvDocuments: CvDocumentSlotV1[] = (prefs.cvDocuments ?? []).map((d) => ({
    ...d,
    cvProfile: JSON.parse(JSON.stringify(d.cvProfile)) as CvProfile,
  }));
  let cvActiveDocumentId = prefs.cvActiveDocumentId ?? cvDocuments[0]?.id ?? "";
  const activeCvSlot = () => cvDocuments.find((d) => d.id === cvActiveDocumentId) ?? cvDocuments[0]!;

  let cvProfile: CvProfile = {};
  const hydrateCvProfileFromActiveSlot = () => {
    const a = activeCvSlot();
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
      ...(a?.cvProfile ?? {}),
    };
    if (!cvProfile.photoSource) {
      cvProfile.photoSource = avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider";
    }
  };
  hydrateCvProfileFromActiveSlot();

  const getCvLinkSlots = (): string[] => {
    if (Array.isArray(cvProfile.cvLinkSlots) && cvProfile.cvLinkSlots.length === CV_LINK_SLOT_COUNT) {
      return cvProfile.cvLinkSlots.map((x) => (typeof x === "string" ? x : ""));
    }
    return migrateCvLinksToSlots(cvProfile.links);
  };

  const buildCvDisplayOrder = (saved: string[] | undefined, slugs: string[]): string[] => {
    const allowed = new Set(slugs);
    const seen = new Set<string>();
    const out: string[] = [];
    if (saved) {
      for (const s of saved) {
        if (allowed.has(s) && !seen.has(s)) {
          out.push(s);
          seen.add(s);
        }
      }
    }
    for (const s of slugs) {
      if (!seen.has(s)) {
        out.push(s);
        seen.add(s);
      }
    }
    return out;
  };

  let displayOrder = buildCvDisplayOrder(activeCvSlot().cvProjectDisplayOrder, defaultOrder);

  const applySelectionFromPrefs = () => {
    const act = activeCvSlot();
    const raw = act.cvProjectSlugs;
    displayOrder = buildCvDisplayOrder(act.cvProjectDisplayOrder, defaultOrder);
    selectedSlugs.clear();
    if (raw === undefined) {
      for (const s of defaultOrder) selectedSlugs.add(s);
      selectedOrder = displayOrder.filter((s) => selectedSlugs.has(s));
      return;
    }
    const allowed = new Set(defaultOrder);
    for (const s of raw) {
      if (allowed.has(s)) selectedSlugs.add(s);
    }
    selectedOrder = displayOrder.filter((s) => selectedSlugs.has(s));
  };

  applySelectionFromPrefs();

  function persistCvState() {
    const idx = cvDocuments.findIndex((d) => d.id === cvActiveDocumentId);
    if (idx < 0) return;
    selectedOrder = displayOrder.filter((s) => selectedSlugs.has(s));
    const allSelected = selectedSlugs.size === defaultOrder.length && defaultOrder.every((s) => selectedSlugs.has(s));
    const isDefaultSubsetOrder =
      allSelected && selectedOrder.length === defaultOrder.length && selectedOrder.every((s, i) => s === defaultOrder[i]);
    const slugsToSave = isDefaultSubsetOrder ? undefined : [...selectedOrder];
    const sameAsDefaultOrd =
      displayOrder.length === defaultOrder.length && displayOrder.every((s, i) => s === defaultOrder[i]);
    const displayOrderToSave = sameAsDefaultOrd ? undefined : [...displayOrder];
    const next = [...cvDocuments];
    next[idx] = {
      ...next[idx]!,
      cvProfile: JSON.parse(JSON.stringify(cvProfile)) as CvProfile,
      cvProjectSlugs: slugsToSave,
      cvProjectDisplayOrder: displayOrderToSave,
    };
    cvDocuments = next;
    prefs = updatePrefs(buildCvDocumentsPrefsPatch(cvDocuments, cvActiveDocumentId) as any);
  }

  const persistDisplayOrder = () => {
    persistCvState();
  };

  const persistSelection = () => {
    selectedOrder = displayOrder.filter((s) => selectedSlugs.has(s));
    persistCvState();
  };

  let cvJobOffers: CvJobOfferV1[] = [...(prefs.cvJobOffers ?? [])];

  const persistJobOffers = (next: CvJobOfferV1[]) => {
    cvJobOffers = next.slice(0, CV_JOB_OFFERS_MAX);
    prefs = updatePrefs({ cvJobOffers: cvJobOffers.length ? cvJobOffers : undefined });
    (window as unknown as { __skillatlasCvJobOffersRefresh?: () => void }).__skillatlasCvJobOffersRefresh?.();
  };

  const slotLabels = () => [
    tt("cv.linkLabel1", "LinkedIn"),
    tt("cv.linkLabel2", "GitHub"),
    tt("cv.linkLabel3", "Portfolio"),
    tt("cv.linkLabel4", "X / Twitter"),
    tt("cv.linkLabel5", "Web / otro"),
  ];

  const escManualOptAttr = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  let manualImportAssignments: CvManualAssignment[] = [];
  let importManualTextSnapshot = "";
  /** Evita cerrar el modal al soltar el clic del backdrop tras arrastrar una selección desde el panel. */
  let suppressCvImportModalBackdropClose = false;

  const rebuildManualImportTargetSelect = () => {
    if (!importManualTarget) return;
    const linkLabs = slotLabels();
    const expLen = Array.isArray(cvProfile.experiences) ? cvProfile.experiences.length : 0;
    const eduLen = Array.isArray(cvProfile.education) ? cvProfile.education.length : 0;
    const certLen = Array.isArray(cvProfile.certifications) ? cvProfile.certifications.length : 0;
    const langLen = Array.isArray(cvProfile.languages) ? cvProfile.languages.length : 0;
    const newSlots = 4;
    const o = (v: string, t: string) => `<option value="${escManualOptAttr(v)}">${escManualOptAttr(t)}</option>`;
    const grp = (label: string, inner: string) => `<optgroup label="${escManualOptAttr(label)}">${inner}</optgroup>`;
    const parts: string[] = [];
    let b = o("", tt("cv.importManualTargetPlaceholder", "— Elige destino —"));
    b += o("headline", tt("cv.importManualOptHeadline", "Titular (debajo del nombre)"));
    b += o("summary", tt("cv.importManualOptSummary", "Resumen / bio del CV"));
    b += o("email", tt("cv.importManualOptEmail", "Email"));
    b += o("phoneMobile", tt("cv.importManualOptPhoneMobile", "Teléfono (móvil / principal)"));
    b += o("phoneLandline", tt("cv.importManualOptPhoneLandline", "Teléfono fijo / otro"));
    parts.push(grp(tt("cv.importManualGroupProfile", "Perfil"), b));
    b = "";
    for (let i = 0; i < CV_LINK_SLOT_COUNT; i++) {
      b += o(`link:${i}`, `${tt("cv.importManualOptLink", "Enlace")}: ${linkLabs[i]}`);
    }
    parts.push(grp(tt("cv.importManualGroupLinks", "Enlaces"), b));
    b = "";
    const expRow = tt("cv.importManualRowExp", "Experiencia");
    for (let i = 0; i < expLen; i++) {
      const p = `${expRow} ${i + 1}`;
      b += o(`exp:exist:${i}:role`, `${p} — ${tt("cv.expRole", "Rol")}`);
      b += o(`exp:exist:${i}:company`, `${p} — ${tt("cv.expCompany", "Empresa")}`);
      b += o(`exp:exist:${i}:location`, `${p} — ${tt("cv.expLocation", "Ubicación")}`);
      b += o(`exp:exist:${i}:start`, `${p} — ${tt("cv.expStart", "Inicio")}`);
      b += o(`exp:exist:${i}:end`, `${p} — ${tt("cv.expEnd", "Fin")}`);
      b += o(`exp:exist:${i}:bullets`, `${p} — ${tt("cv.expBullets", "Bullets")}`);
    }
    if (b) parts.push(grp(tt("cv.importManualGroupExpCur", "Experiencia (formulario)"), b));
    b = "";
    const expNew = tt("cv.importManualRowExpNew", "Nueva experiencia");
    for (let i = 0; i < newSlots; i++) {
      const p = `${expNew} ${i + 1}`;
      b += o(`exp:new:${i}:role`, `${p} — ${tt("cv.expRole", "Rol")}`);
      b += o(`exp:new:${i}:company`, `${p} — ${tt("cv.expCompany", "Empresa")}`);
      b += o(`exp:new:${i}:location`, `${p} — ${tt("cv.expLocation", "Ubicación")}`);
      b += o(`exp:new:${i}:start`, `${p} — ${tt("cv.expStart", "Inicio")}`);
      b += o(`exp:new:${i}:end`, `${p} — ${tt("cv.expEnd", "Fin")}`);
      b += o(`exp:new:${i}:bullets`, `${p} — ${tt("cv.expBullets", "Bullets")}`);
    }
    parts.push(grp(tt("cv.importManualGroupExpNew", "Experiencia (nueva fila)"), b));
    b = "";
    const eduRow = tt("cv.importManualRowEdu", "Educación");
    for (let i = 0; i < eduLen; i++) {
      const p = `${eduRow} ${i + 1}`;
      b += o(`edu:exist:${i}:degree`, `${p} — ${tt("cv.eduDegree", "Título")}`);
      b += o(`edu:exist:${i}:school`, `${p} — ${tt("cv.eduSchool", "Centro")}`);
      b += o(`edu:exist:${i}:location`, `${p} — ${tt("cv.eduLocation", "Ubicación")}`);
      b += o(`edu:exist:${i}:start`, `${p} — ${tt("cv.eduStart", "Inicio")}`);
      b += o(`edu:exist:${i}:end`, `${p} — ${tt("cv.eduEnd", "Fin")}`);
      b += o(`edu:exist:${i}:details`, `${p} — ${tt("cv.eduDetails", "Detalles")}`);
    }
    if (b) parts.push(grp(tt("cv.importManualGroupEduCur", "Educación (formulario)"), b));
    b = "";
    const eduNew = tt("cv.importManualRowEduNew", "Nueva educación");
    for (let i = 0; i < newSlots; i++) {
      const p = `${eduNew} ${i + 1}`;
      b += o(`edu:new:${i}:degree`, `${p} — ${tt("cv.eduDegree", "Título")}`);
      b += o(`edu:new:${i}:school`, `${p} — ${tt("cv.eduSchool", "Centro")}`);
      b += o(`edu:new:${i}:location`, `${p} — ${tt("cv.eduLocation", "Ubicación")}`);
      b += o(`edu:new:${i}:start`, `${p} — ${tt("cv.eduStart", "Inicio")}`);
      b += o(`edu:new:${i}:end`, `${p} — ${tt("cv.eduEnd", "Fin")}`);
      b += o(`edu:new:${i}:details`, `${p} — ${tt("cv.eduDetails", "Detalles")}`);
    }
    parts.push(grp(tt("cv.importManualGroupEduNew", "Educación (nueva fila)"), b));
    b = "";
    const certRow = tt("cv.importManualRowCert", "Certificación");
    for (let i = 0; i < certLen; i++) {
      b += o(`cert:exist:${i}:name`, `${certRow} ${i + 1} — ${tt("cv.certName", "Nombre")}`);
    }
    for (let i = 0; i < newSlots; i++) {
      b += o(`cert:new:${i}:name`, `${tt("cv.importManualRowCertNew", "Nueva certificación")} ${i + 1}`);
    }
    parts.push(grp(tt("cv.importManualGroupCert", "Certificaciones"), b));
    b = "";
    const langRow = tt("cv.importManualRowLang", "Idioma");
    for (let i = 0; i < langLen; i++) {
      b += o(`lang:exist:${i}:line`, `${langRow} ${i + 1} — ${tt("cv.importManualLangLine", "Línea completa")}`);
      b += o(`lang:exist:${i}:name`, `${langRow} ${i + 1} — ${tt("cv.langName", "Idioma")}`);
      b += o(`lang:exist:${i}:level`, `${langRow} ${i + 1} — ${tt("cv.langLevel", "Nivel")}`);
    }
    for (let i = 0; i < newSlots; i++) {
      b += o(`lang:new:${i}:line`, `${tt("cv.importManualRowLangNew", "Nuevo idioma")} ${i + 1} — ${tt("cv.importManualLangLine", "Línea (p. ej. Inglés — B2)")}`);
      b += o(`lang:new:${i}:name`, `${tt("cv.importManualRowLangNew", "Nuevo idioma")} ${i + 1} — ${tt("cv.langName", "Nombre")}`);
      b += o(`lang:new:${i}:level`, `${tt("cv.importManualRowLangNew", "Nuevo idioma")} ${i + 1} — ${tt("cv.langLevel", "Nivel")}`);
    }
    parts.push(grp(tt("cv.importManualGroupLang", "Idiomas"), b));
    importManualTarget.innerHTML = parts.join("");
    importManualTarget.value = "";
  };

  const getImportPopoverFollowDrag = () => importManualPopoverFollowDragCb?.checked === true;

  const compareManualRowIndexOrOther = (a: string, b: string): number => {
    if (a === "other" && b !== "other") return 1;
    if (b === "other" && a !== "other") return -1;
    return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0);
  };

  const manualSidebarSectionHeading = (id: ManualImportSidebarSectionId) => {
    const labels: Record<ManualImportSidebarSectionId, string> = {
      profile: tt("cv.importManualSidebarProfile", "Perfil"),
      links: tt("cv.importManualSidebarLinks", "Enlaces"),
      experience: tt("cv.importManualSidebarExperience", "Experiencia"),
      education: tt("cv.importManualSidebarEducation", "Educación"),
      certifications: tt("cv.importManualSidebarCertifications", "Certificaciones"),
      languages: tt("cv.importManualSidebarLanguages", "Idiomas"),
      other: tt("cv.importManualSidebarOther", "Otros"),
    };
    return labels[id];
  };

  const manualExpEduUnifiedBlockTitle = (section: "experience" | "education", indexStr: string) => {
    const n = (parseInt(indexStr, 10) || 0) + 1;
    if (section === "experience") {
      return tt("cv.importManualSidebarExpBlock", "Experiencia — bloque {{n}}").replace("{{n}}", String(n));
    }
    return tt("cv.importManualSidebarEduBlock", "Educación — bloque {{n}}").replace("{{n}}", String(n));
  };

  const manualExpEduUnifiedBlockHintHtml = (section: "experience" | "education") =>
    escHtml(
      section === "experience"
        ? tt(
            "cv.importManualSidebarExpBlockHint",
            "Las etiquetas exp:exist / exp:new indican si al aplicar se rellena la fila que ya tienes o se añade una nueva; un solo valor por campo (al cambiar de exist a new, o al revés, se sustituye).",
          )
        : tt(
            "cv.importManualSidebarEduBlockHint",
            "Las etiquetas edu:exist / edu:new indican si al aplicar se rellena la fila que ya tienes o se añade una nueva; un solo valor por campo (al cambiar de exist a new, o al revés, se sustituye).",
          ),
    );

  const buildManualImportAssignmentRowHtml = (a: CvManualAssignment, i: number, raw: string) => {
    const slice = raw.slice(a.start, a.end);
    const display =
      a.valueOverride !== undefined && String(a.valueOverride).trim().length > 0
        ? String(a.valueOverride).trim()
        : slice;
    const short = display.length > 56 ? `${display.slice(0, 54)}…` : display;
    const hue = manualTargetMarkClass(a.target);
    return `<div class="flex items-start gap-2 rounded-md border border-gray-200/75 dark:border-gray-800 bg-white/70 dark:bg-gray-950/50 px-2 py-1">
      <span class="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-gray-800 dark:text-gray-200">${escHtml(short)}</span>
      <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono text-gray-900 dark:text-gray-100 ${hue}">${escHtml(a.target)}</span>
      <button type="button" class="shrink-0 text-rose-600 dark:text-rose-400 hover:underline" data-cv-import-manual-remove="${i}" aria-label="Quitar">×</button>
    </div>`;
  };

  const buildManualImportListHtml = (): string => {
    const raw = importPaste?.value ?? "";
    if (manualImportAssignments.length === 0) {
      return `<p class="m-0 rounded-lg border border-dashed border-gray-300/80 dark:border-gray-700 px-2 py-6 text-center text-[11px] text-gray-500 dark:text-gray-500">${escHtml(
        tt("cv.importManualSidebarEmpty", "Nada mapeado aún. Asigna fragmentos desde el texto."),
      )}</p>`;
    }
    const indexed = manualImportAssignments.map((a, i) => ({ a, i }));
    const buckets = new Map<ManualImportSidebarSectionId, typeof indexed>();
    for (const sid of MANUAL_IMPORT_SIDEBAR_SECTION_ORDER) buckets.set(sid, []);
    for (const row of indexed) {
      buckets.get(manualImportSidebarSection(row.a.target))!.push(row);
    }
    let html = "";
    for (const sid of MANUAL_IMPORT_SIDEBAR_SECTION_ORDER) {
      const items = buckets.get(sid)!;
      if (items.length === 0) continue;
      const title = manualSidebarSectionHeading(sid);
      html += `<section class="mb-4 last:mb-0">`;
      html += `<h4 class="m-0 mb-2 border-b border-gray-200/60 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">${escHtml(title)}</h4>`;
      if (sid === "experience") {
        html += `<p class="m-0 mb-2 text-[9px] leading-snug text-gray-500 dark:text-gray-500">${manualExpEduUnifiedBlockHintHtml(
          "experience",
        )}</p>`;
      } else if (sid === "education") {
        html += `<p class="m-0 mb-2 text-[9px] leading-snug text-gray-500 dark:text-gray-500">${manualExpEduUnifiedBlockHintHtml(
          "education",
        )}</p>`;
      }
      if (sid === "experience" || sid === "education") {
        const rowKeyOf = (target: string) =>
          sid === "experience"
            ? (manualImportExperienceRowIndexKey(target) ?? "other")
            : (manualImportEducationRowIndexKey(target) ?? "other");
        const keys = [...new Set(items.map(({ a }) => rowKeyOf(a.target)))].sort(compareManualRowIndexOrOther);
        for (const key of keys) {
          const subItems = items.filter(({ a }) => rowKeyOf(a.target) === key);
          subItems.sort((x, y) => x.a.start - y.a.start);
          html += `<div class="mb-2 space-y-1 rounded-lg border border-gray-200/60 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/25 p-2 last:mb-0">`;
          if (key !== "other") {
            html += `<p class="m-0 mb-1 text-[10px] font-semibold text-gray-600 dark:text-gray-400">${escHtml(
              manualExpEduUnifiedBlockTitle(sid, key),
            )}</p>`;
          }
          for (const { a, i } of subItems) html += buildManualImportAssignmentRowHtml(a, i, raw);
          html += `</div>`;
        }
      } else {
        items.sort((x, y) => x.a.start - y.a.start);
        html += `<div class="space-y-1">`;
        for (const { a, i } of items) html += buildManualImportAssignmentRowHtml(a, i, raw);
        html += `</div>`;
      }
      html += `</section>`;
    }
    return html;
  };

  const refreshManualImportUi = () => {
    const raw = importPaste?.value ?? "";
    if (importManualSurface) {
      renderManualImportSurface(
        importManualSurface,
        raw,
        manualImportAssignments,
        tt("cv.importSurfaceEmptyHint", "Pega el CV con Ctrl+V o usa «Elegir PDF»."),
      );
    }
    if (importManualList) {
      importManualList.innerHTML = buildManualImportListHtml();
    }
  };

  let manualImportPopoverRaf = 0;
  /** Mientras el usuario arrastra la selección en la superficie, no mostramos el popover (evita interceptar el gesto). */
  let manualImportPointerSelecting = false;

  const hideManualImportPopover = () => {
    importManualPopover?.classList.add("hidden");
    importManualPopover?.classList.remove("pointer-events-none");
  };

  const filterNorm = (s: string) => {
    try {
      return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch {
      return s.toLowerCase();
    }
  };

  const rebuildManualImportPopoverOptions = () => {
    if (!importManualPopoverOptions || !importManualTarget) return;
    importManualPopoverOptions.replaceChildren();
    const qRaw = (importManualPopoverFilter?.value ?? "").trim();
    const nq = filterNorm(qRaw);
    for (const og of importManualTarget.querySelectorAll("optgroup")) {
      const glabel = og.getAttribute("label") ?? "";
      const opts: { v: string; t: string }[] = [];
      for (const op of og.querySelectorAll("option")) {
        const v = op.getAttribute("value") ?? "";
        const t = (op.textContent ?? "").trim();
        if (!v) continue;
        if (nq && !filterNorm(t).includes(nq) && !filterNorm(v).includes(nq)) continue;
        opts.push({ v, t });
      }
      if (opts.length === 0) continue;
      const details = document.createElement("details");
      details.className =
        "group mb-2 last:mb-0 rounded-lg border border-gray-200/80 dark:border-gray-800 bg-white/50 dark:bg-gray-950/40 open:pb-1";
      if (nq) details.open = true;
      const summary = document.createElement("summary");
      summary.className =
        "cursor-pointer select-none list-none px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 marker:content-none [&::-webkit-details-marker]:hidden";
      summary.textContent = glabel;
      details.appendChild(summary);
      const wrap = document.createElement("div");
      wrap.className = "flex flex-col gap-0.5 px-2 pb-1";
      for (const { v, t } of opts) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-cv-manual-assign-to", v);
        b.className =
          "w-full rounded-md border border-gray-200/90 text-left dark:border-gray-700 bg-white/90 dark:bg-gray-950/80 px-2 py-1.5 text-[11px] font-medium text-gray-800 dark:text-gray-100 hover:border-teal-400/60 hover:bg-teal-50/80 dark:hover:bg-teal-950/30";
        b.textContent = t;
        wrap.appendChild(b);
      }
      details.appendChild(wrap);
      importManualPopoverOptions.appendChild(details);
    }
    if (!importManualPopoverOptions.firstChild) {
      const empty = document.createElement("p");
      empty.className = "m-0 py-3 text-center text-[11px] text-gray-500 dark:text-gray-500";
      empty.textContent = tt("cv.importManualPopoverNoMatch", "Ningún destino coincide con la búsqueda.");
      importManualPopoverOptions.appendChild(empty);
    }
  };

  const renderManualImportPopoverShortcuts = () => {
    if (!importManualPopoverShortcuts) return;
    const chips: { target: string; label: string }[] = [
      { target: "summary", label: tt("cv.importManualChipBio", "Bio") },
      { target: "headline", label: tt("cv.importManualChipHeadline", "Titular") },
      { target: "email", label: tt("cv.importManualChipEmail", "Email") },
      { target: "phoneMobile", label: tt("cv.importManualChipPhone", "Teléfono") },
      { target: "link:0", label: tt("cv.importManualChipLinkedIn", "LinkedIn") },
      { target: "link:1", label: tt("cv.importManualChipGitHub", "GitHub") },
      { target: "exp:new:0:role", label: tt("cv.importManualChipExp1Role", "Exp.1 rol") },
      { target: "exp:new:0:company", label: tt("cv.importManualChipExp1Company", "Exp.1 empresa") },
      { target: "exp:new:0:start", label: tt("cv.importManualChipExp1Dates", "Exp.1 fechas") },
      { target: "exp:new:0:bullets", label: tt("cv.importManualChipExp1Bullets", "Exp.1 bullets") },
    ];
    const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    importManualPopoverShortcuts.innerHTML = chips
      .map(
        (c) =>
          `<button type="button" data-cv-manual-assign-to="${escAttr(c.target)}" class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-2 py-1 text-[11px] font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">${escHtml(c.label)}</button>`,
      )
      .join("");
  };

  const syncManualImportPopoverFromTarget = () => {
    renderManualImportPopoverShortcuts();
    if (importManualPopoverFilter) importManualPopoverFilter.value = "";
    rebuildManualImportPopoverOptions();
  };

  const updateManualImportPopoverPosition = () => {
    const pop = importManualPopover;
    if (!pop || pop.classList.contains("hidden")) return;
    const block = getSurfaceSelectionClientRect(importManualSurface);
    const caret = getSurfaceSelectionEndCaretRect(importManualSurface);
    const fb = importManualSurface?.getBoundingClientRect();
    const margin = 8;
    const popW = Math.min(720, window.innerWidth - margin * 2);
    pop.style.width = `${popW}px`;
    void pop.offsetHeight;
    const ph = pop.getBoundingClientRect().height || 120;
    const fallback = fb
      ? new DOMRect(fb.left + 12, fb.top + 12, 8, 22)
      : new DOMRect(16, 16, 8, 22);
    const focus = caret ?? block ?? fallback;
    const fullBlock = block ?? focus;
    let left = focus.right + margin;
    let top = focus.top + focus.height * 0.5 - ph * 0.5;
    if (left + popW > window.innerWidth - margin) {
      left = focus.left - popW - margin;
    }
    if (left < margin) {
      left = fullBlock.left;
      top = fullBlock.bottom + 6;
      if (left + popW > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - margin - popW);
    }
    if (left < margin) left = margin;
    if (top + ph > window.innerHeight - margin) top = Math.max(margin, focus.top - ph - margin);
    if (top < margin) top = margin;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  };

  const scheduleManualImportPopover = () => {
    if (manualImportPopoverRaf) cancelAnimationFrame(manualImportPopoverRaf);
    manualImportPopoverRaf = requestAnimationFrame(() => {
      manualImportPopoverRaf = 0;
      if (manualImportPointerSelecting && !getImportPopoverFollowDrag()) {
        hideManualImportPopover();
        return;
      }
      if (!importManualSurface || !importModal || importModal.classList.contains("hidden")) {
        hideManualImportPopover();
        return;
      }
      const raw = importPaste?.value ?? "";
      const off = getSurfaceSelectionSourceOffsets(importManualSurface);
      let bodyText = "";
      if (off && off.end > off.start) bodyText = raw.slice(off.start, off.end);
      else bodyText = (typeof window.getSelection === "function" ? window.getSelection()?.toString() : "") ?? "";
      if (!bodyText.trim()) {
        hideManualImportPopover();
        return;
      }
      if (importManualPopoverBody) {
        importManualPopoverBody.value =
          bodyText.length > 12000 ? `${bodyText.slice(0, 12000)}\n…` : bodyText;
      }
      if (importManualPopoverFilter) {
        importManualPopoverFilter.placeholder = tt("cv.importManualPopoverSearchPh", "Filtrar por nombre de campo…");
      }
      syncManualImportPopoverFromTarget();
      importManualPopover?.classList.remove("hidden");
      if (manualImportPointerSelecting && getImportPopoverFollowDrag()) {
        importManualPopover?.classList.add("pointer-events-none");
      } else {
        importManualPopover?.classList.remove("pointer-events-none");
      }
      updateManualImportPopoverPosition();
    });
  };

  const assignManualSelectionToTarget = (target: string) => {
    if (!target.trim()) return;
    const off = getSurfaceSelectionSourceOffsets(importManualSurface);
    if (!off || off.start === off.end) {
      showToast(tt("cv.importManualNoSelectToast", "Selecciona texto en la vista con colores antes de asignar."), "info");
      return;
    }
    const rawFull = importPaste?.value ?? "";
    const sourceSlice = rawFull.slice(off.start, off.end).replace(/\r\n/g, "\n");
    const bodyRaw = (importManualPopoverBody?.value ?? "").replace(/\r\n/g, "\n");
    const trimmed = bodyRaw.trim();
    if (!trimmed) {
      showToast(tt("cv.importManualEmptyBodyToast", "El texto a asignar no puede estar vacío."), "info");
      return;
    }
    const expLen = Array.isArray(cvProfile.experiences) ? cvProfile.experiences.length : 0;
    const eduLen = Array.isArray(cvProfile.education) ? cvProfile.education.length : 0;
    const certLen = Array.isArray(cvProfile.certifications) ? cvProfile.certifications.length : 0;
    const langLen = Array.isArray(cvProfile.languages) ? cvProfile.languages.length : 0;
    let t = target.trim();
    t = bumpManualImportTargetIfOccupied(t, manualImportAssignments, { expLen, eduLen, certLen, langLen });
    if (!manualAssignmentTargetIsMultiline(t)) {
      manualImportAssignments = manualImportAssignments.filter((x) => x.target !== t);
    }
    const valueOverride = trimmed !== sourceSlice.trim() ? trimmed : undefined;
    manualImportAssignments.push({
      start: off.start,
      end: off.end,
      target: t,
      ...(valueOverride !== undefined ? { valueOverride } : {}),
    });
    importManualTextSnapshot = importPaste?.value ?? "";
    refreshManualImportUi();
    hideManualImportPopover();
  };

  const runManualImportAutosuggest = (showInfoToast: boolean) => {
    const ta = importPaste;
    if (!ta) return;
    const v = ta.value;
    if (!v.trim()) {
      if (showInfoToast) showToast(tt("cv.importEmptyToast", "Pega texto antes de importar."), "info");
      return;
    }
    const sug = suggestManualAssignmentsFromPaste(v);
    manualImportAssignments = mergeSuggestedAssignments(v, manualImportAssignments, sug);
    importManualTextSnapshot = v;
    refreshManualImportUi();
    if (showInfoToast) {
      showToast(
        tt("cv.importManualSuggestMergedToast", "Sugerencias añadidas sin pisar lo que ya mapeaste."),
        "success",
      );
    }
  };

  const resetManualImportState = () => {
    manualImportAssignments = [];
    importManualTextSnapshot = importPaste?.value ?? "";
    hideManualImportPopover();
    refreshManualImportUi();
  };

  const prepareCvImportModalManual = () => {
    rebuildManualImportTargetSelect();
    renderManualImportPopoverShortcuts();
    const raw = (importPaste?.value ?? "").trim();
    if (raw && manualImportAssignments.length === 0) {
      const sug = suggestManualAssignmentsFromPaste(importPaste!.value);
      if (sug.length > 0) {
        manualImportAssignments = mergeSuggestedAssignments(importPaste!.value, [], sug);
        importManualTextSnapshot = importPaste!.value;
        showToast(
          tt("cv.importManualSuggestAutoToast", "Autodetección aplicada; revisa los colores y ajusta."),
          "info",
        );
      }
    }
    refreshManualImportUi();
  };

  const applyProfileToInputs = () => {
    if (fullNameInput) fullNameInput.value = displayName;
    if (publicBioInput) publicBioInput.value = bio;
    if (headlineInput) headlineInput.value = (cvProfile.headline ?? "").toString();
    if (locationInput) locationInput.value = (cvProfile.location ?? "").toString();
    if (emailInput) emailInput.value = (cvProfile.email ?? "").toString();
    if (phoneMobileInput) phoneMobileInput.value = (cvProfile.phoneMobile ?? "").toString();
    if (phoneLandlineInput) phoneLandlineInput.value = (cvProfile.phoneLandline ?? "").toString();
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
    const tpl = normalizeCvTemplateId(cvProfile.cvTemplate);
    if (templateSelect) templateSelect.value = tpl;
    if (previewTemplateSelect) previewTemplateSelect.value = tpl;
    if (printMaxPagesSelect) printMaxPagesSelect.value = String(clampCvPrintMaxPages(cvProfile.cvPrintMaxPages));
    if (cvDateExpSel) cvDateExpSel.value = cvProfile.cvDateDisplayExperience === "year" ? "year" : "full";
    if (cvDateEduSel) cvDateEduSel.value = cvProfile.cvDateDisplayEducation === "year" ? "year" : "full";
    if (cvShowExpLocCb) cvShowExpLocCb.checked = cvProfile.cvShowExperienceLocation !== false;
    if (cvShowEduLocCb) cvShowEduLocCb.checked = cvProfile.cvShowEducationLocation !== false;
    if (cvShowEduDetailsCb) cvShowEduDetailsCb.checked = cvProfile.cvShowEducationDetails !== false;
    if (cvShowProjDescCb) cvShowProjDescCb.checked = cvProfile.cvShowProjectDescriptions !== false;
    if (cvShowContactLocCb) cvShowContactLocCb.checked = cvProfile.cvShowContactLocation !== false;
    settingsModal?.querySelectorAll<HTMLInputElement>("input[data-cv-sec-show]").forEach((cb) => {
      const k = cb.dataset.cvSecShow ?? "";
      if (!k) return;
      const vis = cvProfile.cvSectionVisibility ?? {};
      cb.checked = (vis as Record<string, boolean>)[k] !== false;
    });
  };

  const downloadCvJsonFile = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      cvDocuments: JSON.parse(JSON.stringify(cvDocuments)) as CvDocumentSlotV1[],
      cvActiveDocumentId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skillatlas-cv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(tt("cv.backupDownloadedToast", "Respaldo descargado."), "success");
  };

  let pendingImportMode: "apply" | "both" | "exp" | "edu" | "manual" | null = null;

  const hideImportConfirmModal = () => {
    if (!importConfirmModal) return;
    importConfirmModal.classList.add("hidden");
    importConfirmModal.classList.remove("flex");
    const previewOpen = previewModal && !previewModal.classList.contains("hidden");
    const importOpen = importModal && !importModal.classList.contains("hidden");
    if (!previewOpen && !importOpen) document.body.style.overflow = "";
  };

  const openImportConfirmModal = (mode: "apply" | "both" | "exp" | "edu" | "manual") => {
    pendingImportMode = mode;
    importConfirmModal?.classList.remove("hidden");
    importConfirmModal?.classList.add("flex");
    document.body.style.overflow = "hidden";
  };

  const openCvImportModal = () => {
    if (!importModal) return;
    manualImportPointerSelecting = false;
    suppressCvImportModalBackdropClose = false;
    importModal.classList.remove("hidden");
    importModal.classList.add("flex");
    if (previewModal?.classList.contains("hidden")) document.body.style.overflow = "hidden";
    if (importManualPopoverFollowDragCb) {
      importManualPopoverFollowDragCb.checked =
        typeof localStorage !== "undefined" && localStorage.getItem(CV_IMPORT_POPOVER_FOLLOW_DRAG_LS) === "1";
    }
    resetManualImportState();
    prepareCvImportModalManual();
    queueMicrotask(() => importManualSurface?.focus());
  };

  const closeCvImportModal = () => {
    if (!importModal) return;
    manualImportPointerSelecting = false;
    suppressCvImportModalBackdropClose = false;
    hideManualImportPopover();
    importModal.classList.add("hidden");
    importModal.classList.remove("flex");
    pendingImportMode = null;
    hideImportConfirmModal();
    const previewOpen = previewModal && !previewModal.classList.contains("hidden");
    if (!previewOpen) document.body.style.overflow = "";
  };

  const importParseFailedMessage = () =>
    `${tt("cv.importParseFailedToast", "No se detectaron bloques válidos.")} ${tt(
      "cv.importParseFailedHints",
      "Separa cada puesto o titulación con una línea en blanco; incluye cabeceras «Experiencia» / «Educación» si puedes. Si el PDF viene de escaneo, copia el texto desde el visor o prueba «Solo experiencia» / «Solo educación».",
    )}`;

  const resolveCvImportSources = (normalized: string, split: ReturnType<typeof splitCvPasteBySections>) => {
    const expText = split.sawExperienceHeader ? (split.experience.trim() || normalized) : normalized;
    const eduText = split.sawEducationHeader ? (split.education.trim() || normalized) : normalized;
    const filterExpNoise = !split.sawExperienceHeader || !split.experience.trim();
    return { expText, eduText, filterExpNoise };
  };

  const executeCvManualImportAfterConfirm = () => {
    const raw = importPaste?.value?.trim() ?? "";
    if (!raw) {
      showToast(tt("cv.importEmptyToast", "Pega texto antes de importar."), "info");
      return;
    }
    if (manualImportAssignments.length === 0) {
      showToast(
        tt("cv.importManualNoAssignmentsToast", "Marca al menos un fragmento y asígnalo a un campo."),
        "info",
      );
      return;
    }
    const r = applyCvManualImport(raw, manualImportAssignments, cvProfile, {
      displayNameLower: displayName.trim().toLowerCase(),
    });
    let nextProf = r.profile;
    if (r.summaryPendingReplace) {
      if (
        window.confirm(
          tt(
            "cv.importReplaceSummaryConfirm",
            "¿Sustituir el resumen del CV por el texto detectado en el documento importado?",
          ),
        )
      ) {
        nextProf = { ...nextProf, summary: r.summaryPendingReplace };
      }
    }
    cvProfile = nextProf;
    if (r.errors.length > 0) {
      showToast(
        tt("cv.importManualPartialErrorsToast", "Algunas asignaciones tenían un índice inválido y se omitieron."),
        "warning",
      );
    }
    persistCvState();
    applyProfileToInputs();
    renderExperienceEditor();
    renderEducationEditor();
    renderCertificationEditor();
    renderLanguageEditor();
    renderCoverLettersEditor();
    renderDocument();
    const filled = r.filled.length > 0 ? ` (${r.filled.join(", ")})` : "";
    showToast(tt("cv.importManualToast", "Mapeo manual aplicado.") + filled, "success");
    closeCvImportModal();
    resetManualImportState();
  };

  const runCvImportMode = (mode: "apply" | "both" | "exp" | "edu") => {
    const raw = importPaste?.value?.trim() ?? "";
    if (!raw) {
      showToast(tt("cv.importEmptyToast", "Pega texto antes de importar."), "info");
      return;
    }
    const norm = normalizeCvPasteForHeuristics(preprocessCvPasteForImport(raw));
    const sectionSplit = mergeLanguagesSplitFromCertificationsSection(splitCvPasteBySections(norm));
    let expAdded = 0;
    let eduAdded = 0;
    let dupSkipped = 0;
    const hintLabels: string[] = [];

    if (mode === "exp") {
      const { expText, filterExpNoise } = resolveCvImportSources(norm, sectionSplit);
      let rows = parseExperienceBlocksFromPaste(expText);
      if (filterExpNoise) rows = filterFalsePositiveExperienceRows(rows);
      if (rows.length === 0) {
        showToast(importParseFailedMessage(), "error");
        return;
      }
      const exp = [...(Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [])];
      let added = 0;
      for (const r of rows) {
        if (isDuplicateExperience(exp, r)) {
          dupSkipped++;
          continue;
        }
        exp.push({ ...r });
        added++;
      }
      if (added === 0) {
        showToast(tt("cv.importAllDuplicatesToast", "Nada nuevo: esas entradas ya estaban en experiencia."), "info");
        return;
      }
      cvProfile = { ...cvProfile, experiences: exp };
      expAdded = added;
    } else if (mode === "edu") {
      const { eduText } = resolveCvImportSources(norm, sectionSplit);
      const rows = parseEducationBlocksFromPaste(eduText);
      if (rows.length === 0) {
        showToast(importParseFailedMessage(), "error");
        return;
      }
      const edu = [...(Array.isArray(cvProfile.education) ? cvProfile.education : [])];
      let added = 0;
      for (const r of rows) {
        if (isDuplicateEducation(edu, r)) {
          dupSkipped++;
          continue;
        }
        edu.push({ ...r });
        added++;
      }
      if (added === 0) {
        showToast(tt("cv.importAllDuplicatesToast", "Nada nuevo: esas entradas ya estaban en educación."), "info");
        return;
      }
      cvProfile = { ...cvProfile, education: edu };
      eduAdded = added;
    } else {
      const { expText, eduText, filterExpNoise } = resolveCvImportSources(norm, sectionSplit);
      let expRows = parseExperienceBlocksFromPaste(expText);
      if (filterExpNoise) expRows = filterFalsePositiveExperienceRows(expRows);
      const eduRows = parseEducationBlocksFromPaste(eduText);
      const exp = [...(Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [])];
      const edu = [...(Array.isArray(cvProfile.education) ? cvProfile.education : [])];
      for (const r of expRows) {
        if (isDuplicateExperience(exp, r)) {
          dupSkipped++;
          continue;
        }
        exp.push({ ...r });
        expAdded++;
      }
      for (const r of eduRows) {
        if (isDuplicateEducation(edu, r)) {
          dupSkipped++;
          continue;
        }
        edu.push({ ...r });
        eduAdded++;
      }
      cvProfile = { ...cvProfile, experiences: exp, education: edu };

      if (mode === "apply" || mode === "both") {
        const urlSlots = extractUrlsForCvSlots(raw);
        const curSlots = getCvLinkSlots();
        const nextSlots = [...curSlots];
        let linksFilled = 0;
        for (let i = 0; i < CV_LINK_SLOT_COUNT; i++) {
          if (!nextSlots[i]?.trim() && urlSlots[i]?.trim()) {
            nextSlots[i] = urlSlots[i]!.trim();
            linksFilled++;
          }
        }
        if (linksFilled > 0) {
          cvProfile = { ...cvProfile, cvLinkSlots: nextSlots };
          hintLabels.push(tt("cv.importHintLinks", "Enlaces"));
        }

        if (sectionSplit.sawCertificationsHeader && sectionSplit.certifications.trim()) {
          const certs = parseCertificationsFromPaste(sectionSplit.certifications.trim());
          if (certs.length > 0) {
            const arr = [...(Array.isArray(cvProfile.certifications) ? cvProfile.certifications : [])];
            const n0 = arr.length;
            for (const c of certs) {
              if (isDuplicateCert(arr, c)) {
                dupSkipped++;
                continue;
              }
              arr.push({ ...c });
            }
            if (arr.length > n0) {
              cvProfile = { ...cvProfile, certifications: arr };
              hintLabels.push(tt("cv.importHintCerts", "Certificaciones"));
            }
          }
        }

        if (sectionSplit.sawLanguagesHeader && sectionSplit.languages.trim()) {
          const langs = parseLanguagesFromPaste(sectionSplit.languages.trim());
          if (langs.length > 0) {
            const arr = [...(Array.isArray(cvProfile.languages) ? cvProfile.languages : [])];
            const n0 = arr.length;
            for (const l of langs) {
              if (isDuplicateLang(arr, l)) {
                dupSkipped++;
                continue;
              }
              arr.push({ ...l });
            }
            if (arr.length > n0) {
              cvProfile = { ...cvProfile, languages: arr };
              hintLabels.push(tt("cv.importHintLanguages", "Idiomas"));
            }
          }
        }
      }

      if (mode === "apply") {
        const hints = extractLooseCvHeaderFields(norm);
        if (hints.email && !(cvProfile.email ?? "").trim()) {
          cvProfile = { ...cvProfile, email: hints.email };
          hintLabels.push(tt("cv.importHintEmail", "Email"));
        }
        if (hints.headline && !(cvProfile.headline ?? "").trim()) {
          const hn = hints.headline.trim().toLowerCase();
          const dn = displayName.trim().toLowerCase();
          if (hn !== dn) {
            cvProfile = { ...cvProfile, headline: hints.headline };
            hintLabels.push(tt("cv.importHintHeadline", "Titular"));
          }
        }
        if (hints.summary) {
          const curSum = (cvProfile.summary ?? "").trim();
          const nextSum = hints.summary.trim();
          const dn = displayName.trim().toLowerCase();
          if (nextSum.toLowerCase() !== dn) {
            if (!curSum) {
              cvProfile = { ...cvProfile, summary: hints.summary };
              hintLabels.push(tt("cv.importHintSummary", "Resumen"));
            } else if (
              window.confirm(
                tt(
                  "cv.importReplaceSummaryConfirm",
                  "¿Sustituir el resumen del CV por el texto detectado en el documento importado?",
                ),
              )
            ) {
              cvProfile = { ...cvProfile, summary: hints.summary };
              hintLabels.push(tt("cv.importHintSummary", "Resumen"));
            }
          }
        }
        if (hints.phoneMobile && !(cvProfile.phoneMobile ?? "").trim()) {
          cvProfile = { ...cvProfile, phoneMobile: hints.phoneMobile };
          hintLabels.push(tt("cv.importHintPhone", "Teléfono"));
        }
      }

      if (mode === "both") {
        if (expRows.length === 0 && eduRows.length === 0) {
          showToast(importParseFailedMessage(), "error");
          return;
        }
        if (expAdded === 0 && eduAdded === 0) {
          showToast(
            dupSkipped > 0
              ? tt("cv.importAllDuplicatesToast", "Nada nuevo: esas entradas ya estaban en el formulario.")
              : importParseFailedMessage(),
            dupSkipped > 0 ? "info" : "error",
          );
          return;
        }
      }

      if (mode === "apply") {
        if (expAdded === 0 && eduAdded === 0 && hintLabels.length === 0) {
          if (dupSkipped > 0) {
            showToast(tt("cv.importAllDuplicatesToast", "Nada nuevo que fusionar con lo detectado en el texto."), "info");
            return;
          }
          showToast(importParseFailedMessage(), "error");
          return;
        }
      }
    }

    const dupSuffixFinal =
      dupSkipped > 0
        ? " " + tt("cv.importDedupeSuffix", "({{n}} entradas ya existían y no se duplicaron).").replace("{{n}}", String(dupSkipped))
        : "";

    persistCvState();
    applyProfileToInputs();
    renderExperienceEditor();
    renderEducationEditor();
    renderCertificationEditor();
    renderLanguageEditor();
    renderCoverLettersEditor();
    renderDocument();

    if (mode === "exp") {
      showToast(tt("cv.importToastExperience", "Bloques añadidos a experiencia.") + dupSuffixFinal, "success");
    } else if (mode === "edu") {
      showToast(tt("cv.importToastEducation", "Bloques añadidos a educación.") + dupSuffixFinal, "success");
    } else if (mode === "both") {
      showToast(
        tt("cv.importBothToast", "Añadidos {{exp}} bloque(s) de experiencia y {{edu}} de educación.")
          .replace("{{exp}}", String(expAdded))
          .replace("{{edu}}", String(eduAdded)) + dupSuffixFinal,
        "success",
      );
    } else {
      const base = tt("cv.importApplyToast", "Importación aplicada: {{exp}} experiencia, {{edu}} educación.")
        .replace("{{exp}}", String(expAdded))
        .replace("{{edu}}", String(eduAdded));
      const extra =
        hintLabels.length > 0
          ? " " + tt("cv.importApplyHintsExtra", "Campos vacíos rellenados: {{list}}.").replace("{{list}}", hintLabels.join(", "))
          : "";
      showToast(base + extra + dupSuffixFinal, "success");
    }
    closeCvImportModal();
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

  const CV_COVER_LETTERS_MAX = 10;
  const newCoverLetterId = () => `cl_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`;

  const renderCoverLettersEditor = () => {
    if (!cvCoverList) return;
    const letters = Array.isArray(cvProfile.coverLetters) ? cvProfile.coverLetters : [];
    if (letters.length === 0) {
      cvCoverList.innerHTML = `<p class="m-0 text-sm text-gray-500 dark:text-gray-400">${esc(
        tt("cv.coverEmptyHint", "Añade cartas breves (p. ej. menos de 200 palabras) orientadas a distintos tipos de oferta."),
      )}</p>`;
      return;
    }
    cvCoverList.innerHTML = letters
      .map((c, idx) => {
        const id = esc((c.id ?? "").toString());
        const title = esc((c.title ?? "").toString());
        const body = esc((c.body ?? "").toString());
        const wc = (c.body ?? "").trim().split(/\s+/).filter(Boolean).length;
        return `<div class="rounded-xl border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 p-4 space-y-3" data-cv-cover-row="${idx}">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">${esc(tt("cv.coverLetterN", "Carta {{n}}").replace("{{n}}", String(idx + 1)))}</p>
            <button type="button" class="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline" data-cv-cover-del="${idx}">${esc(tt("cv.remove", "Quitar"))}</button>
          </div>
          <input type="hidden" data-cv-cover-field="id" data-idx="${idx}" value="${id}" />
          <label class="space-y-1">
            <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.coverTitle", "Título / tipo de oferta"))}</span>
            <input class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm" data-cv-cover-field="title" data-idx="${idx}" value="${title}" placeholder="${esc(tt("cv.coverTitlePh", "LinkedIn · startup · consultora"))}" />
          </label>
          <label class="space-y-1">
            <span class="text-[11px] text-gray-600 dark:text-gray-400">${esc(tt("cv.coverBody", "Texto"))}</span>
            <textarea rows="8" class="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-mono/90" data-cv-cover-field="body" data-idx="${idx}">${body}</textarea>
            <p class="m-0 text-[10px] text-gray-400" data-cv-cover-wc="${idx}">${wc} ${esc(tt("cv.coverWords", "palabras"))}</p>
          </label>
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

  const renderDocument = () => {
    docName.textContent = displayName;
    const headline = (cvProfile.headline ?? "").trim();
    const location = (cvProfile.location ?? "").trim();
    const email = normalizeEmail((cvProfile.email ?? "").trim());
    const phoneMobile = (cvProfile.phoneMobile ?? "").trim();
    const phoneLandline = (cvProfile.phoneLandline ?? "").trim();
    const summary = (cvProfile.summary ?? "").trim();
    const showHelp = cvProfile.showHelpStack ?? true;
    const vis = cvProfile.cvSectionVisibility ?? {};
    const showBlock = (key: string) => (vis as Record<string, boolean>)[key] !== false;

    if (docEl) {
      docEl.classList.remove(...CV_TEMPLATE_BODY_CLASSES);
      const tpl = normalizeCvTemplateId(cvProfile.cvTemplate);
      docEl.classList.add(`cv-template-${tpl}`);
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
      const showLoc = cvProfile.cvShowContactLocation !== false;
      if (location && showLoc) chips.push(`<span class="inline-flex items-center gap-1"><span class="text-gray-400">📍</span> ${esc(location)}</span>`);
      if (email && isProbablyEmail(email)) {
        chips.push(`<a class="no-underline hover:underline" href="mailto:${esc(email)}">${esc(email)}</a>`);
      }
      if (phoneMobile) {
        chips.push(`<a class="no-underline hover:underline" href="${esc(cvTelHref(phoneMobile))}">${esc(phoneMobile)}</a>`);
      }
      if (phoneLandline) {
        chips.push(`<a class="no-underline hover:underline" href="${esc(cvTelHref(phoneLandline))}">${esc(phoneLandline)}</a>`);
      }
      const slots = getCvLinkSlots();
      const mode = (cvProfile.socialLinkDisplay ?? "both") as CvSocialLinkDisplay;
      chips.push(...buildCvSocialChipsHtml({ slots, slotLabels: slotLabels(), display: mode, esc }));
      docContact.innerHTML = chips.length > 0 ? chips.join(`<span class="text-gray-300 dark:text-gray-700">•</span>`) : "";
      docContact.classList.toggle("hidden", chips.length === 0);
    }

    const finalSummary = summary || bio || tt("cv.noBio", "");
    docBio.textContent = finalSummary;
    const showSummary = showBlock("summary");
    docBio.classList.toggle("hidden", !finalSummary || !showSummary);

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
    const featSlug = (cvProfile.cvFeaturedProjectSlug ?? "").trim();
    const featured = featSlug ? chosen.find((p) => p.slug === featSlug) : undefined;
    const others = featured ? chosen.filter((p) => p.slug !== featSlug) : chosen;

    const projectFullHtml = (p: ProjectRow) => {
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
      const descOn = cvProfile.cvShowProjectDescriptions !== false;
      const descHtml =
        descOn && (p.description ?? "").trim()
          ? `<p class="m-0 mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">${esc((p.description ?? "").trim())}</p>`
          : "";
      return `<section class="cv-doc-project">
            <h4 class="m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">${esc(p.title)}</h4>
            ${meta}
            ${descHtml}
            ${techHtml}
          </section>`;
    };

    const projectCompactLi = (p: ProjectRow) => {
      const role = (p.role ?? "").trim();
      const one = role ? ` — ${esc(role)}` : "";
      return `<li class="text-sm text-gray-800 dark:text-gray-200"><span class="font-semibold">${esc(p.title)}</span>${one}</li>`;
    };

    if (docProjectsSection) {
      docProjectsSection.classList.toggle("hidden", chosen.length === 0 || !showBlock("projects"));
    }
    if (chosen.length === 0) {
      docProjects.innerHTML = `<p class="m-0 text-sm text-gray-500 dark:text-gray-400">${esc(tt("cv.noProjectsSelected", "No hay proyectos seleccionados."))}</p>`;
    } else if (featured) {
      const restUl =
        others.length > 0
          ? `<p class="m-0 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">${esc(
              tt("cv.projectsMoreLabel", "También"),
            )}</p><ul class="m-0 mt-1 space-y-0.5 pl-5 list-disc text-gray-700 dark:text-gray-300">${others.map(projectCompactLi).join("")}</ul>`
          : "";
      docProjects.innerHTML = `${projectFullHtml(featured)}${restUl}`;
    } else {
      docProjects.innerHTML = `<ul class="m-0 space-y-0.5 pl-5 list-disc text-gray-700 dark:text-gray-300">${chosen.map(projectCompactLi).join("")}</ul>`;
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
      const expDateMode = cvProfile.cvDateDisplayExperience === "year" ? "year" : "full";
      const expShowLoc = cvProfile.cvShowExperienceLocation !== false;
      docExperience.innerHTML = show
        ? exp
            .map((x) => {
              const company = (x.company ?? "").trim();
              const role = (x.role ?? "").trim();
              const loc = (x.location ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const when = formatCvDateRange(start, end, expDateMode);
              const bullets = linesToBullets(x.bullets ?? "");
              const bulletsHtml =
                bullets.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">${bullets
                      .map((b) => `<li>${esc(b)}</li>`)
                      .join("")}</ul>`
                  : "";
              const subParts = [company];
              if (expShowLoc && loc) subParts.push(loc);
              const subLine = subParts.filter(Boolean).join(" · ");
              return `<section class="cv-doc-project">
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">${esc(role || company || tt("cv.untitled", "—"))}</p>
                    <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${esc(subLine)}</p>
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
      const eduDateMode = cvProfile.cvDateDisplayEducation === "year" ? "year" : "full";
      const eduShowLoc = cvProfile.cvShowEducationLocation !== false;
      const eduShowDetails = cvProfile.cvShowEducationDetails !== false;
      docEducation.innerHTML = show
        ? edu
            .map((x) => {
              const school = (x.school ?? "").trim();
              const degree = (x.degree ?? "").trim();
              const loc = (x.location ?? "").trim();
              const start = (x.start ?? "").trim();
              const end = (x.end ?? "").trim();
              const when = formatCvDateRange(start, end, eduDateMode);
              const details = linesToBullets(x.details ?? "");
              const detailsHtml =
                eduShowDetails && details.length > 0
                  ? `<ul class="mt-2 space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">${details
                      .map((b) => `<li>${esc(b)}</li>`)
                      .join("")}</ul>`
                  : "";
              const subParts = [school];
              if (eduShowLoc && loc) subParts.push(loc);
              const subLine = subParts.filter(Boolean).join(" · ");
              return `<section class="cv-doc-project">
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div class="min-w-0">
                    <p class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">${esc(degree || school || tt("cv.untitled", "—"))}</p>
                    <p class="m-0 text-sm text-gray-600 dark:text-gray-400">${esc(subLine)}</p>
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

    if (docCoverSection && docCoverLetters) {
      const letters = Array.isArray(cvProfile.coverLetters) ? cvProfile.coverLetters : [];
      const show = letters.length > 0 && showBlock("coverLetters");
      docCoverSection.classList.toggle("hidden", !show);
      docCoverLetters.innerHTML = show
        ? letters
            .map((c) => {
              const t0 = (c.title ?? "").trim() || tt("cv.coverUntitled", "Carta");
              const body = (c.body ?? "").trim();
              const wc = body ? body.split(/\s+/).filter(Boolean).length : 0;
              return `<section class="cv-doc-project">
                <h4 class="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">${esc(t0)}</h4>
                <p class="m-0 mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">${esc(body)}</p>
                <p class="m-0 mt-1 text-[10px] text-gray-400">${wc} ${esc(tt("cv.coverWords", "palabras"))}</p>
              </section>`;
            })
            .join("")
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
      coverLetters: tt("cv.docCoverHeading", "Cartas de presentación"),
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
      persistCvState();
      renderDocument();
      refreshPreviewSectionRail();
    });
  };

  const renderList = () => {
    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    displayOrder = buildCvDisplayOrder(displayOrder, defaultOrder);
    const visibleOrder = displayOrder.filter((slug) => bySlug.has(slug));
    let feat = (cvProfile.cvFeaturedProjectSlug ?? "").trim();
    if (feat && !selectedSlugs.has(feat)) {
      cvProfile = { ...cvProfile, cvFeaturedProjectSlug: undefined };
      feat = "";
      persistCvState();
    }

    const featLabel = tt("cv.featuredShort", "Destacado");
    listEl.innerHTML = visibleOrder
      .map((slug) => {
        const p = bySlug.get(slug);
        if (!p) return "";
        const on = selectedSlugs.has(p.slug);
        const isFeat = feat === p.slug;
        const radDis = on ? "" : "disabled";
        const radCheck = isFeat && on ? "checked" : "";
        return `<li data-cv-row="${esc(p.slug)}" draggable="true"
          class="flex items-center gap-2 rounded-md border border-gray-200/70 dark:border-gray-800/80 bg-white/50 dark:bg-gray-950/40 px-2 py-1.5">
          <button type="button" aria-label="Arrastrar" title="Arrastrar"
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/60 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-grab active:cursor-grabbing select-none text-xs"
            data-cv-drag="${esc(p.slug)}">⋮⋮</button>
          <input type="checkbox" class="rounded border-gray-300 dark:border-gray-600 shrink-0" data-cv-pick="${esc(p.slug)}" ${on ? "checked" : ""} />
          <div class="min-w-0 flex-1">
            <p class="m-0 text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug">${esc(p.title)}</p>
            <p class="m-0 text-[10px] text-gray-500 dark:text-gray-400 truncate">/${esc(p.slug)}</p>
          </div>
          <label class="shrink-0 flex items-center gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-200 ${on ? "" : "opacity-40 pointer-events-none"}">
            <input type="radio" name="cv-proj-featured" class="accent-amber-600" data-cv-featured-pick="${esc(p.slug)}" ${radCheck} ${radDis} />
            <span>${esc(featLabel)}</span>
          </label>
        </li>`;
      })
      .join("");

    listEl.querySelectorAll<HTMLInputElement>("input[data-cv-pick]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const slug = inp.dataset.cvPick ?? "";
        if (!slug) return;
        if (inp.checked) selectedSlugs.add(slug);
        else {
          selectedSlugs.delete(slug);
          if ((cvProfile.cvFeaturedProjectSlug ?? "").trim() === slug) {
            cvProfile = { ...cvProfile, cvFeaturedProjectSlug: undefined };
            persistCvState();
          }
        }
        persistSelection();
        renderList();
        renderDocument();
      });
    });

    listEl.querySelectorAll<HTMLInputElement>("input[data-cv-featured-pick]").forEach((rad) => {
      rad.addEventListener("change", () => {
        if (!rad.checked) return;
        const slug = rad.dataset.cvFeaturedPick ?? "";
        if (!slug || !selectedSlugs.has(slug)) return;
        cvProfile = { ...cvProfile, cvFeaturedProjectSlug: slug };
        persistCvState();
        renderList();
        renderDocument();
      });
    });

    // Drag & drop reorder (lista completa del editor)
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
        const cur = [...displayOrder];
        const fromIdx = cur.indexOf(from);
        const toIdx = cur.indexOf(to);
        if (fromIdx < 0 || toIdx < 0) return;
        cur.splice(fromIdx, 1);
        cur.splice(toIdx, 0, from);
        displayOrder = cur;
        persistCvState();
        renderList();
        renderDocument();
      });
    });
    editorEl?.classList.remove("hidden");
  };

  const parseCvDocTags = (raw: string): string[] =>
    raw
      .split(/[,;]+/)
      .map((s) => s.trim().slice(0, 24))
      .filter(Boolean)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 8);

  function emptyCvProfileForNewDocument(): CvProfile {
    return {
      headline: "",
      location: "",
      email: "",
      phoneMobile: "",
      phoneLandline: "",
      summary: "",
      highlights: "",
      experiences: [],
      education: [],
      certifications: [],
      languages: [],
      coverLetters: [],
      cvDocumentSectionOrder: undefined,
      cvFeaturedProjectSlug: undefined,
      cvLinkSlots: Array.from({ length: CV_LINK_SLOT_COUNT }, () => ""),
      links: [],
      showHelpStack: true,
      showPhoto: true,
      socialLinkDisplay: "both",
      cvTemplate: "classic",
      cvSectionVisibility: {},
      cvPrintMaxPages: 3,
      photoSource: avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider",
    };
  }

  function renderCvDocumentSelect() {
    if (!docSelect) return;
    docSelect.replaceChildren();
    for (const d of cvDocuments) {
      const opt = document.createElement("option");
      opt.value = d.id;
      const tagPart = d.tags.length ? ` · ${d.tags.slice(0, 3).join(", ")}` : "";
      const mainPart = d.isMain ? ` ${tt("cv.docMainMark", "★")}` : "";
      opt.textContent = `${d.name}${mainPart}${tagPart}`;
      if (d.id === cvActiveDocumentId) opt.selected = true;
      docSelect.appendChild(opt);
    }
    const atCap = cvDocuments.length >= CV_DOCUMENTS_MAX;
    if (docNewBtn) docNewBtn.disabled = atCap;
    if (docDupBtn) docDupBtn.disabled = atCap;
    if (docSelect && cvDocuments.some((d) => d.id === cvActiveDocumentId)) {
      docSelect.value = cvActiveDocumentId;
    }
    (window as unknown as { __skillatlasCvRailRefresh?: () => void }).__skillatlasCvRailRefresh?.();
  }

  function fullCvRefreshAfterSwitch() {
    rebuildManualImportTargetSelect();
    applyProfileToInputs();
    renderExperienceEditor();
    renderEducationEditor();
    renderCertificationEditor();
    renderLanguageEditor();
    renderCoverLettersEditor();
    renderList();
    renderDocument();
  }

  function switchCvDocument(nextId: string) {
    if (!nextId || nextId === cvActiveDocumentId) return;
    persistCvState();
    cvActiveDocumentId = nextId;
    prefs = updatePrefs({ cvActiveDocumentId: nextId } as any);
    hydrateCvProfileFromActiveSlot();
    applySelectionFromPrefs();
    fullCvRefreshAfterSwitch();
    renderCvDocumentSelect();
  }

  function openCvDocNameDialog(mode: "new" | "dup") {
    if (cvDocuments.length >= CV_DOCUMENTS_MAX) {
      showToast(tt("cv.docLimitToast", "Máximo 5 CV."), "info");
      return;
    }
    if (!docNameDialog || !docNameInput || !docNameMode) return;
    docNameMode.value = mode;
    const active = activeCvSlot();
    docNameInput.value =
      mode === "dup"
        ? tt("cv.docDupNamePlaceholder", "Copia de {{name}}").replace("{{name}}", active.name)
        : tt("cv.docNewNamePlaceholder", "CV {{n}}").replace("{{n}}", String(cvDocuments.length + 1));
    docNameDialog.showModal();
    window.setTimeout(() => docNameInput.focus(), 50);
  }

  function closeCvDocNameDialog() {
    docNameDialog?.close();
  }

  function confirmCreateCvFromNameDialog() {
    const mode = docNameMode?.value === "dup" ? "dup" : "new";
    const name = (docNameInput?.value ?? "").trim().slice(0, 80);
    if (!name) {
      showToast(tt("cv.docNameRequired", "Escribe un nombre."), "info");
      return;
    }
    persistCvState();
    const base = activeCvSlot();
    let slot: CvDocumentSlotV1;
    if (mode === "dup") {
      slot = {
        id: newCvDocumentId(),
        name,
        tags: [...base.tags],
        isMain: false,
        cvProfile: JSON.parse(JSON.stringify(base.cvProfile)) as CvProfile,
        cvProjectSlugs: base.cvProjectSlugs ? [...base.cvProjectSlugs] : undefined,
        cvProjectDisplayOrder: base.cvProjectDisplayOrder ? [...base.cvProjectDisplayOrder] : undefined,
      };
    } else {
      slot = {
        id: newCvDocumentId(),
        name,
        tags: [],
        isMain: false,
        cvProfile: emptyCvProfileForNewDocument(),
        cvProjectSlugs: undefined,
        cvProjectDisplayOrder: undefined,
      };
    }
    cvDocuments = [...cvDocuments, slot];
    cvActiveDocumentId = slot.id;
    prefs = updatePrefs(buildCvDocumentsPrefsPatch(cvDocuments, cvActiveDocumentId) as any);
    hydrateCvProfileFromActiveSlot();
    applySelectionFromPrefs();
    closeCvDocNameDialog();
    fullCvRefreshAfterSwitch();
    renderCvDocumentSelect();
    showToast(tt("cv.docCreatedToast", "CV creado."), "success");
  }

  function openCvDocManageDialog() {
    const a = activeCvSlot();
    if (!docManageDialog || !docManageName || !docManageTags || !docManageMain) return;
    docManageName.value = a.name;
    docManageTags.value = a.tags.join(", ");
    docManageMain.checked = a.isMain;
    if (docManageDelete) docManageDelete.classList.toggle("hidden", cvDocuments.length <= 1);
    docManageDialog.showModal();
  }

  function closeCvDocManageDialog() {
    docManageDialog?.close();
  }

  function saveCvDocManageDialog() {
    const idx = cvDocuments.findIndex((d) => d.id === cvActiveDocumentId);
    if (idx < 0) return;
    const name = (docManageName?.value ?? "").trim().slice(0, 80);
    if (!name) {
      showToast(tt("cv.docNameRequired", "Escribe un nombre."), "info");
      return;
    }
    const tags = parseCvDocTags(docManageTags?.value ?? "");
    const wantMain = Boolean(docManageMain?.checked);
    let next = cvDocuments.map((d) => ({ ...d }));
    next[idx] = { ...next[idx]!, name, tags };
    if (wantMain) {
      next = next.map((d) => ({ ...d, isMain: d.id === cvActiveDocumentId }));
    } else {
      next[idx] = { ...next[idx]!, isMain: false };
      if (!next.some((d) => d.isMain)) {
        const j = next.findIndex((d) => d.id !== cvActiveDocumentId);
        const k = j >= 0 ? j : 0;
        next[k] = { ...next[k]!, isMain: true };
      }
    }
    cvDocuments = next;
    prefs = updatePrefs(buildCvDocumentsPrefsPatch(cvDocuments, cvActiveDocumentId) as any);
    closeCvDocManageDialog();
    renderCvDocumentSelect();
    showToast(tt("cv.docUpdatedToast", "Cambios guardados."), "success");
  }

  function deleteActiveCvDocument() {
    if (cvDocuments.length <= 1) {
      showToast(tt("cv.docDeleteOnly", "No puedes eliminar el único CV."), "info");
      return;
    }
    if (!window.confirm(tt("cv.docDeleteConfirm", "¿Eliminar este CV? No se puede deshacer."))) return;
    const id = cvActiveDocumentId;
    let next = cvDocuments.filter((d) => d.id !== id);
    if (!next.some((d) => d.isMain)) next[0] = { ...next[0]!, isMain: true };
    cvDocuments = next;
    cvActiveDocumentId = next[0]!.id;
    prefs = updatePrefs(buildCvDocumentsPrefsPatch(cvDocuments, cvActiveDocumentId) as any);
    hydrateCvProfileFromActiveSlot();
    applySelectionFromPrefs();
    closeCvDocManageDialog();
    fullCvRefreshAfterSwitch();
    renderCvDocumentSelect();
    showToast(tt("cv.docDeletedToast", "CV eliminado."), "success");
  }

  docSelect?.addEventListener("change", () => {
    const id = docSelect.value;
    if (id) switchCvDocument(id);
  });
  docNewBtn?.addEventListener("click", () => openCvDocNameDialog("new"));
  docDupBtn?.addEventListener("click", () => openCvDocNameDialog("dup"));
  docManageBtn?.addEventListener("click", () => openCvDocManageDialog());
  docNameCancel?.addEventListener("click", () => closeCvDocNameDialog());
  docNameSave?.addEventListener("click", () => confirmCreateCvFromNameDialog());
  docNameDialog?.addEventListener("cancel", () => closeCvDocNameDialog());
  docManageCancel?.addEventListener("click", () => closeCvDocManageDialog());
  docManageSave?.addEventListener("click", () => saveCvDocManageDialog());
  docManageDelete?.addEventListener("click", () => deleteActiveCvDocument());
  docManageDialog?.addEventListener("cancel", () => closeCvDocManageDialog());

  bindPreviewSectionRail();
  renderList();
  applyProfileToInputs();
  renderExperienceEditor();
  renderEducationEditor();
  renderCertificationEditor();
  renderLanguageEditor();
  renderCoverLettersEditor();
  renderDocument();
  renderCvDocumentSelect();

  bindCvScrollDocRail({
    getDocs: () => cvDocuments.map((d) => ({ id: d.id, name: d.name, isMain: Boolean(d.isMain) })),
    getActiveId: () => cvActiveDocumentId,
    onPick: (id) => switchCvDocument(id),
    docSelectAnchor: document.querySelector<HTMLElement>("[data-cv-doc-select-wrap]"),
  });

  bindCvSettingsModal({});

  bindCvBrowserTabs({
    onChange: (tab) => {
      if (tab === "cv") queueMicrotask(() => renderDocument());
    },
  });

  bindCvJobOffersKanban({
    tt,
    getOffers: () => cvJobOffers,
    setOffers: (n) => persistJobOffers(n),
  });

  const dockTipsCol = document.querySelector<HTMLElement>(".cv-dock-column--tips");
  const syncCvDockTipsVisibility = () => {
    dockTipsCol?.classList.toggle("hidden", !(loadPrefs().showFabCvTips ?? true));
  };
  syncCvDockTipsVisibility();
  document.querySelector<HTMLButtonElement>("[data-cv-dock-tips-open-fab]")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("skillatlas:open-fab-pane", { detail: { pane: "cvTips" }, bubbles: true }));
  });

  if (!(document as Document & { __cvPrefsJobOfferSync?: boolean }).__cvPrefsJobOfferSync) {
    (document as Document & { __cvPrefsJobOfferSync?: boolean }).__cvPrefsJobOfferSync = true;
    document.addEventListener("skillatlas:prefs-updated", () => {
      cvJobOffers = [...(loadPrefs().cvJobOffers ?? [])];
      (window as unknown as { __skillatlasCvJobOffersRefresh?: () => void }).__skillatlasCvJobOffersRefresh?.();
      syncCvDockTipsVisibility();
    });
  }

  const bindProfileInput = () => {
    let t: number | null = null;
    const schedule = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        persistCvState();
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
    phoneMobileInput?.addEventListener("input", () => {
      cvProfile = { ...cvProfile, phoneMobile: phoneMobileInput.value.trim() };
      schedule();
    });
    phoneLandlineInput?.addEventListener("input", () => {
      cvProfile = { ...cvProfile, phoneLandline: phoneLandlineInput.value.trim() };
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
      const next = normalizeCvTemplateId(String(templateSelect.value ?? ""));
      cvProfile.cvTemplate = next;
      if (previewTemplateSelect) previewTemplateSelect.value = next;
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

    cvDateExpSel?.addEventListener("change", () => {
      const v = cvDateExpSel.value === "year" ? "year" : "full";
      cvProfile = { ...cvProfile, cvDateDisplayExperience: v };
      schedule();
    });
    cvDateEduSel?.addEventListener("change", () => {
      const v = cvDateEduSel.value === "year" ? "year" : "full";
      cvProfile = { ...cvProfile, cvDateDisplayEducation: v };
      schedule();
    });
    cvShowExpLocCb?.addEventListener("change", () => {
      cvProfile = { ...cvProfile, cvShowExperienceLocation: Boolean(cvShowExpLocCb.checked) };
      schedule();
    });
    cvShowEduLocCb?.addEventListener("change", () => {
      cvProfile = { ...cvProfile, cvShowEducationLocation: Boolean(cvShowEduLocCb.checked) };
      schedule();
    });
    cvShowEduDetailsCb?.addEventListener("change", () => {
      cvProfile = { ...cvProfile, cvShowEducationDetails: Boolean(cvShowEduDetailsCb.checked) };
      schedule();
    });
    cvShowProjDescCb?.addEventListener("change", () => {
      cvProfile = { ...cvProfile, cvShowProjectDescriptions: Boolean(cvShowProjDescCb.checked) };
      schedule();
    });
    cvShowContactLocCb?.addEventListener("change", () => {
      cvProfile = { ...cvProfile, cvShowContactLocation: Boolean(cvShowContactLocCb.checked) };
      schedule();
    });

    cvCoverAddBtn?.addEventListener("click", () => {
      const cur = Array.isArray(cvProfile.coverLetters) ? [...cvProfile.coverLetters] : [];
      if (cur.length >= CV_COVER_LETTERS_MAX) {
        showToast(tt("cv.coverLimitToast", "Máximo 10 cartas."), "info");
        return;
      }
      cur.push({ id: newCoverLetterId(), title: "", body: "" });
      cvProfile = { ...cvProfile, coverLetters: cur };
      persistCvState();
      renderCoverLettersEditor();
      renderDocument();
    });

    cvCoverList?.addEventListener("input", (e) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      const field = (el as HTMLElement | null)?.dataset?.cvCoverField as string | undefined;
      const idx = Number((el as HTMLElement | null)?.dataset?.idx ?? "");
      if (!el || !field || !Number.isFinite(idx)) return;
      const letters = Array.isArray(cvProfile.coverLetters) ? [...cvProfile.coverLetters] : [];
      const row = { ...(letters[idx] ?? { id: newCoverLetterId(), title: "", body: "" }) } as Record<string, string>;
      row[field] = el.value;
      letters[idx] = row as any;
      cvProfile = { ...cvProfile, coverLetters: letters };
      if (field === "body") {
        const wcP = cvCoverList.querySelector(`[data-cv-cover-wc="${idx}"]`);
        if (wcP) {
          const wc = el.value.trim().split(/\s+/).filter(Boolean).length;
          wcP.textContent = `${wc} ${tt("cv.coverWords", "palabras")}`;
        }
      }
      schedule();
    });
    cvCoverList?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement | null)?.closest("[data-cv-cover-del]") as HTMLElement | null;
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-cv-cover-del") ?? "");
      if (!Number.isFinite(idx)) return;
      const letters = Array.isArray(cvProfile.coverLetters) ? [...cvProfile.coverLetters] : [];
      letters.splice(idx, 1);
      cvProfile = { ...cvProfile, coverLetters: letters };
      persistCvState();
      renderCoverLettersEditor();
      renderDocument();
    });

    settingsModal?.querySelectorAll<HTMLInputElement>("input[data-cv-sec-show]").forEach((cb) => {
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
      renderCoverLettersEditor();
      renderDocument();
    });
  };

  bindProfileInput();

  previewTemplateSelect?.addEventListener("change", () => {
    const v = normalizeCvTemplateId(String(previewTemplateSelect.value ?? ""));
    cvProfile = { ...cvProfile, cvTemplate: v };
    if (templateSelect) templateSelect.value = v;
    persistCvState();
    renderDocument();
    if (previewAtsPanel && !previewAtsPanel.classList.contains("hidden")) renderAtsCheckPanel();
  });

  importOpenBtn?.addEventListener("click", () => openCvImportModal());
  importModalClose?.addEventListener("click", () => closeCvImportModal());
  importModalPanel?.addEventListener(
    "pointerdown",
    () => {
      suppressCvImportModalBackdropClose = true;
    },
    true,
  );
  importManualPopover?.addEventListener(
    "pointerdown",
    () => {
      suppressCvImportModalBackdropClose = true;
    },
    true,
  );
  importModal?.addEventListener("pointerdown", (e) => {
    if (e.target === importModal) suppressCvImportModalBackdropClose = false;
  });
  importModal?.addEventListener("click", (e) => {
    if (e.target !== importModal) return;
    if (suppressCvImportModalBackdropClose) {
      suppressCvImportModalBackdropClose = false;
      return;
    }
    closeCvImportModal();
  });
  importModalPanel?.addEventListener("click", (e) => e.stopPropagation());

  const onImportPasteValueMaybeChanged = () => {
    if (manualImportAssignments.length === 0) {
      importManualTextSnapshot = importPaste?.value ?? "";
      return;
    }
    if ((importPaste?.value ?? "") !== importManualTextSnapshot) {
      manualImportAssignments = [];
      refreshManualImportUi();
      importManualTextSnapshot = importPaste?.value ?? "";
      showToast(
        tt("cv.importManualTextChangedToast", "El texto cambió; se borraron las asignaciones manuales."),
        "info",
      );
    }
  };
  importPaste?.addEventListener("input", onImportPasteValueMaybeChanged);
  importManualSurface?.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (!importPaste || !text) return;
    importPaste.value = (importPaste.value ? `${importPaste.value}\n\n` : "") + text;
    importPaste.dispatchEvent(new Event("input", { bubbles: true }));
    refreshManualImportUi();
    queueMicrotask(() => scheduleManualImportPopover());
  });
  importManualClear?.addEventListener("click", () => {
    manualImportAssignments = [];
    importManualTextSnapshot = importPaste?.value ?? "";
    hideManualImportPopover();
    refreshManualImportUi();
  });
  importManualSuggestBtn?.addEventListener("click", () => runManualImportAutosuggest(true));
  importManualPopoverFollowDragCb?.addEventListener("change", () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        CV_IMPORT_POPOVER_FOLLOW_DRAG_LS,
        importManualPopoverFollowDragCb.checked ? "1" : "0",
      );
    }
  });
  importManualPopoverFilter?.addEventListener("input", () => rebuildManualImportPopoverOptions());
  importManualPopoverShortcuts?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-cv-manual-assign-to]");
    const v = btn?.getAttribute("data-cv-manual-assign-to");
    if (!v) return;
    assignManualSelectionToTarget(v);
  });
  importManualPopoverOptions?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-cv-manual-assign-to]");
    const v = btn?.getAttribute("data-cv-manual-assign-to");
    if (!v) return;
    assignManualSelectionToTarget(v);
  });
  const finishManualImportSurfacePointerIfAny = () => {
    if (!manualImportPointerSelecting) return;
    manualImportPointerSelecting = false;
    importManualPopover?.classList.remove("pointer-events-none");
    if (importModal && !importModal.classList.contains("hidden")) {
      queueMicrotask(() => scheduleManualImportPopover());
    }
  };
  importManualSurface?.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (importModal?.classList.contains("hidden")) return;
    manualImportPointerSelecting = true;
    if (getImportPopoverFollowDrag()) {
      importManualPopover?.classList.add("pointer-events-none");
      queueMicrotask(() => scheduleManualImportPopover());
    } else {
      hideManualImportPopover();
    }
  });
  document.addEventListener("pointerup", (e) => {
    if (e.button !== 0) return;
    finishManualImportSurfacePointerIfAny();
  });
  document.addEventListener("pointercancel", () => {
    finishManualImportSurfacePointerIfAny();
  });
  importManualSurface?.addEventListener("keyup", () => scheduleManualImportPopover());
  importManualSurface?.addEventListener("scroll", () => updateManualImportPopoverPosition(), { passive: true });
  document.addEventListener("selectionchange", () => {
    if (manualImportPointerSelecting && !getImportPopoverFollowDrag()) return;
    if (!importModal || importModal.classList.contains("hidden")) return;
    if (!importManualSurface) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!importManualSurface.contains(r.commonAncestorContainer)) return;
    scheduleManualImportPopover();
  });
  importManualSurface?.addEventListener("blur", () => {
    window.setTimeout(() => {
      const ae = document.activeElement as Node | null;
      if (ae && importManualPopover?.contains(ae)) return;
      if (ae && importManualSurface?.contains(ae)) return;
      hideManualImportPopover();
    }, 220);
  });
  importModalPanel?.addEventListener("scroll", () => updateManualImportPopoverPosition(), { passive: true });
  window.addEventListener("resize", () => updateManualImportPopoverPosition());
  importModalPanel?.addEventListener(
    "mousedown",
    (ev) => {
      const t = ev.target as Node;
      if (importManualPopover?.contains(t) || importManualSurface?.contains(t)) return;
      hideManualImportPopover();
    },
    true,
  );
  importManualList?.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement | null;
    const btn = t?.closest<HTMLButtonElement>("[data-cv-import-manual-remove]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-cv-import-manual-remove"));
    if (Number.isFinite(idx) && idx >= 0 && idx < manualImportAssignments.length) {
      manualImportAssignments.splice(idx, 1);
      refreshManualImportUi();
    }
  });
  importManualApply?.addEventListener("click", () => openImportConfirmModal("manual"));

  importApplyFormBtn?.addEventListener("click", () => openImportConfirmModal("apply"));
  importBothBtn?.addEventListener("click", () => openImportConfirmModal("both"));
  importExpBtn?.addEventListener("click", () => openImportConfirmModal("exp"));
  importEduBtn?.addEventListener("click", () => openImportConfirmModal("edu"));

  importConfirmBackup?.addEventListener("click", () => downloadCvJsonFile());
  importConfirmCancel?.addEventListener("click", () => {
    pendingImportMode = null;
    hideImportConfirmModal();
  });
  importConfirmProceed?.addEventListener("click", () => {
    const m = pendingImportMode;
    pendingImportMode = null;
    hideImportConfirmModal();
    if (m === "manual") {
      executeCvManualImportAfterConfirm();
      return;
    }
    if (m) runCvImportMode(m);
  });
  importConfirmModal?.addEventListener("click", (e) => {
    if (e.target === importConfirmModal) {
      pendingImportMode = null;
      hideImportConfirmModal();
    }
  });
  importConfirmPanel?.addEventListener("click", (e) => e.stopPropagation());

  const ingestCvPdfFile = async (file: File) => {
    try {
      const { extractTextFromPdfFile } = await import("@lib/cv-pdf-text");
      const extracted = await extractTextFromPdfFile(file);
      const text = normalizeCvPasteForHeuristics(preprocessCvPasteForImport(extracted));
      if (!text.trim()) {
        showToast(tt("cv.importPdfEmptyText", "No se extrajo texto del PDF."), "warning");
        return;
      }
      if (importPaste) {
        importPaste.value = (importPaste.value ? `${importPaste.value}\n\n` : "") + text;
      }
      openCvImportModal();
      showToast(tt("cv.importPdfToast", "Texto extraído del PDF. Revisa el modal y pulsa «Importar al formulario»."), "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      showToast(msg || tt("cv.importPdfError", "No se pudo leer el PDF."), "error");
    }
  };

  importModalPdfOpen?.addEventListener("click", () => importModalPdfInput?.click());
  importModalPdfInput?.addEventListener("change", async () => {
    const file = importModalPdfInput.files?.[0];
    importModalPdfInput.value = "";
    if (!file) return;
    await ingestCvPdfFile(file);
  });

  headerJsonExportBtn?.addEventListener("click", () => downloadCvJsonFile());

  backupRestoreTrigger?.addEventListener("click", () => backupRestoreInput?.click());
  backupRestoreInput?.addEventListener("change", async () => {
    const file = backupRestoreInput.files?.[0];
    backupRestoreInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        version?: number;
        cvProfile?: CvProfile;
        cvDocuments?: CvDocumentSlotV1[];
        cvActiveDocumentId?: string;
      };
      if (!parsed || typeof parsed !== "object") {
        showToast(tt("cv.backupRestoreInvalid", "El archivo no es un respaldo válido."), "error");
        return;
      }
      if (parsed.version === 2 && Array.isArray(parsed.cvDocuments) && parsed.cvDocuments.length > 0) {
        const migrated = migrateCvDocumentsIntoPrefs({
          ...loadPrefs(),
          cvDocuments: parsed.cvDocuments as CvDocumentSlotV1[],
          cvActiveDocumentId:
            typeof parsed.cvActiveDocumentId === "string" ? parsed.cvActiveDocumentId : undefined,
        } as AppPrefsV1);
        cvDocuments = (migrated.cvDocuments ?? []).map((d) => ({
          ...d,
          cvProfile: JSON.parse(JSON.stringify(d.cvProfile)) as CvProfile,
        }));
        cvActiveDocumentId = migrated.cvActiveDocumentId ?? cvDocuments[0]!.id;
        prefs = updatePrefs(buildCvDocumentsPrefsPatch(cvDocuments, cvActiveDocumentId) as any);
        hydrateCvProfileFromActiveSlot();
        applySelectionFromPrefs();
      } else if (parsed.cvProfile && typeof parsed.cvProfile === "object") {
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
          ...parsed.cvProfile,
        };
        if (!cvProfile.photoSource) {
          cvProfile.photoSource = avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider";
        }
        const idx = cvDocuments.findIndex((d) => d.id === cvActiveDocumentId);
        if (idx >= 0) {
          const next = [...cvDocuments];
          next[idx] = { ...next[idx]!, cvProfile: JSON.parse(JSON.stringify(cvProfile)) as CvProfile };
          cvDocuments = next;
          prefs = updatePrefs(buildCvDocumentsPrefsPatch(cvDocuments, cvActiveDocumentId) as any);
        }
      } else {
        showToast(tt("cv.backupRestoreInvalid", "El archivo no es un respaldo válido."), "error");
        return;
      }
      applyProfileToInputs();
      renderExperienceEditor();
      renderEducationEditor();
      renderCertificationEditor();
      renderLanguageEditor();
      renderCoverLettersEditor();
      renderList();
      renderCvDocumentSelect();
      renderDocument();
      showToast(tt("cv.backupRestoredToast", "CV restaurado desde el archivo."), "success");
    } catch {
      showToast(tt("cv.backupRestoreError", "No se pudo leer el archivo."), "error");
    }
  });

  const closeCvClearModal = () => {
    if (!clearModal) return;
    clearModal.classList.add("hidden");
    clearModal.classList.remove("flex");
    const previewOpen = previewModal && !previewModal.classList.contains("hidden");
    const importOpen = importModal && !importModal.classList.contains("hidden");
    if (!previewOpen && !importOpen) document.body.style.overflow = "";
  };

  const openCvClearModal = () => {
    if (!clearModal) return;
    clearModal.classList.remove("hidden");
    clearModal.classList.add("flex");
    document.body.style.overflow = "hidden";
  };

  clearContentBtn?.addEventListener("click", () => openCvClearModal());

  clearModalCancel?.addEventListener("click", () => closeCvClearModal());
  clearModal?.addEventListener("click", (e) => {
    if (e.target === clearModal) closeCvClearModal();
  });
  clearModalPanel?.addEventListener("click", (e) => e.stopPropagation());

  clearModalConfirm?.addEventListener("click", () => {
    closeCvClearModal();
    cvProfile = {
      ...cvProfile,
      headline: "",
      location: "",
      email: "",
      phoneMobile: "",
      phoneLandline: "",
      summary: "",
      highlights: "",
      experiences: [],
      education: [],
      certifications: [],
      languages: [],
      coverLetters: [],
      cvDocumentSectionOrder: undefined,
      cvFeaturedProjectSlug: undefined,
      cvLinkSlots: Array.from({ length: CV_LINK_SLOT_COUNT }, () => ""),
      links: [],
      showHelpStack: true,
      showPhoto: true,
      socialLinkDisplay: "both",
      cvTemplate: "classic",
      cvSectionVisibility: {},
      cvPrintMaxPages: 3,
      photoSource: cvProfile.photoSource ?? (avatarSignedUrl ? "uploaded" : linkedinAvatar ? "linkedin" : "provider"),
    };
    persistCvState();
    applyProfileToInputs();
    renderExperienceEditor();
    renderEducationEditor();
    renderCertificationEditor();
    renderLanguageEditor();
    renderCoverLettersEditor();
    renderList();
    renderDocument();
    showToast(tt("cv.clearContentDoneToast", "Contenido del CV vaciado."), "success");
  });

  // Photo source toggles (CV-only; does not overwrite uploaded avatar)
  photoUseLinkedinBtn?.addEventListener("click", () => {
    if (!linkedinAvatar) return;
    cvProfile = { ...cvProfile, photoSource: "linkedin", showPhoto: true };
    persistCvState();
    applyProfileToInputs();
    renderDocument();
  });
  photoUseUploadedBtn?.addEventListener("click", () => {
    if (!avatarSignedUrl) return;
    cvProfile = { ...cvProfile, photoSource: "uploaded", showPhoto: true };
    persistCvState();
    applyProfileToInputs();
    renderDocument();
  });

  const renderAtsCheckPanel = () => {
    if (!previewTemplateSelect || !atsOkList || !atsWarnList || !atsInfoList) return;
    const tpl = normalizeCvTemplateId(String(previewTemplateSelect.value || "classic"));
    const result = analyzeCvForAts(cvProfile, tpl);
    const { score } = computeAtsHeuristicScore(result);
    if (atsScoreVal) atsScoreVal.textContent = String(score);
    if (atsScoreBar) {
      atsScoreBar.style.width = `${score}%`;
      atsScoreBar.parentElement?.setAttribute("aria-valuenow", String(score));
    }
    const fill = (ul: HTMLElement, keys: string[]) => {
      ul.innerHTML = "";
      if (keys.length === 0) {
        const li = document.createElement("li");
        li.className = "text-gray-500 dark:text-gray-400";
        li.textContent = tt("cv.ats.emptyColumn", "—");
        ul.appendChild(li);
        return;
      }
      for (const k of keys) {
        const li = document.createElement("li");
        li.className = "border-l-2 border-gray-200/90 pl-2 dark:border-gray-700";
        li.textContent = tt(k, k);
        ul.appendChild(li);
      }
    };
    fill(atsOkList, result.ok);
    fill(atsWarnList, result.warn);
    fill(atsInfoList, result.info);
  };

  // Preview modal (moves the document into a full-screen dialog)
  const openPreview = () => {
    if (!previewModal || !previewBody || !docEl) return;
    previewBody.innerHTML = "";
    previewBody.appendChild(docEl);
    const tpl = normalizeCvTemplateId(cvProfile.cvTemplate);
    if (previewTemplateSelect) {
      previewTemplateSelect.value = tpl;
      previewTemplateSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    previewAtsPanel?.classList.add("hidden");
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
  previewAtsBtn?.addEventListener("click", () => {
    renderAtsCheckPanel();
    previewAtsPanel?.classList.remove("hidden");
  });
  previewAtsHide?.addEventListener("click", () => previewAtsPanel?.classList.add("hidden"));
  previewModal?.addEventListener("click", (e) => {
    if (e.target === previewModal) closePreview();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (clearModal && !clearModal.classList.contains("hidden")) {
      closeCvClearModal();
      return;
    }
    if (importModal && !importModal.classList.contains("hidden")) {
      closeCvImportModal();
      return;
    }
    if (!previewModal || previewModal.classList.contains("hidden")) return;
    closePreview();
  });

  expAddBtn?.addEventListener("click", () => {
    const exp = Array.isArray(cvProfile.experiences) ? [...cvProfile.experiences] : [];
    exp.push({ role: "", company: "", location: "", start: "", end: "", bullets: "" });
    cvProfile = { ...cvProfile, experiences: exp };
    persistCvState();
    renderExperienceEditor();
    renderDocument();
  });
  eduAddBtn?.addEventListener("click", () => {
    const edu = Array.isArray(cvProfile.education) ? [...cvProfile.education] : [];
    edu.push({ degree: "", school: "", location: "", start: "", end: "", details: "" });
    cvProfile = { ...cvProfile, education: edu };
    persistCvState();
    renderEducationEditor();
    renderDocument();
  });

  certAddBtn?.addEventListener("click", () => {
    const certs = Array.isArray(cvProfile.certifications) ? [...cvProfile.certifications] : [];
    certs.push({ name: "", issuer: "", year: "", url: "" });
    cvProfile = { ...cvProfile, certifications: certs };
    persistCvState();
    renderCertificationEditor();
    renderDocument();
  });
  langAddBtn?.addEventListener("click", () => {
    const langs = Array.isArray(cvProfile.languages) ? [...cvProfile.languages] : [];
    langs.push({ name: "", level: "" });
    cvProfile = { ...cvProfile, languages: langs };
    persistCvState();
    renderLanguageEditor();
    renderCoverLettersEditor();
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
    cvProfile = { ...cvProfile, cvFeaturedProjectSlug: undefined };
    persistCvState();
    persistSelection();
    renderList();
    renderDocument();
  });

  selFeaturedOnly?.addEventListener("click", () => {
    const feat = (cvProfile.cvFeaturedProjectSlug ?? "").trim();
    if (!feat || !selectedSlugs.has(feat)) {
      showToast(
        tt("cv.featuredOnlyNeedFeatured", "Marca primero un proyecto como destacado."),
        "warning",
      );
      return;
    }
    selectedSlugs.clear();
    selectedSlugs.add(feat);
    persistSelection();
    renderList();
    renderDocument();
    showToast(tt("cv.featuredOnlyDoneToast", "Solo el proyecto destacado queda en el CV."), "success");
  });

  featuredNoneBtn?.addEventListener("click", () => {
    cvProfile = { ...cvProfile, cvFeaturedProjectSlug: undefined };
    persistCvState();
    renderList();
    renderDocument();
  });

  printBtn?.addEventListener("click", async () => {
    // Print in an isolated iframe to avoid blank pages caused by:
    // - `display:none` / overlays / view transitions
    // - transforms and complex fixed layouts
    // - timing issues in Chromium print preview
    try {
      document.body.classList.add("cv-print-mode");
      renderDocument();
      docEl?.classList.remove("hidden");
    } catch {
      // ignore
    }

    const sourceDoc = docEl?.cloneNode(true) as HTMLElement | null;
    if (!sourceDoc) {
      window.print();
      return;
    }
    sourceDoc.classList.remove("hidden");

    // Create hidden iframe
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    document.body.appendChild(frame);

    const headHtml = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => {
        if (n.tagName.toLowerCase() === "link") {
          const l = n as HTMLLinkElement;
          const href = l.href;
          if (!href) return "";
          return `<link rel="stylesheet" href="${href}">`;
        }
        return `<style>${(n as HTMLStyleElement).textContent ?? ""}</style>`;
      })
      .join("\n");

    // For printing: fill width of the printable area.
    // We intentionally avoid "fit-to-pages" scaling here; the user controls margins in print dialog.
    const scale = 1;

    const html = `<!doctype html>
<html lang="${document.documentElement.lang || "es"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    ${headHtml}
    <style>
      /* Force light mode for consistent print */
      html, body { background:#fff !important; color:#111827 !important; color-scheme: light !important; }
      body { margin: 0; }
      /* Ensure the document is printable even if hidden in the app */
      [data-cv-document]{ display:block !important; }
      @page { size: A4; margin: 14mm 14mm 16mm; }
      /* Make sure the document uses the full printable width. */
      [data-cv-document], [data-public-cv-doc]{
        transform: none !important;
        width: 100% !important;
        max-width: none !important;
      }
      /* Avoid accidental horizontal scroll/clipping in the print engine. */
      html, body { overflow: visible !important; }
      /* Print in this iframe should look like the preview card (centered, full width). */
      .cv-print-wrap{
        box-sizing: border-box;
        width: 100%;
      }
      .cv-print-wrap [data-cv-document]{
        margin: 0 auto !important;
      }
      /* Prevent any global "cv-print-mode" hacks from leaking via imported CSS. */
      @media print{
        body *{ visibility: visible !important; }
        [data-cv-document], [data-public-cv-doc]{ position: static !important; left: auto !important; top: auto !important; }
      }
    </style>
  </head>
  <body>
    <div class="cv-print-wrap" style="--cv-print-scale:${String(scale)}">
      ${sourceDoc.outerHTML}
    </div>
  </body>
</html>`;

    const w = frame.contentWindow;
    const d = frame.contentDocument;
    if (!w || !d) {
      frame.remove();
      window.print();
      return;
    }

    d.open();
    d.write(html);
    d.close();

    const cleanup = () => {
      try {
        frame.remove();
      } catch {
        // ignore
      }
    };

    await new Promise<void>((resolve) => {
      // Wait for iframe resources to load (best-effort)
      const done = () => resolve();
      frame.onload = done;
      // Fallback timeout (avoid getting stuck)
      window.setTimeout(done, 800);
    });

    try {
      // A couple frames for layout
      await new Promise<void>((r) => w.requestAnimationFrame(() => r()));
      await new Promise<void>((r) => w.requestAnimationFrame(() => r()));
    } catch {
      // ignore
    }

    try {
      w.focus();
      w.print();
    } finally {
      // Cleanup after print closes (or immediately if not supported)
      try {
        w.addEventListener("afterprint", cleanup, { once: true } as any);
        window.setTimeout(cleanup, 2000);
      } catch {
        cleanup();
      }
    }
  });
}

const start = () => void boot();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
document.addEventListener("astro:page-load", start as any);
document.addEventListener("astro:after-swap", start as any);
