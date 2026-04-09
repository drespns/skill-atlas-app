<!-- skillatlas-tier: iniciacion -->
## Motor columnar

- Orientado a OLAP con almacenamiento por columnas y compresión agresiva
- Familia *MergeTree* como base de tablas particionadas y ordenadas
- Tablas distribuidas y motores con deduplicación (*ReplacingMergeTree*) según el caso

## SQL y tipos

- SQL analítico con funciones de fecha, arrays y mapas
- Columnas materializadas y funciones lambda para transformaciones en consulta

<!-- skillatlas-tier: junior -->
## Ingesta y almacenamiento

- Inserciones por lotes, motor *Kafka* y lectura desde S3 mediante funciones de tabla
- Índices dispersos, proyecciones y políticas TTL para expirar datos antiguos

## Clúster y réplicas

- Coordinación con ZooKeeper (o alternativas recientes) y tablas replicadas
- Elección de clave de *sharding* equilibrada para evitar nodos calientes

<!-- skillatlas-tier: mid -->
## Rendimiento

- Ajuste de hilos, fusiones de partes en segundo plano y vigilancia de *merges*
- Integración con *dbt* y motores federados hacia MySQL/PostgreSQL para consultas híbridas

## Operación

- Tablas `system.*` para diagnóstico, backups nativos y exportación a cold storage

<!-- skillatlas-tier: senior -->
## Producción

- Monitorización con Prometheus/Grafana y alertas por latencia de consultas
- Dimensionamiento de hardware y políticas de retención alineadas con coste
- Buenas prácticas de modelado para evitar joins masivos inesperados en tablas anchas
