<!-- skillatlas-tier: iniciacion -->
## Componentes del workspace

- *Dedicated SQL pool* (MPP) para cargas analíticas tradicionales
- *Serverless SQL pool* para consultas sobre el lago sin aprovisionar cluster
- *Apache Spark pools* para procesamiento distribuido y notebooks integrados
- Integration Runtime para conectar orígenes híbridos (nube + on-prem)

## SQL y lago

- CETAS para materializar resultados en el almacenamiento
- Tablas externas con PolyBase / rutas al *Data Lake* Gen2
- Aislamiento de cargas (*workload groups*) y caché de resultados cuando aplica

<!-- skillatlas-tier: junior -->
## Orquestación

- Pipelines con actividades de copia, flujos de datos y disparadores programados
- Integración con Azure Data Lake Gen2, Key Vault y redes virtuales gestionadas

## Gobernanza

- Linaje y catálogo con Microsoft Purview en ecosistemas empresariales

<!-- skillatlas-tier: mid -->
## Seguridad

- *Private endpoints*, identidades administradas y acceso condicional con Entra ID
- *Self-hosted IR* para sistemas dentro de la red corporativa

## Integración analítica

- Consumo desde Power BI mediante vistas y datasets conectados al servidor SQL

<!-- skillatlas-tier: senior -->
## Migración y operación

- Estrategias desde almacenes legados (*SQL pool* clásico) hace arquitecturas lake-first
- Monitorización de concurrencia, colas y coste por pool
- Buenas prácticas: zonas de staging en el lago, particionado y gobierno de vistas compartidas
