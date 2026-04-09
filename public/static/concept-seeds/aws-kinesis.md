<!-- skillatlas-tier: iniciacion -->
## Data Streams

- Flujos, particiones (*shards*) y claves de partición
- Productores y consumidores con posición en secuencia
- Retención y relectura desde checkpoint

## Firehose

- Entrega near-real-time a S3, Redshift, OpenSearch
- Transformación con Lambda en la tubería

<!-- skillatlas-tier: junior -->
## Consumidores

- KCL / SDK: *checkpointing*, reintentos y manejo de poison messages
- Enhanced fan-out para múltiples aplicaciones lectoras

## Video Streams

- Ingestión de vídeo, fragmentos y reproducción HLS/DASH a alto nivel

<!-- skillatlas-tier: mid -->
## Operaciones

- Métricas CloudWatch: *iterator age*, throughput, errores
- Escalado de shards y límites de escritura

## Coste

- Retención extendida vs procesamiento en caliente

<!-- skillatlas-tier: senior -->
## Arquitectura

- Diseño idempotente y exactamente-una-vez vs al-menos-una-vez
- Integración con Glue, Lambda y analítica downstream
