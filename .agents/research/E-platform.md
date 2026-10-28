# E — Platform tracks (containers, Kubernetes, Argo CD, Terraform, observability, CI/CD)

Research date: 2026-10-28. Versions verified by `git ls-remote --tags` + shallow tag fetch (tag/commit date) against upstream GitHub repos, plus official docs/blogs cited inline. "Tag date" = git tagger/commit date of the release tag, which can precede the GitHub release page by hours/days.

## Structural decisions (summary)

| Question | Recommendation | Rationale |
|---|---|---|
| Docker vs Podman | **One track `technologies/containers`** | Both are front-ends over the same OCI image/runtime/distribution specs, same kernel primitives (namespaces, cgroups v2, overlayfs, seccomp), same runtimes (runc/crun). Splitting would duplicate ~70% of content. Tool differences (daemon vs daemonless, rootless defaults, Quadlet vs compose, Buildah/Skopeo) fit in 2 modules. |
| Kubernetes | **`technologies/kubernetes`**, prerequisite = containers | Single narrative covering CKA+CKAD; CKS content as late modules (security). |
| Argo CD | **Standalone `technologies/argocd`, scoped as "GitOps with Argo CD (+ Argo Rollouts)"** | Too deep (controller internals, sharding, ApplicationSets, hydrator, RBAC, multi-tenancy) to be one K8s module; but should not become an "all of Argo" track — CAPA is 36% Workflows + 12% Events, which are a different problem (batch/DAG). Cover CGOA (100%) + CAPA's Argo CD 34% + Rollouts 18%; Workflows/Events = one optional appendix module. Flux only as comparison. A separate `gitops` track is not justified (principles = 1 module). |
| Grafana / Kibana | **One track `technologies/observability`** (vendor-neutral spine: OTel + signals + SLOs; two backends: Grafana LGTM and Elastic) | The concepts (signals, cardinality, sampling, alerting, SLOs) are tool-independent; Grafana and Kibana are UIs over different stores. Boundary: the Elasticsearch track owns ES storage/indexing/mappings/query DSL/ES|QL internals/ILM; observability owns Kibana dashboards/Lens/Discover, alerting rules, Elastic Observability (APM, EDOT, Synthetics), and only cross-links ES internals. |
| CI/CD | **Yes: `technologies/gitlab-ci`** (smaller, 9–10 modules) | User uses GitLab; pipelines are where containers, Terraform, K8s and GitOps meet (build → scan → sign → push → update GitOps repo). Supply-chain security (SBOM, cosign, SLSA) lives here and is cross-linked from containers + CKS module. |

Suggested order: containers → kubernetes → (terraform in parallel) → argocd → gitlab-ci → observability.

---

### Containers (Docker + Podman) — `technologies/containers`

- **Current stable version(s)** (tag dates from upstream repos):
  - Docker Engine **29.9.2** (tag `docker-v29.9.2`, 2026-10-20; moby/moby now tags engine releases as `docker-vX`; docker/cli v29.9.2). v29 baseline changes: min API 1.44, **containerd image store default for new installs**, graph drivers deprecated, experimental `--firewall-backend=nftables`, Go module path moved to `github.com/moby/moby` — https://www.docker.com/blog/docker-engine-version-29/ , https://docs.docker.com/engine/release-notes/29/
  - Docker Compose **v5.6.1** (2026-10-21). v5 is "functionally identical to Compose v2"; adds official Go SDK; version jump to avoid confusion with legacy file-format "v2/v3" — https://docs.docker.com/compose/intro/history/
  - BuildKit **v0.34.1** (2026-10-20); buildx v0.38.1.
  - Podman **6.1.4** (2026-10-12; 6.0.0 tagged 2026-06-24). 6.0 breaking: slirp4netns removed (pasta only), **cgroups v1 removed**, BoltDB removed (SQLite only; upgrade via 5.8 first), Netavark drops iptables → nftables, containers.conf/storage.conf parsing reworked — https://fedoraproject.org/wiki/Changes/Podman6 . (Search results mention a `podman-container-tools/podman` GitHub org — possible repo move, unverified.)
  - Buildah **1.46.0**, Skopeo **1.24.1**, runc **1.5.2**, crun **1.30.1**, containerd **2.4.2** (2026-10-13).
  - OCI specs: image-spec **v1.1.1** (2025-03-03), runtime-spec **v1.3.0** (2025-11-04), distribution-spec **v1.1.1** (2025-01-29) — https://github.com/opencontainers
- **Authoritative syllabi used**:
  - OCI specs (primary definitions): https://github.com/opencontainers/image-spec , /runtime-spec , /distribution-spec
  - Linux man pages: namespaces(7), cgroups(7), user_namespaces(7), capabilities(7), seccomp(2); kernel cgroup v2 doc https://docs.kernel.org/admin-guide/cgroup-v2.html ; overlayfs https://docs.kernel.org/filesystems/overlayfs.html
  - Docker docs ToC (build, engine, compose, security): https://docs.docker.com/ ; Dockerfile reference https://docs.docker.com/reference/dockerfile/ ; Compose spec https://github.com/compose-spec/compose-spec
  - Podman docs https://docs.podman.io/ ; Quadlet `podman-systemd.unit(5)`
  - Docker Certified Associate (DCA, Mirantis) is legacy and not worth targeting (unverified current status); CKAD "Application Design and Build 20%" (define/build/modify images) and CKS "Supply Chain Security 20%" + "Minimize base image footprint" overlap — curricula at https://github.com/cncf/curriculum
- **Proposed modules** (12):
  1. **What a container is (and isn't)** — process + namespaces + cgroups + rootfs; VM vs container; why Mac/Windows run a Linux VM (Docker Desktop, Colima/Lima, podman machine); OCI layering of the ecosystem (CLI → daemon → containerd → shim → runc/crun).
  2. **Linux namespaces** — pid, mnt, net, uts, ipc, user, cgroup, time; `unshare`/`nsenter`/`setns`; PID 1 semantics (signal handling, zombie reaping, `--init`/tini); user-ns UID mapping (`/proc/self/uid_map`, subuid/subgid).
  3. **cgroups v2** — unified hierarchy, controllers (cpu.max, cpu.weight, memory.max/high/low, pids.max, io.max); OOM killer & `memory.events`; PSI; CPU throttling (CFS quota period); systemd as cgroup manager; v1 removal (Podman 6, K8s 1.35 FailCgroupV1).
  4. **Filesystems & storage** — overlayfs lowerdir/upperdir/workdir, whiteouts, copy-up cost; storage drivers vs containerd snapshotters; volumes vs bind mounts vs tmpfs; SELinux `:z/:Z` relabeling; idmapped mounts.
  5. **OCI image spec** — manifest, image index (multi-arch), config, layers (tar+gzip/zstd), content-addressable digests, annotations, artifacts & `subject`/referrers (v1.1); tags vs digests; reproducibility (SOURCE_DATE_EPOCH).
  6. **OCI runtime spec & runtimes** — `config.json`, bundle, lifecycle (create/start/kill/delete), hooks; runc vs crun vs gVisor/Kata (sandboxed); containerd shim v2; CRI preview.
  7. **OCI distribution spec & registries** — pull/push API, blob mounts, chunked uploads, auth token flow, rate limits, mirrors/pull-through caches; Skopeo copy/inspect; `crane`/`oras`.
  8. **Building images: Dockerfile + BuildKit** — instruction semantics (RUN/COPY/ADD, shell vs exec form, ENTRYPOINT+CMD), cache keys & invalidation, multi-stage, `--mount=type=cache|secret|ssh`, heredocs, `.dockerignore`, buildx multi-platform (QEMU vs native nodes), bake, cache export (registry/gha/local), Buildah alternative (scripts, `buildah unshare`).
  9. **Container networking** — veth pairs, bridges, NAT/iptables→nftables, port publishing, DNS on user-defined networks, host/none/macvlan; rootless networking (pasta, slirp4netns removed in Podman 6); Netavark/aardvark-dns; CNI preview for K8s.
  10. **Docker vs Podman/Buildah/Skopeo** — daemon vs fork/exec, socket API compatibility (`podman system service`), pods, Quadlet/systemd integration, `podman kube play/generate`, rootless defaults, compose (docker compose vs podman compose), Desktop/machine VMs on macOS.
  11. **Compose in depth** — Compose spec, merge/override/`include`, profiles, `depends_on` conditions + healthchecks, project name collisions, watch/develop, env interpolation precedence, Compose v5 SDK; when Compose stops being enough.
  12. **Security & supply chain** — rootless vs userns-remap, capabilities drop, seccomp/AppArmor/SELinux profiles, read-only rootfs, no-new-privileges, socket exposure risk, image minimisation (distroless/scratch/chainguard-style), scanning (Trivy), SBOM (syft), signing (cosign v3), provenance attestations (SLSA via BuildKit), CVE triage.
- **Gotchas & production failure modes**:
  - `ENTRYPOINT` in shell form → app is not PID 1, never gets SIGTERM, killed after 10 s grace (SIGKILL); exit code 137 misread as OOM.
  - Exit 137 ≠ always OOM: check `memory.events oom_kill` / `docker inspect .State.OOMKilled`.
  - Mounting `/var/run/docker.sock` into a container = root on the host.
  - `COPY . .` before `RUN npm ci` busts the dependency cache on every source change; missing `.dockerignore` ships `.git`/`node_modules`/secrets into context and layers.
  - Secrets via `ARG`/`ENV` persist in image history/config; use `RUN --mount=type=secret`.
  - Deleting a file in a later layer doesn't shrink the image (whiteout); `rm` must be in the same `RUN`.
  - `latest` + `imagePullPolicy` / mutable tags → non-reproducible deploys; pin by digest.
  - Docker publishes ports by inserting iptables rules **ahead of** ufw/firewalld rules → "firewalled" ports exposed; `DOCKER-USER` chain needed (and must be migrated under nftables backend).
  - JVM/Node/Go runtimes not cgroup-aware in old versions → heap sized to host RAM → OOM kills; CPU quota throttling with high thread counts (GOMAXPROCS).
  - overlayfs copy-up on large files (DB files written in image layer) — huge latency/space; use volumes.
  - Bind-mount UID mismatch in rootless mode (files owned by subuid 100999 on host); `--userns=keep-id` (Podman).
  - Docker Hub pull rate limits break CI; configure a mirror/pull-through cache.
  - Multi-arch: building amd64 on Apple Silicon via QEMU is 5–20x slower and can segfault on some toolchains; image index missing a platform → `exec format error`.
  - Upgrading to Podman 6 with BoltDB state → containers unusable unless migrated via 5.8 first.
  - Docker 29 raised minimum API to 1.44 → old CI clients/SDKs (e.g. older Testcontainers/docker-py) fail with "client version too old".
  - Zombie processes accumulate when PID 1 is a shell script without `exec`/init.
  - Log driver `json-file` without rotation fills the disk.
- **Interview hot topics**:
  - Container vs VM; what isolation actually exists (shared kernel).
  - Namespaces + cgroups explanation, and how rootless works (user namespaces, subuid).
  - Image layers, digests, multi-stage builds, cache invalidation rules.
  - PID 1 / signal handling / graceful shutdown.
  - CMD vs ENTRYPOINT, shell vs exec form.
  - How `docker run` flows through containerd/shim/runc.
  - Docker vs Podman architectural differences.
  - Image hardening and supply chain (SBOM, signing, scanning).
  - Container networking (bridge, NAT, port publishing).
  - Debugging a crashing/OOM-killed container.
- **Executable-proof strategy**:
  - Mac host: namespaces/cgroups/overlayfs labs must run **inside a Linux VM** — Lima **v2.2.1** or Colima **v0.10.3** (or `podman machine`); scripts executed via `limactl shell`. Flag: kernel primitives cannot be demonstrated natively on macOS.
  - Bats or pytest suites that assert observable kernel facts (e.g. `readlink /proc/$pid/ns/pid` differs; `cat memory.max` equals the `--memory` flag; OOM test: allocate > limit → assert `oom_kill` counter incremented, exit 137).
  - Build tests: `docker buildx build --check` (Dockerfile lint rules), hadolint **v2.15.1**, assert image size budget and layer count via `docker image inspect`/`skopeo inspect`; dive **v0.13.1** CI mode for wasted-space thresholds; reproducibility test: build twice with `SOURCE_DATE_EPOCH` → identical digest.
  - Registry tests: local `registry:3` (distribution) container; skopeo copy/inspect; negative tests (pull by wrong digest fails, unsigned image rejected by `cosign verify`, cosign **v3.1.4**).
  - Security negatives: container without CAP_NET_RAW cannot ping; read-only rootfs write fails; seccomp profile blocks `unshare`.
  - Testcontainers (Node **v12.2.1**) for app-level integration.
  - mise pins: docker CLI, buildx, compose, podman (CLI via brew/mise aqua — verify registry), hadolint, dive, trivy **v0.76.1**, cosign, skopeo (Linux-only binaries → install inside VM).
- **Overlaps / dedupe**:
  - Linux process model, signals, filesystems, networking basics (iptables/nftables, veth, bridges) → a `foundations/linux` (or `foundations/networking`) track; containers cross-links.
  - CRI/containerd-in-K8s, Pod security contexts → kubernetes track.
  - SBOM/signing/SLSA pipeline mechanics → gitlab-ci track (containers explains the artifacts; CI shows enforcement).
  - Compose-based local stacks reused by observability/terraform examples — keep a shared `examples/_compose` convention, not duplicated content.

---

### Kubernetes — `technologies/kubernetes`

- **Current stable version(s)**:
  - **v1.37.2** (tag 2026-10-27). v1.37.0 "Garhwal" released 2026-08-26 — https://kubernetes.io/blog/2026/08/26/kubernetes-v1-37-release/
  - Maintained: 1.37, 1.36 (1.36.5), 1.35 (1.35.9); 1.34 EOL 2026-10-27 — https://kubernetes.io/releases/
  - Next: **v1.38** in alpha (v1.38.0-alpha.3 tagged); date per https://github.com/kubernetes/sig-release/tree/master/releases (not checked).
  - Notable recent: v1.36 GA user namespaces, fine-grained kubelet API authz, declarative validation, PSI metrics, VolumeGroupSnapshots; Service ExternalIPs deprecated (https://kubernetes.io/blog/2026/04/22/kubernetes-v1-36-release/). v1.37 GA Metrics API, StorageVersionMigration GA; beta HPA scale-to-zero, Pod certificates, KubeletInUserNamespace, native histograms. v1.35: kubelet refuses cgroup v1 by default (FailCgroupV1=true), code removal ≥1.38 — https://kubernetes.dev/resources/keps/5573
  - Gateway API **v1.6.3** (v1.6.0 on 2026-06-30): v1.5 moved ListenerSet, TLSRoute, HTTPRoute CORS, client cert validation, ReferenceGrant to Standard (https://kubernetes.io/blog/2026/04/21/gateway-api-v1-5/); v1.6 moved TCPRoute/UDPRoute to Standard `v1`, experimental resources moved to `gateway.networking.x-k8s.io` with `X` prefix (https://kubernetes.io/zh-cn/blog/2026/08/03/gateway-api-v1-6-release/).
  - **Ingress-NGINX retired March 2026** (no further releases/security fixes) — https://kubernetes.io/blog/2026/01/29/ingress-nginx-statement/
  - etcd **v3.7.3**, containerd **2.4.2**, Helm **v4.3.1** (Helm 4 is current major), Kustomize **v5.8.3**, kind **v0.33.0** (2026-08-26), k3d **v5.9.0**.
- **Authoritative syllabi used** (https://github.com/cncf/curriculum, files `CKA_Curriculum_v1.37.pdf`, `CKAD_Curriculum_v1.37.pdf`, `CKS_Curriculum v1.34.pdf` — note CKS curriculum lags at v1.34):
  - **CKA (v1.37)**: Troubleshooting 30% · Cluster Architecture, Installation & Configuration 25% · Services & Networking 20% · Workloads & Scheduling 15% · Storage 10%. Includes Gateway API, Helm+Kustomize, CRDs/operators, CNI/CSI/CRI, HA control plane, workload autoscaling.
  - **CKAD (v1.37)**: Application Environment, Configuration & Security 25% · Application Design & Build 20% · Application Deployment 20% · Services & Networking 20% · Application Observability & Maintenance 15%.
  - **CKS (v1.34)**: Minimize Microservice Vulnerabilities 20% · Supply Chain Security 20% · Monitoring, Logging & Runtime Security 20% · Cluster Setup 15% · Cluster Hardening 15% · System Hardening 10%.
  - Official docs ToC https://kubernetes.io/docs/ ; API reference https://kubernetes.io/docs/reference/kubernetes-api/ ; KEPs https://github.com/kubernetes/enhancements ; "Kubernetes the Hard Way" https://github.com/kelseyhightower/kubernetes-the-hard-way ; Programming Kubernetes / kubebuilder book https://book.kubebuilder.io/
- **Proposed modules** (14):
  1. **Mental model: declarative API + reconciliation** — desired vs observed state, level-triggered control loops, objects (metadata/spec/status), labels/selectors/annotations, ownerReferences & GC, kubectl apply (client vs server-side apply, field managers).
  2. **Control plane internals** — kube-apiserver request path (authn → authz → mutating admission → schema validation → validating admission → etcd), watch/list + resourceVersion, informers/shared caches; etcd (Raft, MVCC revisions, compaction/defrag, quorum); scheduler; controller-manager; cloud-controller-manager.
  3. **Node internals** — kubelet (pod lifecycle, PLEG, static pods), CRI + containerd/CRI-O, cgroup v2 (FailCgroupV1), QoS classes, eviction thresholds, PSI, kube-proxy (iptables/nftables/IPVS modes) vs eBPF dataplanes.
  4. **Pods & workloads** — Pod lifecycle/phases/conditions, init + native sidecar containers, probes (startup/liveness/readiness), graceful termination (preStop, terminationGracePeriodSeconds), Deployments/ReplicaSets (rollout, maxSurge/maxUnavailable, rollback), StatefulSets, DaemonSets, Jobs/CronJobs (backoff, pod failure policy, suspended jobs), deployment strategies (blue/green, canary with primitives).
  5. **Configuration & resources** — ConfigMaps, Secrets (base64 ≠ encryption; encryption at rest; projected volumes), env vs volume semantics; requests/limits, LimitRange, ResourceQuota; in-place pod resize; pod-level resources; HPA/VPA (HPA scale-to-zero beta in 1.37).
  6. **Scheduling** — filter/score plugins, node affinity, pod (anti-)affinity, taints/tolerations, topology spread, priority & preemption, PodDisruptionBudgets, DRA overview, scheduler profiles.
  7. **Networking** — pod network model, CNI plugins (Cilium/Calico), Services (ClusterIP/NodePort/LoadBalancer/headless/ExternalName), EndpointSlices, CoreDNS (search paths, ndots:5), NetworkPolicy semantics (default-allow, additive, egress DNS), Ingress (and ingress-nginx retirement).
  8. **Gateway API** — GatewayClass/Gateway/HTTPRoute/GRPCRoute/TLSRoute/TCPRoute/UDPRoute, ListenerSet, ReferenceGrant, BackendTLSPolicy, role-oriented model, channels (standard vs experimental `x-k8s.io`), migration from Ingress (ingress2gateway).
  9. **Storage** — volumes, PV/PVC binding, StorageClasses & dynamic provisioning, access modes (RWO/RWX/RWOP), reclaim policies, volumeBindingMode WaitForFirstConsumer, CSI architecture (controller/node plugins, sidecars), snapshots/VolumeGroupSnapshots, StatefulSet volumeClaimTemplates.
  10. **Cluster lifecycle (kubeadm)** — init/join, certificates & PKI, kubeconfig, HA control plane (stacked vs external etcd, LB), version skew policy, upgrades (drain/cordon), etcd backup/restore (snapshot save/restore), managed K8s differences (EKS/GKE/AKS).
  11. **Security** — authn (certs, OIDC, SA tokens/bound tokens), RBAC (Role/ClusterRole/bindings, aggregation, escalate/bind verbs), ServiceAccounts, Pod Security Standards/Admission, securityContext (runAsNonRoot, capabilities, seccomp RuntimeDefault, AppArmor), user namespaces (GA 1.36), ValidatingAdmissionPolicy (CEL), audit logging, CIS benchmark (kube-bench), runtime security (Falco), image policy/signature verification (Kyverno), Secrets encryption + KMS.
  12. **Extending Kubernetes** — CRDs (schema, versions, conversion webhooks, CEL validation rules, status subresource), admission webhooks, aggregated API, operator pattern, controller-runtime/kubebuilder (reconcile idempotence, finalizers, requeue, owner refs), Helm 4 charts vs Kustomize overlays.
  13. **Observability & troubleshooting** — kubectl debug/ephemeral containers, events, logs (container output streams), metrics-server/Metrics API, CrashLoopBackOff/ImagePullBackOff/Pending/OOMKilled playbook, node NotReady, control-plane component failure, DNS & Service debugging, API deprecations (kubectl convert, `pluto`-style checks).
  14. **Production & expert topics** — multi-tenancy (namespaces, vCluster, sandboxed runtimes), capacity & autoscaling (Cluster Autoscaler/Karpenter), API Priority & Fairness, large-cluster limits, etcd performance, upgrade strategy & deprecation policy, disaster recovery, cost.
- **Gotchas & production failure modes**:
  - CPU limits cause CFS throttling even at low average utilization (latency spikes); many teams set requests without CPU limits.
  - Memory limit < working set → OOMKilled loop; QoS BestEffort pods evicted first under node pressure.
  - Liveness probe hitting a dependency (DB) → cascading restarts across all replicas during a DB blip.
  - No readiness gate during rollout + no preStop sleep → 502s because endpoints update after SIGTERM is sent.
  - `ndots:5` makes every external DNS lookup try 4–5 search domains first → CoreDNS load, latency; conntrack races on UDP DNS.
  - NetworkPolicy default-deny egress without allowing DNS (UDP+TCP 53 to kube-dns) breaks everything.
  - NetworkPolicy objects are silently ignored if the CNI doesn't enforce them.
  - PDB with `minAvailable` = replicas blocks node drains forever (stuck upgrades).
  - etcd DB size quota (default 2 GiB, max recommended 8 GiB) exceeded → cluster read-only ("mvcc: database space exceeded"); needs compaction + defrag.
  - Large `kubectl get -A` / unpaginated LISTs from controllers overload apiserver; use informers, pagination, APF.
  - Finalizer on a CR whose controller is gone → namespace stuck Terminating.
  - Secrets are base64, readable by anyone with `get secrets` or who can create pods in the namespace (mount any secret).
  - `kubectl apply` with large CRDs fails ("metadata.annotations too long") → use server-side apply.
  - Mixing client-side apply and SSA/Helm → field ownership conflicts, fields silently reverted.
  - Using `latest` tags with `imagePullPolicy: IfNotPresent` → nodes run different code.
  - Cluster upgrade to 1.35+ on cgroup v1 nodes → kubelet won't start.
  - Still on ingress-nginx after March 2026 → unpatched edge proxy.
  - Webhook with `failurePolicy: Fail` and its backend down → cluster-wide inability to create pods (including the webhook's own pods).
  - HPA on CPU with no requests set → HPA can't compute utilization.
- **Interview hot topics**:
  - What happens on `kubectl apply -f deployment.yaml` end to end (apiserver → etcd → controllers → scheduler → kubelet → CRI → CNI).
  - Reconciliation/level-triggered controllers; writing an operator.
  - Services & kube-proxy, DNS resolution, Ingress vs Gateway API.
  - Requests/limits, QoS, throttling, OOM, eviction.
  - Probes and zero-downtime rollouts.
  - StatefulSets vs Deployments; storage binding.
  - RBAC design, ServiceAccounts, Pod Security.
  - etcd role, Raft, backup/restore.
  - Troubleshooting CrashLoopBackOff / Pending pods.
  - Scheduling: affinity, taints, topology spread.
  - Helm vs Kustomize.
  - Multi-tenancy and cluster upgrades.
- **Executable-proof strategy**:
  - **kind v0.33.0** (node image for 1.37 — exact default image unverified) for multi-node clusters with kubeadm under the hood; **k3d v5.9.0** as lightweight alternative. Requires a container runtime on Mac (Docker Desktop / Colima / OrbStack / podman machine).
  - Kubernetes e2e assertions with **Chainsaw v0.2.15** (Kyverno's declarative K8s test runner: apply/assert/error steps — good for negative tests like "Pod violating PSS restricted is rejected"); alternatively bats + `kubectl wait`.
  - Static validation: `kubeconform` **v0.8.0** with schemas for 1.37; `kubectl apply --dry-run=server`; Helm 4 `helm template` + `helm lint`; Kustomize build snapshot tests.
  - Policy tests: Kyverno CLI **v1.19.2** `kyverno test`; ValidatingAdmissionPolicy tested against kind.
  - Operator module: kubebuilder/controller-runtime with **envtest** (real apiserver+etcd binaries, no kubelet) — deterministic Go tests; or a Python kopf alternative.
  - Scale/scheduler experiments without real nodes: **KWOK v0.8.0** (fake nodes).
  - etcd backup/restore and kubeadm upgrade labs: on kind partly (etcdctl snapshot inside control-plane container); full kubeadm HA install needs Lima VMs (Linux) — flag as "lab, not CI-deterministic".
  - Cannot prove locally: real cloud LoadBalancers (use MetalLB/cloud-provider-kind), CSI cloud drivers (use local-path/hostpath CSI), Karpenter. Fallback: manifest validation + documented expected output.
  - mise pins: kubectl 1.37.x, kind, k3d, helm 4.3.x, kustomize, kubeconform, chainsaw, kyverno CLI, etcd (etcdctl), kwok.
- **Overlaps / dedupe**:
  - Container primitives, image building, runtimes → containers track (prerequisite).
  - Prometheus/metrics/logging stacks on K8s → observability track (K8s module 13 only covers kubectl-level debugging + Metrics API).
  - Supply-chain signing/SBOM generation → gitlab-ci/containers; K8s covers only admission-time verification.
  - GitOps deployment → argocd track; progressive delivery → argocd (Argo Rollouts).
  - Cloud-managed clusters (EKS/GKE/AKS IAM integration) → respective cloud tracks; Terraform provisioning of clusters → terraform track.
  - Distributed-systems theory (Raft, consensus) → a `foundations/distributed-systems` track if present; K8s applies it to etcd.

---

### Argo CD (GitOps with Argo CD + Argo Rollouts) — `technologies/argocd`

- **Current stable version(s)**:
  - Argo CD **v3.5.6** (tag 2026-10-20); v3.5.0 released 2026-08-04. Supported lines also v3.4.x (3.4.8+) and v3.3.x (3.3.14+) per release page. **v3.6.0-rc4** (2026-10-22) in RC — https://github.com/argoproj/argo-cd/releases
  - v3.5 highlights: Source Hydrator → beta, impersonation → beta, ApplicationSets-in-any-namespace stable, **Helm 3 → Helm 4 migration**, repo-server mTLS, Gateway API health checks — https://newreleases.io/project/github/argoproj/argo-cd/release/v3.5.0
  - v3.0 breaking changes still worth teaching (fine-grained RBAC no longer inherits to sub-resources, logs RBAC enforced, **annotation-based resource tracking default**, default `resource.exclusions`, repos in `argocd-cm` removed, status-ignore defaults) — https://argo-cd.readthedocs.io/en/stable/operator-manual/upgrading/2.14-3.0/
  - Argo Rollouts **v1.10.1** (v1.10.0 on 2026-08-05). Argo Workflows **v4.1.6** (for appendix only). Flux **v2.10.0** (comparison).
- **Authoritative syllabi used**:
  - **CAPA** (Certified Argo Project Associate), https://github.com/cncf/curriculum `CAPA_Curriculum.pdf`: Argo Workflows 36% · **Argo CD 34%** (fundamentals, sync apps, Application, Helm & Kustomize, reconciliation patterns) · **Argo Rollouts 18%** (fundamentals, progressive strategies, AnalysisTemplate/AnalysisRun) · Argo Events 12%.
  - **CGOA** (Certified GitOps Associate), `CGOA_Curriculum.pdf`: GitOps Principles 30% · GitOps Terminology 20% · GitOps Patterns 20% · Related Practices 16% · Tooling 14%.
  - OpenGitOps principles v1.0.0 (Declarative, Versioned & Immutable, Pulled Automatically, Continuously Reconciled) — https://opengitops.dev/
  - Argo CD docs (user guide + operator manual) https://argo-cd.readthedocs.io/ ; Argo Rollouts docs https://argo-rollouts.readthedocs.io/
- **Proposed modules** (11):
  1. **GitOps principles** — OpenGitOps 4 principles, terminology (desired state, drift, reconciliation, state store), push CI/CD vs pull GitOps, Argo CD vs Flux architectures, when GitOps is wrong (CGOA terminology+principles).
  2. **Argo CD architecture** — api-server, repo-server (manifest generation + cache), application-controller (reconciliation loop, comparison, sync), applicationset-controller, Redis cache, Dex/OIDC, notifications controller; CRDs (Application, AppProject, ApplicationSet).
  3. **Applications & sources** — plain manifests, Helm (values, valueFiles globs, Helm 4), Kustomize, multi-source apps, config management plugins (sidecar CMP), directory recursion, `targetRevision` semantics (branch/tag/SHA).
  4. **Sync mechanics** — diffing (live vs desired, normalization, `ignoreDifferences`, server-side diff), sync options (ServerSideApply, Prune, PruneLast, Replace, CreateNamespace, ApplyOutOfSyncOnly), auto-sync + self-heal + prune, **sync phases/hooks** (PreSync/Sync/PostSync/SyncFail/PostDelete), **sync waves**, health assessment (built-in + Lua custom health), resource tracking (annotation vs label).
  5. **Drift & reconciliation patterns** — refresh vs hard refresh, webhook vs polling (jitter), drift sources (HPA replicas, mutating webhooks, controllers writing spec), app-of-apps, orphaned resources, finalizers & cascading deletion.
  6. **ApplicationSets** — generators (list, cluster, git directory/file, matrix, merge, SCM provider, pull request, cluster-decision), templating (goTemplate), progressive syncs, policies (create-only/sync), preview environments.
  7. **Multi-tenancy & security** — AppProjects (source/destination/resource allow/deny lists), RBAC (Casbin policies, fine-grained 3.x semantics), SSO/Dex, impersonation (beta), apps-in-any-namespace, repo credentials & credential templates, secrets management (Sealed Secrets, External Secrets, SOPS via CMP — never plain secrets in Git).
  8. **Repo & environment structure** — monorepo vs polyrepo, environment promotion (branch-per-env anti-pattern vs folder-per-env), Source Hydrator (rendered manifests pattern), GitOps Promoter, image update automation (Argo CD Image Updater), CI → GitOps handoff.
  9. **Progressive delivery with Argo Rollouts** — Rollout CRD, blue/green vs canary steps, traffic routing (Gateway API plugin, Istio, NGINX/ALB), AnalysisTemplate/AnalysisRun with Prometheus metrics, abort/retry, experiments; interplay with Argo CD health/sync.
  10. **Operating Argo CD at scale** — HA install, controller sharding (legacy/round-robin/consistent-hashing), repo-server scaling & caching, `resource.exclusions`, reconciliation timeout, Redis, metrics & alerts, notifications, disaster recovery (`argocd admin export/import`), upgrades (server-side apply of CRDs).
  11. **(Optional appendix) Rest of Argo: Workflows & Events** — Workflow/WorkflowTemplate, DAG/steps, artifacts; EventSource/Sensor; just enough for CAPA's 48%.
- **Gotchas & production failure modes**:
  - Auto-sync with `prune: true` + accidental path rename/empty render → Argo CD deletes production resources (use `PruneLast`, `Prune=false` annotations, app finalizer awareness, deletion confirmation).
  - Deleting an Application with `resources-finalizer.argocd.argoproj.io` cascades to all managed resources; without it, resources are orphaned.
  - HPA-managed `replicas` in Deployment manifest → perpetual OutOfSync/self-heal fight; remove `replicas` or `ignoreDifferences`.
  - Mutating webhooks / defaulting (e.g. Istio injection, defaulted fields) cause permanent diffs; fix with server-side diff or `ignoreDifferences` + `RespectIgnoreDifferences=true`.
  - Large CRDs fail client-side apply (annotation size) → `ServerSideApply=true`.
  - Sync waves: resources in the same wave with dependency (CRD + CR) fail; CRDs must be in an earlier wave or a separate app; `SkipDryRunOnMissingResource=true`.
  - Hook resources without `hook-delete-policy` accumulate or block re-runs (Job name immutability).
  - Upgrade to 3.x switched to annotation tracking → resources tracked by label may appear orphaned; `ApplyOutOfSyncOnly` apps need explicit sync.
  - Upgrade to 3.x: users lose log access / sub-resource update rights (fine-grained RBAC change).
  - Helm `lookup` and random functions (`randAlphaNum`, generated certs) re-render each reconcile → constant diff/regenerated secrets.
  - Polling 3-minute default + many apps → Git provider rate limits; use webhooks, increase `timeout.reconciliation`, repo-server caching.
  - Single application-controller OOM with thousands of apps/huge clusters → shard controllers, exclude high-churn kinds.
  - `targetRevision: HEAD`/branch means anyone who can push to the branch can deploy to prod; protect branches, pin SHAs/tags for prod.
  - Secrets in Git (even base64) — leaks; use SOPS/External Secrets.
  - Argo CD managing itself without care (self-managed install) can lock you out after a bad sync.
  - Rollouts: AnalysisTemplate querying a metric that returns empty → `inconclusive`/failure depending on config; canary without traffic routing only scales replicas (percent ≈ replica ratio).
- **Interview hot topics**:
  - Push vs pull deployment; OpenGitOps principles.
  - How Argo CD detects and resolves drift (refresh, diff, self-heal).
  - Sync waves vs hooks; ordering CRDs, migrations (PreSync Job).
  - App-of-apps vs ApplicationSets.
  - Environment promotion strategies; why not branch-per-environment.
  - Multi-tenancy with AppProjects + RBAC.
  - Secrets in GitOps.
  - Blue/green vs canary with Argo Rollouts + automated analysis.
  - Scaling Argo CD (sharding, repo-server).
  - Argo CD vs Flux.
- **Executable-proof strategy**:
  - kind **v0.33.0** cluster + Argo CD **v3.5.x** installed from pinned upstream manifest (server-side apply); in-cluster Git server (Gitea or a plain `git-http-backend` container) so tests never hit the internet.
  - Test driver: bats/pytest calling `argocd` CLI (`app sync`, `app wait --health --sync`, `app diff` exit codes) — assert deterministic states: drift injected via `kubectl patch` → `OutOfSync` → self-heal restores; sync-wave ordering asserted via resource creation timestamps/hook Job logs; negative test: AppProject destination denial rejects sync; prune safety.
  - Chainsaw **v0.2.15** for declarative assert steps on Application status.
  - ApplicationSet generator output tests: apply ApplicationSet, assert generated Application set (list/git/matrix) — deterministic.
  - Rollouts: kubectl-argo-rollouts plugin + Prometheus in-cluster; AnalysisTemplate using `job` or `web` provider against a deterministic stub service (avoid flaky metrics); assert abort on failing analysis.
  - Offline fallback: render-only tests (`helm template`/`kustomize build` + kubeconform) to snapshot what Argo would apply.
  - Cannot prove locally: SSO with corporate IdP (use Dex static users), real Git provider webhooks (simulate with `curl` to `/api/webhook`), multi-cluster at scale (2 kind clusters as approximation).
  - mise pins: argocd CLI 3.5.x, kubectl-argo-rollouts 1.10.x, kind, kubectl, helm 4.
- **Overlaps / dedupe**:
  - K8s objects, CRDs, server-side apply, RBAC basics → kubernetes track.
  - Helm/Kustomize authoring → kubernetes track module 12 (argocd only covers how Argo renders them).
  - CI half of the pipeline (build/test/sign/push, bumping image tags in Git) → gitlab-ci track.
  - Prometheus queries for AnalysisTemplates → observability track.
  - Terraform vs GitOps for infra (Crossplane mention) → terraform track cross-link.

---

### Terraform (+ OpenTofu) — `technologies/terraform`

- **Current stable version(s)**:
  - Terraform **v1.17.0** (tag 2026-10-21; very fresh — changelog still headed "Unreleased" on the branch): variables/locals in provider requirements, `-minimal-refresh`, **Terraform Policy GA** (`-policies` on plan/apply/query) — https://github.com/hashicorp/terraform/blob/v1.17/CHANGELOG.md . Previous: **1.16.7** (1.16.0 on 2026-08-26: `import` blocks inside modules, `lifecycle { destroy = false }`, action `before_destroy/after_destroy` events, `terraform_data` `store` block, Mermaid graph output) — https://github.com/hashicorp/terraform/blob/v1.16/CHANGELOG.md ; 1.15 (2026-04-29: variables in module `source`/`version`, `deprecated` attribute on variables/outputs, `convert()`) — https://github.com/hashicorp/terraform/blob/v1.15/CHANGELOG.md . Security support: 1.16 & 1.15 (and now 1.17) — https://endoflife.date/terraform
  - Recommend pinning course to **1.16.x** until 1.17 has a patch release, with a 1.17 delta note (judgement call).
  - OpenTofu **v1.13.2** (2026-10-21; 1.13.0 on 2026-09-30): experimental symbol libraries and `-lint`, `convert`, OCI registry improvements, WinRM provisioner removed, macOS 13+ required — https://raw.githubusercontent.com/opentofu/opentofu/v1.13/CHANGELOG.md ; OpenTofu is a CNCF project https://www.cncf.io/projects/opentofu/
  - Licence: Terraform under **BSL 1.1 since v1.6 (Aug 2023)**; OpenTofu forked from 1.5.x under MPL-2.0; IBM acquired HashiCorp (closed Feb 2025 — from background knowledge, unverified here).
- **Authoritative syllabi used**:
  - **Terraform Associate (004)** — https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004 — tests **Terraform 1.12**; 003 retired 2026-01-08 (https://notes.kodekloud.com/docs/HashiCorp-Certified-Terraform-Associate-004/Course-Introduction/Whats-New-in-the-Terraform-Associate-004-Exam/page). Objectives: (1) IaC with Terraform, (2) Terraform fundamentals (providers, state), (3) Core workflow (init/validate/plan/apply/destroy/fmt), (4) Configuration (resource vs data, references, variables/outputs, complex types, expressions/functions, dependencies, **custom conditions**, sensitive data & Vault), (5) Modules (sources, scope, versions), (6) State management (local backend, locking, remote backend, drift), (7) Maintain infra (import, state CLI, verbose logging), (8) HCP Terraform (workspaces, projects, governance, integrations). New vs 003: lifecycle rules, custom validation, **ephemeral values & write-only arguments**, expanded HCP Terraform. HashiCorp doesn't publish percentage weights (unverified that none exist).
  - Terraform Authoring & Operations Professional (exists; objectives not checked — unverified).
  - Official docs: language https://developer.hashicorp.com/terraform/language , CLI, `terraform test` https://developer.hashicorp.com/terraform/language/tests , plugin framework; OpenTofu docs https://opentofu.org/docs/
- **Proposed modules** (12):
  1. **IaC & Terraform model** — declarative vs imperative IaC, desired state, Terraform's graph-based plan/apply, providers as plugins (gRPC protocol), multi-cloud reality; Terraform vs OpenTofu vs Pulumi vs CloudFormation vs Crossplane (GitOps for infra).
  2. **HCL semantics** — blocks/attributes, type system (primitive, collection, structural, `any`, optional attrs), expressions, `for`, splat, conditionals, functions (pure), `dynamic` blocks, string templates, `locals`, unknown values ("known after apply") and why.
  3. **Core workflow & CLI** — init (provider install, lock file `.terraform.lock.hcl`, plugin cache), validate, fmt, plan (refresh, `-refresh-only`, `-minimal-refresh` 1.17, saved plans), apply, destroy, `-target`/`-replace`, workspaces CLI, `TF_LOG`.
  4. **Providers & resources** — required_providers/version constraints, provider aliases & multi-region, resource vs data sources, meta-arguments (`count` vs `for_each` addressing, `depends_on`, `provider`, `lifecycle`: create_before_destroy, prevent_destroy, ignore_changes, replace_triggered_by, `destroy=false` 1.16), implicit vs explicit dependencies.
  5. **Variables, outputs, validation & secrets** — variable validation, preconditions/postconditions, `check` blocks, `sensitive`, **ephemeral variables/resources & write-only arguments**, `deprecated` (1.15), Vault provider patterns, secrets in state.
  6. **State internals** — state file format (JSON, serial, lineage), resource addressing, refresh & drift, backends (local, S3 with native `use_lockfile`, GCS, azurerm, `remote`/`cloud`), locking semantics & `force-unlock`, state CLI (`list/show/mv/rm`), `moved`/`removed`/`import` blocks vs CLI, partial-backend config, state encryption (OpenTofu-native).
  7. **Modules** — module structure, inputs/outputs, variable scope, sources (registry, git, OCI in OpenTofu), versioning, composition vs inheritance, refactoring with `moved`, module design anti-patterns (god modules, provider config inside modules).
  8. **Testing & quality** — `terraform test` (`.tftest.hcl`, run blocks, `command = plan|apply`, assertions, `expect_failures`, mock providers/overrides), `terraform validate`, tflint, policy as code (Terraform Policy GA in 1.17, OPA/Conftest, Sentinel), Terratest (Go) for integration.
  9. **Import, refactoring & drift** — `import` blocks + `-generate-config-out`, imports in modules (1.16), `removed` blocks, `moved`, refresh-only plans, drift detection schedules, `terraform query`/list resources (1.14+) for discovering unmanaged infra.
  10. **HCP Terraform & collaboration** — workspaces/projects, VCS-driven vs CLI vs API runs, remote execution, variable sets, run tasks, policy sets, private registry, Stacks overview, agents, cost; CI alternatives (Atlantis, GitLab-managed state/OpenTofu CI component).
  11. **Provider internals & authoring** — plugin framework, schema, CRUD + plan modification, diagnostics, import, acceptance tests (`TF_ACC`), how unknowns/deferred actions work; write a small provider.
  12. **Production & OpenTofu** — repo/state layout (blast radius, per-env state), pipelines (plan as artifact, apply exact saved plan), concurrency & locks, upgrades (provider/major bumps), BSL licence implications, OpenTofu differences (state encryption, `enabled`/dynamic `prevent_destroy` (unverified version), provider-defined functions, OCI registries, `-exclude`), migration path.
- **Gotchas & production failure modes**:
  - `count` over a list → removing an element in the middle shifts indexes and destroys/recreates everything after it; use `for_each` with stable keys.
  - Secrets (DB passwords, private keys from `tls_private_key`) stored in plaintext in state; `sensitive` only redacts CLI output — use ephemeral/write-only arguments and encrypted, access-controlled backends.
  - `terraform apply` without a saved plan in CI applies something different from what was reviewed.
  - Lost/stale lock after a killed CI job → `force-unlock` misuse while another apply runs → corrupted state.
  - `-target` used routinely → partial graphs, drift, dependencies skipped.
  - `ignore_changes = all` hides real drift; `ignore_changes` on tags fights with org-level tag policies.
  - `create_before_destroy` with unique-name resources (S3 bucket, IAM role names) → name collision failures.
  - Provider configuration inside reusable modules blocks `count/for_each` on modules and prevents removing the module (orphaned resources can't be destroyed).
  - Unpinned provider versions/missing lock file → new provider major on next `init` changes plans.
  - `depends_on` on a data source makes it read at apply time → perpetual "known after apply" diffs.
  - Renaming a resource without `moved` block → destroy + create (data loss for databases).
  - Upgrading from local to remote backend or splitting state without `state mv`/`moved` → duplicates or deletions.
  - `prevent_destroy` doesn't help if the block is deleted from config along with the resource (use `removed { lifecycle { destroy = false } }` / 1.16 `destroy = false`).
  - Large monolithic state → 20-minute plans and API rate limits on refresh; split states, `-refresh=false` sparingly, `-minimal-refresh`.
  - Mixing Terraform ≥1.6 and OpenTofu on the same state: state format compatible only up to divergence; new features (state encryption, 1.16 blocks) break the other tool.
  - HCP Terraform free tier/legacy plans changes affecting cost (unverified specifics).
- **Interview hot topics**:
  - State: why it exists, locking, remote backends, drift.
  - `count` vs `for_each`; `moved`/`import`/`removed` blocks.
  - Module design & versioning; mono vs multi-state layout.
  - Plan/apply in CI with approvals; saved plans.
  - Handling secrets (sensitive vs ephemeral vs Vault).
  - Dependency graph, implicit vs explicit dependencies, unknown values.
  - `terraform test` & policy as code.
  - Terraform vs OpenTofu (licence, features) vs Pulumi/Crossplane.
  - Importing existing infrastructure.
  - Blast radius and multi-environment strategy (workspaces vs directories).
- **Executable-proof strategy**:
  - `terraform test` with **mock providers** (`mock_provider`, `override_resource`) — fully offline and deterministic; includes negative tests via `expect_failures` on variable validation/preconditions.
  - Real-apply tests against local providers: `hashicorp/random`, `hashicorp/local`, `hashicorp/null`/`terraform_data`, and **kreuzwerker/docker v4.6.0** (manages containers/networks on the local Docker/Colima VM).
  - Cloud-like provider tests: **LocalStack v4.14.0** (AWS API emulation; note LocalStack licensing/auth-token changes for community image in 2026 — unverified, check before pinning) or MinIO for S3 backend; prove **state locking**: two concurrent applies against S3 backend with `use_lockfile = true` → second fails with lock error.
  - Plan snapshot tests: `terraform plan -out` + `terraform show -json` → assert JSON (jq/pytest) for resource counts/actions (e.g., `for_each` change = 1 update not N replaces).
  - Static: `terraform fmt -check`, `terraform validate`, tflint **v0.65.0**, Conftest **v0.71.1** against plan JSON; Terraform Policy (1.17) where available.
  - OpenTofu parity: run the same suite with `tofu` 1.13.2 via mise; mark tests that are tool-specific.
  - Cannot prove locally: HCP Terraform runs/Sentinel (fallback: documented CLI-driven `cloud` block + screenshots or a free HCP account outside CI), real cloud provider quirks (eventual consistency) → describe, use LocalStack approximations.
  - mise pins: terraform 1.16.x (or 1.17.0), opentofu 1.13.2, tflint, conftest, localstack CLI, jq.
- **Overlaps / dedupe**:
  - Cloud resource semantics (IAM, VPC, S3) → AWS/Azure/GCP tracks (owned elsewhere); terraform uses them only as examples.
  - Provisioning Kubernetes clusters → terraform; deploying workloads into K8s → argocd (avoid Terraform helm/kubernetes provider for apps — cross-link).
  - CI plan/apply pipeline → gitlab-ci track (terraform module 12 references it).
  - Policy-as-code (OPA/Rego) concepts → could be a shared `foundations/policy-as-code` mini-track or live in kubernetes security module; terraform cross-links.
  - Secrets management (Vault) → separate track if any; cross-link only.

---

### Observability (OpenTelemetry, Prometheus, Grafana LGTM, Kibana/Elastic Observability) — `technologies/observability`

- **Current stable version(s)** (tag dates):
  - OpenTelemetry Collector (releases repo) **v0.164.0** (2026-10-26); semantic conventions **v1.44.0**. Collector distribution is still 0.x (pdata/core modules have 1.x — unverified detail).
  - Prometheus **v3.15.1** (2026-10-21); Alertmanager **v0.34.1**. Prometheus 3.0 (Nov 2024) introduced UTF-8 metric/label names, OTLP ingestion, Remote Write 2.0, new UI — https://prometheus.io/blog/2024/11/14/prometheus-3-0/
  - Grafana **v13.3.0** (2026-10-27; 13.0.0 on 2026-04-14). 13.0: Git Sync GA, dynamic dashboards GA/default (new schema), `/api` deprecated for `/apis`, `grafana-cli/grafana-server` binaries removed, Image Renderer plugin removed, 13.0.0 migration bug with Git Sync (upgrade to 13.0.1+ after DB backup) — https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v13-0/
  - Loki **v3.7.9**, Tempo **v3.1.1** (Tempo 3.x is a major line), Mimir **3.2.3**, Alloy **v1.21.2**. **Promtail EOL March 2026** → Alloy — https://community.grafana.com/t/promtail-is-now-end-of-life-eol-how-to-migrate-to-grafana-alloy-for-existing-loki-server-deployments/162087 ; Grafana Agent also replaced by Alloy (EOL date unverified).
  - Kibana / Elasticsearch **v9.5.5** (2026-09-30); APM Server 9.5.5. Elastic Observability ingests OTel natively via EDOT (Elastic Distributions of OpenTelemetry) (feature details unverified). Elastic licence: ELv2/SSPL plus AGPLv3 option since 2024 (background knowledge, unverified here).
  - k6 **v2.3.0** (load generation for SLO demos), Pyrra **v0.10.2** / Sloth **v0.16.0** (SLO rule generators).
- **Authoritative syllabi used**:
  - **PCA** (Prometheus Certified Associate), https://github.com/cncf/curriculum `PCA_Curriculum.pdf`: PromQL 28% · Prometheus Fundamentals 20% · Observability Concepts 18% · Alerting & Dashboarding 18% · Instrumentation & Exporters 16%.
  - **OTCA** (OpenTelemetry Certified Associate), `OTCA_Curriculum.pdf`: OTel API & SDK 46% · OTel Collector 26% · Fundamentals of Observability 18% · Maintaining & Debugging Pipelines 10%.
  - Elastic Certified Observability Engineer (Elastic training; current objectives not checked — unverified). Grafana certifications (unverified).
  - Primary docs: OTel spec https://opentelemetry.io/docs/specs/ , semconv https://opentelemetry.io/docs/specs/semconv/ ; Prometheus docs https://prometheus.io/docs/ ; Grafana/Loki/Tempo/Mimir/Alloy docs https://grafana.com/docs/ ; Elastic Observability docs https://www.elastic.co/docs/solutions/observability ; Google SRE Book/Workbook (SLOs, alerting on burn rate) https://sre.google/books/
- **Proposed modules** (13):
  1. **Observability foundations** — monitoring vs observability, signals (metrics/logs/traces/profiles/events), cardinality & dimensionality, push vs pull, sampling, USE/RED/golden signals, cost model.
  2. **OpenTelemetry model** — API vs SDK separation, resources, semantic conventions, context & **W3C Trace Context/Baggage propagation**, spans (kinds, links, events, status), metrics instruments (counter, up-down, histogram, gauge, exemplars, temporality cumulative vs delta), logs bridge; OTLP.
  3. **Instrumentation in practice** — Node.js/TypeScript + Python SDKs, auto-instrumentation vs manual, zero-code agents, tail vs head sampling, span naming/attribute hygiene, metric naming (Prometheus vs OTel conventions, UTF-8), log correlation (trace_id in logs).
  4. **OpenTelemetry Collector** — receivers/processors/exporters/connectors/extensions, pipelines, batch/memory_limiter, transform (OTTL), tail_sampling, k8sattributes, deployment patterns (agent/daemonset vs gateway), scaling & load-balancing exporter, debugging pipelines (debug exporter, zpages, internal telemetry), Alloy as a Collector distribution.
  5. **Prometheus internals** — data model (series, labels, samples), exposition formats (text, OpenMetrics, protobuf), scraping & service discovery, relabeling, TSDB (head block, WAL, compaction, retention), native histograms, staleness, limits (single-node, no HA by itself).
  6. **PromQL mastery** — instant vs range vectors, selectors, `rate`/`irate`/`increase` (counter resets, extrapolation), aggregation `by/without`, binary ops & vector matching (`on/ignoring`, `group_left`), `histogram_quantile` (classic vs native), subqueries, recording rules, `absent`, offset/@ modifiers.
  7. **Alerting** — alerting rules, `for`/`keep_firing_for`, Alertmanager (routing tree, grouping, inhibition, silences, HA gossip), Grafana Alerting vs Prometheus alerting, alert design (symptom-based, actionable, runbooks), testing rules with `promtool test rules`.
  8. **SLOs** — SLI/SLO/SLA, error budgets, multi-window multi-burn-rate alerts, latency SLIs from histograms, SLO generators (Pyrra/Sloth), Grafana SLO / Elastic SLO features, reporting.
  9. **Logs: Loki** — label-indexed design vs full-text, streams & label cardinality, chunks/index (TSDB), LogQL (log & metric queries, parsers, line filters), structured metadata, Alloy pipelines (Promtail EOL), retention.
  10. **Traces: Tempo & scaling metrics: Mimir** — Tempo architecture (object storage, no index, TraceQL, metrics-generator → span metrics/service graphs), Mimir (horizontally scalable Prometheus: distributor/ingester/querier/store-gateway, hash ring, replication, tenancy), Prometheus remote write.
  11. **Grafana** — data sources, dashboards as code (dynamic dashboards/new schema, Git Sync GA, provisioning, Terraform provider/Grafonnet), variables, transformations, Explore & correlations (exemplars → traces, logs ↔ traces), RBAC/folders, Grafana Alerting.
  12. **Elastic Observability & Kibana** — Elastic Agent/Fleet vs Beats vs EDOT/OTel, APM (services, transactions, spans), data streams & ECS/OTel semconv mapping, Kibana Discover/Lens/dashboards, ES|QL in observability use, Kibana alerting rules & connectors, SLOs, Synthetics; when to pick Elastic vs LGTM.
  13. **Production observability** — cardinality explosions & cost control, sampling strategy, multi-tenancy, retention tiers, observability of the observability stack (meta-monitoring), K8s monitoring (kube-state-metrics, cAdvisor, kube-prometheus-stack), incident workflow, eBPF-based auto-instrumentation (overview), continuous profiling (Pyroscope) overview.
- **Gotchas & production failure modes**:
  - Putting user IDs/request IDs/URLs with IDs into metric labels → cardinality explosion, Prometheus OOM, Mimir per-tenant limits rejecting samples.
  - Using high-cardinality labels in Loki (e.g. `trace_id`, `user_id` as labels) → millions of tiny streams, ingester OOM; put them in structured metadata/log line.
  - `rate()` over a range shorter than 2× scrape interval → empty/gappy results; `irate` in alerting = noisy.
  - `sum(rate(x[5m]))` vs `rate(sum(x)[5m])` — summing counters before rate breaks reset handling.
  - Averaging percentiles (`avg(histogram_quantile(...))`) is mathematically wrong; aggregate buckets first (`sum by (le)`).
  - Histogram bucket boundaries not covering the SLO threshold → SLI can't be computed precisely.
  - Alert without `for` flaps; alert on `absent()` forgotten → silent failure when the target disappears (scrape broken = no alert).
  - Alertmanager `group_by` too coarse → one page hides 50 incidents; too fine → paging storm.
  - Head sampling at 1% drops the rare error traces you need; tail sampling in Collector requires all spans of a trace on the same instance (loadbalancing exporter by trace ID).
  - Collector without `memory_limiter` → OOM under backpressure, dropping all telemetry.
  - Broken context propagation across async boundaries (Node.js `AsyncLocalStorage` lost through custom promise libraries/queues) → disconnected traces.
  - Clock skew between hosts → negative span durations / out-of-order samples rejected by Prometheus/Mimir.
  - Prometheus "HA" pair without dedup → double-counted alerts/series in remote storage (need external labels + Mimir HA dedup).
  - Grafana 13.0.0 upgrade with Git Sync enabled could lose/revert dashboards (fixed 13.0.1; restore from backup).
  - Kibana alerting rules run on Kibana task manager — overloaded task manager delays alerts silently.
  - Elastic: dynamic mapping of arbitrary log fields → mapping explosion (field limit 1000) and rejected documents (deeper treatment in Elasticsearch track).
  - Promtail still deployed after March 2026 EOL → unpatched agent.
- **Interview hot topics**:
  - Metrics vs logs vs traces — when to use each; correlation via exemplars/trace IDs.
  - Cardinality: what it is, how to detect and control it.
  - `rate` vs `irate` vs `increase`; histograms vs summaries; computing p99 correctly.
  - Designing SLOs and burn-rate alerting.
  - OpenTelemetry architecture (API/SDK/Collector/OTLP), context propagation.
  - Sampling strategies (head vs tail).
  - Scaling Prometheus (federation vs remote write vs Mimir/Thanos).
  - Loki vs Elasticsearch for logs (index design trade-off).
  - Alert fatigue and good alert design.
  - Instrumenting a Node.js service end to end.
- **Executable-proof strategy**:
  - Docker Compose stack (pinned image tags): OTel Collector contrib 0.164.0, Prometheus 3.15.1, Alertmanager 0.34.1, Loki 3.7.9, Tempo 3.1.1, Grafana 13.3.0 (provisioned datasources/dashboards), optional Mimir 3.2.3 monolithic; separate Elastic compose (Elasticsearch + Kibana 9.5.5 + EDOT Collector) gated behind a profile because of RAM.
  - Most deterministic proofs need **no running stack**:
    - `promtool test rules` — unit tests for recording/alerting rules with synthetic series (`input_series`, `eval_time`, expected alerts) incl. negative tests (alert must NOT fire).
    - `promtool check config/rules`, `amtool check-config` and `amtool config routes test` (routing tree assertions).
    - PromQL semantics tests: `promtool test rules` with expressions comparing `rate` across counter resets.
    - `otelcol-contrib validate --config` for Collector configs; OTTL transforms tested via Collector with `file` receiver/exporter on fixtures → golden-file comparison.
    - SDK tests: OTel JS/Python **in-memory span/metric exporters** in vitest/pytest — assert span names, attributes, parent/child, propagation headers (deterministic).
    - Loki: `logcli`/LogQL against a short-lived Loki in Testcontainers; Alloy config `alloy fmt` + test pipeline.
    - Grafana dashboards: JSON schema lint + provisioning load test (Grafana starts and API returns dashboard) via Testcontainers; Grafana Terraform provider plan.
    - SLO rules: Sloth/Pyrra generate rules → promtool unit-tests the burn-rate alerts with synthetic error ratios.
    - Kibana: saved objects import via API in Testcontainers; ES|QL queries asserted on fixture data (heavier; mark optional).
  - Load: k6 2.3.0 scripts to drive deterministic error rates for SLO demos (not for CI assertions).
  - Cannot prove locally: real long-retention/scale behaviour (Mimir ring rebalancing, Tempo backend at scale), Grafana Cloud/Elastic Cloud managed features (Adaptive Metrics, Grafana SLO app, Elastic AI assistant) → describe + config validation only.
  - mise pins: prometheus (promtool), alertmanager (amtool), otelcol-contrib, logcli, alloy, k6, sloth; Node + Python OTel SDKs via package lockfiles.
- **Overlaps / dedupe**:
  - **Elasticsearch track (other agent)** owns: cluster architecture, shards/replicas, mappings & analyzers, query DSL, ES|QL language internals, aggregations, ILM/data tiers, performance. Observability owns: Elastic Agent/EDOT ingestion, APM data model, Kibana UI (Discover/Lens/dashboards), Kibana alerting/SLOs, Elastic vs LGTM decision — and cross-links ES internals.
  - K8s-specific monitoring components install → kubernetes track cross-links; observability shows the signals.
  - Distributed tracing concepts for microservices → could also be referenced by a system-design track; owned here.
  - Node.js async context (AsyncLocalStorage) internals → Node.js track; observability only uses it.
  - Argo Rollouts analysis queries → argocd track references PromQL module.

---

### CI/CD with GitLab — `technologies/gitlab-ci` (recommended: yes)

- **Current stable version(s)**: GitLab **19.x** (19.0 released 2026-05-21 — https://www.businesswire.com/news/home/20260521893408/en/ ; monthly releases on the third Thursday, so 19.5 likely current as of Oct 2026 — **unverified**). gitlab-ci-local **4.77.0** (third-party local runner emulator). GitLab Runner version not verified.
- **Authoritative syllabi used**: GitLab CI/CD YAML reference https://docs.gitlab.com/ci/yaml/ ; GitLab CI/CD docs ToC https://docs.gitlab.com/ci/ ; GitLab certifications (GitLab Certified CI/CD Associate — current availability unverified); SLSA spec https://slsa.dev/ ; CKS "Supply Chain Security 20%" domain.
- **Proposed modules** (9):
  1. CI/CD fundamentals — CI vs CD vs continuous deployment, trunk-based dev, pipeline as code, DORA metrics.
  2. GitLab CI model — stages vs `needs` DAG, jobs, rules/workflow rules, variables precedence, predefined variables, artifacts vs cache (keys, fallback), pipelines types (branch, MR, merged-results, tag, scheduled).
  3. Reuse — `include` (local/project/remote/template), CI/CD **components & catalog**, `extends`, YAML anchors/`!reference`, `spec:inputs`, parent-child & multi-project pipelines, dynamic child pipelines.
  4. Runners — architecture (runner manager, executors: docker, kubernetes, shell, docker-autoscaler), concurrency, tags, caching in distributed runners, building images in CI (BuildKit rootless/kaniko alternatives, docker-in-docker risks).
  5. Testing & quality gates — test reports (JUnit), coverage, parallel/matrix jobs, flaky test handling, merge trains, MR approvals.
  6. Security & supply chain — SAST/DAST/dependency/container scanning, secret detection, SBOM, cosign keyless signing with GitLab OIDC `id_tokens`, SLSA provenance, protected branches/variables/environments.
  7. Deployments — environments, review apps, deployment approvals, `resource_group` (serialize deploys), rollbacks; GitOps handoff (bump tag in config repo → Argo CD); Terraform/OpenTofu plan/apply pipelines with GitLab-managed state.
  8. Secrets & cloud auth — masked/hidden/protected variables, OIDC federation to AWS/GCP/Azure/Vault (no long-lived keys), GitLab Secrets Manager (19.0 — unverified detail).
  9. Pipeline performance & operations — pipeline efficiency (DAG, `interruptible`, `rules:changes`), cache strategy, monorepo pipelines, cost, debugging (`CI_DEBUG_TRACE` dangers).
- **Gotchas & production failure modes** (short list): `rules:changes` on scheduled/tag pipelines evaluates true → everything runs; duplicate pipelines (branch + MR) without `workflow:rules`; `CI_DEBUG_TRACE` leaks masked variables into logs; unprotected variables available to any branch → secret exfiltration via MR; docker-in-docker privileged runners shared across projects = container escape risk; cache shared across branches poisoning builds; `artifacts:expire_in` defaults filling storage; `only/except` mixed with `rules` (not allowed); `needs` across stages skipping implicit artifact downloads; non-`interruptible` jobs wasting runners; concurrent deploys without `resource_group`.
- **Interview hot topics**: pipeline design for a monorepo; CI vs CD vs GitOps boundaries; secure secrets & OIDC; supply-chain security (SBOM/sign/provenance); caching vs artifacts; deployment strategies & rollback; flaky tests; DORA metrics.
- **Executable-proof strategy**: `gitlab-ci-local` 4.77.0 runs `.gitlab-ci.yml` jobs locally in Docker (deterministic for job scripts, rules evaluation approximated — flag differences). Pipeline config validation needs a GitLab instance (CI Lint API) → fallback: run GitLab CE in Docker (heavy, optional profile) or validate against the published CI JSON schema (check-jsonschema). `gitlab-runner exec` was deprecated/removed — don't rely on it. Cosign signing/verify and SBOM generation testable locally (cosign 3.1.4, syft, trivy 0.76.1). Components with `spec:inputs` tested by rendering includes in a local GitLab CE (optional).
- **Overlaps / dedupe**: image building internals → containers; deploy targets → kubernetes/argocd; Terraform pipelines → terraform module 12 cross-link; DevSecOps concepts shared with CKS module in kubernetes; GitHub Actions only as comparison table.

---

## Cross-track shared foundations (proposed, owned elsewhere or new)
- `foundations/linux` — processes, signals, filesystems, permissions, systemd, networking (iptables/nftables, DNS) — prerequisite for containers & kubernetes.
- `foundations/distributed-systems` — consensus/Raft (etcd), replication, hash rings (Mimir/Loki), backpressure.
- Supply-chain security (SBOM, signing, SLSA) — owned by gitlab-ci; containers + kubernetes (CKS) cross-link.
- Policy-as-code (OPA/Rego, CEL, Kyverno) — small shared module, referenced by kubernetes security, terraform testing, argocd projects.

## Notable surprises / data-integrity caveats
- Kubernetes is already at **1.37** (1.34 went EOL 2026-10-27); CKA/CKAD curricula are on v1.37, **CKS curriculum still v1.34**.
- **Terraform 1.17.0** tagged only 7 days ago (2026-10-21); Terraform Associate 004 still targets **1.12** — exam content lags the tool by 5 minors.
- **Ingress-NGINX retired (March 2026)** and **Promtail EOL (March 2026)** — old tutorials are now wrong.
- **Podman 6** and **K8s 1.35+** both drop/disable cgroup v1; Docker 29 makes containerd image store default for new installs.
- CAPA is 48% Argo Workflows+Events — poor fit if the goal is Argo CD mastery; CGOA is a better certification fit.
- Argo CD 3.5 moved to Helm 4; Argo CD 3.6 is in RC.
- Version numbers from git tags; release-page dates may differ slightly. Items marked (unverified) were not confirmed against a primary source.
