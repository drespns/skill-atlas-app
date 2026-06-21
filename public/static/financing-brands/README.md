# Logos de financiación (BNPL)

Coloca aquí los logos de cada proveedor. El nombre del archivo debe coincidir con la **clave** del catálogo en `packages/expense-core/src/financing-brands.ts`.

Formato preferido: **SVG** (`klarna.svg`). También se intenta `.png` si el SVG no carga.

## Claves disponibles

| Archivo | Proveedor |
|---------|-----------|
| `klarna.svg` | Klarna |
| `sequra.svg` | Sequra |
| `paypal.svg` | PayPal |

Al guardar una financiación, el nombre se compara con los alias del catálogo y se asigna el logo automáticamente. También puedes elegir la marca manualmente en el modal.
