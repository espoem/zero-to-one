# Cloud Foundations Architecture Curriculum

Comprehensive, vendor-neutral cloud systems architecture curriculum covering foundational mechanics, multi-cloud abstractions, distributed governance, IAM, virtual networking, reliability, Well-Architected frameworks, and FinOps.

Verified against AWS, Google Cloud, Microsoft Azure, Cloudflare, Terraform 1.17.0, and Open Policy Agent (OPA) 1.20.1 on 2026-11-07.

## Curriculum Syllabus

The curriculum spans 14 self-contained modules in [`modules/`](./modules/):

1. **[01. Cloud Model & Shared Responsibility](./modules/01-cloud-model-and-shared-responsibility.md)**: NIST SP 800-145 essential characteristics; IaaS, PaaS, FaaS, SaaS boundaries; failure domains (regions, AZs, edge); static stability mechanics; control plane vs data plane separation.
2. **[02. Resource Hierarchy & Governance](./modules/02-resource-hierarchy-and-governance.md)**: Multi-account isolation boundaries; landing zones; preventive vs detective guardrails; Service Control Policies (SCPs); break-glass emergency accounts.
3. **[03. Identity & Authorization Models](./modules/03-identity-and-authorization-models.md)**: Formal IAM policy evaluation algebra; explicit deny precedence; ABAC tag conditions; Workload Identity Federation (OIDC without static API keys); confused deputy defense.
4. **[04. Virtual Networking & CIDR Planning](./modules/04-virtual-networking.md)**: RFC 1918 CIDR subnetting; route tables; IGW and NAT gateways; stateful security groups vs stateless NACLs; private endpoints (PrivateLink / PSC); VPC peering non-transitivity.
5. **[05. Load Balancing, Edge & DNS](./modules/05-load-balancing-edge-and-dns.md)**: Layer 4 vs Layer 7 load balancing; Anycast routing; health checks and connection draining; CDN cache keys; DNS failover and TTL caching realities.
6. **[06. Compute Models & Elasticity](./modules/06-compute-models.md)**: Virtual machines, autoscaling signals, and scale-in protection; serverless containers vs managed Kubernetes; FaaS lifecycle, cold starts, and init phases; Spot and preemptible interruption handling.
7. **[07. Storage Classes & Data Durability](./modules/07-storage-classes-and-durability.md)**: Object storage 11×9s durability vs availability; lifecycle tiering rules and minimum retention penalties; block vs file storage; versioning, Object Lock (WORM), and envelope encryption.
8. **[08. Managed Databases & Availability](./modules/08-managed-databases.md)**: Synchronous multi-AZ standbys vs asynchronous read replicas; RPO and RTO mathematical derivations; globally distributed SQL (Spanner TrueTime, Cosmos DB consistency); serverless connection poolers.
9. **[09. Messaging & Event-Driven Integration](./modules/09-messaging-and-event-driven-integration.md)**: Queues, topics, and event streams; at-least-once delivery; visibility timeouts and dead-letter queues (DLQs); outbox pattern and consumer idempotency keys; CloudEvents standard.
10. **[10. Serverless & Durable Workflows](./modules/10-serverless-and-durable-workflows.md)**: Event source mappings and partial-batch failures; orchestrator state machines (Step Functions, Workflows); distributed Saga pattern with compensating transactions; exponential backoff with full jitter against retry storms.
11. **[11. Resilience, Disaster Recovery & Multi-Region](./modules/11-resilience-dr-and-multi-region.md)**: Disaster recovery tiers (Backup & Restore, Pilot Light, Warm Standby, Active-Active); cell-based architectures; shuffle sharding mathematical blast radius containment; chaos engineering.
12. **[12. Security Posture & Compliance](./modules/12-security-posture-and-compliance.md)**: KMS key hierarchies, envelope encryption, and HSMs; audit logging (management vs data events); cloud security posture management (CSPM); policy-as-code guardrails (OPA/Rego, Terraform Policy).
13. **[13. Observability & SRE Operations](./modules/13-observability-and-operations.md)**: Multi-cloud telemetry aggregation; Service Level Indicators (SLIs), Service Level Objectives (SLOs), and error budgets; multi-window multi-burn-rate alerting; log retention optimization and quota monitoring.
14. **[14. Cost Engineering & FinOps](./modules/14-cost-and-finops.md)**: Cloud pricing dimensions (compute-seconds, egress, cross-AZ data transfer, NAT gateway processing); commitment vehicles (Savings Plans, Reserved Instances, CUDs); unit economics; showback and chargeback models.

## Concept-to-Service Mapping

For an exhaustive cross-cloud service comparison mapping vendor-neutral primitives to AWS, Google Cloud, Microsoft Azure, and Cloudflare, see **[MAPPING.md](./MAPPING.md)**.

## Certifications & Exams

This foundation track covers the provider-neutral architecture core of the following leading cloud certifications and technical interview formats:

| Certification / Exam | Vendor / Foundation | Official Exam Guide | Target Product Version | Format & Duration |
| :-- | :-- | :-- | :-- | :-- |
| **AWS Solutions Architect - Associate (SAA-C03)** | Amazon Web Services | [Official SAA-C03 Guide](https://aws.amazon.com/certification/certified-solutions-architect-associate/) | Current AWS Services | 65 Questions (Multiple choice / Multiple response), 130 minutes |
| **AWS Solutions Architect - Professional (SAP-C03)** | Amazon Web Services | [Official SAP-C03 Guide](https://aws.amazon.com/certification/certified-solutions-architect-professional/) | Current AWS Services | 75 Questions (Complex scenario-based), 180 minutes |
| **Google Professional Cloud Architect (PCA)** | Google Cloud | [Official PCA Guide](https://cloud.google.com/learn/certification/cloud-architect) | Current Google Cloud Platform | 50–60 Questions (Multiple choice + Case studies), 120 minutes |
| **Microsoft Certified: Azure Solutions Architect Expert (AZ-305)** | Microsoft Azure | [Official AZ-305 Guide](https://learn.microsoft.com/credentials/certifications/azure-solutions-architect/) | Current Microsoft Azure | 40–60 Questions (Case studies, multi-select), 120 minutes |
| **FinOps Certified Practitioner (FOCP)** | FinOps Foundation | [Official FOCP Guide](https://www.finops.org/certification/) | FinOps Framework v2026 | 50 Questions (Multiple choice), 60 minutes |
| **Principal / Staff Cloud Architecture Interview** | Industry Standard | Multi-region system design and trade-off loop | Cloud Agnostic | 60-minute interactive architecture whiteboard round |

For the complete domain-to-module coverage matrix and practice question banks with comprehensive explanations and mock exams, see **[exams/README.md](./exams/README.md)**.

## Executable Proofs & Tests

All architecture algorithms, IAM evaluation semantics, CIDR allocators, and FinOps models are verified through deterministic TypeScript test suites in [`examples/`](./examples/).

Run all test suites locally:

```bash
mise exec -- npm test
```

Run static type checking and linters:

```bash
mise exec -- npm run typecheck
mise exec -- npm run lint
```
