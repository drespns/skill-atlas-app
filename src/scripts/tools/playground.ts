function guardStyleClose(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

function guardScriptClose(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

function buildDoc(html: string, css: string, js: string, injectScript: boolean): string {
  const safeCss = guardStyleClose(css);
  const scriptEl =
    injectScript && js.trim().length > 0
      ? `<script>${guardScriptClose(js)}<\/script>`
      : "";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${safeCss}</style></head><body>${html}${scriptEl}</body></html>`;
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-playground-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const taHtml = root.querySelector<HTMLTextAreaElement>("[data-pg-html]");
  const taCss = root.querySelector<HTMLTextAreaElement>("[data-pg-css]");
  const taJs = root.querySelector<HTMLTextAreaElement>("[data-pg-js]");
  const allowJs = root.querySelector<HTMLInputElement>("[data-pg-allow-js]");
  const frame = root.querySelector<HTMLIFrameElement>("[data-pg-frame]");
  if (!taHtml || !taCss || !taJs || !frame) return;

  let t: ReturnType<typeof setTimeout> | undefined;
  let lastUrl: string | undefined;

  const apply = () => {
    const optedIn = !!allowJs?.checked;
    const js = taJs.value;
    const injectScript = optedIn && js.trim().length > 0;
    frame.setAttribute("sandbox", injectScript ? "allow-scripts" : "");

    const doc = buildDoc(taHtml.value, taCss.value, js, injectScript);
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    frame.src = url;
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = url;
  };

  const schedule = () => {
    if (t) clearTimeout(t);
    t = setTimeout(apply, 220);
  };

  taHtml.addEventListener("input", schedule);
  taCss.addEventListener("input", schedule);
  taJs.addEventListener("input", schedule);
  allowJs?.addEventListener("change", apply);
  apply();
}

init();
