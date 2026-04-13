import { marked } from "marked";
import DOMPurify from "dompurify";

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-readme-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const ta = root.querySelector<HTMLTextAreaElement>("[data-readme-md]");
  const urlIn = root.querySelector<HTMLInputElement>("[data-readme-url]");
  const out = root.querySelector<HTMLElement>("[data-readme-out]");
  const btnRender = root.querySelector<HTMLButtonElement>("[data-readme-render]");
  const btnFetch = root.querySelector<HTMLButtonElement>("[data-readme-fetch]");
  const err = root.querySelector<HTMLElement>("[data-readme-err]");

  const render = () => {
    if (!out || !ta) return;
    err && (err.textContent = "");
    const md = ta.value;
    if (!md.trim()) {
      out.innerHTML = "";
      return;
    }
    const raw = marked.parse(md, { async: false, breaks: true, gfm: true });
    const str = typeof raw === "string" ? raw : String(raw);
    out.innerHTML = DOMPurify.sanitize(str, {
      ADD_ATTR: ["target", "rel"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    });
    out.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  };

  btnRender?.addEventListener("click", render);
  btnFetch?.addEventListener("click", async () => {
    const u = (urlIn?.value ?? "").trim();
    if (!u) return;
    err && (err.textContent = "");
    try {
      const res = await fetch(u, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (ta) ta.value = text;
      render();
    } catch (e) {
      if (err) {
        err.textContent =
          "No se pudo cargar (CORS o URL). Copia el Markdown y pégalo arriba, o usa un enlace raw (p. ej. raw.githubusercontent.com/…).";
      }
    }
  });
}

init();
