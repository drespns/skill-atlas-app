<!-- skillatlas-tier: iniciacion -->
## Arquitectura

- Driver orquestación
- Executors trabajadores
- SparkContext entrada legacy
- SparkSession unificado
- DAG plan lógico y físico

## Datos core

- RDD bajo nivel
- DataFrame API
- Dataset typed Scala
- Schema inferencia y explícito
- Catalyst optimizador
- Tungsten ejecución

## Transformaciones y acciones

- lazy eval transformaciones
- narrow vs wide shuffle
- cache y persist niveles
- repartition coalesce
- broadcast joins pequeños

<!-- skillatlas-tier: junior -->
## SQL y catálogo

- spark.sql queries
- Temp views
- Hive metastore tablas
- Catalog API 3.x

## Tiempo ventanas

- window functions
- tumbling watermark streaming
- Structured Streaming

<!-- skillatlas-tier: mid -->
## Rendimiento

- AQE adaptativo
- Shuffle partition tuning
- Skew join mitigación
- Salting patrón
- UDF evitar si posible

## Integración datos

- Parquet ORC orígenes
- JDBC lectores SQL
- Delta source sink
- Kafka source streaming

<!-- skillatlas-tier: senior -->
## Despliegue

- Standalone cluster
- YARN mesos histórico
- Kubernetes spark operator

## Debugging

- Spark UI stages tasks
- event logs historial
- speculative execution
