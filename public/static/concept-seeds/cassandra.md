<!-- skillatlas-tier: iniciacion -->
## Fundamentos distributed

- Cluster peer-to-peer
- Partition key dispersión
- Clustering column sort
- Replication factor N
- Consistency levels ONE QUORUM ALL

## Modelado CQL

- Keyspace namespace
- Table wide column
- Primary key compuesta
- Static columns fila lógica
- Collections list set map
- User-defined types UDT

## Consultas

- SELECT partition limited
- ALLOW FILTERING riesgo
- Secondary index uso moderado
- SASI secondary legacy

<!-- skillatlas-tier: junior -->
## Escritura

- Lightweight transactions LWT
- Batches logged unlogged
- TTL tiempo vida filas
- Compaction estrategias STCS TWCS

## Operación nodos

- Gossip membership
- Repair nodetool
- Bootstrap joining node
- Decommission salida
- nodetool status ring

<!-- skillatlas-tier: mid -->
## Rendimiento

- Partition key hot spots
- Denormalización patrón
- Prepared statements driver

## Seguridad

- LDAP auth
- Encryption internode TLS
- Role-based CQL

<!-- skillatlas-tier: senior -->
## Herramientas

- nodetool mantenimiento
- cassandra-stress benchmark

## Managed

- Amazon Keyspaces compat API
- Astra DB DataStax serverless
