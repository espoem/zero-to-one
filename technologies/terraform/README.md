# Terraform & OpenTofu Engineering Curriculum

Verified against Terraform 1.16.7 / 1.17.0, OpenTofu 1.13.2, tflint 0.65.0, Conftest 0.71.1, Node 26.13.0, TypeScript 7.0.2 on 2026-11-07.

## Curriculum Overview & Prerequisites

This track provides a comprehensive, rigorous curriculum on Infrastructure as Code (IaC), HashiCorp Configuration Language (HCL), state management, provider architecture, module design, testing, policy-as-code, and production multi-environment orchestration using Terraform and OpenTofu.

### Prerequisites

Before diving into this track, you should be familiar with:

- [Distributed Systems Core](../../architecture/distributed-systems/README.md): Consensus, state machines, locking primitives, and replication.
- [Networking & Protocols](../../architecture/networking/README.md): TCP/IP, DNS, TLS, and HTTP APIs.
- [Security & Identity](../../architecture/security-identity/README.md): Secrets management, IAM policies, PKI, and encryption at rest.
- [Algorithms & Data Structures](../../algorithms/dsa/README.md): Directed acyclic graphs (DAGs), topological sorting, and dependency resolution.

## Syllabus

| Module | Title | Core Topics |
| --- | --- | --- |
| [01-iac-and-terraform-model](modules/01-iac-and-terraform-model.md) | IaC & Terraform Model | Declarative vs. imperative, desired state reconciliation, DAG planning, provider plugins (gRPC). |
| [02-hcl-semantics-and-type-system](modules/02-hcl-semantics-and-type-system.md) | HCL Semantics & Types | Blocks, attributes, type constraints, collection/structural types, `dynamic` blocks, unknowns. |
| [03-core-workflow-and-cli](modules/03-core-workflow-and-cli.md) | Core Workflow & CLI | `init`, lock files (`.terraform.lock.hcl`), `plan` refresh modes, `apply`, `destroy`, `TF_LOG`. |
| [04-providers-resources-and-lifecycle](modules/04-providers-resources-and-lifecycle.md) | Providers, Resources & Lifecycle | Version constraints, aliases, resource vs. data sources, meta-arguments, `lifecycle` blocks. |
| [05-variables-outputs-validation-and-secrets](modules/05-variables-outputs-validation-and-secrets.md) | Variables, Validation & Secrets | Custom conditions, preconditions/postconditions, `sensitive`, ephemeral values, write-only args. |
| [06-state-internals-and-backends](modules/06-state-internals-and-backends.md) | State Internals & Backends | State file format, lineage, remote backends (S3, GCS), locking (`use_lockfile`), state surgery. |
| [07-module-design-and-composition](modules/07-module-design-and-composition.md) | Module Design & Composition | Module structure, inputs/outputs, variable scope, OCI/git sources, refactoring with `moved`. |
| [08-testing-and-policy-as-code](modules/08-testing-and-policy-as-code.md) | Testing & Policy-as-Code | `terraform test`, mock providers, OPA/Rego, CEL, Kyverno, Terraform Policy GA. _(Shared Policy-as-Code curriculum)_ |
| [09-import-refactoring-and-drift](modules/09-import-refactoring-and-drift.md) | Import, Refactoring & Drift | `import` blocks with config generation, `removed` blocks, `terraform query`, drift remediation. |
| [10-hcp-terraform-and-ci-workflows](modules/10-hcp-terraform-and-ci-workflows.md) | HCP Terraform & CI Workflows | Workspaces, projects, remote runs, variable sets, Atlantis, GitLab-managed state/OpenTofu CI. |
| [11-provider-internals-and-plugin-framework](modules/11-provider-internals-and-plugin-framework.md) | Provider Internals & Plugin Framework | gRPC protocol, plugin framework, schema definitions, plan modifiers, CRUD operations, `TF_ACC`. |
| [12-production-architecture-and-opentofu](modules/12-production-architecture-and-opentofu.md) | Production Architecture & OpenTofu | Blast radius, state layout, BSL licensing, OpenTofu 1.13 feature parity (state encryption, provider-defined functions). |

### Out of Scope

- Specific cloud provider service internals (AWS IAM internal state machine, GCP VPC routing hardware) — see respective cloud tracks.
- Kubernetes workload deployment (Helm charts, Kubernetes manifests) — owned by `technologies/kubernetes` and `technologies/argocd`.

## Certifications & Exams

This track prepares you for the following official certifications:

1. **HashiCorp Certified: Terraform Associate (004)**:
   - **Status**: Active (Exam 003 retired on 2026-01-08).
   - **Target Version**: Terraform 1.12 (with exam-delta notes covering 1.16/1.17 and OpenTofu 1.13 features taught in this track).
   - **Format**: 57 questions (multiple choice, multiple select, true/false, text match), 60 minutes.
   - **Official Guide**: [HashiCorp Terraform Associate (004) Exam Guide](https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004).
2. **HashiCorp Certified: Terraform Authoring and Operations Professional**:
   - **Status**: Active.
   - **Format**: Performance-based hands-on lab environment coupled with advanced multiple-choice scenarios.

## Running the Examples & Tests

```bash
# Install toolchain via mise
mise install

# Install npm dependencies
mise exec -- npm ci

# Run hermetic TypeScript unit tests
mise exec -- npm test

# Run integration tests (requires Docker / local backend binaries)
mise exec -- npm run test:integration
```
