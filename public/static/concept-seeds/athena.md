<!-- skillatlas-tier: iniciacion -->
## Consultas serverless

- Motor de consultas SQL sobre datos en S3 sin gestionar clústeres permanentes
- Basado en tecnología tipo Presto/Trino para analítica interactiva
- *Workgroups* para aislar equipos, límites de escaneo y resultados en bucket dedicado

## Modelo de tablas

- Tablas externas con particiones estilo Hive y reparación de particiones (`MSCK`)
- Formatos columnar (Parquet, ORC) y tablas Iceberg gestionadas cuando aplique

<!-- skillatlas-tier: junior -->
## Coste y rendimiento

- Facturación por datos escandos; reducción mediante particionado y proyección de particiones
- *Predicate pushdown* y columnas necesarias para minimizar bytes leídos

## Federación

- Conectores Lambda para fuentes externas y UDFs para lógica personalizada

<!-- skillatlas-tier: mid -->
## Seguridad e integración

- Permisos vía Lake Formation, cifrado SSE-KMS en S3 y rutas de resultados acotadas
- Encadenamiento con Glue, Step Functions y eventos para pipelines

## Motor avanzado

- Motor v3 con capacidades batch tipo Spark y notebooks para experimentación

<!-- skillatlas-tier: senior -->
## Buenas prácticas de lake

- Evitar demasiados archivos diminutos; compactar y comprimir Parquet
- Versionado de datos y contratos de esquema con el equipo de plataforma
- Observabilidad de consultas lentas y coste por equipo o producto de datos
