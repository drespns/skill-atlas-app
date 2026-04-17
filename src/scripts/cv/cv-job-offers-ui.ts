import type { CvJobOfferColumnV1, CvJobOfferV1 } from "@scripts/core/prefs";

const NOTE_MAX = 600;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hostLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 32);
  }
}

const COLS: CvJobOfferColumnV1[] = ["todo", "applied", "followup"];

export function bindCvJobOffersKanban(opts: {
  tt: (key: string, fb: string) => string;
  getOffers: () => CvJobOfferV1[];
  setOffers: (next: CvJobOfferV1[]) => void;
}): void {
  const form = document.querySelector<HTMLFormElement>("[data-cv-job-offer-form]");
  const urlInp = document.querySelector<HTMLInputElement>("[data-cv-job-offer-url-input]");
  const titleInp = document.querySelector<HTMLInputElement>("[data-cv-job-offer-title-input]");
  if (!form || !urlInp) return;
  if (form.dataset.cvJobKanbanBound === "1") return;
  form.dataset.cvJobKanbanBound = "1";

  const newId = () => `jo_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`;

  let dragOfferId: string | null = null;
  const noteTimers = new Map<string, number>();

  const scheduleNotePersist = (id: string, ta: HTMLTextAreaElement) => {
    const prev = noteTimers.get(id);
    if (prev) window.clearTimeout(prev);
    noteTimers.set(
      id,
      window.setTimeout(() => {
        noteTimers.delete(id);
        const trimmed = ta.value.trim().slice(0, NOTE_MAX);
        const cur = opts.getOffers();
        opts.setOffers(cur.map((x) => (x.id === id ? { ...x, notes: trimmed || undefined } : x)));
      }, 450),
    );
  };

  const setColumn = (id: string, column: CvJobOfferColumnV1) => {
    const cur = opts.getOffers();
    opts.setOffers(cur.map((x) => (x.id === id ? { ...x, column } : x)));
    paint();
  };

  for (const col of COLS) {
    const host = document.querySelector<HTMLElement>(`[data-cv-job-list="${col}"]`);
    if (!host) continue;
    host.addEventListener("dragover", (e) => {
      if (!e.dataTransfer?.types?.includes("text/plain")) return;
      e.preventDefault();
      try {
        e.dataTransfer!.dropEffect = "move";
      } catch {
        // ignore
      }
      host.classList.add("cv-job-drop-list--over");
    });
    host.addEventListener("dragleave", (e) => {
      if (e.currentTarget === e.target || !host.contains(e.relatedTarget as Node)) {
        host.classList.remove("cv-job-drop-list--over");
      }
    });
    host.addEventListener("drop", (e) => {
      e.preventDefault();
      host.classList.remove("cv-job-drop-list--over");
      const id = (() => {
        try {
          return e.dataTransfer?.getData("text/plain").trim() || dragOfferId;
        } catch {
          return dragOfferId;
        }
      })();
      dragOfferId = null;
      if (!id) return;
      setColumn(id, col);
    });
  }

  const paint = () => {
    const offers = opts.getOffers();
    for (const col of COLS) {
      const host = document.querySelector<HTMLElement>(`[data-cv-job-list="${col}"]`);
      if (!host) continue;
      host.classList.remove("cv-job-drop-list--over");
      host.replaceChildren();
      const inCol = offers.filter((o) => o.column === col);
      for (const o of inCol) {
        const card = document.createElement("div");
        card.className =
          "cv-job-card group rounded-xl border border-gray-200/90 bg-white/95 p-2.5 shadow-sm dark:border-gray-600/90 dark:bg-gray-900/80 dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]";
        card.dataset.cvJobCard = o.id;
        card.draggable = true;
        card.tabIndex = 0;

        const title = (o.title ?? "").trim() || hostLabel(o.url);
        const move = (next: CvJobOfferColumnV1) => {
          setColumn(o.id, next);
        };

        card.addEventListener("dragstart", (e) => {
          dragOfferId = o.id;
          card.classList.add("cv-job-card--dragging");
          try {
            e.dataTransfer?.setData("text/plain", o.id);
            e.dataTransfer!.effectAllowed = "move";
          } catch {
            // ignore
          }
        });
        card.addEventListener("dragend", () => {
          dragOfferId = null;
          card.classList.remove("cv-job-card--dragging");
          document.querySelectorAll(".cv-job-drop-list--over").forEach((el) => el.classList.remove("cv-job-drop-list--over"));
        });

        const head = document.createElement("div");
        head.className = "flex items-start gap-2";
        const grip = document.createElement("span");
        grip.className =
          "mt-0.5 cursor-grab select-none text-[10px] leading-none text-gray-400 opacity-70 group-hover:opacity-100 dark:text-gray-500";
        grip.setAttribute("aria-hidden", "true");
        grip.textContent = "⋮⋮";
        const meta = document.createElement("div");
        meta.className = "min-w-0 flex-1";
        meta.innerHTML = `
          <p class="m-0 font-semibold leading-snug text-gray-900 dark:text-gray-100">${esc(title)}</p>
          <p class="m-0 mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">${esc(hostLabel(o.url))}</p>
        `;
        head.append(grip, meta);

        const actions = document.createElement("div");
        actions.className = "mt-2 flex flex-wrap items-center gap-1.5";
        const openA = document.createElement("a");
        openA.href = o.url;
        openA.target = "_blank";
        openA.rel = "noreferrer";
        openA.className =
          "inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:text-indigo-200 dark:hover:bg-indigo-900/80";
        openA.textContent = opts.tt("cv.jobOpenLink", "Abrir");
        actions.appendChild(openA);

        for (const c of COLS) {
          if (c === col) continue;
          const b = document.createElement("button");
          b.type = "button";
          b.className =
            "rounded-md border border-gray-200/90 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-950/60 dark:text-gray-200 dark:hover:bg-gray-800";
          b.textContent =
            c === "todo"
              ? opts.tt("cv.jobMoveTodo", "→ Por aplicar")
              : c === "applied"
                ? opts.tt("cv.jobMoveApplied", "→ Enviadas")
                : opts.tt("cv.jobMoveFollowup", "→ Seguimiento");
          b.addEventListener("click", () => move(c));
          actions.appendChild(b);
        }
        const del = document.createElement("button");
        del.type = "button";
        del.className =
          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 hover:underline dark:text-rose-400";
        del.textContent = opts.tt("cv.remove", "Quitar");
        del.addEventListener("click", () => {
          opts.setOffers(opts.getOffers().filter((x) => x.id !== o.id));
          paint();
        });
        actions.appendChild(del);

        const noteWrap = document.createElement("label");
        noteWrap.className = "mt-2 block";
        const noteLab = document.createElement("span");
        noteLab.className = "mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
        noteLab.textContent = opts.tt("cv.jobNoteLabel", "Notas");
        const ta = document.createElement("textarea");
        ta.rows = 2;
        ta.className =
          "w-full min-w-0 resize-y rounded-lg border border-gray-200/90 bg-gray-50/80 px-2 py-1.5 text-[11px] leading-snug text-gray-800 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-100 dark:placeholder:text-gray-500";
        ta.placeholder = opts.tt("cv.jobNotePlaceholder", "Empresa, contacto, fecha límite…");
        ta.value = o.notes ?? "";
        ta.addEventListener("input", () => {
          scheduleNotePersist(o.id, ta);
        });

        noteWrap.append(noteLab, ta);
        card.append(head, actions, noteWrap);
        host.appendChild(card);
      }
      if (inCol.length === 0) {
        const empty = document.createElement("p");
        empty.className =
          "cv-job-col-empty m-0 rounded-lg border border-dashed border-gray-300/80 px-2 py-6 text-center text-[11px] text-gray-400 dark:border-gray-600/60 dark:text-gray-500";
        empty.textContent = opts.tt("cv.jobColEmpty", "Vacío");
        empty.dataset.cvJobEmpty = "1";
        host.appendChild(empty);
      }
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let url = (urlInp.value ?? "").trim();
    const title = (titleInp?.value ?? "").trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      return;
    }
    const next = [...opts.getOffers(), { id: newId(), url, title: title || undefined, column: "todo" as const }];
    opts.setOffers(next);
    urlInp.value = "";
    if (titleInp) titleInp.value = "";
    paint();
  });

  (window as unknown as { __skillatlasCvJobOffersRefresh?: () => void }).__skillatlasCvJobOffersRefresh = paint;
  paint();
}
