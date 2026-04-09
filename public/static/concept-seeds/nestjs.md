<!-- skillatlas-tier: iniciacion -->
## Módulos y DI

- `Module`, `providers`, `controllers` y exportaciones
- Inyección basada en tokens y alcances (`DEFAULT`, `REQUEST`)
- `ConfigModule` y variables de entorno tipadas

## HTTP

- Rutas, parámetros de ruta y *pipes* de validación (`class-validator`)

<!-- skillatlas-tier: junior -->
## Capas transversales

- *Guards* (autorización), *Interceptors* (logging, transformación)
- *Exception filters* y formato de errores homogéneo
- Middleware de Express subyacente cuando haga falta

## OpenAPI

- Swagger integrado y DTOs documentados

<!-- skillatlas-tier: mid -->
## Persistencia

- TypeORM / Prisma / Mongoose: elección según modelo de datos
- Transacciones y migraciones

## Microservicios

- Transporte TCP, Redis, NATS; patrones request-reply
- GraphQL code-first con Nest

<!-- skillatlas-tier: senior -->
## Producción

- *Health checks* para orquestadores
- Carga y pruebas de estrés del contenedor Node
