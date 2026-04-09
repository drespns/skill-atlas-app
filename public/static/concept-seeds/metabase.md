<!-- skillatlas-tier: iniciacion -->
## Conceptos de producto

- *Questions* guardadas y *Models* como capa semántica sobre tablas físicas
- Colecciones para organizar contenido y *dashboards* con rejillas de tarjetas
- Conexión a bases mediante drivers JDBC y sincronización periódica del esquema

## Exploración

- Editor SQL nativo, *notebook* para análisis más largos y constructor visual de filtros
- Filtros enlazados entre gráficos y parámetros en la URL

<!-- skillatlas-tier: junior -->
## Métricas y segmentos

- Métricas reutilizables y segmentos (conjuntos de filtros) compartidos
- *Pulses*: informes programados por email o Slack con umbrales

## Incrustación

- *Signed embedding* para iframes en productos propios con parámetros bloqueados

<!-- skillatlas-tier: mid -->
## Despliegue y ediciones

- Metabase open source (Docker, JAR) frente a Cloud con SSO y SLA
- Variables de entorno para secretos y URL pública

## Seguridad

- Sandbox por filas cuando el motor lo permite, LDAP/SAML/Google Workspace

<!-- skillatlas-tier: senior -->
## Rendimiento y gobierno

- Caché de resultados de preguntas frecuentes y snippets SQL reutilizables
- *Actions* HTTP para disparar webhooks desde interacciones en el dashboard
- Roles administrativos y auditoría de consultas en entornos regulados
