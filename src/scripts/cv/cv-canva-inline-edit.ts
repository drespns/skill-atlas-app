import i18next from "i18next";
import { linesToBullets } from "@lib/cv-bullets";
import { getSupabaseBrowserClient } from "@scripts/core/client-supabase";
import { getSessionUserId } from "@scripts/core/auth-session";
import {
  buildCvDocumentsPrefsPatch,
  loadPrefs,
  migrateCvDocumentsIntoPrefs,
  updatePrefs,
  type CvDocumentSlotV1,
  type CvProfileV1,
} from "@scripts/core/prefs";
import { notifyCvEmbedPrefsSyncedExternally } from "@lib/cv-studio-prefs-channel";
import {
  compactCvStudioLayoutForPersist,
  mergeCvStudioCanvasLayoutFromProfile,
  type CvStudioCanvasLayoutV1,
} from "@lib/cv-studio-layout";
import { normalizeCvLinkSlotsArray, normalizeCvUrl, type CvSocialLinkDisplay } from "@lib/cv-contact-html";
import { showToast } from "@scripts/core/ui-feedback";

type EditField = "displayName" | "headline" | "cvTargetRole" | "summary";

function tt(key: string, fb: string): string {
  try {
    if (!i18next.isInitialized) return fb;
    const v = i18next.t(key);
    return typeof v === "string" && v.length > 0 && v !== key ? v : fb;
  } catch {
    return fb;
  }
}

function readActiveSlot(): { documents: CvDocumentSlotV1[]; activeId: string; idx: number } | null {
  const prefs = migrateCvDocumentsIntoPrefs(loadPrefs());
  const documents = (prefs.cvDocuments ?? []).map((d) => ({
    ...d,
    cvProfile: JSON.parse(JSON.stringify(d.cvProfile ?? {})) as CvProfileV1,
  }));
  const activeId = prefs.cvActiveDocumentId ?? documents[0]?.id ?? "";
  const idx = documents.findIndex((d) => d.id === activeId);
  if (idx < 0 || !documents[idx]) return null;
  return { documents, activeId, idx };
}

function persistCvProfile(nextProfile: CvProfileV1) {
  const cur = readActiveSlot();
  if (!cur) return;
  const next = [...cur.documents];
  next[cur.idx] = { ...next[cur.idx]!, cvProfile: nextProfile };
  updatePrefs(buildCvDocumentsPrefsPatch(next, cur.activeId));
  notifyCvEmbedPrefsSyncedExternally();
}

function persistPartialCv(patch: Partial<CvProfileV1>) {
  const cur = readActiveSlot();
  if (!cur) return;
  const prev = cur.documents[cur.idx]!.cvProfile ?? {};
  persistCvProfile({ ...prev, ...patch } as CvProfileV1);
}

async function savePortfolioBase(patch: { display_name?: string; bio?: string }): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const userId = supabase ? await getSessionUserId(supabase) : null;
  if (!supabase || !userId) {
    showToast(tt("cv.studioDocNeedSession", "Inicia sesión para ver el documento."), "error");
    return false;
  }
  const row: Record<string, unknown> = { user_id: userId, ...patch };
  const res = await supabase.from("portfolio_profiles").upsert(row, { onConflict: "user_id" });
  if (res.error) {
    showToast(res.error.message ?? tt("cv.canvaSaveFailed", "No se pudo guardar."), "error");
    return false;
  }
  window.dispatchEvent(new CustomEvent("skillatlas:portfolio-base-saved", { detail: patch }));
  showToast(tt("cv.canvaInlineSaved", "Cambios guardados."), "success");
  return true;
}

function plainText(el: HTMLElement): string {
  return (el.innerText ?? el.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

function normBulletKey(s: string | undefined): string {
  return linesToBullets(s ?? "").join("\n");
}

function clearEditableMarks(doc: HTMLElement) {
  doc.querySelectorAll<HTMLElement>("[data-cv-canva-edit]").forEach((n) => {
    n.removeAttribute("data-cv-canva-edit");
    n.removeAttribute("contenteditable");
    n.classList.remove("cv-canva-editable");
    n.removeAttribute("data-cv-canva-baseline");
  });
  doc.querySelectorAll<HTMLElement>("[data-cv-canva-entity]").forEach((n) => {
    n.removeAttribute("contenteditable");
    n.classList.remove("cv-canva-editable");
    n.removeAttribute("data-cv-canva-baseline");
  });
}

function markEditable(el: HTMLElement | null, field: EditField) {
  if (!el || el.classList.contains("hidden")) return;
  el.setAttribute("data-cv-canva-edit", field);
  el.setAttribute("contenteditable", "true");
  el.classList.add("cv-canva-editable");
}

function markEntityCells(doc: HTMLElement) {
  doc.querySelectorAll<HTMLElement>(".cv-canva-cell[data-cv-canva-entity]").forEach((n) => {
    n.setAttribute("contenteditable", "true");
    n.classList.add("cv-canva-editable");
  });
}

let delegated = false;

async function commitField(field: EditField, el: HTMLElement, baseline: string) {
  const next = plainText(el);
  if (next === baseline.trim()) return;

  if (field === "displayName") {
    if (!next) {
      el.textContent = baseline;
      showToast(tt("cv.canvaNameRequired", "El nombre no puede estar vacío."), "error");
      return;
    }
    const ok = await savePortfolioBase({ display_name: next });
    if (!ok) el.textContent = baseline;
    return;
  }

  if (field === "headline") {
    if (!next) {
      persistPartialCv({ headline: undefined });
      return;
    }
    persistPartialCv({ headline: next });
    return;
  }

  if (field === "cvTargetRole") {
    if (!next) {
      persistPartialCv({ cvTargetRole: undefined });
      return;
    }
    persistPartialCv({ cvTargetRole: next });
    return;
  }

  if (field === "summary") {
    if (!next) {
      persistPartialCv({ summary: undefined });
      return;
    }
    persistPartialCv({ summary: next });
  }
}

function joinLinesFromListUl(doc: HTMLElement, root: string): string {
  const ul = doc.querySelector(`ul[data-cv-canva-bullets-root="${root}"]`);
  if (!ul) return "";
  const parts = Array.from(ul.querySelectorAll<HTMLElement>(":scope > li")).map((li) => {
    const cell = li.querySelector<HTMLElement>('[data-cv-canva-field="line"]');
    return plainText(cell ?? li);
  });
  return linesToBullets(parts.join("\n")).join("\n");
}

function joinBulletsFromEntryUl(doc: HTMLElement, root: string, idx: number): string {
  const ul = doc.querySelector(`ul[data-cv-canva-bullets-root="${root}"][data-cv-canva-idx="${idx}"]`);
  if (!ul) return "";
  const parts = Array.from(ul.querySelectorAll<HTMLElement>(":scope > li")).map((li) => {
    const cell = li.querySelector<HTMLElement>('[data-cv-canva-field="bullet"]');
    return plainText(cell ?? li);
  });
  return linesToBullets(parts.join("\n")).join("\n");
}

function commitEntityCell(doc: HTMLElement, el: HTMLElement) {
  const entity = el.dataset.cvCanvaEntity;
  const field = el.dataset.cvCanvaField;
  const idxRaw = el.dataset.cvCanvaIdx ?? "0";
  const idx = Number.parseInt(idxRaw, 10);
  if (!entity || !field || !Number.isFinite(idx)) return;

  const cur = readActiveSlot();
  if (!cur) return;
  const profile = cur.documents[cur.idx]!.cvProfile ?? {};

  const baseline = el.dataset.cvCanvaBaseline ?? "";
  const nextScalar = plainText(el);

  if (entity === "workPrefs") {
    if (nextScalar === baseline.trim()) return;
    if (field === "cvWorkArrangement") {
      const prev = String(profile.cvWorkArrangement ?? "").trim();
      if (nextScalar.trim() === prev) return;
      persistPartialCv({ cvWorkArrangement: nextScalar.trim() || undefined });
    } else if (field === "cvWorkAuthorization") {
      const prev = String(profile.cvWorkAuthorization ?? "").trim();
      if (nextScalar.trim() === prev) return;
      persistPartialCv({ cvWorkAuthorization: nextScalar.trim() || undefined });
    }
    return;
  }

  if (entity === "contact") {
    if (field === "location") {
      if (nextScalar === baseline.trim()) return;
      const prev = String(profile.location ?? "").trim();
      if (nextScalar.trim() === prev) return;
      persistPartialCv({ location: nextScalar.trim() || undefined });
      return;
    }
    if (field === "email" || field === "phoneMobile" || field === "phoneLandline") {
      if (nextScalar === baseline.trim()) return;
      const k = field as "email" | "phoneMobile" | "phoneLandline";
      const prev = String(profile[k] ?? "").trim();
      if (nextScalar.trim() === prev) return;
      persistPartialCv({ [k]: nextScalar.trim() || undefined } as Partial<CvProfileV1>);
      return;
    }
  }

  if (entity === "linkSlots" && field === "url") {
    if (nextScalar === baseline.trim()) return;
    const slots = normalizeCvLinkSlotsArray(profile.cvLinkSlots);
    if (idx < 0 || idx >= slots.length) return;
    const nextUrl = normalizeCvUrl(nextScalar);
    if (nextUrl === slots[idx]) return;
    slots[idx] = nextUrl;
    persistPartialCv({ cvLinkSlots: slots });
    return;
  }

  if (entity === "highlights" && field === "line") {
    const joined = joinLinesFromListUl(doc, "highlights");
    if (normBulletKey(joined) === normBulletKey(profile.highlights)) return;
    if (!joined) persistPartialCv({ highlights: undefined });
    else persistPartialCv({ highlights: joined });
    return;
  }

  if (entity === "interests" && field === "line") {
    const joined = joinLinesFromListUl(doc, "interests");
    if (normBulletKey(joined) === normBulletKey(profile.cvInterests)) return;
    if (!joined) persistPartialCv({ cvInterests: undefined });
    else persistPartialCv({ cvInterests: joined });
    return;
  }

  const bulletEntities = new Set(["experiences", "education", "complementaryEducation", "volunteering"]);
  if (bulletEntities.has(entity) && field === "bullet") {
    const joined = joinBulletsFromEntryUl(doc, entity, idx);
    const key = entity as "experiences" | "education" | "complementaryEducation" | "volunteering";
    const arr = Array.isArray(profile[key]) ? [...(profile[key] as object[])] : [];
    const row = { ...(arr[idx] as Record<string, unknown>) };
    const prevB = normBulletKey(String(row.bullets ?? ""));
    if (normBulletKey(joined) === prevB) return;
    row.bullets = joined || undefined;
    arr[idx] = row;
    persistPartialCv({ [key]: arr } as Partial<CvProfileV1>);
    return;
  }

  if (entity === "experiences") {
    if (!["role", "company", "location", "start", "end"].includes(field)) return;
    if (nextScalar === baseline.trim()) return;
    const arr = Array.isArray(profile.experiences) ? profile.experiences.map((x) => ({ ...x })) : [];
    if (!arr[idx]) return;
    const row = { ...arr[idx]! } as Record<string, string | undefined>;
    const k = field as "role" | "company" | "location" | "start" | "end";
    const prev = String(row[k] ?? "").trim();
    if (nextScalar.trim() === prev) return;
    row[k] = nextScalar.trim() || undefined;
    arr[idx] = row;
    persistPartialCv({ experiences: arr });
    return;
  }

  if (entity === "education" || entity === "complementaryEducation") {
    const key = entity === "education" ? "education" : "complementaryEducation";
    const arr = Array.isArray(profile[key]) ? (profile[key] as object[]).map((x) => ({ ...x })) : [];
    if (!arr[idx]) return;
    const row = { ...(arr[idx] as Record<string, string | undefined>) };
    if (field === "details") {
      const prose = plainText(el);
      if (prose.trim() === baseline.trim()) return;
      const prev = String(row.details ?? "").trim();
      if (prose.trim() === prev) return;
      row.details = prose.trim() || undefined;
    } else if (["degree", "school", "location", "start", "end"].includes(field)) {
      if (nextScalar === baseline.trim()) return;
      const k = field as "degree" | "school" | "location" | "start" | "end";
      const prev = String(row[k] ?? "").trim();
      if (nextScalar.trim() === prev) return;
      row[k] = nextScalar.trim() || undefined;
    } else return;
    arr[idx] = row;
    persistPartialCv({ [key]: arr } as Partial<CvProfileV1>);
    return;
  }

  if (entity === "certifications") {
    if (!["name", "issuer", "year"].includes(field)) return;
    if (nextScalar === baseline.trim()) return;
    const arr = Array.isArray(profile.certifications) ? profile.certifications.map((x) => ({ ...x })) : [];
    if (!arr[idx]) return;
    const row = { ...arr[idx]! };
    const k = field as "name" | "issuer" | "year";
    const prev = String(row[k] ?? "").trim();
    if (nextScalar.trim() === prev) return;
    row[k] = nextScalar.trim() || undefined;
    arr[idx] = row;
    persistPartialCv({ certifications: arr });
    return;
  }

  if (entity === "languages") {
    if (!["name", "level"].includes(field)) return;
    if (nextScalar === baseline.trim()) return;
    const arr = Array.isArray(profile.languages) ? profile.languages.map((x) => ({ ...x })) : [];
    if (!arr[idx]) return;
    const row = { ...arr[idx]! };
    const k = field as "name" | "level";
    const prev = String(row[k] ?? "").trim();
    if (nextScalar.trim() === prev) return;
    row[k] = nextScalar.trim() || undefined;
    arr[idx] = row;
    persistPartialCv({ languages: arr });
    return;
  }

  if (entity === "publications") {
    if (!["title", "venue", "year"].includes(field)) return;
    if (nextScalar === baseline.trim()) return;
    const arr = Array.isArray(profile.publications) ? profile.publications.map((x) => ({ ...x })) : [];
    if (!arr[idx]) return;
    const row = { ...arr[idx]! };
    const k = field as "title" | "venue" | "year";
    const prev = String(row[k] ?? "").trim();
    if (nextScalar.trim() === prev) return;
    row[k] = nextScalar.trim() || undefined;
    arr[idx] = row;
    persistPartialCv({ publications: arr });
    return;
  }

  if (entity === "awards") {
    const arr = Array.isArray(profile.awards) ? profile.awards.map((x) => ({ ...x })) : [];
    if (!arr[idx]) return;
    const row = { ...arr[idx]! };
    if (field === "detail") {
      const prose = plainText(el);
      if (prose.trim() === baseline.trim()) return;
      const prev = String(row.detail ?? "").trim();
      if (prose.trim() === prev) return;
      row.detail = prose.trim() || undefined;
    } else if (["title", "issuer", "year"].includes(field)) {
      if (nextScalar === baseline.trim()) return;
      const k = field as "title" | "issuer" | "year";
      const prev = String(row[k] ?? "").trim();
      if (nextScalar.trim() === prev) return;
      row[k] = nextScalar.trim() || undefined;
    } else return;
    arr[idx] = row;
    persistPartialCv({ awards: arr });
    return;
  }

  if (entity === "volunteering") {
    if (!["organization", "role", "start", "end"].includes(field)) return;
    if (nextScalar === baseline.trim()) return;
    const arr = Array.isArray(profile.volunteering) ? profile.volunteering.map((x) => ({ ...x })) : [];
    if (!arr[idx]) return;
    const row = { ...(arr[idx] as Record<string, string | undefined>) };
    const k = field as "organization" | "role" | "start" | "end";
    const prev = String(row[k] ?? "").trim();
    if (nextScalar.trim() === prev) return;
    row[k] = nextScalar.trim() || undefined;
    arr[idx] = row;
    persistPartialCv({ volunteering: arr });
    return;
  }

  if (entity === "coverLetters") {
    const arr = Array.isArray(profile.coverLetters) ? profile.coverLetters.map((x) => ({ ...x })) : [];
    const prevRow = arr[idx];
    if (!prevRow) return;
    const row = { ...prevRow };
    if (field === "title") {
      if (nextScalar.trim() === baseline.trim()) return;
      row.title = nextScalar.trim() || row.title;
    } else if (field === "body") {
      const prose = (el.innerText ?? el.textContent ?? "").replace(/\u00a0/g, " ");
      if (prose === (baseline || "")) return;
      const prevBody = String(prevRow.body ?? "");
      if (prose === prevBody) return;
      row.body = prose.trimEnd();
    }
    arr[idx] = row;
    persistPartialCv({ coverLetters: arr });
  }
}

/**
 * Campos del titular + celdas con `data-cv-canva-entity` (prefs + portfolio para el nombre).
 * Se re-aplica tras cada `renderCvDocument` (evento `skillatlas:cv-studio-doc-painted`).
 */
export function setupCvCanvaInlineEdit(docPanel: HTMLElement) {
  const doc = docPanel.querySelector<HTMLElement>("[data-cv-document]");
  if (!doc) return;

  clearEditableMarks(doc);

  const name = doc.querySelector<HTMLElement>("[data-cv-doc-name]");
  const headline = doc.querySelector<HTMLElement>("[data-cv-doc-headline]");
  const targetRole = doc.querySelector<HTMLElement>("[data-cv-doc-target-role]");
  const bio = doc.querySelector<HTMLElement>("[data-cv-doc-bio]");

  markEditable(name, "displayName");
  markEditable(headline, "headline");
  markEditable(targetRole, "cvTargetRole");
  markEditable(bio, "summary");
  markEntityCells(doc);

  if (!delegated) {
    delegated = true;
    docPanel.addEventListener(
      "focusout",
      (e) => {
        const el = e.target as HTMLElement | null;
        if (!el || !docPanel.contains(el)) return;
        const field = el.dataset.cvCanvaEdit as EditField | undefined;
        if (field) {
          const baseline = el.dataset.cvCanvaEditBaseline ?? "";
          void commitField(field, el, baseline);
          return;
        }
        if (el.dataset.cvCanvaEntity) {
          const d = docPanel.querySelector<HTMLElement>("[data-cv-document]");
          if (d) commitEntityCell(d, el);
        }
      },
      true,
    );

    docPanel.addEventListener(
      "focusin",
      (e) => {
        const el = e.target as HTMLElement | null;
        if (!el) return;
        if (el.dataset.cvCanvaEdit && !el.dataset.cvCanvaEditBaseline) {
          el.dataset.cvCanvaEditBaseline = plainText(el);
        }
        if (el.dataset.cvCanvaEntity && !el.dataset.cvCanvaBaseline) {
          if (el.dataset.cvCanvaField === "body") {
            el.dataset.cvCanvaBaseline = (el.innerText ?? el.textContent ?? "").replace(/\u00a0/g, " ");
          } else {
            el.dataset.cvCanvaBaseline = plainText(el);
          }
        }
      },
      true,
    );
  }

  const snap = (el: HTMLElement | null) => {
    if (!el) return;
    if (el.dataset.cvCanvaEdit) el.dataset.cvCanvaEditBaseline = plainText(el);
    if (el.dataset.cvCanvaEntity) {
      if (el.dataset.cvCanvaField === "body") {
        el.dataset.cvCanvaBaseline = (el.innerText ?? el.textContent ?? "").replace(/\u00a0/g, " ");
      } else {
        el.dataset.cvCanvaBaseline = plainText(el);
      }
    }
  };
  snap(name);
  snap(headline);
  snap(targetRole);
  snap(bio);
  doc.querySelectorAll<HTMLElement>("[data-cv-canva-entity]").forEach((n) => snap(n));
}

/** Aplica un parche al `cvStudioCanvasLayout` del documento CV activo (prefs). */
export function patchActiveCanvasLayout(updater: (lay: CvStudioCanvasLayoutV1) => CvStudioCanvasLayoutV1): void {
  const cur = readActiveSlot();
  if (!cur) return;
  const prev = cur.documents[cur.idx]!.cvProfile ?? {};
  const merged = mergeCvStudioCanvasLayoutFromProfile(prev);
  const nextLay = updater(merged);
  persistPartialCv({
    cvStudioCanvasLayout: compactCvStudioLayoutForPersist(nextLay),
  } as Partial<CvProfileV1>);
}

export function patchActiveCvProfile(patch: Partial<CvProfileV1>): void {
  persistPartialCv(patch);
}

/** Cicla `socialLinkDisplay` entre icono, URL y ambos (enlaces del titular). */
export function cycleActiveSocialLinkDisplay(): void {
  const cur = readActiveSlot();
  if (!cur) return;
  const p = cur.documents[cur.idx]!.cvProfile ?? {};
  const order: CvSocialLinkDisplay[] = ["both", "icon", "url"];
  const raw = (p.socialLinkDisplay ?? "both") as string;
  const curM = order.includes(raw as CvSocialLinkDisplay) ? (raw as CvSocialLinkDisplay) : "both";
  const idx = order.indexOf(curM);
  const next = order[(idx + 1) % order.length]!;
  persistPartialCv({ socialLinkDisplay: next });
}
