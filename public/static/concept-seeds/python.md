<!-- skillatlas-tier: iniciacion -->
## Fundamentos

- REPL y ejecución de scripts
- Shebang y `__main__`
- Sangría significativa
- Comentarios y docstrings
- Convención PEP 8

## Sintaxis y tipos

- Variables y asignación
- Tipos dinámicos
- `int` y `float`
- `str` y literales
- `bool` y operadores lógicos
- `None`
- Tuplas inmutables
- Listas mutables
- Diccionarios
- Conjuntos `set`
- `bytes` y `bytearray`
- Operador morsa (walrus)
- Desempaquetado de tuplas
- F-strings
- Formato con `format()`
- Comparaciones encadenadas
- Identidad con `is`

<!-- skillatlas-tier: junior -->
## Funciones y alcance

- Definición con `def`
- Argumentos posicionales
- Argumentos por nombre
- Valores por defecto
- `*args`
- `**kwargs`
- Solo palabras clave
- Alcance local y global
- `global` y `nonlocal`
- Funciones anidadas
- Closures
- Decoradores básicos
- Lambda
- Anotaciones de tipo

## Control de flujo

- `if` `elif` `else`
- `match` / `case`
- Bucles `for`
- Bucles `while`
- `break` y `continue`
- `else` en bucles
- `pass`

## Comprensiones e iteración

- List comprehension
- Dict comprehension
- Set comprehension
- Generator expression
- Iteradores y protocolo
- `yield` y generadores
- `yield from`

<!-- skillatlas-tier: mid -->
## Orientación a objetos

- Clases con `class`
- `self` en instancias
- Constructor `__init__`
- Atributos de instancia
- Atributos de clase
- Herencia simple
- `super()` para padres
- Métodos especiales básicos
- Propiedades con `@property`
- Métodos de clase
- Métodos estáticos
- Dataclasses
- Enums con `Enum`
- Mixins

## Módulos y paquetes

- `import` y `from`
- `__name__ == "__main__"`
- `__init__.py` en paquetes
- Espacio de nombres
- Imports relativos
- `__all__` de módulo

## Errores y depuración

- `try` `except` `finally`
- Jerarquía de excepciones
- `raise` y excepción encadenada
- `else` en `try`
- Assertions con `assert`
- Context managers con `with`
- Bloqueo con `contextlib`
- Logging con `logging`

## Archivos y E/S

- Abrir archivos con `open()`
- Codificación UTF-8
- Lectura línea a línea
- Modo binario
- Rutas con `pathlib`
- `Path` y operadores

<!-- skillatlas-tier: senior -->
## Tipado y herramientas

- Type hints básicos
- `typing.Optional`
- `typing.List` dictado legacy
- `list[str]` moderno
- `Union` y `|`
- `Protocol` estructural
- `TypedDict`
- MyPy en proyectos
- `pyproject.toml`

## Biblioteca estándar

- `sys` argv y salida
- `os` entorno básico
- `argparse` CLI
- `json` serialización
- `csv` lectura
- `datetime` fechas
- `collections.Counter`
- `collections.defaultdict`
- `itertools` combinaciones
- `functools.partial`
- `functools.wraps`
- `copy` shallow y deep
- `math` utilidades
- `random` semillas
- `subprocess` procesos
- `urllib` peticiones simples
- `http.client` bajo nivel
- `sqlite3` embebido
- `unittest` pruebas
- `pytest` ecosistema

## Concurrencia y asíncrono

- Hilos con `threading`
- Bloqueos y colas
- `multiprocessing` CPU
- `asyncio` event loop
- `async` y `await`
- `asyncio.gather`
- Colas asíncronas

## Entornos y empaquetado

- `venv` entornos
- `pip` dependencias
- `requirements.txt`
- Ruedas con `wheel`
- Editable installs
- PyPI publicación básica
