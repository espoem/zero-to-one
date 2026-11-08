# Cloud Foundations Certification & Exam Coverage Matrix

This matrix maps foundational cloud architecture domains across AWS Solutions Architect (SAA/SAP), Google Professional Cloud Architect (PCA), Microsoft Azure Solutions Architect (AZ-305), and FinOps Certified Practitioner (FOCP) to the teaching modules and executable test suites in this track.

## Comprehensive Domain Coverage Matrix

| Exam / Domain | Objective & Capability | Official Weight | Mapped Modules | Verified Examples & Proofs | Status |
| :-- | :-- | :-: | :-- | :-- | :-: |
| **Domain 1: Resilient & Multi-AZ Architectures** | High-availability design, fault domains, static stability, AZ isolation, cell-based systems, shuffle sharding, control/data plane independence | 26% | `01`, `05`, `11` | `01-cloud-model-and-static-stability.test.ts`, `05-load-balancing-and-dns-failover.test.ts`, `11-cell-architecture-and-shuffle-sharding.test.ts` | ✅ Full |
| **Domain 2: Secure Identity, Access & Governance** | Multi-account landing zones, SCP guardrails, IAM policy evaluation, condition keys, OIDC workload identity federation, least privilege, KMS | 24% | `02`, `03`, `12` | `02-resource-hierarchy-and-guardrails.test.ts`, `03-iam-evaluation-and-workload-identity.test.ts`, `12-policy-as-code-and-guardrails.test.ts` | ✅ Full |
| **Domain 3: High-Performing Cloud Networks** | Non-overlapping CIDR planning, subnet tiering, routing tables, VPC peering, transit hubs, private endpoints (PrivateLink/PSC), egress NAT | 18% | `04`, `05` | `04-cidr-planning-and-vpc-peering.test.ts`, `05-load-balancing-and-dns-failover.test.ts` | ✅ Full |
| **Domain 4: Data Systems, Storage & Durability** | Object storage tiering economics, minimum retention fees, 11×9s durability vs availability, synchronous standbys vs async replicas, RPO/RTO | 16% | `07`, `08` | `07-storage-lifecycle-and-durability.test.ts`, `08-managed-databases-and-rpo-rto.test.ts` | ✅ Full |
| **Domain 5: Event-Driven Systems & Workflows** | At-least-once queues, poison message DLQ routing, consumer idempotency keys, distributed Saga orchestrations, exponential backoff against retry storms | 8% | `09`, `10` | `09-messaging-dlq-and-idempotency.test.ts`, `10-saga-workflows-and-retry-storms.test.ts` | ✅ Full |
| **Domain 6: Cost Optimization & FinOps Operations** | Unit economics, hidden network egress, inter-AZ data transfer, NAT gateway data processing, commitment savings plans, log retention optimization | 8% | `13`, `14` | `13-observability-slo-and-log-retention.test.ts`, `14-finops-unit-economics-and-cost.test.ts` | ✅ Full |

## Question Banks

- **[Cloud Architecture Practice Bank & Mock Exam (65 Questions)](../exams/cloud-architecture-interview.md)**: Comprehensive scenario question bank covering multi-cloud enterprise architecture, trade-offs, distractor analyses, and a 65-question timed mock exam with full scoring key and remediation breakdown.
