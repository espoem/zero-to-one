# Certification and Exam Coverage: Containers

This document establishes the exam coverage matrix, delta callouts, and preparation guidelines for container technologies, aligning with Linux Foundation / CNCF standards (CKAD v1.37 / CKS v1.34) and senior infrastructure engineering interviews.

## Exam Status Table

| Exam Code | Vendor / Program | Target Version | Status | Format | Passing Score |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **CKAD** | Linux Foundation / CNCF | Kubernetes v1.37 / Container Runtime | Active | Performance-based (15-20 tasks, 2 hours) | 66% |
| **CKS** | Linux Foundation / CNCF | Kubernetes v1.34 / Container Security | Active | Performance-based (15-20 tasks, 2 hours) | 67% |
| **Senior Interview** | Industry Technical Loop | OCI / Linux / BuildKit / Podman | Active | Multi-round system design & live debugging | N/A |

## Exam Delta Callouts

- **Docker Engine 29 vs Older Enterprise Baselines**: Docker 29 defaults to containerd image store and requires API v1.44+, whereas legacy certifications often assume monolithic graph drivers and older API versions.
- **Podman 6 vs Podman 4/5**: Podman 6 removed cgroups v1 support entirely, deprecated slirp4netns in favor of pasta, and removed BoltDB storage backend in favor of SQLite. Certifications referencing Podman rootless networking must account for pasta.
- **CKS v1.34 Security Domains**: Emphasizes supply chain security, immutable root filesystems, user namespace mapping, and container vulnerability scanning with Trivy/Cosign over basic Dockerfile directives.

## Domain → Module Coverage Matrix

| Domain | Weight | Core Objectives | Modules | Examples & Test Suites | Status |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **D1 Linux Kernel Primitives: Namespaces, Processes & cgroups v2** | 20% | Process isolation, 8 namespaces, PID 1 signaling, cgroups v2 resource controllers, PSI | Modules 01, 02, 03 | `examples/ts/01-what-a-container-is.test.ts` to `03-cgroups-v2.test.ts` | ✅ |
| **D2 Storage, OverlayFS & OCI Specifications** | 20% | OverlayFS layering, copy-up overhead, image/runtime/distribution specs, referrers | Modules 04, 05, 06, 07 | `examples/ts/04-filesystems-and-storage.test.ts` to `07-oci-distribution-and-registries.test.ts` | ✅ |
| **D3 Image Construction, BuildKit & Reproducibility** | 20% | LLB graphs, cache invalidation, multi-stage builds, secret/cache mounts, Buildah | Module 08 | `examples/ts/08-building-images-dockerfile-and-buildkit.test.ts` | ✅ |
| **D4 Container Networking, DNS & Rootless Pasta** | 15% | veth pairs, Linux bridges, nftables NAT, DNS resolution, rootless pasta backend | Module 09 | `examples/ts/09-container-networking.test.ts` | ✅ |
| **D5 Daemon vs Daemonless Engines & Compose v5** | 10% | Docker vs Podman architecture, Pods, systemd Quadlet, Compose v5 dependency trees | Modules 10, 11 | `examples/ts/10-docker-vs-podman-buildah-skopeo.test.ts`, `11-compose-in-depth.test.ts` | ✅ |
| **D6 Hardening, Capabilities & Supply-Chain Security** | 15% | Capability bounding, seccomp profiles, Trivy scanning, Cosign signing, SLSA provenance | Module 12 | `examples/ts/12-security-and-supply-chain.test.ts` | ✅ |
