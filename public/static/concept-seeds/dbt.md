<!-- skillatlas-tier: iniciacion -->
## Fundamentos proyecto

- dbt_project.yml raíz
- models capas staging mart
- seeds CSV versionados
- snapshots SCD
- tests genéricos singulares

## SQL y Jinja

- ref dependencias modelos
- source definición origen
- config materialización
- macros reutilización
- vars parámetros proyecto

## Materializaciones

- view ligera
- table rebuild
- incremental merge delete insert
- ephemeral CTE reutilizable

<!-- skillatlas-tier: junior -->
## Calidad datos

- unique not_null tests
- relationships FK lógicas
- accepted_values lista
- custom generic tests
- severity warn error

## Lineaje y docs

- schema.yml descripción
- dbt docs generate
- exposures dashboards Downstream

<!-- skillatlas-tier: mid -->
## Despliegue

- dbt run selección
- dbt test en CI
- dbt compile SQL final
- state comparison slim CI
- dbt Cloud jobs

## Warehouse

- profiles.yml targets
- Snowflake BigQuery Redshift
- Databricks adapter Spark SQL

<!-- skillatlas-tier: senior -->
## Packages y estilo

- dbt-utils macros
- package-lock paquetes
- SQLFluff lint opcional

## Performance

- incremental_strategy
- cluster_by partición BQ
- tags selección subsets
