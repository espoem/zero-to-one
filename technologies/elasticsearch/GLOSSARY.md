# Elasticsearch Bilingual Terminology Glossary

Terms used in the `technologies/elasticsearch/` track. All definitions are in English; each term gives its canonical English name and an established Czech equivalent. Where Czech technical usage has not settled on a translation, the English term is kept in _italics_ (as Czech engineering literature does), sometimes with a descriptive Czech gloss in parentheses. Definitions follow the Elasticsearch 9.5 and Lucene 10 documentation. Terms that also appear in the [root glossary](../../GLOSSARY.md) or in the [data-systems](../../architecture/data-systems/GLOSSARY.md), [distributed-systems](../../architecture/distributed-systems/GLOSSARY.md) or [DSA](../../algorithms/dsa/GLOSSARY.md) glossaries are copied verbatim, including the Czech term. The last column links to the module that teaches the term.

---

## 1. Search fundamentals (module 01)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Inverted Index** | **Invertovaný index** | An indexing data structure mapping each unique lexical term (token) to a sorted postings list of document identifiers containing that term. | Manning, Raghavan & Schütze; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Term** | **Term (termín)** | In Lucene the pair of a field name and a byte string; the same string in two fields is two terms with independent statistics. | Lucene documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Term Dictionary** | **Slovník termů** | The set of all terms of a field, sorted by their UTF-8 bytes, stored as blocks with an in-memory FST index. | Lucene documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Postings List** | **Seznam výskytů (postings list)** | For one term, the list of documents containing it, ordered by document id, with term frequencies and optionally positions and offsets. | Manning, Raghavan & Schütze; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Segment** | **Segment** | An immutable, self-contained Lucene index; a shard is the ordered set of its segments plus a commit point. | Lucene documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Norms** | _Norms_ (normy délky pole) | One byte per document per field that encodes the field length for BM25 length normalisation; it is lossy. | Lucene documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Doc Values** | _Doc values_ (sloupcová data dokumentů) | An on-disk, column-oriented structure mapping a document to its field value, written at index time and used for sorting, aggregations and scripts. | Elastic documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Stored Fields** | **Uložená pole** | Row-oriented, compressed storage of whole documents (`_source`, `_id`) used by the fetch phase. | Lucene documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **BM25** | **BM25 (Okapi BM25)** | The default ranking function of Lucene and Elasticsearch: idf times a saturating term-frequency component with length normalisation (`k1` 1.2, `b` 0.75). | Robertson & Zaragoza; Lucene documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Inverse Document Frequency (idf)** | **Inverzní dokumentová frekvence (idf)** | Weight of a term that decreases with the number of documents containing it; Lucene uses `ln(1 + (N - n + 0.5) / (n + 0.5))`, which is never negative. | Spärck Jones (1972); [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Query Context** | **Kontext dotazu (query context)** | The evaluation mode in which a clause both selects documents and contributes to the score. | Elastic documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Filter Context** | **Kontext filtru (filter context)** | The evaluation mode in which a clause only selects documents, contributes score 0 and can be cached. | Elastic documentation; [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Block-Max WAND** | **Block-Max WAND** | A top-k retrieval algorithm that skips postings blocks whose maximum possible score cannot enter the current top k. | Ding & Suel (2011); [M01](modules/01-search-fundamentals-and-ir-theory.md) |
| **Relevance** | **Relevance** | The degree to which a returned document satisfies the information need of the query; measured with judgement lists and metrics such as nDCG. | Manning, Raghavan & Schütze; [M01](modules/01-search-fundamentals-and-ir-theory.md) |

## 2. Cluster architecture and near-real-time search (module 02)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Cluster** | **Cluster (klastr)** | A set of Elasticsearch nodes that share a cluster name, elect one master and host indices together. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Node** | **Uzel (node)** | One Elasticsearch JVM process; its `node.roles` decide what it does. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Index** | **Index** | A logical namespace with one mapping and one set of settings, split into primary shards. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Shard** | **Shard** | The unit of data placement; each shard is one Lucene index with a primary copy and zero or more replicas. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Primary Shard** | **Primární shard** | The copy of a shard that first executes every write operation and then forwards it to the replicas. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Replica Shard** | **Replika (repliková kopie shardu)** | A copy of a primary shard that re-executes its operations; it provides availability and read throughput and never shares a node with its primary. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Master Node** | **Řídicí uzel (master)** | The elected node that owns and publishes the cluster state. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Cluster State** | **Stav clusteru (cluster state)** | Node list, index metadata, routing table and persistent settings; changed only by the elected master. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Coordinating Node** | **Koordinační uzel** | The node that receives a request, routes it to shards and reduces the partial results. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Voting Configuration** | **Hlasovací konfigurace** | The set of master-eligible nodes whose majority is required for elections and cluster-state commits. | Elastic documentation (cluster coordination); [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Quorum** | **Kvórum** | A subset of cluster nodes whose vote or acknowledgment is sufficient to validate an operation; majority quorums guarantee that any two quorums intersect by at least one node. | Gifford (SOSP 1979), Thomas (1979); [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Sequence Number** | **Pořadové číslo operace (`_seq_no`)** | A dense, monotonic per-shard number assigned by the primary to each write operation. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Primary Term** | **Primární term (`_primary_term`)** | A counter incremented on primary failover that fences operations of stale primaries. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Global Checkpoint** | **Globální kontrolní bod** | The minimum local checkpoint over the in-sync copies; all operations at or below it exist on every in-sync copy. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Optimistic Concurrency Control** | **Optimistické řízení souběhu** | Conditional writes with `if_seq_no` and `if_primary_term` that fail with HTTP 409 when the document changed since it was read. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Refresh** | _Refresh_ (obnovení vyhledávacího pohledu) | Writing the in-memory indexing buffer as a new searchable segment into the page cache; it makes documents visible but not durable. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Near-Real-Time Search** | **Vyhledávání téměř v reálném čase (NRT)** | The property that a written document becomes searchable only after the next refresh, by default within about one second. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Translog** | _Translog_ (transakční log shardu) | The per-shard write-ahead log that is fsynced before an acknowledgement (durability `request`) and replayed after a crash. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Write-Ahead Logging (WAL)** | **Zápis do předstihového deníku (WAL)** | A durability protocol requiring state modifications to be flushed to non-volatile sequential log storage before the corresponding dirty page blocks are written to heap storage. | Mohan et al. (ARIES Recovery Algorithm); [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Flush** | _Flush_ (Lucene commit) | A Lucene commit that fsyncs segments and starts a new translog generation, shortening recovery. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Merge** | **Slučování segmentů (merge)** | The background rewriting of several segments into one, which physically removes deleted documents. | Lucene documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Force Merge** | **Vynucené slučování (force merge)** | A manual merge to a given number of segments, appropriate for indices that are no longer written. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Query-Then-Fetch** | **Dotaz a následné načtení (query-then-fetch)** | The default two-phase search: shards return ids and scores, then only the final top documents are fetched. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Scatter-Gather** | **Dotazování metodou Scatter-Gather** | A query pattern where a coordinator broadcasts sub-queries to all partitioned shards simultaneously and aggregates the returned responses into a final result set. | Distributed Query Processing; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Adaptive Replica Selection** | **Adaptivní výběr repliky** | Choosing the shard copy with the best observed response time and queue size instead of round robin. | Elastic documentation; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Batched Query Phase** | _Batched query phase_ (dávková fáze dotazu) | Since 9.5, one query-phase request per data node with a node-level partial reduce (`search.batched_query_phase`). | Elastic release notes; [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |
| **Eventual Consistency** | **Konečná konzistence** | A consistency model where, in the absence of new updates, all replicas eventually converge to the same value. | Vogels (Eventually Consistent); [M02](modules/02-cluster-architecture-and-near-real-time-search.md) |

## 3. Mappings (module 03)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Mapping** | **Mapování (mapping)** | The schema of an index: for each field path a type and parameters, plus a `dynamic` policy; append-only. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Field Type** | **Typ pole** | The type that decides which Lucene structures (inverted index, points, doc values, norms, vectors) are written for a field. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Dynamic Mapping** | **Dynamické mapování** | Automatic type inference for unmapped fields; strings become `text` plus a `keyword` sub-field. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Mapping Explosion** | **Explozivní růst mapování (mapping explosion)** | Uncontrolled growth of the number of mapped fields, usually from user-supplied keys, which burdens the cluster state. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Text Field** | **Pole typu `text`** | A field analysed into terms for full-text search; it has no doc values. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Keyword Field** | **Pole typu `keyword`** | A field indexed as one unanalysed term (optionally normalised) for exact matching, sorting and aggregations. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Multi-Field** | **Víceúčelové pole (multi-field)** | Indexing one source value several ways through `fields`, for example a `text` field with a `keyword` sub-field. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Nested Field** | **Vnořené pole (`nested`)** | A field type that indexes each array element as a separate hidden document so that conditions stay on one element. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Flattened Field** | **Pole typu `flattened`** | A field type that maps a whole object with arbitrary keys as one field of keyword leaves. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Runtime Field** | **Runtime pole (pole počítané za běhu)** | A field evaluated at query time by a Painless script (schema on read). | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Fielddata** | _Fielddata_ | An on-heap uninverted structure for sorting and aggregating `text` fields; disabled by default and a heap risk. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Synthetic Source** | _Synthetic source_ (syntetický zdroj) | `_source` reconstructed from doc values and stored fields instead of being stored verbatim. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Composable Index Template** | **Skládatelná šablona indexu** | An `_index_template` that composes reusable component templates; only the matching template with the highest priority applies. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Component Template** | **Komponentní šablona** | A reusable building block of settings, mappings or aliases referenced in `composed_of`. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |
| **Dynamic Template** | **Dynamická šablona** | A rule with match conditions that decides how dynamically added fields are mapped. | Elastic documentation; [M03](modules/03-mappings-field-types-and-templates.md) |

## 4. Text analysis (module 04)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Analyzer** | **Analyzér** | A chain of char filters, one tokenizer and token filters that turns a string into terms. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Char Filter** | **Znakový filtr** | A component that rewrites the character stream before tokenisation while keeping offset corrections. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Tokenizer** | **Tokenizér** | The component that splits the character stream into tokens with positions and offsets. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Token Filter** | **Tokenový filtr** | A component that rewrites, removes or adds tokens after tokenisation. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Normalizer** | **Normalizér** | An analyzer for `keyword` fields restricted to character-level filters, so each value remains one term. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Stemming** | **Stemování (kmenování)** | Reducing inflected words to a common stem; the stem need not be a word. | Manning, Raghavan & Schütze; [M04](modules/04-text-analysis.md) |
| **Stop Word** | **Stop slovo** | A frequent word removed by the `stop` filter, which leaves a position gap. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Synonym Filter** | **Filtr synonym** | A token filter that stacks synonyms at the same position; `synonym_graph` handles multi-word rules. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Edge N-gram** | **Hranové n-gramy (edge n-grams)** | Prefixes of each word emitted as terms at index time for autocomplete. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **Position Increment Gap** | **Mezera v pozicích (`position_increment_gap`)** | The position gap (default 100) inserted between values of a multi-valued text field. | Elastic documentation; [M04](modules/04-text-analysis.md) |
| **ASCII Folding** | **Odstranění diakritiky (asciifolding)** | Mapping accented characters to their ASCII equivalents, such as `Příbor` to `pribor`. | Elastic documentation; [M04](modules/04-text-analysis.md) |

## 5. Query DSL (module 05)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Query DSL** | **Query DSL (dotazovací jazyk založený na JSON)** | Elasticsearch's JSON tree of query types executed as Lucene queries. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Full-Text Query** | **Fulltextový dotaz** | A query that analyses its input with the field's search analyzer, such as `match`. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Term-Level Query** | **Termový dotaz (bez analýzy)** | A query that does not analyse its input, such as `term`, `range` or `exists`. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Compound Query** | **Složený dotaz** | A query that combines others, such as `bool`, `dis_max`, `function_score` or `constant_score`. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Fuzziness** | **Přibližné vyhledávání (fuzziness)** | Matching terms within a Damerau-Levenshtein edit distance; `AUTO` chooses 0, 1 or 2 edits by term length. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Slop** | **Tolerance pozic (slop)** | The number of position moves a phrase query may use. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Pagination** | **Stránkování** | Retrieving results in pages: `from`/`size` up to the result window, `search_after`, or scroll. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Search After** | _Search after_ (stránkování pomocí hodnot řazení) | Resuming a sorted search after the sort values of the last hit; needs a unique tiebreaker. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Point in Time (PIT)** | **Bod v čase (PIT)** | A lightweight snapshot of the segments of one or more indices that gives consistent pagination. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Scroll** | _Scroll_ | A legacy API that keeps a search context open to read large result sets. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Search Template** | **Šablona dotazu** | A stored Mustache script rendered into a search body from parameters. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Highlighting** | **Zvýraznění nalezených výrazů** | Returning fragments of the original text with matched terms wrapped in tags. | Elastic documentation; [M05](modules/05-query-dsl.md) |
| **Async Search** | **Asynchronní vyhledávání** | Running a long search in the background and retrieving partial or final results by id. | Elastic documentation; [M05](modules/05-query-dsl.md) |

## 6. ES|QL (module 06)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **ES\|QL** | **ES\|QL (piped dotazovací jazyk Elasticsearch)** | A piped, columnar query language executed by a dedicated compute engine inside Elasticsearch. | Elastic documentation; [M06](modules/06-esql.md) |
| **Lookup Join** | **Spojení s vyhledávacím indexem (`LOOKUP JOIN`)** | A left outer join of an ES\|QL table with an index of mode `lookup`, one output row per match. | Elastic documentation; [M06](modules/06-esql.md) |
| **Enrich Policy** | **Obohacovací politika (enrich policy)** | A periodically executed snapshot of a source index used by `ENRICH` and the ingest `enrich` processor. | Elastic documentation; [M06](modules/06-esql.md) |
| **Three-Valued Logic** | **Trojhodnotová logika** | Logic with TRUE, FALSE and NULL; a `WHERE` predicate that is NULL drops the row. | Kleene; [M06](modules/06-esql.md) |
| **Multi-Valued Field** | **Vícehodnotové pole** | A field with several values in one document; most scalar ES\|QL functions return NULL on it. | Elastic documentation; [M06](modules/06-esql.md) |

## 7. Aggregations (module 07)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Aggregation** | **Agregace** | A distributed summary computed from doc values: metric, bucket or pipeline. | Elastic documentation; [M07](modules/07-aggregations.md) |
| **Bucket** | _Bucket_ (skupina dokumentů) | A set of documents with a `doc_count` and optional sub-aggregations. | Elastic documentation; [M07](modules/07-aggregations.md) |
| **Pipeline Aggregation** | **Pipeline agregace** | An aggregation computed from the output of other aggregations on the coordinating node. | Elastic documentation; [M07](modules/07-aggregations.md) |
| **Shard Size** | _Shard size_ (počet termů z každého shardu) | The number of terms each shard returns to a `terms` aggregation, default `size × 1.5 + 10`. | Elastic documentation; [M07](modules/07-aggregations.md) |
| **Composite Aggregation** | **Kompozitní agregace** | An exhaustive, paginated bucket aggregation using `after_key`. | Elastic documentation; [M07](modules/07-aggregations.md) |
| **HyperLogLog** | **HyperLogLog** | A space-efficient probabilistic algorithm estimating the cardinality of unique elements in a multiset using the harmonic mean of leading zero counts. | Flajolet et al. (2007); [M07](modules/07-aggregations.md) |
| **Cardinality** | **Kardinalita** | The number of distinct values; Elasticsearch estimates it with HyperLogLog++. | Elastic documentation; [M07](modules/07-aggregations.md) |
| **TDigest** | **TDigest** | A mergeable sketch of weighted centroids used for approximate percentiles. | Dunning; [M07](modules/07-aggregations.md) |
| **Post Filter** | _Post filter_ (filtr po agregacích) | A filter applied to hits after aggregations are computed, used for facets. | Elastic documentation; [M07](modules/07-aggregations.md) |
| **Circuit Breaker** | **Jistič paměti (circuit breaker)** | A limit that rejects a request instead of letting the node run out of memory. | Elastic documentation; [M07](modules/07-aggregations.md) |

## 8. Ingest and data lifecycle (module 08)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Ingest Pipeline** | **Ingest pipeline** | An ordered list of processors applied to a document before it is indexed. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Processor** | **Procesor** | One step of an ingest pipeline, such as `set`, `dissect` or `script`. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Painless** | **Painless** | Elasticsearch's sandboxed scripting language compiled to JVM bytecode. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Bulk API** | **Hromadné zápisy (bulk API)** | An NDJSON endpoint executing many index, create, update and delete actions with per-item results. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Reindex** | **Reindexace (reindex)** | Copying documents from one index to another, optionally through a pipeline. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Idempotence / Idempotency** | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics); [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Alias** | **Alias** | A name that points to one or more indices, optionally with a filter and routing. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Data Stream** | _Data stream_ | An append-only sequence of hidden backing indices addressed by one name, for timestamped data. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Backing Index** | **Podkladový index (backing index)** | A hidden index of a data stream; the newest is the write index. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Rollover** | _Rollover_ | Creating a new write index when a size, age or document-count condition is met. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Index Lifecycle Management (ILM)** | **Správa životního cyklu indexů (ILM)** | A policy engine that moves indices through hot, warm, cold, frozen and delete phases. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Data Stream Lifecycle** | **Životní cyklus data streamu** | A simpler built-in alternative to ILM offering retention and downsampling. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Data Tier** | **Datová vrstva (data tier)** | A class of nodes (hot, warm, cold, frozen, content) with a role-based allocation preference. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Searchable Snapshot** | **Prohledávatelný snímek (searchable snapshot)** | An index served directly from a snapshot repository; fully mounted (cold) or partially mounted (frozen). | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |
| **Index Mode** | **Režim indexu (index mode)** | A preset for an index: `standard`, `time_series`, `logsdb` or `lookup`. | Elastic documentation; [M08](modules/08-ingest-pipelines-and-data-lifecycle.md) |

## 9. Vector and hybrid search (module 09)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Approximate Nearest Neighbor (ANN)** | **Aproximativní vyhledávání nejbližších sousedů (ANN)** | Algorithmic techniques that search for vectors closest to a query embedding in high-dimensional metric space with bounded recall trade-offs for orders-of-magnitude faster query latency. | Indyk & Motwani (1998); [M09](modules/09-vector-and-hybrid-search.md) |
| **Dense Vector** | **Hustý vektor (`dense_vector`)** | A fixed-length array of numbers produced by an embedding model and indexed in an HNSW graph. | Elastic documentation; [M09](modules/09-vector-and-hybrid-search.md) |
| **Embedding** | **Vektorová reprezentace (embedding)** | A vector that places a text or other item in a space where similar items are close. | Mikolov et al.; [M09](modules/09-vector-and-hybrid-search.md) |
| **HNSW** | **HNSW (hierarchický navigovatelný graf malého světa)** | The layered proximity graph Lucene builds per segment for approximate nearest-neighbour search. | Malkov & Yashunin (2016); [M09](modules/09-vector-and-hybrid-search.md) |
| **Quantisation** | **Kvantizace** | Storing vector components with fewer bits (int8, int4, BBQ) to reduce memory. | Elastic documentation; [M09](modules/09-vector-and-hybrid-search.md) |
| **Better Binary Quantization (BBQ)** | _Better Binary Quantization_ (BBQ) | Elastic's one-bit-per-dimension quantisation with corrective factors, used with oversampling and rescoring. | Elastic documentation; [M09](modules/09-vector-and-hybrid-search.md) |
| **Retriever** | _Retriever_ | A stage of a search request tree (`standard`, `knn`, `rrf`, `linear`, reranker) that composes retrieval and ranking. | Elastic documentation; [M09](modules/09-vector-and-hybrid-search.md) |
| **Reciprocal Rank Fusion (RRF)** | **Fúze podle převrácených pořadí (RRF)** | A rank-only fusion `sum 1 / (k + rank)` over several result lists, with `k` 60. | Cormack, Clarke & Büttcher (2009); [M09](modules/09-vector-and-hybrid-search.md) |
| **Semantic Text** | **Sémantický text (`semantic_text`)** | A field type that infers and stores embeddings through an inference endpoint and chunks long text. | Elastic documentation; [M09](modules/09-vector-and-hybrid-search.md) |
| **ELSER** | **ELSER (učený řídký kodér)** | Elastic Learned Sparse EncodeR; expands text into weighted vocabulary terms stored in a `sparse_vector` field. | Elastic documentation; [M09](modules/09-vector-and-hybrid-search.md) |

## 10. Scaling and multiple clusters (module 10)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Routing** | **Směrování dokumentů (routing)** | Choosing the shard of a document from a routing value, by default its `_id`, with murmur3. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Routing Shards** | **Směrovací shardy (`number_of_routing_shards`)** | The hash space size that makes `_split` map each source shard to a fixed set of target shards. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Split** | **Dělení indexu (`_split`)** | Increasing the number of primaries by a factor using hard links. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Shrink** | **Zmenšení indexu (`_shrink`)** | Reducing the number of primaries to a factor of the original. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Allocation Awareness** | **Povědomí o umístění (allocation awareness)** | Spreading shard copies across values of a node attribute such as a zone. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Forced Awareness** | _Forced awareness_ (vynucené povědomí o umístění) | Awareness that refuses to place all copies in the surviving zone, leaving replicas unassigned. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Cross-Cluster Search (CCS)** | **Vyhledávání napříč clustery (CCS)** | Querying registered remote clusters with the `cluster:index` syntax. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Cross-Cluster Replication (CCR)** | **Replikace napříč clustery (CCR)** | Pull-based replication of a leader index to a read-only follower index on another cluster. | Elastic documentation; [M10](modules/10-scaling-sharding-and-multi-cluster.md) |
| **Document-Partitioned Index (Local)** | **Index dělený dle dokumentů (lokální sekundární index)** | Secondary index design where index entries are stored on the same shard as the primary data tuple, requiring scatter-gather queries across all shards to evaluate search predicates. | Kleppmann (DDIA); [M10](modules/10-scaling-sharding-and-multi-cluster.md) |

## 11. Operations, security and upgrades (module 11)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Cluster Health** | **Zdraví clusteru** | Green, yellow or red status derived from the assignment of primary and replica shards. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Allocation Explain** | **Vysvětlení alokace (`_cluster/allocation/explain`)** | The API that lists, per node, every allocation decider's decision for a shard. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Disk Watermark** | _Watermark_ (práh zaplnění disku) | Disk-usage thresholds (low 85%, high 90%, flood stage 95%) that stop, move or block shards. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Bootstrap Check** | **Startovní kontrola (bootstrap check)** | A production-mode check of heap, file descriptors, `max_map_count` and discovery that blocks node start when it fails. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Role-Based Access Control (RBAC)** | **Řízení přístupu na základě rolí (RBAC)** | Authorisation through roles with cluster, index and application privileges. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Document-Level Security** | **Zabezpečení na úrovni dokumentů (DLS)** | A role query that limits which documents a user can search. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Field-Level Security** | **Zabezpečení na úrovni polí (FLS)** | A role setting that limits which fields a user can see. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **API Key** | **API klíč** | A scoped, expiring and revocable credential for services. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Snapshot** | **Snímek (snapshot)** | A backup of indices stored in a repository, incremental at segment-file level. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Snapshot Lifecycle Management (SLM)** | **Správa životního cyklu snímků (SLM)** | Scheduled snapshots with retention rules. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |
| **Rolling Upgrade** | **Průběžný upgrade (rolling upgrade)** | Upgrading nodes one at a time while the cluster stays available. | Elastic documentation; [M11](modules/11-operations-security-and-upgrades.md) |

## 12. Lucene internals, relevance and ecosystem (module 12)

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Codec** | **Kodek (codec)** | The Lucene component that defines the file formats of a segment. | Lucene documentation; [M12](modules/12-lucene-internals-relevance-and-ecosystem.md) |
| **BKD Tree** | **BKD strom** | A block k-d tree used for numeric, date, IP and geo points. | Procopiuc et al.; [M12](modules/12-lucene-internals-relevance-and-ecosystem.md) |
| **Finite State Transducer (FST)** | **Konečný převodník (FST)** | A minimal acyclic automaton with outputs, used as the in-memory index of the term dictionary. | Lucene documentation; [M12](modules/12-lucene-internals-relevance-and-ecosystem.md) |
| **Ranking Evaluation** | **Vyhodnocení pořadí (`_rank_eval`)** | The API that computes precision, recall, MRR, DCG or ERR for rated queries. | Elastic documentation; [M12](modules/12-lucene-internals-relevance-and-ecosystem.md) |
| **Normalized Discounted Cumulative Gain (nDCG)** | **Normalizovaný diskontovaný kumulativní zisk (nDCG)** | A graded ranking metric whose DCG is divided by the ideal DCG. | Järvelin & Kekäläinen (2002); [M12](modules/12-lucene-internals-relevance-and-ecosystem.md) |
| **OpenSearch** | **OpenSearch** | The Apache 2.0 fork of Elasticsearch and Kibana 7.10.2, governed by the OpenSearch Software Foundation. | OpenSearch Software Foundation; [M12](modules/12-lucene-internals-relevance-and-ecosystem.md) |
