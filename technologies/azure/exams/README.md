# Azure Certification & Exam Coverage Matrix

This directory contains the certification domain-to-module coverage matrices, exam-delta callouts, original question banks, and full-length mock exams for the three active Microsoft Azure certifications covered by `technologies/azure`:

1. **AZ-104**: Microsoft Azure Administrator Associate ([`az-104.md`](az-104.md))
2. **AZ-305**: Designing Microsoft Azure Infrastructure Solutions ([`az-305.md`](az-305.md))
3. **AI-200**: Developing AI Cloud Solutions on Azure — official successor to retired **AZ-204** ([`ai-200.md`](ai-200.md))

---

## Exam-Delta Callouts

> [!IMPORTANT]
> **AZ-204 Retired → AI-200 Active:** Exam AZ-204 (*Developing Solutions for Microsoft Azure*) retired on **2026-07-31**. Microsoft replaced it with **AI-200** (*Developing AI Cloud Solutions on Azure*), shifting developer emphasis toward Azure Container Apps with KEDA, Cosmos DB vector search and Azure AI Search RAG pipelines, Azure Functions Flex Consumption, and OpenTelemetry instrumentation. This track teaches current AI-200 objectives while preserving legacy AZ-204 developer primitives (App Service slots, Durable Functions, Service Bus, Storage SAS) where still tested across AZ-104, AZ-305, and AI-200.

> [!IMPORTANT]
> **Default Outbound Access Retirement (2026-03-31):** New VNets deployed with API version `2025-07-01` or later create private subnets (`defaultOutboundAccess: false`) with no implicit internet egress. Older AZ-104/AZ-305 study materials sometimes assume VMs in a subnet without a NAT Gateway or Public IP can still reach the internet by default; current Azure behavior and updated 2026 exam items require an explicit outbound path (NAT Gateway, Standard Load Balancer outbound rules, instance Public IP, or UDR to Firewall/NVA).

> [!IMPORTANT]
> **Key Vault Access Policies & Azure Blueprints Legacy Framing:** While some older AZ-104/AZ-305 items still mention Key Vault Access Policies or Azure Blueprints as historical comparison distractors, Microsoft recommends **Azure RBAC for Key Vault** and **Deployment Stacks** (with `denySettings`) for all new deployments. Both legacy and current models are contrasted in [Module 03](../modules/03-arm-bicep-and-iac-patterns.md), [Module 09](../modules/09-security-monitoring-and-bcdr.md), and [Module 10](../modules/10-well-architected-finops-and-version-history.md).

---

## 1. AZ-104: Microsoft Azure Administrator Coverage Matrix

| Domain & Technical Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Manage Azure identities and governance**<br>Manage Microsoft Entra users, groups, and service principals; manage Azure RBAC (built-in and custom roles, control vs data plane, ABAC); manage subscriptions, management groups, Azure Policy initiatives and remediation, resource locks, and Cost Management budgets. | 20–25% | Modules 01, 02, 10 | `examples/01-governance-and-policy.test.ts`, `examples/02-entra-rbac-and-abac.test.ts` | ✅ full |
| **Implement and manage storage**<br>Configure Storage Account security (Entra RBAC, User Delegation SAS, disabling Shared Key, immutability); manage Azure Blob Storage tiers, lifecycle, soft delete, versioning, and redundancy/failover; configure Azure Files and AzCopy transfers. | 15–20% | Module 07 | `examples/06-storage-sas-and-durability.test.ts`, `examples/09-azurite-integration.test.ts` | ✅ full |
| **Deploy and manage Azure compute resources**<br>Automate deployments with ARM, Bicep, and Deployment Stacks; configure VMs, Availability Zones, VMSS Flexible orchestration; configure App Service Plans, deployment slots, and VNet integration; deploy Azure Container Apps, ACI, and AKS workloads. | 20–25% | Modules 03, 05 | `examples/03-arm-bicep-and-stacks.test.ts`, `examples/05-compute-and-serverless.test.ts` | ✅ full |
| **Implement and manage virtual networking**<br>Configure VNets, subnets, peering, and gateway transit; implement NSGs, ASGs, UDRs, and Azure Firewall; configure Private Endpoints and Private DNS Zones; configure explicit outbound egress (NAT Gateway after DOA retirement), Load Balancer, Application Gateway, Front Door, and VPN/ExpressRoute. | 15–20% | Module 04 | `examples/04-vnet-routing-nsg-and-dns.test.ts` | ✅ full |
| **Monitor and maintain Azure resources**<br>Monitor with Azure Monitor Metrics, Log Analytics (KQL), Diagnostic Settings, Alerts, and Action Groups; implement Azure Backup and Azure Site Recovery; inspect connectivity with Network Watcher. | 10–15% | Modules 04, 09 | `examples/08-keyvault-monitor-and-bcdr.test.ts` | ✅ full |

---

## 2. AZ-305: Designing Microsoft Azure Infrastructure Solutions Coverage Matrix

| Domain & Enterprise Architecture Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Design identity, governance, and monitoring solutions**<br>Design CAF Landing Zones, Management Group and Azure Policy guardrails; design Entra ID authentication, Managed Identities, PIM, Conditional Access, and Workload Identity Federation; design centralized Azure Monitor, Log Analytics, OpenTelemetry, and Defender for Cloud architectures. | 25–30% | Modules 01, 02, 09, 10 | `examples/01-governance-and-policy.test.ts`, `examples/02-entra-rbac-and-abac.test.ts`, `examples/08-keyvault-monitor-and-bcdr.test.ts` | ✅ full |
| **Design data storage solutions**<br>Design relational architectures (Azure SQL DTU/vCore/Hyperscale, SQL MI, PostgreSQL Flexible Server); design non-relational storage (Blob tiers/redundancy, Azure Files/NetApp, Cosmos DB partitioning, RU/s sizing, and consistency levels); design data integration and caching (Azure Managed Redis, Event Hubs, AI Search). | 20–25% | Modules 07, 08 | `examples/06-storage-sas-and-durability.test.ts`, `examples/07-cosmos-partitioning-and-consistency.test.ts` | ✅ full |
| **Design business continuity solutions**<br>Design backup and disaster recovery architectures meeting explicit RPO and RTO targets (Azure Backup immutable vaults, Azure Site Recovery, GRS/GZRS customer-initiated failover, SQL Failover Groups, Cosmos DB multi-region writes, Availability Zones vs Region Pairs). | 15–20% | Modules 07, 08, 09, 10 | `examples/06-storage-sas-and-durability.test.ts`, `examples/08-keyvault-monitor-and-bcdr.test.ts` | ✅ full |
| **Design infrastructure solutions**<br>Design compute architectures (VMSS, App Service, Container Apps, AKS, Functions); design application integration and messaging (Service Bus, Event Grid, Event Hubs, API Management); design Hub-Spoke/Virtual WAN networking, Private Link DNS, and global edge routing; apply Well-Architected and FinOps optimization. | 30–35% | Modules 03, 04, 05, 06, 10 | `examples/03-arm-bicep-and-stacks.test.ts`, `examples/04-vnet-routing-nsg-and-dns.test.ts`, `examples/05-compute-and-serverless.test.ts` | ✅ full |

---

## 3. AI-200: Developing AI Cloud Solutions on Azure Coverage Matrix

| Domain & Cloud Developer Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Develop containerized solutions on Azure**<br>Package and operate containerized APIs and AI workers on Azure Container Apps (environments, KEDA event-driven scaling, revisions, traffic splitting, Dapr sidecars), ACR, and AKS integration patterns. | 20–25% | Module 05 | `examples/05-compute-and-serverless.test.ts` | ✅ full |
| **Develop AI solutions by using Azure data management services**<br>Model high-scale operational and vector data in Azure Cosmos DB (partition keys, Hierarchical Partition Keys, RU/s optimization, Change Feed, DiskANN vector search), Azure AI Search (hybrid BM25 + vector + semantic ranking for RAG), and Blob Storage data pipelines. | 30–35% | Modules 07, 08 | `examples/06-storage-sas-and-durability.test.ts`, `examples/07-cosmos-partitioning-and-consistency.test.ts` | ✅ full |
| **Connect to and consume Azure services**<br>Build resilient serverless and event-driven consumers with Azure Functions (Flex Consumption, Durable Functions determinism), Service Bus (peek-lock, sessions, DLQ, duplicate detection), Event Grid, Event Hubs, API Management AI gateway policies, and Azure Managed Redis. | 20–25% | Modules 06, 08 | `examples/05-compute-and-serverless.test.ts` | ✅ full |
| **Secure, monitor, and troubleshoot Azure solutions**<br>Authenticate passwordlessly via Entra Managed Identities and Workload Identity Federation; manage secrets with Key Vault RBAC and soft-delete/purge protection; instrument with Azure Monitor OpenTelemetry Distro, Application Insights, and KQL diagnostics. | 20–25% | Modules 02, 09 | `examples/02-entra-rbac-and-abac.test.ts`, `examples/08-keyvault-monitor-and-bcdr.test.ts` | ✅ full |

---

## 4. Question Bank Inventory

- **AZ-104 Bank**: [`az-104.md`](az-104.md) — 65 original questions (`Q-AZ104-001`–`Q-AZ104-065`) weighted across all 5 administrator domains + full 60-question timed mock exam (100 minutes) with scoring key.
- **AZ-305 Bank**: [`az-305.md`](az-305.md) — 65 original questions (`Q-AZ305-001`–`Q-AZ305-065`) weighted across all 4 architect domains + full 50-question timed mock exam (100 minutes) with scoring key.
- **AI-200 Bank**: [`ai-200.md`](ai-200.md) — 60 original questions (`Q-AI200-001`–`Q-AI200-060`) weighted across all 4 AI cloud developer domains + full 50-question timed mock exam (100 minutes) with scoring key.
