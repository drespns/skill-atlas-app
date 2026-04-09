<!-- skillatlas-tier: iniciacion -->
## Índices y documentos

- Índice como conjunto lógico de documentos JSON con tipado mediante *mapping*
- Particionado en *shards* y réplicas para escalado horizontal
- Analizadores, tokenizadores y filtros para búsqueda de texto completo

## Consultas

- Consultas `bool`, `multi_match` y resaltado de fragmentos
- Agregaciones para métricas, histogramas temporales y *cardinality*

<!-- skillatlas-tier: junior -->
## Escritura y consistencia

- API *bulk* para alto rendimiento y ajuste de *refresh interval*
- Versionado de documentos y gestión de conflictos concurrentes

## Rendimiento y almacenamiento

- *Force merge* con precaución, ILM para rotación por edad o tamaño
- *Data tiers* (caliente, frío, congelado) y búsqueda federada entre clústeres

<!-- skillatlas-tier: mid -->
## Seguridad y observabilidad

- Stack Elastic Security, roles RBAC y TLS
- Elastic Agent, APM y Kibana para operación unificada
- *Data streams* para logs y métricas a escala

<!-- skillatlas-tier: senior -->
## Ecosistema

- Integración con pipelines Hadoop/Spark y CDC hacia índices
- Comparativa con OpenSearch: bifurcación 7.x, licencias y hoja de ruta
- Coste total: índices calientes, retención y búsquedas frecuentes en observabilidad
