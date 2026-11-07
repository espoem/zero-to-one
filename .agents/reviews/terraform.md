# Review: terraform · reviewer Gemini 4 Argon (capable · challenger & verifier) · 2026-11-07 · branch track/terraform @ 3d7196af

## Summary

Verdict: **Approved** (all P1, P2, and P3 findings resolved and verified). The track demonstrates exemplary technical depth, comprehensive formal rigor, and a deterministic 57-test TypeScript execution model covering all 16 gotchas with 100% passing checks (`npm test`, `typecheck`, `lint`, `fmt`, `wrap`, `table`, `link`, and `mermaid`). All proof maps, exam matrices, mock exams, glossary terms, and cheatsheet syntax have been rigorously verified.

---

## Findings

### P0 (None)

_No P0 blockers found. All deterministic checks (`npm test`, `typecheck`, `lint`, `fmt:check`, `wrap-check`, `table-check`, `mermaid-check`, `link-check`) pass cleanly with zero errors._

---

### P1 (Misleads or Incomplete Exam Coverage)

- [x] **P1** `technologies/terraform/exams/README.md:5-11`: `exams/README.md` only contains a high-level 2-row certification summary table. It completely lacks the domain-by-domain / objective-level coverage matrix specifying domain weights, mapped modules, example tests, and coverage status (`✅ Full`), which is explicitly mandated by `AGENTS.md` § Certification and Exam Coverage rule 2 and `REVIEW.md` § D. → **Fix**: Add the full 8-domain coverage matrix to `exams/README.md` (mirroring and expanding the table from `exams/terraform-associate-004.md:17-25`), with official domain objectives, weights, mapped modules, and status `✅ Full`. Source: `.agents/REVIEW.md` § D.

- [x] **P1** `technologies/terraform/exams/terraform-associate-004.md:1293-1298`: The "Full Mock Exam" section at the end of the question bank is an unpopulated stub of four bullet points. It lacks the standard 57-question / 65-question mock exam answer key mapping table (Question #, Domain, Type, Difficulty, Key) and the per-domain score breakdown & remediation table (Domain, Questions, Weight, Passing Threshold, Next step if below 70%) required by `AGENTS.md` § Certification and Exam Coverage rule 4 and `REVIEW.md` § D (see `technologies/redis/exams/redis-certified-associate-developer.md` and `technologies/postgres/exams/edb-postgres-associate-professional.md` for the standard structure). → **Fix**: Populate the full mock exam scoring key table and the per-domain score breakdown / remediation guide matching the official 57-question / 65-question exam mix. Source: `.agents/REVIEW.md` § D.

- [x] **P1** `technologies/terraform/modules/01-iac-and-terraform-model.md:514`: Module 01 Proof Map claims `Out-of-Process Provider Handshake | Parsing magic cookie and gRPC connection string | ../examples/ts/01-iac-and-terraform-model.test.ts`. No such test exists in `01-iac-and-terraform-model.test.ts` or anywhere in the test suite. → **Fix**: Remove the phantom entry or implement the magic cookie / handshake parser test in `01-iac-and-terraform-model.test.ts`. Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/02-hcl-semantics-and-type-system.md:566`: Module 02 Proof Map claims `Static Cardinality Barrier | Rejection of Unknown values in count and for_each` in `02-hcl-semantics-and-type-system.test.ts`. This assertion is not tested in that test file (unknown propagation in dynamic blocks is tested, but not the count/for_each static cardinality error). → **Fix**: Align the proof map entry with the actual tests in `02-hcl-semantics-and-type-system.test.ts` (e.g., Kleene 3VL truth tables, structural optional default injection, type mismatch path formatting) or add the cardinality barrier assertion. Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/03-core-workflow-and-cli.md:507`: Module 03 Proof Map claims `Declarative Replacement | Verification that -replace schedules destruction without mutating state` in `03-core-workflow-and-cli.test.ts`. No test for `-replace` exists in that test file. → **Fix**: Update the proof map row to reference the actual test (`CI gotcha: applying without a saved plan applies unreviewed drift` or lockfile checksum verification). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/05-variables-outputs-validation-and-secrets.md:454`: Module 05 Proof Map claims `Cross-Variable Validation Barrier` in `05-variables-outputs-validation-and-secrets.test.ts`. No such test exists in that file. → **Fix**: Update the proof map to match the actual tests in `05-variables-outputs-validation-and-secrets.test.ts` (variable custom validation, preconditions/postconditions/check blocks, sensitive redaction vs plaintext state, ephemeral/write-only omission). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/06-state-internals-and-backends.md:539`: Module 06 Proof Map claims `Declarative Refactoring Equivalence | Proof that moved blocks preserve resource identity and IDs` in `06-state-internals-and-backends.test.ts`. That test actually lives in `07-module-design-and-composition.test.ts`. → **Fix**: Point the reference in Module 06 to `../examples/ts/07-module-design-and-composition.test.ts` or replace with `06`'s actual tests (`S3 backend with use_lockfile`, `force-unlock race condition`, `state v4 structure invariants`). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/07-module-design-and-composition.md:600-602`: Module 07 Proof Map lists `testModuleCompositionGraph()` and `testOciSourceParsing()`, neither of which exists in `07-module-design-and-composition.test.ts`. → **Fix**: Replace the phantom function names with the actual tests in `07-module-design-and-composition.test.ts` (`module scoping: inputs, outputs, and internal encapsulation`, `production gotcha: renaming without moved block causes catastrophic destroy-and-create`, `moving resources across module boundaries with moved blocks`). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/08-testing-and-policy-as-code.md:650`: Module 08 Proof Map claims `testValidatingAdmissionPolicyParsing()` in `08-testing-and-policy-as-code.test.ts`. No such test exists in that file. → **Fix**: Replace with the actual test name (`Kyverno validate rules on container workload infrastructure` or `Terraform 1.17 Policy GA: advisory warnings vs mandatory failures`). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/09-import-refactoring-and-drift.md:506`: Module 09 Proof Map claims `testMinimalRefreshSubgraph()` in `09-import-refactoring-and-drift.test.ts`. Minimal refresh is actually tested in `03-core-workflow-and-cli.test.ts`. → **Fix**: Update the proof map to reference the actual tests in `09-import-refactoring-and-drift.test.ts` (`declarative import blocks`, `deleting prevent_destroy block`, `removed block with destroy = false`, `out-of-band drift detection and planned reconciliation`). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/10-hcp-terraform-and-ci-workflows.md:498-500`: Module 10 Proof Map lists `testAtlantisLockingEngine()`, `testHttpBackendProtocol()`, and `testOidcTokenExchange()`. None of these functions exist in `10-hcp-terraform-and-ci-workflows.test.ts`. → **Fix**: Update Module 10 Proof Map to reflect the actual 3 tests present in `10-hcp-terraform-and-ci-workflows.test.ts` (`cryptographic plan artifact verification between plan and apply`, `speculative plans in PR workflows do not acquire state locks`, `HCP Terraform variable sets hierarchy: organization vs project vs workspace scope`). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/11-provider-internals-and-plugin-framework.md:528-530`: Module 11 Proof Map lists `testReadDriftRemoval()` and `testInconsistentPlanDetection()`. Neither exists in `11-provider-internals-and-plugin-framework.test.ts`. → **Fix**: Update Module 11 Proof Map to reflect the actual tests in `11-provider-internals-and-plugin-framework.test.ts` (`provider schema validation and diagnostics`, `plan modifiers: UseStateForUnknown retains prior state when config is unchanged`, `CRUD lifecycle simulation: Create, Read, Update, Delete`). Source: `REVIEW.md` § A.

- [x] **P1** `technologies/terraform/modules/12-production-architecture-and-opentofu.md:486-488`: Module 12 Proof Map lists `testDistributedLockingFencing()` and `testVersionMatrixParity()`. Neither exists in `12-production-architecture-and-opentofu.test.ts`. → **Fix**: Update Module 12 Proof Map to reflect the actual tests in `12-production-architecture-and-opentofu.test.ts` (`blast radius comparison: monolithic state vs segmented per-environment state`, `OpenTofu 1.13 native state encryption with AES-256-GCM and PBKDF2`, `OpenTofu dynamic prevent_destroy evaluation vs Terraform static constraint`, `production gotcha: state divergence when mixing Terraform >= 1.6 and OpenTofu`). Source: `REVIEW.md` § A.

---

### P2 (Inconsistencies & Glossary Drift)

- [x] **P2** `technologies/terraform/GLOSSARY.md:21`: Line 21 translates "Fencing Token" as `"Oplocovací token"`. This is an unestablished, invented machine-translation neologism (translating fencing as building a garden fence), violating `AGENTS.md` § Terminology and Glossary Discipline rule 1 ("Never invent neologisms or colloquial translations") and `REVIEW.md` § E ("Czech terms are established, not invented"). Root `GLOSSARY.md:62` establishes `"Ohraničující token (fencing token)"` with a formal definition. → **Fix**: Replace `"Oplocovací token"` with root's canonical `"Ohraničující token (fencing token)"` and align definition verbatim with root `GLOSSARY.md:62`. Source: `GLOSSARY.md:62`.

- [x] **P2** `technologies/terraform/GLOSSARY.md:13,22`: Glossary definitions for shared root concepts diverge from root `GLOSSARY.md` instead of matching verbatim per `AGENTS.md` § Terminology and Glossary Discipline rule 2 and `REVIEW.md` § E:
  - Line 13: `Idempotence` defines: `"Property where applying the same configuration multiple times results in the exact same system state."` Root `GLOSSARY.md:17` defines: `"The property of an operation where multiple identical executions yield the exact same system state as a single execution (f(f(x)) = f(x))."`
  - Line 22: `Lease` defines: `"Time-bound exclusive grant of authority over a resource or lock."` Root `GLOSSARY.md:61` defines: `"A time-bounded grant of authority or lock ownership that expires automatically after a fixed time-to-live unless renewed by the holder."` → **Fix**: Align definitions and Czech terms for `Idempotence` and `Lease` to match root `GLOSSARY.md:17,61` verbatim. Source: `GLOSSARY.md`.

- [x] **P2** `technologies/terraform/GLOSSARY.md:41`: Line 41 translates "Blast Radius" as `"Radgus dopadu"`. This is an obvious typographical error for `"Rádius dopadu"`. → **Fix**: Correct typo to `"Rádius dopadu"`. Source: `GLOSSARY.md`.

- [x] **P2** `technologies/terraform/exams/terraform-associate-004.md:21,25`: The domain coverage matrix in lines 21 and 25 states:
  - `D4 | ... | 22% / 14 Qs`
  - `D8 | ... | 10% / 5 Qs` In reality, the question bank contains 12 questions for D4 (Q-TFA-025 to Q-TFA-036) and 7 questions for D8 (Q-TFA-059 to Q-TFA-065). → **Fix**: Correct the question counts in the table to `D4: 12 Qs` and `D8: 7 Qs` so they match the actual question bank. Source: `exams/terraform-associate-004.md`.

- [x] **P2** `technologies/terraform/CHEATSHEET.md:37,38`: Lines 37-38 have invalid markdown code formatting with trailing double backticks:
  - Line 37: `ignore_changes = [tags]```
  - Line 38: `replace_triggered_by = [terraform_data.trigger]``` → **Fix**: Fix trailing backticks so each inline code span is properly closed with a single backtick. Source: `CHEATSHEET.md`.

- [x] **P2** `technologies/terraform/CHEATSHEET.md:26`: Line 26 has an unmatched closing parenthesis: `{for k, v in var.map : k => upper(v))}`. → **Fix**: Remove the extraneous parenthesis: `{for k, v in var.map : k => upper(v)}`. Source: `CHEATSHEET.md`.

- [x] **P2** `technologies/terraform/CHEATSHEET.md:24`: Line 24 lists `var.instances[*.id]` as "attr splat". This is syntactically invalid HCL. In HCL, legacy attribute splat is `var.instances.*.id`, while modern full splat is `var.instances[*].id`. → **Fix**: Correct to `var.instances.*.id (legacy attribute splat) vs. var.instances[*].id (full splat)`. Source: https://developer.hashicorp.com/terraform/language/expressions/splat.

- [x] **P2** `technologies/terraform/CHEATSHEET.md:15`: Line 15 documents the flag as `-gen-config-out=...`. The actual Terraform CLI flag is `-generate-config-out=...`. → **Fix**: Correct flag to `-generate-config-out=...`. Source: https://developer.hashicorp.com/terraform/cli/commands/plan#generate-config-out.

---

### P3 (Polish)

- [x] **P3** `technologies/terraform/exams/terraform-associate-004.md:1115,1261`: Questions Q-TFA-058 and Q-TFA-065 repeat `· hands-on · hands-on` twice in the header tag, and both place an extra H3 heading `### Hands-On Task: ...` directly beneath the question header, which deviates from standard question bank heading structure. → **Fix**: Remove the duplicate `· hands-on` tag and remove the redundant subordinate H3 heading. Source: `exams/terraform-associate-004.md`.

- [x] **P3** `technologies/terraform/GLOSSARY.md:32`: Line 32 gives `"Ephemérní hodnota"` with an erroneous "h". Standard Czech terminology is `"Efemérní hodnota"`. → **Fix**: Correct spelling to `"Efemérní hodnota"`. Source: `GLOSSARY.md`.

---

## Technical Audit & Verification Notes

1. **Deterministic Test Verification**:
   - `mise exec -- npm test`: 57 hermetic tests pass cleanly in 612ms.
   - `mise exec -- npm run typecheck`: clean TypeScript 7.0.2 emit check (0 errors).
   - `mise exec -- npm run lint`: oxlint passed with 0 errors across 14 files.
   - `mise exec -- npm run fmt:check`: oxfmt passed with 0 errors across 34 files.
   - `node tools/wrap-check/check.mjs`: 0 wrapped lines in 0 files.
   - `node tools/table-check/check.mjs`: 29 tables, 0 failing.
   - `node tools/mermaid-check/check.mjs`: 31 diagrams, 0 failing across Mermaid 11 & 12.
   - `node tools/link-check/check.mjs`: 169 links, 0 broken.
   - KaTeX check: 207 math expressions parsed cleanly with zero syntax errors.
   - `examples/ts/integration/01-live-cli.test.ts`: hermetically executes or skips cleanly when CLI binaries are not on host.

2. **Syllabus & Gotcha Coverage**: All 16 production gotchas and failure modes from the task brief are implemented with executable proofs in `examples/ts/lib/terraform-model.ts` and verified by unit tests in `examples/ts/*.test.ts`:
   - `count` index shifting vs `for_each` stable addressing: verified in `04-providers-resources-and-lifecycle.test.ts`.
   - Plaintext secret persistence in state despite `sensitive = true`: verified in `05-variables-outputs-validation-and-secrets.test.ts`.
   - Ephemeral values and write-only arguments omitted from state: verified in `05-variables-outputs-validation-and-secrets.test.ts`.
   - Unreviewed drift applied in CI without saved plans: verified in `03-core-workflow-and-cli.test.ts`.
   - `force-unlock` split-brain state corruption: verified in `06-state-internals-and-backends.test.ts`.
   - Targeted apply (`-target`) downstream drift risk: verified in `01-iac-and-terraform-model.test.ts`.
   - `ignore_changes = all` drift blindness: verified in `04-providers-resources-and-lifecycle.test.ts`.
   - `create_before_destroy` unique naming collision deadlocks: verified in `04-providers-resources-and-lifecycle.test.ts`.
   - Child modules with internal provider blocks blocking `count`/`for_each`: verified in `04-providers-resources-and-lifecycle.test.ts`.
   - Data source with `depends_on` deferring read to apply time: verified in `04-providers-resources-and-lifecycle.test.ts`.
   - Renaming resources without `moved` blocks causing destructive churn: verified in `07-module-design-and-composition.test.ts`.
   - Deleting `prevent_destroy` block from config destroying resource: verified in `09-import-refactoring-and-drift.test.ts`.
   - `removed` blocks with `destroy = false`: verified in `09-import-refactoring-and-drift.test.ts`.
   - Monolithic state vs tiered micro-state blast radius: verified in `12-production-architecture-and-opentofu.test.ts`.
   - OpenTofu AES-256-GCM client-side state encryption: verified in `12-production-architecture-and-opentofu.test.ts`.
   - State divergence when mixing Terraform >= 1.6 and OpenTofu: verified in `12-production-architecture-and-opentofu.test.ts`.

3. **Policy-as-Code Coverage (Module 08)**: Module 08 satisfies all curriculum requirements for Policy-as-Code:
   - Full coverage of `terraform test` (`.tftest.hcl`, mock providers, state overrides, `expect_failures`).
   - OPA/Rego policy engine evaluation of plan JSON files (`conftest`).
   - Non-Turing-complete Common Expression Language (CEL) syntax and evaluation mechanics.
   - Kubernetes-native policy evaluation (Kyverno vs Gatekeeper vs in-tree ValidatingAdmissionPolicy).
   - HashiCorp Sentinel and Terraform 1.17 GA native policy checking (`-policies`).

4. **Exam Deltas & Spot-Check**:
   - All 12 modules contain explicit, high-visibility "Exam Delta" callouts differentiating Terraform Associate 004 (Terraform 1.12 baseline) from modern features (Terraform 1.16/1.17 and OpenTofu 1.13).
   - 15 questions across D1-D8 spot-checked in `exams/terraform-associate-004.md` confirmed technically accurate answers, rigorous distractor explanations, and valid module/documentation references.

---

## Resolution (author fills)

- [x] P1 #1 fixed in working tree (verified)
- [x] P1 #2 fixed in working tree (verified)
- [x] P1 #3 fixed in working tree (verified)
- [x] P1 #4 fixed in working tree (verified)
- [x] P1 #5 fixed in working tree (verified)
- [x] P1 #6 fixed in working tree (verified)
- [x] P1 #7 fixed in working tree (verified)
- [x] P1 #8 fixed in working tree (verified)
- [x] P1 #9 fixed in working tree (verified)
- [x] P1 #10 fixed in working tree (verified)
- [x] P1 #11 fixed in working tree (verified)
- [x] P1 #12 fixed in working tree (verified)
- [x] P2 #1 fixed in working tree (verified)
- [x] P2 #2 fixed in working tree (verified)
- [x] P2 #3 fixed in working tree (verified)
- [x] P2 #4 fixed in working tree (verified)
- [x] P2 #5 fixed in working tree (verified)
- [x] P2 #6 fixed in working tree (verified)
- [x] P2 #7 fixed in working tree (verified)
- [x] P2 #8 fixed in working tree (verified)
- [x] P3 #1 fixed in working tree (verified)
- [x] P3 #2 fixed in working tree (verified)
