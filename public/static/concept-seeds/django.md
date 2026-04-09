<!-- skillatlas-tier: iniciacion -->
## Proyecto y apps

- `settings.py` por entorno, `urls.py` raíz con `include()`
- Vistas función y basadas en clase (`ListView`, etc.)
- Plantillas, contexto y herencia de bloques

## Modelo ORM

- Modelos `models.Model`, migraciones `makemigrations` / `migrate`
- Consultas: `filter`, `exclude`, `annotate`, `select_related`

<!-- skillatlas-tier: junior -->
## Admin y formularios

- `ModelAdmin` personalizado y permisos
- `ModelForm`, validación y mensajes de error

## Autenticación

- `django.contrib.auth`, sesiones y middleware CSRF
- Permisos por grupo y comprobaciones en vistas

<!-- skillatlas-tier: mid -->
## APIs

- Django REST Framework: serializers, viewsets, routers
- Paginación, filtros y throttling

## Async (versiones recientes)

- Vistas asíncronas y ORM async cuando el despliegue lo permita

<!-- skillatlas-tier: senior -->
## Producción

- `collectstatic`, CDN y cabeceras de seguridad (`SECURE_*`)
- Observabilidad: logging estructurado y APM
