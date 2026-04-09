<!-- skillatlas-tier: iniciacion -->
## Motor asociativo

- Modelo en memoria (*QIX*): selecciones que filtran el espacio de datos asociado
- Estados de selección (verde/blanco/gris) y granularidad de la carga
- Claves sintéticas como síntoma de modelo mal diseñado

## Script de carga

- Script ETL propio: `LOAD`, tablas residentes, transformaciones encadenadas
- Carga incremental con archivos QVD y *section access* para seguridad a nivel de fila

## Modelo dimensional

- Esquema en estrella recomendado y tablas puente cuando la granularidad lo exige
- Dimensiones de calendario generadas para análisis temporal

<!-- skillatlas-tier: junior -->
## Expresiones y UI

- *Set analysis* para comparar conjuntos de datos en una misma visualización
- Objetos maestros reutilizables y narrativa en *storytelling*
- Extensiones y *mashups* web para casos avanzados

<!-- skillatlas-tier: mid -->
## Despliegue

- Qlik Sense Enterprise (on-prem) frente a Qlik Cloud SaaS
- Qlik Replicate / Data Integration para CDC y pipelines hacia el motor

## Gobierno

- Catálogo y linaje en el ecosistema Qlik para impacto de cambios

<!-- skillatlas-tier: senior -->
## Rendimiento y escala

- Capas QVD, motor optimizado y generación bajo demanda de aplicaciones grandes
- *Section access* dinámico y administración multi-inquilino en cloud
- Integración con flujos de datos empresariales y automatización de aplicaciones
