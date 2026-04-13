type ConvertKind = "document" | "image" | "audio" | "video";

import { convertImageClientSide, sniffImageExt } from "@scripts/tools/convert/image-convert";

const OPTIONS: Record<ConvertKind, { from: string[]; to: string[] }> = {
  document: { from: ["pdf", "docx", "txt", "md"], to: ["pdf", "docx", "txt", "md"] },
  image: { from: ["png", "jpg", "webp", "svg"], to: ["png", "jpg", "webp"] },
  audio: { from: ["mp3", "wav", "aac"], to: ["mp3", "wav"] },
  video: { from: ["mp4", "webm"], to: ["mp4", "webm"] },
};

function renderOptions(select: HTMLSelectElement, values: string[]) {
  select.innerHTML = "";
  for (const v of values) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v.toUpperCase();
    select.appendChild(o);
  }
}

function boot() {
  const root = document.querySelector<HTMLElement>("[data-tools-convert-page]");
  if (!root) return;
  if (root.dataset.convertInit === "1") return;
  root.dataset.convertInit = "1";

  const kindEl = root.querySelector<HTMLSelectElement>("[data-convert-kind]");
  const fromEl = root.querySelector<HTMLSelectElement>("[data-convert-from]");
  const toEl = root.querySelector<HTMLSelectElement>("[data-convert-to]");
  const fileEl = root.querySelector<HTMLInputElement>("[data-convert-file]");
  const runEl = root.querySelector<HTMLButtonElement>("[data-convert-run]");
  const feedback = root.querySelector<HTMLElement>("[data-convert-feedback]");
  const swapEl = root.querySelector<HTMLButtonElement>("[data-convert-swap]");
  const dropzone = root.querySelector<HTMLElement>("[data-convert-dropzone]");
  const pickEl = root.querySelector<HTMLButtonElement>("[data-convert-pick]");
  const fileMeta = root.querySelector<HTMLElement>("[data-convert-file-meta]");
  const inImg = root.querySelector<HTMLImageElement>("[data-convert-preview-in]");
  const outImg = root.querySelector<HTMLImageElement>("[data-convert-preview-out]");
  const inHint = root.querySelector<HTMLElement>("[data-convert-preview-in-hint]");
  const outHint = root.querySelector<HTMLElement>("[data-convert-preview-out-hint]");
  const download = root.querySelector<HTMLAnchorElement>("[data-convert-download]");
  const okEl = root.querySelector<HTMLElement>("[data-convert-ok]");
  if (!kindEl || !fromEl || !toEl || !fileEl || !runEl || !feedback) return;
  if (
    !swapEl ||
    !dropzone ||
    !pickEl ||
    !fileMeta ||
    !inImg ||
    !outImg ||
    !inHint ||
    !outHint ||
    !download ||
    !okEl
  )
    return;

  let currentFile: File | null = null;
  let outUrl: string | null = null;
  const isImageEnabled = () => (kindEl.value as ConvertKind) === "image";

  const applyCapabilities = () => {
    const imageMode = isImageEnabled();
    // Swap + convert only make sense for image right now.
    swapEl.disabled = !imageMode;
    runEl.disabled = !imageMode;
    swapEl.classList.toggle("opacity-50", !imageMode);
    swapEl.classList.toggle("cursor-not-allowed", !imageMode);
    runEl.classList.toggle("opacity-50", !imageMode);
    runEl.classList.toggle("cursor-not-allowed", !imageMode);
    if (!imageMode) {
      clearOutput();
      outHint.textContent = "";
      okEl.classList.add("hidden");
      feedback.textContent = "Disponible gratis solo para imágenes. El resto será Pro (server-side).";
    }
  };

  const clearOutput = () => {
    if (outUrl) URL.revokeObjectURL(outUrl);
    outUrl = null;
    download.classList.add("hidden");
    download.removeAttribute("href");
    download.removeAttribute("download");
    outImg.classList.add("hidden");
    outImg.removeAttribute("src");
    outHint.textContent = "";
    okEl.classList.add("hidden");
  };

  const setFile = async (f: File | null) => {
    currentFile = f;
    clearOutput();
    feedback.textContent = "";
    if (!f) {
      fileMeta.textContent = "";
      inImg.classList.add("hidden");
      inImg.removeAttribute("src");
      inHint.textContent = "Selecciona un archivo para previsualizar.";
      return;
    }

    const ext = await sniffImageExt(f);
    fileMeta.textContent = `${f.name} · ${Math.round(f.size / 1024)} KB`;

    // Previsualización solo para imágenes.
    if (kindEl.value === "image" && (f.type.startsWith("image/") || ext === "svg")) {
      const url = URL.createObjectURL(f);
      inImg.src = url;
      inImg.classList.remove("hidden");
      inHint.textContent = `Entrada: ${ext.toUpperCase()}`;
      inImg.onload = () => URL.revokeObjectURL(url);
      inImg.onerror = () => {
        URL.revokeObjectURL(url);
        inImg.classList.add("hidden");
        inHint.textContent = "No se pudo previsualizar la imagen.";
      };
    } else {
      inImg.classList.add("hidden");
      inImg.removeAttribute("src");
      inHint.textContent = "Previsualización disponible solo para imágenes.";
    }
  };

  const render = () => {
    const kind = kindEl.value as ConvertKind;
    const opts = OPTIONS[kind] ?? OPTIONS.document;
    const prevFrom = fromEl.value;
    const prevTo = toEl.value;
    renderOptions(fromEl, opts.from);
    renderOptions(toEl, opts.to);
    if (opts.from.includes(prevFrom)) fromEl.value = prevFrom;
    if (opts.to.includes(prevTo)) toEl.value = prevTo;
    applyCapabilities();
  };

  render();

  kindEl.addEventListener("change", () => {
    render();
    if (isImageEnabled()) feedback.textContent = "";
    void setFile(currentFile);
  });

  swapEl.addEventListener("click", () => {
    if (!isImageEnabled()) return;
    const a = fromEl.value;
    const b = toEl.value;
    fromEl.value = b;
    toEl.value = a;
    feedback.textContent = "";
    clearOutput();
  });

  pickEl.addEventListener("click", () => fileEl.click());
  fileEl.addEventListener("change", () => void setFile(fileEl.files?.[0] ?? null));

  // Dropzone
  const setDrag = (on: boolean) => {
    dropzone.classList.toggle("ring-2", on);
    dropzone.classList.toggle("ring-indigo-400/60", on);
    dropzone.classList.toggle("dark:ring-indigo-500/30", on);
  };
  ["dragenter", "dragover"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      setDrag(true);
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      setDrag(false);
    });
  });
  dropzone.addEventListener("drop", (e) => {
    const dt = (e as DragEvent).dataTransfer;
    const f = dt?.files?.[0] ?? null;
    fileEl.files = dt?.files ?? null;
    void setFile(f);
  });

  runEl.addEventListener("click", () => {
    if (!isImageEnabled()) return;
    const file = currentFile ?? fileEl.files?.[0] ?? null;
    const kind = kindEl.value as ConvertKind;
    const from = fromEl.value;
    const to = toEl.value;
    if (!file) {
      feedback.textContent = "Selecciona un archivo primero.";
      return;
    }
    clearOutput();

    if (kind !== "image") {
      feedback.textContent = `Demo: ${kind} (${from} → ${to}) · ${file.name}. La conversión real será Pro (server-side).`;
      return;
    }

    feedback.textContent = "Convirtiendo…";
    okEl.classList.add("hidden");
    void (async () => {
      try {
        const out = await convertImageClientSide(file, to as any);
        const outKb = Math.max(1, Math.round(out.size / 1024));
        outUrl = URL.createObjectURL(out);
        outImg.src = outUrl;
        outImg.classList.remove("hidden");
        outHint.textContent = `Salida: ${to.toUpperCase()} · ${outKb} KB`;
        download.href = outUrl;
        download.download = `${file.name.replace(/\.[^.]+$/, "")}.${to}`;
        download.classList.remove("hidden");
        okEl.classList.remove("hidden");
        feedback.textContent = `Imagen convertida (${from} → ${to}).`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo convertir.";
        feedback.textContent = `Error: ${msg}`;
      }
    })();
  });

  void setFile(null);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

