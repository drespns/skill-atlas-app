# `src/scripts/`

Scripts TypeScript que se cargan en el **navegador** (client-side) desde páginas Astro con `<script src="../scripts/<carpeta>/….ts"></script>` (procesados por Astro; ver `docs/architecture.md`).

En este proyecto, los scripts viven **por dominio** en subcarpetas (`login/`, `portfolio/`, `settings/`, …) y en **`core/`** para utilidades compartidas (Supabase browser, prefs, toasts, sesión).

**Imports:** usar aliases de `tsconfig.json` — p. ej. `@scripts/core/client-supabase`, `@config/help-stack`, `@lib/evidence-url`, `@shaders/...`, `@i18n/es.json` — en lugar de `../../../`.

## Convenciones

- **Selectores por `data-*`**: la UI marca puntos de enganche con atributos como `data-tech-form`, `data-project-id`, `data-project-embed-edit`, etc.
- **Facade de Supabase en navegador**: usa `getSupabaseBrowserClient()` de `core/client-supabase.ts` (evita repetir `createClient()` en cada script).
- **Feedback UI**: usa `core/ui-feedback.ts` para toasts y modales consistentes.
- **Cargar solo cuando aplica**: cada script valida que existan los nodos (`querySelector`) y retorna temprano si no están.

## Estructura

- **`client.ts`**: único entry del **shell global** (AppShell); orquesta el boot e importa `shell/command-palette` y `client-shell/*`.
- **`core/`**: `client-supabase`, `prefs`, `ui-feedback`, `auth-session`, `admin-role`, `public-profile-local`, `view-toggle`.
- **`shell/`**: scripts referenciados con `<script src>` desde `AppShell` además de `client.ts` — `command-palette`, `fab-bubbles`, `onboarding-spotlight`.
- **`client-shell/*`**: módulos del chrome (banner, nav, prefs, i18n, auth header, landing CTAs, guard). Importan desde `../core/…`. Ver `client-shell/README.md`.
- **Por dominio**: `login/`, `settings/`, `cv/`, `portfolio/`, `projects/` (+ `projects/project-detail/`), `technologies/` (+ `technologies/technology-detail/`), `app/`, `landing/`, `pricing/`, `admin/`, `access/`, `study/`.

## Mapa amplio de features

Tabla de **rutas → scripts** y detalle en **`docs/code-locations.md`**.

## Ejemplos

- **`client.ts`** + **`client-shell/*`**: tema, prefs, i18n, cabecera/auth, banner, command palette trigger, layout CSS vars.
- **`shell/command-palette.ts`**: modal de búsqueda/navegación (`Ctrl+K`).
- **`shell/fab-bubbles.ts`**: panel flotante atajos/checklist/IA.
- **`technologies/technologies.ts`**: CRUD de tecnologías en `/technologies`.
- **`technologies/technology-detail.ts`**: entry mock Supabase para detalle tecnología; lógica en `technology-detail/*`.
- **`projects/projects.ts`**: crear proyecto (lista de proyectos).
- **`projects/project-detail.ts`**: entry mock Supabase para detalle proyecto; delega en `projects/project-detail/*`.
- **`core/client-supabase.ts`**: singleton Supabase en cliente.
- **`core/ui-feedback.ts`**: toasts y modales (`projectEditModal` / `embedEditModal`, etc.).
