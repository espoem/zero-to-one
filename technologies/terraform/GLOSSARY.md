# Terraform & OpenTofu Glossary

| English Term | Czech Term | Definition & Context | Primary Reference |
| --- | --- | --- | --- |
| Declarative Infrastructure | Deklarativní infrastruktura | Describing the desired end state of infrastructure rather than sequential imperative commands. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Imperative Automation | Imperativní automatizace | Executing a procedural script of commands to provision or modify resources. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Desired State | Požadovaný stav | The configuration declaration specifying how resources should be configured. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Observed State | Pozorovaný stav | The actual configuration and attributes of infrastructure currently present in the real world. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Reconciliation Loop | Rekonciliační smyčka | The continuous or on-demand process of comparing desired state against observed state and applying diffs. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Directed Acyclic Graph (DAG) | Orientovaný acyklický graf (DAG) | A mathematical graph with directed edges and no cycles, used by Terraform to model resource dependencies. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Topological Sort | Topologické řazení | Linear ordering of vertices in a DAG such that every directed edge goes from earlier to later vertices. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Provider Plugin | Poskytovatel (plugin) | Out-of-process binary communicating over gRPC that translates generic Terraform actions to API calls. | [Module 01](modules/01-iac-and-terraform-model.md) |
| Idempotence / Idempotency | Idempotence | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) |
| HashiCorp Configuration Language (HCL) | Jazyk HCL | Domain-specific language created by HashiCorp designed to be human- and machine-readable. | [Module 02](modules/02-hcl-semantics-and-type-system.md) |
| Expression | Výraz | A snippet of HCL code that evaluates to a value (primitive, collection, or structural). | [Module 02](modules/02-hcl-semantics-and-type-system.md) |
| Unknown Value ("Known after apply") | Neznámá hodnota | A value whose exact content cannot be determined until the provider executes API calls during `apply`. | [Module 02](modules/02-hcl-semantics-and-type-system.md) |
| Dynamic Block | Dynamický blok | Construct in HCL used to generate repeating nested configuration blocks programmatically. | [Module 02](modules/02-hcl-semantics-and-type-system.md) |
| State File | Stavový soubor | JSON-formatted artifact maintaining the mapping between resource addresses and remote IDs. | [Module 06](modules/06-state-internals-and-backends.md) |
| State Lineage | Rodokmen stavu | Unique UUID assigned to a state file upon creation to prevent divergent state file overwrites. | [Module 06](modules/06-state-internals-and-backends.md) |
| State Locking | Zamykání stavu | Mechanism ensuring exclusive access to a remote state file during mutating operations. | [Module 06](modules/06-state-internals-and-backends.md) |
| Fencing Token | Ohraničující token (fencing token) | A monotonically increasing sequence number issued with each lock or lease acquisition; storage resources reject writes carrying a token lower than the highest token already observed. | Kleppmann (Designing Data-Intensive Applications) |
| Lease | Pronájem (lease) | A time-bounded grant of authority or lock ownership that expires automatically after a fixed time-to-live unless renewed by the holder. | Gray & Cheriton (SOSP 1989) |
| State Drift | Drift stavu | Discrepancy between the recorded state/desired config and actual real-world infrastructure. | [Module 06](modules/06-state-internals-and-backends.md) |
| Dependency Lock File | Soubor zámků závislostí (`.terraform.lock.hcl`) | File recording cryptographic checksums of provider packages to guarantee reproducible installs. | [Module 03](modules/03-core-workflow-and-cli.md) |
| Refresh-Only Plan | Plán pouze pro obnovení | Execution mode updating state to match reality without proposing infrastructure mutations. | [Module 03](modules/03-core-workflow-and-cli.md) |
| Resource Address | Adresa zdroje | Canonical identifier for a resource instance in state (e.g., `aws_instance.web[0]`). | [Module 04](modules/04-providers-resources-and-lifecycle.md) |
| Data Source | Zdroj dat | Mechanism allowing Terraform to read external or existing infrastructure attributes without managing them. | [Module 04](modules/04-providers-resources-and-lifecycle.md) |
| Meta-Argument | Meta-argument | Built-in configuration keywords (`count`, `for_each`, `depends_on`, `lifecycle`) controlling resource behavior. | [Module 04](modules/04-providers-resources-and-lifecycle.md) |
| Precondition | Prekondice | Custom validation rule evaluated prior to planning or applying a resource. | [Module 05](modules/05-variables-outputs-validation-and-secrets.md) |
| Postcondition | Postkondice | Custom validation rule verified after a resource has been created or modified. | [Module 05](modules/05-variables-outputs-validation-and-secrets.md) |
| Sensitive Data | Citlivá data | Attributes marked to prevent redaction in standard CLI output logs. | [Module 05](modules/05-variables-outputs-validation-and-secrets.md) |
| Ephemeral Value | Efemérní hodnota | Short-lived value that exists only in memory during execution and is never persisted to state. | [Module 05](modules/05-variables-outputs-validation-and-secrets.md) |
| Write-Only Argument | Argument pouze pro zápis | Attribute that can be sent to an API provider but cannot be read back into state. | [Module 05](modules/05-variables-outputs-validation-and-secrets.md) |
| Module Composition | Kompozice modulů | Architectural pattern of combining smaller, focused modules into complex architectures. | [Module 07](modules/07-module-design-and-composition.md) |
| Refactoring Block (`moved`) | Refaktoringový blok (`moved`) | Declarative statement instructing Terraform to rename or relocate resource addresses without destroying them. | [Module 07](modules/07-module-design-and-composition.md) |
| Removal Block (`removed`) | Blok odstranění (`removed`) | Declarative statement indicating a resource is dropped from configuration and optionally destroyed. | [Module 09](modules/09-import-refactoring-and-drift.md) |
| Import Block (`import`) | Blok importu (`import`) | Declarative statement linking existing unmanaged infrastructure into Terraform state. | [Module 09](modules/09-import-refactoring-and-drift.md) |
| Policy-as-Code | Politika jako kód | Expressing operational, security, and compliance guardrails in machine-readable policy languages. | [Module 08](modules/08-testing-and-policy-as-code.md) |
| Open Policy Agent (OPA) | OPA / Rego | General-purpose policy engine using Rego language to evaluate structured JSON plans. | [Module 08](modules/08-testing-and-policy-as-code.md) |
| Common Expression Language (CEL) | CEL | Lightweight expression language designed for safety and speed in policy enforcement. | [Module 08](modules/08-testing-and-policy-as-code.md) |
| Blast Radius | Rádius dopadu | The extent of potential damage or affected infrastructure if a change fails or is misconfigured. | [Module 12](modules/12-production-architecture-and-opentofu.md) |
| Business Source License (BSL) | Licence BSL | Source-available license restricting commercial hosting of Terraform as a managed service. | [Module 12](modules/12-production-architecture-and-opentofu.md) |
| OpenTofu | OpenTofu | Open-source fork of Terraform under Mozilla Public License 2.0 governed by the CNCF. | [Module 12](modules/12-production-architecture-and-opentofu.md) |
| Acceptance Testing (`TF_ACC`) | Akceptační testování (`TF_ACC`) | Integration test suite executing real API calls against mock or sandbox cloud endpoints for providers. | [Module 11](modules/11-provider-internals-and-plugin-framework.md) |
