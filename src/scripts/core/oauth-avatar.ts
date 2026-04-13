import type { User } from "@supabase/supabase-js";

/** Foto de perfil del proveedor OAuth (GitHub, LinkedIn OIDC, etc.). */
export function oauthPictureFromUser(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromMeta =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    null;
  if (fromMeta) return fromMeta;
  const ids = user.identities ?? [];
  for (const row of ids as { identity_data?: Record<string, unknown> }[]) {
    const d = row?.identity_data ?? {};
    const u =
      (typeof d.avatar_url === "string" && d.avatar_url.trim()) ||
      (typeof d.picture === "string" && d.picture.trim()) ||
      (typeof (d as { image_url?: string }).image_url === "string" &&
        String((d as { image_url?: string }).image_url).trim()) ||
      null;
    if (u) return u;
  }
  return null;
}
