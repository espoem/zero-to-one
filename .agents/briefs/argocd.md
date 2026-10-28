# Brief: Argo CD (`technologies/argocd`)

| | |
|---|---|
| Phase | 3 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/argocd` · `../zto-argocd` |
| Depends on | technologies/kubernetes |
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
- GitOps principles (OpenGitOps), Argo CD internals, Rollouts / progressive delivery

**Cross-link only (do not re-explain):**
- Kubernetes control plane, workloads, Services/CNI/NetworkPolicy, RBAC, CRDs/operators, Helm/Kustomize authoring → owned by `technologies/kubernetes`
- Policy-as-code (OPA/Rego, CEL, Kyverno, Terraform Policy): one shared module → owned by `technologies/terraform`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Argo CD (GitOps with Argo CD + Argo Rollouts) — `technologies/argocd`

- **Current stable version(s)**:
  - Argo CD **v3.5.6** (tag 2026-10-20); v3.5.0 released 2026-08-04. Supported lines also v3.4.x (3.4.8+) and v3.3.x (3.3.14+) per release page. **v3.6.0-rc4** (2026-10-22) in RC — https://github.com/argoproj/argo-cd/releases
  - v3.5 highlights: Source Hydrator → beta, impersonation → beta, ApplicationSets-in-any-namespace stable, **Helm 3 → Helm 4 migration**, repo-server mTLS, Gateway API health checks — https://newreleases.io/project/github/argoproj/argo-cd/release/v3.5.0
  - v3.0 breaking changes still worth teaching (fine-grained RBAC no longer inherits to sub-resources, logs RBAC enforced, **annotation-based resource tracking default**, default `resource.exclusions`, repos in `argocd-cm` removed, status-ignore defaults) — https://argo-cd.readthedocs.io/en/stable/operator-manual/upgrading/2.14-3.0/
  - Argo Rollouts **v1.10.1** (v1.10.0 on 2026-08-05). Argo Workflows **v4.1.6** (for appendix only). Flux **v2.10.0** (comparison).
- **Authoritative syllabi used**:
  - **CAPA** (Certified Argo Project Associate), https://github.com/cncf/curriculum `CAPA_Curriculum.pdf`: Argo Workflows 36% · **Argo CD 34%** (fundamentals, sync apps, Application, Helm & Kustomize, reconciliation patterns) · **Argo Rollouts 18%** (fundamentals, progressive strategies, AnalysisTemplate/AnalysisRun) · Argo Events 12%.
  - **CGOA** (Certified GitOps Associate), `CGOA_Curriculum.pdf`: GitOps Principles 30% · GitOps Terminology 20% · GitOps Patterns 20% · Related Practices 16% · Tooling 14%.
  - OpenGitOps principles v1.0.0 (Declarative, Versioned & Immutable, Pulled Automatically, Continuously Reconciled) — https://opengitops.dev/
  - Argo CD docs (user guide + operator manual) https://argo-cd.readthedocs.io/ ; Argo Rollouts docs https://argo-rollouts.readthedocs.io/
- **Proposed modules** (11):
  1. **GitOps principles** — OpenGitOps 4 principles, terminology (desired state, drift, reconciliation, state store), push CI/CD vs pull GitOps, Argo CD vs Flux architectures, when GitOps is wrong (CGOA terminology+principles).
  2. **Argo CD architecture** — api-server, repo-server (manifest generation + cache), application-controller (reconciliation loop, comparison, sync), applicationset-controller, Redis cache, Dex/OIDC, notifications controller; CRDs (Application, AppProject, ApplicationSet).
  3. **Applications & sources** — plain manifests, Helm (values, valueFiles globs, Helm 4), Kustomize, multi-source apps, config management plugins (sidecar CMP), directory recursion, `targetRevision` semantics (branch/tag/SHA).
  4. **Sync mechanics** — diffing (live vs desired, normalization, `ignoreDifferences`, server-side diff), sync options (ServerSideApply, Prune, PruneLast, Replace, CreateNamespace, ApplyOutOfSyncOnly), auto-sync + self-heal + prune, **sync phases/hooks** (PreSync/Sync/PostSync/SyncFail/PostDelete), **sync waves**, health assessment (built-in + Lua custom health), resource tracking (annotation vs label).
  5. **Drift & reconciliation patterns** — refresh vs hard refresh, webhook vs polling (jitter), drift sources (HPA replicas, mutating webhooks, controllers writing spec), app-of-apps, orphaned resources, finalizers & cascading deletion.
  6. **ApplicationSets** — generators (list, cluster, git directory/file, matrix, merge, SCM provider, pull request, cluster-decision), templating (goTemplate), progressive syncs, policies (create-only/sync), preview environments.
  7. **Multi-tenancy & security** — AppProjects (source/destination/resource allow/deny lists), RBAC (Casbin policies, fine-grained 3.x semantics), SSO/Dex, impersonation (beta), apps-in-any-namespace, repo credentials & credential templates, secrets management (Sealed Secrets, External Secrets, SOPS via CMP — never plain secrets in Git).
  8. **Repo & environment structure** — monorepo vs polyrepo, environment promotion (branch-per-env anti-pattern vs folder-per-env), Source Hydrator (rendered manifests pattern), GitOps Promoter, image update automation (Argo CD Image Updater), CI → GitOps handoff.
  9. **Progressive delivery with Argo Rollouts** — Rollout CRD, blue/green vs canary steps, traffic routing (Gateway API plugin, Istio, NGINX/ALB), AnalysisTemplate/AnalysisRun with Prometheus metrics, abort/retry, experiments; interplay with Argo CD health/sync.
  10. **Operating Argo CD at scale** — HA install, controller sharding (legacy/round-robin/consistent-hashing), repo-server scaling & caching, `resource.exclusions`, reconciliation timeout, Redis, metrics & alerts, notifications, disaster recovery (`argocd admin export/import`), upgrades (server-side apply of CRDs).
  11. **(Optional appendix) Rest of Argo: Workflows & Events** — Workflow/WorkflowTemplate, DAG/steps, artifacts; EventSource/Sensor; just enough for CAPA's 48%.
- **Gotchas & production failure modes**:
  - Auto-sync with `prune: true` + accidental path rename/empty render → Argo CD deletes production resources (use `PruneLast`, `Prune=false` annotations, app finalizer awareness, deletion confirmation).
  - Deleting an Application with `resources-finalizer.argocd.argoproj.io` cascades to all managed resources; without it, resources are orphaned.
  - HPA-managed `replicas` in Deployment manifest → perpetual OutOfSync/self-heal fight; remove `replicas` or `ignoreDifferences`.
  - Mutating webhooks / defaulting (e.g. Istio injection, defaulted fields) cause permanent diffs; fix with server-side diff or `ignoreDifferences` + `RespectIgnoreDifferences=true`.
  - Large CRDs fail client-side apply (annotation size) → `ServerSideApply=true`.
  - Sync waves: resources in the same wave with dependency (CRD + CR) fail; CRDs must be in an earlier wave or a separate app; `SkipDryRunOnMissingResource=true`.
  - Hook resources without `hook-delete-policy` accumulate or block re-runs (Job name immutability).
  - Upgrade to 3.x switched to annotation tracking → resources tracked by label may appear orphaned; `ApplyOutOfSyncOnly` apps need explicit sync.
  - Upgrade to 3.x: users lose log access / sub-resource update rights (fine-grained RBAC change).
  - Helm `lookup` and random functions (`randAlphaNum`, generated certs) re-render each reconcile → constant diff/regenerated secrets.
  - Polling 3-minute default + many apps → Git provider rate limits; use webhooks, increase `timeout.reconciliation`, repo-server caching.
  - Single application-controller OOM with thousands of apps/huge clusters → shard controllers, exclude high-churn kinds.
  - `targetRevision: HEAD`/branch means anyone who can push to the branch can deploy to prod; protect branches, pin SHAs/tags for prod.
  - Secrets in Git (even base64) — leaks; use SOPS/External Secrets.
  - Argo CD managing itself without care (self-managed install) can lock you out after a bad sync.
  - Rollouts: AnalysisTemplate querying a metric that returns empty → `inconclusive`/failure depending on config; canary without traffic routing only scales replicas (percent ≈ replica ratio).
- **Interview hot topics**:
  - Push vs pull deployment; OpenGitOps principles.
  - How Argo CD detects and resolves drift (refresh, diff, self-heal).
  - Sync waves vs hooks; ordering CRDs, migrations (PreSync Job).
  - App-of-apps vs ApplicationSets.
  - Environment promotion strategies; why not branch-per-environment.
  - Multi-tenancy with AppProjects + RBAC.
  - Secrets in GitOps.
  - Blue/green vs canary with Argo Rollouts + automated analysis.
  - Scaling Argo CD (sharding, repo-server).
  - Argo CD vs Flux.
- **Executable-proof strategy**:
  - kind **v0.33.0** cluster + Argo CD **v3.5.x** installed from pinned upstream manifest (server-side apply); in-cluster Git server (Gitea or a plain `git-http-backend` container) so tests never hit the internet.
  - Test driver: bats/pytest calling `argocd` CLI (`app sync`, `app wait --health --sync`, `app diff` exit codes) — assert deterministic states: drift injected via `kubectl patch` → `OutOfSync` → self-heal restores; sync-wave ordering asserted via resource creation timestamps/hook Job logs; negative test: AppProject destination denial rejects sync; prune safety.
  - Chainsaw **v0.2.15** for declarative assert steps on Application status.
  - ApplicationSet generator output tests: apply ApplicationSet, assert generated Application set (list/git/matrix) — deterministic.
  - Rollouts: kubectl-argo-rollouts plugin + Prometheus in-cluster; AnalysisTemplate using `job` or `web` provider against a deterministic stub service (avoid flaky metrics); assert abort on failing analysis.
  - Offline fallback: render-only tests (`helm template`/`kustomize build` + kubeconform) to snapshot what Argo would apply.
  - Cannot prove locally: SSO with corporate IdP (use Dex static users), real Git provider webhooks (simulate with `curl` to `/api/webhook`), multi-cluster at scale (2 kind clusters as approximation).
  - mise pins: argocd CLI 3.5.x, kubectl-argo-rollouts 1.10.x, kind, kubectl, helm 4.
- **Overlaps / dedupe**:
  - K8s objects, CRDs, server-side apply, RBAC basics → kubernetes track.
  - Helm/Kustomize authoring → kubernetes track module 12 (argocd only covers how Argo renders them).
  - CI half of the pipeline (build/test/sign/push, bumping image tags in Git) → gitlab-ci track.
  - Prometheus queries for AnalysisTemplates → observability track.
  - Terraform vs GitOps for infra (Crossplane mention) → terraform track cross-link.

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
- (none flagged; still re-check every version)

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
1. **Primary (Opus)** works on branch `track/argocd` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(argocd)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/argocd.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/argocd.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
