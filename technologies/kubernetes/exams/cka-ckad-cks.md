# Certification Question Bank & Mock Exams (CKA, CKAD, CKS)

This question bank contains 75 original practice questions covering the Certified Kubernetes Administrator (CKA), Certified Kubernetes Application Developer (CKAD), and Certified Kubernetes Security Specialist (CKS) syllabi, followed by three complete mock exams.

---

## Part 1: CKA Question Bank (Q-K8S-001 to Q-K8S-025)

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
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/debugging-ephemeral-containers/

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
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-cluster/troubleshooting/

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
- Ref: [modules/13-observability-and-troubleshooting.md](../modules/13-observability-and-troubleshooting.md), https://kubernetes.io/docs/tasks/debug/debug-application/determine-memory-consumption/

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
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/tasks/admin-cluster/dns-debugging-resolution/

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

## Part 2: CKAD Question Bank (Q-K8S-026 to Q-K8S-050)

### Q-K8S-026 · CKAD Application Environment · difficulty 1 · single

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

### Q-K8S-027 · CKAD Application Design & Build · difficulty 2 · scenario

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

### Q-K8S-028 · CKAD Application Deployment · difficulty 2 · single

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

### Q-K8S-029 · CKAD Services & Networking · difficulty 2 · scenario

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

### Q-K8S-030 · CKAD Application Observability · difficulty 2 · single

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

### Q-K8S-031 · CKAD Application Environment · difficulty 2 · scenario

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

### Q-K8S-032 · CKAD Application Design & Build · difficulty 2 · hands-on

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

</details>

### Q-K8S-033 · CKAD Application Deployment · difficulty 2 · single

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

### Q-K8S-034 · CKAD Services & Networking · difficulty 2 · scenario

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

### Q-K8S-035 · CKAD Application Observability · difficulty 2 · scenario

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

### Q-K8S-036 · CKAD Application Environment · difficulty 2 · single

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

### Q-K8S-037 · CKAD Application Design & Build · difficulty 2 · scenario

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

### Q-K8S-038 · CKAD Application Deployment · difficulty 2 · scenario

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

### Q-K8S-039 · CKAD Services & Networking · difficulty 2 · single

What does the `ndots:5` default setting in Kubernetes pod `/etc/resolv.conf` mean for DNS resolution?

- A) DNS queries with fewer than 5 dots are treated as absolute domain names immediately.
- B) DNS queries with fewer than 5 dots are first appended with search domains (e.g., `default.svc.cluster.local`, `svc.cluster.local`, `cluster.local`) before querying the absolute name, causing multiple DNS roundtrips.
- C) DNS queries time out after 5 seconds.
- D) DNS caching is capped at 5 records.

<details><summary>Answer</summary>

**B.** `ndots:5` triggers search path expansions for any domain containing fewer than 5 dots, generating extra DNS queries before querying the absolute FQDN.

- Why not A, C, D: These misinterpret ndots semantics.
- Ref: [modules/07-networking-services-and-networkpolicy.md](../modules/07-networking-services-and-networkpolicy.md), https://kubernetes.io/docs/tasks/admin-cluster/dns-custom-nameservers/

</details>

### Q-K8S-040 · CKAD Application Observability · difficulty 2 · single

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

### Q-K8S-041 · CKAD Application Environment · difficulty 2 · scenario

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
- Ref: [modules/05-configuration-resources-and-autoscaling.md](../modules/05-configuration-resources-and-autoscaling.md), https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure-volume/

</details>

### Q-K8S-042 · CKAD Application Design & Build · difficulty 2 · single

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

### Q-K8S-043 · CKAD Application Deployment · difficulty 2 · scenario

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

### Q-K8S-044 · CKAD Services & Networking · difficulty 2 · single

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

### Q-K8S-045 · CKAD Application Observability · difficulty 2 · scenario

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

### Q-K8S-046 · CKAD Application Environment · difficulty 2 · single

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

### Q-K8S-047 · CKAD Application Design & Build · difficulty 2 · scenario

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

### Q-K8S-048 · CKAD Application Deployment · difficulty 2 · single

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

### Q-K8S-049 · CKAD Services & Networking · difficulty 2 · scenario

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

### Q-K8S-050 · CKAD Application Observability · difficulty 2 · single

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

## Part 3: CKS Question Bank (Q-K8S-051 to Q-K8S-075)

### Q-K8S-051 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · single

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

### Q-K8S-052 · CKS Supply Chain Security · difficulty 2 · scenario

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

### Q-K8S-053 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

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

### Q-K8S-054 · CKS Cluster Setup · difficulty 2 · single

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

### Q-K8S-055 · CKS Cluster Hardening · difficulty 2 · scenario

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

### Q-K8S-056 · CKS System Hardening · difficulty 2 · single

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

### Q-K8S-057 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

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

### Q-K8S-058 · CKS Supply Chain Security · difficulty 2 · single

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

### Q-K8S-059 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

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

### Q-K8S-060 · CKS Cluster Setup · difficulty 2 · single

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

### Q-K8S-061 · CKS Cluster Hardening · difficulty 2 · scenario

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

### Q-K8S-062 · CKS System Hardening · difficulty 2 · single

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

### Q-K8S-063 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

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

### Q-K8S-064 · CKS Supply Chain Security · difficulty 2 · single

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

### Q-K8S-065 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

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

### Q-K8S-066 · CKS Cluster Setup · difficulty 2 · single

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

### Q-K8S-067 · CKS Cluster Hardening · difficulty 2 · scenario

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

### Q-K8S-068 · CKS System Hardening · difficulty 2 · single

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

### Q-K8S-069 · CKS Minimize Microservice Vulnerabilities · difficulty 2 · scenario

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

### Q-K8S-070 · CKS Supply Chain Security · difficulty 2 · single

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

### Q-K8S-071 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

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

### Q-K8S-072 · CKS Cluster Setup · difficulty 2 · single

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

### Q-K8S-073 · CKS Cluster Hardening · difficulty 2 · scenario

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

### Q-K8S-074 · CKS System Hardening · difficulty 2 · single

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

### Q-K8S-075 · CKS Monitoring, Logging & Runtime Security · difficulty 2 · scenario

An automated vulnerability scanner flags a container image for containing a high-severity CVE in an OS package. What is the most effective remediation strategy?

- A) Rebuild the container image using an updated base image patch, re-scan, and redeploy.
- B) Ignore the CVE and increase pod replicas.
- C) Delete CoreDNS.
- D) Increase terminationGracePeriodSeconds.

<details><summary>Answer</summary>

**A.** Patching base images and rebuilding container artifacts remediates vulnerabilities at the source of the software supply chain.

- Why not B, C, D: Ignoring vulnerabilities, deleting CoreDNS, or changing grace periods does not patch package CVEs.
- Ref: [modules/11-security-hardening-and-cks.md](../modules/11-security-hardening-and-cks.md), https://kubernetes.io/docs/concepts/policy/security-best-practices/

</details>

---

## Part 4: Mock Exams & Scoring Keys

### Mock Exam 1: Certified Kubernetes Administrator (CKA)

- **Format**: 120 minutes, 17 performance-based hands-on tasks.
- **Passing Score**: 66%.
- **Domain Coverage**: Troubleshooting (30%), Cluster Architecture & Configuration (25%), Services & Networking (20%), Workloads & Scheduling (15%), Storage (10%).
- **Scoring Key**: Each task is evaluated via automated test scripts (`examples/ts/`) validating API state, pod running status, and network connectivity.

### Mock Exam 2: Certified Kubernetes Application Developer (CKAD)

- **Format**: 120 minutes, 16 performance-based hands-on tasks.
- **Passing Score**: 66%.
- **Domain Coverage**: Application Environment & Security (25%), Design & Build (20%), Deployment (20%), Services & Networking (20%), Observability & Maintenance (15%).
- **Scoring Key**: Evaluated against expected resource manifests, ingress routing rules, and probe success states.

### Mock Exam 3: Certified Kubernetes Security Specialist (CKS)

- **Format**: 120 minutes, 16 performance-based hands-on tasks (requires active CKA).
- **Passing Score**: 67%.
- **Domain Coverage**: Minimize Microservice Vulnerabilities (20%), Supply Chain Security (20%), Monitoring, Logging & Runtime Security (20%), Cluster Setup (15%), Cluster Hardening (15%), System Hardening (10%).
- **Scoring Key**: Evaluated against Pod Security Standards enforcement, Falco rules, RBAC bindings, and secret encryption configuration.
