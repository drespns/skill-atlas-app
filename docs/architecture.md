# Architecture

## Vista general

Astro genera sitio **estatico** (`output: static`). Las paginas se prerenderizan en build; la **app autenticada con Supabase** carga listas y detalles **en el cliente (CSR)** cuando RLS no permite leer todo el dataset con la anon key sin sesion.

- Render: Astro pages (`src/pages`)
- UI reusable: `src/components`
- Shell global: `src/layouts/AppShell.astro`
- Data access facade: `src/data/index.ts`
- Providers: mock y supabase
- Scripts cliente por pantalla: `src/scripts/*.ts` y subcarpetas (`project-detail/`, `technology-detail/`)

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
- `ui-feedback.ts` -> modales y toasts
- `login-auth.ts` -> login/signup email+password + OAuth en `/login`
- `login-earth.ts` -> escena Three.js (Earth) en background del login
- `settings-profile.ts` -> nombre/bio/stack de ayuda; `public-profile-local.ts` + upsert `portfolio_profiles`
- `portfolio-public-profile.ts` -> hidrata cabecera de `/portfolio` desde Supabase o localStorage; chips de **stack de ayuda**
- `settings-dashboard.ts` -> grid de Ajustes: columnas configurables + orden de tarjetas (drag & drop) persistido en prefs

## Ajustes (`/settings`) — layout y perfil (v0.10+)

### Preferencias (`skillatlas_prefs_v1`)

Además de tema, densidad, fuente, acento, movimiento, vistas lista/cards, iconos del header y visibilidad del selector de idioma:

- **`settingsGridColumns`**: 1–4 columnas en viewport ≥ `md` (en móvil siempre 1). Selector en Preferencias.
- **`settingsSectionOrder`**: orden de las tarjetas `prefs` | `shortcuts` | `portfolio` (sesión y acciones de cuenta van en la barra fija superior, sin arrastre).

### Perfil y stack de ayuda

- **Nombre público** y **bio**: edición en cliente; **upsert** a `portfolio_profiles` (`display_name`, `bio`) con sesión; caché en `public-profile-local.ts` (`skillatlas_public_profile_v1`).
- **Stack de ayuda**: lista de herramientas (productividad / IA) definidas en `src/config/help-stack.ts`; persistencia en columna **`help_stack`** (JSONB) tras `docs/sql/saas-005-portfolio-help-stack.sql`, con reintento del cliente si la columna aún no existe.
- **`portfolio-public-profile.ts`**: en `/portfolio` muestra nombre/bio y chips del stack (Supabase + fallback local).

### Idioma (UI)

- Selector global en header: **banderas** 🇪🇸 / 🇬🇧 (sustituye al `<select>`); misma idea en Preferencias de Ajustes.

### Footer (`AppShell.astro`)

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

## Web pública (landing) + app privada (plan)

Objetivo de producto: `skillatlas.app` sirve una **landing pública** en `/` y la app (CRUD + dashboard) queda **privada** para usuarios invitados.

Decisiones (2026-03-31):

- `/` será una landing de marketing (estilo product site), no el dashboard.
- `/login` existe pero se mantiene **oculto** (no enlazado públicamente); acceso solo por invitación.
- Rutas internas (`/app`, `/projects*`, `/technologies*`, `/settings`) se protegen para usuarios autenticados e invitados.

Implicaciones técnicas:

- Banner global sticky con versión/noticias (en `AppShell.astro`, config en `src/config/banner.ts`, cierre persistente y botón de re-apertura en header).
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
- Preferencias guardadas en `localStorage` (`skillatlas_prefs_v1`) y aplicadas en `AppShell.astro` (script inline en `<head>`) + `src/scripts/client.ts`.
- UI en `/settings` con `src/scripts/settings-prefs.ts` + `settings-dashboard.ts` (grid/columnas/orden).
- Cache de navegación ligera para CSR lists en `sessionStorage` (TTL 2 min) en `src/scripts/{projects,technologies}.ts`.

Mejoras UX (Sprint A+):
- Botón visible para Command Palette en header (además de `Ctrl+K` y tecla `/` fuera de campos de texto).
- Toggle Cards/Lista en páginas (sin pasar por Ajustes) y persistencia en prefs.
- Preferencias de UI: mostrar/ocultar iconos del header y selector de idioma por **banderas** (con opción de ocultar el bloque en el header).
- Listado de **atajos de teclado** documentado en la tarjeta correspondiente de Ajustes.

## Proyectos: historia + evidencias (implementado)

Modelo de producto: cada proyecto combina **historia** (contexto narrativo) y **evidencias** (piezas demostrables: enlaces o iframes). Las evidencias son el foco de la UX en detalle CSR; no hay subida de archivos en esta iteración.

### Historia (`projects`)

- **Título** y **descripción** (existentes).
- **`role`**: rol o responsabilidad (p. ej. “Data analyst”).
- **`outcome`**: resultado o impacto en texto libre.
- Edición: modal **`projectEditModal`** (`src/scripts/ui-feedback.ts`) invocado desde **`initProjectEdit`** (`project-detail/project.ts`). Persistencia: `UPDATE projects` con `slug` en sesión.

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
| `/portfolio` (Supabase) | **CSR**: cards renderizadas en cliente con sesión (evita vacíos por RLS en build). Script: **`src/scripts/portfolio-projects.ts`**. |
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

Para evitar warnings de Supabase (`Multiple GoTrueClient instances detected`), `getSupabaseBrowserClient()` cachea un singleton en `src/scripts/client-supabase.ts` (una instancia por pestaña).

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
- Script: `src/scripts/login-earth.ts` (usa `three` + `OrbitControls`)

