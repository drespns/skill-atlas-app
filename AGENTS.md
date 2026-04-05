# AGENTS.md

Guia operativa para cualquier nuevo agente que entre al proyecto.

## Objetivo del proyecto

SkillAtlas es un MVP para gestionar conocimiento tecnico y mostrar portfolio:

- tecnologias
- conceptos por tecnologia
- proyectos
- embeds por proyecto
- portfolio publico (preview en sesion `/portfolio`; URL legible `/portfolio/<slug>` **saas-011**; enlace revocable `/p/<token>` **saas-003**)
- CV privado (`/cv`; seleccion/orden de proyectos + perfil del CV en prefs; preview modal; print en claro; enlace publico opcional `/cv/p/<token>` **saas-012**)

## Stack actual

- Astro
- Tailwind CSS v4
- Supabase (PostgreSQL + RLS; transicion `docs/sql/rls-mvp-authenticated.sql`; SaaS multi-tenant `docs/sql/saas-001` … `saas-014` — ver `docs/db.md`)
- Despliegue **Vercel:** `@astrojs/vercel` en `astro.config.mjs` (rutas on-demand); no commitear `.vercel/` ni `dist/`
- TypeScript para scripts cliente; imports con aliases de `tsconfig.json` (`@scripts/*`, `@lib/*`, `@config/*`, …) dentro de `src/scripts/**`
- Cliente Supabase en el navegador: `getSupabaseBrowserClient()` en `src/scripts/core/client-supabase.ts` (evitar repetir `createClient` en cada script)

## Auth (login convencional)

- La pantalla principal es **`/login`** (email+contraseña + OAuth).
- `Ajustes` (`/settings`) se usa para estado de sesión, logout, preferencias UI (navegación lateral estilo “repo settings”), perfil público y stack de ayuda (`portfolio_profiles` + localStorage). Secciones enlazables con hash (`#prefs`, `#portfolio-links`, `#portfolio-presentation`, …); bookmarks antiguos `#classic-*` se redirigen en cliente al id nuevo. **Enlaces públicos:** visibilidad y slug se guardan con **Aplicar** (toast), no solo con el checkbox; **Guardar perfil** es para el bloque de perfil (nombre, bio, enlaces, stack).
- En el header:
  - si NO hay sesión: aparece icono de `/login`
  - si hay sesión: aparecen **Ajustes + Sign out** y avatar (si el provider lo devuelve); enlaces de app (CV, tecnologías, proyectos, portfolio); **Admin** si allowlist; **no** hay enlace a **Precios** en la barra (Precios: landing/hero + footer con sesión).
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
- `src/scripts/core/ui-feedback.ts`
- `src/scripts/client.ts` (orquesta boot global) y `src/scripts/client-shell/*` (banner, nav, prefs, i18n, auth header); mapa en `docs/code-locations.md`
- `src/pages/login.astro` + `src/scripts/login/login-auth.ts`
- `src/scripts/login/login-earth.ts` + `src/shaders/*` + assets en `public/static/earth/*`
- `src/pages/technologies/[techId].astro` y `src/pages/technologies/view.astro`
- `src/pages/projects/[projectId].astro` y `src/pages/projects/view.astro`
- `src/scripts/projects/project-view-bootstrap.ts`, `src/scripts/technologies/technology-view-bootstrap.ts`
- `src/scripts/settings/settings-profile.ts`, `src/scripts/cv/cv-page.ts`, `src/lib/public-portfolio-slug.ts` (perfil, CV, slug publico)

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

