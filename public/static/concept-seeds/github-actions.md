<!-- skillatlas-tier: iniciacion -->
## Workflows

- Ficheros YAML en `.github/workflows`
- Eventos: `push`, `pull_request`, `schedule`, `workflow_dispatch`
- Jobs, `runs-on` y matriz `strategy.matrix`

## Pasos

- Acciones reutilizables del marketplace y versionado por commit SHA

<!-- skillatlas-tier: junior -->
## Contexto y secretos

- `github.token` con permisos mínimos
- *Environments* con protección y secretos por entorno
- Variables `vars` vs `secrets`

## Artefactos y caché

- Subida de builds intermedios entre jobs
- Caché de dependencias (`npm`, `pip`, etc.)

<!-- skillatlas-tier: mid -->
## CI avanzado

- Workflows reutilizables (`workflow_call`)
- Concurrency groups y cancelación de runs obsoletos

## Seguridad

- OIDC para despliegue en nube sin claves largas
- *Code scanning* y Dependabot (integración conceptual)

<!-- skillatlas-tier: senior -->
## Estrategia

- Pipelines trunk-based vs GitFlow
- Observabilidad de pipelines y SLAs de tiempo de build
