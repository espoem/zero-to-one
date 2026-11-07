# Glossary: GitLab CI/CD, Runners, and Supply-Chain Security

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Artifact** | Artefakt | Files or directories generated during a job execution that are passed to subsequent stages or stored for download. | GitLab CI/CD Docs |
| **Autoscaler** | Automatické škálování | Dynamic provisioning mechanism in GitLab Runner (such as `docker-autoscaler`) that scales runner worker instances based on job queue demand. | GitLab Runner Architecture |
| **Cache** | Mezipaměť | A collection of files (such as package manager dependencies) downloaded and preserved across multiple job runs for faster compilation. | GitLab CI/CD Caching |
| **CI/CD Component** | CI/CD komponenta | A self-contained, reusable GitLab CI/CD configuration template configured with `spec:inputs` parameters and published in the CI/CD Catalog. | GitLab CI/CD Catalog |
| **Circuit Breaker** | Jistič | A design pattern that prevents cascading failures by stopping calls to a failing external service or pipeline dependency. | Distributed Systems |
| **Cosign** | Cosign | A tool by the Sigstore project for keyless container image signing, verification, and SBOM attestation using OIDC tokens. | Sigstore Project |
| **CycloneDX** | CycloneDX | An OWASP standard lightweight software bill of materials (SBOM) specification for security analysis and component inventory. | OWASP CycloneDX |
| **DAG (Directed Acyclic Graph)** | Směrovaný acyklický graf | A pipeline execution model where jobs depend on explicit predecessor jobs (`needs`) rather than strict stage barriers. | GitLab CI/CD DAG |
| **Deployment Environment** | Nasazovací prostředí | A logical target representing infrastructure (production, staging, review) where code versions are released and tracked. | GitLab Environments |
| **Docker-in-Docker (DinD)** | Docker v Dockeru | A container execution pattern where a container runs a Docker daemon inside itself to build child images, presenting security container escape risks. | Container Security |
| **Executor** | Exekutor | The isolation backend environment (Kubernetes, Docker, Shell, SSH) where GitLab Runner executes CI/CD job scripts. | GitLab Runner |
| **Idempotence / Idempotency** | Idempotence | The property where an operation can be applied multiple times without changing the result beyond the initial application. | System Architecture |
| **ID Token** | ID token | A short-lived JSON Web Token (JWT) issued by GitLab securely via `id_tokens` to authenticate against external clouds (AWS, GCP, Vault). | GitLab OIDC Federation |
| **Include** | Zahrnutí | A YAML directive (`include:local`, `include:project`, `include:remote`) used to compose modular pipeline files into a single execution graph. | GitLab CI/CD Include |
| **Job** | Úloha | The fundamental atomic unit of execution in a GitLab CI/CD pipeline, containing scripts, rules, and execution parameters. | GitLab CI/CD Jobs |
| **Keyless Signing** | Bezklíčové podepisování | Cryptographic signing of artifacts without long-lived private keys, relying on ephemeral keys bound to verified OIDC identities. | Sigstore Cosign |
| **Lead Time for Changes** | Doba pro změnu | A DORA metric measuring the duration from code commit entering version control to successful production deployment. | DORA Metrics |
| **Matrix Parallelism** | Maticová paralelizace | A pipeline feature (`parallel: matrix`) that generates combinatorial job variants across multiple environmental or testing axes. | GitLab CI/CD Matrix |
| **Merge Request (MR)** | Žádost o sloučení | GitLab's atomic code review construct where changes are proposed, reviewed, tested, and gated before merging into main. | GitLab Code Review |
| **Merge Train** | Vlak sloučení | An automated queue of merge requests tested together sequentially against the target branch HEAD to prevent broken master builds. | GitLab Merge Trains |
| **Needs** | Závislosti (`needs`) | A keyword that defines explicit data or job dependencies in a pipeline DAG, bypassing stage ordering barriers. | GitLab CI/CD Needs |
| **OIDC (OpenID Connect)** | OpenID Connect | An identity layer built on OAuth 2.0 enabling clients to verify user identity and obtain secure claims via ID tokens. | OAuth/OIDC RFC |
| **Pipeline** | Pipeline | The top-level orchestration structure in GitLab containing stages, jobs, rules, and execution graphs triggered by git events. | GitLab CI/CD Pipelines |
| **Provenance** | Provenance | Cryptographic attestation detailing the exact build inputs, source repository, commit hash, and build toolchain used to create an artifact. | SLSA Framework |
| **Resource Group** | Skupina prostředků | A concurrency control mechanism that locks deployment jobs per environment to enforce serialized deployments. | GitLab Resource Groups |
| **Review App** | Recenzní aplikace | Ephemeral dynamically provisioned environments spun up per merge request to preview code changes live. | GitLab Review Apps |
| **Rootless BuildKit** | Rootless BuildKit | A container image builder running without root privileges, enhancing container build security on shared worker nodes. | BuildKit Security |
| **Runner** | Runner | A lightweight Go daemon that polls GitLab instances for pending jobs, executes them in configured environments, and reports status. | GitLab Runner |
| **SAST** | SAST | Static Application Security Testing; automated scanning of source code for vulnerabilities and insecure coding patterns. | DevSecOps Standards |
| **SCA** | SCA | Software Composition Analysis; scanning project dependencies for known Common Vulnerabilities and Exposures (CVEs). | DevSecOps Standards |
| **Secret Detection** | Detekce tajemství | Automated scanning processes that prevent hardcoded API keys, private keys, and passwords from being committed to repositories. | Security Scanning |
| **SLSA (Supply-chain Levels for Software Artifacts)** | SLSA | A security framework establishing tamper-proof software supply chains through verifiable build provenance. | SLSA Specification |
| **SPDX** | SPDX | The Software Package Data Exchange standard for communicating software bill of materials and licensing data. | Linux Foundation SPDX |
| **Stage** | Fáze | A logical sequential grouping of jobs in a traditional pipeline where all jobs in a stage must complete before the next stage starts. | GitLab CI/CD Stages |
| **Syft** | Syft | A CLI tool by Anchore for generating CycloneDX and SPDX software bills of materials (SBOMs) from container images and filesystems. | Anchore Syft |
| **Trunk-Based Development** | Vývoj založený na větvi trunk | A version control management practice where all developers merge code into a central branch frequently, avoiding long-lived branches. | Continuous Delivery |
| **Trivy** | Trivy | A comprehensive security scanner by Aqua Security for container images, filesystems, SBOMs, and Infrastructure as Code misconfigurations. | Aqua Security Trivy |
| **Variable Precedence** | Priorita proměnných | The hierarchical rule determining which variable scope (project, group, pipeline, job) overrides another when name collisions occur. | GitLab CI/CD Variables |
| **Vulnerability** | Zranitelnost | A weakness in an information system, security procedure, internal control, or implementation that can be exploited. | Security Glossary |
| **Workflow Rules** | Pravidla workflow (`workflow:rules`) | Top-level pipeline rules that control whether an entire pipeline is created or cancelled based on git events and variable state. | GitLab Workflow Rules |
