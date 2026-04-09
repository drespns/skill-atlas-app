<!-- skillatlas-tier: iniciacion -->
## Documento y metadatos

- Doctype HTML5 y estructura mínima: `html`, `head`, `body`
- Codificación UTF-8 declarada y meta *viewport* para diseño responsive
- Jerarquía lógica de encabezados `h1`–`h6` (un `h1` principal por página cuando proceda)

## Contenido textual y listas

- Párrafos, listas ordenadas y no ordenadas, listas de definición
- Enlaces con texto descriptivo (`<a href>`); evitar “clic aquí” como única etiqueta
- Imágenes con `alt` significativo; tablas con cabeceras claras cuando representan datos tabulares

<!-- skillatlas-tier: junior -->
## Formularios

- Etiquetas `<label>` asociadas a controles; agrupación con `fieldset` / `legend`
- Tipos de `input` adecuados (email, number, date) y validación HTML5 básica
- Botones con `type` explícito para evitar envíos accidentales

## Multimedia e incrustaciones

- `<picture>` y `<source>` para arte responsive; `video` / `audio` con controles accesibles
- `iframe` con `sandbox` y políticas de origen cuando se incrusta terceros

<!-- skillatlas-tier: mid -->
## Semántica y landmarks

- Uso de `main`, `nav`, `header`, `footer`, `aside`, `section`, `article` según el rol real
- Enlaces de salto (*skip links*) para usuarios de teclado y lectores de pantalla

## Accesibilidad

- Contraste suficiente y orden de tabulación coherente con el diseño visual
- No depender solo del color para transmitir estado o error

<!-- skillatlas-tier: senior -->
## Calidad y mantenimiento

- HTML válido como base antes de capas de estilo y script
- Evitar `div` genéricos cuando existe un elemento semántico adecuado
- Comentarios HTML solo cuando documentan decisiones no obvias para el equipo
