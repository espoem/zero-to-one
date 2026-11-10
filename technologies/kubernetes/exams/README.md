# Certification & Exam Coverage Matrix

This document maps official Linux Foundation / CNCF certification domains for CKA, CKAD, and CKS to the curriculum modules and verification test suites in `technologies/kubernetes`.

## Question banks

| Bank | File | Questions | Coverage |
| :-- | :-- | :-- | :-- |
| CKA / CKAD / CKS | `cka-ckad-cks.md` | 186 (61 CKA, 61 CKAD, 64 CKS) | Every domain at or above its official weight; difficulty 1-3; three full mock exams with scoring keys. |
| Interview format | `interview.md` | 12 | Topics outside certification scope: cost, multi-tenancy, immutable infrastructure, organizational change. |
| Roadmap mapping | `roadmap-coverage.md` | 50 source questions | Maps the roadmap.sh Kubernetes interview guide onto modules, existing questions, and the new banks. |

Every hands-on task in the mock exams has a runnable verification in `examples/ts/`; the shared suite is `examples/ts/15-hands-on-verification.test.ts`.

## 1. Certified Kubernetes Administrator (CKA v1.37) Coverage Matrix

| Domain & Weight | Objective / Topic | Covered Modules | Verification Suites | Status |
| :-- | :-- | :-- | :-- | :-- |
| **Troubleshooting (30%)** | Troubleshoot cluster component failures, network issues, pod failures, and node NotReady conditions. | Module 03, Module 13 | `examples/ts/13-observability-and-troubleshooting.test.ts` | ✅ Full |
| **Cluster Architecture, Installation & Configuration (25%)** | Manage kubeadm clusters, etcd backups, RBAC, control plane components, and upgrades. | Module 02, Module 10, Module 11, Module 12 | `examples/ts/10-cluster-lifecycle-and-kubeadm.test.ts`<br/>`examples/ts/11-security-hardening-and-cks.test.ts` | ✅ Full |
| **Services & Networking (20%)** | Configure CNI network plugins, Services, EndpointSlices, NetworkPolicies, and Gateway API. | Module 07, Module 08 | `examples/ts/07-networking-services-and-networkpolicy.test.ts`<br/>`examples/ts/08-gateway-api-and-ingress-migration.test.ts` | ✅ Full |
| **Workloads & Scheduling (15%)** | Manage Deployments, StatefulSets, DaemonSets, taints/tolerations, affinity, and autoscaling. | Module 04, Module 05, Module 06 | `examples/ts/04-pods-and-workloads.test.ts`<br/>`examples/ts/06-scheduling-and-topology.test.ts` | ✅ Full |
| **Storage (10%)** | Configure PersistentVolumes, PersistentVolumeClaims, StorageClasses, and CSI volume provisioning. | Module 09 | `examples/ts/09-storage-and-csi.test.ts` | ✅ Full |

---

## 2. Certified Kubernetes Application Developer (CKAD v1.37) Coverage Matrix

| Domain & Weight | Objective / Topic | Covered Modules | Verification Suites | Status |
| :-- | :-- | :-- | :-- | :-- |
| **Application Environment, Configuration & Security (25%)** | ConfigMaps, Secrets, SecurityContexts, ServiceAccounts, and Pod Security Standards. | Module 05, Module 11 | `examples/ts/05-configuration-resources-and-autoscaling.test.ts`<br/>`examples/ts/11-security-hardening-and-cks.test.ts` | ✅ Full |
| **Application Design & Build (20%)** | Define CRDs, use Helm charts, Kustomize overlays, multi-container pods, and container builds. | Module 04, Module 12 | `examples/ts/04-pods-and-workloads.test.ts`<br/>`examples/ts/12-extending-kubernetes-crds-operators-helm.test.ts` | ✅ Full |
| **Application Deployment (20%)** | Deployments, rollouts, rolling updates, blue/green strategies, and Job/CronJob orchestration. | Module 04 | `examples/ts/04-pods-and-workloads.test.ts` | ✅ Full |
| **Services & Networking (20%)** | Expose applications via Services, Ingress, and Gateway API HTTPRoutes. | Module 07, Module 08 | `examples/ts/07-networking-services-and-networkpolicy.test.ts`<br/>`examples/ts/08-gateway-api-and-ingress-migration.test.ts` | ✅ Full |
| **Application Observability & Maintenance (15%)** | Configure startup/liveness/readiness probes, resource metrics, logs, and debugging containers. | Module 04, Module 13 | `examples/ts/04-pods-and-workloads.test.ts`<br/>`examples/ts/13-observability-and-troubleshooting.test.ts` | ✅ Full |

---

## 3. Certified Kubernetes Security Specialist (CKS v1.37) Coverage Matrix

| Domain & Weight | Objective / Topic | Covered Modules | Verification Suites | Status |
| :-- | :-- | :-- | :-- | :-- |
| **Minimize Microservice Vulnerabilities (20%)** | Pod Security Standards, service account tokens, user namespaces, and security contexts. | Module 11 | `examples/ts/11-security-hardening-and-cks.test.ts` | ✅ Full |
| **Supply Chain Security (20%)** | Image signature verification, binary authorization, vulnerability scanning, and admission policies. | Module 11, Module 12 | `examples/ts/11-security-hardening-and-cks.test.ts`<br/>`examples/ts/12-extending-kubernetes-crds-operators-helm.test.ts` | ✅ Full |
| **Monitoring, Logging & Runtime Security (20%)** | Audit logging, Falco runtime anomaly detection, and syscall behavior monitoring. | Module 11 | `examples/ts/11-security-hardening-and-cks.test.ts` | ✅ Full |
| **Cluster Setup (15%)** | API server hardening, network encryption, CIS benchmarks, and secure node bootstrapping. | Module 10, Module 11 | `examples/ts/10-cluster-lifecycle-and-kubeadm.test.ts`<br/>`examples/ts/11-security-hardening-and-cks.test.ts` | ✅ Full |
| **Cluster Hardening (15%)** | RBAC privilege auditing, secret encryption at rest, and admission control webhooks. | Module 11 | `examples/ts/11-security-hardening-and-cks.test.ts` | ✅ Full |
| **System Hardening (10%)** | Kernel hardening, seccomp profiles, AppArmor, and reducing node attack surface. | Module 03, Module 11 | `examples/ts/03-node-internals.test.ts`<br/>`examples/ts/11-security-hardening-and-cks.test.ts` | ✅ Full |

> [!NOTE]
> **Upstream inconsistency:** the CNCF CKS web page lists Cluster Setup 10% and System Hardening 15%, while the CKS v1.37 curriculum PDF lists Cluster Setup 15% and System Hardening 10%. This track follows the curriculum PDF, which is the exam's authoritative syllabus.

---

## Exam Delta Callouts

> [!IMPORTANT]
> **CKS curriculum alignment**: The CNCF CKS curriculum was updated to Kubernetes v1.37 (the v1.34 curriculum is archived under `old-versions/`). This track teaches Kubernetes v1.37, so the CKS exam and the curriculum are aligned. User namespaces (`hostUsers: false`, GA since v1.36) and CEL `ValidatingAdmissionPolicy` (GA since v1.30) are fully supported in v1.37, and Ingress-NGINX is retired as of March 2026, replaced entirely by Gateway API v1.6.
