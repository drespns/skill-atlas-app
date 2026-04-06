# Mapa de código (rutas, features → archivos)

Referencia rápida para localizar implementación sin recorrer todo el repo. Complementa `docs/architecture.md` y `AGENTS.md`.

## Rutas → página y scripts cliente

Rutas públicas o de app según `src/pages/`. Los scripts viven en `src/scripts/` agrupados por dominio (ver sección siguiente).

| Ruta | Página (`src/pages/…`) | Script(s) principal(es) (`src/scripts/…`) |
|------|-------------------------|-------------------------------------------|
| `/` (landing) | `index.astro` | `landing/landing-page.ts`, `landing/landing-charts-preview.ts` (gráfico demo) |
| `/login` | `login.astro` | `login/login-auth.ts`, `login/login-earth.ts` |
| `/app` | `app.astro` | `app/app-dashboard.ts`, `app/app-dashboard-charts.ts` (Apache ECharts), `app/app-onboarding.ts` |
| `/settings` | `settings.astro` | `settings/settings-auth.ts`, `settings/settings-prefs.ts`, `settings/settings-classic-ui.ts`, `settings/settings-profile.ts`, `settings/settings-qa.ts` |
| `/cv` | `cv.astro` | `cv/cv-page.ts` |
| `/cv/p/[token]` (CV público) | `cv/p/[token].astro` | `cv/public-cv-by-token.ts` |
| `/pricing` | `pricing.astro` | `pricing/pricing-billing.ts` |
| `/portfolio` (sesión) | `portfolio.astro` | `portfolio/portfolio-public-profile.ts`, `portfolio/portfolio-projects.ts` (Supabase) |
| `/portfolio/[slug]` (público por slug) | `portfolio/[slug].astro` | `portfolio/public-portfolio-by-slug.ts` |
| `/p/[token]` (público por token) | `p/[token].astro` | `portfolio/public-portfolio-by-token.ts` |
| `/projects` | `projects.astro` | `projects/projects.ts`; con Supabase también `core/view-toggle.ts` |
| `/projects/view?project=…` | `projects/view.astro` | `projects/project-view-bootstrap.ts` |
| `/projects/[projectId]` (mock) | `projects/[projectId].astro` | `projects/project-detail.ts` (solo Supabase) |
| `/technologies` | `technologies.astro` | `technologies/technologies.ts`; con Supabase también `core/view-toggle.ts` |
| `/technologies/view?tech=…` | `technologies/view.astro` | `technologies/technology-view-bootstrap.ts` |
| `/technologies/[techId]` (mock) | `technologies/[techId].astro` | `technologies/technology-detail.ts` (solo Supabase) |
| `/study` | `study.astro` | `study/study-workspace.ts` |
| `/admin` | `admin.astro` | `admin/admin-access-requests.ts` |
| `/request-access` | `request-access.astro` | `access/request-access.ts` |
| `/demo`, `/prep` | `demo.astro`, `prep.astro` | (sin scripts dedicados en tabla; layout global) |

**Layout global:** `src/layouts/AppShell.astro` carga `client.ts`, `shell/fab-bubbles.ts`, `shell/onboarding-spotlight.ts`. El modal de command palette se inicializa desde `client.ts` → `shell/command-palette.ts`.

## Componentes Astro por área (extractos)

| Área | Carpeta |
|------|---------|
| Shell (banner, header, footer, palette, FAB) | `src/components/shell/*` |
| Landing | `src/components/landing/*` (página: `index.astro`) |
| Precios | `src/components/pricing/*` |
| CV | `src/components/cv/*` |
| Ajustes | `src/components/settings/*` |

## Estructura `src/scripts/`

| Carpeta / archivo | Contenido |
|-------------------|-----------|
| `client.ts` | Orquestación del boot global; importa `shell/command-palette` y `client-shell/*`. |
| `core/` | Infra compartida en cliente: `client-supabase.ts`, `prefs.ts`, `ui-feedback.ts`, `auth-session.ts`, `admin-role.ts`, `public-profile-local.ts`, `view-toggle.ts`. |
| `shell/` | Chrome cargado por etiqueta `<script>` en layout: `command-palette.ts`, `fab-bubbles.ts`, `onboarding-spotlight.ts`. |
| `client-shell/` | Módulos del boot global (banner, prefs, i18n, auth header, nav, guard, landing CTAs). |
| `login/` | Login y escena Three.js. |
| `settings/` | Ajustes (auth barra, prefs form, UI clásica, perfil, QA). |
| `cv/` | CV privado y página pública por token. |
| `portfolio/` | Portfolio sesión, público slug/token, página compartida `public-portfolio-public-page.ts`. |
| `projects/` | Listas, bootstrap vista CSR, entrada mock `project-detail.ts`, subcarpeta `project-detail/*`. |
| `technologies/` | Listas, bootstrap vista CSR, entrada mock `technology-detail.ts`, subcarpeta `technology-detail/*`. |
| `app/` | Dashboard y onboarding del home app; `recent-activity.ts` (historial local + usado por bootstraps). |
| `landing/` | Efectos de la landing. |
| `pricing/` | Toggle facturación en `/pricing`. |
| `admin/` | Panel admin (solicitudes). |
| `access/` | Formulario request access. |
| `study/` | Workspace estudio. |

Imports entre dominios: preferir `../core/…` para Supabase, prefs, toasts y sesión; el detalle de proyecto importa semillas de conceptos desde `technologies/technology-detail/concept-seeds.ts` cuando hace falta.

## Layout global (AppShell)

| Área | Componente Astro | Script cliente |
|------|------------------|----------------|
| HTML document + `<ClientRouter />` | `src/layouts/AppShell.astro` | — |
| Script inline prefs (FOUC tema/densidad) | `src/components/shell/AppShellHeadBootstrap.astro` | Duplica defaults con `src/scripts/core/prefs.ts` (`loadPrefs` / `applyPrefs`) |
| Banner dismiss (`data-sa-banner-dismissed`) | `src/components/shell/AppShellBannerDismissScript.astro` | — |
| Banner sticky | `src/components/shell/AppGlobalBanner.astro` | `src/scripts/client-shell/global-banner.ts` |
| Cabecera (nav, palette trigger, idioma, tema, auth) | `src/components/shell/AppHeader.astro` | `client-shell/header-nav.ts`, `header-icons.ts`, `auth-header-bootstrap.ts`, `i18n-bootstrap.ts`, `prefs-bootstrap.ts`, `command-palette-trigger.ts` |
| Pie | `src/components/shell/AppFooter.astro` | Misma visibilidad auth que header vía `auth-header-bootstrap.ts` |
| Command palette (modal) | `src/components/shell/AppCommandPalette.astro` | `src/scripts/shell/command-palette.ts` |
| FAB (atajos / checklist / IA) | `src/components/shell/AppFabShell.astro` | `src/scripts/shell/fab-bubbles.ts` |
| Onboarding spotlight | — (marcadores en páginas) | `src/scripts/shell/onboarding-spotlight.ts` |

**Bootstrap global:** `src/scripts/client.ts` solo orquesta; módulos en `src/scripts/client-shell/`.

## Cliente global (`client-shell/`)

| Módulo | Responsabilidad |
|--------|-----------------|
| `global-banner.ts` | Estado abierto/cerrado del banner, `localStorage`, delegación cierre |
| `layout-vars.ts` | `--app-header-h` desde altura real del header |
| `prefs-bootstrap.ts` | `applyPrefs`, botón tema, `matchMedia` auto, sync `user_prefs` remoto |
| `theme-toggle-sync.ts` | `aria-pressed` del toggle vs `.dark` |
| `header-nav.ts` | `syncHeaderNavActive`, indicador animado bajo enlaces |
| `header-icons.ts` | Visibilidad de `[data-header-icons]` según prefs |
| `command-palette-trigger.ts` | Click en `[data-command-palette-trigger]` |
| `i18n-bootstrap.ts` | i18next, `data-i18n`, banderas ES/EN, listener `prefs-updated` |
| `auth-header-bootstrap.ts` | Sesión Supabase, nav auth, avatar, admin link, popover marca |
| `landing-ctas.ts` | CTAs condicionados en landing (`data-landing-*`) |
| `auth-guard.ts` | `[data-requires-auth]` → redirect si no hay sesión |

## Preferencias y tipos

| Qué | Dónde |
|-----|--------|
| Esquema prefs, `SETTINGS_PANEL_IDS`, migración hash | `src/scripts/core/prefs.ts` |
| UI formulario prefs (Ajustes) | `src/components/settings/SettingsPrefsFields.astro`, `src/scripts/settings/settings-prefs.ts` |

## Datos y Supabase en navegador

| Qué | Dónde |
|-----|--------|
| Cliente browser singleton | `src/scripts/core/client-supabase.ts` |
| Facade datos (mock / supabase) | `src/data/index.ts`, `src/data/providers/*` |

## Libs compartidas (ejemplos)

| Dominio | `src/lib/*` |
|---------|-------------|
| Slug portfolio público | `public-portfolio-slug.ts` |
| Tarjeta visitante portfolio | `public-portfolio-project-card.ts` |
| Presentación / prefs visitante | `portfolio-presentation.ts`, `public-portfolio-guest-prefs.ts` |
| RPC server-side (OG, etc.) | `server-supabase-rpc.ts` |

---

*Convención:* nuevas piezas del shell → `src/components/shell/`; nueva lógica de arranque global → `src/scripts/client-shell/` y un `import` desde `client.ts` si hace falta en el boot. Nuevos scripts de pantalla → subcarpeta de dominio bajo `src/scripts/<dominio>/`; si es utilidad transversal → `src/scripts/core/`. Dentro de `src/scripts/**`, preferir imports con aliases (`@scripts/…`, `@config/…`, `@lib/…`) definidos en `tsconfig.json`.
