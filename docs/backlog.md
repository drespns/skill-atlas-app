# Backlog

## Prioridad maxima (producto): SaaS + portfolio por enlace

Plan detallado (fases, DB, RLS, rutas, riesgos): **`docs/plan-saas-multi-tenant-portfolio.md`**

Resumen:

1. Multiusuario real: `user_id` en tablas + RLS por `auth.uid()` (SQL en repo: `docs/sql/saas-001*.sql`, `saas-002*.sql`).
2. Portfolio no catalogo publico: `portfolio_profiles` + `share_token` + ruta `/p/...` y RPC `skillatlas_portfolio_by_share_token` (`docs/sql/saas-003*.sql`).
3. App interna con **CSR** en Supabase: listas y detalles cargan en cliente (`/projects/view`, `/technologies/view`, bootstraps en `src/scripts/*-view-bootstrap.ts`). Ver `docs/architecture.md`.

**Hecho en codigo (pendiente de aplicar SQL en tu proyecto Supabase si aun no):** inserts con `user_id`, rutas CSR, `supabaseProvider` tolerante a build sin datos, duplicados de proyecto por `(user_id, slug)`.

**Siguiente vertical sugerido:** fila en `portfolio_profiles` al registrar o primer login; pagina publica `/p/[token]` que llame a la RPC; ajustes UI (toggle compartir, copiar enlace). `/portfolio` estatico seguira vacio en build con RLS estricta hasta usar la RPC o CSR de preview autenticado.

El bloque "single-account" y el script `rls-mvp-authenticated.sql` quedan como **paso previo**; en produccion SaaS deben sustituirse por `saas-002` cuando el esquema y backfill esten listos.

## Prioridad alta (siguiente iteracion)

0. Auth UX (iteración actual, hecho)
- `/login` como pantalla principal (email+password + OAuth)
- providers activos: GitHub + LinkedIn OIDC (`linkedin_oidc`)
- header: avatar + Sign out + ocultar Login con sesión
- login con escena 3D (Three.js Earth) full-bleed a la derecha

1. ~~Mejorar UX de edicion de entidades~~ (hecho)
- ~~modal unico para editar tecnologia~~ (`technologyEditModal` en `ui-feedback.ts`)
- ~~modal unico para editar proyecto~~ (`projectEditModal`)
- ~~modal unico para editar embed~~ (`embedEditModal`; alta y edicion)

2. ~~Hardening de validaciones en DB~~ (script en repo)
- ~~unique compuesto para conceptos por tecnologia (lower(title))~~ -> ver `docs/sql/mvp-constraints.sql`
- ~~constraints para sort_order por proyecto~~ -> indice unico `(project_id, sort_order)`

3. ~~Limpieza tecnica~~ (hecho)
- ~~dividir `project-detail.ts` en modulos mas pequenos~~ -> `src/scripts/project-detail/*.ts`
- ~~extraer helper compartido~~ -> `getSupabaseBrowserClient` en `src/scripts/client-supabase.ts`

## Prioridad media

1. ~~Completar i18n en toda la app~~ (en progreso avanzado)
- ~~mover recursos a archivos por idioma~~ -> `src/i18n/{es,en}.json`
- ~~traducir textos hardcoded~~ (parcial) + soporte para atributos:
  - `data-i18n-attr="placeholder,aria-label,title"` + `data-i18n-args` (JSON) en `src/scripts/client.ts`
  - cubierto en `technologies.astro`, `projects.astro`, `portfolio.astro`, `projects/[projectId].astro`, `technologies/[techId].astro`, `AppShell.astro`

2. ~~Mejorar portfolio publico~~ (hecho; sera reemplazado por portfolio por token en plan SaaS)
- ~~estilos mas visuales~~ (cards + dark)
- ~~filtros sencillos~~ (query `?tech=` en `/portfolio`)

3. ~~Mejorar estados vacios y errores~~ (hecho)
- ~~mensajes mas accionables~~
- ~~links directos entre flujos~~ (CTAs en `technologies/[techId]` y `projects/[projectId]`)

## Bloque completado / transicion: Auth + RLS MVP (single-tenant)

1. ~~Auth magic link + gating CRUD en cliente~~ (`/settings`, scripts CRUD)
2. ~~RLS transicion~~ -> `docs/sql/rls-mvp-authenticated.sql` (sustituir por multi-tenant segun plan SaaS)

## Prioridad siguiente (tras SaaS + portfolio)

1. Catalogo de conceptos asistido (**Sprint B** — **implementado** MVP; detalle en `docs/architecture.md` § Sprint B)
- ~~import en `/technologies/view` (URL + texto; vista previa; revisión; carga en bloque)~~
- ~~plantillas `public/static/concept-seeds/*.md` + picker al crear tecnología (`getSeedCatalogEntries`)~~
- ~~filtros de calidad, agrupación por nivel + categoría, quick import, `ImportEnricher` stub~~
- ~~modal editor Markdown amplio; refresco de lista sin reload completo~~
- **Mejoras opcionales**: marcar `skillatlas-tier` en más plantillas que `python.md`; columnas dedicadas `category`/`tier` en DB + migración SQL; i18n de nuevos strings del import
- secciones de documentacion y referencias externas (post Sprint B o en paralelo si hay tiempo):
  - **1 Tech Note por tecnología** (markdown) + links
  - conceptos siguen siendo “átomos” (RDD, Lazy, Shuffle, etc.)
  - ver seccion 7 en `docs/plan-saas-multi-tenant-portfolio.md`

## Prioridad baja / futura

1. Observabilidad y QA
- pruebas e2e basicas del flujo CRUD
- snapshots visuales

2. Performance / UX de navegación (pendiente)
- reducir “re-carga completa” al cambiar entre pantallas (cache en memoria + skeletons consistentes)
- opcional: conservar datos en client scripts (prefetch / sessionStorage) para listas CSR

3. Ajustes (UX “daily driver”)
- preferencias globales **local-first** (sin sync al inicio): tipografía, tema/acentos, densidad UI, vistas por defecto
