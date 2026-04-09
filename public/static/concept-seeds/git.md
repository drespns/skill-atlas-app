<!-- skillatlas-tier: iniciacion -->
## Conceptos base

- Repositorio como historial de commits; directorio de trabajo frente a índice (*staging*)
- Ramas como punteros móviles y *merge* como integración de historiales
- Remotos (`origin`) para colaborar y publicar cambios

## Flujo diario

- `git status`, `add`, `commit` con mensajes claros y frecuencia razonable
- `pull` (fetch + merge) y `push` respetando la política de la rama principal

<!-- skillatlas-tier: junior -->
## Historial y depuración

- `log` con grafos, `diff` entre commits y `blame` para atribución por línea
- `bisect` para localizar regresiones y `revert` para deshacer en historial compartido
- `reset` (--soft, --mixed, --hard) con cuidado en ramas remotas

## Ramas avanzadas

- `rebase` interactivo para limpiar commits antes de revisión
- `cherry-pick` para traer parches puntuales y resolución de conflictos de fusión

<!-- skillatlas-tier: mid -->
## Colaboración

- Diferencia entre `fetch` y `pull`; seguimiento de *upstream*
- Pull requests / merge requests con revisión y políticas de rama
- Etiquetas anotadas para marcar releases

## Hooks y activos grandes

- Hooks locales (`pre-commit`) para calidad antes del commit
- Git LFS para binarios pesados sin inflar el historial

<!-- skillatlas-tier: senior -->
## Monorepos y servidor

- Submódulos y *subtree* como trade-offs documentados
- *Sparse checkout* para clones parciales en repos enormes
- Repositorios *bare*, protección de ramas y políticas en el servidor (GitHub/GitLab)
