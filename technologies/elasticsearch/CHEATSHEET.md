# Elasticsearch 9.5 Cheatsheet

Fast lookup for the material taught in [modules/](modules/). Every value comes from a module; defaults are those stated there. Verified against Elasticsearch 9.5.6 (Lucene 10.5.2). The Elastic Certified Engineer exam runs on 9.3; differences are marked **9.5 only**.

## 1. Search fundamentals ([01](modules/01-search-fundamentals-and-ir-theory.md))

| Topic | Value or rule |
| --- | --- |
| BM25 | `idf × tf / (tf + k1 × (1 − b + b × len / avgdl))`; `idf = ln(1 + (N − n + 0.5) / (n + 0.5))`; `k1` 1.2, `b` 0.75 |
| Statistics scope | per shard; deleted but unmerged documents still count; `dfs_query_then_fetch` collects global statistics |
| Norms | 1 byte per document per field; lengths below 24 exact, then about 1/8 relative error |
| `track_total_hits` | default 10000 (`gte` beyond); `true` exact; `false` none |
| `index_options` | `docs` (keyword), `freqs`, `positions` (text default), `offsets` |
| Query vs filter | filter: no score, cacheable, `bool.filter` and `must_not`; query: scored |
| Node query cache | segments with at least 10,000 docs and at least 3% of the shard (unverified for 9.x) |
| `term` on `text` | no analysis; use `match`, or a `keyword` sub-field |

## 2. Architecture and NRT ([02](modules/02-cluster-architecture-and-near-real-time-search.md))

| Topic | Value or rule |
| --- | --- |
| Defaults | 1 primary, 1 replica per index; `refresh_interval` 1s (only for shards searched in the last 30s, `index.search.idle.after`) |
| Roles | `master`, `voting_only`, `data`, `data_content`, `data_hot`, `data_warm`, `data_cold`, `data_frozen`, `ingest`, `ml`, `transform`, `remote_cluster_client`; empty list = coordinating only |
| Write path | route to primary, assign `_seq_no` and `_primary_term`, forward to in-sync replicas, fsync translog, ack |
| `wait_for_active_shards` | default 1; a pre-flight check, not a quorum |
| Refresh options | `refresh=false` (default), `wait_for`, `true`; `POST /idx/_refresh` |
| Translog | durability `request` (fsync before ack) or `async` (`sync_interval` 5s); `flush_threshold_size` 10 GB |
| OCC | `if_seq_no` + `if_primary_term`; conflict = HTTP 409 |
| Merge policy | `segments_per_tier` 10, `max_merge_at_once` 10, `max_merged_segment` 5 GB, `deletes_pct_allowed` 20 |
| Read path | pick copy (adaptive replica selection), query phase, reduce, fetch phase |
| 9.5 only | `search.batched_query_phase`: one query request per data node |
| Bulk-load recipe | `refresh_interval: -1`, `number_of_replicas: 0`, then restore both |

## 3. Mappings and templates ([03](modules/03-mappings-field-types-and-templates.md))

| Topic | Value or rule |
| --- | --- |
| Dynamic types | boolean, integer → `long`, float → `float`, date strings → `date`, other strings → `text` + `keyword` (`ignore_above` 256) |
| `dynamic` | `true`, `runtime`, `false` (ignored, kept in `_source`), `strict` (reject) |
| Limits | `total_fields.limit` 1000, `depth.limit` 20, `nested_fields.limit` 50, `nested_objects.limit` 10000 |
| Parameters | `index`, `doc_values` (not text), `norms`, `ignore_above`, `ignore_malformed`, `copy_to`, `null_value`, `fielddata` (false), `eager_global_ordinals` |
| Fielddata breaker | `indices.breaker.fielddata.limit` 40% of heap |
| Object arrays | flattened, cross-matches; `nested` = hidden documents, needs `nested` query |
| Template rules | highest `priority` wins, one template applies; equal priority + overlap rejected; applies at creation only; built-in `logs-*-*` at priority 100 |
| Simulate | `POST _index_template/_simulate_index/<name>` |
| Dynamic template conditions | `match_mapping_type`, `match`/`unmatch`, `path_match`/`path_unmatch`; first match wins |
| Runtime field | mapping `runtime` section or `runtime_mappings`; `emit(...)` |
| Synthetic source | `index.mapping.source.mode`; default for `logsdb` and `time_series`; paid otherwise |

## 4. Text analysis ([04](modules/04-text-analysis.md))

| Topic | Value or rule |
| --- | --- |
| Chain | char filters, one tokenizer, token filters |
| Analyzer lookup (index) | field `analyzer`, index `default`, `standard` |
| Analyzer lookup (search) | query `analyzer`, field `search_analyzer`, field `analyzer`, index `default_search`, `standard` |
| `_analyze` | `GET /_analyze { "analyzer": ..., "text": ... }`, `GET /idx/_analyze { "field": ..., "text": ... }`, `"explain": true` |
| `standard` | UAX #29, no stop words, `max_token_length` 255 |
| Position effects | `stop` leaves a gap; synonyms stack (posInc 0) |
| Normalizer | keyword tokenizer + character-level filters only |
| Synonyms | `PUT _synonyms/<set>`; `synonym_graph` with `"updateable": true` at search time; `POST /idx/_reload_search_analyzers` for file-based |
| Autocomplete | index with `edge_ngram`, search with `standard`; `index.max_ngram_diff` default 1 |
| `position_increment_gap` | default 100 |
| Lucene term limit | 32,766 bytes |

## 5. Query DSL ([05](modules/05-query-dsl.md))

| Topic | Value or rule |
| --- | --- |
| `bool` | `must` (scored), `filter` (not scored, cached), `should`, `must_not`; `minimum_should_match` default 1 without `must`/`filter`, else 0 |
| `match` | `operator` or/and, `minimum_should_match`, `fuzziness` (`AUTO`: 0 edits for 1-2 chars, 1 for 3-5, 2 above), `prefix_length` 0, `max_expansions` 50 |
| `multi_match` types | `best_fields` (default, `tie_breaker`), `most_fields`, `cross_fields`, `phrase`, `phrase_prefix`, `bool_prefix` |
| `terms` limit | `index.max_terms_count` 65,536 |
| Date math | `now-1d/d` rounds; unrounded `now` is not cached |
| `from` + `size` | at most `index.max_result_window` (10,000) |
| `search_after` | explicit `sort`, `from` 0, unique tiebreaker; with PIT use `_shard_doc` |
| PIT | `POST /idx/_pit?keep_alive=1m`, search without index in path, `DELETE /_pit` |
| Scroll | `POST /idx/_search?scroll=1m`, `POST /_search/scroll`, `DELETE /_search/scroll`; sort `_doc` |
| Sorting | needs doc values; `missing` `_last`; `mode` min/max/sum/avg/median |
| Highlighters | `unified` (default), `plain`, `fvh`; `index.highlight.max_analyzed_offset` 1,000,000 |
| Templates | `PUT _scripts/<id>` (mustache), `GET /idx/_search/template`, `POST _render/template`; `{{#toJson}}` for arrays |
| Async search | `POST /idx/_async_search?wait_for_completion_timeout=..&keep_on_completion=true&keep_alive=1d`, `GET /_async_search/<id>`, `/status/<id>`, `DELETE` |
| Debugging | `_validate/query?explain`, `_explain/<id>`, `profile`, `_analyze` |

## 6. ES\|QL ([06](modules/06-esql.md))

| Topic | Value or rule |
| --- | --- |
| Endpoint | `POST /_query?format=json\|csv\|txt` with `query`, `filter`, `params`; async `POST /_query/async` |
| Row limit | 1000 default, 10,000 maximum (`esql.query.result_truncation_default_size`, `esql.query.result_truncation_max_size`); output only |
| Commands | `FROM`, `ROW`, `WHERE`, `EVAL`, `STATS ... BY`, `SORT`, `KEEP`, `DROP`, `RENAME`, `LIMIT`, `MV_EXPAND`, `DISSECT`, `GROK`, `ENRICH`, `LOOKUP JOIN`, `FORK`/`FUSE` |
| Equality | `==` compares, `=` assigns |
| NULL | `WHERE` drops NULL predicates; `COUNT(*)` rows vs `COUNT(field)` non-null; `SORT` NULL last for `ASC` |
| Integer division | `7 / 2` = 3 |
| Full-text | `MATCH(field, "text")` or `field : "text"`; a `text` field with `==` compares the whole string |
| `LOOKUP JOIN` | right side `index.mode: lookup`; left join; one row per match |
| `STATS` output | aggregates first, then `BY` columns |
| 9.5 only | Views and PromQL arrived in 9.4 (tech preview); not on a 9.3 exam cluster |

## 7. Aggregations ([07](modules/07-aggregations.md))

| Topic | Value or rule |
| --- | --- |
| Families | metric, bucket, pipeline; `size: 0` for no hits |
| `buckets_path` | `agg>sub_agg.metric`, `_count`, `_bucket_count` |
| `terms` | `shard_size` default `size × 1.5 + 10`; `doc_count_error_upper_bound`, `sum_other_doc_count`, `show_term_doc_count_error` |
| `cardinality` | HyperLogLog++; `precision_threshold` default 3000, max 40000 |
| `percentiles` | TDigest, `compression` 100; HDR optional |
| `composite` | exact; `after` / `after_key`; `missing_bucket` |
| `date_histogram` | `fixed_interval`, `calendar_interval`, `time_zone`, `offset`; `interval` removed in 8.0 |
| Limits | `search.max_buckets` 65,536; request breaker 60%; parent breaker 95% (real memory) |
| Facets | `post_filter` filters hits after aggregations |
| Request cache | `size: 0` requests, per shard, invalidated by refresh |
| 9.5 only | `multi_terms` capped at 128 fields (9.5.5, 9.4.8) |

## 8. Ingest and lifecycle ([08](modules/08-ingest-pipelines-and-data-lifecycle.md))

| Topic | Value or rule |
| --- | --- |
| Pipelines | `PUT _ingest/pipeline/<id>`, `POST _ingest/pipeline/<id>/_simulate` (`?verbose=true`), `index.default_pipeline`, `index.final_pipeline` |
| Failure order | `ignore_failure`, processor `on_failure`, pipeline `on_failure`, else reject |
| Painless contexts | ingest `ctx.field`; update `ctx._source.field`; search `doc['f'].value` |
| Script compilation | `script.max_compilations_rate`; pass values as `params` |
| Bulk | NDJSON, trailing newline, HTTP 200 with `errors: true`, 429 = back off |
| Reindex | `slices=auto`, `wait_for_completion=false`, `op_type: create`, `conflicts: proceed`, `_tasks`, `_rethrottle` |
| By-query | snapshot at start, conflict aborts unless `conflicts=proceed`, no rollback |
| Aliases | `POST _aliases` atomic; write alias needs `is_write_index` on exactly one index |
| Data streams | template with `data_stream: {}`; `@timestamp` required; `op_type: create` only; `.ds-<name>-<date>-<generation>` |
| Rollover | any `max_*` (`max_age`, `max_docs`, `max_size`, `max_primary_shard_size`, `max_primary_shard_docs`) and all `min_*`; empty index never |
| ILM | `indices.lifecycle.poll_interval` 10m; `min_age` from rollover; `_ilm/explain`, `_ilm/retry`; phases hot, warm, cold, frozen, delete |
| Data stream lifecycle | `PUT _data_stream/<n>/_lifecycle { "data_retention": "30d" }`; `index.lifecycle.prefer_ilm` |
| Tiers | `index.routing.allocation.include._tier_preference`; searchable snapshots need Enterprise |
| Index modes | `standard`, `time_series`, `logsdb`, `lookup` |
| 9.5 only | `frozen_after` in data stream lifecycle; columnar index modes (tech preview) |

## 9. Vector and hybrid search ([09](modules/09-vector-and-hybrid-search.md))

| Topic | Value or rule |
| --- | --- |
| `dense_vector` | `dims` up to 4096, `similarity` `cosine` (default) / `dot_product` / `l2_norm` / `max_inner_product`, `m` 16, `ef_construction` 100 |
| `index_options.type` | `hnsw`, `int8_hnsw`, `int4_hnsw`, `bbq_hnsw`, `*_flat`, `bbq_disk` (Enterprise) |
| `knn` | `k`, `num_candidates` (default `min(1.5 × k, 10000)`), `filter` (during search), `similarity` |
| Cosine score | `(1 + cos) / 2` |
| BBQ | rescore with `rescore_vector.oversample` (1 to 10, or 0 to disable) |
| Retrievers | `standard`, `knn`, `rrf`, `linear`, `text_similarity_reranker`, `rule`, `pinned`, `rescorer` |
| RRF | `sum 1 / (rank_constant + rank)`, `rank_constant` 60, `rank_window_size` |
| `semantic_text` | default ELSER endpoint, chunking, `inference_id`, `search_inference_id` |
| Defaults by version | `int8_hnsw` in 9.0, `bbq_hnsw` for 384 dims or more in later 9.x (docs inconsistent, check the 9.3 docs on the exam) |

## 10. Scaling and multiple clusters ([10](modules/10-scaling-sharding-and-multi-cluster.md))

| Topic | Value or rule |
| --- | --- |
| Routing | ES 9+: `floorMod(murmur3(routing), primaries)`; legacy 7/8: `floorMod(murmur3, R) / (R/P)`; hash of UTF-16LE bytes |
| Example | `_id` 654321 with 6 primaries → shard 2 (legacy ES 7/8: shard 4) |
| Routing shards | legacy default largest power-of-two multiple up to 1024; ES 9+ splits directly modulo target shard count |
| Resizing | `_split` (multiple), `_shrink` (factor), `_clone`; source needs `index.blocks.write: true` |
| Custom routing | `?routing=`; same value on get/update/delete; `_routing.required`; `index.routing_partition_size` |
| Shard sizing | 10 to 50 GB per shard, under 200 million documents, `cluster.max_shards_per_node` 1000 (3000 frozen) |
| Replicas | `auto_expand_replicas: 0-all` for small reference indices |
| Allocation deciders | same shard, disk threshold, awareness, filtering, tier preference, `total_shards_per_node`, throttling (`node_concurrent_recoveries` 2), `index.allocation.max_retries` 5 |
| Awareness | `node.attr.zone`, `cluster.routing.allocation.awareness.attributes`, `...awareness.force.zone.values` |
| Filtering | `index.routing.allocation.include/exclude/require.<attr>`; drain with `cluster.routing.allocation.exclude._name` |
| Retry | `POST _cluster/reroute?retry_failed=true` |
| CCS | `cluster.remote.<name>.seeds` or `mode: proxy`; `skip_unavailable` default true; `remote_cluster_client` role; `ccs_minimize_roundtrips` default true |
| CCR | Platinum/Enterprise; `PUT /f/_ccr/follow`, `PUT _ccr/auto_follow/<n>`; followers read-only |

## 11. Operations, security and upgrades ([11](modules/11-operations-security-and-upgrades.md))

| Topic | Value or rule |
| --- | --- |
| Health | green all assigned; yellow replica unassigned; red primary unassigned |
| Diagnosis | `_cluster/health`, `_cat/shards?v&h=index,shard,prirep,state,unassigned.reason`, `_cluster/allocation/explain`, `_health_report` |
| Watermarks | low 85% (no new shards), high 90% (move away), flood 95% (`read_only_allow_delete`, auto-released below high) |
| Heap | automatic in 8+; if manual: at most 50% of RAM and about 31 GB |
| System | disable swap, `vm.max_map_count` ≥ 262144, file descriptors 65535+ |
| Production mode | non-loopback `network.host` enables bootstrap checks; `discovery.type: single-node` for one node |
| Bootstrap | `cluster.initial_master_nodes` on first start only |
| Breakers | parent 95%, request 60%, fielddata 40%, in-flight 100% |
| Indexing pressure | `indexing_pressure.memory.limit` 10% of heap |
| Slow logs | `index.search.slowlog.threshold.query.warn`, `index.indexing.slowlog.threshold.index.warn` |
| Security | on by default since 8.0; roles, `POST /_security/role`, `/user`, `/api_key`; ingestion privileges `create_doc`, `auto_configure`; `GET /_security/_authenticate` |
| Snapshots | `PUT _snapshot/<repo>`, `PUT _snapshot/<repo>/<snap>`, `POST _snapshot/<repo>/<snap>/_restore`; `fs` needs `path.repo` |
| SLM | `PUT _slm/policy/<id>`; Quartz cron (seconds first, UTC); retention `expire_after`, `min_count`, `max_count` |
| Stale primary | `_cluster/reroute` `allocate_stale_primary` / `allocate_empty_primary` with `accept_data_loss: true` |
| Upgrade | 9.1+ needs 8.19.x first; 7.x-created indices reindexed or archived; `GET /_migration/deprecations`; tiers frozen to hot, masters last |

## 12. Internals, relevance and ecosystem ([12](modules/12-lucene-internals-relevance-and-ecosystem.md))

| Topic | Value or rule |
| --- | --- |
| Segment files | `.tim/.tip` terms, `.doc/.pos/.pay` postings, `.nvd` norms, `.dvd` doc values, `.fdt` stored fields, `.kdd/.kdi` points, `.vec/.vex` vectors, `.liv` live docs |
| Postings | gaps in blocks of 128, bit-packed (PFOR) |
| Points | BKD tree, leaves of up to 512 points; map numeric identifiers as `keyword` |
| Merge settings | see section 2; `floor_segment` 2 MB; `index.merge.scheduler.max_thread_count` |
| `_rank_eval` | metrics `precision`, `recall`, `mean_reciprocal_rank`, `dcg` (`normalize: true`), `expected_reciprocal_rank` |
| Inspection | `GET _cat/segments?v`, `_disk_usage?run_expensive_tasks=true` |
| OpenSearch | Apache 2.0 fork of 7.10.2; 3.x on Lucene 10; separate clients |
| Versions | 9.0 Lucene 10, 9.4 ES\|QL Views, 9.5 batched query phase |
