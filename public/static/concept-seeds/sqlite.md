<!-- skillatlas-tier: iniciacion -->
## Modelo embebido

- Archivo único, sin proceso servidor separado
- Tipado dinámico de columnas y afinidad de tipos
- Transacciones ACID en un solo escritor concurrente

## SQL esencial

- `CREATE TABLE`, claves primarias y `FOREIGN KEY`
- `SELECT`, `JOIN`, índices y `EXPLAIN QUERY PLAN`

<!-- skillatlas-tier: junior -->
## Concurrencia y diario

- Modos de diario: *rollback*, *WAL* y lecturas concurrentes
- Bloqueos y *timeouts* en escrituras largas
- Backup en caliente copiando el fichero o usando API online

## Rendimiento

- Índices adecuados y consultas N+1 evitadas
- `ANALYZE` y estadísticas para el optimizador

<!-- skillatlas-tier: mid -->
## Extensiones

- Funciones definidas por usuario y virtual tables (cuando apliquen)
- FTS5 para búsqueda de texto completo

## Integración

- Uso desde aplicaciones (drivers, ORMs) y pools de conexiones
- Cuándo migrar a motor cliente-servidor (PostgreSQL, etc.)

<!-- skillatlas-tier: senior -->
## Operación

- Replicación y backup incremental en entornos críticos
- Cifrado del fichero en reposo y controles de acceso al sistema de archivos
