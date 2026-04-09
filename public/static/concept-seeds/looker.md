<!-- skillatlas-tier: iniciacion -->
## LookML y proyecto

- Proyecto versionado en Git con vistas (`view`), *explores* y joins declarativos
- `sql_table_name` y tablas derivadas en SQL o nativas de la plataforma
- Reutilización con `include` / `ref` y organización modular del modelo

## Capa semántica

- Dimensiones y medidas con tipos agregación (`sum`, `count`, `average`)
- Filtros de acceso y parámetros dinámicos en SQL generado
- Plantillas Liquid en campos HTML o etiquetas

<!-- skillatlas-tier: junior -->
## Rendimiento

- PDT (*persistent derived tables*) completas o incrementales según volumen
- Claves de partición por fecha y agregados precomputados (*aggregate awareness*)
- Conexiones a warehouses modernos (BigQuery, Snowflake, Redshift, etc.)

## Integración

- Incrustación en aplicaciones con SSO y API REST para automatización

<!-- skillatlas-tier: mid -->
## API y gobierno

- Acciones salientes, *Data Actions* y webhooks
- Modo desarrollo del modelo, ramas Git y validación de contenido antes de producción
- Atributos de usuario para RLS equivalente en la capa Looker

<!-- skillatlas-tier: senior -->
## Seguridad y producto Google

- SSO OIDC/SAML y permisos por carpeta o modelo
- Relación con Looker Studio / informes sobre BigQuery y hojas de cálculo
- Estrategia de equipos: quién posee el modelo LookML frente a consumo en BI
