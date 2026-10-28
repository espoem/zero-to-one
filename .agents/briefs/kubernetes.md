# Brief: Kubernetes (`technologies/kubernetes`)

| | |
|---|---|
| Phase | 3 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/kubernetes` · `../zto-kubernetes` |
| Depends on | technologies/containers |
| Research dossier | `.agents/research/E-platform.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- CKA/CKAD curricula target 1.37 and CKS targets 1.34: add exam-delta callouts. Performance-based exams need hands-on tasks with verification scripts (kind/k3d pinned via mise).
- Ingress-NGINX is retired (Mar 2026): teach Gateway API, with a "Then vs now".
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Kubernetes control plane, workloads, Services/CNI/NetworkPolicy, RBAC, CRDs/operators, Helm/Kustomize authoring

**Cross-link only (do not re-explain):**
- Consensus (Paxos/Raft/ZAB), replicated state machines, leases & fencing, distributed locks → owned by `architecture/distributed-systems`
- TCP/IP, UDP, routing/BGP/anycast, NAT, DNS, congestion control → owned by `architecture/networking`
- PKI/X.509 validation, mTLS identity, cert lifecycle → owned by `architecture/security-identity`
- Authorization models (RBAC/ABAC/ReBAC, Zanzibar, Cedar, OpenFGA) → owned by `architecture/security-identity`
- Linux processes, signals, filesystems, namespaces, cgroups v2, overlayfs, seccomp → owned by `technologies/containers`
- OCI image/runtime/distribution specs, BuildKit, rootless, Docker vs Podman → owned by `technologies/containers`
- GitOps principles (OpenGitOps), Argo CD internals, Rollouts / progressive delivery → owned by `technologies/argocd`
- Policy-as-code (OPA/Rego, CEL, Kyverno, Terraform Policy): one shared module → owned by `technologies/terraform`
- CI/CD pipelines, SBOM, signing (cosign), SLSA provenance, OIDC-to-cloud from CI → owned by `technologies/gitlab-ci`
- OpenTelemetry, metrics/logs/traces, Prometheus/PromQL, LGTM, Kibana/Elastic Observability, alerting, SLO burn rates → owned by `technologies/observability`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Kubernetes — `technologies/kubernetes`

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

#### Context from `E-platform.md`

##### Structural decisions (summary)

| Question | Recommendation | Rationale |
|---|---|---|
| Docker vs Podman | **One track `technologies/containers`** | Both are front-ends over the same OCI image/runtime/distribution specs, same kernel primitives (namespaces, cgroups v2, overlayfs, seccomp), same runtimes (runc/crun). Splitting would duplicate ~70% of content. Tool differences (daemon vs daemonless, rootless defaults, Quadlet vs compose, Buildah/Skopeo) fit in 2 modules. |
| Kubernetes | **`technologies/kubernetes`**, prerequisite = containers | Single narrative covering CKA+CKAD; CKS content as late modules (security). |
| Argo CD | **Standalone `technologies/argocd`, scoped as "GitOps with Argo CD (+ Argo Rollouts)"** | Too deep (controller internals, sharding, ApplicationSets, hydrator, RBAC, multi-tenancy) to be one K8s module; but should not become an "all of Argo" track — CAPA is 36% Workflows + 12% Events, which are a different problem (batch/DAG). Cover CGOA (100%) + CAPA's Argo CD 34% + Rollouts 18%; Workflows/Events = one optional appendix module. Flux only as comparison. A separate `gitops` track is not justified (principles = 1 module). |
| Grafana / Kibana | **One track `technologies/observability`** (vendor-neutral spine: OTel + signals + SLOs; two backends: Grafana LGTM and Elastic) | The concepts (signals, cardinality, sampling, alerting, SLOs) are tool-independent; Grafana and Kibana are UIs over different stores. Boundary: the Elasticsearch track owns ES storage/indexing/mappings/query DSL/ES|QL internals/ILM; observability owns Kibana dashboards/Lens/Discover, alerting rules, Elastic Observability (APM, EDOT, Synthetics), and only cross-links ES internals. |
| CI/CD | **Yes: `technologies/gitlab-ci`** (smaller, 9–10 modules) | User uses GitLab; pipelines are where containers, Terraform, K8s and GitOps meet (build → scan → sign → push → update GitOps repo). Supply-chain security (SBOM, cosign, SLSA) lives here and is cross-linked from containers + CKS module. |

Suggested order: containers → kubernetes → (terraform in parallel) → argocd → gitlab-ci → observability.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- **kind v0.33.0** (node image for 1.37 — exact default image unverified) for multi-node clusters with kubeadm under the hood; **k3d v5.9.0** as lightweight alternative. Requires a container runtime on Mac (Docker Desktop / Colima / OrbStack / podman machine).

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/kubernetes` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(kubernetes)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/kubernetes.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/kubernetes.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
