# Ideas de preferencias futuras (recolección)

Lista orientativa; no son compromisos de roadmap. Sirve para priorizar cuando haya capacidad.

## Accesibilidad y lectura

- **Contraste forzado** (además del tema claro/oscuro): subir contraste de texto/bordes sin depender solo del tema del portfolio público.
- **Ancho máximo de lectura** en vistas largas (p. ej. listas o detalle) para quien prefiere columnas más estrechas.
- **Subrayado de enlaces** siempre visible (mejor reconocimiento que solo color).

## Navegación y productividad

- **Recordar última pestaña** en `/settings` cuando hay hash vacío (hoy el default es `#prefs`).
- **Abrir command palette** con tecla personalizable (donde el navegador lo permita).
- **Sonidos** opcionales para toasts / acciones (desactivados por defecto).

## Datos y rendimiento

- **Reducir animaciones de terceros** en embeds (carga diferida más agresiva) — relacionado con `motion` ya existente.
- **Vista compacta opcional** en listas concretas (sin reintroducir “densidad” global del shell si se prefiere mantenerla fija).

## Privacidad / UX

- **Ocultar previews** en notificaciones del sistema (si en el futuro hay push o integraciones).
- **Modo presentación** (ocultar elementos secundarios del shell durante demos).

## Sincronización

- Si `user_prefs` en Supabase crece: **sincronizar** más claves de `AppPrefsV1` o subconjuntos explícitos (hoy es parcial).

---

*Última revisión: alineado con `SETTINGS_PANEL_IDS` y prefs en `src/scripts/core/prefs.ts`. Tras mejorar el CV (bloques, plantillas, prefs de sección), conviene repasar esta lista para priorizar nuevas preferencias.*
