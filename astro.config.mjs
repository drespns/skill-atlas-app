// @ts-check
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// Despliegue en Vercel: rutas on-demand (p. ej. `src/pages/portfolio/[slug].astro` con
// `prerender = false`) requieren el adapter `@astrojs/vercel`, no `@astrojs/node`.
// Para servidor Node propio (Docker/VPS): `adapter: node({ mode: "standalone" })` +
// `node ./dist/server/entry.mjs` según la guía de Astro.
export default defineConfig({
  /** URL canónica (OG, sitemap). Opcional: `PUBLIC_SITE_URL` en build. */
  site: process.env.PUBLIC_SITE_URL || undefined,
  adapter: vercel(),
  prefetch: {
    defaultStrategy: "viewport",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
