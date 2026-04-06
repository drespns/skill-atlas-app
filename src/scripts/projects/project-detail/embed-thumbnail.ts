import { compressImageForEmbedThumb } from "@lib/browser/image-compress";
import { publicStorageObjectUrl } from "@lib/supabase-public-storage-url";

const BUCKET = "embed_thumbnails";

function extForMime(m: "image/webp" | "image/jpeg"): string {
  return m === "image/webp" ? "webp" : "jpg";
}

/**
 * Sube miniatura comprimida; devuelve URL pública para `project_embeds.thumbnail_url`.
 * Ruta: `{userId}/{projectId}/{embedId}/thumb.{ext}`.
 */
export async function uploadEmbedThumbnail(
  supabase: any,
  opts: { userId: string; projectId: string; embedId: string; file: File },
): Promise<string | null> {
  let blob: Blob;
  let mime: "image/webp" | "image/jpeg";
  try {
    const r = await compressImageForEmbedThumb(opts.file);
    blob = r.blob;
    mime = r.outMime;
  } catch {
    return null;
  }

  const ext = extForMime(mime);
  const path = `${opts.userId}/${opts.projectId}/${opts.embedId}/thumb.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: mime,
    cacheControl: "31536000",
  });
  if (upErr) return null;

  const url = publicStorageObjectUrl(BUCKET, path);
  return url || null;
}

export async function removeEmbedThumbnailIfOwn(supabase: any, userId: string, publicUrl: string | null | undefined) {
  const u = (publicUrl ?? "").trim();
  if (!u) return;
  const marker = `/object/public/${BUCKET}/`;
  const i = u.indexOf(marker);
  if (i < 0) return;
  const after = (u.slice(i + marker.length).split("?")[0] ?? "").trim();
  const segments = after.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  const path = segments.join("/");
  if (!path.startsWith(`${userId}/`)) return;
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}
