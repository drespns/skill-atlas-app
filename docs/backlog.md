# Backlog

Documento orientado al **historial** de lo implementado y a **ideas** sin orden de prioridad fijo. Detalle de esquema y migraciones: **`docs/db.md`**. Plan multi-tenant ampliado: **`docs/plan-saas-multi-tenant-portfolio.md`**.

**Convención:** las versiones de producto siguen **`package.json`** y tags Git anotados (`git tag -l`, `git show v0.100.0`). Esta sección intenta listar **todo lo hecho hasta la versión actual**; las ideas futuras siguen al final y **no se borran** salvo decisión explícita.

**Proceso de documentación (cada iteración con alcance de producto):** al cerrar un bloque de trabajo que añada o cambie **funcionalidad** visible (flujos, pantallas, prefs, SQL, rutas), actualizar **este `backlog.md`** en la entrada de versión en curso (o la siguiente) con bullets concretos por área, para que el historial refleje lo implementado. Los **fixes** puntuales o de calidad sin cambio de producto no requieren línea obligatoria; usar criterio.

---

## Registro de versiones (historial de producto)

### v0.130.0 (actual)

**Numeración:** el trabajo acumulado que estaba documentado como salida **0.120.x** se publica como **0.130.0** (salto de versión por alcance: Estudio, `/tools` ampliado, CV, admin, SQL y sync en cuenta).

- **Command palette:** fondo del overlay más suave (`backdrop` ligero, viñetas de color atenuadas, panel un poco más opaco); entradas para **todas** las rutas bajo `/tools` (además de `/backlog`, `/contact`, etc.).
- **CV (`/cv`):**
  - Botón **Descargar JSON** en la cabecera (mismo payload que el respaldo del editor).
  - **Vaciar contenido** con modal in-app (mismo patrón que import/preview), sin `window.confirm`.
  - Proyectos en CV: copy alineado con portfolio; **proyecto destacado** opcional (`cvFeaturedProjectSlug` en `cvProfile`); el resto en **lista compacta** en vista previa e impresión; CV público por token respeta destacado si viene en el JSON del perfil.
- **Estudio (`/study`):**
  - Carpetas **definidas por el usuario** (`customStudyFolders` + asignación en `sourceFolderById`), persistidas en local junto al workspace; fusión al hidratar desde Supabase.
  - Iconos **VS Code Codicons** (`@vscode/codicons`) para carpeta y asa de arrastre.
  - Panel central tipo IDE con cabecera y dock más **visibles** (gradiente, anillo, borde).
- **Admin (`/admin`):**
  - Bloque **Usuarios y sesión**: `GET /api/admin/stats` (JWT de sesión + fila `admin_users` + opcional `SUPABASE_SERVICE_ROLE_KEY` en servidor) lista usuarios Auth (email, creado, último login, provider). Sin service role, mensaje de configuración.
- **Importación GitHub:** confirmado estable en uso real (stack / evidencia).
- **Herramientas (`/tools`) — hub ampliado (cliente, sin servidor salvo lo ya existente):**
  - Enlace **Herramientas** en cabecera (solo con sesión) con **popover desplazable** y listado de accesos directos; pie y palette alineados.
  - **Hub** `/tools` con tarjetas (grid responsive) hacia: **hábitos**, **convertidor** (imágenes en cliente; resto marcado Pro), **vista Markdown/README** (`marked` + saneado `DOMPurify`), **bio corta**, **título/slug**, **checklist pre-entrevista** (localStorage + JSON), **Pomodoro**, **cronómetro de charla** (avisos 2′/1′/0), **diff de texto** (`diff`), **JSON** (formatear/minificar), **snippet HTML escapado**, **estimación bruto→neto**, **generador `.gitignore`** (`src/lib/tools-gitignore-parts.ts`), **código QR** (`qrcode`).
  - Dependencias nuevas en bundle: `marked`, `dompurify`, `diff`, `qrcode` (+ tipos dev `@types/dompurify` donde aplica).
- **Producto — historial visible:**
  - Ruta `/backlog` que muestra el historial por versiones (derivado de `docs/backlog.md`).
- **Bubble (FAB) — utilidades:**
  - Pestañas nuevas: Calendario (notas por fecha) y Curiosidades (links).
  - Se quitan “Primeros pasos” y “Contacto” del bubble (onboarding + ruta `/contact`).
- **Contacto:**
  - Ruta `/contact` enlazada desde Ajustes (menú de usuario).
  - `/request-access` renovado con enlace a `/contact`.
- **Estudio (`/study`) — fase 1 (persistencia):**
  - Tablas Supabase + RLS: `study_sources` (links/notas) y `study_workspaces` (activeIds + sessionNotes).
  - La UI hidrata desde Supabase con sesión y mantiene fallback/cache en `localStorage` (migración 1 vez si remoto está vacío).
- **Estudio (`/study`) — fase 2 (subida de archivos):**
  - Bucket Storage `study_files` + policies para subir/leer/borrar solo lo propio.
  - UI para adjuntar archivos (PDF/TXT/MD) como fuentes y mantenerlos en el contexto.
- **Estudio (`/study`) — fase 3 (extracción de texto):**
  - Extracción best-effort de texto al subir fuentes tipo archivo: TXT/MD directo y PDF vía `pdfjs-dist`.
  - Persistencia del texto extraído en `study_sources.body` (base para chat/RAG en fases posteriores).
- **Estudio — dossiers y objetivo (cuenta):**
  - Dossiers: sincronización **remote-first** vía `user_client_state` scope `study_dossiers` (mantiene `localStorage` como caché).
  - Campo **Objetivo** (etiqueta de convocatoria/temario) en `user_client_state` scope `study_prefs`; visible en `/app`.
- **Dashboard (`/app`) — bloque Estudio:**
  - Conteos de fuentes, chunks, notas guardadas y dossiers + CTA a `/study`.
- **Estudio — Nivel A (SkillAtlas) + temario:**
  - SQL **`saas-025`**: proyecto opcional vinculado al workspace + tabla `study_workspace_technologies`.
  - UI en `/study`: selector de **proyecto** y multiselect de **tecnologías** del usuario; avisos en detalle de **proyecto** / **tecnología** cuando hay vínculo.
  - **Temario** (bloques → temas con estado todo/doing/done) persistido en `user_client_state` scope **`study_curriculum`**.
- **Catálogo:** plantilla **SciPy** ampliada con `optimize.linprog`; el catálogo curado no intenta listar todo PyPI/npm — **librerías/paquetes** los crea el usuario en **Tecnologías** (import por URL / flujos propios: ver ideas en backlog).
- **Tecnologías — registro npm/PyPI:** `POST /api/tech-registry-lookup` (sesión) + botón **Buscar npm/PyPI** y slug opcional en el formulario; rellena nombre/slug/tipo sugerido desde metadatos públicos (icono sigue siendo catálogo / clave local).
- **Proyectos — duplicar:** botón en detalle CSR que copia proyecto (stack, conceptos enlazados, evidencias); sin copiar portada.
- **Actividad reciente:** scope `user_client_state` **`recent_activity`**; merge con `localStorage` al iniciar sesión y guardado tras cada visita.
- **Dashboard:** línea de progreso del **temario** (`study_curriculum`: temas hechos / total).
- **`/prep`:** bloque “qué usar ya” con enlaces a `/app`, `/technologies`, `/study`.
- **Estudio (`/study`) — fase 3 (chat + citas interactivas):**
  - Endpoint `POST /api/study/chat` (feature flag servidor `STUDY_CHAT_ENABLED`): RAG sobre chunks Postgres, respuesta con citas numeradas; cada cita incluye **`body`** (texto del chunk, capado) para resaltar en cliente sin otra petición.
  - UI en `/study`: mensajes del asistente con botones **`[[n]]`**; panel de cita con fragmento resaltado (`<mark>`), enlace “Abrir fuente” y “Resaltar en lista” (scroll + anillo en la fila de fuentes).
  - La caja de chat solo se habilita si `PUBLIC_STUDY_CHAT_ENABLED=true` (el servidor puede seguir apagado con 404 hasta activar ambos flags + `OPENAI_API_KEY`).
- **Persistencia (Supabase) — remote-first con caché local:**
  - Tabla `user_client_state` para estado de cliente por `scope` (RLS own-only). SQL: `docs/sql/saas-024-user-client-state.sql`.
  - Calendario del bubble y hábitos (`/tools/habits`) pasan a sincronizarse con cuenta; `localStorage` queda como caché/offline.
- **UI — selects modernizados:**
  - “Select popover” global: cualquier `<select>` se transforma en popover con `<ul role="listbox">` (estilo Tecnologías); mantiene `<select>` oculto para compatibilidad.
- **Convertidor:**
  - Controles no soportados quedan deshabilitados (solo imagen es usable en gratis).
- **Hábitos:**
  - Fix: marcado “paint” ya no desaparece tras la animación; respeta `motion: reduced`.
- **Convertidor (`/tools/convert`) — UI moderna + conversión gratis (imágenes):**
  - Rediseño tipo “Convertio”: dropzone, previews de entrada/salida, botón swap (⇄) y descarga.
  - Conversión **client-side** sin coste para imágenes: `PNG/JPG/WEBP` (entrada) → `PNG/JPG/WEBP` (salida) y entrada `SVG` (rasteriza).
  - Nota: conversiones de audio/vídeo/documentos quedan como **Pro** (server-side o WASM pesado).
- **Bubble (FAB):**
  - Calendario: UI más moderna + filtros por mes y por tag.
  - Curiosidades: ampliadas y agrupadas por temática con color.
  - Preferencias nuevas: mostrar/ocultar **Atajos** en el bubble.
  - Preferencias: cambios en Ajustes actualizan el bubble **sin recargar**.
  - IA: puede mostrarse también con sesión si el usuario la activa (sigue off por defecto).
- **Navegación / shell:**
  - “Herramientas” en header y footer pasa a ser **solo con sesión** (fuera de login no debe aparecer navegación interna).
  - Footer: reorganización del bloque de links (incluye accesos a `/backlog` y `/contact`).
- **Command palette:**
  - Entradas para `/tools` y **cada** subruta de herramienta, más `/backlog` y `/contact`.
- **Fixes:**
  - Planificador de hábitos: arreglado click y Shift+click (evita doble toggle por múltiples bindings).
- **Admin — siguiente nivel (idea):** métricas agregadas (DAU, registros por día), tabla de **audit log** si se añade SQL, export CSV, paginación `listUsers` >100, **nunca** exponer service role al cliente.
- **Estudio (`/study`) — UX / cohesión (pendiente; próximo tramo hacia 0.140.0):**
  - **Objetivo:** acción explícita de **guardar** (o auto-guardado con feedback inequívoco: guardado / error / pendiente) y **continuar / proceder** — enlace o CTA que encadene el flujo (p. ej. bajar foco a fuentes, dossier o “siguiente paso”), no solo texto de ayuda bajo el input.
  - **Cohesión:** Objetivo, SkillAtlas (tech + proyecto) y Temario se perciben como bloques inconexos; acercar jerarquía (pasos numerados, pestañas, acordeón o strip colapsable) y menos rejilla densa a la vez en viewport.
  - **Mini-espec** de pantalla Estudio (flujo feliz + qué va a “Más / avanzado”) antes de rediseños grandes; alinear copy y CTAs con ese orden.

#### Estudio — roadmap tipo NotebookLM (siguiente trabajo; priorizar velocidad y UX, evitar sobre-ingeniería)

Orden acordado para RAG / asistente sobre fuentes:

| Fase | Alcance |
|------|--------|
| **1** | **Chunking** (TS, solapamiento moderado) + **búsqueda full-text** en Postgres (`tsvector` / GIN); índice por usuario y fuente. |
| **2** | **Dossier (sin IA)**: “pregunta/tema → pack de evidencias” (retrieval-only) con chunks rankeados + highlights, selección y guardado como artefacto; UX potente sin costes variables. **Persistencia en cuenta:** `user_client_state` `study_dossiers`. *(El endpoint de chat queda apagado por feature flag).* |
| **3** | **UI** de chat con **citas interactivas** (resaltar fragmento / saltar a fuente). **Hecho** (abr. 2026). |
| **4** | **Notas persistentes** (tabla dedicada o extensión de workspace; sincronizado con cuenta). |
| **5** | **Salidas:** resumen, quiz, flashcards (reutilizan el mismo retrieval + prompt; sin nuevos subsistemas). |
| **6** | **Embeddings** (`pgvector` u opción gestionada) cuando el full-text deje de bastar; mismo pipeline de chunks. |

**Stack:** TypeScript + Supabase + endpoints Astro; **Python no es necesario** para este plan (reservado solo si más adelante hace falta OCR pesado, modelos locales o workers dedicados).

**Estado actual (implementado):**

- **Fase 1**: `study_chunks` (RLS + índice GIN), chunking en cliente, y buscador en `/study` con alcance “en contexto / todas mis fuentes”.
- **Fase 2 (núcleo UI + persistencia):** dossier retrieval-only en `/study`; lista de dossiers **sync** vía `study_dossiers` (ver arriba).
- **Fase 3:** chat asistido + citas clicables (`study-chat-ui.ts`, `wireStudyChatUi` desde `study-workspace.ts`).
- **Fase 4 (parcial / MVP):** tabla `study_user_notes` + UI en `/study` para notas con título/cuerpo (persistencia en cuenta; el textarea “Notas de sesión” sigue en `study_workspaces`). SQL: `docs/sql/saas-023-study-user-notes.sql`.

**Integración con SkillAtlas (diferencial vs NotebookLM):**

- **Nivel A (rápido / bajo riesgo):** enlazar un workspace de estudio a **Proyectos** y a **Tecnologías** — **implementado** con `saas-025` + UI en `/study` + banderolas en detalle CSR. Pendiente de refinar: “fuentes relacionadas” embebidas en proyecto, progreso agregado en `/app`.
- **Nivel B (producto fuerte, más adelante):** estructurar el temario como **Bloques → temas → subtemas**, con:
  - Estado por tema (pendiente / en progreso / dominado). **MVP UI:** `/study` + JSON `study_curriculum` (bloques/temas/estado) sync con cuenta; versión tabular SQL opcional más adelante.
  - Outputs (quiz/flashcards/resumen) vinculados a temas.
  - Hooks de tracking (p. ej. “horas”, “sesiones”, “temas cubiertos”) agregables en `/app`.

### v0.110.0

- **Proyectos / Tecnologías — import GitHub (beta):** modal “Importar stack desde GitHub” (API de GitHub Tree/Contents + lectura de manifests típicos) para detectar tecnologías y aplicarlas:
  - Desde **Proyectos**: botón “Importar desde GitHub” en el bloque de stack, crea tecnologías faltantes y las asocia al proyecto.
  - Desde **Tecnologías**: botón “Importar desde GitHub” en el formulario, crea tecnologías faltantes en el catálogo.
- **Proyectos — import GitHub → evidencia lista:** al importar stack desde GitHub en un proyecto, se rellena el input de evidencia con la URL del repo y (si no existía) se crea una evidencia tipo enlace “Repositorio GitHub”.
- **Proyectos — ponderación GitHub (local):** al importar stack desde GitHub se guarda la ponderación por lenguajes (GitHub Languages API) en `localStorage` por proyecto; `/app` puede agregarlas.
- **Dashboard (`/app`) — GitHub (scope + decimales):** vista “Por GitHub (lenguajes)” con:
  - Selector de **alcance**: “Todos los proyectos” o un **proyecto concreto** (por slug) usando los pesos guardados en `localStorage`.
  - Porcentajes con **1 decimal** (p. ej. `98.7%`), simplificando cuando acaba en `.0`.
- **Dashboard (`/app`) — pesos GitHub auto‑recalculables:** si existe `pctByLanguage`, el dashboard re‑genera `techWeights` con el mapeo actual y lo persiste, evitando “reimportar” cuando se amplía el mapeo (ej. añadir Astro).
- **GitHub languages → tecnologías:** mapeo ampliado para incluir `Astro → astro` (además de TypeScript/JavaScript/CSS…).
- **Tecnologías — multiselect quality:** modo múltiple con chips persistidos temporalmente en `localStorage` (sobrevive refresh) y fix de validación HTML (`required`) para evitar “Completa este campo” cuando hay chips.
- **Subtecnologías (MVP):** selector de **Tipo** (Tecnología / Framework / Librería / Paquete) en `/technologies` y ampliación del catálogo con entradas extra **sin seed** todavía (aparecen como “Catálogo”); badges visibles en el desplegable.
- **Dashboard (`/app`) — uso acumulado:** bloque “Tecnologías más usadas (por proyectos)” con ranking (Top 12) por número de proyectos donde aparece cada tecnología.
- **Dashboard (`/app`) — stack primero:** el bloque de Stack aparece antes que los gráficos/visualizaciones; el resto queda como secundario.
- **Catálogo (auto):** `EXTRA_CATALOG` se genera automáticamente desde `public/icons/*.svg` (script `gen:tech-catalog` + `prebuild`).
- **Supabase (schema):** script `docs/sql/saas-019-technologies-kind.sql` añade `technologies.kind` (compatible hacia atrás; el cliente lo usa si la columna existe).
- **CV (`/cv`) — editor menos ruidoso:** secciones **Proyectos**, **Experiencia** y **Educación** plegadas por defecto para reducir fatiga visual en viewport.
- **CV (`/cv`) — impresión/PDF (fixes):**
  - Exportación robusta en Chromium: impresión desde **iframe aislado** (evita hojas en blanco por overlays/transforms).
  - Preview sin scroll horizontal sobrante.
  - Plantillas nuevas con nombres i18n (ES/EN): Moderna, Compacta, Mono, Sidebar, Serif.
  - Impresión: se evita que la pantalla móvil (“Pensado para pantallas grandes”) se cuele en el PDF.
- **Proyectos — picker tecnologías:** `technologyPickerModal` con **modo múltiple** para asociar varias tecnologías de una pasada.
- **Navegación /projects (fixes):** mitigaciones para clicks/hover “muertos” al volver desde `/projects/view` bajo View Transitions:
  - Cleanup global de overlays (cierra `dialog[open]` y resetea `[data-modal-root]`) en `astro:before-swap`.
  - Navegación forzada en lista/cards CSR y refresh de caché “en background” sin bucles (bypass de caché).
- **Command palette:** atajo adaptado a plataforma (**`⌘K` en Mac**, **`Ctrl+K` en Windows/Linux**) y overlay/panel con fondo “glass” (blur + gradientes suaves).
- **Banner global (fixes):** cierre sin dejar hueco (sin drift de `max-h-*`) y sin “flash” al recargar si ya estaba dismiss en `localStorage` (CSS crítico inline).
- **Landing:** ajuste de espaciado en el subtítulo del hero (“Organiza stack y conceptos…”).

### v0.100.0

- **Footer:** `clip-path` superior en forma de V (`polygon(50% 17%, …)`); capas de gradiente y halos; sin enlace “código abierto” duplicado junto al stack.
- **Banner global:** misma línea estética que el footer (halos indigo/violeta, fondo en capas, anillo suave, sombra); `config/banner.ts` en **0.100.0**.
- **SEO:** `SiteMeta.astro` + `config/site-meta.ts`, imagen OG por defecto (`public/og/og-default.svg`), `site` opcional vía `PUBLIC_SITE_URL` en `astro.config.mjs`.
- **Landing — carrusel facetas:** arrastre con `requestAnimationFrame`, scroll solo en el carril (`scrollTo`, sin `scrollIntoView`), `snap-proximity` + `overscroll-x-contain`; auto-avance con barra de progreso; puntos extremos no clicables; transición de tarjetas desactivada mientras se arrastra.
- **Shell / responsive:** relleno horizontal con `clamp` en `.app-main-shell`, cabecera y footer con márgenes laterales coherentes; landing con `px-4 sm:px-6 lg:px-8` en el contenedor; hero con tipografía escalada (`sm` / `lg`); rejilla de tarjetas bajo el hero **2 columnas en tablet** (`sm:grid-cols-2 lg:grid-cols-3`); carrusel de facetas **compacto** de nuevo.
- **Precios (orientativos):** Team mensual **€4,99** (`data-price-month` 4.99 / anual equivalente 3.99); vitalicios **€19,99** (Pro) y **€49,99** (Team) en `PricingLifetime.astro`.
- **Navegación:** menú del avatar sin entrada “Perfil público” (duplicaba Ajustes).
- **CV (`/cv`):** `cvLinkSlots` (huecos fijos LinkedIn / GitHub / portfolio / X / web) para corregir desalineación etiqueta–URL; `socialLinkDisplay` (solo enlace, solo icono, ambos) y chips con iconos en vista previa; secciones **Certificaciones** e **Idiomas**; `cvSectionVisibility` por bloque; plantilla documento `classic` \| `minimal` (primera iteración); **bug** arreglado: inputs de experiencia/educación ya no re-renderizan en cada tecla; encabezados de sección del editor más destacados.
- **CV — orden de bloques:** `cvDocumentSectionOrder` en `cvProfile` (prefs); vista previa con carril derecho para reordenar; aplicado al documento y al CV público. El RPC **`skillatlas_cv_by_share_token`** ya devuelve `prefs.cvProfile` completo desde **`user_prefs`**: al sincronizar prefs con cuenta, el orden viaja al enlace público (sin migración SQL adicional).
- **CV — i18n documento:** `cv.docHighlightsHeading` pasa a **Logros** / **Highlights** (antes duplicaba “Experiencia” con el bloque de experiencia laboral).
- **CV — preview:** selector de **plantilla** en la cabecera del modal (cambio en caliente, sin recarga; persiste en prefs).
- **CV — importar texto (beta):** bloque **“Importar desde texto”** con heurística `cv-paste-import.ts` (bloques separados por línea en blanco; rol `en`/`@`/`|`; fechas flexibles; viñetas). **No** sustituye a import PDF ni a IA; sirve para pegar CV previo y rellenar experiencia/educación más rápido.
- **Prefs remoto:** al cargar `user_prefs`, **fusión superficial de `cvProfile`** (`{ ...local.cvProfile, ...remote.cvProfile }`) para no perder claves solo locales si el servidor trae un subconjunto.
- **FAB:** una sola burbuja; pestaña Contacto con iconos **estables** (LinkedIn SVG local, logo Gmail de `gstatic`) en lugar de avatares externos lentos o rotos.
- **Ideas explícitas (post‑MVP):** import **PDF/DOCX** con extracción de texto en servidor; **IA** para mapear campos arbitrarios a `experiences`/`education` (formatos de fecha heterogéneos); preview de plantilla ya resuelto en cliente.

### v0.70.0 (anterior)

- **Base de datos (repo):** scripts **`docs/sql/saas-015-embed-public-thumbnail.sql`** y **`docs/sql/saas-016-project-cover-storage.sql`** — evidencias con `show_in_public` y `thumbnail_url` en RPCs; **portada por proyecto** con `projects.cover_image_path`, bucket Storage **`project_covers`**, RPCs portfolio + **`skillatlas_cv_by_share_token`** con **`coverImagePath`** (ver **`docs/db.md`**).
- **Portada de proyecto:** compresión en navegador (`src/lib/browser/image-compress.ts`), subida y quitar portada (`project-cover.ts`), UI en detalle CSR (`project-view-bootstrap.ts`), URL pública (`supabase-public-storage-url.ts`); `coverImagePath` en `supabaseProvider` y tipo `Project`.
- **Portfolio / CV público:** tarjetas visitante con imagen de portada (`public-portfolio-project-card.ts`); CV por token con portada + bloque de evidencia con miniatura (`public-cv-by-token.ts`); scripts portfolio alineados (`portfolio-projects.ts`, `public-portfolio-public-page.ts`).
- **Evidencias:** thumbnails en componentes y flujo público; API **`/api/evidence-thumb`**; utilidades servidor `src/lib/server/` (p. ej. resolución OG para previews).
- **Producto / UI (tramo 0.60 → 0.70):** catálogo de fuentes y bootstrap de cabecera (`font-catalog.ts`, `AppShellHeadBootstrap.astro`); gráficos en landing (`LandingChartsPreview.astro`, `landing-charts-preview.ts`) y dashboard (`app-dashboard-charts*.ts`); refactors de shell/cabecera, login (escena tierra modular, shaders), i18n y estilos globales; **`runner.ts`** desactiva controles de portada en UI solo lectura.
- **Documentación:** `docs/db.md` y este archivo actualizados con el alcance anterior.

### v0.60.0

- UI **`/settings`** estilo repositorio: navegación lateral, una sección visible por clic, hashes `#classic-*`, iconos SVG en menú.
- Transiciones entre secciones (fade + altura); respeta `prefers-reduced-motion` y prefs de movimiento.
- Prefs: `settingsActiveSection`, `settingsSidebarSide`; retirada del **tablero** GridStack (columnas, orden, dependencia).
- `settings-classic-ui`, evento `skillatlas:settings-panel`; soporte DOM duplicado en profile/QA.
- i18n (`settings.shell`, `classic`, QA), `global.css`, `docs/architecture.md`, `AGENTS.md`.

### v0.50.0

- **CV público:** **`saas-012`**, RPC **`skillatlas_cv_by_share_token`**, ruta **`/cv/p/[token]`**, script cliente y controles en Ajustes (activar / copiar / regenerar); `/cv` alineado con avisos hacia Ajustes.
- **Servidor:** helper **`server-supabase-rpc`** para RPC anónimas (OG y páginas públicas).
- **QA / tester:** panel en Ajustes (modo tester, checklist, seed, debug); nota si el seed choca con constraints de conceptos.
- **OG / compartir:** meta OG/Twitter en **`/portfolio/<slug>`** y **`/p/<token>`**; imagen dinámica **`/og/portfolio.svg`**.
- **Onboarding:** tour + spotlight (minimizar, progreso, prefs); botones en **`/app`**.
- **`/prep`**, **`/study`** (workspace local, tres columnas); landing y navegación actualizadas.
- Documentación al día con ese alcance.

### v0.45.0

- **Despliegue:** adapter **`@astrojs/vercel`**; carpeta **`.vercel/`** ignorada; evitar 404 frente a un adapter Node aislado.
- **Portfolio público:** **`saas-011`**, **`/portfolio/[slug]`**, Ajustes (**`#portfolio-links`**: slug, visibilidad, copiar URL) y script visitante.
- **CV privado:** **`/cv`**, `cvProjectSlugs` en prefs, impresión con **`body.cv-print-mode`**.
- **Header:** `syncHeaderNavActive()` para View Transitions; indicador de nav con `left`+`width`; sin Precios en nav; Admin separado de iconos.
- **Landing:** `overflow-x` contenido sin romper hero full-bleed.
- Docs, banner y versión en `package.json`.

### v0.40.0

- Landing pública amplia, **`/pricing`**, **`/admin`** (solicitudes de acceso), mejoras UX transversales.
- Formulario **`/request-access`** y flujo invite-only (tras migraciones **saas-009** / **010**).

### v0.30.0 / v0.31.0

- Ajustes con rejilla 2D, prefs con sync, View Transitions; iteración de banderas y fuentes.

### v0.20.x

- **SaaS multi-tenant** (scripts **saas-001** …), vistas CSR **`/projects/view`**, **`/technologies/view`**, **`/login`** con email/OAuth, documentación RLS y providers tolerantes a build sin datos.

### v0.15.0

- Proyectos como **historia** (`role` / `outcome` vía **saas-006**) + **evidencias** (embeds); portfolio en CSR con tarjetas enriquecidas.

### v0.10.0

- **Ajustes** tipo dashboard: columnas reorderables, orden en prefs; **perfil** + stack de ayuda; i18n con selector; **footer** con stack; **import de conceptos** y catálogo de seeds; iconos y `help-stack`.

### Versiones anteriores (≤ 0.8)

- MVP inicial: Astro, datos mock, integración Supabase base, layout y páginas fundacionales.

---

## Open Graph (OG) — cobertura actual

| Superficie | Estado |
|------------|--------|
| **`/portfolio/<slug>`** y **`/p/<token>`** | Meta `og:*` + `twitter:card` / `twitter:image`; imagen dinámica **`/og/portfolio.svg`** (SVG generado en servidor vía RPC). |
| **Landing `/`**, **`/cv`**, **`/app`**, rutas internas | Solo título/layout habitual; **sin** pack OG rico por página. |
| **`/cv/p/<token>`** (CV público) | **Sin** meta OG específica (compartir en redes no muestra preview dedicada). |
| **Por proyecto** (URL única de “solo este proyecto”) | **No** existe ruta pública de proyecto; las miniaturas son en **cards** / **portada** (`project_covers`), no preview OG por proyecto. |

**API relacionada (no es meta de página):** `/api/evidence-thumb` y `src/lib/server/og-image-from-url.ts` resuelven `og:image` de URLs externas para **evidencias**.

---

## Base de datos (referencia rápida)

Migraciones **`saas-001` … `saas-016`** (ver tabla en `docs/db.md`). Tras **v0.70.0** el repo incluye **saas-015** y **saas-016** (thumbnails públicos + portadas en Storage).

---

## Evidencias — ideas (dominio)

Estas ideas **no** están cerradas en producto; parte del modelo ya existe en BD.

### Miniatura propia por evidencia (opcional)

- **Hoy:** `project_embeds.thumbnail_url` (**saas-015**) admite URL; YouTube / Open Graph pueden rellenarse automáticamente; en UI el foco ha sido URL de imagen, no subida a Storage por embed.
- **Deseable:** poder fijar una **miniatura propia** (p. ej. captura donde el cuadro de Tableau se lea bien) cuando el **iframe** en tarjeta pequeña **recorta** el libro de trabajo y no se entiende la pieza.

### Modos de presentación de evidencias

- **Grandes** — más superficie para iframes “difíciles” (BI, dashboards).
- **Cuadrícula** — equilibrio actual / móvil.
- **Fila / lista** — cada evidencia como **enlace** (y opcionalmente miniatura pequeña), evitando embeds ridículos en alto.

*(Implica prefs a nivel proyecto o global y trabajo de UI; puede combinarse con miniatura por evidencia.)*

---

## Ideas y frentes abiertos (para decidir qué mantener)

Lista **explícita** — no implica prioridad; **no eliminar** entradas por ahora.

1. **PDF de portfolio** y/o export estático cuando encaje.
2. **OG enriquecido** para landing, CV público, o **artefacto OG por proyecto** (nueva ruta o imagen dinámica).
3. **Plantillas de proyecto** (duplicar proyecto ya disponible en detalle CSR).
4. ~~Actividad reciente multi-dispositivo~~ → implementado vía `recent_activity` + merge al login.
5. **Insights en `/app`** (gráficos, heatmap, eventos).
6. **`/study`** — Storage y extracción de texto ya en curso; RAG / NotebookLM: ver tabla **“Estudio — roadmap tipo NotebookLM”** bajo **v0.130.0** (chunking + FTS → chat con citas → UI → notas → salidas → embeddings).
7. **`/prep`** — convocatorias / proyectos de estudio ampliados.
8. **Monetización** — pasarela, planes, límites (tras validar demanda).
9. **Tech Note** por tecnología (markdown) + mejoras de import / tiers en DB.
10. **Observabilidad** — e2e, snapshots visuales.
11. **Rendimiento navegación** — menos recarga completa, caché de listas CSR, skeletons.
12. **i18n** — textos restantes (p. ej. mensajes de `userFacingDbError` en EN cuando UI en EN).
13. **i18n multi-idioma amplio** — además de ES/EN en shell, **muchos idiomas** en selector, traducciones completas de landing/app y mantenimiento de `*.json` (pendiente de priorizar; hoy solo ES/EN en UI principal).
14. **QA seed** — el botón “Crear datos de prueba” puede chocar con constraints de `concepts` (p. ej. `progress`); alinear seed con DB real.
15. **Categorías / columnas** en conceptos (`category`, `tier`) si se sale del modelo actual.
16. **CV — import enriquecido:** subida **PDF/DOCX**, extracción de texto en servidor, opcional **IA** para mapear a `experiences` / `education` con fechas en formatos heterogéneos (mes/año, rangos, etc.); complementa el import por pegado en **v0.100.0**.
17. **`/tools` — ampliar utilidades y modo Pro:** el hub y la primera tanda de herramientas cliente ya están en **v0.130.0**; pendiente priorizar **PDF→Word**, **PNG→ICO**, edición PDF, conversiones server-side/WASM pesado, etc., inspirado en Convertio pero embebido en SkillAtlas.
18. **Alta de tecnología/librería por URL o identificador de registro** — *parcial:* npm/PyPI rellena nombre/slug/descripción vía API; **pendiente:** sugerir/asignar **icono** automáticamente y ampliar a otros registros o GitHub package.

---

## Handoff — trabajo explícito para siguiente agente (abr. 2026)

Bloques listos para retomar con **otro agente** sin depender del hilo de chat largo.

### 1) Importación CV desde PDF — **prioridad alta (bug / percepción de “no importa nada”)**

- **Síntoma reportado:** Tras **Elegir PDF**, el texto puede aparecer en el modal, pero **«Importar al formulario»** no deja experiencia/educación como el usuario espera (toast de error tipo “No se detectaron bloques válidos” o sensación de que **no se importó nada**).
- **Código relevante:**
  - `src/scripts/cv/cv-page.ts` — `ingestCvPdfFile`, `runCvImportMode`, modal import.
  - `src/lib/cv-paste-import.ts` — `normalizeCvPasteForHeuristics`, `parseExperienceBlocksFromPaste`, `parseEducationBlocksFromPaste`.
  - `src/lib/cv-pdf-text.ts` — extracción de texto del PDF en cliente.
- **Línea de trabajo sugerida:** Reproducir con PDFs reales; log o inspección del **texto normalizado** antes del parse; ampliar heurísticas (bloques, fechas en español, empresas en línea separada, PDF de una columna); tests unitarios con cadenas representativas; mensajes de error más accionables (“prueba pegando desde la vista de texto”, “separar bloques con línea en blanco”, etc.).
- **Nota:** El import por **pegado** comparte el mismo parser; el fallo puede ser sobre todo **forma del texto tras PDF** + límites del parser heurístico.

### 2) Librerías / paquetes como **subcategoría** de una tecnología “madre”

- **Objetivo de producto:** Al registrar **librerías o paquetes** (npm/PyPI, etc.), asociarlos a una **tecnología base** (p. ej. Python, SQL, React) no como un concepto más del catálogo, sino como **subtecnología** o agrupación jerárquica (UX: bajo la tech madre, carpetas en listado, filtros).
- **Dirección técnica (a validar en `docs/db.md` + SQL):**
  - Opción A: `technologies.parent_technology_id` (self-FK, nullable), con `kind` existente (`library` / `package` donde aplique).
  - Opción B: tabla puente `technology_children` si se quieren relaciones N:1 flexibles o orden.
  - **RLS:** mismas reglas `user_id` que el resto de `technologies`; comprobar impacto en proyectos, conceptos y Estudio (`linked_technology_ids`, carpetas por tech).
- **UI:** formulario de alta (y quizá import registro) con selector **“Tecnología madre”** opcional/obligatorio para `kind` librería; detalle/listado que agrupe hijas bajo madre; no romper flujos actuales de conceptos ni de proyectos.
- **Referencias en repo:** formulario `technologies`, `POST /api/tech-registry-lookup`, `src/data/providers/supabaseProvider.ts`, scripts CSR de tecnologías.

---

## Referencias cruzadas

- Ideas de preferencias (futuro): `docs/prefs-candidates.md`
- Persistencia local (localStorage/sessionStorage): `docs/local-persistence.md`
- Arquitectura y CSR: `docs/architecture.md`
- SQL y RPCs: `docs/db.md`
- Plan SaaS: `docs/plan-saas-multi-tenant-portfolio.md`
- README (resumen y versión): `README.md`
