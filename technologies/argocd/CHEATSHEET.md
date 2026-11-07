# Argo CD & GitOps Cheatsheet (`technologies/argocd`)

Fast-lookup reference for Argo CD CLI commands, Argo Rollouts CLI (`kubectl argo rollouts`), custom resource manifests, sync hooks, Casbin RBAC, and controller tuning configurations.

## 1. Argo CD CLI (`argocd`)

```bash
# Login to Argo CD server
argocd login argocd.example.com --username admin --password <password> --insecure

# Create and sync an Application
argocd app create guestbook \
  --repo https://github.com/argoproj/argocd-example-apps.git \
  --path guestbook \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace default \
  --sync-policy automated \
  --self-heal \
  --prune

# Trigger manual synchronization and wait for completion
argocd app sync guestbook --prune --wait

# Get sync status and health details
argocd app get guestbook --show-caught

# Perform a hard refresh (bypass repo-server cache)
argocd app get guestbook --hard-refresh

# Diff live cluster state against Git repository state
argocd app diff guestbook

# Export and import cluster state for disaster recovery
argocd admin export > argocd-backup.yaml
argocd admin import < argocd-backup.yaml
```

## 2. Argo Rollouts CLI (`kubectl argo rollouts`)

```bash
# View rollout status and canary progression live
kubectl argo rollouts status rollout/guestbook-rollout -n default

# Promote a paused canary rollout to next step or full release
kubectl argo rollouts promote guestbook-rollout -n default

# Abort an active canary rollout due to failing metrics
kubectl argo rollouts abort guestbook-rollout -n default

# Restart a rollout (triggers rolling update or blue/green switch)
kubectl argo rollouts restart guestbook-rollout -n default

# View analysis run metrics history
kubectl argo rollouts get analysisrun -n default
```

## 3. Custom Resource Manifests

### Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

### AppProject

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: production
  namespace: argocd
spec:
  description: Production applications project
  sourceRepos:
    - https://github.com/org/production-manifests.git
  destinations:
    - namespace: production
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
```

### ApplicationSet (Git Generator)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: cluster-addons
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/org/fleet-configs.git
        revision: HEAD
        directories:
          - path: clusters/*
  template:
    metadata:
      name: '{{path.basename}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/fleet-configs.git
        targetRevision: HEAD
        path: '{{path.path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path.basename}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

### Rollout (Canary with Analysis)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: webapp-rollout
spec:
  replicas: 5
  strategy:
    canary:
      analysis:
        templates:
          - templateName: success-rate
        args:
          - name: service-name
            value: webapp-svc
      steps:
        - setWeight: 20
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: {}
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
        - name: webapp
          image: ghcr.io/org/webapp:v2.0.0
```

## 4. Sync Waves & Hooks Annotations

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  annotations:
    argocd.argoproj.io/sync-wave: '-1'
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: postgres:16-alpine
          command: ['sh', '-c', "echo 'Running database migrations...'"]
      restartPolicy: Never
```

## 5. Casbin RBAC (`argocd-rbac-cm`)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.csv: |
    p, role:developers, applications, get, */*, allow
    p, role:developers, applications, sync, */*, allow
    g, developer-team, role:developers
  scopes: '[groups]'
```

## 6. Controller Tuning (`argocd-cm`)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  timeout.reconciliation: '180s'
  exec.enabled: 'true'
  resource.exclusions: |
    - apiGroups:
        - metrics.k8s.io
      kinds:
        - PodMetrics
        - NodeMetrics
  admin.enabled: 'true'
```
