# Kubernetes Cheatsheet

Fast-lookup reference for Kubernetes administration, development, traffic management, security hardening, and troubleshooting.

## 1. Kubectl Imperative & Declarative Commands

```bash
# Server-Side Apply (SSA) with field manager
kubectl apply --server-side --field-manager=my-controller -f deployment.yaml

# Dry-run generation and output
kubectl create deployment web --image=nginx:alpine --dry-run=client -o yaml > deployment.yaml

# Expose a deployment as a ClusterIP or NodePort service
kubectl expose deployment web --port=80 --target-port=8080 --type=ClusterIP

# Temporary interactive debugging container attached to a running pod
kubectl debug pod/web-app-abc -it --image=busybox:1.37.0 --target=app-container

# Force delete a stuck terminating pod
kubectl delete pod web-app-abc --grace-period=0 --force
```

## 2. Gateway API v1.6 YAML Templates

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: external-gateway
  namespace: production
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: app-route
  namespace: production
spec:
  parentRefs:
    - name: external-gateway
      namespace: production
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: backend-service
          port: 8080
```

## 3. Kubeadm Lifecycle & etcd Backup/Restore

```bash
# Initialize control plane
kubeadm init --control-plane-endpoint "k8s-cluster.local:6443" --pod-network-cidr=10.244.0.0/16

# Generate join command for worker nodes
kubeadm token create --print-join-command

# Save etcd snapshot using etcdctl (requires certs)
ETCDCTL_API=3 etcdctl snapshot save /var/backups/etcd-snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Restore etcd snapshot
ETCDCTL_API=3 etcdctl snapshot restore /var/backups/etcd-snapshot.db \
  --data-dir=/var/lib/etcd-restored
```

## 4. RBAC & Pod Security Standards Labels

```bash
# Create a namespace with restricted Pod Security Standards enforced
kubectl create namespace secure-ns
kubectl label namespace secure-ns \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/enforce-version=v1.37 \
  pod-security.kubernetes.io/warn=restricted
```

```yaml
# RBAC Role granting read-only access to pods and write access to configmaps
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: app-developer
rules:
  - apiGroups: ['']
    resources: ['pods']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['']
    resources: ['configmaps']
    verbs: ['get', 'list', 'watch', 'create', 'update', 'patch']
```

## 5. CEL ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: 'require-run-as-non-root'
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['pods']
  validations:
    - expression: 'object.spec.securityContext.runAsNonRoot == true'
      message: 'Pods must enforce securityContext.runAsNonRoot == true'
```

## 6. Helm 4 & Kustomize CLI

```bash
# Install / upgrade a Helm chart with custom values
helm upgrade --install my-release oci://ghcr.io/example/charts/my-app --version 1.2.3 \
  --namespace production --create-namespace --values values.yaml

# Build a Kustomize overlay snapshot
kustomize build overlays/production > manifested-output.yaml
```

## 7. Troubleshooting Playbook

- **CrashLoopBackOff**: Check logs (`kubectl logs pod/<name> -c <container> --previous`), verify entrypoint commands, inspect exit codes (e.g., 137 = OOMKilled).
- **Pending Pods**: Check scheduler events (`kubectl describe pod/<name>`), verify resource requests vs node allocatable capacity, taints/tolerations, and PVC binding status.
- **Service Connectivity Failure**: Inspect EndpointSlices (`kubectl get endpointslices -l kubernetes.io/service-name=<svc>`), verify container port declarations, and check CNI network policy restrictions.
- **etcd Space Exceeded**: If apiserver returns HTTP 500 space exceeded errors, execute etcd compaction (`etcdctl compact <revision>`) followed by defragmentation (`etcdctl defrag`).
