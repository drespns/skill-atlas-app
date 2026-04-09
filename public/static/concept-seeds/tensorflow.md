<!-- skillatlas-tier: iniciacion -->
## Modelos Keras

- API secuencial y funcional, capas comunes
- `compile`, `fit`, métricas y *callbacks* básicos

## Datos

- `tf.data`: pipelines, *batching*, *prefetch*
- TFRecords para datasets grandes en disco

<!-- skillatlas-tier: junior -->
## Entrenamiento

- Estrategias `MirroredStrategy` en una máquina multi-GPU
- *Checkpointing*, TensorBoard y early stopping

## Guardado

- `SavedModel` y conversión a TensorFlow Lite / Serving

<!-- skillatlas-tier: mid -->
## Graph y rendimiento

- `tf.function` y *autograph* para grafos
- Precisión mixta (`mixed_float16`) en GPUs modernas

## Distribuido

- `MultiWorkerMirroredStrategy` y configuración de cluster

<!-- skillatlas-tier: senior -->
## Producción

- Servir modelos con TensorFlow Serving o contenedores
- Monitorización de deriva y reentrenamiento periódico
