# Brief: Azure (`technologies/azure`)

| | |
|---|---|
| Phase | 4 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/azure` · `../zto-azure` |
| Depends on | architecture/cloud-foundations |
| Research dossier | `.agents/research/F-cloud.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- AZ-204 is retired → AI-200. Cover AZ-104, AZ-305 and AI-200 (re-verify dates).
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- (see dossier "Overlaps / dedupe")

**Cross-link only (do not re-explain):**
- OAuth 2.1, OIDC, PKCE, DPoP, JWT pitfalls, sessions/cookies, WebAuthn/passkeys → owned by `architecture/security-identity`
- Cloud model, shared responsibility, IAM model, VPC/CIDR, storage classes, managed DBs, serverless, Well-Architected, FinOps → owned by `architecture/cloud-foundations`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Azure — `technologies/azure`

- **Current stable version(s):**
  - `hashicorp/azurerm` **5.11.0** (2026-10-23)
  - `@azure/storage-blob` **12.34.0**
  - **Azurite 3.37.0** (npm, 2026-08-25)
  - **Cosmos DB Linux emulator vNext:** GA **2026-06-02**, image `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-latest`, x64 and **ARM64 (Apple Silicon OK)**, NoSQL API. Source: https://devblogs.microsoft.com/cosmosdb/announcing-general-availability-of-the-azure-cosmos-db-vnext-emulator/
  - **Service Bus emulator** (Docker; no SLA; AMQP TCP only, no WebSockets, no partitioned entities, no persistence across restarts; 1 namespace / 50 entities; config via `config.json` or the Administration Client). Source: https://learn.microsoft.com/en-us/azure/service-bus-messaging/overview-emulator
  - Azure CLI / Bicep / Functions Core Tools: pin at authoring time (unverified versions).
- **Authoritative syllabi used:**
  - **AZ-104 (Administrator):** skills measured as of **2026-04-17**, no retirement notice. Source: https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104

    | Domain | Weight |
    |---|---|
    | Identities and governance | 20–25% |
    | Compute | 20–25% |
    | Storage | 15–20% |
    | Virtual networking | 15–20% |
    | Monitor and maintain | 10–15% |

  - **AZ-305 (Solutions Architect Expert):** skills as of **2026-04-17**, no retirement notice. Source: https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-305

    | Domain | Weight |
    |---|---|
    | Identity, governance, monitoring | 25–30% |
    | Data storage | 20–25% |
    | Business continuity | 15–20% |
    | Infrastructure | 30–35% |

  - **AZ-204 is RETIRED.**
    - The official certification page states "This certification and the renewal assessment are retired": https://learn.microsoft.com/en-us/credentials/certifications/azure-developer/
    - Retirement date 2026-07-31 per secondary sources: https://vladtalkstech.com/microsoft-learning-and-credential-news/microsoft-certification-retirements-2026/
    - Successor: **AI-200 "Developing AI Cloud Solutions on Azure"**, leading to the Azure AI Cloud Developer Associate. Skills as of **2026-10-07**:

      | AI-200 domain | Weight |
      |---|---|
      | Develop containerized solutions | 20–25% |
      | Develop AI solutions using Azure data management services | 30–35% (page also says 25–30% in one heading; inconsistency in source) |
      | Connect to and consume Azure services | 20–25% |
      | Secure, monitor and troubleshoot | 20–25% |

      Source: https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-200
    - Topics include vector search/RAG, KEDA on Container Apps and OpenTelemetry (per https://dev.to/lovelacecoding/bye-az-204-hello-ai-200-what-you-need-to-know-about-the-new-azure-developer-certification-2lo).
    - Other 2026 swaps: AZ-500 → SC-500 (2026-08-31), AI-102 → AI-103, DP-100 → AI-300 (secondary source above).
  - Azure Well-Architected Framework: https://learn.microsoft.com/azure/well-architected/
  - Cloud Adoption Framework (landing zones): https://learn.microsoft.com/azure/cloud-adoption-framework/
  - Azure Architecture Center: https://learn.microsoft.com/azure/architecture/
- **Proposed modules:**
  1. **Tenancy and governance**
     - Entra tenant vs subscription vs management groups vs resource groups (RG location ≠ resource location)
     - Azure Policy effects (Audit/Deny/Modify/DeployIfNotExists/DenyAction), initiatives, remediation tasks
     - Resource locks; tags inheritance via Policy
     - CAF landing zones; cost management and budgets
  2. **Identity: Entra ID and RBAC**
     - Users/groups/service principals vs app registrations
     - Managed identities (system vs user-assigned)
     - Azure RBAC (control plane vs data plane actions, e.g. `Storage Blob Data Reader`), role assignment scope and propagation latency
     - ABAC conditions; PIM; Conditional Access (concepts)
     - Workload identity federation (GitLab OIDC)
  3. **ARM, Bicep and IaC**
     - ARM resource provider model, API versions
     - Deployment scopes and modes (incremental vs complete), what-if
     - Bicep modules; Deployment Stacks with deny settings
     - Terraform azurerm vs AzAPI
  4. **Networking**
     - VNets/subnets, delegated subnets; NSGs/ASGs, effective rules
     - UDRs + Azure Firewall/NVA; hub-spoke vs Virtual WAN; VNet peering (gateway transit)
     - Private Endpoints + Private DNS zones; service endpoints
     - NAT Gateway and **default outbound access retirement**
     - Load Balancer / Application Gateway (WAF) / Front Door / Traffic Manager decision tree
     - VPN Gateway / ExpressRoute; Bastion; Network Watcher
  5. **Compute**
     - VMs (availability sets vs zones vs VMSS Flexible), Spot, Azure Hybrid Benefit
     - App Service (plans, deployment slots and swap semantics, VNet integration)
     - AKS (cross-link); Container Apps (environments, KEDA scaling, revisions, Dapr); Container Instances
  6. **Serverless and integration**
     - Azure Functions hosting plans (Flex Consumption, Premium, Dedicated), triggers/bindings, Durable Functions (orchestrator determinism)
     - Service Bus (sessions, peek-lock, lock renewal, DLQ, duplicate detection)
     - Event Grid vs Event Hubs vs Storage Queues; API Management; Logic Apps
  7. **Storage**
     - Account kinds, redundancy (LRS/ZRS/GRS/RA-GRS/GZRS) and failover semantics
     - Access tiers (Hot/Cool/Cold/Archive, rehydration)
     - SAS types (account/service/user-delegation), shared key disablement
     - Immutability policies, soft delete/versioning, lifecycle management
     - Azure Files vs NetApp; AzCopy; Data Box
  8. **Data**
     - Azure SQL (DTU vs vCore, serverless, Hyperscale, failover groups), SQL MI
     - PostgreSQL Flexible Server
     - Cosmos DB (RU/s, partition key design, 5 consistency levels, multi-region writes, change feed, vector search for AI-200)
     - Azure Managed Redis; AI Search (AI-200)
  9. **Security, monitoring and BCDR**
     - Key Vault (RBAC vs access policies, soft-delete/purge protection), Defender for Cloud
     - Azure Monitor (metrics, Log Analytics/KQL, Application Insights via OpenTelemetry distro), diagnostic settings, alerts and action groups
     - Azure Backup vs Site Recovery; availability zones and region pairs
     - Well-Architected reviews (AZ-305 design depth)
- **Gotchas & production failure modes:**
  1. **Default outbound access:** VNets created after **2026-03-31** default to private subnets with no implicit internet egress. New VMs can't reach the internet or package repos without NAT Gateway/LB outbound rules/a public IP. Sources: https://mc.merill.net/message/AZ515484 and https://community.advania.co.uk/discussion/470/update-the-retirement-date-for-azure-default-outbound-access-has-been-extended-to-march-31-2026 (secondary; confirm against https://learn.microsoft.com/azure/virtual-network/ip-services/default-outbound-access).
  2. A Private Endpoint without the matching Private DNS zone linked to the VNet means the FQDN still resolves to the public IP. "Works from my laptop, not from the VNet", or the reverse.
  3. RBAC control plane ≠ data plane: `Owner` on a storage account can't read blobs via Entra auth without a `Storage Blob Data *` role. Role assignments take minutes to propagate (unverified exact SLA).
  4. ARM **Complete** deployment mode deletes resources in the RG that are not in the template.
  5. App Service slot swap: slot-sticky settings vs swapped settings. Warm-up (`applicationInitialization`) is skipped, and a cold production follows.
  6. Service Bus peek-lock duration shorter than processing time causes `MessageLockLost` and redelivery. `MaxDeliveryCount` (default 10) → DLQ. Sessions serialise per session ID.
  7. Cosmos DB: a poorly chosen partition key hits the 20 GB logical partition limit (unverified for current limits) plus RU hot partitions. Cross-partition queries burn RUs. 429s need SDK retry with `x-ms-retry-after-ms`.
  8. Azure Functions Consumption/Flex cold starts. Durable Functions orchestrators must be deterministic: no `DateTime.Now`, no I/O.
  9. Key Vault soft-delete plus purge protection means you can't recreate a vault/secret with the same name for the retention period. Terraform `destroy`/`apply` cycles fail.
  10. Storage account names are globally unique, 3–24 lowercase alphanumerics, which collides in IaC naming conventions.
  11. GRS failover is customer-initiated, and data written after the last sync is lost (RPO ~15 min, unverified). RA-GRS reads can be stale.
  12. NSG rules on the subnet and the NIC are both evaluated. The effective-rules view is the only reliable debugger.
  13. Resource-group location only stores metadata, but RG-region outages can block management operations on resources elsewhere.
  14. Azure Policy `DeployIfNotExists` runs only on create/update. Existing non-compliant resources need an explicit remediation task.
- **Interview hot topics:**
  - Management-group hierarchy and Policy-driven landing zone
  - Entra ID managed identity vs service principal vs workload identity federation
  - Hub-spoke vs Virtual WAN; Private Endpoint DNS
  - Front Door vs Application Gateway vs Traffic Manager
  - Cosmos DB partitioning and consistency levels
  - Service Bus vs Event Grid vs Event Hubs
  - Functions hosting plans and Durable Functions
  - Storage redundancy and failover
  - Container Apps vs AKS vs App Service
  - AZ-305-style BCDR design
- **Executable-proof strategy:**
  - **Local suites:**
    - **Azurite 3.37.0** (`npx azurite` or the Docker `mcr.microsoft.com/azure-storage/azurite`): Blob/Queue/Table tests, SAS expiry negative test, conditional ETag writes (`If-Match` → 412).
    - **Cosmos DB vNext emulator** (ARM64 OK): partition-key design, RU charge headers (emulator RU numbers are not production-accurate (unverified)), consistency levels are not meaningfully emulated, change feed.
    - **Service Bus emulator:** peek-lock expiry → redelivery → DLQ after `MaxDeliveryCount`; sessions ordering; duplicate detection.
    - **Azure Functions Core Tools** (`func start`) with Azurite as `AzureWebJobsStorage`. Durable Functions orchestrator replay tests.
  - **IaC:**
    - `bicep build` + `az deployment what-if` needs Azure (cloud-only). Offline: `bicep lint` and PSRule for Azure (unverified version).
    - `terraform test` + `mock_provider "azurerm"`; Conftest (deny public blob access, require private endpoints, require `min_tls_version = "TLS1_2"`).
  - **Cannot prove locally:** Entra ID/RBAC propagation, Azure Policy evaluation (fallback: Policy definitions unit-tested with the community `AzPolicyTest`/PSRule (unverified), plus a sandbox subscription), Private Endpoint DNS, Front Door, failover.
  - **Mise:** `node 22`, `azure-cli` (pin; via pipx/uv), `bicep` (pin), `azure-functions-core-tools` (npm), `terraform 1.17.0`, `opa 1.20.1`.
- **Overlaps / dedupe:**
  - Concepts → Cloud Foundations.
  - AKS → K8s.
  - Entra ID/OIDC protocol details → security/identity track.
  - KQL → observability track (cross-link).
  - The AI-200 AI-specific content (vector search, RAG) → AI/LLM-engineering track if it exists; keep only the Azure service wiring here.

---

#### Context from `F-cloud.md`

##### 0. Design decision: one shared foundation track plus thin provider tracks

**Problem.** AWS, GCP and Azure implement the same roughly 12 primitives: identity, network, compute, block/object/file storage, managed SQL/NoSQL, queues/pub-sub, serverless, IaC, observability, governance and cost. Three full tracks would teach VPC/CIDR/routing, IAM evaluation logic, storage tiers, the consistency of managed databases and the Well-Architected pillars three times over.

**Proposal.**

| Track | Repo path | Owns | Size |
|---|---|---|---|
| Cloud Foundations | `architecture/cloud-foundations` | Provider-neutral concepts with formal definitions. Each module ends with a three-column "how AWS / GCP / Azure spell it" table that deep-links into the provider tracks. Uses Terraform as the lingua franca, with the IaC internals themselves left to the IaC track. | 12 modules (the full syllabus) |
| AWS | `technologies/aws` | Exam-domain mapping (SAA-C03, DVA-C02 to C03, SAP-C03), AWS-only semantics (IAM policy evaluation order, SCP/RCP, S3 specifics, DynamoDB modelling, Lambda internals) and AWS gotchas | 9–10 modules |
| GCP | `technologies/gcp` | ACE/PCA mapping, resource hierarchy, IAM deny/PAB, global VPC, Shared VPC, Cloud Run/GKE, Spanner/BigQuery, PCA case studies | 8–9 modules |
| Azure | `technologies/azure` | AZ-104/AZ-305/AI-200 mapping, Entra ID and RBAC vs ABAC, ARM/Bicep, management groups/Policy, hub-spoke/vWAN, App Service/Functions/Container Apps, Cosmos DB | 9 modules |
| Cloudflare | `technologies/cloudflare` | Standalone edge platform. It does not fit the hyperscaler mold, so it has its own internals: isolates, Durable Objects, the KV consistency model. | 12 modules |

**Rule of thumb:** a concept belongs in a provider track only when the knowledge disappears if you swap the logo. Provider tracks never re-explain CIDR, CAP, idempotency or the Well-Architected pillars. They link to the foundation module and cover only the delta: names, limits, defaults, quotas, pricing traps and exam framing.

**Cross-track dependencies (other briefs' tracks, assumed):** networking fundamentals (TCP/IP, DNS, TLS, BGP), the Kubernetes track (EKS/GKE/AKS only cross-link), the Terraform/IaC track (state, modules, `terraform test` mechanics), databases (Postgres, isolation levels), distributed systems (consensus, consistency), observability (OpenTelemetry) and security (OAuth/OIDC, PKI).

##### 0.1 Concept to service mapping (core of the foundation track; becomes `architecture/cloud-foundations/MAPPING.md`)

| Concept | AWS | GCP | Azure | Cloudflare (where applicable) |
|---|---|---|---|---|
| Top-level boundary / hierarchy | Organization → OU → Account | Organization → Folder → Project | Entra tenant → Management group → Subscription → Resource group | Account → Zone |
| Guardrail policy (preventive) | SCP, RCP (resource control policies), declarative policies | Org Policy constraints (incl. custom), IAM Deny policies | Azure Policy (Deny/Modify/DeployIfNotExists), deny assignments | Account-level settings |
| Human identity / SSO | IAM Identity Center | Cloud Identity / Workspace, Workforce Identity Federation | Entra ID | Cloudflare Access (Zero Trust) |
| Workload identity | IAM roles (instance profile, IRSA / EKS Pod Identity) | Service accounts, Workload Identity Federation | Managed identities (system/user-assigned), Workload identity federation | Service tokens, mTLS |
| Authorization model | Identity- and resource-based JSON policies (allow/deny, conditions), ABAC via tags | Allow policies binding principal→role on resource; inherited; IAM Conditions | RBAC role assignments at scope; ABAC conditions (storage) | API tokens with scoped permissions |
| Virtual network | VPC (regional; subnets are AZ-scoped) | VPC (global; subnets regional) | VNet (regional; subnets span zones) | (n/a, anycast edge) |
| Shared network across accounts | VPC sharing (RAM), Transit Gateway, Cloud WAN | Shared VPC, Network Connectivity Center | VNet peering, Virtual WAN, hub-spoke + AVNM | Magic WAN |
| Stateful L4 filter | Security groups (stateful), NACLs (stateless) | VPC firewall rules / hierarchical firewall policies (stateful) | NSGs (stateful), ASGs | WAF / Magic Firewall |
| Private access to PaaS | Gateway endpoints (S3/DynamoDB), Interface endpoints (PrivateLink) | Private Google Access, Private Service Connect | Service endpoints, Private Endpoint (Private Link) | Tunnel (cloudflared) |
| Egress NAT | NAT Gateway | Cloud NAT | NAT Gateway (default outbound access retired for new VNets, see Azure gotchas) | n/a |
| L7 load balancer | ALB (regional), CloudFront | Global external Application LB (anycast) | Application Gateway (regional), Front Door (global) | Load Balancing, CDN |
| L4 load balancer | NLB | Network LB (passthrough/proxy) | Azure Load Balancer | Spectrum |
| DNS | Route 53 | Cloud DNS | Azure DNS / Private DNS zones | Cloudflare DNS |
| Hybrid connectivity | Site-to-Site VPN, Direct Connect | Cloud VPN (HA), Cloud Interconnect | VPN Gateway, ExpressRoute | Magic WAN / CNI |
| VMs | EC2 (+ ASG) | Compute Engine (+ MIG) | Virtual Machines (+ VMSS) | n/a |
| Managed Kubernetes | EKS (+ Auto Mode) | GKE (Standard / Autopilot) | AKS (+ Automatic) | n/a |
| Serverless containers | ECS on Fargate, App Runner (unverified current status) | Cloud Run (services, jobs, functions) | Container Apps (KEDA-based) | Containers (GA 2026-04-13) |
| FaaS | Lambda (+ durable functions, Managed Instances) | Cloud Run functions (ex-Cloud Functions) | Azure Functions (Flex Consumption) | Workers |
| Workflow / durable execution | Step Functions, Lambda durable functions | Workflows | Durable Functions, Logic Apps | Workflows |
| Object storage | S3 (Standard/IA/One Zone-IA/Glacier tiers, Intelligent-Tiering, Express One Zone) | Cloud Storage (Standard/Nearline/Coldline/Archive, Autoclass) | Blob Storage (Hot/Cool/Cold/Archive) | R2 (no egress fees) |
| Block storage | EBS (gp3/io2) | Persistent Disk / Hyperdisk | Managed Disks (Premium SSD v2, Ultra) | n/a |
| File storage | EFS, FSx | Filestore, NetApp Volumes | Azure Files, NetApp Files | n/a |
| Managed relational | RDS, Aurora (incl. DSQL) | Cloud SQL, AlloyDB, Spanner | Azure SQL DB / MI, Database for PostgreSQL Flexible Server | D1 (SQLite), Hyperdrive (pooling to external PG/MySQL) |
| Key-value / document NoSQL | DynamoDB | Firestore, Bigtable | Cosmos DB | KV, Durable Objects storage |
| In-memory cache | ElastiCache / MemoryDB (Valkey, Redis OSS) | Memorystore (Valkey/Redis) | Azure Managed Redis | KV / Cache API |
| Queue | SQS (standard/FIFO) | Pub/Sub (pull), Cloud Tasks | Storage Queues, Service Bus queues | Queues |
| Pub/sub, fan-out | SNS, EventBridge | Pub/Sub, Eventarc | Service Bus topics, Event Grid | Queues + Workers |
| Streaming | Kinesis Data Streams, MSK | Pub/Sub, Managed Kafka | Event Hubs (Kafka API) | Pipelines (unverified) |
| Data warehouse | Redshift, Athena | BigQuery | Synapse / Fabric | R2 SQL / Data Catalog (unverified) |
| Secrets / keys | Secrets Manager, KMS, CloudHSM | Secret Manager, Cloud KMS | Key Vault, Managed HSM | Secrets Store (unverified) |
| IaC native | CloudFormation, CDK | Infrastructure Manager (Terraform-based) | ARM / Bicep, Deployment Stacks | Wrangler config (`wrangler.jsonc`) |
| Observability | CloudWatch, X-Ray, CloudTrail | Cloud Monitoring/Logging/Trace, Cloud Audit Logs | Azure Monitor, Log Analytics, App Insights, Activity Log | Workers Logs, Logpush, Tail Workers |
| Well-Architected | AWS WAF: 6 pillars | Google Cloud Well-Architected Framework (5 pillars + cross-pillar) | Azure WAF: 5 pillars | n/a |
| Cost tooling | Cost Explorer, Budgets, CUR 2.0, Savings Plans, RIs | Billing export to BigQuery, CUDs, SUDs | Cost Management, Reservations, Savings Plan, Hybrid Benefit | Usage-based, no egress |
| Local emulator | LocalStack (now account-gated), moto | gcloud emulators (Firestore, Spanner GA; Pub/Sub, Bigtable, Datastore beta), Firebase Emulator Suite | Azurite, Cosmos DB vNext emulator, Service Bus emulator, Functions Core Tools | workerd / miniflare / wrangler dev |

Rows marked "(unverified)" are names the curriculum author must confirm before publishing. The table is a teaching scaffold, not a spec.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Azure CLI / Bicep / Functions Core Tools: pin at authoring time (unverified versions).
- 3. RBAC control plane ≠ data plane: `Owner` on a storage account can't read blobs via Entra auth without a `Storage Blob Data *` role. Role assignments take minutes to propagate (unverified exact SLA).
- 7. Cosmos DB: a poorly chosen partition key hits the 20 GB logical partition limit (unverified for current limits) plus RU hot partitions. Cross-partition queries burn RUs. 429s need SDK retry with `x-ms-retry-after-ms`.
- 11. GRS failover is customer-initiated, and data written after the last sync is lost (RPO ~15 min, unverified). RA-GRS reads can be stale.
- **Cosmos DB vNext emulator** (ARM64 OK): partition-key design, RU charge headers (emulator RU numbers are not production-accurate (unverified)), consistency levels are not meaningfully emulated, change feed.
- `bicep build` + `az deployment what-if` needs Azure (cloud-only). Offline: `bicep lint` and PSRule for Azure (unverified version).
- **Cannot prove locally:** Entra ID/RBAC propagation, Azure Policy evaluation (fallback: Policy definitions unit-tested with the community `AzPolicyTest`/PSRule (unverified), plus a sandbox subscription), Private Endpoint DNS, Front Door, failover.
- | Serverless containers | ECS on Fargate, App Runner (unverified current status) | Cloud Run (services, jobs, functions) | Container Apps (KEDA-based) | Containers (GA 2026-04-13) |
- | Streaming | Kinesis Data Streams, MSK | Pub/Sub, Managed Kafka | Event Hubs (Kafka API) | Pipelines (unverified) |
- | Data warehouse | Redshift, Athena | BigQuery | Synapse / Fabric | R2 SQL / Data Catalog (unverified) |
- | Secrets / keys | Secrets Manager, KMS, CloudHSM | Secret Manager, Cloud KMS | Key Vault, Managed HSM | Secrets Store (unverified) |
- Rows marked "(unverified)" are names the curriculum author must confirm before publishing. The table is a teaching scaffold, not a spec.

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
1. **Primary (Opus)** works on branch `track/azure` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(azure)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/azure.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/azure.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
