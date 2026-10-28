# Brief: Cloud Foundations (`architecture/cloud-foundations`)

| | |
|---|---|
| Phase | 4 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/cloud-foundations` · `../zto-cloud-foundations` |
| Depends on | phase 3 foundations |
| Research dossier | `.agents/research/F-cloud.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- None beyond the dossier and AGENTS.md.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Cloud model, shared responsibility, IAM model, VPC/CIDR, storage classes, managed DBs, serverless, Well-Architected, FinOps

**Cross-link only (do not re-explain):**
- TCP/IP, UDP, routing/BGP/anycast, NAT, DNS, congestion control → owned by `architecture/networking`
- OAuth 2.1, OIDC, PKCE, DPoP, JWT pitfalls, sessions/cookies, WebAuthn/passkeys → owned by `architecture/security-identity`
- Authorization models (RBAC/ABAC/ReBAC, Zanzibar, Cedar, OpenFGA) → owned by `architecture/security-identity`
- AWS-, GCP- and Azure-only semantics (IAM evaluation order, SCP/RCP, DynamoDB modelling, GCP hierarchy, Entra/ARM/Bicep) → owned by each provider track

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Cloud Foundations — `architecture/cloud-foundations`

- **Current stable version(s):** N/A (conceptual). Pinned tooling:
  - Terraform **1.17.0** (2026-10-21; adds GA Terraform Policy via `-policies`, `-minimal-refresh`, and `mock_provider` support for ephemeral resources). Sources: https://releases.hashicorp.com/terraform/, https://newreleases.io/project/github/hashicorp/terraform/release/v1.17.0
  - OpenTofu **1.13.2** (2026-10-21): https://releasealert.dev/github/opentofu/opentofu
  - Providers: `hashicorp/aws` **6.70.0** (2026-10-21, https://releasealert.dev/github/hashicorp/terraform-provider-aws), `hashicorp/google` **8.6.0** (2026-10-06), `hashicorp/azurerm` **5.11.0** (2026-10-23, https://registry.terraform.io/v1/providers/hashicorp/azurerm), `cloudflare/cloudflare` **5.28.1** (2026-10-20, https://registry.terraform.io/v1/providers/cloudflare/cloudflare)
  - OPA **1.20.1** (2026-08-28): https://github.com/open-policy-agent/opa/releases
  - Checkov **3.3.30** (PyPI)
  - Terraform Policy docs v0.5.x (HCL `policy`/`enforce` blocks, local `tfpolicy` CLI): https://docs.hashicorp.com/terraform/policy
- **Authoritative syllabi used:**
  - AWS Well-Architected (6 pillars incl. Sustainability): https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html
  - Google Cloud Well-Architected Framework: https://cloud.google.com/architecture/framework
  - Azure Well-Architected Framework: https://learn.microsoft.com/azure/well-architected/
  - NIST SP 800-145 (cloud definition) and SP 800-210 (access control for cloud)
  - FinOps Foundation framework: https://www.finops.org/framework/
  - The cert guides cited in each provider section; all their design domains are covered here neutrally.
- **Proposed modules:**
  1. **Cloud model and shared responsibility**
     - NIST 800-145 essential characteristics; IaaS/PaaS/FaaS/SaaS
     - Shared-responsibility line per service model
     - Regions, AZs and edge; blast radius
     - Control plane vs data plane (static stability)
     - Quotas vs limits
  2. **Resource hierarchy and governance**
     - Org/account/project/subscription as the isolation and billing boundary
     - Landing zones; tagging/labels strategy
     - Preventive vs detective guardrails (SCP / Org Policy / Azure Policy)
     - Policy inheritance; break-glass accounts
  3. **Identity and authorization models**
     - Principals, roles, policies; RBAC vs ABAC vs ReBAC
     - Policy evaluation (explicit deny wins), condition keys
     - Workload identity federation (OIDC from GitLab CI to cloud, no static keys)
     - Confused deputy and external IDs
     - Least privilege via access analysis
  4. **Virtual networking**
     - CIDR planning across environments and the overlap problem
     - Subnets and route tables; IGW/NAT; stateful vs stateless filtering
     - Private endpoints vs service endpoints
     - Peering non-transitivity; hub-spoke vs transit routers
     - Private DNS resolution; IPv6 dual-stack
  5. **Load balancing, edge and DNS**
     - L4 vs L7; anycast vs regional
     - Health checks and connection draining; TLS termination; mTLS
     - CDN cache keys
     - DNS failover and TTL realities; GSLB
  6. **Compute models**
     - VM/MIG/ASG autoscaling signals; containers (serverless containers vs managed K8s; cross-link to the K8s track)
     - FaaS lifecycle: cold start, concurrency model, init phase
     - Spot/preemptible interruption handling; Graviton/ARM economics
  7. **Storage classes and data durability**
     - Object (11×9s durability vs availability; strong read-after-write)
     - Lifecycle/tiering and minimum storage duration charges
     - Block (IOPS/throughput provisioning) vs file
     - Versioning, object lock/WORM, replication (CRR/turbo/GRS)
     - Encryption: SSE, CMK, envelope encryption
  8. **Managed databases**
     - Managed SQL HA (sync standby vs read replicas)
     - Failover and DNS TTL; backups/PITR, RPO/RTO math
     - Globally distributed SQL (Spanner/Aurora DSQL/Cosmos): TrueTime, consistency levels
     - Wide-column/document key design, hot partitions
     - Connection pooling for serverless (RDS Proxy/Hyperdrive/PgBouncer)
  9. **Messaging and event-driven integration**
     - Queues vs topics vs streams; delivery semantics (at-least-once, FIFO/ordering keys)
     - Visibility timeout / ack deadline; DLQs and poison messages
     - Idempotency keys; outbox; fan-out
     - Backpressure; EventBridge/Eventarc/Event Grid schemas (CloudEvents)
  10. **Serverless and durable workflows**
      - Function triggers; event source mappings and batching/partial-batch failure
      - Step Functions / Workflows / Durable Functions / Cloudflare Workflows: deterministic replay
      - Saga/compensation
      - Timeouts and retries composition (retry storms)
  11. **Resilience, DR and multi-region**
      - Failure domains; backup/pilot-light/warm-standby/active-active
      - Cell-based architecture; shuffle sharding
      - Chaos engineering (FIS/Chaos Studio)
      - Dependency on a single region's control plane (e.g. us-east-1 IAM/Route 53 control plane)
  12. **Security posture and compliance**
      - KMS key hierarchies; secrets rotation
      - Audit logs (management vs data events)
      - CSPM (Security Hub / SCC / Defender for Cloud); data perimeter
      - Policy-as-code (OPA/Conftest, Checkov, Terraform Policy)
      - Supply chain (image signing)
  13. **Observability and operations**
      - Metrics/logs/traces in each cloud (OTel cross-link)
      - SLOs and alerting; log cost control (sampling, retention, routing)
      - Runbooks; quota monitoring
  14. **Cost and FinOps**
      - Pricing dimensions (compute-seconds, requests, GB-month, egress, inter-AZ traffic, NAT processing)
      - Commitments (RI/SP/CUD)
      - Unit economics; tagging for showback
      - Anomaly detection; Well-Architected cost pillar
      - Egress-free alternatives (R2)
- **Gotchas & production failure modes:**
  1. Inter-AZ data transfer is billed on AWS and Azure (unverified per-GB rates; check the pricing page). Chatty microservices across AZs plus NAT data processing can exceed compute cost.
  2. Peering is non-transitive on all three clouds, so a hub without a transit router or NVA silently fails to route spoke-to-spoke.
  3. Overlapping CIDRs between environments or acquisitions block peering later. Plan an IPAM before the first VPC.
  4. Object storage "durability" is not "availability", and neither protects against `DELETE`. Without versioning plus object lock you have no backup.
  5. Lifecycle transitions to cold tiers have minimum storage durations and per-object transition fees. Millions of small objects make "archiving" more expensive than not archiving.
  6. Serverless plus a relational DB exhausts connections without a pooler (RDS Proxy, Hyperdrive, PgBouncer).
  7. Retries at every layer (SDK, LB, queue redelivery, client) multiply into retry storms. Use budgets and jitter, and retry only at one layer.
  8. Queue visibility timeout or ack deadline shorter than processing time causes duplicate processing. At-least-once delivery means consumers must be idempotent.
  9. DNS-based failover is bounded by client and resolver TTL caching (JVMs historically cached forever).
  10. Control-plane dependency during an incident: scaling or recovery that needs API calls fails when the control plane is degraded. Prefer statically stable designs.
  11. Long-lived static keys in CI are the #1 breach path. Use OIDC federation from GitLab (`id_tokens`) to AWS/GCP/Azure.
  12. Terraform `plan` against mocked providers proves nothing about IAM permissions, quota or eventual consistency (e.g. IAM propagation delay causing a first-apply failure).
  13. Tag-based cost allocation is not retroactive, and untagged resources pile up in "unallocated".
  14. Default log retention is often infinite or expensive (CloudWatch Logs never expires by default). Set retention in IaC.
- **Interview hot topics:**
  - Design a multi-account/project landing zone with guardrails
  - How cloud IAM evaluates a request (explicit deny, SCP/RCP intersection, resource policy)
  - Private connectivity to managed services without internet
  - RPO/RTO trade-offs and DR tiers
  - Queue vs stream vs pub/sub, and exactly-once myths
  - Cold starts and how to mitigate them
  - Multi-region active-active data consistency
  - Cost hot spots: NAT, egress, cross-AZ, logging
  - Keyless CI auth via OIDC
  - Shared responsibility for managed DBs
  - Well-Architected trade-off discussion
- **Executable-proof strategy:**
  - **Terraform-only proofs (no cloud account):**
    - `terraform test` with `mock_provider` blocks for aws/google/azurerm, asserting module outputs (e.g. CIDR splitting via `cidrsubnets`, tag propagation, naming).
    - Plan-JSON snapshot tests: `terraform plan -out` → `terraform show -json` → assert with OPA/Conftest Rego unit tests (`opa test`) or Terraform Policy (`tfpolicy`). Include negative fixtures: public bucket, `0.0.0.0/0` on 22, wildcard IAM action.
    - Checkov/Trivy config scanning as a second opinion.
  - **Pure-logic proofs:**
    - Python/TS property tests of an IAM-style policy evaluator (explicit-deny precedence, condition matching) to teach the algorithm. This mirrors AWS docs, not real AWS (label it).
    - CIDR allocator tests; retry/jitter and idempotency-key simulators against Redis via testcontainers.
  - **Messaging semantics:** run the same at-least-once consumer suite against three local brokers (LocalStack SQS or ElasticMQ, the GCP Pub/Sub emulator, the Azure Service Bus emulator) to show the semantic differences.
  - **Mise pins:**
    - `terraform = "1.17.0"`, `opentofu = "1.13.2"`, `opa = "1.20.1"`
    - `conftest` and `tflint`: latest at authoring time (unverified, GitHub API blocked in research env)
    - `python = "3.13"`, `node = "22"` (Wrangler requires Node ≥22)
  - **Cannot prove locally:**
    - Real IAM evaluation including SCP/RCP
    - Network reachability across peered VPCs
    - Latency, cross-AZ costs, quota and failover timings
    - Fallback: documented "cloud lab" scripts with budgets plus teardown (`terraform destroy` in an `always` CI step), run manually and kept out of CI.
- **Overlaps / dedupe:**
  - Terraform internals (state, locking, `moved`/`import`, test framework) → IaC/Terraform track; only use it here.
  - Kubernetes (EKS/GKE/AKS) → K8s track.
  - TCP/DNS/TLS/BGP → networking track.
  - Consistency/consensus → distributed-systems track.
  - OTel → observability track.
  - OAuth/OIDC/JWT → security track.

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

#### Context from `F-cloud.md`

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
- 1. Inter-AZ data transfer is billed on AWS and Azure (unverified per-GB rates; check the pricing page). Chatty microservices across AZs plus NAT data processing can exceed compute cost.
- `conftest` and `tflint`: latest at authoring time (unverified, GitHub API blocked in research env)
- | Serverless containers | ECS on Fargate, App Runner (unverified current status) | Cloud Run (services, jobs, functions) | Container Apps (KEDA-based) | Containers (GA 2026-04-13) |
- | Streaming | Kinesis Data Streams, MSK | Pub/Sub, Managed Kafka | Event Hubs (Kafka API) | Pipelines (unverified) |
- | Data warehouse | Redshift, Athena | BigQuery | Synapse / Fabric | R2 SQL / Data Catalog (unverified) |
- | Secrets / keys | Secrets Manager, KMS, CloudHSM | Secret Manager, Cloud KMS | Key Vault, Managed HSM | Secrets Store (unverified) |
- Rows marked "(unverified)" are names the curriculum author must confirm before publishing. The table is a teaching scaffold, not a spec.
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
1. **Primary (Opus)** works on branch `track/cloud-foundations` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(cloud-foundations)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/cloud-foundations.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/cloud-foundations.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
