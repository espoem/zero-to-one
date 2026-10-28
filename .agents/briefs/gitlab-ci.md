# Brief: GitLab CI (`technologies/gitlab-ci`)

| | |
|---|---|
| Phase | 3 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/gitlab-ci` · `../zto-gitlab-ci` |
| Depends on | technologies/containers |
| Research dossier | `.agents/research/E-platform.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- None beyond the dossier and AGENTS.md.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- CI/CD pipelines, SBOM, signing (cosign), SLSA provenance, OIDC-to-cloud from CI

**Cross-link only (do not re-explain):**
- Delivery semantics (at-most / at-least / effectively-once), idempotency theory → owned by `architecture/distributed-systems`
- OCI image/runtime/distribution specs, BuildKit, rootless, Docker vs Podman → owned by `technologies/containers`
- GitOps principles (OpenGitOps), Argo CD internals, Rollouts / progressive delivery → owned by `technologies/argocd`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### CI/CD with GitLab — `technologies/gitlab-ci` (recommended: yes)

- **Current stable version(s)**: GitLab **19.x** (19.0 released 2026-05-21 — https://www.businesswire.com/news/home/20260521893408/en/ ; monthly releases on the third Thursday, so 19.5 likely current as of Oct 2026 — **unverified**). gitlab-ci-local **4.77.0** (third-party local runner emulator). GitLab Runner version not verified.
- **Authoritative syllabi used**: GitLab CI/CD YAML reference https://docs.gitlab.com/ci/yaml/ ; GitLab CI/CD docs ToC https://docs.gitlab.com/ci/ ; GitLab certifications (GitLab Certified CI/CD Associate — current availability unverified); SLSA spec https://slsa.dev/ ; CKS "Supply Chain Security 20%" domain.
- **Proposed modules** (9):
  1. CI/CD fundamentals — CI vs CD vs continuous deployment, trunk-based dev, pipeline as code, DORA metrics.
  2. GitLab CI model — stages vs `needs` DAG, jobs, rules/workflow rules, variables precedence, predefined variables, artifacts vs cache (keys, fallback), pipelines types (branch, MR, merged-results, tag, scheduled).
  3. Reuse — `include` (local/project/remote/template), CI/CD **components & catalog**, `extends`, YAML anchors/`!reference`, `spec:inputs`, parent-child & multi-project pipelines, dynamic child pipelines.
  4. Runners — architecture (runner manager, executors: docker, kubernetes, shell, docker-autoscaler), concurrency, tags, caching in distributed runners, building images in CI (BuildKit rootless/kaniko alternatives, docker-in-docker risks).
  5. Testing & quality gates — test reports (JUnit), coverage, parallel/matrix jobs, flaky test handling, merge trains, MR approvals.
  6. Security & supply chain — SAST/DAST/dependency/container scanning, secret detection, SBOM, cosign keyless signing with GitLab OIDC `id_tokens`, SLSA provenance, protected branches/variables/environments.
  7. Deployments — environments, review apps, deployment approvals, `resource_group` (serialize deploys), rollbacks; GitOps handoff (bump tag in config repo → Argo CD); Terraform/OpenTofu plan/apply pipelines with GitLab-managed state.
  8. Secrets & cloud auth — masked/hidden/protected variables, OIDC federation to AWS/GCP/Azure/Vault (no long-lived keys), GitLab Secrets Manager (19.0 — unverified detail).
  9. Pipeline performance & operations — pipeline efficiency (DAG, `interruptible`, `rules:changes`), cache strategy, monorepo pipelines, cost, debugging (`CI_DEBUG_TRACE` dangers).
- **Gotchas & production failure modes** (short list): `rules:changes` on scheduled/tag pipelines evaluates true → everything runs; duplicate pipelines (branch + MR) without `workflow:rules`; `CI_DEBUG_TRACE` leaks masked variables into logs; unprotected variables available to any branch → secret exfiltration via MR; docker-in-docker privileged runners shared across projects = container escape risk; cache shared across branches poisoning builds; `artifacts:expire_in` defaults filling storage; `only/except` mixed with `rules` (not allowed); `needs` across stages skipping implicit artifact downloads; non-`interruptible` jobs wasting runners; concurrent deploys without `resource_group`.
- **Interview hot topics**: pipeline design for a monorepo; CI vs CD vs GitOps boundaries; secure secrets & OIDC; supply-chain security (SBOM/sign/provenance); caching vs artifacts; deployment strategies & rollback; flaky tests; DORA metrics.
- **Executable-proof strategy**: `gitlab-ci-local` 4.77.0 runs `.gitlab-ci.yml` jobs locally in Docker (deterministic for job scripts, rules evaluation approximated — flag differences). Pipeline config validation needs a GitLab instance (CI Lint API) → fallback: run GitLab CE in Docker (heavy, optional profile) or validate against the published CI JSON schema (check-jsonschema). `gitlab-runner exec` was deprecated/removed — don't rely on it. Cosign signing/verify and SBOM generation testable locally (cosign 3.1.4, syft, trivy 0.76.1). Components with `spec:inputs` tested by rendering includes in a local GitLab CE (optional).
- **Overlaps / dedupe**: image building internals → containers; deploy targets → kubernetes/argocd; Terraform pipelines → terraform module 12 cross-link; DevSecOps concepts shared with CKS module in kubernetes; GitHub Actions only as comparison table.

---

#### Context from `E-platform.md`

##### Structural decisions (summary)

| Question | Recommendation | Rationale |
|---|---|---|
| Docker vs Podman | **One track `technologies/containers`** | Both are front-ends over the same OCI image/runtime/distribution specs, same kernel primitives (namespaces, cgroups v2, overlayfs, seccomp), same runtimes (runc/crun). Splitting would duplicate ~70% of content. Tool differences (daemon vs daemonless, rootless defaults, Quadlet vs compose, Buildah/Skopeo) fit in 2 modules. |
| Kubernetes | **`technologies/kubernetes`**, prerequisite = containers | Single narrative covering CKA+CKAD; CKS content as late modules (security). |
| Argo CD | **Standalone `technologies/argocd`, scoped as "GitOps with Argo CD (+ Argo Rollouts)"** | Too deep (controller internals, sharding, ApplicationSets, hydrator, RBAC, multi-tenancy) to be one K8s module; but should not become an "all of Argo" track — CAPA is 36% Workflows + 12% Events, which are a different problem (batch/DAG). Cover CGOA (100%) + CAPA's Argo CD 34% + Rollouts 18%; Workflows/Events = one optional appendix module. Flux only as comparison. A separate `gitops` track is not justified (principles = 1 module). |
| Grafana / Kibana | **One track `technologies/observability`** (vendor-neutral spine: OTel + signals + SLOs; two backends: Grafana LGTM and Elastic) | The concepts (signals, cardinality, sampling, alerting, SLOs) are tool-independent; Grafana and Kibana are UIs over different stores. Boundary: the Elasticsearch track owns ES storage/indexing/mappings/query DSL/ES|QL internals/ILM; observability owns Kibana dashboards/Lens/Discover, alerting rules, Elastic Observability (APM, EDOT, Synthetics), and only cross-links ES internals. |
| CI/CD | **Yes: `technologies/gitlab-ci`** (smaller, 9–10 modules) | User uses GitLab; pipelines are where containers, Terraform, K8s and GitOps meet (build → scan → sign → push → update GitOps repo). Supply-chain security (SBOM, cosign, SLSA) lives here and is cross-linked from containers + CKS module. |

Suggested order: containers → kubernetes → (terraform in parallel) → argocd → gitlab-ci → observability.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- **Current stable version(s)**: GitLab **19.x** (19.0 released 2026-05-21 — https://www.businesswire.com/news/home/20260521893408/en/ ; monthly releases on the third Thursday, so 19.5 likely current as of Oct 2026 — **unverified**). gitlab-ci-local **4.77.0** (third-party local runner emulator). GitLab Runner version not verified.
- **Authoritative syllabi used**: GitLab CI/CD YAML reference https://docs.gitlab.com/ci/yaml/ ; GitLab CI/CD docs ToC https://docs.gitlab.com/ci/ ; GitLab certifications (GitLab Certified CI/CD Associate — current availability unverified); SLSA spec https://slsa.dev/ ; CKS "Supply Chain Security 20%" domain.
- 8. Secrets & cloud auth — masked/hidden/protected variables, OIDC federation to AWS/GCP/Azure/Vault (no long-lived keys), GitLab Secrets Manager (19.0 — unverified detail).

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
1. **Primary (Opus)** works on branch `track/gitlab-ci` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(gitlab-ci)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/gitlab-ci.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/gitlab-ci.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
