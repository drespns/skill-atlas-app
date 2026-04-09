<!-- skillatlas-tier: iniciacion -->
## Motor y SQL

- Motor InnoDB por defecto con transacciones ACID y bloqueo a nivel de fila
- Charset `utf8mb4` y intercalación coherente para texto internacional
- Tipos JSON, columnas generadas y ventanas analíticas en versiones recientes

## Índices y consultas

- Índices B-tree agrupados en la clave primaria e índices secundarios
- Índices de texto completo y planes con `EXPLAIN` en formato árbol

<!-- skillatlas-tier: junior -->
## Transacciones y HA

- Aislamiento MVCC, detección de interbloqueos y variable `autocommit`
- *Binary log* para replicación asíncrona, GTID para topologías claras
- Group Replication, InnoDB Cluster y proxies tipo ProxySQL para lecturas

<!-- skillatlas-tier: mid -->
## Particionamiento y rendimiento

- Particiones por rango, lista o hash con *pruning* efectivo
- Ajuste de `innodb_buffer_pool`, redo log y análisis de *slow query log*

<!-- skillatlas-tier: senior -->
## Operación y nube

- Copias lógicas (`mysqldump`) y físicas (Percona XtraBackup) según RTO/RPO
- Variantes gestionadas: Aurora MySQL-compatible, Cloud SQL, etc.
- Roles y privilegios mínimos, rotación de credenciales y auditoría de accesos
