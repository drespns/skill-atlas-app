<!-- skillatlas-tier: iniciacion -->
## Arquitectura

- Cluster control plane
- Nodes data plane
- kube-apiserver entrada
- etcd almacén estado
- kube-scheduler asignación
- kubelet en nodo
- CNI networking pods

## Workloads

- Pod unidad mínima
- Deployment réplicas
- StatefulSet orden estable
- DaemonSet nodo a nodo
- Job y CronJob batch
- ReplicaSet tras Deploy

## Configuración

- ConfigMap no sensible
- Secrets codificación base64
- Volumen proyectado
- Downward API metadatos

<!-- skillatlas-tier: junior -->
## Red y servicio

- Service ClusterIP interno
- NodePort exposición
- LoadBalancer cloud LB
- Ingress controlador HTTP
- NetworkPolicy segmentación
- DNS interno cluster

## Escalado y recursos

- HPA métricas CPU memoria
- VPA ajuste vertical
- requests y limits QoS
- QualityOfService clases

<!-- skillatlas-tier: mid -->
## Almacenamiento

- PersistentVolume reclamo
- StorageClass dinámico
- AccessModes RWO RWX

## Seguridad

- RBAC roles bindings
- ServiceAccount pod
- Pod Security Standards
- admission controllers
- imagePullSecrets registry

<!-- skillatlas-tier: senior -->
## GitOps y despliegue

- Helm charts empaquetado
- Kustomize overlays
- Argo CD reconciliación
- Flux GitOps

## Observabilidad

- Probes liveness readiness
- kubectl logs exec
- metrics-server HPA
- Prometheus operador
