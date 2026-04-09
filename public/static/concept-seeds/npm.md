<!-- skillatlas-tier: iniciacion -->
## Paquetes y versiones

- `package.json`: dependencias, `devDependencies` y scripts `npm run`
- Semver (`^`, `~`, rangos) y lockfile (`package-lock.json` / `pnpm-lock.yaml`)
- Registro público npm y *scopes* (`@org/paquete`)

## Instalación

- `npm install`, `npm ci` en CI y caché de artefactos
- Instalación global vs local y `npx` para ejecutables

<!-- skillatlas-tier: junior -->
## Publicación y calidad

- Versionado, tags Git y convención de *changelog*
- `npm publish`, visibilidad y tokens de autenticación
- `npm audit` y políticas de dependencias vulnerables

## Monorepos

- *Workspaces* nativos y hoisting de dependencias
- Herramientas complementarias (Nx, Turborepo) cuando el repo crece

<!-- skillatlas-tier: mid -->
## Resolución y conflictos

- Overrides / resolutions para forzar versiones transitivas
- Duplicados en `node_modules` y deduplicación

## Rendimiento

- Tamaño del árbol de dependencias y alternativas ligeras
- Caché en CI (GitHub Actions, etc.) y artefactos reproducibles

<!-- skillatlas-tier: senior -->
## Gobierno corporativo

- Registries privados (Verdaccio, Artifactory) y proxy
- SBOM y trazabilidad de licencias en supply chain
