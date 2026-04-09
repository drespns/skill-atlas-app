<!-- skillatlas-tier: iniciacion -->
## Sintaxis y módulos

- Paquetes con `main` o biblioteca; `go mod` para versionado de dependencias
- Tipado estático explícito; composición con `struct` e interfaces implícitas
- Punteros, pero sin aritmética insegura como en C

## Flujo de control

- `if` con declaración inicial; `switch` sin *fallthrough* por defecto
- Un único bucle `for`; `range` sobre slices, mapas y canales

<!-- skillatlas-tier: junior -->
## Funciones y errores

- Múltiples valores de retorno; errores como valores (`error` interface)
- Closures y captura de variables

## Concurrencia

- Goroutines y canales (*buffered* / *unbuffered*); `select` para multiplexar
- Paquete `context` para cancelación y *timeouts*
- `sync.Mutex`, `RWMutex` y `WaitGroup` para coordinación

<!-- skillatlas-tier: mid -->
## Testing y estándar

- `go test`, tablas de casos y *benchmarks* integrados
- Detector de carreras (`-race`) en CI

## Red y servicios

- `net/http`, serialización JSON y middleware con `context` en handlers
- gRPC y protobuf en ecosistemas de microservicios

<!-- skillatlas-tier: senior -->
## Tooling y operación

- `gofmt`, `go vet` y linters agregados (`golangci-lint`)
- Perfilado con `pprof` y trazas en producción
- Imágenes de contenedor mínimas y *build* reproducible
