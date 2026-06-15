# CV Studio — Roadmap hacia una experiencia tipo Canva

Plan por fases para acercar **`/cv/studio`** (y el flujo de diseño del CV) a un producto **estilo Canva**: superficie de trabajo clara, página como unidad, bloques reconocibles y feedback visual, **sin** sustituir el PDF por un lienzo raster ni perder **HTML + CSS imprimible** ni las reglas **ATS** acordadas en producto.

**Documentos relacionados**

- **`docs/cv-blocks-spike.md`** — modelo JSON de bloques (orientación técnica).
- **`docs/backlog.md`** — tabla *CV — Estudio de maquetación* (estado resumido).

---

## Registro de iteraciones (Canva / titular)

| Fecha (aprox.) | Hecho | Próximo / pendiente |
|----------------|--------|---------------------|
| 2026-04 | Superficie `/cv/canva`, zoom, selección de bloques, prefs de layout (`cvStudioCanvasLayout`), documento vía `renderCvDocument` sin iframe completo. | Pulir ATS en estudio, undo de layout. |
| 2026-04 | Edición in-place con `data-cv-canva-entity` + prefs en muchas secciones (experiencia, educación, certificaciones, etc.). | Proyectos del CV siguen en Supabase (fuera de prefs). |
| 2026-04 | **Titular / datos personales en Canva:** chips de contacto en modo `plain` (solo en panel bajo `[data-cv-canva-v2-root]`): email, teléfonos y **URLs de huecos** como texto `contenteditable` (sin `<a href>`); persistencia en `cvProfile` / `cvLinkSlots`. | Editar etiquetas custom por hueco, validar URL al blur. |
| 2026-04 | **Barra flotante:** se muestra al **enfocar** cualquier celda editable (no hace falta seleccionar texto); B/I/U; **A− / A+** guardan `heroFontRem` en `cvStudioCanvasLayout`; en el hero, botón **Icono** cicla `socialLinkDisplay` (ambos → solo icono → solo texto) y **+/−** ajustan `heroContactIconScalePct`. | Toolbar rica (fuente, color, listas), atajos teclado. |
| 2026-04 | **Ancho de franjas del titular:** envoltorios `data-cv-hero-resize-wrap` + `resize: horizontal` dentro del hero (`data-cv-doc-canva-hero-chrome`); `ResizeObserver` persiste `heroFieldWidthsPct`. | Límites mín/máx por plantilla, handles visibles estilo Canva. |
| 2026-04 | Iconos de enlaces y 📍 escalan con variable CSS `--cv-hero-contact-icon-scale` aplicada desde layout. | Misma escala para la **foto** del titular si producto lo pide. |

**Archivos tocados recientemente (referencia rápida):** `src/lib/cv-document-render.ts`, `src/lib/cv-studio-layout.ts`, `src/components/cv/CvDocumentHost.astro`, `src/scripts/cv/cv-canva-inline-edit.ts`, `src/scripts/cv/cv-canva-floating-toolbar.ts`, `src/scripts/cv/cv-canva-hero-field-resize.ts`, `src/scripts/cv/cv-canva-v2.ts`, `src/scripts/cv/cv-studio-document.ts`, `src/styles/global.css`.

---

**Principios (no negociables en el roadmap)**

1. **Fuente de verdad imprimible:** el resultado sigue siendo DOM + CSS (navegador / “Guardar como PDF”), no una imagen como única salida.
2. **ATS y lectura:** orden de documento coherente, secciones semánticas reconocibles; cualquier layout “creativo” debe advertir cuando se aleja de patrones seguros.
3. **Una app en el lienzo:** el objetivo final es **no** depender de un iframe que cargue toda la shell; el estudio debe montar **solo** el documento (y su cromática de editor) en la misma página que el hub.

---

## Estado actual (referencia)

- Hub en **`/cv/studio`** y nuevo endpoint de trabajo **`/cv/canva`**: copy de roadmap, orden de secciones (prefs), **documento en el DOM del estudio** (`CvDocumentHost` + `renderCvDocument`); la vista en iframe queda como **`?legacyIframe=1`**.
- Sincronización prefs → documento: canal dedicado + evento `skillatlas:prefs-updated` + `storage` (ver `src/lib/cv-studio-prefs-channel.ts`, `cv-studio-document.ts`, `cv-page.ts`, `cv-studio-page.ts`).
- Controles de “lienzo” (zoom/rejilla): **no** son prioridad de producto hasta tener **superficie única** y bloques; pueden quedar ocultos o simplificados en una iteración posterior si molestan.

---

## Fase 0 — Alineación y criterios de “hecho”

**Objetivo:** cerrar con stakeholders qué significa “suficientemente Canva” para v1 del estudio.

**Entregables**

- Lista corta de **must-have** vs **nice-to-have** (p. ej. selección de bloque, rejilla de página, plantillas numeradas, snap, multi-página).
- **Definición de hecho** por fase (demo grabable o checklist manual).
- Decisión: **¿el editor principal `/cv` sigue siendo la fuente de datos y el estudio solo layout**, o el estudio puede escribir campos concretos en v1?

**Duración estimada:** 0,5–1 sesión de producto (sin código obligatorio).

### Criterios acordados para v1 (referencia de producto)

Esta sección plasma decisiones de trabajo **para desbloquear implementación**; pueden refinarse con stakeholders.

| Tema | Decisión v1 |
|------|----------------|
| Fuente de datos del CV | **`/cv` + `loadPrefs` / `updatePrefs`**: perfil del slot activo, orden de secciones y selección de proyectos viven en preferencias locales; el estudio **no** escribe campos de texto ni experiencia en v1 (solo lo que ya pasa por prefs, p. ej. orden de secciones del documento). |
| Rol del estudio | **Vista de maquetación**: mismo motor de render del PDF (`renderCvDocument`), misma sesión Supabase; el estudio es **superficie de trabajo** alrededor del documento, no un segundo editor de contenido. |
| Must-have v1 | Superficie única sin iframe de la app completa; **reflejo inmediato** del documento al cambiar prefs relevantes (p. ej. orden de secciones); escape controlado **`?legacyIframe=1`** si hiciera falta el embed antiguo. |
| Nice-to-have (post v1) | Bloques serializables, plantillas de rejilla, snap, undo de layout, tema del lienzo desacoplado del tema global (ver fases 2–5). |
| Definición de hecho Fase 0 | Esta tabla + principios no negociables del encabezado del documento revisados por quien define producto. |
| Definición de hecho Fase 1 | En `/cv/studio` (modo por defecto) el área de diseño **no** monta la shell de `/cv` dentro de un iframe; el documento se pinta en el DOM del estudio y reacciona a cambios de prefs sin recargar toda la página del estudio. |

> **Nota 2026-04:** la fila «el estudio no escribe campos de texto en v1» quedó **superada** para **`/cv/canva`**: el lienzo escribe en `CvProfileV1` + `cvStudioCanvasLayout` del slot activo (prefs). La tabla se conserva como histórico de la decisión inicial; el estado real está en *Registro de iteraciones* más arriba.

---

## Fase 1 — Superficie única (adiós “web dentro de web”)

**Objetivo:** en **`/cv/studio`**, el documento del CV se renderiza **en el DOM del estudio** (mismo `CvDocumentHost` / mismo pipeline de render que hoy usa `cv-page.ts`), **sin** iframe de página completa.

**Entregables técnicos (orientativos)**

1. Extraer o compartir un módulo tipo **`renderCvDocumentPreview`** (nombre final a decidir) que, dado `CvProfileV1` + orden de secciones + contexto mínimo (proyectos, techs, i18n), actualice el host del documento.
2. Página estudio: contenedor único “mesa de trabajo” + **solo** documento + barra propia del estudio (sin duplicar `AppHeader` del producto).
3. Sesión y prefs: reutilizar **`loadPrefs` / `updatePrefs`** como hoy; evitar segunda copia de estado salvo transición controlada.
4. Fallback controlado: si el extract falla en un entorno, mantener iframe **solo** como escape (feature flag o query `?legacyIframe=1`).

**Criterios de hecho**

- En `/cv/studio` no se carga la shell global **dentro** del área de diseño.
- Cambiar orden de secciones desde el estudio **refleja** el documento sin recargar toda la app del estudio.

**Riesgos:** tamaño del bundle del estudio, tiempo de primera pintura — mitigar con carga diferida del módulo pesado si hace falta.

---

## Fase 2 — Página como unidad (mesa de trabajo Canva-lite)

**Objetivo:** sensación de **hoja** centrada: fondo neutro, sombra de página, márgenes seguros, zoom/pan **opcional** a nivel contenedor (no prioridad hasta Fase 1 estable).

**Nota (estado):** en el estudio inline ya hay mesa (fondo neutro) + ancho máximo tipo A4; el botón **Rejilla** del toolbar queda oculto hasta que haya guías de bloque o márgenes con sentido (Fase 3+).

**Entregables**

- Contenedor de página con **ratio A4** (o configurable), márgenes guía opcionales, scroll/pan del workspace.
- Tema visual del workspace desacoplado del tema del editor `/cv` si aporta claridad (p. ej. siempre claro en el lienzo aunque la app esté en oscuro).

**Criterios de hecho**

- Captura de producto alineada con referencia “Canva”: una página clara, sin ruido de navegación alrededor del documento.

---

## Fase 3 — Bloques: selección, orden y plantillas acotadas

**Objetivo:** pasar de “secciones fijas reordenables” a **bloques** serializables (ver spike JSON), con **plantillas** (rejillas predefinidas), no lienzo infinito libre.

**Estado (incremental):** en `/cv/studio` (modo inline) ya hay **selección visual** del bloque cabecera (`hero`), de la banda tech+proyecto destacado y de cada `<section data-cv-section>` (clic + `Escape` para limpiar). Siguiente paso: barra contextual mínima y/o persistencia en prefs según spike.

**Entregables**

1. **Schema v1** en prefs o en slot de documento: `cvLayoutBlocks` (nombre tentativo) versionado, migración desde `cvProfile` + `cvDocumentSectionOrder`.
2. Catálogo pequeño de **tipos de bloque** (Hero, Lista de experiencia, Banda tech+proyecto, etc.) mapeados a componentes existentes donde sea posible.
3. UI: lista o rail de bloques, **arrastrar para reordenar**, click = selección con borde/handles (patrón Canva).
4. **Plantillas** (2–3 layouts) que solo combinan bloques en rejillas permitidas.

**Criterios de hecho**

- Guardar / cargar layout en el mismo navegador (prefs) y ver el mismo resultado en preview de impresión del documento.

**Dependencia:** `docs/cv-blocks-spike.md` pasa de spike a **contrato** mínimo (campos obligatorios por tipo).

---

## Fase 4 — ATS y “modo seguro”

**Objetivo:** cuando el layout se aleje de heurísticas seguras (orden DOM, headings, densidad), mostrar **avisos accionables** (no solo puntuación).

**Entregables**

- Reglas por plantilla y por tipo de bloque; integración con **`cv-ats-check`** (o evolución de él).
- UI: panel o badges en el estudio (“orden de lectura”, “sección sin heading”, etc.).

**Criterios de hecho**

- Casos de prueba documentados (3–5 layouts) con resultado ATS esperado.

---

## Fase 5 — Pulido producto y continuidad

**Objetivo:** acercar a Canva en **percepción de calidad**: atajos, deshacer, microcopy, accesibilidad del rail, rendimiento con CV grandes.

**Entregables (elegir según prioridad)**

- Historial local de cambios de layout (**undo/redo** ligero en memoria o en prefs).
- Alineación con **CV público por token** (¿mismo motor de render solo lectura?).
- Limpieza de código muerto (iframe legacy, toggles experimentales).

---

## Orden recomendado de ejecución (después de OK)

1. **Fase 0** — criterios (si no está ya cerrado implícitamente).
2. **Fase 1** — superficie única (mayor salto arquitectónico; desbloquea el resto).
3. **Fase 2** — mesa de trabajo visual.
4. **Fase 3** — bloques + plantillas.
5. **Fase 4** — ATS en estudio.
6. **Fase 5** — pulido.

Cada fase puede cerrarse en **una o varias PRs**; conviene no mezclar Fase 1 y Fase 3 en el mismo diff gigante.

---

## Fuera de alcance (por ahora)

- Editor vectorial infinito tipo Figma.
- PDF como **única** salida rasterizada desde un canvas 2D sin DOM semántico paralelo.
- Colaboración en tiempo real multiusuario.

---

## Siguiente paso tras tu OK

Acordar por escrito la **Fase 0** (must-have v1 del estudio) y abrir la **Fase 1** con un PR acotado: *montar documento en DOM del estudio sin iframe*, con checklist de regresión en `/cv` y en `/cv/studio`.
