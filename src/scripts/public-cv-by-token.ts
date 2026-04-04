import i18next from "i18next";
import { getHelpStackItem, HELP_STACK_ITEMS } from "../config/help-stack";
import { getSupabaseBrowserClient } from "./client-supabase";

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

function linesToBullets(raw: string): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^-+\s*/, ""));
}

function initPrintThemeLock() {
  if ((window as any).__skillatlasPublicCvPrintThemeLock === true) return;
  (window as any).__skillatlasPublicCvPrintThemeLock = true;
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

type RpcProject = {
  slug: string;
  title: string;
  description: string;
  role: string;
  outcome: string;
  technologyNames: string[];
};

type RpcCvProfile = {
  headline?: string;
  location?: string;
  email?: string;
  links?: { label: string; url: string }[];
  summary?: string;
  showHelpStack?: boolean;
  highlights?: string;
  showPhoto?: boolean;
  experiences?: {
    company?: string;
    role?: string;
    location?: string;
    start?: string;
    end?: string;
    bullets?: string;
  }[];
  education?: {
    school?: string;
    degree?: string;
    location?: string;
    start?: string;
    end?: string;
    details?: string;
  }[];
};

type RpcPayload = {
  displayName?: string;
  bio?: string;
  helpStack?: unknown;
  cvProfile?: unknown;
  projects?: RpcProject[];
};

async function run() {
  const root = document.querySelector<HTMLElement>("[data-public-cv-page]");
  const token = root?.dataset.publicCvToken?.trim() ?? "";
  const loadingEl = document.querySelector<HTMLElement>("[data-public-cv-loading]");
  const errEl = document.querySelector<HTMLElement>("[data-public-cv-error]");
  const docEl = document.querySelector<HTMLElement>("[data-public-cv-doc]");
  const docName = document.querySelector<HTMLElement>("[data-public-cv-doc-name]");
  const docHeadline = document.querySelector<HTMLElement>("[data-public-cv-doc-headline]");
  const docContact = document.querySelector<HTMLElement>("[data-public-cv-doc-contact]");
  const docBio = document.querySelector<HTMLElement>("[data-public-cv-doc-bio]");
  const docHelpStack = document.querySelector<HTMLElement>("[data-public-cv-doc-helpstack]");
  const docProjects = document.querySelector<HTMLElement>("[data-public-cv-doc-projects]");
  const docHighlightsSection = document.querySelector<HTMLElement>("[data-public-cv-doc-highlights-section]");
  const docHighlights = document.querySelector<HTMLElement>("[data-public-cv-doc-highlights]");
  const docExperienceSection = document.querySelector<HTMLElement>("[data-public-cv-doc-experience-section]");
  const docExperience = document.querySelector<HTMLElement>("[data-public-cv-doc-experience]");
  const docEducationSection = document.querySelector<HTMLElement>("[data-public-cv-doc-education-section]");
  const docEducation = document.querySelector<HTMLElement>("[data-public-cv-doc-education]");
  const docPhoto = document.querySelector<HTMLImageElement>("[data-public-cv-doc-photo]");
  const printBtn = document.querySelector<HTMLButtonElement>("[data-public-cv-print]");

  if (!token || !docEl || !docName || !docBio || !docProjects) return;

  document.body.classList.add("cv-print-mode");
  initPrintThemeLock();

  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    if (errEl) {
      errEl.textContent = tt("cv.publicNoSupabase", "No hay cliente Supabase configurado.");
      errEl.classList.remove("hidden");
    }
    loadingEl?.classList.add("hidden");
    return;
  }

  const { data, error } = await supabase.rpc("skillatlas_cv_by_share_token", { p_token: token });

  loadingEl?.classList.add("hidden");

  if (error) {
    if (errEl) {
      errEl.textContent = error.message ?? tt("cv.publicLoadError", "No se pudo cargar el CV público.");
      errEl.classList.remove("hidden");
    }
    return;
  }

  if (!data) {
    if (errEl) {
      errEl.textContent = tt("cv.publicNotFound", "Este CV no existe o no está publicado.");
      errEl.classList.remove("hidden");
    }
    document.title = `CV · SkillAtlas`;
    return;
  }

  const payload = data as RpcPayload;
  const displayName = (payload.displayName ?? "").trim() || "CV";
  const bio = (payload.bio ?? "").trim();
  const cvProfile = (payload.cvProfile && typeof payload.cvProfile === "object" ? (payload.cvProfile as RpcCvProfile) : {}) as RpcCvProfile;
  const projects = Array.isArray(payload.projects) ? (payload.projects as RpcProject[]) : [];

  docName.textContent = displayName;
  document.title = `${displayName} · CV`;

  const headline = (cvProfile.headline ?? "").trim();
  if (docHeadline) {
    docHeadline.textContent = headline;
    docHeadline.classList.toggle("hidden", !headline);
  }

  if (docContact) {
    const chips: string[] = [];
    const location = (cvProfile.location ?? "").trim();
    const email = normalizeEmail((cvProfile.email ?? "").trim());
    const links = Array.isArray(cvProfile.links) ? cvProfile.links : [];
    if (location) chips.push(`<span class="inline-flex items-center gap-1"><span class="text-gray-400">📍</span> ${esc(location)}</span>`);
    if (email && isProbablyEmail(email)) {
      chips.push(`<a class="no-underline hover:underline" href="mailto:${esc(email)}">${esc(email)}</a>`);
    }
    for (const l of links) {
      const url = normalizeUrl(String((l as any)?.url ?? ""));
      if (!url) continue;
      const label = String((l as any)?.label ?? "").trim() || url;
      chips.push(`<a class="no-underline hover:underline" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`);
    }
    docContact.innerHTML = chips.length > 0 ? chips.join(`<span class="text-gray-300 dark:text-gray-700">•</span>`) : "";
    docContact.classList.toggle("hidden", chips.length === 0);
  }

  const summary = (cvProfile.summary ?? "").trim();
  const finalSummary = summary || bio || "";
  docBio.textContent = finalSummary;
  docBio.classList.toggle("hidden", !finalSummary);

  const showHelp = cvProfile.showHelpStack ?? true;
  if (docHelpStack) {
    const raw = payload.helpStack;
    const keys = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    const allowed = new Set(HELP_STACK_ITEMS.map((i) => i.key));
    const uniq = Array.from(new Set(keys)).filter((k) => allowed.has(k));
    const visible = showHelp && uniq.length > 0;
    docHelpStack.classList.toggle("hidden", !visible);
    docHelpStack.classList.toggle("flex", visible);
    docHelpStack.innerHTML = visible
      ? uniq
          .map((k) => {
            const it = getHelpStackItem(k);
            if (!it) return "";
            return `<span class="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200">
              <img src="${esc(it.icon)}" alt="" class="h-4 w-4" loading="lazy" decoding="async" />
              ${esc(it.label)}
            </span>`;
          })
          .join("")
      : "";
  }

  // Public page: do not render private avatar URLs (storage requires auth).
  if (docPhoto) {
    docPhoto.classList.add("hidden");
    docPhoto.removeAttribute("src");
  }

  // Projects
  if (projects.length === 0) {
    docProjects.innerHTML = `<p class="m-0 text-sm text-gray-500 dark:text-gray-400">${esc(tt("cv.publicNoProjects", "No hay proyectos."))}</p>`;
  } else {
    docProjects.innerHTML = projects
      .map((p) => {
        const techLabels = [...(p.technologyNames ?? [])].sort((a, b) => a.localeCompare(b, "es"));
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
        const desc = (p.description ?? "").trim();
        return `<section class="cv-doc-project">
          <h4 class="m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">${esc(p.title)}</h4>
          ${meta}
          ${desc ? `<p class="m-0 mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">${esc(desc)}</p>` : ""}
          ${techHtml}
        </section>`;
      })
      .join("");
  }

  // Highlights
  const hl = linesToBullets(cvProfile.highlights ?? "");
  if (docHighlightsSection && docHighlights) {
    const show = hl.length > 0;
    docHighlightsSection.classList.toggle("hidden", !show);
    docHighlights.innerHTML = show ? hl.map((s) => `<li>${esc(s)}</li>`).join("") : "";
  }

  // Experience
  if (docExperienceSection && docExperience) {
    const exp = Array.isArray(cvProfile.experiences) ? cvProfile.experiences : [];
    const show = exp.length > 0;
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
    const show = edu.length > 0;
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

  docEl.classList.remove("hidden");
}

run();

