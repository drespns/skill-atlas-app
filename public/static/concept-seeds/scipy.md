<!-- skillatlas-tier: iniciacion -->
## Integración numérica

- `integrate.quad`, `solve_ivp` para EDOs
- `optimize` para raíces y minimización sin restricciones

## Optimización lineal (LP)

- `scipy.optimize.linprog(c, A_ub, b_ub, A_eq, b_eq, bounds)` para minimizar el objetivo lineal sobre `x` con restricciones en forma matricial
- Interpretar `result.fun`, `result.x` y `result.status` (factible, no acotado, fallo del solver)
- En temarios de oposición suele enlazarse con formulación estándar y método Símplex en papel

## Estadística

- Distribuciones `stats`, tests de hipótesis comunes
- Ajuste de parámetros (`fit`) y generación de muestras

<!-- skillatlas-tier: junior -->
## Álgebra lineal dispersa

- Formatos CSR, CSC, COO y operaciones básicas
- Solvers sparse para sistemas grandes

## Señal e imagen

- `signal` filtros, convoluciones, espectro
- `ndimage` morfología y filtros espaciales

<!-- skillatlas-tier: mid -->
## Espacio y clustering espacial

- `spatial.KDTree` para vecinos más cercanos
- `cluster.hierarchy` en datos tabulares

## Interpolación

- `interpolate` splines y `griddata` para datos dispersos

<!-- skillatlas-tier: senior -->
## Rendimiento

- Cuándo delegar en Fortran/C subyacente vs NumPy puro
- Integración con pipelines de ML (scikit-learn, PyTorch)
