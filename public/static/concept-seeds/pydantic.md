<!-- skillatlas-tier: iniciacion -->
## Modelos y validación

- `BaseModel` con campos tipados y validación en la entrada/salida
- `Field()` para valores por defecto, restricciones y metadatos
- `model_validate` / `model_dump` para integrar con dicts y APIs REST
- Inmutabilidad opcional (`frozen`) y constructores controlados

## Validadores

- `field_validator` y `model_validator` para reglas por campo o modelo completo
- Composición con `BeforeValidator` / `AfterValidator` y tipos reutilizables

<!-- skillatlas-tier: junior -->
## Configuración del modelo

- `ConfigDict`: política ante campos extra, *strip* de cadenas, validación al asignar
- Tipos restringidos (`PositiveInt`, `EmailStr`, `HttpUrl`) y secretos en logs (`SecretStr`)

## Esquemas e interoperabilidad

- Generación de JSON Schema para OpenAPI y contratos entre equipos
- `TypeAdapter` para validar listas, uniones y tipos genéricos complejos

<!-- skillatlas-tier: mid -->
## Pydantic v2

- Núcleo en Rust (`pydantic-core`) y guía de migración desde v1
- Validaciones de fecha/hora con zona y restricciones temporales

## Integración aplicación

- Cuerpos de petición en FastAPI y configuración con `BaseSettings` / variables de entorno
- Modo compatible con ORMs cuando se expone DTOs de lectura/escritura

<!-- skillatlas-tier: senior -->
## Rendimiento y límites

- Cuándo validar en el borde (API) vs confiar en la base de datos
- Tests de regresión sobre modelos compartidos entre microservicios
- Documentación viva del contrato JSON Schema en el portal de API
