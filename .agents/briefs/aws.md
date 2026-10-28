# Brief: AWS (`technologies/aws`)

| | |
|---|---|
| Phase | 4 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/aws` · `../zto-aws` |
| Depends on | architecture/cloud-foundations |
| Research dossier | `.agents/research/F-cloud.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- LocalStack now requires an auth token and its free tier is non-commercial. Use moto as the token-free baseline; LocalStack tests skip without a token.
- DVA-C02 → DVA-C03 and SAP-C02 → SAP-C03 transitions: cover both, with an exam-delta callout.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- (see dossier "Overlaps / dedupe")

**Cross-link only (do not re-explain):**
- Cloud model, shared responsibility, IAM model, VPC/CIDR, storage classes, managed DBs, serverless, Well-Architected, FinOps → owned by `architecture/cloud-foundations`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### AWS — `technologies/aws`

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
- AWS CLI v2 (pin minor at authoring time; unverified exact, GitHub blocked)
- Source: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html. Third-party "SAA-C04" claims (e.g. cciedump.spoto.net) are **not** reflected on aws.amazon.com and should be treated as false/unverified.
- 5. An SQS visibility timeout shorter than the Lambda timeout × batch causes duplicate processing. AWS guidance: visibility timeout ≥ 6× function timeout (unverified current wording).
- 8. A DynamoDB hot partition: a low-cardinality partition key throttles even with on-demand capacity (per-partition limits; unverified current numbers).
- Lambda handler unit tests with Powertools idempotency against **DynamoDB Local** (Docker `amazon/dynamodb-local`, version unverified)
- Step Functions Local is legacy (unverified status). Prefer the TestState API or skip.
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
1. **Primary (Opus)** works on branch `track/aws` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(aws)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/aws.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/aws.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
