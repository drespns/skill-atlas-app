<!-- skillatlas-tier: iniciacion -->
## Modelos

- BaseModel fields typing
- Field default factory constraints
- model_validate parse datos
- model_dump serializa dict
- model_construct raw

## Validadores

- field_validator classmethod
- model_validator whole model
- BeforeValidator AfterValidator wraps

## Tipos especiales

- EmailStr HttpUrl tipos
- Json tipo anidado
- SecretStr SecretBytes masking
- PositiveInt constrained int
- Annotated metadata stack

<!-- skillatlas-tier: junior -->
## Configuración

- ConfigDict model config
- extra ignore forbid allow
- str_strip_whitespace strings
- validate_assignment mutables
- frozen inmutable model

## Esquemas JSON

- model_json_schema OpenAPI
- TypeAdapter genéricos unions

<!-- skillatlas-tier: mid -->
## v1 frente v2

- v2 unified validators perf
- migration guide breaking

## Datetime

- AwareDatetime zona horaria
- PastDate future validations

<!-- skillatlas-tier: senior -->
## Integración

- FastAPI request body depend
- ORM mode SQLAlchemy compat
- Settings BaseSettings dotenv

## Rendimiento

- pydantic-core Rust core
- validation rust speed
