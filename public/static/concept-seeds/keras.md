<!-- skillatlas-tier: iniciacion -->
## Modelos

- API secuencial y funcional (`Model`, capas apiladas)
- Capas densas, convolucionales y de *pooling*
- `compile`: pérdida, optimizador y métricas

## Entrenamiento

- `fit`, lotes (`batch_size`), épocas y conjuntos train/validation
- *Callbacks*: `EarlyStopping`, `ModelCheckpoint`, `TensorBoard`

<!-- skillatlas-tier: junior -->
## Datos

- `tf.data` o generadores para datasets grandes
- Aumento de datos (*data augmentation*) en visión

## Regularización

- `Dropout`, `L1`/`L2`, *batch normalization*

<!-- skillatlas-tier: mid -->
## Exportación

- `SavedModel`, TensorFlow Lite y despliegue en servidor
- Fine-tuning de modelos preentrenados

## Depuración

- Sobreajuste vs infraajuste y curvas de aprendizaje

<!-- skillatlas-tier: senior -->
## Producción

- Latencia de inferencia y cuantización
- Versionado de modelos y reproducibilidad de entrenamiento
