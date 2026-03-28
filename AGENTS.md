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
- Supabase (PostgreSQL + RLS; script recomendado `docs/sql/rls-mvp-authenticated.sql`)
- TypeScript para scripts cliente
- Cliente Supabase en el navegador: `getSupabaseBrowserClient()` en `src/scripts/client-supabase.ts` (evitar repetir `createClient` en cada script)

## Variables de entorno

Requeridas en `.env`:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_DATA_SOURCE` (`mock` o `supabase`)

## Convenciones clave del dominio

- Los conceptos siempre pertenecen a una tecnologia.
- Los conceptos se crean desde `/technologies/:techId`.
- Un proyecto se relaciona con muchas tecnologias.
- Un proyecto se relaciona con muchos conceptos.
- En `/projects/:projectId`, el picker de conceptos solo muestra conceptos de tecnologias asociadas al proyecto.

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

UI/UX:

- dark mode
- selector ES/EN basico
- modales in-app y toasts custom

## Archivos sensibles para no romper

- `src/data/index.ts`
- `src/data/providers/supabaseProvider.ts`
- `src/scripts/ui-feedback.ts`
- `src/pages/technologies/[techId].astro`
- `src/pages/projects/[projectId].astro`

## Regla de trabajo recomendada

1. Cambios pequeños y verticales.
2. Mantener scripts cliente separados por pantalla.
3. Validar con `npm run build` tras cambios.
4. Evitar introducir features fuera del flujo MVP sin consenso.

