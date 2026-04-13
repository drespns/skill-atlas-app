import QRCode from "qrcode";

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-qr-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const inp = root.querySelector<HTMLInputElement>("[data-qr-text]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-qr-canvas]");
  const err = root.querySelector<HTMLElement>("[data-qr-err]");
  const btn = root.querySelector<HTMLButtonElement>("[data-qr-gen]");
  const btnDl = root.querySelector<HTMLButtonElement>("[data-qr-dl]");

  const run = async () => {
    if (!canvas) return;
    err && (err.textContent = "");
    const text = (inp?.value ?? "").trim();
    if (!text) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    try {
      await QRCode.toCanvas(canvas, text, {
        width: 240,
        margin: 2,
        color: { dark: "#111827", light: "#ffffff" },
      });
    } catch (e) {
      if (err) err.textContent = "No se pudo generar (demasiado largo o contenido no válido).";
    }
  };

  btn?.addEventListener("click", run);
  btnDl?.addEventListener("click", () => {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "skillatlas-qr.png";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });
}

init();
