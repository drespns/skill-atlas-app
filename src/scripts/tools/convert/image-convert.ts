type ImageTo = "png" | "jpg" | "webp";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("No se pudo leer el archivo."));
    fr.onload = () => resolve(String(fr.result || ""));
    fr.readAsDataURL(file);
  });
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  // Para SVG es más fiable usar objectURL.
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    });
    img.src = objectUrl;
    return await p;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error("No se pudo generar el archivo de salida."));
        else resolve(b);
      },
      mime,
      quality,
    );
  });
}

export async function convertImageClientSide(file: File, to: ImageTo): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("La imagen no tiene dimensiones válidas.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible en este navegador.");

  // Fondo blanco para JPG (evitar transparencias negras).
  if (to === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  if (to === "png") return await canvasToBlob(canvas, "image/png");
  if (to === "webp") return await canvasToBlob(canvas, "image/webp", 0.92);
  return await canvasToBlob(canvas, "image/jpeg", 0.92);
}

export async function sniffImageExt(file: File): Promise<string> {
  const nameExt = (file.name.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "svg"].includes(nameExt)) return nameExt === "jpeg" ? "jpg" : nameExt;
  // Fallback: mira el mime.
  const t = (file.type || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("jpeg")) return "jpg";
  if (t.includes("webp")) return "webp";
  if (t.includes("svg")) return "svg";
  // Último recurso.
  try {
    const url = await readAsDataUrl(file);
    if (url.startsWith("data:image/png")) return "png";
    if (url.startsWith("data:image/jpeg")) return "jpg";
    if (url.startsWith("data:image/webp")) return "webp";
    if (url.startsWith("data:image/svg")) return "svg";
  } catch {
    // ignore
  }
  return nameExt || "file";
}

