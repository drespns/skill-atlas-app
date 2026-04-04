# Database (Supabase)

## Tablas usadas por el MVP

- `technologies`
- `concepts`
- `projects`
- `project_technologies`
- `project_concepts`
- `project_embeds`

## SaaS (en repo; aplicar en Supabase en orden)

Migracion multi-tenant y portfolio por token (scripts versionados):

| Orden | Archivo | Contenido |
|-------|---------|-----------|
| (previo si aplica) | `docs/sql/mvp-constraints.sql` | Unicidad conceptos por tecnologia; `sort_order` por proyecto |
| 1 | `docs/sql/saas-001-user-id-profiles.sql` | `user_id` en `technologies`, `projects`, `concepts`; tabla `portfolio_profiles`; indices `(user_id, slug)` |
| 2 | `docs/sql/saas-002-rls-multi-tenant.sql` | RLS por `auth.uid() = user_id`; sin SELECT amplio de `anon` en tablas de contenido |
| 3 | `docs/sql/saas-003-fn-portfolio-share.sql` | RPC `skillatlas_portfolio_by_share_token(uuid)` (SECURITY DEFINER); `GRANT EXECUTE` a `anon` |
| 4 (si aplica) | `docs/sql/saas-004-drop-global-slug-constraints.sql` | Quita UNIQUE solo sobre `slug` en `technologies` / `projects` si quedó del esquema inicial; necesario para que distintos usuarios puedan reutilizar el mismo slug |
| 5 (recomendado si usas stack de ayuda en la nube) | `docs/sql/saas-005-portfolio-help-stack.sql` | Columna `portfolio_profiles.help_stack` (JSONB) para el «stack de ayuda» en Ajustes; la app hace upsert y tolera ausencia de columna con `select`/`upsert` reducido |
| 6 | `docs/sql/saas-006-projects-role-outcome.sql` | Columnas `projects.role`, `projects.outcome`; **reemplaza** el cuerpo de `skillatlas_portfolio_by_share_token` para incluir `role` y `outcome` en cada objeto del array `projects` del JSON |
| 7 | `docs/sql/saas-007-user-prefs.sql` | Tabla `user_prefs` (JSONB) para persistir preferencias y layout de `/settings` por usuario (RLS por `auth.uid()`). La app guarda también claves de producto en el mismo JSON (p. ej. `cvProjectSlugs` + `cvProfile` para `/cv`) — ver `src/scripts/prefs.ts` |
| 8 | `docs/sql/saas-008-portfolio-avatar.sql` | `portfolio_profiles.avatar_url` + bucket `portfolio_avatars` en Storage y políticas para que cada usuario gestione sus archivos |
| 9 | `docs/sql/saas-009-access-requests.sql` | Tabla `access_requests` (INSERT permitido para `anon`/`auth`, sin SELECT) para el formulario público de `/request-access` |
| 10 | `docs/sql/saas-010-admin-access-requests.sql` | Tabla `admin_users` (allowlist) + RLS admin-only para listar/gestionar `access_requests` desde `/admin` |
| 11 | `docs/sql/saas-011-portfolio-public-slug.sql` | `portfolio_profiles.public_slug` (unico case-insensitive) + RPC `skillatlas_portfolio_by_public_slug(text)` (`GRANT` a `anon`) para `/portfolio/<slug>` |
| 12 | `docs/sql/saas-012-cv-public-share-token.sql` | `portfolio_profiles.cv_share_enabled` + `cv_share_token` (unico) + RPC `skillatlas_cv_by_share_token(uuid)` (`GRANT` a `anon`) para `/cv/p/<token>` |

**Nota saas-006:** si ya aplicaste `saas-003`, debes aplicar **saas-006** (o al menos el bloque `CREATE OR REPLACE FUNCTION` del script) para que la RPC y el esquema coincidan con lo que espera el frontend (`select` con `role`/`outcome` y consumidores del JSON del portfolio). En entornos nuevos: orden típico … → `saas-003` → … → `saas-006`.

**Sintoma:** puedes crear solo Docker pero al añadir "Python" aparece error de slug duplicado aunque tu lista no muestre Python → casi seguro queda unicidad **global** en `slug`. Ejecuta `saas-004` y confirma que existen los indices `(user_id, slug)` de `saas-001`.

### `portfolio_profiles` (tras saas-001)

- `user_id` PK (FK a `auth.users`)
- `display_name`, `bio`
- `share_enabled`, `share_token` (unico)
- `public_slug` (tras **saas-011**): segmento de URL publica; unico por `lower(trim(...))` cuando no es NULL
- `help_stack` (JSONB, tras **saas-005**): array de claves de herramientas (`src/config/help-stack.ts`)

La **app aun no crea** la fila automaticamente al registrarse; hay que hacerlo en un siguiente paso (p. ej. primer login o trigger en auth). La RPC de saas-003 asume que existe fila cuando se activa comparticion.

### Que hacer en Supabase (checklist operativo)

1. **Backup / proyecto de prueba** si ya tienes datos en produccion.
2. Ejecutar **`mvp-constraints.sql`** si no estaba aplicado (resolver duplicados que impidan crear los indices).
3. Ejecutar **`saas-001-user-id-profiles.sql`**:
   - Las columnas `user_id` empiezan nullable.
   - **Backfill manual**: asignar el mismo `auth.users.id` a todas las filas existentes en `technologies` y `projects` (y dejar que el `UPDATE` del script alinee `concepts.user_id` desde la tecnologia).
   - Si existia **unicidad global** en `technologies.slug` o `projects.slug` (constraint o indice unico solo sobre `slug`), puede **chocar** con el indice `(user_id, slug)`. En ese caso elimina el constraint/indice global antes de crear `technologies_user_slug_idx` / `projects_user_slug_idx`.
   - Cuando no queden NULL: descomentar en el script los `ALTER ... SET NOT NULL` de `user_id`.
4. Ejecutar **`saas-002-rls-multi-tenant.sql`** (sustituye el modelo del script `rls-mvp-authenticated.sql` para estas tablas).
5. Ejecutar **`saas-003-fn-portfolio-share.sql`** para habilitar lectura publica solo vía token (la UI de `/p/...` puede llegar despues).

**Sin aplicar saas-002**: la app puede seguir usando `rls-mvp-authenticated.sql` (anon lee en build; CRUD con sesion). **Tras saas-002**: el build ya no ve filas con anon; el frontend compensa con CSR y provider tolerante a fallos en build.

## Auth (Supabase Dashboard)

- **Email + contraseña** (principal ahora): Authentication → Providers → **Email** → activar proveedor con contraseña e **habilitar signups con password**.
- **Confirmación de email**: si está obligatoria, cada alta envía correo (cuenta para rate limits). Para desarrollo, desactiva confirmación o ajusta “Rate limit for sending emails”.
- **OAuth (varias tecnologías)**: activa providers en Authentication → Providers:
  - `Google`
  - `GitHub`
  - `LinkedIn (OIDC)` (en código el provider es `linkedin_oidc`)
  - `Notion` (si lo tienes como proveedor configurado en Supabase; si usas “Custom OAuth”, configura el nombre/provider exacto que te permita `signInWithOAuth`)
- **URLs de redirección**: añade `http://localhost:4321/login` y `http://localhost:4321/settings` (y tu dominio de producción) en URL Configuration.

Notas:
- GitHub usa `provider: "github"`.
- LinkedIn usa `provider: "linkedin_oidc"` (ver doc oficial de Supabase para LinkedIn OIDC).

## Relaciones

- `concepts.technology_id -> technologies.id` (1:N)
- `project_technologies` (N:N entre projects y technologies)
- `project_concepts` (N:N entre projects y concepts)
- `project_embeds.project_id -> projects.id` (1:N)

### Tabla `projects` (campos relevantes al MVP actual)

Además de `id`, `user_id`, `slug`, `title`, `description` (y timestamps si los hubiera):

| Columna | Tipo | Uso |
|---------|------|-----|
| `role` | `text` nullable | Rol o responsabilidad en el proyecto (historia). |
| `outcome` | `text` nullable | Resultado o impacto (historia). |

Añadidas por **`docs/sql/saas-006-projects-role-outcome.sql`**. El cliente Supabase hace `UPDATE`/`SELECT` incluyendo estas columnas; sin migración, fallan esas queries.

### Tabla `project_embeds` (evidencias)

| Columna | Uso |
|---------|-----|
| `project_id` | FK al proyecto. |
| `kind` | `iframe` o `link` (texto en BD; validación en app). |
| `title` | Título visible. |
| `url` | URL absoluta. |
| `sort_order` | Orden dentro del proyecto (0, 1, 2…; unicidad recomendada `(project_id, sort_order)` vía `mvp-constraints.sql`). |

La **detección** del “tipo de sitio” (Tableau, GitHub, etc.) **no se persiste**: se calcula en cliente desde `url` (`src/lib/evidence-url.ts`).

### RPC `skillatlas_portfolio_by_share_token`

Definida en **saas-003** y **actualizada** en **saas-006**. Cada elemento de `projects` en el JSON incluye, entre otros: `slug`, `title`, `description`, **`role`**, **`outcome`**, `technologyNames`, `primaryEmbed` (`kind`, `title`, `url`).

### RPC `skillatlas_portfolio_by_public_slug`

Definida en **saas-011**. Misma forma de payload que la RPC por token, mas `helpStack` (JSON array, desde `portfolio_profiles.help_stack`). Solo resuelve filas con `share_enabled = true` y `public_slug` coincidente (comparacion case-insensitive).

## Nota sobre `/portfolio` (CSR)

Con RLS multi-tenant (saas-002), el build estático no puede listar proyectos del usuario con `anon`. Por eso la pantalla `/portfolio` en modo Supabase:

- carga el perfil público en cliente (`portfolio-public-profile.ts`)
- carga el **listado de proyectos** en cliente con sesión (`portfolio-projects.ts`)

No requiere cambios de esquema; usa las mismas tablas (`projects`, `project_embeds`, relaciones N:N) y se beneficia de `saas-006` (role/outcome).

## Slugs (clave para frontend)

El frontend usa slugs como ids "publicos" en UI:

- tecnologia -> `technologies.slug`
- proyecto -> `projects.slug`

Con multi-tenant, la unicidad de negocio es **por usuario**: `(user_id, slug)`.

## RLS (historial y transicion)

- **Transicion single-tenant / anon lee todo**: `docs/sql/rls-mvp-authenticated.sql` (autenticado CRUD; anon SELECT para SSG).
- **Objetivo SaaS**: `docs/sql/saas-002-rls-multi-tenant.sql` — `authenticated` solo filas propias; `anon` sin lectura directa al contenido; portfolio publico solo via RPC (saas-003).

## SQL recomendado para constraints extra

`docs/sql/mvp-constraints.sql`:

- indice unico funcional en `concepts`: `(technology_id, lower(trim(title)))`
- indice unico en `project_embeds`: `(project_id, sort_order)`
- las relaciones N:N siguen cubiertas con PK compuesta
