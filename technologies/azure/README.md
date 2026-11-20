# Microsoft Azure: Enterprise Cloud Architecture & Systems Engineering

A rigorous, production-oriented engineering curriculum covering Microsoft Azure tenancy and governance, Microsoft Entra ID and RBAC/ABAC authorization, ARM/Bicep and Deployment Stacks, virtual networking and Private Link DNS mechanics, compute and serverless runtimes, Azure Storage durability and failover semantics, Azure Cosmos DB and relational data platforms, security, observability, and business continuity.

Verified against Azure CLI 2.93.0, Bicep 0.49.2, Terraform `hashicorp/azurerm` 5.14.0, `@azure/storage-blob` 12.34.0, `@azure/cosmos` 4.10.2, `@azure/service-bus` 7.10.0, Azurite 3.38.0, Azure Functions Core Tools 4.16.1, PSRule for Azure 1.47.0, Node.js 26.13.0, and TypeScript 7.0.2 on 2026-11-20.

---

## Curriculum Overview & Syllabus

1. [Module 01: Tenancy, Governance, and Azure Policy](modules/01-tenancy-governance-and-policy.md) — Entra tenant, Management Group hierarchy, Subscriptions, Resource Groups (RG metadata region outage trap), Azure Policy evaluation lifecycle (`Audit`, `Deny`, `Modify`, `DeployIfNotExists`, `DenyAction`), initiatives, explicit remediation tasks, Resource Locks (`CanNotDelete`/`ReadOnly` vs data-plane mutations), tag inheritance, Cloud Adoption Framework (CAF) Landing Zones, and Cost Management budgets.
2. [Module 02: Microsoft Entra ID, RBAC, and Workload Identity](modules/02-entra-id-rbac-and-workload-identity.md) — Entra ID users, groups, App Registrations vs Enterprise Applications (Service Principals), System-Assigned vs User-Assigned Managed Identities and IMDS (`169.254.169.254`) token flow, Azure RBAC evaluation separating control-plane `actions` from data-plane `dataActions`, Deny Assignments, RBAC propagation latency (up to 30 min cache window), Azure ABAC conditions, Privileged Identity Management (PIM), Conditional Access, and Workload Identity Federation (GitLab/GitHub OIDC).
3. [Module 03: ARM, Bicep, Deployment Stacks, and IaC Patterns](modules/03-arm-bicep-and-iac-patterns.md) — Azure Resource Manager (ARM) resource provider model and API versions, deployment scopes (Tenant, Management Group, Subscription, Resource Group), Incremental vs Complete deployment mode deletion hazards, `what-if` noise and limitations, Bicep modules and user-defined types, Deployment Stacks with `denySettings` (replacing Azure Blueprints), Terraform `azurerm` vs `AzAPI` provider strategies, and offline policy/template verification (`bicep lint`, `PSRule.Rules.Azure`, `terraform test` with `mock_provider`, Conftest/OPA).
4. [Module 04: Virtual Networking, Private Link, and Traffic Routing](modules/04-virtual-networking-private-link-and-routing.md) — VNets, subnets (5 reserved IPs, delegated subnets), NSGs and ASGs (subnet + NIC dual evaluation and Effective Security Rules debugging), UDRs and longest-prefix match with Azure Firewall/NVAs (asymmetric routing pitfalls), Hub-Spoke vs Virtual WAN vs AVNM, VNet peering non-transitivity and gateway transit, Private Endpoints and split-horizon `privatelink.*` Private DNS Zones, Service Endpoints, **Default Outbound Access retirement (effective 2026-03-31, API `2025-07-01+`)** and NAT Gateway SNAT port math, L4/L7 ingress decision tree (Azure Load Balancer, Application Gateway WAF v2, Azure Front Door, Traffic Manager), VPN Gateway, ExpressRoute, Bastion, and Network Watcher.
5. [Module 05: Compute — VMs, App Service, Container Apps, and AKS Delta](modules/05-compute-vms-app-service-and-containers.md) — Virtual Machines (Availability Sets vs Availability Zones vs VMSS Flexible orchestration, Spot eviction 30-second notice, Azure Hybrid Benefit), App Service Plans, deployment slots, slot-sticky vs swapped settings and `applicationInitialization` warm-up bypass pitfalls, VNet integration vs Private Endpoints, Azure Container Apps (managed Envoy ingress, KEDA event-driven scaling, revisions, traffic splitting, Dapr sidecars), Azure Container Instances, and Azure Kubernetes Service (AKS) platform delta (cross-linking to [`technologies/kubernetes`](../kubernetes/)).
6. [Module 06: Serverless, Messaging, and Event Integration](modules/06-serverless-messaging-and-event-integration.md) — Azure Functions hosting plans (Flex Consumption, Consumption, Premium, Dedicated), cold start mechanics, isolated worker model, triggers and bindings, Durable Functions event-sourcing replay and strict orchestrator determinism constraints, Azure Service Bus (queues vs topics/subscriptions, peek-lock expiry and `MessageLockLost`, lock renewal, `MaxDeliveryCount` to DLQ, sessions FIFO serialization, duplicate detection), Event Grid vs Event Hubs (Kafka protocol, partitions, consumer groups) vs Storage Queues, API Management (policies, AI token-limit gateway), and Logic Apps.
7. [Module 07: Azure Storage — Blob, Files, Durability, and Access Control](modules/07-storage-blob-files-and-data-protection.md) — Storage account kinds (`StorageV2`, `BlockBlobStorage`, `FileStorage`), globally unique naming collisions in IaC, redundancy models (LRS, ZRS, GRS, RA-GRS, GZRS, RA-GZRS) and customer-initiated GRS failover (typical RPO ≤ 15 minutes with no strict SLA, stale RA-GRS reads), access tiers (Hot, Cool, Cold, Archive, early deletion fees, Archive rehydration latency), SAS types (Account, Service, User Delegation SAS) and disabling Shared Key authentication, WORM immutability policies, soft delete, blob versioning, lifecycle management, Azure Files vs Azure NetApp Files, AzCopy, and Data Box.
8. [Module 08: Data Platforms — Azure SQL, PostgreSQL, Cosmos DB, and AI Data](modules/08-data-platforms-sql-cosmos-and-ai-data.md) — Azure SQL Database (DTU vs vCore, Serverless auto-pause wake-up, Hyperscale decoupled storage, Failover Groups vs Active Geo-Replication), SQL Managed Instance, Azure Database for PostgreSQL Flexible Server (cross-linking [`technologies/postgres`](../postgres/)), Azure Cosmos DB internals (RU/s metering, 429 throttling and `x-ms-retry-after-ms`, strict 20 GB logical partition limit returning `403/1014`, 10,000 RU/s physical partition ceiling, Hierarchical Partition Keys up to 3 levels, five consistency levels with session tokens, multi-region writes, Change Feed, DiskANN vector search), Azure Managed Redis (cross-linking [`technologies/redis`](../redis/)), and Azure AI Search (hybrid BM25 + vector + semantic ranking).
9. [Module 09: Security, Key Vault, Monitoring, and Business Continuity](modules/09-security-monitoring-and-bcdr.md) — Azure Key Vault (Azure RBAC vs legacy Vault Access Policies, soft-delete + purge protection IaC recreate collisions, Managed HSM), Microsoft Defender for Cloud, Azure Monitor (Platform Metrics, Log Analytics Workspace and KQL cross-linking [`technologies/observability`](../observability/), Application Insights OpenTelemetry Distro, Data Collection Rules, Diagnostic Settings, Alerts and Action Groups), Azure Backup (Vaulted vs Snapshot, immutable vaults) vs Azure Site Recovery, Availability Zones vs legacy Region Pairs, and AZ-305 BCDR architecture design.
10. [Module 10: Well-Architected Framework, FinOps, and Platform Evolution](modules/10-well-architected-finops-and-version-history.md) — Azure Well-Architected Framework five pillars and AZ-305 trade-off analysis, Azure FinOps (Reservations, Savings Plans for Compute, Azure Hybrid Benefit, Spot VMs, Cost Management exports, Azure Advisor), production pattern synthesis, comprehensive **Then vs Now** migration guides (AZ-204 → AI-200, Default Outbound Access retirement, Key Vault Access Policies → RBAC, Blueprints → Deployment Stacks, Functions In-Process → Isolated Worker & Flex Consumption, Azure Cache for Redis → Azure Managed Redis), and platform version history table.

---

## Prerequisites

- Provider-neutral cloud primitives and AWS/GCP/Azure service mapping from [`architecture/cloud-foundations`](../../architecture/cloud-foundations/) (especially [MAPPING.md](../../architecture/cloud-foundations/MAPPING.md)).
- Networking fundamentals from [`architecture/networking`](../../architecture/networking/) (CIDR, BGP, DNS, TLS 1.3, HTTP/2–3, L4/L7 load balancing).
- Identity and cryptographic foundations from [`architecture/security-identity`](../../architecture/security-identity/) (OAuth 2.1, OIDC, JWT, PKI/mTLS, RBAC/ABAC models).
- Distributed storage, consistency, and replication foundations from [`architecture/data-systems`](../../architecture/data-systems/) and [`architecture/distributed-systems`](../../architecture/distributed-systems/).
- Kubernetes, Terraform, and Observability foundations from [`technologies/kubernetes`](../kubernetes/), [`technologies/terraform`](../terraform/), and [`technologies/observability`](../observability/).

---

## Runnable Verification Instructions

```bash
# Install pinned toolchain via mise
cd technologies/azure
mise install
mise exec -- npm ci

# Run deterministic unit, property, and negative-test suites (no Docker required)
mise exec -- npm test

# Run optional live Azurite integration tests (skips cleanly if Azurite/Docker unavailable)
mise exec -- npm run test:integration

# Run static analysis, type checking, and formatting checks
mise exec -- npm run typecheck
mise exec -- npm run lint
mise exec -- npm run fmt:check
```

---

## Certifications & Exams

This track covers the three active Microsoft Azure engineering certifications aligned to administration, architecture, and cloud/AI application development. **Exam AZ-204 (Developing Solutions for Microsoft Azure) retired on 2026-07-31** and is succeeded by **AI-200**.

### 1. Exam AZ-104: Microsoft Azure Administrator

- **Vendor**: Microsoft
- **Official Study Guide**: [AZ-104 Study Guide on Microsoft Learn](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104)
- **Guide Verified**: 2026-11-20 (skills measured updated 2026-04-17; targets current Azure GA platform)
- **Status**: Active
- **Format**: 40–60 questions (single choice, multiple select, drag-and-drop ordering, case studies, interactive lab/performance tasks); 100 minutes exam duration; passing score 700/1000.
- **Domain Weights**:
  - Manage Azure identities and governance: 20–25%
  - Implement and manage storage: 15–20%
  - Deploy and manage Azure compute resources: 20–25%
  - Implement and manage virtual networking: 15–20%
  - Monitor and maintain Azure resources: 10–15%
- **Question Bank**: 65 original questions + 60-question timed mock exam in [`exams/az-104.md`](exams/az-104.md).

### 2. Exam AZ-305: Designing Microsoft Azure Infrastructure Solutions

- **Vendor**: Microsoft
- **Official Study Guide**: [AZ-305 Study Guide on Microsoft Learn](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-305)
- **Guide Verified**: 2026-11-20 (skills measured updated 2026-04-17; requires active AZ-104 for Azure Solutions Architect Expert certification)
- **Status**: Active
- **Format**: 40–60 scenario and case-study questions (single choice, multiple select, build list, hotspot); 100 minutes exam duration; passing score 700/1000.
- **Domain Weights**:
  - Design identity, governance, and monitoring solutions: 25–30%
  - Design data storage solutions: 20–25%
  - Design business continuity solutions: 15–20%
  - Design infrastructure solutions: 30–35%
- **Question Bank**: 65 original questions + 50-question timed mock exam in [`exams/az-305.md`](exams/az-305.md).

### 3. Exam AI-200: Developing AI Cloud Solutions on Azure (Successor to Retired AZ-204)

- **Vendor**: Microsoft
- **Official Study Guide**: [AI-200 Study Guide on Microsoft Learn](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-200)
- **Guide Verified**: 2026-11-20 (skills measured updated 2026-10-07; replaces retired AZ-204, retired 2026-07-31)
- **Status**: Active (leads to Azure AI Cloud Developer Associate)
- **Format**: 40–60 scenario, code-completion, and architecture questions; 100 minutes exam duration; passing score 700/1000.
- **Domain Weights**:
  - Develop containerized solutions on Azure: 20–25%
  - Develop AI solutions by using Azure data management services: 30–35%
  - Connect to and consume Azure services: 20–25%
  - Secure, monitor, and troubleshoot Azure solutions: 20–25%
- **Question Bank**: 60 original questions + 50-question timed mock exam in [`exams/ai-200.md`](exams/ai-200.md).

Full domain-to-module coverage matrices and exam-delta callouts live in [`exams/README.md`](exams/README.md).
