<!-- skillatlas-tier: iniciacion -->
## WebDriver

- Control del navegador vía driver (Chrome, Firefox, Edge)
- Sesión, timeouts implícitos y explícitos
- Localizadores: `id`, CSS, XPath y buenas prácticas de estabilidad

## Acciones básicas

- Navegación, `click`, `send_keys`, `clear`
- Capturas de pantalla y volcado de HTML para depuración

<!-- skillatlas-tier: junior -->
## Page Object

- Encapsular selectores y acciones reutilizables
- Separar datos de prueba de la lógica de interacción

## Esperas

- `WebDriverWait` con condiciones esperadas (`element_to_be_clickable`, etc.)
- Evitar `sleep` fijos salvo casos justificados

<!-- skillatlas-tier: mid -->
## Grid y paralelo

- Selenium Grid: hub, nodos y capacidades deseadas
- Ejecución paralela en CI con contenedores efímeros

## Integración

- pytest / JUnit con reportes y artefactos en fallos

<!-- skillatlas-tier: senior -->
## Mantenimiento

- Tests *flaky*: causas (red, animaciones) y mitigación
- Migración progresiva a herramientas modernas (Playwright, Cypress) cuando convenga
