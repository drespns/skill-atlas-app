# `src/scripts/projects/project-detail/`

Módulos del script de la pantalla **detalle de proyecto** (`/projects/:projectId`).

## Por qué existe esta carpeta

`project-detail.ts` creció como un “script monolítico” con responsabilidades muy distintas (editar proyecto, tecnologías, conceptos, embeds, reordenación, borrado). Dividirlo en módulos mejora:

- **Mantenibilidad**: cada archivo trata un único dominio (embeds / conceptos / tecnologías / proyecto).
- **Cambios verticales**: tocar “solo embeds” ya no implica navegar un fichero enorme.
- **Reutilización**: helpers como resolver `projectDbId` se comparten.
- **UX consistente**: es más fácil introducir modales únicos (editar proyecto / editar embed) sin mezclar lógica de formularios, ordenación y borrado.

## Entrada (entrypoint)

- **`../project-detail.ts`**: inicializa el cliente de Supabase y llama a los `init*` según el DOM.

## Módulos

- **`helpers.ts`**:
  - Resolver IDs internos de DB desde slugs públicos.
  - Ejemplo: `getProjectDbId(supabase, projectSlug)`.

- **`project.ts`**:
  - Edición del proyecto con modal único (`projectEditModal`) y borrado (`confirmModal`).
  - Enganches: `data-project-edit-open`, `data-project-delete`, `data-project-edit-feedback`, `data-project-*` en el contenedor del proyecto.

- **`technologies.ts`**:
  - Asociar/desasociar tecnologías al proyecto.
  - Enganches: `data-project-tech-form`, `data-project-tech-remove`, `data-project-tech-feedback`.

- **`concepts.ts`**:
  - Asociar conceptos (filtrados por tecnologías del proyecto).
  - Enganches: `data-project-concept-form`, `data-project-concept-feedback`.

- **`embeds.ts`**:
  - Alta con modal (`embedEditModal`), edición con modal, eliminación y reordenación (swap de `sort_order`).
  - Enganches: `data-project-embed-add`, `data-project-embed-edit`, `data-project-embed-remove`, `data-project-embed-move`, `data-project-embed-feedback`.

## Nota sobre DB

La reordenación de embeds depende de que **no haya colisiones** de `sort_order` por proyecto. En `docs/sql/mvp-constraints.sql` hay un índice único recomendado: `(project_id, sort_order)`.

