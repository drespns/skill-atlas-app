<!-- skillatlas-tier: iniciacion -->
## Ejecución en el navegador

- Etiqueta `<py-script>` y configuración básica de entorno
- Runtime WebAssembly (p. ej. Pyodide / Micropython) frente a servidor
- Punto de entrada del script y ciclo de carga de la página

## Interoperabilidad

- Acceso al DOM desde Python de forma limitada y segura
- Eventos del navegador y actualización de la UI
- Separación entre lógica en cliente y llamadas a API remotas

<!-- skillatlas-tier: junior -->
## Paquetes y rendimiento

- Subconjunto de la biblioteca estándar y paquetes empaquetados
- Tamaño del bundle y tiempo de arranque en primera visita
- Comparativa con ejecutar Python en backend (latencia, estado)

## Desarrollo

- Depuración en DevTools frente a entorno clásico
- Empaquetado con bundlers modernos (Vite, etc.)

<!-- skillatlas-tier: mid -->
## Casos de uso

- Prototipos educativos y demos interactivas sin servidor propio
- Visualizaciones ligeras embebidas en documentación estática

## Limitaciones

- No sustituye a un backend para secretos o cargas pesadas
- Concurrencia y hilos distintos al modelo servidor tradicional

<!-- skillatlas-tier: senior -->
## Arquitectura

- Cuándo combinar PyScript con workers o WASM nativo
- Estrategias de caché y actualización de runtime entre despliegues
