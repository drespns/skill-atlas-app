# Architecture

## Vista general

Astro genera sitio **estatico** (`output: static`). Las paginas se prerenderizan en build; la **app autenticada con Supabase** carga listas y detalles **en el cliente (CSR)** cuando RLS no permite leer todo el dataset con la anon key sin sesion.

- Render: Astro pages (`src/pages`)
- UI reusable: `src/components`
- Shell global: `src/layouts/AppShell.astro` (compone piezas en `src/components/shell/*`; ver `docs/code-locations.md`)
- Data access facade: `src/data/index.ts`
- Providers: mock y supabase
- Scripts cliente por pantalla: `src/scripts/<dominio>/*.ts` (p. ej. `login/`, `portfolio/`, `settings/`), más `core/`, `shell/`, `client-shell/`, `projects/project-detail/`, `technologies/technology-detail/`. El bootstrap global del layout vive en `client.ts` + `client-shell/*` + `shell/command-palette.ts`.
- **Despliegue Vercel**: `astro.config.mjs` usa `@astrojs/vercel` para que las rutas **on-demand** (p. ej. `/portfolio/[slug]` con `prerender = false`) generen la salida que Vercel espera. El adapter `@astrojs/node` sirve para un **proceso Node propio** (`node ./dist/server/entry.mjs`); en Vercel sin ese proceso el sitio puede responder **404** en todas las rutas.

### Acceso privado + solicitudes (invite-only)

La app está pensada como acceso privado por invitación. Para no depender de `mailto:` existe una pantalla pública:

- `/request-access`: formulario que inserta en `public.access_requests` (ver migración `docs/sql/saas-009-access-requests.sql`).
- Tras **`docs/sql/saas-010-admin-access-requests.sql`**: existe allowlist `public.admin_users`; usuarios en esa tabla pueden **SELECT/UPDATE** `access_requests` desde cliente. El resto de cuentas autenticadas **no** leen filas (RLS).
- **`/admin`**: página CSR protegida por sesión (`data-requires-auth`) + comprobación de admin en cliente; el enlace en cabecera y la entrada en el command palette solo se muestran si `isSkillAtlasAdmin` es true (caché corta en `sessionStorage`). **Cualquiera puede escribir la URL**: no es secreto; la confidencialidad depende de RLS y del login.

**Nota:** ser propietario del proyecto en Supabase **no** implica estar en `admin_users`; hay que insertar tu `auth.users.id` manualmente.

- **`/pricing`**: página de marketing estática + script `pricing-billing.ts` (toggle mensual/anual solo en cliente). Sin pasarela de pago acoplada; CTA coherente con invite-only (`/request-access`).

### Scripts cliente en Astro (importante)

Para que funcione igual en **dev** y **producción** (Vercel), los scripts cliente deben cargarse como **scripts procesados por Astro**:

- Usar `<script src="../scripts/mi-script.ts"></script>` (sin `type="module"`).
- Evitar servir `.ts` directamente por URL o usar `?url`, porque puede acabar en MIME incorrecto / imports a `.ts` en producción.

**Imports entre módulos `.ts` del cliente:** en `tsconfig.json` hay `compilerOptions.paths` (`@scripts/*`, `@config/*`, `@lib/*`, `@shaders/*`, `@i18n/*`, `@components/*`, …). Los archivos bajo `src/scripts/**` deben usarlos en lugar de rutas relativas largas; Vite los resuelve en dev y build (ver [Import aliases](https://docs.astro.build/es/guides/typescript/#import-aliases) en la documentación de Astro).

### Navegación sin recarga (View Transitions + Prefetch)

La app usa el router del navegador con **View Transitions** (`<ClientRouter />`) para que la navegación sea más fluida. Además, Astro hace **prefetch** de links (estrategia `viewport`) para reducir tiempos de carga.

Esto implica que scripts cliente que antes dependían de `DOMContentLoaded` deben ser **idempotentes** y re-ejecutarse en eventos del router (`astro:page-load`, `astro:after-swap`). En la práctica conviene registrar **ambos** (y `DOMContentLoaded` en la primera carga): en algunos casos solo uno de los eventos del router refleja el DOM ya sustituido.

**Auditoría (abr. 2026, punto 1 backlog):** además de los bootstraps CSR de `/projects/view` y `/technologies/view`, quedaron alineados con `astro:after-swap` (y guards anti-listeners duplicados donde aplica) entre otros: `portfolio-projects.ts`, `portfolio-public-profile.ts`, `projects.ts`, `technologies.ts`, `app-dashboard.ts`, `view-toggle.ts`, `study-workspace.ts`, `cv-page.ts`, `public-portfolio-by-token.ts`, `public-portfolio-by-slug.ts`. Otros módulos (`client.ts`, `command-palette.ts`, Ajustes, admin, etc.) ya seguían este patrón.

**Cabecera y estado activo:** el HTML prerenderizado solo refleja la ruta del **build** de esa página. Tras navegar en cliente, el boot (`client.ts`) llama a **`syncHeaderNavActive()`** (`client-shell/header-nav.ts`) para alinear `data-nav-active` en cada `[data-header-nav-link]` y `[data-admin-header-link]` con `location.pathname` (misma regla que `isActive` en `AppHeader.astro`).

**Indicador subrayado (nav):** el subrayado animado usa **`left` + `width`** en el elemento `[data-header-nav-indicator]` (anclado con `left-0` en el `<nav>`), no `translateX` horizontal, para evitar desalineación con **flex + `justify-center`** y con la animación de ancho al hacer hover.

**Precios en header:** no hay enlace a `/pricing` en la barra superior; **Precios** sigue en landing/hero y, con sesión, en el **footer** (`data-public-footer-pricing`).

**Portfolio público (visitante):** el HTML de cada proyecto en `/portfolio/<slug>`, `/p/<token>` y el preview CSR de `/portfolio` se genera con **`renderPortfolioVisitorCard`** (`src/lib/public-portfolio-project-card.ts`): jerarquía fija título → tecnologías → bloque historia → descripción → sección evidencia (varias incrustaciones si el RPC las devuelve); copy vía i18n `portfolio.public.*`. La lógica compartida de RPC + barra de controles (vista cuadrícula/lista, tope de evidencias, “menos animación”) está en **`public-portfolio-public-page.ts`**; preferencias del visitante en **`localStorage`** (`src/lib/public-portfolio-guest-prefs.ts`, clave por slug o token; en preview autenticado `preview:session`). Valores por defecto del autor: columnas `portfolio_profiles` + RPC tras **saas-013** (layout, evidencias, CTA) y **saas-014** (tema visual `public_theme`, densidad `public_density`, acento hex opcional, cabecera `public_header_style`, slugs destacados y su orden en el JSON); utilidades **`src/lib/portfolio-presentation.ts`** + `data-public-presentation-*` en el DOM; animación ligera y `prefers-reduced-motion` (`global.css`).

**Dashboard (`/app`):** `src/scripts/app/recent-activity.ts` guarda en `localStorage` (clave `skillatlas_recent_activity_v1`) las últimas aperturas de detalle **proyecto** y **tecnología**; la escritura ocurre en `projects/project-view-bootstrap.ts` y `technologies/technology-view-bootstrap.ts` tras cargar el recurso con éxito. `app/app-dashboard.ts` renderiza esas listas con marca de tiempo relativa, hidrata conteos y listas alfabéticas (8 ítems) vía Supabase cuando hay cliente y sesión, y escucha `skillatlas:auth-nav-updated` para refrescar. **Nota de producto:** si hiciera falta continuidad entre dispositivos, habría que persistir el historial en servidor (p. ej. prefs sync o tabla dedicada), no solo en `localStorage`.

**Insights / gráficos (plan):** siguiente vertical en `/app` — métricas **solo del usuario** en MVP (p. ej. conceptos por tecnología y `progress` desde tablas ya cubiertas por RLS); agregados **multi-usuario** y cualquier IA sobre datos solo vía **RPC agregadas / vistas fijas** + opt-in, no con SELECTs abiertos en cliente. Contexto e ideas relacionadas: **`docs/backlog.md`** (p. ej. ítem “Insights en `/app`” en ideas y frentes abiertos).

### Geo / país del usuario (futuro)

Ahora mismo, para elegir bandera/región usamos señales del navegador (**`navigator.language`** y fallback por **timezone**). Esto no garantiza ubicación física real.

Si en el futuro queremos detección real por país, hay opciones:

- **Headers Geo en el edge** (Vercel/Cloudflare) y render SSR/adapter (no aplica tal cual con `output: static` puro).
- **Endpoint propio** (serverless) que devuelva país/region y el cliente consuma (con rate-limit/cache).
- **Servicio externo** de geolocalización por IP (con cuidado de privacidad/consentimiento).

### Ajustes (`/settings`) y preferencias (abr. 2026)

- **Fragmento por defecto:** sin `#` en la URL se abre la sección **Preferencias** (`#prefs`) y se sincroniza el hash con `history.replaceState` (`settings-classic-ui.ts`). Los enlaces genéricos a Ajustes apuntan a **`/settings#prefs`**.
- **Modelo (`skillatlas_prefs_v1` / `AppPrefsV1`):** incluye **`uiFontScale`** (`sm` \| `md` \| `lg`) aplicado vía `--app-root-font-size` en `html` (`global.css` + `applyPrefs` + `AppShellHeadBootstrap.astro`). La **densidad compacta del shell** dejó de exponerse; se mantiene `density: "comfortable"` en datos por compatibilidad.
- **Idioma:** la UI va **solo en español**; `lang` en prefs se fuerza a `es`, `document.documentElement.dataset.langUiLocked = "1"`, i18n arranca en `es` (`i18n-bootstrap.ts`) y el toggle rápido de bandera en cabecera no cambia idioma. `en.json` queda como recurso **sin mantenimiento activo** hasta reactivar traducciones. **Futuro:** modal de idiomas con banderas (SVG en `public/icons/flags/*`) y más locales.

## Capa de datos

`src/data/index.ts` es la entrada unica:

- exporta tipos del dominio
- expone funciones async de consulta
- elige provider por `PUBLIC_DATA_SOURCE`

### Contrato actual (lectura)

- `getTechnologies()`
- `getConcepts()`
- `getProjects()`
- `getTechnologyById(id)`
- `getConceptsByTechnology(technologyId)`
- `getProjectsByTechnology(technologyId)`
- `getConceptById(id)`
- `getProjectById(id)`

## Provider Supabase

`src/data/providers/supabaseProvider.ts` transforma el esquema relacional a shape de UI:

- `technologies.slug` se usa como `technology.id` en UI
- `projects.slug` se usa como `project.id` en UI
- joins N:N:
  - `project_technologies`
  - `project_concepts`
- evidencias (`project_embeds`: `kind` `iframe` | `link`, `url`, `title`, `sort_order`)
- campos de historia en `projects`: `role`, `outcome` (texto nullable; ver **saas-006**)

En **build estatico**, las lecturas usan el cliente server-side de Supabase (sin cookie de usuario). Si fallan (p. ej. RLS sin filas visibles para `anon`), las funciones de carga devuelven **arrays vacios** para no romper `astro build`. El contenido real del usuario se obtiene en el navegador tras iniciar sesion.

## Rutas: mock vs Supabase (`PUBLIC_DATA_SOURCE`)

| Pantalla | `mock` | `supabase` |
|----------|--------|------------|
| Lista proyectos | `/projects` (datos en HTML del build) | `/projects` + CSR en `[data-projects-csr-mount]` |
| Detalle proyecto | `/projects/[projectId]` (`projectId` = id mock) | `/projects/view?project=<slug>` + `project-view-bootstrap.ts` |
| Lista tecnologias | `/technologies` | `/technologies` + CSR en `[data-technologies-csr-mount]` |
| Detalle tecnologia | `/technologies/[techId]` (`techId` = slug) | `/technologies/view?tech=<slug>` + `technology-view-bootstrap.ts` |
| Login | `/login` | `/login` (email/password + OAuth en cliente) |
| Ajustes | `/settings` | `/settings` (sesión, preferencias UI, perfil público + stack de ayuda; sync `portfolio_profiles` en Supabase; auth en `/login`) |
| CV (privado) | — | `/cv` — sesión obligatoria; editor + documento; selección y orden de proyectos (`cvProjectSlugs`), perfil del CV (`cvProfile`), experiencia/educación; **preview modal**; impresión en claro (`body.cv-print-mode`, `beforeprint`) |
| CV (público por token) | — | `/cv/p/<token>` — **SSR/on-demand** (`prerender = false`): anon llama RPC `skillatlas_cv_by_share_token`; se activa/regenera desde `/cv` (migración **saas-012**) |
| Portfolio público (slug) | — | `/portfolio/<slug>` — **SSR/on-demand** (`prerender = false`): anon llama RPC `skillatlas_portfolio_by_public_slug`; Ajustes → **Enlaces públicos** (`#portfolio-links`): **saas-011**–**014** |
| Portfolio público (token) | — | `/p/<token>` — **SSR/on-demand** (`prerender = false`): anon llama RPC `skillatlas_portfolio_by_share_token` (misma forma JSON que slug); token en Ajustes (requiere `share_enabled`) |

Los componentes `ProjectCard.astro` y `TechnologyCard.astro` enlazan a las rutas CSR cuando el data source es Supabase. `project-detail.ts` no inicializa formularios si existe `[data-project-csr-mount]` (evita doble enganche).

El header usa un chequeo de sesión en cliente (sin SSR) para:

- mostrar `/login` cuando no hay sesión
- mostrar `Ajustes` + botón **Sign out** cuando hay sesión
- pintar avatar de usuario si `user_metadata.avatar_url` o `user_metadata.picture` existe

## UI Actions (cliente)

Scripts principales:

- `technologies.ts` -> formulario nueva tecnologia (busqueda de **catalogo** con plantillas `concept-seeds`) + CSR de la rejilla + editar/eliminar
- `technology-detail.ts` -> entrypoint detalle tecnologia (SSR mock); delega en `technology-detail/runner.ts`
- `technology-view-bootstrap.ts` -> montaje CSR del detalle tecnologia (Supabase)
- `projects.ts` -> crear proyecto + CSR lista proyectos (Supabase)
- `project-detail.ts` -> entrypoint detalle proyecto en paginas Astro con DOM estatico; delega en `project-detail/runner.ts`
- `project-view-bootstrap.ts` -> montaje CSR del detalle proyecto (Supabase); ver sección **Proyectos** abajo
- `src/lib/evidence-url.ts` -> detección heurística de origen de URL y normalización de iframe (Tableau Public)
- `auth-session.ts` -> `getSessionUserId()` para adjuntar `user_id` en inserts
- `client-supabase.ts` -> `getSupabaseBrowserClient()` para scripts en navegador
- `ui-feedback.ts` -> modales y toasts (`showToast` con tipos `success` | `error` | `info` | `warning`, escape HTML del mensaje, `role="status"`); **`userFacingDbError`** para acortar/mapear errores típicos de Supabase/Postgres en copy legible (español) antes de mostrarlos en feedback inline o toasts
- `login-auth.ts` -> login/signup email+password + OAuth en `/login`
- `login-earth.ts` -> escena Three.js (Earth) en background del login
- `settings-profile.ts` -> nombre/bio/stack de ayuda + avatar; **Enlaces públicos**: visibilidad y slug se confirman con **Aplicar** (toast); `share_enabled` / `public_slug` en `portfolio_profiles`; token `/p/…` copiar/regenerar; `public-profile-local.ts` + upsert `portfolio_profiles`
- `cv-page.ts` -> `/cv` (privado): editor completo (perfil, resumen, stack, experiencia/educación), selección + orden de proyectos (`cvProjectSlugs`), preview modal, impresión/PDF en claro
- `public-cv-by-token.ts` -> `/cv/p/<token>` (público): render de CV desde RPC `skillatlas_cv_by_share_token`
- `public-portfolio-by-token.ts` -> `/p/<token>` (público): render de portfolio desde RPC `skillatlas_portfolio_by_share_token`
- `portfolio-public-profile.ts` -> hidrata cabecera de `/portfolio` desde Supabase o localStorage; chips de **stack de ayuda**
## Ajustes (`/settings`) — layout y perfil (v0.10+)

### Preferencias (`skillatlas_prefs_v1`)

Además de tema, densidad, fuente, acento, movimiento, vistas lista/cards, iconos del header y visibilidad del selector de idioma:

- **`settingsSidebarSide`**: barra lateral de navegación en `/settings` a izquierda o derecha.
- **`settingsActiveSection`**: última sección de Ajustes abierta. IDs de panel (hash `#…`): `prefs`, `shortcuts`, `portfolio-profile`, `portfolio-links`, `portfolio-display`, `portfolio-presentation`, `cv-public`, `qa` (lista canónica en `SETTINGS_PANEL_IDS` en `src/scripts/core/prefs.ts`). Si la URL o prefs guardadas usan el prefijo antiguo `#classic-*`, el cliente **normaliza** a los ids nuevos (`migrateSettingsPanelHashFragment`, `replaceState` en `settings/settings-classic-ui.ts`).
- **`cvProjectSlugs`** (opcional): array de slugs de proyectos incluidos en `/cv`; ausente = todos; vacío = ninguno; el orden del array es el orden del CV (drag & drop en el editor). Persistido en `user_prefs` y caché local `skillatlas_prefs_v1`.
- **`cvProfile`** (opcional): datos privados del CV guardados en prefs: `headline`, `location`, `email`, `links`, `summary`, `highlights`, `experiences[]`, `education[]`, `showHelpStack`, `showPhoto` y `photoSource` (subida vs LinkedIn/proveedor).
- **`qaTesterMode`** (opcional): habilita UI de **Onboarding/QA** (checklist, seed demo, copiar debug info) en `/settings`. La checklist se guarda localmente en `localStorage` (`skillatlas_qa_v1`).

### Onboarding/QA (tester mode)

- UI en Ajustes → sección **Onboarding / QA** (`#qa`): toggle “modo tester”, checklist rápida, botón de **seed demo** y “copiar debug info”.
- Implementación: `src/scripts/settings/settings-qa.ts` + persistencia en prefs (`user_prefs`).

## OG previews (portfolio público)

- Las páginas públicas `/portfolio/<slug>` y `/p/<token>` incluyen meta tags **OG/Twitter** server-side para previews al compartir.
- `og:image` apunta a un endpoint SSR: `/og/portfolio.svg?slug=...` o `/og/portfolio.svg?token=...` que resuelve datos vía RPC (`skillatlas_portfolio_by_public_slug` / `skillatlas_portfolio_by_share_token`).
- Helpers server-side: `src/lib/server-supabase-rpc.ts` (llamada anon a RPC por REST).

### CV (`/cv`) — sincronización con Ajustes

- **Base profile (Ajustes)**: `display_name`, `bio`, `avatar_url` y `help_stack` viven en `portfolio_profiles`. En `/cv` se muestran y, si están vacíos, se pueden completar **también desde /cv** (se hace upsert a la misma fila).
- **Foto**: por defecto el CV usa:
  1) foto subida (`portfolio_profiles.avatar_url` + signed URL) si existe  
  2) si no, avatar del provider (LinkedIn `user_metadata.picture`)  
  En el editor hay botones suaves para elegir fuente (`photoSource`) sin sobrescribir la foto subida.
- **Preview**: botón “Preview” abre un modal y renderiza el CV completo sin salir de la página.
- **Print/PDF**: se fuerza tema claro en impresión (evento `beforeprint` + CSS `@media print`).

### Perfil y stack de ayuda

- **Nombre público** y **bio**: edición en cliente; **upsert** a `portfolio_profiles` (`display_name`, `bio`) con sesión; caché en `public-profile-local.ts` (`skillatlas_public_profile_v1`).
- **Stack de ayuda**: lista de herramientas (productividad / IA) definidas en `src/config/help-stack.ts`; persistencia en columna **`help_stack`** (JSONB) tras `docs/sql/saas-005-portfolio-help-stack.sql`, con reintento del cliente si la columna aún no existe.
- **Avatar**: `portfolio_profiles.avatar_url` + Storage bucket `portfolio_avatars` (migración `docs/sql/saas-008-portfolio-avatar.sql`). En cliente se sube la imagen y en `/portfolio` se hidrata (signed URL si aplica) con fallback al avatar del último provider OAuth.
- **`portfolio-public-profile.ts`**: en `/portfolio` muestra nombre/bio y chips del stack (Supabase + fallback local).
- **URL pública** (`#portfolio-links`): checkbox de visibilidad + campo slug (`src/lib/public-portfolio-slug.ts`); vista previa y copiar enlace; la persistencia en Supabase ocurre al pulsar **Aplicar visibilidad y slug** (toast éxito/error); **Guardar perfil** cubre nombre, bio, enlaces y stack, no sustituye a Aplicar en esta sección. Columnas **saas-011** (`share_enabled`, `public_slug`); enlace por token `/p/<token>` (**saas-003**) con regeneración en la misma tarjeta.

### Idioma (UI)

- Selector global en header: **banderas** 🇪🇸 / 🇬🇧 (sustituye al `<select>`); misma idea en Preferencias de Ajustes.

### Footer (`src/components/shell/AppFooter.astro`)

- Bloque “Hecho con” con logos (Astro, Tailwind, TypeScript, Vite, Supabase) y navegación secundaria.

### Catálogo de iconos de tecnologías

- `src/config/icons.ts`: mapas por categorías (lenguajes, web, data, BBDD, data engineering, BI, cloud, DevOps, etc.) exportando `iconByKey` / `getTechnologyIconSrc`.

### Import de conceptos — extras

- **Vista previa**: acciones por nivel, por categoría (sección) y globales (“Todos visibles” / “Ninguno”); listener delegado en el panel de revisión.
- **Plantillas Markdown** (`public/static/concept-seeds/*.md`): comentarios `<!-- skillatlas-tier: … -->`; script opcional `scripts/annotate-concept-seed-tiers.mjs` para reparto por cuartiles en ficheros sin marcas (omite los que ya contienen `skillatlas-tier`).
- **Alta de tecnología** (`/technologies`): sugerencias del catálogo con **icono** por fila, lista completa ordenada y altura de panel con scroll (`max-h-[min(70vh,28rem)]`).

## Tradeoffs actuales

- Hay bastante logica en scripts cliente (rapido para MVP).
- Para escalar, conviene:
  - extraer servicios compartidos de Supabase por entidad
  - reducir logica duplicada en scripts
  - mover mas validacion a DB (constraints + unique indexes)

## Landing (`/`) — scroll horizontal

El hero usa **full-bleed** (`w-screen` centrado con `left-1/2 -translate-x-1/2`). Para evitar **scroll horizontal** por `100vw`/blobs sin recortar el diseño del fondo, `src/styles/global.css` aplica **`overflow-x: hidden`** en `html` y `body` (la sección mantiene `overflow-x-clip`).

## Web pública (landing) + app privada (plan)

Objetivo de producto: `skillatlas.app` sirve una **landing pública** en `/` y la app (CRUD + dashboard) queda **privada** para usuarios invitados.

Decisiones (2026-03-31):

- `/` será una landing de marketing (estilo product site), no el dashboard.
- `/login` existe pero se mantiene **oculto** (no enlazado públicamente); acceso solo por invitación.
- Rutas internas (`/app`, `/projects*`, `/technologies*`, `/settings`) se protegen para usuarios autenticados e invitados.

Implicaciones técnicas:

- Banner global sticky con versión/noticias (`AppGlobalBanner.astro` + `client-shell/global-banner.ts`, config `src/config/banner.ts`, cierre persistente y botón de re-apertura en header).
- Navegación cruzada:
  - desde la app: link a `/` (landing)
  - desde landing: CTA “Entrar” condicionado a sesión/invitación
- Control de acceso: “invites only” (Supabase Auth + checks en UI).
  - Guard de rutas en cliente con `data-requires-auth` (redirección a `/` si no hay sesión).
  - `/login`: se deshabilita signup en UI (solo login + OAuth).
  - `/demo`: página pública estática para enseñar el look & feel sin depender de sesión ni de datos.

## Roadmap (producto prioritario)

Plan detallado para **multiusuario + portfolio por enlace compartido**: `docs/plan-saas-multi-tenant-portfolio.md`. Decision actual para la app interna: **CSR** (sin adapter SSR); el portfolio publico por token usa la RPC `skillatlas_portfolio_by_share_token` (`docs/sql/saas-003-fn-portfolio-share.sql`, **extendida** por `docs/sql/saas-006-projects-role-outcome.sql` con `role` y `outcome` por proyecto en el JSON).

## Decisiones UX (local-first)

- Preferencias globales (fuente/tema/densidad/etc.) empiezan en **localStorage** (sin sync multi-dispositivo en la primera iteración).
- Import semiautomático por tecnología: fuentes **URL + texto**, con preview y revisión antes de crear conceptos.
- Documentación: **1 Tech Note por tecnología** (markdown) además de conceptos.

Implementación (Sprint A):
- Preferencias guardadas en `localStorage` (`skillatlas_prefs_v1`) y aplicadas en `AppShellHeadBootstrap.astro` (script inline en `<head>`) + `client.ts` / `client-shell/prefs-bootstrap.ts`.
- UI en `/settings` con `src/scripts/settings/settings-prefs.ts` + `src/scripts/settings/settings-classic-ui.ts` (navegación lateral y un panel visible por sección; hash `#prefs`, `#portfolio-links`, etc.; compatibilidad con bookmarks `#classic-*` vía migración en cliente).
- Cache de navegación ligera para CSR lists en `sessionStorage` (TTL 2 min) en `src/scripts/projects/projects.ts` y `src/scripts/technologies/technologies.ts`.

Mejoras UX (Sprint A+):
- **Command Palette:** el **botón en cabecera** ya existe (`[data-command-palette-trigger]` en `AppHeader.astro`, mismo flujo que `Ctrl+K` y `/` fuera de campos de texto). La evolución prevista es **enriquecer** la paleta (búsqueda de entidades, más acciones), no duplicarla. Ver **Plan de implementación por iteración** en `docs/backlog.md`.
- **Burbujas flotantes (FAB):** patrón planificado para atajos visibles y onboarding corto (y extensiones futuras); detalle en el mismo apartado del backlog.
- Toggle Cards/Lista en páginas (sin pasar por Ajustes) y persistencia en prefs.
- Preferencias de UI: mostrar/ocultar iconos del header y selector de idioma por **banderas** (con opción de ocultar el bloque en el header).
- Listado de **atajos de teclado** documentado en la tarjeta correspondiente de Ajustes.

## Proyectos: historia + evidencias (implementado)

Modelo de producto: cada proyecto combina **historia** (contexto narrativo) y **evidencias** (piezas demostrables: enlaces o iframes). Las evidencias son el foco de la UX en detalle CSR; no hay subida de archivos en esta iteración.

### Historia (`projects`)

- **Título** y **descripción** (existentes).
- **`role`**: rol o responsabilidad (p. ej. “Data analyst”).
- **`outcome`**: resultado o impacto en texto libre.
- Edición: modal **`projectEditModal`** (`src/scripts/core/ui-feedback.ts`) invocado desde **`initProjectEdit`** (`projects/project-detail/project.ts`). Persistencia: `UPDATE projects` con `slug` en sesión.

### Evidencias (`project_embeds`)

- Cada fila: `kind` (`iframe` | `link`), `title`, `url`, `sort_order` (entero; orden visible con botones Subir/Bajar e intercambio de `sort_order` en BD).
- **Plantillas rápidas**: chips (`src/config/evidence-templates.ts`, `initProjectEvidenceTemplates` en `project-detail/embeds.ts`) rellenan el input con URLs de ejemplo (segmentos en MAYÚSCULAS) para alinear el hint con Tableau, GitHub, etc.
- **Añadir desde URL (rápido)**: input + “Revisar y añadir” → abre **`embedEditModal`** con URL rellena y tipo sugerido; confirmación inserta fila (`initProjectEvidenceQuickAdd` en `project-detail/embeds.ts`).
- **Añadir (formulario completo)**: mismo modal desde cero (`initProjectEmbedAdd`).
- **Edición / borrado / reordenación**: `initProjectEmbedEdit`, `initProjectEmbedRemove`, `initProjectEmbedMove`.
- El modal de evidencia muestra **hint** según la URL (input en vivo): sugiere `iframe` vs `link`; el título puede quedar vacío y se usa la **etiqueta detectada** (p. ej. “GitHub”) al guardar.

### Detección de URL (`src/lib/evidence-url.ts`)

- **`detectEvidenceUrl(raw)`**: según `hostname`, devuelve `sourceKey`, `sourceLabel` (ES), `suggestedKind`, `hint`. Cubre entre otros: Tableau, Power BI (web), GitHub, Looker Studio, YouTube, Notion, Observable; resto → enlace por defecto con hint conservador.
- **`embedIframeSrc(url)`**: aplica parámetros típicos de **Tableau Public** para embed; otros hosts pasan la URL tal cual (el usuario puede cambiar a “solo enlace” si el iframe falla).
- **`evidenceSiteIconUrl(url)`**: URL de favicon vía servicio público (sin fetch al dominio del usuario); usado en lista de evidencias CSR, **`embedEditModal`** y **`EmbedCard.astro`**.
- Uso: bootstrap CSR, modales, tarjetas numeradas con chip de `sourceLabel`; **`EmbedCard.astro`** (portfolio / mock) usa `embedIframeSrc` para iframes.

### Superficies de UI

| Superficie | Comportamiento |
|------------|----------------|
| `/projects/view?project=<slug>` | HTML generado por **`project-view-bootstrap.ts`**; orden secciones: cabecera (historia + pills tech), **Evidencias**, tecnologías, conceptos. |
| `/projects` (CSR) | **`projects.ts`**: lista/cards; muestra **rol** si existe (línea secundaria). |
| `/portfolio` (Supabase) | **CSR**: cards renderizadas en cliente con sesión (evita vacíos por RLS en build). Script: **`src/scripts/portfolio/portfolio-projects.ts`**. |
| `/projects/[projectId]` (mock) | Misma idea de historia en cabecera; sección “Evidencias”; sin detección en caliente (datos estáticos). |

### Dominio TypeScript (`src/data`)

- Tipo **`Project`** en `mock.ts` incluye `role` y `outcome` (strings; vacío si no hay dato).
- **`supabaseProvider`** lee `role` y `outcome` en el `select` de proyectos.

### Limitaciones y deuda conocida

- Textos del detalle CSR y parte de la lista están **en español fijo** en HTML generado; **i18n** unificado queda para más adelante.
- No hay **plantillas por tipo de proyecto** (metadato del proyecto); sí plantillas de **URL de evidencia** (chips). Preview **favicon** sí; **Open Graph / capturas** automáticas no.
- **Archivos** (.pbix, PDF alojados, etc.): fuera de alcance; el producto asume URL pública o servicio que permita embed/enlace.

## Portfolio (iteración CSR Supabase)

En modo Supabase con RLS multi-tenant, el build estático no puede listar datos del usuario con la anon key. Por eso `/portfolio` hace:

- Cabecera (perfil + stack de ayuda) en cliente: `portfolio-public-profile.ts`.
- **Listado de proyectos** en cliente: `portfolio-projects.ts`:
  - lee `projects`, `project_technologies`, `technologies`, `project_embeds`
  - pinta cards con **historia** (rol/resultado), pills de tecnologías con icono y color suave, y evidencia primaria (iframe/enlace + chip de origen + favicon)
  - filtro por tecnología sincronizado a `?tech=...`

### Nota: Supabase client singleton

Para evitar warnings de Supabase (`Multiple GoTrueClient instances detected`), `getSupabaseBrowserClient()` cachea un singleton en `src/scripts/core/client-supabase.ts` (una instancia por pestaña).

### Siguiente iteración sugerida (producto)

- ~~Plantillas de URL (chips Tableau / GitHub / …) y favicon en lista + modal~~ **Hecho** (`evidence-templates.ts`, `evidenceSiteIconUrl`).
- Preview rico opcional (**og:image**, título de página) vía proxy o backend si se desea (CORS y rate limits).
- Considerar columna opcional `source_key` en `project_embeds` si se quiere persistir la detección (hoy se recalcula desde `url`).

## Sprint B (import semi-automático de conceptos por tecnología) — **implementado (MVP)**

Ubicación: `/technologies/view?tech=<slug>` (CSR), sección **Conceptos**.

### Código (layout)

- `technology-view-bootstrap.ts`: montaje HTML (formulario concepto, bloque import, lista `[data-concept-list]`).
- `technology-detail/concept-import.ts`: parseo Markdown, filtros de calidad, vista previa agrupada, URL/texto, quick import, hook `ImportEnricher`.
- `technology-detail/concept-list-html.ts`: HTML reutilizable de filas de conceptos + refresco de lista.
- `technology-detail/concept-actions.ts`: editar/eliminar concepto (evita dependencia circular con el import).
- `technology-detail/runner.ts`: `initConceptForm`, `initConceptActions`, `initConceptImport`.
- `technology-detail/concept-seeds.ts`: mapa slug → fichero, alias, `getSeedCatalogEntries()` para el picker en `/technologies`.
- `ui-feedback.ts`: `markdownEditorModal` para editar el Markdown en ventana amplia.

### Fuentes y limitaciones

- **URL** + **texto** pegado. El fetch de URL desde el navegador depende de **CORS** del sitio remoto; si falla, el UX pide usar el tab de texto. Lo habitual para documentación “oficial” en HTML es **no** servir como `.md` plano; el usuario pega Markdown o usa plantilla local.
- **Catálogos sugeridos**: `public/static/concept-seeds/<fichero>.md`; registro y alias en `concept-seeds.ts`. Botón **Cargar catálogo sugerido** si el slug de la tecnología tiene entrada (p. ej. `python`, `snowflake`, `power-bi` vía alias `powerbi`).
- **Alta de tecnología** (`/technologies`): campo de nombre con lista filtrable del mismo catálogo; al elegir una fila se fija el **slug** de plantilla; si se edita el nombre a mano, el slug vuelve a derivarse con la regla habitual.
- Extracción: headings `##`, bullets (`-`, `*`, numeradas), comentarios HTML de nivel (ver más abajo); **sin IA** en v1.

### Filtros de calidad

Implementados en `IMPORT_QUALITY` dentro de `concept-import.ts` (longitud min/max, palabras máx., comas, heurística de párrafo). Los omitidos se cuentan en la vista previa.

### Categoría y nivel (tier)

- **Categoría**: último `##` previo al bullet → prefijo en `notes`: `[cat:…]`.
- **Nivel** (Iniciación / Junior / Mid / Senior): comentario opcional en el Markdown antes de secciones, p. ej. `<!-- skillatlas-tier: junior -->` (aliases: `principiante`, `intermedio`, `avanzado`, etc.). Sin marca, los conceptos van a **mid**. Persistencia en `notes`: `[tier:…]`.
- Vista previa: agrupación por **nivel** (acordeón abierto por defecto) y dentro por **categoría** (idem); filtro desplegable **Nivel** + búsqueda por texto. Botón de acción principal: **Generar vista previa** (antes “extraer candidatos”).
- **Editor amplio**: botón que abre modal con textarea grande para pegar/editar el Markdown del import.

### Tags (MVP)

- Tag en UI: slug derivado del texto del heading de sección (no columna propia en DB).

### Hook IA (futuro)

- `ImportEnricher` en `concept-import.ts`; implementación por defecto identidad. Tras enriquecer se recalculan duplicados frente a BD.

### Quick import

- Botón con confirmación; mismos filtros y dedupe; sin paso de revisión detallada.

### Tras importar

- Se actualiza la lista de conceptos y cabeceras de contadores **sin** `location.reload`; se vuelven a enlazar acciones en lista.


## Assets 3D del login (Earth)

- Shaders: `src/shaders/{earth,atmosphere}/*.glsl`
- Texturas: `public/static/earth/{day,night,specularClouds}.jpg`
- Script: `src/scripts/login/login-earth.ts` (usa `three` + `OrbitControls`)

