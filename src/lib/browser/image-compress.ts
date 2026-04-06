/**
 * Compresión en cliente para portadas de proyecto (reduce almacenamiento y ancho de banda).
 * WebP preferido; JPEG de respaldo si el navegador no genera WebP.
 */

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_EDGE_PX = 1920;
const TARGET_MAX_BYTES = 480 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function blobToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality);
  });
}

function blobToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", quality);
  });
}

/**
 * Redimensiona (contención en caja MAX_EDGE) y comprime a WebP o JPEG.
 * @throws si no es imagen, supera tamaño de entrada o falla decode
 */
export async function compressImageForProjectCover(file: File): Promise<{ blob: Blob; outMime: "image/webp" | "image/jpeg" }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato no admitido. Usa JPG, PNG, WebP, GIF o AVIF.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("La imagen supera 12 MB antes de comprimir.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const scale = maxSide > MAX_EDGE_PX ? MAX_EDGE_PX / maxSide : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible.");
    ctx.drawImage(bitmap, 0, 0, w, h);

    let webpBlob = await blobToWebp(canvas, 0.82);
    if (!webpBlob || webpBlob.size < 80) {
      let blob = await blobToJpeg(canvas, 0.85);
      let jq = 0.85;
      while (blob.size > TARGET_MAX_BYTES && jq > 0.45) {
        jq -= 0.07;
        blob = await blobToJpeg(canvas, jq);
      }
      return { blob, outMime: "image/jpeg" };
    }

    let blob: Blob = webpBlob;
    let q = 0.82;
    while (blob.size > TARGET_MAX_BYTES && q > 0.42) {
      q -= 0.06;
      const next = await blobToWebp(canvas, q);
      if (!next) break;
      blob = next;
    }
    if (blob.size > TARGET_MAX_BYTES) {
      blob = await blobToJpeg(canvas, 0.78);
      return { blob, outMime: "image/jpeg" };
    }
    return { blob, outMime: "image/webp" };
  } finally {
    bitmap.close();
  }
}

const EMBED_THUMB_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const EMBED_THUMB_MAX_EDGE_PX = 1280;
const EMBED_THUMB_TARGET_MAX_BYTES = 200 * 1024;

/** Miniaturas de evidencia: algo más pequeñas que la portada de proyecto. */
export async function compressImageForEmbedThumb(file: File): Promise<{ blob: Blob; outMime: "image/webp" | "image/jpeg" }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato no admitido. Usa JPG, PNG, WebP, GIF o AVIF.");
  }
  if (file.size > EMBED_THUMB_MAX_INPUT_BYTES) {
    throw new Error("La imagen supera 8 MB antes de comprimir.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const scale = maxSide > EMBED_THUMB_MAX_EDGE_PX ? EMBED_THUMB_MAX_EDGE_PX / maxSide : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible.");
    ctx.drawImage(bitmap, 0, 0, w, h);

    let webpBlob = await blobToWebp(canvas, 0.8);
    if (!webpBlob || webpBlob.size < 80) {
      let blob = await blobToJpeg(canvas, 0.82);
      let jq = 0.82;
      while (blob.size > EMBED_THUMB_TARGET_MAX_BYTES && jq > 0.45) {
        jq -= 0.07;
        blob = await blobToJpeg(canvas, jq);
      }
      return { blob, outMime: "image/jpeg" };
    }

    let blob: Blob = webpBlob;
    let q = 0.8;
    while (blob.size > EMBED_THUMB_TARGET_MAX_BYTES && q > 0.42) {
      q -= 0.06;
      const next = await blobToWebp(canvas, q);
      if (!next) break;
      blob = next;
    }
    if (blob.size > EMBED_THUMB_TARGET_MAX_BYTES) {
      blob = await blobToJpeg(canvas, 0.76);
      return { blob, outMime: "image/jpeg" };
    }
    return { blob, outMime: "image/webp" };
  } finally {
    bitmap.close();
  }
}
