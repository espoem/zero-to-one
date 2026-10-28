# Brief: GCP (`technologies/gcp`)

| | |
|---|---|
| Phase | 4 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/gcp` · `../zto-gcp` |
| Depends on | architecture/cloud-foundations |
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
- (see dossier "Overlaps / dedupe")

**Cross-link only (do not re-explain):**
- Cloud model, shared responsibility, IAM model, VPC/CIDR, storage classes, managed DBs, serverless, Well-Architected, FinOps → owned by `architecture/cloud-foundations`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Google Cloud Platform — `technologies/gcp`

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
- 5. Cloud NAT port exhaustion (`min-ports-per-vm` default 64, unverified current default) under high-connection workloads causes silent outbound drops. Use dynamic port allocation.
- 12. Container Registry is shut down. Artifact Registry is required (unverified exact shutdown date, 2025: https://cloud.google.com/artifact-registry/docs/transition/transition-from-gcr).
- 13. Firestore in Datastore mode vs Native mode is a one-way per-database choice. The emulator does not enforce security rules identically to production (unverified).
- Pub/Sub emulator (beta): test ordering keys, ack deadline redelivery and DLQ. DLQ/filtering support in the emulator is partial (unverified), so mark DLQ tests "cloud-only" if unsupported.
- **Cloud Storage:** no official emulator. Use `fsouza/fake-gcs-server` (unverified version) or test against an abstraction.
- **Mise:** `gcloud` (pin; via the mise `gcloud` plugin, availability unverified), `java 21` (Firestore/Pub/Sub emulators need a JRE), `node 22`, `python 3.13`, `terraform 1.17.0`.
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
1. **Primary (Opus)** works on branch `track/gcp` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(gcp)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/gcp.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/gcp.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
