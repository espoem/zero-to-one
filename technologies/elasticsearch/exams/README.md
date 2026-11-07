# Elasticsearch: Certifications and Exam Coverage

This page lists the certification this track prepares for, maps every exam objective to the modules and executable examples that teach it, records the exam-version delta, and links the question bank in [`exams/elastic-certified-engineer.md`](./elastic-certified-engineer.md).

---

## 1. Elastic Certified Engineer

|  |  |
| --- | --- |
| Vendor | Elastic |
| Exam | Elastic Certified Engineer (no public exam code) |
| Official pages | [Exam page](https://www.elastic.co/training/elastic-certified-engineer-exam), [Certification FAQ](https://www.elastic.co/training/certification/faq), [Elasticsearch Engineer course](https://www.elastic.co/training/elasticsearch-engineer) |
| Product version tested | **Elasticsearch 9.3** (FAQ, verified 2026-11-04) |
| Track version | Elasticsearch 9.5.6 / Lucene 10.5.2 |
| Status | active |
| Format | performance-based: timed, real-world tasks on a live cluster reached over SSH, remotely proctored (Honorlock); only the Elastic documentation is available; no multiple-choice questions |
| Duration, task count, passing score | 3 hours (180 minutes); 10–12 hands-on tasks on live clusters with partial credit; passing score is not publicly disclosed (reported as pass/fail) |
| Price, validity | USD 500 per attempt; valid 2 years; 14-day wait before a retake |

There is no other vendor certification for Elasticsearch itself. For interview preparation beyond the exam, every module ends with an Interview Drill.

### 1.1 Exam delta (9.3 exam vs 9.5 track)

| Area | On a 9.3 exam cluster | In this track (9.5) | Module |
| --- | --- | --- | --- |
| Search execution | per-shard query phase | batched query phase per data node (`search.batched_query_phase`) | 02 |
| ES\|QL | available, without Views or PromQL | Views and PromQL (9.4, tech preview); newer `LOOKUP JOIN` condition forms | 06 |
| Data stream lifecycle | retention and downsampling | adds `frozen_after` (9.5, paid) | 08 |
| Index modes | `standard`, `time_series`, `logsdb`, `lookup` | plus columnar modes (9.5 tech preview) | 08 |
| Aggregations | `multi_terms` uncapped | `multi_terms` capped at 128 fields (9.5.5 / 9.4.8) | 07 |
| Vectors | quantisation defaults of 9.3 | later 9.x defaults (`bbq_hnsw`, `bbq_disk` when licensed) | 09 |
| Pagination | scroll still listed in older objective lists | PIT + `search_after` recommended; scroll still works | 05 |

Older study material targets 7.x/8.x. The 8 → 9 changes that matter for the exam are security on by default (8.0), no mapping types, `fixed_interval`/`calendar_interval` only, composable templates, and data tiers.

### 1.2 Official exam domains (Elasticsearch 9.3)

Verified 2026-11-06 against the official exam specification payload on [elastic.co/training/elastic-certified-engineer-exam](https://www.elastic.co/training/elastic-certified-engineer-exam) and the [Certification FAQ](https://www.elastic.co/training/certification/faq). The official 9.3 exam defines 6 performance domains:

| # | Official domain (9.3) | Core objectives | Primary track modules |
| --- | --- | --- | --- |
| 1 | **Elasticsearch Architecture** | Stack architecture, node roles, cluster state, shard sizing and allocation strategies | [02](../modules/02-cluster-architecture-and-near-real-time-search.md), [10](../modules/10-scaling-sharding-and-multi-cluster.md) |
| 2 | **Data Management** | Indices, composable index templates, dynamic templates, aliases, ILM lifecycle policies, data stream management | [03](../modules/03-mappings-field-types-and-templates.md), [08](../modules/08-ingest-pipelines-and-data-lifecycle.md) |
| 3 | **Data Ingestion & Processing** | Ingest methods, explicit mappings, field types, Reindex & Update By Query, Ingest pipelines, Painless scripts, Streams | [03](../modules/03-mappings-field-types-and-templates.md), [04](../modules/04-text-analysis.md), [08](../modules/08-ingest-pipelines-and-data-lifecycle.md) |
| 4 | **Searching Data** | Term/phrase searches, Boolean queries, metric and bucket aggregations, ES\|QL, semantic search, cross-cluster search | [05](../modules/05-query-dsl.md), [06](../modules/06-esql.md), [07](../modules/07-aggregations.md), [09](../modules/09-vector-and-hybrid-search.md) |
| 5 | **Cluster Management** | Cluster health monitoring, shard allocation explain, disk watermarks, node draining, snapshot & restore, SLM | [10](../modules/10-scaling-sharding-and-multi-cluster.md), [11](../modules/11-operations-security-and-upgrades.md) |
| 6 | **Security & Access Control** | Cluster security, RBAC roles and users, document- and field-level security (DLS/FLS), API keys | [11](../modules/11-operations-security-and-upgrades.md#5-security) |

For pedagogical clarity and preparation bank balance, the question bank maps these 6 official performance domains into 7 focused preparation domains: D1 Data Modeling, D2 Search, D3 Aggregations, D4 Data Processing, D5 Distributed Datastore, D6 Data Management, and D7 Cluster Management (including security):

| # | Domain (bank topic area) | Track weight | Target questions (of 70) | Official 9.3 domains mapped |
| --- | --- | --- | --- | --- |
| D1 | Data Modeling | 15% | 10 | 2. Data Management, 3. Data Ingestion & Processing |
| D2 | Search | 18% | 13 | 4. Searching Data |
| D3 | Aggregations | 14% | 10 | 4. Searching Data |
| D4 | Data Processing | 16% | 11 | 3. Data Ingestion & Processing |
| D5 | Distributed Datastore | 10% | 7 | 1. Elasticsearch Architecture |
| D6 | Data Management | 13% | 9 | 2. Data Management |
| D7 | Cluster Management (incl. security) | 14% | 10 | 5. Cluster Management, 6. Security & Access Control |
|  | **Total** | **100%** | **70** |  |

---

## 2. Coverage Matrix

Status: ✅ full (taught and proven), 🟡 partial (reason given). Example paths are relative to [`examples/`](../examples/).

| Domain | Objective | Modules | Examples | Status |
| --- | --- | --- | --- | --- |
| D1 | Define an index that satisfies a given set of requirements | [03](../modules/03-mappings-field-types-and-templates.md), [02](../modules/02-cluster-architecture-and-near-real-time-search.md) | `03-mappings.test.ts` | ✅ |
| D1 | Define a mapping that satisfies a given set of requirements | [03](../modules/03-mappings-field-types-and-templates.md) | `03-mappings.test.ts` | ✅ |
| D1 | Define and use multi-fields with different data types and/or analyzers | [03](../modules/03-mappings-field-types-and-templates.md), [04](../modules/04-text-analysis.md) | `03-mappings.test.ts`, `04-text-analysis.test.ts` | ✅ |
| D1 | Maintain relationships of nested arrays of objects | [03](../modules/03-mappings-field-types-and-templates.md#4-objects-nested-and-join) | `03-mappings.test.ts` (object vs nested) | ✅ |
| D1 | Define and use a custom analyzer | [04](../modules/04-text-analysis.md) | `04-text-analysis.test.ts` | ✅ |
| D1 | Define and use an index template / dynamic template | [03](../modules/03-mappings-field-types-and-templates.md#7-index-templates-and-dynamic-templates) | `03-mappings.test.ts`, `integration/single-node.itest.ts` (Q-ECE-006, Q-ECE-102) | ✅ |
| D2 | Search for terms and/or phrases in one or more fields | [01](../modules/01-search-fundamentals-and-ir-theory.md), [05](../modules/05-query-dsl.md) | `05-query-dsl.test.ts`, `fixtures/dsl/04,05,07,08` | ✅ |
| D2 | Boolean combination of queries and filters | [05](../modules/05-query-dsl.md#4-compound-queries-and-the-scoring-algebra) | `fixtures/dsl/01,02,03` | ✅ |
| D2 | Apply fuzzy matching | [05](../modules/05-query-dsl.md#2-full-text-queries) | `fixtures/dsl/10-fuzzy-match.json` | ✅ |
| D2 | Highlight search terms | [05](../modules/05-query-dsl.md#7-shaping-the-response) | `fixtures/dsl/15`, `integration/single-node.itest.ts` (Q-ECE-014, Q-ECE-103) | ✅ |
| D2 | Sort results | [05](../modules/05-query-dsl.md#5-sorting) | `fixtures/dsl/11,13` | ✅ |
| D2 | Implement pagination | [05](../modules/05-query-dsl.md#6-pagination) | `05-query-dsl.test.ts` (pagination) | ✅ |
| D2 | Retrieve large numbers of results (scroll / PIT) | [05](../modules/05-query-dsl.md#6-pagination), [02](../modules/02-cluster-architecture-and-near-real-time-search.md) | `02-architecture-nrt.test.ts`, `integration/single-node.itest.ts` (Q-ECE-015, Q-ECE-017) | ✅ |
| D2 | Define and use a search template | [05](../modules/05-query-dsl.md#8-search-templates) | `05-query-dsl.test.ts`, `integration/single-node.itest.ts` (Q-ECE-019) | ✅ |
| D2 | Search across multiple clusters | [10](../modules/10-scaling-sharding-and-multi-cluster.md#5-cross-cluster-search-ccs) | — | 🟡 needs two clusters; configuration taught only |
| D2 | Async search; ES\|QL queries | [05](../modules/05-query-dsl.md#9-asynchronous-search), [06](../modules/06-esql.md) | `06-esql.test.ts`, `integration/single-node.itest.ts` (Q-ECE-020, Q-ECE-022) | ✅ |
| D3 | Metric and bucket aggregations | [07](../modules/07-aggregations.md) | `07-aggregations.test.ts` | ✅ |
| D3 | Aggregations with sub-aggregations, pipeline aggregations | [07](../modules/07-aggregations.md#1-families-and-the-request-shape) | `07-aggregations.test.ts`, `integration/single-node.itest.ts` (Q-ECE-025, Q-ECE-106) | ✅ |
| D3 | Aggregation accuracy and limits | [07](../modules/07-aggregations.md#3-terms-and-its-error-bounds) | `07-aggregations.test.ts`, `integration/single-node.itest.ts` | ✅ |
| D4 | Ingest pipelines including Painless | [08](../modules/08-ingest-pipelines-and-data-lifecycle.md#1-ingest-pipelines) | `08-ingest-lifecycle.test.ts`, `integration/single-node.itest.ts` (Q-ECE-034, Q-ECE-107) | ✅ |
| D4 | Reindex API and Update By Query API | [08](../modules/08-ingest-pipelines-and-data-lifecycle.md#3-reindex-update-by-query-delete-by-query) | `08-ingest-lifecycle.test.ts`, `integration/single-node.itest.ts` (Q-ECE-037, Q-ECE-108) | ✅ |
| D4 | CRUD on documents, bulk | [02](../modules/02-cluster-architecture-and-near-real-time-search.md), [08](../modules/08-ingest-pipelines-and-data-lifecycle.md#2-the-_bulk-api) | `02-architecture-nrt.test.ts`, `08-ingest-lifecycle.test.ts`, `integration/single-node.itest.ts` | ✅ |
| D4 | Text analysis (analyzers, normalizers, synonyms) | [04](../modules/04-text-analysis.md) | `04-text-analysis.test.ts`, `integration/single-node.itest.ts` (Q-ECE-041, Q-ECE-043) | ✅ |
| D4 | Runtime fields | [03](../modules/03-mappings-field-types-and-templates.md#6-runtime-fields-schema-on-read) | `03-mappings.test.ts`, `integration/single-node.itest.ts` (Q-ECE-044) | ✅ |
| D5 | Shards, replicas, routing, write and read paths | [02](../modules/02-cluster-architecture-and-near-real-time-search.md), [10](../modules/10-scaling-sharding-and-multi-cluster.md) | `02-architecture-nrt.test.ts`, `10-routing-sharding.test.ts`, `integration/single-node.itest.ts` | ✅ |
| D5 | Refresh, flush, translog, merges | [02](../modules/02-cluster-architecture-and-near-real-time-search.md#3-from-buffer-to-durable-segment-refresh-translog-flush), [12](../modules/12-lucene-internals-relevance-and-ecosystem.md) | `02-architecture-nrt.test.ts`, `12-internals-relevance.test.ts` | ✅ |
| D6 | Index aliases | [08](../modules/08-ingest-pipelines-and-data-lifecycle.md#33-zero-downtime-mapping-changes-with-aliases), [10](../modules/10-scaling-sharding-and-multi-cluster.md) | `08-ingest-lifecycle.test.ts`, `integration/single-node.itest.ts` (Q-ECE-052) | ✅ |
| D6 | Data streams and their templates | [08](../modules/08-ingest-pipelines-and-data-lifecycle.md#4-data-streams) | `08-ingest-lifecycle.test.ts`, `integration/single-node.itest.ts` (Q-ECE-054) | ✅ |
| D6 | ILM for time-series data; hot/warm architecture | [08](../modules/08-ingest-pipelines-and-data-lifecycle.md#5-index-lifecycle-management-ilm) | `08-ingest-lifecycle.test.ts`, `integration/single-node.itest.ts` (Q-ECE-055, Q-ECE-110) | ✅ |
| D6 | Searchable snapshots, data tiers | [08](../modules/08-ingest-pipelines-and-data-lifecycle.md#6-data-tiers-and-searchable-snapshots) | — | 🟡 needs a licence and a repository; taught only |
| D7 | Deploy and configure nodes and a cluster | [02](../modules/02-cluster-architecture-and-near-real-time-search.md#11-node-roles), [11](../modules/11-operations-security-and-upgrades.md#3-node-configuration) | `docker-compose.yml`, `compose.3node.yml`, `integration/exam-d7-cluster-management.itest.ts` (Q-ECE-066) | ✅ |
| D7 | Secure a cluster; role-based access control | [11](../modules/11-operations-security-and-upgrades.md#5-security) | `compose.secure.yml`, `integration/exam-d7-cluster-management.itest.ts` (Q-ECE-063, Q-ECE-111) | ✅ |
| D7 | Allocate shards to nodes; awareness and forced awareness | [10](../modules/10-scaling-sharding-and-multi-cluster.md#4-shard-allocation), [11](../modules/11-operations-security-and-upgrades.md) | `11-operations.test.ts`, `integration/exam-d7-cluster-management.itest.ts` | ✅ |
| D7 | Diagnose shard issues and repair cluster health | [11](../modules/11-operations-security-and-upgrades.md#1-health-green-yellow-red) | `11-operations.test.ts`, `integration/single-node.itest.ts` (Q-ECE-065, Q-ECE-112) | ✅ |
| D7 | Back up and restore a cluster and/or indices | [11](../modules/11-operations-security-and-upgrades.md#6-snapshots-restore-and-slm) | `11-operations.test.ts`, `integration/exam-d7-cluster-management.itest.ts` (Q-ECE-061) | ✅ |
| D7 | Cross-cluster replication | [10](../modules/10-scaling-sharding-and-multi-cluster.md#6-cross-cluster-replication-ccr) | — | 🟡 needs two clusters and a licence |

No objective is a gap (❌). Every 🟡 row is limited by what can be executed without a live cluster; the integration suite and the hands-on tasks in the question bank close them on a machine with Docker.

---

## 3. Question Bank Specification

The bank lives in [`exams/elastic-certified-engineer.md`](./elastic-certified-engineer.md) (70 original questions, 33 hands-on tasks, plus a 12-task mock exam). Requirements, from AGENTS.md § Certification and Exam Coverage:

- **70 questions** distributed per §1.2 (at least 5 per domain).
- **Types.** Because the real exam is entirely hands-on, at least **40%** of questions (≥ 28) are `hands-on` tasks: "on a cluster, do X so that Y holds", with the exact checks a grader would run. The rest are `single`, `multi`, `scenario` and `ordering` questions that test the understanding behind the tasks.
- **Difficulty** tagged 1–3; at least 15 questions at difficulty 3, harder than the real exam (combined objectives, failure diagnosis).
- **Format** per question: heading `### Q-ECE-<NNN> · <Domain> · difficulty <1-3> · <type>`, options, then `<details><summary>Answer</summary>` with the answer, explanation, why each distractor is wrong, and refs to a module anchor plus an official elastic.co docs URL.
- **Hands-on tasks** state the starting state, the task, and a verification block (requests and expected responses). Each must be implementable as an integration test in `examples/integration/` (the primary author adds those verification scripts).
- **Mock exam**: one section of **12 hands-on tasks**, 180 minutes, covering all seven domains in proportion, with a scoring key (points per task, partial credit rules, pass mark 70% as a practice threshold, since the real one is unpublished).
- **Exam-delta notes** inside answers wherever 9.3 and 9.5 differ (§1.1).
- **Originality.** Base every question on the objectives and the official documentation; never reproduce or paraphrase real exam content.
