# Cloud Foundations: Concept to Service Mapping

Cross-provider architectural mapping translating vendor-neutral cloud concepts into concrete service implementations across Amazon Web Services (AWS), Google Cloud Platform (GCP), Microsoft Azure, and Cloudflare.

> [!IMPORTANT]
> A concept belongs in a provider track only when the knowledge disappears if you swap the logo. Provider tracks never re-explain CIDR, CAP theorem, idempotency, or the Well-Architected pillars. They link to this foundation track and cover only vendor deltas: specific names, hard quotas, engine limits, default configurations, pricing traps, and certification framing.

| Concept | AWS | GCP | Azure | Cloudflare (Edge) |
| :-- | :-- | :-- | :-- | :-- |
| **Top-Level Boundary / Hierarchy** | Organization → OU → Account | Organization → Folder → Project | Entra tenant → Management group → Subscription → Resource group | Account → Zone |
| **Preventive Guardrail Policy** | Service Control Policies (SCP), Resource Control Policies (RCP) | Org Policy constraints, IAM Deny policies | Azure Policy (Deny / Modify / DeployIfNotExists) | Account-level configuration rules |
| **Human Identity & SSO** | IAM Identity Center | Cloud Identity / Google Workspace, Workforce Identity | Entra ID (formerly Azure AD) | Cloudflare Access (Zero Trust) |
| **Workload Identity** | IAM Roles (Instance Profile, EKS Pod Identity, AssumeRoleWithWebIdentity) | Service Accounts, Workload Identity Federation | Managed Identities (System- / User-Assigned), Workload Identity Federation | Service Tokens, mTLS Authenticated Origins |
| **Authorization Model** | JSON Identity & Resource policies (explicit deny wins), ABAC tags | Allow policies binding principal → role on resource, IAM Conditions | Azure RBAC role assignments at scope, ABAC conditions | Scoped API Tokens, Workers Access Policies |
| **Virtual Network** | VPC (regional; subnets are AZ-scoped) | VPC (global; subnets are regional) | VNet (regional; subnets span availability zones) | Anycast Global Network (overlay) |
| **Cross-Account Virtual Routing** | Transit Gateway (TGW), Cloud WAN, VPC Sharing (RAM) | Shared VPC, Network Connectivity Center (NCC) | Virtual WAN (vWAN), VNet Peering, Azure Virtual Network Manager | Magic WAN, Cloudflare Tunnel |
| **Stateful L4 Filtering** | Security Groups (stateful), Network ACLs (stateless) | VPC Firewall Rules, Hierarchical Firewall Policies | Network Security Groups (NSG, stateful), Application Security Groups (ASG) | Magic Firewall, WAF Layer 4 Rules |
| **Private PaaS Access** | Gateway Endpoints (S3, DynamoDB), Interface Endpoints (AWS PrivateLink) | Private Google Access, Private Service Connect (PSC) | Service Endpoints, Private Endpoints (Azure Private Link) | Cloudflare Tunnel (`cloudflared`) |
| **Egress NAT** | NAT Gateway (managed, AZ-scoped) | Cloud NAT (software-defined, regional) | Azure NAT Gateway (outbound rules) | Automatic outbound edge SNAT |
| **Layer 7 Load Balancer** | Application Load Balancer (ALB), CloudFront | Global External Application Load Balancer (anycast) | Application Gateway, Azure Front Door | Cloudflare Load Balancing & CDN |
| **Layer 4 Load Balancer** | Network Load Balancer (NLB, TCP/UDP) | Network Load Balancer (passthrough proxy) | Azure Load Balancer (Standard SKU) | Cloudflare Spectrum |
| **Authoritative & Private DNS** | Route 53 (Hosted Zones, Resolver) | Cloud DNS (Public & Private zones) | Azure DNS, Azure Private DNS Zones | Cloudflare DNS (1.1.1.1, Authoritative) |
| **Hybrid Dedicated Connectivity** | AWS Direct Connect (DX), Site-to-Site VPN | Cloud Interconnect (Dedicated / Partner), Cloud VPN | ExpressRoute, Azure VPN Gateway | Cloudflare Network Interconnect (CNI), Magic WAN |
| **Virtual Machines** | Elastic Compute Cloud (EC2 + Auto Scaling Groups) | Compute Engine (GCE + Managed Instance Groups) | Azure Virtual Machines (VM + Virtual Machine Scale Sets) | Not Applicable (V8 Isolate Serverless) |
| **Managed Kubernetes** | Elastic Kubernetes Service (EKS + EKS Auto Mode) | Google Kubernetes Engine (GKE Standard / Autopilot) | Azure Kubernetes Service (AKS + Automatic) | Not Applicable (Container runtime via Workers) |
| **Serverless Containers** | AWS Fargate (ECS / EKS), AWS App Runner | Cloud Run (Services & Jobs) | Azure Container Apps (ACA, KEDA-based) | Cloudflare Containers |
| **Function-as-a-Service (FaaS)** | AWS Lambda | Cloud Run functions (formerly Cloud Functions v2) | Azure Functions (Flex Consumption plan) | Cloudflare Workers (V8 Isolates) |
| **Durable Orchestration** | AWS Step Functions | Google Cloud Workflows | Azure Durable Functions, Logic Apps | Cloudflare Workflows |
| **Object Storage** | Amazon S3 (Standard, Express One Zone, Glacier) | Cloud Storage (Standard, Nearline, Coldline, Archive) | Azure Blob Storage (Hot, Cool, Cold, Archive) | Cloudflare R2 (zero egress fees) |
| **Block Storage** | Elastic Block Store (EBS gp3, io2 Block Express) | Persistent Disk (Standard, Balanced, SSD), Hyperdisk | Azure Managed Disks (Premium SSD v2, Ultra Disk) | Not Applicable |
| **Managed Shared File Storage** | Amazon EFS (NFS), Amazon FSx (Lustre, NetApp ONTAP) | Filestore (NFS), Google Cloud NetApp Volumes | Azure Files (SMB, NFS), Azure NetApp Files | Not Applicable |
| **Managed Relational SQL** | Amazon RDS, Aurora, Aurora DSQL | Cloud SQL, AlloyDB, Google Cloud Spanner | Azure SQL Database, Azure Database for PostgreSQL Flexible | Cloudflare D1 (SQLite), Hyperdrive (pooler) |
| **Managed NoSQL Document / KV** | Amazon DynamoDB | Cloud Firestore, Cloud Bigtable | Azure Cosmos DB (NoSQL, PostgreSQL, MongoDB APIs) | Cloudflare KV, Durable Objects Storage |
| **In-Memory Cache** | Amazon ElastiCache (Valkey, Redis OSS), MemoryDB | Memorystore for Valkey / Redis | Azure Managed Redis | Cloudflare KV, Cache API |
| **Message Queues** | Amazon SQS (Standard, FIFO) | Cloud Pub/Sub (Pull subscriptions), Cloud Tasks | Azure Queue Storage, Azure Service Bus Queues | Cloudflare Queues |
| **Pub/Sub & Event Fan-Out** | Amazon SNS, Amazon EventBridge | Cloud Pub/Sub (Push subscriptions), Eventarc | Azure Service Bus Topics, Azure Event Grid | Cloudflare Queues + Workers |
| **Event Streaming** | Amazon Kinesis Data Streams, Amazon MSK (Kafka) | Cloud Pub/Sub (Ordered delivery), Managed Kafka | Azure Event Hubs (Kafka protocol head) | Workers Analytics Engine, Queues |
| **Data Warehouse & Analytics** | Amazon Redshift, Amazon Athena (Trino/Presto) | BigQuery (Serverless SQL) | Azure Synapse Analytics, Microsoft Fabric | Cloudflare R2 SQL / Data Catalog |
| **KMS & Secrets Management** | AWS Key Management Service (KMS), Secrets Manager | Cloud KMS, Secret Manager | Azure Key Vault, Azure Dedicated HSM | Cloudflare Secrets Store |
| **Native Infrastructure-as-Code** | AWS CloudFormation, AWS CDK | Google Cloud Infrastructure Manager | Azure Resource Manager (ARM), Bicep | Wrangler Configuration (`wrangler.jsonc`) |
| **Native Observability** | Amazon CloudWatch, AWS X-Ray, AWS CloudTrail | Cloud Monitoring, Cloud Logging, Cloud Trace | Azure Monitor, Log Analytics, Application Insights | Cloudflare Workers Logs, Logpush, Tail Workers |
| **Well-Architected Framework** | AWS Well-Architected Framework (6 Pillars) | Google Cloud Architecture Framework (5 Pillars) | Microsoft Azure Well-Architected Framework (5 Pillars) | Zero Trust Reference Architecture |
| **Cost Management & FinOps** | AWS Cost Explorer, Budgets, Cost & Usage Report (CUR) | Cloud Billing Export to BigQuery, Cost Table | Microsoft Cost Management, Power BI Billing Connector | Cloudflare Usage & Billing Dashboard |
| **Local Development Emulator** | LocalStack, Moto | Google Cloud Emulators (Pub/Sub, Firestore, Spanner) | Azurite, Cosmos DB Emulator, Functions Core Tools | `workerd`, Miniflare, Wrangler Local Dev |
