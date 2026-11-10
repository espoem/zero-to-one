# Roadmap.sh Kubernetes Coverage Matrix

This matrix maps the 50 interview questions from [roadmap.sh/questions/kubernetes](https://roadmap.sh/questions/kubernetes) (fetched 2026-11-09) onto the `technologies/kubernetes` modules and the existing CKA/CKAD/CKS question bank. The source is used as factual inspiration only; no wording is reproduced.

Status values: **covered** (an existing question examines the topic), **gap** (no existing question), **outdated** (the source framing conflicts with current Kubernetes 1.37 / Gateway API practice). Destination values: **primary** (add to `exams/cka-ckad-cks.md`), **secondary** (add to `exams/interview.md`), **existing** (no new question needed).

| # | Source question | Level | Module(s) | Existing Q | Status | Destination | Note |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | What is Kubernetes, and why is it used? | Beginner | M01 | none | gap | secondary | General definition; M01 covers the declarative model. Not a CNCF domain objective. |
| 2 | What is a pod? | Beginner | M04 | none | gap | primary | Foundational for CKAD Application Design & Build. |
| 3 | What is a node? | Beginner | M03 | none | gap | primary | CKA Cluster Architecture, Installation & Configuration. |
| 4 | What is a service? | Beginner | M07 | Q-K8S-008 | covered | existing | Q-008 covers external exposure; Service types live in M07. |
| 5 | What is a namespace? | Beginner | M14, M11 | none | gap | primary | CKA Cluster Architecture; RBAC scope in M11. |
| 6 | Docker vs Kubernetes | Beginner | M03, M01 | none | gap | secondary | CRI boundary in M03. The source correctly states Kubernetes uses CRI/containerd, not Docker. |
| 7 | What is the control plane? | Beginner | M02 | Q-K8S-007, Q-K8S-012 | covered | existing |  |
| 8 | Role of ReplicaSet | Beginner | M04 | Q-K8S-084 | covered | existing | Q-048 covers ReplicaSet lifecycle after rollout. |
| 9 | Rolling update | Beginner | M04 | Q-K8S-064, Q-K8S-084 | covered | existing |  |
| 10 | What happens when a Deployment is created? | Beginner | M04, M01 | Q-K8S-084 | gap | primary | Reconciliation flow; add a CKA Workloads & Scheduling question. |
| 11 | What happens when you run kubectl? | Beginner | M02 | Q-K8S-012 | covered | existing |  |
| 12 | Why does every request go through the API server? | Beginner | M02 | Q-K8S-007 | covered | existing |  |
| 13 | Role of etcd | Beginner | M02, M10 | Q-K8S-002, Q-K8S-022 | covered | existing |  |
| 14 | Why kubectl needs kubeconfig | Beginner | M10, M02 | Q-K8S-144 | gap | primary | Kubeconfig structure; add a CKA Cluster Architecture question. |
| 15 | DaemonSet | Beginner | M04 | Q-K8S-004 | covered | existing |  |
| 16 | How scheduling works | Intermediate | M06 | Q-K8S-009, Q-K8S-024 | gap | primary | Filter/score/bind flow is not directly examined. |
| 17 | Deployment vs StatefulSet | Intermediate | M04, M09 | Q-K8S-070, Q-K8S-084 | gap | primary | Identity and storage contrast; add a CKAD Application Deployment question. |
| 18 | How scaling works | Intermediate | M05, M14 | Q-K8S-081 | gap | primary | HPA/VPA/Cluster Autoscaler; add a CKA Workloads & Scheduling question. |
| 19 | How networking works | Intermediate | M07, M08 | Q-K8S-003, Q-K8S-013, Q-K8S-023 | outdated | existing | Source presents Ingress as the edge and names Flannel/Weave. M07/M08 teach Gateway API (ingress-nginx retired March 2026) and Cilium/Calico. |
| 20 | ConfigMaps and Secrets | Intermediate | M05, M11 | Q-K8S-062, Q-K8S-067, Q-K8S-077 | covered | existing |  |
| 21 | Pod exceeds memory limit | Intermediate | M03, M05 | Q-K8S-016 | covered | existing | OOMKilled and exit code 137. |
| 22 | Mount a secret | Intermediate | M05, M11 | Q-K8S-077 | covered | existing |  |
| 23 | Role of kube-proxy | Intermediate | M03, M07 | none | gap | primary | CKA Services & Networking. |
| 24 | Readiness and liveness probes | Intermediate | M04 | Q-K8S-066, Q-K8S-079 | covered | existing |  |
| 25 | Three pod failure states | Intermediate | M13 | Q-K8S-001, Q-K8S-011, Q-K8S-016 | covered | existing |  |
| 26 | kubeconfig and cluster connections | Intermediate | M10, M02 | Q-K8S-144 | gap | primary | Contexts, clusters, users; add a CKA Cluster Architecture question. |
| 27 | Taints and tolerations | Intermediate | M06 | Q-K8S-024 | gap | primary | Tolerations are not examined; add a CKA Workloads & Scheduling question. |
| 28 | Pod-to-pod communication | Intermediate | M07 | Q-K8S-013 | covered | existing |  |
| 29 | Debug pods | Intermediate | M13 | Q-K8S-001, Q-K8S-006, Q-K8S-071 | covered | existing |  |
| 30 | PV and PVC | Intermediate | M09 | Q-K8S-005, Q-K8S-010, Q-K8S-020 | covered | existing |  |
| 31 | High availability | Advanced | M10, M14 | Q-K8S-022 | gap | primary | HA control plane and etcd quorum; add a CKA Cluster Architecture question. |
| 32 | Secure a cluster | Advanced | M11 | Q-K8S-123..Q-K8S-147 | covered | existing |  |
| 33 | Troubleshoot a failing pod | Advanced | M13 | Q-K8S-001, Q-K8S-011 | covered | existing |  |
| 34 | Rolling updates and rollbacks | Advanced | M04 | Q-K8S-064, Q-K8S-084 | covered | existing |  |
| 35 | Monitor and observe | Advanced | M13 | Q-K8S-076, Q-K8S-131 | covered | existing | Source names Prometheus, Grafana, Fluentd, Loki, ELK; the observability track owns those tools. |
| 36 | Resource management and limits | Advanced | M05, M03 | Q-K8S-082, Q-K8S-016 | covered | existing |  |
| 37 | Upgrade a cluster safely | Advanced | M10 | none | gap | primary | CKA Cluster Architecture, Installation & Configuration. |
| 38 | PodDisruptionBudget | Advanced | M06 | Q-K8S-019 | covered | existing |  |
| 39 | CRDs | Advanced | M12 | Q-K8S-063, Q-K8S-078 | covered | existing |  |
| 40 | Scale under traffic | Advanced | M05, M14 | Q-K8S-081 | covered | existing |  |
| 41 | etcd outage | Advanced | M02, M10, M14 | Q-K8S-022 | gap | primary | Add a CKA Troubleshooting question. |
| 42 | Cost efficiency | Advanced | M14 | none | gap | secondary | Not a CNCF domain objective. |
| 43 | Deployment strategy and scalable platform | Advanced | M04, M14 | none | gap | secondary | Organizational interview question. |
| 44 | Monitoring tools | Advanced | M13 | Q-K8S-076, Q-K8S-131 | covered | existing | Cross-link the observability track. |
| 45 | Host vs container deployment | Advanced | M01, M03 | none | gap | secondary | General interview. |
| 46 | Immutable infrastructure | Advanced | M04, M01 | none | gap | secondary | General interview; rolling-update model in M04. |
| 47 | Fine-grained RBAC | Advanced | M11 | Q-K8S-127, Q-K8S-133 | covered | existing |  |
| 48 | Multi-tenancy | Advanced | M14 | none | gap | secondary | Not a CNCF domain objective; M14 covers it. |
| 49 | Admission controllers | Advanced | M11, M12 | Q-K8S-136, Q-K8S-142 | covered | existing |  |
| 50 | Disaster recovery | Advanced | M10 | Q-K8S-002 | gap | primary | etcd backup/restore; add a CKA Cluster Architecture question. |

## Summary

- **Covered by existing questions:** 27
- **Gaps:** 22 (15 primary bank, 7 secondary bank)
- **Outdated source claims:** 1 (Q19: Ingress as the edge, Flannel/Weave as the CNI examples)
- **Existing questions referenced:** 41 distinct IDs (plus the Q-K8S-123..075 range)

The primary-bank gaps cluster in CKA Cluster Architecture (kubeconfig, HA, upgrade, disaster recovery, etcd outage), CKA Workloads & Scheduling (Deployment reconciliation, tolerations, scaling), CKA Services & Networking (kube-proxy), and CKAD Application Deployment (Deployment vs StatefulSet).
