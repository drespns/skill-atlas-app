<!-- skillatlas-tier: iniciacion -->
## Cascada y especificidad

- Selectores de tipo, clase, id y combinadores (descendiente, hijo, hermano)
- Cálculo de especificidad y orden de aparición; uso de `@layer` para control explícito
- Variables personalizadas (`--token`) para temas y diseño sistemático

## Caja y flujo

- Modelo de caja: `margin`, `border`, `padding`; `box-sizing: border-box` como base habitual
- Unidades relativas (`rem`, `em`, `%`, `vw`/`vh`) para layouts fluidos

<!-- skillatlas-tier: junior -->
## Flexbox

- Eje principal y cruzado; `justify-content`, `align-items`, `gap`
- Elementos flexibles: `flex-grow`, `shrink`, `basis` y alineación individual

## Grid

- Rejillas explícitas con `grid-template`, `fr`, `minmax` y áreas nombradas
- Alineación de ítems y superposición controlada con `z-index` en contextos de apilamiento

<!-- skillatlas-tier: mid -->
## Tipografía y color

- Jerarquía tipográfica coherente: familia, tamaño, interlineado
- Contraste de color y legibilidad; truncado con `text-overflow` / `line-clamp` cuando proceda

## Responsive y accesibilidad

- *Media queries* por anchura y preferencias (`prefers-color-scheme`, `prefers-reduced-motion`)
- Imágenes y contenedores fluidos sin desbordar el viewport

<!-- skillatlas-tier: senior -->
## Animación y rendimiento

- `transition` y `@keyframes` con moderación; `transform` y `opacity` suelen ser baratas
- `will-change` solo como optimización medida, no por defecto
- Evitar animaciones que afecten al diseño para usuarios que piden menos movimiento
