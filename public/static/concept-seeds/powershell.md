<!-- skillatlas-tier: iniciacion -->
## Shell y objetos

- Cmdlets verbo-sustantivo (`Get-Help`, `Get-Command`)
- Tuberías con objetos .NET, no solo texto
- `$PSVersionTable` y diferencias *Windows PowerShell* vs *PowerShell 7+*

## Sintaxis básica

- Variables `$nombre`, comillas simples vs dobles y expansión
- Listas, tablas hash y acceso a propiedades

<!-- skillatlas-tier: junior -->
## Scripting

- Parámetros con validación (`ValidateSet`, `ValidateScript`)
- Manejo de errores: `-ErrorAction`, `$Error` y `try` / `catch` / `finally`
- Perfiles de usuario y `ExecutionPolicy`

## Remoting

- WinRM en entornos Windows tradicionales
- SSH remoting en PowerShell multiplataforma

<!-- skillatlas-tier: mid -->
## Módulos

- Módulos script vs binarios, manifiestos `.psd1`
- Galería PSGallery y firma de scripts

## Automatización

- Tareas programadas y servicios Windows
- Integración con Azure / cloud mediante módulos oficiales

<!-- skillatlas-tier: senior -->
## Producción

- *Desired State Configuration* (DSC) a alto nivel
- Rendimiento en bucles masivos y paralelización (`ForEach-Object -Parallel`)
