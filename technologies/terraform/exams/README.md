# Terraform Exams & Certification Guide

This document provides certification coverage details, exam guidance, and preparation resources for the Terraform track.

## 1. Exam Status & Metadata

| Exam / Certification | Vendor | Target Version | Status | Domains Covered | Passing Score |
| --- | --- | --- | --- | --- | --- |
| **HashiCorp Certified: Terraform Associate (004)** | HashiCorp / IBM | Terraform 1.12 (with 1.16/1.17 + OpenTofu 1.13 deltas) | Active | D1–D8 (All 8 domains fully covered) | ~70% (40/57 real exam, 46/65 mock bank) |
| **HashiCorp Certified: Terraform Authoring and Operations Professional** | HashiCorp / IBM | Terraform 1.12+ | Active | Advanced authoring, modules, state operations, troubleshooting | Performance lab + MC |

## 2. Terraform Associate (004) Domain Coverage Matrix

The table below maps each official domain and objective of the HashiCorp Certified: Terraform Associate (004) exam to the curriculum modules, executable test suites, question counts, and coverage status.

| Domain | Official Objective & Focus | Weight / Qs | Mapped Modules | Covered Examples & Test Suites | Status |
| --- | --- | --- | --- | --- | --- |
| D1 | Understand Infrastructure as Code (IaC) with Terraform | 12% / 8 Qs | [Module 01](../modules/01-iac-and-terraform-model.md) | [`01-iac-and-terraform-model.test.ts`](../examples/ts/01-iac-and-terraform-model.test.ts) | ✅ Full |
| D2 | Understand the purpose of Terraform & Fundamentals (Providers, State) | 12% / 8 Qs | [Modules 01](../modules/01-iac-and-terraform-model.md), [03](../modules/03-core-workflow-and-cli.md), [04](../modules/04-providers-resources-and-lifecycle.md) | [`01-*`](../examples/ts/01-iac-and-terraform-model.test.ts), [`03-*`](../examples/ts/03-core-workflow-and-cli.test.ts), [`04-*`](../examples/ts/04-providers-resources-and-lifecycle.test.ts) | ✅ Full |
| D3 | Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) | 12% / 8 Qs | [Module 03](../modules/03-core-workflow-and-cli.md) | [`03-core-workflow-and-cli.test.ts`](../examples/ts/03-core-workflow-and-cli.test.ts) | ✅ Full |
| D4 | Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) | 19% / 12 Qs | [Modules 02](../modules/02-hcl-semantics-and-type-system.md), [04](../modules/04-providers-resources-and-lifecycle.md), [05](../modules/05-variables-outputs-validation-and-secrets.md) | [`02-*`](../examples/ts/02-hcl-semantics-and-type-system.test.ts), [`04-*`](../examples/ts/04-providers-resources-and-lifecycle.test.ts), [`05-*`](../examples/ts/05-variables-outputs-validation-and-secrets.test.ts) | ✅ Full |
| D5 | Interact with Terraform Modules (sources, scope, versions, design) | 12% / 8 Qs | [Module 07](../modules/07-module-design-and-composition.md) | [`07-module-design-and-composition.test.ts`](../examples/ts/07-module-design-and-composition.test.ts) | ✅ Full |
| D6 | Navigate Terraform State Management (backends, locking, drift, security) | 12% / 8 Qs | [Module 06](../modules/06-state-internals-and-backends.md) | [`06-state-internals-and-backends.test.ts`](../examples/ts/06-state-internals-and-backends.test.ts) | ✅ Full |
| D7 | Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) | 10% / 6 Qs | [Modules 08](../modules/08-testing-and-policy-as-code.md), [09](../modules/09-import-refactoring-and-drift.md), [11](../modules/11-provider-internals-and-plugin-framework.md) | [`08-*`](../examples/ts/08-testing-and-policy-as-code.test.ts), [`09-*`](../examples/ts/09-import-refactoring-and-drift.test.ts), [`11-*`](../examples/ts/11-provider-internals-and-plugin-framework.test.ts) | ✅ Full |
| D8 | Understand HCP Terraform capabilities & Production/OpenTofu workflows | 11% / 7 Qs | [Modules 10](../modules/10-hcp-terraform-and-ci-workflows.md), [12](../modules/12-production-architecture-and-opentofu.md) | [`10-*`](../examples/ts/10-hcp-terraform-and-ci-workflows.test.ts), [`12-*`](../examples/ts/12-production-architecture-and-opentofu.test.ts) | ✅ Full |
| **Total** | **All 8 Associate 004 Exam Domains** | **100% / 65 Qs** | **Modules 01–12** | **57 hermetic TS tests + integration suite** | **✅ Full** |

All 8 official domains are fully covered with zero gaps (0 ❌, 0 🟡).

## 3. Exam Delta Notes (Terraform 1.12 vs. 1.16/1.17 & OpenTofu 1.13)

- **Lifecycle `destroy = false`**: Terraform 1.16 introduced `lifecycle { destroy = false }` as a native alternative to `prevent_destroy` when managing resource decommissioning.
- **`import` and `removed` blocks**: Modern Terraform and OpenTofu support declarative `import` and `removed` blocks in configuration files rather than relying solely on imperative CLI commands.
- **State Encryption**: OpenTofu 1.13 supports native client-side state encryption at rest, whereas Terraform relies on backend-native encryption (e.g., S3 SSE, KMS).
- **Terraform Policy GA**: Terraform 1.17 introduced general availability for native policy checking (`-policies` flag on plan/apply).
- **Ephemeral Values & Write-Only Arguments**: Terraform 1.10+ introduced `ephemeral` variables and write-only arguments to prevent secrets from persisting to `.tfstate`.

## 4. Exam Preparation Question Banks

- [Terraform Associate (004) Question Bank & Mock Exam](terraform-associate-004.md): 65 original questions covering D1 through D8 with detailed explanations, distractor rationales, module links, scoring keys, and a full mock exam.
