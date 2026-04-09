<!-- skillatlas-tier: iniciacion -->
## Conectores y sincronización

- Catálogo de conectores SaaS y bases operacionales hacia el *data warehouse*
- Frecuencia de sincronización y modelos de facturación basados en MAR (*monthly active rows*)
- Primera carga histórica frente a actualizaciones incrementales con CDC cuando la fuente lo permite

## Esquema en destino

- Convenciones de nombres de esquema y tablas generadas por Fivetran
- Evolución de esquema: nuevas columnas, tipos y tablas detectadas automáticamente
- Re-sincronización forzada ante corrupciones o cambios mayores de modelo

<!-- skillatlas-tier: junior -->
## Transformaciones ligeras

- Integración con modelos *dbt* en destinos compatibles
- *Quickstart models* como punto de partida para capas de staging

## Operación diaria

- Panel de estado de conectores, alertas por correo o Slack
- Logs detallados por tabla y por ejecución para diagnosticar fallos

<!-- skillatlas-tier: mid -->
## Red y seguridad

- Túneles SSH hacia bases en red privada
- Opciones de *private networking* y cumplimiento de políticas corporativas
- Webhooks firmados (HMAC) para orquestación externa

## API

- Gestión programática de conectores y destinos para equipos de plataforma

<!-- skillatlas-tier: senior -->
## Destinos y coste

- Snowflake, BigQuery, Redshift, Databricks, Azure Synapse y otros almacenes soportados
- Buenas prácticas: limitar tablas sincronizadas al mínimo necesario y revisar MAR mensual
- Alineación con gobierno de datos: propietarios de fuente y catálogo de ingesta
