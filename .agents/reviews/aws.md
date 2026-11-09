# Review: technologies/aws · author Opus / Antigravity · 2026-11-08 · branch track/aws

## Summary

**State**: 🟩 authoring complete (Milestone 3 complete: Modules 10 through 14 authored, deterministic test models expanded to 10 suites, full exam matrices across SAA-C03, DVA-C03, and SAP-C03 marked ✅ full, all verification gates passing)

Authoring the `technologies/aws` track per `.agents/briefs/aws.md` and `AGENTS.md`. Milestone 3 covers security, governance, and cryptography (KMS, Secrets Manager, CloudTrail, GuardDuty, WAF, data perimeters); observability, monitoring, and auditing (CloudWatch, EMF, composite alarms, X-Ray, ADOT, ServiceLens); infrastructure as code and CI/CD (CloudFormation, CDK, CodeDeploy, AppConfig, keyless OIDC); resilience, disaster recovery, and migration (static stability, shuffle sharding, cellular architectures, RPO/RTO DR spectrum, DRS, MGN, DMS, FIS); and cost optimization, FinOps, and version history (CUR 2.0, Athena, Compute Optimizer, Savings Plans, Spot fleets, S3 Storage Lens, Then vs Now evolution table, and historical version timeline).

### What Was Done

1. **Module Standard & Track Architecture**:
   - Authored Modules 10 through 14 in `technologies/aws/modules/` (all 14 curriculum modules now complete, exceeding 400 lines each, strictly unwrapped prose, escaped table pipes, valid Mermaid 11 & 12 diagrams with explicit layout constraints, deep academic/systems mechanics, and 10-question Interview Drills):
     - `10-security-governance-and-cryptography.md` (491 lines): AWS KMS key taxonomy (CMKs vs AWS Managed vs AWS Owned), symmetric vs asymmetric keys, Key Policy as primary authorization document (the root delegation requirement `arn:aws:iam::<account>:root`), KMS Grants lifecycle (`CreateGrant`, `RetireGrant`), envelope encryption protocol (HSM 4 KB limit bypass, local memory sanitation), S3 Bucket Keys (99% KMS API request reduction), Multi-Region KMS keys (`mrk-...` replicated material, independent policies), AWS Secrets Manager 4-step automated rotation lifecycle (`createSecret`, `setSecret`, `testSecret`, `finishSecret`), Secrets Manager vs Parameter Store, CloudTrail (management vs data events, CloudTrail Lake, SHA-256/RSA log file integrity digests), Amazon GuardDuty agentless ML telemetry, AWS Security Hub with ASFF and automated remediation, Amazon Macie, AWS WAF & Shield Advanced with SRT and DDoS cost protection, and multi-layer Data Perimeters (Identity `aws:PrincipalOrgID`, Resource `aws:ResourceOrgID`, Network `aws:sourceVpce`).
     - `11-observability-monitoring-and-auditing.md` (421 lines): Amazon CloudWatch metric engine, standard vs high-resolution metrics (1-second intervals, 3-hour retention), custom metric cardinality, CloudWatch Metric Streams via Firehose push (eliminating polling API fees), Embedded Metric Format (EMF stdout zero-latency asynchronous extraction with zero `PutMetricData` API cost), CloudWatch Logs (log groups, retention policies, subscription filters to Kinesis/Lambda, Logs Insights SQL syntax), CloudWatch Alarms (M-of-N evaluation windows, statistical anomaly detection bands), Composite Alarms (boolean expressions suppressing alert fatigue during maintenance), distributed tracing with AWS X-Ray (segments, subsegments, `X-Amzn-Trace-Id` propagation, reservoir and fixed rate sampling rules), AWS Distro for OpenTelemetry (ADOT collector sidecar/daemonset, vendor-neutral OTLP ingestion, multi-vendor export), CloudWatch Synthetics (Puppeteer/Playwright headless canaries), and CloudWatch ServiceLens unified topology correlation.
     - `12-infrastructure-as-code-and-cicd.md` (402 lines): AWS CloudFormation orchestration engine, template anatomy (Parameters, Mappings, Conditions, Resources, Outputs), Stack lifecycle (Change Sets, Drift Detection, Termination Protection, Stack Policies, DeletionPolicy), cross-stack references (`Fn::ImportValue` export lock) vs Nested Stacks (`AWS::CloudFormation::Stack` unified rollback) vs CloudFormation StackSets (multi-account, multi-region with auto-deployment to new OUs), AWS Cloud Development Kit (CDK) constructs (L1 primitives, L2 curated constructs with least-privilege defaults, L3 architectural patterns), CDK Aspects (Visitor Pattern compliance enforcement with `cdk-nag` at synthesis time), CDK Assets bundling (bootstrap S3/ECR staging, cryptographic hash cache-busting), AWS CodeDeploy progressive traffic shifting (All-at-Once vs Linear vs Canary) and lifecycle event hooks (`BeforeInstall`, `AfterInstall`, `ApplicationStart`, `ValidateService`, `BeforeAllowTraffic`, `AfterAllowTraffic`), AWS AppConfig dynamic configuration (JSON schema validation, linear/exponential rollouts, bake time, automated CloudWatch rollback alarms), and keyless CI/CD with OpenID Connect (OIDC federation via `AssumeRoleWithWebIdentity` asserting `sub` claim constraints).
     - `13-resilience-dr-and-migration.md` (427 lines): Well-Architected Reliability Pillar, Control Plane vs Data Plane operational divergence, Static Stability (surviving control plane and external dependency outages via pre-provisioned capacity, local credential and configuration caching), Timeouts, Retries, and Backoff with Jitter (Amazon Builders' Library mathematical formulation of Full Jitter vs Decorrelated Jitter, Circuit Breaker finite state machine: Closed, Open, Half-Open), Cellular Architectures (monolith decomposition into independent cells, deterministic cell sizing, thin cellular router, cell evacuation), Shuffle Sharding mathematical formulation ($\binom{N}{k}$ combinations, poison-pill isolation reducing total outage probability to $\approx 0.000025\%$), Disaster Recovery RPO and RTO spectrum (Backup & Restore, Pilot Light, Warm Standby, Multi-Region Active-Active), Enterprise 7 Rs migration framework (Retire, Retain, Repurchase, Rehost, Relocate, Replatform, Refactor), automated migration engines: AWS Elastic Disaster Recovery (DRS continuous block replication into low-cost staging area, sub-second RPO), AWS Application Migration Service (MGN block-level live replication with automated Nitro OS driver modernization), AWS Database Migration Service (DMS Full Load + CDC ongoing transactional replication with SCT), and Chaos Engineering with AWS Fault Injection Service (FIS pre-configured CloudWatch stop conditions).
     - `14-cost-optimization-finops-and-version-history.md` (418 lines): Enterprise FinOps principles, Cost Allocation Tags (AWS-generated vs user-defined activation protocol, Tag Policies), Cost and Usage Report (CUR 2.0) partitioned Apache Parquet in S3, AWS Budgets (actual vs forecasted alert thresholds, automated budget actions), Unit Economics analytics querying CUR 2.0 in Amazon Athena (unblended vs amortized costs, forensic queries for orphaned EBS volumes, inter-AZ traffic, untagged resources), Network data transfer cost topology (intra-AZ free, inter-AZ $0.02/GB round-trip, NAT Gateway $0.045/GB anti-pattern resolved via free Gateway VPC Endpoints), Compute rightsizing with AWS Compute Optimizer (CloudWatch Agent `mem_used_percent` prerequisite), Commitment modeling (Compute Savings Plans vs EC2 Instance Savings Plans vs legacy Reserved Instances), Amazon EC2 Spot Instances (2-minute IMDS/EventBridge interruption warning, capacity-optimized allocation strategy), AWS Graviton ARM64 processor architecture (dedicated physical Neoverse V2 cores, 40% price/performance gain), S3 storage cost optimization (Lifecycle transition rules, `AbortIncompleteMultipartUpload`, noncurrent version expiration, S3 Storage Lens multi-account metrics, S3 Intelligent-Tiering economics), Then vs Now Architectural Evolution Table (12 comprehensive domain comparisons), and Architectural Version History (major milestones from 2006 to 2026).
2. **Deterministic Executable Proofs (`examples/`)**:
   - Expanded `examples/lib/aws-models.ts` with 3 comprehensive simulation models:
     - KMS Envelope Encryption Engine (`KmsEngine`, `envelopeEncrypt`, `envelopeDecrypt`, `S3BucketKeySimulation`): validates Key Policy evaluation (asserting IAM identity access is denied if Key Policy omits root delegation), KMS Grants lifecycle, AES-256-GCM authenticated envelope encryption with local DEK memory wiping, and demonstrates 99.9% KMS API request reduction with S3 Bucket Keys.
     - CloudWatch EMF & Alarm Engine (`formatEmf`, `extractEmfMetrics`, `evaluateMetricAlarm`, `evaluateCompositeAlarm`): formats and extracts structured JSON EMF payloads with multidimensional metrics, evaluates M-of-N metric threshold alarms, and parses recursive boolean composite alarm expressions (`ALARM(A) AND NOT ALARM(B)`) suppressing alert fatigue.
     - Shuffle Sharding Router (`ShuffleShardingRouter`): computes combination space $\binom{N}{k}$, assigns deterministic sorted node shards via SHA-256 hashing, and simulates poison-pill blast radius across 1,000 tenants in a 100-node fleet (0 other tenants fully downed, $> 80\%$ completely unaffected).
   - Authored corresponding unit test suites:
     - `examples/08-kms-envelope-encryption.test.ts`
     - `examples/09-cloudwatch-emf-metrics.test.ts`
     - `examples/10-shuffle-sharding.test.ts`
   - All 10 test suites pass deterministically via `node --experimental-strip-types --test` (37 / 37 tests passing). Clean TypeScript compilation (`npm run typecheck`).
3. **Exam Matrix & Documentation Updates**:
   - `technologies/aws/exams/README.md`: All domains and objectives across SAA-C03 (4 domains), DVA-C03 (4 domains), and SAP-C03 (5 domains) marked **✅ full** with mappings to all 14 modules and 10 executable proofs.
   - `technologies/aws/exams/saa-c03.md`: Full 65-question bank audited with `bun run tools/check-questions.ts`, 0 schema issues, complete 65-question mock exam scoring key.
   - `technologies/aws/CHEATSHEET.md`: Expanded with AWS KMS envelope encryption SDK v3 patterns, CloudWatch Logs Insights queries, and updated service quotas across KMS, CloudWatch, CloudFormation, Secrets Manager, Parameter Store, and DRS.
   - `technologies/aws/GLOSSARY.md`: Expanded with 17 new terms from Modules 10–14 in strict alphabetical order (total 63 bilingual entries).

---

## Mechanical Verification Log

- `mise exec -- npm test` (in `technologies/aws`): **37 / 37 tests passing across 10 suites** (5.8s)
- `mise exec -- npm run typecheck` (in `technologies/aws`): **0 errors** (Clean TypeScript compilation)
- `node tools/wrap-check/check.mjs technologies/aws`: **0 wrapped line(s) in 0 file(s)**
- `node tools/table-check/check.mjs technologies/aws`: **43 table(s), 0 failing**
- `bun run tools/check-questions.ts "technologies/aws/exams/*.md"`: **65 questions audited across 1 file, 0 schema issues**
- `cd tools/mermaid-check && node check.mjs ../../technologies/aws`: **104 diagram(s), 0 failing**
- Secret & Path Leak Scan: Clean (0 local paths, 0 tokens, 0 credentials)

---

## Challenger (Muse Spark 1.3)

### Challenger Summary

Adversarial audit of Modules 01–14, executable test models (`examples/lib/aws-models.ts`), and question bank `exams/saa-c03.md`. Overall track demonstrates exceptional technical depth, accurate distributed systems mechanics (Aurora 6-way quorum math, shuffle sharding combinatorial formulation, KMS envelope encryption memory wiping, and CloudWatch EMF zero-overhead ingestion), strictly unwrapped prose, and valid Mermaid diagrams. However, critical discrepancies were discovered in the SAA-C03 mock exam scoring key (8 answer mismatches), stale quota figures (SCP size and attachment limits, README 25-item DynamoDB transactions vs current 100-item limit), misplaced question bank cross-references, and an overly restrictive IAM permission boundary simulation on resource-policy-granted access.

### Challenger Findings

- [x] **P1** `technologies/aws/exams/saa-c03.md:1326`: Mock exam scoring key for `Q-SAA-007` lists `**B**`, but the question answer and explanation state `**A**` (Secrets Manager automatic rotation via Lambda in VPC) -> Update scoring key entry 7 to `**A**`. Source: https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets.html
- [x] **P1** `technologies/aws/exams/saa-c03.md:1327`: Mock exam scoring key for `Q-SAA-008` lists `**B**`, but the question answer and explanation state `**A**` (S3 Object Lock in Compliance Mode) -> Update scoring key entry 8 to `**A**`. Source: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html
- [x] **P1** `technologies/aws/exams/saa-c03.md:1329`: Mock exam scoring key for `Q-SAA-010` lists `**B**`, but the question answer and explanation state `**A**` (ASG across multiple AZs and RDS Multi-AZ) -> Update scoring key entry 10 to `**A**`. Source: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html
- [x] **P1** `technologies/aws/exams/saa-c03.md:1330`: Mock exam scoring key for `Q-SAA-011` lists `**B**`, but the question answer and explanation state `**A**` (Decouple order submission with SQS) -> Update scoring key entry 11 to `**A**`. Source: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html
- [x] **P1** `technologies/aws/exams/saa-c03.md:1333`: Mock exam scoring key for `Q-SAA-014` lists `**B**`, but the question answer and explanation state `**A**` (Amazon Aurora Global Database) -> Update scoring key entry 14 to `**A**`. Source: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html
- [x] **P1** `technologies/aws/exams/saa-c03.md:1339`: Mock exam scoring key for `Q-SAA-020` lists `**B**`, but the question answer and explanation state `**A**` (AWS Global Accelerator Anycast) -> Update scoring key entry 20 to `**A**`. Source: https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html
- [x] **P1** `technologies/aws/exams/saa-c03.md:1342`: Mock exam scoring key for `Q-SAA-023` lists `**B**`, but the question answer and explanation state `**A**` (Amazon CloudFront edge caching) -> Update scoring key entry 23 to `**A**`. Source: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
- [x] **P1** `technologies/aws/exams/saa-c03.md:1343`: Mock exam scoring key for `Q-SAA-024` lists `**B**`, but the question answer and explanation state `**A**` (Cluster Placement Group for MPI) -> Update scoring key entry 24 to `**A**`. Source: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-groups.html#placement-groups-cluster
- [x] **P1** `technologies/aws/modules/01-account-and-organization-model.md:65`: Policy size and attachment limits state "strict maximum size limit of 5,120 bytes" and "up to 5 SCPs per account or OU", which are legacy limits -> Update to current AWS Organizations quotas: maximum size limit of 10,240 characters/bytes and up to 10 SCPs directly attached per root, OU, or account. Source: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_reference_limits.html
- [x] **P1** `technologies/aws/README.md:18`: Summary for Module 08 states "25-item ACID transactions", whereas Module 08 text correctly documents the increased limit of 100 items (`TransactWriteItems`) -> Update `README.md` to "100-item ACID transactions". Source: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
- [x] **P1** `technologies/aws/examples/lib/aws-models.ts:212`: `evaluateIamRequest` applies `permissionBoundary` checks indiscriminately to access granted by resource-based policies -> Update IAM evaluation logic so permission boundaries constrain only identity-based policies and do not block resource policies that explicitly designate the principal in `Principal`. Source: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:144`: `Q-SAA-007` (Secrets Manager rotation) references `modules/02-iam-in-depth-and-policy-evaluation.md#1-iam-policy-taxonomy-and-precedence-engine` in both question details and scoring table -> Update citation to `modules/10-security-governance-and-cryptography.md#5-aws-secrets-manager-automated-rotation-lifecycle`. Source: https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:164`: `Q-SAA-008` (S3 Object Lock Compliance Mode) references `modules/01-account-and-organization-model.md#2-service-control-policies-scps-and-evaluation-boundaries` in question details and scoring table -> Update citation to `modules/06-storage-s3-ebs-and-efs-internals.md#5-s3-data-protection-object-lock-versioning-and-compliance`. Source: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:284`: `Q-SAA-014` (Aurora Global Database RPO/RTO) references `modules/03-networking-vpc-and-hybrid-connectivity.md#5-transit-gateway-and-hybrid-cloud-connectivity` -> Update citation to `modules/07-relational-databases-rds-aurora-and-dsql.md#4-aurora-scaling-read-replicas-and-global-database` or `modules/13-resilience-dr-and-migration.md#5-disaster-recovery-dr-strategies-rpo-vs-rto-spectrum`. Source: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:424`: `Q-SAA-021` (FSx for Lustre POSIX shared storage) references `modules/04-compute-ec2-ecs-and-lambda-internals.md` -> Update citation to `modules/06-storage-s3-ebs-and-efs-internals.md`. Source: https://docs.aws.amazon.com/fsx/latest/LustreGuide/what-is.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:504`: `Q-SAA-025` (S3 Lifecycle transitions) references `modules/01-account-and-organization-model.md#1-aws-organizations-and-multi-account-governance` -> Update citation to `modules/06-storage-s3-ebs-and-efs-internals.md#4-s3-storage-class-hierarchy--intelligent-tiering`. Source: https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:565`: `Q-SAA-028` (Compute Savings Plans vs EC2 Instance Savings Plans) references `modules/04-compute-ec2-ecs-and-lambda-internals.md#1-ec2-nitro-hypervisor-imdsv2-and-instance-lifecycle` -> Update citation to `modules/14-cost-optimization-finops-and-version-history.md#2-commitment-models-savings-plans-vs-reserved-instances`. Source: https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:585`: `Q-SAA-029` (Spot Instances for batch jobs) references `modules/04-compute-ec2-ecs-and-lambda-internals.md` -> Update citation to `modules/14-cost-optimization-finops-and-version-history.md#3-amazon-ec2-spot-instances`. Source: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html
- [x] **P2** `technologies/aws/exams/saa-c03.md:605`: `Q-SAA-030` (DynamoDB On-Demand capacity mode) references `modules/04-compute-ec2-ecs-and-lambda-internals.md#7-lambda-firecracker-microvms-concurrency-and-snapstart` -> Update citation to `modules/08-nosql-dynamodb-and-in-memory-caching.md#4-capacity-modes-bursting-and-hot-partitions`. Source: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html
- [x] **P2** `technologies/aws/modules/02-iam-in-depth-and-policy-evaluation.md:73`: Step 3 states that in same-account requests an explicit Allow in either identity or resource policy satisfies authorization without exception -> Add a callout noting the AWS KMS exception where the Key Policy MUST delegate authorization to the account root before identity policies have any effect. Source: https://docs.aws.amazon.com/kms/latest/developerguide/key-policies.html
- [x] **P2** `technologies/aws/exams/README.md:47`: Directory maps DVA-C03 and SAP-C03 in the coverage matrix but provides a question bank only for SAA-C03 (`saa-c03.md`) -> Author `exams/dva-c03.md` and `exams/sap-c03.md` or explicitly clarify that SAA-C03 is the primary comprehensive question bank while DVA and SAP domains are addressed through module drills. Source: .agents/REVIEW.md § D
- [x] **P3** `technologies/aws/modules/04-compute-ec2-ecs-and-lambda-internals.md:68`: IMDSv2 hop limit explanation says "because the container network bridge increments the hop count", whereas in IP routing the bridge decrements the packet's TTL counter -> Change "increments the hop count" to "decrements the IP packet's Time-to-Live (TTL) counter to 0". Source: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
- [x] **P3** `technologies/aws/modules/01-account-and-organization-model.md:405`: Drill Q7 says "What occurs when an account belongs to multiple nested OUs..." -> Clarify phrasing to "What occurs when an account resides within nested OUs (e.g. an OU within a parent OU)..." since AWS accounts belong to exactly one immediate parent OU. Source: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_ous.html

---

## Verifier (Antigravity)

### Verifier Summary

Mechanical verification, version currency verification against live package registries, exam guide alignment check, and secret/path leak scanning executed cleanly on branch `track/aws` (`4fdba0ed793e7f6f5e05330adab2b798241ebb98`). All repository gates pass with 0 errors.

### Verification Results

1. **Mechanical Tooling & Gate Execution**:
   - `mise exec -- npm test` (in `technologies/aws`): **PASS** (37 / 37 tests passing across 10 test suites in 468ms)
   - `mise exec -- npm run typecheck`: **PASS** (0 TypeScript errors)
   - `mise exec -- npm run lint`: **PASS** (oxlint: 0 warnings, 0 errors across 11 files)
   - `mise exec -- npm run fmt:check`: **PASS** (oxfmt: all 33 files formatted)
   - `node tools/wrap-check/check.mjs technologies/aws`: **PASS** (0 wrapped lines in 0 files)
   - `node tools/table-check/check.mjs technologies/aws`: **PASS** (43 tables verified, 0 failing)
   - `cd tools/mermaid-check && node check.mjs ../../technologies/aws`: **PASS** (104 diagrams verified with Mermaid 11 & 12, 0 failing)
   - `bun run tools/check-questions.ts "technologies/aws/exams/*.md"`: **PASS** (65 questions audited across 1 file, 0 schema issues)
   - `LINK_CHECK_PENDING=technologies/gcp,technologies/azure,architecture/system-design node tools/link-check/check.mjs technologies/aws`: **PASS** (248 relative links and anchors verified, 0 broken, 0 unresolved pending)

2. **Version Currency Verification (against official registries on 2026-11-08)**:
   - AWS CLI v2: Verified active releases `2.39.6` (README pins `AWS CLI v2`).
   - `@aws-sdk/client-s3`: Registry reports `3.1164.0` (README cites `3.1158.0`; minor patch delta).
   - Terraform AWS provider: GitHub release reports `v6.72.0` (README cites `6.70.0`; minor patch delta).
   - `moto`: PyPI reports `5.2.5` (matches README `5.2.5` exactly).

3. **Certification & Exam Status Alignment**:
   - **SAA-C03**: Active examination standard (65 questions, 130 min, 720/1000 passing score). Verified that domain weights in `README.md` and `exams/README.md` match official AWS exam guide: Domain 1 (30%), Domain 2 (26%), Domain 3 (24%), Domain 4 (20%).
   - **DVA-C03**: Verified transition timeline from DVA-C02 (DVA-C02 last delivery 2026-11-30; DVA-C03 opens 2026-12-01). Domain weights match official DVA-C03 guide: Domain 1 (30%), Domain 2 (26%), Domain 3 (22%), Domain 4 (22%).
   - **SAP-C03**: Verified transition timeline from SAP-C02 (SAP-C02 last delivery 2026-11-16; SAP-C03 GA mid-November 2026). Domain weights match official SAP-C03 guide: Domain 1 (25%), Domain 2 (25%), Domain 3 (15%), Domain 4 (15%), Domain 5 (20%).

4. **Secret, Path, and Leak Scan**:
   - Tracked files scan for absolute paths (`/Users/`, `/home/`): **0 found**.
   - Tracked files scan for AWS access keys (`AKIA...`): Only documented standard AWS mock key `AKIAIOSFODNN7EXAMPLE` in `examples/02-s3-presigned-sigv4.test.ts`.
   - Tracked files scan for personal email addresses: **0 leaks found** (only documentation placeholder domains `user@corp.internal`, `aws-root-account-401@corp.internal`, and `alice@example.com`).
   - Git commit history: Clean (author and committer metadata is `Martin Šmíd <martin.smid94@gmail.com>`; 0 agent or session trailers).

### Verifier Findings

- [x] **P2** `technologies/aws/README.md:5`: Upstream package updates available: `@aws-sdk/client-s3` is `3.1164.0` (README cites `3.1158.0`) and Terraform AWS provider is `6.72.0` (README cites `6.70.0`) -> Bump verified versions in README line 5. Source: https://www.npmjs.com/package/@aws-sdk/client-s3, https://github.com/hashicorp/terraform-provider-aws/releases

---

## Resolution (Opus / Antigravity)

All P1, P2, and P3 findings raised by Challenger and Verifier have been fully resolved and mechanically verified on 2026-11-08:

1. **P1 (Mock Exam Scoring Key Desync)**: In `exams/saa-c03.md`, corrected scoring key entries 7, 8, 10, 11, 14, 20, 23, and 24 to `**A**`, aligning with question text, options, and model explanations.
2. **P1 (SCP Quota Figures)**: In `modules/01-account-and-organization-model.md`, updated SCP size limits from legacy 5,120 bytes / 5 SCPs to current 10,240 characters/bytes and up to 10 directly attached SCPs per root, OU, or account.
3. **P1 (DynamoDB Transaction Limit in README)**: In `technologies/aws/README.md:18`, updated summary from 25-item to 100-item ACID transactions (`TransactWriteItems`).
4. **P1 (IAM Evaluation Boundary Simulation)**: In `examples/lib/aws-models.ts`, updated `evaluateIamRequest` so permission boundaries constrain only identity-based policies and do not evaluate or block resource-based policy grants in same-account requests. Added regression test to `examples/01-iam-evaluation.test.ts`.
5. **P2 (Question Bank Module Citations)**: In `exams/saa-c03.md`, updated citations for Q-SAA-007, 008, 014, 021, 025, 028, 029, and 030 to link directly to their exact modules and headings.
6. **P2 (KMS Key Policy Delegation Callout)**: In `modules/02-iam-in-depth-and-policy-evaluation.md:73`, added explicit `[!IMPORTANT]` alert documenting the AWS KMS exception where Key Policies must delegate authorization to the account root before identity policies take effect.
7. **P2 (DVA & SAP Exam Coverage Clarification)**: In `exams/README.md:47`, added explicit guidance clarifying that SAA-C03 contains the complete 65-question preparation question bank with full mock exam, while DVA-C03 and SAP-C03 domain objectives are taught across the 14 syllabus modules and tested via 140 scenario Interview Drill questions.
8. **P2 (Version Currency Updates)**: In `technologies/aws/README.md:5`, bumped verified package releases to `@aws-sdk/client-s3 3.1164.0` and Terraform AWS provider `6.72.0`.
9. **P3 (IMDSv2 Hop Count Phrasing)**: In `modules/04-compute-ec2-ecs-and-lambda-internals.md:68`, corrected network description to state that the container bridge decrements the IP packet's TTL counter to 0.
10. **P3 (Nested OU Phrasing)**: In `modules/01-account-and-organization-model.md:405`, clarified Interview Drill Q7 phrasing for accounts residing within nested OUs.

### Final Mechanical Verification

- `mise exec -- npm test` (in `technologies/aws`): **38 / 38 tests passing across 10 suites** (477ms)
- `mise exec -- npm run typecheck`: **0 errors** (Clean TypeScript compilation)
- `mise exec -- npm run lint`: **0 warnings, 0 errors** (oxlint across 11 files)
- `mise exec -- npm run fmt:check`: **All 33 files use correct format** (oxfmt)
- `node tools/wrap-check/check.mjs technologies/aws`: **0 wrapped line(s) in 0 file(s)**
- `node tools/table-check/check.mjs technologies/aws`: **43 table(s), 0 failing**
- `node tools/link-check/check.mjs technologies/aws`: **248 link(s), 0 broken**
- `cd tools/mermaid-check && node check.mjs ../../technologies/aws`: **104 diagram(s), 0 failing**
- `bun run tools/check-questions.ts "technologies/aws/exams/*.md"`: **65 questions audited, 0 schema issues**
- Leak scan: **CLEAN** (0 local paths, 0 secrets, 0 credentials).
