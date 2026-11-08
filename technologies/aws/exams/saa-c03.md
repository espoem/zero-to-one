# SAA-C03: AWS Certified Solutions Architect – Associate Question Bank

A preparation question bank for the AWS Certified Solutions Architect – Associate (SAA-C03) examination, strictly formatted to `AGENTS.md` specifications with difficulty ratings, detailed distractor rationales, and syllabus references.

---

## Question Bank

### Q-SAA-001 · Design Secure Architectures · difficulty 2 · scenario

A solutions architect must enforce that developers in member accounts cannot delete S3 buckets containing audit logs, even if developers possess full administrator privileges (`AdministratorAccess`) within their respective member accounts. Which strategy fulfills this requirement with the least operational overhead?

- A) Attach an IAM permission boundary to every IAM user and role created within the member accounts denying `s3:DeleteBucket`.
- B) Attach a Service Control Policy (SCP) to the Organizational Unit (OU) containing the member accounts with an explicit Deny for `s3:DeleteBucket`.
- C) Create an S3 bucket policy in each audit bucket denying `s3:DeleteBucket` to the member account root principal.
- D) Deploy an AWS Config rule with automated EventBridge and Systems Manager remediation to re-create deleted buckets.

<details><summary>Answer</summary>

**B.** Service Control Policies (SCPs) in AWS Organizations establish preventive guardrails that define the maximum available permissions across an account or OU. An explicit Deny in an SCP overrides any identity-based permission grant—including `AdministratorAccess`—within member accounts.

- Why not A: Permission boundaries must be attached to each IAM identity individually and do not prevent local administrators from modifying or creating roles without the boundary unless complex boundary-enforcement conditions are maintained.
- Why not C: A bucket policy located inside the member account can be modified or deleted by a local IAM administrator who possesses full S3 permissions.
- Why not D: AWS Config with automated remediation is a reactive detective control rather than a preventive guardrail; the audit logs would already be destroyed before remediation occurs.
- Ref: [modules/01-account-and-organization-model.md](../modules/01-account-and-organization-model.md#2-service-control-policies-scps-and-evaluation-boundaries), https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html

</details>

### Q-SAA-002 · Design Secure Architectures · difficulty 3 · scenario

A SaaS vendor needs cross-account access to customers' AWS resources to run automated vulnerability scans. The vendor instructs each customer to create an IAM role that trusts the vendor's AWS account. To protect against the confused deputy problem, what must the customer configure in the IAM role's trust policy?

- A) A condition requiring multi-factor authentication (`aws:MultiFactorAuthPresent`).
- B) A condition evaluating `sts:ExternalId` matching a unique, customer-specific string supplied by the vendor.
- C) A condition checking `aws:PrincipalArn` against the vendor's root account ARN.
- D) A permission boundary restricting the role's maximum actions to read-only operations.

<details><summary>Answer</summary>

**B.** In a multi-tenant SaaS integration where a third party assumes roles across multiple customer accounts, requiring a unique, confidential `sts:ExternalId` in the role trust policy prevents an attacker from using the third-party service (the confused deputy) to access another customer's account without knowledge of that customer's unique ID.

- Why not A: MFA protects against compromised human credentials, but automated SaaS daemon scanners cannot fulfill interactive MFA token prompts.
- Why not C: Checking `aws:PrincipalArn` only verifies the vendor's identity, which does not differentiate between legitimate scanning for Customer A versus unauthorized scanning for Customer B.
- Why not D: A permission boundary limits what the assumed role can do inside the account, but does not prevent the unauthorized assumption of the role by another tenant.
- Ref: [modules/02-iam-in-depth-and-policy-evaluation.md](../modules/02-iam-in-depth-and-policy-evaluation.md#3-cross-account-role-assumption-and-confused-deputy-mitigations), https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html

</details>

### Q-SAA-003 · Design Secure Architectures · difficulty 2 · scenario

An engineering team wants to authenticate GitHub Actions CI/CD workflows to AWS to deploy infrastructure without creating or storing long-term IAM access keys. Which architecture satisfies this requirement?

- A) Store IAM user access keys in GitHub Secrets and rotate them weekly using an automated Lambda function.
- B) Configure an IAM OpenID Connect (OIDC) identity provider for GitHub Actions and establish an IAM role with a trust policy checking the repository subject (`sub`).
- C) Launch a self-hosted GitHub runner inside a public VPC subnet and attach an IAM instance profile.
- D) Create an AWS CodeArtifact repository that issues temporary STS tokens to external webhook callers.

<details><summary>Answer</summary>

**B.** AWS IAM supports OpenID Connect (OIDC) identity federation. GitHub Actions issues cryptographic OIDC JSON Web Tokens (JWTs) per workflow run. By establishing GitHub as an IAM OIDC identity provider, workflows exchange temporary JWTs for short-lived AWS STS credentials via `AssumeRoleWithWebIdentity`, scoped by repository claims in the trust policy condition.

- Why not A: Storing static long-term access keys in third-party secret stores creates credential leakage risk and operational rotation overhead.
- Why not C: Self-hosted runners in public subnets introduce infrastructure management overhead, patching requirements, and unnecessary attack surfaces compared to cloud OIDC.
- Why not D: AWS CodeArtifact is a software package repository (npm, PyPI, Maven) and cannot act as an identity federation broker for external CI runners.
- Ref: [modules/02-iam-in-depth-and-policy-evaluation.md](../modules/02-iam-in-depth-and-policy-evaluation.md#4-web-identity-federation-and-keyless-cicd-with-oidc), https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html

</details>

### Q-SAA-004 · Design Secure Architectures · difficulty 2 · scenario

A security audit discovers that EC2 instances running web applications are vulnerable to Server-Side Request Forgery (SSRF) attacks, which could allow adversaries to steal instance metadata IAM credentials. What configuration should the solutions architect mandate to remediate this risk?

- A) Configure Security Groups to block all outbound traffic destined to `169.254.169.254`.
- B) Enforce Instance Metadata Service Version 2 (IMDSv2) on all EC2 instances by setting `HttpTokens=required`.
- C) Migrate application workloads from EC2 instances to Amazon S3 static website hosting.
- D) Attach an IAM permission boundary to the EC2 instance profile denying `sts:GetSessionToken`.

<details><summary>Answer</summary>

**B.** IMDSv2 mitigates SSRF attacks by requiring a session-oriented token acquired through an HTTP `PUT` request with custom headers (`X-aws-ec2-metadata-token-ttl-seconds`). SSRF attacks that exploit open reverse proxies or simple HTTP GET vulnerabilities cannot forge custom PUT headers. Requiring `HttpTokens=required` disables vulnerable IMDSv1.

- Why not A: Blocking `169.254.169.254` via Security Groups is impossible because link-local addresses are routed by the hypervisor and bypassing metadata prevents the AWS SDK from retrieving legitimate temporary credentials.
- Why not C: Amazon S3 static website hosting only serves static HTML/JS/CSS files and cannot run server-side dynamic application logic.
- Why not D: Instance profiles obtain credentials via `sts:AssumeRole` internally; denying `sts:GetSessionToken` does not block metadata credential extraction.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#1-ec2-nitro-hypervisor-imdsv2-and-instance-lifecycle), https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html

</details>

### Q-SAA-005 · Design Secure Architectures · difficulty 3 · scenario

An organization requires that Amazon S3 buckets in its production account allow read access only to requests originating from an Amazon CloudFront distribution, blocking direct internet access to the S3 bucket endpoints. Which mechanism should the architect implement?

- A) Configure Origin Access Control (OAC) on CloudFront and attach an S3 bucket policy allowing `s3:GetObject` only to the CloudFront service principal with a condition matching the distribution ARN.
- B) Configure an Origin Access Identity (OAI) and set the S3 bucket ACL to public-read.
- C) Place the S3 bucket inside a private VPC subnet and configure a CloudFront VPC origin.
- D) Whitelist CloudFront public IP CIDRs in the S3 bucket policy's `aws:SourceIp` condition.

<details><summary>Answer</summary>

**B.** Origin Access Control (OAC) is the modern AWS standard for securing CloudFront-to-S3 origin communications. It signs requests with SigV4, supports all AWS regions, supports SSE-KMS encryption, and allows fine-grained bucket policies using `aws:SourceArn` referencing the specific CloudFront distribution.

- Why not B: Origin Access Identity (OAI) is a legacy mechanism that does not support SSE-KMS or dynamic regions, and setting bucket ACLs to public-read exposes the bucket to the world.
- Why not C: Standard S3 buckets are regional public endpoints that cannot be placed inside private VPC subnets.
- Why not D: Whitelisting CloudFront public IP CIDR ranges requires maintaining brittle, dynamic IP lists and allows any CloudFront customer in AWS to access the bucket.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#9-origin-access-control-oac-for-cloudfront), https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html

</details>

### Q-SAA-006 · Design Secure Architectures · difficulty 2 · scenario

An enterprise needs to grant an external accounting firm temporary, programmatic access to download specific financial reports stored in an S3 bucket without creating IAM users or sharing permanent AWS credentials. How should this be accomplished?

- A) Create an IAM user for each external accountant and send them access keys via encrypted email.
- B) Generate presigned S3 URLs with a 30-minute expiration for each requested report and provide the URLs to the accounting firm.
- C) Enable Cross-Origin Resource Sharing (CORS) on the S3 bucket allowing `GET` methods from `*`.
- D) Disable S3 Block Public Access and configure a public bucket policy restricted by HTTP referer.

<details><summary>Answer</summary>

**B.** Presigned URLs allow S3 bucket owners to share objects temporarily using their own IAM credentials to cryptographically sign a URL via SigV4. The URL grants time-bounded `GET` permissions to anyone possessing it, expiring automatically without exposing credentials.

- Why not A: Creating long-term IAM users for external parties introduces credential lifecycle overhead, offboarding risks, and management complexity.
- Why not C: CORS headers govern browser cross-origin requests and do not bypass IAM authentication or authorize unauthenticated requests.
- Why not D: Disabling Block Public Access violates security standards and HTTP referer headers can be trivially spoofed by attackers.
- Ref: [modules/02-iam-in-depth-and-policy-evaluation.md](../modules/02-iam-in-depth-and-policy-evaluation.md#5-permission-boundaries-and-delegated-administration), https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html

</details>

### Q-SAA-007 · Design Secure Architectures · difficulty 3 · scenario

A company wants to ensure that its database credentials stored in AWS Secrets Manager are automatically rotated every 30 days without downtime for applications connecting via Amazon ECS. Which architecture should be deployed?

- A) Configure Secrets Manager automatic rotation using an AWS-managed Lambda rotation function within the database VPC, and update the application to retrieve secrets dynamically using the Secrets Manager SDK or caching client.
- B) Write an event-driven Step Functions state machine triggered by AWS Budgets to recreate database passwords and restart all ECS tasks.
- C) Store passwords in EC2 instance user-data scripts and run scheduled cron jobs to reboot instances every 30 days.
- D) Use AWS KMS to re-encrypt the database master key and restart the RDS instance.

<details><summary>Answer</summary>

**A.** AWS Secrets Manager supports automated rotation using Lambda functions executed within the database VPC to update credentials on both the database and Secrets Manager. Applications using the AWS SDK or Secrets Manager caching client fetch active credentials dynamically, ensuring zero downtime during rotations.

- Why not B: Restarting ECS tasks and coupling database credential rotation to billing budget triggers is fragile, disruptive, and risks service outages.
- Why not C: Hardcoding credentials in user data scripts exposes secrets in plaintext in the EC2 console and requires instance reboots.
- Why not D: Rotating a KMS key re-encrypts data encryption keys but does not change the database user password.
- Ref: [modules/10-security-governance-and-cryptography.md](../modules/10-security-governance-and-cryptography.md#6-aws-secrets-manager-automated-rotation-lifecycle), https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets.html

</details>

### Q-SAA-008 · Design Secure Architectures · difficulty 2 · scenario

A company's compliance policy mandates that objects stored in Amazon S3 must be protected against deletion or modification by any user, including the root user of the AWS account, for a retention period of 7 years. Which feature satisfies this requirement?

- A) S3 Object Lock configured in Compliance Mode with a 7-year retention period.
- B) S3 Object Lock configured in Governance Mode with an SCP denying delete actions.
- C) S3 Versioning with an S3 Lifecycle rule to transition noncurrent versions to Glacier Deep Archive.
- D) Multi-Factor Authentication Delete (MFA Delete) enabled on the S3 bucket.

<details><summary>Answer</summary>

**A.** S3 Object Lock in Compliance Mode enforces a strict Write Once, Read Many (WORM) storage model. In Compliance Mode, protected objects cannot be deleted, overwritten, or modified by any user—including the AWS account root user—until the retention period elapses.

- Why not B: In Governance Mode, users with specific IAM permissions (`s3:BypassGovernanceRetention`) or the root account can override or delete object retention settings.
- Why not C: S3 Lifecycle rules and Versioning do not prevent an authorized administrator from permanently deleting specific object versions.
- Why not D: MFA Delete requires MFA to delete versioned objects, but the account root user possessing root MFA can still execute deletions.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#5-s3-data-protection-object-lock-versioning-and-compliance), https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html

</details>

### Q-SAA-009 · Design Secure Architectures · difficulty 2 · scenario

An administrator attempts to troubleshoot access for an IAM user who has been granted the `AdministratorAccess` managed policy. When the user attempts to run `ec2:DescribeInstances`, they receive an `AccessDenied` error. What is the most likely cause of this issue?

- A) The EC2 instances are stopped.
- B) An SCP attached to the account's parent Organizational Unit contains an explicit Deny for EC2 actions.
- C) The IAM user has not configured AWS CLI auto-completion.
- D) The IAM user's credentials have been cached by Route 53 Resolver.

<details><summary>Answer</summary>

**B.** In AWS Organizations, Service Control Policies (SCPs) act as filtering guardrails above member accounts. An explicit Deny statement in an applicable SCP overrides all identity-based policies, including `AdministratorAccess`, within that member account.

- Why not A: Stopped instances return an instance state of `stopped` during `DescribeInstances` queries rather than an IAM `AccessDenied` error.
- Why not C: CLI auto-completion is a local shell productivity feature that has no impact on API authorization.
- Why not D: Route 53 Resolver resolves DNS domain names and does not cache or evaluate IAM security credentials.
- Ref: [modules/01-account-and-organization-model.md](../modules/01-account-and-organization-model.md#2-service-control-policies-scps-and-evaluation-boundaries), https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html

</details>

### Q-SAA-010 · Design Resilient Architectures · difficulty 2 · scenario

A critical payment processing application runs on EC2 instances behind an Application Load Balancer. The database is hosted on Amazon RDS for PostgreSQL. The company requires automatic failover with minimal downtime in the event of an Availability Zone outage. Which configuration should the architect select?

- A) Deploy the EC2 instances in an Auto Scaling Group across multiple AZs and configure RDS PostgreSQL with Multi-AZ deployment.
- B) Deploy EC2 instances in a single AZ with Read Replicas in two other AZs.
- C) Configure an Amazon RDS Single-AZ database and schedule automated hourly snapshots to S3.
- D) Create an Amazon EC2 Auto Scaling Group in one AZ and attach an Elastic IP address to the RDS database.

<details><summary>Answer</summary>

**A.** Deploying EC2 instances across multiple Availability Zones in an Auto Scaling Group ensures compute tier resiliency. Enabling Amazon RDS Multi-AZ synchronously replicates data to a standby instance in a different AZ, providing automatic database failover (typically within 60–120 seconds) via dynamic DNS endpoint flipping if the primary AZ fails.

- Why not B: Standard RDS Read Replicas use asynchronous replication and require manual intervention or custom scripts to promote to primary during outages.
- Why not C: Single-AZ RDS with hourly snapshots provides an RPO of up to 1 hour and requires manual restoration of a new DB instance, resulting in hours of RTO downtime.
- Why not D: Single-AZ compute provides no redundancy, and RDS databases cannot have Elastic IP addresses directly attached for automatic multi-AZ failover.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#1-vpc-architecture-subnet-topology-and-az-physical-mapping), https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html

</details>

### Q-SAA-011 · Design Resilient Architectures · difficulty 2 · scenario

A high-volume e-commerce application experiences order drops during flash sales because the backend relational database cannot handle concurrent write spikes. The order submission process must be decoupled to ensure that no customer orders are lost. Which architecture provides the most resilient solution?

- A) Write orders directly to an Amazon SQS standard queue and process orders asynchronously using an Auto Scaling group of worker EC2 instances or Lambda functions.
- B) Increase the instance size of the RDS database to `db.m6i.32xlarge` before every flash sale.
- C) Store orders temporarily in browser local storage and sync to RDS when traffic subsides.
- D) Place an Application Load Balancer directly in front of the RDS database to buffer incoming SQL connections.

<details><summary>Answer</summary>

**A.** Decoupling the frontend web tier from the database tier using Amazon SQS buffers unpredictable write spikes. The queue stores messages durably across multiple Availability Zones, allowing downstream worker instances or Lambda consumers to process orders at a controlled, sustainable rate without dropping orders.

- Why not B: Vertically scaling RDS instances introduces downtime, cost inefficiency, and does not provide architectural resilience against unexpected flash traffic surges.
- Why not C: Browser local storage is client-side, ephemeral, and loses customer orders if users clear browser data, close tabs, or experience device failures.
- Why not D: Application Load Balancers operate at Layer 7 for HTTP/HTTPS protocols and cannot load-balance or buffer raw PostgreSQL database connections.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#3-auto-scaling-groups-lifecycle-hooks-and-warm-pools), https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html

</details>

### Q-SAA-012 · Design Resilient Architectures · difficulty 3 · scenario

A photo editing application processes uploaded images using worker EC2 instances pulling tasks from an Amazon SQS queue. Occasionally, malformed images crash the processing worker, causing the message to return to the queue and be reprocessed indefinitely, blocking other tasks. How should this failure mode be resolved?

- A) Increase the SQS visibility timeout to 12 hours.
- B) Configure an SQS Dead-Letter Queue (DLQ) with a `maxReceiveCount` threshold on the source queue.
- C) Delete the source queue and replace it with an SNS topic.
- D) Enable message deduplication IDs on an SQS standard queue.

<details><summary>Answer</summary>

**B.** A Dead-Letter Queue (DLQ) isolates "poison pill" messages that fail consumption repeatedly. When a message's receive count exceeds the configured `maxReceiveCount`, SQS automatically routes the message to the DLQ, unblocking the worker pool and preserving the failed message for offline inspection.

- Why not A: Increasing the visibility timeout merely delays the repeated crash cycle and worsens overall queue latency.
- Why not C: SNS topics distribute messages via pub/sub fan-out without queuing or backpressure capabilities and cannot isolate failing messages.
- Why not D: Message deduplication IDs are exclusive to SQS FIFO queues and prevent duplicate message submission within a 5-minute window; they do not isolate poison pill messages.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#7-lambda-firecracker-microvms-concurrency-and-snapstart), https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html

</details>

### Q-SAA-013 · Design Resilient Architectures · difficulty 2 · scenario

An enterprise deploys an internal web application across two Availability Zones behind an Application Load Balancer. The company wants to ensure that incoming client traffic is evenly distributed across all backend EC2 instances, even if one AZ contains 4 instances and the other AZ contains 2 instances. Which ALB feature must be enabled?

- A) Sticky Sessions (Cookie affinity).
- B) Cross-Zone Load Balancing.
- C) Path-based routing rules.
- D) AWS Global Accelerator.

<details><summary>Answer</summary>

**B.** When Cross-Zone Load Balancing is enabled on an Application Load Balancer (enabled by default on ALBs), each load balancer node distributes traffic evenly across all registered targets in all enabled Availability Zones, ensuring balanced target utilization regardless of asymmetric instance counts per zone.

- Why not A: Sticky sessions bind a user's session to a specific target instance, which can create unbalanced utilization rather than equal distribution.
- Why not C: Path-based routing routes requests based on the URL path (`/api` vs `/static`) and does not balance traffic across asymmetric targets.
- Why not D: AWS Global Accelerator routes external client traffic across the global AWS edge network to regional ALB endpoints; it does not distribute traffic between targets behind an ALB.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#1-vpc-architecture-subnet-topology-and-az-physical-mapping), https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#cross-zone-load-balancing

</details>

### Q-SAA-014 · Design Resilient Architectures · difficulty 3 · scenario

A global media platform requires a multi-region disaster recovery architecture with an RTO of under 10 minutes and an RPO of under 1 minute for its relational database backend. Which architecture best fulfills these strict recovery objectives?

- A) Deploy Amazon Aurora Global Database with the primary cluster in the primary region and a secondary cluster in the recovery region.
- B) Export Amazon RDS PostgreSQL daily snapshots to an S3 bucket in a secondary region using AWS Backup.
- C) Use Amazon S3 Cross-Region Replication to mirror database transaction logs and replay them manually during a disaster.
- D) Configure an EC2 Auto Scaling group spanning two AWS Regions with shared EBS multi-attach volumes.

<details><summary>Answer</summary>

**A.** Amazon Aurora Global Database uses dedicated storage-level replication infrastructure to replicate database writes across AWS regions with typical latency under 1 second (satisfying the 1-minute RPO). In a regional disaster, a secondary cluster can be promoted to a full read-write cluster in under 1 minute (satisfying the 10-minute RTO).

- Why not B: Daily snapshots provide an RPO of up to 24 hours, and restoring a new RDS instance from a snapshot in another region takes 30–60 minutes or more.
- Why not C: Manually replaying S3-replicated WAL logs is error-prone, highly complex, and cannot reliably meet a 10-minute RTO.
- Why not D: Auto Scaling groups and EBS multi-attach volumes cannot span across distinct AWS Regions.
- Ref: [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#4-aurora-scaling-read-replicas-and-global-database), https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html

</details>

### Q-SAA-015 · Design Resilient Architectures · difficulty 2 · scenario

A web application uses Amazon Route 53 for public DNS resolution. The architecture includes an active-passive failover configuration between a primary application stack in `us-east-1` and a disaster recovery stack in `us-west-2`. How should Route 53 be configured to automate failover?

- A) Create Route 53 Weighted routing records with weights of 50 for both regions.
- B) Create Route 53 Failover routing records associated with Route 53 health checks monitoring the primary stack's ALB endpoint.
- C) Create a Route 53 Latency-based routing record pointing to both ALBs.
- D) Use Route 53 Geolocation routing to route all global traffic to the secondary region.

<details><summary>Answer</summary>

**B.** Route 53 Failover routing records enable active-passive disaster recovery. The primary record is associated with a Route 53 health check that continuously monitors the health of the primary ALB. When the health check fails, Route 53 automatically stops serving the primary IP and routes queries to the secondary (passive) standby record.

- Why not A: Weighted routing splits traffic proportionally in an active-active setup and does not automatically redirect 100% of traffic during an outage unless complex health check associations are configured.
- Why not C: Latency-based routing directs users to the region with the lowest network latency, which still routes nearby users to a failed primary stack.
- Why not D: Geolocation routing routes traffic based on the geographic location of the DNS query and does not react to application health failures.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#7-hybrid-dns-resolution-with-route-53-resolver), https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-failover.html

</details>

### Q-SAA-016 · Design Resilient Architectures · difficulty 2 · scenario

An Auto Scaling Group needs to scale out preemptively before predictable recurring traffic spikes every Monday morning at 09:00 UTC. What is the most reliable and cost-effective scaling policy to configure?

- A) A Target Tracking scaling policy tracking average CPU utilization at 50%.
- B) A Scheduled Scaling action configured to adjust minimum and desired capacity every Monday at 08:30 UTC.
- C) A Step Scaling policy linked to a CloudWatch alarm evaluating NetworkIn metrics.
- D) A manual scaling script executed by an operator every Monday morning.

<details><summary>Answer</summary>

**B.** Scheduled Scaling actions in EC2 Auto Scaling allow engineers to scale capacity based on predictable date and time patterns. Configuring a scheduled action to increase desired capacity 30 minutes before recurring peak traffic ensures instances are initialized, warmed, and healthy before traffic arrives.

- Why not A: Target tracking is reactive; during sharp traffic spikes, instances take several minutes to launch and pass health checks, causing transient performance degradation.
- Why not C: Step scaling is also reactive and triggers only after CloudWatch alarm thresholds are breached.
- Why not D: Manual intervention violates operational excellence principles and is prone to human delay or omission.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#3-auto-scaling-groups-lifecycle-hooks-and-warm-pools), https://docs.aws.amazon.com/autoscaling/ec2/userguide/schedule_time.html

</details>

### Q-SAA-017 · Design Resilient Architectures · difficulty 2 · scenario

A legacy monolithic application running on an EC2 instance writes transaction state to a local EBS volume. The company wants to improve availability so that if the underlying EC2 physical host suffers a hardware failure, the instance recovers automatically with the same IP and storage. Which feature accomplishes this?

- A) AWS CloudFormation Drift Detection.
- B) Amazon EC2 Instance Auto-Recovery triggered by a CloudWatch `StatusCheckFailed_System` alarm.
- C) AWS Elastic Beanstalk worker environments.
- D) An S3 Event Notification configured on instance state change.

<details><summary>Answer</summary>

**B.** Amazon EC2 Auto-Recovery automatically recovers an instance to a new underlying hardware host if the system status check fails (`StatusCheckFailed_System`). The recovered instance retains its original instance ID, private IP addresses, Elastic IP addresses, and EBS volume attachments.

- Why not A: CloudFormation Drift Detection identifies changes made to infrastructure outside CloudFormation templates and does not recover failing hardware.
- Why not C: Elastic Beanstalk is a PaaS deployment service and does not manage bare EC2 host recovery for legacy stateful monoliths.
- Why not D: S3 event notifications respond to object creations inside S3 buckets and cannot monitor EC2 hypervisor hardware status.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#1-ec2-nitro-hypervisor-imdsv2-and-instance-lifecycle), https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-recover.html

</details>

### Q-SAA-018 · Design High-Performing Architectures · difficulty 3 · scenario

A real-time financial trading platform requires high-throughput, single-digit millisecond latency data storage for active trading sessions. The data access pattern requires key-value lookups by session ID. Which database service best meets this performance specification?

- A) Amazon RDS for MySQL with Multi-AZ enabled.
- B) Amazon DynamoDB configured with on-demand capacity and DynamoDB Accelerator (DAX) for microsecond in-memory caching.
- C) Amazon Redshift provisioned with dense storage nodes.
- D) Amazon S3 Standard configured with S3 Transfer Acceleration.

<details><summary>Answer</summary>

**B.** Amazon DynamoDB natively delivers consistent single-digit millisecond response times at any scale. Adding DynamoDB Accelerator (DAX) provides an in-memory hardware cache cluster that accelerates read responses down to microseconds for high-throughput, latency-critical key-value workloads.

- Why not A: RDS MySQL involves relational query parsing, connection overhead, and disk I/O latency that cannot guarantee sub-millisecond in-memory response times.
- Why not C: Amazon Redshift is an OLAP columnar data warehouse designed for complex analytical queries, not real-time OLTP session lookups.
- Why not D: Amazon S3 Transfer Acceleration optimizes WAN uploads over CloudFront edge locations, but S3 object retrieval latencies are tens to hundreds of milliseconds.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#7-lambda-firecracker-microvms-concurrency-and-snapstart), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.html

</details>

### Q-SAA-019 · Design High-Performing Architectures · difficulty 2 · scenario

A batch analytics workload processes hundreds of gigabytes of geospatial imagery stored in Amazon S3. The processing cluster consists of dozens of EC2 instances running parallel Python scripts. The instances report S3 `503 Slow Down` throttling errors during job initiation. How can the solutions architect resolve this bottleneck?

- A) Consolidate all imagery files into a single large ZIP archive inside the S3 bucket.
- B) Distribute imagery files across multiple distinct S3 key prefixes (e.g., partitioning by hash or date).
- C) Request that AWS Support convert the S3 bucket into an EBS gp3 volume.
- D) Enable S3 Versioning on the bucket.

<details><summary>Answer</summary>

**B.** Amazon S3 scales request throughput automatically per prefix, supporting at least 3,500 PUT/POST/DELETE and 5,500 GET/HEAD requests per second per prefix. Distributing files across distinct prefixes partitions the storage namespace across distinct internal storage partitions, multiplying total achievable throughput.

- Why not A: Consolidating files into a single archive concentrates access into a single key, worsening bottlenecks and preventing parallel chunk downloads.
- Why not C: S3 buckets cannot be converted into EBS volumes; EBS volumes are block devices attachable to single EC2 instances in a single AZ.
- Why not D: S3 Versioning retains multiple variants of objects and does not alter S3 prefix request rate quotas.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#3-vpc-endpoints-gateway-endpoints-vs-privatelink-interface-endpoints), https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html

</details>

### Q-SAA-020 · Design High-Performing Architectures · difficulty 2 · scenario

A web application serves dynamic API endpoints to users distributed globally across Europe, Asia, and North America. The backend application runs in a single AWS Region (`eu-west-1`). Users in distant regions experience high latency during the initial TCP and TLS connection establishment handshakes. Which service minimizes this network latency?

- A) AWS Global Accelerator.
- B) Amazon Route 53 Weighted Routing.
- C) Amazon VPC Peering.
- D) AWS Storage Gateway.

<details><summary>Answer</summary>

**A.** AWS Global Accelerator provides static Anycast IP addresses that route traffic into the nearest AWS edge point of presence (PoP). TCP and TLS handshakes are terminated at the edge PoP close to the user, and traffic is routed across AWS's private, congestion-free global fiber backbone directly to regional endpoints, drastically reducing connection establishment latency.

- Why not B: Route 53 Weighted routing directs DNS queries proportionally but does not terminate TCP/TLS connections at the edge or accelerate network transit.
- Why not C: VPC Peering connects VPCs to each other and does not accelerate internet ingress traffic from global public clients.
- Why not D: AWS Storage Gateway connects on-premises storage appliances to AWS cloud storage and is unrelated to public API traffic acceleration.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#10-aws-global-accelerator-for-anycast-routing), https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html

</details>

### Q-SAA-021 · Design High-Performing Architectures · difficulty 3 · scenario

A machine learning training cluster requires distributed shared file storage accessible concurrently by hundreds of Linux EC2 instances. The storage must deliver sub-millisecond latencies, millions of IOPS, and hundreds of gigabytes per second of throughput with POSIX file system compliance. Which storage service should be selected?

- A) Amazon S3 Glacier Flexible Retrieval.
- B) Amazon FSx for Lustre.
- C) Amazon Elastic Block Store (EBS) General Purpose SSD (`gp3`).
- D) AWS Storage Gateway Volume Gateway.

<details><summary>Answer</summary>

**B.** Amazon FSx for Lustre is a high-performance POSIX-compliant parallel file system optimized for compute-intensive workloads such as machine learning, high-performance computing (HPC), and financial modeling. It provides sub-millisecond latencies, scales to millions of IOPS, and links directly with Amazon S3.

- Why not A: S3 Glacier Flexible Retrieval is an archival storage tier with retrieval times ranging from minutes to hours, entirely unsuitable for live ML cluster storage.
- Why not C: EBS gp3 volumes are block storage devices attachable to single instances (unless using io2 multi-attach, which does not provide a distributed shared POSIX file system for hundreds of hosts).
- Why not D: Storage Gateway connects on-premises environments to cloud storage and does not provide ultra-high-throughput HPC parallel storage.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#9-amazon-efs-distributed-posix-shared-file-system), https://docs.aws.amazon.com/fsx/latest/LustreGuide/what-is.html

</details>

### Q-SAA-022 · Design High-Performing Architectures · difficulty 2 · scenario

An Amazon RDS for PostgreSQL database experiences high CPU utilization due to an overwhelming volume of read-only analytical queries executed by reporting dashboards. Write transactions are low but are suffering latency penalties due to read contention. What architectural modification should the architect implement?

- A) Migrate the database to an Amazon DynamoDB table.
- B) Create one or more RDS PostgreSQL Read Replicas and point the reporting dashboards to the read replica endpoints.
- C) Enable RDS Multi-AZ synchronous replication and route read queries to the standby instance.
- D) Scale down the primary DB instance to throttle reporting queries.

<details><summary>Answer</summary>

**B.** Creating RDS Read Replicas offloads read-only query traffic from the primary DB instance. Read replicas use asynchronous replication to keep read data synchronized, freeing primary CPU resources for transactional writes.

- Why not A: Migrating a relational database supporting complex reporting queries to DynamoDB requires complete data model rewrites and may not support arbitrary SQL analytical joins.
- Why not C: In a standard RDS Multi-AZ deployment, the secondary standby instance is passive, does not accept client connections, and cannot serve read traffic.
- Why not D: Scaling down the primary instance reduces available CPU and memory, worsening latency and outages for both reads and writes.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#1-vpc-architecture-subnet-topology-and-az-physical-mapping), https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html

</details>

### Q-SAA-023 · Design High-Performing Architectures · difficulty 2 · scenario

A video streaming platform hosts static video thumbnails in Amazon S3. Due to viral traffic, millions of users frequently request the same popular thumbnails, causing high S3 read costs and latency. What is the most effective way to improve performance and reduce cost?

- A) Configure an Amazon CloudFront distribution in front of the S3 bucket to cache popular thumbnails at edge locations.
- B) Upgrade the S3 bucket to S3 Glacier Instant Retrieval.
- C) Replicate the S3 bucket to 10 different AWS Regions using Cross-Region Replication.
- D) Add an Auto Scaling group of EC2 reverse proxies to download and cache images on local instance storage.

<details><summary>Answer</summary>

**A.** Amazon CloudFront is a Content Delivery Network (CDN) that caches content at edge locations worldwide. Placing CloudFront in front of S3 caches popular video thumbnails close to viewers, drastically reducing time-to-first-byte (TTFB) latency and eliminating S3 GET request fees on cache hits.

- Why not B: S3 Glacier Instant Retrieval has higher retrieval costs per GB and is designed for rarely accessed data (accessed once per quarter), making it cost-prohibitive for popular thumbnails.
- Why not C: Replicating data to 10 regions incurs massive inter-region data transfer and replication storage fees without providing edge caching benefits.
- Why not D: Managing custom EC2 reverse proxy fleets introduces operational overhead, maintenance burdens, and higher compute costs than serverless CloudFront edge caching.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#9-origin-access-control-oac-for-cloudfront), https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html

</details>

### Q-SAA-024 · Design High-Performing Architectures · difficulty 2 · scenario

A high-performance computing application on EC2 requires maximum network throughput and low inter-node latency between cluster instances communicating via Message Passing Interface (MPI). What instance placement strategy should the architect specify?

- A) Cluster Placement Group.
- B) Spread Placement Group.
- C) Partition Placement Group.
- D) Multi-AZ Auto Scaling Group.

<details><summary>Answer</summary>

**A.** A Cluster Placement Group packs instances close together inside an Availability Zone. This strategy enables applications to participate in a low-latency network with high per-flow throughput (up to 100 Gbps on supported instance types), ideal for tightly coupled HPC and MPI workloads.

- Why not B: A Spread Placement Group places instances on distinct physical hardware racks to reduce correlated failures, which increases inter-node latency.
- Why not C: A Partition Placement Group divides instances into logical partitions across distinct racks, primarily designed for distributed big data workloads like HDFS or Cassandra.
- Why not D: Multi-AZ placement introduces cross-AZ inter-data-center latency (typically 1–2 ms), which violates tight HPC network coupling requirements.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#1-ec2-nitro-hypervisor-imdsv2-and-instance-lifecycle), https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-groups.html#placement-groups-cluster

</details>

### Q-SAA-025 · Design Cost-Optimized Architectures · difficulty 2 · scenario

An analytics application writes millions of log files to Amazon S3 every day. The logs are accessed frequently during the first 30 days for debugging, rarely accessed between 30 and 90 days, and must be retained for 7 years for compliance without requiring immediate retrieval after 90 days. Which S3 Lifecycle configuration is most cost-effective?

- A) Keep objects in S3 Standard for 7 years, then delete.
- B) Transition objects to S3 Standard-IA after 30 days, transition to S3 Glacier Flexible Retrieval after 90 days, and expire objects after 2,555 days (7 years).
- C) Transition objects immediately to S3 Glacier Deep Archive upon upload.
- D) Transition objects to S3 One Zone-IA after 30 days and keep indefinitely.

<details><summary>Answer</summary>

**B.** Storing actively queried data in S3 Standard for 30 days avoids retrieval fees. Transitioning to S3 Standard-Infrequent Access (IA) at 30 days lowers storage costs while maintaining millisecond access. Transitioning to S3 Glacier Flexible Retrieval at 90 days drastically reduces long-term archival storage costs, and automated expiration at 7 years enforces compliance.

- Why not A: Retaining millions of rarely accessed objects in S3 Standard for 7 years results in excessive, unnecessary storage expenditure.
- Why not C: Transitioning immediately to Glacier Deep Archive incurs minimum storage duration charges (180 days) and makes first-month debugging queries slow and expensive due to retrieval fees.
- Why not D: S3 One Zone-IA lacks multi-AZ redundancy, risking data loss, and keeping logs indefinitely fails to clean up expired compliance data.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#4-s3-storage-class-hierarchy--intelligent-tiering), https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html

</details>

### Q-SAA-026 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A fleet of backend worker EC2 instances in private subnets downloads multi-terabyte data dumps from Amazon S3 daily. The company notices exorbitant monthly charges for AWS NAT Gateways. How can the solutions architect eliminate these data processing charges?

- A) Assign public IPv4 addresses to all private EC2 worker instances.
- B) Provision a Gateway VPC Endpoint for Amazon S3 in the VPC and associate it with the private subnet route tables.
- C) Replace the NAT Gateway with a NAT instance running on an EC2 `t4g.nano` instance.
- D) Migrate the worker instances to AWS Lambda functions without a VPC.

<details><summary>Answer</summary>

**B.** Gateway VPC Endpoints for Amazon S3 provide a private route directly from subnets to S3 across the internal AWS network fabric. Gateway VPC endpoints are provided at no additional charge and incur no per-GB data processing fees, completely eliminating NAT Gateway data transfer charges for S3 traffic.

- Why not A: Assigning public IP addresses to backend worker instances exposes them directly to internet ingress risks, violating security best practices.
- Why not C: A `t4g.nano` NAT instance cannot handle multi-terabyte throughput, will introduce severe network bottlenecks, and still incurs EC2 run charges.
- Why not D: Multi-terabyte data dump processing exceeds Lambda execution time limits (15 minutes) and memory/disk storage capacities.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#3-vpc-endpoints-gateway-endpoints-vs-privatelink-interface-endpoints), https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html

</details>

### Q-SAA-027 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A company runs a stateless containerized web service on Amazon ECS that experiences unpredictable traffic spikes. The application can tolerate occasional task interruptions and container restarts. Which capacity configuration minimizes compute costs?

- A) Provision dedicated EC2 On-Demand instances.
- B) Configure an ECS Capacity Provider utilizing Fargate Spot.
- C) Purchase 3-year all-upfront EC2 Reserved Instances for peak capacity.
- D) Run the containers on Amazon EC2 instances utilizing Dedicated Hosts.

<details><summary>Answer</summary>

**B.** AWS Fargate Spot runs containerized tasks on spare AWS compute capacity at up to a 70% discount compared to standard Fargate pricing. Because the application is stateless and resilient to task interruptions, Fargate Spot provides optimal cost reduction without managing underlying EC2 virtual machines.

- Why not A: Dedicated On-Demand instances charge full standard hourly rates and do not take advantage of spare capacity discounts.
- Why not C: Purchasing 3-year upfront RIs for peak capacity locks capital into idle, unutilized capacity during off-peak periods.
- Why not D: Dedicated Hosts are designed for compliance or proprietary per-core licensing constraints and represent the most expensive EC2 tenancy model.
- Ref: [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#5-ecs-fargate-container-networking-and-capacity-providers), https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html

</details>

### Q-SAA-028 · Design Cost-Optimized Architectures · difficulty 3 · scenario

An enterprise has a predictable baseline compute footprint consisting of 50 Linux virtual machines running continuously 24/7 across multiple EC2 instance families (m6i, c6i, r6i) and plans to migrate parts of the workload to AWS Lambda and Fargate over the next 3 years. Which discount model provides the highest flexibility and cost savings?

- A) Standard EC2 Reserved Instances.
- B) Compute Savings Plans.
- C) EC2 Instance Savings Plans.
- D) Spot Fleets with diversified allocation strategy.

<details><summary>Answer</summary>

**B.** Compute Savings Plans offer significant savings (up to 66%) in exchange for a commitment to a consistent amount of compute usage (measured in $/hour) for a 1- or 3-year term. Unlike EC2 Instance Savings Plans or Standard RIs, Compute Savings Plans apply automatically across EC2 instance families, operating systems, regions, and critically across Fargate and Lambda compute runtimes.

- Why not A: Standard Reserved Instances are tied to specific instance families, sizes, and regions, offering zero flexibility for migrations to Fargate or Lambda.
- Why not C: EC2 Instance Savings Plans are tied to specific instance families in a specific region and do not apply discounts to Fargate or Lambda usage.
- Why not D: Spot Fleets can be interrupted with 2 minutes notice and are unsuitable for predictable 24/7 baseline stateful workloads.
- Ref: [modules/14-cost-optimization-finops-and-version-history.md](../modules/14-cost-optimization-finops-and-version-history.md#4-compute-optimization-compute-optimizer-commitments-and-spot-fleets), https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html

</details>

### Q-SAA-029 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A data science team periodically runs big data batch rendering jobs that take 4 hours to complete. If a rendering job is interrupted, it can easily restart from checkpoint files stored in Amazon S3. What EC2 purchasing option provides the steepest cost discount for this fault-tolerant workload?

- A) On-Demand Instances.
- B) Spot Instances.
- C) Convertible Reserved Instances.
- D) Dedicated Instances.

<details><summary>Answer</summary>

**B.** EC2 Spot Instances allow customers to purchase unused EC2 capacity at steep discounts (up to 90% off On-Demand rates). Because the batch job can restart from checkpoints upon interruption, Spot Instances provide the most cost-effective compute platform.

- Why not A: On-Demand instances pay the maximum standard price and offer no discounts for batch jobs that can tolerate interruptions.
- Why not C: Convertible RIs require a 1-year or 3-year continuous commitment and are meant for steady-state workloads, not periodic batch rendering.
- Why not D: Dedicated Instances run on hardware dedicated to a single customer, incurring an additional per-region dedicated tenancy fee and full On-Demand pricing.
- Ref: [modules/14-cost-optimization-finops-and-version-history.md](../modules/14-cost-optimization-finops-and-version-history.md#4-compute-optimization-compute-optimizer-commitments-and-spot-fleets), https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html

</details>

### Q-SAA-030 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A company operates hundreds of DynamoDB tables. Most tables receive low, intermittent traffic with occasional unpredictable spikes. The current provisioned read/write capacity units are consistently underutilized, yet the company pays for allocated capacity 24/7. How can the database costs be immediately optimized?

- A) Switch the DynamoDB tables to On-Demand capacity mode.
- B) Create Global Secondary Indexes on every table.
- C) Migrate the DynamoDB data to an Amazon Redshift cluster.
- D) Enable DynamoDB Streams and replicate to Amazon S3.

<details><summary>Answer</summary>

**A.** DynamoDB On-Demand capacity mode charges strictly for the read and write requests executed by the application (pay-per-request). For workloads with unpredictable, intermittent, or low average utilization, on-demand capacity eliminates paying for idle provisioned capacity.

- Why not B: Adding Global Secondary Indexes creates additional storage and consumes extra write capacity units on every update, increasing costs.
- Why not C: Redshift is an expensive analytical data warehouse with high baseline cluster node costs, completely unsuitable for transactional NoSQL workloads.
- Why not D: Enabling Streams and replicating to S3 incurs additional stream read charges, Lambda invocation costs, and S3 storage costs.
- Ref: [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#4-capacity-modes-bursting-and-hot-partitions), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html

</details>

### Q-SAA-031 · Design Secure Architectures · difficulty 2 · scenario

A company accepts daily data drops from third-party vendor AWS accounts into an Amazon S3 bucket. Currently, objects uploaded by vendors cannot be read by the bucket owner unless the vendor explicitly grants object ACL permissions. The security team mandates that object ACLs must be disabled entirely and the bucket owner must automatically own all uploaded objects. What should the solutions architect configure?

- A) Create an S3 Lifecycle rule to transition all objects to S3 Glacier Instant Retrieval.
- B) Enable the Bucket Owner Enforced setting for S3 Object Ownership on the target bucket.
- C) Create a Cross-Region Replication (CRR) rule to copy objects to a secondary bucket.
- D) Attach an IAM permission boundary to the third-party IAM roles.

<details><summary>Answer</summary>

**B.** The Bucket Owner Enforced setting in Amazon S3 Object Ownership disables legacy Access Control Lists (ACLs) bucket-wide. When enabled, any object uploaded to the bucket—regardless of the uploader's AWS account—is automatically owned by the bucket owner, simplifying permissions strictly to bucket and IAM policies.

- Why not A: S3 Lifecycle transitions change storage tiers but do not alter object ownership or disable ACLs.
- Why not C: Replication rules do not solve ownership permissions on incoming raw objects if the bucket owner lacks initial read access under legacy ACLs.
- Why not D: IAM permission boundaries limit maximum permissions for identities within the vendor's account, not object ownership inside the customer's bucket.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#6-replication-mechanics-cross-region-crr-and-same-region-srr), https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html

</details>

### Q-SAA-032 · Design Secure Architectures · difficulty 3 · scenario

A financial services firm must archive transaction records in Amazon S3 for exactly 7 years to satisfy SEC Rule 17a-4 regulations. During this 7-year retention period, records must be completely immutable: no user, administrator, or AWS root account principal may delete or overwrite the objects, nor shorten the retention duration. Which configuration achieves this compliance standard?

- A) S3 Object Lock configured in Governance Mode with a 7-year retention period.
- B) An S3 Bucket Policy with an explicit Deny for `s3:DeleteObject` for all principals except the root user.
- C) S3 Object Lock configured in Compliance Mode with a 7-year retention period.
- D) S3 Legal Hold applied to each object version upon upload.

<details><summary>Answer</summary>

**C.** S3 Object Lock in Compliance Mode enforces strict Write-Once-Read-Many (WORM) storage. Once applied, no IAM principal—including the AWS Account Root User and AWS Support—can delete or overwrite the object version, or shorten the retention period, until the 7-year retention period elapses.

- Why not A: Governance mode permits users with the `s3:BypassGovernanceRetention` permission to bypass or delete locked objects before the retention period expires.
- Why not B: An S3 bucket policy can be modified or deleted by an IAM administrator or root user possessing bucket policy permissions.
- Why not D: A Legal Hold does not have an expiration date and can be removed at any time by a user with `s3:PutObjectLegalHold` permission.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#5-s3-data-protection-object-lock-versioning-and-compliance), https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html

</details>

### Q-SAA-033 · Design Secure Architectures · difficulty 2 · scenario

A mobile application allows users to upload profile pictures directly to an Amazon S3 bucket. The backend API runs on AWS Lambda and generates S3 presigned URLs with an expiration duration parameter of 2 hours (`expiresIn: 7200`). However, mobile clients report that uploads fail with HTTP 403 Forbidden after 1 hour. What is the root cause of this failure?

- A) S3 presigned URLs have a hard, unalterable protocol limit of 15 minutes.
- B) The Lambda function's IAM execution role uses temporary STS credentials whose lifetime expires after 1 hour, invalidating the presigned signature.
- C) S3 bucket CORS configuration blocks uploads lasting longer than 3,600 seconds.
- D) The mobile client must authenticate using AWS Cognito Identity Pools instead of Lambda.

<details><summary>Answer</summary>

**B.** When an IAM role (such as a Lambda execution role) generates a presigned URL, the signature incorporates temporary security credentials issued by AWS STS. The presigned URL's maximum lifetime is strictly bounded by the underlying STS token expiration (default 1 hour). Even if the code specifies 2 hours, the signature becomes invalid the moment the STS token expires.

- Why not A: Presigned URLs support expirations up to 7 days when signed by IAM users, and up to the temporary STS token lifetime for roles.
- Why not C: CORS headers govern cross-origin browser headers, not presigned URL signature validity.
- Why not D: Cognito identity pools also issue temporary STS credentials and do not change the cryptographic boundary of STS session lifetimes.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#7-presigned-urls-and-sigv4-cryptographic-delegation), https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html

</details>

### Q-SAA-034 · Design Secure Architectures · difficulty 2 · scenario

A serverless application running on AWS Lambda connects to an Amazon Aurora PostgreSQL database. The security team mandates that database credentials must never be hardcoded in application code or environment variables, passwords must rotate automatically every 30 days without application downtime, and Lambda functions must authenticate without database passwords. Which solution satisfies these requirements?

- A) Store database passwords in AWS Systems Manager Parameter Store as PlainText and use an EventBridge rule to update Lambda environment variables.
- B) Deploy an Amazon RDS Proxy with IAM authentication enabled, storing backend database credentials in AWS Secrets Manager with automated rotation.
- C) Attach an IAM database authentication policy directly to the Aurora PostgreSQL instance and disable master passwords.
- D) Use AWS KMS to decrypt database passwords during the Lambda Init Phase from a local configuration file.

<details><summary>Answer</summary>

**B.** Deploying Amazon RDS Proxy allows Lambda functions to authenticate to the proxy using temporary IAM tokens rather than passwords. RDS Proxy retrieves and caches backend database credentials securely from AWS Secrets Manager, which handles automated 30-day password rotation transparently with zero client downtime.

- Why not A: Storing plaintext passwords violates security best practices, and updating environment variables forces Lambda cold starts and code restarts.
- Why not C: Direct IAM authentication to Aurora does not pool or multiplex connections, leading to connection exhaustion during serverless traffic bursts.
- Why not D: Storing passwords in configuration files—even encrypted—requires redeploying Lambda functions when credentials rotate and risks credential sprawl.
- Ref: [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#5-amazon-rds-proxy-connection-pooling-and-resilient-multiplexing), https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html

</details>

### Q-SAA-035 · Design Secure Architectures · difficulty 3 · scenario

A gaming company builds a multi-player backend using Amazon DynamoDB. The architecture team wants mobile clients to query their own player profile item directly from DynamoDB using temporary credentials issued by Amazon Cognito, while strictly preventing players from reading or updating other players' profiles. Which IAM policy mechanism enforces this row-level security?

- A) Attach an S3 bucket policy to the DynamoDB table ARN specifying the player's Cognito identity ID.
- B) Configure an IAM policy with a `Condition` evaluating `dynamodb:LeadingKeys` matching `${cognito-identity.amazonaws.com:sub}`.
- C) Create a separate DynamoDB table for every registered player.
- D) Enable DynamoDB Streams and trigger a Lambda function to rollback unauthorized partition modifications.

<details><summary>Answer</summary>

**B.** DynamoDB supports fine-grained access control using IAM policy conditions. The `dynamodb:LeadingKeys` condition key restricts access strictly to items whose partition key matches the caller's identity attribute (such as their Cognito identity ID `${cognito-identity.amazonaws.com:sub}`), enforcing row-level security at the database engine boundary.

- Why not A: S3 bucket policies apply exclusively to Amazon S3 buckets and cannot be attached to Amazon DynamoDB tables.
- Why not C: Creating dedicated tables for millions of players exceeds account limits, incurs massive management overhead, and breaks single-table architecture.
- Why not D: Reactive rollback via DynamoDB Streams occurs asynchronously after data has already been modified or read, failing to provide preventive authorization.
- Ref: [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#1-amazon-dynamodb-core-architecture--storage-engine), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/specifying-conditions.html

</details>

### Q-SAA-036 · Design Secure Architectures · difficulty 2 · scenario

An enterprise deploys an Amazon Managed Streaming for Apache Kafka (Amazon MSK) cluster across three Availability Zones. The security team mandates that client microservices must authenticate to the Kafka brokers using temporary AWS credentials without managing static usernames, passwords, or SSL client certificates. Which authentication mechanism fulfills this mandate?

- A) SASL/SCRAM authentication backed by an unencrypted text file stored in Amazon S3.
- B) AWS IAM Client Authentication using Signature Version 4 (SigV4) request signing.
- C) Basic HTTP authentication over an unencrypted public endpoint.
- D) Amazon Cognito user pools integrated directly with the Kafka broker port 9092.

<details><summary>Answer</summary>

**B.** Amazon MSK supports AWS IAM Client Authentication. Clients use the AWS IAM credential provider and the AWS MSK IAM SASL signer to sign Kafka authentication requests with temporary SigV4 credentials, completely eliminating static secrets, passwords, and private certificate management.

- Why not A: SASL/SCRAM with plaintext S3 storage creates severe credential leakage risks and requires manual credential rotation.
- Why not C: Apache Kafka wire protocol is not HTTP, and unencrypted transmission exposes data in transit to interception.
- Why not D: Amazon Cognito user pools are designed for end-user mobile/web authentication and do not natively authenticate Kafka wire protocol connections.
- Ref: [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#7-amazon-managed-streaming-for-apache-kafka-msk), https://docs.aws.amazon.com/msk/latest/developerguide/iam-access-control.html

</details>

### Q-SAA-037 · Design Secure Architectures · difficulty 2 · scenario

A multi-account enterprise has an analytics account (Account B) that needs to ingest application events published by microservices running in a production account (Account A). The security team requires that only Account A be authorized to send events to Account B's custom event bus, and all communication must remain within the AWS global network. How should this access be configured?

- A) Attach an Amazon EventBridge resource-based policy to Account B's custom event bus granting `events:PutEvents` permission to Account A's principal.
- B) Create an IAM user in Account B with administrative privileges and store its static access keys in Account A.
- C) Deploy an internet-facing Application Load Balancer in Account B and configure Account A to send HTTP webhooks over the public internet.
- D) Create a VPC Peering connection and route events through an unauthenticated NAT Gateway.

<details><summary>Answer</summary>

**A.** Amazon EventBridge custom event buses support resource-based policies. Attaching a policy to Account B's event bus that grants `events:PutEvents` specifically to Account A's account principal (`arn:aws:iam::AccountA:root`) authorizes cross-account event routing securely over internal AWS network backbones.

- Why not B: Storing static access keys across accounts violates the principle of least privilege and introduces long-term credential leakage risks.
- Why not C: Exposing an internet-facing ALB introduces unnecessary attack surfaces and public egress/ingress network transfer costs.
- Why not D: EventBridge is a managed regional service that communicates natively over AWS backbones; VPC peering and NAT gateways are unnecessary for cross-account EventBridge publishing.
- Ref: [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#4-amazon-eventbridge-the-central-serverless-event-router), https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-permissions.html

</details>

### Q-SAA-038 · Design Secure Architectures · difficulty 3 · scenario

Multiple worker instances in an automated invoice ingestion pipeline simultaneously generate daily settlement reports and upload them to an Amazon S3 bucket. A solutions architect must guarantee that if two workers attempt to write a report with the same filename simultaneously, the first write succeeds and the second write is rejected rather than overwriting the report. Which feature implements this control natively?

- A) Deploy an external Redis cluster to manage distributed locks across all worker threads.
- B) Execute the S3 `PutObject` API call with the conditional header `If-None-Match: "*"`.
- C) Enable S3 Versioning and configure a Lifecycle rule to delete noncurrent versions.
- D) Configure an S3 Event Notification to trigger a Lambda function that restores overwritten files.

<details><summary>Answer</summary>

**B.** Amazon S3 supports atomic conditional writes. Passing the HTTP header `If-None-Match: "*"` in a `PutObject` request ensures that the object is written only if no object exists with that key. If an object already exists, S3 halts the upload and returns HTTP 412 Precondition Failed, preventing accidental concurrent overwrites.

- Why not A: Deploying an external Redis cluster introduces substantial infrastructure provisioning, maintenance overhead, and operational failure modes.
- Why not C: S3 Versioning retains previous versions, but does not reject the overwrite; the second write still clobbers the latest version.
- Why not D: Reactive Lambda restoration happens after the overwrite has occurred and cannot prevent race conditions in downstream processing.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#1-amazon-s3-storage-engine--consistency-model), https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html

</details>

### Q-SAA-039 · Design Secure Architectures · difficulty 2 · scenario

A company operates EC2 instances in a private VPC subnet without internet access. Instances communicate with Amazon S3 via a Gateway VPC Endpoint. The security team mandates that instances must only be permitted to download assets from the company's designated asset bucket (`arn:aws:s3:::corp-assets-prod`), and data exfiltration to any personal or external S3 buckets must be blocked. How should the solutions architect enforce this policy?

- A) Create a Security Group outbound rule allowing traffic only to the IP address range of the S3 asset bucket.
- B) Attach an Endpoint Policy to the S3 Gateway VPC Endpoint specifying an `Allow` effect for `s3:GetObject` restricted strictly to `arn:aws:s3:::corp-assets-prod/*`.
- C) Configure an AWS WAF rule on the Gateway VPC Endpoint inspecting HTTP Host headers.
- D) Modify the route table to route non-corporate S3 traffic to a blackhole route `0.0.0.0/0`.

<details><summary>Answer</summary>

**B.** Gateway VPC Endpoints support endpoint resource policies. An endpoint policy acts as a preventive perimeter guardrail: configuring an `Allow` statement restricted strictly to `arn:aws:s3:::corp-assets-prod/*` guarantees that instances traversing the endpoint can access that designated bucket, blocking exfiltration to all other S3 buckets.

- Why not A: Amazon S3 uses dynamic public IP address ranges that change continuously; Security Groups cannot filter by specific S3 bucket ARNs.
- Why not C: AWS WAF protects Application Load Balancers, API Gateways, and CloudFront distributions, but cannot attach to S3 Gateway VPC Endpoints.
- Why not D: S3 route table routes point to the gateway endpoint prefix list (`pl-xxxxxxxx`) and cannot differentiate between individual bucket destinations.
- Ref: [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#3-vpc-endpoints-gateway-endpoints-vs-privatelink-interface-endpoints), https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html#vpc-endpoints-s3-policies

</details>

### Q-SAA-040 · Design Secure Architectures · difficulty 2 · scenario

An application publishes sensitive healthcare messages to an Amazon SQS queue. Compliance regulations require encrypting queue messages at rest using a Customer Managed Key (CMK) in AWS KMS. When an Amazon SNS topic attempts to fan-out messages to the encrypted SQS queue, messages fail to arrive. What configuration step resolves this issue?

- A) Switch the SQS queue from a Standard queue to a FIFO queue.
- B) Update the KMS CMK key policy to grant the Amazon SNS service principal (`sns.amazonaws.com`) permissions to `kms:GenerateDataKey` and `kms:Decrypt`.
- C) Disable SQS server-side encryption and use S3 client-side encryption instead.
- D) Attach an IAM role to the Amazon SNS topic with AdministratorAccess permissions.

<details><summary>Answer</summary>

**B.** When Amazon SNS publishes messages to an SQS queue encrypted with a customer-managed KMS key (CMK), SNS must be authorized by the KMS key policy to use the key. Adding an Allow statement granting `kms:GenerateDataKey*` and `kms:Decrypt` to `sns.amazonaws.com` allows SNS to encrypt messages upon queue delivery.

- Why not A: Switching queue types does not resolve cryptographic permission errors between SNS and KMS.
- Why not C: Disabling SQS server-side encryption violates the compliance mandate for encryption at rest.
- Why not D: Amazon SNS topics are AWS resources, not IAM identities; you cannot attach IAM identity roles directly to SNS topics to grant KMS rights.
- Ref: [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#3-amazon-sns-high-throughput-pubsub-fan-out), https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-key-management.html

</details>

### Q-SAA-041 · Design Secure Architectures · difficulty 3 · scenario

An auditor discovers that an S3 bucket configured with Object Lock in Compliance Mode has an object retention period set to 5 years. An administrator attempts to reduce the retention period on an existing object version to 3 years to save storage costs. What will be the outcome of this action?

- A) S3 allows the change if the administrator authenticates with the AWS Account Root User credentials.
- B) S3 permits shortening the retention period if the `x-amz-bypass-governance-retention:true` header is provided.
- C) S3 rejects the request; in Compliance Mode, an object's retention period can only be extended, never decreased or removed by any principal.
- D) S3 deletes the object version immediately and archives the metadata to CloudTrail.

<details><summary>Answer</summary>

**C.** In Amazon S3 Object Lock Compliance Mode, retention rules are strictly enforced by AWS. Once applied, an object's retention period can only be extended into the future; it can never be decreased, shortened, or bypassed by any principal, including the AWS Account Root User.

- Why not A: In Compliance Mode, even the AWS Account Root User is strictly prohibited from deleting objects or shortening retention periods.
- Why not B: The bypass header applies strictly to Governance Mode, having zero effect on Compliance Mode.
- Why not D: S3 never deletes objects upon receiving invalid retention alteration requests; it returns HTTP 403 Forbidden.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#5-s3-data-protection-object-lock-versioning-and-compliance), https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html

</details>

### Q-SAA-042 · Design Resilient Architectures · difficulty 3 · scenario

A mission-critical online banking application utilizes an Amazon Aurora MySQL database cluster deployed across three Availability Zones (AZ-A, AZ-B, AZ-C). A catastrophic physical power outage disables all data centers in AZ-A simultaneously. How does the Aurora storage architecture respond to this outage?

- A) Aurora enters read-only mode because a quorum of 6 nodes is required to commit new writes.
- B) Aurora continues processing read and write transactions without interruption because the remaining 4 storage copies in AZ-B and AZ-C satisfy the 4/6 write quorum.
- C) Aurora initiates a cross-region failover to a standby region, causing 15 minutes of downtime.
- D) The database halts until storage nodes in AZ-A are recovered by AWS hardware technicians.

<details><summary>Answer</summary>

**B.** Aurora replicates all storage 6 ways across 3 Availability Zones (2 copies per AZ). Aurora requires a 4/6 write quorum to commit write transactions. When an entire Availability Zone fails (losing 2 copies), the remaining 4 copies in the other two AZs fulfill the write quorum, allowing write and read operations to proceed with zero downtime.

- Why not A: Aurora does not require all 6 nodes to write; it requires a 4/6 quorum ($V_w = 4$), which is fully satisfied by the remaining 4 nodes.
- Why not C: Aurora multi-AZ clusters are designed to absorb local AZ failures in-region without triggering disruptive cross-region failovers.
- Why not D: Aurora's self-healing quorum architecture was explicitly designed to survive AZ outages without pausing operations.
- Ref: [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#3-amazon-aurora-distributed-log-structured-storage-architecture), https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.StorageReliability.html

</details>

### Q-SAA-043 · Design Resilient Architectures · difficulty 2 · scenario

A consumer microservice encounters a null-pointer bug that causes 5,000 orders in an Amazon SQS queue to fail repeatedly and move into a Dead-Letter Queue (DLQ). The engineering team fixes the code and deploys a patched container. How should the solutions architect restore the 5,000 failed messages to the primary queue for reprocessing with the least operational effort?

- A) Write and execute a custom Python script that reads messages from the DLQ, calls `SendMessage` to the primary queue, and calls `DeleteMessage` on the DLQ.
- B) Use the SQS Dead-Letter Queue Redrive feature to automatically move messages from the DLQ back to the primary source queue.
- C) Purge the primary queue and instruct external customers to submit their orders again.
- D) Create a new SQS queue and redirect incoming traffic to the DLQ.

<details><summary>Answer</summary>

**B.** Amazon SQS provides automated Dead-Letter Queue Redrive (via the console or the `StartMessageMoveTask` API). This native feature redrives failed messages from the DLQ back to the primary source queue asynchronously at high throughput without writing custom migration scripts or managing worker credentials.

- Why not A: Writing custom migration scripts introduces manual development overhead, risks rate-limiting, and can result in message duplication or loss.
- Why not C: Purging queues and requesting customers to resubmit orders destroys business data and violates SLAs.
- Why not D: Pointing active traffic to the DLQ pollutes failed historical messages with new traffic and fails to replay orders.
- Ref: [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#2-amazon-sqs-architecture--lifecycle-internals), https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html

</details>

### Q-SAA-044 · Design Resilient Architectures · difficulty 2 · scenario

An AWS Lambda function processes clickstream records in batches from an Amazon Kinesis Data Stream. Occasionally, a single malformed JSON record in a batch throws an unhandled exception. Because Kinesis retains strict record ordering, the Lambda poller retries the entire batch repeatedly, blocking the shard from processing subsequent records. What configuration mitigates this poison pill bottleneck?

- A) Increase the Lambda function timeout to 15 minutes.
- B) Enable `BisectBatchOnFunctionError` in the Lambda Event Source Mapping configuration.
- C) Increase the Kinesis shard retention period from 24 hours to 7 days.
- D) Configure an Application Load Balancer in front of the Kinesis stream.

<details><summary>Answer</summary>

**B.** Enabling `BisectBatchOnFunctionError` instructs the Lambda Event Source Mapping to automatically split a failed batch in half upon an unhandled exception and retry each half independently. The ESM repeats this bisection recursively until the single malformed record is isolated into a batch of 1, allowing it to be sent to an On-Failure Destination while unblocking the rest of the shard.

- Why not A: Increasing function timeout does not fix a malformed payload; it only causes the function to hang longer before failing.
- Why not C: Extending retention allows older records to stay longer in the stream, but does not unblock the stalled shard iterator.
- Why not D: ALBs cannot be placed between Amazon Kinesis Data Streams and AWS Lambda Event Source Mappings.
- Ref: [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#2-lambda-event-source-mappings-esm-deep-dive), https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html

</details>

### Q-SAA-045 · Design Resilient Architectures · difficulty 2 · scenario

An AWS Lambda function processes messages in batches of 10 from an Amazon SQS Standard queue. If message 7 in a batch encounters a transient downstream service error, the function throws an error, causing SQS to retry all 10 messages after the visibility timeout expires. This causes messages 1 through 6 to be processed multiple times. How can the architect ensure that only message 7 is retried?

- A) Reduce the SQS batch size from 10 to 1.
- B) Enable `ReportBatchItemFailures` on the Event Source Mapping and configure the Lambda handler to return `{ batchItemFailures: [{ itemIdentifier: messageId }] }` for failed items.
- C) Configure an Amazon SNS topic between the SQS queue and the Lambda function.
- D) Increase the SQS visibility timeout to 12 hours.

<details><summary>Answer</summary>

**B.** Configuring `ReportBatchItemFailures` on the SQS Event Source Mapping enables partial batch responses. The Lambda handler wraps each item in a try/catch block and returns `{ batchItemFailures: [{ itemIdentifier: messageId }] }` containing only failed IDs. SQS automatically deletes succeeded messages from the queue and leaves only failed messages to retry.

- Why not A: Reducing batch size to 1 severely degrades throughput, increases Lambda invocation costs tenfold, and does not leverage batching efficiencies.
- Why not C: SNS cannot sit between an SQS queue and a Lambda event source mapping; SNS is a pub/sub publisher, not a queue poller.
- Why not D: Increasing visibility timeout delays message reprocessing for 12 hours without solving duplicate processing of messages 1-6.
- Ref: [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#3-partial-batch-response-mechanics-reportbatchitemfailures), https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html

</details>

### Q-SAA-046 · Design Resilient Architectures · difficulty 3 · scenario

A global enterprise requires a relational database disaster recovery strategy between `us-east-1` (primary) and `eu-central-1` (secondary). The business mandates a Recovery Point Objective ($RPO$) of less than 1 second and a Recovery Time Objective ($RTO$) of less than 1 minute, with minimal performance overhead on the primary production database. Which database architecture satisfies these criteria?

- A) Deploy an Amazon RDS PostgreSQL Multi-AZ DB Instance with asynchronous read replicas in `eu-central-1`.
- B) Deploy an Amazon Aurora Global Database spanning `us-east-1` and `eu-central-1`.
- C) Use AWS Database Migration Service (DMS) continuous replication between two standalone EC2 PostgreSQL instances.
- D) Configure hourly automated EBS snapshots in `us-east-1` and copy them to `eu-central-1`.

<details><summary>Answer</summary>

**B.** Aurora Global Database replicates storage directly across AWS Regions using dedicated AWS global network infrastructure. Cross-region replication runs with typical latency under 100 milliseconds and $RPO < 1$ second without taxing the primary compute engine. In a disaster recovery event, secondary clusters promote to standalone read/write operation in under 1 minute.

- Why not A: Standard RDS cross-region read replicas experience significant replica lag (often tens of seconds to minutes), breaching the sub-second RPO requirement.
- Why not C: Self-managed EC2 database instances with DMS introduce substantial operational complexity, single points of failure, and higher failover latencies.
- Why not D: Hourly snapshots provide an RPO of up to 1 hour, completely violating the 1-second RPO mandate.
- Ref: [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#4-aurora-scaling-read-replicas-and-global-database), https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html

</details>

### Q-SAA-047 · Design Resilient Architectures · difficulty 2 · multi

An e-commerce platform processes flash sale orders by placing messages into an SQS queue. A Lambda function consumes the messages and writes order records to an Amazon Aurora PostgreSQL database. During flash sales, 2,000 Lambda execution environments launch simultaneously, exhausting the database connection pool (`max_connections`) and causing widespread transaction aborts. Which two architectural controls should be implemented together? (Select TWO)

- A) Deploy Amazon RDS Proxy between the Lambda function and the Aurora database to pool and multiplex database connections.
- B) Configure `MaximumConcurrency` on the SQS Event Source Mapping to limit the maximum number of concurrent Lambda workers.
- C) Convert the Aurora database into an Amazon Redshift cluster.
- D) Increase the SQS message retention period from 4 days to 14 days.
- E) Migrate the Lambda function to run inside a public VPC subnet without a NAT Gateway.

<details><summary>Answer</summary>

**A, B.** Deploying Amazon RDS Proxy pools thousands of ephemeral Lambda connections over a small set of persistent database connections. Configuring `MaximumConcurrency` directly on the SQS Event Source Mapping caps the maximum concurrent Lambda workers processing the queue, preventing sudden traffic spikes from exceeding the database's safe throughput ceiling.

- Why not C: Redshift is an analytical OLAP data warehouse unsuitable for transactional OLTP flash sale processing.
- Why not D: Increasing retention keeps messages longer in the queue but does not prevent concurrent Lambda workers from overwhelming the database.
- Why not E: Lambda functions in public subnets cannot access public IPs without NAT gateways and have zero impact on database connection pooling.
- Ref: [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#9-architectural-patterns-and-production-failure-modes), https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html

</details>

### Q-SAA-048 · Design Resilient Architectures · difficulty 2 · scenario

A healthcare provider must replicate all patient radiological scans from an Amazon S3 bucket in `us-west-2` to an archive bucket in `us-east-1`. To satisfy legal compliance, 99.9% of newly uploaded objects must be replicated within 15 minutes, and operations teams must be alerted if replication latency exceeds this threshold. Which feature fulfills this SLA?

- A) Standard S3 Cross-Region Replication (CRR) with S3 Lifecycle rules.
- B) S3 Cross-Region Replication with S3 Replication Time Control (S3 RTC) enabled.
- C) AWS DataSync scheduled to run once every 24 hours.
- D) An EventBridge rule triggering a Lambda function to copy objects using the S3 CopyObject API.

<details><summary>Answer</summary>

**B.** S3 Replication Time Control (S3 RTC) provides a formal Service Level Agreement guaranteeing that 99.9% of newly uploaded objects replicate to the destination region within 15 minutes. It also publishes detailed CloudWatch metrics tracking replication latency, pending bytes, and pending operations.

- Why not A: Standard S3 CRR operates on a best-effort basis without a delivery time SLA or latency tracking alarms.
- Why not C: AWS DataSync running daily provides an RPO of 24 hours, failing the 15-minute compliance threshold.
- Why not D: Custom Lambda copy scripts fail for objects larger than 5 GB, require managing multi-part uploads manually, and lack formal SLAs.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#6-replication-mechanics-cross-region-crr-and-same-region-srr), https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-time-control.html

</details>

### Q-SAA-049 · Design Resilient Architectures · difficulty 3 · scenario

A banking application executes account transfers by debiting one account and crediting another account in Amazon DynamoDB. The architect must ensure that both balance updates either succeed together or fail together, and network retries caused by mobile connection drops must never execute the money transfer twice. Which solution implements this requirement?

- A) Execute two consecutive `UpdateItem` calls using strong consistency.
- B) Use the `TransactWriteItems` API with a `ClientRequestToken` parameter and condition checks on both account balances.
- C) Enable DynamoDB Streams and use an asynchronous Lambda function to credit the second account.
- D) Create a Global Secondary Index on the balance attribute and execute a batch write.

<details><summary>Answer</summary>

**B.** `TransactWriteItems` provides multi-item ACID atomicity, guaranteeing that both the debit and credit operations succeed together or abort together. Supplying a `ClientRequestToken` ensures idempotency, preventing retried requests from executing duplicate transfers if network timeouts occur during execution.

- Why not A: Two consecutive `UpdateItem` calls are not atomic; if the second call fails or times out, the first debit remains committed, causing financial loss.
- Why not C: Asynchronous stream processing is eventually consistent and cannot atomically rollback the debit if the credit fails.
- Why not D: `BatchWriteItem` does not support conditional checks or transaction rollbacks; individual item writes can succeed while others fail.
- Ref: [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#5-dynamodb-acid-transactions), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html

</details>

### Q-SAA-050 · Design Resilient Architectures · difficulty 2 · scenario

An insurance claims workflow coordinates automated document processing, fraud analysis, an external human adjuster review that can take up to 3 weeks to complete, and final claims payout. If any step fails, automated compensating actions must revert previous steps. Which service orchestrates this multi-week saga workflow with full visual audit history?

- A) AWS Step Functions Express Workflows.
- B) AWS Step Functions Standard Workflows.
- C) AWS Lambda function with maximum timeout configuration.
- D) Amazon EventBridge Scheduler rate-based rule.

<details><summary>Answer</summary>

**B.** AWS Step Functions Standard Workflows are designed for long-running (up to 1 year), auditable business processes. They checkpoint state synchronously at every transition, retain a 90-day visual audit trail in the AWS Console, and support callback tokens to wait weeks for human adjuster approvals and execute compensating saga steps upon failure.

- Why not A: Express Workflows have a maximum execution duration of 5 minutes and lack built-in 90-day visual audit history.
- Why not C: AWS Lambda functions have a maximum execution timeout of 15 minutes, making them incapable of waiting 3 weeks for an adjuster review.
- Why not D: EventBridge Scheduler triggers recurring tasks but cannot coordinate multi-step conditional state machines or manage compensating transactions.
- Ref: [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#8-aws-step-functions-workflow-orchestration), https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html

</details>

### Q-SAA-051 · Design High-Performing Architectures · difficulty 2 · scenario

A deep learning training pipeline runs across hundreds of GPU-accelerated EC2 instances in an AWS Availability Zone. During model training, workers write and read gigabytes of intermediate model checkpoints millions of times per day. The ML engineering team needs an object storage tier that delivers consistent sub-10 millisecond access latencies while reducing request costs by 50%. Which storage class fulfills these needs?

- A) S3 Standard-Infrequent Access.
- B) S3 Express One Zone using directory buckets co-located in the same Availability Zone.
- C) S3 Glacier Instant Retrieval.
- D) Amazon S3 on Outposts.

<details><summary>Answer</summary>

**B.** Amazon S3 Express One Zone utilizes directory buckets co-located in the same physical Availability Zone as compute resources. It delivers consistent sub-10 millisecond data access latencies (up to 10× faster than S3 Standard) and 50% lower request costs, ideal for high-throughput machine learning checkpoints.

- Why not A: S3 Standard-IA has standard multi-AZ latency (50-100ms) and charges expensive per-GB retrieval fees for frequent checkpoint reads.
- Why not C: Glacier Instant Retrieval is designed for rarely accessed data (1x/year) and incurs heavy retrieval fees when read repeatedly during training.
- Why not D: S3 on Outposts runs on physical on-premises hardware, not inside AWS cloud regions.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#3-s3-express-one-zone-sub-10ms-high-performance-storage), https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-express-one-zone.html

</details>

### Q-SAA-052 · Design High-Performing Architectures · difficulty 2 · scenario

A media streaming platform expects 30,000 video segment upload requests (PUT) per second and 50,000 video segment read requests (GET) per second to an Amazon S3 bucket. How should the application structure its S3 object keys to achieve this throughput without experiencing HTTP 503 SlowDown errors?

- A) Prepend a random hexadecimal hash to each key and place all files into a single root prefix.
- B) Distribute objects across at least 10 distinct logical prefixes within the bucket (e.g., partitioning by video ID or category).
- C) Store all video segments inside an Amazon EBS gp3 volume and share it via NFS.
- D) Enable S3 Transfer Acceleration on a bucket with a single shared prefix.

<details><summary>Answer</summary>

**B.** Each partitioned prefix in an S3 bucket natively supports 3,500 PUT and 5,500 GET requests per second. Distributing keys across 10 or more distinct prefixes scales aggregate throughput to 35,000+ PUTs and 55,000+ GETs per second, allowing horizontal throughput scaling without manual hash prefixes.

- Why not A: Hash prefixing is obsolete; distributing traffic across distinct logical prefixes achieves horizontal scaling cleanly without unreadable hash keys.
- Why not C: EBS gp3 volumes cannot scale to 50,000 GET requests per second or provide distributed object storage across global streaming viewers.
- Why not D: Transfer Acceleration optimizes WAN network transit via CloudFront edge locations, but does not increase S3's per-prefix request rate limits.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#2-request-rate-scaling-and-prefix-partitioning), https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html

</details>

### Q-SAA-053 · Design High-Performing Architectures · difficulty 3 · scenario

A SaaS application processes millions of IoT device events in Amazon DynamoDB. The query pattern requires fetching all events for a specific device that occurred within a given date range and possess a specific status (e.g., `device_id = 901`, `status = ERROR`, between `2026-11-01` and `2026-11-08`). How should the table schema be designed to retrieve these records in a single query with minimal RCU consumption?

- A) Use `device_id` as Partition Key and scan the entire table using a filter expression on status and date.
- B) Use `device_id` as Partition Key and construct a composite Sort Key formatted as `STATUS#<status>#DATE#<timestamp>`.
- C) Create a separate table for every status code and execute parallel scans.
- D) Store all device records in an Amazon S3 bucket and query using Athena.

<details><summary>Answer</summary>

**B.** DynamoDB sort keys store data contiguously in local B-trees within a partition. Creating a composite sort key (`STATUS#<status>#DATE#<timestamp>`) allows querying with `PK = 901 AND SK begins_with('STATUS#ERROR#DATE#2026-11')`, fetching precisely matching records in a single roundtrip without consuming unneeded RCUs.

- Why not A: A `Scan` operation reads every item in the table, consuming immense RCU capacity and resulting in slow, unscalable query response times.
- Why not C: Creating separate tables creates operational chaos and breaks single-table transactional consistency.
- Why not D: Athena queries S3 asynchronously with latencies measured in seconds, failing to deliver real-time application query performance.
- Ref: [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#2-dynamodb-single-table-design), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-sort-keys.html

</details>

### Q-SAA-054 · Design High-Performing Architectures · difficulty 2 · scenario

A cryptocurrency exchange streams market trade data through an Amazon Kinesis Data Stream. Three separate microservices (fraud analysis, algorithmic execution, and real-time user ticker) consume the stream concurrently. The algorithmic execution engine requires end-to-end data delivery latency of less than 70 milliseconds and dedicated throughput. Which consumer architecture should be selected?

- A) Standard Kinesis consumers using the HTTP `GetRecords` API with 1-second polling intervals.
- B) Kinesis Enhanced Fan-Out (EFO) consumers using HTTP/2 server push connections (`SubscribeToShard`).
- C) Configure an Amazon SQS Standard queue in front of Kinesis.
- D) Write trade data to an Amazon Aurora database and query using cron jobs.

<details><summary>Answer</summary>

**B.** Kinesis Enhanced Fan-Out (EFO) provides a dedicated 2 MB/s egress throughput allocation per shard per registered consumer over HTTP/2 server push connections (`SubscribeToShard`), reducing end-to-end latency to under 70 milliseconds and eliminating read bandwidth contention among competing consumers.

- Why not A: Standard consumers share 2 MB/s of egress per shard and introduce 200–500ms polling latency, violating the sub-70ms requirement.
- Why not C: Placing SQS in front of Kinesis adds unnecessary queueing delay and destroys strict partition order.
- Why not D: RDBMS polling introduces high database write contention and query latencies far exceeding 70 milliseconds.
- Ref: [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#6-amazon-kinesis-data-streams-real-time-streaming-architecture), https://docs.aws.amazon.com/streams/latest/dev/enhanced-consumers.html

</details>

### Q-SAA-055 · Design High-Performing Architectures · difficulty 2 · scenario

A large financial institution is migrating a core Oracle transactional database to Amazon EC2. The database requires 200,000 IOPS, 3,000 MB/s of sustained storage throughput, sub-millisecond I/O latency, and five-nines (99.999%) volume durability. Which Amazon EBS volume type meets these specifications?

- A) General Purpose SSD (`gp3`).
- B) Provisioned IOPS SSD (`io2 Block Express`).
- C) Throughput Optimized HDD (`st1`).
- D) Cold HDD (`sc1`).

<details><summary>Answer</summary>

**B.** Amazon EBS `io2 Block Express` volumes are designed for mission-critical enterprise workloads. Attached to Nitro-based instances, `io2 Block Express` delivers up to 256,000 IOPS, 4,000 MB/s of throughput, sub-millisecond latencies, and 99.999% durability.

- Why not A: General Purpose SSD (`gp3`) maxes out at 16,000 IOPS and 1,000 MB/s, falling far short of the required 200,000 IOPS.
- Why not C: `st1` is a magnetic spinning disk volume capped at 500 IOPS, designed strictly for sequential big data streaming.
- Why not D: `sc1` is magnetic cold storage designed for rarely accessed sequential workloads, delivering a maximum of 250 IOPS.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#8-amazon-ebs-block-storage-gp3-vs-io2-block-express), https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-volume-types.html#io2-block-express

</details>

### Q-SAA-056 · Design High-Performing Architectures · difficulty 3 · scenario

A gaming platform requires an in-memory database to manage real-time player inventories and leaderboards. The application demands sub-millisecond read response times, but unlike standard caches, game state mutations must be fully durable with zero data loss ($RPO = 0$) if an instance or Availability Zone crashes. Which database engine fulfills both performance and durability mandates?

- A) Amazon ElastiCache for Memcached with multi-node clusters.
- B) Amazon MemoryDB for Redis with Multi-AZ transactional logging.
- C) Amazon RDS MySQL with a large buffer pool.
- D) Amazon DynamoDB configured with eventual consistency.

<details><summary>Answer</summary>

**B.** Amazon MemoryDB for Redis combines in-memory Redis sub-millisecond read performance with Multi-AZ durability. Writes are synchronously committed to a distributed multi-AZ transaction log before acknowledging client requests, guaranteeing $RPO = 0$ transactional durability during primary node crashes.

- Why not A: Memcached is an ephemeral, non-durable in-memory cache without persistence, replication, or transactional logging.
- Why not C: RDS MySQL commits to block storage with latencies in the single-to-double-digit milliseconds, failing to provide sub-millisecond in-memory performance.
- Why not D: DynamoDB delivers single-digit millisecond latency (3–8ms), not the sub-millisecond in-memory speeds required for real-time game loops.
- Ref: [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#8-amazon-memorydb-for-redis), https://docs.aws.amazon.com/memorydb/latest/devguide/what-is-memorydb-for-redis.html

</details>

### Q-SAA-057 · Design High-Performing Architectures · difficulty 2 · scenario

An analytics application uses an AWS Lambda function to process change data capture events from an Amazon DynamoDB Stream. During peak shopping events, write throughput to a specific partition key causes significant consumer lag because Lambda processes records from each stream shard with only one concurrent worker. How can the engineering team scale out Lambda concurrency per shard while maintaining partition key order?

- A) Configure the `ParallelizationFactor` parameter (up to 10) on the Lambda Event Source Mapping.
- B) Convert the DynamoDB table to an Amazon Redshift data warehouse.
- C) Increase the Lambda memory allocation to 10,240 MB.
- D) Deploy an Auto Scaling Group of EC2 instances running custom polling scripts.

<details><summary>Answer</summary>

**A.** Setting the `ParallelizationFactor` (from 1 to 10) on the Lambda Event Source Mapping allows Lambda to execute up to 10 concurrent invocations per stream shard. The ESM partitions incoming records by hashing their partition keys, scaling out processing throughput while preserving in-order processing within each partition key group.

- Why not B: Redshift is an analytical data warehouse, not a real-time stream processing engine.
- Why not C: Increasing memory provides fractional CPU benefits to a single worker, but does not scale concurrency beyond the 1-worker-per-shard bottleneck.
- Why not D: Managing custom EC2 pollers adds high infrastructure overhead and re-invents managed Event Source Mapping features.
- Ref: [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#2-lambda-event-source-mappings-esm-deep-dive), https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html

</details>

### Q-SAA-058 · Design High-Performing Architectures · difficulty 3 · scenario

A high-traffic social media application experiences heavy database write contention and read volume on an Amazon RDS for PostgreSQL database. The application team needs to improve commit latency to less than 35 milliseconds, gain two readable standby instances across Availability Zones, and achieve automated failovers in under 35 seconds. What deployment architecture should be selected?

- A) An Amazon RDS Multi-AZ DB Instance deployment.
- B) An Amazon RDS Multi-AZ DB Cluster deployment.
- C) A standalone RDS DB instance with cross-region replication.
- D) An EC2 instance running PostgreSQL with manual EBS snapshot backups.

<details><summary>Answer</summary>

**B.** Amazon RDS Multi-AZ DB Cluster provisions one primary writer and two readable standby instances across three Availability Zones. It uses local NVMe SSD storage and semi-synchronous Raft replication to deliver commit latencies under 35 milliseconds, offload read queries to two readable standbys, and complete failovers in under 35 seconds.

- Why not A: Multi-AZ DB Instance uses physical EBS mirroring with higher commit latency (50ms+), non-readable standbys, and 60-120 second failover times.
- Why not C: Cross-region replication increases write latency, suffers asynchronous replication lag, and requires manual failover.
- Why not D: Standalone EC2 instances lack automated high availability, require manual failover scripts, and risk severe data loss during crashes.
- Ref: [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#2-amazon-rds-high-availability-architectures), https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/multi-az-db-clusters-concepts.html

</details>

### Q-SAA-059 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A media company stores hundreds of terabytes of user-generated video assets in Amazon S3. The access patterns are unpredictable: new videos are accessed heavily for the first few weeks, some older videos go viral unpredictably months later, and most videos are never watched again. The finance team mandates that storage costs must be minimized automatically without paying data retrieval fees when cold videos are accessed. Which storage tier fulfills this requirement?

- A) S3 Standard-Infrequent Access.
- B) S3 Intelligent-Tiering.
- C) S3 Glacier Flexible Retrieval.
- D) S3 One Zone-Infrequent Access.

<details><summary>Answer</summary>

**B.** S3 Intelligent-Tiering automatically moves data between access tiers (Frequent, Infrequent after 30 days, Archive Instant after 90 days) based on access patterns without operational overhead. Critically, Intelligent-Tiering charges zero data retrieval fees when objects are accessed, preventing unexpected bill spikes when older videos suddenly go viral.

- Why not A: Standard-IA charges per-GB data retrieval fees, resulting in unexpected cost spikes when older videos suddenly go viral.
- Why not C: Glacier Flexible Retrieval introduces retrieval delays (minutes to hours) and data retrieval fees, breaking real-time video playback.
- Why not D: One Zone-IA lacks multi-AZ durability and charges per-GB retrieval fees while storing data in a single Availability Zone.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#4-s3-storage-class-hierarchy--intelligent-tiering), https://docs.aws.amazon.com/AmazonS3/latest/userguide/intelligent-tiering.html

</details>

### Q-SAA-060 · Design Cost-Optimized Architectures · difficulty 2 · scenario

An engineering team maintains 15 separate AWS Lambda functions whose sole responsibility is polling Amazon DynamoDB Streams, filtering records for a specific status, and pushing the records to Amazon SQS queues. The team spends significant monthly budgets on Lambda execution invocations and maintenance. How can this architecture be refactored to eliminate Lambda costs and code maintenance?

- A) Replace the Lambda functions with Amazon EventBridge Pipes configured with source filters.
- B) Rewrite the Lambda functions in Python instead of Node.js.
- C) Provision an Amazon EMR cluster to process DynamoDB Streams.
- D) Migrate the DynamoDB tables to Amazon Redshift.

<details><summary>Answer</summary>

**A.** Amazon EventBridge Pipes provides managed point-to-point integrations connecting stream sources (like DynamoDB Streams) directly to targets (like Amazon SQS). Pipes handles stream polling and filtering natively with declarative JSON patterns, eliminating custom Lambda function code, execution latency, and invocation costs.

- Why not B: Rewriting functions in a different language does not eliminate Lambda invocation costs, cold starts, or code maintenance overhead.
- Why not C: Provisioning an EMR cluster introduces expensive continuous EC2 compute costs, vastly inflating monthly spend.
- Why not D: Amazon Redshift is an analytical data warehouse, not a real-time event streaming pipeline.
- Ref: [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#5-eventbridge-pipes-and-eventbridge-scheduler), https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html

</details>

### Q-SAA-061 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A healthcare conglomerate must retain digital patient medical charts for 10 years to comply with regulatory mandates. The records are accessed on average once every 5 years for legal audits, and retrieval times of 12 to 48 hours are completely acceptable. Which storage option provides the lowest per-gigabyte storage cost?

- A) S3 Standard-Infrequent Access.
- B) S3 Glacier Instant Retrieval.
- C) S3 Glacier Deep Archive.
- D) Amazon EBS cold storage (`sc1`).

<details><summary>Answer</summary>

**C.** Amazon S3 Glacier Deep Archive is AWS's lowest-cost cloud storage tier (costing approximately \$0.00099 per GB-month). Designed for long-term data retention (7 to 10+ years) where retrieval delays of 12 to 48 hours are acceptable, it provides the optimal price point for regulatory medical archives.

- Why not A: Standard-IA costs roughly 10× more per gigabyte per month than Glacier Deep Archive for long-term retention.
- Why not B: Glacier Instant Retrieval is designed for millisecond retrievals and costs approximately 4× more for storage than Glacier Deep Archive.
- Why not D: EBS `sc1` is an EC2 block volume, costing significantly more than S3 storage and requiring an active EC2 instance to mount it.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#4-s3-storage-class-hierarchy--intelligent-tiering), https://aws.amazon.com/s3/pricing/

</details>

### Q-SAA-062 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A corporate intranet application operates an internal employee survey tool in Amazon DynamoDB. The tool receives zero traffic for 28 days each month, but experiences heavy, unpredictable traffic bursts during the last 2 days of each month when quarterly surveys are submitted. Under provisioned capacity mode, the company pays for idle capacity continuously. How should the capacity mode be updated to optimize costs?

- A) Switch the DynamoDB table to On-Demand capacity mode.
- B) Create 10 Global Secondary Indexes to spread the load.
- C) Provision an Amazon ElastiCache cluster in front of DynamoDB.
- D) Migrate the database to an Amazon Aurora Serverless v1 cluster.

<details><summary>Answer</summary>

**A.** DynamoDB On-Demand capacity mode charges strictly for read and write requests executed by the application (pay-per-request). For workloads with long idle periods (such as 28 days of zero traffic), On-Demand completely eliminates paying for idle provisioned capacity while instantly handling sudden traffic surges during survey periods.

- Why not B: Adding GSIs increases storage costs and consumes additional write capacity, inflating total expenses.
- Why not C: An ElastiCache cluster runs 24/7 on dedicated EC2 nodes, adding continuous idle compute costs for an application inactive 28 days a month.
- Why not D: Aurora Serverless v1 is a deprecated legacy engine, and relational databases require complex schema migration without solving pay-per-request NoSQL access.
- Ref: [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#4-capacity-modes-bursting-and-hot-partitions), https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html

</details>

### Q-SAA-063 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A dev/test environment runs hundreds of Docker containers that share a common Amazon EFS filesystem for build artifacts. The build pipeline runs intermittently throughout the day with long idle gaps between builds. Currently, the filesystem is configured with Provisioned Throughput of 200 MB/s, resulting in high baseline monthly costs for unutilized bandwidth. How should the filesystem throughput mode be configured to minimize costs while supporting build surges?

- A) Switch the EFS throughput mode to Elastic Throughput.
- B) Migrate the filesystem to an Amazon EBS gp2 volume.
- C) Delete the EFS filesystem and use local container storage.
- D) Switch to Bursting Throughput mode with 10 GB of dummy data.

<details><summary>Answer</summary>

**A.** Amazon EFS Elastic Throughput mode automatically scales throughput up and down based on real-time workload I/O demand. Customers pay strictly for the data read and written during active builds, eliminating fixed monthly provisioned throughput fees during idle intervals.

- Why not B: EBS volumes cannot be shared concurrently across hundreds of containers distributed across multiple Availability Zones.
- Why not C: Local container storage is ephemeral; build artifacts would be destroyed when containers stop or terminate.
- Why not D: Storing dummy data to inflate bursting credits wastes storage budget and risks sudden I/O throttling when credit buckets drain.
- Ref: [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#9-amazon-efs-distributed-posix-shared-file-system), https://docs.aws.amazon.com/efs/latest/ug/performance.html

</details>

### Q-SAA-064 · Design Cost-Optimized Architectures · difficulty 2 · scenario

An IoT platform ingests 20,000 sensor telemetry readings per second. Each reading triggers a 3-step validation and enrichment pipeline that executes in under 2 seconds. The team currently orchestrates this pipeline using AWS Step Functions Standard Workflows, but the monthly bill for state transitions ($0.025 per 1,000 transitions) is unsustainably high. How can the workflow be re-architected to reduce orchestration costs by over 90%?

- A) Convert the state machine to an AWS Step Functions Express Workflow.
- B) Migrate the workflow to an Amazon EC2 Auto Scaling group running Apache Airflow.
- C) Increase the timeout of the Standard Workflow state machine to 1 year.
- D) Replace Step Functions with an Amazon SQS FIFO queue with 120-hour visibility timeouts.

<details><summary>Answer</summary>

**A.** AWS Step Functions Express Workflows are designed specifically for high-throughput, short-duration (up to 5 minutes) event-driven workloads processing over 100,000 executions per second. Express Workflows charge per execution duration and memory consumed rather than per state transition, reducing orchestration costs by orders of magnitude for high-volume streaming ingest.

- Why not B: Self-hosting Apache Airflow on EC2 introduces heavy management overhead, patching, scaling bottlenecks, and high baseline VM costs.
- Why not C: Increasing timeout does not reduce state transition pricing ($0.025 per 1,000 transitions).
- Why not D: SQS queues cannot execute multi-step validation logic or conditional branching without compute consumers.
- Ref: [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#8-aws-step-functions-workflow-orchestration), https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html

</details>

### Q-SAA-065 · Design Cost-Optimized Architectures · difficulty 2 · scenario

A microservices architecture emits order events that include large customer profile images and PDF invoices (average size 1.5 MB). The team uses Amazon EventBridge to route events, but extended payload fees and event bus size limits are increasing operational costs. How should the team apply the Claim Check pattern to optimize messaging costs?

- A) Store the large PDF and image files in Amazon S3, and publish lightweight events containing metadata and the S3 object key to EventBridge.
- B) Compress the PDF and image files using GZIP and send the binary payload in the EventBridge event detail.
- C) Split the large files into 50 separate 30 KB EventBridge events.
- D) Route all events through an Amazon RDS database table instead of EventBridge.

<details><summary>Answer</summary>

**A.** Applying the Claim Check pattern stores large binary payloads (PDFs, images) in low-cost Amazon S3 storage and passes a lightweight JSON event containing an S3 reference pointer through Amazon EventBridge. Consuming microservices download the file directly from S3, avoiding EventBridge payload charges and staying within standard quotas.

- Why not B: EventBridge enforces a 256 KB message payload limit; even compressed, 1.5 MB files can exceed the limit and still incur extended payload charges.
- Why not C: Splitting files into multiple fragmented events creates massive reassembly complexity, race conditions, and multiplies EventBridge event ingestion charges fiftyfold.
- Why not D: Using a database table as a message bus induces high write lock contention, wastes database storage, and destroys decoupled pub/sub semantics.
- Ref: [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#9-architectural-patterns-and-production-failure-modes), https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/claim-check.html

</details>

---

## Full Mock Exam (65 Questions)

This full timed mock exam replicates the official AWS Certified Solutions Architect – Associate (SAA-C03) testing standard: 65 questions, 130 minutes, passing score 720 / 1000.

### Scoring Key and Domain Mapping

| Q# | Question ID | Domain | Difficulty | Correct Answer | Module Reference |
| :-: | --- | --- | :-: | :-: | --- |
| 1 | Q-SAA-001 | Design Secure Architectures | 2 | **B** | [modules/01-account-and-organization-model.md](../modules/01-account-and-organization-model.md#2-service-control-policies-scps-and-evaluation-boundaries) |
| 2 | Q-SAA-002 | Design Secure Architectures | 3 | **B** | [modules/02-iam-in-depth-and-policy-evaluation.md](../modules/02-iam-in-depth-and-policy-evaluation.md#3-cross-account-role-assumption-and-confused-deputy-mitigations) |
| 3 | Q-SAA-003 | Design Secure Architectures | 2 | **B** | [modules/02-iam-in-depth-and-policy-evaluation.md](../modules/02-iam-in-depth-and-policy-evaluation.md#4-web-identity-federation-and-keyless-cicd-with-oidc) |
| 4 | Q-SAA-004 | Design Secure Architectures | 2 | **B** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#1-ec2-nitro-hypervisor-imdsv2-and-instance-lifecycle) |
| 5 | Q-SAA-005 | Design Secure Architectures | 3 | **B** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#9-origin-access-control-oac-for-cloudfront) |
| 6 | Q-SAA-006 | Design Secure Architectures | 2 | **B** | [modules/02-iam-in-depth-and-policy-evaluation.md](../modules/02-iam-in-depth-and-policy-evaluation.md#5-permission-boundaries-and-delegated-administration) |
| 7 | Q-SAA-007 | Design Secure Architectures | 3 | **A** | [modules/10-security-governance-and-cryptography.md](../modules/10-security-governance-and-cryptography.md#6-aws-secrets-manager-automated-rotation-lifecycle) |
| 8 | Q-SAA-008 | Design Secure Architectures | 2 | **A** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#5-s3-data-protection-object-lock-versioning-and-compliance) |
| 9 | Q-SAA-009 | Design Secure Architectures | 2 | **B** | [modules/01-account-and-organization-model.md](../modules/01-account-and-organization-model.md#2-service-control-policies-scps-and-evaluation-boundaries) |
| 10 | Q-SAA-010 | Design Resilient Architectures | 2 | **A** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#1-vpc-architecture-subnet-topology-and-az-physical-mapping) |
| 11 | Q-SAA-011 | Design Resilient Architectures | 2 | **A** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#3-auto-scaling-groups-lifecycle-hooks-and-warm-pools) |
| 12 | Q-SAA-012 | Design Resilient Architectures | 3 | **B** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#7-lambda-firecracker-microvms-concurrency-and-snapstart) |
| 13 | Q-SAA-013 | Design Resilient Architectures | 2 | **B** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#1-vpc-architecture-subnet-topology-and-az-physical-mapping) |
| 14 | Q-SAA-014 | Design Resilient Architectures | 3 | **A** | [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#4-aurora-scaling-read-replicas-and-global-database) |
| 15 | Q-SAA-015 | Design Resilient Architectures | 2 | **B** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#7-hybrid-dns-resolution-with-route-53-resolver) |
| 16 | Q-SAA-016 | Design Resilient Architectures | 2 | **B** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#3-auto-scaling-groups-lifecycle-hooks-and-warm-pools) |
| 17 | Q-SAA-017 | Design Resilient Architectures | 2 | **B** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#1-ec2-nitro-hypervisor-imdsv2-and-instance-lifecycle) |
| 18 | Q-SAA-018 | Design High-Performing Architectures | 3 | **B** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#7-lambda-firecracker-microvms-concurrency-and-snapstart) |
| 19 | Q-SAA-019 | Design High-Performing Architectures | 2 | **B** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#3-vpc-endpoints-gateway-endpoints-vs-privatelink-interface-endpoints) |
| 20 | Q-SAA-020 | Design High-Performing Architectures | 2 | **A** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#10-aws-global-accelerator-for-anycast-routing) |
| 21 | Q-SAA-021 | Design High-Performing Architectures | 3 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#9-amazon-efs-distributed-posix-shared-file-system) |
| 22 | Q-SAA-022 | Design High-Performing Architectures | 2 | **B** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#1-vpc-architecture-subnet-topology-and-az-physical-mapping) |
| 23 | Q-SAA-023 | Design High-Performing Architectures | 2 | **A** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#9-origin-access-control-oac-for-cloudfront) |
| 24 | Q-SAA-024 | Design High-Performing Architectures | 2 | **A** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#1-ec2-nitro-hypervisor-imdsv2-and-instance-lifecycle) |
| 25 | Q-SAA-025 | Design Cost-Optimized Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#4-s3-storage-class-hierarchy--intelligent-tiering) |
| 26 | Q-SAA-026 | Design Cost-Optimized Architectures | 2 | **B** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#3-vpc-endpoints-gateway-endpoints-vs-privatelink-interface-endpoints) |
| 27 | Q-SAA-027 | Design Cost-Optimized Architectures | 2 | **B** | [modules/04-compute-ec2-ecs-and-lambda-internals.md](../modules/04-compute-ec2-ecs-and-lambda-internals.md#5-ecs-fargate-container-networking-and-capacity-providers) |
| 28 | Q-SAA-028 | Design Cost-Optimized Architectures | 3 | **B** | [modules/14-cost-optimization-finops-and-version-history.md](../modules/14-cost-optimization-finops-and-version-history.md#4-compute-optimization-compute-optimizer-commitments-and-spot-fleets) |
| 29 | Q-SAA-029 | Design Cost-Optimized Architectures | 2 | **B** | [modules/14-cost-optimization-finops-and-version-history.md](../modules/14-cost-optimization-finops-and-version-history.md#4-compute-optimization-compute-optimizer-commitments-and-spot-fleets) |
| 30 | Q-SAA-030 | Design Cost-Optimized Architectures | 2 | **A** | [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#4-capacity-modes-bursting-and-hot-partitions) |
| 31 | Q-SAA-031 | Design Secure Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#6-replication-mechanics-cross-region-crr-and-same-region-srr) |
| 32 | Q-SAA-032 | Design Secure Architectures | 3 | **C** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#5-s3-data-protection-object-lock-versioning-and-compliance) |
| 33 | Q-SAA-033 | Design Secure Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#7-presigned-urls-and-sigv4-cryptographic-delegation) |
| 34 | Q-SAA-034 | Design Secure Architectures | 2 | **B** | [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#5-amazon-rds-proxy-connection-pooling-and-resilient-multiplexing) |
| 35 | Q-SAA-035 | Design Secure Architectures | 3 | **B** | [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#1-amazon-dynamodb-core-architecture--storage-engine) |
| 36 | Q-SAA-036 | Design Secure Architectures | 2 | **B** | [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#7-amazon-managed-streaming-for-apache-kafka-msk) |
| 37 | Q-SAA-037 | Design Secure Architectures | 2 | **A** | [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#4-amazon-eventbridge-the-central-serverless-event-router) |
| 38 | Q-SAA-038 | Design Secure Architectures | 3 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#1-amazon-s3-storage-engine--consistency-model) |
| 39 | Q-SAA-039 | Design Secure Architectures | 2 | **B** | [modules/03-networking-vpc-and-hybrid-connectivity.md](../modules/03-networking-vpc-and-hybrid-connectivity.md#3-vpc-endpoints-gateway-endpoints-vs-privatelink-interface-endpoints) |
| 40 | Q-SAA-040 | Design Secure Architectures | 2 | **B** | [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#3-amazon-sns-high-throughput-pubsub-fan-out) |
| 41 | Q-SAA-041 | Design Secure Architectures | 3 | **C** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#5-s3-data-protection-object-lock-versioning-and-compliance) |
| 42 | Q-SAA-042 | Design Resilient Architectures | 3 | **B** | [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#3-amazon-aurora-distributed-log-structured-storage-architecture) |
| 43 | Q-SAA-043 | Design Resilient Architectures | 2 | **B** | [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#2-amazon-sqs-architecture--lifecycle-internals) |
| 44 | Q-SAA-044 | Design Resilient Architectures | 2 | **B** | [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#2-lambda-event-source-mappings-esm-deep-dive) |
| 45 | Q-SAA-045 | Design Resilient Architectures | 2 | **B** | [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#3-partial-batch-response-mechanics-reportbatchitemfailures) |
| 46 | Q-SAA-046 | Design Resilient Architectures | 3 | **B** | [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#4-aurora-scaling-read-replicas-and-global-database) |
| 47 | Q-SAA-047 | Design Resilient Architectures | 2 | **A, B** | [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#9-architectural-patterns-and-production-failure-modes) |
| 48 | Q-SAA-048 | Design Resilient Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#6-replication-mechanics-cross-region-crr-and-same-region-srr) |
| 49 | Q-SAA-049 | Design Resilient Architectures | 3 | **B** | [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#5-dynamodb-acid-transactions) |
| 50 | Q-SAA-050 | Design Resilient Architectures | 2 | **B** | [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#8-aws-step-functions-workflow-orchestration) |
| 51 | Q-SAA-051 | Design High-Performing Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#3-s3-express-one-zone-sub-10ms-high-performance-storage) |
| 52 | Q-SAA-052 | Design High-Performing Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#2-request-rate-scaling-and-prefix-partitioning) |
| 53 | Q-SAA-053 | Design High-Performing Architectures | 3 | **B** | [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#2-dynamodb-single-table-design) |
| 54 | Q-SAA-054 | Design High-Performing Architectures | 2 | **B** | [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#6-amazon-kinesis-data-streams-real-time-streaming-architecture) |
| 55 | Q-SAA-055 | Design High-Performing Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#8-amazon-ebs-block-storage-gp3-vs-io2-block-express) |
| 56 | Q-SAA-056 | Design High-Performing Architectures | 3 | **B** | [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#8-amazon-memorydb-for-redis) |
| 57 | Q-SAA-057 | Design High-Performing Architectures | 2 | **A** | [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#2-lambda-event-source-mappings-esm-deep-dive) |
| 58 | Q-SAA-058 | Design High-Performing Architectures | 3 | **B** | [modules/07-relational-databases-rds-aurora-and-dsql.md](../modules/07-relational-databases-rds-aurora-and-dsql.md#2-amazon-rds-high-availability-architectures) |
| 59 | Q-SAA-059 | Design Cost-Optimized Architectures | 2 | **B** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#4-s3-storage-class-hierarchy--intelligent-tiering) |
| 60 | Q-SAA-060 | Design Cost-Optimized Architectures | 2 | **A** | [modules/09-messaging-integration-and-streaming.md](../modules/09-messaging-integration-and-streaming.md#5-eventbridge-pipes-and-eventbridge-scheduler) |
| 61 | Q-SAA-061 | Design Cost-Optimized Architectures | 2 | **C** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#4-s3-storage-class-hierarchy--intelligent-tiering) |
| 62 | Q-SAA-062 | Design Cost-Optimized Architectures | 2 | **A** | [modules/08-nosql-dynamodb-and-in-memory-caching.md](../modules/08-nosql-dynamodb-and-in-memory-caching.md#4-capacity-modes-bursting-and-hot-partitions) |
| 63 | Q-SAA-063 | Design Cost-Optimized Architectures | 2 | **A** | [modules/06-storage-s3-ebs-and-efs-internals.md](../modules/06-storage-s3-ebs-and-efs-internals.md#9-amazon-efs-distributed-posix-shared-file-system) |
| 64 | Q-SAA-064 | Design Cost-Optimized Architectures | 2 | **A** | [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#8-aws-step-functions-workflow-orchestration) |
| 65 | Q-SAA-065 | Design Cost-Optimized Architectures | 2 | **A** | [modules/05-serverless-event-driven-architecture.md](../modules/05-serverless-event-driven-architecture.md#9-architectural-patterns-and-production-failure-modes) |
