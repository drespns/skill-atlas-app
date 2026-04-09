<!-- skillatlas-tier: iniciacion -->
## Aplicación mínima

- Instancia `Flask`, rutas con `@app.route`
- Objeto `request`, `jsonify`, códigos HTTP explícitos
- Plantillas Jinja2 y archivos estáticos

## Configuración

- `app.config` y variables de entorno por entorno

<!-- skillatlas-tier: junior -->
## Extensiones comunes

- *Blueprints* para modularizar grandes proyectos
- Flask-SQLAlchemy para modelos y sesiones
- WTForms o validación manual de entradas

## Sesiones y cookies

- `session` firmada con `SECRET_KEY` fuerte

<!-- skillatlas-tier: mid -->
## APIs

- Serialización con Marshmallow / Pydantic (patrones comunes)
- CORS y seguridad de cabeceras detrás de proxy

## Despliegue

- Servidores WSGI: Gunicorn, uWSGI
- Contenedores y healthchecks

<!-- skillatlas-tier: senior -->
## Escalado

- Tareas en background (Celery, RQ) cuando el request no debe bloquear
- Métricas y trazas en aplicaciones Flask en producción
