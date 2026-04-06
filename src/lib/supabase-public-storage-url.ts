/** URL pública de objeto en bucket Supabase Storage (bucket `public`). */
export function publicStorageObjectUrl(bucketId: string, path: string): string {
  const base = (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  if (!base) return "";
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucketId)}/${parts}`;
}
