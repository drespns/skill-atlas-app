<!-- skillatlas-tier: iniciacion -->
## Componentes standalone

- `@Component` con `imports` explícitos en lugar de `NgModule` global
- Plantillas con *control flow* moderno (`@if`, `@for`, `@switch`)
- Enlace de datos, eventos y *two-way binding* con `[(ngModel)]` cuando aplique

## Inyección de dependencias

- `inject()` y constructores con tokens
- Proveedores en componente, ruta o raíz

<!-- skillatlas-tier: junior -->
## Rutas

- `RouterModule` con rutas hijas, *lazy loading* y *guards*
- *Resolvers* para datos antes de activar la ruta

## Forms

- Formularios reactivos (`FormBuilder`, validadores)
- Accesibilidad en mensajes de error y foco

<!-- skillatlas-tier: mid -->
## Estado y async

- Signals y stores ligeros frente a RxJS pesado
- `HttpClient` interceptores, errores y reintentos

## Rendimiento

- `ChangeDetectionStrategy.OnPush` y `track` en listas
- *Defer* de vistas y *hydration* en SSR (según versión)

<!-- skillatlas-tier: senior -->
## Arquitectura

- Nx monorepos y bibliotecas compartidas
- Micro-frontends y *module federation* (cuando aplique)
