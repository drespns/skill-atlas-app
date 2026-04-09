<!-- skillatlas-tier: iniciacion -->
## Apps rápidas

- Script Python único que se convierte en app web
- Widgets: entradas de texto, selectores, sliders, subida de ficheros
- `st.session_state` para conservar estado entre reruns

## Ejecución

- Modelo de rerun completo frente a callbacks granulares
- Organización en páginas (`st.navigation` / multipágina)

<!-- skillatlas-tier: junior -->
## Datos y gráficos

- Integración con Pandas y gráficos nativos
- Caché: `st.cache_data` vs `st.cache_resource` y TTL

## Despliegue

- Streamlit Community Cloud o contenedor propio
- Variables `st.secrets` y configuración por entorno

<!-- skillatlas-tier: mid -->
## Rendimiento

- Evitar recomputar datasets pesados en cada interacción
- Separar ETL batch de la app interactiva cuando escale

## UX

- Mensajes de progreso, errores claros y diseño responsive básico

<!-- skillatlas-tier: senior -->
## Producción

- Autenticación delante del servicio (proxy, SSO)
- Límites de memoria y escalado horizontal con sticky sessions
