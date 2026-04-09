<!-- skillatlas-tier: iniciacion -->
## Flujo típico ML

- Separación train / test (`train_test_split`)
- Estimadores `fit` / `predict` / `transform`
- Métricas: exactitud, F1, RMSE, ROC-AUC según problema

## Preprocesamiento

- `StandardScaler`, `OneHotEncoder`, *pipelines*
- `ColumnTransformer` para datos tabulares mixtos

<!-- skillatlas-tier: junior -->
## Modelos

- Lineales: regresión, logistic, regularización L1/L2
- Árboles, bosques aleatorios, gradient boosting (API unificada)

## Selección de modelos

- `GridSearchCV`, `RandomizedSearchCV`
- Validación cruzada y *nested CV* para evitar fugas

<!-- skillatlas-tier: mid -->
## Pipelines completos

- Encadenar preprocesamiento + modelo en un solo objeto serializable
- `joblib.dump` / `load` para despliegue

## Interpretación

- Importancia de características en modelos de árbol
- Curvas de aprendizaje y validación

<!-- skillatlas-tier: senior -->
## Producción

- Deriva de datos (*data drift*) y monitorización de métricas
- Cuándo pasar a frameworks de deep learning especializados
