# AWS Certification & Exam Coverage Matrix

This directory contains the certification and exam coverage matrices, question banks, and mock exams for the three primary AWS certifications covered by the `technologies/aws` track:

1. **AWS Certified Solutions Architect – Associate (SAA-C03)**
2. **AWS Certified Developer – Associate (DVA-C03)**
3. **AWS Certified Solutions Architect – Professional (SAP-C03)**

---

## 1. AWS Certified Solutions Architect – Associate (SAA-C03) Coverage Matrix

| Domain & Architectural Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Domain 1: Design Secure Architectures**<br>Secure AWS access, multi-account governance (AWS Organizations, SCPs), IAM policy evaluation, VPC security (SGs, NACLs), and cryptographic data protection (KMS, S3 Bucket Keys). | 30% | Modules 01, 02, 03, 10 | `examples/01-iam-evaluation.test.ts`, `examples/02-s3-presigned-sigv4.test.ts`, `examples/08-kms-envelope-encryption.test.ts` | ✅ full |
| **Domain 2: Design Resilient Architectures**<br>Scalable and loosely coupled architectures (SQS, SNS, EventBridge), high-availability database tiers (RDS Multi-AZ, Aurora 6-way quorum), Route 53 failover, shuffle sharding, and disaster recovery. | 26% | Modules 03, 04, 07, 09, 13 | `examples/04-sqs-dlq-simulation.test.ts`, `examples/06-aurora-quorum.test.ts`, `examples/10-shuffle-sharding.test.ts` | ✅ full |
| **Domain 3: Design High-Performing Architectures**<br>High-performing compute (EC2 Nitro, ECS Fargate, Lambda), scalable storage (S3 partition scaling, EBS gp3/io2), caching (ElastiCache, CloudFront), and DynamoDB single-table design. | 24% | Modules 04, 06, 07, 08, 09 | `examples/03-dynamodb-single-table.test.ts`, `examples/05-s3-partitioning.test.ts` | ✅ full |
| **Domain 4: Design Cost-Optimized Architectures**<br>Cost-effective storage tiering (S3 Intelligent-Tiering), compute purchasing models (Spot, Savings Plans), Gateway VPC endpoints vs NAT Gateways, S3 Bucket Keys, and FinOps practices. | 20% | Modules 03, 04, 06, 08, 14 | `examples/08-kms-envelope-encryption.test.ts`, `technologies/aws/modules/03-networking-vpc-and-hybrid-connectivity.md`, `technologies/aws/modules/14-cost-optimization-finops-and-version-history.md` | ✅ full |

---

## 2. AWS Certified Developer – Associate (DVA-C03) Coverage Matrix

| Domain & Developer Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Domain 1: Development with AWS Services**<br>Serverless code authoring (Lambda, Step Functions), NoSQL access patterns (DynamoDB single-table keys, GSIs), asynchronous queuing (SQS, SNS), and AWS SDK for JS v3 patterns. | 30% | Modules 04, 05, 06, 08, 09 | `examples/03-dynamodb-single-table.test.ts`, `examples/04-sqs-dlq-simulation.test.ts`, `examples/07-eventbridge-rules.test.ts` | ✅ full |
| **Domain 2: Security**<br>Application authentication (IAM roles, STS, Cognito), keyless CI/CD with OIDC, client-side encryption with KMS, Secrets Manager rotation, and S3 presigned URL generation. | 26% | Modules 02, 06, 10 | `examples/01-iam-evaluation.test.ts`, `examples/02-s3-presigned-sigv4.test.ts`, `examples/08-kms-envelope-encryption.test.ts` | ✅ full |
| **Domain 3: Testing and Deployment**<br>CI/CD pipeline automation, CloudFormation/CDK deployment configurations, CodeDeploy linear/canary traffic shifting, AppConfig feature flags, and local testing strategies. | 22% | Modules 05, 12 | `technologies/aws/modules/12-infrastructure-as-code-and-cicd.md` | ✅ full |
| **Domain 4: Troubleshooting and Optimization**<br>Distributed tracing with AWS X-Ray and ADOT, CloudWatch Logs Insights, Lambda concurrency tuning, partial batch failure handling (`ReportBatchItemFailures`), and DynamoDB hot partition mitigation. | 22% | Modules 05, 08, 11 | `examples/09-cloudwatch-emf-metrics.test.ts`, `technologies/aws/modules/04-compute-ec2-ecs-and-lambda-internals.md`, `technologies/aws/modules/11-observability-monitoring-and-auditing.md` | ✅ full |

---

## 3. AWS Certified Solutions Architect – Professional (SAP-C03) Coverage Matrix

| Domain & Enterprise Architecture Objective | Weight | Target Modules | Runnable Proofs / Examples | Coverage Status |
| --- | :-: | --- | --- | :-: |
| **Domain 1: Architecture Design and Implementation Built for the Cloud**<br>Complex multi-account VPC topologies (Transit Gateway, Cloud WAN), hybrid cloud network connectivity (Direct Connect, Route 53 Resolver), and distributed database architectures (Aurora Global Database, DSQL). | 25% | Modules 01, 03, 04, 06, 07, 08 | `examples/06-aurora-quorum.test.ts`, `technologies/aws/modules/03-networking-vpc-and-hybrid-connectivity.md` | ✅ full |
| **Domain 2: Security, Compliance, and Governance**<br>Organizational guardrails (SCPs, RCPs), centralized root credentials, delegated administrator architecture, data perimeter enforcement, and audit compliance logging. | 25% | Modules 01, 02, 10 | `examples/01-iam-evaluation.test.ts`, `examples/08-kms-envelope-encryption.test.ts` | ✅ full |
| **Domain 3: Cost-Optimized Architecture Design**<br>Enterprise FinOps, multi-account Cost and Usage Report (CUR 2.0) analysis with Athena, Compute Optimizer recommendations, and blended commitment discount modeling. | 15% | Modules 04, 06, 14 | `examples/08-kms-envelope-encryption.test.ts`, `technologies/aws/modules/14-cost-optimization-finops-and-version-history.md` | ✅ full |
| **Domain 4: Resilience, Migration, and Business Continuity**<br>Static stability, cellular architectures, multi-region disaster recovery (RPO/RTO), AWS Elastic Disaster Recovery (DRS), and large-scale workload migration (MGN, DMS). | 15% | Modules 03, 07, 13 | `examples/06-aurora-quorum.test.ts`, `examples/10-shuffle-sharding.test.ts`, `technologies/aws/modules/13-resilience-dr-and-migration.md` | ✅ full |
| **Domain 5: Operational Excellence and Automation**<br>Landing zone customization with AWS Control Tower, automated compliance remediation via EventBridge and Lambda, and immutable infrastructure delivery. | 20% | Modules 01, 11, 12 | `examples/07-eventbridge-rules.test.ts`, `examples/09-cloudwatch-emf-metrics.test.ts`, `technologies/aws/modules/01-account-and-organization-model.md`, `technologies/aws/modules/12-infrastructure-as-code-and-cicd.md` | ✅ full |

---

## 4. Question Bank Inventory

- **SAA-C03 Question Bank**: [`saa-c03.md`](saa-c03.md) — 65 scenario-based and multiple-choice questions covering all 4 SAA-C03 domains, complete 65-question mock exam with full domain weighting and scoring key, formatted to `AGENTS.md` specifications with full distractor rationales and module citations.
- **DVA-C03 & SAP-C03 Exam Coverage**: DVA-C03 and SAP-C03 domain objectives are taught comprehensively throughout the 14 core syllabus modules and drilled via 140 scenario-based Interview Drill questions and executable simulation proofs in `examples/`. Dedicated question banks for DVA-C03 and SAP-C03 follow the SAA-C03 question bank schema.
