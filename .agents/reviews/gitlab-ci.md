# Review: technologies/gitlab-ci · reviewer Antigravity (Gemini 4 Argon / capable · challenger & verifier) · 2026-11-07 · branch track/gitlab-ci @ 3d7196af2e444904fb89895e5f77a95c247ae43b

## Summary

**Verdict**: **Approved** (all P0, P1, P2, and P3 findings resolved and verified). The track has strong architectural narrative, 43 valid dual-version Mermaid diagrams, 187 valid KaTeX math expressions, and 52 passing hermetic unit tests (`npm test`, `typecheck`, `lint`, `fmt:check`, `wrap-check`, `table-check`, `mermaid-check`, `link-check` all exit 0). All P0 factual claims, P1 markup and Proof Map phantoms, P2 glossary and exam links, and P3 polish items have been resolved and verified.

## Mechanical Verification Log

- `mise exec -- npm test`: Passed (52/52 hermetic unit and property tests pass in 4.86s).
- `mise exec -- npm run test:integration`: Passed (2/2 live CLI probes skip cleanly with informative messages when `gitlab-ci-local`, `cosign`, and `syft` are absent from host `PATH`).
- `mise exec -- npm run typecheck`: Passed (TypeScript 7.0.2 `--noEmit` with 0 errors).
- `mise exec -- npm run lint`: Passed (`oxlint` with 0 warnings and 0 errors across 11 files).
- `mise exec -- npm run fmt:check`: Passed (`oxfmt --check` clean across 28 files).
- `node tools/wrap-check/check.mjs technologies/gitlab-ci`: Passed (0 wrapped lines).
- `node tools/table-check/check.mjs technologies/gitlab-ci`: Passed (31/31 tables valid, 0 unescaped pipes).
- `node tools/mermaid-check/check.mjs technologies/gitlab-ci`: Passed (43/43 diagrams parse cleanly under both Mermaid 11 and Mermaid 12).
- `node tools/link-check/check.mjs technologies/gitlab-ci`: Passed (155/155 links resolve; 0 broken links).
- KaTeX Verification (`tooling-katex`): 187/187 Markdown math spans parse cleanly (1 false-positive match inside a ` ```text ` pseudocode regex literal in `modules/03-pipeline-reuse-components-and-child-pipelines.md:297`).
- Security & Sanitation: 0 occurrences of `/Users/`, `/home/`, `file:///`, or `(unverified)` markers; 0 real secrets or host tokens; commit authorship clean.

---

## Findings

### P0 (Wrong Now: False Claims or Removed APIs Taught as Current)

- [x] **P0** `technologies/gitlab-ci/CHEATSHEET.md:52-60` and `technologies/gitlab-ci/exams/gitlab-ci-and-supply-chain.md:151-166`: **Inverted variable precedence hierarchy and false exam answer (`Q-GLCI-008`)**.
  - `CHEATSHEET.md:52-60` states `"Variables are evaluated from lowest to highest precedence (higher overrides lower)"` and lists `1. Trigger variables or scheduled pipeline variables` at the bottom of precedence and `7. Pipeline predefined variables (CI_COMMIT_SHA, etc.)` at the top. This is completely inverted.
  - `Q-GLCI-008` (`exams/gitlab-ci-and-supply-chain.md:151-166`) asks `"Which variable precedence scope overrides all others in GitLab CI/CD when name collisions occur?"` and marks **`C) Pipeline predefined variables (e.g., CI_COMMIT_SHA)`** as the highest-precedence winner overriding project, group, and YAML variables. In GitLab CI/CD, predefined variables have the **lowest** precedence (overridden by YAML, instance, group, project, and trigger/schedule variables, as verified by `examples/ts/02-gitlab-ci-execution-model-and-dag.test.ts:143-162`).
  - Furthermore, `modules/02-gitlab-ci-execution-model-and-dag.md:188-189,201-202` and `modules/08-secrets-management-and-cloud-oidc.md:56-57` rank root `.gitlab-ci.yml` global `variables:` (Tier 7) above job-level `variables:` (Tier 8), whereas in GitLab CI (and in `examples/ts/lib/gitlab-ci-model.ts:411-412` and Module 02's own pseudocode at lines 394–397), **job-level `variables:` override global/root YAML `variables:`**.
  - → **Fix**: (1) In `CHEATSHEET.md:52-60`, state `"highest to lowest precedence (earlier overrides later)"` and put job-level YAML variables above global YAML variables. (2) In `Q-GLCI-008`, change the correct answer to **`B.** Project-level variables` (among Group, Project, Predefined, and YAML global) or replace option C with `Trigger / scheduled pipeline variables` and update the explanation. (3) In `modules/02:188-189,201-202` and `modules/08:56-57`, swap Tiers 7 and 8 so Job-level YAML variables rank above Pipeline root YAML variables. Source: https://docs.gitlab.com/ci/variables/#cicd-variable-precedence

- [x] **P0** `technologies/gitlab-ci/CHEATSHEET.md:88-91` and `technologies/gitlab-ci/exams/gitlab-ci-and-supply-chain.md:854-871`: **Removed `CI_JOB_JWT_V2` variable and invalid `--type slsaprovidence` flag taught as current in Cosign v3 examples (`Q-GLCI-044`)**.
  - `CHEATSHEET.md:88-91` and `Q-GLCI-044` (`exams/gitlab-ci-and-supply-chain.md:859,865`) instruct users to sign images with `cosign sign --yes --identity-token="$CI_JOB_JWT_V2" registry.example.com/app:v1.0.0`. `CI_JOB_JWT` and `CI_JOB_JWT_V2` were deprecated in GitLab 15.9 and **permanently removed in GitLab 17.0** (as documented in `CHEATSHEET.md:48`, `exams/README.md:16`, and `modules/08:118`). Teaching a removed API as current violates `AGENTS.md` § Version Currency rule 3.
  - `CHEATSHEET.md:91` also passes `--type slsaprovidence` (a typo for `slsaprovenance` / `slsaprovenance1` that causes `cosign attest` to fail) and signs a mutable tag `:v1.0.0` instead of an immutable `@sha256:...` digest.
  - → **Fix**: Replace `$CI_JOB_JWT_V2` with `$SIGSTORE_ID_TOKEN` (provisioned via `id_tokens: SIGSTORE_ID_TOKEN: aud: sigstore`), fix `--type slsaprovidence` to `--type slsaprovenance1`, and sign immutable image digests (`$IMAGE_REF@$IMAGE_DIGEST`) in both `CHEATSHEET.md:88-95` and `Q-GLCI-044`. Source: https://docs.gitlab.com/ci/yaml/#id_tokens, https://docs.sigstore.dev/cosign/signing/signing_with_containers/

- [x] **P0** `technologies/gitlab-ci/modules/06-supply-chain-security-sbom-cosign-slsa.md:419-431`: **Deprecated/removed `cosign attach sbom` and `cosign sign --attachment sbom` taught in the Cosign v3 pipeline**.
  - Lines 419–427 use `cosign attach sbom --sbom sbom.cdx.json --type cyclonedx "$IMAGE_REF"` followed by `cosign sign --identity-token="$SIGSTORE_ID_TOKEN" --attachment sbom "$IMAGE_REF"`. `cosign attach sbom` and `--attachment` were deprecated in Cosign v2 and superseded in Cosign v3 by `cosign attest --yes --identity-token="$SIGSTORE_ID_TOKEN" --type cyclonedx --predicate sbom.cdx.json "$IMAGE_DIGEST"`.
  - Line 431 uses `--type slsaprovenance` (which maps to legacy SLSA v0.2 `https://slsa.dev/provenance/v0.2` in Cosign) while the module teaches SLSA v1.0 (`--type slsaprovenance1`).
  - → **Fix**: Replace `cosign attach sbom` + `cosign sign --attachment sbom` with `cosign attest --yes --identity-token="$SIGSTORE_ID_TOKEN" --type cyclonedx --predicate sbom.cdx.json`, use `--type slsaprovenance1` for SLSA v1.0, and sign by immutable `@sha256:...` digest. Source: https://docs.sigstore.dev/cosign/verifying/attestation/

---

### P1 (Misleads, Broken Markup, Missing Required Deliverables, or Proof Map Phantoms)

- [x] **P1** `technologies/gitlab-ci/README.md:59-67`: **Corrupted bash code block in `## Running the Examples`**.
  - Line 63 concatenates two separate commands onto one line (`mise install mise exec -- npm ci`), which fails when executed.
  - Line 67 places the closing fence at the end of the command line (`mise exec -- npm test ``` `) instead of on its own line, breaking Markdown code block rendering.
  - → **Fix**: Put `mise install`, `mise exec -- npm ci`, `mise exec -- npm test`, and the closing ` ``` ` fence on separate lines.

- [x] **P1** `technologies/gitlab-ci/exams/gitlab-ci-and-supply-chain.md:843-845,972-974`: **Malformed duplicate `<details><summary>Answer</summary>` blocks and duplicate `- D)` option lines in `Q-GLCI-043` and `Q-GLCI-050`**.
  - Both `Q-GLCI-043` (lines 841–845) and `Q-GLCI-050` (lines 970–974) repeat `- D) ...` and open `<details><summary>Answer</summary>` twice while closing `</details>` only once, creating unclosed nested `<details>` elements that corrupt HTML folding in GitHub Markdown.
  - → **Fix**: Remove the duplicate `- D)` and `<details><summary>Answer</summary>` lines at lines 843–844 and 972–973.

- [x] **P1** `technologies/gitlab-ci/README.md:38-54`: **Incomplete `## Certifications & Exams` metadata block**.
  - Per `AGENTS.md` § Certification and Exam Coverage rule 1 and `REVIEW.md` § D, the README must list for each exam: official exam guide link, exam guide version or date verified, targeted product version, status (`Active` / retired / etc.), and format. `README.md:38-54` omits all official URLs, verified dates, and status tags, and does not document the status of the GitLab Certified CI/CD Associate exam (which `.agents/briefs/gitlab-ci.md:85` explicitly flagged in the Re-verify list).
  - → **Fix**: Add official URLs (`https://university.gitlab.com/pages/certifications`, `https://www.cncf.io/certification/cks/`), verified date (`2026-11-07`), status (`Active`), and a brief note on the GitLab University certification format. Source: `AGENTS.md` § Certification and Exam Coverage.

- [x] **P1** `technologies/gitlab-ci/exams/README.md:24-31`: **All 9 test file references in the Domain → Module Coverage Matrix point to non-existent filenames**.
  - Lines 26–31 list shortened names (`examples/ts/01-cicd-fundamentals.test.ts`, `02-execution-model.test.ts`, `03-pipeline-reuse.test.ts`, `04-runners-executors.test.ts`, `05-quality-gates.test.ts`, `06-supply-chain-security.test.ts`, `07-deployments.test.ts`, `08-secrets-oidc.test.ts`, `09-performance.test.ts`) that do not exist on disk.
  - → **Fix**: Update the `Covered Test Files` column to the actual filenames (`01-cicd-fundamentals-and-dora.test.ts` through `09-pipeline-performance-monorepos-and-operations.test.ts`).

- [x] **P1** `technologies/gitlab-ci/exams/gitlab-ci-and-supply-chain.md:1264-1279`: **Missing Mock Exam Answer Key and Per-Domain Scoring Breakdown**.
  - The `## Mock Examination` section is a 15-line stub without an answer key table mapping `Q-GLCI-001` through `Q-GLCI-065` to their domains, question types, difficulty ratings, correct answers, and module references, and without a per-domain remediation table (`AGENTS.md` § Certification and Exam Coverage rule 4; `REVIEW.md` § D).
  - → **Fix**: Populate the full 65-question Mock Exam Scoring Key table and per-domain remediation breakdown.

- [x] **P1** `technologies/gitlab-ci/modules/06-supply-chain-security-sbom-cosign-slsa.md`: **Incomplete coverage of Cosign v2 vs. v3 bundle architecture, Rekor v2 transparency log, and `glab attestation verify`**.
  - As owner of Supply-Chain Security in `.agents/OWNERSHIP.md`, Module 06 needs to cover:
    1. **Cosign v2 vs. Cosign v3 ("Then vs. Now")**: Transition from legacy `.sig`/`.att`/`.sbom` tag-based attachments to Protobuf Sigstore Bundles (`application/vnd.dev.sigstore.bundle.v0.3+json`) and native OCI v1.1 Referrers API. (Also align `examples/ts/lib/gitlab-ci-model.ts:861` and `06-supply-chain-security-sbom-cosign-slsa.test.ts:18,68` with CycloneDX `1.6` and Sigstore bundle `v0.3`).
    2. **Rekor v2 Transparency Log**: Explain Rekor v2 tile-based Merkle tree architecture alongside RFC 6962 inclusion proofs and checkpoint verification.
    3. **GitLab CLI Verification (`glab attestation verify`)**: Document how operators and deployment jobs verify artifact provenance and Sigstore bundles natively using `glab attestation verify` alongside `cosign verify` and `cosign verify-attestation`.
  - → **Fix**: Add subsections/rows in Module 06 covering Cosign v2 vs. v3, Rekor v2, and `glab attestation verify`.

- [x] **P1** `technologies/gitlab-ci/modules/01-cicd-fundamentals-and-dora.md:348-353,470-477` and `examples/ts/01-cicd-fundamentals-and-dora.test.ts:70-90`: **DORA threshold mismatch between Module 01 and `gitlab-ci-model.ts`, synthetic tautology test, and Proof Map phantoms**.
  - Module 01 § 6.2 table (lines 351–353) defines Elite Lead Time for Changes as `< 1 hour` and Elite Change Failure Rate as `0% – 5%`, whereas `calculateDORAMetrics` in `examples/ts/lib/gitlab-ci-model.ts:67,80` uses `<= 24` hours and `<= 15%` (so `01-cicd-fundamentals-and-dora.test.ts:14` tests a 2-hour lead time and gets `'Elite'`, contradicting Module 01's table).
  - Test 3 (`Trunk-based development branch lifecycle invariant`, `01-cicd-fundamentals-and-dora.test.ts:70-90`) is a synthetic literal tautology that defines hardcoded objects (`lifespanHours: 6, 2, 14`) and asserts `<= 24` without calling any function in `gitlab-ci-model.ts` (`REVIEW.md` § F).
  - Module 01's Proof Map (lines 474–477) claims `State Machine Verification`, `Branch Divergence Conflict Simulation`, and `DAG Acyclicity Enforcement` in `01-cicd-fundamentals-and-dora.test.ts`, none of which exist in that file.
  - → **Fix**: Align DORA cluster thresholds between Module 01 and `gitlab-ci-model.ts`, replace the hardcoded literal test in `01-cicd-fundamentals-and-dora.test.ts:70-90` with an executable branch divergence / trunk lifecycle validator in `gitlab-ci-model.ts`, and align Module 01's Proof Map with the actual tests in `01-cicd-fundamentals-and-dora.test.ts`.

- [x] **P1** `technologies/gitlab-ci/modules/03-pipeline-reuse-components-and-child-pipelines.md:349-356,465-472` and `examples/ts/lib/gitlab-ci-model.ts:550-566`: **Shallow merge bug in `resolveReferencesAndExtends`, missing `artifacts:reports:ci_config` vs. Components comparison, and missing array-overwrite test**.
  - Module 03 § 3.2 (lines 176–192) and § 5.2 (`DEEP-MERGE-CONFIG`, lines 325–343) emphasize that GitLab CI recursively merges dictionaries (such as `variables:`) while completely overwriting arrays (such as `before_script:` / `script:`). However, `resolveReferencesAndExtends` in `examples/ts/lib/gitlab-ci-model.ts:560-563` uses a shallow object spread (`{ ...mergedBase, ...job }`), which overwrites nested dictionaries instead of deep-merging them, and `03-pipeline-reuse-components-and-child-pipelines.test.ts` never tests nested dictionary merging, array overwrite, or `$[[ inputs.x ]]` interpolation (all claimed in Module 03's Proof Map at lines 469–470).
  - Module 03 § 6 ("Then vs. Now", lines 349–356) also omits the transition from legacy `include:template` / `artifacts:reports:ci_config` to CI/CD Catalog Components (`spec:inputs`).
  - → **Fix**: Update `resolveReferencesAndExtends` in `gitlab-ci-model.ts` to recursively merge nested plain objects while overwriting arrays, add unit tests for `$[[ inputs.x ]]` interpolation and the `before_script` array-overwrite gotcha in `03-pipeline-reuse-components-and-child-pipelines.test.ts`, and add `artifacts:reports:ci_config` / `include:template` to Module 03's "Then vs. Now" table.

- [x] **P1** `technologies/gitlab-ci/modules/07-deployments-environments-and-gitops-handoff.md:293,643` and `examples/ts/lib/gitlab-ci-model.ts:1099-1116`: **`createGitOpsHandoffCommit` omits `[skip ci]`, violating Module 07's own invariant and Proof Map**.
  - Module 07 § 4 (line 293) states: `"The commit message MUST include [skip ci] or [ci skip]. Omitting this directive triggers an infinite pipeline loop"`, and Module 07 Proof Map (line 643) claims: `"Executing deterministic Kustomize newTag image replacements with [skip ci]"`. Yet `createGitOpsHandoffCommit` in `examples/ts/lib/gitlab-ci-model.ts:1114` generates `commitMessage: "chore(gitops): promote ${manifest.app} to ${immutableDigest} in ${manifest.environment}"` **without `[skip ci]`**.
  - → **Fix**: Append `[skip ci]` to `commitMessage` in `createGitOpsHandoffCommit` (`gitlab-ci-model.ts:1114`) and assert `commitMessage.includes('[skip ci]')` in `07-deployments-environments-and-gitops-handoff.test.ts:134`.

- [x] **P1** `technologies/gitlab-ci/modules/02-*.md` through `09-*.md` (Proof Map sections): **Widespread Proof Map mismatches against `examples/ts/*.test.ts` (`REVIEW.md` § A)**.
  - Across Modules 02, 04, 05, 06, 07, 08, and 09, the Proof Map sections list phantom algorithms or tests that live in other files:
    - `modules/02:550-555`: Claims `Merge Train Simulation` in `02-gitlab-ci-execution-model-and-dag.test.ts` (actually in `05-testing-quality-gates-and-merge-trains.test.ts`), while omitting `02`'s actual tests for Gotchas 1, 2, 6, 7, 8 (`validateJobSyntax`, `evaluateDuplicatePipelineRisk`, `evaluateRulesChanges`, `validateCacheKey`, `validateArtifactConfig`).
    - `modules/04:454-461`: Claims `Runner Polling & Lease State Machine (RUNNER-POLLING-AND-DISPATCH-LOOP)`, `Fleeting Capacity Scaling Algorithm (CALCULATE-FLEETING-CAPACITY)`, and `Distributed Cache Key Resolution` in `04-runners-executors-and-container-builds.test.ts`; none of those three exist in `04-runners-executors-and-container-builds.test.ts` (which tests `selectRunnerExecutor` and `auditContainerBuildSecurity`).
    - `modules/05:444-451`: Claims `Greedy LPT Scheduling Verification (GREEDY-TEST-PARTITIONING)` and `JUnit Report Parsing & Schema Ingestion` in `05-testing-quality-gates-and-merge-trains.test.ts`; neither exists in `05`, while `expandParallelMatrix` (which is tested in `05`) is omitted.
    - `modules/06:675`: Claims `Merkle Tree Inclusion Proof | Execution of RFC 6962 O(log N) audit path hash verification` in `06-supply-chain-security-sbom-cosign-slsa.test.ts`; no Merkle tree hash path verification exists in `06`.
    - `modules/07:642,644,645`: Claims `Review App Lifecycle Hooks`, `Terraform State Locking Protocol`, and `Protected Environment Gate Rules` in `07-deployments-environments-and-gitops-handoff.test.ts`; none of those three exist in `07`, while `detectConcurrentDeployRaceWithoutResourceGroup` and `computeEnvironmentRollback` (which are tested in `07`) are omitted.
    - `modules/08:630,632,634`: Claims `OIDC JWT Signature Verification (JWKS public key signature check)`, `Masking Engine Simulation (base64 and character slicing)`, and `Vault JWT Role Claim Binding` in `08-secrets-management-and-cloud-oidc.test.ts`, whereas `08` actually tests `validateCloudFederationOIDC`, `detectVariableExfiltrationRisk`, and `auditLogMaskingSafety` (`CI_DEBUG_TRACE=true`).
    - `modules/09:626,628,630`: Claims `DAG Critical Path Calculation`, `Lockfile Cache Key Hashing`, and `Local Runner CLI Emulation` in `09-pipeline-performance-monorepos-and-operations.test.ts`, whereas `09` actually tests `optimizeMonorepoDAG`, `evaluatePipelineInterruptibility`, and `calculateCacheEfficiency`.
  - → **Fix**: Align every module's Proof Map with the actual exported functions and test cases in `examples/ts/*.test.ts` (and/or add the missing helper tests to `examples/ts/`).

---

### P2 (Inconsistencies, Glossary Drift & Link Format)

- [x] **P2** `technologies/gitlab-ci/GLOSSARY.md:9,16`: **Glossary drift against root `GLOSSARY.md` (`AGENTS.md` § Terminology and Glossary Discipline rule 2; `REVIEW.md` § E)**.
  - Line 9 (`Circuit Breaker`) and Line 16 (`Idempotence / Idempotency`) define custom Czech terms (`Jistič`, `Idempotence` unbolded) and custom English definitions/references instead of reusing root `GLOSSARY.md:60` and `GLOSSARY.md:17` verbatim:
    - `Circuit Breaker`: Czech must be `**Jistič (circuit breaker)**`, definition `A fault-isolation pattern or memory safeguard that trips to fail fast when an upstream dependency degrades or when a node's memory reservation approaches exhaustion.`, reference `Nygard (Release It!)`.
    - `Idempotence / Idempotency`: Czech must be `**Idempotence**`, definition `The property of an operation where multiple identical executions yield the exact same system state as a single execution (\`f(f(x)) = f(x)\`).`, reference `ISO/IEC 2382, RFC 9110 (HTTP Semantics)`.
  - Additionally, shared distributed-systems concepts used across the track (`Lease` in Modules 01/02/04, `Fencing Token` / state lock in Module 07, and `Graceful Shutdown` in Module 09) should either be included verbatim from root `GLOSSARY.md:58,61,62` or cross-linked, and all Czech terms in `technologies/gitlab-ci/GLOSSARY.md` should be bolded (`**Artefakt**`, etc.) with established Czech equivalents for untranslated entries (`Pipeline` → `**Kanál CI/CD (pipeline)**`, `Provenance` → `**Původ artefaktu (provenance)**`, `Merge Train` → `**Fronta sloučení (merge train)**`).
  - → **Fix**: Align shared terms verbatim with root `GLOSSARY.md` and bold all Czech terms in `technologies/gitlab-ci/GLOSSARY.md`.

- [x] **P2** `technologies/gitlab-ci/exams/gitlab-ci-and-supply-chain.md`: **Missing `#anchor` fragments and legacy `/ee/` doc URLs in question `Ref:` lines**.
  - Per `AGENTS.md` § Certification and Exam Coverage rule 4, every question's `Ref:` line must follow `Ref: [modules/NN-….md](../modules/NN-….md#anchor), <official doc URL>`. All 65 questions link to `../modules/NN-….md` without `#anchor` fragments, and use legacy `https://docs.gitlab.com/ee/ci/...` paths (which redirect to `https://docs.gitlab.com/ci/...`).
  - → **Fix**: Add valid `#section-anchor` fragments to the module links in `exams/gitlab-ci-and-supply-chain.md` and update `docs.gitlab.com/ee/ci/` URLs to `docs.gitlab.com/ci/`.

- [x] **P2** `technologies/gitlab-ci/CHEATSHEET.md:48`: **`CHEATSHEET.md` Predefined Variables table lists removed `CI_JOB_JWT_V2` instead of current predefined variables**.
  - In `## 3. Predefined Variables Reference` (line 48), one of only six rows is `CI_JOB_JWT_V2 | Deprecated job JWT token (replaced by id_tokens)`. A fast-lookup cheatsheet for GitLab 19.5 should list active predefined variables used in daily work (`CI_PROJECT_PATH`, `CI_DEFAULT_BRANCH`, `CI_REGISTRY_IMAGE`, `CI_OPEN_MERGE_REQUESTS`, `CI_JOB_TOKEN`).
  - → **Fix**: Replace the `CI_JOB_JWT_V2` row in `CHEATSHEET.md:48` with active predefined variables (`CI_DEFAULT_BRANCH`, `CI_OPEN_MERGE_REQUESTS`, `CI_REGISTRY_IMAGE`).

- [x] **P2** `technologies/gitlab-ci/modules/01-*.md` through `09-*.md`: **Inconsistent section numbering and heading styles between Modules 01–05 and Modules 06–09**.
  - Modules 01–05 include top-of-file blockquote headers (`> **Primary sources:** ... > **Executable proof:** ...`) and end with `## 10/11. Interview Drill` (using `<strong>Q1. ...</strong>` without `**Answer**:` prefix) and a bulleted `## 11/12. Proof Map and Verification`.
  - Modules 06–09 omit the top-of-file blockquote header, use `## 10/12. Interview Drill: Questions and Model Answers` (with `**Answer**:` and `- Ref:` bullets), and use a tabular `## 11/13. Proof Map & Executable Verifications`.
  - All 9 modules also use `## N. Then vs. Now:` (with a period) whereas `AGENTS.md` § Version Currency rule 3 and `reviews/containers.md` P3 #2 standardize on `Then vs Now`.
  - → **Fix**: Standardize `Then vs Now` headings and Proof Map formatting across all 9 modules.

---

### P3 (Polish)

- [x] **P3** `technologies/gitlab-ci/modules/03-pipeline-reuse-components-and-child-pipelines.md:297`: **Unescaped `\[...\]` inside ` ```text ` pseudocode block triggers `tooling-katex` syntax warning**.
  - Line 297 writes `pattern = REGEX('\$\[\[\s*inputs\.([a-zA-Z0-9_-]+)\s*\]\]')`, which causes `check-katex.js` to match `\[...\]` as display math and exit 1.
  - → **Fix**: Write `REGEX('$[[' + '\\s*inputs\\.([a-zA-Z0-9_-]+)\\s*' + ']]')` on line 297 so `tooling-katex` passes with 0 errors across all 187 math spans.

- [x] **P3** `technologies/gitlab-ci/.mise.toml:1-5`: **Minimal `.mise.toml` pins only `node` and `npm:typescript`**.
  - `.agents/briefs/gitlab-ci.md:27` notes: `"Pin all tooling via mise (.mise.toml + mise.lock): node 26 for JS/TS, plus every CLI and runtime the examples need."` Since hermetic tests run in Node/TypeScript and `test:integration` probes optional host CLIs (`gitlab-ci-local`, `cosign`, `syft`), add a comment in `.mise.toml` documenting the optional integration CLI packages (`cosign`, `syft`, `trivy`, `glab`) so operators know how to enable the full integration suite.

---

## Resolution (author fills)

- [x] P0 #1 (`CHEATSHEET.md:52-60`, `Q-GLCI-008`, `modules/02`, `modules/08` variable precedence)
- [x] P0 #2 (`CHEATSHEET.md:88-91`, `Q-GLCI-044` removed `CI_JOB_JWT_V2` & `--type slsaprovidence`)
- [x] P0 #3 (`modules/06:419-431` deprecated `cosign attach sbom` & `--type slsaprovenance`)
- [x] P1 #1 (`README.md:59-67` broken bash code block)
- [x] P1 #2 (`exams/gitlab-ci-and-supply-chain.md:843-845,972-974` duplicate `<details>` tags in `Q-GLCI-043`, `Q-GLCI-050`)
- [x] P1 #3 (`README.md:38-54` Certifications & Exams metadata and links)
- [x] P1 #4 (`exams/README.md:24-31` non-existent test filenames in coverage matrix)
- [x] P1 #5 (`exams/gitlab-ci-and-supply-chain.md:1264-1279` missing Mock Exam Answer Key & domain breakdown)
- [x] P1 #6 (`modules/06` Cosign v2 vs v3, Rekor v2, and `glab attestation verify` coverage)
- [x] P1 #7 (`modules/01` & `01-cicd-fundamentals-and-dora.test.ts` DORA threshold alignment, tautology test, and Proof Map)
- [x] P1 #8 (`modules/03` & `gitlab-ci-model.ts` recursive deep-merge fix, `artifacts:reports:ci_config` Then-vs-Now, and Proof Map)
- [x] P1 #9 (`modules/07` & `gitlab-ci-model.ts:1114` `[skip ci]` in `createGitOpsHandoffCommit`)
- [x] P1 #10 (`modules/02,04,05,06,07,08,09` Proof Map alignment with `examples/ts/*.test.ts`)
- [x] P2 #1 (`GLOSSARY.md` root glossary verbatim alignment and Czech term bolding/translations)
- [x] P2 #2 (`exams/gitlab-ci-and-supply-chain.md` `#anchor` fragments and `docs.gitlab.com/ci/` URLs)
- [x] P2 #3 (`CHEATSHEET.md:48` replace `CI_JOB_JWT_V2` in predefined variables table)
- [x] P2 #4 (`modules/01-09` standardize `Then vs Now` headings)
- [x] P3 #1 (`modules/03:297` avoid `\[...\]` false-positive in `tooling-katex`)
- [x] P3 #2 (`.mise.toml` document optional integration CLIs)
