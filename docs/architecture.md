# Architecture

## Vista general

La app sigue arquitectura de frontend server-rendered con scripts cliente para acciones CRUD.

- Render: Astro pages (`src/pages`)
- UI reusable: `src/components`
- Shell global: `src/layouts/AppShell.astro`
- Data access facade: `src/data/index.ts`
- Providers: mock y supabase
- Scripts cliente por pagina: `src/scripts/*.ts`

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
- embeds desde `project_embeds` ordenados por `sort_order`

## UI Actions (cliente)

Scripts principales:

- `technologies.ts` -> CRUD tecnologia (lista)
- `technology-detail.ts` -> CRUD concepto (detalle tecnologia)
- `projects.ts` -> crear proyecto
- `project-detail.ts` + `project-detail/*` -> CRUD avanzado proyecto
- `client-supabase.ts` -> `getSupabaseBrowserClient()` para scripts en navegador
- `ui-feedback.ts` -> modales y toasts

## Tradeoffs actuales

- Hay bastante logica en scripts cliente (rapido para MVP).
- Para escalar, conviene:
  - extraer servicios compartidos de Supabase por entidad
  - reducir logica duplicada en scripts
  - mover mas validacion a DB (constraints + unique indexes)

## Roadmap (producto prioritario)

Plan detallado para **multiusuario + portfolio por enlace compartido**: `docs/plan-saas-multi-tenant-portfolio.md` (incluye decision CSR vs SSR y fases de migracion).

