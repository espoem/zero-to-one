# Brief: Elasticsearch (`technologies/elasticsearch`)

| | |
|---|---|
| Phase | 2 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/elasticsearch` · `../zto-elasticsearch` |
| Depends on | phase 1 foundations |
| Research dossier | `.agents/research/B-data.md` |

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
- (see dossier "Overlaps / dedupe")

**Cross-link only (do not re-explain):**
- Storage engines: B-tree vs LSM, WAL/ARIES, compaction, buffer pools → owned by `architecture/data-systems`
- Indexing theory: inverted index, BM25, vector ANN (HNSW, IVF, quantisation) → owned by `architecture/data-systems`
- Replication mechanics (leader/follower, multi-leader, leaderless), sharding/rebalancing, CDC → owned by `architecture/data-systems`
- OpenTelemetry, metrics/logs/traces, Prometheus/PromQL, LGTM, Kibana/Elastic Observability, alerting, SLO burn rates → owned by `technologies/observability`
- ES storage, mappings, query DSL, ES\ → owned by QL, ILM

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Elasticsearch — `technologies/elasticsearch` (NEW)

- **Current stable version(s)**
  - **9.5.5** (Oct 2026; with 9.4.8 as the maintained previous minor) (https://releasebot.io/updates/elastic/elasticsearch; secondary aggregator. Confirm on https://www.elastic.co/docs/release-notes/elasticsearch).
  - **9.5.0** (Aug 2026):
    - batched query phase by default
    - DSL `frozen_after`
    - ES|QL `flattened` support (tech preview)
    - experimental ES|QL data federation to S3
    - columnar / `logsdb_columnar` index modes (tech preview)
  - **9.4.0** (May 2026): ES|QL **Views**, PromQL in ES|QL (tech preview), Prometheus-compatible endpoints.
  - **9.0 GA April 2025** (with 8.18): **Lucene 10**, BBQ (Better Binary Quantization) GA, ES|QL `LOOKUP JOIN` (tech preview at the time) (https://www.elastic.co/blog/whats-new-elastic-search-9-0-0, https://www.elastic.co/blog/whats-new-elastic-9-0-0).
  - **Licensing:** since Aug 2024, the source is under **AGPLv3** as an option alongside SSPL and ELv2 (https://www.businesswire.com/news/home/20240829537786/en). The default distribution is under the Elastic License; some features (e.g. `frozen_after`, searchable snapshots) need paid tiers.
  - Client: `@elastic/elasticsearch` **9.5.1** on npm (verified).
  - **OpenSearch:** Apache-2.0 fork of ES 7.10.2, governed by the OpenSearch Software Foundation (Linux Foundation, Sept 2024). **3.8.0 latest (2026-08-05)**, based on Lucene 10 since 3.0 (https://en.wikipedia.org/wiki/OpenSearch_(software)). An LTS program was announced (https://www.pulse.bot/devops/news/opensearch-foundation-launches-lts-versions-to-bolster-devops-stability-9822b925-1a61-48f3-981a-f991d9925baf/; details unverified).

- **Authoritative syllabi used**
  - **Elastic Certified Engineer** (hands-on, performance-based). Third-party source says it is **still on version 8.1** (https://nextbrick.com/elastic-search-engineer; official page https://www.elastic.co/training/elastic-certified-engineer-exam does not show objectives). Weights unpublished. Domains:
    1. **Data Management:** index definition, index/dynamic templates, ILM for time series, data-stream templates.
    2. **Searching Data:** term/phrase, bool, async search, metric/bucket/sub-aggs, cross-cluster search, runtime fields.
    3. **Developing Search Apps:** highlight, sort, pagination, aliases, search templates.
    4. **Data Processing:** mappings, custom analyzers, multi-fields, reindex/update-by-query, ingest pipelines + Painless, runtime fields.
    5. **Cluster Management:** shard diagnosis/health, snapshot/restore, searchable snapshots, CCS, CCR.
  - Official docs: https://www.elastic.co/docs (Elasticsearch reference: mapping, text analysis, Query DSL, ES|QL https://www.elastic.co/docs/reference/query-languages/esql, aggregations, data streams, ILM, vector search/kNN, cluster/shard allocation).
  - *Elasticsearch: The Definitive Guide* (concepts, dated); Lucene docs (https://lucene.apache.org/core/); *Introduction to Information Retrieval* (Manning et al., free at https://nlp.stanford.edu/IR-book/) for inverted index, TF-IDF/BM25 and evaluation.

- **Proposed modules** (12)
  1. **Search fundamentals & IR theory:** inverted index, postings, term dictionary (FST), BM25 scoring, precision/recall, relevance vs filter context. Cross-links data-systems for indexing theory.
  2. **Architecture:** cluster/node roles, index → shards → Lucene segments, primary/replica, coordinating node scatter-gather, query-then-fetch (9.5 batched query phase), near-real-time refresh, translog, flush, merges; stateless/serverless architecture overview.
  3. **Mappings:** dynamic vs explicit, field types (`text`/`keyword`/numeric/date/`flattened`/`nested`/`object`/`join`), multi-fields, `doc_values` vs `fielddata`, `_source`/synthetic source, `index: false`, runtime fields, mapping explosion limits, index & dynamic templates. Exam domains 1 and 4.
  4. **Text analysis:** char filters/tokenizers/token filters, standard vs language analyzers, custom analyzers, synonyms (search-time, synonyms API), n-grams/edge n-grams, normalizers, `_analyze` API, index vs search analyzers.
  5. **Query DSL:** query vs filter context, `match`/`multi_match`/`match_phrase`/`term`/`terms`/`range`/`exists`, `bool` scoring semantics, `nested`, `function_score`, highlighting, sorting, pagination (`from/size` vs `search_after` + PIT; scroll legacy), search templates, async search.
  6. **ES|QL:** pipe syntax, `FROM/WHERE/EVAL/STATS/SORT/KEEP`, `LOOKUP JOIN`, `ENRICH`, Views (9.4), limits vs DSL, when to use which.
  7. **Aggregations:** bucket/metric/pipeline, `terms` accuracy (shard_size, doc count error), `composite` for pagination, `cardinality` (HLL++), percentiles (TDigest), date histograms, memory/circuit breakers.
  8. **Ingest & data lifecycle:** ingest pipelines + Painless, `_bulk` sizing, reindex/update-by-query, aliases for zero-downtime reindex, data streams, ILM vs Data Stream Lifecycle (DSL), hot/warm/cold/frozen tiers, rollover, searchable snapshots, TSDS/logsdb index modes.
  9. **Vector & hybrid search:** `dense_vector`, HNSW, quantization (int8, int4, **BBQ**), kNN query vs `knn` section, filtering in kNN, `semantic_text` and inference endpoints, ELSER sparse vectors, hybrid via RRF/retrievers, re-ranking.
  10. **Scaling & sharding:** shard sizing (10–50 GB rule of thumb), oversharding, routing, allocation awareness, replicas for read scale, split/shrink, CCS/CCR, `index.max_result_window`.
  11. **Operations:** cluster health red/yellow (`_cluster/allocation/explain`), snapshot/restore and SLM, rolling upgrades 8→9 (deprecation API), security (TLS, API keys, RBAC on by default), JVM heap (≤~31GB compressed oops), circuit breakers, slow logs, hot threads.
  12. **Expert & ecosystem:** Lucene internals (segments, merge policy, deletes as tombstones, doc values columnar format, skip lists, BKD trees for numerics/geo), relevance tuning and evaluation (`_rank_eval`), OpenSearch divergence (API compatibility, k-NN plugin engines FAISS/Lucene, licensing), PG FTS vs ES decision guide.

- **Gotchas & production failure modes**
  1. Dynamic mapping makes every string `text` + `keyword` subfield (doubling index cost). Mapping explosion from user-controlled keys leads to cluster-state bloat; `index.mapping.total_fields.limit` errors.
  2. A mapping type can't be changed in place. It requires reindex + alias swap; forgetting aliases means downtime.
  3. `term` query on a `text` field matches nothing because of analysis (casing).
  4. Deep pagination `from+size > 10000` is rejected. Use `search_after` + PIT.
  5. `terms` aggregation counts are approximate across shards (`doc_count_error_upper_bound`).
  6. Oversharding (thousands of tiny shards) brings heap pressure, a slow master and long recoveries.
  7. Heap > ~31GB loses compressed OOPs. Leave about 50% RAM for the OS page cache (Lucene relies on mmap).
  8. `nested` docs multiply the Lucene doc count; `nested` queries/aggs are slow; the `index.mapping.nested_objects.limit` is hit.
  9. Refresh interval 1s on heavy bulk ingest causes segment churn. Set `refresh_interval: -1`/`30s` during backfills, and set `number_of_replicas: 0` during initial load.
  10. Read-after-write: a doc isn't searchable until refresh (GET by id is realtime; search is not). `refresh=wait_for` vs `true` costs.
  11. Disk watermarks (85/90/95%): the index becomes read-only (`index.blocks.read_only_allow_delete`) at flood stage.
  12. Fielddata on `text` fields blows heap and trips the circuit breaker.
  13. `update_by_query`/`delete_by_query` version conflicts without `conflicts=proceed`. Deletes leave tombstones until merges.
  14. Split brain is no longer possible in 7+ (Zen2/voting config), but losing a majority of master-eligible nodes leaves the cluster unavailable. Always run 3 master-eligible nodes.
  15. kNN with restrictive filters gives poor recall or slow brute-force fallback. HNSW graphs must fit in RAM (off-heap) for latency.
  16. Painless scripts in hot query paths and script compilation limits (`script.max_compilations_rate`).

- **Interview hot topics**
  - Inverted index and BM25
  - text vs keyword; analyzers
  - Shard sizing and replica strategy
  - Near-real-time search (refresh/translog/flush)
  - Query vs filter context and caching
  - Zero-downtime reindex with aliases
  - Deep pagination
  - Aggregation accuracy
  - Hot-warm-cold / ILM
  - Vector/hybrid search (HNSW, quantization, RRF)
  - ES vs OpenSearch vs Postgres FTS
  - Cluster health red/yellow troubleshooting

- **Executable-proof strategy**
  - **Tier 2 only** (no embedded ES).
    - testcontainers 12.2.1 with `@testcontainers/elasticsearch` (version unverified), or docker compose using `docker.elastic.co/elasticsearch/elasticsearch:9.5.5` single-node (`discovery.type=single-node`, `xpack.security.enabled=false` for tests, `ES_JAVA_OPTS=-Xms1g -Xmx1g`), or Elastic's `start-local` script (`curl -fsSL https://elastic.co/start-local | sh`; unverified current). Mac: about 2–4 GB RAM to Docker.
    - Vitest + `@elastic/elasticsearch` 9.5.1.
  - **Determinism:**
    - Always `refresh: true` (or `_refresh`) before asserting search results.
    - Single shard (`number_of_shards: 1`) for scoring assertions, since BM25 stats are per shard. A *negative test* shows a multi-shard score skew and `dfs_query_then_fetch` fixing it.
    - `_analyze` API assertions for analyzers.
    - `_validate/query?explain` and `explain: true` for scoring.
    - Aggregation accuracy demo with 3 shards and `shard_size: 1`.
    - kNN recall tests against brute-force `script_score` ground truth with a fixed seeded dataset.
    - ILM: set `indices.lifecycle.poll_interval: 1s` and tiny `max_docs` rollover conditions. Assert the phase via `_ilm/explain` with polling (bounded wait).
  - **Multi-node:** 3-node compose (lower heap) for shard allocation, `allocation/explain`, replica promotion, and stopping a node for a yellow state. The OpenSearch 3.8 image (`opensearchproject/opensearch:3.8.0`) runs the same API-compat subset in a parallel suite.
  - **Cannot prove locally:** paid-tier features (searchable snapshots/frozen tier, `frozen_after`, CCR need an Enterprise/trial license). A **30-day trial license** via `_license/start_trial` can enable these locally (unverified for 9.5), so mark the tests `trial-only`. ELSER/inference endpoints need ML nodes and model downloads (heavy; mark optional). Performance/capacity claims are documented, not asserted.
  - Kibana is **not** part of this track: use Dev Tools-equivalent HTTP files (`.http`) or `curl` scripts. Kibana, dashboards, Beats/Elastic Agent, EDOT/OTel, APM and Logstash pipelines-for-observability belong to the **observability track**. Elasticsearch only covers ingest pipelines, data streams/ILM and the logsdb/TSDS index modes as storage features, with a cross-link.

- **Overlaps / dedupe**
  - `architecture/data-systems` owns inverted-index fundamentals (shared with PG FTS, SQLite FTS5 and Redis Query Engine), LSM-style segment/merge theory, sharding/replication theory, and vector ANN theory (HNSW, IVF, quantization).
  - The observability track owns Kibana and the Elastic stack ingest agents.
  - The ES track owns Lucene/ES specifics.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- **OpenSearch:** Apache-2.0 fork of ES 7.10.2, governed by the OpenSearch Software Foundation (Linux Foundation, Sept 2024). **3.8.0 latest (2026-08-05)**, based on Lucene 10 since 3.0 (https://en.wikipedia.org/wiki/OpenSearch_(software)). An LTS program was announced (https://www.pulse.bot/devops/news/opensearch-foundation-launches-lts-versions-to-bolster-devops-stability-9822b925-1a61-48f3-981a-f991d9925baf/; details unverified).
- testcontainers 12.2.1 with `@testcontainers/elasticsearch` (version unverified), or docker compose using `docker.elastic.co/elasticsearch/elasticsearch:9.5.5` single-node (`discovery.type=single-node`, `xpack.security.enabled=false` for tests, `ES_JAVA_OPTS=-Xms1g -Xmx1g`), or Elastic's `start-local` script (`curl -fsSL https://elastic.co/start-local | sh`; unverified current). Mac: about 2–4 GB RAM to Docker.
- **Cannot prove locally:** paid-tier features (searchable snapshots/frozen tier, `frozen_after`, CCR need an Enterprise/trial license). A **30-day trial license** via `_license/start_trial` can enable these locally (unverified for 9.5), so mark the tests `trial-only`. ELSER/inference endpoints need ML nodes and model downloads (heavy; mark optional). Performance/capacity claims are documented, not asserted.

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
1. **Primary (Opus)** works on branch `track/elasticsearch` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(elasticsearch)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/elasticsearch.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/elasticsearch.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
