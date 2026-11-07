# Elasticsearch 9 and Lucene 10

> Verified against Elasticsearch 9.5.6 (Lucene 10.5.2), `@elastic/elasticsearch` 9.5.1, OpenSearch 3.9.0, Node 26.12.1 and TypeScript 7.0.2 on 2026-11-04.

A progressive track from the inverted index to running, scaling and tuning Elasticsearch clusters: how Lucene stores and scores documents, how a cluster writes, refreshes, routes and reduces, how to model data, analyse text, query with the Query DSL and ES|QL, aggregate, ingest and age data, search with vectors and hybrid ranking, and operate the whole thing securely. Every module ends with an Interview Drill and is backed by executable proofs in [`examples/`](./examples/).

Supporting material:

- **[GLOSSARY.md](./GLOSSARY.md)**: Authoritative bilingual English ↔ Czech terminology index covering core search, distributed systems, Lucene, and Elasticsearch terms.
- **[CHEATSHEET.md](./CHEATSHEET.md)**: Fast-lookup reference covering key Elasticsearch APIs, Query DSL, ES|QL, cluster settings, and operational limits.
- **[exams/README.md](./exams/README.md)**: Official exam coverage matrix mapping all 9.3 exam domains to modules and test suites with zero gaps.
- **[exams/elastic-certified-engineer.md](./exams/elastic-certified-engineer.md)**: 70 original preparation questions across difficulty levels 1–3, with explanations, distractor analysis, hands-on tasks, and a 12-task mock exam.

## Prerequisites

- JSON and HTTP; basic SQL.
- The theory modules this track builds on: [indexing theory](../../architecture/data-systems/modules/03-indexing-theory-and-vector-search.md), [storage engines](../../architecture/data-systems/modules/02-storage-engines-b-trees-and-lsm.md), [replication](../../architecture/data-systems/modules/07-replication-mechanics-and-consensus.md) and [partitioning](../../architecture/data-systems/modules/08-partitioning-sharding-and-routing.md).

## Syllabus

| # | Module | Proofs |
| --- | --- | --- |
| 01 | [Search fundamentals and the Lucene realisation of IR theory](./modules/01-search-fundamentals-and-ir-theory.md): segments, postings, one-byte norms, BM25 exactly, query vs filter context, IR metrics | `01-search-fundamentals.test.ts` |
| 02 | [Cluster architecture, the write path and near-real-time search](./modules/02-cluster-architecture-and-near-real-time-search.md): node roles, Zen2, primary-backup, seq_no, refresh/translog/flush, merges, query-then-fetch, batched query phase, DFS | `02-architecture-nrt.test.ts` |
| 03 | [Mappings, field types, templates and runtime fields](./modules/03-mappings-field-types-and-templates.md): dynamic mapping, explosion limits, object vs nested, doc values, templates | `03-mappings.test.ts` |
| 04 | [Text analysis](./modules/04-text-analysis.md): char filters, tokenizers, token filters, positions, synonyms, autocomplete, normalizers, Czech folding | `04-text-analysis.test.ts` |
| 05 | [The Query DSL](./modules/05-query-dsl.md): full-text and term-level queries, bool algebra, sorting, pagination, templates, async search | `05-query-dsl.test.ts` + `fixtures/dsl/` |
| 06 | [ES\|QL](./modules/06-esql.md): pipeline semantics, NULLs, limits, STATS, LOOKUP JOIN, Views | `06-esql.test.ts` + `fixtures/esql/` |
| 07 | [Aggregations](./modules/07-aggregations.md): reduce algebra, terms error bounds, HLL++, percentiles, composite, histograms | `07-aggregations.test.ts` |
| 08 | [Ingest pipelines, reindexing and the data lifecycle](./modules/08-ingest-pipelines-and-data-lifecycle.md): processors, Painless, bulk, aliases, data streams, ILM, tiers, index modes | `08-ingest-lifecycle.test.ts` |
| 09 | [Vector, semantic and hybrid search](./modules/09-vector-and-hybrid-search.md): dense_vector, HNSW per segment, int8/int4/BBQ, filtered kNN, semantic_text, RRF retrievers | `09-vector-hybrid.test.ts` |
| 10 | [Scaling, sharding, allocation and multiple clusters](./modules/10-scaling-sharding-and-multi-cluster.md): murmur3 routing, split/shrink, sizing, awareness, CCS, CCR | `10-routing-sharding.test.ts` |
| 11 | [Operations, security, snapshots and upgrades](./modules/11-operations-security-and-upgrades.md): health and allocation explain, watermarks, heap, RBAC and API keys, SLM, 8 → 9 upgrades | `11-operations.test.ts` |
| 12 | [Lucene internals, relevance engineering and the ecosystem](./modules/12-lucene-internals-relevance-and-ecosystem.md): segment files, postings compression, `_rank_eval`, OpenSearch, PostgreSQL FTS, version history | `12-internals-relevance.test.ts` |

### Out of scope (owned elsewhere)

- Kibana, Elastic Agent, Beats, Logstash, OpenTelemetry/EDOT, APM and observability dashboards: the observability track.
- General IR, ANN, LSM, replication and partitioning theory: `architecture/data-systems`.
- TLS/PKI and identity protocols: `architecture/security-identity`.
- Elastic Security (SIEM) and machine-learning anomaly detection jobs: product features outside core Elasticsearch engineering.

## Running the examples

Tooling is pinned in `.mise.toml` / `mise.lock` (Node 26, TypeScript 7.0.2).

```bash
mise install
npm ci
npm test               # hermetic proofs: Lucene/ES models, DSL and ES|QL fixtures (no network)
npm run typecheck
docker compose up -d --wait
npm run test:integration   # real Elasticsearch 9.5.6; skips cleanly without a cluster
docker compose -f compose.3node.yml up -d --wait   # 3-node lab on port 9201 (ES_URL, ES_NODES=3)
```

The hermetic suite models Lucene and Elasticsearch behaviour in TypeScript (analysis chain, inverted index and BM25, segments and refresh, routing, aggregation reduce, ES|QL semantics, quantisation, lifecycle and allocation rules). The integration suite checks the models against a real node where only a cluster can decide.

## Certifications & Exams

| Exam | Vendor | Product version | Status | Format |
| --- | --- | --- | --- | --- |
| [Elastic Certified Engineer](https://www.elastic.co/training/elastic-certified-engineer-exam) | Elastic | 9.3 (per the [certification FAQ](https://www.elastic.co/training/certification/faq), verified 2026-11-04) | active | performance-based tasks on a live cluster, remotely proctored, documentation only; USD 500; valid 2 years |

The coverage matrix, exam-delta table (9.3 exam vs 9.5 track) and the question-bank mapping are in [exams/README.md](./exams/README.md). The full preparation question bank (70 questions, 33 hands-on tasks, plus a 12-task mock exam) is in [exams/elastic-certified-engineer.md](./exams/elastic-certified-engineer.md). No other vendor certification exists for Elasticsearch; every module's Interview Drill covers the interview format.
