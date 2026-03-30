## Fundamentos app

- FastAPI app ASGI Starlette
- rutas decorador get post
- path parameters typing
- query parameters Optional
- request body Pydantic models

## Validación

- response_model serializa salida
- status_code HTTP explícito
- HTTPException errores API
- dependency injection Depends

## OpenAPI docs

- swagger UI automático
- redoc alternativa lectura
- openapi schema export

## Async y sync

- async def endpoints IO bound
- def sync en threadpool interno

## Seguridad

- OAuth2 password bearer JWT
- APIKeyHeader seguridad service
- CORS middleware orígenes

## Testing

- TestClient Starlette httpx
- pytest fixtures app lifespan

## Lifespan y startup

- lifespan async context app
- startup shutdown eventos legacy

## Archivos upload

- UploadFile multipart spool
- StreamingResponse media

## Background tasks

- BackgroundTasks fire forget
- cola simple no durable

## Configuración

- pydantic-settings BaseSettings
- env vars dotenv local dev

## Despliegue

- uvicorn workers producción
- gunicorn uvicorn workers Linux
- reverse proxy nginx TLS

## Versionado API

- APIRouter prefix tags versions

## GraphQL websocket

- WebSocket endpoint básico
- subscriptions patrones externo
