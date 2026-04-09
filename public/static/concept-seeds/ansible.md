<!-- skillatlas-tier: iniciacion -->
## Modelo mental

- Inventario de hosts y grupos; ejecución declarativa vía playbooks YAML
- Tareas idempotentes que describen el estado deseado, no solo comandos sueltos
- Roles reutilizables con estructura de carpetas estándar

## Ejecución

- `ansible-playbook` con etiquetas, comprobación en modo `--check` y diff de ficheros
- Módulos `ansible.builtin` y ampliación mediante *collections* de Ansible Galaxy

<!-- skillatlas-tier: junior -->
## Variables y secretos

- Jerarquía `group_vars` / `host_vars` y prioridad de variables
- Ansible Vault para cifrado de secretos en el repositorio
- Plantillas Jinja2 para ficheros de configuración parametrizados

## Conectividad

- SSH en Linux, WinRM en Windows y escalada de privilegios (`become`)
- Delegación de tareas y conexión local para acciones en el control node

<!-- skillatlas-tier: mid -->
## Fiabilidad y escala

- Condiciones `changed_when` / `failed_when` y tareas asíncronas largas
- Estrategias de ejecución (*linear*, *free*) y despliegues rodantes (*rolling*)

## Calidad

- *Molecule* para probar roles en contenedores y `ansible-lint` para estilo

<!-- skillatlas-tier: senior -->
## Entornos grandes

- Integración con inventarios dinámicos (nube) y AWX/Tower para RBAC
- Mitogen u otras optimizaciones solo tras medir cuellos de botella reales
- Separación de playbooks por entorno (dev/stage/prod) y revisión de cambios en CI
