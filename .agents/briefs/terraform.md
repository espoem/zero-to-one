# Brief: Terraform (`technologies/terraform`)

| | |
|---|---|
| Phase | 3 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/terraform` · `../zto-terraform` |
| Depends on | phase 2 foundations |
| Research dossier | `.agents/research/E-platform.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Terraform Associate 004 targets 1.12 while the track teaches the latest: add exam-delta callouts.
- Owns the shared policy-as-code module (OPA/Rego, CEL, Kyverno, Terraform Policy). kubernetes and argocd cross-link to it.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- IaC model, HCL, state & locking, modules, `terraform test`, OpenTofu
- Policy-as-code (OPA/Rego, CEL, Kyverno, Terraform Policy): one shared module

**Cross-link only (do not re-explain):**
- (see dossier "Overlaps / dedupe")

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Terraform (+ OpenTofu) — `technologies/terraform`

- **Current stable version(s)**:
  - Terraform **v1.17.0** (tag 2026-10-21; very fresh — changelog still headed "Unreleased" on the branch): variables/locals in provider requirements, `-minimal-refresh`, **Terraform Policy GA** (`-policies` on plan/apply/query) — https://github.com/hashicorp/terraform/blob/v1.17/CHANGELOG.md . Previous: **1.16.7** (1.16.0 on 2026-08-26: `import` blocks inside modules, `lifecycle { destroy = false }`, action `before_destroy/after_destroy` events, `terraform_data` `store` block, Mermaid graph output) — https://github.com/hashicorp/terraform/blob/v1.16/CHANGELOG.md ; 1.15 (2026-04-29: variables in module `source`/`version`, `deprecated` attribute on variables/outputs, `convert()`) — https://github.com/hashicorp/terraform/blob/v1.15/CHANGELOG.md . Security support: 1.16 & 1.15 (and now 1.17) — https://endoflife.date/terraform
  - Recommend pinning course to **1.16.x** until 1.17 has a patch release, with a 1.17 delta note (judgement call).
  - OpenTofu **v1.13.2** (2026-10-21; 1.13.0 on 2026-09-30): experimental symbol libraries and `-lint`, `convert`, OCI registry improvements, WinRM provisioner removed, macOS 13+ required — https://raw.githubusercontent.com/opentofu/opentofu/v1.13/CHANGELOG.md ; OpenTofu is a CNCF project https://www.cncf.io/projects/opentofu/
  - Licence: Terraform under **BSL 1.1 since v1.6 (Aug 2023)**; OpenTofu forked from 1.5.x under MPL-2.0; IBM acquired HashiCorp (closed Feb 2025 — from background knowledge, unverified here).
- **Authoritative syllabi used**:
  - **Terraform Associate (004)** — https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004 — tests **Terraform 1.12**; 003 retired 2026-01-08 (https://notes.kodekloud.com/docs/HashiCorp-Certified-Terraform-Associate-004/Course-Introduction/Whats-New-in-the-Terraform-Associate-004-Exam/page). Objectives: (1) IaC with Terraform, (2) Terraform fundamentals (providers, state), (3) Core workflow (init/validate/plan/apply/destroy/fmt), (4) Configuration (resource vs data, references, variables/outputs, complex types, expressions/functions, dependencies, **custom conditions**, sensitive data & Vault), (5) Modules (sources, scope, versions), (6) State management (local backend, locking, remote backend, drift), (7) Maintain infra (import, state CLI, verbose logging), (8) HCP Terraform (workspaces, projects, governance, integrations). New vs 003: lifecycle rules, custom validation, **ephemeral values & write-only arguments**, expanded HCP Terraform. HashiCorp doesn't publish percentage weights (unverified that none exist).
  - Terraform Authoring & Operations Professional (exists; objectives not checked — unverified).
  - Official docs: language https://developer.hashicorp.com/terraform/language , CLI, `terraform test` https://developer.hashicorp.com/terraform/language/tests , plugin framework; OpenTofu docs https://opentofu.org/docs/
- **Proposed modules** (12):
  1. **IaC & Terraform model** — declarative vs imperative IaC, desired state, Terraform's graph-based plan/apply, providers as plugins (gRPC protocol), multi-cloud reality; Terraform vs OpenTofu vs Pulumi vs CloudFormation vs Crossplane (GitOps for infra).
  2. **HCL semantics** — blocks/attributes, type system (primitive, collection, structural, `any`, optional attrs), expressions, `for`, splat, conditionals, functions (pure), `dynamic` blocks, string templates, `locals`, unknown values ("known after apply") and why.
  3. **Core workflow & CLI** — init (provider install, lock file `.terraform.lock.hcl`, plugin cache), validate, fmt, plan (refresh, `-refresh-only`, `-minimal-refresh` 1.17, saved plans), apply, destroy, `-target`/`-replace`, workspaces CLI, `TF_LOG`.
  4. **Providers & resources** — required_providers/version constraints, provider aliases & multi-region, resource vs data sources, meta-arguments (`count` vs `for_each` addressing, `depends_on`, `provider`, `lifecycle`: create_before_destroy, prevent_destroy, ignore_changes, replace_triggered_by, `destroy=false` 1.16), implicit vs explicit dependencies.
  5. **Variables, outputs, validation & secrets** — variable validation, preconditions/postconditions, `check` blocks, `sensitive`, **ephemeral variables/resources & write-only arguments**, `deprecated` (1.15), Vault provider patterns, secrets in state.
  6. **State internals** — state file format (JSON, serial, lineage), resource addressing, refresh & drift, backends (local, S3 with native `use_lockfile`, GCS, azurerm, `remote`/`cloud`), locking semantics & `force-unlock`, state CLI (`list/show/mv/rm`), `moved`/`removed`/`import` blocks vs CLI, partial-backend config, state encryption (OpenTofu-native).
  7. **Modules** — module structure, inputs/outputs, variable scope, sources (registry, git, OCI in OpenTofu), versioning, composition vs inheritance, refactoring with `moved`, module design anti-patterns (god modules, provider config inside modules).
  8. **Testing & quality** — `terraform test` (`.tftest.hcl`, run blocks, `command = plan|apply`, assertions, `expect_failures`, mock providers/overrides), `terraform validate`, tflint, policy as code (Terraform Policy GA in 1.17, OPA/Conftest, Sentinel), Terratest (Go) for integration.
  9. **Import, refactoring & drift** — `import` blocks + `-generate-config-out`, imports in modules (1.16), `removed` blocks, `moved`, refresh-only plans, drift detection schedules, `terraform query`/list resources (1.14+) for discovering unmanaged infra.
  10. **HCP Terraform & collaboration** — workspaces/projects, VCS-driven vs CLI vs API runs, remote execution, variable sets, run tasks, policy sets, private registry, Stacks overview, agents, cost; CI alternatives (Atlantis, GitLab-managed state/OpenTofu CI component).
  11. **Provider internals & authoring** — plugin framework, schema, CRUD + plan modification, diagnostics, import, acceptance tests (`TF_ACC`), how unknowns/deferred actions work; write a small provider.
  12. **Production & OpenTofu** — repo/state layout (blast radius, per-env state), pipelines (plan as artifact, apply exact saved plan), concurrency & locks, upgrades (provider/major bumps), BSL licence implications, OpenTofu differences (state encryption, `enabled`/dynamic `prevent_destroy` (unverified version), provider-defined functions, OCI registries, `-exclude`), migration path.
- **Gotchas & production failure modes**:
  - `count` over a list → removing an element in the middle shifts indexes and destroys/recreates everything after it; use `for_each` with stable keys.
  - Secrets (DB passwords, private keys from `tls_private_key`) stored in plaintext in state; `sensitive` only redacts CLI output — use ephemeral/write-only arguments and encrypted, access-controlled backends.
  - `terraform apply` without a saved plan in CI applies something different from what was reviewed.
  - Lost/stale lock after a killed CI job → `force-unlock` misuse while another apply runs → corrupted state.
  - `-target` used routinely → partial graphs, drift, dependencies skipped.
  - `ignore_changes = all` hides real drift; `ignore_changes` on tags fights with org-level tag policies.
  - `create_before_destroy` with unique-name resources (S3 bucket, IAM role names) → name collision failures.
  - Provider configuration inside reusable modules blocks `count/for_each` on modules and prevents removing the module (orphaned resources can't be destroyed).
  - Unpinned provider versions/missing lock file → new provider major on next `init` changes plans.
  - `depends_on` on a data source makes it read at apply time → perpetual "known after apply" diffs.
  - Renaming a resource without `moved` block → destroy + create (data loss for databases).
  - Upgrading from local to remote backend or splitting state without `state mv`/`moved` → duplicates or deletions.
  - `prevent_destroy` doesn't help if the block is deleted from config along with the resource (use `removed { lifecycle { destroy = false } }` / 1.16 `destroy = false`).
  - Large monolithic state → 20-minute plans and API rate limits on refresh; split states, `-refresh=false` sparingly, `-minimal-refresh`.
  - Mixing Terraform ≥1.6 and OpenTofu on the same state: state format compatible only up to divergence; new features (state encryption, 1.16 blocks) break the other tool.
  - HCP Terraform free tier/legacy plans changes affecting cost (unverified specifics).
- **Interview hot topics**:
  - State: why it exists, locking, remote backends, drift.
  - `count` vs `for_each`; `moved`/`import`/`removed` blocks.
  - Module design & versioning; mono vs multi-state layout.
  - Plan/apply in CI with approvals; saved plans.
  - Handling secrets (sensitive vs ephemeral vs Vault).
  - Dependency graph, implicit vs explicit dependencies, unknown values.
  - `terraform test` & policy as code.
  - Terraform vs OpenTofu (licence, features) vs Pulumi/Crossplane.
  - Importing existing infrastructure.
  - Blast radius and multi-environment strategy (workspaces vs directories).
- **Executable-proof strategy**:
  - `terraform test` with **mock providers** (`mock_provider`, `override_resource`) — fully offline and deterministic; includes negative tests via `expect_failures` on variable validation/preconditions.
  - Real-apply tests against local providers: `hashicorp/random`, `hashicorp/local`, `hashicorp/null`/`terraform_data`, and **kreuzwerker/docker v4.6.0** (manages containers/networks on the local Docker/Colima VM).
  - Cloud-like provider tests: **LocalStack v4.14.0** (AWS API emulation; note LocalStack licensing/auth-token changes for community image in 2026 — unverified, check before pinning) or MinIO for S3 backend; prove **state locking**: two concurrent applies against S3 backend with `use_lockfile = true` → second fails with lock error.
  - Plan snapshot tests: `terraform plan -out` + `terraform show -json` → assert JSON (jq/pytest) for resource counts/actions (e.g., `for_each` change = 1 update not N replaces).
  - Static: `terraform fmt -check`, `terraform validate`, tflint **v0.65.0**, Conftest **v0.71.1** against plan JSON; Terraform Policy (1.17) where available.
  - OpenTofu parity: run the same suite with `tofu` 1.13.2 via mise; mark tests that are tool-specific.
  - Cannot prove locally: HCP Terraform runs/Sentinel (fallback: documented CLI-driven `cloud` block + screenshots or a free HCP account outside CI), real cloud provider quirks (eventual consistency) → describe, use LocalStack approximations.
  - mise pins: terraform 1.16.x (or 1.17.0), opentofu 1.13.2, tflint, conftest, localstack CLI, jq.
- **Overlaps / dedupe**:
  - Cloud resource semantics (IAM, VPC, S3) → AWS/Azure/GCP tracks (owned elsewhere); terraform uses them only as examples.
  - Provisioning Kubernetes clusters → terraform; deploying workloads into K8s → argocd (avoid Terraform helm/kubernetes provider for apps — cross-link).
  - CI plan/apply pipeline → gitlab-ci track (terraform module 12 references it).
  - Policy-as-code (OPA/Rego) concepts → could be a shared `foundations/policy-as-code` mini-track or live in kubernetes security module; terraform cross-links.
  - Secrets management (Vault) → separate track if any; cross-link only.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Licence: Terraform under **BSL 1.1 since v1.6 (Aug 2023)**; OpenTofu forked from 1.5.x under MPL-2.0; IBM acquired HashiCorp (closed Feb 2025 — from background knowledge, unverified here).
- **Terraform Associate (004)** — https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004 — tests **Terraform 1.12**; 003 retired 2026-01-08 (https://notes.kodekloud.com/docs/HashiCorp-Certified-Terraform-Associate-004/Course-Introduction/Whats-New-in-the-Terraform-Associate-004-Exam/page). Objectives: (1) IaC with Terraform, (2) Terraform fundamentals (providers, state), (3) Core workflow (init/validate/plan/apply/destroy/fmt), (4) Configuration (resource vs data, references, variables/outputs, complex types, expressions/functions, dependencies, **custom conditions**, sensitive data & Vault), (5) Modules (sources, scope, versions), (6) State management (local backend, locking, remote backend, drift), (7) Maintain infra (import, state CLI, verbose logging), (8) HCP Terraform (workspaces, projects, governance, integrations). New vs 003: lifecycle rules, custom validation, **ephemeral values & write-only arguments**, expanded HCP Terraform. HashiCorp doesn't publish percentage weights (unverified that none exist).
- Terraform Authoring & Operations Professional (exists; objectives not checked — unverified).
- 12. **Production & OpenTofu** — repo/state layout (blast radius, per-env state), pipelines (plan as artifact, apply exact saved plan), concurrency & locks, upgrades (provider/major bumps), BSL licence implications, OpenTofu differences (state encryption, `enabled`/dynamic `prevent_destroy` (unverified version), provider-defined functions, OCI registries, `-exclude`), migration path.
- HCP Terraform free tier/legacy plans changes affecting cost (unverified specifics).
- Cloud-like provider tests: **LocalStack v4.14.0** (AWS API emulation; note LocalStack licensing/auth-token changes for community image in 2026 — unverified, check before pinning) or MinIO for S3 backend; prove **state locking**: two concurrent applies against S3 backend with `use_lockfile = true` → second fails with lock error.

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/terraform` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(terraform)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/terraform.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/terraform.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
