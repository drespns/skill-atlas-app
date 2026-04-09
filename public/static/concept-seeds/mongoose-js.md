<!-- skillatlas-tier: iniciacion -->
## Esquemas

- Definición de `Schema` con tipos, `required`, valores por defecto
- Validadores built-in y personalizados
- `model()` y nombre de colección en MongoDB

## Documentos

- CRUD básico: `create`, `find`, `findOne`, `update`, `delete`
- Proyecciones y selección de campos

<!-- skillatlas-tier: junior -->
## Relaciones

- `populate()` para referencias entre colecciones
- Índices únicos, TTL y *compound indexes*

## Middleware

- Hooks `pre` / `post` en `save`, `remove`, etc.
- Serialización `toJSON` / `toObject` y virtuals

<!-- skillatlas-tier: mid -->
## Consultas avanzadas

- Agregaciones con pipeline cuando el ORM no basta
- Transacciones multi-documento con sesiones

## Rendimiento

- Explicación de planes (`explain`) y evitar *full collection scans*

<!-- skillatlas-tier: senior -->
## Producción

- Manejo de reconexión y *connection pooling*
- Migraciones de esquema coordinadas con despliegues
