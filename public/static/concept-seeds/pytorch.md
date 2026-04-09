<!-- skillatlas-tier: iniciacion -->
## Tensores

- Creación, tipos (`float32`, `long`) y dispositivo `cpu` / `cuda`
- Operaciones element-wise y broadcasting como NumPy

## Autograd

- `requires_grad`, grafo dinámico y `backward()`
- `torch.no_grad()` en inferencia

<!-- skillatlas-tier: junior -->
## `nn.Module`

- Capas lineales, convoluciones, *dropout*, normalización
- `forward` definido por el usuario, parámetros registrados automáticamente

## Optimización

- `torch.optim` (SGD, Adam, AdamW) y *learning rate schedules*
- Pérdidas integradas (`CrossEntropyLoss`, etc.)

<!-- skillatlas-tier: mid -->
## Datos

- `Dataset`, `DataLoader`, *workers* y *pin_memory* en GPU
- Aumento de datos con `torchvision.transforms`

## Guardado

- `state_dict`, checkpoints completos y compatibilidad de versiones

<!-- skillatlas-tier: senior -->
## Producción

- TorchScript, ONNX export y servidores de inferencia
- Entrenamiento distribuido (`DistributedDataParallel`)
