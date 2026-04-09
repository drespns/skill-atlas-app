<!-- skillatlas-tier: iniciacion -->
## Modelo de datos

- `DataFrame` y `LazyFrame` con plan de consultas optimizado antes de materializar
- Expresiones (`Expr`) encadenables y tipado estricto con valores nulos explícitos
- API alineada con mentalidad SQL/analítica sobre columnas

## API perezosa

- `scan_parquet` / `scan_csv` para proyectar solo columnas y filtros necesarios
- `group_by`, agregaciones y `collect` para ejecutar el plan
- `explain` para inspeccionar optimizaciones aplicadas

<!-- skillatlas-tier: junior -->
## Manipulación

- Joins (inner, left, outer), *asof* para series temporales y concatenación vertical/horizontal
- Cadenas, fechas y ventanas (`over`) con particiones definidas

## Interoperabilidad

- Conversión con Pandas, Arrow y lectura de bases mediante conectores

<!-- skillatlas-tier: mid -->
## Rendimiento

- Núcleo en Rust con SIMD; modo *streaming* para datasets mayores que RAM
- Paralelización con pool de procesos cuando el problema lo permite

## Estructuras avanzadas

- Tipos categóricos, structs anidados y operaciones tipo pivot / melt

<!-- skillatlas-tier: senior -->
## SQL y producto

- Contexto SQL limitado para equipos que prefieren SQL sobre expresiones
- Cuándo elegir Polars frente a Spark o a SQL puro en el warehouse
- Pruebas de regresión sobre pipelines ETL que comparten transformaciones críticas
