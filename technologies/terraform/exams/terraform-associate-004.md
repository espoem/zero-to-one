# Terraform Associate (004) Exam Coverage & Question Bank

This document maps the HashiCorp Certified: Terraform Associate (004) exam domains to the curriculum modules in `technologies/terraform` and provides a comprehensive question bank of 65 original questions.

## Exam Status & Metadata

- **Exam Code**: HashiCorp Certified: Terraform Associate (004)
- **Target Version**: Terraform 1.12 (with exam-delta notes covering Terraform 1.16/1.17 and OpenTofu 1.13 features taught in this track).
- **Exam Format**: 57 questions, 60 minutes, passing score ~70%.
- **Official Guide**: [HashiCorp Terraform Associate (004) Exam Guide](https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004).

## Domain Coverage Matrix

HashiCorp does not publish official percentage weights on the public 004 review page. The table below uses estimated proportional weights totaling 100% (65 questions total, at least 5 questions per domain) ensuring 100% full coverage (`✅`) with zero gaps (`❌`) or partial items (`🟡`).

| Domain | Official Objective & Focus | Est. Weight / Qs | Mapped Modules | Covered Examples | Status |
| --- | --- | --- | --- | --- | --- |
| D1 | Understand Infrastructure as Code (IaC) with Terraform | 12% / 8 Qs | [Module 01](../modules/01-iac-and-terraform-model.md) | `examples/ts/01-*.test.ts` | ✅ Full |
| D2 | Understand the purpose of Terraform & Fundamentals (Providers, State) | 12% / 8 Qs | [Modules 01, 03, 04](../modules/01-iac-and-terraform-model.md) | `examples/ts/01-*.test.ts`, `03-*.test.ts`, `04-*.test.ts` | ✅ Full |
| D3 | Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) | 12% / 8 Qs | [Module 03](../modules/03-core-workflow-and-cli.md) | `examples/ts/03-*.test.ts` | ✅ Full |
| D4 | Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) | 19% / 12 Qs | [Modules 02, 04, 05](../modules/02-hcl-semantics-and-type-system.md) | `examples/ts/02-*.test.ts`, `04-*.test.ts`, `05-*.test.ts` | ✅ Full |
| D5 | Interact with Terraform Modules (sources, scope, versions, design) | 12% / 8 Qs | [Module 07](../modules/07-module-design-and-composition.md) | `examples/ts/07-*.test.ts` | ✅ Full |
| D6 | Navigate Terraform State Management (backends, locking, drift, security) | 12% / 8 Qs | [Module 06](../modules/06-state-internals-and-backends.md) | `examples/ts/06-*.test.ts` | ✅ Full |
| D7 | Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) | 10% / 6 Qs | [Modules 08, 09, 11](../modules/08-testing-and-policy-as-code.md) | `examples/ts/08-*.test.ts`, `09-*.test.ts`, `11-*.test.ts` | ✅ Full |
| D8 | Understand HCP Terraform capabilities & Production/OpenTofu workflows | 11% / 7 Qs | [Modules 10, 12](../modules/10-hcp-terraform-and-ci-workflows.md) | `examples/ts/10-*.test.ts`, `12-*.test.ts` | ✅ Full |

## Exam Delta Notes (Terraform 1.12 vs. 1.16/1.17 & OpenTofu 1.13)

- **Lifecycle `destroy = false`**: Terraform 1.16 introduced `lifecycle { destroy = false }` as a native alternative to `prevent_destroy` when managing resource decommissioning.
- **`import` and `removed` blocks**: Modern Terraform and OpenTofu support declarative `import` and `removed` blocks in configuration files rather than relying solely on imperative CLI commands.
- **State Encryption**: OpenTofu 1.13 supports native client-side state encryption at rest, whereas Terraform relies on backend-native encryption (e.g., S3 SSE, KMS).
- **Terraform Policy GA**: Terraform 1.17 introduced general availability for native policy checking (`-policies` flag on plan/apply).

## Question Bank (Q-TFA-001 through Q-TFA-065)

_(65 original questions covering D1 through D8, including single, multi, scenario, ordering, and hands-on tasks.)_

### Q-TFA-001 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 1 · single

What is the primary conceptual difference between imperative and declarative Infrastructure as Code (IaC)?

- A) Imperative IaC executes scripts on local virtual machines, whereas declarative IaC executes commands on remote cloud APIs.
- B) Declarative IaC defines the desired end state of infrastructure, leaving the orchestration engine to compute the transition diff, whereas imperative IaC specifies exact procedural steps to achieve that state.
- C) Imperative IaC is idempotent by default, whereas declarative IaC requires explicit error handling blocks.
- D) Declarative IaC cannot be used with public cloud providers like AWS or GCP.

<details><summary>Answer</summary>

**B.** Declarative IaC focuses on describing what the final infrastructure should look like, and the tooling computes the necessary changes, whereas imperative IaC requires writing explicit step-by-step procedural instructions.

- Why not A: Both imperative and declarative tools interact with remote cloud APIs.
- Why not C: Declarative IaC provides idempotence by design, whereas imperative scripts often lack idempotence unless carefully written.
- Why not D: Declarative tools are widely used across AWS, GCP, Azure, and other providers.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/intro/vs-chef-puppet

</details>

### Q-TFA-002 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 1 · single

How does Terraform model resource dependencies when generating an execution plan?

- A) As a sequential list executed strictly in the order resources appear in `.tf` files.
- B) As a Directed Acyclic Graph (DAG) derived from implicit references and explicit `depends_on` meta-arguments.
- C) As a relational database schema enforcing foreign key constraints.
- D) As a priority queue sorted alphabetically by resource name.

<details><summary>Answer</summary>

**B.** Terraform builds a Directed Acyclic Graph (DAG) from resource references and explicit dependencies to determine parallel execution order.

- Why not A: HCL file order does not dictate execution order.
- Why not C: Terraform state is not a relational database schema.
- Why not D: Alphabetical sorting is not used for execution scheduling.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/language/syntax/dependencies

</details>

### Q-TFA-003 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 2 · scenario

A DevOps engineer writes a Terraform configuration where `aws_instance.web` references `aws_subnet.subnet_a.id`. How does Terraform handle this relationship?

- A) It treats it as an explicit dependency requiring a `depends_on` block.
- B) It automatically infers an implicit dependency, ensuring `aws_subnet.subnet_a` is created before `aws_instance.web`.
- C) It creates both resources in parallel, causing a race condition in the cloud API.
- D) It ignores the relationship and prompts the user for manual graph ordering.

<details><summary>Answer</summary>

**B.** Attribute references automatically create an implicit dependency in Terraform's dependency graph.

- Why not A: `depends_on` is for explicit dependencies where attribute references are absent.
- Why not C: The dependency graph prevents race conditions by scheduling creation order.
- Why not D: Terraform automatically computes the graph without manual intervention.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/language/syntax/dependencies

</details>

### Q-TFA-004 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 2 · single

What architectural role do Terraform provider plugins play during execution?

- A) Providers compile HCL source code into native machine bytecode before execution.
- B) Providers act as out-of-process gRPC binaries that translate generic Terraform CRUD actions into specific cloud API calls.
- C) Providers store the encrypted state file in remote object storage.
- D) Providers manage the local workstation filesystem permissions for module downloads.

<details><summary>Answer</summary>

**B.** Providers are separate binaries communicating with core Terraform via gRPC to translate resource definitions into cloud API requests.

- Why not A: Terraform core evaluates HCL, not providers.
- Why not C: Backends store state files, not providers.
- Why not D: Filesystem permissions are managed by the operating system.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/plugin

</details>

### Q-TFA-005 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 1 · single

Which of the following best defines idempotence in the context of Terraform?

- A) Running `terraform apply` multiple times with identical configuration produces no changes after the initial creation.
- B) Running `terraform destroy` automatically backs up state to local disk.
- C) Terraform automatically rolls back cloud deployments if an API rate limit is hit.
- D) Configuration files can be written in any programming language.

<details><summary>Answer</summary>

**A.** Idempotence means applying the same desired state multiple times yields the same system state without redundant modifications.

- Why not B: Backup behavior depends on state backends and commands.
- Why not C: Rate limit handling involves retries, not automatic rollbacks of arbitrary cloud infra.
- Why not D: HCL is the primary configuration language.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/intro

</details>

### Q-TFA-006 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 2 · multi

Which characteristics distinguish Terraform from procedural configuration management tools like Ansible? (Select all that apply)

- A) Terraform focuses on declarative desired-state infrastructure provisioning.
- B) Terraform maintains a persistent state file mapping configuration to real-world resources.
- C) Terraform executes tasks as SSH-driven shell scripts on target nodes.
- D) Terraform builds a dependency graph before executing changes.

<details><summary>Answer</summary>

**A, B, D.** Terraform is declarative, maintains a state file, and builds a DAG.

- Why not C: Terraform uses cloud APIs rather than SSH shell scripts for provisioning infrastructure.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/intro/vs-chef-puppet

</details>

### Q-TFA-007 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 2 · single

How does Terraform handle multi-cloud deployments within a single configuration?

- A) It requires separate Terraform core binaries for each cloud provider.
- B) It allows multiple provider blocks to be declared, enabling resources from different clouds to be managed within the same DAG and state.
- C) It automatically translates AWS resource syntax into GCP equivalents.
- D) Multi-cloud deployments are prohibited by core licensing.

<details><summary>Answer</summary>

**B.** Terraform supports multiple provider configurations, allowing orchestration across AWS, Azure, GCP, and other services in a unified graph.

- Why not A: A single Terraform core binary handles multiple providers.
- Why not C: Terraform does not perform automatic cross-cloud syntax translation.
- Why not D: Multi-cloud is a core architectural strength.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/language/providers/configuration

</details>

### Q-TFA-008 · D1 Understand Infrastructure as Code (IaC) with Terraform · difficulty 3 · scenario

An organization evaluates Pulumi and Terraform. Which factor most strongly favors Terraform in enterprise adoption?

- A) Ability to write infrastructure in general-purpose programming languages like Python and TypeScript.
- B) Mature declarative HCL syntax, extensive provider ecosystem, and deterministic static plan execution.
- C) Built-in container runtime orchestration identical to Kubernetes.
- D) Zero state management overhead.

<details><summary>Answer</summary>

**B.** Terraform's strict declarative HCL, large provider ecosystem, and predictable plan phase are key enterprise differentiators.

- Why not A: Pulumi uses general-purpose languages, whereas Terraform uses HCL.
- Why not C: Terraform is not a container runtime orchestrator.
- Why not D: Terraform relies heavily on state management.
- Ref: [modules/01-iac-and-terraform-model.md](../modules/01-iac-and-terraform-model.md), https://developer.hashicorp.com/terraform/intro/vs-pulumi

</details>

### Q-TFA-009 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 1 · single

What is the primary function of a Terraform Provider?

- A) To store the state file in a remote S3 bucket.
- B) To authenticate with a target platform and translate resource CRUD operations into API requests.
- C) To validate HCL syntax during `terraform validate`.
- D) To execute local shell commands after resource creation.

<details><summary>Answer</summary>

**B.** Providers encapsulate API interactions for specific platforms (AWS, GitHub, Kubernetes, etc.).

- Why not A: Backends store state, not providers.
- Why not C: Terraform core handles syntax validation.
- Why not D: Local shell execution is handled by provisioners, not providers.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/providers

</details>

### Q-TFA-010 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 2 · single

Where does Terraform store the mapping between resource declarations in HCL and real-world IDs?

- A) In the local `.terraform` plugin directory.
- B) In the Terraform state file (`terraform.tfstate`).
- C) In the provider binary cache.
- D) Directly inside cloud provider metadata tags.

<details><summary>Answer</summary>

**B.** The state file (`terraform.tfstate`) maintains the mapping between HCL resource addresses and remote provider IDs.

- Why not A: The `.terraform` directory contains downloaded plugins and modules.
- Why not C: Provider caches hold plugin binaries.
- Why not D: Cloud tags are supplementary, not the primary state mapping.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/state

</details>

### Q-TFA-011 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 2 · scenario

If a teammate deletes `terraform.tfstate` from local disk while remote resources are still running in AWS, what happens on the next `terraform apply`?

- A) Terraform automatically recreates the state file by querying AWS APIs.
- B) Terraform attempts to recreate all resources defined in HCL, potentially resulting in duplicate resource errors.
- C) Terraform fails with a fatal syntax error and locks the AWS account.
- D) Terraform ignores missing state and continues normal operations.

<details><summary>Answer</summary>

**B.** Without state, Terraform treats all resources as non-existent and attempts to create them, leading to errors if cloud resources already exist.

- Why not A: Terraform does not automatically rebuild state from cloud APIs without explicit importing.
- Why not C: It is not a syntax error or account lock.
- Why not D: Operations fail or duplicate resources are created.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/state/purpose

</details>

### Q-TFA-012 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 2 · single

What is the purpose of the `.terraform.lock.hcl` file?

- A) To lock the remote state file against concurrent writes.
- B) To record cryptographic checksums of installed provider versions to guarantee reproducible builds.
- C) To store sensitive database passwords securely.
- D) To cache module source code from git repositories.

<details><summary>Answer</summary>

**B.** The dependency lock file records provider package hashes to ensure identical provider versions are installed across environments.

- Why not A: State locking is handled by backend locking mechanisms (e.g., S3 DynamoDB or native lockfiles).
- Why not C: Secrets should never be stored in lock files.
- Why not D: Module sources are cached in `.terraform/modules`.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/language/files/dependency-lock

</details>

### Q-TFA-013 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 3 · multi

Which mechanisms does Terraform use to prevent concurrent state modifications by multiple operators or CI pipelines? (Select all that apply)

- A) State locking via remote backends (e.g., S3 native lockfiles or DynamoDB).
- B) Operating system file locking on local state files.
- C) Automatic Git branch rebasing.
- D) Cryptographic token exchanges during `terraform init`.

<details><summary>Answer</summary>

**A, B.** Remote backends and local OS files use locking mechanisms to prevent concurrent state corruption.

- Why not C: Git branching does not lock Terraform state.
- Why not D: Token exchanges are for provider authentication, not state concurrency control.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/state/locking

</details>

### Q-TFA-014 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 2 · single

How does Terraform distinguish between a resource that needs creation and one that already exists?

- A) By inspecting environment variables set in the shell.
- B) By comparing HCL configuration against records stored in the state file.
- C) By checking git commit hashes.
- D) By pinging IP addresses on the local network.

<details><summary>Answer</summary>

**B.** Terraform compares desired configuration against recorded state to identify additions, modifications, and deletions.

- Why not A, C, D: These do not determine resource existence in Terraform state.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/state

</details>

### Q-TFA-015 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 2 · single

What is a provider alias used for?

- A) To rename a resource address in state without destroying it.
- B) To configure multiple instances of the same provider with different parameters (e.g., different AWS regions).
- C) To create shorthand aliases for HCL functions.
- D) To alias sensitive variables as environment variables.

<details><summary>Answer</summary>

**B.** Provider aliases allow configuring multiple provider instances, such as managing resources across multiple AWS regions simultaneously.

- Why not A: Resource renaming is handled by `moved` blocks.
- Why not C, D: Aliases apply to provider configurations.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/providers/configuration#alias-multiple-provider-configurations

</details>

### Q-TFA-016 · D2 Understand the purpose of Terraform & Fundamentals (Providers, State) · difficulty 3 · scenario

An engineer configures an AWS provider with an alias `aws.us_east_1`. How must a resource specify that it should use this provider configuration?

- A) Using `provider_alias = aws.us_east_1`
- B) Using the `provider = aws.us_east_1` meta-argument inside the resource block.
- C) By setting the `AWS_DEFAULT_REGION` environment variable.
- D) By placing the resource in a subdirectory named `us_east_1`.

<details><summary>Answer</summary>

**B.** Resources select aliased providers using the `provider = <provider_name>.<alias>` meta-argument.

- Why not A: `provider_alias` is not a valid meta-argument.
- Why not C: Environment variables configure default providers, but aliased providers require explicit meta-arguments.
- Why not D: Subdirectory structure does not select provider aliases.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/providers/configuration#alias-multiple-provider-configurations

</details>

### Q-TFA-017 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 1 · single

Which Terraform CLI command initializes a working directory by downloading providers and modules?

- A) `terraform plan`
- B) `terraform init`
- C) `terraform validate`
- D) `terraform apply`

<details><summary>Answer</summary>

**B.** `terraform init` initializes the backend, downloads required providers and modules, and generates the lock file.

- Why not A, C, D: These commands assume an initialized working directory.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/cli/commands/init

</details>

### Q-TFA-018 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 1 · single

What does `terraform validate` check?

- A) Syntax correctness and internal consistency of configuration files without contacting provider APIs.
- B) Live cloud API credentials and network connectivity.
- C) Whether remote state files are locked.
- D) Formatting style against canonical HCL standards.

<details><summary>Answer</summary>

**A.** `terraform validate` checks syntax and internal consistency offline without making provider API calls.

- Why not B: Validation does not contact remote APIs.
- Why not C: State locking is checked during plan/apply.
- Why not D: Formatting is checked and applied by `terraform fmt`.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/cli/commands/validate

</details>

### Q-TFA-019 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 2 · scenario

An auditor requires that CI/CD pipelines review an exact execution plan before applying changes. Which workflow satisfies this requirement?

- A) Run `terraform apply -auto-approve` directly in production.
- B) Run `terraform plan -out=tfplan`, review the plan artifact, and subsequently run `terraform apply tfplan`.
- C) Run `terraform validate` followed immediately by `terraform apply`.
- D) Run `terraform refresh` before every apply.

<details><summary>Answer</summary>

**B.** Saving a plan file with `-out=tfplan` and applying that exact file ensures the applied infrastructure matches the reviewed plan.

- Why not A: `-auto-approve` bypasses interactive review.
- Why not C: `validate` does not generate an execution plan.
- Why not D: `refresh` alone does not guarantee plan immutability.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/cli/commands/plan

</details>

### Q-TFA-020 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 2 · single

What is the purpose of `terraform fmt`?

- A) To format HCL configuration files to a canonical style standard.
- B) To format remote state JSON files.
- C) To format provider documentation.
- D) To clean up unused plugin binaries.

<details><summary>Answer</summary>

**A.** `terraform fmt` automatically formats HCL configuration files to canonical styling.

- Why not B, C, D: It formats configuration files.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/cli/commands/fmt

</details>

### Q-TFA-021 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 2 · single

How can an operator generate a plan that updates state to match reality without proposing any changes to infrastructure?

- A) `terraform plan -destroy`
- B) `terraform plan -refresh-only`
- C) `terraform plan -no-color`
- D) `terraform plan -parallelism=1`

<details><summary>Answer</summary>

**B.** `-refresh-only` inspects real-world infrastructure and updates state to match without modifying actual resources.

- Why not A: `-destroy` proposes destroying all resources.
- Why not C, D: These control formatting and execution parallelism.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/cli/commands/plan#refresh-only-mode

</details>

### Q-TFA-022 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 3 · scenario

A Terraform apply fails midway due to a network timeout. How can verbose logging be enabled for troubleshooting provider API interactions?

- A) Set the environment variable `TF_LOG=DEBUG`.
- B) Run `terraform apply --verbose`.
- C) Edit `.terraformrc` to enable debug mode.
- D) Pass `-debug` to `terraform init`.

<details><summary>Answer</summary>

**A.** Setting `TF_LOG=DEBUG` (or `TRACE`) enables detailed logging of Terraform core and provider execution.

- Why not B: `--verbose` is not a valid flag.
- Why not C, D: Environment variables (`TF_LOG`) are the standard mechanism for debug logging.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/internals/debugging

</details>

### Q-TFA-023 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 2 · single

What does `terraform destroy` accomplish?

- A) It deletes local configuration files from disk.
- B) It removes all remote infrastructure managed by the given configuration and clears state resource records.
- C) It deletes the remote backend S3 bucket itself.
- D) It purges downloaded provider plugins from the plugin cache.

<details><summary>Answer</summary>

**B.** `terraform destroy` tears down all resources managed by the configuration according to dependency order.

- Why not A: Local files remain on disk.
- Why not C: Backends are generally managed outside the workspace configuration.
- Why not D: Provider plugins remain in `.terraform`.
- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/cli/commands/destroy

</details>

### Q-TFA-024 · D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) · difficulty 3 · ordering

Order the standard Terraform execution workflow steps chronologically:

1. `terraform init`
2. `terraform validate`
3. `terraform plan`
4. `terraform apply`

- A) 1 -> 2 -> 3 -> 4
- B) 4 -> 3 -> 2 -> 1
- C) 2 -> 1 -> 4 -> 3
- D) 1 -> 3 -> 2 -> 4

<details><summary>Answer</summary>

**A.** Initialize the workspace, validate configuration syntax, generate an execution plan, and apply changes.

- Ref: [modules/03-core-workflow-and-cli.md](../modules/03-core-workflow-and-cli.md), https://developer.hashicorp.com/terraform/cli

</details>

### Q-TFA-025 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 1 · single

What is the distinction between a `resource` block and a `data` source block in Terraform?

- A) Resources manage infrastructure lifecycle (create, read, update, delete), whereas data sources only read existing infrastructure attributes.
- B) Data sources create infrastructure, whereas resources read it.
- C) Resources are written in JSON, whereas data sources use HCL.
- D) Data sources require a remote backend, whereas resources can use local state.

<details><summary>Answer</summary>

**A.** Resources manage the full lifecycle of infrastructure objects, whereas data sources fetch read-only information from providers.

- Why not B: Reversed definitions.
- Why not C: Both use HCL.
- Why not D: Both rely on state and providers.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/data-sources

</details>

### Q-TFA-026 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 2 · single

What is the primary risk of using `count` over a list of resources when elements are removed from the middle of the list?

- A) Terraform throws a syntax validation error.
- B) Index shifting causes Terraform to destroy and recreate all subsequent resources in the list, disrupting services.
- C) State file encryption keys become invalid.
- D) Provider plugins fail to download.

<details><summary>Answer</summary>

**B.** `count` indexes instances numerically (`0`, `1`, `2`). Removing an element from index `1` shifts index `2` to `1`, prompting Terraform to destroy and recreate resources.

- Why not A, C, D: These are unrelated to `count` index shifting.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/meta-arguments/count

</details>

### Q-TFA-027 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 2 · scenario

To avoid index-shifting destruction when managing collections of resources, which meta-argument should be used instead of `count`?

- A) `depends_on`
- B) `for_each`
- C) `lifecycle`
- D) `provider`

<details><summary>Answer</summary>

**B.** `for_each` keys resource instances by unique map keys or set values rather than positional integers, preventing index shifting.

- Why not A, C, D: These serve other meta-argument functions.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/meta-arguments/for_each

</details>

### Q-TFA-028 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 2 · single

What does setting `lifecycle { create_before_destroy = true }` achieve?

- A) It prevents the resource from ever being destroyed.
- B) It creates the replacement resource before destroying the old one, minimizing downtime during updates.
- C) It destroys all dependent resources prior to creation.
- D) It caches resource attributes in local memory.

<details><summary>Answer</summary>

**B.** `create_before_destroy` ensures replacement resources are instantiated before old ones are decommissioned.

- Why not A: `prevent_destroy` prevents destruction.
- Why not C, D: Unrelated to lifecycle ordering.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle#create_before_destroy

</details>

### Q-TFA-029 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 3 · scenario

An engineer wants to prevent a production database instance from being accidentally destroyed via `terraform destroy`. Which lifecycle rule should be applied?

- A) `create_before_destroy = true`
- B) `prevent_destroy = true`
- C) `ignore_changes = all`
- D) `destroy = false`

<details><summary>Answer</summary>

**B.** `prevent_destroy = true` causes Terraform to reject any plan that attempts to destroy the resource.

- Why not A: `create_before_destroy` changes replacement order, not prevent destruction.
- Why not C: `ignore_changes` ignores drift.
- Why not D: `destroy = false` (Terraform 1.16+) applies when configuration blocks are removed, but `prevent_destroy` blocks explicit destruction.
- Ref: [modules/04-providers-resources-and-lifecycle.md](../modules/04-providers-resources-and-lifecycle.md), https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle#prevent_destroy

</details>

### Q-TFA-030 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 3 · multi

Which types of custom validation and condition checks are supported in modern Terraform configurations? (Select all that apply)

- A) Input variable `validation` blocks with custom error messages.
- B) Resource `precondition` blocks verifying attributes before planning or applying.
- C) Resource `postcondition` blocks verifying attributes after resource creation/modification.
- D) Automatic runtime kernel patching.

<details><summary>Answer</summary>

**A, B, C.** Terraform supports variable validation rules, resource preconditions, and resource postconditions.

- Why not D: Kernel patching is outside Terraform's scope.
- Ref: [modules/05-variables-outputs-validation-and-secrets.md](../modules/05-variables-outputs-validation-and-secrets.md), https://developer.hashicorp.com/terraform/language/expressions/custom-conditions

</details>

### Q-TFA-031 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 2 · single

What is the purpose of marking an input variable or output as `sensitive = true`?

- A) It encrypts the value at rest in remote S3 storage using KMS keys.
- B) It redacts the value in standard CLI output logs to prevent accidental exposure during execution plans.
- C) It prevents anyone from reading the state file.
- D) It forces the variable value to be stored as an environment variable.

<details><summary>Answer</summary>

**B.** `sensitive = true` instructs Terraform CLI to redact values in plan and apply output logs. Note that values remain in plaintext in the state file.

- Why not A: State encryption is handled by backends or OpenTofu native encryption.
- Why not C: State access permissions are managed by backend IAM policies.
- Why not D: Variables are passed via tfvars or CLI flags.
- Ref: [modules/05-variables-outputs-validation-and-secrets.md](../modules/05-variables-outputs-validation-and-secrets.md), https://developer.hashicorp.com/terraform/language/values/variables#sensitivedata

</details>

### Q-TFA-032 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 3 · single

How do `ephemeral` values and write-only arguments improve security compared to traditional `sensitive` variables?

- A) They ensure secrets exist only in memory during execution and are never written to the persistent state file.
- B) They automatically rotate passwords every 24 hours.
- C) They compile HCL into machine bytecode.
- D) They bypass provider API authentication requirements.

<details><summary>Answer</summary>

**A.** Ephemeral values and write-only arguments prevent sensitive secrets from being persisted in the state file.

- Why not B, C, D: Unrelated to ephemeral secret handling.
- Ref: [modules/05-variables-outputs-validation-and-secrets.md](../modules/05-variables-outputs-validation-and-secrets.md), https://developer.hashicorp.com/terraform/language/resources/ephemeral

</details>

### Q-TFA-033 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 2 · single

What does the `dynamic` block construct enable in HCL?

- A) Dynamic cloud provider switching during execution.
- B) Programmatic generation of repeating nested configuration blocks (e.g., ingress rules) from collections or maps.
- C) Automatic scaling of compute instances based on CPU utilization.
- D) Dynamic reloading of state files without running `init`.

<details><summary>Answer</summary>

**B.** `dynamic` blocks allow generating repeated nested blocks (like security group rules or IAM policy statements) using for-expressions.

- Why not A, C, D: Unrelated to `dynamic` configuration blocks.
- Ref: [modules/02-hcl-semantics-and-type-system.md](../modules/02-hcl-semantics-and-type-system.md), https://developer.hashicorp.com/terraform/language/expressions/dynamic-blocks

</details>

### Q-TFA-034 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 2 · single

What is an "unknown value" (or "known after apply") in Terraform?

- A) A syntax error in HCL code caught by `terraform validate`.
- B) An attribute value that cannot be computed until the provider executes API calls during `apply`.
- C) An unauthenticated cloud provider endpoint.
- D) A variable whose default value is null.

<details><summary>Answer</summary>

**B.** Unknown values represent attributes (like generated IDs or IP addresses) that are only determined when the cloud provider creates the resource during `apply`.

- Why not A: Syntax errors are caught by validation.
- Why not C, D: Unrelated to unknown values.
- Ref: [modules/02-hcl-semantics-and-type-system.md](../modules/02-hcl-semantics-and-type-system.md), https://developer.hashicorp.com/terraform/language/expressions/references#unknown-values

</details>

### Q-TFA-035 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 2 · single

Which HCL collection type enforces uniqueness of its elements and unordered storage?

- A) `list`
- B) `tuple`
- C) `set`
- D) `map`

<details><summary>Answer</summary>

**C.** A `set` is a collection of unique values without duplicate elements or guaranteed ordering.

- Why not A, B, D: Lists and tuples maintain ordering and allow duplicates; maps are key-value pairs.
- Ref: [modules/02-hcl-semantics-and-type-system.md](../modules/02-hcl-semantics-and-type-system.md), https://developer.hashicorp.com/terraform/language/expressions/types#sets

</details>

### Q-TFA-036 · D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) · difficulty 3 · scenario

An engineer writes a splat expression `aws_instance.web[*].id`. What type does this expression evaluate to?

- A) A single string containing all instance IDs comma-separated.
- B) A list of strings containing the ID attribute of each instance.
- C) A boolean indicating whether instances exist.
- D) A map of resource addresses to IDs.

<details><summary>Answer</summary>

**B.** Full splat expressions evaluate to a list containing attribute values extracted from each resource instance.

- Why not A, C, D: Splats evaluate to lists of attributes.
- Ref: [modules/02-hcl-semantics-and-type-system.md](../modules/02-hcl-semantics-and-type-system.md), https://developer.hashicorp.com/terraform/language/expressions/references#splat-expressions

</details>

### Q-TFA-037 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 1 · single

What is the primary benefit of using Terraform modules?

- A) To eliminate the need for Terraform state files.
- B) To encapsulate, reuse, and compose configuration logic across multiple projects or environments.
- C) To bypass cloud provider API rate limits.
- D) To automatically translate HCL into Python scripts.

<details><summary>Answer</summary>

**B.** Modules promote encapsulation, reusability, and standardization of infrastructure patterns.

- Why not A, C, D: Unrelated to module purpose.
- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules

</details>

### Q-TFA-038 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 2 · multi

From which sources can Terraform modules be loaded? (Select all that apply)

- A) Local relative file paths.
- B) The Terraform Registry (public or private).
- C) Git and GitHub repositories.
- D) OCI registries (supported natively in OpenTofu and modern Terraform).

<details><summary>Answer</summary>

**A, B, C, D.** Terraform supports local paths, registries, git repositories, and OCI registries as module sources.

- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules/sources

</details>

### Q-TFA-039 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 2 · scenario

A team wants to reference a module stored in a private GitHub repository with a specific version tag `v1.2.0`. How should the source parameter be structured?

- A) `source = "github.com/example/repo?ref=v1.2.0"`
- B) `source = "git::https://github.com/example/repo.git?ref=v1.2.0"`
- C) `source = "module::github.com/example/repo/v1.2.0"`
- D) `source = "registry.terraform.io/example/repo/v1.2.0"`

<details><summary>Answer</summary>

**B.** Git repository sources use the `git::` protocol prefix combined with a `?ref=` query parameter for version tagging.

- Why not A, C, D: Incorrect syntax for git repository module sourcing.
- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules/sources#git

</details>

### Q-TFA-040 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 3 · single

What is a recommended anti-pattern in module design?

- A) Defining input variables with strict type constraints and description documentation.
- B) Embedding provider configuration blocks (`provider "aws" { ... }`) inside a reusable child module.
- C) Exposing outputs that aggregate resource attributes for caller consumption.
- D) Using semantic versioning for public module releases.

<details><summary>Answer</summary>

**B.** Embedding provider configurations inside child modules couples the module to specific credentials and regions, preventing flexible caller-defined provider aliasing.

- Why not A, C, D: These are best practices in module design.
- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules/develop/providers

</details>

### Q-TFA-041 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 2 · single

How do child modules access variables passed from a parent module?

- A) Through global environment variables.
- B) Through input variables declared in the child module's `variables.tf`.
- C) By directly reading the parent's state file.
- D) Through provider configuration injection.

<details><summary>Answer</summary>

**B.** Child modules define input variables that receive values passed as arguments within parent module blocks.

- Why not A, C, D: Variables are explicitly passed via module arguments and declared in variables files.
- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules/syntax#passing-values-to-modules

</details>

### Q-TFA-042 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 3 · scenario

An engineer refactors a configuration by moving a resource into a child module. To prevent Terraform from destroying the existing resource and creating a new one, what block should be added?

- A) A `moved` block mapping the old resource address to the new module resource address.
- B) A `lifecycle { prevent_destroy = true }` block.
- C) A `provider` alias block.
- D) A `removed` block.

<details><summary>Answer</summary>

**A.** A `moved` block instructs Terraform to update state mappings, treating the resource as relocated rather than destroyed and recreated.

- Why not B: `prevent_destroy` stops destruction but does not perform refactoring address mapping.
- Why not C: Provider aliases configure providers.
- Why not D: `removed` drops resources from management.
- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules/develop/refactoring

</details>

### Q-TFA-043 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 2 · single

What does module version pinning ensure?

- A) That provider plugins are updated on every `init`.
- B) That consuming configurations remain stable and do not unexpectedly break when upstream module authors release breaking changes.
- C) That state files are encrypted at rest.
- D) That execution plans run in parallel.

<details><summary>Answer</summary>

**B.** Version constraints (`version = "~> 2.1.0"`) ensure module consumers are protected against unexpected breaking changes in upstream releases.

- Why not A, C, D: Unrelated to module versioning.
- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules/syntax#version

</details>

### Q-TFA-044 · D5 Interact with Terraform Modules (sources, scope, versions, design) · difficulty 3 · multi

Which practices represent sound Terraform module design? (Select all that apply)

- A) Keeping modules focused on a single logical architectural boundary (e.g., a standard VPC or Kubernetes cluster).
- B) Providing clear documentation, input validation rules, and well-defined output values.
- C) Hardcoding AWS account IDs and region strings inside child modules.
- D) Avoiding provider configuration blocks inside child modules.

<details><summary>Answer</summary>

**A, B, D.** Focused boundaries, documentation/validation, and avoiding embedded provider configs are module best practices.

- Why not C: Hardcoding account IDs and regions reduces reusability.
- Ref: [modules/07-module-design-and-composition.md](../modules/07-module-design-and-composition.md), https://developer.hashicorp.com/terraform/language/modules/develop/best-practices

</details>

### Q-TFA-045 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 1 · single

What is the purpose of a Terraform backend?

- A) To compile HCL configuration into executable binaries.
- B) To define where Terraform stores its state file and how state locking is executed.
- C) To authenticate with GitHub repositories.
- D) To cache provider plugins locally.

<details><summary>Answer</summary>

**B.** Backends determine where state is stored (local vs. remote object storage like S3 or GCS) and how locking is managed.

- Why not A, C, D: Unrelated to backend responsibilities.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/settings/backends

</details>

### Q-TFA-046 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 2 · single

Why is storing Terraform state files in unencrypted local disk or public S3 buckets a major security risk?

- A) It causes syntax errors during `terraform validate`.
- B) State files contain resource attributes in plaintext, including sensitive data such as database passwords and private keys.
- C) It prevents `terraform init` from downloading providers.
- D) It disables state locking permanently.

<details><summary>Answer</summary>

**B.** State files store resource attributes in plaintext JSON, making unprotected state files a critical security risk for leaked secrets.

- Why not A, C, D: Unrelated to state file security.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/state/sensitive-data

</details>

### Q-TFA-047 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 2 · scenario

An operator encounters an error stating that the remote state file is locked by another process that crashed. What CLI command can be used to release the lock (use with extreme caution)?

- A) `terraform unlock <lock-ID>`
- B) `terraform init -reconfigure`
- C) `terraform state rm`
- D) `terraform refresh`

<details><summary>Answer</summary>

**A.** `terraform force-unlock` (or `terraform unlock` depending on backend) releases a stuck state lock using the lock ID provided in the error message.

- Why not B, C, D: These do not release locks.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/cli/commands/force-unlock

</details>

### Q-TFA-048 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 3 · scenario

What occurs when state drift is detected during `terraform plan`?

- A) Terraform automatically deletes the drifted cloud resource.
- B) Terraform proposes corrective changes in the execution plan to reconcile actual cloud state back to desired HCL configuration.
- C) Terraform crashes with a state corruption error.
- D) Terraform ignores real-world changes unless `-refresh-only` is passed.

<details><summary>Answer</summary>

**B.** Drift detection identifies discrepancies between observed cloud state and desired state, prompting corrective actions in the plan.

- Why not A: Terraform does not automatically destroy drifted resources without explicit plan application.
- Why not C: Drift does not corrupt state.
- Why not D: Default plans refresh state automatically unless `-refresh=false` is passed.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/state/drift

</details>

### Q-TFA-049 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 2 · single

What does the state lineage UUID signify?

- A) The cryptographic signature of installed provider plugins.
- B) A unique identifier assigned to a state file upon creation to prevent divergent state overwrites across teams.
- C) The AWS region where resources are deployed.
- D) The version number of the Terraform CLI binary.

<details><summary>Answer</summary>

**B.** Lineage UUIDs ensure that separate state files cannot be merged or overwritten if their histories diverge, protecting against state corruption.

- Why not A, C, D: Unrelated to state lineage.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/internals/state-fileformat

</details>

### Q-TFA-050 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 3 · multi

Which features are supported by modern S3 remote backend configurations for Terraform? (Select all that apply)

- A) Native state locking via S3 lock files (`use_lockfile = true`).
- B) Server-side encryption using AWS KMS keys.
- C) Automatic execution of local shell scripts on state update.
- D) DynamoDB table locking integration (traditional approach).

<details><summary>Answer</summary>

**A, B, D.** Modern S3 backends support native S3 lockfiles, server-side KMS encryption, and DynamoDB-based locking.

- Why not C: S3 backends do not execute local shell scripts.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/language/settings/backends/s3

</details>

### Q-TFA-051 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 2 · single

How can an administrator remove a resource from Terraform management without destroying the underlying cloud infrastructure?

- A) `terraform destroy -target=...`
- B) `terraform state rm <resource-address>`
- C) `terraform apply -refresh-only`
- D) `terraform workspace delete`

<details><summary>Answer</summary>

**B.** `terraform state rm` removes the resource record from the state file without invoking provider destroy operations on real-world infrastructure.

- Why not A: `destroy` deletes real infrastructure.
- Why not C, D: Unrelated to state removal.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/cli/commands/state/rm

</details>

### Q-TFA-052 · D6 Navigate Terraform State Management (backends, locking, drift, security) · difficulty 3 · scenario

A team splits a massive monolithic state file into separate component states. Which command helps relocate a resource address from the old state to the new state without recreation?

- A) `terraform state mv`
- B) `terraform import`
- C) `terraform push`
- D) `terraform workspace new`

<details><summary>Answer</summary>

**A.** `terraform state mv` moves items within state or across state files, preserving resource mappings.

- Why not B: `import` brings external resources into state.
- Why not C, D: Unrelated to state item relocation.
- Ref: [modules/06-state-internals-and-backends.md](../modules/06-state-internals-and-backends.md), https://developer.hashicorp.com/terraform/cli/commands/state/mv

</details>

### Q-TFA-053 · D7 Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) · difficulty 1 · single

What is the purpose of the `terraform test` framework introduced in modern Terraform versions?

- A) To execute integration and unit tests using `.tftest.hcl` files with mock providers and assertions.
- B) To run unit tests written in Python pytest.
- C) To test network latency between cloud regions.
- D) To benchmark Terraform CLI execution speed.

<details><summary>Answer</summary>

**A.** `terraform test` provides a native testing framework using `.tftest.hcl` files, supporting assertions and mock providers.

- Why not B, C, D: Unrelated to native `terraform test`.
- Ref: [modules/08-testing-and-policy-as-code.md](../modules/08-testing-and-policy-as-code.md), https://developer.hashicorp.com/terraform/language/tests

</details>

### Q-TFA-054 · D7 Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) · difficulty 2 · scenario

An engineer wants to adopt existing unmanaged AWS infrastructure into Terraform management using declarative configuration. Which block type enables this in modern Terraform?

- A) `moved { ... }`
- B) `import { to = aws_instance.web, id = "i-12345" }`
- C) `removed { ... }`
- D) `lifecycle { import = true }`

<details><summary>Answer</summary>

**B.** Declarative `import` blocks link existing external resources to Terraform resource addresses during plans and applies.

- Why not A, C, D: These serve refactoring, removal, and lifecycle rules.
- Ref: [modules/09-import-refactoring-and-drift.md](../modules/09-import-refactoring-and-drift.md), https://developer.hashicorp.com/terraform/language/import

</details>

### Q-TFA-055 · D7 Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) · difficulty 2 · single

What is Policy-as-Code in the context of infrastructure management?

- A) The practice of writing infrastructure configuration in Python instead of HCL.
- B) Expressing security, compliance, and operational guardrails as automated, machine-readable policies evaluated against execution plans.
- C) Automatically generating cloud provider API documentation.
- D) Enforcing strict indentation standards via `terraform fmt`.

<details><summary>Answer</summary>

**B.** Policy-as-Code codifies governance and security compliance rules to validate Terraform plans before deployment.

- Why not A, C, D: Unrelated to Policy-as-Code.
- Ref: [modules/08-testing-and-policy-as-code.md](../modules/08-testing-and-policy-as-code.md), https://developer.hashicorp.com/terraform/tutorials/automation/opa-validate

</details>

### Q-TFA-056 · D7 Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) · difficulty 3 · multi

Which policy engines and languages are commonly used for Terraform Policy-as-Code? (Select all that apply)

- A) Open Policy Agent (OPA) using Rego.
- B) Common Expression Language (CEL).
- C) HashiCorp Sentinel.
- D) SQL stored procedures.

<details><summary>Answer</summary>

**A, B, C.** OPA/Rego, CEL, and Sentinel are widely used policy engines for evaluating Terraform execution plans.

- Why not D: SQL stored procedures are not used for Terraform policy evaluation.
- Ref: [modules/08-testing-and-policy-as-code.md](../modules/08-testing-and-policy-as-code.md), https://developer.hashicorp.com/terraform/tutorials/automation/opa-validate

</details>

### Q-TFA-057 · D7 Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) · difficulty 3 · scenario

What does a `removed` block with `lifecycle { destroy = false }` (Terraform 1.16+) accomplish when a resource block is deleted from configuration?

- A) It deletes the cloud resource immediately.
- B) It removes the resource from state and configuration management while leaving the real-world cloud infrastructure intact.
- C) It triggers a security alert in HCP Terraform.
- D) It throws a syntax validation error.

<details><summary>Answer</summary>

**B.** `removed` blocks with `destroy = false` allow decommissioning resource management in Terraform without destroying underlying cloud resources.

- Why not A, C, D: Unrelated to `removed` blocks.
- Ref: [modules/09-import-refactoring-and-drift.md](../modules/09-import-refactoring-and-drift.md), https://developer.hashicorp.com/terraform/language/resources/removed

</details>

### Q-TFA-058 · D7 Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) · difficulty 2 · hands-on

Create a `.tftest.hcl` file testing a custom variable validation rule. Write a run block with `command = plan` and `expect_failures = [var.instance_type]` when passing an invalid instance type. Verify execution succeeds when passing a valid type.
<details><summary>Answer</summary>

**Solution:**

```hcl
run "invalid_instance_type" {
  command = plan

  variables {
    instance_type = "invalid-type"
  }

  expect_failures = [
    var.instance_type,
  ]
}

run "valid_instance_type" {
  command = plan

  variables {
    instance_type = "t3.medium"
  }
}
```

- Explanation: Native `terraform test` runs assertions against planned or applied states, enabling robust module testing.
- Ref: [modules/08-testing-and-policy-as-code.md](../modules/08-testing-and-policy-as-code.md), https://developer.hashicorp.com/terraform/language/tests

</details>

### Q-TFA-059 · D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows · difficulty 1 · single

What is HCP Terraform (formerly Terraform Cloud)?

- A) A local command-line tool for formatting HCL files.
- B) A managed SaaS control plane providing remote execution, state storage, collaboration workspaces, and governance for Terraform.
- C) A cloud provider plugin for managing AWS IAM users.
- D) An open-source database engine for storing state files.

<details><summary>Answer</summary>

**B.** HCP Terraform provides remote execution environments, collaboration workspaces, state management, and policy enforcement as a managed service.

- Why not A, C, D: Unrelated to HCP Terraform.
- Ref: [modules/10-hcp-terraform-and-ci-workflows.md](../modules/10-hcp-terraform-and-ci-workflows.md), https://developer.hashicorp.com/terraform/cloud-docs

</details>

### Q-TFA-060 · D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows · difficulty 2 · single

What is OpenTofu?

- A) A proprietary enterprise tier of Terraform created by IBM.
- B) An open-source fork of Terraform created under the Mozilla Public License 2.0 and hosted by the CNCF.
- C) A Python library for parsing JSON state files.
- D) A container runtime built on runc.

<details><summary>Answer</summary>

**B.** OpenTofu is an open-source, community-driven fork of Terraform maintained under the CNCF and MPL 2.0 license.

- Why not A, C, D: Unrelated to OpenTofu.
- Ref: [modules/12-production-architecture-and-opentofu.md](../modules/12-production-architecture-and-opentofu.md), https://opentofu.org/docs/intro/what-is-opentofu

</details>

### Q-TFA-061 · D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows · difficulty 2 · scenario

Why did the licensing change from MPL 2.0 to Business Source License (BSL 1.1) in Terraform v1.6 significantly impact the IaC ecosystem?

- A) It restricted commercial cloud vendors from offering hosted, managed Terraform services as a commercial product without a special license.
- B) It made Terraform entirely closed-source and unavailable for internal enterprise use.
- C) It prohibited developers from writing custom provider plugins.
- D) It mandated migrating all state files to encrypted S3 backends.

<details><summary>Answer</summary>

**A.** BSL 1.1 allows internal enterprise use and standard adoption, but restricts competitors from offering hosted commercial Terraform services.

- Why not B, C, D: Internal use and plugins remain permitted; state encryption is separate.
- Ref: [modules/12-production-architecture-and-opentofu.md](../modules/12-production-architecture-and-opentofu.md), https://www.hashicorp.com/license-faq

</details>

### Q-TFA-062 · D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows · difficulty 3 · multi

Which capabilities distinguish OpenTofu 1.13 from traditional Terraform features? (Select all that apply)

- A) Native client-side state encryption at rest.
- B) Support for provider-defined functions.
- C) BSL 1.1 licensing restrictions.
- D) CNCF governance and MPL 2.0 licensing.

<details><summary>Answer</summary>

**A, B, D.** OpenTofu features native state encryption, provider-defined functions, and operates under CNCF / MPL 2.0.

- Why not C: BSL 1.1 applies to Terraform post-v1.5, not OpenTofu (which is MPL 2.0).
- Ref: [modules/12-production-architecture-and-opentofu.md](../modules/12-production-architecture-and-opentofu.md), https://opentofu.org/docs/

</details>

### Q-TFA-063 · D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows · difficulty 3 · scenario

A production team runs Terraform plans in CI/CD pipelines. What is the safest way to execute infrastructure deployments?

- A) Run `terraform apply -auto-approve` directly against production main branches without reviewing plans.
- B) Save execution plans as secure artifacts (`terraform plan -out=tfplan`), review and approve the artifact, and apply the exact saved plan file.
- C) Execute `terraform apply` locally on developer laptops.
- D) Disable state locking to speed up concurrent pipeline runs.

<details><summary>Answer</summary>

**B.** Saving plans as artifacts and applying exact saved plans ensures zero divergence between reviewed changes and applied infrastructure in CI/CD.

- Why not A: Unreviewed auto-approve risks outages.
- Why not C: Local operator applies lack CI auditability.
- Why not D: Disabling locking risks state corruption.
- Ref: [modules/10-hcp-terraform-and-ci-workflows.md](../modules/10-hcp-terraform-and-ci-workflows.md), https://developer.hashicorp.com/terraform/cloud-docs/run/automation

</details>

### Q-TFA-064 · D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows · difficulty 2 · single

What is a primary advantage of organizing production infrastructure into multiple distinct state files (per environment or per service) rather than one monolithic state?

- A) It reduces the blast radius of potential failures and avoids performance bottlenecks during state refreshes.
- B) It eliminates the need for remote backends.
- C) It allows mixing incompatible provider versions within the same directory.
- D) It automatically encrypts all variable values without marking them sensitive.

<details><summary>Answer</summary>

**A.** Splitting states reduces blast radius and prevents slow plan times caused by massive monolithic state files.

- Why not B, C, D: Unrelated to state partitioning benefits.
- Ref: [modules/12-production-architecture-and-opentofu.md](../modules/12-production-architecture-and-opentofu.md), https://developer.hashicorp.com/terraform/tutorials/cloud/cloud-proven-practices

</details>

### Q-TFA-065 · D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows · difficulty 3 · hands-on

Write an OpenTofu state encryption block configuration in `terraform.tf` enforcing AES-256 GCM encryption at rest with a passphrase key provider.
<details><summary>Answer</summary>

**Solution:**

```hcl
terraform {
  encryption {
    key_provider "pbkdf2" "my_passphrase" {
      passphrase = var.encryption_passphrase
    }

    method "aes_gcm" "encryption_method" {
      keys = key_provider.pbkdf2.my_passphrase
    }

    state {
      method = method.aes_gcm.encryption_method
    }
  }
}
```

- Explanation: OpenTofu native state encryption protects sensitive state contents at rest across any backend storage layer.
- Ref: [modules/12-production-architecture-and-opentofu.md](../modules/12-production-architecture-and-opentofu.md), https://opentofu.org/docs/language/state/encryption

</details>

## Full Mock Exam

- **Total Questions**: 65 (57 standard Associate 004 questions + 8 advanced/OpenTofu bonus questions)
- **Time Limit**: 60 minutes
- **Passing Score**: 70% (46 / 65 correct)

### 65-Question Answer Key

| Question ID | Domain | Type     | Difficulty | Correct Key                                      |
| ----------- | ------ | -------- | ---------- | ------------------------------------------------ |
| Q-TFA-001   | D1     | single   | 1          | B                                                |
| Q-TFA-002   | D1     | single   | 1          | B                                                |
| Q-TFA-003   | D1     | scenario | 2          | B                                                |
| Q-TFA-004   | D1     | single   | 2          | B                                                |
| Q-TFA-005   | D1     | single   | 1          | A                                                |
| Q-TFA-006   | D1     | multi    | 2          | A, B, D                                          |
| Q-TFA-007   | D1     | single   | 2          | B                                                |
| Q-TFA-008   | D1     | scenario | 3          | B                                                |
| Q-TFA-009   | D2     | single   | 1          | B                                                |
| Q-TFA-010   | D2     | single   | 2          | B                                                |
| Q-TFA-011   | D2     | scenario | 2          | B                                                |
| Q-TFA-012   | D2     | single   | 2          | B                                                |
| Q-TFA-013   | D2     | multi    | 3          | A, B                                             |
| Q-TFA-014   | D2     | single   | 2          | B                                                |
| Q-TFA-015   | D2     | single   | 2          | B                                                |
| Q-TFA-016   | D2     | scenario | 3          | B                                                |
| Q-TFA-017   | D3     | single   | 1          | B                                                |
| Q-TFA-018   | D3     | single   | 1          | A                                                |
| Q-TFA-019   | D3     | scenario | 2          | B                                                |
| Q-TFA-020   | D3     | single   | 2          | A                                                |
| Q-TFA-021   | D3     | single   | 2          | B                                                |
| Q-TFA-022   | D3     | scenario | 3          | A                                                |
| Q-TFA-023   | D3     | single   | 2          | B                                                |
| Q-TFA-024   | D3     | ordering | 3          | A (1 -> 2 -> 3 -> 4)                             |
| Q-TFA-025   | D4     | single   | 1          | A                                                |
| Q-TFA-026   | D4     | single   | 2          | B                                                |
| Q-TFA-027   | D4     | scenario | 2          | B                                                |
| Q-TFA-028   | D4     | single   | 2          | B                                                |
| Q-TFA-029   | D4     | scenario | 3          | B                                                |
| Q-TFA-030   | D4     | multi    | 3          | A, B, C                                          |
| Q-TFA-031   | D4     | single   | 2          | B                                                |
| Q-TFA-032   | D4     | single   | 3          | A                                                |
| Q-TFA-033   | D4     | single   | 2          | B                                                |
| Q-TFA-034   | D4     | single   | 2          | B                                                |
| Q-TFA-035   | D4     | single   | 2          | C                                                |
| Q-TFA-036   | D4     | scenario | 3          | B                                                |
| Q-TFA-037   | D5     | single   | 1          | B                                                |
| Q-TFA-038   | D5     | multi    | 2          | A, B, C, D                                       |
| Q-TFA-039   | D5     | scenario | 2          | B                                                |
| Q-TFA-040   | D5     | single   | 3          | B                                                |
| Q-TFA-041   | D5     | single   | 2          | B                                                |
| Q-TFA-042   | D5     | scenario | 3          | A                                                |
| Q-TFA-043   | D5     | single   | 2          | B                                                |
| Q-TFA-044   | D5     | multi    | 3          | A, B, D                                          |
| Q-TFA-045   | D6     | single   | 1          | B                                                |
| Q-TFA-046   | D6     | single   | 2          | B                                                |
| Q-TFA-047   | D6     | scenario | 2          | A                                                |
| Q-TFA-048   | D6     | scenario | 3          | B                                                |
| Q-TFA-049   | D6     | single   | 2          | B                                                |
| Q-TFA-050   | D6     | multi    | 3          | A, B, D                                          |
| Q-TFA-051   | D6     | single   | 2          | B                                                |
| Q-TFA-052   | D6     | scenario | 3          | A                                                |
| Q-TFA-053   | D7     | single   | 1          | A                                                |
| Q-TFA-054   | D7     | scenario | 2          | B                                                |
| Q-TFA-055   | D7     | single   | 2          | B                                                |
| Q-TFA-056   | D7     | multi    | 3          | A, B, C                                          |
| Q-TFA-057   | D7     | scenario | 3          | B                                                |
| Q-TFA-058   | D7     | hands-on | 2          | Code (`.tftest.hcl` plan with `expect_failures`) |
| Q-TFA-059   | D8     | single   | 1          | B                                                |
| Q-TFA-060   | D8     | single   | 2          | B                                                |
| Q-TFA-061   | D8     | scenario | 2          | A                                                |
| Q-TFA-062   | D8     | multi    | 3          | A, B, D                                          |
| Q-TFA-063   | D8     | scenario | 3          | B                                                |
| Q-TFA-064   | D8     | single   | 2          | A                                                |
| Q-TFA-065   | D8     | hands-on | 3          | Code (`encryption` block with AES-256-GCM)       |

### Per-Domain Score Breakdown & Remediation

| Domain | Questions | Weight | Passing Threshold | Remediation Module |
| --- | --- | --- | --- | --- |
| D1 Understand Infrastructure as Code (IaC) with Terraform | 8 | 12.3% | 6 / 8 (70%) | [Module 01](../modules/01-iac-and-terraform-model.md) |
| D2 Understand the purpose of Terraform & Fundamentals (Providers, State) | 8 | 12.3% | 6 / 8 (70%) | [Modules 01, 03, 04](../modules/01-iac-and-terraform-model.md) |
| D3 Use the Terraform CLI & Core Workflow (`init`, `validate`, `plan`, `apply`, `destroy`, `fmt`) | 8 | 12.3% | 6 / 8 (70%) | [Module 03](../modules/03-core-workflow-and-cli.md) |
| D4 Read, generate, and modify Configuration (resources, data, variables, types, expressions, functions, custom conditions, `ephemeral` & write-only arguments, Vault) | 12 | 18.5% | 8 / 12 (70%) | [Modules 02, 04, 05](../modules/02-hcl-semantics-and-type-system.md) |
| D5 Interact with Terraform Modules (sources, scope, versions, design) | 8 | 12.3% | 6 / 8 (70%) | [Module 07](../modules/07-module-design-and-composition.md) |
| D6 Navigate Terraform State Management (backends, locking, drift, security) | 8 | 12.3% | 6 / 8 (70%) | [Module 06](../modules/06-state-internals-and-backends.md) |
| D7 Maintain infrastructure with Terraform (`import`, `moved`, `removed`, `terraform test`, policy-as-code, `TF_LOG`, provider internals) | 6 | 9.2% | 4 / 6 (70%) | [Modules 08, 09, 11](../modules/08-testing-and-policy-as-code.md) |
| D8 Understand HCP Terraform capabilities & Production/OpenTofu workflows | 7 | 10.8% | 5 / 7 (70%) | [Modules 10, 12](../modules/10-hcp-terraform-and-ci-workflows.md) |
| **Total** | **65** | **100%** | **46 / 65 (70%)** | **Comprehensive Track Review** |
