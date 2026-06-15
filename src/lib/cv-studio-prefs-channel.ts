/** Misma clave que `STORAGE_KEY` en `prefs.ts` (evento `storage` entre pestañas). */
export const SKILLATLAS_PREFS_STORAGE_KEY = "skillatlas_prefs_v1";

/** Sincronizar vista `/cv?doc=1` incrustada cuando el estudio guarda preferencias del CV. */
export const CV_STUDIO_EMBED_PREFS_CHANNEL = "skillatlas.cv.embed.sync";

export function notifyCvEmbedPrefsSyncedExternally(): void {
  try {
    new BroadcastChannel(CV_STUDIO_EMBED_PREFS_CHANNEL).postMessage({ v: 1 });
  } catch {
    /* ignore */
  }
}
