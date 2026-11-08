# ACE: Google Cloud Certified Associate Cloud Engineer Question Bank

A preparation question bank for the Google Cloud Certified Associate Cloud Engineer (ACE) examination, strictly formatted to `AGENTS.md` specifications with difficulty ratings, detailed distractor rationales, and syllabus references.

---

## Question Bank

### Q-ACE-001 · Setting up a cloud solution environment · difficulty 2 · scenario

An organization wants to establish centralized control over compute resource locations so that development teams can only provision virtual machines and storage resources in European data centers. Which action fulfills this requirement with the least operational overhead?

- A) Write a custom script that runs nightly via Cloud Scheduler to terminate all instances located outside European regions.
- B) Enforce the Resource Locations organizational policy (`constraints/gcp.resourceLocations`) at the root Organization or target Folder level with an allowlist set to European locations.
- C) Create a custom IAM role that removes compute creation permissions and grant it to all engineers across the company.
- D) Author a VPC firewall egress rule with priority 100 blocking outbound network packets destined for non-European IP CIDRs.

<details><summary>Answer</summary>

**B.** The Resource Locations organizational policy (`constraints/gcp.resourceLocations`) is a native preventive governance guardrail. Setting it at the Organization or Folder level restricts resource creation to specified geographic locations (e.g. `in:eu-locations`), blocking non-compliant API calls at submission time.

- Why not A: A nightly script is a reactive detective control that allows non-compliant resources to run and incur costs for up to 24 hours before termination.
- Why not C: Revoking compute creation permissions entirely prevents developers from launching instances anywhere, rather than restricting their geographic location.
- Why not D: VPC firewall rules control IP packet ingress and egress; they cannot prevent the physical provisioning of Compute Engine instances or Cloud Storage buckets in other regions.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#3-organization-policies-architecture--constraints-engine), https://cloud.google.com/resource-manager/docs/organization-policy/defining-locations

</details>

### Q-ACE-002 · Setting up a cloud solution environment · difficulty 2 · scenario

An administrator creates a budget of $5,000 for a development project and configures email alert thresholds at 50%, 90%, and 100%. Two weeks into the month, a runaway workload incurs $12,000 in charges. Why did the instances continue running past the $5,000 threshold?

- A) The project was created in Auto Mode rather than Custom Mode, which automatically overrides budget thresholds.
- B) Budgets and alerts are monitoring and notification mechanisms only; they do not automatically stop resources or cap spend without programmatic actions.
- C) The budget was missing a dedicated IAM Deny policy explicitly bound to the billing account administrator.
- D) The Essential Contacts API was configured with a Technical contact instead of a Billing contact.

<details><summary>Answer</summary>

**B.** In Google Cloud, budgets and alert thresholds merely trigger email notifications and optional Pub/Sub messages. They never throttle or stop workloads automatically. To stop spend, an automated pipeline must be attached to the Pub/Sub alert topic to detach billing or shut down resources programmatically.

- Why not A: Auto Mode and Custom Mode are VPC networking subnet configurations and have no relationship to billing enforcement.
- Why not C: IAM Deny policies govern IAM permissions for principals; they cannot enforce budgetary spend caps on resources.
- Why not D: While Essential Contacts routes notifications to designated roles, it is purely a communication channel and does not alter budget enforcement behavior.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#2-cloud-billing-architecture--spend-control-mechanics), https://cloud.google.com/billing/docs/how-to/notify

</details>

### Q-ACE-003 · Setting up a cloud solution environment · difficulty 1 · single

Which Google Cloud identifier is globally unique across all customers, cannot be changed once created, and can never be reused even after the project has been permanently deleted?

- A) Project Name
- B) Project ID
- C) Project Number
- D) Billing Account Name

<details><summary>Answer</summary>

**B.** A Project ID is a globally unique string (6 to 30 characters) chosen by the creator. Once chosen, it is immutable, and once the project is expunged past the 30-day soft-delete holding period, that Project ID is retired forever and can never be claimed by another customer.

- Why not A: Project Names are mutable display labels and do not need to be globally unique.
- Why not C: While Project Numbers are globally unique and immutable, they are generated integers rather than user-selected identifiers.
- Why not D: Billing Account Names are display strings associated with payment profiles and do not govern project identity.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#node-types-and-identifiers), https://cloud.google.com/resource-manager/docs/creating-managing-projects

</details>

### Q-ACE-004 · Configuring access and security · difficulty 2 · scenario

A developer accidentally deleted an object from a production Cloud Storage bucket. The company needs to guarantee that developers cannot delete any storage buckets or objects in the production folder, even if they possess full administrative privileges on individual projects within that folder. What should you configure?

- A) An IAM permission boundary attached to each developer Google Account.
- B) An IAM Deny policy attached to the production Folder denying `storage.objects.delete` and `storage.buckets.delete`.
- C) A custom role attached to each bucket that disables the delete button in Cloud Console.
- D) An Essential Contacts entry routing storage deletion alerts to the security operations center.

<details><summary>Answer</summary>

**B.** In Google Cloud IAM evaluation logic, Deny policies evaluate before Allow policies, and an explicit Deny trumps all Allow permissions across the hierarchy. Placing an IAM Deny policy on the production Folder ensures that even if a developer possesses `roles/storage.admin` or Project Owner on a project, deletion actions are denied.

- Why not A: Google Cloud IAM does not utilize AWS-style IAM permission boundaries for human user accounts in this manner; PABs apply to workforce perimeters, while Deny policies apply directly to resource containers.
- Why not C: Cloud Console UI customizations do not prevent programmatic deletion via `gcloud`, gsutil, or the REST API.
- Why not D: Essential Contacts is a notification routing mechanism and does not block API requests.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#7-interview-drill-architectural-questions--scenarios), [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#3-deterministic-evaluation-logic-allow-vs-deny-policies), https://cloud.google.com/iam/docs/deny-overview

</details>

### Q-ACE-005 · Configuring access and security · difficulty 2 · scenario

A CI/CD runner deployed in GitHub Actions needs to build and deploy container images to Google Cloud Artifact Registry. Security policy strictly forbids creating or downloading long-lived service account JSON keys. What authentication architecture should you implement?

- A) Compute Engine default service account keys committed into a private GitHub repository secret.
- B) Workload Identity Federation (WIF) configured with a GitHub OIDC provider and service account impersonation.
- C) Basic authentication using a project administrator username and password stored in GitHub environment variables.
- D) An SSH key pair generated on the runner with the public key added to Cloud Identity metadata.

<details><summary>Answer</summary>

**B.** Workload Identity Federation (WIF) allows external workloads such as GitHub Actions to exchange short-lived OIDC tokens for temporary Google Cloud Security Token Service (STS) credentials, eliminating the need to store long-lived service account private keys.

- Why not A: Committing service account private keys into repository secrets violates the mandate to avoid static downloadable keys.
- Why not C: Google Cloud APIs do not support basic username/password authentication for API deployments.
- Why not D: SSH keys are used for Linux VM terminal access, not for authenticating to Google Cloud management APIs or Artifact Registry.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#5-workload-identity-federation-keyless-external-authentication), https://cloud.google.com/iam/docs/workload-identity-federation

</details>

### Q-ACE-006 · Configuring access and security · difficulty 2 · scenario

An engineer needs to manage Compute Engine instances in a project, but only for instances tagged with `environment: dev`. How can you implement this access control with least privilege?

- A) Grant the engineer `roles/compute.admin` on the project and ask them not to touch production instances.
- B) Grant the engineer `roles/compute.instanceAdmin.v1` with an IAM Condition evaluating `resource.matchTag('123456789012/environment', 'dev')`.
- C) Create a VPC firewall rule blocking the engineer IP address from reaching production instances.
- D) Grant the engineer the basic Viewer role on the project and Editor role on Cloud Storage.

<details><summary>Answer</summary>

**B.** IAM Conditions support Common Expression Language (CEL) expressions to evaluate resource tags. Binding `roles/compute.instanceAdmin.v1` with a tag condition ensures the engineer can only perform administrative actions on instances matching the `dev` tag value.

- Why not A: Trusting human discretion without policy enforcement violates the principle of least privilege and provides full access to production.
- Why not C: Firewall rules control network packet flow between IP addresses and ports, not API management permissions in Google Cloud IAM.
- Why not D: Basic Viewer role is read-only and does not allow managing instances, while Editor on storage has no effect on compute management.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#4-resource-labels-vs-resource-tags), [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#1-google-cloud-iam-conceptual-architecture), https://cloud.google.com/iam/docs/conditions-overview

</details>

### Q-ACE-007 · Planning and implementing a cloud solution · difficulty 2 · scenario

A network engineer is configuring an enterprise Google Cloud network that must connect to an on-premises data center via Cloud Interconnect. Which VPC creation mode must be used, and why?

- A) Auto Mode, because it automatically provisions subnets in every region to optimize routing tables.
- B) Custom Mode, because Auto Mode uses predefined IP ranges that frequently conflict with on-premises RFC 1918 networks.
- C) Legacy Mode, because it disables regional routing barriers across the global network.
- D) Default Mode, because it automatically enables Private Google Access on all subnets.

<details><summary>Answer</summary>

**B.** Enterprise hybrid networks must always use Custom Mode VPC networks. Auto Mode networks automatically create `/20` subnets using fixed CIDR blocks within `10.128.0.0/9`, which inevitably collide with enterprise on-premises networks and prevent BGP routing.

- Why not A: Auto Mode subnet allocation is an anti-pattern for enterprise hybrid networks due to IP range collisions.
- Why not C: Legacy networks are obsolete, single-range non-subnetted networks that are deprecated and not recommended.
- Why not D: There is no formal "Default Mode" network type; newly created projects receive a default Auto Mode network unless explicitly configured otherwise.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#auto-mode-vs-custom-mode-networks), https://cloud.google.com/vpc/docs/vpc#subnet-ranges

</details>

### Q-ACE-008 · Planning and implementing a cloud solution · difficulty 2 · scenario

A company needs to provision a fleet of private Compute Engine instances without external IP addresses that can download software updates from public internet repositories. What service should be deployed?

- A) Private Google Access configured on the subnet.
- B) Cloud NAT configured on a Cloud Router in the VPC and region.
- C) An external HTTP(S) Load Balancer connected to a Serverless NEG.
- D) An Identity-Aware Proxy (IAP) TCP forwarding tunnel.

<details><summary>Answer</summary>

**B.** Cloud NAT provides managed outbound network address translation, allowing private VMs without external IP addresses to initiate outbound connections to the internet to download updates while preventing unsolicited inbound connections.

- Why not A: Private Google Access allows private VMs to reach Google Cloud APIs and services (e.g. Cloud Storage, BigQuery), but does not allow access to general public internet domains.
- Why not C: External HTTP(S) Load Balancers handle incoming ingress traffic from external clients to backend services, not outbound VM internet egress.
- Why not D: IAP TCP forwarding allows authorized external users to establish inbound administrative tunnels (SSH/RDP) to private VMs, not outbound internet browsing.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#5-cloud-nat-architecture--port-allocation-mechanics), https://cloud.google.com/nat/docs/overview

</details>

### Q-ACE-009 · Planning and implementing a cloud solution · difficulty 3 · scenario

A backend microservice deployed on private Compute Engine VMs sends thousands of outbound requests per minute to an external payment processor. Under load bursts, the service reports intermittent connection timeouts, but VM CPU utilization remains below 20%. What is the most likely root cause?

- A) Cloud NAT port exhaustion caused by the default static allocation of 64 ports per VM.
- B) The Andromeda SDN dropping packets due to non-transitive VPC peering rules.
- C) Private Google Access rate limiting HTTPS connections to external payment gateways.
- D) Cloud Armor WAF blocking outbound traffic from private IP addresses.

<details><summary>Answer</summary>

**A.** By default, Cloud NAT static port allocation assigns only 64 source ports per VM instance. If a high-throughput microservice initiates more than 64 concurrent outbound TCP connections, additional connection attempts are silently dropped due to source port exhaustion, resulting in timeouts.

- Why not B: VPC peering transitivity constraints affect private inter-VPC traffic, not outbound internet connections traversing Cloud NAT.
- Why not C: Private Google Access routes traffic to Google internal Anycast VIPs; it is not involved in routing traffic to external third-party payment gateways.
- Why not D: Cloud Armor inspects incoming ingress traffic to external load balancers; it does not filter outbound egress traffic from VMs.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#5-cloud-nat-architecture--port-allocation-mechanics), https://cloud.google.com/nat/docs/troubleshooting#nat-allocation-exhaustion

</details>

### Q-ACE-010 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

An administrator wants to prevent developers from attaching public external IP addresses to any new Compute Engine instances in a project. Which solution enforces this guardrail automatically?

- A) Write a custom script that runs every minute to delete external IP addresses.
- B) Apply the `constraints/compute.vmExternalIpAccess` organizational policy constraint to deny external IP access on the project or folder.
- C) Create a VPC firewall egress rule with priority 65535 denying all traffic.
- D) Delete the default internet gateway route (`0.0.0.0/0`) from the VPC routing table.

<details><summary>Answer</summary>

**B.** The Organization Policy constraint `constraints/compute.vmExternalIpAccess` allows administrators to specify an allowlist or denylist of instances that can be assigned external IP addresses. Setting this to deny all blocks the creation or update of any instance with an external IP address.

- Why not A: Cron scripts are reactive, allowing instances with public IPs to exist and be exposed between script executions.
- Why not C: Priority 65535 is the lowest possible priority and will be overridden by any higher priority rule; furthermore, firewall rules do not prevent the allocation of IP addresses.
- Why not D: Deleting the default route breaks internet egress for all workloads (including NAT and private access), but does not prevent the instance from having a public IP attached.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#3-organization-policies-architecture--constraints-engine), https://cloud.google.com/compute/docs/ip-addresses/reserve-static-external-ip-address#disable-external-ip

</details>

### Q-ACE-011 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A security policy mandates that user-managed service account private keys (`.json` files) must never be created anywhere within the corporate Google Cloud organization. How should you enforce this requirement?

- A) Remove the Service Account User role from all developers.
- B) Enforce the `constraints/iam.disableServiceAccountKeyCreation` organization policy at the root Organization level.
- C) Delete all service accounts across all projects and use Google accounts for all workloads.
- D) Block port 443 outbound to prevent private key downloads.

<details><summary>Answer</summary>

**B.** The Organization Policy constraint `constraints/iam.disableServiceAccountKeyCreation` prevents users from generating and downloading user-managed service account keys, forcing the adoption of service account impersonation and Workload Identity Federation.

- Why not A: Removing `roles/iam.serviceAccountUser` prevents attaching service accounts to resources, but does not block principals with key creation permissions (`iam.serviceAccountKeys.create`) from generating keys.
- Why not C: Automated workloads and APIs require service account identities to function securely in Google Cloud.
- Why not D: Blocking port 443 breaks all Google Cloud API communication and HTTPS web browsing.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#4-service-accounts-architecture--credential-hardening), https://cloud.google.com/iam/docs/understanding-service-accounts#disable_key_creation

</details>

### Q-ACE-012 · Configuring access and security · difficulty 2 · scenario

A central networking team needs to separate network administration from application development. Application teams need to deploy VMs into specific subnets in a shared network, but must not be able to modify firewall rules, routes, or gateways. What architecture fulfills this requirement?

- A) Deploy each application team in a separate VPC and peer all networks with VPC Peering.
- B) Configure a Shared VPC with a central Host Project and multiple Service Projects, granting application teams `roles/compute.networkUser` on specific subnets.
- C) Grant application developers the Network Admin role on the shared project.
- D) Create a single project and give all developers Project Editor permissions.

<details><summary>Answer</summary>

**B.** Shared VPC allows an organization to connect resources from multiple Service Projects to a centralized VPC network in a Host Project. Granting developers `roles/compute.networkUser` scoped to specific subnets allows them to provision VMs without granting any authority to modify network configurations.

- Why not A: VPC Peering requires separate VPCs to be managed, increases routing complexity, and does not centralize subnet administration.
- Why not C: Granting Network Admin allows developers to modify firewall rules, routes, and subnets, violating least privilege.
- Why not D: Project Editor grants full permissions across all services in the project, eliminating administrative boundaries.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#3-shared-vpc-multi-tenant-architecture), https://cloud.google.com/vpc/docs/shared-vpc

</details>

### Q-ACE-013 · Planning and implementing a cloud solution · difficulty 2 · scenario

Company A and Company B both host workloads in Google Cloud VPC networks that use the identical IP range `10.0.0.0/16`. Workloads in Company A need to securely call an internal REST API hosted in Company B. What solution enables this communication without modifying existing IP address allocations?

- A) Establish VPC Network Peering between the two VPCs and enable custom route export.
- B) Publish the API using Private Service Connect (PSC) in Company B and create a PSC Endpoint in Company A.
- C) Deploy Cloud HA VPN between the two VPCs with static routing.
- D) Convert both VPC networks from Custom Mode to Auto Mode.

<details><summary>Answer</summary>

**B.** Private Service Connect (PSC) uses a software-defined Layer 4 proxy mechanism to connect consumer endpoints to producer services. Because PSC translates traffic transparently, consumer and producer VPCs can have overlapping IP address spaces (such as `10.0.0.0/16`).

- Why not A: VPC Network Peering strictly fails if any primary or secondary subnet ranges overlap between the two networks.
- Why not C: Standard IPsec VPN routing fails without complex double-NAT configurations when both sides share the identical CIDR prefix.
- Why not D: Custom Mode networks cannot be converted to Auto Mode, and Auto Mode would not resolve overlapping CIDRs.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#4-vpc-network-peering-vs-private-service-connect-psc), https://cloud.google.com/vpc/docs/private-service-connect

</details>

### Q-ACE-014 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

An engineer accidentally deletes a critical project using the `gcloud projects delete` command. Twelve days later, the team realizes the project contained irreplaceable configuration files. Can the project be restored, and what command should be executed?

- A) No; project deletion is immediate and irrevocable.
- B) Yes; execute `gcloud projects undelete <project-id>` because projects remain in a soft-delete state for 30 days.
- C) Yes; contact Google Cloud Support to restore the project from tape backup.
- D) Yes; recreate the project using the same Project ID.

<details><summary>Answer</summary>

**B.** Google Cloud places deleted projects into a 30-day soft-delete holding period. During this window, an owner or Organization Administrator can restore the project and its resources by executing `gcloud projects undelete <project-id>`.

- Why not A: Projects are not permanently expunged immediately; they enter a 30-day soft-delete state.
- Why not C: Support intervention is unnecessary; self-service restoration is available via the CLI and console.
- Why not D: Project IDs cannot be reused while the project is in the soft-delete state, nor after it is permanently expunged.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#node-types-and-identifiers), https://cloud.google.com/resource-manager/docs/creating-managing-projects#restoring_a_project

</details>

### Q-ACE-015 · Configuring access and security · difficulty 2 · scenario

A developer needs temporary administrative access to deploy an application to a production project. Instead of creating a long-lived service account key or permanently elevating the user's role, what is the Google Cloud recommended best practice?

- A) Temporarily grant the developer the basic Project Owner role and set a calendar reminder to revoke it.
- B) Grant the developer `roles/iam.serviceAccountTokenCreator` on the deployment service account so they can impersonate it.
- C) Add the developer to the default Compute Engine service account.
- D) Have the developer commit their personal credentials to a secret manager.

<details><summary>Answer</summary>

**B.** Service account impersonation allows an authorized user to generate short-lived OAuth 2.0 access tokens (typically valid for 1 hour) for a service account via the IAM Credentials API. This provides the necessary deployment permissions without issuing long-lived private keys or permanently elevating the user's personal identity.

- Why not A: Granting temporary Project Owner introduces severe security risks and relies on error-prone manual revocation.
- Why not C: Default service accounts should have their permissions stripped and should never be used for human access.
- Why not D: Storing personal credentials in secret managers does not solve access scoping and creates credential sprawl.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#the-static-key-vulnerability-vs-short-lived-impersonation), https://cloud.google.com/iam/docs/impersonating-service-accounts

</details>

### Q-ACE-016 · Planning and implementing a cloud solution · difficulty 2 · scenario

A security policy requires that all internal virtual machines in a production VPC must resolve internal domain names belonging to another VPC network managed by a different team. Neither network should be peered, and no public DNS records should be created. What Cloud DNS feature should you use?

- A) Cloud DNS Public Zone
- B) Cloud DNS Peering Zone
- C) Cloud DNS Forwarding Zone pointing to 8.8.8.8
- D) Cloud DNS Dynamic Response Policy

<details><summary>Answer</summary>

**B.** Cloud DNS Peering Zones allow one VPC network to forward DNS queries for a specific private domain directly to another VPC network's private DNS zone without requiring VPC Network Peering or public routing between the underlying subnets.

- Why not A: Public zones publish records to the global internet, violating the requirement to keep records private.
- Why not C: Forwarding to public resolvers (`8.8.8.8`) cannot resolve private, non-public internal domains.
- Why not D: Response policies are used for DNS firewalling and query overrides, not for cross-VPC private resolution.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#8-interview-drill-architectural-questions--scenarios), https://cloud.google.com/dns/docs/zones/peering-zones

</details>

### Q-ACE-017 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

An organization provisions a Cloud HA VPN between their on-premises network and Google Cloud. The contract specifies a 99.99% availability SLA. What configuration is mandatory to qualify for this SLA?

- A) Single VPN tunnel configured with static routes.
- B) Two VPN tunnels connecting the Cloud HA VPN gateway to two separate on-premises VPN gateways with dynamic BGP routing.
- C) Three VPN tunnels connecting to a single on-premises router interface.
- D) A Cloud NAT gateway configured in the same subnet as the VPN.

<details><summary>Answer</summary>

**B.** Google Cloud's 99.99% availability SLA for Cloud HA VPN requires two VPN tunnels configured from the Cloud HA VPN gateway to two distinct on-premises peer gateways (or two separate interfaces on redundant hardware) utilizing dynamic routing with BGP.

- Why not A: Static routing is not supported for HA VPN, and a single tunnel only provides a 99.9% SLA at best.
- Why not C: Terminating tunnels on a single on-premises router interface leaves an on-premises single point of failure, disqualifying the deployment from the 99.99% SLA.
- Why not D: Cloud NAT handles outbound internet traffic for VMs; it is completely unrelated to VPN gateway SLA compliance.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#6-hybrid-connectivity-cloud-interconnect-vs-ha-vpn), https://cloud.google.com/network-connectivity/docs/vpn/concepts/topologies

</details>

### Q-ACE-018 · Setting up a cloud solution environment · difficulty 2 · scenario

An enterprise needs to ensure that all critical security incident notifications, legal DMCA notices, and billing suspension warnings are automatically routed to verified corporate email lists rather than individual project creators. Which Google Cloud API solves this?

- A) Cloud Monitoring Notification Channels
- B) Essential Contacts API
- C) Cloud Logging Sinks
- D) Cloud Pub/Sub Push Subscriptions

<details><summary>Answer</summary>

**B.** The Essential Contacts API allows administrators to configure verified email contacts for specific notification categories (SECURITY, BILLING, LEGAL, SUSPENSION, TECHNICAL) at the Organization, Folder, or Project level, ensuring automated Google Cloud communications reach designated teams.

- Why not A: Cloud Monitoring notification channels receive alerts from user-defined metric alert policies, not official Google administrative and legal communications.
- Why not C: Cloud Logging sinks export log entries to storage or BigQuery; they do not manage platform incident communications.
- Why not D: Pub/Sub is a messaging queue service and does not manage official corporate contact registrations.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#5-essential-contacts-and-operational-governance), https://cloud.google.com/resource-manager/docs/essential-contacts

</details>

### Q-ACE-019 · Configuring access and security · difficulty 2 · scenario

A security administrator configures an Organization-level hierarchical firewall rule with Priority 100 that denies ingress traffic on port 22 from `0.0.0.0/0`. A developer in a project creates a VPC firewall rule with Priority 10 that allows port 22 from `0.0.0.0/0` to instances tagged `bastion`. What happens when an external user attempts an SSH connection to a bastion instance?

- A) The connection is allowed because the VPC rule has a lower priority number (10 vs 100).
- B) The connection is dropped because Hierarchical Firewall Policies evaluate before VPC-level firewall rules.
- C) The connection is allowed because network tags override hierarchical policies.
- D) The connection is rejected by the default implied egress rule.

<details><summary>Answer</summary>

**B.** Hierarchical Firewall Policies are evaluated before any VPC-level firewall rules. Because the Organization-level rule matches the packet (ingress on port 22) and executes a `DENY`, the packet is dropped immediately without ever evaluating the project's local VPC firewall rules.

- Why not A: Priority numbers are only compared within the same policy layer; hierarchical rules evaluate before VPC rules regardless of priority numbers.
- Why not C: Target network tags in a lower-level VPC rule cannot bypass an explicit Deny in an ancestor hierarchical policy.
- Why not D: Default implied egress allows outbound traffic; this scenario concerns inbound ingress traffic, which is blocked by the hierarchical rule.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#2-hierarchical-firewall-policies-vs-vpc-firewall-rules), https://cloud.google.com/firewall/docs/hierarchical-firewall-policies

</details>

### Q-ACE-020 · Planning and implementing a cloud solution · difficulty 2 · scenario

A company needs to connect their on-premises data center to a Google Cloud VPC with dedicated, high-throughput physical fiber circuits delivering 100 Gbps bandwidth and an industry-standard 99.99% availability SLA. What solution must be provisioned?

- A) Cloud HA VPN with 34 active tunnels.
- B) Dedicated Cloud Interconnect with 4 physical circuits deployed across 2 distinct metropolitan locations and 2 colocation facilities.
- C) Partner Interconnect with a single 100 Mbps VLAN attachment.
- D) Carrier Peering with static route tables.

<details><summary>Answer</summary>

**B.** Dedicated Interconnect provides direct physical 10 Gbps, 100 Gbps, or 400 Gbps cross-connect circuits into Google colocation facilities. Achieving a 99.99% SLA requires four circuits deployed across two distinct metropolitan areas (two circuits per metro across two separate colocation edge facilities).

- Why not A: Cloud HA VPN runs over the public internet, each tunnel is capped at 3 Gbps, and managing 34 tunnels introduces extreme operational complexity.
- Why not C: Partner Interconnect is provisioned via service providers and a single attachment provides zero hardware redundancy, falling far short of a 99.99% SLA.
- Why not D: Carrier Peering provides enterprise edge routing to Google public services, not private RFC 1918 VPC connectivity.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#6-hybrid-connectivity-cloud-interconnect-vs-ha-vpn), https://cloud.google.com/network-connectivity/docs/interconnect/concepts/overview

</details>

### Q-ACE-021 · Configuring access and security · difficulty 2 · single

In Google Cloud IAM, what is the role assigned to Google internal service agents (e.g. `service-<project-number>@gcp-sa-storage.iam.gserviceaccount.com`) that allows them to perform automated background tasks?

- A) Primitive Owner Role
- B) Google-managed Service Agent Role
- C) Project Editor Role
- D) Custom Identity Role

<details><summary>Answer</summary>

**B.** Google Cloud provisions internal Service Agents for various APIs and automatically grants them specialized Predefined Service Agent roles (e.g., `roles/storage.serviceAgent`) containing the minimum required permissions to coordinate background tasks across services.

- Why not A: Primitive Owner roles are overly permissive and never assigned to modern service agents.
- Why not C: The Project Editor role is not assigned to specific service agents; service agents receive least-privilege service agent roles.
- Why not D: Custom roles are user-managed; Google-managed service agents rely on Google-maintained service agent roles.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#service-account-taxonomy), https://cloud.google.com/iam/docs/service-agents

</details>

### Q-ACE-022 · Setting up a cloud solution environment · difficulty 2 · scenario

An organization wants to categorize projects by business unit and billing cost center for financial reporting in BigQuery. The metadata must be editable by resource owners and visible on daily invoice exports. Which primitive should be used?

- A) Resource Manager Tags
- B) Resource Labels
- C) IAM Conditions
- D) Organizational Policies

<details><summary>Answer</summary>

**B.** Resource Labels are lightweight key-value pairs designed specifically for billing allocation, cost-center grouping, and inventory filtering. They appear directly on billing export records in BigQuery and can be modified by resource owners.

- Why not A: Resource Manager Tags are centrally governed for security policy and IAM conditional access; they are heavier to manage and not designed for simple cost center reporting.
- Why not C: IAM Conditions govern conditional authorization logic and do not attach metadata to resources for billing exports.
- Why not D: Organizational Policies enforce compliance constraints; they do not tag resources for billing exports.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#4-resource-labels-vs-resource-tags), https://cloud.google.com/resource-manager/docs/labels-overview

</details>

### Q-ACE-023 · Configuring access and security · difficulty 2 · scenario

An engineer wants to audit who has access to read objects in a Cloud Storage bucket. They notice that `roles/storage.objectViewer` is granted to `group:all-staff@example.com` on the Folder containing the project, but the project's local IAM policy contains no storage bindings. Why can members of the staff group still view objects in the bucket?

- A) Cloud Storage ignores IAM and defaults to public access.
- B) IAM Allow policies inherit monotonically down the resource hierarchy from Organization to Folder to Project to Resource.
- C) The staff group was assigned the primitive Project Owner role by default.
- D) The bucket has legacy ACLs enabled that grant read access to all users.

<details><summary>Answer</summary>

**B.** Google Cloud IAM permissions inherit downward additively. An Allow policy binding created at an ancestor Folder level applies automatically to all Projects and Resources beneath that Folder, even if the leaf resource's local policy contains no explicit bindings.

- Why not A: Cloud Storage enforces Google Cloud IAM as its primary authorization model.
- Why not C: Staff groups are not granted Project Owner by default.
- Why not D: Even with Uniform Bucket-Level Access disabled, inherited IAM permissions grant access regardless of local object ACLs.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#1-formal-resource-hierarchy-architecture), [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#3-deterministic-evaluation-logic-allow-vs-deny-policies), https://cloud.google.com/iam/docs/resource-hierarchy-access-control

</details>

### Q-ACE-024 · Planning and implementing a cloud solution · difficulty 2 · scenario

A developer needs to expand an existing subnet with primary IP range `10.1.0.0/24` (254 addresses) to accommodate 500 new virtual machines. The subnet is in a Custom Mode VPC and currently hosts 200 active production VMs. How can the developer expand the capacity with zero downtime?

- A) Delete the subnet and recreate it with `10.1.0.0/22`.
- B) Execute `gcloud compute networks subnets expand-ip-range` to expand the prefix length to `/22`.
- C) Convert the VPC network to Auto Mode.
- D) Create a secondary IP range and migrate all VM primary interfaces to the secondary range.

<details><summary>Answer</summary>

**B.** Google Cloud VPC permits non-disruptive subnet CIDR range expansion for Custom Mode subnets using `expand-ip-range`. Expanding the prefix length from `/24` to `/22` increases capacity to 1,022 usable addresses without terminating running VMs or dropping network connections.

- Why not A: Deleting a subnet requires terminating all attached VMs first, causing unacceptable production downtime.
- Why not C: Custom Mode networks cannot be converted to Auto Mode, and Auto Mode subnets are fixed at `/20`.
- Why not D: Compute Engine VM primary interfaces cannot be assigned to secondary IP ranges; secondary ranges are used for alias IPs, GKE pods, and services.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#8-interview-drill-architectural-questions--scenarios), https://cloud.google.com/vpc/docs/create-modify-vpc-networks#expand-subnet

</details>

### Q-ACE-025 · Configuring access and security · difficulty 2 · scenario

An organization wants to authenticate external contractors into Google Cloud to access specific analytics tools, but wants to ensure that even if a contractor account is compromised, the identity can never be used to access projects outside the analytics business unit. What security control should be implemented?

- A) IAM Deny Policy on every external project
- B) Principal Access Boundary (PAB) policy restricting the contractor's identity to analytics project resource perimeters
- C) VPC Service Controls perimeter around all non-analytics projects
- D) Cloud Armor security policy blocking contractor IP addresses

<details><summary>Answer</summary>

**B.** A Principal Access Boundary (PAB) policy defines an identity-side security perimeter that restricts the resources a principal can access. Restricting the contractor's identity to analytics project resource prefixes guarantees that the credential cannot access other projects, regardless of any Allow grants.

- Why not A: Authoring and updating individual Deny policies across hundreds of current and future projects is operationally fragile and prone to omission.
- Why not C: VPC Service Controls protects resource services against data exfiltration; it is not configured on a per-identity basis for contractor bounding.
- Why not D: Cloud Armor protects web application load balancers against Layer 7 attacks, not Google Cloud management API access.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#6-principal-access-boundaries-pab), https://cloud.google.com/iam/docs/principal-access-boundary-policies

</details>

### Q-ACE-026 · Setting up a cloud solution environment · difficulty 2 · scenario

A DevOps lead needs to grant an intern permission to view Google Cloud billing account costs and associate existing projects with the billing account, without allowing the intern to view credit card details or modify payment profiles. What predefined role should be granted?

- A) `roles/billing.admin`
- B) `roles/billing.user`
- C) `roles/billing.viewer`
- D) `roles/owner`

<details><summary>Answer</summary>

**B.** The Billing Account User role (`roles/billing.user`) allows a principal to associate projects with a billing account without granting permissions to view payment instruments, manage billing accounts, or modify invoicing contracts.

- Why not A: `roles/billing.admin` provides full administrative control over the billing account, including payment methods and account management.
- Why not C: `roles/billing.viewer` allows viewing billing account costs and transactions, but does not grant permission to link projects to the billing account.
- Why not D: `roles/owner` is a basic role with full control over project resources and should never be granted for billing delegation.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#billing-association-rules), https://cloud.google.com/billing/docs/how-to/billing-access

</details>

### Q-ACE-027 · Ensuring successful operation of a cloud solution · difficulty 2 · single

When configuring a custom IAM role in Google Cloud, what happens to the custom role if Google deprecates or changes an underlying permission included in the role's definition?

- A) Google Cloud automatically updates the custom role with replacement permissions.
- B) The customer is responsible for maintaining and updating custom role permissions when underlying APIs change.
- C) The custom role is immediately deleted by the IAM service.
- D) The custom role is automatically upgraded to the nearest predefined role.

<details><summary>Answer</summary>

**B.** Custom roles carry an operational maintenance burden: Google does not automatically update custom roles when new API permissions are added or existing permissions are modified. The organization must monitor and maintain custom role definitions manually.

- Why not A: Automatic permission updates apply only to Google-managed Predefined Roles.
- Why not C: Deprecated permissions do not cause the entire role to be deleted; the deprecated permission simply ceases to grant access.
- Why not D: Google Cloud never converts or upgrades custom roles to predefined roles automatically.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#2-role-taxonomy-basic-vs-predefined-vs-custom-roles), https://cloud.google.com/iam/docs/understanding-custom-roles

</details>

### Q-ACE-028 · Planning and implementing a cloud solution · difficulty 2 · scenario

A developer creates a Cloud Storage bucket to host public assets for a web application. The developer attempts to set an object-level ACL granting `allUsers:READER`, but the command fails with an error indicating that ACLs are disabled. What bucket setting is causing this behavior?

- A) Bucket Lock compliance mode
- B) Uniform Bucket-Level Access (UBLA)
- C) Object Versioning
- D) Autoclass lifecycle policy

<details><summary>Answer</summary>

**B.** Uniform Bucket-Level Access (UBLA) disables legacy object-level Access Control Lists (ACLs) entirely, requiring all access to be managed exclusively through Cloud IAM policies at the bucket level. When UBLA is enabled, any attempt to evaluate or mutate object ACLs is rejected.

- Why not A: Bucket Lock prevents the reduction of retention periods; it does not disable ACLs.
- Why not C: Object Versioning preserves historical versions of modified or deleted objects; it does not govern ACL enforcement.
- Why not D: Autoclass automatically transitions objects across storage classes based on access patterns without disabling ACLs.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#3-organization-policies-architecture--constraints-engine), https://cloud.google.com/storage/docs/uniform-bucket-level-access

</details>

### Q-ACE-029 · Configuring access and security · difficulty 2 · scenario

A security engineer needs to verify which specific IAM policies, roles, and conditions are granting a user permission to read a confidential BigQuery table. What Google Cloud tool provides automated root-cause analysis for authorization decisions?

- A) Cloud Trace
- B) Policy Troubleshooter
- C) Cloud Profiler
- D) Cloud Debugger

<details><summary>Answer</summary>

**B.** Policy Troubleshooter is a native Google Cloud IAM diagnostic tool that inspects the resource hierarchy and evaluates all Allow policies, Deny policies, and conditions to explain whether and why a specific principal is granted or denied a permission on a resource.

- Why not A: Cloud Trace tracks latency and distributed call chains for microservice requests.
- Why not C: Cloud Profiler analyzes CPU and memory consumption in application runtime code.
- Why not D: Cloud Debugger was a legacy application inspection tool and is deprecated; it does not evaluate IAM policies.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#3-deterministic-evaluation-logic-allow-vs-deny-policies), https://cloud.google.com/iam/docs/troubleshoot-policy

</details>

### Q-ACE-030 · Planning and implementing a cloud solution · difficulty 2 · scenario

A company has private Compute Engine virtual machines in a VPC that must privately communicate with a Cloud SQL MySQL database instance. How should connectivity between the VPC and Cloud SQL be established?

- A) Assign public IP addresses to both the VMs and the Cloud SQL instance and allow port 3306 in firewall rules.
- B) Configure Private Services Access (PSA) using a reserved internal IP range and VPC Network Peering with Google's service producer network.
- C) Connect the VPC to Cloud SQL using a Cloud HA VPN tunnel.
- D) Export the Cloud SQL database to Cloud Storage and read it via Private Google Access.

<details><summary>Answer</summary>

**B.** Cloud SQL private IP connectivity is established via Private Services Access (PSA), which sets up a private VPC Network Peering connection between the customer's VPC and the Google-managed Service Networking VPC hosting the Cloud SQL instance, allocating addresses from a reserved private range.

- Why not A: Assigning public IP addresses violates security requirements for private database access.
- Why not C: Cloud HA VPN connects customer on-premises networks to Google Cloud, not Google Cloud internal PaaS services.
- Why not D: Exporting databases to Cloud Storage is an asynchronous backup mechanism, not an interactive transactional database connection.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#4-vpc-network-peering-vs-private-service-connect-psc), https://cloud.google.com/sql/docs/mysql/private-ip

</details>
### Q-ACE-031 · Setting up a cloud solution environment · difficulty 2 · scenario

An engineer works across three distinct Google Cloud environments: development, staging, and production. The engineer frequently switches between projects, default compute zones, and service account credentials, leading to accidental command execution against the wrong project. How should the engineer structure the local environment using the Google Cloud SDK to prevent this?

- A) Reinstall the Google Cloud SDK into three separate directory paths and invoke them via absolute file paths.
- B) Create and name separate gcloud configurations using `gcloud config configurations create` and toggle between them using `gcloud config configurations activate`.
- C) Export the `CLOUDSDK_CORE_PROJECT` environment variable manually in every shell session prior to executing commands.
- D) Maintain three distinct Google user accounts and log into the web console in three separate private browser tabs.

<details><summary>Answer</summary>

**B.** The Google Cloud SDK natively supports named configurations (`gcloud config configurations`). By defining distinct configurations for `dev`, `staging`, and `prod`, each environment encapsulates its own active account, project ID, default compute region, and compute zone. Activating a configuration (`gcloud config configurations activate prod`) atomically transitions all gcloud settings without risk of cross-environment pollution.

- Why not A: Installing multiple SDK instances introduces severe maintenance overhead, PATH conflicts, and redundant disk usage.
- Why not C: Relying on manual environment variable exports is error-prone, easy to forget, and does not persist across new shell tabs.
- Why not D: Multiple web console sessions do not configure or protect CLI commands executed from the terminal.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#1-formal-resource-hierarchy-architecture), https://cloud.google.com/sdk/docs/configurations

</details>

### Q-ACE-032 · Setting up a cloud solution environment · difficulty 2 · scenario

An enterprise with 5,000 corporate employees in an on-premises Microsoft Active Directory domain wants to provision Google Cloud identities. The security team mandates that identity synchronization must be automated, passwords must not be synchronized into Google Cloud, and users must authenticate against Active Directory via SAML Single Sign-On (SSO). What combination of tools should be deployed?

- A) Deploy Google Cloud Directory Sync (GCDS) for user and group synchronization alongside Active Directory Federation Services (AD FS) configured as the SAML Identity Provider in Cloud Identity.
- B) Write a custom Python script that queries Active Directory via LDAP and calls the Cloud IAM REST API to create IAM service accounts for each employee.
- C) Export active directory users to a CSV file weekly and import them manually into Google Workspace Admin Console.
- D) Deploy Workload Identity Federation with Active Directory acting as an OIDC provider.

<details><summary>Answer</summary>

**A.** Google Cloud Directory Sync (GCDS) is Google's official, one-way synchronization tool that replicates users, groups, and organizational units from on-premises LDAP/Active Directory into Cloud Identity. Pairing GCDS with an identity federation service (such as AD FS or Okta) acting as the SAML 2.0 Identity Provider enables enterprise SSO without synchronizing passwords to Google.

- Why not B: Cloud IAM manages authorization within GCP; individual employees must be represented as Cloud Identity human users, not IAM service accounts.
- Why not C: Manual CSV imports are operationally intensive, introduce synchronization lag, and cannot revoke access in real time when employees leave.
- Why not D: Workload Identity Federation is designed for non-Google software workloads (GitHub Actions, AWS, on-prem servers), whereas human workforce federation uses Cloud Identity SAML/OIDC SSO or Workforce Identity Federation.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#1-google-cloud-iam-conceptual-architecture), https://cloud.google.com/architecture/identity/federating-gcp-with-active-directory-introduction

</details>

### Q-ACE-033 · Setting up a cloud solution environment · difficulty 2 · scenario

A managed service provider (MSP) manages Google Cloud infrastructure for ten corporate clients. Each client must receive a separate, itemized monthly invoice displaying their individual consumption, but the MSP must retain centralized billing account ownership and payment liability with Google. How should the billing architecture be designed?

- A) Create ten separate Google Cloud Organizations, each with an independent Cloud Billing account and credit card.
- B) Create a single Cloud Billing account with Cloud Billing Subaccounts for each client, linking each client's projects to their respective Subaccount.
- C) Create a single shared project and allocate resources to clients using different VPC subnets.
- D) Instruct each client to create their own billing account and grant the MSP Project Owner on each project.

<details><summary>Answer</summary>

**B.** Cloud Billing Subaccounts allow master billing account owners (such as resellers and MSPs) to segment charges, generate separate monthly statements for individual clients, and isolate project billing relationships while aggregating total spend against a single parent billing account for unified settlement with Google.

- Why not A: Creating separate organizations requires multiple root domains, fragments administrative governance, and fails to provide centralized billing visibility.
- Why not C: Subnets do not isolate billing or project security boundaries; all resources in a single project are billed together on the parent project invoice.
- Why not D: Requiring clients to maintain billing accounts eliminates the MSP's reseller business model and prevents centralized volume discount aggregation.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#2-cloud-billing-architecture--spend-control-mechanics), https://cloud.google.com/billing/docs/how-to/subaccounts

</details>

### Q-ACE-034 · Setting up a cloud solution environment · difficulty 1 · single

A company wants to ensure that data breach notifications and mandatory security advisories from Google Cloud are automatically routed to the corporate Security Operations Center (SOC) email distribution list, while compliance subpoenas route to the legal team. What Google Cloud feature configures this governance routing?

- A) Cloud Monitoring Alert Notification Channels
- B) Essential Contacts API
- C) Cloud Logging Log Sinks
- D) Service Account Key Rotation Policies

<details><summary>Answer</summary>

**B.** The Essential Contacts API enables administrators to designate specific email contacts for distinct notification categories (including Security, Legal, Billing, Technical, and Product Updates) at the Organization, Folder, or Project level, ensuring Google-originated notices reach the correct enterprise departments.

- Why not A: Cloud Monitoring notification channels receive alerts generated by metric threshold breaches, not official Google communications or security advisories.
- Why not C: Cloud Logging log sinks route export audit logs and application logs to storage or pub/sub; they do not route official vendor notifications.
- Why not D: Service Account Key Rotation policies govern cryptographic credential lifecycle and have no relationship to organizational contact routing.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#5-essential-contacts-and-operational-governance), https://cloud.google.com/resource-manager/docs/managing-essential-contacts

</details>

### Q-ACE-035 · Setting up a cloud solution environment · difficulty 2 · scenario

An engineering team wants to guarantee that a mission-critical production project containing customer transaction data cannot be accidentally deleted by an administrator using the Google Cloud console or CLI. What protection mechanism should be applied?

- A) Apply an IAM Deny policy blocking `resourcemanager.projects.delete` for all users across the organization.
- B) Place a Project Lien (`resourcemanager.projects.createLien`) on the project resource.
- C) Remove all Project Owners from the project IAM policy.
- D) Enable Object Versioning on all Cloud Storage buckets within the project.

<details><summary>Answer</summary>

**B.** A Project Lien (`resourcemanager.projects.createLien`) places an explicit hold on a project resource that prevents deletion. Any attempt to shut down or delete the project via the Console, API, or gcloud CLI fails immediately with an error until the lien is deliberately removed by an authorized user possessing `resourcemanager.projects.deleteLien`.

- Why not A: An IAM Deny policy on project deletion would block legitimate project decommissioning and requires complex organization-level management.
- Why not C: A project must have at least one principal with owner or administrative permissions; removing owners violates administrative requirements and does not prevent API-driven deletion by folder admins.
- Why not D: Object Versioning protects files in Cloud Storage buckets against overwrite or deletion, but does not prevent the parent Google Cloud project itself from being deleted.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#1-formal-resource-hierarchy-architecture), https://cloud.google.com/resource-manager/docs/project-liens

</details>

### Q-ACE-036 · Setting up a cloud solution environment · difficulty 2 · scenario

A security architect must enforce that developers can only attach Compute Engine virtual machines to specific production subnets if the VM has been verified by the security team. The policy must evaluate resource metadata dynamically in IAM conditions and must inherit hierarchically down the resource tree. Which metadata system should be used?

- A) Resource Labels
- B) Resource Tags
- C) Network Tags
- D) Custom Metadata

<details><summary>Answer</summary>

**B.** Resource Tags (managed via Resource Manager) are centrally governed key-value pairs that attach at the Organization, Folder, or Project level and inherit down the hierarchy. Unlike labels, Tags are strongly typed, RBAC-protected, and can be evaluated directly in IAM Conditions and Organization Policies to enforce dynamic authorization boundaries.

- Why not A: Resource Labels are simple string annotations used primarily for cost allocation and billing export filtering; they cannot be evaluated in IAM Conditions.
- Why not C: Network Tags apply strictly to Compute Engine instances to route firewall rules and VPC routes; they do not inherit hierarchically nor do they integrate with IAM Conditions.
- Why not D: Custom Metadata is instance-specific text stored inside Compute Engine guest attributes and cannot be used in IAM policy enforcement.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#4-resource-labels-vs-resource-tags), https://cloud.google.com/resource-manager/docs/tags/tags-overview

</details>

### Q-ACE-037 · Setting up a cloud solution environment · difficulty 2 · single

A DevOps team manages infrastructure as code using Terraform across fifty Google Cloud projects. The team wants to eliminate the risk of compromised static service account private keys on local developer laptops while maintaining least-privilege automation execution. What authentication architecture should be configured?

- A) Instruct developers to use their personal Google accounts directly in Terraform provider configuration with Project Owner roles.
- B) Configure the Terraform Google provider to impersonate dedicated deployment service accounts using short-lived OAuth2 access tokens.
- C) Generate 10-year service account JSON keys and store them in private, password-protected GitHub repositories.
- D) Assign the basic `roles/editor` role to each developer at the root Organization level.

<details><summary>Answer</summary>

**B.** Configuring Terraform with service account impersonation (`impersonate_service_account`) allows developers to authenticate using their individual corporate Google identities and generate short-lived, cryptographically bounded OAuth2 access tokens on the fly. This eliminates long-lived static JSON credentials and logs all impersonation events to Cloud Audit Logs.

- Why not A: Granting personal user accounts direct Project Owner access violates least privilege and breaks automated pipeline parity.
- Why not C: Static JSON keys are bearer tokens that present significant exfiltration and leak risks; storing them in source repositories breaches security best practices.
- Why not D: Granting organization-wide Editor permissions creates a massive privilege escalation risk across all company projects.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#4-service-accounts-architecture--credential-hardening), https://cloud.google.com/docs/terraform/authentication#service-account-impersonation

</details>

### Q-ACE-038 · Planning and implementing a cloud solution · difficulty 2 · scenario

An engineering team is migrating a legacy memory-intensive cache to Compute Engine. The workload requires 4 vCPUs and 48 GB of RAM. The standard `n2-standard-4` machine type provides only 16 GB of RAM, and upgrading to `n2-standard-16` to get 64 GB of RAM would incur significant compute cost for unused vCPUs. How should the virtual machine be provisioned cost-effectively?

- A) Deploy an `n2-standard-4` instance and configure 32 GB of swap space on a standard persistent disk.
- B) Provision a custom machine type using `n2-custom-4-49152` to allocate exactly 4 vCPUs and 48 GB of memory.
- C) Deploy three `n2-standard-4` instances in a Managed Instance Group and shard the cache.
- D) Provision a Sole-Tenant Node and assign the instance to it.

<details><summary>Answer</summary>

**B.** Compute Engine supports Custom Machine Types for general-purpose machine families (N1, N2, N2D, E2). An administrator can tailor the exact ratio of vCPUs and memory (e.g. `--custom-cpu=4 --custom-memory=48GB`), avoiding paying for excess unneeded vCPUs that standard predefined machine shapes require.

- Why not A: Swap space on persistent disk exhibits orders-of-magnitude higher latency and lower throughput than physical RAM, degrading cache performance.
- Why not C: Running three instances triples the base vCPU cost and introduces distributed cache sharding complexity.
- Why not D: Sole-tenant nodes require purchasing an entire physical server, which is far more expensive than a single custom VM.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#1-compute-engine-architecture--machine-families), https://cloud.google.com/compute/docs/instances/creating-instance-with-custom-machine-type

</details>

### Q-ACE-039 · Planning and implementing a cloud solution · difficulty 2 · scenario

A startup wants to run containerized microservices on Kubernetes without managing underlying VM instances, node OS patching, cluster upgrades, or node pool capacity provisioning. The team also mandates that billing must be based strictly on the CPU and memory resources requested by running Pods, rather than node uptime. Which deployment model fulfills this?

- A) Google Kubernetes Engine (GKE) Standard with Cluster Autoscaler
- B) Google Kubernetes Engine (GKE) Autopilot
- C) Compute Engine Managed Instance Groups with Container-Optimized OS
- D) Cloud Functions for Firebase

<details><summary>Answer</summary>

**B.** GKE Autopilot is a fully managed, hands-off Kubernetes deployment mode where Google manages the entire cluster infrastructure, control plane, node provisioning, and OS patching. Customers are billed strictly for the aggregate vCPU, memory, and storage requested by running Pods rather than provisioned VM capacity.

- Why not A: GKE Standard requires managing node pools, selecting machine types, and paying for underlying VM instance uptime regardless of Pod utilization.
- Why not C: MIGs with Container-Optimized OS require manual container orchestration, VM maintenance, and bespoke scaling configurations.
- Why not D: Cloud Functions executes discrete event-driven functions, not continuous multi-container Kubernetes workloads with Kubernetes API manifests.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#5-google-kubernetes-engine-gke-autopilot-vs-standard), https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview

</details>

### Q-ACE-040 · Planning and implementing a cloud solution · difficulty 2 · scenario

A developer deploys a public web application to Cloud Run from an image hosted in Artifact Registry. During traffic surges, users experience 3-second latency spikes caused by container cold starts. The development budget permits paying for a small baseline of warm instances. Which Cloud Run configuration eliminates cold starts for baseline traffic?

- A) Configure `--min-instances=3` in the Cloud Run service deployment settings.
- B) Increase the container memory limit to 32 GB.
- C) Configure `--concurrency=1` to ensure each container handles only one request.
- D) Attach a Cloud Armor security policy with rate limiting set to 10 requests per second.

<details><summary>Answer</summary>

**A.** Setting `--min-instances` on a Cloud Run service keeps a specified number of container instances initialized, booted, and warm in the background. Incoming requests are routed to these warm instances immediately, eliminating cold-start latency for baseline request volume while still allowing the service to autoscale up to `--max-instances` during traffic peaks.

- Why not B: Increasing container memory allocation does not prevent container initialization overhead or cold starts.
- Why not C: Setting concurrency to 1 forces Cloud Run to spin up a new container instance for every concurrent request, massively exacerbating cold-start spikes.
- Why not D: Rate limiting throttles user requests and drops traffic; it does not warm container instances.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#4-cloud-run-serverless-container-architecture), https://cloud.google.com/run/docs/configuring/min-instances

</details>

### Q-ACE-041 · Planning and implementing a cloud solution · difficulty 2 · scenario

A data engineering team needs to run a nightly batch database maintenance container that processes large log files for 4 hours and then exits cleanly. When deployed as a Cloud Run Service, the container crashes because the request duration exceeds the maximum 60-minute request timeout. Which Google Cloud serverless feature should be used?

- A) Cloud Functions with HTTP triggers
- B) Cloud Run Jobs
- C) Cloud Run Services with `--timeout=24h`
- D) App Engine Standard Environment

<details><summary>Answer</summary>

**B.** Cloud Run Jobs is specifically designed for batch workloads, data transformations, and migration scripts that run to completion rather than serving continuous web requests. Unlike Cloud Run Services (which have a maximum request timeout of 60 minutes), Cloud Run Jobs can execute tasks for up to 24 hours per task and execute tasks in parallel array indices.

- Why not A: Cloud Functions (2nd gen) has a maximum execution timeout of 60 minutes for HTTP functions.
- Why not C: Cloud Run Services cannot exceed the hard platform maximum request timeout of 60 minutes (3600 seconds).
- Why not D: App Engine Standard has strict request timeouts (10 minutes for automatic scaling; 24 hours for basic/manual scaling, but lacks modern container job primitives).
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#4-cloud-run-serverless-container-architecture), https://cloud.google.com/run/docs/create-jobs

</details>

### Q-ACE-042 · Planning and implementing a cloud solution · difficulty 2 · scenario

An organization stores 200 TB of raw media assets in a Cloud Storage Standard bucket. Assets are accessed frequently during the first 30 days after creation. Between day 31 and day 90, assets are accessed less than once a month. After 90 days, assets are accessed less than once a year but must be retained for compliance. How should lifecycle management be configured to minimize storage costs?

- A) Configure an Object Lifecycle Management rule to transition objects to Nearline storage after 30 days, and to Coldline storage after 90 days.
- B) Run a daily Cloud Function that downloads files older than 30 days and re-uploads them to an Archive bucket.
- C) Create three separate buckets and require developers to manually move files between buckets via the Cloud Console.
- D) Enable Bucket Lock with a 90-day retention duration.

<details><summary>Answer</summary>

**A.** Cloud Storage Object Lifecycle Management allows automated rule-based transitions based on object age. Configuring transition rules to Nearline (intended for access < once a month, 30-day minimum retention) at 30 days and Coldline (intended for access < once a year, 90-day minimum retention) at 90 days optimizes storage costs automatically without application overhead.

- Why not B: Re-uploading data via Cloud Functions incurs unnecessary compute fees, network egress bandwidth charges, and operational complexity.
- Why not C: Manual file movement between buckets breaks client URL references and introduces severe operational risk.
- Why not D: Bucket Lock prevents object deletion; it does not transition objects across cheaper storage classes.
- Ref: [modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md](../modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md#1-cloud-storage-architecture--global-strong-consistency), https://cloud.google.com/storage/docs/lifecycle

</details>

### Q-ACE-043 · Planning and implementing a cloud solution · difficulty 2 · scenario

A network engineer connects VPC-A to VPC-B using VPC Network Peering, and connects VPC-B to VPC-C using VPC Network Peering. Workloads in VPC-A attempt to ping workloads in VPC-C, but packets are dropped. Why does connectivity fail between VPC-A and VPC-C?

- A) VPC Network Peering is non-transitive; traffic from VPC-A cannot transit through VPC-B to reach VPC-C.
- B) The VPC networks were not created with the `--auto-mode` flag.
- C) Firewall rules in VPC-B must be configured with priority 0 to forward transit traffic.
- D) Cloud DNS private forwarding zones must be enabled before peering routes take effect.

<details><summary>Answer</summary>

**A.** Google Cloud VPC Network Peering is strictly non-transitive. Only directly peered networks can communicate over peering links. VPC-A can communicate with VPC-B, and VPC-B with VPC-C, but VPC-B cannot act as an intermediate transit router between VPC-A and VPC-C. Direct peering between VPC-A and VPC-C, Cloud VPN, or Network Connectivity Center is required.

- Why not B: Auto mode networks create default subnets and actually increase the likelihood of overlapping CIDR ranges, which prevents peering.
- Why not C: VPC firewalls evaluate packets arriving at instances; they cannot override the SDN's fundamental non-transitive routing topology.
- Why not D: Cloud DNS manages domain resolution; it does not govern IP packet forwarding across non-transitive networks.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#4-vpc-network-peering-vs-private-service-connect-psc), https://cloud.google.com/vpc/docs/vpc-peering#non-transitive

</details>

### Q-ACE-044 · Planning and implementing a cloud solution · difficulty 2 · scenario

A company implements a multi-project governance model. The central networking team maintains a dedicated host project containing the corporate VPC network and subnets. Development teams manage their own service projects for application VMs. What role must the networking team grant to the development service accounts to allow them to attach instances to the host project's subnets?

- A) `roles/compute.networkAdmin` on the host project
- B) `roles/compute.networkUser` on the specific subnets in the host project
- C) `roles/owner` on the host project
- D) `roles/compute.securityAdmin` on the organization

<details><summary>Answer</summary>

**B.** In a Shared VPC architecture, the host project administrator delegates the Network User role (`roles/compute.networkUser`) to service project admins or service accounts scoped specifically to individual subnets. This grants permission to bind VM network interfaces to those subnets without granting permission to modify routing tables, firewalls, or other network configurations.

- Why not A: Granting Network Admin on the host project gives developers full permission to create, delete, and modify all subnets, firewalls, and routes, violating least privilege.
- Why not C: Granting Owner on the host project gives absolute administrative authority over all central network resources and billing.
- Why not D: Security Admin manages firewall rules and security policies; it does not grant permissions to attach VM interfaces to subnets.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#3-shared-vpc-multi-tenant-architecture), https://cloud.google.com/vpc/docs/shared-vpc#iam_in_shared_vpc

</details>

### Q-ACE-045 · Planning and implementing a cloud solution · difficulty 2 · scenario

A global retail application deployed in Cloud Run requires a custom domain name, SSL termination, web application firewall (WAF) inspection for SQL injection attacks, and multi-region anycast edge routing. What load balancing architecture should be deployed?

- A) Global External Application Load Balancer with Serverless Network Endpoint Groups (Serverless NEGs) and Cloud Armor security policies.
- B) Regional Internal Application Load Balancer with Cloud NAT.
- C) External Passthrough Network Load Balancer with instance groups.
- D) Cloud DNS routing policies with round-robin public IP records.

<details><summary>Answer</summary>

**A.** A Global External Application Load Balancer utilizes Google's global Anycast IP infrastructure to terminate TLS at the edge (GFE). By configuring Serverless NEGs pointing to the Cloud Run services and attaching Cloud Armor security policies, the architecture provides DDoS mitigation, OWASP Top 10 WAF inspection, and global routing.

- Why not B: Internal Application Load Balancers are accessible only within private VPC networks and cannot serve public internet users.
- Why not C: Passthrough Network Load Balancers operate at Layer 4 (TCP/UDP), do not terminate TLS, cannot inspect Layer 7 HTTP payloads, and do not integrate with Serverless NEGs.
- Why not D: DNS round-robin does not provide TLS termination, health checking, reverse proxying, or WAF security inspection.
- Ref: [modules/04-load-balancing-cloud-armor-and-edge.md](../modules/04-load-balancing-cloud-armor-and-edge.md#3-serverless-network-endpoint-groups-serverless-negs), https://cloud.google.com/load-balancing/docs/https/setting-up-https-serverless

</details>

### Q-ACE-046 · Planning and implementing a cloud solution · difficulty 2 · scenario

A microservice fleet consisting of 200 Compute Engine VMs in a private subnet communicates with external payment APIs on the public internet through Cloud NAT. During flash sale traffic spikes, application instances report socket timeout errors when initiating new outbound connections. Cloud NAT monitoring shows packet drops due to port exhaustion. What configuration change resolves this?

- A) Assign public IP addresses directly to all 200 virtual machines.
- B) Enable Dynamic Port Allocation on the Cloud NAT gateway or increase the Minimum Ports Per VM setting.
- C) Create a second VPC network and route traffic through VPC peering.
- D) Reduce the Cloud NAT TCP Established timeout to 10 seconds.

<details><summary>Answer</summary>

**B.** Cloud NAT statically allocates a fixed number of source ports (default: 64 ports per VM) from its assigned external IPs. High-connection workloads can exhaust this allocation. Enabling **Dynamic Port Allocation** allows Cloud NAT to dynamically scale port assignments per VM in powers of two to absorb connection bursts, or increasing `min-ports-per-vm` allocates a larger baseline pool.

- Why not A: Assigning public IPs directly exposes private instances to the public internet, violating security requirements.
- Why not C: Peering another VPC does not increase the outbound NAT port capacity for existing subnet instances.
- Why not D: While reducing timeouts frees ports faster, reducing TCP Established timeout to 10 seconds prematurely breaks long-lived legitimate connections.
- Ref: [modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md](../modules/03-vpc-networking-firewalls-and-hybrid-connectivity.md#5-cloud-nat-architecture--port-allocation-mechanics), https://cloud.google.com/nat/docs/ports-and-addresses#dynamic-port-allocation

</details>

### Q-ACE-047 · Planning and implementing a cloud solution · difficulty 2 · scenario

A global web application uses Cloud SQL for PostgreSQL in `us-central1`. Analytical teams in Europe (`europe-west1`) run heavy read queries that saturate primary database CPU and degrade write transaction latency for US users. How should the database architecture be adjusted with minimal administrative overhead?

- A) Deploy a Cross-Region Read Replica in `europe-west1` and point European analytical queries to the replica endpoint.
- B) Deploy a second standalone Cloud SQL instance in `europe-west1` and write a custom nightly database export/import script.
- C) Migrate the database to Cloud Spanner across a multi-continent instance.
- D) Enable High Availability (HA) failover on the primary Cloud SQL instance.

<details><summary>Answer</summary>

**A.** Cloud SQL supports Cross-Region Read Replicas. Deploying a read replica in `europe-west1` offloads read and analytical traffic from the primary instance, reduces query latency for European users, and maintains asynchronous replication automatically without custom scripts.

- Why not B: Custom nightly export/import scripts provide stale data, require manual maintenance, and fail to provide real-time analytical visibility.
- Why not C: Migrating to Cloud Spanner requires application code rewrites, relational schema redesign, and significantly higher licensing/infrastructure costs.
- Why not D: HA failover provisions a standby replica in a different zone within the same region for disaster recovery; it does not serve read traffic or span regions.
- Ref: [modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md](../modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md#2-cloud-sql-high-availability--alloydb-architecture), https://cloud.google.com/sql/docs/postgres/replication/cross-region-replicas

</details>

### Q-ACE-048 · Planning and implementing a cloud solution · difficulty 2 · scenario

A stream of IoT telemetry events is published to a Cloud Pub/Sub topic at a rate of 50,000 messages per second. The events must be ingested into BigQuery for analytical processing. The engineering team mandates that the ingestion pipeline must require zero intermediate compute VM or container provisioning, incur zero maintenance, and handle schema mapping automatically. How should this pipeline be built?

- A) Deploy an Apache Kafka cluster on Compute Engine to consume from Pub/Sub and write to BigQuery.
- B) Create a Cloud Pub/Sub BigQuery Subscription targeted directly at the destination BigQuery table.
- C) Write a Cloud Function triggered by Pub/Sub that runs `bq insertAll` HTTP calls.
- D) Deploy a self-managed GKE cluster running Fluentd pods.

<details><summary>Answer</summary>

**B.** A Cloud Pub/Sub BigQuery Subscription writes messages directly from a Pub/Sub topic into a BigQuery table using the BigQuery Storage Write API without requiring any intermediate compute infrastructure (such as Cloud Functions, Cloud Run, or Dataflow). It supports schema mapping and dead-letter queue routing out of the box.

- Why not A: Self-managed Kafka clusters introduce massive infrastructure, operational, and maintenance overhead.
- Why not C: Using Cloud Functions with legacy HTTP `insertAll` introduces compute charges, cold starts, and strict API rate limit bottlenecks.
- Why not D: Running GKE with Fluentd requires managing Kubernetes nodes, Pod configurations, and cluster lifecycle.
- Ref: [modules/07-pubsub-eventarc-and-bigquery-architecture.md](../modules/07-pubsub-eventarc-and-bigquery-architecture.md#11-topic-ingestion-routing-and-subscription-types), https://cloud.google.com/pubsub/docs/bigquery

</details>

### Q-ACE-049 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A Compute Engine Managed Instance Group (MIG) runs a Java web service behind an External Application Load Balancer. Occasionally, the application process hangs with a JVM deadlocked thread, causing it to return HTTP 500 errors to health checks, but the underlying Linux VM continues running normally. How should the MIG be configured to automatically replace hung VMs?

- A) Configure an Application Autohealing health check on the MIG pointing to the application's `/healthz` endpoint.
- B) Deploy a cron job inside each VM that reboots the operating system every hour.
- C) Recreate the instance template with preemptible VMs.
- D) Increase the Load Balancer timeout to 300 seconds.

<details><summary>Answer</summary>

**A.** A Managed Instance Group supports **Autohealing** by attaching an application-level health check. If the application endpoint (e.g. `/healthz`) fails consecutive health probes, the autohealing policy flags the instance as unhealthy and automatically terminates and recreates the instance from the template, restoring application availability.

- Why not B: Scheduled reboots disrupt healthy traffic and do not remediate deadlocks when they occur between reboots.
- Why not C: Preemptible/Spot VMs are terminated randomly by Google based on excess capacity; they do not monitor or remediate application software health.
- Why not D: Increasing load balancer timeout causes client requests to hang for 5 minutes instead of resolving the application deadlock.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#2-managed-instance-groups-migs-autoscaling-and-autohealing), https://cloud.google.com/compute/docs/instance-groups/autohealing-instances-in-migs

</details>

### Q-ACE-050 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A production Managed Instance Group has a target size of 10 instances. An administrator needs to perform a zero-downtime rolling update to deploy a new instance template. The application cannot tolerate any reduction in total serving capacity during the rollout, but temporary additional compute instances are budgeted. How should the rolling update policy be configured?

- A) Set `maxUnavailable = 0` and `maxSurge = 3`.
- B) Set `maxUnavailable = 5` and `maxSurge = 0`.
- C) Set `maxUnavailable = 10` and `maxSurge = 10`.
- D) Delete the instance group and recreate it using the new template.

<details><summary>Answer</summary>

**A.** Configuring `maxUnavailable = 0` guarantees that the MIG never terminates an existing healthy instance until replacement instances are created, booted, and pass health checks. Setting `maxSurge = 3` allows the group to provision up to 3 additional instances beyond the target size of 10 (scaling to 13 during the rollout), ensuring zero capacity reduction throughout the deployment.

- Why not B: Setting `maxUnavailable = 5` allows the group to terminate 5 instances immediately, reducing serving capacity by 50% during the update.
- Why not C: Setting `maxUnavailable = 10` terminates the entire fleet simultaneously, causing total application downtime.
- Why not D: Recreating the instance group causes catastrophic production downtime and drops all active user sessions.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#2-managed-instance-groups-migs-autoscaling-and-autohealing), https://cloud.google.com/compute/docs/instance-groups/rolling-out-updates-to-managed-instance-groups

</details>

### Q-ACE-051 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A web application running on Google Kubernetes Engine (GKE) experiences sudden morning traffic spikes. Pod CPU utilization exceeds 85%, and the Horizontal Pod Autoscaler (HPA) attempts to schedule new Pod replicas, but new Pods remain stuck in a `Pending` state because all cluster nodes are at full CPU capacity. What cluster feature should be enabled to resolve this automatically?

- A) Cluster Autoscaler
- B) Vertical Pod Autoscaler in `Off` mode
- C) GKE Sandbox
- D) Node Auto-Repair

<details><summary>Answer</summary>

**A.** The GKE **Cluster Autoscaler** monitors the cluster for Pods in a `Pending` state that cannot be scheduled due to insufficient CPU or memory capacity on existing nodes. When pending Pods are detected, the Cluster Autoscaler automatically adds new Compute Engine worker nodes to the node pool, allowing the HPA's new Pod replicas to be scheduled and begin serving traffic.

- Why not B: Vertical Pod Autoscaler in `Off` mode generates resource recommendations without applying changes or scaling nodes.
- Why not C: GKE Sandbox provides kernel-level container isolation using gVisor; it does not provision compute capacity.
- Why not D: Node Auto-Repair detects and repairs unhealthy or unresponsive nodes; it does not scale node capacity in response to traffic growth.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#5-google-kubernetes-engine-gke-autopilot-vs-standard), https://cloud.google.com/kubernetes-engine/docs/concepts/cluster-autoscaler

</details>

### Q-ACE-052 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A release engineer wants to deploy a new version of a microservice to Cloud Run using a canary deployment strategy. The engineer wants to route exactly 10% of live production traffic to the new revision (`v2`) while 90% remains on the current stable revision (`v1`), allowing real-time monitoring of error rates before full cutover. Which gcloud command achieves this?

- A) `gcloud run deploy --image=gcr.io/my-proj/app:v2`
- B) `gcloud run services update-traffic my-service --to-revisions=my-service-v1=90,my-service-v2=10`
- C) `gcloud run revisions delete my-service-v1`
- D) `gcloud compute url-maps add-host-rule --traffic-split=10/90`

<details><summary>Answer</summary>

**B.** Cloud Run natively supports traffic splitting across multiple revisions. Using `gcloud run services update-traffic` with the `--to-revisions` flag allows precise percentage-based traffic allocation between revision tags (e.g. 90% to `v1` and 10% to `v2`), enabling seamless canary testing and instantaneous rollback if errors occur.

- Why not A: Deploying without specifying traffic routing defaults to routing 100% of traffic to the newly deployed revision immediately.
- Why not C: Deleting the v1 revision drops all traffic and makes rollback impossible.
- Why not D: Cloud Run traffic splitting is managed within Cloud Run's service control plane, not by editing Compute Engine URL maps.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#4-cloud-run-serverless-container-architecture), https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration

</details>

### Q-ACE-053 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

An administrator accidentally overwrites a critical configuration file `settings.json` in a Cloud Storage bucket where Object Versioning is enabled. How can the administrator restore the previous version of the object?

- A) Open a support ticket with Google Cloud customer engineering to recover the disk sector.
- B) List all versions using `gcloud storage objects list --generation-numbers`, identify the historical generation number, and copy that specific generation to the live object name.
- C) Revert the bucket's Uniform Bucket-Level Access setting.
- D) Query the Cloud Logging data access logs and replay the HTTP PUT request.

<details><summary>Answer</summary>

**B.** When Object Versioning is enabled in Cloud Storage, overwriting or deleting an object does not destroy previous content; instead, historical states are preserved with unique, immutable **generation numbers**. Running `gcloud storage objects list --generation-numbers` surfaces historical generations, and copying the desired generation (`gs://bucket/settings.json#<gen_id>`) back to `gs://bucket/settings.json` restores the file.

- Why not A: Object Versioning is a self-service feature; opening a support ticket is unnecessary and introduces prolonged delays.
- Why not C: Uniform Bucket-Level Access governs IAM permission enforcement, not object content versioning.
- Why not D: Cloud Logging records API call metadata; it does not store historical file payload bytes for data recovery.
- Ref: [modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md](../modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md#1-cloud-storage-architecture--global-strong-consistency), https://cloud.google.com/storage/docs/object-versioning#restore

</details>

### Q-ACE-054 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A developer executes an erroneous SQL update script that corrupts customer records in a production Cloud SQL for PostgreSQL database at 14:15 UTC. The database has automated daily backups scheduled at 02:00 UTC and Point-in-Time Recovery (PITR) with write-ahead log (WAL) archiving enabled. How should the database be restored with minimal data loss?

- A) Restore the database from the previous night's 02:00 UTC automated backup.
- B) Perform a Point-in-Time Recovery to a new instance, specifying a timestamp of 14:14 UTC immediately prior to the corrupting transaction.
- C) Export the corrupted database to Cloud Storage and import it into BigQuery.
- D) Restart the Cloud SQL instance to rollback uncommitted memory buffers.

<details><summary>Answer</summary>

**B.** Point-in-Time Recovery (PITR) uses a base backup combined with continuous write-ahead transaction logs (WAL). This enables restoring the database to a new instance at any arbitrary minute or second within the retention window. Restoring to 14:14 UTC recovers all legitimate transactions up to one minute before the corruption occurred, losing zero data prior to the incident.

- Why not A: Restoring from the 02:00 UTC backup discards over 12 hours of valid business transactions.
- Why not C: Exporting to BigQuery does not restore the operational PostgreSQL database or rollback the erroneous UPDATE statement.
- Why not D: SQL UPDATE transactions that have committed to disk are persistent across instance restarts.
- Ref: [modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md](../modules/06-storage-cloud-sql-alloydb-spanner-and-firestore.md#2-cloud-sql-high-availability--alloydb-architecture), https://cloud.google.com/sql/docs/postgres/backup-recovery/pitr

</details>

### Q-ACE-055 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

An operations team needs to receive automated alerts in a Slack channel whenever the 99th percentile HTTP request latency of an external application exceeds 500 milliseconds for more than 5 consecutive minutes. What combination of Cloud Monitoring components must be configured?

- A) A Cloud Monitoring Alerting Policy with an MQL/PromQL metric threshold condition and a Slack Notification Channel.
- B) A Cloud Logging Log Metric with a Pub/Sub sink and an on-premises mail daemon.
- C) A Cloud Trace diagnostic rule linked to an Essential Contacts group.
- D) A Cloud Functions script scheduled to run every 10 seconds via Cloud Scheduler.

<details><summary>Answer</summary>

**A.** Cloud Monitoring allows authoring Alerting Policies that evaluate metric threshold conditions over rolling alignment windows (e.g. latency percentile > 500ms for 5 minutes). When the condition triggers, an incident is created and dispatched directly to configured Notification Channels, which natively supports Slack webhooks, PagerDuty, and email.

- Why not B: Creating custom log metrics is unnecessary when HTTP request latency is natively captured by load balancers and Cloud Run metrics.
- Why not C: Cloud Trace captures distributed trace spans; it does not manage operational alerting policies or notification channels.
- Why not D: Custom polling functions running every 10 seconds introduce unnecessary maintenance, compute costs, and duplicate alerting logic.
- Ref: [modules/07-pubsub-eventarc-and-bigquery-architecture.md](../modules/07-pubsub-eventarc-and-bigquery-architecture.md#2-cloud-tasks-vs-pubsub-vs-eventarc-vs-workflows), https://cloud.google.com/monitoring/alerts

</details>

### Q-ACE-056 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A high-volume Kubernetes cluster in GKE generates millions of repetitive HTTP 200 health check logs every hour from internal load balancer probes. These logs consume 60% of the project's Cloud Logging monthly ingestion quota and incur substantial costs without providing operational value. How should the team eliminate these ingestion costs while preserving error logs?

- A) Delete the GKE cluster and migrate workloads to Compute Engine VMs.
- B) Create an Exclusion Filter in the `_Default` log sink to drop log entries matching the health check user-agent and status code 200.
- C) Revoke the Logging Admin role from the GKE node service account.
- D) Disable Cloud Logging entirely across the project using an organizational policy.

<details><summary>Answer</summary>

**B.** Cloud Logging allows configuring **Exclusion Filters** on log sinks (such as the `_Default` bucket sink). Excluded logs are evaluated at the ingestion edge and discarded before ingestion, preventing them from being stored in log buckets and eliminating ingestion charges while allowing non-matching application warnings and errors to be ingested normally.

- Why not A: Migrating away from GKE is a drastic and unnecessary architectural change that does not address load balancer probe logging.
- Why not C: Revoking logging permissions breaks cluster-level diagnostics, container stdout/stderr capture, and operational observability.
- Why not D: Disabling logging project-wide creates severe security blind spots and violates compliance mandates.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#2-cloud-billing-architecture--spend-control-mechanics), https://cloud.google.com/logging/docs/routing/overview#exclusions

</details>

### Q-ACE-057 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

An SRE team needs to verify the external availability and TLS certificate expiration of a public e-commerce website from multiple geographic locations around the world every 60 seconds. What native Google Cloud service provides this capability without deploying custom probe instances?

- A) Cloud Monitoring Uptime Checks
- B) Cloud Armor Rate Limiting
- C) Network Intelligence Center Performance Dashboard
- D) Cloud NAT Connection Logging

<details><summary>Answer</summary>

**A.** Cloud Monitoring Uptime Checks periodically send synthetic requests to public or private endpoints from multiple probe locations worldwide (e.g. US, Europe, Asia-Pacific). Uptime checks monitor HTTP/HTTPS status, response latency, content matching, and automatically alert on impending TLS certificate expiration.

- Why not B: Cloud Armor is a web application firewall that filters inbound traffic; it does not perform outbound synthetic availability checks.
- Why not C: Network Intelligence Center monitors inter-region packet loss and network topology; it does not validate application HTTP endpoints or TLS certificates.
- Why not D: Cloud NAT connection logging tracks outbound NAT translations; it does not test external service availability.
- Ref: [modules/04-load-balancing-cloud-armor-and-edge.md](../modules/04-load-balancing-cloud-armor-and-edge.md#7-certificate-manager-and-tls-automation-architecture), https://cloud.google.com/monitoring/uptime-checks

</details>

### Q-ACE-058 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A critical stream-processing subscription in Cloud Pub/Sub begins accumulating an unacknowledged message backlog. The operations team suspects that subscriber worker instances are crashing before acknowledging messages, or that throughput is falling behind publish volume. Which two Cloud Monitoring metrics should the team analyze to diagnose subscriber lag and message age?

- A) `pubsub.googleapis.com/subscription/num_undelivered_messages` and `pubsub.googleapis.com/subscription/oldest_unacked_message_age`
- B) `compute.googleapis.com/instance/cpu/utilization` and `storage.googleapis.com/storage/object_count`
- C) `pubsub.googleapis.com/topic/send_request_count` and `logging.googleapis.com/byte_count`
- D) `bigquery.googleapis.com/slots/allocated` and `spanner.googleapis.com/cpu/utilization`

<details><summary>Answer</summary>

**A.** `subscription/num_undelivered_messages` reports the total number of unacknowledged messages currently held in the subscription backlog, while `subscription/oldest_unacked_message_age` measures the elapsed time since the oldest unacknowledged message was published. Together, these two metrics indicate whether subscriber consumers are stalled, deadlocked, or under-provisioned.

- Why not B: Compute CPU and storage object count do not report Pub/Sub queue backlog or message delivery latency.
- Why not C: Topic send request count measures publishing volume, not subscriber consumption health or backlog buildup.
- Why not D: BigQuery slots and Spanner CPU metrics monitor downstream databases, not Pub/Sub subscription delivery queue state.
- Ref: [modules/07-pubsub-eventarc-and-bigquery-architecture.md](../modules/07-pubsub-eventarc-and-bigquery-architecture.md#12-ack-deadline-lease-management-and-redelivery-storms), https://cloud.google.com/pubsub/docs/monitoring

</details>

### Q-ACE-059 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A system administrator needs to schedule automated, consistent daily disk backups for 50 Compute Engine virtual machines. Backups must be retained for 14 days and automatically replicated to a secondary region for disaster recovery compliance. How should this backup process be automated?

- A) Create a Compute Engine Resource Policy for Snapshot Schedules, specify the schedule frequency, retention period, and storage location, and attach the policy to the persistent disks.
- B) Write a bash script that executes `gcloud compute instances stop` and `dd` to write disk contents to an NFS share.
- C) Deploy a third-party backup agent inside each VM guest OS.
- D) Configure an instance template with a secondary empty persistent disk.

<details><summary>Answer</summary>

**A.** Compute Engine supports automated Snapshot Schedules via **Resource Policies**. An administrator defines snapshot frequency (e.g. daily at midnight), retention rules (e.g. 14 days with automatic deletion of expired snapshots), and snapshot storage location (multi-region or custom secondary region). Attaching the policy to persistent disks automates zero-maintenance backups.

- Why not B: Stopping instances and running manual `dd` scripts causes prolonged downtime and requires substantial custom scripting.
- Why not C: Guest-level backup agents introduce host performance overhead and fail to leverage Google's hypervisor-level snapshot consistency.
- Why not D: Adding empty persistent disks provides blank storage; it does not create automated historical backups.
- Ref: [modules/05-compute-engine-cloud-run-and-gke.md](../modules/05-compute-engine-cloud-run-and-gke.md#1-compute-engine-architecture--machine-families), https://cloud.google.com/compute/docs/disks/scheduled-snapshots

</details>

### Q-ACE-060 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

During an unexpected maintenance outage of an external legacy accounting API, an application's Cloud Tasks queue continues dispatching HTTP requests, resulting in thousands of failed task attempts that consume retry budgets. The on-call engineer needs to immediately halt task execution without deleting the queued tasks. What command should the engineer run?

- A) `gcloud tasks queues pause QUEUE_ID`
- B) `gcloud tasks queues purge QUEUE_ID`
- C) `gcloud tasks queues delete QUEUE_ID`
- D) `gcloud tasks tasks delete --all`

<details><summary>Answer</summary>

**A.** Pausing a queue using `gcloud tasks queues pause QUEUE_ID` immediately suspends task dispatch. Tasks currently residing in the queue remain stored safely without being delivered to worker endpoints or consuming retries. Once the downstream API recovers, the engineer resumes execution using `gcloud tasks queues resume QUEUE_ID`.

- Why not B: Purging a queue permanently deletes all queued tasks, resulting in catastrophic data and business transaction loss.
- Why not C: Deleting the queue removes the resource entirely and requires recreation and IAM re-binding.
- Why not D: Deleting individual tasks destroys pending workloads and cannot be undone.
- Ref: [modules/07-pubsub-eventarc-and-bigquery-architecture.md](../modules/07-pubsub-eventarc-and-bigquery-architecture.md#21-cloud-tasks-granular-rate-limited-worker-invocation), https://cloud.google.com/tasks/docs/manage-queues#pause-queue

</details>

### Q-ACE-061 · Ensuring successful operation of a cloud solution · difficulty 3 · scenario

An analytical query executed on BigQuery takes 25 minutes to complete on a large table. The query execution graph shows that Stage 01 processed 10 billion rows across 2,000 slots in 10 seconds, but Stage 02 shows a single slot running for 24 minutes while all other 1,999 slots remain idle. What is the root cause of this performance bottleneck?

- A) The Jupiter network fabric ran out of bisection bandwidth during the shuffle phase.
- B) Severe Data Skew on the join or group-by key caused all rows with a common key value to route to a single Dremel worker slot.
- C) The query hit the hard limit on the number of partitions per table.
- D) The table storage format was converted from Capacitor to Avro.

<details><summary>Answer</summary>

**B.** A single slot executing for the vast majority of query duration while other slots sit idle is the classic symptom of **Data Skew**. When BigQuery hashes keys to distribute data across slots during a join or `GROUP BY` operation, a high-frequency key (such as `NULL` or default `'UNKNOWN'`) routes all associated records to one leaf slot, creating a severe straggler bottleneck.

- Why not A: Jupiter provides petabit bisection bandwidth and disaggregated shuffle memory; network saturation does not cause single-slot CPU stragglers.
- Why not C: Table partition limits (4,000 partitions) are evaluated at query submission time and cause immediate query failure, not runtime stage skew.
- Why not D: BigQuery internally stores persistent tables strictly in Capacitor; tables are not converted to Avro during query execution.
- Ref: [modules/07-pubsub-eventarc-and-bigquery-architecture.md](../modules/07-pubsub-eventarc-and-bigquery-architecture.md#31-dremel-multi-tier-execution-tree), https://cloud.google.com/bigquery/docs/troubleshoot-queries#data-skew

</details>

### Q-ACE-062 · Ensuring successful operation of a cloud solution · difficulty 2 · scenario

A security audit mandates that an organization must maintain records of every read and download operation performed against sensitive patient data stored in Cloud Storage buckets for 3 years. By default, Cloud Storage data reads do not appear in Cloud Logging. How must this audit logging be enabled?

- A) Enable Data Access Audit Logs for Cloud Storage (`storage.googleapis.com`) covering the `DATA_READ` log type in IAM Audit Configuration.
- B) Enable Admin Activity Audit Logs on the Cloud Storage bucket.
- C) Deploy a Cloud Function that intercepts all HTTP GET requests to the Cloud Storage API.
- D) Author a custom VPC firewall rule logging all outbound port 443 packets.

<details><summary>Answer</summary>

**A.** In Google Cloud, **Admin Activity** audit logs are enabled by default for all services at zero cost, but **Data Access** audit logs (which record `DATA_READ` and `DATA_WRITE` operations on data payloads) are disabled by default (except for BigQuery) due to high volume. To record read and download operations on Cloud Storage, `DATA_READ` audit logging must be explicitly activated in project or organization Audit Config.

- Why not B: Admin Activity logs record control-plane administrative mutations (creating or deleting buckets, updating metadata), not reading data objects.
- Why not C: Cloud Storage is a managed PaaS service accessed over Google APIs; customer Cloud Functions cannot intercept direct API calls.
- Why not D: VPC firewall logs capture Layer 4 IP packet headers (IP and port); they cannot decrypt TLS payloads or identify which specific object was read.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#5-essential-contacts-and-operational-governance), https://cloud.google.com/logging/docs/audit/configure-data-access

</details>

### Q-ACE-063 · Configuring access and security · difficulty 2 · scenario

A DevOps team uses GitHub Actions to deploy container workloads to Google Cloud. The security team forbids downloading, storing, or managing long-lived service account JSON keys in GitHub Secrets. How should GitHub Actions be authenticated to Google Cloud securely?

- A) Store the GCP user account password in GitHub Secrets and execute `gcloud auth login`.
- B) Configure Workload Identity Federation (WIF) with GitHub's OIDC identity provider, mapping repository claims to a dedicated deployment service account.
- C) Create a Compute Engine instance in GCP to act as a self-hosted GitHub runner and grant it Project Owner.
- D) Expose an unauthenticated Cloud Function that deploys containers upon receiving an HTTP webhook.

<details><summary>Answer</summary>

**B.** Workload Identity Federation (WIF) allows external workloads (such as GitHub Actions, GitLab, or AWS) to exchange their native OpenID Connect (OIDC) identity tokens for short-lived Google Cloud access tokens. This enables keyless authentication, enforces attribute-based conditions (e.g. restricting deployments to `ref:refs/heads/main`), and eliminates static JSON credential compromise risks.

- Why not A: Storing personal user passwords in CI secrets violates multi-factor authentication, security standards, and Google Terms of Service.
- Why not C: Running a self-hosted VM runner with Project Owner creates an enormous security risk and requires ongoing VM maintenance.
- Why not D: An unauthenticated webhook allows anyone on the public internet to trigger arbitrary production deployments.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#5-workload-identity-federation-keyless-external-authentication), https://cloud.google.com/iam/docs/workload-identity-federation

</details>

### Q-ACE-064 · Configuring access and security · difficulty 2 · scenario

When a new Google Cloud project is created and the Compute Engine API is enabled, the default Compute Engine service account (`<project-number>-compute@developer.gserviceaccount.com`) is automatically created. Historically, this service account was automatically granted the highly permissive `roles/editor` role on the project. What organizational policy prevents this automatic broad role assignment across all newly created projects?

- A) `constraints/iam.disableServiceAccountKeyCreation`
- B) `constraints/iam.automaticIamGrantsForDefaultServiceAccounts`
- C) `constraints/compute.disableSerialPortAccess`
- D) `constraints/gcp.restrictVpcPeering`

<details><summary>Answer</summary>

**B.** Enforcing the organizational policy constraint `constraints/iam.automaticIamGrantsForDefaultServiceAccounts` prevents Google Cloud from automatically granting the primitive `roles/editor` role to the default Compute Engine and App Engine service accounts upon API initialization, enforcing least privilege from project inception.

- Why not A: `constraints/iam.disableServiceAccountKeyCreation` blocks users from generating static service account JSON keys; it does not control role assignment to default service accounts.
- Why not C: `constraints/compute.disableSerialPortAccess` blocks interactive serial console access to VM instances.
- Why not D: `constraints/gcp.restrictVpcPeering` governs which VPC networks are permitted to establish peering connections.
- Ref: [modules/01-resource-hierarchy-billing-and-org-policies.md](../modules/01-resource-hierarchy-billing-and-org-policies.md#3-organization-policies-architecture--constraints-engine), https://cloud.google.com/iam/docs/service-agents#disable-default-role

</details>

### Q-ACE-065 · Configuring access and security · difficulty 2 · scenario

A developer needs permission to launch new Compute Engine virtual machines in a staging project. The VMs must run under a custom application service account (`app-sa@proj.iam.gserviceaccount.com`) with specific database permissions. The developer must not be granted permissions to modify the service account's IAM roles or view other projects. Which two roles must be granted to the developer?

- A) `roles/compute.instanceAdmin.v1` on the project and `roles/iam.serviceAccountUser` on the specific service account
- B) `roles/iam.serviceAccountAdmin` on the project and `roles/compute.networkAdmin` on the VPC
- C) `roles/owner` on the project and `roles/iam.securityAdmin` on the organization
- D) `roles/viewer` on the project and `roles/storage.admin` on the bucket

<details><summary>Answer</summary>

**A.** To deploy an instance that runs as a designated service account, a principal requires two discrete permissions: permission to provision the VM resource (`roles/compute.instanceAdmin.v1`) and permission to "act as" the service account by attaching its identity to the VM (`roles/iam.serviceAccountUser`, which grants `iam.serviceAccounts.actAs`). Scoping the Service Account User role strictly to `app-sa` enforces least privilege.

- Why not B: `roles/iam.serviceAccountAdmin` allows the developer to create, delete, and alter service accounts, violating security restrictions.
- Why not C: Project Owner and Security Admin grant unrestricted administrative authority over all project and organizational resources.
- Why not D: `roles/viewer` is read-only and cannot provision Compute Engine virtual machines.
- Ref: [modules/02-iam-service-accounts-and-workload-identity.md](../modules/02-iam-service-accounts-and-workload-identity.md#4-service-accounts-architecture--credential-hardening), https://cloud.google.com/iam/docs/service-account-overview#user-role

</details>

---

## Full Mock Examination & Scoring Guide

This section provides a complete, 65-question timed mock exam matching the official Google Cloud Certified Associate Cloud Engineer (ACE) domain distribution, difficulty mix, and passing threshold.

### Exam Administration Parameters

| Parameter            | Specification                                                |
| :------------------- | :----------------------------------------------------------- |
| **Exam Code**        | ACE (Associate Cloud Engineer)                               |
| **Duration**         | 120 Minutes (2 Hours)                                        |
| **Total Questions**  | 65 Questions                                                 |
| **Passing Standard** | Scaled score equating to approximately 70% (46 / 65 correct) |
| **Format**           | Single choice, multiple selection, scenario analysis         |

### Domain Distribution Breakdown

| Exam Domain | Target Weight | Question Count | Question Range |
| :-- | :-- | :-- | :-- |
| **1. Setting up a cloud solution environment** | ~20% | 13 Questions | Q-ACE-001 – Q-ACE-006, Q-ACE-031 – Q-ACE-037 |
| **2. Planning and implementing a cloud solution** | ~30% | 20 Questions | Q-ACE-007 – Q-ACE-015, Q-ACE-030, Q-ACE-038 – Q-ACE-048 |
| **3. Ensuring successful operation of a cloud solution** | ~30% | 19 Questions | Q-ACE-016 – Q-ACE-020, Q-ACE-049 – Q-ACE-062 |
| **4. Configuring access and security** | ~20% | 13 Questions | Q-ACE-021 – Q-ACE-029, Q-ACE-063 – Q-ACE-065 |
| **Total** | **100%** | **65 Questions** | **Q-ACE-001 – Q-ACE-065** |

### Comprehensive Mock Exam Scoring Key

| Q# | Domain | Difficulty | Type | Correct Option | Focus Topic |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Q-ACE-001** | Setting up a cloud solution environment | 2 | scenario | B | Resource Location Org Policy |
| **Q-ACE-002** | Setting up a cloud solution environment | 2 | scenario | B | Budget Alert Trap & Spend Limits |
| **Q-ACE-003** | Setting up a cloud solution environment | 1 | single | B | Project ID Immutability |
| **Q-ACE-004** | Configuring access and security | 2 | scenario | B | Folder IAM Policy Inheritance |
| **Q-ACE-005** | Configuring access and security | 2 | scenario | B | Billing Account Association |
| **Q-ACE-006** | Configuring access and security | 2 | scenario | B | BigQuery Billing Export Setup |
| **Q-ACE-007** | Planning and implementing a cloud solution | 2 | scenario | B | Custom Mode vs Auto Mode Subnets |
| **Q-ACE-008** | Planning and implementing a cloud solution | 2 | scenario | B | Firewall Priority & Target Tags |
| **Q-ACE-009** | Planning and implementing a cloud solution | 3 | scenario | A | Cloud NAT Port Allocation |
| **Q-ACE-010** | Ensuring successful operation of a cloud solution | 2 | scenario | B | Disable VM External IP Org Policy |
| **Q-ACE-011** | Ensuring successful operation of a cloud solution | 2 | scenario | B | Private Google Access for GCS |
| **Q-ACE-012** | Configuring access and security | 2 | scenario | B | Hierarchical Firewall Precedence |
| **Q-ACE-013** | Planning and implementing a cloud solution | 2 | scenario | B | Shared VPC Host & Service Projects |
| **Q-ACE-014** | Ensuring successful operation of a cloud solution | 2 | scenario | B | HA VPN Dynamic Routing (BGP) |
| **Q-ACE-015** | Configuring access and security | 2 | scenario | B | Dedicated Interconnect Bandwidth |
| **Q-ACE-016** | Planning and implementing a cloud solution | 2 | scenario | B | Compute Engine MIG Autohealing |
| **Q-ACE-017** | Ensuring successful operation of a cloud solution | 2 | scenario | B | Cloud Logging BigQuery Log Sink |
| **Q-ACE-018** | Setting up a cloud solution environment | 2 | scenario | B | Persistent Disk Snapshot Restore |
| **Q-ACE-019** | Configuring access and security | 2 | scenario | B | Service Account Key Rotation |
| **Q-ACE-020** | Planning and implementing a cloud solution | 2 | scenario | B | Spot VM Preemption Handling |
| **Q-ACE-021** | Configuring access and security | 2 | single | B | Basic vs Predefined IAM Roles |
| **Q-ACE-022** | Setting up a cloud solution environment | 2 | scenario | B | Custom IAM Role Definition |
| **Q-ACE-023** | Configuring access and security | 2 | scenario | B | Short-Lived SA Impersonation |
| **Q-ACE-024** | Planning and implementing a cloud solution | 2 | scenario | B | Cloud Run Container Deployment |
| **Q-ACE-025** | Configuring access and security | 2 | scenario | B | CEL IAM Conditions on Tags |
| **Q-ACE-026** | Setting up a cloud solution environment | 2 | scenario | B | IAM Deny Policy Precedence |
| **Q-ACE-027** | Ensuring successful operation of a cloud solution | 2 | single | B | Principal Access Boundaries (PAB) |
| **Q-ACE-028** | Planning and implementing a cloud solution | 2 | scenario | B | Uniform Bucket-Level Access (UBLA) |
| **Q-ACE-029** | Configuring access and security | 2 | scenario | B | Policy Troubleshooter Diagnostics |
| **Q-ACE-030** | Planning and implementing a cloud solution | 2 | scenario | B | Private Services Access (Cloud SQL) |
| **Q-ACE-031** | Setting up a cloud solution environment | 2 | scenario | B | SDK Named Configurations |
| **Q-ACE-032** | Setting up a cloud solution environment | 2 | scenario | A | Google Cloud Directory Sync (GCDS) |
| **Q-ACE-033** | Setting up a cloud solution environment | 2 | scenario | B | Cloud Billing Subaccounts |
| **Q-ACE-034** | Setting up a cloud solution environment | 1 | single | B | Essential Contacts Governance |
| **Q-ACE-035** | Setting up a cloud solution environment | 2 | scenario | B | Project Liens Protection |
| **Q-ACE-036** | Setting up a cloud solution environment | 2 | scenario | B | Resource Tags vs Labels in IAM |
| **Q-ACE-037** | Setting up a cloud solution environment | 2 | single | B | Terraform SA Impersonation |
| **Q-ACE-038** | Planning and implementing a cloud solution | 2 | scenario | B | Custom Compute Machine Types |
| **Q-ACE-039** | Planning and implementing a cloud solution | 2 | scenario | B | GKE Autopilot Serverless Model |
| **Q-ACE-040** | Planning and implementing a cloud solution | 2 | scenario | A | Cloud Run Minimum Instances |
| **Q-ACE-041** | Planning and implementing a cloud solution | 2 | scenario | B | Cloud Run Jobs vs Services |
| **Q-ACE-042** | Planning and implementing a cloud solution | 2 | scenario | A | GCS Storage Class Lifecycle |
| **Q-ACE-043** | Planning and implementing a cloud solution | 2 | scenario | A | VPC Peering Non-Transitivity |
| **Q-ACE-044** | Planning and implementing a cloud solution | 2 | scenario | B | Shared VPC Subnet IAM Delegation |
| **Q-ACE-045** | Planning and implementing a cloud solution | 2 | scenario | A | Global External Application LB |
| **Q-ACE-046** | Planning and implementing a cloud solution | 2 | scenario | B | Cloud NAT Dynamic Port Allocation |
| **Q-ACE-047** | Planning and implementing a cloud solution | 2 | scenario | A | Cloud SQL Cross-Region Replicas |
| **Q-ACE-048** | Planning and implementing a cloud solution | 2 | scenario | B | Pub/Sub BigQuery Subscriptions |
| **Q-ACE-049** | Ensuring successful operation of a cloud solution | 2 | scenario | A | MIG Application Autohealing |
| **Q-ACE-050** | Ensuring successful operation of a cloud solution | 2 | scenario | A | MIG Zero-Downtime Rolling Update |
| **Q-ACE-051** | Ensuring successful operation of a cloud solution | 2 | scenario | A | GKE Cluster Autoscaler & HPA |
| **Q-ACE-052** | Ensuring successful operation of a cloud solution | 2 | scenario | B | Cloud Run Traffic Splitting |
| **Q-ACE-053** | Ensuring successful operation of a cloud solution | 2 | scenario | B | GCS Object Versioning Recovery |
| **Q-ACE-054** | Ensuring successful operation of a cloud solution | 2 | scenario | B | Cloud SQL Point-in-Time Recovery |
| **Q-ACE-055** | Ensuring successful operation of a cloud solution | 2 | scenario | A | Cloud Monitoring Alerting Policies |
| **Q-ACE-056** | Ensuring successful operation of a cloud solution | 2 | scenario | B | Cloud Logging Exclusion Filters |
| **Q-ACE-057** | Ensuring successful operation of a cloud solution | 2 | scenario | A | Cloud Monitoring Uptime Checks |
| **Q-ACE-058** | Ensuring successful operation of a cloud solution | 2 | scenario | A | Pub/Sub Subscription Lag Metrics |
| **Q-ACE-059** | Ensuring successful operation of a cloud solution | 2 | scenario | A | Compute Engine Snapshot Schedules |
| **Q-ACE-060** | Ensuring successful operation of a cloud solution | 2 | scenario | A | Cloud Tasks Queue Pause Management |
| **Q-ACE-061** | Ensuring successful operation of a cloud solution | 3 | scenario | B | BigQuery Stage Data Skew Diagnosis |
| **Q-ACE-062** | Ensuring successful operation of a cloud solution | 2 | scenario | A | Data Access Audit Logging Setup |
| **Q-ACE-063** | Configuring access and security | 2 | scenario | B | Workload Identity Federation (WIF) |
| **Q-ACE-064** | Configuring access and security | 2 | scenario | B | Disable Automatic Default SA Grants |
| **Q-ACE-065** | Configuring access and security | 2 | scenario | A | Service Account User Delegation |
