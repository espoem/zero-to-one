# CGOA and CAPA Certification Preparation Bank & Mock Exam (`technologies/argocd/exams/cgoa-and-capa.md`)

This question bank contains 65 original questions (`Q-ARGO-001` through `Q-ARGO-065`) covering all domains of the **Certified GitOps Associate (CGOA)** and **Certified Argo Project Associate (CAPA)** certification curricula.

---

## Question Bank

### Q-ARGO-001 · CGOA D1 GitOps Principles · difficulty 1 · single

Which of the following is one of the four core OpenGitOps principles defined by the CNCF OpenGitOps working group?

- A) Declarative systems must use imperative scripts for execution.
- B) The desired state of a system must be expressed declaratively and version-controlled.
- C) Software deployments must be executed via manual push scripts from developer laptops.
- D) Cluster state changes must bypass version control when urgent patches are required.

<details><summary>Answer</summary>

**B.** The OpenGitOps specification explicitly mandates that the desired state of a system must be declared and stored in a version control system that guarantees immutability, version history, and auditability.

- Why not A: OpenGitOps requires declarative specifications, forbidding procedural imperative scripts.
- Why not C: GitOps enforces pull-based synchronization from central version control, prohibiting manual push deployments from developer workstations.
- Why not D: Bypassing version control violates the foundational auditability and traceability axioms of GitOps.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://opengitops.dev/

</details>

### Q-ARGO-002 · CGOA D1 GitOps Principles · difficulty 2 · scenario

An enterprise engineering team currently deploys container images to Kubernetes clusters by running `helm upgrade` inside Jenkins CI pipelines directly against cluster API servers. Leadership decides to migrate to GitOps. What is the fundamental architectural shift in deployment flow?

- A) CI pipelines push manifests directly to Kubernetes API servers via webhook triggers.
- B) Developers commit desired state changes to Git, and an in-cluster pull agent reconciles live cluster state against Git.
- C) Kubernetes API servers poll developer workstations for local code updates every 30 seconds.
- D) Container registries automatically execute kubectl apply commands whenever an image is pushed.

<details><summary>Answer</summary>

**B.** GitOps replaces external push-based CI mechanisms with an in-cluster pull agent (such as Argo CD or Flux) that continuously watches the Git desired state repository and pulls changes into the cluster.

- Why not A: Pushing from CI pipelines to the cluster API server is a push-based deployment model, not GitOps pull.
- Why not C: Kubernetes does not poll developer workstations; version control servers store the declarative truth.
- Why not D: Container registries store container images, not declarative infrastructure manifests.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-003 · CGOA D1 GitOps Principles · difficulty 2 · multi

Which of the following guarantees are provided by adhering to OpenGitOps principles? (Select all that apply)

- A) Complete audit trail of who modified configuration and when.
- B) Automated instant rollback capabilities via Git revert commits.
- C) Elimination of all possible application runtime bugs.
- D) Prevention of unauthorized direct `kubectl` cluster modifications when self-heal is enabled.

<details><summary>Answer</summary>

**A, B, D.** Version control provides immutable audit logs (A) and instant rollback via git revert (B). When self-healing is active, Argo CD overwrites unauthorized manual `kubectl` edits, preserving desired state (D).

- Why not C: GitOps ensures configuration and desired state consistency, but cannot eliminate application bugs inside container code.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://opengitops.dev/

</details>

### Q-ARGO-004 · CGOA D1 GitOps Principles · difficulty 1 · single

What is the primary distinction between push-based CI/CD pipelines and pull-based GitOps?

- A) Push CI/CD requires credentials stored outside the cluster, whereas pull GitOps requires cluster credentials stored in CI runners.
- B) Push CI/CD initiates deployment from outside the cluster, while pull GitOps runs an authorized agent inside the cluster pulling updates.
- C) Push CI/CD cannot deploy Helm charts, whereas pull GitOps exclusively supports plain YAML.
- D) Push CI/CD is fully declarative, while pull GitOps is entirely imperative.

<details><summary>Answer</summary>

**B.** In push CI/CD, external CI servers hold cluster admin credentials and push updates into the cluster. In pull GitOps, an internal cluster agent pulls updates from Git, keeping cluster access credentials hermetically inside the cluster boundary.

- Why not A: Push CI holds cluster credentials in external CI runners, whereas pull GitOps stores git credentials inside the cluster secret store.
- Why not C: Both push and pull systems support Helm charts and plain YAML.
- Why not D: GitOps is declarative, whereas push CI can be either imperative or declarative.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-005 · CGOA D1 GitOps Principles · difficulty 2 · scenario

An operator observes that whenever an administrator manually edits a Deployment replica count in the cluster using `kubectl scale`, Argo CD automatically reverts the replicas back to the count specified in Git within three minutes. Which OpenGitOps principle is demonstrated here?

- A) Automated version promotion
- B) Continuous reconciliation and drift correction
- C) Ephemeral container scheduling
- D) Immutable infrastructure provisioning

<details><summary>Answer</summary>

**B.** Continuous reconciliation is the core OpenGitOps principle stating that software agents must continuously monitor live system state and automatically correct any drift from the declared desired state.

- Why not A: Version promotion involves moving tags or commits across environment branches, not drift correction.
- Why not C: Ephemeral containers refer to debugging sidecars in Kubernetes pods.
- Why not D: Immutable infrastructure involves replacing servers rather than mutating them in place.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-006 · CGOA D1 GitOps Principles · difficulty 1 · single

Which organization maintains the official OpenGitOps specification and principles?

- A) Cloud Native Computing Foundation (CNCF)
- B) Linux Foundation Enterprise Networking
- C) Apache Software Foundation
- D) Open Source Initiative (OSI)

<details><summary>Answer</summary>

**A.** OpenGitOps is an official CNCF sandbox and incubation project focused on defining standardized GitOps principles.

- Why not B, C, D: These organizations do not host the OpenGitOps project.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://opengitops.dev/

</details>

### Q-ARGO-007 · CGOA D1 GitOps Principles · difficulty 2 · multi

Which of the following scenarios represent anti-patterns in GitOps architectures? (Select all that apply)

- A) Storing unencrypted database passwords in plain text in a public Git repository.
- B) Using an automated CI pipeline to update image tags in Git manifests.
- C) Running imperative `kubectl delete pod` commands to troubleshoot live production issues temporarily.
- D) Utilizing a pull-based controller to synchronize Kubernetes CRDs from Git.

<details><summary>Answer</summary>

**A, C.** Storing plaintext secrets in Git violates security fundamentals (A). Executing imperative manual commands directly in production bypasses Git auditability and risks permanent drift if self-heal is disabled (C).

- Why not B: Automated CI image tag updates are standard GitOps automation practices.
- Why not D: Synchronizing CRDs via pull-based controllers is a standard GitOps pattern.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-008 · CGOA D1 GitOps Principles · difficulty 1 · single

What is the primary benefit of treating infrastructure and application configuration as immutable version-controlled artifacts?

- A) Eliminates the need for container registries.
- B) Enables reproducible environments and deterministic rollbacks.
- C) Speeds up Linux kernel compilation times.
- D) Removes the requirement for Kubernetes RBAC enforcement.

<details><summary>Answer</summary>

**B.** Version-controlled immutable artifacts ensure that any historical environment state can be precisely reproduced and rolled back instantly.

- Why not A: Container registries remain necessary for storing OCI container image layers.
- Why not C: Kernel compilation is unrelated to declarative application configurations.
- Why not D: RBAC remains essential for cluster security regardless of GitOps.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-009 · CGOA D1 GitOps Principles · difficulty 2 · scenario

When designing a GitOps workflow for a multi-tenant enterprise cluster, security auditors require that no cluster credentials ever leave the Kubernetes control plane boundary. Which architectural pattern satisfies this requirement?

- A) Push-based GitHub Actions workflow using cluster admin kubeconfig secrets.
- B) Pull-based Argo CD agent operating inside the cluster using internal API tokens and read-only repository access.
- C) Developer laptops executing `helm install` via VPN tunnels.
- D) Unauthenticated HTTP webhooks pushing configuration payloads.

<details><summary>Answer</summary>

**B.** A pull-based in-cluster agent (Argo CD) operates entirely within the cluster boundary, fetching configuration from Git without exposing cluster credentials to external CI runners.

- Why not A: GitHub Actions holding kubeconfig secrets represents an external push architecture with credential exposure risks.
- Why not C, D: Developer VPN installs and unauthenticated webhooks violate security compliance standards.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-010 · CGOA D1 GitOps Principles · difficulty 1 · single

According to OpenGitOps axioms, what happens to the state of software systems if the declarative repository becomes unavailable or corrupted?

- A) All running pods terminate immediately.
- B) The system continues running its last successfully synchronized state until connectivity or repository integrity is restored.
- C) Kubernetes automatically deletes all custom resources.
- D) The cluster reverts to factory default settings.

<details><summary>Answer</summary>

**B.** Because GitOps relies on pull reconciliation, temporary repository unavailability prevents new updates but leaves existing successfully reconciled live workloads running unaffected.

- Why not A, C, D: Pull agents do not destroy workloads when repositories are temporarily unreachable.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://opengitops.dev/

</details>

### Q-ARGO-011 · CGOA D2 GitOps Terminology · difficulty 1 · single

What does the term "Desired State" refer to in GitOps terminology?

- A) The live memory consumption of Kubernetes worker nodes.
- B) The declarative configuration stored in version control representing how the system should be configured.
- C) The CPU throttle limits defined by container runtimes.
- D) The network packet drop rate reported by CNI plugins.

<details><summary>Answer</summary>

**B.** Desired state refers to the declarative YAML, JSON, or Helm manifests stored in Git that define what resources must exist in the target cluster.

- Why not A, C, D: These represent live runtime metrics and hardware telemetry, not declarative desired state.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-012 · CGOA D2 GitOps Terminology · difficulty 2 · scenario

An engineer runs `argocd app diff my-app` and notices differences listed between Git and the cluster. What term best describes this condition?

- A) Network Partition
- B) Configuration Drift
- C) Kernel Panic
- D) Pod Eviction

<details><summary>Answer</summary>

**B.** Configuration drift occurs when the live state of cluster resources diverges from the version-controlled desired state stored in Git.

- Why not A: Network partitions refer to network link failures between nodes.
- Why not C: Kernel panic is an operating system crash.
- Why not D: Pod eviction occurs under resource pressure.
- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-013 · CGOA D2 GitOps Terminology · difficulty 1 · single

What is the function of an Argo CD "Application" Custom Resource?

- A) It compiles container source code into binary executables.
- B) It binds a Git manifest source repository and path to a target Kubernetes cluster and namespace.
- C) It provisions physical cloud provider virtual machines.
- D) It generates TLS certificates for Ingress controllers.

<details><summary>Answer</summary>

**B.** An Argo CD `Application` CRD acts as the primary deployment unit linking a source repository revision to a target Kubernetes destination.

- Why not A: Compilation is handled by CI tools (e.g., GitLab CI), not Argo CD.
- Why not C: Infrastructure provisioning is typically handled by Terraform or Crossplane.
- Why not D: TLS certs are managed by cert-manager.
- Ref: [modules/02-argocd-architecture-and-controllers.md](../modules/02-argocd-architecture-and-controllers.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-014 · CGOA D2 GitOps Terminology · difficulty 2 · multi

Which of the following components are part of the core Argo CD control plane architecture? (Select all that apply)

- A) API Server (`argocd-server`)
- B) Application Controller (`argocd-application-controller`)
- C) Repository Server (`argocd-repo-server`)
- D) Linux Kernel Scheduler (`ksoftirqd`)

<details><summary>Answer</summary>

**A, B, C.** Argo CD consists of the API server for UI/CLI requests (A), application controller for reconciliation (B), and repo-server for cloning repos and rendering manifests (C).

- Why not D: `ksoftirqd` is a Linux kernel thread, not an Argo CD component.
- Ref: [modules/02-argocd-architecture-and-controllers.md](../modules/02-argocd-architecture-and-controllers.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-015 · CGOA D2 GitOps Terminology · difficulty 1 · single

What is an Argo CD `AppProject` used for?

- A) Grouping container image registries for vulnerability scanning.
- B) Enforcing multi-tenancy boundaries, source repository allowlists, and destination namespace restrictions.
- C) Storing database encryption keys.
- D) Configuring Kubernetes CNI network policies.

<details><summary>Answer</summary>

**B.** `AppProject` provides multi-tenancy isolation by restricting which Git repositories, destination clusters, namespaces, and Kubernetes resource kinds an Application can deploy.

- Why not A: Vulnerability scanning is handled by container security tools.
- Why not C: Encryption keys are managed by Secret stores (SOPS, External Secrets).
- Why not D: Network policies are managed by CNI plugins.
- Ref: [modules/07-multi-tenancy-rbac-and-secrets.md](../modules/07-multi-tenancy-rbac-and-secrets.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-016 · CGOA D2 GitOps Terminology · difficulty 2 · scenario

An operator needs to deploy an application across 50 distinct customer clusters simultaneously without writing 50 separate `Application` manifests. Which Argo CD resource CRD should be used?

- A) AppProject
- B) ApplicationSet
- C) AnalysisTemplate
- D) ConfigMap

<details><summary>Answer</summary>

**B.** `ApplicationSet` uses generators (such as Cluster or List generators) to automate the generation and management of multiple `Application` resources from a single template.

- Why not A: AppProject handles multi-tenancy boundaries, not multi-cluster application generation.
- Why not C: AnalysisTemplate is an Argo Rollouts resource for metric analysis.
- Why not D: ConfigMap stores key-value configuration data.
- Ref: [modules/06-applicationsets-and-generators.md](../modules/06-applicationsets-and-generators.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-017 · CGOA D2 GitOps Terminology · difficulty 1 · single

What purpose do "Sync Waves" serve in Argo CD?

- A) They schedule network packet routing priorities across service meshes.
- B) They sequence the creation and updating of Kubernetes resources during synchronization based on integer annotations.
- C) They control CPU frequency scaling on worker nodes.
- D) They dictate the order of container image builds in CI pipelines.

<details><summary>Answer</summary>

**B.** Sync waves (`argocd.argoproj.io/sync-wave`) allow operators to assign integer values to manifests ensuring foundational resources (like CRDs or Namespaces) deploy before dependent workloads.

- Why not A, C, D: Sync waves govern manifest deployment sequencing within Argo CD sync operations.
- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-018 · CGOA D2 GitOps Terminology · difficulty 2 · multi

Which lifecycle hook phases are natively supported by Argo CD during a synchronization operation? (Select all that apply)

- A) PreSync
- B) Sync
- C) PostSync
- D) SyncFail

<details><summary>Answer</summary>

**A, B, C, D.** Argo CD supports PreSync, Sync, PostSync, SyncFail, and PostDelete lifecycle hooks for executing custom jobs around deployment phases.

- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-019 · CGOA D3 GitOps Patterns · difficulty 2 · scenario

An engineering organization manages 20 microservices across development, staging, and production environments. To prevent developers from accidentally deploying staging configurations to production clusters, which GitOps architectural pattern should be implemented?

- A) Storing all environments in a single root directory with random file naming.
- B) Folder-per-environment repository structure combined with AppProjects enforcing strict destination namespace boundaries.
- C) Disabling Argo CD authentication completely to allow unrestricted deployments.
- D) Running all microservices in the default Kubernetes namespace.

<details><summary>Answer</summary>

**B.** A folder-per-environment repository topology combined with AppProjects restricting destination clusters and namespaces ensures strict separation of concerns and security boundaries.

- Why not A, C, D: Single root directories, disabled auth, and default namespace deployments violate enterprise security and isolation standards.
- Ref: [modules/08-repo-structure-promotion-and-hydrator.md](../modules/08-repo-structure-promotion-and-hydrator.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-020 · CGOA D3 GitOps Patterns · difficulty 1 · single

What is the "App-of-Apps" pattern in Argo CD?

- A) An application that installs other applications by managing a master set of Argo CD `Application` CRDs in Git.
- B) A script that deletes all Kubernetes namespaces when system memory is exhausted.
- C) A method for running mobile phone applications inside Kubernetes pods.
- D) A cluster autoscaling algorithm based on git commit frequency.

<details><summary>Answer</summary>

**A.** The App-of-Apps pattern uses a root Argo CD `Application` whose source points to a directory of child `Application` manifests, enabling declarative bootstrap of entire platform fleets.

- Why not B, C, D: These definitions are unrelated to the Argo CD App-of-Apps deployment pattern.
- Ref: [modules/05-drift-reconciliation-and-app-of-apps.md](../modules/05-drift-reconciliation-and-app-of-apps.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-021 · CGOA D3 GitOps Patterns · difficulty 2 · multi

When implementing secret management in GitOps, which patterns are considered secure and compliant? (Select all that apply)

- A) Committing plaintext database passwords directly into public GitHub repositories.
- B) Utilizing Mozilla SOPS to encrypt secret YAML files stored in Git, decrypting them via in-cluster CMP plugins or operators.
- C) Using External Secrets Operator (ESO) to sync secrets from HashiCorp Vault or AWS Secrets Manager into Kubernetes Secret objects.
- D) Storing base64-encoded Kubernetes secrets directly in Git repositories.

<details><summary>Answer</summary>

**B, C.** Mozilla SOPS (B) and External Secrets Operator (C) ensure that sensitive credentials are never stored in plaintext in Git.

- Why not A, D: Plaintext passwords and base64-encoded strings (which are trivially decoded) stored in Git represent severe security vulnerabilities.
- Ref: [modules/07-multi-tenancy-rbac-and-secrets.md](../modules/07-multi-tenancy-rbac-and-secrets.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-022 · CGOA D3 GitOps Patterns · difficulty 2 · scenario

An Argo CD application managing an autoscaling Deployment experiences perpetual `OutOfSync` status because the Horizontal Pod Autoscaler (HPA) constantly modifies the replica count in the cluster. How should this conflict be resolved?

- A) Delete the HPA controller from the cluster permanently.
- B) Add an `ignoreDifferences` entry targeting `/spec/replicas` on the Deployment in the Argo CD Application spec.
- C) Disable Argo CD synchronization across the entire cluster.
- D) Manually execute `kubectl scale` every 5 minutes.

<details><summary>Answer</summary>

**B.** `ignoreDifferences` instructs Argo CD to ignore specific JSON path fields (such as HPA-managed replicas) during diffing and reconciliation.

- Why not A: Deleting HPA breaks autoscaling functionality.
- Why not C, D: Disabling sync or manual scaling defeats the purpose of GitOps automation.
- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-023 · CGOA D3 GitOps Patterns · difficulty 1 · single

What is the function of the `resources-finalizer.argocd.argoproj.io` finalizer on an Argo CD Application resource?

- A) It prevents the Kubernetes API server from deleting worker nodes.
- B) It ensures that when an Argo CD Application is deleted, all managed child resources deployed in the cluster are also automatically deleted (cascading deletion).
- C) It prevents users from logging into the Argo CD user interface.
- D) It automatically compresses application log files.

<details><summary>Answer</summary>

**B.** The Argo CD finalizer enables cascading deletion, ensuring that deleting an `Application` CRD automatically cleans up all Kubernetes resources managed by that application.

- Why not A, C, D: The finalizer governs cascading cleanup of managed application resources.
- Ref: [modules/05-drift-reconciliation-and-app-of-apps.md](../modules/05-drift-reconciliation-and-app-of-apps.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-024 · CGOA D3 GitOps Patterns · difficulty 2 · multi

Which synchronization options can be configured in an Argo CD Application sync policy? (Select all that apply)

- A) `Prune` (delete resources no longer in Git)
- B) `SelfHeal` (automatically apply corrections upon live drift)
- C) `CreateNamespace` (automatically create destination namespace if missing)
- D) `AutoFormatHardDrive` (format node storage on sync failure)

<details><summary>Answer</summary>

**A, B, C.** Argo CD supports Prune (A), SelfHeal (B), and CreateNamespace (C) sync options.

- Why not D: AutoFormatHardDrive is fictitious and destructive.
- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-025 · CGOA D4 Related Practices · difficulty 1 · single

In a secure GitOps pipeline, what role does a CI (Continuous Integration) system play relative to Argo CD?

- A) The CI system deploys workloads directly to production clusters using admin kubeconfigs.
- B) The CI system builds container images, runs tests, pushes images to a registry, and updates image tags in the GitOps configuration repository.
- C) The CI system replaces the Argo CD repo-server entirely.
- D) The CI system acts as an OIDC identity provider for Dex.

<details><summary>Answer</summary>

**B.** In standard GitOps separation of concerns, CI handles building, testing, and pushing images while updating manifest tags in Git, leaving deployment execution to Argo CD.

- Why not A: Direct CI deployments to production bypass GitOps pull principles.
- Why not C, D: CI does not replace repo-servers or act as OIDC providers.
- Ref: [modules/08-repo-structure-promotion-and-hydrator.md](../modules/08-repo-structure-promotion-and-hydrator.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-026 · CGOA D4 Related Practices · difficulty 2 · scenario

An enterprise security team mandates that all Kubernetes manifests deployed via GitOps must be validated against compliance and security policies (e.g., forbidding privileged containers) before Argo CD applies them. Where in the GitOps workflow should this policy check execute?

- A) Inside the Kubernetes kube-proxy daemonset.
- B) In the CI pipeline or as an Argo CD PreSync validation hook / server-side admission controller (OPA Gatekeeper / Kyverno).
- C) Directly inside developer web browsers via JavaScript.
- D) Inside the Argo CD Redis cache instance.

<details><summary>Answer</summary>

**B.** Policy enforcement should occur during CI manifest generation, via admission controllers (OPA Gatekeeper / Kyverno) in the cluster, or via Argo CD validation hooks before workloads launch.

- Why not A, C, D: kube-proxy, browser JS, and Redis do not perform policy-as-code validation checks.
- Ref: [modules/07-multi-tenancy-rbac-and-secrets.md](../modules/07-multi-tenancy-rbac-and-secrets.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-027 · CGOA D4 Related Practices · difficulty 1 · single

What is the primary purpose of container image update automation tools such as "Argo CD Image Updater"?

- A) To automatically compile Linux kernel modules.
- B) To monitor container registries for new image tags and automatically commit updates to Git manifest repositories.
- C) To delete old pods when disk space runs low.
- D) To rotate TLS certificates in Ingress gateways.

<details><summary>Answer</summary>

**B.** Argo CD Image Updater monitors container registries and automatically updates image tags in Git repositories when new tagged releases become available.

- Why not A, C, D: Image Updater focuses strictly on registry tag monitoring and Git manifest updates.
- Ref: [modules/08-repo-structure-promotion-and-hydrator.md](../modules/08-repo-structure-promotion-and-hydrator.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-028 · CGOA D4 Related Practices · difficulty 2 · multi

Which practices enhance supply-chain security in GitOps workflows? (Select all that apply)

- A) Cryptographically signing container images using Cosign and verifying signatures via admission controllers.
- B) Storing database credentials in plaintext comments inside Dockerfiles.
- C) Generating and verifying Software Bill of Materials (SBOM) for all deployed artifacts.
- D) Pinning git references to immutable commit SHAs or release tags rather than floating `HEAD` branches in production.

<details><summary>Answer</summary>

**A, C, D.** Container image signing (A), SBOM generation (C), and pinning immutable Git commit SHAs (D) are core supply-chain security best practices.

- Why not B: Plaintext credentials in Dockerfiles represent severe security flaws.
- Ref: [modules/07-multi-tenancy-rbac-and-secrets.md](../modules/07-multi-tenancy-rbac-and-secrets.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-029 · CGOA D4 Related Practices · difficulty 2 · scenario

A financial institution requires a complete audit trail proving that every production change originated from an approved pull request merged by two senior engineers. How does GitOps satisfy this audit requirement?

- A) By deleting all git commit history daily to save disk space.
- B) By relying on immutable version control commit logs, pull request review records, and merge signatures.
- C) By allowing any developer to execute unauthenticated cluster admin commands.
- D) By disabling logging across all Kubernetes API servers.

<details><summary>Answer</summary>

**B.** GitOps provides immutable audit trails through version control commit logs, pull request approvals, and cryptographic merge records.

- Why not A, C, D: Deleting history, unauthenticated commands, and disabled logs destroy auditability.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://opengitops.dev/

</details>

### Q-ARGO-030 · CGOA D5 Tooling · difficulty 1 · single

Which tool is the primary CNCF continuous delivery and GitOps engine designed specifically for Kubernetes?

- A) Apache Spark
- B) Argo CD
- C) Prometheus
- D) Fluent Bit

<details><summary>Answer</summary>

**B.** Argo CD is the leading CNCF continuous delivery and GitOps engine for Kubernetes.

- Why not A, C, D: Spark is for big data, Prometheus for metrics, Fluent Bit for logging.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-031 · CGOA D5 Tooling · difficulty 2 · scenario

An engineering team is evaluating GitOps tools and compares Argo CD with Flux. What is a key architectural differentiator of Argo CD?

- A) Argo CD provides a rich graphical user interface (Web UI) and command-line interface out of the box, whereas Flux relies primarily on Kubernetes custom controllers and CLI tooling without a native UI.
- B) Argo CD only supports plain YAML and cannot render Helm charts.
- C) Flux runs exclusively on bare-metal servers without Kubernetes.
- D) Argo CD does not support multi-cluster deployments.

<details><summary>Answer</summary>

**A.** Argo CD is distinguished by its comprehensive Web UI and CLI capabilities, whereas Flux is primarily controller-centric with `flux` CLI tooling.

- Why not B: Argo CD has native support for Helm, Kustomize, and CMP plugins.
- Why not C: Flux runs on Kubernetes.
- Why not D: Argo CD natively supports multi-cluster deployments via registered cluster contexts.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-032 · CGOA D5 Tooling · difficulty 1 · single

What command-line utility is used to interact with Argo CD servers?

- A) `kubectl`
- B) `argocd`
- C) `terraform`
- D) `helm`

<details><summary>Answer</summary>

**B.** The `argocd` CLI is the dedicated command-line interface for managing Argo CD applications, projects, clusters, and admin settings.

- Why not A, C, D: These are general Kubernetes, IaC, and package management tools.
- Ref: [modules/02-argocd-architecture-and-controllers.md](../modules/02-argocd-architecture-and-controllers.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-033 · CGOA D5 Tooling · difficulty 2 · multi

Which manifest formatting engines and tools does Argo CD support natively out of the box? (Select all that apply)

- A) Plain Kubernetes YAML manifests
- B) Helm charts (`helm`)
- C) Kustomize (`kustomize`)
- D) Config Management Plugins (CMP) for custom rendering

<details><summary>Answer</summary>

**A, B, C, D.** Argo CD natively supports plain YAML (A), Helm charts (B), Kustomize (C), and extensible CMP plugins (D).

- Ref: [modules/03-applications-and-manifest-sources.md](../modules/03-applications-and-manifest-sources.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-034 · CGOA D5 Tooling · difficulty 2 · scenario

An organization uses a proprietary templating engine that outputs Kubernetes YAML. How can Argo CD be configured to render these proprietary files before deployment?

- A) By rewriting the engine in Go and recompiling the Kubernetes kernel.
- B) By configuring a Config Management Plugin (CMP) sidecar container in the `argocd-repo-server` pod.
- C) By converting all files into binary images.
- D) By disabling manifest rendering entirely.

<details><summary>Answer</summary>

**B.** Config Management Plugins (CMP) run as sidecar containers in the `argocd-repo-server`, allowing integration of arbitrary CLI rendering tools into Argo CD.

- Why not A, C, D: Kernel recompilation and binary conversions are incorrect; CMP sidecars provide custom rendering.
- Ref: [modules/03-applications-and-manifest-sources.md](../modules/03-applications-and-manifest-sources.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-035 · CAPA D1 Argo Workflows · difficulty 1 · single

What is Argo Workflows?

- A) A container-native workflow engine for orchestrating parallel jobs and Directed Acyclic Graphs (DAGs) on Kubernetes.
- B) A database indexing engine for PostgreSQL.
- C) A browser-based IDE for editing YAML files.
- D) A network load balancer for ingress traffic.

<details><summary>Answer</summary>

**A.** Argo Workflows is a container-native workflow engine designed to execute complex pipelines, steps, and DAGs as native Kubernetes pods.

- Why not B, C, D: Argo Workflows orchestrates containerized workflows and pipelines.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/workflows/

</details>

### Q-ARGO-036 · CAPA D1 Argo Workflows · difficulty 2 · scenario

An automated data processing pipeline requires Step A to execute first, followed by Step B and Step C running in parallel, with Step D executing only after both B and C successfully finish. Which Argo Workflows construct defines this execution topology?

- A) Linear shell script
- B) Directed Acyclic Graph (DAG) or steps structure with dependencies
- C) Infinite while loop
- D) Stateless CronJob

<details><summary>Answer</summary>

**B.** DAGs and step templates in Argo Workflows explicitly model complex execution dependencies, parallel branching, and convergence points.

- Why not A, C, D: Shell scripts lack native container orchestration, while loops and CronJobs do not model complex DAG dependencies.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/workflows/

</details>

### Q-ARGO-037 · CAPA D1 Argo Workflows · difficulty 1 · single

How are individual steps or tasks executed in Argo Workflows?

- A) As dedicated individual Kubernetes Pods where each container executes a workflow step.
- B) As systemd services running on the master node.
- C) As raw SQL queries inside MySQL.
- D) As browser extensions.

<details><summary>Answer</summary>

**A.** Argo Workflows executes workflow steps as isolated Kubernetes Pods, leveraging container isolation and Kubernetes scheduling.

- Why not B, C, D: Steps execute as Kubernetes Pods.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/workflows/

</details>

### Q-ARGO-038 · CAPA D1 Argo Workflows · difficulty 2 · multi

Which features are supported by Argo Workflows? (Select all that apply)

- A) Passing artifacts (files/data) between workflow steps using object storage (S3/GCS).
- B) Retrying failed steps with exponential backoff.
- C) Suspending workflows for manual human approval.
- D) Compiling Python code directly into Linux kernel space.

<details><summary>Answer</summary>

**A, B, C.** Argo Workflows supports artifact passing via S3/GCS (A), step retries with backoff (B), and manual suspension gates for human approval (C).

- Why not D: Workflows execute container pods, not kernel space code.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/workflows/

</details>

### Q-ARGO-039 · CAPA D1 Argo Workflows · difficulty 2 · scenario

A machine learning training workflow generates a 50GB model weights file in Step 1 that must be consumed by Step 2. How does Argo Workflows handle data artifact passing between steps?

- A) By printing the binary weights into standard output text logs.
- B) By uploading the artifact from Step 1 to an artifact repository (such as S3 or MinIO) and downloading it into Step 2's container pod.
- C) By transmitting the file over unencrypted UDP broadcast.
- D) By storing the file in the etcd key-value store.

<details><summary>Answer</summary>

**B.** Argo Workflows integrates with artifact repositories (S3, MinIO, GCS) to persist and transfer large files between isolated step pods.

- Why not A, C, D: Binary files cannot be piped through logs, UDP broadcast, or etcd (which has strict size limits).
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/workflows/

</details>

### Q-ARGO-040 · CAPA D2 Argo CD · difficulty 1 · single

What is the role of the `argocd-repo-server` component in Argo CD architecture?

- A) It manages cluster networking and CNI routing rules.
- B) It clones Git repositories, fetches Helm charts, and generates live manifests for the application controller.
- C) It stores user passwords in plaintext.
- D) It executes container security scans.

<details><summary>Answer</summary>

**B.** The `argocd-repo-server` is a stateless microservice responsible for interacting with Git repositories, rendering Helm/Kustomize/CMP manifests, and returning YAML to the application controller.

- Why not A, C, D: Repo-server handles manifest generation and repository caching, not CNI, plaintext storage, or security scanners.
- Ref: [modules/02-argocd-architecture-and-controllers.md](../modules/02-argocd-architecture-and-controllers.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-041 · CAPA D2 Argo CD · difficulty 2 · scenario

An administrator notices high CPU and memory utilization on the Argo CD `repo-server` pod when thousands of applications reconcile simultaneously. What architectural feature mitigates this load?

- A) Disabling the Kubernetes API server.
- B) Enabling the repo-server manifest cache (Redis-backed caching) and scaling repo-server replicas horizontally.
- C) Deleting all Git repository credentials.
- D) Reducing cluster worker node RAM.

<details><summary>Answer</summary>

**B.** Scaling `repo-server` replicas horizontally and utilizing Redis-backed manifest caching significantly reduces redundant Git cloning and manifest rendering overhead.

- Why not A, C, D: Disabling API servers, deleting credentials, or reducing RAM will break or destabilize the platform.
- Ref: [modules/10-operating-argocd-at-scale.md](../modules/10-operating-argocd-at-scale.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-042 · CAPA D2 Argo CD · difficulty 1 · single

What is the function of the Argo CD application controller's reconciliation loop?

- A) To periodically compare the desired state in Git with the live state in the target Kubernetes cluster and calculate sync status.
- B) To backup cluster databases onto magnetic tape.
- C) To generate SSL certificates for user browsers.
- D) To compile source code into container images.

<details><summary>Answer</summary>

**A.** The application controller runs a continuous reconciliation loop comparing Git desired state against live cluster state, determining whether applications are Synced or OutOfSync.

- Why not B, C, D: These tasks belong to backup systems, certificate managers, and CI pipelines.
- Ref: [modules/02-argocd-architecture-and-controllers.md](../modules/02-argocd-architecture-and-controllers.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-043 · CAPA D2 Argo CD · difficulty 2 · multi

Which components are involved in Argo CD high-availability deployments? (Select all that apply)

- A) High-availability Redis cache cluster
- B) Multiple sharded or replicated application controllers
- C) Replicated API servers (`argocd-server`)
- D) Replicated repo-servers (`argocd-repo-server`)

<details><summary>Answer</summary>

**A, B, C, D.** Production HA Argo CD installations replicate API servers, repo-servers, application controllers (with sharding), and Redis instances.

- Ref: [modules/10-operating-argocd-at-scale.md](../modules/10-operating-argocd-at-scale.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-044 · CAPA D2 Argo CD · difficulty 2 · scenario

An Argo CD installation manages 5,000 applications, causing the single default application-controller pod to suffer frequent OOM (Out Of Memory) crashes. What is the recommended remediation?

- A) Increase the pod memory limit to 500GB on a single pod.
- B) Configure application controller sharding (`ARGOCD_CONTROLLER_REPLICAS`) to distribute application reconciliation across multiple controller replicas.
- C) Delete 4,500 applications.
- D) Switch Argo CD to push mode.

<details><summary>Answer</summary>

**B.** Controller sharding distributes the workload of reconciling thousands of applications across multiple application-controller replicas.

- Why not A: Vertical scaling has physical limits and single-point-of-failure risks.
- Why not C, D: Deleting apps or switching to push mode is incorrect.
- Ref: [modules/10-operating-argocd-at-scale.md](../modules/10-operating-argocd-at-scale.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-045 · CAPA D3 Argo Rollouts · difficulty 1 · single

What is Argo Rollouts?

- A) A Kubernetes controller and set of CRDs providing progressive delivery features such as blue/green and canary deployments.
- B) A database migration tool for relational schemas.
- C) A log aggregation agent for Elasticsearch.
- D) A network packet analyzer.

<details><summary>Answer</summary>

**A.** Argo Rollouts is a Kubernetes progressive delivery controller providing advanced deployment strategies like canary analysis and blue/green switches.

- Why not B, C, D: Argo Rollouts manages progressive Kubernetes deployments.
- Ref: [modules/09-progressive-delivery-argo-rollouts.md](../modules/09-progressive-delivery-argo-rollouts.md), https://argoproj.github.io/argo-rollouts/

</details>

### Q-ARGO-046 · CAPA D3 Argo Rollouts · difficulty 2 · scenario

During a canary rollout managed by Argo Rollouts, the automated analysis template queries Prometheus for HTTP 5xx error rates. If the error rate exceeds 1% during a canary step, what action does Argo Rollouts take?

- A) It automatically aborts the rollout and rolls back traffic to the stable version.
- B) It scales the cluster worker nodes to zero.
- C) It deletes the Prometheus database.
- D) It ignores the metric failure and promotes the canary to 100%.

<details><summary>Answer</summary>

**A.** When analysis fails criteria thresholds, Argo Rollouts automatically aborts the rollout, halting progression and rolling back to stable workloads.

- Why not B, C, D: Deleting nodes, databases, or ignoring failures violates progressive delivery safety protocols.
- Ref: [modules/09-progressive-delivery-argo-rollouts.md](../modules/09-progressive-delivery-argo-rollouts.md), https://argoproj.github.io/argo-rollouts/

</details>

### Q-ARGO-047 · CAPA D3 Argo Rollouts · difficulty 1 · single

Which Custom Resource replaces standard Kubernetes `Deployment` objects when using Argo Rollouts for advanced deployments?

- A) Application
- B) Rollout
- C) AppProject
- D) DaemonSet

<details><summary>Answer</summary>

**B.** The `Rollout` CRD (`argoproj.io/v1alpha1`) replaces standard `Deployment` objects, providing native canary and blue/green progressive delivery controls.

- Why not A, C, D: Application and AppProject are Argo CD resources; DaemonSet runs pods on all nodes.
- Ref: [modules/09-progressive-delivery-argo-rollouts.md](../modules/09-progressive-delivery-argo-rollouts.md), https://argoproj.github.io/argo-rollouts/

</details>

### Q-ARGO-048 · CAPA D3 Argo Rollouts · difficulty 2 · multi

What metrics providers are natively supported by Argo Rollouts `AnalysisTemplate` objects? (Select all that apply)

- A) Prometheus / Thanos / VictoriaMetrics
- B) Web (HTTP JSON endpoints)
- C) Datadog / New Relic / CloudWatch
- D) Direct kernel memory inspection

<details><summary>Answer</summary>

**A, B, C.** Argo Rollouts analysis templates support Prometheus (A), Web HTTP APIs (B), and APM providers like Datadog and New Relic (C).

- Why not D: Kernel inspection is not a Rollouts analysis provider.
- Ref: [modules/09-progressive-delivery-argo-rollouts.md](../modules/09-progressive-delivery-argo-rollouts.md), https://argoproj.github.io/argo-rollouts/

</details>

### Q-ARGO-049 · CAPA D3 Argo Rollouts · difficulty 2 · scenario

An engineer configures a blue/green deployment strategy using Argo Rollouts. What happens when a new version is promoted?

- A) Pods are deleted randomly across nodes without traffic redirection.
- B) New preview (green) pods spin up alongside stable (blue) pods; once ready, traffic switches atomically to green, and blue pods scale down after a preview/scale-down delay.
- C) The cluster operating system reboots.
- D) All traffic is dropped for 10 minutes.

<details><summary>Answer</summary>

**B.** Blue/green rollouts spin up the new green version, verify health, atomically switch traffic router rules, and retain blue for rollback capability before scaling down.

- Why not A, C, D: Random deletion, reboots, and dropped traffic violate zero-downtime deployment principles.
- Ref: [modules/09-progressive-delivery-argo-rollouts.md](../modules/09-progressive-delivery-argo-rollouts.md), https://argoproj.github.io/argo-rollouts/

</details>

### Q-ARGO-050 · CAPA D4 Argo Events · difficulty 1 · single

What is Argo Events?

- A) An event-driven dependency manager for Kubernetes that connects event sources (webhooks, S3, PubSub) to triggers (Argo Workflows, serverless functions).
- B) A logging tool that prints kernel timestamps.
- C) A packet sniffing utility for CNI interfaces.
- D) A cluster autoscaler.

<details><summary>Answer</summary>

**A.** Argo Events is an event-driven automation framework for Kubernetes that triggers workflows and workloads in response to external events.

- Why not B, C, D: Argo Events coordinates event-driven triggers and dependencies.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/events/

</details>

### Q-ARGO-051 · CAPA D4 Argo Events · difficulty 2 · scenario

An automated workflow needs to trigger whenever a new object is uploaded to an AWS S3 bucket. Which Argo Events custom resources collaborate to achieve this?

- A) Application and AppProject
- B) EventSource and Sensor
- C) Rollout and AnalysisTemplate
- D) Deployment and Service

<details><summary>Answer</summary>

**B.** `EventSource` captures incoming events from external providers (like S3), and `Sensor` evaluates event conditions to trigger downstream actions (like Argo Workflows).

- Why not A, C, D: These are Argo CD and Kubernetes workload resources.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/events/

</details>

### Q-ARGO-052 · CAPA D4 Argo Events · difficulty 1 · single

In Argo Events terminology, what does an `EventSource` CRD define?

- A) The configuration for receiving events from external event brokers and services (e.g., GitHub, AWS S3, Webhooks, Kafka).
- B) The CPU architecture of worker nodes.
- C) The database connection string for Argo CD.
- D) The TLS cipher suites for Ingress controllers.

<details><summary>Answer</summary>

**A.** `EventSource` defines how Argo Events connects to and consumes events from external event providers and message queues.

- Why not B, C, D: EventSource configures event source ingestion listeners.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/events/

</details>

### Q-ARGO-053 · CAPA D4 Argo Events · difficulty 2 · multi

Which event sources are natively supported by Argo Events `EventSource` definitions? (Select all that apply)

- A) Webhooks (GitHub, GitLab, Bitbucket)
- B) AWS S3 / MinIO object storage
- C) Apache Kafka / NATS / RabbitMQ messaging systems
- D) Direct physical mouse clicks on server bezels

<details><summary>Answer</summary>

**A, B, C.** Argo Events supports webhooks (A), object storage (B), and message brokers like Kafka and NATS (C).

- Why not D: Physical mouse clicks cannot be captured by Kubernetes cluster controllers.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/events/

</details>

### Q-ARGO-054 · Hands-on Task · difficulty 3 · hands-on

**Hands-On Task 1: Declarative Argo CD Application Sync Verification** Verify that an Argo CD `Application` resource successfully synchronizes a Git repository manifest into a Kubernetes cluster using the Argo CD CLI and test suite assertions.

- Task Script Reference: `examples/ts/04-sync-mechanics-waves-and-hooks.test.ts`
- Verification Steps:
  1. Apply the Application manifest: `kubectl apply -f examples/ts/lib/argocd-model.ts`
  2. Execute sync: `argocd app sync guestbook --wait`
  3. Run test assertion suite: `npx tsx examples/ts/04-sync-mechanics-waves-and-hooks.test.ts`

<details><summary>Answer</summary>

**Correct execution and test pass.** The test suite asserts that live cluster deployment status matches Git desired state with exit code 0 and health status `Healthy`.

- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), `examples/ts/04-sync-mechanics-waves-and-hooks.test.ts`

</details>

### Q-ARGO-055 · Hands-on Task · difficulty 3 · hands-on

**Hands-On Task 2: Sync Wave Ordering Validation** Validate that resources annotated with negative sync waves (`sync-wave: "-1"`) successfully complete execution before application workloads in wave `0`.

- Task Script Reference: `examples/ts/04-sync-mechanics-waves-and-hooks.test.ts`
- Verification Steps:
  1. Deploy multi-wave manifest bundle.
  2. Inspect execution timestamps of PreSync migration Jobs and Deployment pods.
  3. Execute `npx tsx examples/ts/04-sync-mechanics-waves-and-hooks.test.ts` to assert strict wave ordering invariants.

<details><summary>Answer</summary>

**Correct execution and test pass.** The test suite verifies completion timestamps proving wave `-1` resources terminated successfully prior to wave `0` deployment creation.

- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), `examples/ts/04-sync-mechanics-waves-and-hooks.test.ts`

</details>

### Q-ARGO-056 · Hands-on Task · difficulty 3 · hands-on

**Hands-On Task 3: ApplicationSet Generator Verification** Verify that an Argo CD `ApplicationSet` utilizing a Git directory generator correctly spawns individual `Application` CRDs for discovered subdirectories.

- Task Script Reference: `examples/ts/06-applicationsets-and-generators.test.ts`
- Verification Steps:
  1. Apply ApplicationSet manifest.
  2. Query generated applications: `kubectl get applications -n argocd`
  3. Execute `npx tsx examples/ts/06-applicationsets-and-generators.test.ts` to assert correct templating and cluster binding.

<details><summary>Answer</summary>

**Correct execution and test pass.** The test asserts that discovered directory paths map 1:1 to generated Argo CD Application custom resources.

- Ref: [modules/06-applicationsets-and-generators.md](../modules/06-applicationsets-and-generators.md), `examples/ts/06-applicationsets-and-generators.test.ts`

</details>

### Q-ARGO-057 · Hands-on Task · difficulty 3 · hands-on

**Hands-On Task 4: Casbin RBAC Authorization Audit** Audit Argo CD fine-grained RBAC policies in `argocd-rbac-cm` to ensure developer groups possess application sync rights while lacking administrative cluster privileges.

- Task Script Reference: `examples/ts/07-multi-tenancy-rbac-and-secrets.test.ts`
- Verification Steps:
  1. Apply `argocd-rbac-cm` configuration map.
  2. Execute test suite: `npx tsx examples/ts/07-multi-tenancy-rbac-and-secrets.test.ts` simulating API requests with developer tokens.

<details><summary>Answer</summary>

**Correct execution and test pass.** The test verifies that developer tokens successfully execute `app sync` but receive HTTP 403 Forbidden on admin cluster mutation requests.

- Ref: [modules/07-multi-tenancy-rbac-and-secrets.md](../modules/07-multi-tenancy-rbac-and-secrets.md), `examples/ts/07-multi-tenancy-rbac-and-secrets.test.ts`

</details>

### Q-ARGO-058 · Hands-on Task · difficulty 3 · hands-on

**Hands-On Task 5: Argo Rollouts Canary Analysis Abort Verification** Verify that an Argo Rollouts canary deployment automatically aborts and rolls back when an `AnalysisTemplate` detects simulated metric failure thresholds.

- Task Script Reference: `examples/ts/09-progressive-delivery-argo-rollouts.test.ts`
- Verification Steps:
  1. Apply Rollout and AnalysisTemplate manifests.
  2. Trigger promotion: `kubectl argo rollouts promote webapp-rollout`
  3. Simulate metric error spike and execute `npx tsx examples/ts/09-progressive-delivery-argo-rollouts.test.ts` to assert automated abort and rollback status.

<details><summary>Answer</summary>

**Correct execution and test pass.** The test asserts that the Rollout controller transitions to `Degraded`/`Aborted` status and reverts traffic to the stable ReplicaSet.

- Ref: [modules/09-progressive-delivery-argo-rollouts.md](../modules/09-progressive-delivery-argo-rollouts.md), `examples/ts/09-progressive-delivery-argo-rollouts.test.ts`

</details>

### Q-ARGO-059 · CGOA D1 GitOps Principles · difficulty 2 · multi

Which core tenets distinguish GitOps from traditional configuration management tools like Ansible or Chef? (Select all that apply)

- A) Continuous automated reconciliation loop running inside the target cluster.
- B) Version control serving as the single source of truth for all system state.
- C) Imperative shell scripts executing ad-hoc SSH commands against remote servers.
- D) Cryptographic audit trails linking every change to git commits and pull requests.

<details><summary>Answer</summary>

**A, B, D.** GitOps relies on continuous in-cluster reconciliation (A), version control as single source of truth (B), and cryptographic PR audit trails (D).

- Why not C: Imperative SSH scripts represent traditional configuration management anti-patterns, not GitOps.
- Ref: [modules/01-gitops-principles-and-architecture-comparison.md](../modules/01-gitops-principles-and-architecture-comparison.md), https://opengitops.dev/

</details>

### Q-ARGO-060 · CAPA D2 Argo CD · difficulty 2 · scenario

An operator needs to prevent Argo CD from managing or reconciling custom resource definitions (CRDs) installed by third-party operators that frequently update internal annotations. How can this be achieved safely?

- A) Uninstall Kubernetes completely.
- B) Add the CRD API group and kind to `resource.exclusions` in the `argocd-cm` ConfigMap.
- C) Delete all Argo CD application controllers.
- D) Switch to unauthenticated HTTP mode.

<details><summary>Answer</summary>

**B.** `resource.exclusions` in `argocd-cm` instructs the Argo CD controller to ignore specified resource kinds or API groups entirely.

- Why not A, C, D: Uninstalling Kubernetes, deleting controllers, or disabling auth disrupts platform operations.
- Ref: [modules/10-operating-argocd-at-scale.md](../modules/10-operating-argocd-at-scale.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-061 · CGOA D3 GitOps Patterns · difficulty 2 · scenario

When structuring a monorepo for multiple microservices across staging and production environments, why is a folder-per-environment structure preferred over a branch-per-environment structure?

- A) Folder-per-environment allows atomic cross-service promotions via pull requests and avoids complex git merge conflict overhead across diverging long-lived branches.
- B) Branch-per-environment is required by Kubernetes API servers.
- C) Folder-per-environment prevents container images from being built.
- D) Branch-per-environment consumes zero disk space.

<details><summary>Answer</summary>

**A.** Folder-per-environment structures enable transparent diffing, atomic pull requests across environments, and avoid the notorious merge conflict hell of branch-per-environment models.

- Why not B, C, D: Kubernetes does not mandate branch models, and branches consume git storage.
- Ref: [modules/08-repo-structure-promotion-and-hydrator.md](../modules/08-repo-structure-promotion-and-hydrator.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-062 · CAPA D1 Argo Workflows · difficulty 2 · scenario

An Argo Workflow step fails due to a transient network timeout when calling an external API. How can the workflow be configured to automatically retry the failed step up to 3 times with exponential backoff?

- A) By restarting the entire Kubernetes cluster.
- B) By configuring `retryStrategy` with `limit: 3` and `backoff: { duration: "10s", factor: 2 }` on the workflow template step.
- C) By setting pod CPU requests to zero.
- D) By disabling workflow persistence.

<details><summary>Answer</summary>

**B.** Argo Workflows supports native `retryStrategy` configurations with backoff factors and limits for resilient task execution.

- Why not A, C, D: Cluster restarts and zero CPU requests do not solve transient step retries.
- Ref: [modules/11-argo-workflows-events-and-version-history.md](../modules/11-argo-workflows-events-and-version-history.md), https://argoproj.github.io/workflows/

</details>

### Q-ARGO-063 · CAPA D3 Argo Rollouts · difficulty 2 · scenario

An engineer wants to route 10% of production traffic to a canary Argo Rollout pod using an existing Istio ServiceMesh VirtualService. How does Argo Rollouts integrate with Istio for traffic splitting?

- A) By manually editing Istio YAML files every 5 minutes.
- B) By configuring the Rollout `strategy.canary.trafficRouting.istio` section referencing virtualServices and destinationRules.
- C) By deleting the Istio control plane.
- D) By routing all traffic through local host files.

<details><summary>Answer</summary>

**B.** Argo Rollouts integrates directly with traffic routers (Istio, Gateway API, NGINX, ALB) via declarative traffic routing plugin stanzas in the Rollout spec.

- Why not A, C, D: Manual edits, deleting control planes, and host files bypass declarative progressive delivery controller automation.
- Ref: [modules/09-progressive-delivery-argo-rollouts.md](../modules/09-progressive-delivery-argo-rollouts.md), https://argoproj.github.io/argo-rollouts/

</details>

### Q-ARGO-064 · CGOA D2 GitOps Terminology · difficulty 1 · single

What is the function of an Argo CD "Webhook"?

- A) To allow external Git hosting providers (GitHub, GitLab, Bitbucket) to notify Argo CD instantly when code changes are pushed, triggering immediate reconciliation.
- B) To capture audio recordings of server rooms.
- C) To connect printer peripherals to Kubernetes worker nodes.
- D) To compile container source code.

<details><summary>Answer</summary>

**A.** Webhooks notify Argo CD of Git push events instantly, bypassing polling intervals for immediate reconciliation.

- Why not B, C, D: Webhooks handle event notifications from Git providers.
- Ref: [modules/05-drift-reconciliation-and-app-of-apps.md](../modules/05-drift-reconciliation-and-app-of-apps.md), https://argo-cd.readthedocs.io/

</details>

### Q-ARGO-065 · CAPA D2 Argo CD · difficulty 2 · scenario

An Argo CD application encounters synchronization failure because a large custom resource manifest exceeds the maximum annotation size limit during client-side apply. What Argo CD sync option resolves this issue?

- A) `Replace=true`
- B) `ServerSideApply=true`
- C) `Prune=false`
- D) `SkipDryRunOnMissingResource=true`

<details><summary>Answer</summary>

**B.** Enabling `ServerSideApply=true` delegates manifest application to the Kubernetes API server, eliminating client-side annotation size constraints and managing field ownership cleanly.

- Why not A, C, D: Replace, Prune=false, and SkipDryRun do not address client-side annotation size limits.
- Ref: [modules/04-sync-mechanics-waves-and-hooks.md](../modules/04-sync-mechanics-waves-and-hooks.md), https://argo-cd.readthedocs.io/

</details>

---

## Full Mock Exam

This mock exam mirrors the format, question count, and domain distribution of the combined CGOA and CAPA certification exams.

### Answer Key

| Q ID       | Cert & Domain | Type     | Difficulty | Correct Key |
| :--------- | :------------ | :------- | :--------- | :---------- |
| Q-ARGO-001 | CGOA D1       | single   | 1          | B           |
| Q-ARGO-002 | CGOA D1       | scenario | 2          | B           |
| Q-ARGO-003 | CGOA D1       | multi    | 2          | A, B, D     |
| Q-ARGO-004 | CGOA D1       | single   | 1          | B           |
| Q-ARGO-005 | CGOA D1       | scenario | 2          | B           |
| Q-ARGO-006 | CGOA D1       | single   | 1          | A           |
| Q-ARGO-007 | CGOA D1       | multi    | 2          | A, C        |
| Q-ARGO-008 | CGOA D1       | single   | 1          | B           |
| Q-ARGO-009 | CGOA D1       | scenario | 2          | B           |
| Q-ARGO-010 | CGOA D1       | single   | 1          | B           |
| Q-ARGO-011 | CGOA D2       | single   | 1          | B           |
| Q-ARGO-012 | CGOA D2       | scenario | 2          | B           |
| Q-ARGO-013 | CGOA D2       | single   | 1          | B           |
| Q-ARGO-014 | CGOA D2       | multi    | 2          | A, B, C     |
| Q-ARGO-015 | CGOA D2       | single   | 1          | B           |
| Q-ARGO-016 | CGOA D2       | scenario | 2          | B           |
| Q-ARGO-017 | CGOA D2       | single   | 1          | B           |
| Q-ARGO-018 | CGOA D2       | multi    | 2          | A, B, C, D  |
| Q-ARGO-019 | CGOA D3       | scenario | 2          | B           |
| Q-ARGO-020 | CGOA D3       | single   | 1          | A           |
| Q-ARGO-021 | CGOA D3       | multi    | 2          | B, C        |
| Q-ARGO-022 | CGOA D3       | scenario | 2          | B           |
| Q-ARGO-023 | CGOA D3       | single   | 1          | B           |
| Q-ARGO-024 | CGOA D3       | multi    | 2          | A, B, C     |
| Q-ARGO-025 | CGOA D4       | single   | 1          | B           |
| Q-ARGO-026 | CGOA D4       | scenario | 2          | B           |
| Q-ARGO-027 | CGOA D4       | single   | 1          | B           |
| Q-ARGO-028 | CGOA D4       | multi    | 2          | A, C, D     |
| Q-ARGO-029 | CGOA D4       | scenario | 2          | B           |
| Q-ARGO-030 | CGOA D5       | single   | 1          | B           |
| Q-ARGO-031 | CGOA D5       | scenario | 2          | A           |
| Q-ARGO-032 | CGOA D5       | single   | 1          | B           |
| Q-ARGO-033 | CGOA D5       | multi    | 2          | A, B, C, D  |
| Q-ARGO-034 | CGOA D5       | scenario | 2          | B           |
| Q-ARGO-035 | CAPA D1       | single   | 1          | A           |
| Q-ARGO-036 | CAPA D1       | scenario | 2          | B           |
| Q-ARGO-037 | CAPA D1       | single   | 1          | A           |
| Q-ARGO-038 | CAPA D1       | multi    | 2          | A, B, C     |
| Q-ARGO-039 | CAPA D1       | scenario | 2          | B           |
| Q-ARGO-040 | CAPA D2       | single   | 1          | B           |
| Q-ARGO-041 | CAPA D2       | scenario | 2          | B           |
| Q-ARGO-042 | CAPA D2       | single   | 1          | A           |
| Q-ARGO-043 | CAPA D2       | multi    | 2          | A, B, C, D  |
| Q-ARGO-044 | CAPA D2       | scenario | 2          | B           |
| Q-ARGO-045 | CAPA D3       | single   | 1          | A           |
| Q-ARGO-046 | CAPA D3       | scenario | 2          | A           |
| Q-ARGO-047 | CAPA D3       | single   | 1          | B           |
| Q-ARGO-048 | CAPA D3       | multi    | 2          | A, B, C     |
| Q-ARGO-049 | CAPA D3       | scenario | 2          | B           |
| Q-ARGO-050 | CAPA D4       | single   | 1          | A           |
| Q-ARGO-051 | CAPA D4       | scenario | 2          | B           |
| Q-ARGO-052 | CAPA D4       | single   | 1          | A           |
| Q-ARGO-053 | CAPA D4       | multi    | 2          | A, B, C     |
| Q-ARGO-054 | Hands-on      | hands-on | 3          | Pass        |
| Q-ARGO-055 | Hands-on      | hands-on | 3          | Pass        |
| Q-ARGO-056 | Hands-on      | hands-on | 3          | Pass        |
| Q-ARGO-057 | Hands-on      | hands-on | 3          | Pass        |
| Q-ARGO-058 | Hands-on      | hands-on | 3          | Pass        |
| Q-ARGO-059 | CGOA D1       | multi    | 2          | A, B, D     |
| Q-ARGO-060 | CAPA D2       | scenario | 2          | B           |
| Q-ARGO-061 | CGOA D3       | scenario | 2          | A           |
| Q-ARGO-062 | CAPA D1       | scenario | 2          | B           |
| Q-ARGO-063 | CAPA D3       | scenario | 2          | B           |
| Q-ARGO-064 | CGOA D2       | single   | 1          | A           |
| Q-ARGO-065 | CAPA D2       | scenario | 2          | B           |

### Per-Domain Score Breakdown & Remediation

| Domain | Total Questions | Passing Threshold (75%) | Remediation Module |
| :-- | :-- | :-- | :-- |
| **CGOA D1: Principles** | 12 | 9 | [`modules/01-gitops-principles-and-architecture-comparison.md`](../modules/01-gitops-principles-and-architecture-comparison.md) |
| **CGOA D2: Terminology** | 10 | 8 | [`modules/02-argocd-architecture-and-controllers.md`](../modules/02-argocd-architecture-and-controllers.md) |
| **CGOA D3: Patterns** | 10 | 8 | [`modules/04-sync-mechanics-waves-and-hooks.md`](../modules/04-sync-mechanics-waves-and-hooks.md), [`modules/05-drift-reconciliation-and-app-of-apps.md`](../modules/05-drift-reconciliation-and-app-of-apps.md) |
| **CGOA D4: Related Practices** | 5 | 4 | [`modules/07-multi-tenancy-rbac-and-secrets.md`](../modules/07-multi-tenancy-rbac-and-secrets.md), [`modules/08-repo-structure-promotion-and-hydrator.md`](../modules/08-repo-structure-promotion-and-hydrator.md) |
| **CGOA D5: Tooling** | 5 | 4 | [`modules/03-applications-and-manifest-sources.md`](../modules/03-applications-and-manifest-sources.md), [`modules/06-applicationsets-and-generators.md`](../modules/06-applicationsets-and-generators.md) |
| **CAPA D1: Argo Workflows** | 6 | 5 | [`modules/11-argo-workflows-events-and-version-history.md`](../modules/11-argo-workflows-events-and-version-history.md) |
| **CAPA D2: Argo CD** | 9 | 7 | [`modules/10-operating-argocd-at-scale.md`](../modules/10-operating-argocd-at-scale.md) |
| **CAPA D3: Argo Rollouts** | 5 | 4 | [`modules/09-progressive-delivery-argo-rollouts.md`](../modules/09-progressive-delivery-argo-rollouts.md) |
| **CAPA D4: Argo Events** | 3 | 3 | [`modules/11-argo-workflows-events-and-version-history.md`](../modules/11-argo-workflows-events-and-version-history.md) |
