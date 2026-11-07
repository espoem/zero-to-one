# Containers and OCI Runtime Curricula

Verified against Docker Engine 29.9.2, Docker Compose 5.6.1, BuildKit 0.34.1, Podman 6.1.4, Buildah 1.46.0, Skopeo 1.24.1, containerd 2.4.2, runc 1.5.2, crun 1.30.1, OCI Image Spec 1.1.1 / Runtime Spec 1.3.0 / Distribution Spec 1.1.1, Node 26.13.0, TypeScript 7.0.2 on 2026-11-07.

## Overview

This track provides a comprehensive, academically grounded, and production-oriented study of container technologies, Linux kernel primitives, OCI specifications, image construction engines, networking stacks, and supply-chain security mechanisms. Designed for platform engineers, systems architects, and SREs, it bridges the gap between low-level operating system abstractions and high-level orchestrators.

## Prerequisites

Before diving into this track, you should be familiar with foundational concepts covered in:

- [`../../architecture/networking/README.md`](../../architecture/networking/README.md) (TCP/IP sockets, routing, NAT, and Linux network namespaces)
- [`../../architecture/security-identity/README.md`](../../architecture/security-identity/README.md) (PKI, X.509 certificates, capability models, and supply chain security)
- [`../../architecture/data-systems/README.md`](../../architecture/data-systems/README.md) (Storage engines, page caches, write-ahead logs, and file system mechanics)
- [`../nodejs/README.md`](../nodejs/README.md) (Runtime memory management, garbage collection, and signal handling)

## Syllabus

| Module | Title | Core Topics |
| :-- | :-- | :-- |
| [`modules/01-what-a-container-is.md`](modules/01-what-a-container-is.md) | What a Container Is (and Isn't): Isolation Primitives, VMs, and the OCI Stack | Kernel isolation vs virtualization, hypervisors, OCI layering, shim architecture |
| [`modules/02-linux-namespaces.md`](modules/02-linux-namespaces.md) | Linux Namespaces, Process Trees, PID 1 Semantics, and User Namespace Mapping | `clone`, `unshare`, `nsenter`, 8 namespace types, PID 1 zombie reaping, subuid mapping |
| [`modules/03-cgroups-v2.md`](modules/03-cgroups-v2.md) | Control Groups v2: Unified Hierarchy, Resource Controllers, PSI, and OOM Mechanics | Unified tree, `cpu.max`, `memory.max`, Pressure Stall Information,oom_kill events |
| [`modules/04-filesystems-and-storage.md`](modules/04-filesystems-and-storage.md) | Filesystems and Storage: OverlayFS, Snapshotters, Volumes, and Idmapped Mounts | Lower/upper/work layers, whiteouts, copy-up overhead, bind mounts, idmapped mounts |
| [`modules/05-oci-image-spec.md`](modules/05-oci-image-spec.md) | OCI Image Specification: Manifests, Indexes, Content-Addressable Layers, and Referrers | Tar+gzip/zstd layers, descriptors, image index, manifest v1.1 referrers, reproducible builds |
| [`modules/06-oci-runtime-spec-and-runtimes.md`](modules/06-oci-runtime-spec-and-runtimes.md) | OCI Runtime Specification and Runtimes: Bundles, Lifecycle, runc, crun, and Sandboxes | `config.json`, OCI bundle lifecycle, runc (Go) vs crun (C), gVisor, Kata Containers |
| [`modules/07-oci-distribution-and-registries.md`](modules/07-oci-distribution-and-registries.md) | OCI Distribution Specification and Registries: Push/Pull Protocol, Token Auth, and Skopeo | Chunked uploads, manifest pulls, token auth exchange, Skopeo copy/inspect workflows |
| [`modules/08-building-images-dockerfile-and-buildkit.md`](modules/08-building-images-dockerfile-and-buildkit.md) | Building Images with Dockerfile and BuildKit: LLB Graph, Caching, Multi-Stage, and Reproducibility | Low-Level Builder DAG, cache mounts, secret/SSH mounts, multi-stage builds, Buildah |
| [`modules/09-container-networking.md`](modules/09-container-networking.md) | Container Networking: veth Pairs, Bridges, nftables NAT, DNS, and Rootless Pasta | Virtual Ethernet, Linux bridges, nftables forwarding chains, pasta for rootless net |
| [`modules/10-docker-vs-podman-buildah-skopeo.md`](modules/10-docker-vs-podman-buildah-skopeo.md) | Docker versus Podman, Buildah, and Skopeo: Daemonless Architecture, Pods, and Quadlet | Daemonful vs fork-exec daemonless, Podman pods, systemd Quadlet unit integration |
| [`modules/11-compose-in-depth.md`](modules/11-compose-in-depth.md) | Compose Specification in Depth: Dependency Graphs, Profiles, Merging, and Shared Stack Conventions | Compose v5 spec, merge precedence, `depends_on` health conditions, project namespaces |
| [`modules/12-security-and-supply-chain.md`](modules/12-security-and-supply-chain.md) | Container Security and Supply Chain: Capabilities, Seccomp, Rootless, Image Hardening, and Version History | Linux capabilities bounding, seccomp filters, Trivy scanning, Cosign signing, SLSA |

## Out of Scope

- Kubernetes cluster control plane architecture, custom resource definitions (CRDs), and Operator development (covered in `technologies/kubernetes`).
- Linux kernel module development and custom system call implementation (covered in operating systems curricula).
- Advanced BGP routing, MPLS tunnels, and enterprise SDN fabrics (covered in `architecture/networking`).

## Certifications & Exams

This track prepares engineers for professional cloud-native certifications and rigorous infrastructure interviews, aligned with CNCF curriculum specifications:

1. **Certified Kubernetes Application Developer (CKAD)**:
   - **Exam Guide & Curriculum**: [CKAD Guide](https://www.cncf.io/certification/ckad/) and [CNCF Curriculum](https://github.com/cncf/curriculum) (verified 2026-11-07).
   - **Target Version & Status**: Active, targeting Kubernetes v1.37 and OCI container runtimes.
   - **Format & Duration**: Performance-based (15–20 hands-on CLI tasks), 2 hours.
   - **Passing Score**: 66%.
   - **Containers Relevance**: Application Design & Build, multi-stage Dockerfile construction, OCI container image packaging, runtime resource limits, and health checks.

2. **Certified Kubernetes Security Specialist (CKS)**:
   - **Exam Guide & Curriculum**: [CKS Guide](https://www.cncf.io/certification/cks/) and [CNCF Curriculum](https://github.com/cncf/curriculum) (verified 2026-11-07).
   - **Target Version & Status**: Active, targeting Kubernetes v1.34 (Exam Delta documented in `exams/README.md`).
   - **Format & Duration**: Performance-based (15–20 hands-on CLI tasks), 2 hours.
   - **Passing Score**: 67%.
   - **Containers Relevance**: Supply-chain security, container vulnerability scanning (Trivy), image signing and attestation (Cosign), runtime security, Seccomp profiles, AppArmor, Linux capabilities bounding, and user namespace isolation.

3. **Mirantis Docker Certified Associate (DCA)**:
   - **Status**: Legacy / superseded by modern CNCF cloud-native certifications (CKAD/CKS). Legacy Docker daemon-centric concepts are retained in Then vs Now comparisons.

4. **Senior Infrastructure & Platform Engineering Interview Loop**:
   - **Format**: Multi-round system design, Linux systems debugging, and container runtime architecture deep-dives.
   - **Coverage**: OCI runtime specifications, Linux kernel isolation primitives (namespaces, cgroups v2, OverlayFS), rootless networking (pasta), daemonless engines (Podman), and secure software supply chains (SLSA).

## Running the Examples

Ensure you have [mise](https://mise.jdx.dev/) installed. To run tests and typechecks:

```bash
mise install
mise exec -- npm ci
mise exec -- npm test
```
