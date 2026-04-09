<!-- skillatlas-tier: iniciacion -->
## App Router

- Convención `app/` con `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`
- *Server Components* por defecto y límites de código cliente (`use client`)

## Rutas y datos

- `fetch` en servidor con caché y `revalidate`
- Rutas dinámicas `[slug]` y *route handlers* (`route.ts`)

<!-- skillatlas-tier: junior -->
## Navegación y UX

- `<Link>` prefetch y transiciones experimentales
- *Streaming* HTML y *Suspense* en segmentos

## Imágenes y fuentes

- `next/image` con dominios remotos permitidos
- `next/font` para optimización de tipografías

<!-- skillatlas-tier: mid -->
## Autenticación y edge

- Middleware en el edge para sesiones y redirecciones
- Integración con proveedores OAuth (patrones comunes)

## Despliegue

- Salida `standalone` para Docker
- Variables `NEXT_PUBLIC_*` vs secretos solo servidor

<!-- skillatlas-tier: senior -->
## Arquitectura

- Micro-frontends y monorepos (Turborepo)
- Observabilidad: OpenTelemetry y trazas en producción
