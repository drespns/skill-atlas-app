<!-- skillatlas-tier: iniciacion -->
## Sintaxis base

- Encabezados `#`–`##`, listas ordenadas y no ordenadas
- Enlaces `[texto](url)` e imágenes `![alt](url)`
- Código en línea `` ` `` y bloques con cercado de tres tildas

## Párrafos y énfasis

- Saltos de línea, *cursiva* y **negrita**
- Citas en bloque `>` y reglas horizontales

<!-- skillatlas-tier: junior -->
## Sabores y extensiones

- CommonMark como núcleo frente a GitHub Flavored Markdown
- Tablas, listas de tareas y tachado en GFM
- *Front matter* YAML en generadores estáticos (Astro, etc.)

## Buenas prácticas

- Accesibilidad: texto alternativo en imágenes
- Enlaces relativos vs absolutos en documentación versionada

<!-- skillatlas-tier: mid -->
## Tooling

- Linters (`markdownlint`) y formato consistente en CI
- Inclusión de fragmentos (`include`) según el motor

## Seguridad

- Sanitización HTML si se permite HTML crudo
- Precaución con enlaces `javascript:` o contenido incrustado

<!-- skillatlas-tier: senior -->
## Publicación

- Generadores (MkDocs, Docusaurus) y búsqueda full-text
- Internacionalización de docs y *slug* estables
