# SkillAtlas

![Astro](https://img.shields.io/badge/Astro-6-FF5D01?logo=astro&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![Status](https://img.shields.io/badge/Status-MVP-blue)
![License](https://img.shields.io/badge/License-Private-lightgrey)

Aplicación web para **organizar conocimiento técnico** y **mostrar un portfolio** coherente: tecnologías, conceptos por tecnología, proyectos con embeds y perfil público. Pensada como MVP con datos **mock** o **Supabase** (PostgreSQL, RLS multi-tenant), misma interfaz en ambos modos.

**Versión de producto (rama actual):** **v0.130.0** — alinear con `package.json`, `src/config/banner.ts` y el registro en [`docs/backlog.md`](docs/backlog.md).

---

## Qué incluye hoy

- **Flujo**: Tecnologías → Conceptos → Proyectos → Portfolio; conceptos siempre ligados a una tecnología; proyectos enlazan tecnologías y conceptos.
- **Persistencia Supabase**: CRUD de tecnologías, conceptos y proyectos; asociaciones proyecto–tecnología y proyecto–concepto; **evidencias** por proyecto (`project_embeds`: enlace o iframe, ordenables; visibilidad/thumbnail en público con **`saas-015`**); **portada opcional por proyecto** (Storage `project_covers`, **`saas-016`**); campos de **historia** en proyecto (`role`, `outcome` — `docs/sql/saas-006-projects-role-outcome.sql`); perfil en `portfolio_profiles` (nombre, bio, stack de ayuda con `docs/sql/saas-005-portfolio-help-stack.sql`) y **avatar** (Storage + `docs/sql/saas-008-portfolio-avatar.sql`).
- **Autenticación**: `/login` con email/contraseña y OAuth (GitHub, LinkedIn OIDC); sesión y logout desde **Ajustes**.
- **Ajustes** (`/settings`): preferencias de UI (tema, densidad, fuente, atajos), **dashboard** con rejilla configurable (1–4 columnas en escritorio), orden de tarjetas por arrastre, perfil público y stack de ayuda; enlaces profundos por hash (p. ej. `#portfolio-links`, `#prefs`); visibilidad/slug del portfolio público con botón **Aplicar** y feedback (toast).
- **Portfolio** (`/portfolio`): preview autenticado; visitantes en `/portfolio/<slug>` o `/p/<token>` (RPCs públicas; ver `docs/db.md`).
- **Acceso privado (invite-only)**: landing pública con CTA **“Solicitar acceso”** (`/request-access`) que guarda solicitudes en BD (migración `docs/sql/saas-009-access-requests.sql`).
- **Import de conceptos** (detalle de tecnología en modo Supabase): Markdown desde URL o pegado, vista previa con niveles/categorías, selección masiva, plantillas y catálogo de seeds.
- **UX**: modo claro/oscuro, selector de idioma ES/EN (banderas en cabecera y ajustes), modales y toasts propios, command palette (p. ej. `Ctrl+K`), footer con stack técnico.
- **Login**: fondo 3D (Three.js) opcional en la pantalla de acceso.

El sitio se genera como **estático** (`astro build`); con Supabase y RLS, listas y detalles autenticados se **hidratan en el cliente** tras el login. Detalle en [`docs/architecture.md`](docs/architecture.md).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | [Astro](https://astro.build/) 6 |
| Estilos | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Cliente | TypeScript |
| Datos / auth | [Supabase](https://supabase.com/) (`@supabase/supabase-js`) |
| i18n | [i18next](https://www.i18next.com/) |
| 3D (login) | [three](https://threejs.org/) |

---

## Requisitos

- **Node.js** ≥ 22.12 (ver `package.json` → `engines`)

---

## Configuración

Crea un archivo `.env` en la raíz (no commitear secretos):

| Variable | Descripción |
|----------|-------------|
| `PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave anónima |
| `PUBLIC_DATA_SOURCE` | `mock` o `supabase` |
| `OPENAI_API_KEY` | (Server) API key para chat en `/study` (Fase 2). |
| `OPENAI_MODEL` | (Server, opcional) Modelo para chat. Ej: `gpt-4.1-mini`. |

Con `supabase`, aplica los scripts SQL en el orden indicado en [`docs/db.md`](docs/db.md) (MVP + migraciones `saas-001` … hasta **`saas-016`** si usas portadas de proyecto y thumbnails públicos en evidencias).

---

## Scripts npm

```bash
npm install
npm run dev      # desarrollo
npm run build    # build de producción
npm run preview  # sirve la carpeta dist
```

Tras cambios relevantes, conviene validar con `npm run build`.

---

## Capa de datos

La UI **no** importa el mock directamente: todo pasa por [`src/data/index.ts`](src/data/index.ts), que delega en:

- [`src/data/providers/mockProvider.ts`](src/data/providers/mockProvider.ts)
- [`src/data/providers/supabaseProvider.ts`](src/data/providers/supabaseProvider.ts)

según `PUBLIC_DATA_SOURCE`. Así se mantiene un contrato estable al cambiar de origen de datos.

---

## Rutas principales

| Ruta | Rol |
|------|-----|
| `/` | Landing (pública; `skillatlas.app`) |
| `/pricing` | Precios (pública; marketing) |
| `/login` | Acceso (oculto en producción; invitación) |
| `/app` | Dashboard |
| `/technologies` | Lista de tecnologías |
| `/technologies/[techId]` | Detalle (modo **mock**, `techId` = slug) |
| `/technologies/view?tech=<slug>` | Detalle (modo **Supabase**, CSR) |
| `/projects` | Lista de proyectos |
| `/projects/[projectId]` | Detalle (modo **mock**) |
| `/projects/view?project=<slug>` | Detalle (modo **Supabase**, CSR) |
| `/demo` | Demo pública (estática; no depende de sesión) |
| `/portfolio` | Portfolio (preview autenticado; en Supabase carga por CSR) |
| `/portfolio/<slug>` | Portfolio público por slug (on-demand; **saas-011**) |
| `/p/<token>` | Portfolio público por token revocable (**saas-003**) |
| `/cv` | CV privado (sesión; editor, preview, impresión) |
| `/cv/p/<token>` | CV público por token (**saas-012**) |
| `/settings` | Ajustes, sesión y perfil (hash de sección, p. ej. `#portfolio-links`) |
| `/request-access` | Solicitud de acceso (pública; guarda en `access_requests`) |
| `/admin` | Panel admin (privado; lista/gestiona `access_requests`) |

Las tarjetas de listado enlazan automáticamente a las rutas CSR cuando el data source es Supabase.

---

## Documentación en el repo

| Documento | Contenido |
|-----------|-----------|
| [`AGENTS.md`](AGENTS.md) | Guía operativa para contribuir (convenciones, archivos sensibles, commits/tags) |
| [`docs/architecture.md`](docs/architecture.md) | CSR vs build, scripts por pantalla, import de conceptos, decisiones UX |
| [`docs/db.md`](docs/db.md) | Tablas, migraciones SaaS, checklist Supabase |
| [`docs/backlog.md`](docs/backlog.md) | **Historial de entregas** (versiones 0.10 → actual), ideas y frentes abiertos |

---

## Estructura del repositorio

```text
├── public/
│   ├── icons/                 # SVG de marcas y tecnologías
│   └── static/                # Earth (login), concept-seeds, etc.
├── docs/                      # Arquitectura, SQL versionado, backlog
├── scripts/                   # Utilidades Node (p. ej. anotación de tiers en seeds)
├── src/
│   ├── components/
│   ├── config/                # help-stack, icons, seeds
│   ├── data/                  # Facade + providers
│   ├── layouts/               # AppShell (header, footer, tema)
│   ├── pages/                 # Rutas Astro
│   ├── scripts/               # Lógica cliente por pantalla (+ subcarpetas)
│   ├── shaders/               # GLSL (tierra en login)
│   └── styles/
├── astro.config.mjs
└── package.json
```

---

## Versionado

- **Versión actual del paquete:** la que declare **`package.json`** (hoy **v0.70.0**).
- **Tags Git:** releases anotadas (`v0.45.0`, `v0.50.0`, `v0.60.0`, `v0.70.0`, …); mensaje de tag al estilo `feat:` + bullets (ver [`AGENTS.md`](AGENTS.md)).

| Versión | Eje principal |
|---------|----------------|
| **0.45** | Vercel, portfolio por slug (**saas-011**), CV privado, header/landing |
| **0.50** | CV público (**saas-012**), OG portfolio + `/og/portfolio.svg`, QA Ajustes, onboarding, `/prep` + `/study` |
| **0.60** | Ajustes estilo GitHub, retirada tablero GridStack, prefs laterales |
| **0.70** | **saas-015** / **saas-016**, portadas de proyecto, thumbnails evidencias, CV público enriquecido, APIs auxiliares, gráficos landing/dashboard |

El **listado completo** de lo implementado por versión (incl. 0.10 … 0.40) está en [**`docs/backlog.md`**](docs/backlog.md) § *Registro de versiones*. El README se mantiene breve; ampliar aquí cuando el producto lo requiera.

---

## Licencia

Repositorio **privado**; uso y distribución según acuerdo del propietario.
