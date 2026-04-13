# Persistencia local (browser)

Documento de referencia para todo lo que **se guarda en el navegador** (principalmente `localStorage`, algo de `sessionStorage`). Sirve para:

- saber qué datos existen “solo en este dispositivo”
- facilitar migraciones si algún día pasan a cuenta/Supabase
- evitar colisiones de keys y entender su impacto en UX

> Nota: desde **v0.130.0** (sync en cuenta vía `user_client_state` y prefs remotas) parte del estado pasa a ser **remote-first** (Supabase) y `localStorage` queda como **caché/offline** para UX.

---

## `localStorage` — claves

### Preferencias UI

- **`skillatlas_prefs_v1`**
  - **qué**: caché local de preferencias de UI (tema, idioma, layout, bubble tabs, etc.)
  - **dónde**: `src/scripts/core/prefs.ts`
  - **alcance**: dispositivo/navegador (**cache**; la cuenta persiste en `user_prefs`)

Claves legacy (compatibilidad):

- **`theme`** (`"dark"`/`"light"`) — legacy
- **`lang`** (`"es"`/`"en"`) — legacy

### Bubble (FAB)

- **`skillatlas_fab_calendar_v1`**
  - **qué**: caché local del calendario del bubble (`date`, `title`, `tag`)
  - **dónde**: `src/scripts/shell/fab-bubbles.ts`
  - **alcance**: dispositivo/navegador (**cache**; la cuenta persiste en `user_client_state` scope `fab_calendar`)

### Herramientas (`/tools`)

- **`skillatlas_tools_habits_v1`**
  - **qué**: caché local de hábitos + checks por mes
  - **dónde**: `src/scripts/tools/habits.ts`
  - **alcance**: dispositivo/navegador (**cache**; la cuenta persiste en `user_client_state` scope `tools_habits`)

- Otras rutas bajo `/tools` (p. ej. checklist pre-entrevista, Pomodoro) pueden usar **solo memoria de sesión** o claves propias en `localStorage`; no hay sync remota unificada salvo la indicada en cada script.

### Estudio (`/study`)

- **`skillatlas_study_workspace_v1`**
  - **qué**: estado del workspace en cliente (fallback/cache; usado también para migración inicial si remoto está vacío)
  - **dónde**: `src/scripts/study/study-workspace.ts` (orquesta) y `src/scripts/study/workspace/*` (estado local por `study_space_id` en clave `skillatlas_study_workspace_v1:<id>`).
  - **alcance**: dispositivo/navegador

- **`skillatlas_study_dossiers_v1`**
  - **qué**: caché local de artefactos “dossier”; la **fuente de verdad** con sesión es `user_client_state` scope `study_dossiers` ((remote-first, como bubble/hábitos).
  - **dónde**: `src/scripts/study/dossier-store.ts`
  - **alcance**: dispositivo/navegador + cuenta (sync)

- **`skillatlas_study_curriculum_v1`**
  - **qué**: caché del temario (bloques/temas/estado); remoto en `user_client_state` scope `study_curriculum`.
  - **dónde**: `src/scripts/study/study-curriculum.ts`

### Dashboard / Actividad / GitHub

- **`skillatlas_recent_activity_v1`**
  - **qué**: actividad reciente en `/app` (últimos proyectos/tecnologías abiertos); con sesión se **fusiona** con `user_client_state` scope **`recent_activity`** (remote-first al iniciar sesión; cada visita guarda en local + nube).
  - **dónde**: `src/scripts/app/recent-activity.ts`

- **`skillatlas_dashboard_github_scope_v1`**
  - **qué**: selector de alcance del bloque GitHub (todos/proyecto)
  - **dónde**: `src/scripts/app/app-dashboard.ts`

- **`skillatlas_dashboard_stack_mode_v1`**
  - **qué**: modo de stack/visualizaciones en dashboard
  - **dónde**: `src/scripts/app/app-dashboard.ts`

- **`skillatlas_github_weights_v1:<projectSlug>`**
  - **qué**: pesos de lenguajes/tech calculados por proyecto
  - **dónde**: `src/scripts/app/app-dashboard.ts`

### Landing / shell

- **`skillatlas_banner_dismissed:<bannerId>`**
  - **qué**: “dismiss” del banner global
  - **dónde**: `src/scripts/client-shell/global-banner.ts`

- **`skillatlas_last_auth_provider`**
  - **qué**: último provider usado para login (UX)
  - **dónde**: `src/scripts/client-shell/auth-header-bootstrap.ts`

### Tecnologías

- **`skillatlas_technologies_multi_draft_v1`**
  - **qué**: borrador de selección múltiple (chips) en `/technologies`
  - **dónde**: `src/scripts/technologies/technologies.ts`

- **`skillatlas_tech_filter_stack_v1`**
  - **qué**: filtro “solo stack” en listado de tecnologías
  - **dónde**: `src/scripts/technologies/technologies.ts`

---

## `sessionStorage` — claves

`sessionStorage` se usa solo como caché “rápida” por pestaña:

- **`skillatlas_cache_palette_v2:<userId>`**
  - **qué**: caché de items de command palette para no re-hidratar en cada apertura
  - **dónde**: `src/scripts/shell/command-palette.ts`

- **`skillatlas_cache_technologies_grid_v1:<userId>`**
  - **qué**: caché del HTML de grid de tecnologías (optimización)
  - **dónde**: `src/scripts/technologies/technologies.ts`

---

## Riesgos y criterios

- **Privacidad**: todo lo de `localStorage` es legible por scripts en el mismo dominio; no guardar secretos.
- **Multi-dispositivo**: prefs/FAB/tools pasan a viajar con cuenta; el resto depende del `scope` y tablas remotas.
- **Migraciones**: versionar keys (sufijo `_v1`, `_v2`…) para poder invalidar/transformar.

