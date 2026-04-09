<!-- skillatlas-tier: iniciacion -->
## Store central

- Estado global único y flujo unidireccional de datos
- *Actions* con tipo descriptivo y *reducers* puros
- `dispatch`, `subscribe` y conexión a la vista (React, etc.)

## Redux Toolkit

- `configureStore`, *slices* con `createSlice`
- `createAsyncThunk` para peticiones asíncronas
- Inmutabilidad asistida por Immer integrado

<!-- skillatlas-tier: junior -->
## Datos remotos

- RTK Query: caché por etiqueta, invalidación y reintentos
- Normalización de entidades frente a listas anidadas

## Middleware

- *Thunk* vs *Saga* / *Observable* (elección según complejidad)
- Registro de middleware en cadena y orden de ejecución

<!-- skillatlas-tier: mid -->
## Rendimiento

- Selectores memoizados (`reselect`) para evitar renders innecesarios
- División de estado por dominio (*feature slices*)

## Depuración

- Redux DevTools: time travel y acciones registradas

<!-- skillatlas-tier: senior -->
## Arquitectura

- Cuándo preferir estado local, React Query o contexto ligero
- Patrones de *undo/redo* y persistencia selectiva (localStorage)
