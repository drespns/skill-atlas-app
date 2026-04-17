/**
 * Carril «Tus CV»: fijo a la derecha en escritorio, siempre visible al hacer scroll.
 * Modo compacto cuando el selector del header sigue visible (IntersectionObserver).
 */

type CvRailDoc = { id: string; name: string; isMain: boolean };

export function bindCvScrollDocRail(opts: {
  getDocs: () => CvRailDoc[];
  getActiveId: () => string;
  onPick: (id: string) => void;
  /** Selector del CV en cabecera; si sigue en vista, el rail se muestra más discreto. */
  docSelectAnchor?: HTMLElement | null;
}): void {
  const rail = document.querySelector<HTMLElement>("[data-cv-scroll-rail]");
  const cards = document.querySelector<HTMLElement>("[data-cv-scroll-rail-cards]");
  if (!rail || !cards) return;
  if (rail.dataset.cvRailBound === "1") return;
  rail.dataset.cvRailBound = "1";

  const paint = () => {
    const docs = opts.getDocs();
    const activeId = opts.getActiveId();
    rail.classList.remove("hidden");
    cards.replaceChildren();
    for (const d of docs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.cvRailDocId = d.id;
      btn.className = [
        "w-full rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-colors",
        d.id === activeId
          ? "border-indigo-400/80 bg-indigo-50/90 text-indigo-950 dark:border-indigo-500/50 dark:bg-indigo-950/50 dark:text-indigo-50"
          : "border-gray-200/80 bg-white/90 text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950/80 dark:text-gray-100 dark:hover:bg-gray-900",
      ].join(" ");
      btn.textContent = `${d.name}${d.isMain ? " ★" : ""}`;
      btn.addEventListener("click", () => opts.onPick(d.id));
      cards.appendChild(btn);
    }
  };

  const anchor = opts.docSelectAnchor ?? null;
  if (anchor && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        rail.classList.toggle("cv-scroll-rail--compact", vis);
      },
      { root: null, threshold: 0.08, rootMargin: "-8px 0px 0px 0px" },
    );
    io.observe(anchor);
  }

  document.addEventListener("skillatlas:prefs-updated", paint);
  (window as unknown as { __skillatlasCvRailRefresh?: () => void }).__skillatlasCvRailRefresh = paint;
  paint();
}
