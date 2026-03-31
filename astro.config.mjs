// @ts-check
import node from "@astrojs/node";
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// Por defecto Astro pre-renderiza todo como estático. `src/pages/portfolio/[slug].astro`
// usa `export const prerender = false` para resolverse en el servidor (ruta dinámica).
// El adapter Node permite ese modo en despliegue (`node ./dist/server/entry.mjs`).
export default defineConfig({
  adapter: node({ mode: "standalone" }),
  prefetch: {
    defaultStrategy: "viewport",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
