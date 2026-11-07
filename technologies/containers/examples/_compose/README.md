# Repository-Wide Docker Compose Stack Conventions

This document defines the shared Docker Compose conventions mandated across all `zero-to-one` topic tracks, maintained and owned by `technologies/containers` per `.agents/OWNERSHIP.md`. Every laboratory stack, integration harness, and multi-service demonstration in this repository must adhere to these specifications.

## 1. Image Pinning: Tags and Digest Immutability

All service images must be pinned by both an exact semantic version tag and a content-addressable multi-arch image index or platform digest (`image: <repository>:<exact-tag>@sha256:<digest>`). Mutable tags (such as `:latest`, `:alpine`, `:bookworm`, or bare major versions `:8`) are prohibited in production and educational examples because upstream tag mutation breaks reproducible builds, alters test baselines silently, and invalidates verification assertions.

## 2. Healthchecks and Startup Ordering

Simple `depends_on` lists without health status conditions only guarantee that a dependent container process has entered the `running` state; they do not ensure the underlying daemon, socket, or database engine is ready to accept connections. All dependency edges across services must declare explicit healthchecks and depend on `condition: service_healthy`:

```yaml
services:
  database:
    image: postgres:17.4-bookworm@sha256:d826a7e0d37e753bfb4421d011f008892ec9c62923f666f21e5491104e176b66
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d testdb']
      interval: 2s
      timeout: 3s
      retries: 5
      start_period: 2s

  api:
    image: my-service:1.0.0
    depends_on:
      database:
        condition: service_healthy
```

## 3. Profile-Based Service Partitioning

Compose profiles prevent unintentional resource allocation, port collisions, and execution overhead during CI runs and local tests:

| Profile Name | Intended Scope & Trigger | Typical Services |
| --- | --- | --- |
| `default` (no profile) | Core minimal runtime for single-node unit or hermetic integration checks | Primary database or cache standalone instance |
| `cluster` | Distributed topology proofs, multi-node consensus, and replication failover | Multi-master nodes, secondary replicas, cluster coordinators |
| `monitoring` | Observability sinks, OpenTelemetry collectors, and metric visualizers | Prometheus, Jaeger, Grafana, OpenTelemetry Collector |
| `integration` | Interactive harness mocks and end-to-end integration test runners | Webhook simulators, mock OAuth/OIDC providers, seed workers |

## 4. Ephemeral and Isolated Storage

To prevent cross-test state leakage, stale volume locks, and host disk exhaustion:

- Named persistent volumes must be namespaced using the stack prefix (`zto_<track>_<service>_data`).
- Temporary runtimes and scratch directories must mount memory-backed `tmpfs` mounts (`/tmp`, `/var/run`) with `noexec` and `nosuid` flags.
- Test suites must clean up volumes deterministically on teardown via `docker compose down -v --remove-orphans`.

## 5. Port and Network Collision Avoidance

To enable multiple tracks and test harnesses to execute concurrently on a developer workstation without `address already in use` errors:

- Avoid binding service ports to wildcard `0.0.0.0`. Bind explicitly to loopback `127.0.0.1` (`127.0.0.1:6379:6379`) to prevent exposing unauthenticated test instances to local network segments.
- Allow port overrides via environment variables with safe defaults (for example, `${REDIS_PORT:-6379}:6379`).
- Set an explicit, isolated project name either inside `compose.yaml` using the top-level `name: zto-<track>` attribute or via the `-p` / `COMPOSE_PROJECT_NAME` configuration.

## 6. Security Baseline and Resource Limits

All Compose service definitions must observe the principle of least privilege:

- Include `init: true` to inject an init process (such as `tini`) when running custom commands to guarantee proper `SIGTERM` forwarding and zombie reaping.
- Include `security_opt: ["no-new-privileges:true"]` to prevent privilege escalation via setuid binaries.
- Specify cgroups v2 resource limits (`deploy.resources.limits.cpus` and `deploy.resources.limits.memory`) to ensure rogue test workloads cannot freeze the host operating system.
- Configure log rotation (`max-size: "10m"`, `max-file: "3"`) under `logging` to avoid filling the host root partition with unrotated `json-file` buffers.
