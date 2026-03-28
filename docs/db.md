# Database (Supabase)

## Tablas usadas por el MVP

- `technologies`
- `concepts`
- `projects`
- `project_technologies`
- `project_concepts`
- `project_embeds`

## Relaciones

- `concepts.technology_id -> technologies.id` (1:N)
- `project_technologies` (N:N entre projects y technologies)
- `project_concepts` (N:N entre projects y concepts)
- `project_embeds.project_id -> projects.id` (1:N)

## Slugs (clave para frontend)

El frontend usa slugs como ids "publicos":

- tecnologia -> `technologies.slug`
- proyecto -> `projects.slug`

## RLS (recomendado tras magic link)

Script versionado en el repo: `docs/sql/rls-mvp-authenticated.sql`

- Elimina policies antiguas en las tablas del MVP y crea un conjunto nuevo.
- **Modo por defecto del script**: `authenticated` tiene CRUD completo; `anon` solo **SELECT** (así el build estatico de Astro con la anon key sigue pudiendo leer datos; el CRUD en navegador usa JWT de sesion).
- Las policies se aplican **una vez** en la base de datos; no se crean por cada usuario.

Opcional (single-account mas estricto): restringir `authenticated` por email; instrucciones al final del mismo SQL. Si quitas tambien el SELECT de `anon`, hace falta leer en build con **service role** u otro enfoque.

## RLS legacy (MVP anterior)

Si aun no has aplicado el script: RLS con policies abiertas para `anon` (todo permitido). Sustituir cuanto antes por el script anterior.

## Cambio futuro (multiusuario, fuera de alcance actual)

1. Columna `user_id` en tablas principales.
2. Policies por `auth.uid()` por fila.

## SQL recomendado para constraints extra

Script listo para aplicar en Supabase: `docs/sql/mvp-constraints.sql`

- indice unico funcional en `concepts`: `(technology_id, lower(trim(title)))`
- indice unico en `project_embeds`: `(project_id, sort_order)`
- las relaciones N:N siguen cubiertas con PK compuesta

