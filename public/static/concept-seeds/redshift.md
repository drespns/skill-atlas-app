<!-- skillatlas-tier: iniciacion -->
## Arquitectura

- Almacén columnar derivado de PostgreSQL, optimizado para analítica masiva
- Nodos de cómputo y almacenamiento gestionado (familias RA3, etc.) en VPC aislada
- Carga masiva con `COPY` desde S3 y exportación con `UNLOAD`

## Modelado físico

- Estilos de distribución (`KEY`, `EVEN`, `ALL`) y claves de ordenación compuestas
- *Spectrum* para consultar datos externos en S3 sin ingresarlos al clúster
- Vistas materializadas para acelerar consultas repetidas

<!-- skillatlas-tier: junior -->
## Rendimiento operativo

- Escalado de concurrencia (*Concurrency Scaling*) y gestión de cargas (WLM / auto WLM)
- Mantenimiento: `VACUUM`, ordenación y eliminación de filas fantasma

## Seguridad y compartición

- Federación IAM, seguridad a nivel de fila y columna
- *Data sharing* con otras cuentas de AWS (patrones tipo Snowflake)

<!-- skillatlas-tier: mid -->
## Serverless y integraciones

- Redshift Serverless con unidades de capacidad elásticas
- Integración con SageMaker, *Zero-ETL* desde Aurora y pipelines *dbt*

<!-- skillatlas-tier: senior -->
## Observabilidad y resiliencia

- *Query monitoring*, *Performance Insights* y auditoría a S3
- Snapshots automáticos y copia entre regiones para continuidad
- Diseño de distribución para evitar sesgo (*skew*) y tablas anchas lentas
