# Google Cloud Platform (GCP): Cloud Architecture & Systems Engineering

A comprehensive, mathematically and mechanically rigorous engineering curriculum covering Google Cloud resource governance, IAM inheritance and policy evaluation, global software-defined networking, Andromeda virtualization, Cloud Run serverless concurrency, Spanner TrueTime distributed transactions, Pub/Sub stream processing, BigQuery columnar storage and query execution, and Site Reliability Engineering (SRE) operations.

Verified against Google Cloud SDK (gcloud) 570.0.0, Terraform Google provider 6.72.0, `@google-cloud/pubsub 6.3.2`, and `@google-cloud/storage 8.4.0` on 2026-11-08.

---

## Curriculum Overview & Syllabus

1. [Module 01: Resource Hierarchy, Billing, and Org Policies](modules/01-resource-hierarchy-billing-and-org-policies.md) — Google Cloud resource hierarchy (Organization, Folders, Projects, Resources), Project IDs vs numbers vs display names, Cloud Billing accounts, budgets and alert limitations (alerts do not cap spend), Organizational Policy constraints (list, boolean, custom constraints), Essential Contacts, and labels vs tags (IAM-conditional resource tags).
2. [Module 02: IAM, Service Accounts, and Workload Identity](modules/02-iam-service-accounts-and-workload-identity.md) — IAM Allow policies and deterministic inheritance down the hierarchy, basic vs predefined vs custom roles, IAM Conditions, Deny policies and evaluation order (Deny trumps Allow), Principal Access Boundaries (PAB), Service Account architecture, SA keys vs SA impersonation, Service Agents, Workload Identity Federation (WIF) with GitLab/GitHub OIDC, and Workforce Identity Federation.
3. [Module 03: VPC Networking, Firewalls, and Hybrid Connectivity](modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md) — Global VPC topology, regional subnets, Andromeda SDN architecture, hierarchical firewall policies vs VPC firewall rules (priority evaluation 0–65535, network tags vs service account filtering), Shared VPC (Host and Service projects), VPC Network Peering limits and non-transitivity, Private Google Access, Private Service Connect (PSC), Cloud NAT static (default 64 ports/VM) vs dynamic (default 32 ports/VM) port allocation, Cloud DNS private/forwarding/peering zones, and Cloud Interconnect / Cloud VPN.
4. [Module 04: Load Balancing, Cloud Armor, and Edge](modules/04-load-balancing-cloud-armor-and-edge.md) — Google Front End (GFE) Anycast infrastructure, Global External Application Load Balancer (Envoy-based), Regional External and Internal Application Load Balancers, Network Load Balancers (passthrough), Serverless Network Endpoint Groups (NEGs), Cloud CDN caching and cache invalidation, Cloud Armor WAF and DDoS mitigation (rate limiting, adaptive protection), Identity-Aware Proxy (IAP) zero-trust access, and Certificate Manager.
5. [Module 05: Compute Engine, Cloud Run, and GKE](modules/05-compute-engine-cloud-run-and-gke.md) — Compute Engine machine families (general-purpose, compute-optimized, memory-optimized, accelerator-optimized), Managed Instance Groups (MIGs, regional distribution, autoscaling algorithms, autohealing health checks, rolling updates), Spot VMs and preemption mechanics, Cloud Run container architecture (request-based billing vs instance-based "CPU always allocated", concurrency configuration, min instances, jobs, functions), and GKE Autopilot vs Standard operational boundaries.
6. [Module 06: Storage, Cloud SQL, AlloyDB, Spanner, and Firestore](modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md) — Cloud Storage strong global consistency, storage classes (Standard, Nearline, Coldline, Archive), Autoclass lifecycle, uniform bucket-level access (UBLA), signed URLs (V4 signing), retention policies and Bucket Lock compliance, dual-region and multi-region turbo replication; Cloud SQL High Availability (regional persistent disk synchronous replication); AlloyDB columnar engine; Cloud Spanner distributed relational architecture (TrueTime GPS/atomic clocks, wait-out-uncertainty commit protocol, interleaved tables, and monotonically increasing key hotspotting); Firestore permanent database mode lock (Native mode vs Datastore mode); Bigtable row-key design; and Memorystore Redis/Valkey caching.
7. [Module 07: Pub/Sub, Eventarc, and BigQuery Architecture](modules/07-pubsub-eventarc-and-bigquery-architecture.md) — Cloud Pub/Sub distributed messaging architecture (topics, pull/push/BigQuery/Cloud Storage subscriptions, ack deadlines, redelivery storms, ordering keys and head-of-line blocking, exactly-once delivery option, dead-letter topics and seek/snapshots); Cloud Tasks rate-limiting and scheduled dispatch vs Pub/Sub; Eventarc event routing; Workflows orchestration; and BigQuery serverless data warehouse (Dremel execution engine, Capacitor columnar format, slots allocation, table partitioning and clustering, on-demand query byte billing mechanics and `maximum_bytes_billed` financial safeguards).
8. [Module 08: Observability, SRE, and VPC Service Controls](modules/08-observability-sre-and-vpc-service-controls.md) — Cloud Logging (log sinks, log buckets, exclusion filters, retention periods), Cloud Monitoring (metrics, alert policies, Service Level Objectives [SLOs], Service Level Indicators [SLIs], and Error Budgets), Cloud Trace and Cloud Profiler; Cloud Audit Logs (Admin Activity enabled by default, Data Access logs disabled by default except BigQuery); Security Command Center (SCC); VPC Service Controls (service perimeters, access levels, perimeter bridges, dry-run mode, and data exfiltration defense); Cloud Key Management Service (Cloud KMS, CMEK, Cloud HSM); and Secret Manager automated secret lifecycle.
9. [Module 09: PCA Architecture Case Studies and Disaster Recovery](modules/09-pca-architecture-case-studies-and-disaster-recovery.md) — Professional Cloud Architect (PCA) official case studies (Altostrat Media, Cymbal Retail, EHR Healthcare, KnightMotives Automotive), architectural trade-off analysis, Disaster Recovery patterns (Cold/Backup & Restore, Warm Standby, Hot Multi-Region Active-Active) with RPO and RTO mathematical derivations, Database Migration Service (DMS), Migration Center, and Anthos / Google Cloud hybrid topologies.
10. [Module 10: Cost Optimization, FinOps, and Version History](modules/10-cost-optimization-finops-and-version-history.md) — Google Cloud FinOps architecture, Cloud Billing export to BigQuery, Committed Use Discounts (CUDs: resource-based vs spend-based), Sustained Use Discounts (SUDs), Recommender API, BigQuery BI Engine reservation optimization, legacy GCR shutdown (writes stopped March 18, 2025; reads terminated May 20, 2025) and Artifact Registry migration, historical platform evolution table, and then-vs-now architectural transitions.

---

## Prerequisites

- Foundation knowledge from [`architecture/cloud-foundations`](../../architecture/cloud-foundations) (shared responsibility model, cloud economics, high availability primitives, multi-tenant boundaries).
- Foundation knowledge from [`architecture/networking`](../../architecture/networking) (IPv4/IPv6 CIDR, TCP/IP handshake, DNS resolution, BGP routing, Anycast, TLS 1.3).
- Foundation knowledge from [`architecture/security-identity`](../../architecture/security-identity) (cryptographic signing, asymmetric keys, OAuth 2.0 / OIDC tokens, RBAC vs ABAC).
- Foundation knowledge from [`architecture/distributed-systems`](../../architecture/distributed-systems) (consensus, Paxos/Raft, linearizability, clock skew, Vector Clocks, TrueTime).
- TypeScript & Modern Node.js (`node:test`, `fast-check`, asynchronous runtime concurrency).

---

## Runnable Verification Instructions

```bash
# Install pinned toolchain via mise
mise install

# Run deterministic simulation test suites
cd technologies/gcp
mise exec -- npm test

# Run static analysis and type checking
mise exec -- npm run typecheck
mise exec -- npm run lint
mise exec -- npm run fmt:check
```

---

## Certifications & Exams

This track prepares engineers for two primary Google Cloud certifications, mapping specific technical domains, architectural trade-offs, and service quotas to syllabus modules:

### 1. Google Cloud Certified Associate Cloud Engineer (ACE)

- **Exam Guide**: [Google Cloud Associate Cloud Engineer Official Exam Guide](https://cloud.google.com/learn/certification/cloud-engineer)
- **Format**: 50–60 multiple-choice and multiple-select questions; 2 hours duration; Pass/Fail score based on minimum scaled competency threshold.
- **Target Platform Version**: Current Google Cloud GA features and CLI commands.
- **Domain Weighting**:
  - Domain 1: Setting up a cloud solution environment (~20%)
  - Domain 2: Planning and implementing a cloud solution (~30%)
  - Domain 3: Ensuring successful operation of a cloud solution (~30%)
  - Domain 4: Configuring access and security (~20%)
- **Track Deliverable**: Full 65-question preparation question bank with full mock exam and domain-weighted scoring key in [`exams/ace.md`](exams/ace.md).

### 2. Google Cloud Certified Professional Cloud Architect (PCA)

- **Exam Guide**: [Google Cloud Professional Cloud Architect Official Exam Guide](https://cloud.google.com/learn/certification/cloud-architect)
- **Format**: 50–60 multiple-choice and multiple-select questions, including 20–30% scenario questions based on official case studies; 2 hours duration.
- **Target Platform Version**: Current Google Cloud Enterprise Architecture guidelines.
- **Official Case Studies**:
  - _Altostrat Media_: High-volume media streaming, global CDN caching, transcoding queues, and multi-region storage.
  - _Cymbal Retail_: Omnichannel retail migration, hybrid connectivity, inventory management on Spanner, and real-time analytics on BigQuery.
  - _EHR Healthcare_: Regulated HIPAA healthcare data, strict VPC Service Controls, CMEK encryption, and disaster recovery.
  - _KnightMotives Automotive_: Connected vehicle telematics, high-throughput streaming with Pub/Sub and Bigtable, and global low-latency APIs.
- **Domain Weighting**:
  - Domain 1: Designing and planning a cloud solution architecture (~25%)
  - Domain 2: Managing and provisioning a cloud solution infrastructure (~17.5%)
  - Domain 3: Designing for security and compliance (~17.5%)
  - Domain 4: Analyzing and optimizing technical and business processes (~15%)
  - Domain 5: Managing implementations of cloud architecture (~12.5%)
  - Domain 6: Ensuring solution and operations excellence (~12.5%)
- **Track Deliverable**: Full domain mapping matrix in [`exams/README.md`](exams/README.md) and extensive case-study walkthroughs and drill questions in [Module 09](modules/09-pca-architecture-case-studies-and-disaster-recovery.md).
