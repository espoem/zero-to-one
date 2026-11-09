# GitLab CI/CD, Runners, and Software Supply-Chain Security

`Verified against GitLab 19.5, GitLab Runner 19.5, gitlab-ci-local 4.77.0, Sigstore cosign 3.1.4, Syft 1.24.0, Trivy 0.76.1, SLSA Specification 1.0, Node 26.13.0, TypeScript 7.0.2 on 2026-11-07.`

Welcome to the comprehensive engineering curriculum for **GitLab CI/CD, Runners, and Software Supply-Chain Security**. This track covers the entire spectrum of modern continuous integration, continuous delivery, pipeline architecture, runner provisioning, quality gates, and supply-chain security (SBOMs, keyless signing, and SLSA provenance), taking you from foundational Git workflow mechanics to enterprise-grade platform engineering.

## Prerequisites

Before diving into this track, ensure you are familiar with:

- Container fundamentals and OCI image specifications: see [Containers Curriculum](../containers/README.md).
- Distributed systems coordination and consensus: see [Distributed Systems Curriculum](../../architecture/distributed-systems/README.md).
- Public Key Infrastructure, X.509 certificates, OIDC federation, and mutual TLS: see [Security & Identity Curriculum](../../architecture/security-identity/README.md).
- Infrastructure as Code and state management: see [Terraform Curriculum](../terraform/README.md).

## Syllabus

The curriculum is structured into 9 rigorous modules:

| Module | Title | Core Concepts |
| :-- | :-- | :-- |
| [01](modules/01-cicd-fundamentals-and-dora.md) | CI/CD Fundamentals, Trunk-Based Development, Pipeline-as-Code, and DORA Engineering Metrics | Trunk-based development, lead time for changes, deployment frequency, mean time to recovery (MTTR), change failure rate, YAML parsing mechanics, declarative vs imperative pipelines. |
| [02](modules/02-gitlab-ci-execution-model-and-dag.md) | GitLab CI Execution Model: Stages vs Needs DAG, Workflow Rules, Variable Precedence, Artifacts, and Merge Trains | Pipeline directed acyclic graphs (`needs`), job state machines, workflow rules, variable precedence hierarchy, artifact retention and transfer, merge trains and concurrency. |
| [03](modules/03-pipeline-reuse-components-and-child-pipelines.md) | Pipeline Reuse and Composition: CI/CD Components, Catalog, Spec Inputs, Includes, and Dynamic Child Pipelines | CI/CD components (`spec:inputs`), catalog publishing, local and remote `include`, `extends`, anchor expansion (`*`), dynamic child pipelines generated via artifact handoff. |
| [04](modules/04-runners-executors-and-container-builds.md) | GitLab Runner Architecture: Executors, Autoscaling, Distributed Caching, Rootless BuildKit, and DinD Risks | Runner registration token lifecycle, executors (Kubernetes, Docker, SSH, Shell), Docker-autoscaler, distributed cache caches, rootless BuildKit daemon, Docker-in-Docker security hazards. |
| [05](modules/05-testing-quality-gates-and-merge-trains.md) | Automated Testing and Quality Gates: Matrix Parallelism, JUnit/Coverage Reports, Flaky Test Quarantine, and Merge Trains | Parallel matrix builds, JUnit test report ingestion, code coverage parsing regex, flaky test quarantine strategies, automated code quality and security scanning gates, merge train concurrency locks. |
| [06](modules/06-supply-chain-security-sbom-cosign-slsa.md) | Software Supply-Chain Security: SAST/SCA, CycloneDX/SPDX SBOMs, Keyless Cosign v3 OIDC Signing, and SLSA Provenance | Static application security testing (SAST), software composition analysis (SCA), CycloneDX and SPDX SBOM generation via Syft, vulnerability scanning via Trivy, keyless Sigstore Cosign signing via OIDC tokens, SLSA Level 3 provenance generation. |
| [07](modules/07-deployments-environments-and-gitops-handoff.md) | Continuous Deployment Mechanics: Environments, Resource Groups, Review Apps, GitOps Handoff, and Terraform Pipelines | Deployment environments, deployment targets, rollout protection via `resource_group`, ephemeral review apps with dynamic teardown, GitOps repository handoff automation, Terraform execution pipelines with state locking. |
| [08](modules/08-secrets-management-and-cloud-oidc.md) | Secrets Management and Keyless Cloud Federation: OIDC ID Tokens, AWS/GCP/Azure/Vault Auth, and GitLab Secrets Manager | JSON Web Tokens (`id_tokens`), OpenID Connect federation with AWS IAM, Google Cloud Workload Identity, Azure AD, HashiCorp Vault secrets engine, GitLab native Secrets Manager. |
| [09](modules/09-pipeline-performance-monorepos-and-operations.md) | Pipeline Performance, Monorepo Change Detection, Cost Economics, Debugging Hazards, and Version History | Monorepo change detection using git diff filters, runner queue time optimization, caching strategies, cost economics of runner concurrency, pipeline debugging with `gitlab-ci-local`, GitLab CI/CD version history and deprecations. |

### Out of Scope

- General Kubernetes cluster administration and custom resource development (covered in [Kubernetes Curriculum](../kubernetes/README.md)).
- Advanced service mesh traffic management and eBPF kernel packet manipulation (covered in [Networking Architecture](../../architecture/networking/README.md)).
- General programming language syntax and data structure design (covered in individual language tracks).

## Certifications & Exams

This track prepares engineers for the following examinations and professional roles:

1. **GitLab Certified CI/CD Associate**:
   - **Vendor**: GitLab Inc. / GitLab University (`https://university.gitlab.com/pages/certifications`).
   - **Target Version & Verified Date**: GitLab 19.x CI/CD architecture (Verified 2026-11-07).
   - **Status**: Active.
   - **Format**: 60 multiple-choice and scenario-based questions; 90 minutes; 70% passing threshold.
   - **Scope**: Pipeline composition, `.gitlab-ci.yml` syntax, rules, artifacts, runners, environments, and basic security scanning.
2. **CNCF Certified Kubernetes Security Specialist (CKS) - Supply Chain Security Domain (20%)**:
   - **Vendor**: Cloud Native Computing Foundation (CNCF) / The Linux Foundation (`https://www.cncf.io/certification/cks/`).
   - **Target Version & Verified Date**: Kubernetes 1.35+ and container supply-chain tooling (Verified 2026-11-07).
   - **Status**: Active.
   - **Format**: Hands-on practical exam in a live Kubernetes cluster; 2 hours; 67% passing threshold.
   - **Overlap with this track**: Module 06 covers container image vulnerability scanning, SBOM generation (Syft), cryptographic signing (Cosign), and SLSA provenance attestation, matching the CKS supply-chain security blueprint.
3. **Senior DevSecOps & Platform Engineering Interview Loop**:
   - Technical screening for senior infrastructure and platform engineering roles focusing on secure CI/CD orchestration, runner fleet scalability, ephemeral build security, and supply-chain attestation.

## Running the Examples

All examples and test suites in this track are fully executable and verified.

```bash
# Install toolchain and dependencies via mise
mise install
mise exec -- npm ci

# Run the test suite across all modules
mise exec -- npm test
```
