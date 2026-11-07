# Kubernetes Curriculum & Architecture Guide

Verified against Kubernetes 1.37.2 ("Garhwal"), Gateway API 1.6.3, etcd 3.7.3, containerd 2.4.2, Helm 4.3.1, Kustomize 5.8.3, kind 0.33.0, k3d 5.9.0, kubeconform 0.8.0, Chainsaw 0.2.15, Kyverno 1.19.2, KWOK 0.8.0, Node 26.13.0, TypeScript 7.0.2 on 2026-11-07.

## Overview & Prerequisites

This track provides a rigorous, deep-dive curriculum into Kubernetes orchestration, control plane mechanics, distributed systems integration, network routing, storage, and cluster security.

Before starting this track, ensure you are familiar with the foundations covered in:

- [`../containers/README.md`](../containers/README.md): OCI container runtime specifications, cgroups v2, namespaces, and image building.
- [`../../architecture/networking/README.md`](../../architecture/networking/README.md): IP routing, TCP/IP mechanics, DNS, and load balancing.
- [`../../architecture/security-identity/README.md`](../../architecture/security-identity/README.md): PKI, X.509 certificates, mTLS, and RBAC authorization models.
- [`../../architecture/distributed-systems/README.md`](../../architecture/distributed-systems/README.md): Consensus algorithms (Raft), leases, fencing tokens, and linearizability.
- [`../terraform/README.md`](../terraform/README.md): Infrastructure as Code and declarative state reconciliation.

## Syllabus

| Module | Title | Core Concepts |
| :-- | :-- | :-- |
| [`modules/01-declarative-api-and-reconciliation.md`](modules/01-declarative-api-and-reconciliation.md) | Declarative API and Level-Triggered Reconciliation | Desired vs observed state, level-triggered control loops, object metadata/spec/status, labels/selectors, ownerReferences, and Server-Side Apply. |
| [`modules/02-control-plane-internals.md`](modules/02-control-plane-internals.md) | Control Plane Internals | kube-apiserver request pipeline, watch cache, shared informers, etcd MVCC revisions, compaction, and consensus. |
| [`modules/03-node-internals.md`](modules/03-node-internals.md) | Node Internals | kubelet lifecycle, PLEG, CRI, cgroup v2 QoS classes, PSI eviction thresholds, and kube-proxy vs eBPF dataplane. |
| [`modules/04-pods-and-workloads.md`](modules/04-pods-and-workloads.md) | Pods and Workloads | Init/sidecar containers, probes, graceful termination, Deployments, StatefulSets, DaemonSets, Jobs, and CronJobs. |
| [`modules/05-configuration-resources-and-autoscaling.md`](modules/05-configuration-resources-and-autoscaling.md) | Configuration, Resource Management, and Autoscaling | ConfigMaps, Secrets, in-place pod resize, quotas, HPA (scale-to-zero), and VPA. |
| [`modules/06-scheduling-and-topology.md`](modules/06-scheduling-and-topology.md) | Scheduling Architecture | Filter/score scheduler pipeline, node affinity, taints, topology spread, preemption, PDBs, and DRA. |
| [`modules/07-networking-services-and-networkpolicy.md`](modules/07-networking-services-and-networkpolicy.md) | Kubernetes Networking | CNI model, Services, EndpointSlices, CoreDNS search paths (`ndots:5`), and NetworkPolicy semantics. |
| [`modules/08-gateway-api-and-ingress-migration.md`](modules/08-gateway-api-and-ingress-migration.md) | Gateway API v1.6 and Traffic Management | Role-oriented routing, HTTP/TCP/TLSRoute, ReferenceGrant, and Ingress-NGINX retirement migration. |
| [`modules/09-storage-and-csi.md`](modules/09-storage-and-csi.md) | Persistent Storage and CSI Architecture | PV/PVC binding, WaitForFirstConsumer, volumeBindingMode, CSI architecture, and VolumeGroupSnapshots. |
| [`modules/10-cluster-lifecycle-and-kubeadm.md`](modules/10-cluster-lifecycle-and-kubeadm.md) | Cluster Lifecycle with kubeadm | PKI certificates, stacked vs external etcd HA, version skew policies, upgrades, and etcd snapshot backup/restore. |
| [`modules/11-security-hardening-and-cks.md`](modules/11-security-hardening-and-cks.md) | Cluster and Runtime Security (CKS) | RBAC hardening, Pod Security Standards, user namespaces, CEL ValidatingAdmissionPolicy, audit logs, and Falco. |
| [`modules/12-extending-kubernetes-crds-operators-helm.md`](modules/12-extending-kubernetes-crds-operators-helm.md) | Extending Kubernetes | CustomResourceDefinitions, CEL validation rules, Operator pattern, controller-runtime, Helm 4, and Kustomize. |
| [`modules/13-observability-and-troubleshooting.md`](modules/13-observability-and-troubleshooting.md) | Cluster Observability and Troubleshooting | Ephemeral debug containers, Metrics API, triage playbooks for CrashLoopBackOff/OOMKilled, and API deprecations. |
| [`modules/14-production-architecture-and-scale.md`](modules/14-production-architecture-and-scale.md) | Production Kubernetes at Scale | Multi-tenancy, Karpenter, API Priority and Fairness, etcd performance tuning, and major version history. |

## Out of Scope

- Raw Linux kernel container primitive development (namespaces, cgroups v2 low-level programming) — covered in [`technologies/containers`](../containers/README.md).
- Infrastructure provisioning of underlying virtual machines or cloud VPCs — covered in [`technologies/terraform`](../terraform/README.md).
- GitOps continuous delivery controller internals and progressive delivery rollouts — covered in [`technologies/argocd`](../argocd/README.md).
- Comprehensive centralized log indexing and metrics storage backends (Prometheus/Thanos/Elasticsearch) — covered in [`technologies/observability`](../observability/README.md).

## Certifications & Exams

This track prepares candidates for three official Linux Foundation / CNCF certifications:

- **Verified against Official CNCF Exam Guides** (Curriculum Version: `v1.35`, Verified Date: `2026-11-07`).

1. **Certified Kubernetes Administrator (CKA)**:
   - **Official Exam Guide**: [CNCF CKA Exam Guide](https://www.cncf.io/certification/cka/) ([Curriculum Repo](https://github.com/cncf/curriculum))
   - **Status**: Active, targeting Kubernetes v1.35 / v1.37.
   - **Format**: 2 hours, 15–20 performance-based command-line tasks.
   - **Passing Score**: 66%.
   - **Domains**: Troubleshooting (30%), Cluster Architecture, Installation & Configuration (25%), Services & Networking (20%), Workloads & Scheduling (15%), Storage (10%).

2. **Certified Kubernetes Application Developer (CKAD)**:
   - **Official Exam Guide**: [CNCF CKAD Exam Guide](https://www.cncf.io/certification/ckad/) ([Curriculum Repo](https://github.com/cncf/curriculum))
   - **Status**: Active, targeting Kubernetes v1.35 / v1.37.
   - **Format**: 2 hours, 15–20 performance-based command-line tasks.
   - **Passing Score**: 66%.
   - **Domains**: Application Environment, Configuration & Security (25%), Application Design & Build (20%), Application Deployment (20%), Services & Networking (20%), Application Observability & Maintenance (15%).

3. **Certified Kubernetes Security Specialist (CKS)**:
   - **Official Exam Guide**: [CNCF CKS Exam Guide](https://www.cncf.io/certification/cks/) ([Curriculum Repo](https://github.com/cncf/curriculum))
   - **Status**: Active, targeting Kubernetes v1.35 (Exam Delta v1.35 vs v1.37 documented in modules). Requires active CKA certification.
   - **Format**: 2 hours, 15–20 performance-based command-line tasks.
   - **Passing Score**: 67%.
   - **Domains**: Minimize Microservice Vulnerabilities (20%), Supply Chain Security (20%), Monitoring, Logging & Runtime Security (20%), Cluster Setup (15%), Cluster Hardening (15%), System Hardening (10%).
