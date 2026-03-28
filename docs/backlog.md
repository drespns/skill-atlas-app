# Backlog

## Prioridad maxima (producto): SaaS + portfolio por enlace

Plan detallado (fases, DB, RLS, rutas, riesgos): **`docs/plan-saas-multi-tenant-portfolio.md`**

Resumen:

1. Multiusuario real: `user_id` en tablas + RLS por `auth.uid()`.
2. Portfolio no catalogo publico: tabla perfil + `share_token` + ruta `/p/...` y RPC (o edge) para lectura por token.
3. Ajustar Astro: SSG global incompatible con datos privados por usuario -> CSR en app interna y/o SSR (decision en el plan).

El bloque "single-account" y el script `rls-mvp-authenticated.sql` quedan como **paso previo / transicion**; la meta actual es sustituirlo por politicas multi-tenant del plan.

## Prioridad alta (siguiente iteracion)

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

1. Catalogo de conceptos asistido
- import semiautomatico por tecnologia
- secciones de documentacion y referencias externas (ver seccion 7 en `docs/plan-saas-multi-tenant-portfolio.md`)

## Prioridad baja / futura

1. Observabilidad y QA
- pruebas e2e basicas del flujo CRUD
- snapshots visuales
