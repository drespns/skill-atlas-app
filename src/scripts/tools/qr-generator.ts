import i18next from "i18next";
import QRCode from "qrcode";
import { showToast } from "@scripts/core/ui-feedback";

function tt(key: string, fallback: string, opts?: Record<string, string | number>): string {
  const v = i18next.t(key, opts as any);
  return typeof v === "string" && v.length > 0 && v !== key ? v : fallback;
}

const PRESETS: Record<string, string> = {
  url: "https://",
  wifi: "WIFI:T:WPA;S:MiRed;P:MiClaveSegura;;",
  vcard: "BEGIN:VCARD\nVERSION:3.0\nFN:Alex SkillAtlas\nORG:SkillAtlas\nTEL:+34000000000\nEMAIL:hola@ejemplo.com\nEND:VCARD",
  plain: "",
};

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-qr-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const inp = root.querySelector<HTMLTextAreaElement>("[data-qr-text]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-qr-canvas]");
  const err = root.querySelector<HTMLElement>("[data-qr-err]");
  const warn = root.querySelector<HTMLElement>("[data-qr-warn]");
  const charsEl = root.querySelector<HTMLElement>("[data-qr-chars]");
  const btnDl = root.querySelector<HTMLButtonElement>("[data-qr-dl]");
  const btnCopy = root.querySelector<HTMLButtonElement>("[data-qr-copy]");
  const btnClear = root.querySelector<HTMLButtonElement>("[data-qr-clear]");
  const sizeInp = root.querySelector<HTMLInputElement>("[data-qr-size]");
  const sizeVal = root.querySelector<HTMLElement>("[data-qr-size-val]");
  const marginInp = root.querySelector<HTMLInputElement>("[data-qr-margin]");
  const marginVal = root.querySelector<HTMLElement>("[data-qr-margin-val]");
  const ecSel = root.querySelector<HTMLSelectElement>("[data-qr-ec]");
  const invertChk = root.querySelector<HTMLInputElement>("[data-qr-invert]");

  let deb: number | null = null;

  const setChars = (n: number) => {
    if (charsEl) {
      const v = i18next.t("tools.qrChars", { n });
      charsEl.textContent = typeof v === "string" && v !== "tools.qrChars" ? v : `${n} caracteres`;
    }
  };

  const run = async () => {
    if (!canvas) return;
    if (err) err.textContent = "";
    if (warn) warn.textContent = "";
    const text = (inp?.value ?? "").trim();
    setChars(inp?.value.length ?? 0);

    if (!text) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (text.length > 1500 && warn) {
      warn.textContent = tt("tools.qrWarnLength", "Contenido muy largo: algunos lectores pueden fallar.");
    }

    const w = Number(sizeInp?.value ?? 280);
    const margin = Number(marginInp?.value ?? 2);
    const ec = (ecSel?.value ?? "M") as "L" | "M" | "Q" | "H";
    const invert = Boolean(invertChk?.checked);
    const dark = invert ? "#f9fafb" : "#111827";
    const light = invert ? "#111827" : "#ffffff";

    canvas.width = w;
    canvas.height = w;

    try {
      await QRCode.toCanvas(canvas, text, {
        width: w,
        margin,
        errorCorrectionLevel: ec,
        color: { dark, light },
      });
    } catch {
      if (err) err.textContent = tt("tools.qrErrorGen", "No se pudo generar el QR.");
    }
  };

  const schedule = () => {
    if (deb) window.clearTimeout(deb);
    deb = window.setTimeout(() => {
      deb = null;
      void run();
    }, 280);
  };

  inp?.addEventListener("input", schedule);
  sizeInp?.addEventListener("input", () => {
    if (sizeVal) sizeVal.textContent = String(sizeInp.value);
    schedule();
  });
  marginInp?.addEventListener("input", () => {
    if (marginVal) marginVal.textContent = String(marginInp.value);
    schedule();
  });
  ecSel?.addEventListener("change", () => void run());
  invertChk?.addEventListener("change", () => void run());

  root.querySelectorAll<HTMLButtonElement>("[data-qr-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-qr-preset") as keyof typeof PRESETS | null;
      if (!k || !inp) return;
      inp.value = PRESETS[k] ?? "";
      schedule();
    });
  });

  btnClear?.addEventListener("click", () => {
    if (inp) inp.value = "";
    schedule();
  });

  btnDl?.addEventListener("click", () => {
    if (!canvas) return;
    const text = (inp?.value ?? "").trim();
    if (!text) {
      showToast(tt("tools.qrErrorEmpty", "Escribe algo para generar el QR."), "warning");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "skillatlas-qr.png";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });

  btnCopy?.addEventListener("click", async () => {
    if (!canvas) return;
    const text = (inp?.value ?? "").trim();
    if (!text) {
      showToast(tt("tools.qrErrorEmpty", "Escribe algo para generar el QR."), "warning");
      return;
    }
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("blob");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast(tt("tools.qrCopiedPng", "PNG copiado."), "success");
    } catch {
      showToast(tt("tools.qrCopyFail", "No se pudo copiar el PNG."), "error");
    }
  });

  window.addEventListener("skillatlas:prefs-updated", () => void run());

  void run();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

document.addEventListener("astro:page-load", init as EventListener);
document.addEventListener("astro:after-swap", init as EventListener);
