<!-- skillatlas-tier: iniciacion -->
## Rol en la ingesta

- Servicio alojado sobre el ecosistema *Singer*: *taps* (extracción) y *targets* (carga)
- Elección de destino analítico (warehouse, lake) según el caso de uso
- Planes de replicación y límites de filas según suscripción

## Modos de replicación

- Incremental por clave, por log (*log-based*) o tabla completa según capacidades del conector
- Impacto en coste y frescura de datos en el destino

<!-- skillatlas-tier: junior -->
## Esquema y calidad

- Selección explícita de tablas y campos a replicar
- Mapeo de nombres, aplanado de JSON anidado y cola de errores de carga
- Destinos habituales: Snowflake, BigQuery, Redshift, S3 como paso intermedio

<!-- skillatlas-tier: mid -->
## Observabilidad

- Informes de extracción y carga con trazas por tabla
- Notificaciones ante fallos repetidos o retrasos de ventana

## Seguridad

- Túneles SSH y listas de IP en planes empresariales

<!-- skillatlas-tier: senior -->
## Arquitectura Singer

- Entender tap/target como contrato reutilizable fuera de Stitch
- Cuándo combinar Stitch con orquestadores (*Airflow*, *dbt*) para capas posteriores
- Coste total: filas movidas, almacén destino y transformaciones downstream
