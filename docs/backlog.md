# Backlog

Documento orientado al **historial** de lo implementado y a **ideas** sin orden de prioridad fijo. Detalle de esquema y migraciones: **`docs/db.md`**. Plan multi-tenant ampliado: **`docs/plan-saas-multi-tenant-portfolio.md`**.

**Convención:** las versiones de producto siguen **`package.json`** y tags Git anotados (`git tag -l`, `git show v0.100.0`). Esta sección intenta listar **todo lo hecho hasta la versión actual**; las ideas futuras siguen al final y **no se borran** salvo decisión explícita.

**Proceso de documentación (cada iteración con alcance de producto):** al cerrar un bloque de trabajo que añada o cambie **funcionalidad** visible (flujos, pantallas, prefs, SQL, rutas), actualizar **este `backlog.md`** en la entrada de versión en curso (o la siguiente) con bullets concretos por área, para que el historial refleje lo implementado. Los **fixes** puntuales o de calidad sin cambio de producto no requieren línea obligatoria; usar criterio.

---

## Registro de versiones (historial de producto)

### v0.110.0 (actual)

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
3. **Duplicar proyecto** y **plantillas de proyecto**.
4. **Actividad reciente multi-dispositivo** (sincronizada con cuenta; hoy solo `localStorage`).
5. **Insights en `/app`** (gráficos, heatmap, eventos).
6. **`/study`** — Storage, extracción de texto, RAG, salidas reales (hoy UI + localStorage).
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

---

## Referencias cruzadas

- Ideas de preferencias (futuro): `docs/prefs-candidates.md`
- Arquitectura y CSR: `docs/architecture.md`
- SQL y RPCs: `docs/db.md`
- Plan SaaS: `docs/plan-saas-multi-tenant-portfolio.md`
- README (resumen y versión): `README.md`
