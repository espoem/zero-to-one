# Cheatsheet: Containers and OCI Runtimes

Fast-lookup reference for kernel primitives, CLI flags, BuildKit syntax, OCI media types, Quadlet configuration keys, and container exit codes.

## 1. Kernel Primitives & Inspection (`unshare`, `nsenter`, cgroups v2)

```bash
# Enter existing container namespaces (pid, net, mnt, uts, ipc, user)
sudo nsenter --target <PID> --mount --net --pid --uts --ipc -- bash

# Create a new isolated namespace session
sudo unshare --pid --net --mount --fork --map-root-user bash

# Inspect cgroups v2 resource usage for a process or slice
cat /sys/fs/cgroup/system.slice/docker-<CONTAINER_ID>.scope/memory.current
cat /sys/fs/cgroup/system.slice/docker-<CONTAINER_ID>.scope/cpu.stat
```

## 2. Container Engine CLI Flags (`docker`, `podman`, `buildah`, `skopeo`, `cosign`, `trivy`)

```bash
# Docker: Run container with strict resource limits and read-only rootfs
docker run --detach --name secure-app --memory=512m --cpus=2.0 --read-only --tmpfs /tmp:size=64M my-app:latest

# Podman: Run rootless container with idmapped/kept UID and podman machine
podman run --detach --pod new:my-pod --userns=keep-id registry.example.com/app:1.0.0

# Buildah: Create container scratch space and commit
cid=$(buildah from scratch)
buildah add $cid app-binary /app/
buildah config --entrypoint '["/app/app-binary"]' $cid
buildah commit $cid my-app:latest

# Skopeo: Copy image between registries inspecting TLS
skopeo copy --src-tls-verify=false --dest-tls-verify=false docker://docker.io/library/alpine:latest oci:/tmp/alpine-oci

# Cosign: Sign image by digest using keyless OIDC
cosign sign --yes --registry-referrers-mode=oci-1.1 registry.example.com/app@sha256:abcdef...

# Trivy: Scan image for high/critical vulnerabilities
trivy image --severity HIGH,CRITICAL --security-checks vuln,config registry.example.com/app:latest
```

## 3. Dockerfile & BuildKit Advanced Syntax (`--mount`)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:26-alpine AS builder
WORKDIR /app
# Persistent package manager cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs26-debian12
COPY --from=builder /app/dist /app/dist
USER 1000:1000
ENTRYPOINT ["/app/dist/index.js"]
```

## 4. OCI Media Types

| Object | OCI Media Type | Description |
| :-- | :-- | :-- |
| **Image Manifest** | `application/vnd.oci.image.manifest.v1+json` | Describes image layers, config descriptor, and annotations. |
| **Image Index** | `application/vnd.oci.image.index.v1+json` | Multi-architecture index pointing to platform-specific manifests. |
| **Image Config** | `application/vnd.oci.image.config.v1+json` | Container configuration (env vars, entrypoint, architecture). |
| **Layer (Tar+Gzip)** | `application/vnd.oci.image.layer.v1.tar+gzip` | Compressed tar archive layer. |
| **Layer (Tar+Zstd)** | `application/vnd.oci.image.layer.v1.tar+zstd` | Zstandard-compressed layer for faster decompression. |

## 5. Podman Quadlet `.container` Unit Keys (`/etc/containers/systemd/`)

```ini
[Unit]
Description=Production API Service
After=network-online.target

[Container]
Image=registry.example.com/api:v1.2.0
ContainerName=api-service
PublishPort=8080:8080
Environment=NODE_ENV=production
Volume=/var/lib/app/data:/app/data:Z
ReadOnly=true
Memory=1024M
DropCapability=ALL
AddCapability=NET_BIND_SERVICE

[Service]
Restart=always
TimeoutStartSec=60

[Install]
WantedBy=multi-user.target
```

## 6. Compose v5 Syntax Highlights

```yaml
services:
  api:
    image: registry.example.com/api:1.4.2@sha256:7b83d95efc94e80678d4615a133f671c662e6504de1a868f1c8d5a864e2fb60a
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 512M
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/healthz']
      interval: 10s
      timeout: 3s
      retries: 3
  db:
    image: postgres:17.4-bookworm@sha256:d826a7e0d37e753bfb4421d011f008892ec9c62923f666f21e5491104e176b66
    environment:
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

## 7. Container Exit Codes & Troubleshooting

| Exit Code | Meaning | Common Root Cause |
| :-- | :-- | :-- |
| **125** | Engine Command Failure | Docker/Podman daemon flag error or invalid syntax. |
| **126** | Command Invoked Cannot Execute | Entrypoint binary lacks execution permissions (`chmod +x`) or wrong architecture. |
| **127** | Command Not Found | Entrypoint binary or executable not found in `$PATH` or shell form misinterpretation. |
| **137** | Process Terminated by SIGKILL (9) | Container exceeded memory limit (`memory.max`) and was OOM-killed by kernel, or manual `docker kill`. |
| **143** | Process Terminated by SIGTERM (15) | Graceful shutdown signal received from orchestrator or `docker stop` timeout elapsed. |
