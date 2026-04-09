<!-- skillatlas-tier: iniciacion -->
## Núcleo del clúster

- Arquitectura de nodos (*master*, *data*, roles dedicados según despliegue)
- Índices divididos en *shards* primarios y réplicas para disponibilidad y lectura
- Documentos JSON con `_id` y *mapping* rígido o dinámico según el caso de uso

## Búsqueda y agregaciones

- DSL de consulta booleana, analizadores de texto y relevancia ajustable
- Agregaciones de métricas, *buckets* y series temporales para analítica sobre logs

<!-- skillatlas-tier: junior -->
## Seguridad y cumplimiento

- Control de acceso fino, cifrado en tránsito y en reposo
- Integración SSO (SAML) en despliegues gestionados

## Observabilidad

- OpenSearch Dashboards para explorar datos y crear visualizaciones
- Alertas, monitorización y detección de anomalías mediante plugins

<!-- skillatlas-tier: mid -->
## Ingesta y ciclo de vida

- Pipelines de ingesta (*Data Prepper*, OpenSearch Ingestion) para flujos continuos
- ISM (*Index State Management*) para rotación, archivado y *UltraWarm* en AWS

## Rendimiento

- Ajuste de *merges* de segmentos y almacenamiento frío para coste

<!-- skillatlas-tier: senior -->
## Integración y despliegue

- Plugin SQL y casos de ML con *ML Commons*
- OpenSearch Service en AWS, OCI u operación *self-managed* (Docker, Helm)
- Relación con Elasticsearch: compatibilidad de API y diferencias de licencia
