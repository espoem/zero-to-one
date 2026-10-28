# F — Cloud tracks (AWS, GCP, Azure, Cloudflare)

Research date: 2026-10-28. Every version and exam fact below was checked against the cited URL on that date unless marked "(unverified)".

---

## 0. Design decision: one shared foundation track plus thin provider tracks

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

### 0.1 Concept to service mapping (core of the foundation track; becomes `architecture/cloud-foundations/MAPPING.md`)

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

### Cloud Foundations — `architecture/cloud-foundations`

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

### AWS — `technologies/aws`

- **Current stable version(s):**
  - Tooling pins:
    - AWS CLI v2 (pin minor at authoring time; unverified exact, GitHub blocked)
    - AWS SDK for JS v3 `@aws-sdk/client-s3` **3.1158.0** (npm, 2026-10-27)
    - Terraform AWS provider **6.70.0** (2026-10-21)
    - moto **5.2.5** (PyPI)
    - LocalStack Python CLI **2026.8.2** (PyPI; CalVer after the consolidation)
  - Recent platform features worth teaching (announced re:Invent 2025):
    - **Lambda durable functions** (checkpoint/replay, waits up to 1 year; Node 22/24, Python 3.13/3.14; Java preview, .NET GA July 2026)
    - **Lambda Managed Instances** (multi-concurrency on EC2, EC2 pricing + 15% fee, 14-day instance lifetime)
    - Source: https://builder.aws.com/content/3Khau5gTSwgQtIvpLKuytKkDkg2/lambda-in-2026-durable-functions-and-managed-instances-explained (community-authored on AWS Builder; cross-check the Lambda docs)
- **Authoritative syllabi used (verified on official AWS pages):**
  - **SAA-C03:** still current, no successor announced on the official page.

    | Domain | Weight |
    |---|---|
    | Design Secure Architectures | 30% |
    | Design Resilient Architectures | 26% |
    | Design High-Performing Architectures | 24% |
    | Design Cost-Optimized Architectures | 20% |

    Source: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html. Third-party "SAA-C04" claims (e.g. cciedump.spoto.net) are **not** reflected on aws.amazon.com and should be treated as false/unverified.
  - **Developer Associate: transition happening now.** DVA-C02 last test day is **2026-11-30**; **DVA-C03** registration opens **2026-12-01**.

    | DVA-C03 domain | Weight |
    |---|---|
    | Development with AWS Services | 30% |
    | Security | 26% |
    | Testing and Deployment | 22% |
    | Troubleshooting and Optimization | 22% |

    Source: https://docs.aws.amazon.com/aws-certification/latest/developer-associate-03/developer-associate-03.html. Target C03.
  - **SA Professional: transition happening now.** **SAP-C03** registration opened 2026-10-27, GA 2026-11-17; SAP-C02 last day 2026-11-16 (dates per https://tutorialsdojo.com/whats-new-with-the-aws-certified-solutions-architect-professional-sap-c03/; the official guide links a C02/C03 comparison page). 65 scored + 10 unscored questions, pass 720.

    | SAP-C03 domain | Weight |
    |---|---|
    | Architecture Design and Implementation Built for the Cloud | 25% |
    | Security, Compliance, and Governance | 25% |
    | Cost-Optimized Architecture Design | 15% |
    | Resilience, Migration, and Business Continuity | 15% |
    | Operational Excellence and Automation | 20% |

    Source: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-professional-03/solutions-architect-professional-03.html
  - AWS Well-Architected Framework and lenses (Serverless lens): https://docs.aws.amazon.com/wellarchitected/latest/framework/
  - IAM policy evaluation logic: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html
  - Amazon Builders' Library (static stability, timeouts/retries/backoff, shuffle sharding): https://aws.amazon.com/builders-library/
- **Proposed modules (assumes Cloud Foundations):**
  1. **Account and organization model**
     - Organizations, OUs, Control Tower landing zone
     - SCPs vs RCPs vs declarative policies
     - Delegated admin; root user hardening and centralized root access
  2. **IAM in depth**
     - Policy types (identity, resource, permission boundary, session, SCP/RCP) and the full evaluation flowchart
     - Cross-account `AssumeRole`, `sts:ExternalId`
     - `aws:PrincipalOrgID`, `aws:SourceArn`/`SourceAccount` (confused deputy)
     - IAM Access Analyzer (unused access, policy generation)
     - IAM Identity Center permission sets
     - GitLab OIDC → `AssumeRoleWithWebIdentity`
  3. **VPC and connectivity**
     - Subnet/AZ mapping
     - SG references vs CIDRs; NACL ephemeral ports
     - Gateway vs interface endpoints and endpoint policies
     - Transit Gateway route tables; PrivateLink provider/consumer
     - Route 53 Resolver endpoints and rules; CloudFront + OAC; Global Accelerator
  4. **Compute**
     - EC2 purchasing (On-Demand/SP/RI/Spot), ASG lifecycle hooks, warm pools; instance metadata IMDSv2
     - ECS vs EKS (cross-link), Fargate task networking (awsvpc), capacity providers
  5. **Lambda internals**
     - Firecracker microVMs; init/invoke/shutdown phases
     - Concurrency (reserved/provisioned), SnapStart
     - Event source mappings (SQS/Kinesis/DynamoDB Streams batching, `ReportBatchItemFailures`); async invocation retries and destinations
     - Durable functions; Managed Instances; Powertools for TypeScript/Python
  6. **Storage**
     - S3 consistency (strong read-after-write)
     - Request-rate scaling per prefix; storage classes and Intelligent-Tiering
     - Object Lock, replication (RTC)
     - Bucket policies vs ACLs (Object Ownership: bucket owner enforced), presigned URLs, multipart
     - S3 Express One Zone; EBS gp3/io2; EFS throughput modes
  7. **Databases**
     - RDS Multi-AZ (instance vs cluster); Aurora storage architecture (6-way quorum across 3 AZs) and Global Database; RDS Proxy
     - DynamoDB: partitions, single-table design, GSIs/LSIs, capacity modes, transactions, Streams, TTL, conditional writes
     - ElastiCache/MemoryDB (Valkey)
  8. **Integration and messaging**
     - SQS standard vs FIFO (message group ID, dedupe window), visibility timeout, redrive
     - SNS filtering and fan-out; EventBridge buses/rules/pipes/scheduler
     - Kinesis shards vs MSK; Step Functions Standard vs Express
  9. **Security and data protection**
     - KMS (key policies plus grants, multi-region keys), Secrets Manager rotation
     - CloudTrail (management vs data events, Lake)
     - GuardDuty, Security Hub, Macie
     - WAF/Shield; data perimeter patterns
  10. **Operations, deployment, cost and migration (SAP depth)**
      - CloudWatch (EMF, Logs Insights, alarms), X-Ray/ADOT
      - CloudFormation/CDK vs Terraform; CodeDeploy blue/green and canaries
      - Backup, DRS, multi-region DR patterns
      - Migration (7 Rs, MGN, DMS)
      - Cost Explorer, CUR 2.0, Compute Optimizer, Savings Plans
- **Gotchas & production failure modes:**
  1. An SCP/RCP deny overrides any admin policy. "AccessDenied even as admin" in a member account is usually an SCP. SCPs do not affect the management account.
  2. A resource policy plus a cross-account principal needs **both** sides to allow (except same-account cases).
  3. The S3 Block Public Access account setting overrides bucket policies. Conversely, disabling ACLs (bucket-owner-enforced) breaks legacy writers that set ACLs.
  4. A NAT Gateway per AZ costs per hour plus per GB processed. S3/DynamoDB traffic through NAT instead of free gateway endpoints is a classic bill shock.
  5. An SQS visibility timeout shorter than the Lambda timeout × batch causes duplicate processing. AWS guidance: visibility timeout ≥ 6× function timeout (unverified current wording).
  6. Without `ReportBatchItemFailures`, one bad SQS/Kinesis record retries the whole batch. On Kinesis it blocks the shard until the data expires.
  7. Lambda async invocation retries twice by default. Non-idempotent handlers double-charge.
  8. A DynamoDB hot partition: a low-cardinality partition key throttles even with on-demand capacity (per-partition limits; unverified current numbers).
  9. A DynamoDB `Scan` in a request path, plus GSI eventual consistency (no strongly consistent GSI reads).
  10. Lambda in a VPC needs NAT or endpoints for AWS APIs, and the "timeout calling STS/Secrets Manager" error is the symptom.
  11. RDS Multi-AZ failover changes the DNS target. Clients with cached IPs or long TTLs hang. Use RDS Proxy or a short TTL.
  12. IMDSv1 SSRF credential theft. Enforce IMDSv2 (`HttpTokens=required`, hop limit 1 vs containers needing 2).
  13. CloudWatch Logs default retention is "never expire", and high-cardinality custom metrics are a cost explosion.
  14. Route 53/IAM/CloudFront control planes are anchored in us-east-1. Recovery runbooks that need control-plane changes may fail during a us-east-1 event.
  15. KMS throttling (per-account request quotas) when every S3 GET decrypts with SSE-KMS. Use S3 Bucket Keys.
  16. Lambda durable functions replay: non-deterministic code outside steps (timestamps, random UUIDs) diverges on replay.
- **Interview hot topics:**
  - IAM evaluation logic end-to-end (with SCP/RCP/boundary)
  - Designing a multi-account network (TGW vs VPC sharing vs PrivateLink)
  - DynamoDB single-table design and access patterns
  - SQS + Lambda error handling and idempotency
  - Aurora vs RDS vs DynamoDB vs DSQL selection
  - S3 security (BPA, OAC, presigned URLs, Object Lock)
  - Cost optimisation of a NAT/egress-heavy workload
  - DR strategies with RPO/RTO numbers
  - Step Functions vs durable functions
  - Keyless GitLab → AWS deploys
- **Executable-proof strategy:**
  - **LocalStack licensing change (critical, verified):**
    - Community edition support ended **2026-03-23**. There is a single `localstack/localstack` image, and running it requires a **user account plus auth token** (`LOCALSTACK_AUTH_TOKEN`).
    - A free tier exists **for non-commercial use only** (including CI under the fair-use policy).
    - The OSS GitHub repo was archived 2026-03-23 (last OSS tag v4.14.0, 2026-02-26).
    - Sources: https://blog.localstack.cloud/2026-upcoming-pricing-changes/, https://blog.localstack.cloud/localstack-single-image-next-steps/, https://github.com/localstack/localstack/releases
    - Implication: a personal learning repo qualifies for the free non-commercial tier. Examples must read the token from env and **skip gracefully** when it is absent, and must never rely on `:latest` without a token.
    - Pinning old OSS tags (≤4.14) works offline but is frozen/unpatched. Acceptable only as a documented fallback.
  - **Primary deterministic layer: moto 5.2.5** (Apache-2.0, `mock_aws` decorator or `moto_server` for the JS SDK via endpoint override). Covers S3/SQS/SNS/DynamoDB/IAM (IAM policy *enforcement* is opt-in and partial).
  - **Suites:**
    - DynamoDB single-table access patterns plus conditional-write negative tests (`ConditionalCheckFailedException`)
    - SQS consumer idempotency with redelivery
    - S3 presigned URL expiry
    - Lambda handler unit tests with Powertools idempotency against **DynamoDB Local** (Docker `amazon/dynamodb-local`, version unverified)
    - Step Functions Local is legacy (unverified status). Prefer the TestState API or skip.
  - **IaC:**
    - `terraform test` with `mock_provider "aws"`
    - Plan JSON + Conftest policies (deny public S3, require IMDSv2, deny `*:*`)
    - `cdk synth` + `cdk-nag` snapshot if CDK is taught (optional)
  - **Cannot prove locally:**
    - Real IAM/SCP evaluation (fallback: IAM Policy Simulator API / Access Analyzer `ValidatePolicy` and `CheckNoNewAccess`, which need a real account but no resources)
    - VPC routing, PrivateLink, multi-AZ failover timing, Lambda cold starts and concurrency throttling, KMS quotas
    - Mark these as "cloud lab", with a budget alarm and destroy.
  - **Mise:** `python 3.13`, `node 22`, `terraform 1.17.0`, `awscli` (pin), `opa 1.20.1`, `uv` for moto/pytest.
- **Overlaps / dedupe:**
  - All concepts in the mapping table → Cloud Foundations.
  - EKS → K8s track.
  - CloudFormation vs Terraform comparison → IaC track.
  - DynamoDB data-modelling theory (partitioning) → NoSQL/data-modelling track if one exists; keep AWS specifics here.

---

### Google Cloud Platform — `technologies/gcp`

- **Current stable version(s):**
  - Google Cloud SDK (gcloud) **570.0.0** (installed in research env; pin at authoring time)
  - `hashicorp/google` provider **8.6.0** (2026-10-06)
  - `google-cloud-storage` (Python) **3.17.1**
  - `@google-cloud/pubsub` **5.x/6.3.1** (npm 6.3.1)
  - firebase-tools **15.34.1**
  - Emulators:
    - `gcloud emulators` GA: **firestore, spanner**
    - `gcloud beta emulators`: **bigtable, datastore, firestore, pubsub, spanner**
    - Source: https://docs.cloud.google.com/sdk/gcloud/reference/beta/emulators
    - Note: docs moved to the `docs.cloud.google.com` host.
- **Authoritative syllabi used:**
  - **Associate Cloud Engineer:**

    | Section | Weight |
    |---|---|
    | 1. Setting up a cloud solution environment | ~20% |
    | 2. Planning and implementing a cloud solution | ~30% |
    | 3. Ensuring successful operation | ~30% |
    | 4. Configuring access and security | ~20% |

    2 h, 50–60 questions, $125; renewal exam 1 h / 20 questions / $75. Sources: https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf, https://cloud.google.com/learn/certification/cloud-engineer
  - **Professional Cloud Architect:**

    | Section | Weight |
    |---|---|
    | 1. Designing and planning a cloud solution architecture | ~25% |
    | 2. Managing and provisioning infrastructure | ~17.5% |
    | 3. Designing for security and compliance | ~17.5% |
    | 4. Analyzing and optimizing technical and business processes | ~15% |
    | 5. Managing implementation | ~12.5% |
    | 6. Ensuring solution and operations excellence | ~12.5% |

    - 2 h, 50–60 questions, 2 case studies = 20–30% of questions.
    - **Current case studies: Altostrat Media, Cymbal Retail, EHR Healthcare, KnightMotives Automotive.**
    - Renewal exam: 1 h, 25 questions, **one generative-AI-aligned case study = 90–100% of questions**.
    - Sources: https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf, https://cloud.google.com/learn/certification/cloud-architect
  - Google Cloud Well-Architected Framework: https://cloud.google.com/architecture/framework
  - Google SRE books (SLOs, error budgets): https://sre.google/books/
  - Spanner TrueTime paper (OSDI 2012)
- **Proposed modules:**
  1. **Resource hierarchy and billing**
     - Org/folders/projects; project vs project number vs ID
     - Billing accounts and budgets (alerts do not cap spend)
     - Org Policy constraints and custom constraints; Essential Contacts
     - Labels vs tags (IAM-conditional tags)
  2. **IAM**
     - Allow policies and inheritance; basic vs predefined vs custom roles
     - Service accounts: keys vs impersonation vs attached SA
     - Service agents; IAM Conditions; Deny policies; Principal Access Boundary
     - Workload Identity Federation (GitLab OIDC); Workforce Identity Federation
  3. **VPC networking**
     - Global VPC / regional subnets; auto vs custom mode
     - Firewall rules vs network firewall policies (hierarchical), tags vs SA targets
     - Shared VPC host/service projects; VPC peering limits
     - Private Google Access, Private Service Connect; Cloud NAT port allocation
     - Cloud DNS private/forwarding/peering zones
  4. **Load balancing and edge**
     - Global external Application LB (Google Front End, anycast); regional vs cross-region internal LBs
     - Serverless NEGs; Cloud CDN, Cloud Armor
     - IAP; certificate manager
  5. **Compute**
     - Compute Engine machine families, MIGs (regional, autoscaling, autohealing, update policies), Spot VMs, sole tenancy
     - Cloud Run: request vs instance-based billing, concurrency, min instances, jobs, functions
     - GKE Autopilot vs Standard (cross-link to K8s)
  6. **Storage and databases**
     - Cloud Storage classes/Autoclass, uniform bucket-level access, signed URLs, retention/Bucket Lock, dual/multi-region and turbo replication
     - Cloud SQL HA (regional PD) vs AlloyDB vs Spanner (TrueTime, interleaving, hotspotting monotonically increasing keys)
     - Firestore (native vs Datastore mode); Bigtable row-key design
     - Memorystore
  7. **Data and messaging**
     - Pub/Sub (pull/push/BigQuery/Cloud Storage subscriptions, ack deadline, ordering keys, exactly-once delivery option, DLQ, seek/snapshot)
     - Cloud Tasks vs Pub/Sub; Eventarc; Workflows
     - BigQuery architecture (Dremel, slots, partitioning/clustering, on-demand vs editions)
     - Dataflow basics
  8. **Operations and security**
     - Cloud Logging (sinks, buckets, exclusions), Monitoring (SLOs), Trace; Cloud Audit Logs (Admin Activity vs Data Access off by default)
     - Security Command Center; VPC Service Controls perimeters
     - Cloud KMS/CMEK, Secret Manager; Binary Authorization; Artifact Registry
  9. **Architecture practice (PCA)**
     - Case-study walkthroughs for all four current studies
     - Migration (Migration Center, Database Migration Service)
     - DR patterns, cost (CUDs, SUDs, billing export to BigQuery), Infrastructure Manager vs Terraform
- **Gotchas & production failure modes:**
  1. Budgets only alert. They do not stop spend unless you wire Pub/Sub → a function that disables billing (and that is destructive).
  2. Data Access audit logs are off by default (except BigQuery), so a forensic gap is discovered only post-incident.
  3. The Compute Engine default service account historically had the project Editor role. Disable automatic grants via the org policy `iam.automaticIamGrantsForDefaultServiceAccounts`.
  4. Service-account keys are long-lived bearer credentials. Org policy `iam.disableServiceAccountKeyCreation`; use impersonation or WIF.
  5. Cloud NAT port exhaustion (`min-ports-per-vm` default 64, unverified current default) under high-connection workloads causes silent outbound drops. Use dynamic port allocation.
  6. VPC peering is non-transitive and peered VPC routes don't propagate custom routes unless import/export is enabled. GKE/Cloud SQL private services use peering, which consumes peering quota.
  7. Spanner/Bigtable hotspotting from monotonically increasing keys (timestamps, sequences). Use bit-reversed sequences / UUIDv4 / hash prefixes.
  8. A Pub/Sub ack deadline that is too short causes redelivery storms. Ordering keys plus a failed message block that key until it is resolved.
  9. Cloud Run with CPU allocated only during requests means background work after the response is throttled. Use instance-based billing ("CPU always allocated") for async work.
  10. BigQuery on-demand: `SELECT *` on an unpartitioned table bills every column scanned. `LIMIT` does not reduce bytes billed. Set `maximum_bytes_billed`.
  11. VPC Service Controls perimeters break Cloud Build, Console access or cross-project pipelines in non-obvious ways. Use dry-run mode first.
  12. Container Registry is shut down. Artifact Registry is required (unverified exact shutdown date, 2025: https://cloud.google.com/artifact-registry/docs/transition/transition-from-gcr).
  13. Firestore in Datastore mode vs Native mode is a one-way per-database choice. The emulator does not enforce security rules identically to production (unverified).
  14. Project deletion is soft for 30 days, but globally unique IDs cannot be reused, and bucket names are released unpredictably.
- **Interview hot topics:**
  - Resource hierarchy plus org policies for a regulated company
  - Shared VPC vs peering vs PSC
  - Cloud Run vs GKE vs Compute Engine selection
  - Spanner vs Cloud SQL vs AlloyDB vs Firestore
  - Pub/Sub delivery semantics and exactly-once
  - BigQuery cost control
  - VPC Service Controls for data exfiltration
  - Workload Identity (GKE) / WIF from GitLab
  - SRE: SLOs and error budgets
  - PCA case-study reasoning
- **Executable-proof strategy:**
  - **Emulators (all free, run locally or in Docker on a Mac):**
    - Pub/Sub emulator (beta): test ordering keys, ack deadline redelivery and DLQ. DLQ/filtering support in the emulator is partial (unverified), so mark DLQ tests "cloud-only" if unsupported.
    - Firestore emulator: CRUD, transactions, rule tests via `@firebase/rules-unit-testing`.
    - Spanner emulator (GA): schema/interleaving, transaction aborts, hotspot is NOT observable.
    - Bigtable emulator (beta): row-key range scans.
    - Datastore emulator.
  - **Cloud Storage:** no official emulator. Use `fsouza/fake-gcs-server` (unverified version) or test against an abstraction.
  - **IaC:** `terraform test` + `mock_provider "google"`; Conftest policies (no `allUsers` bindings, require uniform bucket-level access, no SA keys); `gcloud`-free plan JSON.
  - **Cannot prove locally:**
    - IAM (no local IAM evaluator; fallback: Policy Troubleshooter / Policy Simulator in a sandbox project)
    - VPC SC, Cloud NAT behaviour, global LB anycast, BigQuery (use a free-tier sandbox with `maximum_bytes_billed` guard and `--dry_run` byte estimates, which are deterministic for a fixed public dataset)
  - **Mise:** `gcloud` (pin; via the mise `gcloud` plugin, availability unverified), `java 21` (Firestore/Pub/Sub emulators need a JRE), `node 22`, `python 3.13`, `terraform 1.17.0`.
- **Overlaps / dedupe:**
  - Hierarchy/IAM/VPC concepts → Cloud Foundations.
  - GKE → K8s track.
  - BigQuery internals → data-engineering track if it exists; otherwise keep BigQuery to cost/partitioning here.
  - SRE practices → observability/SRE track.

---

### Azure — `technologies/azure`

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

### Cloudflare — `technologies/cloudflare`

- **Current stable version(s) (npm registry, 2026-10-28):**
  - **wrangler 4.154.0** (2026-10-27; engines `node >=22`)
  - **workerd 1.20261028.1**
  - **miniflare 4.20260730.0**
  - **@cloudflare/workers-types 5.20261028.1**
  - **@cloudflare/vite-plugin 1.65.0**
  - **Testing package changed: `@cloudflare/vitest-plugin` 1.4.9** (first published 2026-08-20; peer `vitest ^4.1.0 || ^5.0.0`) **replaces `@cloudflare/vitest-pool-workers`**. The latter is at 0.23.0 with peer `vitest ^4.1.0` only, so it is **incompatible with current vitest 5.0.5**. A codemod exists: `npx @cloudflare/codemods vitest:pool-workers-to-vitest-plugin`. Source: https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/
  - Terraform `cloudflare/cloudflare` **5.28.1** (2026-10-20). v5 is the Stainless-generated rewrite with breaking schema changes vs v4 (unverified detail).
  - **Platform status:**
    - **Workflows GA 2025-04-07** (https://developers.cloudflare.com/changelog/post/2025-04-07-workflows-ga/); jurisdiction-restricted Workflows (`eu`/`us`/`fedramp`) 2026-10-27, needs wrangler ≥4.152.0
    - **Containers and Sandboxes GA 2026-04-13** (https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/)
    - D1 undelete limited to 7 days (2026-10-23)
    - `workers-ai-provider` deprecated in favour of `createAI` (2026-10-21)
    - Source for the last three: https://developers.cloudflare.com/changelog/
  - **Pages → Workers:**
    - Pages is not formally deprecated, but Workers with Static Assets is the recommended target. Workers-only features: Vite plugin, gradual deployments, Workers Logs, Tail Workers, Cron, Queue consumers and more.
    - Migration: `pages_build_output_dir` → `assets.directory`, `not_found_handling`, `run_worker_first`, explicit `ASSETS` binding, `.assetsignore`, port 8788 → 8787.
    - Source: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- **Authoritative syllabi used:**
  - No Cloudflare certification is anchored here (none verified as current).
  - Official docs ToC:
    - Workers: https://developers.cloudflare.com/workers/
    - Durable Objects: https://developers.cloudflare.com/durable-objects/
    - KV: https://developers.cloudflare.com/kv/
    - R2, D1, Queues, Hyperdrive, Workflows
    - Cache: https://developers.cloudflare.com/cache/
    - Zero Trust: https://developers.cloudflare.com/cloudflare-one/
  - Limits page: https://developers.cloudflare.com/workers/platform/limits/
  - workerd design docs (GitHub `cloudflare/workerd`)
  - Cloudflare blog posts on isolates ("Cloud Computing without Containers") and on Durable Objects / SQLite-in-DO (unverified URLs; cite at authoring)
  - Hono docs (common framework)
- **Proposed modules:**
  1. **Edge model and request lifecycle**
     - Anycast; PoP → Worker routing (routes vs custom domains vs `workers.dev`)
     - Order of products (WAF → cache → Worker, configurable)
     - `fetch` handler, `ctx.waitUntil`, `passThroughOnException`
     - Smart Placement
  2. **Runtime internals**
     - V8 isolates vs containers/microVMs (no cold-start VM boot, shared process, memory 128 MB per isolate)
     - workerd architecture (nanoservices, capability-based bindings)
     - Compatibility dates and flags; `nodejs_compat`
     - CPU-time vs wall-time accounting
     - Spectre mitigations (timer coarsening, no multithreading)
  3. **Tooling and configuration**
     - `wrangler.jsonc`; environments; secrets (`.dev.vars`)
     - Bindings as capabilities; type generation (`wrangler types`)
     - Vite plugin; local vs remote bindings in dev
     - Gradual deployments/versions; Workers Builds; Terraform provider v5
  4. **Caching and CDN**
     - Cache keys, Cache Rules, Tiered Cache, `cache-control`/`CDN-Cache-Control`
     - Cache API (per-colo, not global); purge semantics
     - `cf` fetch options; stale-while-revalidate; Early Hints
  5. **Workers KV**
     - Eventually consistent global store; central stores plus edge caching
     - `cacheTtl` (default 60 s), up to 60 s+ propagation, negative-lookup caching
     - Per-key write-rate guidance; list pagination; metadata; use cases vs anti-patterns
  6. **Durable Objects**
     - Single-threaded actor per ID; global uniqueness; input/output gates
     - SQLite storage backend vs KV backend; transactional storage; Point-in-Time Recovery
     - Alarms; WebSocket Hibernation API
     - Location hints and jurisdictions; RPC; sharding patterns; eviction behaviour
  7. **D1 and Hyperdrive**
     - D1 = SQLite per database (size limits, single-writer primary, read replication / Sessions API for sequential consistency), migrations, Time Travel
     - Hyperdrive = connection pooling plus query caching to external Postgres/MySQL; `pg`/`postgres.js` in Workers
  8. **R2 and object workflows**
     - S3-compatible API subset; no egress fees
     - Presigned URLs; multipart; event notifications → Queues
     - Lifecycle rules, Infrequent Access class
     - Public buckets vs custom domains; data catalog (unverified)
  9. **Queues and Workflows**
     - Queues at-least-once delivery, batching, retries/DLQ, consumer concurrency, pull consumers
     - Workflows: durable steps (`step.do`, `step.sleep`, `step.waitForEvent`), retry config, idempotency inside steps, built on Durable Objects
     - Cron Triggers
  10. **Service composition**
      - Service bindings and RPC (`WorkerEntrypoint`); Tail Workers
      - Workers for Platforms (dispatch namespaces)
      - Containers (Durable Object–fronted containers, GA); Workers AI / AI Gateway / Agents SDK (brief)
  11. **Security and Zero Trust**
      - WAF, rate limiting, Turnstile, mTLS, API Shield
      - Cloudflare One: Access (identity-aware proxy, service tokens, JWT validation `Cf-Access-Jwt-Assertion`), Tunnel (`cloudflared`), Gateway, WARP
      - Secrets handling
  12. **Observability, limits and cost**
      - Workers Logs, Logpush, tail, source maps, OTel spans
      - Limits (Free 10 ms CPU, Paid up to 5 min CPU (default 30 s), 128 MB, subrequests 50 vs 10k, 64 MiB script, 1 s startup)
      - Pricing model (requests + CPU ms, DO duration/requests/storage)
      - Pages → Workers migration playbook
- **Gotchas & production failure modes:**
  1. KV is eventually consistent, so read-after-write from another PoP can be stale for ≥60 s. Missing keys are negatively cached too, so "create then read elsewhere" fails. Never use KV for counters, locks or sessions that need consistency. Use DOs.
  2. KV per-key write rate: hot-key writes (tens to hundreds per second) get rate-limited (https://developers.cloudflare.com/kv/concepts/how-kv-works/).
  3. Global mutable state in module scope leaks across requests in the same isolate (cross-tenant data bleed). Isolates are reused, but you can't rely on reuse for caching.
  4. Unawaited promises: work not `await`ed or passed to `ctx.waitUntil()` is cancelled when the response returns. `waitUntil` is capped at 30 s after the response.
  5. A CPU-time limit exceeded (Free 10 ms) gives Error 1102. Memory >128 MB per isolate, also 1102. Large JSON parsing / Zod <4.5 schemas inflate memory (the limits page explicitly recommends Zod ≥4.5.0).
  6. A Durable Object is single-threaded per ID. Funnelling all traffic through one global DO (e.g. "rate limiter" ID) creates a global bottleneck (~1k req/s per DO order of magnitude, unverified). Shard by key.
  7. DO input gates are released while awaiting `fetch()` to external services, so interleaving can occur. Read-modify-write across an external `await` is not atomic.
  8. Durable Object migrations (`new_sqlite_classes`, renames, deletes) are declarative in wrangler config. Deleting a class migration destroys data. KV-backed DOs can't be converted to SQLite in place (unverified current status).
  9. The Cache API is per data center and not purged globally by `cache.delete`. `fetch` with `cf.cacheTtl` behaves differently from Cache Rules. Workers on `workers.dev` don't use the zone cache.
  10. The `compatibility_date` freezes runtime behaviour. Bumping it can change semantics (e.g. `nodejs_compat` polyfills, formData parsing). Treat it as a migration.
  11. Six simultaneous outbound connections waiting for headers per invocation. Fan-out beyond this queues silently and adds latency.
  12. Queues are at-least-once, so consumers must be idempotent. Unacked messages in a batch retry the whole batch unless you use per-message `ack()`/`retry()`.
  13. Workflows replay: code outside `step.do` re-executes on every resume. Non-deterministic values must be produced inside steps. Step return values must be serialisable and are size-limited.
  14. D1 is single-primary. Without the Sessions API/bookmarks, read replicas may serve stale reads after writes. Large migrations can time out.
  15. Local vs prod drift: miniflare simulates KV/DO/D1 locally with **strong** consistency and no PoP distribution. Tests passing locally do not prove KV staleness handling.
  16. `vitest-pool-workers` (0.x) vs the new `@cloudflare/vitest-plugin` (1.x): mixing them, or upgrading vitest to 5 with pool-workers, breaks the suite.
  17. Workers custom domains require the zone on Cloudflare nameservers. Pages allowed external-DNS custom domains, which blocks some Pages → Workers migrations.
- **Interview hot topics:**
  - Isolates vs containers vs microVMs (cold start, multi-tenancy, security)
  - KV vs DO vs D1 vs R2 selection by consistency/latency
  - Designing a rate limiter / collaborative doc with Durable Objects (sharding, hibernating WebSockets)
  - Edge caching strategy and cache-key design
  - `waitUntil` and the request lifecycle
  - Durable execution (Workflows) vs Queues
  - Connecting to a regional Postgres from the edge (Hyperdrive, Smart Placement)
  - Zero Trust access in front of internal apps (Access + Tunnel)
  - Cost/limits reasoning (CPU-ms billing)
  - Pages → Workers migration
- **Executable-proof strategy (Cloudflare is the most locally provable of the four):**
  - **Primary harness:** `@cloudflare/vitest-plugin` 1.4.9 + `vitest` (4.1.x or 5.x) runs tests **inside workerd** via miniflare, with per-test-file isolated storage. Deterministic suites:
    - KV CRUD + `list` pagination
    - DO counter with concurrent requests proving serialisation; DO alarm firing via `runDurableObjectAlarm` (unverified helper name in the plugin API)
    - DO SQLite transactions and rollback (negative test)
    - D1 migrations + constraint-violation negative test
    - R2 multipart + presigned flow
    - Queues consumer with `retry()` → DLQ
    - Workflows step retries (local Workflows support in miniflare: unverified depth)
    - Outbound `fetch` mocking via `@msw/cloudflare` (per the migration guide)
  - **Integration:** `wrangler dev` (local mode, port 8787) + Playwright/`fetch` smoke tests; `unstable_startWorker`/`getPlatformProxy` from wrangler for Node-side tests (unverified current API names).
  - **Static checks:** `wrangler types` diff test (generated `worker-configuration.d.ts` committed, CI fails on drift); `wrangler deploy --dry-run --outdir` bundle-size budget test (assert < limit); `tsc --noEmit` against `@cloudflare/workers-types`.
  - **Cannot prove locally:**
    - Global KV propagation delay: simulate with a fake KV wrapper that injects staleness, and label it a model, not proof.
    - Anycast/PoP behaviour, Cache Rules/Tiered Cache, WAF/Zero Trust Access policies, DO placement/latency, real CPU-limit enforcement (local workerd does not enforce production CPU limits (unverified)).
    - Fallback: a free-tier account "lab" with `wrangler deploy` to `workers.dev` and scripted `curl` assertions, kept out of CI.
  - **Mise:** `node = "22"` (wrangler ≥22), npm deps pinned exactly (`wrangler@4.154.0`, `@cloudflare/vitest-plugin@1.4.9`, `vitest@5.0.5` or `4.1.x`), `terraform 1.17.0` for the provider examples, `cloudflared` (pin, unverified version).
- **Overlaps / dedupe:**
  - CDN/HTTP caching semantics (RFC 9111) → web/HTTP track.
  - Actor model and consistency theory → distributed-systems track.
  - SQLite internals → databases track.
  - S3 API semantics → Cloud Foundations storage module.
  - Zero Trust/OIDC/JWT validation → security track.
  - Queue semantics → Cloud Foundations messaging module.
  - Keep only Cloudflare-specific runtime, limits and APIs here.

---

## Surprises / flags for the curriculum owner
1. **LocalStack is no longer free-and-anonymous.** Since 2026-03-23 it needs an account plus auth token, the free tier is non-commercial only, and the OSS repo is archived. Use moto as the token-free baseline.
2. **AZ-204 is retired** (2026-07-31), replaced by **AI-200** (AI-heavy). AZ-104 and AZ-305 are current (skills dated 2026-04-17).
3. **AWS is in the middle of a version transition:** DVA-C02 → **DVA-C03** (C02 last day 2026-11-30) and SAP-C02 → **SAP-C03** (GA 2026-11-17). **SAA-C03 is still current**; "SAA-C04" claims online are unverified third-party noise.
4. **GCP PCA case studies have changed** (Altostrat Media, Cymbal Retail, EHR Healthcare, KnightMotives Automotive), and the PCA renewal exam is generative-AI case-study based.
5. **Cloudflare testing package renamed:** `@cloudflare/vitest-plugin` replaces `vitest-pool-workers`, and the old package doesn't support vitest 5.
6. **Terraform 1.17.0 (2026-10-21)** makes Terraform Policy GA (`-policies`), a native HCL policy-as-code alternative to Conftest/OPA worth one module example.
7. Azure VNets created after 2026-03-31 have no default outbound internet (secondary-source date; confirm).
