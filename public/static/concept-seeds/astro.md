<!-- skillatlas-tier: iniciacion -->
## Islands architecture

- HTML estático por defecto y JS solo donde se pide (`client:*`)
- Componentes `.astro` con *frontmatter* y plantilla
- Integración con React, Vue, Svelte como islas

## Rutas

- Enrutado basado en ficheros en `src/pages`
- Rutas dinámicas `[...slug]` y datos asociados

<!-- skillatlas-tier: junior -->
## Contenido

- Colecciones de contenido con esquema tipado
- Markdown / MDX y componentes embebidos

## Imágenes y assets

- `<Image>` optimizado y formatos modernos
- `public/` vs `src/assets` y rutas base

<!-- skillatlas-tier: mid -->
## Renderizado

- Modo estático, SSR y híbrido según adapter (Vercel, Node, etc.)
- Variables de entorno en servidor vs cliente (`PUBLIC_`)

## Rendimiento

- Puntuación Core Web Vitals y *partial hydration*

<!-- skillatlas-tier: senior -->
## Despliegue

- Adapters oficiales y configuración edge
- Integración con CMS *headless* y webhooks de rebuild
