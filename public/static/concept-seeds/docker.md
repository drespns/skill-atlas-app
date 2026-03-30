<!-- skillatlas-tier: iniciacion -->
## Fundamentos

- Imagen vs contenedor
- Dockerfile capas
- FROM base image
- RUN instrucción
- COPY frente ADD
- CMD vs ENTRYPOINT
- ENV variables entorno
- ARG build time
- EXPOSE documentación

## Redes y volúmenes

- bridge red por defecto
- host red Linux
- overlay swarm / k8s
- Volúmenes nombrados
- bind mount desarrollo
- tmpfs efímero

<!-- skillatlas-tier: junior -->
## Compose

- docker-compose.yml
- services red volumes
- depends_on orden
- profiles servicios opcionales

## Registries

- Docker Hub público
- ECR GCR ACR privado
- Tags y digest pinning
- Image scanning seguridad

<!-- skillatlas-tier: mid -->
## Optimización

- Multi-stage builds
- .dockerignore reducción
- Caché de capas orden
- distroless imágenes mínimas
- BuildKit características

## Runtime y seguridad

- Usuario no root
- readOnlyRootFilesystem
- capabilities Linux
- seccomp y AppArmor
- rootless Docker

<!-- skillatlas-tier: senior -->
## Orquestación ligera

- Docker Swarm modos
- kubectl context local
