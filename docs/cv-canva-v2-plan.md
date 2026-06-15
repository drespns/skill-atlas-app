# CV Canva V2 (`/cv/canva`) — Plan de producto y técnica

Este documento sirve de **memoria de largo plazo** cuando se pierda contexto en el chat. Complementa `docs/cv-studio-canva-roadmap.md` (visión general) y entra en **cómo** llegar a una experiencia cercana a **canva.com/design** sin romper el principio de **HTML imprimible + ATS**.

## Objetivo de producto

- El usuario ve en `/cv/canva` **las mismas páginas** que imprimirá / guardará como PDF (WYSIWYG perceptivo).
- **Sin scroll anidado** artificial: una sola superficie de desplazamiento (o zoom para encajar), como en Canva.
- **Ctrl (⌘) + rueda** para acercar/alejar el **lienzo** (no el texto del sistema).
- **Manipulación directa**: selección con marco, handles, arrastre donde el modelo de datos lo permita.
- **No** sustituir la fuente de verdad por un canvas raster como única salida.

## Estado actual en código (referencia rápida)

| Pieza | Ubicación |
|-------|-----------|
| Página | `src/pages/cv/canva.astro` |
| Shell UI | `src/components/cv/CvCanvaEditor.astro` |
| Lógica cliente | `src/scripts/cv/cv-canva-v2.ts` |
| Render documento | `src/scripts/cv/cv-studio-document.ts` + `src/lib/cv-document-render.ts` |
| Layout serializable | `src/lib/cv-studio-layout.ts` (`cvStudioCanvasLayout` en prefs) |
| Estudio legacy (intacto) | `/cv/studio`, `CvStudioCanvas.astro`, etc. |

## Fase A — Lienzo “Canva-like” (scroll + zoom)

**Implementado (revisar en PR / main)**

1. **Scroll como canva.com (ventana)**  
   - El workspace **ya no** usa `overflow-y-auto` ni la columna central altura fija a viewport: el CV crece con el documento y el **scroll es el del navegador** (`<main>` / página).  
   - Las columnas laterales pueden usar `position: sticky` para mantener capas/propiedades visibles al bajar.

2. **Zoom del lienzo**  
   - Variable CSS `--cv-canva-zoom` en `data-cv-canva-zoom-wrap` (`global.css`: `.cv-canva-v2-zoom-wrap`), `transform: scale()` + `transform-origin: top center`.  
   - **Ctrl / ⌘ + rueda** con objetivo dentro del workspace (`capture` en la raíz del editor), `preventDefault`, persistencia `sessionStorage` clave `cvCanvaV2Zoom`.  
   - Botones +/− y **Ajustar** (ajuste al ancho del contenedor), mismas claves i18n que el estudio clásico.

**Criterio de hecho**

- No debe aparecer una barra de scroll **solo** en el recuadro gris del lienzo: si hay scroll, es el de la página.

**Nota técnica (deuda conocida)**

- `transform: scale()` no reduce el “layout height” del bloque escalado: el área desplazable puede ser mayor que lo visual. Si molesta, siguiente iteración: ajustar altura del contenedor según zoom o usar otra estrategia (p. ej. `zoom` en WebKit con caveats).

## Fase B — Selección y handles (manipulación visual)

**Implementado (MVP)**

1. **Marco de selección** (`data-cv-canva-selection-frame`) posicionado con `getBoundingClientRect` respecto al workspace (sin scroll interno del workspace: el listener es `window` `scroll` capture).  
2. **Handles** esquinas (nw, ne, sw, se) + lados (e, w), todos mapeados al ajuste de **ancho de bloque** (`blockWidthsPct`).  
3. **Repositionar** en: scroll de ventana, `resize`, `ResizeObserver` sobre `[data-cv-document]`, `skillatlas:cv-studio-doc-painted`, cambios desde panel.  
4. **Guías A4** en `/cv/canva`: `paintPageGuidesInRoot` + CSS bajo `[data-cv-canva-v2-root]` (no depende de `data-cv-studio-layout="inline"`). Texto i18n `cv.canvaPageGuidesHint`.

**Criterio de hecho**

- Marco alineado al bloque al hacer scroll de página; con zoom activo el rect sigue coincidiendo (coordenadas en espacio de vista).

## Fase C — Paginación fiel (1:1 con impresión)

Hoy las guías A4 son **aproximadas**. Para acercarse a Canva/PDF:

1. **Motor de paginación** coherente con `@page` y márgenes reales (o `Paged.js` / similar) **solo en vista previa**, o  
2. **Medición + fragmentación** controlada (alto de caja = área imprimible) con sync a reglas de `global.css` `@media print`.

**Criterio de hecho**

- El número de “hojas” en pantalla coincide con el del diálogo de impresión en casos de prueba documentados (3 CV de ejemplo).

## Fase D — Edición de contenido en lienzo

- `contenteditable` enlazado a campos del modelo (por bloque), o paneles flotantes por bloque con sync a prefs / Supabase según el campo.  
- Reglas ATS: no romper orden de lectura; avisos si el DOM diverge.

## Fase E — Plantillas, snap, undo

- Snap a rejilla y márgenes.  
- Historial local (undo/redo) de cambios de layout.  
- Plantillas prearmadas (rejillas permitidas).

## Riesgos y decisiones

| Riesgo | Mitigación |
|--------|------------|
| Duplicar estado (layout vs perfil) | Un solo `cvStudioCanvasLayout` versionado; migraciones explícitas. |
| ATS | Proyección “segura” para PDF vs vista creativa (documentar en UI). |
| Rendimiento CV grandes | Virtualización solo si hace falta; priorizar medición. |

## Próximo paso inmediato tras Fase A–B

Implementar **ajuste al ancho** del zoom wrap al ancho del workspace (un clic) y **mini-map / páginas** en footer estilo Canva (baja prioridad).
