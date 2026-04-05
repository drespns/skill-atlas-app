# Backlog

## Roadmap de producto (orden acordado — 2026)

Orden priorizado para ganar profundidad sin dejar de pulir tecnologías/portfolio:

1. **Precios y posicionamiento** — Página pública `/pricing` (planes Starter / Pro / Team, comparativa, FAQ, toggle mensual/anual). CTAs alineados con acceso por invitación. Más adelante: Patreon u otros apoyos y facturación real (p. ej. Stripe) cuando cierres importes y condiciones legales.
2. **Portfolio por enlace** — Ver `docs/plan-saas-multi-tenant-portfolio.md`.
   - **Slug público:** **`/portfolio/<slug>`** + RPC `skillatlas_portfolio_by_public_slug` + Ajustes → **Enlaces públicos** (`#portfolio-links`): visibilidad + slug; confirmación con **Aplicar** y toast (**saas-011**).
   - **Token revocable:** **`/p/<token>`** + RPC `skillatlas_portfolio_by_share_token` + misma sección de Ajustes (copiar/regenerar; `portfolio_profiles.share_token`, **saas-003**).
3. **CV / hoja de vida** — Por defecto **100 % privado** (previsualización y descarga); **opción explícita de enlace público** revocable (token o flag en perfil, RLS acorde). Varias plantillas; fuentes de datos: perfil, proyectos seleccionados, stack; export PDF (primero cliente/`print`; servidor opcional para pixel-perfect).
   - **Parcial (v0.45+):** `/cv` privado (editor + prefs `cvProfile`/`cvProjectSlugs`, preview, impresión en claro).
   - **Enlace público revocable (código):** `/cv/p/<token>` (RPC `skillatlas_cv_by_share_token`, **saas-012**) + UI en `/cv` para activar/copiar/regenerar (`cv_share_enabled`, `cv_share_token`).
4. **Salida profesional** — PDF de portfolio, previews OG por proyecto, export estático cuando tenga sentido.

**Actualización (calidad de producto):**

- **Onboarding/QA:** “modo tester” en Ajustes (checklist, seed demo, copiar debug info) persistido en prefs (`qaTesterMode`).
- **Nota (pendiente):** el botón “Crear datos de prueba” puede fallar si tu DB tiene `concepts_progress_check` más estricto (ej. `progress` no acepta 0–100). Revisar y adaptar el seed a la constraint real.
- **Portfolio OG:** meta tags OG/Twitter en `/portfolio/<slug>` y `/p/<token>` + endpoint de imagen `/og/portfolio.svg` (resuelve por RPC).
5. **Trabajo diario** — Duplicar proyecto, plantillas de proyecto, actividad reciente en `/app`, búsqueda ampliada en el command palette.
6. **Preparación para convocatorias** — Visión pública en `/prep`; modelo de “proyectos de estudio” (temario, fechas, material enlazado); inspiración tipo NotebookLM **sin** API pública de Google: integración por enlaces, exportaciones y flujos manuales.
   - **Iteración v0 (hecho en código):** `/study` — UI 3 columnas (fuentes · estudio · salidas), fuentes y notas de sesión en `localStorage`; sin IA todavía. Siguiente: subida a Storage + extracción de texto + RAG + botones de salida reales.
7. **Monetización** — Tras validar demanda: pasarela + tabla de suscripciones + límites por plan; mantener precio accesible como objetivo de producto.

**Implementación reciente:** `/pricing` (`src/pages/pricing.astro`, `src/scripts/pricing-billing.ts`); enlaces en footer, landing y Ctrl+K. Textos i18n en `pricing.*` (`src/i18n/{es,en}.json`). **El header no enlaza a Precios** (v0.45+); acceso vía landing/hero/footer (authed) y palette.

---

## Plan de implementación por iteración (acordado — abril 2026)

**Enfoque:** ir por **puntos numerados**; después de cada uno, **pruebas manuales** (tú) y corrección de regresiones antes del siguiente. El roadmap global de producto de arriba **sigue valiendo**; este bloque fija el **orden práctico** con prioridad UX.

**Relación con las “fases” del plan UX (resumen):** puntos **1–4** ≈ pulir app diaria + confianza; **5–6** ≈ dashboard + onboarding; **7–9** ≈ portfolio público + salida profesional + plantillas; **10** ≈ largo plazo (tech notes, estudio/RAG, etc.).

### Lista ordenada (checklist de trabajo)

1. **Navegación CSR + View Transitions** — Revisar pantallas que cargan datos en el cliente (listas, detalles) y las transiciones entre páginas: que no se queden en “Cargando…”, que no mezclen datos de otra URL, que el salto entre vistas sea coherente. **Lista viva:** ir anotando pantallas que fallen al usar la app en el día a día.
   - **Iteración abr. 2026:** ampliado `astro:after-swap` (y programación segura) en portfolio autenticado, cabecera de perfil del portfolio, listas proyectos/tecnologías, `/app`, toggle vista, estudio, CV y portfolios públicos por token/slug; filtro por tecnología en portfolio(s) con **un solo** `change` listener; eliminar tecnología sin doble enganche al disparar el boot dos veces. Detalle técnico en `docs/architecture.md` (párrafo View Transitions).

2. **Command palette (el que ya tienes)** — Hoy: **Ctrl+K**, **/** (cuando el foco no está en un campo de texto) y **botón en la cabecera** (icono de búsqueda, `data-command-palette-trigger` en `AppShell.astro`, p. ej. “Buscar (Ctrl+K)”). **No es** crear un segundo sistema; **sí es** hacerlo más potente: buscar proyectos/tecnologías, más acciones rápidas, mejor textos/i18n.

3. **Burbujas flotantes (FAB / launcher)** — **Nuevo patrón:** zona fija (p. ej. esquina inferior derecha), estilo “widget” de chat: al pulsar, panel con **animación** (modal o toast grande) con **atajos** (la referencia detallada sigue en **Ajustes**). **Extensible** a más burbujas en línea (futuro: asistente / IA, ayuda contextual). La checklist corta post-login (punto 6) vive aquí en el MVP.
   - **Implementado (abr. 2026):** panel con pestañas (atajos · checklist · teaser IA), checklist persistida en `localStorage`, invitados ven la checklist **bloqueada** (sin marcar) con aviso e enlace a login.
   - **Idea futura (no prioritaria):** **burbujas arrastrables** para reposicionar el dock (persistir offset en `localStorage` o prefs); valor UX moderado frente a complejidad en móvil y solapes con el contenido.
   - **Iteración UX pendiente:** el panel debería ganar **ancho fluido** respecto al viewport (p. ej. `min(..., 100vw - padding)`) para que los rótulos de pestaña no se corten; en paralelo, **etiquetas de pestaña cortas** (“Pasos”, “IA”) y el **texto largo en el cuerpo del tab** (intro del checklist, etc.) suelen funcionar mejor que títulos largos en la barra.

4. **Detalles de confianza** — Toasts, mensajes tras guardar/borrar, errores legibles: se implementa con criterio técnico y se ajusta cuando tengas más horas de uso sobre la web.
   - **Parcial (abr. 2026):** tipo de toast **`warning`** (ámbar) alineado con usos reales del código; **accesibilidad** básica en toasts (`role="status"`, `aria-live`); helper **`userFacingDbError`** en `ui-feedback.ts` para mensajes de Postgres/Supabase repetitivos (RLS, sesión, duplicados, red) aplicado en **proyecto**, **tecnologías**, **evidencias (embeds)** y **conceptos**. Valorar i18n de los textos del helper y unificar mensajes en inglés cuando el UI esté en EN.

5. **Dashboard (`/app`)** — **Actividad y/o accesos recientes** (últimos proyectos o tecnologías, enlaces útiles) para que la entrada a la app tenga “vida” y punto de retorno al trabajo.
   - **Implementado (abr. 2026):** bloque **Actividad** con listas “Proyectos recientes” / “Tecnologías recientes” (`localStorage`, `recent-activity.ts`), rellenadas al abrir detalle CSR (`project-view-bootstrap` / `technology-view-bootstrap`); sección **Enlaces útiles** (Estudio, Prep, Ajustes, perfil, atajos); listados A–Z con hints; script `app-dashboard.ts` siempre en `/app` (sin Supabase en cliente o sin sesión → mensaje guía en lugar de “Cargando…” eterno).
   - **Futuro (si el producto lo exige):** historial **multi-dispositivo** / ligado a cuenta (p. ej. `user_prefs` o tabla de eventos) en lugar de solo `localStorage` en el navegador.

6. **Checklist muy corta post-login** — Onboarding mínimo (pocos pasos). **MVP:** integrado con las **burbujas** del punto 3 (segunda burbuja o sección dentro del mismo panel).
   - **Hecho:** checklist en el FAB (pestaña “Pasos”), persistencia local; invitados la ven bloqueada con CTA a login.

7. **Portfolio público** — **Jerarquía y perfilado** para el visitante: lectura clara, móvil, orden visual de historia + evidencias + stack (sin mezclar con refactors grandes de la app interna hasta estar listos).
   - **Parcial (abr. 2026):** módulo compartido `src/lib/public-portfolio-project-card.ts` — tarjeta con orden **título → stack → historia (rol/impacto) → descripción → evidencia**; chips con icono; iframe/enlace con accesibilidad y CTA táctil; preview autenticado (`portfolio-projects.ts`) alineado; `/portfolio/[slug]` y `/p/[token]` con cabecera y rejilla más aireadas (móvil); textos `portfolio.public.*` + `portfolio.publicLoading` (i18n).

8. **Impresión profesional** — PDF de portfolio donde encaje, previews **OG por proyecto** o piezas compartibles, export estático si aplica (alineado con “salida profesional” del roadmap global).

9. **Más plantillas** — **CV** y **presentación del portfolio** (varias jerarquías / layouts), sin perder el modelo de datos actual salvo que haga falta.

10. **Largo plazo** — **Tech Note** por tecnología, mejoras del import de conceptos (DB tiers/categorías, i18n), `/study` + Storage/RAG, duplicar proyecto / plantillas de proyecto, monetización, etc., según el roadmap global y el tiempo disponible.

---

## Release v0.45.0 (resumen)

- **Despliegue:** `@astrojs/vercel` (no `@astrojs/node`) para evitar 404 en Vercel; **`.vercel/`** en `.gitignore` (artefactos de build local).
- **Portfolio público:** `saas-011` + `/portfolio/[slug]` + Ajustes → Enlaces públicos (`#portfolio-links`: slug, visibilidad con **Aplicar**, copiar URL; token `/p/…` con **saas-003**).
- **CV:** `/cv` privado (solo sesión) con:
  - preview modal (CTA “Preview”)
  - datos del CV en prefs (`cvProfile`: titular, ubicación, email, links, resumen, experiencia/educación)
  - selección y **orden** de proyectos (`cvProjectSlugs`, drag & drop)
  - foto opcional + fuente (subida vs LinkedIn/proveedor) sin perder la subida
  - impresión en claro (beforeprint + `@media print`)
- **Landing:** scroll horizontal contenido con `overflow-x: hidden` en `html`/`body` (sin cambiar el full-bleed del hero).
- **Header:** `syncHeaderNavActive()` + indicador `left`/`width`; sin Precios en nav; Admin separado de iconos con `flex-1` espaciador; estilos activos `.header-nav-link` / `.header-admin-link`; **command palette** con estilo primario (índigo); selector de idioma en cabecera **opcional** (`showLangSelector`, por defecto oculto).

---

## Prioridad maxima (producto): SaaS + portfolio por enlace

Plan detallado (fases, DB, RLS, rutas, riesgos): **`docs/plan-saas-multi-tenant-portfolio.md`**

Resumen:

1. Multiusuario real: `user_id` en tablas + RLS por `auth.uid()` (SQL en repo: `docs/sql/saas-001*.sql`, `saas-002*.sql`).
2. Portfolio no catalogo publico: `portfolio_profiles` + `share_token` + ruta `/p/...` y RPC `skillatlas_portfolio_by_share_token` (`docs/sql/saas-003*.sql`).
3. App interna con **CSR** en Supabase: listas y detalles cargan en cliente (`/projects/view`, `/technologies/view`, bootstraps en `src/scripts/*-view-bootstrap.ts`). Ver `docs/architecture.md`.

**Hecho en codigo (pendiente de aplicar SQL en tu proyecto Supabase si aun no):** inserts con `user_id`, rutas CSR, `supabaseProvider` tolerante a build sin datos, duplicados de proyecto por `(user_id, slug)`.

**Hecho en código (aplicar SQL en Supabase si falta):** fila `portfolio_profiles`, páginas `/p/[token]` y `/portfolio/[slug]` con RPCs, preview autenticado CSR en `/portfolio`, Ajustes con **Aplicar** para slug/visibilidad y regeneración de token. El build estático sigue sin datos de usuario en páginas públicas; el contenido real es on-demand + anon RPC.

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
- Despliegue Vercel: variables `PUBLIC_*` en Project Settings, redirects URLs de Supabase, DNS del dominio; build con **`@astrojs/vercel`** (no `@astrojs/node`) para rutas dinámicas.

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
