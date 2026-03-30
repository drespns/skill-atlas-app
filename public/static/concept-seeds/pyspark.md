<!-- skillatlas-tier: iniciacion -->
## Sesión y JVM

- SparkSession builder getOrCreate
- SparkContext gateway JVM
- config dinámico runtime
- log level reducción ruido

## DataFrame Python

- read parquet csv json
- schema StructType explícito
- createDataFrame colecciones
- printSchema preview

## SQL Spark

- createOrReplaceTempView
- spark.sql ANSI SQL
- catalog list databases tables

<!-- skillatlas-tier: junior -->
## Transformaciones

- select selectExpr
- filter where condiciones
- withColumn derived
- withColumnRenamed alias
- drop na fillna
- distinct dropDuplicates
- repartition coalesce shuffle

## Agregación

- groupBy agg count sum
- pivot columnas dinámicas
- Window partitionBy orderBy
- row_number rank dense_rank
- lag lead offsets

## Joins

- join inner left outer
- broadcast hint pequeño
- bucket join grandes

<!-- skillatlas-tier: mid -->
## UDF y funciones

- udf Python registra
- pandas_udf vectorizado
- Column función built-in

## Rendimiento

- cache persist niveles
- AQE configs tuning
- adaptive skew join
- shuffle partitions ajuste

## Delta Lake

- pyspark delta merge
- optimize zorder Delta
- vacuum retención archivos

<!-- skillatlas-tier: senior -->
## Structured Streaming

- readStream writeStream
- foreachBatch microbatch custom
- checkpoint state fault-tolerant

## Integración almacenes

- JDBC read write batches
- S3 ABFS paths cloud
- Kafka source streaming

## Despliegue

- spark-submit cluster mode
- Databricks notebooks connect
