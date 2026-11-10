# Kubernetes Interview Question Bank

Original interview-format questions for Kubernetes topics that sit outside the CKA, CKAD, and CKS certification domains. Topic coverage was inspired by the public roadmap.sh Kubernetes interview guide; the questions, answers, and examples are original and mapped to the official Kubernetes documentation. Use this bank alongside `cka-ckad-cks.md`.

## Interview Questions

### Q-INT-001 · Kubernetes Fundamentals · difficulty 1 · single

What is Kubernetes, and what problem does it solve?

- A) A container runtime that builds and runs images on a single host.
- B) An orchestration platform that schedules, scales, and reconciles containerized workloads across a cluster.
- C) A version-control system for infrastructure manifests.
- D) A monitoring stack for containers.

<details><summary>Answer</summary>

**B.** Kubernetes automates scheduling, scaling, service discovery, and self-healing for containers across many machines, so operators declare desired state and the control plane converges the cluster to it.

- Why not A: a container runtime such as containerd runs containers on one host; Kubernetes orchestrates many hosts.
- Why not C: version control stores manifests; Kubernetes acts on them.
- Why not D: monitoring is a separate concern that Kubernetes exposes data for.
- Ref: [modules/01-declarative-api-and-reconciliation.md](../modules/01-declarative-api-and-reconciliation.md), https://kubernetes.io/docs/concepts/overview/

</details>

### Q-INT-002 · Container Orchestration · difficulty 1 · single

What is the difference between Docker and Kubernetes?

- A) Docker builds and runs containers; Kubernetes schedules and manages them across a cluster.
- B) Docker is a Kubernetes CNI plugin.
- C) Kubernetes builds images; Docker runs them.
- D) They are interchangeable names for the same platform.

<details><summary>Answer</summary>

**A.** Docker (through the Docker Engine and image format) packages and runs containers, while Kubernetes orchestrates those containers across nodes. Kubernetes does not build images and, since the removal of dockershim, talks to runtimes through the Container Runtime Interface.

- Why not B: Docker is not a CNI plugin; Cilium and Calico are CNI plugins.
- Why not C: Kubernetes does not build images; it pulls them from a registry.
- Why not D: they operate at different layers of the stack.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://kubernetes.io/docs/concepts/architecture/cri/

</details>

### Q-INT-003 · Deployment Models · difficulty 1 · single

How does deploying an application on a host differ from deploying it in a container?

- A) A host deployment depends on the host's state; a container deployment packages the app and its dependencies into an immutable image.
- B) A container deployment requires no operating system.
- C) A host deployment is always faster than a container deployment.
- D) A container deployment cannot be rolled back.

<details><summary>Answer</summary>

**A.** Containers package the application with its runtime and libraries, so the same image runs identically on any node; host deployments depend on manual host configuration and drift over time.

- Why not B: containers share the host kernel and still require an OS.
- Why not C: startup time is not the defining difference.
- Why not D: container rollouts are rolled back with `kubectl rollout undo`.
- Ref: [modules/01-declarative-api-and-reconciliation.md](../modules/01-declarative-api-and-reconciliation.md), https://kubernetes.io/docs/concepts/overview/

</details>

### Q-INT-004 · Deployment Philosophy · difficulty 2 · scenario

A team currently SSHes into running Pods to edit configuration files. What is the problem with this approach, and what should they do instead?

- A) There is no problem; in-place edits are the fastest way to fix configuration.
- B) In-place edits are invisible to the desired state, so the next reconcile reverts them; the team should treat infrastructure as immutable and replace Pods with a new image or updated ConfigMap.
- C) SSH is slower than `kubectl exec`, so they should use `kubectl exec` instead.
- D) They should edit the Pod spec directly with `kubectl edit` and leave the container running.

<details><summary>Answer</summary>

**B.** Immutable infrastructure means changes are delivered by building a new artifact and replacing the old unit. A rolling update creates new Pods, waits for readiness, and only then terminates old Pods, so a bad change is rolled back with the previous ReplicaSet.

- Why not A: in-place edits diverge from the declared state and are reverted on the next apply or restart.
- Why not C: the tool is not the issue; the pattern is.
- Why not D: editing the Pod spec does not change the running container and is lost on recreation.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/deployment/

</details>

### Q-INT-005 · Multi-Tenancy · difficulty 2 · scenario

An organization wants to run several teams on one cluster. What mechanisms provide isolation, and what are the residual risks?

- A) Namespaces, RBAC, ResourceQuota, and NetworkPolicy provide logical isolation; containers still share the node kernel, so a kernel exploit can affect other tenants.
- B) Namespaces provide complete kernel-level isolation.
- C) Each team must have its own physical cluster; no shared cluster is possible.
- D) Multi-tenancy is solved entirely by the CNI plugin.

<details><summary>Answer</summary>

**A.** Namespaces partition names and RBAC scope, ResourceQuota caps resources, and NetworkPolicy restricts traffic. Containers on the same node share the kernel, so hard isolation requires separate node pools or sandboxed runtimes such as gVisor or user namespaces.

- Why not B: namespaces are logical, not kernel-level.
- Why not C: soft multi-tenancy on a shared cluster is a standard pattern.
- Why not D: the CNI enforces network policy, not tenant isolation.
- Ref: [modules/14-production-architecture-and-scale.md](../modules/14-production-architecture-and-scale.md), https://kubernetes.io/docs/concepts/security/multi-tenancy/

</details>

### Q-INT-006 · Cost Optimization · difficulty 2 · scenario

A team's cluster is overprovisioned and expensive. What is the most effective first step to reduce cost?

- A) Lower every container's memory limit.
- B) Measure actual usage, lower `requests` toward the observed P95, enable autoscaling, and consolidate underutilized nodes.
- C) Delete all `BestEffort` Pods.
- D) Switch every Service to `ExternalName`.

<details><summary>Answer</summary>

**B.** The scheduler reserves capacity based on `requests`, not limits or actual usage. Right-sizing requests toward real usage, then autoscaling and consolidating, removes reserved-but-unused capacity.

- Why not A: limits do not reduce reservations; requests do.
- Why not C: deleting BestEffort Pods removes workloads, not waste.
- Why not D: ExternalName maps to an external DNS name and does not affect compute cost.
- Ref: [modules/14-production-architecture-and-scale.md](../modules/14-production-architecture-and-scale.md), https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/

</details>

### Q-INT-007 · Organizational Change · difficulty 3 · scenario

An organization runs manual releases on VMs and wants to move to Kubernetes. What is a realistic sequence?

- A) Migrate every application at once, then build the platform.
- B) Containerize one stateless application, establish a CI/CD pipeline that pushes images and updates manifests, add health checks and autoscaling, then expand to more workloads.
- C) Buy a managed cluster and stop all releases until every team is retrained.
- D) Move the VMs into Pods unchanged.

<details><summary>Answer</summary>

**B.** A phased migration de-risks the change: a single stateless workload proves the pipeline, then health checks, autoscaling, and observability are added before stateful and critical workloads move.

- Why not A: a big-bang migration multiplies risk and gives no feedback loop.
- Why not C: stopping releases does not build the platform or the team's skills.
- Why not D: a VM in a Pod does not gain health checks, scaling, or self-healing.
- Ref: [modules/01-declarative-api-and-reconciliation.md](../modules/01-declarative-api-and-reconciliation.md), https://kubernetes.io/docs/concepts/overview/

</details>

### Q-INT-008 · Distributed Systems · difficulty 2 · single

What does the CAP theorem imply for etcd in a Kubernetes control plane?

- A) etcd is available and partition-tolerant, so it sacrifices consistency.
- B) etcd is consistent and partition-tolerant, so it sacrifices availability during a partition; it uses Raft to keep a majority quorum consistent.
- C) etcd is consistent and available, so it sacrifices partition tolerance.
- D) etcd ignores the CAP theorem.

<details><summary>Answer</summary>

**B.** etcd is a CP system: it keeps a consistent majority through Raft and stops accepting writes when it loses quorum, rather than serving inconsistent state.

- Why not A: etcd does not sacrifice consistency; it refuses writes without quorum.
- Why not C: etcd cannot remain available for writes during a partition.
- Why not D: all distributed stores make a CAP trade-off.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/

</details>

### Q-INT-009 · Service Mesh · difficulty 2 · scenario

When does a Kubernetes team need a service mesh, and what does it add beyond Services and NetworkPolicy?

- A) Always; a mesh replaces the CNI plugin.
- B) When the team needs mutual TLS, fine-grained traffic splitting, and uniform telemetry across many services without modifying each application.
- C) Never; Services and NetworkPolicy cover every requirement.
- D) Only when the cluster runs on a single node.

<details><summary>Answer</summary>

**B.** A service mesh such as Istio or Linkerd provides mTLS, traffic management, and observability as a platform layer, so application code does not implement cross-cutting concerns.

- Why not A: a mesh does not replace the CNI; it runs alongside it.
- Why not C: Services provide L4 load balancing and NetworkPolicy provides L3/L4 filtering, but not mTLS or L7 traffic splitting.
- Why not D: a mesh is most valuable in multi-service clusters, not single-node ones.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/

</details>

### Q-INT-010 · Reliability · difficulty 2 · scenario

How do you achieve a zero-downtime deployment of a web application in Kubernetes?

- A) Scale the Deployment to zero, update the image, then scale back up.
- B) Use a rolling update with readiness probes and a `preStop` hook so new Pods receive traffic only when ready and old Pods drain gracefully.
- C) Delete all Pods at once and let the ReplicaSet recreate them.
- D) Set `maxUnavailable` to 100% and `maxSurge` to 0.

<details><summary>Answer</summary>

**B.** A rolling update with `maxSurge` and `maxUnavailable` keeps capacity available, readiness probes prevent traffic from reaching unready Pods, and a `preStop` hook lets old Pods finish in-flight requests before termination.

- Why not A: scaling to zero creates a full outage.
- Why not C: deleting all Pods drops all capacity at once.
- Why not D: `maxUnavailable: 100%` removes all old Pods before new ones are ready.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/deployment/

</details>

### Q-INT-011 · Health Probes · difficulty 1 · single

What is the difference between a liveness probe and a readiness probe?

- A) A liveness probe restarts an unresponsive container; a readiness probe removes an unready Pod from Service endpoints without restarting it.
- B) A liveness probe removes a Pod from Service endpoints; a readiness probe restarts it.
- C) They are identical and interchangeable.
- D) A liveness probe is only used for Jobs.

<details><summary>Answer</summary>

**A.** Liveness failures restart the container; readiness failures stop traffic to the Pod while it keeps running.

- Why not B: the responsibilities are reversed.
- Why not C: they have distinct effects on the container and the endpoints.
- Why not D: Jobs use neither probe by default.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes

</details>

### Q-INT-012 · Supply Chain · difficulty 2 · scenario

A security team requires that only signed, scanned images run in production. Which controls enforce this?

- A) Image signatures verified at admission, an imagePullSecret for the private registry, and a vulnerability scan in the build pipeline.
- B) A NetworkPolicy that blocks egress to the registry.
- C) A Pod Security Standard baseline policy.
- D) A ResourceQuota on the `default` namespace.

<details><summary>Answer</summary>

**A.** Admission-time signature verification, registry credentials, and build-time scanning together enforce that only signed, clean images deploy.

- Why not B: blocking registry egress prevents pulls but does not verify signatures.
- Why not C: Pod Security Standards control Pod settings, not image provenance.
- Why not D: ResourceQuota limits resources, not image content.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/

</details>
