<!-- skillatlas-tier: iniciacion -->
## Plataforma y competiciones

- Cuenta, perfiles públicos y equipos en competiciones
- Tableros (`leaderboards`) con particiones train / validation
- Límite diario de envíos (`submissions`) y reglas anti-cheat
- Uso de notebooks (`kernels`) con GPU según cuota y tier

## Datasets y licencias

- Exploración del catálogo, versiones y discusiones del dataset
- Licencias de uso, redistribución y atribución obligatoria
- Descarga vía interfaz o API con autenticación

<!-- skillatlas-tier: junior -->
## Flujo de trabajo

- Variables de entorno y secretos para credenciales (no en código)
- Integración con `git` y versionado de notebooks
- Comunidad: comentarios, votos y kernels de referencia

## Evaluación

- Métricas oficiales de cada competición (AUC, RMSE, etc.)
- Formato de archivo de predicción exigido por el host
- Validación cruzada local frente a holdout público

<!-- skillatlas-tier: mid -->
## Modelado y ensamblado

- Versionado de modelos y experimentos reproducibles
- *Stacking*, *blending* y votación de modelos base
- Calibración de probabilidades y umbrales de decisión

## Datos y calidad

- Detección de fugas (*leakage*) entre train y test
- Tratamiento de valores ausentes y outliers a escala
- *Feature engineering* documentado para el equipo

<!-- skillatlas-tier: senior -->
## Estrategia y ética

- Lectura del foro sin copiar soluciones ajenas
- Uso responsable de datos personales o sensibles
- Balance entre sobreajuste y generalización en tableros públicos
