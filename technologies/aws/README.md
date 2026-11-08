# AWS: Cloud Architecture & Systems Engineering

A rigorous engineering curriculum covering AWS multi-account governance, IAM policy evaluation mechanics, software-defined networking, compute virtualization, serverless architectures, distributed databases, event-driven messaging, and cloud operations.

Verified against AWS CLI v2, AWS SDK for JS v3 (`@aws-sdk/client-s3 3.1164.0`), Terraform AWS provider `6.72.0`, and moto `5.2.5` on 2026-11-08.

---

## Curriculum Overview & Syllabus

1. [Module 01: Account and Organization Model](modules/01-account-and-organization-model.md) — AWS Organizations hierarchy, Organizational Units (OUs), AWS Control Tower landing zones, Service Control Policies (SCPs), Resource Control Policies (RCPs), Declarative Policies, delegated administrator accounts, and centralized root credential hardening.
2. [Module 02: IAM in Depth and Policy Evaluation](modules/02-iam-in-depth-and-policy-evaluation.md) — IAM policy taxonomy (identity, resource, permission boundaries, session policies, SCPs/RCPs), deterministic evaluation logic (Explicit Deny > Explicit Allow > Default Deny), cross-account `AssumeRole`, `sts:ExternalId`, confused deputy mitigations (`aws:SourceArn`/`aws:SourceAccount`), OIDC federation (`AssumeRoleWithWebIdentity`), and IAM Identity Center permission sets.
3. [Module 03: Networking, VPC, and Hybrid Connectivity](modules/03-networking-vpc-and-hybrid-connectivity.md) — VPC topology, CIDR allocations, AZ-subnet physical mapping, Security Groups (stateful) vs Network ACLs (stateless ephemeral ports), Gateway Endpoints vs Interface Endpoints (PrivateLink), Transit Gateway routing domains, Route 53 Resolver (inbound/outbound rules), CloudFront Origin Access Control (OAC), and AWS Global Accelerator.
4. [Module 04: Compute: EC2, ECS, and Lambda Internals](modules/04-compute-ec2-ecs-and-lambda-internals.md) — EC2 Nitro architecture, IMDSv2 security enforcement, Auto Scaling lifecycle hooks and warm pools, ECS Fargate task networking (`awsvpc`), capacity providers, and Lambda Firecracker microVM execution environments (init/invoke/shutdown lifecycle phases, reserved vs provisioned concurrency, SnapStart, and durable functions).
5. [Module 05: Serverless Event-Driven Architecture](modules/05-serverless-event-driven-architecture.md) — Lambda event source mappings (SQS, Kinesis, DynamoDB Streams), partial batch response (`ReportBatchItemFailures`), asynchronous retry lifecycles, dead-letter destinations, Lambda Managed Instances, Powertools for TypeScript/Python, and Step Functions Standard vs Express execution workflows.
6. [Module 06: Storage: S3, EBS, and EFS Internals](modules/06-storage-s3-ebs-and-efs-internals.md) — S3 strong read-after-write consistency, request rate scaling per prefix (3,500 PUT / 5,500 GET), S3 Express One Zone sub-10ms latency, storage tiers and Intelligent-Tiering mechanics, Object Lock (governance vs compliance), Cross-Region Replication (RTC), Bucket Owner Enforced policies, presigned URLs (SigV4), EBS gp3/io2 burst mechanics, and EFS throughput modes.
7. [Module 07: Relational Databases: RDS, Aurora, and DSQL](modules/07-relational-databases-rds-aurora-and-dsql.md) — RDS Multi-AZ instance replication vs Multi-AZ DB clusters, Aurora distributed storage engine (6-way replication across 3 AZs with 4/6 write and 3/6 read quorum), Aurora Global Database asynchronous storage replication, RDS Proxy connection pooling, and Aurora DSQL distributed SQL architecture.
8. [Module 08: NoSQL: DynamoDB and In-Memory Caching](modules/08-nosql-dynamodb-and-in-memory-caching.md) — DynamoDB single-table design, partition and sort keys, global and local secondary indexes (GSIs/LSIs), on-demand vs provisioned capacity modes, burst capacity and hot partition throttling, 100-item ACID transactions, DynamoDB Streams, TTL, ElastiCache (Valkey/Redis OSS), and MemoryDB multi-AZ transactional log replication.
9. [Module 09: Messaging, Integration, and Streaming](modules/09-messaging-integration-and-streaming.md) — SQS Standard vs FIFO queues (message deduplication ID, message group ID, visibility timeout and redrive policies), SNS message filtering and fan-out topologies, EventBridge event buses, EventBridge Pipes, EventBridge Scheduler, Kinesis Data Streams shard architecture, and Managed Streaming for Apache Kafka (MSK).
10. [Module 10: Security, Governance, and Cryptography](modules/10-security-governance-and-cryptography.md) — AWS Key Management Service (KMS) key policies, grants, cryptographic operations, envelope encryption, S3 Bucket Keys, Secrets Manager automated rotation, AWS CloudTrail management vs data events and CloudTrail Lake, GuardDuty, AWS Security Hub, Macie, WAF, Shield Advanced, and data perimeters.
11. [Module 11: Observability, Monitoring, and Auditing](modules/11-observability-monitoring-and-auditing.md) — CloudWatch metric streams, Embedded Metric Format (EMF), CloudWatch Logs Insights, composite alarms, AWS X-Ray distributed tracing, AWS Distro for OpenTelemetry (ADOT), ServiceLens, and CloudWatch Synthetics canaries.
12. [Module 12: Infrastructure as Code and CI/CD](modules/12-infrastructure-as-code-and-cicd.md) — AWS CloudFormation engine, change sets, stack sets, AWS Cloud Development Kit (CDK) constructs, CDK Aspects (`cdk-nag`), AWS CodeDeploy linear and canary deployment strategies, AppConfig feature flags, and keyless CI/CD deployments using OpenID Connect (OIDC).
13. [Module 13: Resilience, DR, and Migration](modules/13-resilience-dr-and-migration.md) — Well-Architected Reliability pillar, static stability, shuffle sharding, cellular architecture, Disaster Recovery strategies (Backup & Restore, Pilot Light, Warm Standby, Multi-Region Active-Active) with RPO/RTO calculations, AWS Elastic Disaster Recovery (DRS), AWS Application Migration Service (MGN), and AWS Database Migration Service (DMS).
14. [Module 14: Cost Optimization, FinOps, and Version History](modules/14-cost-optimization-finops-and-version-history.md) — AWS Cost Explorer, Cost and Usage Report (CUR 2.0), AWS Budgets, AWS Compute Optimizer, Savings Plans (Compute vs EC2 Instance) vs Reserved Instances, S3 lifecycle optimization, architectural version history, and then-vs-now evolution table.

---

## Prerequisites

- Foundation knowledge from [`architecture/cloud-foundations`](../../architecture/cloud-foundations) (shared responsibility model, cloud economics, high availability primitives, multi-tenant boundaries).
- Foundation knowledge from [`architecture/networking`](../../architecture/networking) (IPv4/IPv6 CIDR, TCP/IP handshake, DNS resolution, BGP routing, TLS 1.3).
- Foundation knowledge from [`architecture/security-identity`](../../architecture/security-identity) (cryptographic signing, asymmetric keys, OAuth 2.0 / OIDC tokens, RBAC vs ABAC).
- TypeScript & Modern Node.js (`node:test`, `fast-check`, asynchronous runtime concurrency).

---

## Runnable Verification Instructions

```bash
# Install pinned toolchain via mise
mise install

# Run deterministic simulation test suites
cd technologies/aws
mise exec -- npm test

# Run static analysis and type checking
mise exec -- npm run typecheck
mise exec -- npm run lint
mise exec -- npm run fmt:check
```

---

## Certifications & Exams

This track prepares engineers for three primary AWS certifications, mapping specific technical domains, architectural trade-offs, and service quotas to syllabus modules:

### 1. AWS Certified Solutions Architect – Associate (SAA-C03)

- **Format**: 65 questions (single-choice, multiple-choice), 130 minutes, passing score 720/1000.
- **Status**: Active. Official exam guide available at [AWS Certification SAA-C03](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html).
- **Official Domains & Weights**:

| Domain                                         | Weight | Modules Covering Domain    |
| ---------------------------------------------- | :----: | -------------------------- |
| Domain 1: Design Secure Architectures          |  30%   | Modules 01, 02, 10         |
| Domain 2: Design Resilient Architectures       |  26%   | Modules 03, 04, 06, 07, 13 |
| Domain 3: Design High-Performing Architectures |  24%   | Modules 04, 06, 07, 08, 09 |
| Domain 4: Design Cost-Optimized Architectures  |  20%   | Modules 04, 06, 08, 14     |

> [!NOTE]
> Third-party "SAA-C04" claims are unverified and unannounced by AWS. SAA-C03 remains the official, active examination standard.

### 2. AWS Certified Developer – Associate (DVA-C03)

- **Format**: 65 questions (single-choice, multiple-choice), 130 minutes, passing score 720/1000.
- **Status**: Transitioning from DVA-C02 to DVA-C03. DVA-C02 last delivery date is 2026-11-30; DVA-C03 registration opens 2026-12-01.
- **Official Domains & Weights (DVA-C03)**:

| Domain                                     | Weight | Modules Covering Domain    |
| ------------------------------------------ | :----: | -------------------------- |
| Domain 1: Development with AWS Services    |  30%   | Modules 04, 05, 06, 08, 09 |
| Domain 2: Security                         |  26%   | Modules 02, 06, 10         |
| Domain 3: Testing and Deployment           |  22%   | Modules 05, 12             |
| Domain 4: Troubleshooting and Optimization |  22%   | Modules 05, 08, 11         |

> [!IMPORTANT]
> **Exam Delta (DVA-C02 → DVA-C03)**: DVA-C03 eliminates legacy deployment tooling (CodeStar, Cloud9), emphasizes AWS SDK for JS v3 modular clients over monolithic SDK v2, prioritizes containerized serverless workflows (ECS Fargate, Lambda container images), adds event-driven streaming patterns (EventBridge Pipes, DynamoDB Streams with partial batch failures), and requires OIDC federation for CI/CD authentication over static IAM access keys.

### 3. AWS Certified Solutions Architect – Professional (SAP-C03)

- **Format**: 75 questions (65 scored + 10 unscored), 180 minutes, passing score 720/1000.
- **Status**: Transitioning from SAP-C02 to SAP-C03. SAP-C02 last delivery date is 2026-11-16; SAP-C03 GA mid-November 2026.
- **Official Domains & Weights (SAP-C03)**:

| Domain | Weight | Modules Covering Domain |
| --- | :-: | --- |
| Domain 1: Architecture Design and Implementation Built for the Cloud | 25% | Modules 01, 03, 04, 06, 07, 08 |
| Domain 2: Security, Compliance, and Governance | 25% | Modules 01, 02, 10 |
| Domain 3: Cost-Optimized Architecture Design | 15% | Modules 04, 06, 14 |
| Domain 4: Resilience, Migration, and Business Continuity | 15% | Modules 03, 07, 13 |
| Domain 5: Operational Excellence and Automation | 20% | Modules 01, 11, 12 |

> [!IMPORTANT]
> **Exam Delta (SAP-C02 → SAP-C03)**: SAP-C03 introduces Resource Control Policies (RCPs) alongside Service Control Policies (SCPs) for centralized data perimeter enforcement, integrates AWS Control Tower programmatic landing zone governance, tests automated multi-account migration pipelines with Application Migration Service (MGN) and Database Migration Service (DMS), and emphasizes Cost and Usage Report (CUR 2.0) with AWS Compute Optimizer FinOps automation.
