# GCP Certification & Exam Coverage Matrix

This directory contains the certification and exam coverage matrices, question banks, and mock exams for the two primary Google Cloud certifications covered by the `technologies/gcp` track:

1. **Google Cloud Certified Associate Cloud Engineer (ACE)**
2. **Google Cloud Certified Professional Cloud Architect (PCA)**

---

## 1. Google Cloud Certified Associate Cloud Engineer (ACE) Coverage Matrix

| Domain & Technical Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Section 1: Setting up a cloud solution environment**<br>Setting up Cloud projects and accounts (resource hierarchy, billing accounts, budgets, alert notifications); managing billing configuration; and installing and configuring the Google Cloud SDK (`gcloud` init, configurations, components). | ~20% | Modules 01, 02 | `examples/01-resource-hierarchy-and-iam.test.ts` | ✅ full |
| **Section 2: Planning and implementing a cloud solution**<br>Planning and estimating GCP products with the Pricing Calculator; planning and configuring Compute Engine resources (machine types, MIGs, Spot VMs); planning and configuring Google Kubernetes Engine (GKE Autopilot vs Standard); planning and configuring Cloud Run containerized workloads; and configuring Cloud Storage buckets and database instances (Cloud SQL, Firestore, Bigtable, Spanner). | ~30% | Modules 04, 05, 06, 07 | `examples/03-storage-and-spanner.test.ts`, `examples/04-pubsub-messaging.test.ts` | ✅ full |
| **Section 3: Ensuring successful operation of a cloud solution**<br>Managing Compute Engine instances, disks, and snapshots; managing GKE clusters and workloads; managing Cloud Run services and jobs; managing Cloud Storage lifecycle rules and bucket policies; managing Cloud SQL and Spanner instances; and monitoring and logging with Google Cloud Observability (Cloud Logging sinks, Cloud Monitoring alerts, metrics explorer). | ~30% | Modules 03, 05, 06, 08 | `examples/02-vpc-firewall-and-nat.test.ts`, `examples/05-bigquery-and-cloudrun.test.ts` | ✅ full |
| **Section 4: Configuring access and security**<br>Managing Identity and Access Management (IAM): viewing role assignments, assigning IAM roles to accounts and service accounts, creating custom IAM roles; managing service accounts (scopes, impersonation, key policies); and managing networking configuration (firewall rules, network tags, service account targets, VPC peering, Shared VPC, Private Google Access, and Cloud NAT). | ~20% | Modules 01, 02, 03, 08 | `examples/01-resource-hierarchy-and-iam.test.ts`, `examples/02-vpc-firewall-and-nat.test.ts` | ✅ full |

---

## 2. Google Cloud Certified Professional Cloud Architect (PCA) Coverage Matrix

| Domain & Enterprise Architecture Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Section 1: Designing and planning a cloud solution architecture**<br>Designing scalable, reliable, and highly available infrastructure; designing microservices and container networking; designing secure data storage systems (Cloud Storage, Spanner TrueTime, Bigtable); and designing hybrid connectivity and network topologies (Shared VPC, Cloud Interconnect, PSC, Anycast Global External Application Load Balancers). | ~25% | Modules 03, 04, 05, 06, 07 | `examples/02-vpc-firewall-and-nat.test.ts`, `examples/03-storage-and-spanner.test.ts` | ✅ full |
| **Section 2: Managing and provisioning a cloud solution infrastructure**<br>Configuring multi-region computing resources; managing automated scaling and self-healing (MIGs, Cloud Run); configuring storage and database instances for enterprise workloads; and managing infrastructure as code with Terraform and Infrastructure Manager. | ~17.5% | Modules 01, 04, 05, 06 | `examples/03-storage-and-spanner.test.ts`, `examples/05-bigquery-and-cloudrun.test.ts` | ✅ full |
| **Section 3: Designing for security and compliance**<br>Designing for security governance (Org Policies, Essential Contacts); designing IAM access and identity perimeters (IAM Conditions, Deny policies, Principal Access Boundaries, Workload Identity Federation); data encryption and key management (Cloud KMS, CMEK, Cloud HSM); and data exfiltration mitigation with VPC Service Controls. | ~17.5% | Modules 01, 02, 08 | `examples/01-resource-hierarchy-and-iam.test.ts`, `technologies/gcp/modules/08-observability-sre-and-vpc-service-controls.md` | ✅ full |
| **Section 4: Analyzing and optimizing technical and business processes**<br>Analyzing software development lifecycle (SDLC) pipelines and binary authorization; analyzing disaster recovery strategies (RPO, RTO, cold/warm/hot active-active topologies); designing data pipelines with Pub/Sub and BigQuery; and business process optimization through Google Cloud FinOps (CUDs, SUDs, BigQuery billing exports). | ~15% | Modules 07, 09, 10 | `examples/04-pubsub-messaging.test.ts`, `examples/05-bigquery-and-cloudrun.test.ts`, `technologies/gcp/modules/09-pca-architecture-case-studies-and-disaster-recovery.md` | ✅ full |
| **Section 5: Managing implementations of cloud architecture**<br>Advising development and operational teams; managing workload migration using Database Migration Service (DMS) and Migration Center; and architecting multi-cloud or hybrid environments using Google Cloud Anthos. | ~12.5% | Modules 01, 03, 09 | `technologies/gcp/modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md`, `technologies/gcp/modules/09-pca-architecture-case-studies-and-disaster-recovery.md` | ✅ full |
| **Section 6: Ensuring solution and operations excellence**<br>Site Reliability Engineering (SRE) practices; defining Service Level Indicators (SLIs), Service Level Objectives (SLOs), and Error Budgets; designing distributed tracing and logging architectures; and incident response and post-mortem workflows. | ~12.5% | Modules 08, 09 | `technologies/gcp/modules/08-observability-sre-and-vpc-service-controls.md`, `technologies/gcp/modules/09-pca-architecture-case-studies-and-disaster-recovery.md` | ✅ full |

---

## 3. Official PCA Case Studies Coverage

The Professional Cloud Architect exam includes 20–30% scenario questions based on four canonical Google Cloud case studies. Each is analyzed in depth with end-to-end reference architectures in [Module 09](../modules/09-pca-architecture-case-studies-and-disaster-recovery.md):

1. **Altostrat Media**: Global media streaming platform. Solution architecture leverages Cloud Storage multi-region buckets, Cloud CDN Anycast caching, Pub/Sub transcoding pipelines, Cloud Run worker autoscaling, and Cloud Armor WAF rate-limiting.
2. **Cymbal Retail**: Omnichannel retail enterprise migrating from legacy data centers. Architecture utilizes Dedicated Cloud Interconnect, Shared VPC with host/service project separation, Cloud Spanner for globally consistent inventory tracking, and BigQuery for real-time basket analysis.
3. **EHR Healthcare**: HIPAA-compliant healthcare data exchange. Architecture enforces strict VPC Service Controls perimeters around BigQuery and Cloud Storage, Customer-Managed Encryption Keys (CMEK), Cloud Audit Logging with zero retention exclusions, and multi-region warm standby disaster recovery.
4. **KnightMotives Automotive**: Global connected vehicle telemetry platform. Architecture processes millions of events per second with Cloud Pub/Sub ordering keys, Cloud Bigtable wide-column time-series storage, Cloud Dataflow windowing pipelines, and private GKE clusters.

---

## 4. Question Bank Inventory

- **ACE Question Bank**: [`ace.md`](ace.md) — 65 scenario-based, single-choice, and multiple-select questions covering all 4 Associate Cloud Engineer domains, complete 65-question mock exam with official domain weighting and scoring key, formatted to `AGENTS.md` specifications with full distractor rationales and module citations.
- **PCA Exam Coverage**: PCA domain objectives and the four case studies are taught across all 10 core syllabus modules, analyzed in detail in [Module 09](../modules/09-pca-architecture-case-studies-and-disaster-recovery.md), and evaluated through 100 scenario-based Interview Drill questions across the syllabus and executable simulation proofs in `examples/`.
