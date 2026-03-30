<!-- skillatlas-tier: iniciacion -->
## Fundamentos DAG

- DAG definición acíclica
- Operator unidad tarea
- Task instancia ejecución
- Depends on dependencias
- Schedule interval cron
- Start date catchup

## Operadores y hooks

- BashOperator shell
- PythonOperator código
- SQL operators
- Sensors espera condición
- Hook conexión externa
- Transfer operadores cloud

## Contexto y plantillas

- Jinja macros Airflow
- XCom paso datos pequeños
- Macros ds execution_date
- Templates campos operador

<!-- skillatlas-tier: junior -->
## Ejecución

- Executor Local y Celery
- KubernetesPodOperator
- Task retries backoff
- Pools slots concurrencia
- Queues Celery routing

## Orquestación moderna

- TaskFlow API decoradores
- Dynamic task mapping
- Deferrable operators ahorro

<!-- skillatlas-tier: mid -->
## Despliegue

- docker-compose local
- Helm chart producción
- Variables entorno Airflow
- Fernet key secrets
- Connections UI y backend

## Calidad y datos

- Data quality checks operators
- Great Expectations integración
- SLAs y alertas

<!-- skillatlas-tier: senior -->
## Observabilidad

- Task logs centralizados
- StatsD métricas
- OpenTelemetry emergente

## Integraciones BI/DE

- S3 GCS Azure blobs
- dbt BashOperator
- SparkSubmitOperator
- SnowflakeOperator módulos
