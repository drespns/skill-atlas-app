<!-- skillatlas-tier: iniciacion -->
## Catálogo y metadatos

- AWS Glue Data Catalog como registro central de tablas sobre S3 y otros orígenes
- *Crawlers* que infieren esquema, particiones y actualizan el catálogo periódicamente
- Versionado de esquemas y compatibilidad con tablas Iceberg / Hudi / Delta según integración

## Jobs ETL

- Jobs de Spark (Python, Scala) y Glue Studio para flujos visuales
- *Bookmarks* para procesamiento incremental sin reprocesar todo el histórico
- Modo Flex para cargas batch con coste reducido y SLA más flexible

<!-- skillatlas-tier: junior -->
## Transformaciones

- `DynamicFrame` frente a `DataFrame` Spark para manejar esquemas semiestructurados
- `ApplyMapping`, resolución de tipos ambiguos y preparación para el warehouse

## Orquestación

- Disparadores por cron, eventos (*EventBridge*) y colas con límites de concurrencia

## Calidad

- Reglas de calidad de datos nativas e informes integrados en el servicio

<!-- skillatlas-tier: mid -->
## Linaje y lake

- Integración con gobierno (*Lake Formation*) y linaje compatible con OpenLineage
- Conexiones JDBC para bases relacionales y entornos de desarrollo local asistidos

## Streaming

- Jobs de streaming sobre Spark Structured Streaming para tuberías near-real-time

<!-- skillatlas-tier: senior -->
## Seguridad y red

- Roles IAM para ejecución de jobs, acceso a S3 y encriptación con KMS
- Ejecución en VPC con *security groups* y conectores hacia orígenes privados

## Coste

- DPUs, modo estándar frente a Flex y dimensionamiento según ventanas de proceso
- Buenas prácticas: particionar datos en lake, compactar archivos pequeños y comprimir (p. ej. Snappy en Parquet)
