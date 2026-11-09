# Module 05: The Query DSL

The Query DSL is Elasticsearch's JSON abstract syntax tree for Lucene queries. Each JSON object names one query type and its parameters; the coordinating node parses it, each shard rewrites it into Lucene `Query` objects, and Lucene executes them per segment. This module gives the semantics of the query types you meet in interviews and in the Elastic Certified Engineer exam, the scoring algebra that combines them, and the pagination and templating machinery around them.

Every request in this module that the model engine can run lives as a JSON fixture in [`examples/fixtures/dsl/`](../examples/fixtures/dsl/) with a `semantics` explanation and an expected result. [`examples/05-query-dsl.test.ts`](../examples/05-query-dsl.test.ts) validates every fixture structurally, executes it against the products dataset in [`examples/fixtures/products.json`](../examples/fixtures/products.json), and asserts the hits. Fixtures marked `"execute": false` (highlighting, `function_score`, PIT) are validated only, and their semantics are explained here.

---

## 1. Anatomy of a Search Request

```json
GET /products/_search
{
  "query":        { ... },
  "post_filter":  { ... },
  "aggs":         { ... },
  "sort":         [ ... ],
  "from": 0, "size": 10,
  "search_after": [ ... ],
  "pit":          { "id": "...", "keep_alive": "1m" },
  "_source":      { "includes": [ ... ] },
  "fields":       [ ... ],
  "highlight":    { ... },
  "track_total_hits": 10000,
  "runtime_mappings": { ... },
  "collapse":     { "field": "..." },
  "rescore":      { ... },
  "knn":          { ... },
  "retriever":    { ... }
}
```

**Definition (query semantics).** A query $q$ denotes a pair $(M(q), S_q)$: a set of matching documents and a scoring function $S_q : M(q) \to \mathbb{R}_{\ge 0}$. A query in **filter context** denotes $(M(q), 0)$. The top-level `query` is in query context.

The parser is strict: an unknown key (`"mtach"`) or a single-field query with two fields is a `parsing_exception` (fixtures `18-unknown-query-negative` and `14-term-multiple-fields-invalid`). Strictness is a feature: silent ignoring would hide typos in production queries.

---

## 2. Full-Text Queries

Full-text queries **analyse** the query string with the field's search analyzer (module 04), then build a Lucene query from the resulting terms.

| Query | Builds | Use |
| --- | --- | --- |
| `match` | `bool.should` of term queries (or `must` with `operator: and`) | the default for user input |
| `match_phrase` | `PhraseQuery` over positions, with `slop` | exact phrase, word order |
| `match_phrase_prefix` | phrase + prefix on the last term | poor-man's autocomplete |
| `match_bool_prefix` | `bool` of terms + prefix on last term | used by `search_as_you_type` |
| `multi_match` | several `match` queries combined by type | search across fields |
| `combined_fields` | BM25F: fields treated as one combined field | title + body as one text |
| `query_string` | Lucene syntax parser (`AND`, `OR`, `field:`, wildcards) | power users; throws on syntax errors |
| `simple_query_string` | forgiving subset (`+`, `\|`, `-`, `"`) | end-user search boxes; never throws |
| `intervals` | ordered/unordered proximity rules | legal and patent search |

### 2.1 `match`

```json
{ "match": { "description": { "query": "the wireless keyboards", "operator": "and" } } }
```

With the `english` analyzer, the query text becomes `[wireless, keyboard]` (stop word removed, plural stemmed). With `operator: and` both must match (fixture `04-match-operator-and` → p2 and p5). Parameters:

- `operator`: `or` (default) or `and`.
- `minimum_should_match`: an integer (`2`), negative (`-1`: all but one), percentage (`75%`, rounded **down**), or combination (`3<90%`).
- `fuzziness`: `AUTO` (0 edits for 1–2 characters, 1 for 3–5, 2 above), or 0/1/2. Fixture `10-fuzzy-match` finds `keyboard` from `keybord`. `prefix_length` (default 0) and `max_expansions` (default 50) bound the term expansion, and transpositions count as one edit (Damerau). Fuzziness on large indices is CPU-heavy; set `prefix_length: 1` or 2.
- `zero_terms_query`: `none` (default) or `all` when analysis removes every term.

### 2.2 `match_phrase` and `slop`

A phrase matches when all terms occur at positions consistent with the query. `slop` is the number of position moves allowed (a transposition costs 2). Fixture `05-match-phrase-slop` matches "Keyboard and mouse combo" for `keyboard mouse` with `slop: 1` because `and` was removed by the `english` analyzer but left a position gap (module 04).

### 2.3 `multi_match` types

| Type | Score | Choose when |
| --- | --- | --- |
| `best_fields` (default) | `dis_max`: best field + `tie_breaker` × others | words should appear together in one field |
| `most_fields` | sum over fields | same text analysed several ways (stemmed + exact + shingles) |
| `cross_fields` | term-centric: each term may come from any field, blended idf | names split across `first`/`last` |
| `phrase`, `phrase_prefix` | `match_phrase` per field, `dis_max` | phrases across fields |
| `bool_prefix` | `match_bool_prefix` per field | `search_as_you_type` |

Field boosts use `^`: `"fields": ["name^3", "description"]`. Fixture `08-multi-match-best-fields` ranks "Office mouse" (title match ×3) above two documents that mention _office_ only in the description; between those two, the shorter description wins (length normalisation). The test `dis_max = max + tie_breaker * (sum of the others)` asserts the formula, and `most_fields sums field scores` shows that `most_fields` scores higher than `best_fields` for a doc matching in two fields.

`combined_fields` (7.13) implements BM25F: the fields are scored as if their text were concatenated, with field weights scaling term frequency. It avoids the classic `most_fields` bias where a term rare in one field but common in another gets two idf bonuses. All fields must share the same analyzer.

---

## 3. Term-Level Queries

Term-level queries do **not** analyse input (only a keyword field's normalizer is applied). They are for structured data: keywords, numbers, dates, booleans, IPs.

| Query | Matches | Scoring |
| --- | --- | --- |
| `term` | exact term | BM25 for the single term (mostly used in filter context) |
| `terms` | any of up to `index.max_terms_count` (65,536) terms | constant score 1 |
| `terms_set` | at least N of the terms (N from a field or script) |  |
| `range` | `gte`/`gt`/`lte`/`lt`; dates accept math (`now-7d/d`) and `format`, `time_zone` | constant |
| `exists` | an indexed value or doc value exists | constant |
| `prefix`, `wildcard`, `regexp` | automaton over the term dictionary | constant (rewrite) |
| `fuzzy` | Levenshtein automaton | blended |
| `ids` | `_id` values | constant |

Fixtures: `06-term-on-text-negative` (zero hits for `Keyboard` on an analysed field), `07-term-on-keyword` (exact whole value on `name.keyword`), `09-range-dates-and-exists` (dates in 2026 that have tags; p6 has no `tags` and is excluded by `exists`).

**`exists` subtleties:** empty arrays, `null` (without `null_value`), and values skipped by `ignore_above` or `ignore_malformed` do not count as existing. An empty string `""` _does_ exist for a `keyword` field.

**Expensive queries.** `wildcard` with a leading `*`, `regexp`, `fuzzy`, `prefix` without `index_prefixes`, `script`, and joining queries can be disabled cluster-wide with `search.allow_expensive_queries: false`.

**Date math.** `now-1d/d` rounds to the start of the day. Rounding interacts with the bound: `gt: now-1d/d` rounds **up** to the end of that day, `gte` rounds **down** to the start. Rounded `now` values are cacheable; unrounded `now` makes the filter uncacheable, because every request has a different millisecond.

---

## 4. Compound Queries and the Scoring Algebra

### 4.1 `bool`

| Clause     | Must match?    | Scored? | Cached?                |
| ---------- | -------------- | ------- | ---------------------- |
| `must`     | yes            | yes     | no                     |
| `filter`   | yes            | no      | yes (node query cache) |
| `should`   | see below      | yes     | no                     |
| `must_not` | must not match | no      | yes                    |

$$S_{\text{bool}}(d) = \text{boost} \cdot \Big( \sum_{c \in \text{must}} S_c(d) + \sum_{c \in \text{should},\, d \in M(c)} S_c(d) \Big)$$

There is no coordination factor since Lucene 7. Tests: `bool.must score = sum of its clause scores; a filter adds nothing`.

**`minimum_should_match` default.** If the `bool` has **no** `must` or `filter` clause, at least one `should` must match (default 1). If it has a `must` or `filter`, `should` clauses become optional and only add score (default 0). Fixtures `02-should-minimum-should-match` (only docs tagged `rgb` or `ergonomic`) and `03-should-with-filter-default-msm-zero` (all mice; the `rgb` one ranks first) contrast the two. This rule changed: before 7.0, a `bool` _in filter context_ also required one should clause; the rule is now uniform.

A `bool` with only `must_not` matches every other document with score 0 (test `must_not alone matches everything else, unscored`).

### 4.2 Other compound queries

- **`constant_score`**: wraps a filter and gives every match the `boost` (test `constant_score gives every match exactly the boost`).
- **`dis_max`**: $S = \max_i S_i + \text{tie-breaker} \cdot \big(\sum_i S_i - \max_i S_i\big)$.
- **`boosting`**: `positive` query, with matches of `negative` multiplied by `negative_boost` (demote, do not exclude).
- **`function_score`**: combines a query score with functions (`field_value_factor`, decay functions `gauss`/`exp`/`linear`, `random_score`, `script_score`, `weight`), with `score_mode` (how functions combine: `multiply`, `sum`, `avg`, `first`, `max`, `min`) and `boost_mode` (how the result combines with the query score: also `replace`). Fixture `16-function-score` blends relevance with `log1p(rating)` and a Gaussian recency decay:

  $$\text{gauss}(x) = \exp\!\left(-\frac{\max(0, |x - \text{origin}| - \text{offset})^2}{2\sigma^2}\right), \quad \sigma^2 = -\frac{\text{scale}^2}{2\ln(\text{decay})}$$

  so at distance `scale` from the origin the factor equals `decay`.

- **`script_score`**: a Painless script computes the score (`_score`, doc values, vector functions). It runs for **every matching document**, so restrict the inner query.
- **`rank_feature`, `distance_feature`**: efficient boosts that can skip non-competitive documents (they are WAND-friendly), preferred over `function_score` for popularity and recency.
- **`pinned`**: promote given ids to the top (merchandising).

### 4.3 Joining queries

`nested` (with `inner_hits` to return the matching nested objects), `has_child`, `has_parent`, `parent_id` (module 03). `score_mode` on `nested` and `has_child` decides how child scores aggregate (`avg`, `sum`, `max`, `min`, `none`).

---

## 5. Sorting

```json
"sort": [
  { "price": { "order": "asc", "missing": "_last", "mode": "min" } },
  { "_score": "desc" },
  { "name.keyword": "asc" }
]
```

- Sorting reads **doc values**. On a `text` field it fails with the exact error in fixture `13-sort-on-text-negative`; sort on the keyword sub-field instead.
- When the sort does not contain `_score`, scores are not computed (`_score: null`, test `sorting by a field disables scoring`) unless `track_scores: true`.
- Multi-valued fields: `mode` `min` (default for `asc`), `max` (default for `desc`), `sum`, `avg`, `median`.
- `missing`: `_last` (default), `_first`, or a value.
- `nested` sorting needs `nested.path` (and optional `nested.filter`).
- Geo distance sorting: `_geo_distance`. Script sorting: `_script` (slow).
- `numeric_type` normalises date vs date_nanos or long vs double across indices.

**Index sorting** (`index.sort.field` at index creation) stores segments pre-sorted, so a query sorted the same way can terminate early. It slows indexing and is fixed at creation.

---

## 6. Pagination

| Technique | Depth | Consistency | Cost | Status |
| --- | --- | --- | --- | --- |
| `from` + `size` | `from + size ≤ index.max_result_window` (10,000) | none across pages | each shard returns `from + size` hits | for UI pages 1–N |
| `search_after` | unlimited | none unless combined with a PIT | each shard returns `size` hits | recommended |
| `search_after` + **PIT** | unlimited | snapshot of the index at PIT creation | holds segments open | recommended for deep/export |
| `scroll` | unlimited | snapshot | holds segments and search context per shard | legacy; still an exam objective |

### 6.1 Why `from + size` is capped

To return hits $[f, f+s)$, each of $n$ shards must return its top $f + s$, and the coordinating node sorts $n(f+s)$ entries. At `from: 9995, size: 10` across 20 shards that is 200,100 entries for 10 results. The default limit `index.max_result_window: 10000` rejects it (fixture `12-deep-pagination-negative`). Raising the limit moves the problem into heap usage; switch technique instead.

### 6.2 `search_after`

Pass the `sort` values of the last hit of the previous page. Requirements, all asserted:

1. an explicit `sort`, with `search_after` the same length;
2. `from` must be 0;
3. a **unique tiebreaker** as the last sort key. Without it, documents sharing the last hit's sort value are skipped forever. The negative test `search_after without a unique tiebreaker skips documents with equal sort values` shows `d2` vanishing; adding `id` as a second key fixes it.

The property test `any page size enumerates every document exactly once` and the test `from/size pages and search_after pages produce the same sequence` prove the technique on a static index. Fixture `11-sort-and-search-after` resumes after `[25, "Keyboard wrist rest"]`.

### 6.3 Point in time (PIT)

Without a PIT, refreshes between pages can move documents across page boundaries. A PIT pins a set of segments:

```json
POST /products/_pit?keep_alive=1m

GET /_search
{
  "size": 100,
  "pit": { "id": "<pit id>", "keep_alive": "1m" },
  "sort": [ { "released": "desc" }, { "_shard_doc": "asc" } ],
  "search_after": [ 1767225600000, 4294967298 ]
}

DELETE /_pit
{ "id": "<pit id>" }
```

The request has **no index in the path** (the PIT knows it). `_shard_doc` is an implicit, cheap, unique tiebreaker (shard index + Lucene doc id) added automatically when a PIT is used. Always `DELETE` PITs you no longer need: each one keeps merged-away segments on disk (module 02 test `an open point-in-time reader keeps seeing the old view`).

### 6.4 Scroll (legacy)

```json
POST /products/_search?scroll=1m
{ "size": 1000, "sort": ["_doc"], "query": { "match_all": {} } }

POST /_search/scroll
{ "scroll": "1m", "scroll_id": "<id>" }

DELETE /_search/scroll
{ "scroll_id": "<id>" }
```

Scroll keeps a search context per shard alive; it is not meant for user-facing paging. `sort: ["_doc"]` is the fastest order. Sliced scroll (`slice: {id, max}`) parallelises exports. The Elastic documentation recommends PIT + `search_after` instead; the exam objective list has historically included scroll, so know both.

### 6.5 `track_total_hits`

Exact counts disable block-max WAND (module 01). Default 10,000; the test `track_total_hits caps the count and reports gte` asserts the response shape.

---

## 7. Shaping the Response

### 7.1 `_source`, `fields`, stored fields

- `_source: false`, `_source: ["name", "price"]` or `includes`/`excludes`: trims the fetch phase.
- `fields`: returns values from the mapping (formatted dates, runtime fields, multi-fields, synthetic-source friendly), always as arrays.
- `docvalue_fields`: values from doc values without touching `_source`.

### 7.2 Highlighting

```json
"highlight": {
  "pre_tags": ["<em>"], "post_tags": ["</em>"],
  "fields": { "description": { "fragment_size": 80, "number_of_fragments": 1 } }
}
```

| Highlighter | Data source | Notes |
| --- | --- | --- |
| `unified` (default) | postings with offsets if indexed, else term vectors, else re-analysis | sentence-aware, BM25-scored fragments |
| `plain` | re-analyses the text in memory | accurate for complex queries, slow on large fields |
| `fvh` (fast vector) | term vectors `with_positions_offsets` | needs mapping change, large index |

Highlighting needs the original text (from `_source` or stored fields) and correct offsets (module 04). `index.highlight.max_analyzed_offset` (1,000,000 characters) protects against huge fields. Fixture `15-highlight-and-source-filtering` shows the request shape.

### 7.3 Field collapsing and rescoring

- `collapse: { "field": "category" }` returns the top hit per distinct value (with `inner_hits` for more); the field needs doc values. It cannot be combined with `search_after` from multiple PIT slices or with `rescore`.
- `rescore` re-scores the top `window_size` hits per shard with a more expensive query (phrase proximity, learning-to-rank models).

---

## 8. Search Templates

A search template is a stored Mustache script rendered into a search body. It separates query logic from the application and lets search engineers change queries without a deploy.

```json
PUT _scripts/product-search
{
  "script": {
    "lang": "mustache",
    "source": "{\"query\":{\"bool\":{\"must\":[{\"match\":{\"description\":\"{{text}}\"}}],\"filter\":[{\"terms\":{\"category\":{{#toJson}}cats{{/toJson}}}}]}},\"size\":{{size}}}"
  }
}

GET /products/_search/template
{ "id": "product-search", "params": { "text": "wireless", "cats": ["keyboards", "mice"], "size": 5 } }

POST _render/template
{ "id": "product-search", "params": { "text": "wireless", "cats": ["keyboards"], "size": 5 } }
```

Mustache inserts raw text, which is why the source must quote string parameters and use `{{#toJson}}` for arrays and objects. The test `renders Mustache parameters into a valid search body` renders this exact template and runs it; the negative test shows an unquoted string parameter producing invalid JSON, the classic template bug. Defaults use the `{{var}}{{^var}}default{{/var}}` section form. `_render/template` is the debugging tool. Templates can be stored as a JSON string `source` or as an object; `_msearch/template` batches them.

---

## 9. Asynchronous Search

Long searches (large time ranges, frozen tier, cross-cluster) can be run asynchronously:

```json
POST /logs-*/_async_search?wait_for_completion_timeout=2s&keep_on_completion=true&keep_alive=1d
{ "query": { "range": { "@timestamp": { "gte": "now-30d" } } }, "aggs": { ... } }

GET /_async_search/<id>
GET /_async_search/status/<id>
DELETE /_async_search/<id>
```

The response carries `is_running` and `is_partial`; partial aggregation results appear as shards complete. Results are stored in a system index until `keep_alive` expires. ES|QL has an equivalent (`_query/async`).

---

## 10. Debugging Queries

| Tool | Answers |
| --- | --- |
| `GET /idx/_validate/query?explain` | is the query valid, and what Lucene query does it become? |
| `GET /idx/_explain/<id>` | why does this document match (or not), with the full score tree? |
| `"explain": true` in a search | score trees for every hit (expensive) |
| `"profile": true` | per-shard timing of query rewriting, collectors, aggregations |
| `GET /_analyze` | which terms does the text become? |
| slow logs (module 11) | which queries are slow in production? |

---

## 11. Then vs Now: Query DSL

| Concern | Then | Now |
| --- | --- | --- |
| `filtered` query | `filtered: { query, filter }` (≤ 1.x) | `bool.filter` (≥ 2.0) |
| Deep pagination | `scroll` | `search_after` + PIT (PIT ≥ 7.10) |
| Multi-field BM25F | `cross_fields` hack | `combined_fields` (≥ 7.13) |
| should in filter context | needed one match even with filter (≤ 6.x) | uniform rule (≥ 7.0) |
| Mapping types in queries | `type` query, `/index/type/_search` | removed (8.0) |
| Hybrid ranking | `bool` with a `knn` clause, manual score blending | retrievers + RRF (module 09) |
| Query language | DSL only | DSL + ES\|QL (module 06) |

> **Exam delta (Elastic Certified Engineer, 9.3).** The 9.3 exam environment supports everything in this module. Study material written for 7.x/8.x may still use `scroll` for "retrieve large numbers of results"; it works on 9.x, but PIT + `search_after` is the documented recommendation. Expect hands-on tasks for highlighting, sorting, pagination, fuzzy matching and search templates.

---

## 12. Production Failure Modes

1. **Unbounded `from`.** A crawler pages to 10,000 and hits the window limit; or someone raised `max_result_window` to 1,000,000 and the coordinating node OOMs. Use `search_after`.
2. **Unrounded `now` in filters.** Every request is unique, so the query cache never hits. Round to minutes or days.
3. **`query_string` on user input.** Syntax errors return 400s and users can run `*`-wildcards over every field. Use `simple_query_string` or `match`.
4. **`script_score` over everything.** CPU saturation. Pre-filter, or use `rank_feature`/`distance_feature`.
5. **Fuzzy on large vocabularies.** Thousands of expanded terms per query. Set `prefix_length`, limit `max_expansions`, or pre-compute spelling corrections.
6. **Forgotten PITs and scrolls.** Disk does not shrink after merges (module 02). Close them; monitor open contexts with `_nodes/stats/indices/search`.
7. **Missing tiebreaker** in `search_after`: silently skipped documents.

---

## Interview Drill

<details><summary>1. What is the default <code>minimum_should_match</code> of a bool query?</summary>

1 if the bool has no `must` or `filter` clause and has `should` clauses; otherwise 0, so `should` clauses only add score. Set it explicitly when you mean something else.
</details>

<details><summary>2. Explain <code>best_fields</code>, <code>most_fields</code> and <code>cross_fields</code>.</summary>

`best_fields` takes the best single-field score (dis_max with tie_breaker) for terms that belong together in one field. `most_fields` sums field scores, for one text indexed several ways. `cross_fields` is term-centric: each term may match in any field, with blended idf, for entities split across fields such as first and last name.
</details>

<details><summary>3. Why is <code>from + size</code> limited, and what do you use instead?</summary>

Every shard must return `from + size` hits to the coordinating node, which sorts `shards × (from + size)` entries. Cost grows linearly with depth. Use `search_after` with a unique tiebreaker, with a PIT for consistency.
</details>

<details><summary>4. What does a point in time guarantee, and what does it cost?</summary>

All pages see the same segments, so documents do not move between pages due to refreshes. The cost is that the referenced segments cannot be deleted after merges until the PIT expires or is deleted.
</details>

<details><summary>5. How does <code>function_score</code> combine scores?</summary>

Each function computes a value for the document; `score_mode` combines the function values (multiply, sum, avg, first, max, min); `boost_mode` combines that result with the query score (multiply, replace, sum, avg, max, min). Decay functions are parameterised so that at `offset + scale` the factor equals `decay`.
</details>

<details><summary>6. Why is a template parameter rendered as invalid JSON?</summary>

Mustache substitutes raw text before JSON parsing. String parameters must be quoted in the template, arrays and objects need `{{#toJson}}`. Debug with `_render/template`.
</details>

<details><summary>7. A dashboard query with <code>now-15m</code> is slow and never cached. Why?</summary>

Unrounded `now` resolves to a different millisecond per request, so the filter is unique and Elasticsearch does not cache it. Round (`now-15m/m`) to make consecutive requests share the cached filter.
</details>
