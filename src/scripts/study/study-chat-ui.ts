import i18next from "i18next";
import { showToast } from "@scripts/core/ui-feedback";
import { esc } from "./study-text";

export type StudyChatCitation = {
  cite: number;
  sourceId: string;
  chunkIndex: number;
  title: string;
  kind: string | null;
  url: string | null;
  fileName: string | null;
  excerpt: string;
  body?: string;
};

function tt(key: string, fallback: string): string {
  const v = i18next.t(key);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

function appendAnswerWithCitations(container: HTMLElement, text: string) {
  const parts = text.split(/(\[\[\d+\]\])/g);
  for (const part of parts) {
    const m = part.match(/^\[\[(\d+)\]\]$/);
    if (m) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "study-cite-btn align-super inline-flex items-center justify-center min-h-[1.1rem] min-w-[1.1rem] mx-0.5 px-1 rounded-md bg-indigo-200/90 dark:bg-indigo-800/80 text-indigo-950 dark:text-indigo-50 text-[10px] font-bold leading-none hover:ring-2 hover:ring-indigo-400/70 focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-shadow";
      btn.textContent = m[1] ?? "";
      btn.dataset.citeNum = m[1] ?? "";
      btn.title = tt("study.citeTooltip", "Ver cita en la fuente");
      container.appendChild(btn);
    } else if (part) {
      container.appendChild(document.createTextNode(part));
    }
  }
}

function fillCiteBody(el: HTMLElement, body: string, excerpt: string) {
  const b = body || excerpt || "";
  const ex = (excerpt || "").trim();
  if (!b) {
    el.textContent = "";
    return;
  }
  const needle = ex.length >= 12 ? ex.slice(0, Math.min(64, ex.length)) : "";
  if (!needle) {
    el.textContent = b;
    return;
  }
  const idx = b.indexOf(needle);
  if (idx < 0) {
    el.textContent = b;
    return;
  }
  const len = Math.min(Math.max(ex.length, needle.length), b.length - idx);
  el.innerHTML = `${esc(b.slice(0, idx))}<mark class="bg-amber-200/95 dark:bg-amber-500/30 rounded px-0.5">${esc(b.slice(idx, idx + len))}</mark>${esc(b.slice(idx + len))}`;
}

export type StudyChatUiOptions = {
  chatEnabled: boolean;
  getSupabase: () => any;
  getUserId: () => string | null;
  getScope: () => "context" | "all";
  getContextSourceIds: () => string[];
  getAllSourceIds: () => string[];
  openFileSource: (sourceId: string) => void | Promise<void>;
  flashSourceRow: (sourceId: string) => void;
};

export function wireStudyChatUi(
  els: {
    messages: HTMLElement;
    form: HTMLFormElement;
    input: HTMLTextAreaElement;
    send: HTMLButtonElement;
    disabledMsg: HTMLElement;
    hint: HTMLElement;
    citeFocus: HTMLElement;
    citeTitle: HTMLElement;
    citeMeta: HTMLElement;
    citeBody: HTMLElement;
    citeSourceBtn: HTMLButtonElement;
    citeHighlightBtn: HTMLButtonElement;
  },
  opts: StudyChatUiOptions,
) {
  const {
    messages,
    form,
    input,
    send,
    disabledMsg,
    hint,
    citeFocus,
    citeTitle,
    citeMeta,
    citeBody,
    citeSourceBtn,
    citeHighlightBtn,
  } = els;

  let activeCitation: StudyChatCitation | null = null;

  const setDisabledState = () => {
    const enabled = opts.chatEnabled;
    if (!enabled) {
      disabledMsg.classList.remove("hidden");
      hint.textContent = tt("study.chatDisabledEnv", "Activa PUBLIC_STUDY_CHAT_ENABLED + STUDY_CHAT_ENABLED y OPENAI_API_KEY.");
      send.disabled = true;
      input.disabled = true;
      input.placeholder = tt("study.chatPlaceholder", "");
      return;
    }
    disabledMsg.classList.add("hidden");
    hint.textContent = tt("study.chatHint", "Citas [[1]]: pulsa el número para ver el fragmento y saltar a la fuente.");
    send.disabled = false;
    input.disabled = false;
  };

  setDisabledState();

  const hideCiteFocus = () => {
    citeFocus.classList.add("hidden");
    activeCitation = null;
  };

  const showCiteFocus = (c: StudyChatCitation) => {
    activeCitation = c;
    citeFocus.classList.remove("hidden");
    citeTitle.textContent = `${c.title} · #${c.chunkIndex + 1}`;
    const metaParts: string[] = [];
    if (c.kind === "link" && c.url) metaParts.push(c.url);
    if (c.kind === "file" && c.fileName) metaParts.push(c.fileName);
    metaParts.push(`[${c.cite}]`);
    citeMeta.textContent = metaParts.join(" · ");
    fillCiteBody(citeBody, c.body ?? "", c.excerpt ?? "");
    citeFocus.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const appendBubble = (role: "user" | "assistant", text: string, citations: StudyChatCitation[]) => {
    const emptyHint = messages.querySelector("[data-study-chat-empty]");
    emptyHint?.remove();

    const wrap = document.createElement("div");
    wrap.className =
      role === "user"
        ? "rounded-lg px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs leading-relaxed ml-6"
        : "rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700 text-xs leading-relaxed mr-4 text-gray-900 dark:text-gray-100";

    if (role === "user") {
      wrap.textContent = text;
    } else {
      const body = document.createElement("div");
      body.className = "whitespace-pre-wrap";
      appendAnswerWithCitations(body, text);
      wrap.appendChild(body);
      wrap.dataset.citations = JSON.stringify(citations);

      wrap.addEventListener("click", (ev) => {
        const btn = (ev.target as HTMLElement).closest("button.study-cite-btn");
        if (!btn) return;
        const n = Number(btn.dataset.citeNum || "0");
        if (!n) return;
        const parsed = JSON.parse(wrap.dataset.citations || "[]") as StudyChatCitation[];
        const c = parsed.find((x) => x.cite === n);
        if (c) showCiteFocus(c);
      });
    }
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  };

  citeSourceBtn.addEventListener("click", () => {
    const c = activeCitation;
    if (!c) return;
    if (c.kind === "link" && c.url) {
      window.open(c.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (c.kind === "file") {
      void opts.openFileSource(c.sourceId);
      return;
    }
    opts.flashSourceRow(c.sourceId);
  });

  citeHighlightBtn.addEventListener("click", () => {
    const c = activeCitation;
    if (!c) return;
    opts.flashSourceRow(c.sourceId);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!opts.chatEnabled) {
      showToast(tt("study.chatDisabledToast", "Chat desactivado en servidor."), "warning");
      return;
    }
    const sb = opts.getSupabase();
    const uid = opts.getUserId();
    if (!sb || !uid) {
      showToast(tt("study.searchNeedSession", "Inicia sesión."), "warning");
      return;
    }

    const text = input.value.trim();
    if (!text) return;

    const scope = opts.getScope();
    const sourceIds =
      scope === "all" ? opts.getAllSourceIds() : opts.getContextSourceIds().length > 0 ? opts.getContextSourceIds() : [];

    if (scope === "context" && sourceIds.length === 0) {
      showToast(tt("study.dossierNeedContext", "Marca al menos una fuente en contexto."), "warning");
      return;
    }

    appendBubble("user", text, []);
    input.value = "";
    send.disabled = true;

    try {
      const { data: sess } = await sb.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("no_token");

      const res = await fetch("/api/study/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, scope, sourceIds }),
      });
      const data = (await res.json().catch(() => null)) as
        | { answer?: string; citations?: StudyChatCitation[]; error?: string }
        | null;

      if (!res.ok) {
        const err = data?.error || tt("study.chatError", "Error en el chat.");
        showToast(err, "error");
        if (Array.isArray(data?.citations) && data.citations.length > 0) {
          appendBubble(
            "assistant",
            tt("study.chatFallbackCitations", "Recuperé fragmentos, pero la IA no respondió. Revisa tus claves OPENAI."),
            data.citations,
          );
        }
        return;
      }

      const answer = String(data?.answer ?? "").trim();
      const citations = Array.isArray(data?.citations) ? data!.citations! : [];
      appendBubble("assistant", answer || tt("study.chatEmptyAnswer", "(Sin texto)"), citations);
    } catch {
      showToast(tt("study.chatError", "Error en el chat."), "error");
    } finally {
      send.disabled = false;
    }
  });

  if (messages.childElementCount === 0) {
    const empty = document.createElement("p");
    empty.dataset.studyChatEmpty = "";
    empty.className = "m-0 px-2 py-4 text-center text-[11px] text-indigo-800/70 dark:text-indigo-200/60";
    empty.textContent = tt("study.chatEmpty", "Pregunta algo sobre tus fuentes; las respuestas llevan citas [[1]], [[2]]…");
    messages.appendChild(empty);
  }

  return { hideCiteFocus, showCiteFocus, setDisabledState };
}
