# Backlog

## Roadmap de producto (orden acordado — 2026)

Orden priorizado para ganar profundidad sin dejar de pulir tecnologías/portfolio:

1. **Precios y posicionamiento** — Página pública `/pricing` (planes Starter / Pro / Team, comparativa, FAQ, toggle mensual/anual). CTAs alineados con acceso por invitación. Más adelante: Patreon u otros apoyos y facturación real (p. ej. Stripe) cuando cierres importes y condiciones legales.
2. **Portfolio por enlace** — Ruta `/p/[token]` + RPC `skillatlas_portfolio_by_share_token` + UI (activar compartir, copiar enlace). Ver `docs/plan-saas-multi-tenant-portfolio.md`.
3. **CV / hoja de vida** — Por defecto **100 % privado** (previsualización y descarga); **opción explícita de enlace público** revocable (token o flag en perfil, RLS acorde). Varias plantillas; fuentes de datos: perfil, proyectos seleccionados, stack; export PDF (primero cliente/`print`; servidor opcional para pixel-perfect).
4. **Salida profesional** — PDF de portfolio, previews OG por proyecto, export estático cuando tenga sentido.
5. **Trabajo diario** — Duplicar proyecto, plantillas de proyecto, actividad reciente en `/app`, búsqueda ampliada en el command palette.
6. **Monetización** — Tras validar demanda: pasarela + tabla de suscripciones + límites por plan; mantener precio accesible como objetivo de producto.

**Implementación reciente:** `/pricing` (`src/pages/pricing.astro`, `src/scripts/pricing-billing.ts`); enlaces en footer, landing y Ctrl+K. Textos i18n en `pricing.*` (`src/i18n/{es,en}.json`).

---

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

## Proyectos: historia + evidencias (iteración cerrada — documentado)

**Estado:** implementado en código; **SQL `saas-006`** aplicado en Supabase (columnas `projects.role` / `projects.outcome` + RPC portfolio ampliada).

**Incluye:**

- Modelo **historia** (título, descripción, rol, resultado) + **evidencias** (lista ordenable de URLs como `iframe` o enlace).
- **`src/lib/evidence-url.ts`**: detección heurística por host + hints en modal; normalización Tableau para embed.
- Detalle CSR **`/projects/view`**: caja “añadir desde URL”, lista numerada con chip de tipo, modales `projectEditModal` / `embedEditModal` extendidos.
- Lista CSR **`/projects`**: muestra rol cuando existe.
- **`/portfolio`** y tipo **`Project`** en `src/data`: rol y outcome en tarjetas / contrato de datos.

**Explícitamente fuera de esta iteración:** i18n de strings del detalle CSR, plantillas por tipo de proyecto, subida de archivos, preview OG/capturas.

**Siguiente iteración sugerida (proyectos):** ~~plantillas de URL (chips) + favicon~~ **hecho**; preview rico (og:image, etc.); columna persistida `source_key` en embeds si hace falta reporting.

---

## Portfolio: cards CSR con sesión (iteración actual)

**Objetivo:** que `/portfolio` muestre proyectos reales en modo Supabase (sin depender del build estático y la anon key bajo RLS).

**Incluye:**

- CSR en `/portfolio` para **cards de proyectos** (`src/scripts/portfolio-projects.ts`):
  - chips de tecnologías con icono y color suave
  - historia: rol + resultado/impacto
  - evidencia primaria: iframe/enlace + chip de origen + favicon + contador
  - filtro por tecnología (`?tech=...`)
- Fix técnico: `getSupabaseBrowserClient()` cacheado (singleton) para evitar warnings de múltiples instancias GoTrue.

---

## Web pública + acceso privado (skillatlas.app) — plan acordado

Decisiones (2026-03-31):

- **Landing en `/`**: marketing + CTA; será lo que se aloje en `skillatlas.app`.
- **`/login` oculto** (no enlazado desde header; acceso solo para invitados).
- **Acceso por invitación** (sin signups abiertos): el usuario contacta y se le habilita acceso.
- **Despliegue**: Vercel + dominio `skillatlas.app`.

Siguientes tareas sugeridas:

- Landing tipo “product site” (hero + secciones + capturas + FAQ + CTA “Solicitar acceso”). **Hecho**
- Banner global sticky (versión / noticias / CTA). **Hecho**
- Navegación cruzada: desde la app “Ver landing” (`/`) y desde la landing “Entrar” (solo si invitado). **Hecho**
- Mecanismo de invitación (MVP):
  - Supabase Auth: deshabilitar signups libres (o bloquear en UI) + flujo de invitación.
  - Ruta de contacto: `mailto` al inicio o formulario (guardar solicitudes / enviar email).
- Despliegue Vercel: variables `.env`, redirects URLs de Supabase, DNS del dominio.

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
- ~~preferencias globales **local-first**~~: tipografía, tema/acentos, densidad UI, vistas por defecto, columnas y orden de tarjetas en `/settings`
- ~~perfil público + stack de ayuda~~ (`portfolio_profiles`, `help_stack` con saas-005)
- ~~portfolio: mostrar stack de ayuda~~ (chips bajo bio)

## Release 0.10.0 (resumen documentado)

- Ajustes tipo **dashboard**: rejilla con 1–4 columnas (≥ md), tarjetas reordenables por arrastre (asa superior), orden en `settingsSectionOrder`.
- **Perfil**: nombre/bio + stack de ayuda; sync Supabase + localStorage; portfolio muestra stack.
- **i18n UI**: selector de idioma por banderas (header y Ajustes).
- **Footer**: “Hecho con” + logos (incl. Supabase).
- **Tecnologías**: catálogo de alta con iconos y lista completa con scroll.
- **Import conceptos**: selección masiva por nivel/categoría/global; plantillas con tiers; script `annotate-concept-seed-tiers.mjs`.
- **Iconos**: `src/config/icons.ts` reorganizado; nuevas plantillas HTML/CSS; `help-stack.ts` y assets en `public/icons/`.
