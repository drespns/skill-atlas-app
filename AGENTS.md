# AGENTS.md

Guia operativa para cualquier nuevo agente que entre al proyecto.

## Objetivo del proyecto

SkillAtlas es un MVP para gestionar conocimiento tecnico y mostrar portfolio:

- tecnologias
- conceptos por tecnologia
- proyectos
- embeds por proyecto
- portfolio publico

## Stack actual

- Astro
- Tailwind CSS v4
- Supabase (PostgreSQL + RLS; transicion `docs/sql/rls-mvp-authenticated.sql`; SaaS multi-tenant `docs/sql/saas-001` … `saas-003` — ver `docs/db.md`)
- TypeScript para scripts cliente
- Cliente Supabase en el navegador: `getSupabaseBrowserClient()` en `src/scripts/client-supabase.ts` (evitar repetir `createClient` en cada script)

## Auth (login convencional)

- La pantalla principal es **`/login`** (email+contraseña + OAuth).
- `Ajustes` (`/settings`) se usa para estado de sesión y logout.
- En el header:
  - si NO hay sesión: aparece icono de `/login`
  - si hay sesión: aparecen **Ajustes + Sign out** y avatar (si el provider lo devuelve)
- Providers usados en el cliente:
  - GitHub: `provider: "github"`
  - LinkedIn: `provider: "linkedin_oidc"` (OIDC, no `"linkedin"`)

## Variables de entorno

Requeridas en `.env`:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_DATA_SOURCE` (`mock` o `supabase`)

## Convenciones clave del dominio

- Los conceptos siempre pertenecen a una tecnologia.
- Los conceptos se crean desde el detalle de tecnologia: en **mock** `/technologies/[techId]`; en **Supabase** `/technologies/view?tech=<slug>` (CSR).
- Un proyecto se relaciona con muchas tecnologias.
- Un proyecto se relaciona con muchos conceptos.
- En detalle de proyecto, el picker de conceptos solo muestra conceptos de tecnologias asociadas al proyecto (**mock**: `/projects/[projectId]`; **Supabase**: `/projects/view?project=<slug>`).

## Data layer (importante)

Usar siempre `src/data/index.ts` como facade.

- No importar `src/data/mock.ts` directamente en paginas/componentes.
- `src/data/index.ts` selecciona provider por `PUBLIC_DATA_SOURCE`.
- Providers actuales:
  - `src/data/providers/mockProvider.ts`
  - `src/data/providers/supabaseProvider.ts`

## Estado funcional actual

Persistencia Supabase implementada para:

- crear, editar y eliminar tecnologias
- crear, editar y eliminar conceptos
- crear, editar y eliminar proyectos
- asociar/desasociar tecnologias de un proyecto
- asociar conceptos a proyecto
- crear/eliminar/reordenar embeds
- con Supabase, listas y detalles relevantes se hidratan en **cliente** (ver `docs/architecture.md`)

UI/UX:

- dark mode
- selector ES/EN basico
- modales in-app y toasts custom

## Archivos sensibles para no romper

- `src/data/index.ts`
- `src/data/providers/supabaseProvider.ts`
- `src/scripts/ui-feedback.ts`
- `src/scripts/client.ts` (header auth + vars layout)
- `src/pages/login.astro` + `src/scripts/login-auth.ts`
- `src/scripts/login-earth.ts` + `src/shaders/*` + assets en `public/static/earth/*`
- `src/pages/technologies/[techId].astro` y `src/pages/technologies/view.astro`
- `src/pages/projects/[projectId].astro` y `src/pages/projects/view.astro`
- `src/scripts/project-view-bootstrap.ts`, `src/scripts/technology-view-bootstrap.ts`

## Regla de trabajo recomendada

1. Cambios pequeños y verticales.
2. Mantener scripts cliente separados por pantalla.
3. Validar con `npm run build` tras cambios.
4. Evitar introducir features fuera del flujo MVP sin consenso.
5. Tras cambios de producto, DB o rutas, actualizar `docs/architecture.md`, `docs/db.md` y/o `docs/backlog.md` cuando proceda.

## Git: formato de commits y tags (obligatorio)

Formato deseado:

- **Asunto** (1 línea): `tipo: resumen corto`
  - Usar prefijos como `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- **Cuerpo**: lista de bullets con `- ` (como en el ejemplo del repo), explicando cambios clave por áreas.

Ejemplo:

```
feat: algo resumido

- Punto 1 (área)
- Punto 2 (área)
- Punto 3 (área)
```

Para releases, crear **tag anotado** (`git tag -a ...`) usando el mismo estilo de bullets en el mensaje del tag.

