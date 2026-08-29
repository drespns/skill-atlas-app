# AGENTS.md

Guia operativa para cualquier nuevo agente que entre al proyecto.

## Estado del proyecto (2026)

**Producto activo = finanzas personales** (cuaderno de gastos, suscripciones, patrimonio, inversiones).

- Ruta principal: **`/tools/expense-tracker`** (también `/app` redirige ahí).
- Login post-auth → `/tools/expense-tracker`.
- CV, tecnologías, proyectos, portfolio, study y el resto de `/tools` quedan **aparcados** (código y rutas vivas; fuera de la barra de navegación).
- Dominio/rebrand completo puede llegar después; el nombre visible en cabecera es **Finanzas**.
- El monorepo hermano `finanzas-app` fue un ensayo de extracción; **no** es el camino activo.

## Objetivo del proyecto

SkillAtlas se reorienta a una app de finanzas:

- gastos y suscripciones
- patrimonio, deudas, escenarios, inversiones
- sync opcional + E2E (`user_client_state` / `tools_expense_tracker`)
- app móvil Expo (`mobile/`)

Legacy (no priorizar features nuevas):

- tecnologias / conceptos / proyectos / embeds
- portfolio publico y CV

## Stack actual

- **pnpm** monorepo (`pnpm-workspace.yaml`: raíz web, `packages/*`, `mobile/`); lockfile `pnpm-lock.yaml`
- Astro
- Tailwind CSS v4
- Supabase (PostgreSQL + RLS; SaaS multi-tenant histórico en `docs/sql/saas-001` … — ver `docs/db.md`)
- Dominio compartido: `packages/expense-core` (`@skill-atlas/expense-core`)
- Despliegue **Vercel:** `@astrojs/vercel` en `astro.config.mjs`
- TypeScript para scripts cliente; aliases de `tsconfig.json`
- Cliente Supabase: `getSupabaseBrowserClient()` en `src/scripts/core/client-supabase.ts`

## Auth (login convencional)

- La pantalla principal es **`/login`** (email+contraseña + OAuth).
- Tras login → **`/tools/expense-tracker`**.
- `Ajustes` (`/settings`) para sesión, logout y preferencias UI.
- En el header (sesión): **Cuaderno** + Ajustes/avatar; sin CV/tech/proyectos/tools en la barra.
- Providers: GitHub (`github`), LinkedIn (`linkedin_oidc`).

## Variables de entorno

Requeridas en `.env`:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_DATA_SOURCE` (`mock` o `supabase`)

## Convenciones clave del dominio (finanzas)

- Estado en `packages/expense-core` + UI en `src/components/tools/expense-tracker/` + scripts `src/scripts/tools/expense-tracker*.ts`.
- Persistencia local `skillatlas_tools_expense_tracker_v1`; nube scope `tools_expense_tracker`.

## Data layer (legacy portfolio)

Usar siempre `src/data/index.ts` como facade si se toca portfolio/tech (no es el foco del producto).

## Archivos sensibles para no romper

- `packages/expense-core/**`
- `src/scripts/tools/expense-tracker.ts` y helpers
- `src/pages/tools/expense-tracker.astro`
- `src/scripts/core/user-client-state.ts`
- `src/scripts/client.ts` y `src/scripts/client-shell/*`
- `src/pages/login.astro` + `src/scripts/login/login-auth.ts`

## Regla de trabajo recomendada

1. Cambios pequeños y verticales en el cuaderno de finanzas.
2. Evitar features nuevas en CV/portfolio/study sin consenso.
3. Validar con `pnpm build` / `pnpm test` tras cambios de dominio.
4. Tras cambios de producto o rutas, actualizar `docs/architecture.md` / `docs/backlog.md` cuando proceda.

## Git: formato de commits y tags (obligatorio)

Formato deseado:

- **Asunto** (1 línea): `tipo: resumen corto`
  - Usar prefijos como `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- **Cuerpo**: lista de bullets con `- `.

Ejemplo:

```
feat: algo resumido

- Punto 1 (área)
- Punto 2 (área)
```

Para releases, crear **tag anotado** (`git tag -a ...`) con el mismo estilo de bullets.
