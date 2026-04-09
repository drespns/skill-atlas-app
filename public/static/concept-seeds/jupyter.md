<!-- skillatlas-tier: iniciacion -->
## Notebooks y kernels

- Celdas de código vs markdown y orden de ejecución
- Kernel por lenguaje (Python, R, etc.) y reinicio del kernel
- Atajos: ejecutar celda, ejecutar todo, interrumpir

## Entorno

- Variables de entorno y rutas de trabajo del kernel
- Extensiones del navegador vs JupyterLab como aplicación

<!-- skillatlas-tier: junior -->
## Reproducibilidad

- Semillas aleatorias y orden de celdas documentado
- Exportación con `nbconvert` (HTML, PDF, slides)
- Control de versiones: qué commitear (`.ipynb` limpio, sin salidas masivas)

## Interactividad

- Widgets (`ipywidgets`) para parámetros en tiempo real
- Visualización integrada (Matplotlib, Plotly en línea)

<!-- skillatlas-tier: mid -->
## JupyterLab y equipos

- Espacios de trabajo, terminales y visores de datos
- Integración con sistemas de scheduling o pipelines externos

## Rendimiento

- Cuándo mover código pesado a scripts `.py` o jobs por lotes
- Uso de memoria y liberación de objetos grandes

<!-- skillatlas-tier: senior -->
## Operación a escala

- JupyterHub: autenticación, perfiles de usuario y cuotas
- Kernels remotos (SSH, Kubernetes) y seguridad de red
