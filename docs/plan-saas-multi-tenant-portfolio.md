# Plan: SaaS multiusuario + portfolio por enlace (prioridad actual)

Este documento describe **todo lo necesario** para alinear producto y tecnologia con:

1. **Servicio**: cualquier usuario puede registrarse y usar la app.
2. **Aprendizaje por usuario**: cada uno gestiona sus tecnologias, conceptos y proyectos.
3. **Portfolio compartible**: no un catalogo 100% publico; acceso tipo **“compartir enlace”** (similar en espiritu a Tableau Public: quien tenga el link puede ver; sin link, no).

La fase siguiente (fuera del alcance inmediato de este plan) sera **import semiautomatico por tecnologia** y **secciones de documentacion / referencias externas** (ver final).

---

## 1. Brecha respecto al estado actual

| Area | Hoy | Objetivo |
|------|-----|----------|
| Datos | Filas globales sin `user_id` | Cada fila “de negocio” ligada a `auth.users` |
| RLS | `authenticated` ve/edita todo | Policies `auth.uid() = user_id` (o equivalente) |
| Slugs | Unicos globalmente (riesgo de colision entre usuarios) | Unicos **por usuario** (indice compuesto) |
| Portfolio | Una pagina estatica `/portfolio` comun | Vista **por token** + datos solo de ese usuario |
| Build Astro | SSG lee BD con anon (todo el dataset) | App autenticada: datos **en cliente** o **SSR con sesion**; portfolio publico vía **RPC/edge** |

Conclusion: el trabajo es **vertical** (DB + RLS + API de lectura + UI + rutas), no solo “un parche”.

---

## 2. Modelo de datos (PostgreSQL / Supabase)

### 2.1 Columna `user_id` (UUID, FK a `auth.users`)

Anadir en tablas que representan contenido del usuario:

- `technologies.user_id`
- `concepts` — ya tiene `technology_id`; la pertenencia al usuario se hereda de la tecnologia **o** redundar `user_id` en `concepts` para RLS mas simple (recomendado: **ambas**: FK a tecnologia + `user_id` NOT NULL alineado con tecnologia, validado por trigger o aplicacion).
- `projects.user_id`
- `project_embeds` — via `project_id` (trigger/check de coherencia) **o** `user_id` redundante para politicas simples.

Tablas puente:

- `project_technologies`, `project_concepts`: el ownership se puede derivar de `projects.user_id`; las policies pueden usar `EXISTS` subquery al proyecto.

### 2.2 Unicidad y indices

- `technologies`: `UNIQUE (user_id, slug)` y `UNIQUE (user_id, lower(trim(name)))` si aplica producto.
- `concepts`: mantener `UNIQUE (technology_id, lower(trim(title)))` (ya planificado en `mvp-constraints.sql`) — suficiente si una tecnologia solo es de un usuario.
- `projects`: `UNIQUE (user_id, slug)`.

### 2.3 Perfil y comparticion de portfolio

Nueva tabla recomendada, por ejemplo `portfolio_settings` o `profiles`:

- `user_id` PK (FK `auth.users`)
- `display_name`, `bio` (lo que hoy es mock `profile`)
- `share_enabled` boolean (default false)
- `share_token` UUID o string criptograficamente aleatorio (unico, index)
- opcional: `share_token_created_at`, `share_token_rotated_at` para auditoria y “revocar enlace”

**Regla de producto**: la URL publica **no** debe ser adivinable (`/portfolio` fijo no vale). Ejemplo: `/p/{share_token}` o `/share/{share_token}`.

### 2.4 Migracion de datos existentes

- Script SQL: `ALTER TABLE ... ADD COLUMN user_id UUID REFERENCES auth.users(id)`.
- Backfill: asignar todas las filas existentes al **primer usuario** creado en el proyecto **o** a un usuario “migracion” definido manualmente.
- Despues: `NOT NULL` + indices.

---

## 3. RLS (politicas)

### 3.1 Rol `authenticated`

Para cada tabla con `user_id`:

- **SELECT / INSERT / UPDATE / DELETE**: `user_id = auth.uid()` (y en puentes, via EXISTS al proyecto).

### 3.2 Rol `anon`

- **Sin acceso directo** a tablas de contenido (retirar `SELECT` globales actuales si existieran tras el script MVP), **salvo** lo estrictamente necesario para:

#### Portfolio por enlace

Dos enfoques seguros (elegir uno):

1. **RPC `SECURITY DEFINER`** (recomendado para MVP estable):
   - Funcion `get_portfolio_by_share_token(token text)` valida token, comprueba `share_enabled`, devuelve JSON (perfil + proyectos visibles + embeds).
   - `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated`.
   - No expone filas crudas; control total en codigo SQL de la funcion.

2. **Edge Function** + service role:
   - Valida token, consulta con service role, devuelve JSON.
   - Mas trabajo operativo; mas flexible (rate limit, analytics).

### 3.3 Scripts SQL en repo

- Nuevo archivo: `docs/sql/rls-multi-tenant.sql` (o migraciones numeradas) que:
  - deshabilita/elimina policies del script `rls-mvp-authenticated.sql` no compatibles,
  - crea policies por `user_id`,
  - crea tabla perfil + funcion RPC de portfolio.

---

## 4. Capa de aplicacion (Astro + TypeScript)

### 4.1 Provider Supabase (`src/data/providers/supabaseProvider.ts`)

- Todas las lecturas deben filtrar por usuario **cuando** el codigo corre con identidad de usuario.
- Problema: en **build estatico** no hay cookie de sesion en el servidor de build.

**Opciones (elegir una estrategia principal):**

| Estrategia | Pros | Contras |
|------------|------|---------|
| **A) App “interna” mayormente CSR** | Coherente con sesion; listas/detalle cargan con `getSession()` + queries | Menos SEO en pantallas privadas; mas loading |
| **B) Astro SSR + middleware** | HTML inicial ya filtrado; mejor UX | Requiere adapter (Node/vercel/etc.), despliegue no solo estatico |
| **C) Hibrido** | Landing/marketing SSG; `/app`, `/technologies`, etc. SSR o CSR | Dos modos en el repo |

Recomendacion pragmatica para **SaaS con datos privados**: **B o C** a medio plazo; **A** es el cambio minimo si quieres evitar adapter ya.

### 4.2 Facade `src/data/index.ts`

- Funciones nuevas o sobrecarga: donde haga falta pasar `userId` o leer sesion solo en servidor.
- `mock` provider: simular multiusuario con un `userId` fijo o varios perfiles de prueba.

### 4.3 Scripts cliente

- Tras RLS real, el **anon key + JWT** del usuario aplicara policies: los `.insert()/.update()` actuales funcionan si mandan filas con `user_id = auth.uid()` (o defaults en DB).
- Rellenar `user_id` en inserts:
  - en cliente: `const { data: { user } } = await supabase.auth.getUser()` y adjuntar `user_id`,
  - o **DEFAULT auth.uid()** en columnas (PostgreSQL) + politicas estrictas.

### 4.4 Rutas

- `/portfolio` (actual): redirigir a **“Mi portfolio”** (preview autenticado) o renombrar a `/me/portfolio`.
- **Nueva ruta publica por token**: `/p/[token].astro` (o similar) que llame a la RPC (desde cliente o servidor segun modo) y renderice solo ese payload.

### 4.5 UI producto

- Ajustes / portfolio:
  - interruptor “Activar enlace de comparticion”
  - mostrar URL copiable
  - “Regenerar enlace” (nuevo token, invalida el anterior)
- Mensajes claros: “Solo quien tenga este enlace puede verlo; no aparece en un listado publico”.

---

## 5. Auth y registro (Supabase Dashboard)

- Mantener **Email + magic link** (o añadir password si producto lo pide).
- **Confirmar** que signups estan alineados con “cualquiera puede registrarse”.
- URLs de redireccion: localhost + produccion.
- (Opcional) plantillas de email en marca.

---

## 6. Orden de implementacion sugerido (fases)

### Fase 0 — Preparacion (1 iteracion corta)

- [ ] Decidir estrategia Astro: **CSR interno** vs **SSR** (afecta despliegue).
- [ ] Documentar variable `PUBLIC_SITE_URL` o equivalente para redirects.

### Fase 1 — Esquema + migracion

- [ ] SQL: `user_id` en tablas + backfill + NOT NULL.
- [ ] Tabla `profiles` (o `portfolio_settings`) + `share_token` + `share_enabled`.
- [ ] Indices unicos compuestos `(user_id, slug)` donde toque.
- [ ] Aplicar `mvp-constraints.sql` si aun no, tras limpiar duplicados **por usuario**.

### Fase 2 — RLS multi-tenant

- [ ] Policies `auth.uid() = user_id` (y puentes via proyecto).
- [ ] Quitar lectura `anon` amplia en tablas de contenido.
- [ ] RPC `get_portfolio_by_share_token` + `GRANT EXECUTE` a `anon`.
- [ ] Probar con dos usuarios reales en Supabase.

### Fase 3 — Aplicacion

- [ ] Provider + facade: todas las queries filtradas por usuario (o CSR desde cliente).
- [ ] Inserts/updates: `user_id` consistente (columna o default).
- [ ] Pagina `/p/[token]` + UI en Settings.
- [ ] Retirar o adaptar `/portfolio` estatico global.

### Fase 4 — Endurecimiento

- [ ] Rate limiting (Edge / Supabase) sobre RPC si hay abuso.
- [ ] Logs minimos de accesos a token (opcional).
- [ ] Tests manuales checklist (registro, dos cuentas, compartir, revocar).

---

## 7. Siguiente bloque de producto (despues de lo anterior)

Cuando el SaaS + portfolio por enlace este estable:

### 7.1 Import semiautomatico por tecnologia

- Fuente de verdad: CSV, pegado de lista, API de documentacion, u “assistant” que sugiera conceptos.
- Flujo UX: preview diff → confirmar altas en bloque.
- DB: posible tabla `concept_import_jobs` o solo transaccion cliente.

### 7.2 Secciones de documentacion y referencias externas

- Modelo: entidades `technology_doc_section` (titulo, body markdown, orden) y `technology_reference` (url, titulo, tipo).
- UI: pestañas en `/technologies/[techId]` (Conceptos | Docs | Enlaces).
- RLS: mismo `user_id` que la tecnologia.

---

## 8. Referencias cruzadas en el repo

- RLS actual (transicion): `docs/sql/rls-mvp-authenticated.sql`
- Constraints: `docs/sql/mvp-constraints.sql`
- Backlog vivo: `docs/backlog.md`
- Arquitectura: actualizar `docs/architecture.md` cuando se elija SSR vs CSR definitivo.

---

## 9. Riesgos y decisiones explicitas

1. **Build estatico + datos privados**: sin SSR, las paginas que listan datos del usuario deben cargar datos **en el cliente** tras login; aceptar flash vacio o skeleton.
2. **Slugs en URL**: pueden seguir siendo slug por usuario; URLs internas `/technologies/{slug}` siguen siendo validas **en contexto de sesion** (no colision entre usuarios).
3. **Portfolio token en logs**: no registrar token completo en analytics; truncar o hash.

Este plan es la base para trocear trabajo en PRs pequenos (schema → RLS → RPC → UI → limpieza rutas viejas).
