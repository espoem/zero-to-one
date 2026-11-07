# Exam Coverage & Preparation: GitLab CI/CD, Runners, and Supply-Chain Security

This document details the examination framework, domain weights, version deltas, and syllabus mapping for the **GitLab CI/CD, Runners, and Software Supply-Chain Security** curriculum.

## Exam Status Table

| Exam | Vendor / Standard | Target Version | Status | Passing Score | Format |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **GitLab Certified CI/CD Associate** | GitLab Inc. | GitLab 19.x | Active | 70% | 60 Multiple-Choice / Scenario Questions (90 mins) |
| **CKS Supply-Chain Security Domain** | CNCF / Linux Foundation | Kubernetes 1.35+ / Container Tooling | Active | 67% | Hands-on Practical Cluster Tasks (2 hours total) |
| **Senior DevSecOps Interview Loop** | Industry Standard | Current Stable Stacks | Active | Hire / No Hire | Live System Architecture & CI/CD Debugging |

## Exam Delta Callouts

- **GitLab 19 CI/CD Components (`spec:inputs`)**: Older GitLab versions (pre-16.8) relied on raw `include:project` templates with fragile global variables. GitLab 19 mandates strict typed inputs via `spec:inputs` and the CI/CD Catalog.
- **Keyless OIDC Authentication (`id_tokens`)**: The legacy `CI_JOB_JWT` and `CI_JOB_JWT_V2` tokens have been removed or deprecated in favor of cryptographically scoped `id_tokens` with custom audience (`aud`) bindings.
- **Docker Autoscaler Runner (`docker-autoscaler`)**: The deprecated `docker-machine` executor has been fully removed in GitLab Runner 17/19 in favor of the cloud-native `docker-autoscaler` executor using custom driver scaling.
- **OpenBao / HashiCorp Vault Secrets**: Traditional file-based secret injection has been superseded by dynamic OIDC integration and native Secrets Manager vault providers.

## Domain → Module Coverage Matrix

Every domain objective mapped in this curriculum is fully covered by the core modules and executable TypeScript test suites:

| Domain | Official Weight | Target Questions | Covered Modules | Covered Test Files | Status |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **D1: CI/CD Fundamentals, DORA Metrics & GitLab Pipeline DAG Architecture** | 18% | 12 Qs | Modules 01, 02 | `examples/ts/01-cicd-fundamentals-and-dora.test.ts`, `examples/ts/02-gitlab-ci-execution-model-and-dag.test.ts` | ✅ Full |
| **D2: Pipeline Composition, CI/CD Components (`spec:inputs`) & Dynamic Child Pipelines** | 16% | 10 Qs | Module 03 | `examples/ts/03-pipeline-reuse-components-and-child-pipelines.test.ts` | ✅ Full |
| **D3: GitLab Runner Architecture, Executors, Autoscaling & Rootless Image Builds** | 16% | 10 Qs | Module 04 | `examples/ts/04-runners-executors-and-container-builds.test.ts` | ✅ Full |
| **D4: Quality Gates, Matrix Parallelism, Flaky Tests & Merge Trains** | 14% | 9 Qs | Module 05 | `examples/ts/05-testing-quality-gates-and-merge-trains.test.ts` | ✅ Full |
| **D5: Software Supply-Chain Security: SBOMs, Keyless Cosign v3 Signing & SLSA Provenance** | 20% | 13 Qs | Module 06 | `examples/ts/06-supply-chain-security-sbom-cosign-slsa.test.ts` | ✅ Full |
| **D6: Continuous Deployment, Cloud OIDC Federation, Secrets & Monorepo Performance** | 16% | 11 Qs | Modules 07, 08, 09 | `examples/ts/07-deployments-environments-and-gitops-handoff.test.ts`, `examples/ts/08-secrets-management-and-cloud-oidc.test.ts`, `examples/ts/09-pipeline-performance-monorepos-and-operations.test.ts` | ✅ Full |
