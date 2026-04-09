<!-- skillatlas-tier: iniciacion -->
## Fundamentos del lenguaje

- `cargo` para compilar, testear y gestionar dependencias
- Propiedad (*ownership*), préstamos (*borrowing*) y reglas de alias exclusivo
- `Option` y `Result` para ausencia de valor y errores explícitos
- *Pattern matching* exhaustivo con `match` y sintaxis de `if let`

## Tipos y traits

- `struct` y `enum` con datos asociados; implementación con bloques `impl`
- *Traits* para polimorfismo estático y genéricos con límites (`where`)

<!-- skillatlas-tier: junior -->
## Colecciones y errores

- `Vec`, `String` frente a `&str`, `HashMap` y adaptadores de iteradores
- Propagación de errores con el operador `?`; cajas como `thiserror` / `anyhow` en aplicaciones

## Módulos y visibilidad

- Organización en `mod`, `pub` y rutas de uso (`use`)

<!-- skillatlas-tier: mid -->
## Concurrencia y asíncrono

- Hilos estándar, canales `mpsc`, `Arc` y mutex para mutabilidad interior
- *Async/await* con runtimes como Tokio; *traits* `Send` y `Sync`

## Rendimiento y FFI

- Bloque `unsafe` solo con justificación y revisión; interoperabilidad con C

<!-- skillatlas-tier: senior -->
## Calidad y despliegue

- `cargo test`, pruebas en módulos `#[cfg(test)]` y pruebas de propiedades
- Integración continua multiplataforma y auditoría de dependencias (`cargo audit`)
- Empaquetado de binarios estáticos o mínimos para contenedores
