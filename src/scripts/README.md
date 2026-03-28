# `src/scripts/`

Scripts TypeScript que se cargan en el **navegador** (client-side) desde páginas Astro con `<script type="module" src={...}>`.

En este proyecto, los scripts viven “por pantalla” (o por feature) para mantener el MVP simple: la página Astro renderiza el HTML y el script añade interactividad/CRUD (Supabase) sobre elementos marcados con `data-*`.

## Convenciones

- **Selectores por `data-*`**: la UI marca puntos de enganche con atributos como `data-tech-form`, `data-project-id`, `data-project-embed-edit`, etc.
- **Facade de Supabase en navegador**: usa `getSupabaseBrowserClient()` de `client-supabase.ts` (evita repetir `createClient()` en cada script).
- **Feedback UI**: usa `ui-feedback.ts` para toasts y modales consistentes.
- **Cargar solo cuando aplica**: cada script valida que existan los nodos (`querySelector`) y retorna temprano si no están.

## Scripts actuales (ejemplos)

- **`client.ts`**: bootstrap global (tema light/dark, selector ES/EN con i18next).
- **`technologies.ts`**: CRUD de tecnologías en `/technologies` (crear, editar, eliminar).
- **`technology-detail.ts`**: CRUD de conceptos en `/technologies/:techId` (crea/edita con `conceptEditModal`).
- **`projects.ts`**: crear proyecto (lista de proyectos).
- **`project-detail.ts`**: “entrypoint” de la pantalla `/projects/:projectId`; delega la lógica a módulos en `project-detail/*`.
- **`client-supabase.ts`**: helper único para inicializar Supabase en cliente.
- **`ui-feedback.ts`**: toasts y modales (confirm/prompt y modales de edición como `projectEditModal` / `embedEditModal`).

