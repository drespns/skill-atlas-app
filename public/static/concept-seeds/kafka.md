## Fundamentos

- Broker nodo Kafka
- Topic particionado
- Partition orden FIFO interno
- Producer publicador
- Consumer grupo lectura
- Offset posición lectura
- Replication factor HA

## Producción

- Keys partición determinista
- Idempotencia producer
- acks durabilidad tradeoff
- compression batch latency
- transactions EOS streams

## Consumo

- consumer group rebalanc
- at-least-once semántica
- exactly-once con transacciones
- auto.offset.reset políticas
- rebalance protocol cooperative

## Esquema y contratos

- Schema Registry Avro JSON
- compatibilidad backward
- subject naming estrategia

## Kafka Connect

- Source connectors
- Sink connectors
- SMT single message transform
- DLQ errores conector

## Streams ksqlDB

- ksql streams tablas
- joins ventana tiempo

## Operación

- ISR réplicas sincronizadas
- Under-replicated partitions
- unclean leader election riesgo
- log retention bytes tiempo

## Seguridad

- SASL SCRAM SSL
- ACL authorizer
- mTLS brokers

## Monitoreo

- JMX métricas brokers
- lag consumidor métrica clave
- Cruise Control rebalanceo
