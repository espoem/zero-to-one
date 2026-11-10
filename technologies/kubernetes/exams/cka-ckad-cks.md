# Certification Question Bank & Mock Exams (CKA, CKAD, CKS)

This question bank contains 186 original practice questions (61 CKA, 61 CKAD, 64 CKS) covering the Certified Kubernetes Administrator (CKA), Certified Kubernetes Application Developer (CKAD), and Certified Kubernetes Security Specialist (CKS) syllabi, followed by three complete mock exams.

---

## Part 1: CKA Question Bank (Q-K8S-001 to Q-K8S-061)

### Q-K8S-001 · CKA Troubleshooting · difficulty 1 · single

When troubleshooting a Pod stuck in `ContainerCreating`, which command best inspects cluster-level scheduling and mounting errors affecting the Pod?

- A) `kubectl logs pod/my-pod`
- B) `kubectl describe pod/my-pod`
- C) `kubectl exec -it my-pod -- sh`
- D) `kubectl top pod/my-pod`

<details><summary>Answer</summary>

**B.** `kubectl describe pod/my-pod` outputs detailed events (such as FailedMount, FailedScheduling, or OOMKilled) recorded by the kubelet and scheduler.

- Why not A: `kubectl logs` fails because container creation has not succeeded yet.
- Why not C: `kubectl exec` cannot enter a container that has not started.
- Why not D: `kubectl top` retrieves resource utilization from metrics-server, not scheduling events.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/

</details>

### Q-K8S-002 · CKA Cluster Architecture · difficulty 2 · scenario

An administrator needs to perform an offline backup of etcd state in a stacked control plane cluster. Which command correctly invokes `etcdctl` to capture a snapshot?

- A) `etcdctl snapshot save /backup/etcd.db --endpoints=https://127.0.0.1:2379`
- B) `ETCDCTL_API=3 etcdctl snapshot save /backup/etcd.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key`
- C) `kubectl get etcd -o yaml > /backup/etcd.yaml`
- D) `kubeadm backup etcd --output=/backup/etcd.db`

<details><summary>Answer</summary>

**B.** etcd requires API version 3 (`ETCDCTL_API=3`) and mutual TLS authentication certificates (`cacert`, `cert`, `key`) when communicating with the secure control plane etcd cluster.

- Why not A: Omitting TLS certificates results in connection rejection by etcd.
- Why not C: `kubectl get etcd` fails because etcd is a backing datastore accessed via API server, not a core resource.
- Why not D: `kubeadm` does not have a native `backup etcd` subcommand.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/#backing-up-an-etcd-cluster

</details>

### Q-K8S-003 · CKA Services & Networking · difficulty 2 · single

What is the primary function of `EndpointSlices` in Kubernetes networking compared to legacy `Endpoints`?

- A) They encrypt pod-to-pod traffic at the transport layer.
- B) They segment network endpoint information into smaller, scalable chunks to prevent large monolithic payloads when services back thousands of pods.
- C) They automatically generate DNS records for external databases.
- D) They replace CNI IPam plugins.

<details><summary>Answer</summary>

**B.** EndpointSlices group network endpoints logically, preventing performance degradation in the API server caused by massive monolithic Endpoints objects when services scale to thousands of backends.

- Why not A: Encryption is handled by mTLS meshes or CNI IPsec, not EndpointSlices.
- Why not C: DNS records are managed by CoreDNS, not EndpointSlices.
- Why not D: CNI IPam handles IP address allocation, whereas EndpointSlices track service backends.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/

</details>

### Q-K8S-004 · CKA Workloads & Scheduling · difficulty 1 · single

Which scheduling feature ensures that a critical monitoring pod is placed on every eligible worker node in the cluster automatically?

- A) Deployment with replicas equal to node count
- B) DaemonSet
- C) StatefulSet with anti-affinity
- D) CronJob running every minute

<details><summary>Answer</summary>

**B.** A DaemonSet ensures that all (or filtered) nodes run exactly one copy of a Pod, automatically adapting when new nodes join the cluster.

- Why not A: Deployments do not guarantee strict 1:1 node distribution.
- Why not C: StatefulSets manage ordered stateful replicas, not node-per-node mapping.
- Why not D: CronJobs execute batch tasks on schedules, not continuous daemon execution.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/

</details>

### Q-K8S-005 · CKA Storage · difficulty 2 · scenario

A persistent volume claim (PVC) remains in `Pending` state despite a StorageClass being configured with `volumeBindingMode: WaitForFirstConsumer`. What is the correct action to trigger provisioning?

- A) Restart the etcd cluster.
- B) Create a Pod that references the PVC, causing the scheduler to select a node before storage binding occurs.
- C) Manually format the backing disk on the worker node.
- D) Delete and recreate the StorageClass with `Immediate` binding mode.

<details><summary>Answer</summary>

**B.** `WaitForFirstConsumer` delays volume provisioning and binding until a Pod referencing the PVC is scheduled to a specific node, ensuring storage is provisioned in the correct availability zone.

- Why not A: Etcd restarts do not influence lazy volume binding.
- Why not C: Dynamic provisioning creates volumes automatically via CSI plugins upon pod scheduling.
- Why not D: Changing binding mode is unnecessary; scheduling the pod resolves the pending state.
- Ref: [modules/09-storage-and-csi.md](../modules/09-storage-and-csi.md), https://kubernetes.io/docs/concepts/storage/storage-classes/#volume-binding-mode

</details>

### Q-K8S-006 · CKA Troubleshooting · difficulty 2 · hands-on

Execute a live debugging session on a crashing Pod named `api-server-xyz` using an ephemeral debug container attached to its namespace without restarting the pod.

- A) `kubectl debug api-server-xyz -it --image=busybox:1.36 --target=app`
- B) `kubectl exec -it api-server-xyz -- /bin/sh`
- C) `kubectl rollout restart pod/api-server-xyz`
- D) `kubectl replace --force -f pod.yaml`

<details><summary>Answer</summary>

**A.** `kubectl debug` injects an ephemeral container into a running pod's namespaces for live troubleshooting without modifying or restarting the primary container.

- Why not B: `kubectl exec` fails if the container runtime is dead or missing debugging binaries.
- Why not C: `rollout restart` restarts the workload, losing transient crash state.
- Why not D: Force replacement deletes and recreates the pod.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/concepts/workloads/pods/ephemeral-containers/
- Verification: [`examples/ts/15-hands-on-verification.test.ts`](../examples/ts/15-hands-on-verification.test.ts) › "evaluateEphemeralDebugTarget resolves the target container"

</details>

### Q-K8S-007 · CKA Cluster Architecture · difficulty 1 · single

What is the primary role of the kube-apiserver component in the Kubernetes control plane?

- A) Executing container runtimes on worker nodes.
- B) Exposing the Kubernetes REST API, validating requests, and coordinating state between control plane and etcd.
- C) Routing internal cluster overlay network packets.
- D) Managing DNS records for cluster services.

<details><summary>Answer</summary>

**B.** The kube-apiserver is the frontend of the control plane, handling authentication, authorization, admission control, and RESTful CRUD operations against etcd.

- Why not A: The kubelet and CRI runtime execute containers.
- Why not C: CNI plugins and kube-proxy handle networking.
- Why not D: CoreDNS manages DNS records.
- Ref: [modules/02-control-plane-internals.md](../modules/02-control-plane-internals.md), https://kubernetes.io/docs/concepts/overview/components/#kube-apiserver

</details>

### Q-K8S-008 · CKA Services & Networking · difficulty 2 · multi

Which mechanisms are valid for exposing a Kubernetes Service externally to clients outside the cluster? (Select all that apply)

- A) ClusterIP
- B) NodePort
- C) LoadBalancer
- D) Gateway API HTTPRoute with external Gateway

<details><summary>Answer</summary>

**B, C, D.** NodePort, LoadBalancer, and Gateway API routing explicitly expose services or traffic externally.

- Why not A: ClusterIP restricts service accessibility strictly to internal cluster IPs.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/

</details>

### Q-K8S-009 · CKA Workloads & Scheduling · difficulty 2 · scenario

An administrator wants to ensure that specific memory-intensive cache pods are scheduled only on nodes labeled `hardware=high-memory`. Which pod spec field achieves this?

- A) `nodeName: high-memory`
- B) `tolerations: [{key: "hardware", operator: "Equal", value: "high-memory"}]`
- C) `affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution`
- D) `securityContext.runAsUser: 1000`

<details><summary>Answer</summary>

**C.** Node affinity (`requiredDuringSchedulingIgnoredDuringExecution`) constrains pod placement based on node labels.

- Why not A: `nodeName` bypasses the scheduler entirely and targets a hardcoded hostname.
- Why not B: Tolerations match taints, not node labels.
- Why not D: `securityContext` configures container privilege and user IDs.
- Ref: [modules/06-scheduling-and-topology.md](../modules/06-scheduling-and-topology.md), https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/

</details>

### Q-K8S-010 · CKA Storage · difficulty 1 · single

Which access mode allows a PersistentVolume to be mounted as read-write by a single node?

- A) ReadWriteMany (RWX)
- B) ReadOnlyMany (ROX)
- C) ReadWriteOnce (RWO)
- D) ReadWriteOncePod (RWOP)

<details><summary>Answer</summary>

**C.** `ReadWriteOnce` (RWO) specifies that the volume can be mounted as read-write by a single node.

- Why not A: RWX allows multiple nodes read-write access.
- Why not B: ROX allows multiple nodes read-only access.
- Why not D: RWOP restricts mounting to exactly a single Pod across the entire cluster.
- Ref: [modules/09-storage-and-csi.md](../modules/09-storage-and-csi.md), https://kubernetes.io/docs/concepts/storage/persistent-volumes/#access-modes

</details>

### Q-K8S-011 · CKA Troubleshooting · difficulty 3 · scenario

A cluster node transitions to `NotReady`. Which log file or journal service on the worker node should an administrator inspect first to diagnose kubelet failures?

- A) `/var/log/nginx/error.log`
- B) `journalctl -u kubelet -e`
- C) `/etc/kubernetes/manifests/etcd.yaml`
- D) `kubectl get events --all-namespaces`

<details><summary>Answer</summary>

**B.** `journalctl -u kubelet -e` displays the systemd journal logs for the local kubelet agent responsible for node health and container management.

- Why not A: Nginx logs are application-specific.
- Why not C: Etcd static pod manifest defines etcd, not kubelet runtime errors.
- Why not D: Cluster events show control plane summaries, but worker node internal failures require direct node journal inspection.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/

</details>

### Q-K8S-012 · CKA Cluster Architecture · difficulty 2 · ordering

Order the following steps in the Kubernetes API server request processing pipeline from initiation to storage:

1. Authentication
2. Authorization (RBAC)
3. Mutating Admission Webhooks
4. Object Schema Validation
5. Validating Admission Webhooks
6. etcd Persistence

- A) 1 -> 2 -> 3 -> 4 -> 5 -> 6
- B) 6 -> 5 -> 4 -> 3 -> 2 -> 1
- C) 2 -> 1 -> 3 -> 4 -> 5 -> 6
- D) 1 -> 3 -> 2 -> 4 -> 5 -> 6

<details><summary>Answer</summary>

**A.** Requests are first authenticated (1), authorized via RBAC (2), modified by mutating webhooks (3), validated against OpenAPI schemas (4), checked by validating webhooks (5), and finally persisted to etcd (6).

- Why not B, C, D: Incorrect execution order bypassing required security gates before persistence.
- Ref: [modules/02-control-plane-internals.md](../modules/02-control-plane-internals.md), https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/

</details>

### Q-K8S-013 · CKA Services & Networking · difficulty 2 · single

What tool or mechanism does Kubernetes use by default in standard cluster networking to assign IP addresses to Pods across nodes?

- A) DHCP server running on the control plane
- B) CNI (Container Network Institute) plugins such as Cilium or Calico
- C) Static IP configuration inside Dockerfiles
- D) kube-proxy IPtables NAT rules

<details><summary>Answer</summary>

**B.** CNI plugins manage container network interface attachment, IP allocation (IPAM), and pod-to-pod routing across worker nodes.

- Why not A: Kubernetes does not use DHCP for pod IPs.
- Why not C: Pod IPs are assigned dynamically at runtime by CNI.
- Why not D: kube-proxy handles Service load balancing, not Pod IP allocation.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/

</details>

### Q-K8S-014 · CKA Workloads & Scheduling · difficulty 2 · scenario

An administrator drains a worker node for maintenance, but a Pod without a controller or owner reference refuses to be evicted. Which `kubectl drain` flag forces the eviction of such non-replicated pods?

- A) `--ignore-daemonsets`
- B) `--delete-emptydir-data`
- C) `--force`
- D) `--timeout=0s`

<details><summary>Answer</summary>

**C.** `--force` bypasses the check preventing deletion of pods not managed by a ReplicationController, ReplicaSet, Job, DaemonSet, or StatefulSet.

- Why not A: `--ignore-daemonsets` specifically bypasses DaemonSet pods.
- Why not B: `--delete-emptydir-data` allows eviction of pods using local `emptyDir` volumes.
- Why not D: `--timeout` sets a deadline, not overriding pod ownership checks.
- Ref: [modules/06-scheduling-and-topology.md](../modules/06-scheduling-and-topology.md), https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/

</details>

### Q-K8S-015 · CKA Storage · difficulty 2 · single

Which volume type mounts an ephemeral temporary directory that shares the lifetime of the Pod and is cleared when the Pod terminates?

- A) PersistentVolumeClaim
- B) hostPath
- C) emptyDir
- D) nfs

<details><summary>Answer</summary>

**C.** `emptyDir` provides an ephemeral scratch directory created when a Pod is assigned to a node and deleted when the Pod is removed.

- Why not A: PVCs persist beyond pod lifecycles.
- Why not B: `hostPath` mounts node filesystem paths directly.
- Why not D: NFS mounts external network storage.
- Ref: [modules/09-storage-and-csi.md](../modules/09-storage-and-csi.md), https://kubernetes.io/docs/concepts/storage/volumes/#emptydir

</details>

### Q-K8S-016 · CKA Troubleshooting · difficulty 1 · single

What does an exit code of `137` in a container status typically indicate?

- A) Application encountered an unhandled syntax error.
- B) Container was terminated due to out-of-memory (OOMKilled) limitation.
- C) Successful execution completion (exit 0 equivalent).
- D) Configuration file missing.

<details><summary>Answer</summary>

**B.** Exit code 137 represents signal 9 (SIGKILL) + 128, indicating the container exceeded its memory limit and was terminated by the kernel OOM killer.

- Why not A: Syntax errors yield standard application exit codes (e.g., 1 or 255).
- Why not C: Exit 0 indicates success.
- Why not D: Missing config files usually yield application startup exit codes (1).
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/

</details>

### Q-K8S-017 · CKA Cluster Architecture · difficulty 2 · single

How does Server-Side Apply (SSA) prevent concurrent update conflicts in Kubernetes controllers?

- A) By locking the entire etcd database during updates.
- B) By tracking field-level ownership via managedFields metadata, allowing multiple controllers to update disjoint fields of the same object safely.
- C) By rejecting all incoming updates if generation numbers mismatch.
- D) By requiring optimistic locking via etcd transaction rolls.

<details><summary>Answer</summary>

**B.** Server-Side Apply records field managers in `metadata.managedFields`, enabling precise conflict detection when distinct actors modify overlapping fields.

- Why not A: Etcd does not lock entire databases for standard object updates.
- Why not C: SSA tracks fields, not rigid whole-object generation failures.
- Why not D: Optimistic locking handles resource versions, but SSA provides granular field ownership.
- Ref: [modules/01-declarative-api-and-reconciliation.md](../modules/01-declarative-api-and-reconciliation.md), https://kubernetes.io/docs/reference/using-api/server-side-apply/

</details>

### Q-K8S-018 · CKA Services & Networking · difficulty 2 · scenario

An administrator needs to troubleshoot why DNS resolution for internal services (e.g., `my-service.default.svc.cluster.local`) is failing inside pods. Which configuration file inside Linux container filesystems defines search domains and nameservers?

- A) `/etc/hosts`
- B) `/etc/resolv.conf`
- C) `/etc/kubernetes/kubelet.conf`
- D) `/etc/cni/net.d/10-flannel.conflist`

<details><summary>Answer</summary>

**B.** `/etc/resolv.conf` inside Linux containers defines DNS nameservers and search domains populated by CoreDNS and kubelet.

- Why not A: `/etc/hosts` maps static hostname IPs.
- Why not C: Kubelet config defines node daemon settings.
- Why not D: CNI config defines network bridging.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/

</details>

### Q-K8S-019 · CKA Workloads & Scheduling · difficulty 2 · single

What is the purpose of a PodDisruptionBudget (PDB)?

- A) To limit the maximum CPU consumption of a pod.
- B) To ensure that a minimum number or percentage of replicated pods remain available during voluntary disruptions such as node drains.
- C) To prevent pods from crashing due to memory pressure.
- D) To restrict network traffic between pods.

<details><summary>Answer</summary>

**B.** PDBs specify limits on the number of concurrent disruptions that can be experienced by a replicated workload during cluster maintenance.

- Why not A: CPU limits are managed via resource limits.
- Why not C: Memory pressure triggers eviction independent of PDBs.
- Why not D: Network traffic is governed by NetworkPolicies.
- Ref: [modules/06-scheduling-and-topology.md](../modules/06-scheduling-and-topology.md), https://kubernetes.io/docs/concepts/workloads/pods/disruptions/

</details>

### Q-K8S-020 · CKA Storage · difficulty 2 · scenario

A PersistentVolume is configured with `persistentVolumeReclaimPolicy: Retain`. What happens to the underlying storage asset when the associated PersistentVolumeClaim is deleted?

- A) The storage asset and all its data are automatically deleted.
- B) The storage asset is retained along with its data, requiring manual cleanup by an administrator before reuse.
- C) The storage asset is automatically migrated to backup storage.
- D) The storage asset is converted to a ReadOnly volume.

<details><summary>Answer</summary>

**B.** `Retain` ensures that deleting the PVC does not delete the physical storage backing asset, allowing manual recovery of data.

- Why not A: Deletion is performed under `Delete` policy.
- Why not C, D: Automatic migration or conversion are not reclaim policies.
- Ref: [modules/09-storage-and-csi.md](../modules/09-storage-and-csi.md), https://kubernetes.io/docs/concepts/storage/persistent-volumes/#reclaim-policy

</details>

### Q-K8S-021 · CKA Troubleshooting · difficulty 2 · single

What does `kubectl get pods --field-selector status.phase=Running` accomplish?

- A) Filters pods by name.
- B) Filters pods displayed in output to show only those currently in the Running phase.
- C) Filters pods by node assignment.
- D) Displays pods sorted by CPU usage.

<details><summary>Answer</summary>

**B.** Field selectors allow querying Kubernetes API resources based on resource field values such as `status.phase`.

- Why not A: Name filtering uses label selectors or name arguments.
- Why not C: Node filtering uses `spec.nodeName`.
- Why not D: Sorting requires `--sort-by`.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/concepts/overview/working-with-objects/field-selectors/

</details>

### Q-K8S-022 · CKA Cluster Architecture · difficulty 2 · single

What consensus algorithm does etcd use to replicate state and maintain high availability across control plane nodes?

- A) Paxos
- B) Raft
- C) PBFT (Practical Byzantine Fault Tolerance)
- D) Two-Phase Commit

<details><summary>Answer</summary>

**B.** etcd implements the Raft consensus algorithm for leader election and replicated log consistency.

- Why not A: Paxos is a consensus family, but etcd explicitly implements Raft.
- Why not C: PBFT handles Byzantine failures, which etcd does not assume.
- Why not D: Two-phase commit is a distributed transaction protocol, not cluster consensus.
- Ref: [modules/02-control-plane-internals.md](../modules/02-control-plane-internals.md), https://etcd.io/docs/v3.7/learning/why/

</details>

### Q-K8S-023 · CKA Services & Networking · difficulty 2 · scenario

An administrator applies a NetworkPolicy with an empty `ingress: []` rule and no spec rules to a namespace. What is the resulting network behavior for pods in that namespace?

- A) All inbound and outbound traffic is allowed.
- B) Default deny all inbound ingress traffic to pods in the namespace.
- C) All traffic is dropped across the entire cluster.
- D) DNS traffic is explicitly disabled.

<details><summary>Answer</summary>

**B.** Selecting a namespace with a NetworkPolicy that specifies an empty ingress list enforces a default-deny policy for all incoming traffic to pods matching the pod selector.

- Why not A: Default-deny applies when isolation rules are declared.
- Why not C: Cluster-wide dropping requires explicit cluster-wide policies; default-deny is namespace-scoped.
- Why not D: DNS requires explicit egress rules if egress isolation is enabled.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/network-policies/

</details>

### Q-K8S-024 · CKA Workloads & Scheduling · difficulty 2 · single

What is the purpose of taints applied to Kubernetes nodes?

- A) To grant administrative permissions to pods.
- B) To repel a set of pods unless those pods explicitly tolerate the taint.
- C) To allocate dedicated persistent storage volumes.
- D) To accelerate network packet routing.

<details><summary>Answer</summary>

**B.** Taints allow a node to repel a set of pods, working in tandem with tolerations on pods to control placement.

- Why not A: Permissions are managed via RBAC ServiceAccounts.
- Why not C: Storage is handled by PVCs and StorageClasses.
- Why not D: Network routing is managed by CNI and kube-proxy.
- Ref: [modules/06-scheduling-and-topology.md](../modules/06-scheduling-and-topology.md), https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/

</details>

### Q-K8S-025 · CKA Storage · difficulty 2 · single

Which component is responsible for communicating with storage backend APIs to provision and attach volumes in a CSI-compliant architecture?

- A) kube-apiserver
- B) CSI External-Provisioner and External-Attacher sidecars
- C) CoreDNS
- D) kube-proxy

<details><summary>Answer</summary>

**B.** CSI sidecar controllers (external-provisioner, external-attacher) watch PVCs and API state, invoking the storage plugin vendor's CSI driver controller RPCs.

- Why not A: Apiserver exposes the API, but does not drive storage vendor RPCs.
- Why not C: CoreDNS handles DNS.
- Why not D: kube-proxy handles service iptables/IPVS routing.
- Ref: [modules/09-storage-and-csi.md](../modules/09-storage-and-csi.md), https://kubernetes.io/docs/concepts/storage/volumes/#csi

</details>

---

### Q-K8S-026 · CKA Troubleshooting · difficulty 1 · single

A Pod remains in `Pending` with the event `FailedScheduling: 0/3 nodes are available: 3 Insufficient memory`. What is the most likely cause?

- A) The container image referenced by the Pod does not exist in the registry.
- B) No node has enough allocatable memory to satisfy the Pod's `resources.requests.memory`.
- C) The Pod's `livenessProbe` is failing repeatedly.
- D) The kubelet on every node has stopped reporting heartbeats.

<details><summary>Answer</summary>

**B.** The scheduler's `NodeResourcesFit` filter removes nodes whose allocatable memory is below the Pod's requested memory, so the Pod cannot be placed.

- Why not A: a missing image produces `ImagePullBackOff` after the Pod is scheduled, not `FailedScheduling`.
- Why not C: probes run only after the container starts; they never block scheduling.
- Why not D: NotReady nodes are filtered out, but the event would name node readiness rather than insufficient memory.
- Ref: [modules/06-scheduling-and-topology.md](../modules/06-scheduling-and-topology.md), https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/

</details>

### Q-K8S-027 · CKA Troubleshooting · difficulty 2 · scenario

A Deployment's Pods are in `CrashLoopBackOff`. `kubectl logs` shows `Error: Cannot find module '/app/server.js'`. What is the most likely cause?

- A) The Pod's `resources.limits.memory` is too low.
- B) The container image was rebuilt without copying the application code into the image.
- C) The Pod's `readinessProbe` is misconfigured.
- D) The node is under memory pressure and evicting the Pod.

<details><summary>Answer</summary>

**B.** The application entrypoint is missing from the image, so the container exits immediately and the kubelet restarts it with exponential backoff.

- Why not A: a low memory limit causes `OOMKilled` (exit code 137), not a missing-module error.
- Why not C: a failing readiness probe removes the Pod from Service endpoints but does not restart the container.
- Why not D: node pressure causes eviction with a `Disrupting` event, not a missing file.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/

</details>

### Q-K8S-028 · CKA Troubleshooting · difficulty 2 · scenario

A Pod is in `ImagePullBackOff`. `kubectl describe pod` shows `Failed to pull image "registry.example.com/app:v9": manifest unknown`. What is the most likely cause?

- A) The node's container runtime is not running.
- B) The image tag `v9` does not exist in the registry.
- C) The Pod's ServiceAccount lacks RBAC permissions.
- D) The node has insufficient disk space.

<details><summary>Answer</summary>

**B.** `manifest unknown` means the registry has no such tag; the image reference is wrong or the tag was deleted.

- Why not A: a stopped runtime produces a runtime sandbox error, not `manifest unknown`.
- Why not C: RBAC controls API calls, not registry pulls; image pulls use the node's registry credentials.
- Why not D: insufficient disk produces `InsufficientDeviceSpace` or `no space left on device`.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/

</details>

### Q-K8S-029 · CKA Troubleshooting · difficulty 3 · scenario

A three-member etcd cluster loses two members to a network partition. What is the immediate effect on the Kubernetes control plane?

- A) The API server continues to serve reads and writes from the remaining member.
- B) The API server can serve reads from the remaining member but rejects all writes.
- C) The cluster loses quorum, the API server can no longer persist changes, and reads may be stale.
- D) The scheduler takes over etcd's role and serves cached state.

<details><summary>Answer</summary>

**C.** etcd requires a majority quorum ($Q = \lfloor N/2 \rfloor + 1 = 2$ for $N=3$) to accept writes and elect a leader. With one member left, the cluster loses quorum, the API server cannot persist changes, and reads may be stale.

- Why not A: a single member cannot form a quorum, so the cluster cannot accept writes.
- Why not B: the primary failure is quorum loss; etcd does not continue serving consistent writes.
- Why not D: the scheduler has no etcd replacement and depends on the API server.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/

</details>

### Q-K8S-030 · CKA Troubleshooting · difficulty 2 · scenario

After applying a NetworkPolicy with `policyTypes: [Ingress, Egress]` and `egress: []` to a namespace, Pods can no longer resolve external hostnames. Why?

- A) The NetworkPolicy blocks the kubelet's health checks.
- B) The empty egress rule denies all outbound traffic, including DNS queries to CoreDNS.
- C) The NetworkPolicy disables the CNI plugin.
- D) The Pods' `/etc/resolv.conf` was rewritten.

<details><summary>Answer</summary>

**B.** NetworkPolicy rules are additive; an empty `egress: []` denies all egress, including UDP and TCP port 53 to the DNS Service.

- Why not A: kubelet probes are node-to-Pod traffic, not affected by the Pod's egress policy.
- Why not C: NetworkPolicy does not disable the CNI; it only programs rules the CNI enforces.
- Why not D: `resolv.conf` is set by the kubelet at Pod creation and is not changed by NetworkPolicy.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/network-policies/

</details>

### Q-K8S-031 · CKA Troubleshooting · difficulty 2 · scenario

A worker node is `NotReady`. `journalctl -u kubelet` shows `x509: certificate has expired or is not yet valid`. What is the most likely cause?

- A) The node's container runtime socket is missing.
- B) The kubelet client certificate has expired.
- C) The API server's etcd is full.
- D) The node's CNI plugin crashed.

<details><summary>Answer</summary>

**B.** The kubelet's client certificate authenticates it to the API server; an expired certificate causes the API server to reject the kubelet's heartbeats, marking the node `NotReady`.

- Why not A: a missing runtime socket produces runtime errors, not x509 errors.
- Why not C: etcd being full produces `NOSPACE` errors on writes, not kubelet x509 errors.
- Why not D: a crashed CNI produces network errors, not certificate errors.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/

</details>

### Q-K8S-032 · CKA Troubleshooting · difficulty 3 · scenario

A Pod is stuck in `Terminating` after `kubectl delete pod`. `kubectl get pod` shows a `metadata.finalizers` entry whose controller no longer exists. What is the correct recovery?

- A) Restart the kubelet on the node.
- B) `kubectl patch pod <name> --type=merge -p '{"metadata":{"finalizers":null}}'` to remove the stale finalizer.
- C) Delete the node object.
- D) Recreate the Pod with the same name.

<details><summary>Answer</summary>

**B.** A finalizer blocks deletion until its controller removes it; if the controller is gone, an administrator can remove the finalizer manually.

- Why not A: restarting the kubelet does not clear finalizers; the API server still blocks deletion.
- Why not C: deleting the node object does not delete the Pod and causes other problems.
- Why not D: the Pod still exists, so recreation fails with an already-exists error.
- Ref: [modules/01-declarative-api-and-reconciliation.md](../modules/01-declarative-api-and-reconciliation.md), https://kubernetes.io/docs/concepts/architecture/garbage-collection/

</details>

### Q-K8S-033 · CKA Troubleshooting · difficulty 2 · scenario

A Pod is evicted with the event `The node was low on resource: memory`. What determines whether a Pod is evicted first under node memory pressure?

- A) The Pod's `spec.priorityClassName`.
- B) The Pod's QoS class and whether its memory usage exceeds its requests.
- C) The Pod's creation time.
- D) The Pod's `restartPolicy`.

<details><summary>Answer</summary>

**B.** The kubelet ranks Pods for eviction by QoS class (BestEffort first, then Burstable, then Guaranteed) and by whether usage exceeds requests.

- Why not A: PriorityClass affects preemption and scheduling, not eviction order.
- Why not C: creation time does not determine eviction order.
- Why not D: `restartPolicy` determines whether the kubelet restarts the container, not eviction priority.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/

</details>

### Q-K8S-034 · CKA Troubleshooting · difficulty 1 · single

Which command lists only the events that involve a specific Pod named `web-0`?

- A) `kubectl get events --field-selector involvedObject.name=web-0`
- B) `kubectl get events --filter pod=web-0`
- C) `kubectl describe pod web-0 --events`
- D) `kubectl logs web-0 --events`

<details><summary>Answer</summary>

**A.** `--field-selector` with `involvedObject.name` filters events by the involved object.

- Why not B: `--filter` is not a kubectl flag.
- Why not C: `describe pod` shows events but has no `--events` flag.
- Why not D: `logs` has no `--events` flag.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/

</details>

### Q-K8S-035 · CKA Troubleshooting · difficulty 3 · scenario

After etcd hits its backend quota, `kubectl apply` fails with `etcdserver: mvcc: database space exceeded`. What is the correct recovery sequence?

- A) Restart the API server, then etcd.
- B) Disarm the NOSPACE alarm, compact etcd, then defragment.
- C) Compact and defragment etcd, then disarm the NOSPACE alarm.
- D) Delete old Pods until the quota is freed.

<details><summary>Answer</summary>

**C.** Compaction rewrites the database to the latest revision, defragmentation reclaims the freed space, and disarming the alarm restores writes.

- Why not A: restarting does not reclaim space or disarm the alarm.
- Why not B: disarming the alarm before compaction leaves the database full and writes still fail.
- Why not D: deleting Pods does not reduce etcd's physical database size; defragmentation is required.
- Ref: [modules/14-production-architecture-and-scale.md](../modules/14-production-architecture-and-scale.md), https://etcd.io/docs/v3.7/op-guide/maintenance/

</details>

### Q-K8S-036 · CKA Troubleshooting · difficulty 2 · scenario

A Pod is in `ContainerCreating` with the event `FailedMount: unable to mount volume "data": mount failed: exit status 32`. What is the most likely cause?

- A) The Pod's `livenessProbe` is failing.
- B) The PersistentVolumeClaim is not bound or the CSI node plugin cannot mount the volume.
- C) The Pod's ServiceAccount is missing.
- D) The node's CNI plugin is down.

<details><summary>Answer</summary>

**B.** `FailedMount` comes from the kubelet's volume manager; the PVC is not bound or the CSI node mount failed.

- Why not A: probes run only after mounting.
- Why not C: ServiceAccounts do not affect volume mounts.
- Why not D: CNI issues produce network errors, not mount errors.
- Ref: [modules/09-storage-and-csi.md](../modules/09-storage-and-csi.md), https://kubernetes.io/docs/concepts/storage/persistent-volumes/

</details>

### Q-K8S-037 · CKA Troubleshooting · difficulty 2 · hands-on

A node named `worker-2` is reported `NotReady`. Which command displays the node's conditions (`Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`) and their reasons?

- A) `kubectl get node worker-2`
- B) `kubectl describe node worker-2`
- C) `kubectl top node worker-2`
- D) `kubectl get events --field-selector involvedObject.name=worker-2`

<details><summary>Answer</summary>

**B.** `kubectl describe node` prints the conditions table with status, last heartbeat, and reason.

- Why not A: `get node` shows only the STATUS column and labels.
- Why not C: `top node` shows resource usage, not conditions.
- Why not D: events show recent happenings, not the full conditions table.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/concepts/architecture/nodes/
- Verification: [`examples/ts/15-hands-on-verification.test.ts`](../examples/ts/15-hands-on-verification.test.ts) › "classifyNodeConditions reports Ready and NotReady from the Ready condition"

</details>

### Q-K8S-038 · CKA Troubleshooting · difficulty 2 · scenario

A Pod's external DNS lookups are consistently slow, while internal lookups such as `kubernetes.default.svc.cluster.local` are fast. `kubectl exec` shows `/etc/resolv.conf` contains `search default.svc.cluster.local svc.cluster.local cluster.local` and `options ndots:5`. Why are the external lookups slow?

- A) The Pod's NetworkPolicy blocks UDP 53.
- B) `api.stripe.com` has fewer than five dots, so the resolver issues several search-domain queries before the absolute lookup succeeds.
- C) CoreDNS is not running.
- D) The Pod's ServiceAccount lacks DNS permissions.

<details><summary>Answer</summary>

**B.** With `ndots:5`, a name with fewer than five dots is first tried as `api.stripe.com.default.svc.cluster.local` and with the other search domains, adding several failed queries before the absolute lookup succeeds; the extra round trips dominate the latency.

- Why not A: if UDP 53 were blocked, the internal name would also fail.
- Why not C: CoreDNS being down would break internal resolution too.
- Why not D: DNS resolution does not use ServiceAccount permissions.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/

</details>

### Q-K8S-039 · CKA Cluster Architecture · difficulty 1 · single

What role does a node play in a Kubernetes cluster?

- A) A logical grouping of Pods that share storage and network.
- B) A worker machine, physical or virtual, that runs Pods and is managed by the control plane.
- C) A control plane component that schedules Pods.
- D) A namespace-scoped workload controller.

<details><summary>Answer</summary>

**B.** A node is a worker machine; the kubelet runs on it and reports to the control plane.

- Why not A: that describes a Pod.
- Why not C: that describes the scheduler.
- Why not D: that describes a controller such as a Deployment.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://kubernetes.io/docs/concepts/architecture/nodes/

</details>

### Q-K8S-040 · CKA Cluster Architecture · difficulty 1 · single

What is the primary purpose of a Kubernetes Namespace?

- A) To isolate network traffic between Pods.
- B) To provide a virtual cluster boundary for naming and RBAC scope within a physical cluster.
- C) To allocate CPU and memory quotas to Nodes.
- D) To define the Pod's restart policy.

<details><summary>Answer</summary>

**B.** Namespaces partition cluster resources by name and provide the scope for RBAC and ResourceQuota.

- Why not A: network isolation is provided by NetworkPolicy.
- Why not C: quotas are attached to namespaces, not nodes, and CPU and memory allocation is set by requests and limits.
- Why not D: `restartPolicy` is a Pod field.
- Ref: [modules/14-production-architecture-and-scale.md](../modules/14-production-architecture-and-scale.md), https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/

</details>

### Q-K8S-041 · CKA Cluster Architecture · difficulty 2 · scenario

An administrator has two clusters (`staging` and `production`) in `~/.kube/config` and needs to switch the active cluster without editing the file. Which command changes the current context?

- A) `kubectl config use-context staging-admin`
- B) `kubectl config set-cluster staging`
- C) `kubectl config set-credentials staging`
- D) `kubectl cluster-info --context staging-admin`

<details><summary>Answer</summary>

**A.** `kubectl config use-context` sets `current-context`, which selects the cluster, user, and namespace used by subsequent commands.

- Why not B: `set-cluster` defines or modifies a cluster entry, not the active context.
- Why not C: `set-credentials` defines a user entry.
- Why not D: `cluster-info` displays information and does not change the context.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/

</details>

### Q-K8S-042 · CKA Cluster Architecture · difficulty 2 · single

Which three top-level sections of a kubeconfig file does a context bind together?

- A) `clusters`, `users`, and `contexts`
- B) `pods`, `services`, and `namespaces`
- C) `apiVersion`, `kind`, and `metadata`
- D) `certificates`, `tokens`, and `passwords`

<details><summary>Answer</summary>

**A.** A context references a cluster, a user, and a namespace; `current-context` selects the active context.

- Why not B: those are API resources, not kubeconfig sections.
- Why not C: those are object metadata fields.
- Why not D: those are credential types, not top-level kubeconfig sections.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/

</details>

### Q-K8S-043 · CKA Cluster Architecture · difficulty 3 · scenario

A production cluster runs a stacked etcd control plane with three control plane nodes. One node fails. Which statement is true?

- A) The cluster loses quorum and all writes fail.
- B) The cluster retains quorum and continues serving reads and writes.
- C) The cluster loses quorum but continues serving writes from the cached API server.
- D) The cluster automatically removes the failed member and rebalances.

<details><summary>Answer</summary>

**B.** A three-member etcd tolerates one failure ($Q=2$); the remaining two members retain quorum and continue serving.

- Why not A: losing one of three members leaves a majority.
- Why not C: without quorum, etcd does not accept writes.
- Why not D: etcd does not automatically remove members; an administrator must remove the failed member.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/

</details>

### Q-K8S-044 · CKA Cluster Architecture · difficulty 2 · ordering

Order the steps to upgrade a kubeadm control plane node from v1.36 to v1.37: upgrade the kubeadm binary, run `kubeadm upgrade apply v1.37.2`, drain the node, upgrade the kubelet and kubectl binaries, uncordon the node.

- A) 1, 3, 2, 4, 5
- B) 1, 2, 3, 4, 5
- C) 3, 1, 2, 4, 5
- D) 1, 3, 4, 2, 5

<details><summary>Answer</summary>

**B.** Upgrade the kubeadm binary, apply the control plane upgrade, drain the node, upgrade the kubelet and kubectl, then uncordon.

- Why not A: the upgrade must be applied before draining, or the node's workloads are disrupted without the new control plane.
- Why not C: draining before upgrading kubeadm leaves the node unable to apply the upgrade.
- Why not D: the kubelet upgrade happens after the control plane upgrade, not before.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/

</details>

### Q-K8S-045 · CKA Cluster Architecture · difficulty 3 · scenario

An administrator needs to restore an etcd snapshot after a catastrophic failure. What does `etcdctl snapshot restore` produce?

- A) A new etcd data directory that can be used to start a replacement cluster.
- B) A YAML backup of all Kubernetes objects.
- C) A compressed copy of the API server's watch cache.
- D) A new set of PKI certificates.

<details><summary>Answer</summary>

**A.** `snapshot restore` writes a new etcd data directory containing the snapshot's state; the replacement cluster's etcd is started against it.

- Why not B: etcd stores its own format, not Kubernetes YAML.
- Why not C: the watch cache is in memory and is not backed up.
- Why not D: PKI is separate from etcd data.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/

</details>

### Q-K8S-046 · CKA Cluster Architecture · difficulty 2 · single

According to the Kubernetes version skew policy, which statement is true?

- A) The kubelet may be up to three minor versions behind the control plane.
- B) The kubelet must not be newer than the control plane and may be up to two minor versions older.
- C) kubectl must be the exact same version as the API server.
- D) The scheduler may be one minor version newer than the API server.

<details><summary>Answer</summary>

**A.** The kubelet may be up to three minor versions older than `kube-apiserver` and must not be newer (kubelet older than 1.25 may only be up to two).

- Why not B: the supported skew is three minor versions, not two.
- Why not C: kubectl may be one minor version older or newer than the API server.
- Why not D: control plane components must not be newer than the API server.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/releases/version-skew-policy/

</details>

### Q-K8S-047 · CKA Cluster Architecture · difficulty 2 · scenario

The scheduler Pod on a control plane node is crash-looping. What is the immediate effect on the cluster?

- A) Existing Pods continue running, but new Pods remain `Pending`.
- B) All Pods are evicted.
- C) The API server stops accepting writes.
- D) The kubelet stops reporting node status.

<details><summary>Answer</summary>

**A.** The scheduler only assigns nodes to new Pods; existing workloads and the API server continue.

- Why not B: Pods are not evicted by a scheduler failure.
- Why not C: the API server is independent of the scheduler.
- Why not D: the kubelet is independent of the scheduler.
- Ref: [modules/02-control-plane-internals.md](../modules/02-control-plane-internals.md), https://kubernetes.io/docs/concepts/overview/components/

</details>

### Q-K8S-048 · CKA Cluster Architecture · difficulty 3 · scenario

The API server is unavailable. Which statement about the running Pods is true?

- A) All Pods stop immediately because the kubelet loses its heartbeat.
- B) Running Pods continue to run, but no new changes can be applied or queried.
- C) The scheduler takes over and continues to place Pods from its cache.
- D) etcd automatically promotes a new API server.

<details><summary>Answer</summary>

**B.** Pods run under the kubelet's local control; the API server is required for desired-state changes and queries, not for already-running containers.

- Why not A: the kubelet does not stop containers when the API server is unreachable.
- Why not C: the scheduler cannot place Pods without the API server.
- Why not D: etcd does not run the API server.
- Ref: [modules/02-control-plane-internals.md](../modules/02-control-plane-internals.md), https://kubernetes.io/docs/concepts/overview/components/

</details>

### Q-K8S-049 · CKA Services & Networking · difficulty 1 · single

What is the primary role of `kube-proxy` on each node?

- A) To assign IP addresses to Pods.
- B) To maintain the network rules that allow traffic to reach Service IPs on the correct backend Pods.
- C) To resolve DNS names for Pods.
- D) To mount persistent volumes.

<details><summary>Answer</summary>

**B.** kube-proxy watches Services and Endpoints and programs iptables, nftables, or IPVS rules to load-balance Service traffic.

- Why not A: IP assignment is done by the CNI.
- Why not C: DNS is handled by CoreDNS.
- Why not D: volume mounting is done by the kubelet and CSI.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://kubernetes.io/docs/concepts/services-networking/service/#proxy-mode

</details>

### Q-K8S-050 · CKA Services & Networking · difficulty 2 · single

Which Service type allocates a stable IP reachable only from inside the cluster?

- A) NodePort
- B) LoadBalancer
- C) ClusterIP
- D) ExternalName

<details><summary>Answer</summary>

**C.** ClusterIP is the default and is reachable only within the cluster.

- Why not A: NodePort exposes the Service on every node's IP.
- Why not B: LoadBalancer provisions an external load balancer.
- Why not D: ExternalName maps to an external DNS name via CNAME.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types

</details>

### Q-K8S-051 · CKA Services & Networking · difficulty 2 · scenario

A namespace has a NetworkPolicy that selects all Pods with `policyTypes: [Egress]` and no egress rules. What is the effect?

- A) All ingress traffic is allowed.
- B) All egress traffic from the selected Pods is denied.
- C) All traffic to kube-dns is allowed.
- D) The Pods lose their IP addresses.

<details><summary>Answer</summary>

**B.** An empty egress rule list denies all egress; DNS must be explicitly allowed.

- Why not A: the policy type is Egress, so ingress is unaffected and defaults to allowed.
- Why not C: DNS is egress and must be allowed explicitly.
- Why not D: NetworkPolicy does not change Pod networking.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/network-policies/

</details>

### Q-K8S-052 · CKA Services & Networking · difficulty 3 · scenario

A StatefulSet with a headless Service (`clusterIP: None`) is created. What DNS record is created for each Pod?

- A) A single A record for the Service name.
- B) An A record per Pod in the form `<pod-name>.<service-name>.<namespace>.svc.cluster.local`.
- C) A CNAME record pointing to the node IP.
- D) No DNS records are created.

<details><summary>Answer</summary>

**B.** A headless Service returns the Pod IPs directly, and each StatefulSet Pod gets a stable per-Pod DNS name.

- Why not A: a ClusterIP Service gets a single A record; a headless Service does not.
- Why not C: ExternalName uses CNAME, not headless.
- Why not D: CoreDNS creates records for headless Services.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/#headless-services

</details>

### Q-K8S-053 · CKA Services & Networking · difficulty 2 · single

What is the effect of the `ndots:5` option in a Pod's `/etc/resolv.conf`?

- A) DNS queries are limited to five per second.
- B) A name with fewer than five dots is first tried with each search domain before being treated as absolute.
- C) The Pod uses five different DNS servers.
- D) DNS queries time out after five seconds.

<details><summary>Answer</summary>

**B.** With `ndots:5`, a query with fewer than five dots is expanded with the search list first.

- Why not A: `ndots` is a dot threshold, not a rate limit.
- Why not C: the nameserver list is separate from `ndots`.
- Why not D: the timeout is controlled by the `timeout` option.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/

</details>

### Q-K8S-054 · CKA Services & Networking · difficulty 2 · scenario

A Service of type `ExternalName` has `externalName: db.example.com`. What happens when a Pod connects to the Service name?

- A) The connection is load-balanced across Pods.
- B) The DNS lookup returns a CNAME record for `db.example.com`.
- C) The connection is routed to a NodePort.
- D) The Service allocates a ClusterIP.

<details><summary>Answer</summary>

**B.** ExternalName Services return a CNAME to the external name; no ClusterIP or endpoints are allocated.

- Why not A: there are no backend Pods.
- Why not C: NodePort is a different Service type.
- Why not D: ExternalName does not allocate a ClusterIP.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/#externalname

</details>

### Q-K8S-055 · CKA Services & Networking · difficulty 3 · scenario

A cluster uses `kube-proxy` in IPVS mode. Compared to iptables mode, what is the main advantage?

- A) IPVS scales better for clusters with thousands of Services because it uses a hash table instead of sequential rule traversal.
- B) IPVS encrypts Service traffic.
- C) IPVS assigns Pod IPs.
- D) IPVS replaces the CNI.

<details><summary>Answer</summary>

**A.** IPVS uses a hash table for Service lookup, reducing the cost of large rule sets compared to iptables' sequential traversal.

- Why not B: kube-proxy does not encrypt traffic.
- Why not C: IP assignment is the CNI's job.
- Why not D: the CNI is separate from kube-proxy.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://kubernetes.io/docs/concepts/services-networking/service/#proxy-mode-ipvs

</details>

### Q-K8S-056 · CKA Workloads & Scheduling · difficulty 1 · single

When a Deployment is created, which controller creates and manages the ReplicaSets?

- A) The kubelet
- B) The Deployment controller
- C) The scheduler
- D) The EndpointSlice controller

<details><summary>Answer</summary>

**B.** The Deployment controller creates ReplicaSets to realize the desired Pod template.

- Why not A: the kubelet runs Pods on nodes.
- Why not C: the scheduler assigns nodes to Pods.
- Why not D: EndpointSlices track Service backends.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/deployment/

</details>

### Q-K8S-057 · CKA Workloads & Scheduling · difficulty 2 · scenario

A node is tainted `dedicated=gpu:NoSchedule`. Which Pod spec allows a Pod to be scheduled on that node?

- A) `tolerations: [{key: "dedicated", operator: "Equal", value: "gpu", effect: "NoSchedule"}]`
- B) `nodeSelector: {dedicated: gpu}`
- C) `affinity: {nodeAffinity: {requiredDuringSchedulingIgnoredDuringExecution: {...}}}`
- D) `priorityClassName: high-priority`

<details><summary>Answer</summary>

**A.** A toleration matching the taint's key, value, and effect allows the Pod to be scheduled on the tainted node.

- Why not B: `nodeSelector` does not override a taint.
- Why not C: node affinity does not tolerate a taint.
- Why not D: PriorityClass affects preemption, not taints.
- Ref: [modules/06-scheduling-and-topology.md](../modules/06-scheduling-and-topology.md), https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/

</details>

### Q-K8S-058 · CKA Workloads & Scheduling · difficulty 2 · single

Which resource automatically scales a Deployment's replica count based on CPU utilization?

- A) VerticalPodAutoscaler
- B) HorizontalPodAutoscaler
- C) ClusterAutoscaler
- D) PodDisruptionBudget

<details><summary>Answer</summary>

**B.** The HPA adjusts replicas to match the target CPU or custom utilization.

- Why not A: VPA adjusts Pod resource requests, not replica count.
- Why not C: ClusterAutoscaler adjusts node count, not Pod replicas.
- Why not D: PDB limits voluntary disruptions.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/

</details>

### Q-K8S-059 · CKA Workloads & Scheduling · difficulty 3 · scenario

A Pod with `resources.requests.memory: 8Gi` is `Pending` on a cluster with three nodes, each with 4Gi allocatable memory. Which scheduling stage is failing?

- A) Scoring
- B) Filtering
- C) Binding
- D) Preemption

<details><summary>Answer</summary>

**B.** The `NodeResourcesFit` filter removes nodes that cannot satisfy the Pod's memory request, so no node remains to score.

- Why not A: scoring runs only on nodes that pass filtering.
- Why not C: binding runs only after a node is chosen.
- Why not D: preemption is attempted only if configured and after filtering.
- Ref: [modules/06-scheduling-and-topology.md](../modules/06-scheduling-and-topology.md), https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/

</details>

### Q-K8S-060 · CKA Storage · difficulty 2 · single

Which field in a StorageClass enables expansion of a PersistentVolume's filesystem?

- A) `allowVolumeExpansion: true`
- B) `volumeBindingMode: Immediate`
- C) `reclaimPolicy: Retain`
- D) The `provisioner` field set to `volume-expansion`

<details><summary>Answer</summary>

**A.** `allowVolumeExpansion` must be true for the PVC to request a larger size; the CSI driver handles online or offline expansion.

- Why not B: binding mode controls when provisioning happens.
- Why not C: reclaim policy controls what happens when the PVC is deleted.
- Why not D: the provisioner field names the CSI driver; it does not enable expansion.
- Ref: [modules/09-storage-and-csi.md](../modules/09-storage-and-csi.md), https://kubernetes.io/docs/concepts/storage/storage-classes/#volume-expansion

</details>

### Q-K8S-061 · CKA Services & Networking · difficulty 2 · multi

Which Service types expose a Service to clients outside the cluster? (Select all that apply)

- A) NodePort
- B) LoadBalancer
- C) ClusterIP
- D) ExternalName

<details><summary>Answer</summary>

**A and B.** NodePort exposes the Service on every node's IP, and LoadBalancer provisions an external load balancer.

- Why not C: ClusterIP allocates an internal IP reachable only inside the cluster.
- Why not D: ExternalName maps to an external DNS name via CNAME; it does not expose the Service itself.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types

</details>

## Part 2: CKAD Question Bank (Q-K8S-062 to Q-K8S-122)

### Q-K8S-062 · CKAD Application Environment · difficulty 1 · single

How can a container consume key-value pairs stored in a Kubernetes ConfigMap as environment variables?

- A) Using `volumeMounts` pointing to `/etc/config`
- B) Using `envFrom` with `configMapRef` or `env` with `valueFrom.configMapKeyRef`
- C) Using `initContainers`
- D) Using persistent volume claims

<details><summary>Answer</summary>

**B.** ConfigMaps can be injected into containers either as individual environment variables (`env.valueFrom.configMapKeyRef`) or bulk environment variables (`envFrom.configMapRef`).

- Why not A: Volume mounts place configmaps as files, not environment variables.
- Why not C, D: Init containers and PVCs serve different initialization and storage functions.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/

</details>

### Q-K8S-063 · CKAD Application Design & Build · difficulty 2 · scenario

An application developer needs to define a custom API resource type `CronTab` in their cluster. Which resource kind defines this custom API schema?

- A) CustomResourceDefinition (CRD)
- B) CustomController
- C) APIService
- D) RoleBinding

<details><summary>Answer</summary>

**A.** A `CustomResourceDefinition` (CRD) lets users define custom resource types, instructing the API server to serve and store custom objects.

- Why not B: CustomControllers execute reconciliation logic, not define API schemas.
- Why not C: APIService registers aggregated API servers.
- Why not D: RoleBinding handles RBAC authorization.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/

</details>

### Q-K8S-064 · CKAD Application Deployment · difficulty 2 · single

During a rolling update of a Deployment, which two parameters control the maximum number of pods created above the desired replica count and the maximum unavailable pods?

- A) `maxSurge` and `maxUnavailable`
- B) `replicas` and `minReadySeconds`
- C) `activeDeadlineSeconds` and `backoffLimit`
- D) `terminationGracePeriodSeconds` and `progressDeadlineSeconds`

<details><summary>Answer</summary>

**A.** `maxSurge` and `maxUnavailable` in Deployment rolling update strategy configure surge capacity and availability thresholds.

- Why not B, C, D: These govern replicas, timeouts, deadlines, and grace periods, not rolling update surge limits.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment

</details>

### Q-K8S-065 · CKAD Services & Networking · difficulty 2 · scenario

An application developer wants to route incoming HTTP traffic based on hostname (`api.example.com`) and path prefix (`/v1`) using the modern Kubernetes traffic standard. Which resource should they create?

- A) CoreDNS zone file
- B) Gateway API HTTPRoute linked to an external Gateway
- C) NetworkPolicy
- D) PersistentVolumeClaim

<details><summary>Answer</summary>

**B.** Gateway API `HTTPRoute` provides role-oriented traffic routing based on hostnames, headers, and path matching.

- Why not A: CoreDNS manages DNS name resolution.
- Why not C: NetworkPolicy handles OSI layer 3/4 firewall rules.
- Why not D: PVC handles storage.
- Ref: [modules/08-gateway-api-and-ingress-migration.md](../modules/08-gateway-api-and-ingress-migration.md), https://kubernetes.io/docs/concepts/services-networking/gateway/

</details>

### Q-K8S-066 · CKAD Application Observability · difficulty 2 · single

Which pod probe configuration checks whether a container has completed its startup phase before liveness probes take over?

- A) readinessProbe
- B) startupProbe
- C) livenessProbe
- D) preStop probe

<details><summary>Answer</summary>

**B.** `startupProbe` disables liveness and readiness checks until it succeeds, protecting slow-starting legacy containers from premature liveness kills.

- Why not A: Readiness checks traffic readiness.
- Why not C: Liveness checks operational health.
- Why not D: preStop is a lifecycle hook, not a probe.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

</details>

### Q-K8S-067 · CKAD Application Environment · difficulty 2 · scenario

Why is storing sensitive database passwords in Kubernetes ConfigMaps considered an insecure practice?

- A) ConfigMaps are encrypted at rest using RSA-4096 by default.
- B) ConfigMaps are stored in base64 encoding (not encryption) and are easily decoded by anyone with read access to the namespace or API.
- C) ConfigMaps expire automatically after 24 hours.
- D) ConfigMaps cannot exceed 1 KB in size.

<details><summary>Answer</summary>

**B.** ConfigMaps store plaintext data encoded in base64, providing zero cryptographic confidentiality protection compared to encrypted Secrets or external vaults.

- Why not A: ConfigMaps are plaintext values.
- Why not C, D: ConfigMaps do not expire automatically and support up to 1 MB.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/configuration/configmap/

</details>

### Q-K8S-068 · CKAD Application Design & Build · difficulty 2 · hands-on

Create a Helm 4 chart installation command named `my-release` from an OCI registry repository `oci://ghcr.io/org/charts/app` with version `2.1.0` in namespace `production`.

- A) `helm install my-release oci://ghcr.io/org/charts/app --version 2.1.0 --namespace production`
- B) `kubectl apply -f chart.yaml`
- C) `kustomize build app`
- D) `docker run ghcr.io/org/charts/app:2.1.0`

<details><summary>Answer</summary>

**A.** `helm install` installs Helm charts from OCI registries with version and namespace parameters.

- Why not B: `kubectl apply` installs raw manifests, not Helm charts.
- Why not C: Kustomize processes YAML overlays.
- Why not D: Docker runs OCI container images, not helm charts.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://helm.sh/docs/topics/registries/
- Verification: [`examples/ts/15-hands-on-verification.test.ts`](../examples/ts/15-hands-on-verification.test.ts) › "evaluateHelmChart validates the chart structure"

</details>

### Q-K8S-069 · CKAD Application Deployment · difficulty 2 · single

What is the primary difference between a Job and a CronJob in Kubernetes?

- A) Jobs run tasks to completion once; CronJobs run jobs on a time-based schedule (cron format).
- B) CronJobs only run on master nodes.
- C) Jobs cannot be deleted manually.
- D) CronJobs do not support container logs.

<details><summary>Answer</summary>

**A.** Jobs execute pods to successful completion once, whereas CronJobs manage recurring execution of jobs based on time schedules.

- Why not B: Workloads run on worker nodes.
- Why not C: Jobs can be deleted anytime.
- Why not D: CronJob pods generate standard container logs.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/

</details>

### Q-K8S-070 · CKAD Services & Networking · difficulty 2 · scenario

An application developer creates a headless service (`clusterIP: None`) for a StatefulSet. What is the key characteristic of a headless service?

- A) It assigns a public IP address to every pod.
- B) It does not allocate a cluster IP; instead, DNS returns the IP addresses of the individual backing pods directly.
- C) It blocks all incoming traffic.
- D) It routes traffic through an external load balancer.

<details><summary>Answer</summary>

**B.** Headless services omit a cluster IP, enabling DNS servers to return individual A/AAAA records for member pods, facilitating peer discovery.

- Why not A: Public IPs require LoadBalancers or NodePorts.
- Why not C, D: Headless services enable direct pod routing, not blocking or external LB abstraction.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/#headless-services

</details>

### Q-K8S-071 · CKAD Application Observability · difficulty 2 · scenario

A developer needs to retrieve logs from a terminated container in a multi-container pod named `web-app` for debugging. Which flag ensures logs from the previous instantiation are fetched?

- A) `--current`
- B) `-p` or `--previous`
- C) `--tail=0`
- D) `--follow`

<details><summary>Answer</summary>

**B.** `--previous` (`-p`) retrieves logs from the previous container instance that crashed or terminated.

- Why not A, C, D: These control current stream following, tail limits, or stream parameters.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#debugging-pods

</details>

### Q-K8S-072 · CKAD Application Environment · difficulty 2 · single

What object associates a ServiceAccount with token permissions for secure workload authentication?

- A) RoleBinding or ClusterRoleBinding referencing a ServiceAccount principal
- B) ConfigMap
- C) PersistentVolume
- D) NetworkPolicy

<details><summary>Answer</summary>

**A.** RoleBindings and ClusterRoleBindings bind Roles and ClusterRoles to ServiceAccounts to grant API permissions.

- Why not B, C, D: ConfigMaps, PVs, and NetworkPolicies manage configuration, storage, and networking, not RBAC identity bindings.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/rbac/

</details>

### Q-K8S-073 · CKAD Application Design & Build · difficulty 2 · scenario

A developer wants to customize base Kubernetes manifests for staging and production environments without duplicating YAML files or using templating engines. Which tool is purpose-built for this?

- A) Helm
- B) Kustomize
- C) Ansible
- D) Terraform

<details><summary>Answer</summary>

**B.** Kustomize uses overlay and patch files to customize declarative Kubernetes resource manifests without templates.

- Why not A: Helm uses template engines.
- Why not C, D: Ansible and Terraform manage provisioning and configuration orchestration.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/

</details>

### Q-K8S-074 · CKAD Application Deployment · difficulty 2 · scenario

An application requires database migrations to run successfully to completion before the main web server container starts. How should this be structured in the Pod spec?

- A) As a liveness probe failure handler
- B) As an `initContainers` entry that runs to completion before application containers start
- C) As a sidecar container with `restartPolicy: Always`
- D) As a postStart lifecycle hook

<details><summary>Answer</summary>

**B.** Init containers run sequentially to completion before application containers start, making them ideal for database migration scripts.

- Why not A: Liveness probes restart containers upon failure, not sequential startup ordering.
- Why not C: Sidecars run concurrently with application containers.
- Why not D: postStart hooks execute asynchronously alongside container startup without blocking application execution deterministically.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/pods/init-containers/

</details>

### Q-K8S-075 · CKAD Services & Networking · difficulty 2 · single

What does the `ndots:5` default setting in Kubernetes pod `/etc/resolv.conf` mean for DNS resolution?

- A) DNS queries with fewer than 5 dots are treated as absolute domain names immediately.
- B) DNS queries with fewer than 5 dots are first appended with search domains (e.g., `default.svc.cluster.local`, `svc.cluster.local`, `cluster.local`) before querying the absolute name, causing multiple DNS roundtrips.
- C) DNS queries time out after 5 seconds.
- D) DNS caching is capped at 5 records.

<details><summary>Answer</summary>

**B.** `ndots:5` triggers search path expansions for any domain containing fewer than 5 dots, generating extra DNS queries before querying the absolute FQDN.

- Why not A, C, D: These misinterpret ndots semantics.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/

</details>

### Q-K8S-076 · CKAD Application Observability · difficulty 2 · single

Which API resource exposes CPU and memory resource usage metrics for pods and nodes collected by metrics-server?

- A) `/metrics` endpoint on etcd
- B) Kubernetes Metrics API (`kubectl top nodes`, `kubectl top pods`)
- C) Prometheus query language API
- D) Docker stats socket

<details><summary>Answer</summary>

**B.** The Kubernetes Metrics API, powered by metrics-server, provides `kubectl top` resource usage telemetry.

- Why not A: Etcd exposes storage metrics.
- Why not C: Prometheus is an external metrics platform.
- Why not D: Docker stats inspects container runtimes directly, bypassing Kubernetes APIs.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/

</details>

### Q-K8S-077 · CKAD Application Environment · difficulty 2 · scenario

How can a Pod securely mount a Kubernetes Secret as an encrypted-at-rest filesystem volume rather than environment variables?

- A) Using `volumes` with `secret` source and `volumeMounts` in the container spec
- B) Using `envFrom` secret reference
- C) Using `hostPath` pointing to `/var/lib/secrets`
- D) Using `initContainers` with `docker cp`

<details><summary>Answer</summary>

**A.** Secrets can be mounted as tmpfs filesystem volumes via `volumes` and `volumeMounts`, avoiding environment variable exposure.

- Why not B: `envFrom` populates environment variables.
- Why not C: `hostPath` exposes node filesystem paths insecurely.
- Why not D: `docker cp` is an imperative anti-pattern.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/

</details>

### Q-K8S-078 · CKAD Application Design & Build · difficulty 2 · single

What is the purpose of the `status` subresource in CustomResourceDefinitions (CRDs)?

- A) To store user passwords securely.
- B) To decouple specification updates from controller status reporting, preventing status writes from triggering spec reconciliation loops.
- C) To disable API validation.
- D) To store container logs.

<details><summary>Answer</summary>

**B.** Enabling the status subresource allows controllers to update `status` fields without incrementing `metadata.generation` or triggering spec-based reconciliation loops.

- Why not A: Passwords belong in Secrets.
- Why not C, D: CRD status does not disable validation or store container logs.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#status-subresource

</details>

### Q-K8S-079 · CKAD Application Deployment · difficulty 2 · scenario

An application deployment experiences frequent cascading failures where restarting web servers immediately hammers a degraded database. Which pattern or configuration prevents this?

- A) Setting `replicas: 100` immediately
- B) Configuring robust liveness and readiness probes with proper `initialDelaySeconds` and exponential backoff restart policies
- C) Removing all health checks
- D) Disabling resource requests

<details><summary>Answer</summary>

**B.** Proper probes (`initialDelaySeconds`, readiness gates, startup probes) prevent cascading startup storms by ensuring dependencies are healthy before traffic routing.

- Why not A, C, D: Increasing replicas or removing probes worsens cascading failure and crash loops.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

</details>

### Q-K8S-080 · CKAD Services & Networking · difficulty 2 · single

What is the function of an Ingress or Gateway API HTTPRoute `backendRef`?

- A) To define node CPU limits.
- B) To route matched incoming HTTP traffic to a specific Kubernetes Service and port.
- C) To configure persistent storage volumes.
- D) To store TLS private keys.

<details><summary>Answer</summary>

**B.** `backendRef` specifies the target Kubernetes Service and port where matched HTTP traffic should be forwarded by the gateway controller.

- Why not A, C, D: These govern resources, storage, and TLS certificates, not traffic forwarding backends.
- Ref: [modules/08-gateway-api-and-ingress-migration.md](../modules/08-gateway-api-and-ingress-migration.md), https://kubernetes.io/docs/concepts/services-networking/gateway/#routes

</details>

### Q-K8S-081 · CKAD Application Observability · difficulty 2 · scenario

A developer wants to scale deployment pods horizontally based on CPU utilization. Which resource object accomplishes this automatically?

- A) Vertical Pod Autoscaler (VPA)
- B) Horizontal Pod Autoscaler (HPA)
- C) Cluster Autoscaler
- D) DaemonSet

<details><summary>Answer</summary>

**B.** Horizontal Pod Autoscaler (HPA) adjusts the replica count of deployments based on observed CPU utilization or custom metrics.

- Why not A: VPA resizes container CPU/memory requests vertically.
- Why not C: Cluster Autoscaler adds worker nodes to the infrastructure.
- Why not D: DaemonSet manages node-per-node pod distribution.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/

</details>

### Q-K8S-082 · CKAD Application Environment · difficulty 2 · single

What is the effect of setting `spec.containers[*].resources.requests.cpu: "500m"` on a Pod container?

- A) The container is strictly capped at 0.5 CPU cores and throttled immediately if exceeded.
- B) The scheduler guarantees 0.5 CPU cores of allocatable capacity on the assigned node during placement.
- C) The container is assigned highest priority eviction status.
- D) CPU limits are disabled entirely.

<details><summary>Answer</summary>

**B.** Resource requests dictate the guaranteed resource allocation used by the kube-scheduler during node placement and scheduling.

- Why not A: Requests guarantee allocation; limits govern throttling caps.
- Why not C: Priority is managed via PriorityClasses.
- Why not D: Requests do not disable limits.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/

</details>

### Q-K8S-083 · CKAD Application Design & Build · difficulty 2 · scenario

A developer packages an application as a reusable Kubernetes artifact containing templates, default values, and helper functions. What is this packaging format called?

- A) Dockerfile
- B) Helm Chart
- C) Kustomization overlay
- D) Systemd service unit

<details><summary>Answer</summary>

**B.** A Helm Chart packages Kubernetes manifests, templates, and default configuration values into a versioned installable bundle.

- Why not A: Dockerfile builds container images.
- Why not C: Kustomize uses overlay patches.
- Why not D: Systemd runs host OS daemons.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://helm.sh/docs/topics/charts/

</details>

### Q-K8S-084 · CKAD Application Deployment · difficulty 2 · single

What happens to a Deployment's ReplicaSets when a rolling update completes successfully?

- A) All old ReplicaSets are deleted immediately.
- B) Old ReplicaSets are retained (up to `revisionHistoryLimit`) to allow rollbacks.
- C) Old ReplicaSets are converted into CronJobs.
- D) The deployment controller crashes.

<details><summary>Answer</summary>

**B.** Kubernetes retains old ReplicaSets according to `revisionHistoryLimit` (default 10) to support `kubectl rollout undo`.

- Why not A: Old ReplicaSets are retained for rollback history.
- Why not C, D: Conversion to cronjobs or crashes do not occur.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment

</details>

### Q-K8S-085 · CKAD Services & Networking · difficulty 2 · scenario

An application developer needs to ensure that external traffic entering a Gateway API HTTPRoute is redirected from HTTP to HTTPS. Where is TLS termination configured?

- A) Inside the Pod container entrypoint
- B) On the Gateway listener configuration (`protocol: HTTPS`) with a referenced TLS Secret
- C) Inside CoreDNS zone files
- D) Inside the CNI network plugin config

<details><summary>Answer</summary>

**B.** Gateway listeners configure TLS termination by specifying `protocol: HTTPS` and referencing a Kubernetes Secret containing TLS certificates and keys.

- Why not A, C, D: TLS termination occurs at the gateway ingress layer, not inside application entrypoints, DNS, or CNI plugins.
- Ref: [modules/08-gateway-api-and-ingress-migration.md](../modules/08-gateway-api-and-ingress-migration.md), https://kubernetes.io/docs/concepts/services-networking/gateway/#listeners

</details>

### Q-K8S-086 · CKAD Application Observability · difficulty 2 · single

What is the function of the `terminationGracePeriodSeconds` field in a Pod specification?

- A) It defines the maximum time allowed for a container to stop gracefully after receiving a SIGTERM signal before receiving a SIGKILL.
- B) It sets the container startup timeout.
- C) It controls how long pod logs are retained in etcd.
- D) It configures idle database connection timeouts.

<details><summary>Answer</summary>

**A.** `terminationGracePeriodSeconds` specifies the grace period (default 30 seconds) allowed for containers to clean up and exit gracefully upon SIGTERM before forced SIGKILL termination.

- Why not B: Startup timeouts are governed by startup probes.
- Why not C, D: Log retention and database timeouts are unrelated to pod termination grace periods.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination

</details>

---

### Q-K8S-087 · CKAD Application Environment · difficulty 1 · single

Which Pod spec field mounts a ConfigMap as a filesystem volume?

- A) `spec.containers[*].envFrom`
- B) `spec.volumes[*].configMap.name`
- C) `spec.containers[*].resources.configMap`
- D) `spec.serviceAccountName`

<details><summary>Answer</summary>

**B.** A volume with a `configMap` source is mounted into the container through `volumeMounts`.

- Why not A: `envFrom` injects keys as environment variables, not files.
- Why not C: resources do not reference ConfigMaps.
- Why not D: ServiceAccount is for API authentication.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/configuration/configmap/

</details>

### Q-K8S-088 · CKAD Application Environment · difficulty 2 · scenario

An application must read a TLS private key from a Secret. Which approach keeps the key out of environment variables and the container image?

- A) Store the key in a ConfigMap and reference it with `envFrom`.
- B) Mount the Secret as a volume and read the key from the mounted file.
- C) Pass the key as a command-line argument.
- D) Store the key in a label on the Deployment.

<details><summary>Answer</summary>

**B.** Mounting the Secret as a volume writes the key to a tmpfs file that the application reads at runtime.

- Why not A: ConfigMaps are not designed for sensitive data, and `envFrom` puts the value in the process environment.
- Why not C: command-line arguments are visible in the process list and the Pod spec.
- Why not D: labels are metadata and are not mounted into Pods.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/configuration/secret/

</details>

### Q-K8S-089 · CKAD Application Environment · difficulty 3 · scenario

A namespace has a ResourceQuota that limits `requests.cpu` to `2` and `limits.memory` to `4Gi`. A Deployment requests `500m` CPU and `1Gi` memory per replica. How many replicas can the namespace run?

- A) 2
- B) 4
- C) 8
- D) The quota does not limit replicas.

<details><summary>Answer</summary>

**B.** `2 / 0.5 = 4` replicas by CPU and `4Gi / 1Gi = 4` by memory; the lower bound is 4.

- Why not A: 2 is the CPU quota in cores, not the replica count.
- Why not C: 8 would exceed the CPU quota.
- Why not D: ResourceQuota enforces aggregate requests and limits across the namespace.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/policy/resource-quotas/

</details>

### Q-K8S-090 · CKAD Application Environment · difficulty 1 · single

What is the purpose of a LimitRange?

- A) To limit the number of Pods in a namespace.
- B) To set default requests and limits for containers that do not specify them.
- C) To restrict which images can be pulled.
- D) To enforce network isolation.

<details><summary>Answer</summary>

**B.** A LimitRange provides default resource requests and limits and can enforce minimum and maximum values.

- Why not A: ResourceQuota limits aggregate resources and object counts.
- Why not C: image policies are enforced by admission controllers.
- Why not D: NetworkPolicy enforces network isolation.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/policy/limit-range/

</details>

### Q-K8S-091 · CKAD Application Environment · difficulty 2 · scenario

A container must not run as root. Which `securityContext` field enforces this?

- A) `runAsNonRoot: true`
- B) `allowPrivilegeEscalation: false`
- C) `readOnlyRootFilesystem: true`
- D) `privileged: false`

<details><summary>Answer</summary>

**A.** `runAsNonRoot: true` causes the kubelet to reject a container that runs as UID 0.

- Why not B: `allowPrivilegeEscalation` prevents gaining more privileges than the parent, not running as root.
- Why not C: a read-only root filesystem prevents writes, not root execution.
- Why not D: `privileged: false` is the default and does not prevent root.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/

</details>

### Q-K8S-092 · CKAD Application Environment · difficulty 3 · single

Which ServiceAccount token type is bound to a Pod, has an audience, and expires automatically?

- A) The legacy service-account token with no expiration.
- B) A bound ServiceAccount token projected into the Pod.
- C) A static token defined in a Secret.
- D) An OIDC token from the cloud provider.

<details><summary>Answer</summary>

**B.** Bound tokens are audience-bound, have an expiration, and are projected into the Pod.

- Why not A: legacy tokens do not expire by default.
- Why not C: static tokens are long-lived and not audience-bound.
- Why not D: OIDC tokens are for cloud identity, not in-cluster API authentication.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/

</details>

### Q-K8S-093 · CKAD Application Environment · difficulty 1 · single

Which field injects all keys from a ConfigMap as environment variables?

- A) `env`
- B) `envFrom`
- C) `valueFrom`
- D) `configMapKeyRef`

<details><summary>Answer</summary>

**B.** `envFrom` injects every key in the ConfigMap as an environment variable.

- Why not A: `env` requires one entry per variable.
- Why not C: `valueFrom` is used inside an `env` entry.
- Why not D: `configMapKeyRef` references a single key.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/configuration/configmap/

</details>

### Q-K8S-094 · CKAD Application Environment · difficulty 3 · scenario

A Pod's readiness probe fails after a configuration change. What happens to the Pod's traffic and state?

- A) The Pod is restarted.
- B) The Pod is removed from Service endpoints but keeps running.
- C) The Pod is evicted from the node.
- D) The Pod's Deployment is rolled back.

<details><summary>Answer</summary>

**B.** A failing readiness probe removes the Pod from the Service's ready endpoints; the container keeps running.

- Why not A: only the liveness probe restarts the container.
- Why not C: eviction is driven by node pressure, not probes.
- Why not D: rollback is a manual or automated action, not a probe effect.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes

</details>

### Q-K8S-095 · CKAD Application Environment · difficulty 2 · single

Which Secret type is used to store credentials for pulling images from a private registry?

- A) `Opaque`
- B) `kubernetes.io/tls`
- C) `kubernetes.io/dockerconfigjson`
- D) `bootstrap.kubernetes.io/token`

<details><summary>Answer</summary>

**C.** `kubernetes.io/dockerconfigjson` holds the Docker registry credentials consumed by the kubelet.

- Why not A: Opaque is for arbitrary key-value data.
- Why not B: TLS stores a certificate and key.
- Why not D: bootstrap tokens are for node joining.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/configuration/secret/#secret-types

</details>

### Q-K8S-096 · CKAD Application Environment · difficulty 3 · scenario

A team sets `immutable: true` on a ConfigMap that an application mounts as a volume. What happens when they try to update the ConfigMap with `kubectl edit`?

- A) The update succeeds and the Pod sees the new data on the next restart.
- B) The API server rejects the update.
- C) The update succeeds but the kubelet does not propagate it.
- D) The update succeeds only if the Pod is deleted.

<details><summary>Answer</summary>

**B.** Immutable ConfigMaps reject updates; the API server returns an error.

- Why not A: immutable means the API server rejects mutations.
- Why not C: the update never reaches the API server.
- Why not D: deleting the Pod does not make the ConfigMap mutable.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/concepts/configuration/configmap/

</details>

### Q-K8S-097 · CKAD Application Design & Build · difficulty 1 · single

What is the smallest deployable unit in Kubernetes that can contain one or more containers sharing a network namespace and storage?

- A) A Deployment
- B) A Pod
- C) A Service
- D) A Namespace

<details><summary>Answer</summary>

**B.** A Pod is the atomic unit; its containers share the network namespace and can share volumes.

- Why not A: a Deployment manages Pods.
- Why not C: a Service provides a stable network endpoint.
- Why not D: a Namespace is a virtual cluster boundary.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/pods/

</details>

### Q-K8S-098 · CKAD Application Design & Build · difficulty 3 · scenario

A Pod needs to run a log collector alongside the application container, sharing the application's volumes and lifecycle. Which container type is the modern approach?

- A) An init container
- B) A native sidecar container with `restartPolicy: Always`
- C) A second Deployment
- D) A DaemonSet

<details><summary>Answer</summary>

**B.** A native sidecar is a regular container with `restartPolicy: Always` in the Pod spec, sharing the Pod's lifecycle.

- Why not A: init containers run to completion before the main container starts.
- Why not C: a second Deployment creates separate Pods.
- Why not D: a DaemonSet runs one Pod per node.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/

</details>

### Q-K8S-099 · CKAD Application Design & Build · difficulty 2 · single

What is the key difference between a built-in resource and a CustomResourceDefinition (CRD)?

- A) Built-in resources are cluster-scoped; CRDs are namespace-scoped.
- B) Built-in resources are shipped with Kubernetes; CRDs extend the API with new resource types.
- C) Built-in resources cannot be validated; CRDs can.
- D) Built-in resources are stored in etcd; CRDs are not.

<details><summary>Answer</summary>

**B.** CRDs let users define new API resources; built-in resources are part of Kubernetes.

- Why not A: both built-in and custom resources can be cluster- or namespace-scoped.
- Why not C: built-in resources have schema validation too.
- Why not D: both are persisted in etcd.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/

</details>

### Q-K8S-100 · CKAD Application Design & Build · difficulty 1 · single

Which file is required in every Helm chart and defines the chart name, version, and API version?

- A) `values.yaml`
- B) `Chart.yaml`
- C) `Chart.lock`
- D) `values.schema.json`

<details><summary>Answer</summary>

**B.** `Chart.yaml` is required and defines the chart metadata.

- Why not A: `values.yaml` is optional and defaults to empty.
- Why not C: `Chart.lock` is generated when dependencies are present.
- Why not D: `values.schema.json` is optional validation.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://helm.sh/docs/topics/charts/

</details>

### Q-K8S-101 · CKAD Application Design & Build · difficulty 1 · single

Which Kustomize file defines the base resources and overlays for an environment?

- A) `kustomization.yaml`
- B) `kubeadm-config.yaml`
- C) `Chart.yaml`
- D) `values.yaml`

<details><summary>Answer</summary>

**A.** `kustomization.yaml` lists resources, patches, and configurations.

- Why not B: that is a kubeadm cluster config.
- Why not C: that is Helm metadata.
- Why not D: that is Helm values.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/

</details>

### Q-K8S-102 · CKAD Application Design & Build · difficulty 3 · scenario

An operator reconciles a custom resource. The controller receives an event, computes the desired state, and applies it. What keeps the controller's view of the world correct despite cache delays?

- A) The controller polls the API server every second.
- B) The level-triggered reconcile re-reads the observed state on each pass, and the informer's watch events wake it when objects change.
- C) The controller reads directly from etcd.
- D) The controller disables the watch cache.

<details><summary>Answer</summary>

**B.** The controller is level-triggered: the informer's watch cache delivers change events as wake-up hints, and each reconcile re-reads the observed state, so a stale cache is corrected on the next event or resync.

- Why not A: polling is not how controllers receive events.
- Why not C: only the API server reads etcd directly.
- Why not D: disabling the cache removes the efficiency benefit and is not required.
- Ref: [modules/12-extending-kubernetes-crds-operators-helm.md](../modules/12-extending-kubernetes-crds-operators-helm.md), https://kubernetes.io/docs/concepts/architecture/controller/

</details>

### Q-K8S-103 · CKAD Application Design & Build · difficulty 3 · scenario

A Pod must pull an image from a private registry. Which Secret type and Pod field are required?

- A) An Opaque Secret and `spec.imagePullSecrets`
- B) A `kubernetes.io/dockerconfigjson` Secret and `spec.imagePullSecrets`
- C) A TLS Secret and `spec.containers[*].imagePullPolicy`
- D) A basic-auth Secret and `spec.registryCredentials`

<details><summary>Answer</summary>

**B.** The `kubernetes.io/dockerconfigjson` Secret holds registry credentials and is referenced in `imagePullSecrets`.

- Why not A: Opaque Secrets do not carry the Docker config format.
- Why not C: TLS Secrets are for certificates, and `imagePullPolicy` controls pull behavior, not credentials.
- Why not D: `spec.registryCredentials` is not a Pod field.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/

</details>

### Q-K8S-104 · CKAD Application Deployment · difficulty 1 · single

How do Deployments and StatefulSets differ in the guarantees they provide?

- A) Deployments are for stateless workloads; StatefulSets give each Pod a stable identity and stable storage.
- B) Deployments are cluster-scoped; StatefulSets are namespace-scoped.
- C) Deployments use ReplicaSets; StatefulSets use DaemonSets.
- D) Deployments support rollbacks; StatefulSets do not.

<details><summary>Answer</summary>

**A.** StatefulSets provide stable network identity and per-Pod persistent storage; Deployments do not.

- Why not B: both are namespace-scoped.
- Why not C: StatefulSets manage Pods directly, not DaemonSets.
- Why not D: StatefulSets support partitioned rollouts.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/

</details>

### Q-K8S-105 · CKAD Application Deployment · difficulty 2 · scenario

A rollout introduced a bad image. Which command rolls the Deployment back to the previous ReplicaSet?

- A) `kubectl rollout undo deployment/web`
- B) `kubectl rollout restart deployment/web`
- C) `kubectl delete deployment/web`
- D) `kubectl scale deployment/web --replicas=0`

<details><summary>Answer</summary>

**A.** `kubectl rollout undo` reverts to the previous revision.

- Why not B: restart recreates Pods with the same bad image.
- Why not C: deleting the Deployment removes it entirely.
- Why not D: scaling to zero stops traffic but does not roll back.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment

</details>

### Q-K8S-106 · CKAD Application Deployment · difficulty 1 · single

Which field controls how many old ReplicaSets Kubernetes retains for rollback?

- A) `spec.revisionHistoryLimit`
- B) `spec.strategy.rollingUpdate.maxSurge`
- C) `spec.minReadySeconds`
- D) `spec.progressDeadlineSeconds`

<details><summary>Answer</summary>

**A.** `revisionHistoryLimit` bounds the number of old ReplicaSets.

- Why not B: maxSurge controls the surge during an update.
- Why not C: minReadySeconds controls how long a Pod must be ready before it counts.
- Why not D: progressDeadlineSeconds bounds the rollout duration.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/deployment/

</details>

### Q-K8S-107 · CKAD Application Deployment · difficulty 2 · scenario

A team runs a blue/green deployment using two Deployments and a Service. How do they switch traffic from blue to green?

- A) Delete the blue Deployment.
- B) Update the Service's `spec.selector` to match the green Deployment's labels.
- C) Scale the blue Deployment to zero.
- D) Change the Service type to ExternalName.

<details><summary>Answer</summary>

**B.** The Service selects Pods by label; changing the selector moves traffic to the green Pods.

- Why not A: deleting blue removes the rollback target.
- Why not C: scaling blue to zero does not direct traffic to green unless the selector matches both.
- Why not D: ExternalName maps to an external DNS name.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/services-networking/service/

</details>

### Q-K8S-108 · CKAD Application Deployment · difficulty 3 · scenario

A canary rollout must send 10% of HTTP traffic to a new version. Which Gateway API mechanism expresses this?

- A) Two HTTPRoutes with different hostnames.
- B) A single HTTPRoute with two `backendRefs` and weights 90 and 10.
- C) A Service with two selectors.
- D) A NetworkPolicy that filters 10% of packets.

<details><summary>Answer</summary>

**B.** HTTPRoute `backendRefs` support `weight` for traffic splitting.

- Why not A: different hostnames route by name, not by percentage.
- Why not C: a Service selector chooses one set of Pods.
- Why not D: NetworkPolicy allows or denies traffic; it does not split by weight.
- Ref: [modules/08-gateway-api-and-ingress-migration.md](../modules/08-gateway-api-and-ingress-migration.md), https://kubernetes.io/docs/concepts/services-networking/gateway/

</details>

### Q-K8S-109 · CKAD Application Deployment · difficulty 2 · scenario

A Job's container exits with a transient error. Which field limits how many times Kubernetes retries the Pod before marking the Job failed?

- A) `spec.backoffLimit`
- B) `spec.activeDeadlineSeconds`
- C) `spec.completions`
- D) `spec.parallelism`

<details><summary>Answer</summary>

**A.** `backoffLimit` bounds the number of retries.

- Why not B: activeDeadlineSeconds bounds the total Job duration.
- Why not C: completions is the number of Pods that must succeed.
- Why not D: parallelism is the number of Pods running concurrently.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/job/

</details>

### Q-K8S-110 · CKAD Application Deployment · difficulty 2 · scenario

A CronJob must not run overlapping instances if the previous run is still active. Which policy enforces this?

- A) `concurrencyPolicy: Forbid`
- B) `concurrencyPolicy: Replace`
- C) `startingDeadlineSeconds: 60`
- D) `successfulJobsHistoryLimit: 3`

<details><summary>Answer</summary>

**A.** `Forbid` skips a new run when the previous one is still active.

- Why not B: `Replace` replaces the active Job.
- Why not C: startingDeadlineSeconds bounds how late a missed schedule can start.
- Why not D: successfulJobsHistoryLimit bounds retained Jobs.
- Ref: [modules/04-pods-and-workloads.md](../modules/04-pods-and-workloads.md), https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/

</details>

### Q-K8S-111 · CKAD Services & Networking · difficulty 1 · single

How does a Service select the Pods that receive its traffic?

- A) By the Pods' names.
- B) By a label selector that matches the Pods' labels.
- C) By the Pods' node names.
- D) By the Pods' container ports.

<details><summary>Answer</summary>

**B.** The Service's `spec.selector` matches Pod labels.

- Why not A: names are not used for selection.
- Why not C: node names are not used.
- Why not D: ports forward traffic, they do not select Pods.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/#selector

</details>

### Q-K8S-112 · CKAD Services & Networking · difficulty 2 · scenario

Which HTTPRoute path match routes only the exact URL `/api/v1/users`?

- A) `path: {type: PathPrefix, value: /api}`
- B) `path: {type: Exact, value: /api/v1/users}`
- C) `hostname: {value: api.example.com}`
- D) `method: GET`

<details><summary>Answer</summary>

**B.** An `Exact` path match routes the exact URL path.

- Why not A: PathPrefix `/api` matches all paths beginning with `/api`, which is broader than required.
- Why not C: hostname matches the request host, not the path.
- Why not D: method matches the HTTP method, not the path.
- Ref: [modules/08-gateway-api-and-ingress-migration.md](../modules/08-gateway-api-and-ingress-migration.md), https://kubernetes.io/docs/concepts/services-networking/gateway/

</details>

### Q-K8S-113 · CKAD Services & Networking · difficulty 2 · single

Which Gateway API resource allows a backend in namespace `team-a` to reference a Service in namespace `team-b`?

- A) `GatewayClass`
- B) `HTTPRoute`
- C) `ReferenceGrant`
- D) `BackendTLSPolicy`

<details><summary>Answer</summary>

**C.** A ReferenceGrant authorizes cross-namespace references.

- Why not A: GatewayClass defines the controller implementation.
- Why not B: HTTPRoute defines routes but cannot authorize cross-namespace backends by itself.
- Why not D: BackendTLSPolicy configures TLS to the backend.
- Ref: [modules/08-gateway-api-and-ingress-migration.md](../modules/08-gateway-api-and-ingress-migration.md), https://kubernetes.io/docs/concepts/services-networking/gateway/

</details>

### Q-K8S-114 · CKAD Services & Networking · difficulty 3 · scenario

A developer wants to allow only the `frontend` Pods to reach the `backend` Pods on port 8080. Which NetworkPolicy fields are required?

- A) `podSelector` selecting the backend and an `ingress` rule selecting the frontend.
- B) `podSelector` selecting the frontend and an `egress` rule selecting the backend.
- C) Both A and B are required.
- D) A NetworkPolicy cannot select by namespace.

<details><summary>Answer</summary>

**A.** The policy attaches to the backend Pods and allows ingress from the frontend Pods.

- Why not B: that policy would restrict the frontend's egress, not the backend's ingress.
- Why not C: only the backend's ingress policy is required for this requirement.
- Why not D: NetworkPolicy can select by namespace using `namespaceSelector`.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/network-policies/

</details>

### Q-K8S-115 · CKAD Services & Networking · difficulty 1 · single

What DNS name does a Pod use to reach a Service named `catalog` in the `shop` namespace?

- A) `catalog.shop.svc.cluster.local`
- B) `catalog.svc.cluster.local`
- C) `shop.catalog.svc.cluster.local`
- D) `catalog.shop.pod.cluster.local`

<details><summary>Answer</summary>

**A.** The fully qualified Service DNS name is `<service>.<namespace>.svc.cluster.local`.

- Why not B: that omits the namespace.
- Why not C: the order is service then namespace.
- Why not D: Pods have their own DNS format, not the Service format.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/

</details>

### Q-K8S-116 · CKAD Services & Networking · difficulty 3 · scenario

Two HTTPRoute rules match a request: one with `PathPrefix /` and one with `Exact /health`. Which rule takes precedence?

- A) The `PathPrefix /` rule always wins.
- B) The `Exact /health` rule wins for `/health`.
- C) The rule created first wins.
- D) Gateway API load-balances between the two rules.

<details><summary>Answer</summary>

**B.** Exact matches take precedence over prefix matches, so `/health` routes to the Exact rule.

- Why not A: prefix matches are lower precedence than exact matches.
- Why not C: creation order does not determine precedence.
- Why not D: matching is deterministic, not load-balanced.
- Ref: [modules/08-gateway-api-and-ingress-migration.md](../modules/08-gateway-api-and-ingress-migration.md), https://kubernetes.io/docs/concepts/services-networking/gateway/

</details>

### Q-K8S-117 · CKAD Services & Networking · difficulty 2 · scenario

Which Service type provisions an external load balancer from the cloud provider?

- A) ClusterIP
- B) NodePort
- C) LoadBalancer
- D) ExternalName

<details><summary>Answer</summary>

**C.** LoadBalancer provisions a cloud load balancer and assigns an external IP.

- Why not A: ClusterIP is internal only.
- Why not B: NodePort exposes a port on each node.
- Why not D: ExternalName maps to an external DNS name.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer

</details>

### Q-K8S-118 · CKAD Application Observability · difficulty 1 · single

Which command streams a container's logs in real time?

- A) `kubectl logs -f <pod>`
- B) `kubectl logs --previous <pod>`
- C) `kubectl describe pod <pod>`
- D) `kubectl exec <pod> -- tail -f /var/log/app.log`

<details><summary>Answer</summary>

**A.** `-f` follows the log stream.

- Why not B: `--previous` reads the previous container's logs.
- Why not C: `describe` shows metadata and events, not logs.
- Why not D: that tails a file inside the container, not the container log stream.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/

</details>

### Q-K8S-119 · CKAD Application Observability · difficulty 2 · single

Which command displays the current CPU and memory usage of Pods?

- A) `kubectl top pods`
- B) `kubectl get pods`
- C) `kubectl describe pods`
- D) `kubectl logs --metrics`

<details><summary>Answer</summary>

**A.** `kubectl top pods` reads from the Metrics API.

- Why not B: `get pods` shows status and labels, not usage.
- Why not C: `describe` shows events and spec, not live usage.
- Why not D: `logs` has no `--metrics` flag.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/

</details>

### Q-K8S-120 · CKAD Application Observability · difficulty 2 · scenario

A rollout is stuck because new Pods never become ready. Which command best reveals why the Pods are not ready?

- A) `kubectl get deployments`
- B) `kubectl describe pod <new-pod>`
- C) `kubectl top nodes`
- D) `kubectl get services`

<details><summary>Answer</summary>

**B.** `describe pod` shows the readiness probe failures and events.

- Why not A: `get deployments` shows replica counts, not probe details.
- Why not C: `top nodes` shows node usage, not Pod readiness.
- Why not D: `get services` shows endpoints, not the cause.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/

</details>

### Q-K8S-121 · CKAD Application Observability · difficulty 3 · scenario

A Deployment's Pods are running but the application returns 500 errors. The liveness and readiness probes pass, and the logs show no errors. Which is the most likely cause?

- A) The Pods' resource limits are too high.
- B) The application depends on an external service or configuration that is unavailable or incorrect.
- C) The Deployment's `replicas` field is too low.
- D) The Service selector is empty.

<details><summary>Answer</summary>

**B.** Passing probes with no application errors in the logs points to a dependency or configuration problem.

- Why not A: high limits do not cause 500 errors.
- Why not C: low replicas reduce capacity but do not cause 500s.
- Why not D: an empty selector would cause no endpoints, not 500s from running Pods.
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/

</details>

### Q-K8S-122 · CKAD Application Environment · difficulty 2 · multi

Which fields belong in a container `securityContext`? (Select all that apply)

- A) `runAsNonRoot`
- B) `allowPrivilegeEscalation`
- C) `imagePullPolicy`
- D) `capabilities`

<details><summary>Answer</summary>

**A, B, and D.** `runAsNonRoot`, `allowPrivilegeEscalation`, and `capabilities` are all container `securityContext` fields.

- Why not C: `imagePullPolicy` is a container field, not a `securityContext` field.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/

</details>

## Part 3: CKS Question Bank (Q-K8S-123 to Q-K8S-186)

### Q-K8S-123 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · single

Which Pod Security Standard profile provides the most restrictive security posture, disallowing privilege escalation and enforcing non-root execution?

- A) Privileged
- B) Baseline
- C) Restricted
- D) Unrestricted

<details><summary>Answer</summary>

**C.** The `restricted` Pod Security Standard enforces hardening best practices including non-root execution, dropped capabilities, and read-only root filesystems.

- Why not A: Privileged is completely unconstrained.
- Why not B: Baseline prevents known privilege escalations but allows standard defaults.
- Why not D: Unrestricted is not a standard profile.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted

</details>

### Q-K8S-124 · CKS Supply Chain Security · difficulty 2 · scenario

An enterprise security team requires all container images deployed to the cluster to be cryptographically signed and verified before admission. Which tool or policy engine validates container signatures at admission time?

- A) CoreDNS
- B) Kyverno or ValidatingAdmissionPolicy with signature verification tools (e.g., Cosign)
- C) kube-proxy
- D) etcd snapshotter

<details><summary>Answer</summary>

**B.** Kyverno and admission webhook policy engines verify image signatures (such as Cosign signatures) before allowing pods to be created.

- Why not A, C, D: CoreDNS, kube-proxy, and etcd do not perform container image signature verification.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kyverno.io/docs/writing-policies/verify-images/

</details>

### Q-K8S-125 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

Which runtime security tool monitors system calls against kernel security profiles (e.g., detecting unexpected shell spawning inside a container) in real time?

- A) Falco
- B) kubectl top
- C) Helm
- D) Kustomize

<details><summary>Answer</summary>

**A.** Falco uses kernel module tracing (eBPF or kernel modules) to detect anomalous runtime behavior and security violations in containers.

- Why not B: `kubectl top` measures CPU/memory metrics.
- Why not C, D: Helm and Kustomize are deployment packaging tools.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://falco.org/docs/

</details>

### Q-K8S-126 · CKS Cluster Setup · difficulty 2 · single

What is the primary purpose of enabling encryption at rest for Kubernetes Secrets in etcd?

- A) To accelerate etcd read performance.
- B) To ensure sensitive payloads (passwords, tokens) are encrypted when stored in etcd, protecting confidentiality if etcd storage dumps are compromised.
- C) To compress etcd snapshot file sizes.
- D) To eliminate the need for RBAC.

<details><summary>Answer</summary>

**B.** Encryption at rest encrypts Secret resource payloads before writing them to etcd, preventing plaintext extraction from etcd database backups.

- Why not A: Encryption incurs cryptographic overhead, not speedups.
- Why not C: Compression is handled by etcd backend mechanisms, not secret encryption.
- Why not D: RBAC controls API access, not etcd disk confidentiality.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/

</details>

### Q-K8S-127 · CKS Cluster Hardening · difficulty 2 · scenario

An administrator auditing RBAC permissions discovers a ClusterRole containing `verbs: ["*"]` and `resources: ["*"]` bound to a general developer group. Which security principle does this violate?

- A) Principle of Least Privilege
- B) High Availability
- C) Level-Triggered Reconciliation
- D) Immutable Infrastructure

<details><summary>Answer</summary>

**A.** Granting wildcard cluster-admin permissions violates the Principle of Least Privilege by giving excessive cluster-wide administrative access.

- Why not B, C, D: These refer to availability, reconciliation, and immutability concepts, not RBAC privilege scope.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/rbac/

</details>

### Q-K8S-128 · CKS System Hardening · difficulty 2 · single

What kernel-level security mechanism restricts the system calls a container process is allowed to make?

- A) seccomp (Secure Computing Mode)
- B) DNS search paths
- C) CNI IPam
- D) PersistentVolume claims

<details><summary>Answer</summary>

**A.** seccomp filters syscalls made by container processes, blocking unauthorized or dangerous kernel system calls.

- Why not B, C, D: DNS, CNI, and PVCs handle networking and storage.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://kubernetes.io/docs/tutorials/security/seccomp/

</details>

### Q-K8S-129 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

How does enabling user namespaces (`hostUsers: false`) enhance container isolation in Kubernetes 1.37?

- A) It maps container root (UID 0) to an unprivileged non-root user ID on the host kernel, preventing container root breakout exploits.
- B) It encrypts network traffic between pods.
- C) It accelerates container image downloads.
- D) It replaces RBAC authorization.

<details><summary>Answer</summary>

**A.** User namespaces map container root user IDs to unprivileged user IDs on the host, ensuring that even if a process breaks out of the container, it possesses no root privileges on the host OS.

- Why not B, C, D: Network encryption, image pulls, and RBAC are managed by other subsystems.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/

</details>

### Q-K8S-130 · CKS Supply Chain Security · difficulty 2 · single

What is a Software Bill of Materials (SBOM)?

- A) A list of all open-source packages, libraries, and dependencies included in a software artifact or container image.
- B) A Kubernetes deployment YAML manifest.
- C) An etcd database backup snapshot.
- D) A cluster audit log file.

<details><summary>Answer</summary>

**A.** An SBOM provides a comprehensive inventory of software components and dependencies, crucial for vulnerability tracking and supply-chain auditing.

- Why not B, C, D: Deployment manifests, etcd snapshots, and audit logs serve operational and runtime functions, not dependency inventory.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://www.cisa.gov/sbom

</details>

### Q-K8S-131 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

Where are Kubernetes API server audit logs configured and written on a control plane node?

- A) Configured via API server flags (`--audit-policy-file`, `--audit-log-path`) and written to disk or forwarded streams.
- B) Stored inside ConfigMaps in the default namespace.
- C) Logged automatically by kube-proxy.
- D) Managed exclusively by CoreDNS.

<details><summary>Answer</summary>

**A.** Audit logging is configured on the kube-apiserver using audit policy and log path flags, recording all incoming administrative and user API requests.

- Why not B, C, D: ConfigMaps, kube-proxy, and CoreDNS do not manage cluster audit log policies.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/

</details>

### Q-K8S-132 · CKS Cluster Setup · difficulty 2 · single

What is the purpose of the CIS Kubernetes Benchmark?

- A) To benchmark container image download speeds.
- B) To provide prescriptive security configuration guidelines and best practices for hardening Kubernetes clusters against security risks.
- C) To measure database transaction throughput in etcd.
- D) To test CNI network bandwidth.

<details><summary>Answer</summary>

**B.** The CIS Benchmark provides consensus-based security configuration standards for hardening control planes, worker nodes, and etcd.

- Why not A, C, D: Benchmarks assess security hardening, not download speeds, etcd throughput, or network bandwidth.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://www.cisecurity.org/benchmark/kubernetes

</details>

### Q-K8S-133 · CKS Cluster Hardening · difficulty 2 · scenario

An auditor needs to verify whether any ServiceAccounts possess overly permissive `cluster-admin` bindings. Which Kubernetes command lists cluster role bindings?

- A) `kubectl get clusterrolebindings`
- B) `kubectl top nodes`
- C) `kubectl get storageclasses`
- D) `kubectl get endpoints`

<details><summary>Answer</summary>

**A.** `kubectl get clusterrolebindings` inspects cluster-wide role bindings linking subjects (ServiceAccounts, users) to ClusterRoles.

- Why not B, C, D: Nodes, storage classes, and endpoints measure metrics and storage, not RBAC bindings.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/rbac/

</details>

### Q-K8S-134 · CKS System Hardening · difficulty 2 · single

What Linux kernel capability allows a process to bypass all kernel permission checks, representing a major security risk if retained by a container?

- A) `CAP_NET_BIND_SERVICE`
- B) `CAP_SYS_ADMIN` or `CAP_CHOWN` (specifically `CAP_SYS_ADMIN` acts as a catch-all privilege equivalent to root)
- C) `CAP_KILL`
- D) `CAP_SETGID`

<details><summary>Answer</summary>

**B.** `CAP_SYS_ADMIN` grants broad administrative privileges (mounting filesystems, namespaces, raw device access), effectively bypassing most kernel security checks.

- Why not A: `CAP_NET_BIND_SERVICE` only allows binding to privileged ports (< 1024).
- Why not C, D: `CAP_KILL` and `CAP_SETGID` manage process signals and group IDs, not full kernel administration.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://man7.org/linux/man-pages/man7/capabilities.7.html

</details>

### Q-K8S-135 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

A developer configures a Pod security context with `allowPrivilegeEscalation: false`. What security protection does this provide?

- A) It prevents child processes from gaining more privileges than their parent process (e.g., via `setuid` binaries or `no_new_privs`).
- B) It blocks all network traffic.
- C) It forces the container to run as root.
- D) It mounts read-only root filesystems.

<details><summary>Answer</summary>

**A.** `allowPrivilegeEscalation: false` ensures that processes inside the container cannot acquire new privileges (setting the `no_new_privs` kernel flag).

- Why not B, C, D: Network blocking, root execution, and read-only filesystems are governed by network policies, user IDs, and readOnlyRootFilesystem settings.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/

</details>

### Q-K8S-136 · CKS Supply Chain Security · difficulty 2 · single

What is the primary function of admission controllers in the Kubernetes API server request lifecycle?

- A) To route internal network packets.
- B) To intercept API requests after authentication and authorization to validate or mutate resource objects before persistence.
- C) To compile Helm charts.
- D) To mount persistent volumes.

<details><summary>Answer</summary>

**B.** Admission controllers intercept requests after authn/authz to enforce policies, validate schemas, or mutate object defaults before writing to etcd.

- Why not A, C, D: Networking, chart compilation, and volume mounting are handled by CNI, Helm, and CSI.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/

</details>

### Q-K8S-137 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

An incident responder needs to investigate network socket activity and process execution anomalies on a potentially compromised worker node. Which tool provides eBPF-based kernel tracing across container workloads?

- A) Falco / Tetragon
- B) kubectl get pods
- C) CoreDNS
- D) HPA

<details><summary>Answer</summary>

**A.** Falco and Tetragon leverage eBPF kernel probes to trace security events, process executions, and socket connections in real time.

- Why not B, C, D: Standard Kubernetes tooling does not perform kernel-level eBPF intrusion tracing.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://falco.org/docs/

</details>

### Q-K8S-138 · CKS Cluster Setup · difficulty 2 · single

Why should anonymous requests (`--anonymous-auth=false`) be disabled or restricted on the kube-apiserver?

- A) To prevent unauthenticated clients from querying unauthenticated API endpoints or gathering cluster topology information.
- B) To accelerate API response times.
- C) To enable CoreDNS resolution.
- D) To allow automatic HPA scaling.

<details><summary>Answer</summary>

**A.** Disabling anonymous authentication prevents unauthenticated remote clients from accessing public API server endpoints and inspecting cluster status.

- Why not B, C, D: Anonymous auth settings do not affect speed, DNS, or HPA scaling.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/authentication/#anonymous-requests

</details>

### Q-K8S-139 · CKS Cluster Hardening · difficulty 2 · scenario

What is the security risk of mounting the Docker socket (`/var/run/docker.sock`) or container runtime socket inside an application container?

- A) It allows the container to spawn arbitrary containers on the host, achieving full root control over the host node (container breakout).
- B) It slows down container networking.
- C) It disables volume mounting.
- D) It forces read-only root filesystems.

<details><summary>Answer</summary>

**A.** Mounting the container runtime socket gives the workload root access to the container daemon, enabling immediate container escape and host takeover.

- Why not B, C, D: Runtime socket mounting does not slow networking or disable volume mounts.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/security/security-checklist/

</details>

### Q-K8S-140 · CKS System Hardening · difficulty 2 · single

What Linux security module provides mandatory access control (MAC) policies, often configured via AppArmor profiles in Kubernetes?

- A) AppArmor / SELinux
- B) CNI IPam
- C) CoreDNS
- D) etcd Raft

<details><summary>Answer</summary>

**A.** AppArmor and SELinux enforce mandatory access control (MAC) restricting programs to specific file read, write, and execution privileges.

- Why not B, C, D: CNI, CoreDNS, and etcd manage networking, DNS, and consensus storage.
- Ref: [modules/03-node-internals.md](../modules/03-node-internals.md), https://kubernetes.io/docs/tutorials/security/apparmor/

</details>

### Q-K8S-141 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

A security policy mandates that all containers must drop all default Linux capabilities and retain only `NET_BIND_SERVICE`. How is this expressed in the container securityContext?

- A) `securityContext.capabilities: { drop: ["ALL"], add: ["NET_BIND_SERVICE"] }`
- B) `securityContext.privileged: true`
- C) `securityContext.runAsUser: 0`
- D) `securityContext.readOnlyRootFilesystem: false`

<details><summary>Answer</summary>

**A.** Dropping `"ALL"` and explicitly adding required capabilities (`NET_BIND_SERVICE`) enforces the principle of least privilege for Linux capabilities.

- Why not B, C, D: Privileged mode, root execution, and writable filesystems weaken security.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-capabilities-for-a-container

</details>

### Q-K8S-142 · CKS Supply Chain Security · difficulty 2 · single

What is the primary role of admission webhooks using Common Expression Language (`ValidatingAdmissionPolicy`) compared to webhook servers?

- A) `ValidatingAdmissionPolicy` evaluates CEL expressions natively inside the API server without requiring external network webhook server backends, improving reliability and performance.
- B) They compile Docker images.
- C) They replace etcd storage.
- D) They manage CNI IP assignment.

<details><summary>Answer</summary>

**A.** `ValidatingAdmissionPolicy` evaluates declarative CEL rules directly inside the API server, eliminating external network latency and failure risks associated with HTTP admission webhook servers.

- Why not B, C, D: Image compilation, etcd storage, and CNI IP assignment are outside admission policy evaluation.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/

</details>

### Q-K8S-143 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

An auditor reviewing audit logs notices numerous `Forbidden` responses on sensitive resources (Secrets, ClusterRoles). What security risk does this highlight?

- A) Active reconnaissance or unauthorized privilege escalation attempts by compromised accounts or service accounts.
- B) Normal CoreDNS resolution traffic.
- C) Successful HPA scaling operations.
- D) Successful etcd snapshot compaction.

<details><summary>Answer</summary>

**A.** Repeated `Forbidden` audit events indicate scanning, reconnaissance, or unauthorized access attempts against restricted API endpoints.

- Why not B, C, D: CoreDNS, HPA, and etcd operations generate normal cluster telemetry, not unauthorized RBAC forbidden failures.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/

</details>

### Q-K8S-144 · CKS Cluster Setup · difficulty 2 · single

Why is securing kubeconfig files with strict file permissions (e.g., `chmod 600`) critical for cluster security?

- A) Kubeconfig files contain plaintext client certificates, tokens, and cluster endpoint credentials granting administrative access.
- B) To enable etcd compaction.
- C) To accelerate container runtime execution.
- D) To prevent DNS lookup delays.

<details><summary>Answer</summary>

**A.** Kubeconfig files store credentials, client certificates, and bearer tokens; unencrypted read permissions allow local users to steal cluster admin access.

- Why not B, C, D: Permissions do not affect etcd compaction, container execution speed, or DNS resolution.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/

</details>

### Q-K8S-145 · CKS Cluster Hardening · difficulty 2 · scenario

An administrator wants to prevent accidental deletion of a production namespace `finance`. Which object or field provides this protection?

- A) A finalizer (`metadata.finalizers`) or admission policy restricting deletion.
- B) `spec.replicas: 0`
- C) `nodeSelector`
- D) `terminationGracePeriodSeconds: 0`

<details><summary>Answer</summary>

**A.** Finalizers and validating admission policies prevent namespace or resource deletion until cleanup hooks complete or authorization passes.

- Why not B, C, D: Replicas, node selectors, and grace periods govern workloads and scheduling, not deletion protection.
- Ref: [modules/01-declarative-api-and-reconciliation.md](../modules/01-declarative-api-and-reconciliation.md), https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/

</details>

### Q-K8S-146 · CKS System Hardening · difficulty 2 · single

What is the benefit of mounting container root filesystems as read-only (`readOnlyRootFilesystem: true`)?

- A) It prevents malicious actors or malware from writing persistent binaries, backdoors, or altering system files on the container root filesystem.
- B) It accelerates CNI packet routing.
- C) It disables liveness probes.
- D) It bypasses RBAC checks.

<details><summary>Answer</summary>

**A.** Read-only root filesystems prevent attackers from writing malware binaries or modifying application code inside the container filesystem.

- Why not B, C, D: Routing, probes, and RBAC are unaffected by container root filesystem writability.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/

</details>

### Q-K8S-147 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

An automated vulnerability scanner flags a container image for containing a high-severity CVE in an OS package. What is the most effective remediation strategy?

- A) Rebuild the container image using an updated base image patch, re-scan, and redeploy.
- B) Ignore the CVE and increase pod replicas.
- C) Delete CoreDNS.
- D) Increase terminationGracePeriodSeconds.

<details><summary>Answer</summary>

**A.** Patching base images and rebuilding container artifacts remediates vulnerabilities at the source of the software supply chain.

- Why not B, C, D: Ignoring vulnerabilities, deleting CoreDNS, or changing grace periods does not patch package CVEs.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/security/

</details>

---

### Q-K8S-148 · CKS Minimize Microservice Vulnerabilities · difficulty 1 · single

Which Pod Security Standard profile is the most permissive and is intended for system- and infrastructure-level workloads managed by trusted users?

- A) restricted
- B) baseline
- C) privileged
- D) default

<details><summary>Answer</summary>

**C.** The privileged profile is unrestricted and is intended for system- and infrastructure-level workloads managed by privileged, trusted users.

- Why not A: restricted is the most restrictive profile.
- Why not B: baseline is moderately restrictive.
- Why not D: default is not a Pod Security Standard profile name.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/security/pod-security-standards/

</details>

### Q-K8S-149 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

A namespace is labeled `pod-security.kubernetes.io/enforce: restricted`. What happens when a Pod that runs as root is created in that namespace?

- A) The Pod is created but audited.
- B) The Pod is rejected by the API server.
- C) The Pod is created with a warning event.
- D) The Pod is automatically mutated to run as non-root.

<details><summary>Answer</summary>

**B.** The `enforce` label causes the API server to reject Pods that violate the profile.

- Why not A: auditing is the `audit` label, not `enforce`.
- Why not C: warning is the `warn` label.
- Why not D: Pod Security Admission does not mutate Pods; it only admits or rejects.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/security/pod-security-admission/

</details>

### Q-K8S-150 · CKS Minimize Microservice Vulnerabilities · difficulty 3 · scenario

A Pod must use a custom seccomp profile stored at `/var/lib/kubelet/seccomp/profiles/custom.json` on the node. Which `securityContext` field and value reference it?

- A) `seccompProfile: {type: RuntimeDefault}`
- B) `seccompProfile: {type: Localhost, localhostProfile: profiles/custom.json}`
- C) `seccompProfile: {type: Unconfined}`
- D) `seccompProfile: {type: Default}`

<details><summary>Answer</summary>

**B.** `Localhost` references a profile file on the node; `localhostProfile` names the file relative to the seccomp profile root.

- Why not A: RuntimeDefault uses the container runtime's default profile, not a custom file.
- Why not C: Unconfined disables seccomp.
- Why not D: `Default` is not a valid seccomp profile type.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tutorials/security/seccomp/

</details>

### Q-K8S-151 · CKS Minimize Microservice Vulnerabilities · difficulty 3 · scenario

A Pod sets `hostUsers: false` in its `securityContext`. What does this enable?

- A) The Pod's containers run as UID 0 mapped to a non-root UID on the host.
- B) The Pod can mount the host's `/proc` filesystem.
- C) The Pod's ServiceAccount token is disabled.
- D) The Pod is exempt from Pod Security Standards.

<details><summary>Answer</summary>

**A.** User namespaces map the container's root UID to a non-root host UID, so a container escape does not grant host root.

- Why not B: user namespaces do not grant host `/proc` access.
- Why not C: the ServiceAccount token is unrelated to user namespaces.
- Why not D: Pod Security Standards still apply; `hostUsers: false` is required by the restricted profile.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/

</details>

### Q-K8S-152 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

A container retains the `CAP_NET_RAW` capability. What is the primary risk?

- A) The container can read arbitrary files on the host.
- B) The container can craft raw network packets, enabling ARP spoofing or ping floods.
- C) The container can modify its own image.
- D) The container can escalate to host root automatically.

<details><summary>Answer</summary>

**B.** CAP_NET_RAW allows raw socket creation, which can be used for network attacks.

- Why not A: file access is governed by file permissions and other capabilities.
- Why not C: the image is read-only at runtime.
- Why not D: capabilities do not automatically escalate to host root.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/

</details>

### Q-K8S-153 · CKS Minimize Microservice Vulnerabilities · difficulty 1 · single

What is the security risk of setting `privileged: true` on a container?

- A) The container cannot access the network.
- B) The container gains all capabilities and access to host devices, effectively running as root on the host.
- C) The container's image is pulled over an unencrypted connection.
- D) The container's logs are not collected.

<details><summary>Answer</summary>

**B.** A privileged container has full capabilities and host device access.

- Why not A: privileged containers have full network access.
- Why not C: image pulls use the runtime's transport.
- Why not D: logs are collected normally.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/security/pod-security-standards/

</details>

### Q-K8S-154 · CKS Minimize Microservice Vulnerabilities · difficulty 3 · scenario

A team wants to see which Pods would violate the restricted profile without blocking them. Which namespace labels enable this?

- A) `pod-security.kubernetes.io/audit: restricted` and `pod-security.kubernetes.io/warn: restricted`
- B) `pod-security.kubernetes.io/enforce: restricted`
- C) `pod-security.kubernetes.io/audit: privileged`
- D) `pod-security.kubernetes.io/warn: baseline`

<details><summary>Answer</summary>

**A.** The `audit` and `warn` labels report violations without rejecting Pods.

- Why not B: `enforce` rejects violating Pods.
- Why not C: auditing privileged would not detect restricted violations.
- Why not D: warning on baseline would not detect restricted violations.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/security/pod-security-admission/

</details>

### Q-K8S-155 · CKS Minimize Microservice Vulnerabilities · difficulty 3 · scenario

A Pod mounts `hostPath: /var/run/docker.sock` (or the container runtime socket). What is the primary risk?

- A) The Pod can read and write arbitrary host files.
- B) The Pod can control the container runtime and escape to the host.
- C) The Pod's network performance degrades.
- D) The Pod cannot be scheduled.

<details><summary>Answer</summary>

**B.** Mounting the runtime socket lets the Pod create privileged containers on the host, leading to container escape.

- Why not A: hostPath to the socket does not grant arbitrary file access.
- Why not C: network performance is unaffected.
- Why not D: hostPath does not affect scheduling.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/storage/volumes/#hostpath

</details>

### Q-K8S-156 · CKS Supply Chain Security · difficulty 1 · single

Which image reference pins an image to an immutable content digest?

- A) `registry.example.com/app:latest`
- B) `registry.example.com/app:v1.2.3`
- C) `registry.example.com/app@sha256:4f7c...`
- D) `registry.example.com/app:prod`

<details><summary>Answer</summary>

**C.** The `@sha256:` digest references the image manifest by content hash.

- Why not A: `latest` is a mutable tag.
- Why not B: version tags are mutable.
- Why not D: environment tags are mutable.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/containers/

</details>

### Q-K8S-157 · CKS Supply Chain Security · difficulty 2 · scenario

A team verifies image signatures with cosign using OIDC identity (keyless) instead of a static key. What does keyless verification bind the signature to?

- A) The image digest and the builder's OIDC identity from the certificate transparency log.
- B) The image tag and the registry hostname.
- C) The cluster's ServiceAccount.
- D) The node's container runtime.

<details><summary>Answer</summary>

**A.** Keyless signing uses short-lived certificates tied to an OIDC identity and records them in the transparency log.

- Why not B: tags are mutable and not part of the signature binding.
- Why not C: ServiceAccounts are in-cluster identities.
- Why not D: the runtime does not sign images.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/

</details>

### Q-K8S-158 · CKS Supply Chain Security · difficulty 1 · single

Which tool scans container images for known OS and package vulnerabilities?

- A) cosign
- B) Trivy
- C) kubectl
- D) etcdctl

<details><summary>Answer</summary>

**B.** Trivy is a vulnerability scanner for images and filesystems.

- Why not A: cosign verifies signatures, not vulnerabilities.
- Why not C: kubectl manages the cluster.
- Why not D: etcdctl manages etcd.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://trivy.dev/

</details>

### Q-K8S-159 · CKS Supply Chain Security · difficulty 3 · scenario

A Kyverno `ClusterPolicy` must reject any Pod whose image is not signed. Which policy rule type performs this?

- A) A `validate` rule that checks the image digest.
- B) A `verifyImages` rule that checks the image signature.
- C) A `mutate` rule that adds a label.
- D) A `generate` rule that creates a ConfigMap.

<details><summary>Answer</summary>

**B.** Kyverno's `verifyImages` rule verifies image signatures and attestations at admission.

- Why not A: a validate rule can check fields but cannot verify a cryptographic signature.
- Why not C: mutation does not verify signatures.
- Why not D: generation does not verify signatures.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kyverno.io/docs/

</details>

### Q-K8S-160 · CKS Supply Chain Security · difficulty 2 · scenario

A team needs to produce an SBOM for every image as part of the build. Which statement about SBOM attestations is true?

- A) An SBOM attestation is stored in the image registry and can be verified at admission.
- B) An SBOM is only useful after deployment.
- C) An SBOM attestation replaces image signing.
- D) An SBOM is generated by the kubelet.

<details><summary>Answer</summary>

**A.** SBOM attestations are stored alongside the image and can be verified by admission policies.

- Why not B: SBOMs are used at admission to block vulnerable images.
- Why not C: SBOM and signature attestations are complementary.
- Why not D: SBOMs are generated at build time, not by the kubelet.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/

</details>

### Q-K8S-161 · CKS Supply Chain Security · difficulty 3 · scenario

A Pod must pull an image from a private registry. The Secret exists in the Pod's namespace, but the Pod spec does not reference it. What happens?

- A) The image pull succeeds because the registry credentials are cluster-wide.
- B) The image pull fails with `Unauthorized` because the Pod does not reference the Secret in `imagePullSecrets`.
- C) The image pull succeeds because the kubelet uses the node's credentials.
- D) The Pod is scheduled but the container never starts.

<details><summary>Answer</summary>

**B.** The kubelet uses the Pod's `imagePullSecrets`; without the reference, the pull is unauthenticated.

- Why not A: registry credentials are namespace-scoped Secrets.
- Why not C: the node's credentials are not used unless configured as a cluster-wide default.
- Why not D: the Pod starts but the container stays in `ImagePullBackOff`.
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/

</details>

### Q-K8S-162 · CKS Supply Chain Security · difficulty 1 · single

Which `imagePullPolicy` always pulls the image from the registry, even if a local copy exists?

- A) IfNotPresent
- B) Never
- C) Always
- D) Default

<details><summary>Answer</summary>

**C.** `Always` forces a registry pull on every container start.

- Why not A: IfNotPresent pulls only when the image is absent locally.
- Why not B: Never uses only the local image.
- Why not D: Default is not a valid policy value.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/containers/

</details>

### Q-K8S-163 · CKS Supply Chain Security · difficulty 3 · scenario

A build system produces SLSA provenance for each image. What does the provenance attestation contain?

- A) The image's vulnerability scan results.
- B) The build inputs, builder identity, and build steps that produced the image.
- C) The image's runtime logs.
- D) The cluster's RBAC configuration.

<details><summary>Answer</summary>

**B.** SLSA provenance records the build's inputs, builder, and steps.

- Why not A: vulnerability results are separate attestations.
- Why not C: runtime logs are not part of the build provenance.
- Why not D: RBAC is cluster configuration, not build metadata.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/

</details>

### Q-K8S-164 · CKS Monitoring, Logging & Runtime Security · difficulty 1 · single

Which audit policy stage logs only the request metadata, not the request or response bodies?

- A) RequestResponse
- B) Metadata
- C) None
- D) Detailed

<details><summary>Answer</summary>

**B.** The Metadata stage logs request metadata without bodies.

- Why not A: RequestResponse logs both bodies.
- Why not C: None disables logging for the request.
- Why not D: Detailed is not a valid stage.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/

</details>

### Q-K8S-165 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

An audit policy must log every read of a Secret in the `finance` namespace. Which rule matches?

- A) A rule with `resources: [{group: "", resources: ["secrets"]}]`, `namespace: finance`, and `verb: get` at stage Metadata.
- B) A rule with `resources: [{group: "", resources: ["pods"]}]`.
- C) A rule with `verbs: ["*"]` and stage None.
- D) A rule with `resources: [{group: "apps", resources: ["deployments"]}]`.

<details><summary>Answer</summary>

**A.** The rule selects Secrets in the finance namespace and logs the get verb at the Metadata stage.

- Why not B: that selects Pods, not Secrets.
- Why not C: stage None disables logging.
- Why not D: that selects Deployments.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/

</details>

### Q-K8S-166 · CKS Monitoring, Logging & Runtime Security · difficulty 1 · single

Which Falco rule field specifies the condition that triggers an alert?

- A) `condition`
- B) `output`
- C) `priority`
- D) `description`

<details><summary>Answer</summary>

**A.** The `condition` field defines the event filter that triggers the rule.

- Why not B: `output` defines the message, not the trigger.
- Why not C: `priority` sets the severity.
- Why not D: `description` is documentation.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://falco.org/docs/

</details>

### Q-K8S-167 · CKS Monitoring, Logging & Runtime Security · difficulty 3 · scenario

A runtime security tool uses eBPF to trace syscalls. What is the main advantage over ptrace-based tracing?

- A) eBPF runs in user space and is slower.
- B) eBPF programs run in the kernel with low overhead and can filter events before they reach user space.
- C) eBPF requires recompiling the kernel.
- D) eBPF can only trace network traffic.

<details><summary>Answer</summary>

**B.** eBPF programs run in a sandboxed kernel environment with low overhead and can aggregate events efficiently.

- Why not A: eBPF runs in the kernel, not user space.
- Why not C: eBPF does not require kernel recompilation.
- Why not D: eBPF can trace syscalls, not just network traffic.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://ebpf.io/

</details>

### Q-K8S-168 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

A security team needs audit logs to survive a compromised control plane. Which approach best protects them?

- A) Store logs only on the control plane node's disk.
- B) Forward logs to an external, immutable store with write-once semantics.
- C) Increase the audit log level to RequestResponse.
- D) Disable audit logging to reduce disk usage.

<details><summary>Answer</summary>

**B.** An external immutable store prevents an attacker who controls the control plane from deleting the logs.

- Why not A: a compromised control plane can delete local logs.
- Why not C: a higher level increases detail but not durability.
- Why not D: disabling logging removes the evidence.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/

</details>

### Q-K8S-169 · CKS Monitoring, Logging & Runtime Security · difficulty 3 · scenario

A Pod suddenly consumes 100% CPU and opens outbound connections to an unknown IP. Which runtime security capability detects this?

- A) A static image scan.
- B) A runtime policy that alerts on unexpected process execution and network connections.
- C) A Pod Security Standards baseline check.
- D) An RBAC audit.

<details><summary>Answer</summary>

**B.** Runtime security monitors process execution and network activity to detect cryptomining behavior.

- Why not A: static scans run at build time and cannot detect runtime behavior.
- Why not C: Pod Security Standards control Pod settings, not runtime behavior.
- Why not D: RBAC audits API calls, not process behavior.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://falco.org/docs/

</details>

### Q-K8S-170 · CKS Monitoring, Logging & Runtime Security · difficulty 1 · single

Which component exposes audit log metrics that can trigger alerts?

- A) The API server's audit backend and policy engine.
- B) The scheduler.
- C) The kubelet.
- D) CoreDNS.

<details><summary>Answer</summary>

**A.** The API server's audit backend emits logs and metrics that Alertmanager can use.

- Why not B: the scheduler does not handle audit logs.
- Why not C: the kubelet handles node-level logs, not API audit logs.
- Why not D: CoreDNS handles DNS.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/

</details>

### Q-K8S-171 · CKS Cluster Setup · difficulty 1 · single

Which kube-apiserver flag enables both node and RBAC authorization?

- A) `--authorization-mode=AlwaysAllow`
- B) `--authorization-mode=Node,RBAC`
- C) `--authorization-mode=Node`
- D) `--authorization-mode=RBAC,AlwaysDeny`

<details><summary>Answer</summary>

**B.** `Node,RBAC` chains the node authorizer and the RBAC authorizer.

- Why not A: AlwaysAllow disables authorization.
- Why not C: Node alone does not handle RBAC.
- Why not D: AlwaysDeny denies everything.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/authorization/

</details>

### Q-K8S-172 · CKS Cluster Setup · difficulty 2 · scenario

A cluster uses a KMS v2 plugin for Secrets encryption at rest. What is encrypted with the KMS key?

- A) The entire etcd database.
- B) A data encryption key (DEK) that encrypts the Secret values.
- C) The API server's TLS certificate.
- D) The kubelet's client certificate.

<details><summary>Answer</summary>

**B.** KMS v2 uses envelope encryption: the KMS key encrypts a DEK, which encrypts the Secret.

- Why not A: only Secrets and configured resources are encrypted, not the whole database.
- Why not C: TLS certificates are not encrypted with the KMS key.
- Why not D: kubelet certificates are not encrypted with the KMS key.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/

</details>

### Q-K8S-173 · CKS Cluster Setup · difficulty 1 · single

Which command triggers a certificate renewal for a kubeadm cluster?

- A) `kubeadm certs renew all`
- B) `kubectl rotate-certs`
- C) `kubeadm alpha certs renew`
- D) `kubectl certificate renew`

<details><summary>Answer</summary>

**A.** `kubeadm certs renew all` renews the cluster's certificates.

- Why not B: `kubectl rotate-certs` is not a command.
- Why not C: `kubeadm alpha certs` is not the current command path.
- Why not D: `kubectl certificate renew` is not a command.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/

</details>

### Q-K8S-174 · CKS Cluster Setup · difficulty 3 · scenario

Which combination of kube-apiserver flags is the most secure for authentication and authorization?

- A) `--anonymous-auth=true --authorization-mode=AlwaysAllow`
- B) `--anonymous-auth=false --authorization-mode=Node,RBAC`
- C) `--anonymous-auth=true --authorization-mode=Node`
- D) `--anonymous-auth=false --authorization-mode=AlwaysAllow`

<details><summary>Answer</summary>

**B.** Disabling anonymous auth and enabling Node,RBAC enforces authenticated, authorized access.

- Why not A: anonymous auth and AlwaysAllow disable security.
- Why not C: anonymous auth is enabled and RBAC is missing.
- Why not D: AlwaysAllow disables authorization.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/authorization/

</details>

### Q-K8S-175 · CKS Cluster Setup · difficulty 2 · scenario

A bootstrap token has `usage-bootstrap-authentication: true` and `usage-bootstrap-signing: true`. What is the risk of leaving it valid after the node joins?

- A) The token can be used to join additional nodes or sign certificate signing requests.
- B) The token encrypts Secrets.
- C) The token grants cluster-admin.
- D) The token has no effect after the node joins.

<details><summary>Answer</summary>

**A.** A valid bootstrap token can still join nodes; it should be expired or deleted after use.

- Why not B: bootstrap tokens do not encrypt Secrets.
- Why not C: bootstrap tokens are for node joining, not cluster-admin.
- Why not D: the token remains valid until its expiration.
- Ref: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md), https://kubernetes.io/docs/reference/access-authn-authz/bootstrap-tokens/

</details>

### Q-K8S-176 · CKS Cluster Hardening · difficulty 1 · single

Which RBAC verb is the most dangerous because it allows a subject to grant itself additional permissions?

- A) `get`
- B) `list`
- C) `escalate`
- D) `watch`

<details><summary>Answer</summary>

**C.** The `escalate` verb allows a subject to create or update a Role or ClusterRole with more permissions than it holds.

- Why not A: `get` only reads.
- Why not B: `list` only reads.
- Why not D: `watch` only watches.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/rbac/

</details>

### Q-K8S-177 · CKS Cluster Hardening · difficulty 2 · scenario

A Pod does not need to call the Kubernetes API. Which setting prevents it from automatically receiving a ServiceAccount token?

- A) `spec.automountServiceAccountToken: false`
- B) `spec.serviceAccountName: ""`
- C) `spec.containers[*].securityContext.runAsNonRoot: true`
- D) `spec.volumes: []`

<details><summary>Answer</summary>

**A.** `automountServiceAccountToken: false` disables the automatic token projection.

- Why not B: an empty `serviceAccountName` is invalid.
- Why not C: `runAsNonRoot` does not affect token mounting.
- Why not D: volumes do not control token projection.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/

</details>

### Q-K8S-178 · CKS Cluster Hardening · difficulty 1 · single

Which label aggregates a custom ClusterRole into the default `admin` role?

- A) `rbac.authorization.k8s.io/aggregate-to-admin: "true"`
- B) `rbac.authorization.k8s.io/aggregate-to-view: "true"`
- C) `rbac.authorization.k8s.io/aggregate-to-edit: "true"`
- D) `rbac.authorization.k8s.io/aggregate-to-cluster-admin: "true"`

<details><summary>Answer</summary>

**A.** The `aggregate-to-admin` label combines the custom role into the default `admin` ClusterRole.

- Why not B: that aggregates into `view`.
- Why not C: that aggregates into `edit`.
- Why not D: there is no `aggregate-to-cluster-admin` label.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/rbac/

</details>

### Q-K8S-179 · CKS Cluster Hardening · difficulty 3 · scenario

A team needs to enforce a policy that rejects Pods without a `team` label. Which admission mechanism is the simplest and most maintainable?

- A) A mutating webhook that adds the label.
- B) A ValidatingAdmissionPolicy with a CEL expression.
- C) A Kyverno policy that patches the label.
- D) A scheduler plugin.

<details><summary>Answer</summary>

**B.** ValidatingAdmissionPolicy uses CEL expressions built into the API server, avoiding a webhook service.

- Why not A: a mutating webhook adds the label rather than rejecting the Pod.
- Why not C: Kyverno is an external controller; a built-in policy is simpler.
- Why not D: scheduler plugins do not reject Pods for missing labels.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/

</details>

### Q-K8S-180 · CKS Cluster Hardening · difficulty 2 · scenario

Which NetworkPolicy best protects the API server from unexpected Pod traffic?

- A) A default-deny ingress policy on the `kube-system` namespace that allows only known control plane components.
- B) A policy that allows all egress from Pods.
- C) A policy that allows all ingress to the API server.
- D) A policy that disables the CNI.

<details><summary>Answer</summary>

**A.** A default-deny ingress policy restricts traffic to the control plane to known sources.

- Why not B: egress policies do not protect the API server's ingress.
- Why not C: allowing all ingress removes the protection.
- Why not D: disabling the CNI breaks all cluster networking.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/concepts/services-networking/network-policies/

</details>

### Q-K8S-181 · CKS System Hardening · difficulty 1 · single

Which Linux capability is considered the most dangerous because it grants a wide range of administrative operations, including mounting filesystems and modifying namespaces?

- A) `CAP_NET_BIND_SERVICE`
- B) `CAP_SYS_ADMIN`
- C) `CAP_CHOWN`
- D) `CAP_SETUID`

<details><summary>Answer</summary>

**B.** CAP_SYS_ADMIN is a broad capability that allows many administrative operations.

- Why not A: CAP_NET_BIND_SERVICE only allows binding to low ports.
- Why not C: CAP_CHOWN only allows changing file ownership.
- Why not D: CAP_SETUID only allows changing UIDs.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/

</details>

### Q-K8S-182 · CKS System Hardening · difficulty 2 · scenario

A Pod must use an AppArmor profile named `runtime/default`. Which annotation enables this?

- A) `container.apparmor.security.beta.kubernetes.io/<container>: runtime/default`
- B) `securityContext.apparmorProfile: runtime/default`
- C) `metadata.annotations.apparmor: default`
- D) `spec.apparmorProfile: runtime/default`

<details><summary>Answer</summary>

**A.** AppArmor is configured per container through the `container.apparmor.security.beta.kubernetes.io` annotation.

- Why not B: `securityContext` has no `apparmorProfile` field.
- Why not C: the annotation key must be per container.
- Why not D: there is no Pod-level `apparmorProfile` field.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tutorials/security/apparmor/

</details>

### Q-K8S-183 · CKS Cluster Hardening · difficulty 2 · hands-on

Audit the cluster for ClusterRoles that grant the `escalate` verb and remove that verb from a developer role. Which procedure is correct?

- A) Inspect the role's `rules[].verbs`, then patch the role to remove only the `escalate` verb while keeping the other permissions.
- B) Delete the ClusterRole entirely.
- C) Delete every binding that references the role.
- D) Run `kubectl auth can-i escalate roles` as the developer.

<details><summary>Answer</summary>

**A.** Inspect the role's rules and patch out only the `escalate` verb, preserving the developer's legitimate permissions.

- Why not B: deleting the role removes all of its permissions, breaking legitimate access.
- Why not C: deleting bindings removes access entirely rather than removing the escalation verb.
- Why not D: `kubectl auth can-i` checks a subject's permissions, not which verbs a role grants.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/rbac/
- Verification: [`examples/ts/15-hands-on-verification.test.ts`](../examples/ts/15-hands-on-verification.test.ts) › "auditRbacEscalate finds the escalate verb"

</details>

### Q-K8S-184 · CKS System Hardening · difficulty 2 · hands-on

Configure a container to drop all capabilities and add only `NET_BIND_SERVICE`, then verify the effective set. Which `securityContext` achieves this?

- A) `capabilities: {drop: ["ALL"], add: ["NET_BIND_SERVICE"]}`
- B) `capabilities: {add: ["ALL"]}`
- C) `privileged: true`
- D) `capabilities: {drop: ["NET_BIND_SERVICE"]}`

<details><summary>Answer</summary>

**A.** `drop: ["ALL"]` removes the default capability set, and `add: ["NET_BIND_SERVICE"]` restores only the required capability.

- Why not B: adding ALL grants every capability.
- Why not C: `privileged: true` grants all capabilities and host device access.
- Why not D: dropping only NET_BIND_SERVICE leaves the other default capabilities in place.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/configure-pod-container/security-context/
- Verification: [`examples/ts/15-hands-on-verification.test.ts`](../examples/ts/15-hands-on-verification.test.ts) › "evaluateCapabilities resolves the effective set"

</details>

### Q-K8S-185 · CKS Supply Chain Security · difficulty 3 · hands-on

Verify an image signature with cosign and reject an unsigned image before admission. Which sequence is correct?

- A) Run `cosign verify --key <key> <image>` and configure an admission policy that fails when verification fails.
- B) Run `cosign sign <image>` and redeploy the Pod.
- C) Run `kubectl verify image <image>` and restart the Pod.
- D) Run `kubeconform -v <image>` and label the namespace.

<details><summary>Answer</summary>

**A.** cosign verifies the signature against a key, and an admission policy enforces the result before the Pod is created.

- Why not B: signing an image does not verify an existing image.
- Why not C: `kubectl verify image` is not a kubectl command.
- Why not D: kubeconform validates Kubernetes manifests, not image signatures.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/
- Verification: [`examples/ts/15-hands-on-verification.test.ts`](../examples/ts/15-hands-on-verification.test.ts) › "verifyImageSignature validates the digest"

</details>

### Q-K8S-186 · CKS Cluster Hardening · difficulty 2 · multi

Which RBAC verbs should be restricted to prevent privilege escalation? (Select all that apply)

- A) `escalate`
- B) `bind`
- C) `get`
- D) `list`

<details><summary>Answer</summary>

**A and B.** The `escalate` and `bind` verbs let a subject grant itself or others additional permissions.

- Why not C: `get` only reads a resource.
- Why not D: `list` only lists resources.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/reference/access-authn-authz/rbac/

</details>

## Part 4: Mock Exams & Scoring Keys

Each mock exam follows the real exam's format, time limit, and domain mix. The real exam's exact task count is not published, so the mock uses a representative count. Every task lists a runnable verification in `examples/ts/`: the shared suite `15-hands-on-verification.test.ts` models the task's decision logic deterministically, and tasks that require a running cluster are integration tasks that skip cleanly when no cluster is reachable.

### Mock Exam 1: Certified Kubernetes Administrator (CKA)

- **Format**: 120 minutes, 17 performance-based tasks.
- **Passing score**: 66% on the real exam; pass this mock at 12 of 17 tasks (70.6%).
- **Domain mix**: Troubleshooting 5 · Cluster Architecture 4 · Services & Networking 4 · Workloads & Scheduling 2 · Storage 2.

| # | Domain | Task | Verification |
| :-- | :-- | :-- | :-- |
| 1 | Troubleshooting | A Pod `api-7d9` is stuck in `Pending`. Run `kubectl describe pod api-7d9`, identify the `FailedScheduling` reason, and lower the memory request so the Pod schedules. | `examples/ts/13-observability-and-troubleshooting.test.ts` › "troubleshooting triage accurately diagnoses Pending scheduling deadlock" |
| 2 | Troubleshooting | A Pod `web-5c` is in `CrashLoopBackOff`. Retrieve the previous container's logs, identify the missing configuration key, and fix it. | `examples/ts/13-observability-and-troubleshooting.test.ts` › "troubleshooting triage accurately diagnoses CrashLoopBackOff" |
| 3 | Troubleshooting | A Deployment `frontend` is on a bad revision. Roll it back to the previous ReplicaSet and verify the Pods are healthy. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateRollbackTarget selects the previous ReplicaSet" |
| 4 | Troubleshooting | A node `worker-2` is `NotReady`. Inspect its conditions and the kubelet journal, and identify the expired client certificate. | `examples/ts/15-hands-on-verification.test.ts` › "classifyNodeConditions reports Ready and NotReady from the Ready condition" |
| 5 | Troubleshooting | Verify an etcd snapshot file and identify a corrupted backup before using it for recovery. | `examples/ts/10-cluster-lifecycle-and-kubeadm.test.ts` › "etcd snapshot backup verification detects corrupt or empty backups" |
| 6 | Cluster Architecture | Create a kubeconfig context for a second cluster and switch `current-context` to it without editing the file manually. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateKubeconfigContext selects the active context" |
| 7 | Cluster Architecture | Take an etcd snapshot using the cluster's TLS certificates and verify its hash. | `examples/ts/10-cluster-lifecycle-and-kubeadm.test.ts` › "etcd snapshot backup verification detects corrupt or empty backups" |
| 8 | Cluster Architecture | Check the expiration date of every cluster certificate and report any that expire within 30 days. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateCertificateExpiry computes days remaining" |
| 9 | Cluster Architecture | Restore an etcd snapshot into a new data directory and point the etcd static pod at it. | Lab walkthrough: [modules/10-cluster-lifecycle-and-kubeadm.md](../modules/10-cluster-lifecycle-and-kubeadm.md) §6.2 |
| 10 | Services & Networking | Create a Service that selects the `app=web` Pods and verify that its endpoints match the ready Pods. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateServiceEndpoints matches the label selector" |
| 11 | Services & Networking | Apply a NetworkPolicy that allows only the `frontend` Pods to reach the `backend` Pods on port 8080, and verify the isolation. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateNetworkPolicyIngress allows the frontend Pods" |
| 12 | Services & Networking | A Pod cannot resolve external hostnames. Inspect `/etc/resolv.conf`, explain the `ndots:5` behavior, and test an absolute lookup. | `examples/ts/07-networking-services-and-networkpolicy.test.ts` › "CoreDNS ndots:5 causes external domains with <5 dots to query cluster search domains first" |
| 13 | Services & Networking | Create a Gateway API HTTPRoute that routes `GET /api/v1` to the `api` Service and verify the route becomes Accepted. | `examples/ts/08-gateway-api-and-ingress-migration.test.ts` › "intra-namespace routing succeeds without ReferenceGrant" |
| 14 | Workloads & Scheduling | Create a Deployment with 3 replicas and scale it to 5, then verify the ReplicaSet and Pods. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateDeploymentScaling reaches the desired replicas" |
| 15 | Workloads & Scheduling | Taint a node `dedicated=gpu:NoSchedule` and add a toleration to a Pod so it schedules there. | `examples/ts/06-scheduling-and-topology.test.ts` › "scheduler filter pipeline filters nodes by resources, nodeSelector, and taints" |
| 16 | Storage | Create a PersistentVolumeClaim with a StorageClass and bind it to a Pod, then verify the mount. | `examples/ts/09-storage-and-csi.test.ts` › "WaitForFirstConsumer delays PVC binding until scheduler chooses the pod node zone" |
| 17 | Storage | Expand a PVC from 5Gi to 10Gi and verify the filesystem resize. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateVolumeExpansion validates the requested size" |

**Scoring key**: each task is pass/fail; 1 point per task; pass at 12 points (66% real-exam threshold; 70.6% of 17 tasks).

### Mock Exam 2: Certified Kubernetes Application Developer (CKAD)

- **Format**: 120 minutes, 16 performance-based tasks.
- **Passing score**: 66% on the real exam; pass this mock at 11 of 16 tasks (68.75%).
- **Domain mix**: Application Environment 4 · Design & Build 3 · Deployment 3 · Services & Networking 3 · Observability & Maintenance 3.

| # | Domain | Task | Verification |
| :-- | :-- | :-- | :-- |
| 1 | Application Environment | Create a ConfigMap and consume all its keys as environment variables in a Pod. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateConfigMapEnvInjection expands all keys" |
| 2 | Application Environment | Create a Secret and mount it as a volume at `/etc/tls`, then read the key from the Pod. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateSecretVolumeMount mounts the Secret" |
| 3 | Application Environment | Set a container `securityContext` with `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, and `readOnlyRootFilesystem: true`. | `examples/ts/11-security-hardening-and-cks.test.ts` › "negative test: Pod Security Admission restricted level requires runAsNonRoot, dropped capabilities, and seccomp" |
| 4 | Application Environment | Create a ResourceQuota that limits `requests.cpu` to `2` and verify that a third 500m replica is rejected. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateResourceQuota enforces the aggregate limit" |
| 5 | Design & Build | Define a CRD `CronTab` and create a custom resource that satisfies its schema. | `examples/ts/15-hands-on-verification.test.ts` › "validateCrdInstance accepts a conforming custom resource" |
| 6 | Design & Build | Author a Helm chart with a `ConfigMap` template and render it with `helm template`. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateHelmChart validates the chart structure" |
| 7 | Design & Build | Create a Kustomize overlay that adds a `prod` label and a replica patch to a base. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateKustomizeOverlay applies labels and replicas" |
| 8 | Deployment | Perform a rolling update of a Deployment by changing the image, and verify the new ReplicaSet reaches the desired replicas. | `examples/ts/04-pods-and-workloads.test.ts` › "deployment rollout bounds respect maxSurge and maxUnavailable constraints" |
| 9 | Deployment | Roll back a Deployment to the previous revision and verify the Pods use the old image. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateRollbackTarget selects the previous ReplicaSet" |
| 10 | Deployment | Create a Job with `backoffLimit: 3` and a CronJob with `concurrencyPolicy: Forbid`. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateJobPolicy enforces backoff and concurrency" |
| 11 | Services & Networking | Expose a Deployment with a Service and verify the DNS name resolves from another Pod. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateServiceEndpoints matches the label selector" |
| 12 | Services & Networking | Create a Gateway API HTTPRoute with an exact path match for `/health`. | `examples/ts/08-gateway-api-and-ingress-migration.test.ts` › "intra-namespace routing succeeds without ReferenceGrant" |
| 13 | Services & Networking | Apply a NetworkPolicy that allows only the `frontend` Pods to reach the `backend` Pods. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateNetworkPolicyIngress allows the frontend Pods" |
| 14 | Observability & Maintenance | Configure a startup probe, a liveness probe, and a readiness probe on a slow-starting container. | `examples/ts/04-pods-and-workloads.test.ts` › "probe state machine: startup probe gates liveness and readiness until success" |
| 15 | Observability & Maintenance | Retrieve logs from a crashed container using the previous instantiation. | `examples/ts/13-observability-and-troubleshooting.test.ts` › "troubleshooting triage accurately diagnoses CrashLoopBackOff" |
| 16 | Observability & Maintenance | Attach an ephemeral debug container to a running Pod without restarting it. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateEphemeralDebugTarget resolves the target container" |

**Scoring key**: each task is pass/fail; 1 point per task; pass at 11 points (66% real-exam threshold; 68.75% of 16 tasks).

### Mock Exam 3: Certified Kubernetes Security Specialist (CKS)

- **Format**: 120 minutes, 16 performance-based tasks (requires a passed CKA certification; the CKA does not need to be active).
- **Passing score**: 67% on the real exam; pass this mock at 11 of 16 tasks (68.75%).
- **Domain mix**: Minimize Microservice Vulnerabilities 3 · Supply Chain Security 3 · Monitoring, Logging & Runtime Security 3 · Cluster Setup 2 · Cluster Hardening 3 · System Hardening 2.

| # | Domain | Task | Verification |
| :-- | :-- | :-- | :-- |
| 1 | Minimize Microservice Vulnerabilities | Apply the restricted Pod Security Standard to a namespace and verify that a root-running Pod is rejected. | `examples/ts/11-security-hardening-and-cks.test.ts` › "negative test: Pod Security Admission restricted level requires runAsNonRoot, dropped capabilities, and seccomp" |
| 2 | Minimize Microservice Vulnerabilities | Enable user namespaces for a Pod and verify the UID mapping. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateUserNamespaces reports the mapping" |
| 3 | Minimize Microservice Vulnerabilities | Configure a seccomp profile for a container and verify the effective type. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateSeccompProfile resolves the profile" |
| 4 | Supply Chain Security | Verify an image signature with cosign and reject an unsigned image. | `examples/ts/15-hands-on-verification.test.ts` › "verifyImageSignature validates the digest" |
| 5 | Supply Chain Security | Create a `kubernetes.io/dockerconfigjson` Secret and reference it in `imagePullSecrets`. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateImagePullSecret authenticates the pull" |
| 6 | Supply Chain Security | Scan an image for critical CVEs and report the findings. | `examples/ts/15-hands-on-verification.test.ts` › "scanImageVulnerabilities flags critical CVEs" |
| 7 | Monitoring, Logging & Runtime Security | Enable audit logging with a policy that records Secret reads at the Metadata stage. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateAuditPolicy matches the rule and stage" |
| 8 | Monitoring, Logging & Runtime Security | Deploy a runtime security tool and verify it detects an unexpected shell. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateRuntimeDetection flags the syscall" |
| 9 | Monitoring, Logging & Runtime Security | Forward audit logs to an external immutable store. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateLogForwarding targets the external store" |
| 10 | Cluster Setup | Enable encryption at rest for Secrets using a KMS provider. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateEncryptionAtRest reports the provider" |
| 11 | Cluster Setup | Verify that the API server uses `Node,RBAC` authorization and anonymous auth is disabled. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateAuthorizationMode reports the secure mode" |
| 12 | Cluster Hardening | Audit all ClusterRoles for wildcard verbs or resources and report the findings. | `examples/ts/11-security-hardening-and-cks.test.ts` › "RBAC evaluator enforces least privilege and handles wildcards" |
| 13 | Cluster Hardening | Disable automatic ServiceAccount token mounting for a Pod that does not call the API. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateServiceAccountTokenMounting disables the token" |
| 14 | Cluster Hardening | Audit RBAC for the `escalate` verb and remove it from developer roles. | `examples/ts/15-hands-on-verification.test.ts` › "auditRbacEscalate finds the escalate verb" |
| 15 | System Hardening | Drop all capabilities and add only `NET_BIND_SERVICE`. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateCapabilities resolves the effective set" |
| 16 | System Hardening | Mount the container root filesystem read-only and verify writes fail. | `examples/ts/15-hands-on-verification.test.ts` › "evaluateReadOnlyRootFilesystem reports the posture" |

**Scoring key**: each task is pass/fail; 1 point per task; pass at 11 points (67% real-exam threshold; 68.75% of 16 tasks).
