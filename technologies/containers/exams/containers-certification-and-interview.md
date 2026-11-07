# Certification Preparation Question Bank & Mock Exam: Containers

This document contains 65 original questions covering domains D1 through D6 for container technologies, followed by a full 90-minute mock exam.

## Question Bank (Q-CONT-001 to Q-CONT-065)

### Q-CONT-001 · D1 Linux Kernel Primitives · difficulty 1 · single

Which Linux kernel system call is primarily responsible for creating a new process while allowing selective isolation of global system resource namespaces?

- A) `fork()`
- B) `clone()`
- C) `execve()`
- D) `ptrace()`

<details><summary>Answer</summary>

**B.** `clone()` is the underlying system call in Linux that creates a new process and accepts flags (such as `CLONE_NEWPID`, `CLONE_NEWNET`, `CLONE_NEWNS`) to isolate execution contexts into new namespaces.

- Why not A: `fork()` duplicates an existing process without configuring namespace isolation flags.
- Why not C: `execve()` executes a new program within the existing process space rather than creating a new process/namespace.
- Why not D: `ptrace()` is used for process tracing, debugging, and system call interception.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man2/clone.2.html

</details>

### Q-CONT-002 · D1 Linux Kernel Primitives · difficulty 2 · scenario

An engineer runs a containerized Node.js application where the application process fails to terminate promptly upon receiving `SIGTERM`, resulting in a 10-second timeout before the container runtime issues a forceful `SIGKILL`. What is the primary architectural cause?

- A) The cgroups v2 memory controller has exhausted its swap allowance.
- B) The application is running as PID 1 in the container and lacks signal handlers for `SIGTERM`.
- C) The container filesystem storage driver is using overlayfs copy-up locks.
- D) The OCI runtime spec has disabled capability bounding.

<details><summary>Answer</summary>

**B.** When a process runs as PID 1 in Linux, it does not receive default signal dispositions for POSIX signals like `SIGTERM`. If the application does not explicitly register a signal handler or if a shell wrapper intercepts signals instead of passing them via `exec`, PID 1 ignores `SIGTERM` until the runtime timeout expires.

- Why not A: Memory exhaustion causes OOM termination (exit code 137), not SIGTERM grace period timeouts.
- Why not C: OverlayFS locking affects disk I/O, not process signal delivery.
- Why not D: Capability bounding restricts system call privileges, not signal handling behavior of PID 1.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man7/pid_namespaces.7.html

</details>

### Q-CONT-003 · D1 Linux Kernel Primitives · difficulty 3 · multi

Which of the following namespace types are supported by the Linux kernel for container isolation? (Select all that apply)

- A) `mnt` (Mount namespaces)
- B) `net` (Network namespaces)
- C) `sched` (Scheduler namespaces)
- D) `pid` (Process ID namespaces)
- E) `ipc` (Inter-Process Communication namespaces)

<details><summary>Answer</summary>

**A, B, D, E.** Linux supports mount (`mnt`), network (`net`), process ID (`pid`), IPC (`ipc`), UTS, user (`user`), cgroup, and time namespaces. There is no dedicated `sched` namespace in the Linux kernel.

- Why not C: `sched` is not a Linux namespace type.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man7/namespaces.7.html

</details>

### Q-CONT-004 · D1 Linux Kernel Primitives · difficulty 2 · single

In cgroups v2, which unified control file is used to configure hard CPU bandwidth limits (quota and period)?

- A) `cpu.weight`
- B) `cpu.max`
- C) `cpu.shares`
- D) `cpu.stat`

<details><summary>Answer</summary>

**B.** `cpu.max` in cgroups v2 contains two values: quota and period (e.g., `100000 100000` limits the cgroup to 1 CPU core equivalent per 100ms period).

- Why not A: `cpu.weight` replaces cgroups v1 `cpu.shares` for proportional weight-based CPU allocation.
- Why not C: `cpu.shares` was used in cgroups v1 and is deprecated in cgroups v2.
- Why not D: `cpu.stat` provides read-only usage statistics and throttling counters, not configuration limits.
- Ref: [modules/03-cgroups-v2.md](../modules/03-cgroups-v2.md), https://docs.kernel.org/admin-guide/cgroup-v2.html

</details>

### Q-CONT-005 · D1 Linux Kernel Primitives · difficulty 2 · hands-on

You are debugging a container that crashes unexpectedly under heavy load with exit code 137. Which kernel mechanism and diagnostic file should you inspect first?

- A) `memory.events` in the cgroup v2 directory to verify `oom_kill` increments.
- B) `/var/log/messages` for ext4 filesystem journal corruption errors.
- C) `net.ipv4.tcp_rmem` for socket buffer exhaustion.
- D) `/proc/sys/kernel/pid_max` for process table limits.

<details><summary>Answer</summary>

**A.** Exit code 137 indicates termination by SIGKILL (9). In containers, this is most frequently caused by the kernel OOM killer when memory exceeds `memory.max`. Inspecting `memory.events` shows the exact `oom_kill` counter.

- Why not B: Filesystem journaling errors cause I/O lockups or read-only remounts, not standard container exit 137.
- Why not C: Socket buffer issues result in connection drops or network timeouts, not process exit 137.
- Why not D: Exceeding `pid_max` causes `fork()` failures with `EAGAIN`, not sudden container termination.
- Ref: [modules/03-cgroups-v2.md](../modules/03-cgroups-v2.md), https://docs.kernel.org/admin-guide/cgroup-v2.html

</details>

### Q-CONT-006 · D1 Linux Kernel Primitives · difficulty 1 · single

What does Pressure Stall Information (PSI) measure in the Linux kernel?

- A) Physical temperature and voltage fluctuations of CPU sockets.
- B) The percentage of time tasks are stalled waiting for CPU, memory, or I/O resources.
- C) Network packet drop rates on virtual ethernet bridges.
- D) Inode allocation counts on overlayfs filesystems.

<details><summary>Answer</summary>

**B.** PSI metrics measure resource scarcity by quantifying the percentage of time worker tasks are stalled waiting for CPU, memory, or I/O availability.

- Why not A: Hardware thermal monitoring is handled by `lm-sensors`, not kernel PSI.
- Why not C: Packet drops are tracked via network interface counters (`ip -s link`).
- Why not D: Inode counts are retrieved via filesystem statistics (`statvfs`).
- Ref: [modules/03-cgroups-v2.md](../modules/03-cgroups-v2.md), https://docs.kernel.org/admin-guide/accounting/psi.html

</details>

### Q-CONT-007 · D1 Linux Kernel Primitives · difficulty 2 · scenario

A container running with unprivileged user namespaces maps UID 0 inside the container to UID 100000 on the host. When a file is created inside the container, what is its ownership on the host filesystem?

- A) UID 0 (root)
- B) UID 100000
- C) UID 65534 (nobody)
- D) UID -1 (overflow)

<details><summary>Answer</summary>

**B.** User namespace mapping translates UIDs. UID 0 inside the container maps to the starting UID of the subuid range assigned on the host (e.g., 100000).

- Why not A: Unprivileged user namespaces prevent container root from possessing real host root privileges.
- Why not C: UID 65534 is used for unmapped overflow operations, not successfully mapped container root files.
- Why not D: UID -1 is invalid for filesystem object ownership.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man7/user_namespaces.7.html

</details>

### Q-CONT-008 · D1 Linux Kernel Primitives · difficulty 1 · single

Which file in `/proc/<pid>/` contains the UID mapping table for a process's user namespace?

- A) `uid_map`
- B) `user_id`
- C) `credentials`
- D) `ns_map`

<details><summary>Answer</summary>

**A.** `/proc/<pid>/uid_map` (and `gid_map`) defines the mapping of user IDs between the process's user namespace and its parent namespace.

- Why not B, C, D: These are not valid procfs paths for namespace user mappings.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man7/user_namespaces.7.html

</details>

### Q-CONT-009 · D1 Linux Kernel Primitives · difficulty 3 · ordering

Order the following steps taken by the Linux kernel when creating a new process with `clone()` using `CLONE_NEWPID`:

1. The new process becomes PID 1 within its newly created PID namespace.
2. The `clone()` system call is invoked with the `CLONE_NEWPID` flag.
3. The process retains its original PID in the parent (host) PID namespace.

- A) 2 -> 3 -> 1
- B) 2 -> 1 -> 3
- C) 1 -> 2 -> 3
- D) 3 -> 2 -> 1

<details><summary>Answer</summary>

**A.** First, `clone()` is invoked with `CLONE_NEWPID` (2). The newly created process is assigned a PID in the parent namespace (3), and within the new child PID namespace, it is allocated PID 1 (1).

- Why not B, C, D: Incorrect chronological order of kernel allocation.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man7/pid_namespaces.7.html

</details>

### Q-CONT-010 · D1 Linux Kernel Primitives · difficulty 2 · single

What is the primary role of an init process (such as `tini`) when running as PID 1 inside a container?

- A) Managing cgroups v2 unified resource limits.
- B) Reaping zombie processes (orphan processes whose parent terminated) and forwarding signals correctly.
- C) Providing cryptographic key rotation for TLS termination.
- D) Translating OCI image manifests into OCI runtime bundles.

<details><summary>Answer</summary>

**B.** PID 1 is responsible for reaping adopted zombie processes and forwarding signals to child processes. Standard application runtimes often fail to handle these init responsibilities, leading to memory leaks from orphaned zombie processes.

- Why not A: Cgroups are managed by the host kernel and runtime, not PID 1.
- Why not C: TLS key rotation is handled by application-level logic or secret managers.
- Why not D: OCI bundles are prepared by container engines (Docker/Podman), not container init processes.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://github.com/krallin/tini

</details>

### Q-CONT-011 · D1 Linux Kernel Primitives · difficulty 2 · multi

Which cgroups v2 controllers are commonly enabled by container runtimes to manage resource isolation? (Select all that apply)

- A) `cpu`
- B) `memory`
- C) `io`
- D) `pids`
- E) `net_cls`

<details><summary>Answer</summary>

**A, B, C, D.** The `cpu`, `memory`, `io`, and `pids` controllers are standard cgroups v2 controllers used to restrict CPU bandwidth, RAM consumption, block I/O bandwidth, and maximum process counts. `net_cls` is a legacy cgroups v1 network classifier.

- Why not E: `net_cls` belongs to cgroups v1 and is not part of the standard cgroups v2 controller set.
- Ref: [modules/03-cgroups-v2.md](../modules/03-cgroups-v2.md), https://docs.kernel.org/admin-guide/cgroup-v2.html

</details>

### Q-CONT-012 · D1 Linux Kernel Primitives · difficulty 1 · single

What happens when a cgroup exceeds its configured `pids.max` limit in cgroups v2?

- A) The kernel triggers a system-wide kernel panic.
- B) Subsequent `fork()` or `clone()` system calls fail with `EAGAIN`.
- C) The oldest process in the cgroup receives `SIGKILL`.
- D) The container's network interface is automatically throttled.

<details><summary>Answer</summary>

**B.** When `pids.max` is reached, any attempt by the process tree to create a new process via `fork()` or `clone()` fails with the `EAGAIN` error code.

- Why not A: Process limits do not trigger kernel panics.
- Why not C: Process limits restrict creation (`EAGAIN`), they do not actively kill existing processes unless OOM memory limits are reached.
- Why not D: PID limits do not throttle network traffic.
- Ref: [modules/03-cgroups-v2.md](../modules/03-cgroups-v2.md), https://docs.kernel.org/admin-guide/cgroup-v2.html

</details>

### Q-CONT-013 · D1 Linux Kernel Primitives · difficulty 2 · scenario

An administrator notices high CPU throttling (`cpu.stat` throttling metrics increasing) in a container despite `cpu.max` being set to `500000 100000` (5 CPU cores). What is the most likely root cause?

- A) The application is spawning thousands of threads, causing CFS scheduler contention and context-switching overhead.
- B) The container storage driver is using ext4 instead of OverlayFS.
- C) The container network namespace has too many veth pairs attached.
- D) The OCI image manifest is missing content-addressable digests.

<details><summary>Answer</summary>

**A.** Even with high CPU quotas, applications spawning excessive threads can trigger CFS scheduler throttling due to lock contention, context switching, and thread synchronization overhead within the assigned period.

- Why not B: Storage drivers affect disk I/O, not CPU scheduler throttling.
- Why not C: Network interfaces affect packet processing, not CPU quota calculations.
- Why not D: Image manifests are static metadata and do not impact runtime CPU scheduling.
- Ref: [modules/03-cgroups-v2.md](../modules/03-cgroups-v2.md), https://docs.kernel.org/admin-guide/cgroup-v2.html

</details>

### Q-CONT-014 · D2 Storage, OverlayFS & OCI Specifications · difficulty 1 · single

Which OverlayFS directory layer stores modifications, new files, and deletions made by a running container?

- A) `lowerdir`
- B) `upperdir`
- C) `workdir`
- D) `merged`

<details><summary>Answer</summary>

**B.** The `upperdir` is the read-write layer where all new files, modifications, and deletion markers (whiteouts) are stored.

- Why not A: `lowerdir` contains read-only image layers.
- Why not C: `workdir` is an internal scratch directory used by OverlayFS for atomic copy operations.
- Why not D: `merged` is the unified view directory presented to the container.
- Ref: [modules/04-filesystems-and-storage.md](../modules/04-filesystems-and-storage.md), https://docs.kernel.org/filesystems/overlayfs.html

</details>

### Q-CONT-015 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · scenario

When a file located in a read-only lower image layer is modified inside a container, OverlayFS performs a "copy-up" operation. What does this operation entail?

- A) Copying the file from the lower layer to the upper layer before applying the modification.
- B) Moving the file permanently from the lower layer to the upper layer, removing it from the image.
- C) Creating a symlink in the upper layer pointing to the read-only file in the lower layer.
- D) Re-indexing the content-addressable storage manifest in the OCI registry.

<details><summary>Answer</summary>

**A.** The copy-up operation copies the file from the read-only `lowerdir` to the read-write `upperdir` on first write, allowing subsequent modifications to occur in the upper layer without altering the shared base image.

- Why not B: Lower layers are read-only and cannot be modified or have files removed directly; deletions are handled via whiteout files.
- Why not C: Modifying a file requires a physical copy to the upper layer, not a symlink.
- Why not D: OCI registries are not involved in local runtime filesystem operations.
- Ref: [modules/04-filesystems-and-storage.md](../modules/04-filesystems-and-storage.md), https://docs.kernel.org/filesystems/overlayfs.html

</details>

### Q-CONT-016 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · multi

Which components are mandated by the OCI Image Specification v1.1? (Select all that apply)

- A) Image Manifest
- B) Image Configuration JSON
- C) Kubernetes Deployment YAML
- D) Content-Addressable Layer Tarballs
- E) Helm Chart Archive

<details><summary>Answer</summary>

**A, B, D.** The OCI Image Specification defines the Image Manifest, Image Configuration JSON, and content-addressable layer tarballs (or blobs). Kubernetes YAMLs and Helm charts belong to orchestration specifications, not image specs.

- Why not C, E: Kubernetes YAML and Helm charts are orchestrator concepts outside the OCI Image Spec.
- Ref: [modules/05-oci-image-spec.md](../modules/05-oci-image-spec.md), https://github.com/opencontainers/image-spec

</details>

### Q-CONT-017 · D2 Storage, OverlayFS & OCI Specifications · difficulty 1 · single

What is the primary benefit of content-addressable storage (CAS) in OCI container registries?

- A) Files can be renamed dynamically without changing their URLs.
- B) Data integrity is cryptographically guaranteed by hashing layer contents, preventing tampering or corruption.
- C) Storage encryption keys are automatically rotated every 24 hours.
- D) Registry bandwidth is compressed using proprietary binary algorithms.

<details><summary>Answer</summary>

**B.** Content-addressable storage identifies blobs by their cryptographic hash (e.g., SHA-256), ensuring that any data corruption or tampering is immediately detectable and layers can be safely shared across different images.

- Why not A: Content hashes change if file content changes, making renaming irrelevant to the address.
- Why not C: Encryption key rotation is a storage management feature, not CAS itself.
- Why not D: Compression uses standard algorithms (gzip, zstd), not proprietary ones tied to CAS.
- Ref: [modules/05-oci-image-spec.md](../modules/05-oci-image-spec.md), https://github.com/opencontainers/image-spec

</details>

### Q-CONT-018 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · single

What does the OCI Runtime Specification file `config.json` describe for a container bundle?

- A) The cloud infrastructure provider network topology.
- B) The complete machine-independent execution specification, including namespaces, mounts, environment variables, and resource limits.
- C) The CI/CD pipeline build stages and test runners.
- D) The TLS certificates required for registry authentication.

<details><summary>Answer</summary>

**B.** The `config.json` file defined by the OCI Runtime Specification contains all parameters required by an OCI runtime (such as runc or crun) to instantiate a container bundle, including namespace configurations, rootfs paths, process arguments, and device permissions.

- Why not A, C, D: These are outside the scope of the OCI runtime bundle specification.
- Ref: [modules/06-oci-runtime-spec-and-runtimes.md](../modules/06-oci-runtime-spec-and-runtimes.md), https://github.com/opencontainers/runtime-spec

</details>

### Q-CONT-019 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · scenario

An engineering team wants to compare runc (implemented in Go) and crun (implemented in C) for a high-density serverless function platform spawning thousands of short-lived containers per second. Which runtime is better suited and why?

- A) runc, because Go garbage collection optimizes memory usage under high concurrency.
- B) crun, because its C implementation and lower memory footprint per container enable faster startup times and higher container density.
- C) runc, because it natively integrates with systemd Quadlet units without external wrappers.
- D) crun, because it requires cgroups v1 and disallows cgroups v2.

<details><summary>Answer</summary>

**B.** crun is written in C with minimal memory overhead and zero garbage collection pauses, making it significantly faster and more resource-efficient for high-density, short-lived container workloads compared to Go-based runc.

- Why not A: Go runtime initialization and GC overhead make runc heavier for sub-millisecond container lifecycles.
- Why not C: Both runc and crun can integrate with systemd/Quadlet.
- Why not D: crun fully supports cgroups v2 (and cgroups v1 is deprecated/removed in modern stacks).
- Ref: [modules/06-oci-runtime-spec-and-runtimes.md](../modules/06-oci-runtime-spec-and-runtimes.md), https://github.com/containers/crun

</details>

### Q-CONT-020 · D2 Storage, OverlayFS & OCI Specifications · difficulty 1 · single

Which OCI specification defines the REST API protocol for pushing and pulling container images and artifacts between clients and registries?

- A) OCI Image Specification
- B) OCI Runtime Specification
- C) OCI Distribution Specification
- D) OCI Artifacts Specification

<details><summary>Answer</summary>

**C.** The OCI Distribution Specification defines the standardized HTTP/1.1 REST API endpoints and authentication flows required for interacting with container registries.

- Why not A: Image spec defines the format of images on disk and in transit.
- Why not B: Runtime spec defines local execution bundles.
- Why not D: Artifacts are covered under image and distribution extensions (like OCI 1.1 referrers).
- Ref: [modules/07-oci-distribution-and-registries.md](../modules/07-oci-distribution-and-registries.md), https://github.com/opencontainers/distribution-spec

</details>

### Q-CONT-021 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · hands-on

You need to copy an OCI container image directly from an insecure internal registry to a tar archive without running a container daemon or pulling the image into a local Docker storage engine. Which tool should you use?

- A) `docker pull` followed by `docker save`
- B) `skopeo copy docker://internal.registry/app:latest oci:/tmp/app-oci`
- C) `buildah push app:latest tar:/tmp/app.tar`
- D) `kubectl cp`

<details><summary>Answer</summary>

**B.** Skopeo is a daemonless utility specifically designed to inspect, copy, and convert container images between registries, OCI layouts, and tar archives without needing a container engine daemon.

- Why not A: `docker pull`/`save` requires a running Docker daemon and local storage engine.
- Why not C: Buildah is for building images, not arbitrary registry-to-archive copying.
- Why not D: `kubectl cp` copies files into/out of running Kubernetes pods.
- Ref: [modules/07-oci-distribution-and-registries.md](../modules/07-oci-distribution-and-registries.md), https://github.com/containers/skopeo

</details>

### Q-CONT-022 · D2 Storage, OverlayFS & OCI Specifications · difficulty 3 · multi

What features were introduced in OCI Distribution Specification v1.1? (Select all that apply)

- A) The Referrers API for associating signatures and SBOMs directly with image digests
- B) Support for unauthenticated anonymous root access across all enterprise registries
- C) Chunked monolithic blob uploads with resumable sessions
- D) Standardized error response codes for registry operations
- E) Automatic conversion of OCI images to virtual machine disk images (AMI/QCOW2)

<details><summary>Answer</summary>

**A, C, D.** OCI Distribution Spec v1.1 introduced the Referrers API for detached artifacts (signatures, SBOMs), standardized chunked upload enhancements, and clear REST error response codes.

- Why not B: Registries retain fine-grained access control and token authentication.
- Why not E: OCI distribution does not convert images to VM disk formats.
- Ref: [modules/07-oci-distribution-and-registries.md](../modules/07-oci-distribution-and-registries.md), https://github.com/opencontainers/distribution-spec

</details>

### Q-CONT-023 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · scenario

An automated security audit flags that an image layer contains sensitive database credentials that were added in an intermediate `RUN` instruction and subsequently deleted in a later `RUN` instruction within the same Dockerfile. Why are the credentials still present in the final image?

- A) OverlayFS lowerdir synchronization failed.
- B) Each Dockerfile instruction creates an immutable image layer; deleting a file in a later layer merely adds a whiteout marker, while the original file remains fully recoverable in the preceding layer blob.
- C) The OCI runtime spec mandates retaining all build arguments in runtime memory.
- D) BuildKit caching disabled layer compaction.

<details><summary>Answer</summary>

**B.** Container image layers are immutable tar archives. Deleting a file in a subsequent instruction adds a whiteout file in the new layer, but the original file data remains fully present and accessible in the blob history of the earlier layer.

- Why not A: OverlayFS is a runtime union filesystem, not build-time image layering.
- Why not C: Runtime specs do not dictate image build-layer contents.
- Why not D: BuildKit caching accelerates builds, but immutability of layers is a fundamental property of OCI image construction.
- Ref: [modules/05-oci-image-spec.md](../modules/05-oci-image-spec.md), https://docs.docker.com/reference/dockerfile/

</details>

### Q-CONT-024 · D2 Storage, OverlayFS & OCI Specifications · difficulty 1 · single

What is an idmapped mount in Linux VFS?

- A) A network routing table mapping IP addresses to container virtual interfaces.
- B) A mount feature that translates UIDs and GIDs on the fly for files accessed through a mount point without altering on-disk inode ownership.
- C) A cgroups v2 controller for tracking memory page allocations.
- D) A security profile restricting system calls via seccomp.

<details><summary>Answer</summary>

**B.** Idmapped mounts allow filesystem mounts to translate UIDs and GIDs dynamically between host and container contexts without rewriting ownership metadata on every file on disk.

- Why not A, C, D: Idmapped mounts are a Virtual Filesystem (VFS) feature for user ID translation, not networking or cgroups.
- Ref: [modules/04-filesystems-and-storage.md](../modules/04-filesystems-and-storage.md), https://kernelnewbies.org/Linux_5.12#Idmapped_mounts

</details>

### Q-CONT-025 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · single

What is the role of an OCI Image Index (manifest list)?

- A) To store application logs generated by container stdout.
- B) To aggregate multiple architecture-specific image manifests into a single reference so clients can automatically pull the correct binary for their CPU architecture and OS.
- C) To index database transactions inside container volumes.
- D) To map network ports to container IP addresses.

<details><summary>Answer</summary>

**B.** An image index (manifest list) acts as a pointer pointing to multiple platform-specific manifests (e.g., linux/amd64, linux/arm64), enabling multi-architecture distribution under a single tag.

- Why not A, C, D: Image indices manage multi-arch image references, not logs, DB transactions, or port mappings.
- Ref: [modules/05-oci-image-spec.md](../modules/05-oci-image-spec.md), https://github.com/opencontainers/image-spec

</details>

### Q-CONT-026 · D3 Image Construction, BuildKit & Reproducibility · difficulty 1 · single

What underlying graph representation does BuildKit use to optimize, parallelize, and cache container image builds?

- A) Directed Acyclic Graph (DAG) of Low-Level Builder (LLB) operations.
- B) Relational SQL database schema.
- C) FIFO message queue.
- D) Red-Black tree of file inodes.

<details><summary>Answer</summary>

**A.** BuildKit compiles Dockerfiles into a Low-Level Builder (LLB) Directed Acyclic Graph (DAG), enabling concurrent execution of independent build steps and fine-grained cache tracking.

- Why not B, C, D: BuildKit relies on content-addressable DAGs for dependency resolution, not SQL DBs, queues, or binary trees.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://github.com/moby/buildkit

</details>

### Q-CONT-027 · D3 Image Construction, BuildKit & Reproducibility · difficulty 2 · scenario

An engineering team notices that adding a project README file change to their repository root invalidates the dependency cache of their Node.js application container build, even though `package.json` was unchanged. What is the root cause in the Dockerfile?

- A) Using `COPY . .` before `RUN npm ci`.
- B) Using multi-stage builds incorrectly.
- C) Setting `ENV NODE_ENV=production` in the first layer.
- D) Using BuildKit cache mounts (`--mount=type=cache`).

<details><summary>Answer</summary>

**A.** When `COPY . .` copies the entire repository context before running dependency installation (`npm ci`), any file change in the repository (including a README) alters the checksum of the copy operation, invalidating all subsequent instruction cache keys.

- Why not B: Multi-stage builds isolate build artifacts, but incorrect copy ordering still invalidates stages.
- Why not C: Environment variables invalidate cache only if their values change.
- Why not D: Cache mounts preserve package manager caches across builds, they do not cause instruction invalidation.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://docs.docker.com/build/building/best-practices/

</details>

### Q-CONT-028 · D3 Image Construction, BuildKit & Reproducibility · difficulty 3 · multi

Which BuildKit Dockerfile extensions enhance security and build performance during `RUN` instructions? (Select all that apply)

- A) `--mount=type=cache` for preserving package manager caches
- B) `--mount=type=secret` for injecting sensitive credentials without persisting them in image layers
- C) `--mount=type=ssh` for forwarding SSH agent authentication securely during git clones
- D) `--privileged` flag directly inside the Dockerfile `RUN` instruction
- E) Heredoc syntax for multi-line shell scripts (`RUN <<EOF ... EOF`)

<details><summary>Answer</summary>

**A, B, C, E.** BuildKit supports cache mounts, secret mounts, SSH agent forwarding, and heredocs natively. The `--privileged` flag is a runtime container flag, not a valid Dockerfile mount instruction.

- Why not D: `--privileged` cannot be passed as a Dockerfile instruction flag.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://docs.docker.com/reference/dockerfile/

</details>

### Q-CONT-029 · D3 Image Construction, BuildKit & Reproducibility · difficulty 2 · single

How does setting the `SOURCE_DATE_EPOCH` environment variable during a container image build improve reproducibility?

- A) It encrypts all image layers with a time-based symmetric key.
- B) It forces file modification timestamps (mtime) across all generated files inside layers to a fixed epoch timestamp, ensuring identical binary output hashes.
- C) It restricts container execution to specific calendar dates.
- D) It synchronizes container system clocks with NIST atomic clocks.

<details><summary>Answer</summary>

**B.** `SOURCE_DATE_EPOCH` standardizes file modification timestamps across tar archive creation, preventing non-reproducible binary hashes caused by variable build timestamps (`mtime`).

- Why not A, C, D: It affects file timestamps for reproducible builds, not encryption, execution dates, or atomic clock sync.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://reproducible-builds.org/docs/source-date-epoch/

</details>

### Q-CONT-030 · D3 Image Construction, BuildKit & Reproducibility · difficulty 2 · hands-on

You are building multi-architecture container images (`linux/amd64` and `linux/arm64`) on an Apple Silicon (ARM64) host. When building for `amd64`, the build runs noticeably slower and occasionally encounters emulator faults. What technology is BuildKit utilizing under the hood, and how can performance be optimized?

- A) Kernel-level kvm virtualization; optimize by disabling cgroups v2.
- B) QEMU user-mode emulation; optimize by using remote native builder nodes or cross-compilation toolchains.
- C) OverlayFS union mounts; optimize by increasing upperdir size.
- D) Containerd shim v2; optimize by switching from runc to crun.

<details><summary>Answer</summary>

**B.** Building cross-architecture images on foreign hosts relies on QEMU user-mode emulation, which incurs performance overhead and emulation edge cases. Performance is optimized by delegating builds to native builder nodes for each architecture or utilizing native cross-compilers.

- Why not A, C, D: QEMU emulation is the standard mechanism for cross-arch emulation in buildx, resolved via native builders.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://docs.docker.com/build/building/multi-platform/

</details>

### Q-CONT-031 · D3 Image Construction, BuildKit & Reproducibility · difficulty 1 · single

What is the primary advantage of using multi-stage builds in Dockerfiles?

- A) They allow running multiple container daemons simultaneously on the same host.
- B) They enable separating build-time dependencies (compilers, SDKs) from the final production runtime image, drastically reducing attack surface and image size.
- C) They automatically generate Kubernetes YAML deployment manifests.
- D) They bypass OCI registry authentication token exchange.

<details><summary>Answer</summary>

**B.** Multi-stage builds let developers use heavy toolchain images to compile applications, then copy only the compiled binary into a minimal runtime base image (such as distroless or scratch), eliminating unnecessary build tools and reducing vulnerabilities.

- Why not A, C, D: Multi-stage builds are strictly for separating build steps and minimizing production image size.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://docs.docker.com/build/building/multi-stage/

</details>

### Q-CONT-032 · D3 Image Construction, BuildKit & Reproducibility · difficulty 2 · scenario

An engineer writes a Dockerfile instruction as `ENTRYPOINT npm start`. When the container runs, shell signal handling fails. How should this be corrected to ensure the application receives `SIGTERM` directly?

- A) Change to exec form: `ENTRYPOINT ["npm", "start"]`
- B) Change to background execution: `ENTRYPOINT npm start &`
- C) Remove the ENTRYPOINT and use `USER root`
- D) Enable cgroups v1 resource controllers

<details><summary>Answer</summary>

**A.** Shell form (`ENTRYPOINT npm start`) executes the command inside a `/bin/sh -c` shell wrapper, making the shell PID 1 and preventing signals from reaching the Node.js process directly. Exec form (`ENTRYPOINT ["npm", "start"]`) executes the binary directly as PID 1 (or child process), receiving signals correctly.

- Why not B: Background execution adds job control complexity, not signal correctness.
- Why not C: User selection does not fix shell wrapper signal interception.
- Why not D: Cgroups control resources, not Dockerfile instruction parsing syntax.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://docs.docker.com/reference/dockerfile/#entrypoint

</details>

### Q-CONT-033 · D4 Container Networking, DNS & Rootless Pasta · difficulty 1 · single

What kernel networking abstraction connects a container's network namespace to a host bridge or routing table?

- A) Netfilter iptables chains
- B) Virtual Ethernet (`veth`) pairs
- C) Loopback devices (`lo`)
- D) BGP routing tables

<details><summary>Answer</summary>

**B.** A `veth` pair consists of two virtual network interfaces that act as a bidirectional pipe: one interface resides in the container network namespace, and the other connects to the host bridge or network stack.

- Why not A: iptables/nftables handle packet filtering and NAT, not physical/virtual wire connection.
- Why not C: Loopback interfaces handle local intra-namespace communication.
- Why not D: BGP operates at inter-domain routing layers.
- Ref: [modules/09-container-networking.md](../modules/09-container-networking.md), https://man7.org/linux/man-pages/man4/veth.4.html

</details>

### Q-CONT-034 · D4 Container Networking, DNS & Rootless Pasta · difficulty 2 · scenario

A security engineer discovers that a container port published with `docker run -p 80:80` is accessible from external networks even though the host firewall (`ufw` / `firewalld`) has explicit rules blocking port 80. What is the root cause?

- A) Docker inserts iptables/nftables forwarding rules into the `PREROUTING` and `DOCKER` chains **ahead of** user-defined firewall rules.
- B) The container is using host network mode.
- C) The OCI distribution spec mandates public port binding.
- D) The overlayfs storage driver bypassed the network stack.

<details><summary>Answer</summary>

**A.** Docker inserts its NAT and port-forwarding rules into the Linux netfilter tables before UFW/firewalld rules are evaluated, effectively bypassing standard host firewall rules unless traffic is filtered via the `DOCKER-USER` iptables chain.

- Why not B: Host network mode binds directly to host interfaces, but the port-publishing behavior occurs via Docker's netfilter integration for bridged networks.
- Why not C, D: OCI distribution and overlayfs have no role in host packet filtering.
- Ref: [modules/09-container-networking.md](../modules/09-container-networking.md), https://docs.docker.com/network/packet-filtering-firewalls/

</details>

### Q-CONT-035 · D4 Container Networking, DNS & Rootless Pasta · difficulty 2 · multi

Which networking technologies are utilized in modern rootless container environments (such as Podman 6) for guest-to-host connectivity without root privileges? (Select all that apply)

- A) `pasta` (Peer-to-Peer PASST)
- B) `slirp4netns` (deprecated/removed in Podman 6)
- C) Direct kernel tap device creation without user namespaces (requires root)
- D) `macvlan` network attachments requiring physical switch trunking
- E) Slirp user-mode networking integration

<details><summary>Answer</summary>

**A, B, E.** Rootless containers rely on user-mode networking backends like `pasta` (the modern standard in Podman 6), legacy `slirp4netns`, and user-mode slirp stacks to forward packets without root privileges.

- Why not C: Creating host tap devices requires root privileges.
- Why not D: `macvlan` requires direct physical interface attachment with root privileges.
- Ref: [modules/09-container-networking.md](../modules/09-container-networking.md), https://github.com/containers/podman/blob/main/docs/tutorials/socket_activation.md

</details>

### Q-CONT-036 · D4 Container Networking, DNS & Rootless Pasta · difficulty 1 · single

What is the primary function of Netavark in Podman?

- A) Providing OCI image signing and verification.
- B) Acting as the core network stack manager for configuring container interfaces, bridges, and firewall rules.
- C) Managing overlayfs lower/upper storage layer compaction.
- D) Compiling Dockerfile instructions into LLB graphs.

<details><summary>Answer</summary>

**B.** Netavark is a rust-based network stack manager used by Podman to configure container network interfaces, bridges, and firewall (nftables) rules, replacing older CNI plugins.

- Why not A, C, D: Netavark is strictly for container networking, not signing, storage, or image builds.
- Ref: [modules/09-container-networking.md](../modules/09-container-networking.md), https://github.com/containers/netavark

</details>

### Q-CONT-037 · D4 Container Networking, DNS & Rootless Pasta · difficulty 2 · scenario

Two containers attached to a user-defined bridge network in Docker need to communicate with each other using their container names as hostnames. How does Docker resolve these names?

- A) Through external public DNS servers configured in `/etc/resolv.conf`.
- B) Through an internal embedded DNS server managed by the Docker daemon that intercepts DNS queries on `127.0.0.11`.
- C) By broadcasting ARP packets across the physical host interface.
- D) By modifying the host's `/etc/hosts` file dynamically.

<details><summary>Answer</summary>

**B.** User-defined networks in Docker feature built-in automatic service discovery via an embedded DNS server residing at `127.0.0.11` inside the container network namespace.

- Why not A: External public DNS servers do not know internal Docker container names.
- Why not C: ARP resolves MAC addresses, not container hostname discovery.
- Why not D: Host `/etc/hosts` is not modified for container-to-container discovery.
- Ref: [modules/09-container-networking.md](../modules/09-container-networking.md), https://docs.docker.com/engine/network/drivers/bridge/#networking-with-standalone-containers

</details>

### Q-CONT-038 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 1 · single

What is the fundamental architectural difference between Docker and Podman regarding process management?

- A) Docker uses a central daemon (`dockerd`) to manage containers, whereas Podman is daemonless and uses fork-exec models directly via container runtimes.
- B) Podman requires a kernel module loaded at boot, whereas Docker runs entirely in userspace.
- C) Docker supports Windows containers exclusively, whereas Podman supports Linux exclusively.
- D) Podman relies on Kubernetes for all single-node container operations.

<details><summary>Answer</summary>

**A.** Docker relies on a central background daemon (`dockerd`) to handle API requests and orchestrate container lifecycles. Podman is daemonless; each command is a standalone client process that interacts directly with storage, networking, and runtimes.

- Why not B: Neither requires special kernel modules beyond standard container primitives.
- Why not C: Both support Linux container execution.
- Why not D: Podman operates independently of Kubernetes, though it supports generating K8s YAMLs (`podman kube generate`).
- Ref: [modules/10-docker-vs-podman-buildah-skopeo.md](../modules/10-docker-vs-podman-buildah-skopeo.md), https://podman.io/

</details>

### Q-CONT-039 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 2 · multi

Which features are unique or prominent in Podman compared to traditional Docker? (Select all that apply)

- A) Native support for Pods (groups of containers sharing namespaces)
- B) Daemonless architecture eliminating single-point-of-failure daemon crashes
- C) Integration with systemd via Quadlet for declarative container service management
- D) Exclusive reliance on the Mirantis Docker Swarm orchestrator
- E) Rootless-first design utilizing user namespaces by default

<details><summary>Answer</summary>

**A, B, C, E.** Podman supports Pods, operates daemonless, integrates with systemd via Quadlet, and is designed rootless-first. Podman does not use Docker Swarm.

- Why not D: Podman does not use Docker Swarm; it supports K8s-compatible manifests.
- Ref: [modules/10-docker-vs-podman-buildah-skopeo.md](../modules/10-docker-vs-podman-buildah-skopeo.md), https://podman.io/

</details>

### Q-CONT-040 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 2 · scenario

An administrator wants to manage a Podman container as a native systemd service on a RHEL 9 server without writing manual complex systemd service unit files. Which feature should they use?

- A) Docker Swarm overlay networks
- B) Podman Quadlet (`.container` unit files in `/etc/containers/systemd/`)
- C) Kubernetes Helm charts
- D) BuildKit LLB graph compilation

<details><summary>Answer</summary>

**B.** Quadlet is Podman's systemd integration feature that reads declarative `.container` (and `.pod`, `.volume`) configuration files and automatically generates and manages native systemd service units at boot.

- Why not A, C, D: Docker Swarm, Helm, and BuildKit do not generate native systemd units for Podman.
- Ref: [modules/10-docker-vs-podman-buildah-skopeo.md](../modules/10-docker-vs-podman-buildah-skopeo.md), https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html

</details>

### Q-CONT-041 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 1 · single

In Docker Compose v5, how do you ensure that a dependent database container is fully ready to accept connections before starting the dependent API application container?

- A) Setting `restart: always` on the API service.
- B) Using `depends_on` with `condition: service_healthy` coupled with a container healthcheck.
- C) Increasing `cpu.weight` limits in cgroups.
- D) Specifying `network_mode: host`.

<details><summary>Answer</summary>

**B.** Compose supports healthcheck-based dependency sequencing using `depends_on` with `condition: service_healthy`, ensuring the dependent service waits until the healthcheck passes successfully.

- Why not A: Restart policies govern crash recovery, not startup sequencing.
- Why not C, D: Resource weights and network modes do not sequence application startup health.
- Ref: [modules/11-compose-in-depth.md](../modules/11-compose-in-depth.md), https://docs.docker.com/compose/compose-file/compose-file-v3/#depends_on

</details>

### Q-CONT-042 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 2 · scenario

An engineer deploys multiple distinct multi-container applications on the same server using Docker Compose, but service names collide across projects. How does Compose prevent container naming collisions?

- A) By prepending the project name (derived from the parent directory or `-p` flag) to container names.
- B) By assigning random cryptographic UUIDs to every container network namespace.
- C) By requiring manual port offset configurations in every `docker-compose.yaml` file.
- D) By enforcing global singleton locks on the Docker socket.

<details><summary>Answer</summary>

**A.** Compose prefixes container names with the project name (e.g., `myproject_web_1`), allowing multiple distinct stacks to run simultaneously without resource name collisions.

- Why not B, C, D: Project namespacing handles container naming isolation automatically.
- Ref: [modules/11-compose-in-depth.md](../modules/11-compose-in-depth.md), https://docs.docker.com/compose/

</details>

### Q-CONT-043 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 2 · multi

Which mechanisms are supported in Compose specification files for assembling and reusing multi-container stacks? (Select all that apply)

- A) `include` directive for importing external compose files
- B) Environment variable interpolation (`${VAR:-default}`)
- C) Profiles for selectively enabling or disabling services during deployment
- D) Direct kernel compilation directives within YAML services
- E) Override files (`docker-compose.override.yaml`) for merging configuration layers

<details><summary>Answer</summary>

**A, B, C, E.** Compose supports file inclusion (`include`), environment variable interpolation, deployment profiles, and override merging. It does not perform kernel compilation.

- Why not D: Kernel compilation is handled by host operating system tooling, not Compose YAML files.
- Ref: [modules/11-compose-in-depth.md](../modules/11-compose-in-depth.md), https://compose-spec.io/

</details>

### Q-CONT-044 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 1 · single

What security benefit does dropping all Linux capabilities (`--cap-drop=ALL`) and adding back only explicitly required capabilities provide?

- A) It prevents the container from writing logs to stdout.
- B) It enforces the principle of least privilege, neutralizing potential container escape exploits that rely on root capabilities like `CAP_SYS_ADMIN` or `CAP_NET_RAW`.
- C) It upgrades the container storage driver from OverlayFS to ext4.
- D) It enables automatic TLS certificate issuance.

<details><summary>Answer</summary>

**B.** Dropping all capabilities and adding back only necessary ones restricts container privileges, preventing attackers who gain root inside the container from performing privileged kernel operations.

- Why not A, C, D: Capabilities govern kernel privilege checks, not stdout logging, storage drivers, or TLS certificates.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://man7.org/linux/man-pages/man7/capabilities.7.html

</details>

### Q-CONT-045 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 2 · scenario

A security scanner reports that a container application running as non-root user `1000` is still vulnerable because it can execute dangerous system calls. Which Linux kernel facility should be configured to restrict permitted system calls?

- A) cgroups v2 memory controller
- B) Seccomp (Secure Computing Mode) filtering profile
- C) OverlayFS whiteout layer masking
- D) User namespace UID mapping

<details><summary>Answer</summary>

**B.** Seccomp profiles filter and restrict the system calls a containerized process can issue to the kernel, blocking dangerous or unnecessary syscalls even if running as non-root.

- Why not A: Cgroups manage resource usage (CPU/memory), not syscall restrictions.
- Why not C: OverlayFS manages filesystem layers.
- Why not D: User namespaces isolate UIDs, not individual system calls.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://man7.org/linux/man-pages/man2/seccomp.2.html

</details>

### Q-CONT-046 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 2 · multi

Which tools are standard for container supply-chain security, vulnerability scanning, and cryptographic image signing? (Select all that apply)

- A) Aqua Security Trivy for vulnerability and misconfiguration scanning
- B) Syft for generating Software Bills of Materials (SBOMs)
- C) Cosign for signing and verifying OCI images using Sigstore OIDC flows
- D) GCC for compiling container runtimes from source
- E) Grype for matching SBOM inventory against vulnerability databases

<details><summary>Answer</summary>

**A, B, C, E.** Trivy scans vulnerabilities, Syft generates SBOMs, Cosign signs OCI images, and Grype analyzes SBOMs against CVE databases. GCC is a C compiler.

- Why not D: GCC is a general compiler toolchain, not a container security supply-chain tool.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://github.com/aquasecurity/trivy

</details>

### Q-CONT-047 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 1 · single

What is a Software Bill of Materials (SBOM)?

- A) A commercial invoice detailing cloud infrastructure hosting costs.
- B) A formal structured inventory of software components, libraries, and dependencies contained within a software artifact.
- C) A binary file containing compiled kernel modules.
- D) A network traffic capture log.

<details><summary>Answer</summary>

**B.** An SBOM provides a comprehensive, structured inventory of all open-source and proprietary software components and dependencies bundled inside a container image or application.

- Why not A, C, D: SBOMs inventory software components, not billing, kernel modules, or packet captures.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://www.cisa.gov/sbom

</details>

### Q-CONT-048 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 2 · hands-on

You are tasked with verifying that a container image pulled from a public registry has not been tampered with and was signed by your organization's CI pipeline using Cosign. Which command should you execute?

- A) `docker inspect --format='{{.RepoDigests}}' my-image:latest`
- B) `cosign verify --key cosign.pub registry.example.com/app@sha256:abcdef...`
- C) `trivy image --security-checks vuln my-image:latest`
- D) `skopeo inspect docker://registry.example.com/app:latest`

<details><summary>Answer</summary>

**B.** `cosign verify` checks cryptographic signatures and attestations stored in the OCI registry against a public key (or keyless OIDC identity), validating image integrity.

- Why not A: Inspecting repo digests shows content hashes, not cryptographic signatures.
- Why not C: Trivy scans vulnerabilities, it does not verify Cosign signatures.
- Why not D: Skopeo inspects image metadata, not cryptographic signatures.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://github.com/sigstore/cosign

</details>

### Q-CONT-049 · D1 Linux Kernel Primitives · difficulty 2 · scenario

A container process running inside a PID namespace attempts to inspect all processes on the host using `ps aux`. It only observes processes belonging to its own container. What kernel mechanism enforces this isolation?

- A) Mount namespace restrictions on `/proc`
- B) PID namespace virtualization, where processes outside the namespace are invisible and local processes start at PID 1
- C) cgroups v2 process accounting controllers
- D) Seccomp system call filtering blocking `getpid()`

<details><summary>Answer</summary>

**B.** A PID namespace isolates the process ID space. Processes inside the namespace cannot see or signal processes in parent or sibling namespaces, and their own root process is assigned PID 1.

- Why not A: While `/proc` is typically mounted inside the container via mount namespaces, the underlying invisibility is enforced by PID namespace isolation.
- Why not C, D: Cgroups manage resources and seccomp filters syscalls; process visibility is strictly PID namespaces.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man7/pid_namespaces.7.html

</details>

### Q-CONT-050 · D1 Linux Kernel Primitives · difficulty 1 · single

What is the purpose of the `unshare` command-line utility?

- A) To delete container image layers from local storage.
- B) To run a program in new namespaces that are detached from the parent process.
- C) To push container images to an OCI registry.
- D) To compile Dockerfile instructions into LLB.

<details><summary>Answer</summary>

**B.** `unshare` runs a program with specified namespaces detached (unshared) from the parent process context, allowing rapid creation of isolated test environments.

- Why not A, C, D: `unshare` is a kernel namespace utility, not an image builder or registry tool.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man1/unshare.1.html

</details>

### Q-CONT-051 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · scenario

An engineer notices that container startup times degrade significantly when containers mount a large SQLite database file located in the read-only image layer. What OverlayFS mechanism causes this, and how should it be resolved?

- A) Whiteout creation; resolve by deleting the database.
- B) Copy-up latency; OverlayFS must copy the entire multi-gigabyte database file from the read-only lower layer to the read-write upper layer upon first write. Resolve by placing the database on a dedicated volume or bind mount.
- C) Inode exhaustion; resolve by reformatting the host partition to XFS.
- D) OCI manifest version mismatch; resolve by upgrading to OCI Image Spec v1.1.

<details><summary>Answer</summary>

**B.** Writing to any file in a lower layer triggers an immediate copy-up of the entire file to the upper layer. For large files (like databases), this causes severe latency and storage overhead. They should be stored in volumes or bind mounts instead.

- Why not A, C, D: The bottleneck is the OverlayFS copy-up mechanism on large files, solved via volumes.
- Ref: [modules/04-filesystems-and-storage.md](../modules/04-filesystems-and-storage.md), https://docs.kernel.org/filesystems/overlayfs.html

</details>

### Q-CONT-052 · D3 Image Construction, BuildKit & Reproducibility · difficulty 2 · single

What is the primary role of the `.dockerignore` file during a container image build?

- A) To exclude sensitive files (e.g., `.git`, credentials, local `node_modules`) from being sent to the BuildKit daemon build context, improving build speed and security.
- B) To configure runtime environment variables for the container.
- C) To define OCI runtime bundle specifications.
- D) To specify which CVE vulnerabilities Trivy should ignore during scans.

<details><summary>Answer</summary>

**A.** `.dockerignore` prevents unnecessary or sensitive files from entering the build context sent to BuildKit, reducing context size, protecting secrets, and avoiding cache invalidations.

- Why not B, C, D: `.dockerignore` filters build context files, not runtime variables, runtime specs, or security scanner exceptions.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://docs.docker.com/reference/dockerfile/#dockerignore-file

</details>

### Q-CONT-053 · D4 Container Networking, DNS & Rootless Pasta · difficulty 2 · scenario

A containerized application attempts to resolve an external domain name (`api.example.com`) but fails with a temporary DNS resolution error. Inspecting `/etc/resolv.conf` inside the container reveals nameserver `127.0.0.11`. How does this nameserver function?

- A) It is a local loopback stub resolver managed by the Docker daemon that forwards DNS queries to the host's configured upstream DNS servers.
- B) It points to a local BIND9 authoritative nameserver running inside every container.
- C) It is an invalid IP address indicating a network configuration failure.
- D) It routes DNS queries directly through the OCI registry distribution API.

<details><summary>Answer</summary>

**A.** `127.0.0.11` is Docker's embedded DNS server address. The container's resolver sends DNS queries there, and the daemon resolves them either via internal service discovery or by forwarding to upstream host resolvers.

- Why not B, C, D: It is Docker's embedded DNS forwarder, not a BIND server, invalid IP, or registry API.
- Ref: [modules/09-container-networking.md](../modules/09-container-networking.md), https://docs.docker.com/engine/network/

</details>

### Q-CONT-054 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 2 · hands-on

You are running Podman in rootless mode and need to inspect the logs of a container managed by a systemd Quadlet service. Which command should you execute?

- A) `docker logs --tail=100 my-container`
- B) `journalctl --user -u my-container.service`
- C) `podman system service --daemon`
- D) `buildah inspect my-container`

<details><summary>Answer</summary>

**B.** Because Quadlet integrates containers directly into systemd services, container stdout/stderr logs are captured by the systemd journal. For rootless mode, they are accessed via `journalctl --user`.

- Why not A: Docker commands interact with Docker daemon containers, not Podman Quadlet services.
- Why not C: `podman system service` exposes an API socket, it does not view logs.
- Why not D: Buildah inspects images, not running service logs.
- Ref: [modules/10-docker-vs-podman-buildah-skopeo.md](../modules/10-docker-vs-podman-buildah-skopeo.md), https://docs.podman.io/

</details>

### Q-CONT-055 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 2 · scenario

A container running in production is compromised, and the attacker attempts to load an unauthorized kernel module using `init_module()`. Which security mechanism blocks this syscall by default in a hardened OCI container?

- A) The container memory limit enforced by cgroups v2.
- B) The default Seccomp syscall filter profile, which blocks dangerous kernel module loading and administrative syscalls.
- C) OverlayFS read-only rootfs layer permissions.
- D) Network namespace packet filtering via nftables.

<details><summary>Answer</summary>

**B.** The default Seccomp profile used by modern container engines explicitly blocks dangerous system calls such as `init_module`, `sys_mknod`, and `swapon`, preventing kernel-level attacks.

- Why not A, C, D: Cgroups manage resources, OverlayFS manages filesystems, and nftables manages networking; Seccomp restricts system calls.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://docs.docker.com/engine/security/seccomp/

</details>

### Q-CONT-056 · D1 Linux Kernel Primitives · difficulty 3 · hands-on

Write the conceptual steps required to inspect a running container's process tree and network interfaces from the host administrative shell using its container PID.

- A) Run `docker ps` to find the container ID, then inspect `/var/lib/docker`.
- B) Obtain the host PID of the container's init process, then run `nsenter --target <PID> --mount --net --pid ip addr` and `ps`.
- C) Execute `iptables -F` on the host network bridge.
- D) Run `podman machine ssh` and execute `journalctl`.

<details><summary>Answer</summary>

**B.** `nsenter` allows an administrator to enter the namespaces of a specific target PID on the host, granting direct inspection of the container's isolated network and process tree.

- Why not A, C, D: `nsenter` is the precise kernel namespace entry tool for debugging containers from the host.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man1/nsenter.1.html

</details>

### Q-CONT-057 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · single

What is the purpose of volume mounts (`-v` or `--mount`) in container execution compared to OverlayFS container layers?

- A) Volumes bypass OverlayFS copy-up overhead by mounting host directories or managed volumes directly into the container filesystem, persisting data independently of container lifecycle.
- B) Volumes store encrypted container cryptographic signatures.
- C) Volumes provide kernel namespace isolation for process trees.
- D) Volumes compile Dockerfile instructions into LLB graphs.

<details><summary>Answer</summary>

**A.** Volumes mount host storage or managed volumes directly into the container filesystem, bypassing OverlayFS copy-up overhead and ensuring data persists even if the container is destroyed.

- Why not B, C, D: Volumes are for persistent data storage, not signatures, namespaces, or image builds.
- Ref: [modules/04-filesystems-and-storage.md](../modules/04-filesystems-and-storage.md), https://docs.docker.com/engine/storage/volumes/

</details>

### Q-CONT-058 · D3 Image Construction, BuildKit & Reproducibility · difficulty 2 · scenario

An engineer observes that pulling a container image from an OCI registry is slow because every layer is downloaded sequentially as a monolithic gzipped tarball. Which OCI Image / Distribution feature optimizes layer transfer speed?

- A) Zstandard (zstd) compression and chunked/parallel blob mounting supported by OCI distribution specs.
- B) Disabling content-addressable storage hashing.
- C) Using Dockerfile shell form instead of exec form.
- D) Increasing cgroups v2 CPU weight limits.

<details><summary>Answer</summary>

**A.** Zstandard (`zstd`) compression provides faster decompression speeds, and chunked blob transfers allow parallel downloading of image layers.

- Why not B, C, D: Hashing ensures integrity, form affects signals, and cgroups manage CPU; transfer speed is optimized via compression and chunked transport.
- Ref: [modules/05-oci-image-spec.md](../modules/05-oci-image-spec.md), https://github.com/opencontainers/image-spec

</details>

### Q-CONT-059 · D4 Container Networking, DNS & Rootless Pasta · difficulty 2 · single

What is the function of the bridge network driver in container engines?

- A) It routes BGP announcements to external BGP peers.
- B) It creates a software bridge on the host that connects container `veth` interfaces, enabling local subnet communication and NAT-based external routing.
- C) It encrypts all container network packets using IPsec tunnels.
- D) It allocates persistent static MAC addresses to every ephemeral container.

<details><summary>Answer</summary>

**B.** A software bridge acts like a virtual network switch on the host, bridging container `veth` pairs together and utilizing NAT to allow communication with external networks.

- Why not A, C, D: Bridges operate as virtual layer-2 switches with NAT, not BGP routers, IPsec encryptors, or persistent MAC allocators.
- Ref: [modules/09-container-networking.md](../modules/09-container-networking.md), https://docs.docker.com/network/bridge/

</details>

### Q-CONT-060 · D5 Daemon vs Daemonless Engines & Compose v5 · difficulty 2 · scenario

A platform engineer needs to run container workloads on a multi-tenant Linux cluster without running a persistent root-privileged container daemon. Which toolchain satisfies this requirement?

- A) Docker Engine with default daemon configuration.
- B) Podman operating in rootless mode with user namespaces and daemonless fork-exec execution.
- C) Kubernetes kubelet running in privileged host mode.
- D) Docker Swarm manager nodes.

<details><summary>Answer</summary>

**B.** Podman is daemonless and designed rootless-first, allowing unprivileged users to run containers securely using user namespaces without requiring a root daemon.

- Why not A, C, D: Docker daemon and Kubelet require root privileges; Podman rootless is designed specifically for unprivileged execution.
- Ref: [modules/10-docker-vs-podman-buildah-skopeo.md](../modules/10-docker-vs-podman-buildah-skopeo.md), https://podman.io/

</details>

### Q-CONT-061 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 2 · hands-on

You need to ensure that a container's root filesystem cannot be modified by any process running inside the container, even if running with elevated privileges. Which flag should you pass to the container runtime?

- A) `--read-only`
- B) `--privileged`
- C) `--cap-add=ALL`
- D) `--net=host`

<details><summary>Answer</summary>

**A.** The `--read-only` flag mounts the container's root filesystem as read-only, forcing applications to use explicit tmpfs mounts or volumes for any ephemeral write operations.

- Why not B, C, D: Privileged mode and adding all capabilities weaken security; host networking affects network namespaces, not rootfs write permissions.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://docs.docker.com/engine/security/

</details>

### Q-CONT-062 · D1 Linux Kernel Primitives · difficulty 1 · single

What is the primary function of the `uts` namespace in Linux?

- A) Isolating process IDs and process trees.
- B) Isolating hostname and NIS domain name identifiers.
- C) Isolating network interfaces and routing tables.
- D) Isolating mount points and filesystem tables.

<details><summary>Answer</summary>

**B.** The `uts` (UNIX Timesharing System) namespace isolates the hostname and NIS domain name returned by `uname()`.

- Why not A: PID namespace isolates process trees.
- Why not C: Network namespace isolates network interfaces.
- Why not D: Mount namespace isolates mount points.
- Ref: [modules/02-linux-namespaces.md](../modules/02-linux-namespaces.md), https://man7.org/linux/man-pages/man7/namespaces.7.html

</details>

### Q-CONT-063 · D2 Storage, OverlayFS & OCI Specifications · difficulty 2 · scenario

An engineer inspects an OCI image manifest and finds a reference to a signature object linked via the v1.1 referrers API. What type of artifact does this refer to?

- A) A container memory dump generated during an OOM crash.
- B) A cryptographic signature or attestation proving the provenance and integrity of the parent container image.
- C) A database transaction log.
- D) A network traffic packet capture.

<details><summary>Answer</summary>

**B.** The OCI v1.1 Referrers API allows detached artifacts such as Cosign digital signatures, SLSA provenance attestations, and SBOMs to reference a parent image manifest directly by digest.

- Why not A, C, D: Referrers link security artifacts (signatures, SBOMs, attestations), not crash dumps, DB logs, or packet captures.
- Ref: [modules/07-oci-distribution-and-registries.md](../modules/07-oci-distribution-and-registries.md), https://github.com/opencontainers/distribution-spec

</details>

### Q-CONT-064 · D3 Image Construction, BuildKit & Reproducibility · difficulty 2 · single

What is the purpose of the `HEALTHCHECK` instruction in a Dockerfile?

- A) It configures the CPU memory limit controller in cgroups v2.
- B) It defines a command that the container engine runs periodically to check whether the application container is healthy and responding correctly.
- C) It verifies OCI cryptographic image signatures prior to pulling.
- D) It compiles multi-architecture manifests.

<details><summary>Answer</summary>

**B.** The `HEALTHCHECK` instruction instructs the container engine to run a periodic probe command inside the container to report its health status to orchestrators and dependency graphs.

- Why not A, C, D: Healthchecks monitor application liveness, not cgroups, signatures, or multi-arch manifests.
- Ref: [modules/08-building-images-dockerfile-and-buildkit.md](../modules/08-building-images-dockerfile-and-buildkit.md), https://docs.docker.com/reference/dockerfile/#healthcheck

</details>

### Q-CONT-065 · D6 Hardening, Capabilities & Supply-Chain Security · difficulty 2 · scenario

A containerized microservice running in production is discovered to have an exposed remote code execution vulnerability. To mitigate the risk of the attacker reading host files or mounting malicious devices, which flags should be strictly avoided in container creation?

- A) `--read-only` and `--security-type=seccomp`
- B) `--privileged` and mounting host root `/` or `/var/run/docker.sock` into the container.
- C) `--cap-drop=ALL` and non-root user execution.
- D) User namespace mapping with unprivileged subuids.

<details><summary>Answer</summary>

**B.** Mounting `/var/run/docker.sock` gives container processes full root control over the host Docker daemon, and `--privileged` disables all kernel isolation barriers, leading to immediate host compromise.

- Why not A, C, D: Read-only rootfs, dropping capabilities, and rootless user namespaces are hardening best practices, whereas privileged mode and socket mounts are extreme security risks.
- Ref: [modules/12-security-and-supply-chain.md](../modules/12-security-and-supply-chain.md), https://docs.docker.com/engine/security/security/

</details>

---

## Mock Exam

- **Total Questions:** 65
- **Time Limit:** 90 minutes
- **Passing Score:** 70% (46 / 65 correct)
- **Domain Breakdown:**
  - D1 Linux Kernel Primitives: 17 questions (Q01–Q13, Q49–Q50, Q56, Q62)
  - D2 Storage & OCI Specifications: 15 questions (Q14–Q25, Q51, Q57, Q63)
  - D3 Image Construction & BuildKit: 10 questions (Q26–Q32, Q52, Q58, Q64)
  - D4 Container Networking & DNS: 7 questions (Q33–Q37, Q53, Q59)
  - D5 Daemon vs Daemonless Engines: 8 questions (Q38–Q43, Q54, Q60)
  - D6 Container Hardening & Supply Chain: 8 questions (Q44–Q48, Q55, Q61, Q65)

### Scoring Key

- **59–65 correct:** Expert Container Architect / CKS / CKAD Specialist
- **46–58 correct:** Passing (Production Ready)
- **< 46 correct:** Review modules 01 through 12 and re-take the mock exam.
