<!-- skillatlas-tier: iniciacion -->
## Escena básica

- `Scene`, `PerspectiveCamera`, `WebGLRenderer`
- `Mesh` = `Geometry` + `Material`, luces ambientales y direccionales

## Carga de modelos

- `GLTFLoader` y formatos estándar para assets 3D

<!-- skillatlas-tier: junior -->
## Materiales y luces

- PBR `MeshStandardMaterial`, mapas normal/roughness/metalness
- Sombras proyectadas y resolución de mapa de sombras

## Interacción

- `Raycaster` para *picking* con ratón o touch
- `OrbitControls` y controles de cámara comunes

<!-- skillatlas-tier: mid -->
## Animación

- `AnimationMixer`, *clips* y *skeletal animation*
- Interpolación de propiedades con *tweens*

## Rendimiento

- Instancing (`InstancedMesh`) para muchos objetos idénticos
- LOD y frustum culling a nivel de aplicación

<!-- skillatlas-tier: senior -->
## Post-procesado y XR

- *EffectComposer* con passes (bloom, SSAO)
- WebXR básico para VR/AR en navegador
