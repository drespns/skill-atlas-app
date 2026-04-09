<!-- skillatlas-tier: iniciacion -->
## Utility-first

- Clases atómicas para layout, color, tipografía
- Breakpoints responsive (`sm:`, `md:`, `lg:`)
- Modo oscuro con `dark:` y estrategia `class` / `media`

## Configuración

- `tailwind.config`: tema, colores de marca, fuentes
- `@tailwind base/components/utilities` en CSS de entrada

<!-- skillatlas-tier: junior -->
## Plugins oficiales

- `@tailwindcss/forms`, `@tailwindcss/typography`
- Extensión de utilidades y *presets*

## Patrones

- Componentes UI con `@apply` en capa CSS dedicada
- Design tokens vía variables CSS (`--color-*`)

<!-- skillatlas-tier: mid -->
## Rendimiento

- JIT: solo CSS usado en el proyecto
- Purge / *content paths* correctos en monorepos

## Accesibilidad

- Contraste, foco visible y orden de tabulación en componentes compuestos

<!-- skillatlas-tier: senior -->
## Diseño a escala

- Sistemas de diseño compartidos entre productos
- Integración con librerías headless (Radix, etc.)
