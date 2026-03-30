<!-- skillatlas-tier: iniciacion -->
## Tipos de datos

- Strings contadores
- Lists colas simples
- Sets únicos miembros
- Sorted sets scores
- Hashes campos objeto
- Streams consumidores grupo
- JSON modulo RedisStack

## Comandos núcleo

- GET y SET cadena
- INCR decrement atómico
- EXPIRE TTL claves
- Pipelining round-trips
- Transactions MULTI EXEC

## Persistencia

- RDB snapshots punto tiempo
- AOF append log
- Hybrid RDB AOF
- fsync políticas tradeoff

<!-- skillatlas-tier: junior -->
## Réplicas

- Replication async replica
- Sentinel failover auto
- Read from replica stale

## Cluster

- Hash slots 16384
- Resharding rebalance
- Moved redirection cliente

<!-- skillatlas-tier: mid -->
## Uso patrones

- Cache-aside pattern
- Session store web
- Rate limiting ventana
- Pub sub mensajes livianos
- Leaderboards sorted sets

## Rendimiento y memoria

- Eviction políticas LRU LFU
- maxmemory límites
- Big keys riesgo latencia

## Seguridad

- ACL usuarios Redis 6
- TLS transport
- AUTH password legacy

<!-- skillatlas-tier: senior -->
## Redis Modules

- RediSearch full-text
- RedisJSON documentos
- RedisTimeSeries métricas

## Cloud

- ElastiCache AWS
- Azure Cache Redis
- Memorystore GCP
