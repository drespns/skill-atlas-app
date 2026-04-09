<!-- skillatlas-tier: iniciacion -->
## Modelo de datos

- Tablas con clave de partición y opcionalmente clave de ordenación; ítems como documentos
- Índices secundarios globales (GSI) y locales (LSI) para patrones de acceso alternativos
- *Streams* para capturar cambios casi en tiempo real hacia Lambda u otros consumidores

## Capacidad y caché

- Modo bajo demanda frente a aprovisionado con autoescalado de RCU/WCU
- DAX como caché in-memory para lecturas de latencia muy baja

<!-- skillatlas-tier: junior -->
## Diseño de acceso

- Diseño *single-table* para entidades relacionadas y patrones de lista de adyacencia
- TTL para caducar registros y GSIs “sobrecargados” cuando el modelo lo requiere

## Consistencia y seguridad

- Transacciones en varios ítems con tokens de idempotencia
- Cifrado con KMS, políticas IAM finas y endpoints de VPC

<!-- skillatlas-tier: mid -->
## Integración y herramientas

- EventBridge Pipes, disparadores desde streams y PartiQL para consultas SQL parciales
- DynamoDB Local para desarrollo; backups bajo demanda y PITR

<!-- skillatlas-tier: senior -->
## Global y coste

- Tablas globales multi-región y resolución de conflictos *last writer wins*
- Clases de almacenamiento estándar e IA para datos poco consultados
- Revisión periódica de patrones de acceso y GSIs para evitar coste innecesario
