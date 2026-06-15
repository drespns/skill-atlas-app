import i18next from "i18next";
import { analyzeCron, randomCronExample } from "@lib/tools-cron";
import { loadPrefs } from "@scripts/core/prefs";
import { showToast } from "@scripts/core/ui-feedback";

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function cronLocale(): "es" | "en" {
  const l = (i18next.language || loadPrefs().lang || "es").slice(0, 2);
  return l === "en" ? "en" : "es";
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatWhen(d: Date, locale: "es" | "en", tz: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function bind() {
  const root = document.querySelector<HTMLElement>("[data-tools-cron-page]");
  if (!root || root.dataset.cronBound === "1") return;
  root.dataset.cronBound = "1";

  const inp = root.querySelector<HTMLInputElement>("[data-cron-expr]");
  const errEl = root.querySelector<HTMLElement>("[data-cron-err]");
  const humanEl = root.querySelector<HTMLElement>("[data-cron-human]");
  const nextEl = root.querySelector<HTMLElement>("[data-cron-next]");
  const tzEl = root.querySelector<HTMLElement>("[data-cron-tz]");
  const btnRandom = root.querySelector<HTMLButtonElement>("[data-cron-random]");
  const btnCopyExpr = root.querySelector<HTMLButtonElement>("[data-cron-copy-expr]");
  const btnCopyHuman = root.querySelector<HTMLButtonElement>("[data-cron-copy-human]");

  const tz = timeZone();
  const updateTzLabel = () => {
    if (!tzEl) return;
    const v = i18next.t("tools.cronTzLabel", { tz });
    tzEl.textContent = typeof v === "string" && v !== "tools.cronTzLabel" ? v : `Zona horaria: ${tz}`;
  };
  updateTzLabel();

  let deb: number | null = null;

  const render = () => {
    if (!inp || !errEl || !humanEl || !nextEl) return;
    const raw = inp.value;
    const loc = cronLocale();
    const res = analyzeCron(raw, loc, tz, 16);
    errEl.textContent = "";
    humanEl.textContent = "";
    nextEl.innerHTML = "";

    if (!res.normalized.trim()) {
      humanEl.textContent = tt("tools.cronEmptyHint", "Escribe una expresión o elige un ejemplo.");
      return;
    }

    if (!res.ok) {
      const key =
        res.parseError === "empty"
          ? "tools.cronErrEmpty"
          : res.parseError.toLowerCase().includes("invalid")
            ? "tools.cronErrInvalid"
            : "tools.cronErrParse";
      errEl.textContent = tt(key, res.parseError);
      return;
    }

    humanEl.textContent = res.human || tt("tools.cronHumanFallback", "Descripción no disponible para esta expresión.");
    res.next.forEach((d) => {
      const li = document.createElement("li");
      li.className = "rounded px-2 py-1 text-gray-800 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-900/60";
      li.textContent = formatWhen(d, loc, tz);
      nextEl.appendChild(li);
    });
  };

  const schedule = () => {
    if (deb) window.clearTimeout(deb);
    deb = window.setTimeout(() => {
      deb = null;
      render();
    }, 220);
  };

  inp?.addEventListener("input", schedule);
  inp?.addEventListener("change", render);

  root.querySelectorAll<HTMLButtonElement>("[data-cron-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-cron-preset") ?? "";
      if (inp) inp.value = v;
      render();
    });
  });

  btnRandom?.addEventListener("click", () => {
    if (inp) inp.value = randomCronExample();
    render();
  });

  const copyText = async (text: string, okKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(tt(okKey, "Copiado."), "success");
    } catch {
      showToast(tt("tools.cronCopyFail", "No se pudo copiar."), "error");
    }
  };

  btnCopyExpr?.addEventListener("click", () => {
    const t = (inp?.value ?? "").trim();
    if (!t) {
      showToast(tt("tools.cronCopyExprEmpty", "Nada que copiar."), "warning");
      return;
    }
    void copyText(t, "tools.cronCopiedExpr");
  });

  btnCopyHuman?.addEventListener("click", () => {
    const t = (humanEl?.textContent ?? "").trim();
    if (!t) {
      showToast(tt("tools.cronCopyHumanEmpty", "Primero genera una descripción válida."), "warning");
      return;
    }
    void copyText(t, "tools.cronCopiedHuman");
  });

  window.addEventListener("skillatlas:prefs-updated", () => {
    updateTzLabel();
    render();
  });

  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
else bind();

document.addEventListener("astro:page-load", bind as EventListener);
document.addEventListener("astro:after-swap", bind as EventListener);
