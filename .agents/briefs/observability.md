# Brief: Observability (`technologies/observability`)

| | |
|---|---|
| Phase | 3 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/observability` · `../zto-observability` |
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
- OpenTelemetry, metrics/logs/traces, Prometheus/PromQL, LGTM, Kibana/Elastic Observability, alerting, SLO burn rates

**Cross-link only (do not re-explain):**
- Kubernetes control plane, workloads, Services/CNI/NetworkPolicy, RBAC, CRDs/operators, Helm/Kustomize authoring → owned by `technologies/kubernetes`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Observability (OpenTelemetry, Prometheus, Grafana LGTM, Kibana/Elastic Observability) — `technologies/observability`

- **Current stable version(s)** (tag dates):
  - OpenTelemetry Collector (releases repo) **v0.164.0** (2026-10-26); semantic conventions **v1.44.0**. Collector distribution is still 0.x (pdata/core modules have 1.x — unverified detail).
  - Prometheus **v3.15.1** (2026-10-21); Alertmanager **v0.34.1**. Prometheus 3.0 (Nov 2024) introduced UTF-8 metric/label names, OTLP ingestion, Remote Write 2.0, new UI — https://prometheus.io/blog/2024/11/14/prometheus-3-0/
  - Grafana **v13.3.0** (2026-10-27; 13.0.0 on 2026-04-14). 13.0: Git Sync GA, dynamic dashboards GA/default (new schema), `/api` deprecated for `/apis`, `grafana-cli/grafana-server` binaries removed, Image Renderer plugin removed, 13.0.0 migration bug with Git Sync (upgrade to 13.0.1+ after DB backup) — https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v13-0/
  - Loki **v3.7.9**, Tempo **v3.1.1** (Tempo 3.x is a major line), Mimir **3.2.3**, Alloy **v1.21.2**. **Promtail EOL March 2026** → Alloy — https://community.grafana.com/t/promtail-is-now-end-of-life-eol-how-to-migrate-to-grafana-alloy-for-existing-loki-server-deployments/162087 ; Grafana Agent also replaced by Alloy (EOL date unverified).
  - Kibana / Elasticsearch **v9.5.5** (2026-09-30); APM Server 9.5.5. Elastic Observability ingests OTel natively via EDOT (Elastic Distributions of OpenTelemetry) (feature details unverified). Elastic licence: ELv2/SSPL plus AGPLv3 option since 2024 (background knowledge, unverified here).
  - k6 **v2.3.0** (load generation for SLO demos), Pyrra **v0.10.2** / Sloth **v0.16.0** (SLO rule generators).
- **Authoritative syllabi used**:
  - **PCA** (Prometheus Certified Associate), https://github.com/cncf/curriculum `PCA_Curriculum.pdf`: PromQL 28% · Prometheus Fundamentals 20% · Observability Concepts 18% · Alerting & Dashboarding 18% · Instrumentation & Exporters 16%.
  - **OTCA** (OpenTelemetry Certified Associate), `OTCA_Curriculum.pdf`: OTel API & SDK 46% · OTel Collector 26% · Fundamentals of Observability 18% · Maintaining & Debugging Pipelines 10%.
  - Elastic Certified Observability Engineer (Elastic training; current objectives not checked — unverified). Grafana certifications (unverified).
  - Primary docs: OTel spec https://opentelemetry.io/docs/specs/ , semconv https://opentelemetry.io/docs/specs/semconv/ ; Prometheus docs https://prometheus.io/docs/ ; Grafana/Loki/Tempo/Mimir/Alloy docs https://grafana.com/docs/ ; Elastic Observability docs https://www.elastic.co/docs/solutions/observability ; Google SRE Book/Workbook (SLOs, alerting on burn rate) https://sre.google/books/
- **Proposed modules** (13):
  1. **Observability foundations** — monitoring vs observability, signals (metrics/logs/traces/profiles/events), cardinality & dimensionality, push vs pull, sampling, USE/RED/golden signals, cost model.
  2. **OpenTelemetry model** — API vs SDK separation, resources, semantic conventions, context & **W3C Trace Context/Baggage propagation**, spans (kinds, links, events, status), metrics instruments (counter, up-down, histogram, gauge, exemplars, temporality cumulative vs delta), logs bridge; OTLP.
  3. **Instrumentation in practice** — Node.js/TypeScript + Python SDKs, auto-instrumentation vs manual, zero-code agents, tail vs head sampling, span naming/attribute hygiene, metric naming (Prometheus vs OTel conventions, UTF-8), log correlation (trace_id in logs).
  4. **OpenTelemetry Collector** — receivers/processors/exporters/connectors/extensions, pipelines, batch/memory_limiter, transform (OTTL), tail_sampling, k8sattributes, deployment patterns (agent/daemonset vs gateway), scaling & load-balancing exporter, debugging pipelines (debug exporter, zpages, internal telemetry), Alloy as a Collector distribution.
  5. **Prometheus internals** — data model (series, labels, samples), exposition formats (text, OpenMetrics, protobuf), scraping & service discovery, relabeling, TSDB (head block, WAL, compaction, retention), native histograms, staleness, limits (single-node, no HA by itself).
  6. **PromQL mastery** — instant vs range vectors, selectors, `rate`/`irate`/`increase` (counter resets, extrapolation), aggregation `by/without`, binary ops & vector matching (`on/ignoring`, `group_left`), `histogram_quantile` (classic vs native), subqueries, recording rules, `absent`, offset/@ modifiers.
  7. **Alerting** — alerting rules, `for`/`keep_firing_for`, Alertmanager (routing tree, grouping, inhibition, silences, HA gossip), Grafana Alerting vs Prometheus alerting, alert design (symptom-based, actionable, runbooks), testing rules with `promtool test rules`.
  8. **SLOs** — SLI/SLO/SLA, error budgets, multi-window multi-burn-rate alerts, latency SLIs from histograms, SLO generators (Pyrra/Sloth), Grafana SLO / Elastic SLO features, reporting.
  9. **Logs: Loki** — label-indexed design vs full-text, streams & label cardinality, chunks/index (TSDB), LogQL (log & metric queries, parsers, line filters), structured metadata, Alloy pipelines (Promtail EOL), retention.
  10. **Traces: Tempo & scaling metrics: Mimir** — Tempo architecture (object storage, no index, TraceQL, metrics-generator → span metrics/service graphs), Mimir (horizontally scalable Prometheus: distributor/ingester/querier/store-gateway, hash ring, replication, tenancy), Prometheus remote write.
  11. **Grafana** — data sources, dashboards as code (dynamic dashboards/new schema, Git Sync GA, provisioning, Terraform provider/Grafonnet), variables, transformations, Explore & correlations (exemplars → traces, logs ↔ traces), RBAC/folders, Grafana Alerting.
  12. **Elastic Observability & Kibana** — Elastic Agent/Fleet vs Beats vs EDOT/OTel, APM (services, transactions, spans), data streams & ECS/OTel semconv mapping, Kibana Discover/Lens/dashboards, ES|QL in observability use, Kibana alerting rules & connectors, SLOs, Synthetics; when to pick Elastic vs LGTM.
  13. **Production observability** — cardinality explosions & cost control, sampling strategy, multi-tenancy, retention tiers, observability of the observability stack (meta-monitoring), K8s monitoring (kube-state-metrics, cAdvisor, kube-prometheus-stack), incident workflow, eBPF-based auto-instrumentation (overview), continuous profiling (Pyroscope) overview.
- **Gotchas & production failure modes**:
  - Putting user IDs/request IDs/URLs with IDs into metric labels → cardinality explosion, Prometheus OOM, Mimir per-tenant limits rejecting samples.
  - Using high-cardinality labels in Loki (e.g. `trace_id`, `user_id` as labels) → millions of tiny streams, ingester OOM; put them in structured metadata/log line.
  - `rate()` over a range shorter than 2× scrape interval → empty/gappy results; `irate` in alerting = noisy.
  - `sum(rate(x[5m]))` vs `rate(sum(x)[5m])` — summing counters before rate breaks reset handling.
  - Averaging percentiles (`avg(histogram_quantile(...))`) is mathematically wrong; aggregate buckets first (`sum by (le)`).
  - Histogram bucket boundaries not covering the SLO threshold → SLI can't be computed precisely.
  - Alert without `for` flaps; alert on `absent()` forgotten → silent failure when the target disappears (scrape broken = no alert).
  - Alertmanager `group_by` too coarse → one page hides 50 incidents; too fine → paging storm.
  - Head sampling at 1% drops the rare error traces you need; tail sampling in Collector requires all spans of a trace on the same instance (loadbalancing exporter by trace ID).
  - Collector without `memory_limiter` → OOM under backpressure, dropping all telemetry.
  - Broken context propagation across async boundaries (Node.js `AsyncLocalStorage` lost through custom promise libraries/queues) → disconnected traces.
  - Clock skew between hosts → negative span durations / out-of-order samples rejected by Prometheus/Mimir.
  - Prometheus "HA" pair without dedup → double-counted alerts/series in remote storage (need external labels + Mimir HA dedup).
  - Grafana 13.0.0 upgrade with Git Sync enabled could lose/revert dashboards (fixed 13.0.1; restore from backup).
  - Kibana alerting rules run on Kibana task manager — overloaded task manager delays alerts silently.
  - Elastic: dynamic mapping of arbitrary log fields → mapping explosion (field limit 1000) and rejected documents (deeper treatment in Elasticsearch track).
  - Promtail still deployed after March 2026 EOL → unpatched agent.
- **Interview hot topics**:
  - Metrics vs logs vs traces — when to use each; correlation via exemplars/trace IDs.
  - Cardinality: what it is, how to detect and control it.
  - `rate` vs `irate` vs `increase`; histograms vs summaries; computing p99 correctly.
  - Designing SLOs and burn-rate alerting.
  - OpenTelemetry architecture (API/SDK/Collector/OTLP), context propagation.
  - Sampling strategies (head vs tail).
  - Scaling Prometheus (federation vs remote write vs Mimir/Thanos).
  - Loki vs Elasticsearch for logs (index design trade-off).
  - Alert fatigue and good alert design.
  - Instrumenting a Node.js service end to end.
- **Executable-proof strategy**:
  - Docker Compose stack (pinned image tags): OTel Collector contrib 0.164.0, Prometheus 3.15.1, Alertmanager 0.34.1, Loki 3.7.9, Tempo 3.1.1, Grafana 13.3.0 (provisioned datasources/dashboards), optional Mimir 3.2.3 monolithic; separate Elastic compose (Elasticsearch + Kibana 9.5.5 + EDOT Collector) gated behind a profile because of RAM.
  - Most deterministic proofs need **no running stack**:
    - `promtool test rules` — unit tests for recording/alerting rules with synthetic series (`input_series`, `eval_time`, expected alerts) incl. negative tests (alert must NOT fire).
    - `promtool check config/rules`, `amtool check-config` and `amtool config routes test` (routing tree assertions).
    - PromQL semantics tests: `promtool test rules` with expressions comparing `rate` across counter resets.
    - `otelcol-contrib validate --config` for Collector configs; OTTL transforms tested via Collector with `file` receiver/exporter on fixtures → golden-file comparison.
    - SDK tests: OTel JS/Python **in-memory span/metric exporters** in vitest/pytest — assert span names, attributes, parent/child, propagation headers (deterministic).
    - Loki: `logcli`/LogQL against a short-lived Loki in Testcontainers; Alloy config `alloy fmt` + test pipeline.
    - Grafana dashboards: JSON schema lint + provisioning load test (Grafana starts and API returns dashboard) via Testcontainers; Grafana Terraform provider plan.
    - SLO rules: Sloth/Pyrra generate rules → promtool unit-tests the burn-rate alerts with synthetic error ratios.
    - Kibana: saved objects import via API in Testcontainers; ES|QL queries asserted on fixture data (heavier; mark optional).
  - Load: k6 2.3.0 scripts to drive deterministic error rates for SLO demos (not for CI assertions).
  - Cannot prove locally: real long-retention/scale behaviour (Mimir ring rebalancing, Tempo backend at scale), Grafana Cloud/Elastic Cloud managed features (Adaptive Metrics, Grafana SLO app, Elastic AI assistant) → describe + config validation only.
  - mise pins: prometheus (promtool), alertmanager (amtool), otelcol-contrib, logcli, alloy, k6, sloth; Node + Python OTel SDKs via package lockfiles.
- **Overlaps / dedupe**:
  - **Elasticsearch track (other agent)** owns: cluster architecture, shards/replicas, mappings & analyzers, query DSL, ES|QL language internals, aggregations, ILM/data tiers, performance. Observability owns: Elastic Agent/EDOT ingestion, APM data model, Kibana UI (Discover/Lens/dashboards), Kibana alerting/SLOs, Elastic vs LGTM decision — and cross-links ES internals.
  - K8s-specific monitoring components install → kubernetes track cross-links; observability shows the signals.
  - Distributed tracing concepts for microservices → could also be referenced by a system-design track; owned here.
  - Node.js async context (AsyncLocalStorage) internals → Node.js track; observability only uses it.
  - Argo Rollouts analysis queries → argocd track references PromQL module.

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
- OpenTelemetry Collector (releases repo) **v0.164.0** (2026-10-26); semantic conventions **v1.44.0**. Collector distribution is still 0.x (pdata/core modules have 1.x — unverified detail).
- Loki **v3.7.9**, Tempo **v3.1.1** (Tempo 3.x is a major line), Mimir **3.2.3**, Alloy **v1.21.2**. **Promtail EOL March 2026** → Alloy — https://community.grafana.com/t/promtail-is-now-end-of-life-eol-how-to-migrate-to-grafana-alloy-for-existing-loki-server-deployments/162087 ; Grafana Agent also replaced by Alloy (EOL date unverified).
- Kibana / Elasticsearch **v9.5.5** (2026-09-30); APM Server 9.5.5. Elastic Observability ingests OTel natively via EDOT (Elastic Distributions of OpenTelemetry) (feature details unverified). Elastic licence: ELv2/SSPL plus AGPLv3 option since 2024 (background knowledge, unverified here).
- Elastic Certified Observability Engineer (Elastic training; current objectives not checked — unverified). Grafana certifications (unverified).

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
1. **Primary (Opus)** works on branch `track/observability` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(observability)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/observability.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/observability.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
