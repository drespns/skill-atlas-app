# `client-shell/`

Módulos cargados **solo** vía `src/scripts/client.ts` (layout `AppShell`). Cada archivo cubre un aspecto del chrome global (banner, cabecera, prefs, i18n, auth). Dependencias compartidas (`getSupabaseBrowserClient`, prefs, toasts, admin) viven en `src/scripts/core/`.

- No importar estos módulos desde páginas sueltas salvo que compartan el mismo contrato DOM (`data-*` del shell).
- Si añades un listener global idempotente, usa flags en `window` o `dataset.bound` como en el resto del proyecto.

Índice detallado: `docs/code-locations.md`.
