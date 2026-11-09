# Cloud Foundations Cheatsheet

Fast-lookup reference for multi-cloud platform architecture, Well-Architected frameworks, IAM policy evaluation, CIDR subnetting, storage economics, and disaster recovery tiers.

## 1. Well-Architected Pillars Comparison

| Pillar | AWS WAF (6 Pillars) | Google Cloud Architecture Framework (5 Pillars) | Microsoft Azure WAF (5 Pillars) |
| :-- | :-- | :-- | :-- |
| **Pillar 1** | Operational Excellence | Operational Excellence | Operational Excellence |
| **Pillar 2** | Security | Security, Privacy & Compliance | Security |
| **Pillar 3** | Reliability | Reliability | Reliability |
| **Pillar 4** | Performance Efficiency | Performance Optimization | Performance Efficiency |
| **Pillar 5** | Cost Optimization | Cost Optimization | Cost Optimization |
| **Pillar 6** | Sustainability | Cross-Pillar / Environmental Impact | Cross-Pillar Sustainability Guidance |

## 2. Cloud IAM Evaluation Algorithm

```
                 Incoming Request (Principal, Action, Resource, Context)
                                           │
                                           ▼
                            Is there an EXPLICIT DENY?
                                      /        \
                                  YES/          \NO
                                    ▼            ▼
                           DENIED_EXPLICIT   Is there an EXPLICIT ALLOW?
                                                      /        \
                                                  YES/          \NO
                                                    ▼            ▼
                                                 ALLOWED   DENIED_DEFAULT
```

Key Rules:

1. **Explicit Deny Always Wins**: If any matching statement evaluates to `Deny` (across SCPs, IAM policies, or Resource policies), access is denied regardless of any `Allow`.
2. **Default Deny**: All requests are denied by default unless an explicit `Allow` statement matches.
3. **Guardrail Intersection**: Organization guardrails (SCP, Azure Policy, Org Policy) act as filters; they do not grant permissions on their own. Effective permissions are the intersection of Organization guardrails and IAM Identity/Resource permissions.

## 3. IPv4 CIDR Subnetting Matrix (Cloud Reserved IPs)

> [!NOTE]
> Major cloud providers (AWS, Azure, GCP) reserve 5 IP addresses per subnet: Network address (`.0`), Router / Default Gateway (`.1`), DNS resolver (`.2`), Future cloud use (`.3`), and Broadcast address (`.255`).

| Prefix | Total IPv4 Addresses | Usable Cloud IPs | Cloud Subnet Mask | Example Subnet Allocation |
| :-- | :-- | :-- | :-- | :-- |
| `/16` | 65,536 | 65,531 | `255.255.0.0` | Whole VPC / VNet Allocation |
| `/18` | 16,384 | 16,379 | `255.255.192.0` | Large Multi-Tier Environment |
| `/20` | 4,096 | 4,091 | `255.255.240.0` | Broad Regional Subnet Tier |
| `/22` | 1,024 | 1,019 | `255.255.252.0` | Medium Container / Kubernetes Node Pool |
| `/24` | 256 | 251 | `255.255.255.0` | Standard Service / Workload Subnet |
| `/26` | 64 | 59 | `255.255.255.192` | Database or Managed Private Endpoints |
| `/28` | 16 | 11 | `255.255.255.240` | Small Transit / NAT Gateway Tier |

## 4. Disaster Recovery (DR) Strategies

| Strategy | RTO (Recovery Time) | RPO (Data Loss) | Cost Overhead | Architecture Profile |
| :-- | :-- | :-- | :-- | :-- |
| **Backup & Restore** | Hours to Days | Hours (Last Snapshot) | `$` (Lowest) | Cold backups in object storage; re-provisioned via IaC. |
| **Pilot Light** | 10 to 60 Minutes | Minutes (Replication Lag) | `$$` | Core data replicated continuously; compute idle/scaled to zero. |
| **Warm Standby** | 2 to 10 Minutes | Seconds to Minutes | `$$$` | Scaled-down copy of full stack running 24/7; auto-scales up on alarm. |
| **Multi-Region Active-Active** | Near Zero (< 30s) | Near Zero / Zero (Sync or TrueTime) | `$$$$` (Highest) | Full production capacity serving live traffic across multiple regions simultaneously. |

## 5. Storage Classes & Minimum Retention Rules

| Storage Class Tier | Minimum Storage Duration Fee | Retrieval Fee Per GB | Read Latency | Primary Use Case |
| :-- | :-- | :-- | :-- | :-- |
| **Hot / Standard** | None (0 Days) | $0.00 | Milliseconds | Active data, web assets, databases. |
| **Cool / Infrequent Access** | 30 Days | ≈ $0.01 | Milliseconds | Monthly reports, backups held 30+ days. |
| **Cold / Archive** | 90 Days | ≈ $0.03–$0.05 | Minutes to Hours | Regulatory compliance, annual tax archives. |
| **Deep Archive** | 180 Days | ≈ $0.02–$0.05 | 12 to 48 Hours | Long-term digital preservation, tape replacement. |

## 6. Multi-Cloud Cost Traps & FinOps Rules

1. **NAT Gateway Processing Fee**: NAT Gateways charge hourly for the instance _plus_ ≈ $0.045 per GB processed. Downloading container images from public registries via private subnets through a NAT gateway burns huge unnecessary costs; use VPC Private Endpoints instead.
2. **Inter-Availability Zone Egress**: Network traffic crossing AZ boundaries within the same cloud region is billed ≈ $0.01/GB in each direction (≈ $0.02/GB roundtrip). Deploy chatty microservice clusters within the same AZ or use local caching.
3. **Public Egress Asymmetry**: Ingress to cloud hyperscalers is $0.00/GB, while egress back to the internet is billed at ≈ $0.08–$0.09/GB. Use egress-free object stores (such as Cloudflare R2) or CDNs to buffer bandwidth.
4. **Untagged Resource Sprawl**: Cost allocation tags are not retroactive. Enforce tagging guardrails (`Environment`, `Owner`, `CostCenter`, `Service`) via IaC policy at pull-request time.
