# Elastic Certified Engineer: Question Bank (`elastic-certified-engineer`)

Seventy original practice questions for the Elastic Certified Engineer exam (Elasticsearch 9.3 on the exam cluster) and for senior Elasticsearch interviews. The real exam is performance-based, so 33 of the 70 questions are `hands-on` tasks and the rest test the understanding behind them. Counts per domain follow [`README.md`](README.md) §1.2: D1 10, D2 13, D3 10, D4 11, D5 7, D6 9, D7 10. A 12-task mock exam follows the bank.

**How to use.**

- Question IDs are `Q-ECE-001` to `Q-ECE-070`; mock tasks are `Q-ECE-101` to `Q-ECE-112`.
- Hands-on tasks name their starting state. Unless a task says otherwise, the _products_ dataset means the index `products` created with the mapping and the seven documents `p1`..`p7` of [`fixtures/products.json`](../examples/fixtures/products.json), one primary shard, no replicas. The _employees_ and _logs-web_ datasets are those of [`fixtures/esql/dataset.json`](../examples/fixtures/esql/dataset.json) (`host` and `status` mapped as `keyword` and `short`, `@timestamp` as `date`).
- Every answer sits in a collapsible block with the explanation, a "why not" line for each distractor, a module reference and an official documentation link. Lines marked **Exam delta** state where the 9.3 exam cluster and the 9.5 track differ ([`README.md`](README.md) §1.1).
- Expected results of hands-on tasks come from the hermetic fixtures and the module text. Items that only a live cluster can prove are listed in the review file; run them on `docker compose up -d --wait` before trusting an exact value.
- Every hands-on task links its verification test under `examples/integration/` (`exam-d1-…` to `exam-d7-…` per domain, `exam-mock` for the mock exam). Each test performs the reference answer and asserts the stated success criteria; they skip cleanly without a cluster. Q-ECE-061 needs `path.repo` (set in `docker-compose.yml`), Q-ECE-063 and Q-ECE-111 need `compose.secure.yml` with `ES_PASSWORD`, Q-ECE-066 needs `compose.3node.yml` with `ES_NODES=3`, and Q-ECE-065 and Q-ECE-112 need the single-node lab. Offline proofs of deterministic criteria sit in `examples/13-exam-reference-answers.test.ts`.
- Difficulty: 1 foundational, 2 exam level, 3 harder than the exam (combined objectives, failure diagnosis).

---

## Domain 1: Data Modeling

### Q-ECE-001 · Data Modeling · difficulty 1 · hands-on

**Starting state:** an empty single-node cluster.

**Task:** create index `catalog` (1 primary, 0 replicas) with `dynamic: strict` and these fields: `sku` as `keyword`; `name` as `text` with a multi-field `raw` of type `keyword` and `ignore_above` 128; `price` as `scaled_float` with `scaling_factor` 100; `in_stock` as `boolean`; `added` as `date`.

**Success criteria:** the mapping reads back exactly as specified; indexing a document with an extra field `colour` is rejected; sorting by `name.raw` works and sorting by `name` fails.
<details><summary>Answer</summary>

```json
PUT /catalog
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "sku": { "type": "keyword" },
      "name": { "type": "text", "fields": { "raw": { "type": "keyword", "ignore_above": 128 } } },
      "price": { "type": "scaled_float", "scaling_factor": 100 },
      "in_stock": { "type": "boolean" },
      "added": { "type": "date" }
    }
  }
}
```

**Verification.**

1. `GET /catalog/_mapping` shows `dynamic: "strict"`, `price.scaling_factor: 100` and `name.fields.raw.ignore_above: 128`.
2. `PUT /catalog/_doc/1 { "sku": "a1", "colour": "red" }` returns HTTP 400 with `strict_dynamic_mapping_exception`.
3. `PUT /catalog/_doc/1?refresh=true { "sku": "a1", "name": "Desk lamp", "price": 19.99, "in_stock": true, "added": "2026-11-01" }` returns 201.
4. `GET /catalog/_search { "sort": ["name.raw"] }` returns 200; `{ "sort": ["name"] }` returns a 4xx error because `text` has no doc values.

Verification script: [`examples/integration/exam-d1-data-modeling.itest.ts`](../examples/integration/exam-d1-data-modeling.itest.ts), test `Q-ECE-001`.

**Why it works:** `strict` rejects unmapped fields, `scaled_float` stores money as a scaled `long`, and a keyword multi-field supplies the doc values that sorting needs.

- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#2-field-types-and-what-they-write), [dynamic policy](../modules/03-mappings-field-types-and-templates.md#31-the-dynamic-policy), https://www.elastic.co/docs/manage-data/data-store/mapping

</details>

### Q-ECE-002 · Data Modeling · difficulty 1 · single

Dynamic mapping is enabled and the first document indexed into a new index is `{ "city": "Brno", "visits": 3, "rating": 4.5 }`. Which mapping results?

- A) `city`: `text` with a `keyword` sub-field (`ignore_above: 256`); `visits`: `long`; `rating`: `float`
- B) `city`: `keyword`; `visits`: `integer`; `rating`: `double`
- C) `city`: `text` only; `visits`: `long`; `rating`: `double`
- D) `city`: `keyword` with a `text` sub-field; `visits`: `long`; `rating`: `float`

<details><summary>Answer</summary>

**A.** A plain string becomes `text` plus a `keyword` sub-field limited by `ignore_above: 256`, an integer becomes `long` and a floating point number becomes `float`.

- Why not B: dynamic mapping never chooses `integer` or `double`; this is a common wrong guess.
- Why not C: no `keyword` sub-field would make exact matching and aggregations impossible, so Elasticsearch adds it, and `rating` is `float`, not `double`.
- Why not D: the parent is `text`, the sub-field is `keyword`; the roles are not reversed.
- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#3-dynamic-mapping), https://www.elastic.co/docs/manage-data/data-store/mapping/dynamic-mapping

</details>

### Q-ECE-003 · Data Modeling · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** create index `groups` (1 shard, 0 replicas) where `group` is a `keyword` and `user` is a `nested` field with `first` and `last` as `keyword`. Index one document `{ "group": "fans", "user": [ { "first": "John", "last": "Smith" }, { "first": "Alice", "last": "White" } ] }` and refresh.

**Success criteria:** a query for the same element with `first = John` and `last = White` returns no hit; `first = Alice` and `last = White` returns one hit and reports the matching element through `inner_hits`.
<details><summary>Answer</summary>

```json
PUT /groups
{ "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": { "properties": {
    "group": { "type": "keyword" },
    "user": { "type": "nested", "properties": { "first": { "type": "keyword" }, "last": { "type": "keyword" } } } } } }

GET /groups/_search
{ "query": { "nested": { "path": "user", "query": { "bool": { "filter": [
  { "term": { "user.first": "John" } }, { "term": { "user.last": "White" } } ] } }, "inner_hits": {} } } }
```

**Verification.**

1. The John/White query returns `hits.total.value` 0.
2. The same query with `Alice` returns `hits.total.value` 1, and `hits.hits[0].inner_hits.user.hits.total.value` is 1 with `_nested.offset` 1.
3. Changing the mapping to `object` (a second index `groups-obj`) makes the John/White query return 1 hit, which is the cross-match false positive.

Verification script: [`examples/integration/exam-d1-data-modeling.itest.ts`](../examples/integration/exam-d1-data-modeling.itest.ts), test `Q-ECE-003`.

**Why it works:** `nested` indexes each array element as a hidden document in the same block, so a `nested` query keeps both conditions on one element. `object` flattens the array into parallel multi-valued fields.

- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#42-nested), https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/nested

</details>

### Q-ECE-004 · Data Modeling · difficulty 2 · multi

Which THREE statements about the `dynamic` mapping parameter are correct?

- A) `strict` rejects a document that contains an unmapped field with `strict_dynamic_mapping_exception`
- B) `false` adds the new field to the mapping but does not index it
- C) `false` ignores the new field for search but keeps it in `_source`
- D) `runtime` maps new fields as runtime fields, searchable and computed at query time
- E) `dynamic` can only be set at the root of the mapping

<details><summary>Answer</summary>

**A, C, D.**

- **A:** `strict` rejects the whole document.
- **C:** with `false` the value stays in `_source` but is not searchable and the mapping does not grow.
- **D:** `runtime` creates entries in the `runtime` section only.
- Why not B: with `false` the mapping does not grow; the field is simply ignored.
- Why not E: `dynamic` is inherited by inner objects and can be overridden per object; a typical pattern is `strict` at the root with one `labels` object set to `true`.
- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#31-the-dynamic-policy), https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dynamic

</details>

### Q-ECE-005 · Data Modeling · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** create index `places` (1 shard, 0 replicas) with a custom analyzer `fold` (`standard` tokenizer, filters `lowercase` and `asciifolding`) and a normalizer `fold_kw` (filters `lowercase` and `asciifolding`). Map `name` as `text` using `fold`, with a `keyword` sub-field `exact` that uses `fold_kw`. Index `{ "name": "Kopřivnice" }` as id 1 and `{ "name": "Příbor" }` as id 2, then refresh.

**Success criteria:** a `match` on `name` for `koprivnice` finds id 1; a `term` on `name.exact` for `PRIBOR` finds id 2; `_analyze` on the field yields the folded term.
<details><summary>Answer</summary>

```json
PUT /places
{ "settings": { "number_of_shards": 1, "number_of_replicas": 0, "analysis": {
    "analyzer": { "fold": { "type": "custom", "tokenizer": "standard", "filter": ["lowercase", "asciifolding"] } },
    "normalizer": { "fold_kw": { "type": "custom", "filter": ["lowercase", "asciifolding"] } } } },
  "mappings": { "properties": { "name": { "type": "text", "analyzer": "fold",
    "fields": { "exact": { "type": "keyword", "normalizer": "fold_kw" } } } } } }
```

**Verification.**

1. `GET /places/_analyze { "field": "name", "text": "Kopřivnice" }` returns one token `koprivnice`.
2. `GET /places/_search { "query": { "match": { "name": "koprivnice" } } }` returns id 1 only.
3. `GET /places/_search { "query": { "term": { "name.exact": "PRIBOR" } } }` returns id 2, because the normalizer is applied to term-level queries on that keyword field.

Verification script: [`examples/integration/exam-d1-data-modeling.itest.ts`](../examples/integration/exam-d1-data-modeling.itest.ts), test `Q-ECE-005`.

**Why it works:** the same folding runs at index and search time. The normalizer contains only character-level filters, so each value still maps to exactly one term.

- Ref: [modules/04-text-analysis.md](../modules/04-text-analysis.md#43-folding-diacritics), [normalizers](../modules/04-text-analysis.md#5-normalizers), https://www.elastic.co/docs/manage-data/data-store/text-analysis/create-custom-analyzer

</details>

### Q-ECE-006 · Data Modeling · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** create a component template `base-settings` (1 shard, 0 replicas) and an index template `events` for pattern `events-*` with priority 200 that composes it and adds a dynamic template: strings whose field name matches `*_id` become `keyword`. Do not create any index with the pattern before verifying with the simulate API.

**Success criteria:** the simulated settings show 1 shard; after indexing `{ "user_id": "42", "note": "hello" }` into `events-2026.11`, `user_id` is `keyword` and `note` is `text` with a `keyword` sub-field.
<details><summary>Answer</summary>

```json
PUT _component_template/base-settings
{ "template": { "settings": { "number_of_shards": 1, "number_of_replicas": 0 } } }

PUT _index_template/events
{ "index_patterns": ["events-*"], "composed_of": ["base-settings"], "priority": 200,
  "template": { "mappings": { "dynamic_templates": [
    { "ids_as_keywords": { "match_mapping_type": "string", "match": "*_id", "mapping": { "type": "keyword" } } } ] } } }
```

**Verification.**

1. `POST _index_template/_simulate_index/events-test` returns `template.settings.index.number_of_shards: "1"` and the `ids_as_keywords` dynamic template.
2. `POST /events-2026.11/_doc?refresh=true { "user_id": "42", "note": "hello" }` creates the index.
3. `GET /events-2026.11/_mapping` shows `user_id.type: keyword`, `note.type: text` and `note.fields.keyword.ignore_above: 256`.

Verification script: [`examples/integration/exam-d1-data-modeling.itest.ts`](../examples/integration/exam-d1-data-modeling.itest.ts), test `Q-ECE-006`.

**Why it works:** the template applies at index creation, the component template supplies the settings, and the first matching dynamic template wins.

- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#71-composable-index-templates), [dynamic templates](../modules/03-mappings-field-types-and-templates.md#72-dynamic-templates), https://www.elastic.co/docs/manage-data/data-store/templates

</details>

### Q-ECE-007 · Data Modeling · difficulty 3 · scenario

A team creates `PUT _index_template/web-logs` with `index_patterns: ["logs-*-*"]`, `data_stream: {}` and `priority: 100`. The request is rejected because a built-in template with the same pattern and priority 100 exists. They raise the priority to 200 and the request succeeds, but new data streams lose the mappings that the built-in template used to provide. What is the correct reading of this?

- A) Only the highest-priority matching template applies, so the team must compose every component template it needs in `composed_of`
- B) The higher-priority template is merged on top of the built-in one, so a mapping bug must have occurred in the team's template
- C) Legacy `_template` must be used to inherit from the built-in template
- D) Equal priorities with overlapping patterns are allowed; the rejection was caused by `data_stream: {}`

<details><summary>Answer</summary>

**A.** Two templates with the same priority and overlapping patterns are rejected. When several match, only the one with the highest `priority` applies; sharing is done with component templates.

- Why not B: index templates are never merged with each other; only component templates within one template are merged.
- Why not C: legacy templates are deprecated; if both kinds match, the composable one wins and the legacy one is ignored.
- Why not D: the rejection is exactly the same-priority overlap rule, not the `data_stream` object.
- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#71-composable-index-templates), https://www.elastic.co/docs/manage-data/data-store/templates

</details>

### Q-ECE-008 · Data Modeling · difficulty 2 · scenario

An index with 1,000,000 documents gets a new multi-field `name.exact` (keyword) through `PUT /idx/_mapping`. The request is accepted, but `term` queries on `name.exact` return no hits for old documents, while documents indexed afterwards are found. What should you do?

- A) Run `_update_by_query` (or reindex) so that existing documents are indexed into the new sub-field
- B) Close and reopen the index
- C) Raise `index.mapping.total_fields.limit`
- D) Run `_forcemerge?max_num_segments=1`

<details><summary>Answer</summary>

**A.** Adding a multi-field is allowed, but existing documents are not indexed into it until they are reindexed or touched by `_update_by_query` (a script-less run simply reindexes them in place).

- Why not B: opening and closing does not index anything.
- Why not C: the limit is unrelated; the new field was accepted.
- Why not D: merging rewrites segments with the data they already contain.
- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#5-multi-fields-normalizers-and-copy_to), [update by query](../modules/08-ingest-pipelines-and-data-lifecycle.md#32-_update_by_query-and-_delete_by_query), https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/multi-fields

</details>

### Q-ECE-009 · Data Modeling · difficulty 3 · hands-on

**Starting state:** an empty cluster.

**Task:** model index `telemetry` (1 shard, 0 replicas) for events with a fixed set of top-level fields (`@timestamp` as `date`, `host` as `keyword`) plus a `labels` object whose keys come from users. The mapping must not grow when new label keys arrive, and unknown top-level fields must be rejected.

**Success criteria:** after indexing a document with 30 distinct label keys, the mapping contains no `labels.<key>` entries, a `term` query on `labels.region` works, and an unknown top-level field is rejected.
<details><summary>Answer</summary>

```json
PUT /telemetry
{ "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": { "dynamic": "strict", "properties": {
    "@timestamp": { "type": "date" }, "host": { "type": "keyword" }, "labels": { "type": "flattened" } } } }
```

**Verification.**

1. Index `{ "@timestamp": "2026-11-04T10:00:00Z", "host": "h1", "labels": { "region": "eu", "k1": "v", "k2": "v" } }` (extend to 30 keys); it returns 201.
2. `GET /telemetry/_mapping` lists only `@timestamp`, `host` and `labels` (type `flattened`).
3. `GET /telemetry/_search { "query": { "term": { "labels.region": "eu" } } }` returns the document.
4. Indexing `{ "@timestamp": "2026-11-04T10:00:00Z", "foo": 1 }` returns 400 `strict_dynamic_mapping_exception`.

Verification script: [`examples/integration/exam-d1-data-modeling.itest.ts`](../examples/integration/exam-d1-data-modeling.itest.ts), test `Q-ECE-009`.

**Why it works:** `flattened` is one mapper for any number of keys, so user keys never reach the cluster state; `strict` guards the rest. Raising `total_fields.limit` (default 1000) would only treat the symptom.

- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#32-mapping-explosion), https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/flattened

</details>

### Q-ECE-010 · Data Modeling · difficulty 2 · ordering

`price` was mapped as `float` in `products-v1`, which is served through the alias `products`, and must become `scaled_float` while writes continue. Put the steps in order.

- A) Create `products-v2` with the new mapping
- B) Atomically swap the alias with `POST _aliases` (remove `products-v1`, add `products-v2`)
- C) `_reindex` from `products-v1` into `products-v2`
- D) Delete `products-v1` after verification
- E) Catch up documents written to `products-v1` during the reindex

<details><summary>Answer</summary>

**A, C, E, B, D.**

- A field type cannot change in place, so the destination must exist with its mapping before `_reindex`; otherwise it would be created by dynamic mapping.
- The catch-up (dual writes, or a second reindex of documents with a recent `updated_at`) must finish before the swap, otherwise writes are lost.
- The alias swap is atomic, so readers never see a missing alias; the old index is deleted last.
- Why not B before E: swapping first would send readers to an index that lacks the late writes.
- Why not C before A: the destination would be dynamically mapped, defeating the purpose.
- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#8-changing-a-mapping-reindex-behind-an-alias), [zero-downtime changes](../modules/08-ingest-pipelines-and-data-lifecycle.md#33-zero-downtime-mapping-changes-with-aliases), https://www.elastic.co/docs/manage-data/data-store/aliases

</details>

---

## Domain 2: Search

### Q-ECE-011 · Search · difficulty 1 · single

Index `products` holds `name` (`text`, `english` analyzer) with a `keyword` sub-field `name.keyword`. A user types `Gaming mouse` and expects exactly the product with that complete name. Which query is correct and cheapest?

- A) `{ "term": { "name": "Gaming mouse" } }`
- B) `{ "term": { "name.keyword": "Gaming mouse" } }`
- C) `{ "match": { "name.keyword": "gaming" } }`
- D) `{ "term": { "name": "Keyboard" } }` after lowercasing the user input

<details><summary>Answer</summary>

**B.** `term` does not analyse its input; `keyword` values are indexed verbatim, so the whole original string matches.

- Why not A: the analysed `name` holds individual lowercased, stemmed tokens, so the byte string `Gaming mouse` is not a term.
- Why not C: `match` on a keyword field matches the whole value only, so the partial `gaming` finds nothing.
- Why not D: it queries a different value and still goes to the analysed field; a capitalised term never exists there (fixture `06-term-on-text-negative` returns no hit).
- Ref: [modules/01-search-fundamentals-and-ir-theory.md](../modules/01-search-fundamentals-and-ir-theory.md#7-exact-value-versus-full-text-matching), https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-term-query

</details>

### Q-ECE-012 · Search · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** write two searches. (1) Rank products by relevance for `wireless keyboard` in `description`, but only in-stock products with `price` below 100 and not in the category `bundles`. (2) Return all products of category `mice`, with those tagged `rgb` ranked first but the others still returned.

**Success criteria:** (1) returns exactly `p2`; (2) returns `p3` then `p4`.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "query": { "bool": {
  "must": [ { "match": { "description": "wireless keyboard" } } ],
  "filter": [ { "term": { "in_stock": true } }, { "range": { "price": { "lt": 100 } } } ],
  "must_not": [ { "term": { "category": "bundles" } } ] } } }

GET /products/_search
{ "query": { "bool": { "filter": [ { "term": { "category": "mice" } } ], "should": [ { "term": { "tags": "rgb" } } ] } } }
```

**Verification.**

1. Request 1 returns `hits.total.value` 1 with `_id` `p2`.
2. Request 2 returns `p3` first (score above 0) then `p4` (score 0): with a `filter` present, `minimum_should_match` defaults to 0, so `should` only adds score.

Verification script: [`examples/integration/exam-d2-search.itest.ts`](../examples/integration/exam-d2-search.itest.ts), test `Q-ECE-012`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

**Why it works:** yes/no constraints belong in `filter` and `must_not`; only the free-text intent is scored.

- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#41-bool), https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-bool-query

</details>

### Q-ECE-013 · Search · difficulty 2 · single

On the products dataset, what does this return? `{ "query": { "bool": { "filter": [ { "term": { "category": "accessories" } } ], "should": [ { "term": { "tags": "ergonomic" } } ] } } }`

- A) Only `p7`, because one `should` clause must match
- B) `p7` then `p6`; the `should` clause only affects ranking
- C) Nothing, because `should` without `must` is invalid
- D) `p6` then `p7`, because lower prices rank first

<details><summary>Answer</summary>

**B.** With a `filter` (or `must`) present, `should` clauses become optional (`minimum_should_match` defaults to 0). Both accessories match the filter; `p7` carries the `ergonomic` tag and scores higher, while `p6` scores 0.

- Why not A: the default of 1 applies only when the `bool` has no `must` or `filter`.
- Why not C: `should` is always valid.
- Why not D: price plays no role without a sort.
- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#41-bool), https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-bool-query

</details>

### Q-ECE-014 · Search · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** find the products whose `name` is close to the misspelling `keybord`, allowing the automatic number of edits, return only `name` and `price` in `_source`, and highlight the matches in `name` with `<em>` tags.

**Success criteria:** exactly `p1`, `p2`, `p5` and `p7` are returned; each hit has `highlight.name` containing an `<em>`-wrapped `keyboard`.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "query": { "match": { "name": { "query": "keybord", "fuzziness": "AUTO" } } },
  "_source": { "includes": ["name", "price"] },
  "highlight": { "pre_tags": ["<em>"], "post_tags": ["</em>"], "fields": { "name": {} } } }
```

**Verification.**

1. `hits.total.value` is 4 and the ids are `p1`, `p2`, `p5`, `p7` (any order).
2. Each `_source` has only `name` and `price`.
3. Each hit has a `highlight.name` array whose first entry contains `<em>` around `keyboard` (capitalisation as in the field).

`AUTO` allows 0 edits for 1 to 2 characters, 1 edit for 3 to 5 and 2 edits above; `keybord` has seven characters and is one deletion from `keyboard`. Highlight output is only provable on a live cluster.

Verification script: [`examples/integration/exam-d2-search.itest.ts`](../examples/integration/exam-d2-search.itest.ts), test `Q-ECE-014`.

- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#21-match), [highlighting](../modules/05-query-dsl.md#72-highlighting), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting

</details>

### Q-ECE-015 · Search · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** list all seven products by `price` ascending, three per page, with a stable order for equal prices and without using `from`.

**Success criteria:** three pages with the ids `p4, p7, p6`, then `p2, p3, p5`, then `p1`.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "size": 3, "sort": [ { "price": "asc" }, { "name.keyword": "asc" } ] }

GET /products/_search
{ "size": 3, "sort": [ { "price": "asc" }, { "name.keyword": "asc" } ],
  "search_after": [45, "USB-C hub"] }

GET /products/_search
{ "size": 3, "sort": [ { "price": "asc" }, { "name.keyword": "asc" } ],
  "search_after": [90, "Keyboard and mouse combo"] }
```

**Verification.**

1. Page 1 ids: `p4` (15), `p7` (25), `p6` (45); the last hit's `sort` is `[45.0, "USB-C hub"]`.
2. Page 2 ids: `p2` (60), `p3` (80), `p5` (90).
3. Page 3 ids: `p1` only.

The second sort key must be unique per document, otherwise documents sharing the last sort value can be skipped.

Verification script: [`examples/integration/exam-d2-search.itest.ts`](../examples/integration/exam-d2-search.itest.ts), test `Q-ECE-015`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#62-search_after), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results

</details>

### Q-ECE-016 · Search · difficulty 3 · multi

An export job pages through a live index with `search_after` and the single sort key `released`. It produces duplicates and misses documents. Which TWO changes fix this?

- A) Open a point in time and send it with every page
- B) Add a unique tiebreaker to the sort (for example `_shard_doc` with a PIT, or a unique field)
- C) Raise `index.max_result_window` to 1,000,000 and use `from`
- D) Set `track_total_hits: true`
- E) Lower `size` to 1

<details><summary>Answer</summary>

**A, B.** A PIT pins the set of segments, so refreshes do not move documents across pages; a unique tiebreaker prevents documents with equal sort values from being skipped.

- Why not C: it moves the cost into heap usage on the coordinating node and still gives no consistent view.
- Why not D: it only changes hit counting.
- Why not E: smaller pages do not remove ties or refresh effects.
- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#63-point-in-time-pit), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-open-point-in-time

</details>

### Q-ECE-017 · Search · difficulty 3 · hands-on

**Starting state:** the products dataset.

**Task:** with a point in time of one minute, read the products by `released` descending, three per page, using `_shard_doc` as tiebreaker. After the first page, index a new product `p8` with `released` `2027-01-01` and refresh. Finish by deleting the PIT.

**Success criteria:** the three pages return `p5, p3, p6`, then `p2, p7, p1`, then `p4`; `p8` never appears; the PIT is closed.
<details><summary>Answer</summary>

```json
POST /products/_pit?keep_alive=1m

GET /_search
{ "size": 3, "pit": { "id": "<pit id>", "keep_alive": "1m" },
  "sort": [ { "released": "desc" }, { "_shard_doc": "asc" } ] }

GET /_search
{ "size": 3, "pit": { "id": "<pit id>", "keep_alive": "1m" },
  "sort": [ { "released": "desc" }, { "_shard_doc": "asc" } ],
  "search_after": [ <released of last hit>, <_shard_doc of last hit> ] }

DELETE /_pit
{ "id": "<pit id>" }
```

**Verification.**

1. The `_search` requests have no index in the path; the PIT carries it.
2. Page order is `p5` (2026-09-01), `p3`, `p6`, then `p2`, `p7`, `p1`, then `p4`.
3. A fresh search without the PIT after the refresh would return `p8` first, proving the PIT view is a snapshot.
4. `DELETE /_pit` reports success; a later search with that id fails.

Verification script: [`examples/integration/exam-d2-search.itest.ts`](../examples/integration/exam-d2-search.itest.ts), test `Q-ECE-017`.

- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#63-point-in-time-pit), [an open PIT pins segments](../modules/02-cluster-architecture-and-near-real-time-search.md#4-segments-deletes-and-merges), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-open-point-in-time

</details>

### Q-ECE-018 · Search · difficulty 2 · multi

You must export two million documents on a 9.3 cluster. Which TWO approaches are supported and sensible?

- A) `scroll` with `sort: ["_doc"]` and a large `size`
- B) A point in time with `search_after`
- C) `from` and `size` with `index.max_result_window` set to 2,000,000
- D) `size: 2000000` in one request
- E) ES|QL without `LIMIT`

<details><summary>Answer</summary>

**A, B.** Scroll still works on 9.x and is a historical exam objective; PIT with `search_after` is the documented recommendation, and sliced requests parallelise exports.

- Why not C and D: every shard would return `from + size` hits to the coordinating node; the window limit exists to prevent that.
- Why not E: ES|QL returns at most 1,000 rows by default and at most 10,000 with an explicit `LIMIT`.
- **Exam delta:** older study material asks for scroll; it works on both 9.3 and 9.5, but prefer PIT + `search_after` when the task does not name a technique.
- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#6-pagination), [ES|QL limits](../modules/06-esql.md#31-implicit-and-maximum-limit), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results

</details>

### Q-ECE-019 · Search · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** store a Mustache search template `product-search` that matches `description` against a `text` parameter, filters `category` with a `cats` list and limits the result with a `size` parameter. Run it with `text` `wireless`, `cats` `["keyboards","mice"]` and `size` 5, and render it without executing it.

**Success criteria:** the rendered body is valid JSON with `size` 5; the search returns `p2` and `p3`.
<details><summary>Answer</summary>

```json
PUT _scripts/product-search
{ "script": { "lang": "mustache",
  "source": "{\"query\":{\"bool\":{\"must\":[{\"match\":{\"description\":\"{{text}}\"}}],\"filter\":[{\"terms\":{\"category\":{{#toJson}}cats{{/toJson}}}}]}},\"size\":{{size}}}" } }

GET /products/_search/template
{ "id": "product-search", "params": { "text": "wireless", "cats": ["keyboards", "mice"], "size": 5 } }

POST _render/template
{ "id": "product-search", "params": { "text": "wireless", "cats": ["keyboards", "mice"], "size": 5 } }
```

**Verification.**

1. The render response contains `"terms": { "category": ["keyboards","mice"] }` and `"size": 5`.
2. The search returns `p2` and `p3` (`p5` is in category `bundles`).
3. Negative: storing the template with `{{text}}` unquoted makes the render produce invalid JSON and the search fails with a parsing error.

Verification script: [`examples/integration/exam-d2-search.itest.ts`](../examples/integration/exam-d2-search.itest.ts), test `Q-ECE-019`.

- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#8-search-templates), https://www.elastic.co/docs/solutions/search/search-templates

</details>

### Q-ECE-020 · Search · difficulty 3 · hands-on

**Starting state:** the logs-web dataset in indices `logs-web-2026.11.03` and `logs-web-2026.11.04`.

**Task:** run a search over `logs-web-*` as an asynchronous search that is kept after completion for one day and returns the count of documents per `host`. Retrieve its status and result by id, then delete it.

**Success criteria:** the result reports `is_running: false`, `is_partial: false` and the buckets `web-1` (3) and `web-2` (1); after the delete the id is unknown.
<details><summary>Answer</summary>

```json
POST /logs-web-*/_async_search?wait_for_completion_timeout=1ms&keep_on_completion=true&keep_alive=1d
{ "size": 0, "aggs": { "by_host": { "terms": { "field": "host" } } } }

GET /_async_search/status/<id>
GET /_async_search/<id>
DELETE /_async_search/<id>
```

**Verification.**

1. The submit response contains an `id` (because of `keep_on_completion=true`).
2. Polling `GET /_async_search/<id>` until `is_running` is false returns `is_partial: false` and `response.aggregations.by_host.buckets` with `web-1` doc_count 3 and `web-2` doc_count 1.
3. After `DELETE`, `GET /_async_search/<id>` returns 404.

Results are stored in a system index until `keep_alive` expires; partial aggregations appear while shards finish.

Verification script: [`examples/integration/exam-d2-search.itest.ts`](../examples/integration/exam-d2-search.itest.ts), test `Q-ECE-020`.

- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#9-asynchronous-search), https://www.elastic.co/docs/solutions/search/async-search-api

</details>

### Q-ECE-021 · Search · difficulty 2 · scenario

A cross-cluster search `GET /logs-*,prague:logs-*,brno:logs-*/_search` fails completely whenever the Brno cluster is down, although Prague is healthy. Which explanation and fix are correct?

- A) `cluster.remote.brno.skip_unavailable` is `false`; set it to `true` to get partial results with a `_clusters` section
- B) Brno must be registered in `sniff` mode; `proxy` mode never returns partial results
- C) `ccs_minimize_roundtrips` must be `false` to tolerate a failing cluster
- D) The local nodes lack the `remote_cluster_client` role

<details><summary>Answer</summary>

**A.** With `skip_unavailable: true` (the default in current versions) an unavailable remote is skipped and reported in `_clusters`; the explicit `false` makes the whole search fail.

- Why not B: the connection mode is about topology, not failure tolerance.
- Why not C: that parameter chooses between one request per remote cluster and shard-level requests across the WAN.
- Why not D: a missing role would break searches to every remote, including Prague.
- Ref: [modules/10-scaling-sharding-and-multi-cluster.md](../modules/10-scaling-sharding-and-multi-cluster.md#5-cross-cluster-search-ccs), https://www.elastic.co/docs/explore-analyze/cross-cluster-search

</details>

### Q-ECE-022 · Search · difficulty 2 · hands-on

**Starting state:** the employees dataset (index `employees`).

**Task:** with ES|QL, return the average salary and head count per `dept`, keep only departments with an average salary of at least 6000 and sort by the average descending. Then list the first names of employees with fewer than three `languages` or an unknown number of languages, sorted by name.

**Success criteria:** the first query returns `ml` and `search`; the second returns Eva, Jana, Lucie, Tomas.
<details><summary>Answer</summary>

```esql
FROM employees
| STATS avg_salary = AVG(salary), headcount = COUNT(*) BY dept
| WHERE avg_salary >= 6000
| SORT avg_salary DESC

FROM employees
| WHERE languages < 3 OR languages IS NULL
| KEEP first_name
| SORT first_name
```

Run them with `POST /_query?format=json { "query": "..." }`.

**Verification.**

1. Query 1 has columns `avg_salary`, `headcount`, `dept` (aggregates first, then the `BY` columns) and rows `[8000, 1, "ml"]`, `[6750, 2, "search"]`.
2. Query 2 returns Eva, Jana, Lucie, Tomas. Without `OR languages IS NULL`, Tomas (NULL `languages`) would be dropped by three-valued logic.

`WHERE` after `STATS` filters groups, which SQL calls `HAVING`.

Verification script: [`examples/integration/exam-d2-search.itest.ts`](../examples/integration/exam-d2-search.itest.ts), test `Q-ECE-022`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/06-esql.md](../modules/06-esql.md#32-null-and-three-valued-logic), [column naming](../modules/06-esql.md#36-column-naming), https://www.elastic.co/docs/reference/query-languages/esql

</details>

### Q-ECE-023 · Search · difficulty 3 · scenario

An analyst writes `FROM app-logs | WHERE message == "timeout"` where `message` is a `text` field containing sentences such as `request timeout after 30s`. The query returns nothing, and a dashboard built on a sister query always shows exactly 1,000 rows. Which diagnosis is correct?

- A) Without a full-text function, `==` on `text` compares the whole string; use `MATCH(message, "timeout")` or `message : "timeout"`, and add an explicit `LIMIT` or aggregate for the row cap
- B) Use `WHERE message = "timeout"`, since `=` is the comparison operator in ES|QL
- C) Add `| LIMIT 100000` to raise the row cap, which also fixes the empty result
- D) Convert with `TO_STRING(message)`, which analyses the text

<details><summary>Answer</summary>

**A.** A `text` field without a full-text function behaves like a keyword for `==`. The 1,000-row cap applies to output when no `LIMIT` is given, and an explicit `LIMIT` is capped at 10,000.

- Why not B: `=` assigns in ES|QL; in `WHERE` it is a parse error.
- Why not C: the limit cannot exceed 10,000 by default and has no influence on matching.
- Why not D: conversion functions do not analyse text.
- Ref: [modules/06-esql.md](../modules/06-esql.md#33-types-and-arithmetic), [limits](../modules/06-esql.md#31-implicit-and-maximum-limit), https://www.elastic.co/docs/reference/query-languages/esql

</details>

---

## Domain 3: Aggregations

### Q-ECE-024 · Aggregations · difficulty 1 · single

You need to know the number of products per category and the average price of each category, without returning any hits. Which request shape is right?

- A) `size: 0` with a `terms` aggregation on `category` and an `avg` sub-aggregation on `price`
- B) A `terms` aggregation on `category` with `size: 10`, leaving hits enabled, and averaging in the client
- C) An `avg` aggregation on `category`
- D) A `terms` aggregation on `description` with a `sum` sub-aggregation

<details><summary>Answer</summary>

**A.** `size: 0` skips the hits and lets the shard request cache store the result; `terms` is a bucket aggregation and `avg` a metric sub-aggregation, both reading doc values.

- Why not B: it works but returns unneeded hits and moves arithmetic to the client.
- Why not C: `category` is a keyword; `avg` needs numeric values.
- Why not D: `description` is `text` and has no doc values, so aggregating it fails unless fielddata is enabled, which should be avoided.
- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#1-families-and-the-request-shape), https://www.elastic.co/docs/explore-analyze/query-filter/aggregations

</details>

### Q-ECE-025 · Aggregations · difficulty 2 · hands-on

**Starting state:** the logs-web dataset.

**Task:** over `logs-web-*` compute, per UTC day, the sum of `bytes`, and add a pipeline aggregation that finds the day with the largest sum. Return no hits.

**Success criteria:** daily sums 1200 (2026-11-03) and 800 (2026-11-04); the best day is 2026-11-03 with value 1200.
<details><summary>Answer</summary>

```json
GET /logs-web-*/_search
{ "size": 0, "aggs": {
  "per_day": { "date_histogram": { "field": "@timestamp", "calendar_interval": "1d" },
    "aggs": { "daily": { "sum": { "field": "bytes" } } } },
  "best_day": { "max_bucket": { "buckets_path": "per_day>daily" } } } }
```

**Verification.**

1. `aggregations.per_day.buckets` has two buckets with `key_as_string` `2026-11-03T00:00:00.000Z` (`daily.value` 1200.0) and `2026-11-04T00:00:00.000Z` (800.0).
2. `aggregations.best_day.value` is 1200.0 and `keys` is `["2026-11-03T00:00:00.000Z"]`.

`best_day` is a sibling pipeline aggregation: it sits next to `per_day` and addresses the metric with `agg>sub_agg`.

Verification script: [`examples/integration/exam-d3-aggregations.itest.ts`](../examples/integration/exam-d3-aggregations.itest.ts), test `Q-ECE-025`.

- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#1-families-and-the-request-shape), [date_histogram](../modules/07-aggregations.md#62-date_histogram), https://www.elastic.co/docs/reference/aggregations/pipeline

</details>

### Q-ECE-026 · Aggregations · difficulty 3 · hands-on

**Starting state:** an empty index `ev` with `@timestamp` mapped as `date`.

**Task:** index one event at `2026-11-04T23:30:00Z`. Count events per day twice: with `calendar_interval: 1d` in UTC and with `time_zone: Europe/Prague`.

**Success criteria:** the UTC bucket is 2026-11-04; the Prague bucket is the 5th of November local time, whose key in milliseconds is 1793833200000.
<details><summary>Answer</summary>

```json
GET /ev/_search
{ "size": 0, "aggs": {
  "utc":    { "date_histogram": { "field": "@timestamp", "calendar_interval": "1d" } },
  "prague": { "date_histogram": { "field": "@timestamp", "calendar_interval": "1d", "time_zone": "Europe/Prague" } } } }
```

**Verification.**

1. `utc.buckets[0].key` is 1793750400000 (`2026-11-04T00:00:00.000Z`), `doc_count` 1.
2. `prague.buckets[0].key` is 1793833200000, which is `2026-11-04T23:00:00Z`, i.e. local midnight at the start of 5 November (+01:00); `doc_count` 1.

The interval parameter `interval` was removed in 8.0; use `calendar_interval` or `fixed_interval`.

Verification script: [`examples/integration/exam-d3-aggregations.itest.ts`](../examples/integration/exam-d3-aggregations.itest.ts), test `Q-ECE-026`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#62-date_histogram), https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-datehistogram-aggregation

</details>

### Q-ECE-027 · Aggregations · difficulty 3 · hands-on

**Starting state:** three single-shard indices `agg-s0`, `agg-s1`, `agg-s2`, each with `k` mapped as `keyword`. `agg-s0` holds 10 docs `x` and 9 docs `y`, `agg-s1` holds 10 `z` and 9 `y`, `agg-s2` holds 10 `w` and 9 `y`.

**Task:** ask for the single top term of `k` over `agg-s*` with `shard_size: 1`, then repeat with the default `shard_size`.

**Success criteria:** the first answer is wrong and reports its error bound; the second returns `y`.
<details><summary>Answer</summary>

```json
GET /agg-s*/_search
{ "size": 0, "aggs": { "top": { "terms": { "field": "k", "size": 1, "shard_size": 1, "show_term_doc_count_error": true } } } }

GET /agg-s*/_search
{ "size": 0, "aggs": { "top": { "terms": { "field": "k", "size": 1 } } } }
```

**Verification.**

1. Request 1: bucket `w` with `doc_count` 10, `doc_count_error_upper_bound` 30 on the aggregation and 20 on the bucket. The true winner `y` (27) was cut on every shard.
2. Request 2: the default `shard_size` is `size × 1.5 + 10` = 11, so `y` is returned with `doc_count` 27 and an error bound of 0.

Each shard returns only its local top `shard_size` terms; the bound sums, per shard, the count of the last returned term.

Verification script: [`examples/integration/exam-d3-aggregations.itest.ts`](../examples/integration/exam-d3-aggregations.itest.ts), test `Q-ECE-027`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#32-the-counterexample), [practical rules](../modules/07-aggregations.md#34-practical-rules), https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-terms-aggregation

</details>

### Q-ECE-028 · Aggregations · difficulty 2 · multi

Which TWO aggregations are exact for any number of shards?

- A) `terms` with `size: 5`, ordered by count
- B) `composite`
- C) `cardinality`
- D) `avg`
- E) `percentiles` (default TDigest)

<details><summary>Answer</summary>

**B, D.** `composite` streams keys in sorted order from every shard and merges them; `avg` ships `(sum, count)` per shard, so the reduction is associative and lossless.

- Why not A: each shard truncates to `shard_size`, so the result is approximate.
- Why not C: the HyperLogLog++ sketch merges exactly but the estimate is approximate.
- Why not E: TDigests merge approximately.
- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#2-the-reduce-algebra), https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-composite-aggregation

</details>

### Q-ECE-029 · Aggregations · difficulty 2 · single

A product team treats the `cardinality` result for unique visitors as exact for billing. What is the correct advice?

- A) It is approximate (HyperLogLog++); `precision_threshold` (default 3000, maximum 40000) improves accuracy but does not make it exact, so use `composite` or a transform for billing
- B) It is exact below 40,000 values on any index
- C) It is exact when `size: 0` is set
- D) It is exact only on indices with one primary shard

<details><summary>Answer</summary>

**A.** Counts are expected to be close to exact below the threshold, with relative error about 1.04/√m above it; hash collisions remain the residual error.

- Why not B: the threshold is a tuning knob, not a guarantee.
- Why not C: `size: 0` affects hits and caching only.
- Why not D: a single shard does not remove the approximation.
- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#4-cardinality-hyperloglog), https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-cardinality-aggregation

</details>

### Q-ECE-030 · Aggregations · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** list every `category` bucket with its document count using a `composite` aggregation, two buckets per page, until no buckets remain.

**Success criteria:** page 1 `accessories`, `bundles`; page 2 `keyboards`, `mice`; page 3 empty.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "size": 0, "aggs": { "cats": { "composite": { "size": 2,
  "sources": [ { "cat": { "terms": { "field": "category" } } } ] } } } }

GET /products/_search
{ "size": 0, "aggs": { "cats": { "composite": { "size": 2,
  "sources": [ { "cat": { "terms": { "field": "category" } } } ],
  "after": { "cat": "bundles" } } } } }
```

**Verification.**

1. Page 1: keys `accessories` (2) and `bundles` (1); `after_key` is `{ "cat": "bundles" }`.
2. Page 2 with that `after`: `keyboards` (2) and `mice` (2); `after_key` is `{ "cat": "mice" }`.
3. Page 3 with `after: { "cat": "mice" }` has an empty `buckets` array.

Verification script: [`examples/integration/exam-d3-aggregations.itest.ts`](../examples/integration/exam-d3-aggregations.itest.ts), test `Q-ECE-030`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#5-composite-exhaustive-paginated-buckets), https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-composite-aggregation

</details>

### Q-ECE-031 · Aggregations · difficulty 3 · hands-on

**Starting state:** the products dataset.

**Task:** build a shop facet: search `description` for `keyboard`, show category counts for all matches, but list only the hits of the selected category `keyboards`.

**Success criteria:** hits `p1` and `p2`; category buckets `keyboards` 2, `bundles` 1, `accessories` 1.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "query": { "match": { "description": "keyboard" } },
  "aggs": { "cats": { "terms": { "field": "category" } } },
  "post_filter": { "term": { "category": "keyboards" } } }
```

**Verification.**

1. `hits.total.value` is 2 (`p1`, `p2`).
2. `aggregations.cats.buckets` are `keyboards` 2, `bundles` 1 (`p5`), `accessories` 1 (`p7`).
3. Moving the `term` into `query.bool.filter` instead makes the aggregation show only `keyboards: 2`.

`post_filter` runs after aggregations are computed. For several facets, wrap each in a `filter` aggregation that applies all other selections.

Verification script: [`examples/integration/exam-d3-aggregations.itest.ts`](../examples/integration/exam-d3-aggregations.itest.ts), test `Q-ECE-031`.

- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#71-facets-with-post_filter), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/filter-search-results

</details>

### Q-ECE-032 · Aggregations · difficulty 3 · scenario

A dashboard nests `terms` (size 1000) over `terms` (size 1000) over a `date_histogram`; it fails with `too_many_buckets_exception` or, on busy days, with `circuit_breaking_exception` (429). Which remedy is best?

- A) Reduce the sizes, restructure to what is displayed, and use `composite` pagination when all groups are needed
- B) Raise `search.max_buckets` and the request breaker limit until it passes
- C) Enable `fielddata` on the fields
- D) Add `size: 0` to the request

<details><summary>Answer</summary>

**A.** `search.max_buckets` (65,536 by default) and the request breaker (60% of heap) protect the cluster; the product of the nested sizes is a design problem, so cut the sizes or page exhaustively with `composite`.

- Why not B: it removes the guard rails instead of fixing the product of bucket counts.
- Why not C: fielddata is for `text` and increases heap pressure.
- Why not D: the query already needs no hits; the buckets remain.
- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#8-memory-limits-and-caching), https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-terms-aggregation

</details>

### Q-ECE-033 · Aggregations · difficulty 3 · single

A nightly transform stores the p95 latency per hour, and a report averages these 24 values to publish a daily p95. What is wrong, and what is the fix?

- A) Percentiles do not compose; store raw values or a mergeable histogram (`histogram` or `exponential_histogram` field) and aggregate those
- B) Nothing is wrong when the hourly doc counts are equal
- C) Switch to `avg` of the hourly `max` values, which is exact
- D) Raise TDigest `compression` to 1000, which makes hourly p95 values additive

<details><summary>Answer</summary>

**A.** The p95 of a union is not a function of the p95s of the parts; the same reasoning forbids averaging averages.

- Why not B: equal counts do not make quantiles averageable.
- Why not C: the average of maxima is a different statistic and not the daily p95.
- Why not D: higher compression improves a digest's accuracy but not the arithmetic of combining results.
- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#41-percentiles-tdigest-and-hdr), https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-percentile-aggregation

</details>

---

## Domain 4: Data Processing

### Q-ECE-034 · Data Processing · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** create ingest pipeline `access-logs` that (1) dissects `message` with the pattern `%{client} [%{ts}] "%{verb} %{path}" %{status} %{bytes}`, (2) converts `status` to `integer` and `bytes` to `long` (ignoring failures for `bytes`), (3) parses `ts` (ISO 8601) into `@timestamp` and removes `ts`, (4) sets `event.outcome` to `failure` when `status` is 500 or more, (5) lowercases `verb`. Simulate it with the message `10.0.0.5 [2026-11-04T10:00:00Z] "GET /index" 500 1200` and with the same message ending in `abc` instead of `1200`.

**Success criteria:** the first document is fully parsed; in the second `bytes` stays the string `abc` and the document is not rejected.
<details><summary>Answer</summary>

```json
PUT _ingest/pipeline/access-logs
{ "processors": [
  { "dissect": { "field": "message", "pattern": "%{client} [%{ts}] \"%{verb} %{path}\" %{status} %{bytes}" } },
  { "convert": { "field": "status", "type": "integer" } },
  { "convert": { "field": "bytes", "type": "long", "ignore_failure": true } },
  { "date": { "field": "ts", "formats": ["ISO8601"], "target_field": "@timestamp" } },
  { "remove": { "field": "ts" } },
  { "set": { "field": "event.outcome", "value": "failure", "if": "ctx.status >= 500" } },
  { "lowercase": { "field": "verb" } } ] }

POST _ingest/pipeline/access-logs/_simulate
{ "docs": [ { "_source": { "message": "10.0.0.5 [2026-11-04T10:00:00Z] \"GET /index\" 500 1200" } },
            { "_source": { "message": "10.0.0.5 [2026-11-04T10:00:00Z] \"GET /index\" 500 abc" } } ] }
```

**Verification.**

1. Document 1 has `client` `10.0.0.5`, `verb` `get`, `path` `/index`, `status` 500, `bytes` 1200 (numbers), `@timestamp` `2026-11-04T10:00:00.000Z`, `event.outcome` `failure`, and no `ts`.
2. Document 2 has `bytes` `"abc"` (string) and every later processor still ran.

Order matters: removing `ts` before the `date` processor would make it fail.

Verification script: [`examples/integration/exam-d4-data-processing.itest.ts`](../examples/integration/exam-d4-data-processing.itest.ts), test `Q-ECE-034`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#1-ingest-pipelines), [failure semantics](../modules/08-ingest-pipelines-and-data-lifecycle.md#12-failure-semantics), https://www.elastic.co/docs/manage-data/ingest/transform-enrich/ingest-pipelines

</details>

### Q-ECE-035 · Data Processing · difficulty 2 · hands-on

**Starting state:** document `inventory/_doc/1` with `{ "stock": 5, "in_stock": true }`.

**Task:** with one scripted update that takes the quantity as a parameter, remove 5 units and set `in_stock` to `false` when the stock reaches zero or less.

**Success criteria:** the document ends as `{ "stock": 0, "in_stock": false }` with `_version` 2, and the script source contains no literal quantity.
<details><summary>Answer</summary>

```json
POST /inventory/_update/1
{ "script": {
    "source": "ctx._source.stock -= params.qty; if (ctx._source.stock <= 0) { ctx._source.in_stock = false }",
    "params": { "qty": 5 } } }
```

**Verification.**

1. The response has `result: "updated"`.
2. `GET /inventory/_doc/1` shows `_source` `{ "stock": 0, "in_stock": false }` and `_version` 2.

Variable data goes into `params` so that one source string is compiled once; building sources with literal values hits `script.max_compilations_rate` and fails with `circuit_breaking_exception: too many script compilations`.

Verification script: [`examples/integration/exam-d4-data-processing.itest.ts`](../examples/integration/exam-d4-data-processing.itest.ts), test `Q-ECE-035`.

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#14-painless-essentials), https://www.elastic.co/docs/explore-analyze/scripting/modules-scripting-using

</details>

### Q-ECE-036 · Data Processing · difficulty 1 · single

A `_bulk` request of 1,000 actions returns HTTP 200 with `"errors": true`. What does this mean?

- A) The request itself was processed, but at least one item failed; inspect each item's `status` and retry only the failed ones
- B) The whole batch was rolled back
- C) The whole batch was indexed and `errors` is only a warning
- D) The cluster is red

<details><summary>Answer</summary>

**A.** Bulk is not transactional: items succeed or fail independently, and the HTTP status stays 200. A `429 es_rejected_execution_exception` item means the write queue was full and should be retried with back-off.

- Why not B: there is no rollback across items.
- Why not C: `errors: true` means some item failed and data may be missing.
- Why not D: cluster health is unrelated.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#2-the-_bulk-api), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk

</details>

### Q-ECE-037 · Data Processing · difficulty 2 · hands-on

**Starting state:** the products dataset; an ingest pipeline `tag-v2` that sets `schema` to `v2`.

**Task:** copy `products` into a new index `products-v2` that you create first with the same mapping, running every document through `tag-v2`. Make the operation safe to repeat: existing documents must be skipped, not overwritten and not treated as failures.

**Success criteria:** the first run creates 7 documents; a second run creates 0 and reports 7 version conflicts without failing.
<details><summary>Answer</summary>

```json
POST _reindex?slices=auto
{ "source": { "index": "products" },
  "dest": { "index": "products-v2", "pipeline": "tag-v2", "op_type": "create" },
  "conflicts": "proceed" }
```

**Verification.**

1. Run 1: `total` 7, `created` 7, `failures` empty.
2. Run 2: `created` 0, `version_conflicts` 7, `failures` empty.
3. `GET /products-v2/_count` returns 7 and every document has `schema: "v2"`.

Create the destination first; otherwise it is built by dynamic mapping. `_reindex` copies documents only, not mappings or settings.

Verification script: [`examples/integration/exam-d4-data-processing.itest.ts`](../examples/integration/exam-d4-data-processing.itest.ts), test `Q-ECE-037`.

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#31-_reindex), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reindex-indices

</details>

### Q-ECE-038 · Data Processing · difficulty 2 · scenario

A scripted `_update_by_query` over 20 million documents stops halfway with a `version_conflict_engine_exception` because applications keep updating documents. Which statement describes the state and the right retry strategy?

- A) Batches already processed stay changed (no rollback); re-run with `conflicts=proceed` and an idempotent script
- B) Everything was rolled back, so just re-run it unchanged
- C) The index is corrupt and must be restored from a snapshot
- D) Only `_delete_by_query` aborts on conflicts; `_update_by_query` never does

<details><summary>Answer</summary>

**A.** Both by-query operations run over a snapshot taken at the start and abort on a version conflict unless `conflicts=proceed`, which counts and skips the conflicts. Nothing is rolled back, so the script must tolerate being applied to already-updated documents.

- Why not B: without `proceed` the same abort happens again, and already-changed documents would be changed twice.
- Why not C: the data is consistent, just partly processed.
- Why not D: both APIs behave the same way.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#32-_update_by_query-and-_delete_by_query), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/update-by-query-api

</details>

### Q-ECE-039 · Data Processing · difficulty 3 · scenario

A pipeline has: (1) `convert` `bytes` with `ignore_failure: true`; (2) `convert` `status` with no handler; (3) `set` `checked` = `true`; and a pipeline-level `on_failure` that sets `error.message`. A document arrives with `bytes` = `"x"` and `status` = `"y"`. What is indexed?

- A) The document with `bytes` still `"x"`, `error.message` set, `status` unconverted, and no `checked` field
- B) The document is rejected with an error
- C) The document with `checked` = `true` and no `error.message`
- D) The document with `bytes` removed and `error.message` set

<details><summary>Answer</summary>

**A.** `ignore_failure` lets the pipeline continue past step 1. Step 2 fails with no processor-level `on_failure`, so the pipeline-level handler runs and the pipeline stops there; step 3 never runs, and the document is indexed as modified.

- Why not B: rejection only happens when no handler exists at any level.
- Why not C: the pipeline ends at the failure, so `checked` is never set.
- Why not D: a failed `convert` leaves the field as it was.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#12-failure-semantics), https://www.elastic.co/docs/manage-data/ingest/transform-enrich/error-handling

</details>

### Q-ECE-040 · Data Processing · difficulty 2 · hands-on

**Starting state:** an empty index `notes`.

**Task:** index document 1, read its `_seq_no` and `_primary_term`, update it conditionally with those values, then repeat the same conditional update with the old values.

**Success criteria:** the first conditional write succeeds; the second fails with HTTP 409.
<details><summary>Answer</summary>

```json
PUT /notes/_doc/1
{ "text": "v1" }

GET /notes/_doc/1

PUT /notes/_doc/1?if_seq_no=0&if_primary_term=1
{ "text": "v2" }

PUT /notes/_doc/1?if_seq_no=0&if_primary_term=1
{ "text": "v3" }
```

**Verification.**

1. `_seq_no` and `_primary_term` of the first read are those used in the conditions (typically 0 and 1 on a fresh index).
2. Write 2 returns `result: "updated"`, `_seq_no` 1.
3. Write 3 returns 409 `version_conflict_engine_exception`, because the stored `_seq_no` is now 1.

For commutative `_update` calls use `retry_on_conflict`; the internal `version` parameter for OCC was removed in 7.0 for index and delete requests.

Verification script: [`examples/integration/exam-d4-data-processing.itest.ts`](../examples/integration/exam-d4-data-processing.itest.ts), test `Q-ECE-040`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#2-the-write-path), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/optimistic-concurrency-control

</details>

### Q-ECE-041 · Data Processing · difficulty 3 · hands-on

**Starting state:** an empty cluster.

**Task:** manage the synonym set `product-synonyms` with the Synonyms API (`laptop, notebook` and `tv, television`). Create index `catalog-syn` whose `name` field is indexed with the `standard` analyzer and searched with an updateable `synonym_graph` search analyzer fed by that set. Index id 1 `Gaming notebook`, id 2 `Samsung television`, id 4 `smartphone case`. Then add the rule `phone, smartphone` to the set without reindexing.

**Success criteria:** `laptop` finds id 1 and `tv` finds id 2 from the start; `phone` finds nothing before the update and id 4 after it.
<details><summary>Answer</summary>

```json
PUT _synonyms/product-synonyms
{ "synonyms_set": [ { "id": "laptop", "synonyms": "laptop, notebook" },
                    { "id": "tv", "synonyms": "tv, television" } ] }

PUT /catalog-syn
{ "settings": { "number_of_shards": 1, "number_of_replicas": 0, "analysis": {
    "filter": { "prod_syn": { "type": "synonym_graph", "synonyms_set": "product-synonyms", "updateable": true } },
    "analyzer": { "prod_search": { "tokenizer": "standard", "filter": ["lowercase", "prod_syn"] } } } },
  "mappings": { "properties": { "name": { "type": "text", "analyzer": "standard", "search_analyzer": "prod_search" } } } }

PUT _synonyms/product-synonyms
{ "synonyms_set": [ { "id": "laptop", "synonyms": "laptop, notebook" },
                    { "id": "tv", "synonyms": "tv, television" },
                    { "id": "phone", "synonyms": "phone, smartphone" } ] }
```

**Verification.**

1. `match` on `name` for `laptop` returns id 1; for `tv` returns id 2.
2. `match` for `phone` returns 0 hits before the second `PUT _synonyms`, and id 4 afterwards, with no reindex.

Synonyms belong on the search side: index-time synonyms bake the list into the segments and need a reindex on every change. Multi-word rules such as `ny, new york` require `synonym_graph`, not `synonym`.

Verification script: [`examples/integration/exam-d4-data-processing.itest.ts`](../examples/integration/exam-d4-data-processing.itest.ts), test `Q-ECE-041`.

- Ref: [modules/04-text-analysis.md](../modules/04-text-analysis.md#44-synonyms), https://www.elastic.co/docs/reference/text-analysis/analysis-synonym-graph-tokenfilter

</details>

### Q-ECE-042 · Data Processing · difficulty 3 · multi

Field `text` uses a custom analyzer (`standard` tokenizer, filters `lowercase` and `stop`) and holds the value `quick and the fox`. Which THREE queries match the document?

- A) `match_phrase` `quick fox`
- B) `match_phrase` `quick fox` with `slop: 2`
- C) `match_phrase` `quick and the fox`
- D) `match` `quick fox` with `operator: and`
- E) `term` `quick fox`

<details><summary>Answer</summary>

**B, C, D.** The stop filter removes `and` and `the` but leaves a position gap, so the indexed terms are `quick(0)` and `fox(3)`.

- **B:** slop 2 closes the gap.
- **C:** the query is analysed the same way, so it also becomes `quick(0) fox(3)`.
- **D:** both terms are present; positions do not matter for `match`.
- Why not A: the analysed query has adjacent positions 0 and 1, which the index does not have.
- Why not E: `term` does not analyse, and no single term `quick fox` exists.
- Ref: [modules/04-text-analysis.md](../modules/04-text-analysis.md#41-stop-words-leave-holes), https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-match-query-phrase

</details>

### Q-ECE-043 · Data Processing · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** build prefix autocomplete on `name` in index `ac`: an `edge_ngram` tokenizer (`min_gram` 2, `max_gram` 10, token characters letters and digits) plus `lowercase` for indexing and the `standard` analyzer for searching. Index id 1 `Quick fox`, id 2 `Quiet room`, id 3 `Laptop`. Then show what goes wrong if the search analyzer is also the n-gram analyzer.

**Success criteria:** `quic` finds only id 1 and `qu` finds ids 1 and 2; with the n-gram search analyzer `quic` also finds id 2.
<details><summary>Answer</summary>

```json
PUT /ac
{ "settings": { "number_of_shards": 1, "number_of_replicas": 0, "analysis": {
    "tokenizer": { "autocomplete_tok": { "type": "edge_ngram", "min_gram": 2, "max_gram": 10, "token_chars": ["letter", "digit"] } },
    "analyzer": { "autocomplete": { "tokenizer": "autocomplete_tok", "filter": ["lowercase"] } } } },
  "mappings": { "properties": { "name": { "type": "text", "analyzer": "autocomplete", "search_analyzer": "standard" } } } }
```

**Verification.**

1. `match` `quic` returns id 1 only; `match` `qu` returns ids 1 and 2.
2. Re-creating the index with `search_analyzer: autocomplete` makes `match` `quic` produce `qu`, `qui`, `quic`, so id 2 (`Quiet` has `qu`, `qui`) matches too.

Rule: index with edge n-grams, search with a normal analyzer.

Verification script: [`examples/integration/exam-d4-data-processing.itest.ts`](../examples/integration/exam-d4-data-processing.itest.ts), test `Q-ECE-043`.

- Ref: [modules/04-text-analysis.md](../modules/04-text-analysis.md#6-autocomplete), https://www.elastic.co/docs/reference/text-analysis/analysis-edgengram-tokenizer

</details>

### Q-ECE-044 · Data Processing · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** without reindexing, query products by a price in Czech crowns computed as `price × 25`: first with a per-request `runtime_mappings` field `price_czk`, then by defining the same runtime field in the mapping.

**Success criteria:** a `range` with `gte: 2000` returns `p1`, `p3`, `p5`; `fields: ["price_czk"]` returns `3000.0` for `p1`.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "runtime_mappings": { "price_czk": { "type": "double", "script": "emit(doc['price'].value * 25)" } },
  "query": { "range": { "price_czk": { "gte": 2000 } } },
  "fields": ["price_czk"] }

PUT /products/_mapping
{ "runtime": { "price_czk": { "type": "double", "script": { "source": "emit(doc['price'].value * 25)" } } } }
```

**Verification.**

1. The ids are `p1` (3000.0), `p5` (2250.0), `p3` (2000.0).
2. After the mapping update the same search works without `runtime_mappings`.
3. `GET /products/_mapping` shows the field under `runtime`, not under `properties`.

The script runs for every candidate document, so combine runtime fields with a selective indexed filter and promote frequently used ones to indexed fields.

Verification script: [`examples/integration/exam-d4-data-processing.itest.ts`](../examples/integration/exam-d4-data-processing.itest.ts), test `Q-ECE-044`.

- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#6-runtime-fields-schema-on-read), https://www.elastic.co/docs/manage-data/data-store/mapping/runtime-fields

</details>

---

## Domain 5: Distributed Datastore

### Q-ECE-045 · Distributed Datastore · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** create index `nrt` (1 shard, 0 replicas, `refresh_interval` 30s). Index id 1, then check what search, GET and an explicit refresh each see. Then index id 2 so that the call returns only after the document is searchable.

**Success criteria:** search sees 0 documents while GET by id finds id 1; after `_refresh` search sees 1; document 2 is searchable the moment its index call returns.
<details><summary>Answer</summary>

```json
PUT /nrt
{ "settings": { "number_of_shards": 1, "number_of_replicas": 0, "refresh_interval": "30s" } }

PUT /nrt/_doc/1 { "t": "a" }
GET /nrt/_search
GET /nrt/_doc/1
POST /nrt/_refresh
PUT /nrt/_doc/2?refresh=wait_for { "t": "b" }
```

**Verification.**

1. After the first index call, `_search` returns `hits.total.value` 0 while `GET /nrt/_doc/1` returns `found: true` (GET is realtime).
2. After `_refresh`, `_search` returns 1.
3. The `refresh=wait_for` call blocks up to the refresh interval and returns once a refresh has made id 2 visible; an immediate `_search` returns 2.

`refresh=true` would force a refresh per call (a tiny segment each time) and must not be used in a loop.

Verification script: [`examples/integration/exam-d5-distributed.itest.ts`](../examples/integration/exam-d5-distributed.itest.ts), test `Q-ECE-045`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#31-near-real-time-nrt-search), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/refresh-parameter

</details>

### Q-ECE-046 · Distributed Datastore · difficulty 1 · single

How does an Elasticsearch index request become acknowledged, and what does `wait_for_active_shards` guarantee?

- A) The primary executes the operation, forwards it to all in-sync replicas and waits for them; `wait_for_active_shards` only checks before the write that enough copies are active
- B) The write succeeds when a majority of copies acknowledge it; `wait_for_active_shards` sets that majority
- C) The coordinating node writes to all copies in parallel and acknowledges on the first response
- D) The primary acknowledges immediately and replicas catch up asynchronously

<details><summary>Answer</summary>

**A.** Replication is primary-backup. A failed replica is reported to the master and removed from the in-sync set, and the write still succeeds. The default of `wait_for_active_shards` is 1 (the primary).

- Why not B: there is no write quorum.
- Why not C: only the primary accepts the operation from the coordinating node.
- Why not D: replicas are part of the acknowledged path unless they fail.
- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#2-the-write-path), https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents

</details>

### Q-ECE-047 · Distributed Datastore · difficulty 3 · hands-on

**Starting state:** an empty cluster.

**Task:** create index `orders` with 6 primaries, 0 replicas and `tenant` mapped as `keyword`. (1) Find the shard that document id `654321` is routed to. (2) Index `o-1001` with the routing value `tenant-42` and show that it can only be read back with the same routing. (3) Run a search restricted by routing to that tenant.

**Success criteria:** id 654321 maps to shard 2 (in ES 9+; shard 4 in legacy ES 7/8); GET without routing misses; the routed search touches one shard.
<details><summary>Answer</summary>

```json
PUT /orders { "settings": { "number_of_shards": 6, "number_of_replicas": 0 }, "mappings": { "properties": { "tenant": { "type": "keyword" } } } }

GET /orders/_search_shards?routing=654321

PUT /orders/_doc/o-1001?routing=tenant-42&refresh=true { "tenant": "tenant-42", "total": 99 }
GET /orders/_doc/o-1001
GET /orders/_doc/o-1001?routing=tenant-42
GET /orders/_search?routing=tenant-42 { "query": { "term": { "tenant": "tenant-42" } } }
```

**Verification.**

1. `_search_shards` lists one shard with `shard: 2`: `h("654321") = 1424940152`, and in Elasticsearch 9+ modulo routing `floorMod(1424940152, 6) = 2`. (On legacy Elasticsearch 7/8 with 768 routing shards, `floorMod(h, 768) = 632`, `632 / 128 = 4`).
2. `GET` without routing returns 404 `found: false` (most likely a different shard); with `routing=tenant-42` it returns the document.
3. The routed search reports `_shards.total` 1.

Routing hot spots (one tenant with most data) and the need to pass the same routing on every get, update and delete are the costs; `"_routing": { "required": true }` makes it mandatory.

Verification script: [`examples/integration/exam-d5-distributed.itest.ts`](../examples/integration/exam-d5-distributed.itest.ts), test `Q-ECE-047`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/10-scaling-sharding-and-multi-cluster.md](../modules/10-scaling-sharding-and-multi-cluster.md#1-document-routing-exactly), [custom routing](../modules/10-scaling-sharding-and-multi-cluster.md#2-custom-routing), https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-routing-field

</details>

### Q-ECE-048 · Distributed Datastore · difficulty 2 · single

For throughput, an operator sets `index.translog.durability: async` on an index that receives orders. After a node crashes (power loss), which writes can be lost?

- A) Operations acknowledged in the window since the last translog fsync (`sync_interval`, 5 seconds by default)
- B) Only operations not yet refreshed
- C) None, because the Lucene commit makes everything durable
- D) Everything since the last flush

<details><summary>Answer</summary>

**A.** With `async` the translog is fsynced every `sync_interval` instead of before each acknowledgement, so acknowledged writes in that window are lost. It is a throughput knob for data that can be replayed from the source.

- Why not B: refresh only affects searchability; with the default `request` durability unrefreshed writes survive via translog replay.
- Why not C: durability between commits comes from the translog.
- Why not D: the translog fsync interval, not the flush, bounds the loss.
- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#32-the-translog), https://www.elastic.co/docs/reference/elasticsearch/index-settings/translog

</details>

### Q-ECE-049 · Distributed Datastore · difficulty 3 · scenario

An index with one replica receives frequent updates. Users running the same query twice get the same hits but slightly different scores. Which explanation and mitigation are correct?

- A) Primary and replica have different numbers of not-yet-merged deleted documents, which still count in term statistics; pin each user to the same copies with `preference=<session id>`
- B) The replica is stale; run `_refresh` before each search
- C) `dfs_query_then_fetch` removes the effect completely
- D) Replicas use a different similarity; copy the primary's settings

<details><summary>Answer</summary>

**A.** An update is delete plus insert, and deleted documents keep contributing to `docFreq` and `avgdl` until a merge removes them. Copies merge at different times, so statistics differ per copy.

- Why not B: refresh would not remove the deleted documents from statistics.
- Why not C: DFS aggregates statistics across shards, but deleted documents are still counted in them.
- Why not D: all copies share the index settings.
- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#7-production-failure-modes), [statistics are local](../modules/01-search-fundamentals-and-ir-theory.md#4-statistics-are-local-shards-segments-and-deleted-documents), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-shard-routing

</details>

### Q-ECE-050 · Distributed Datastore · difficulty 2 · single

A one-off backfill of 200 million documents into a new index should finish fast. Which settings plan is right?

- A) Set `refresh_interval: -1` and `number_of_replicas: 0` for the load, then restore both and let the replicas recover by file copy
- B) Keep replicas at 1 and call `?refresh=true` on every bulk request
- C) Set `translog.durability: async` and leave it afterwards
- D) Force-merge to one segment after every bulk

<details><summary>Answer</summary>

**A.** Without a 1 s refresh the load does not write thousands of tiny segments, and without replicas each document is not re-executed on a second copy; afterwards one file copy replaces per-document replication. On a single-node cluster the restored replica stays unassigned and health is yellow.

- Why not B: it creates a tiny segment per request and keeps merges busy.
- Why not C: leaving `async` in place risks acknowledged writes after a crash.
- Why not D: repeated merges rewrite data over and over.
- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#7-production-failure-modes), https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/indexing-speed

</details>

### Q-ECE-051 · Distributed Datastore · difficulty 2 · ordering

Order the phases of a distributed search with the default `query_then_fetch`.

- A) The coordinating node picks one copy per shard (adaptive replica selection)
- B) Each shard returns its top `from + size` entries (doc id, score, sort values) and partial aggregations
- C) The coordinating node merges the shard lists and keeps the global top `size`
- D) The coordinating node fetches `_source` and highlights for the chosen documents only
- E) The coordinating node returns the hits to the client

<details><summary>Answer</summary>

**A, B, C, D, E.** The query phase returns only identifiers and scores; the fetch phase touches just the final `size` documents, which keeps deep pagination expensive only in phase B and C.

- Why not D before C: it would fetch documents that are then discarded.
- **Exam delta:** 9.5 sends one query-phase request per data node and partially reduces there (`search.batched_query_phase`), while a 9.3 cluster sends one request per shard. The phase order and results are the same, because top-k merge is associative and commutative.
- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#5-the-read-path-query-then-fetch), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search

</details>

---

## Domain 6: Data Management

### Q-ECE-052 · Data Management · difficulty 2 · hands-on

**Starting state:** indices `products-v1` (the products dataset, with alias `products-live`) and an empty `products-v2` with the same mapping.

**Task:** move the alias `products-live` from v1 to v2 in one atomic request. Then show that a request containing one failing action changes nothing, and that an alias over two indices needs a designated write index.

**Success criteria:** after the swap the alias resolves to v2 only; the failing request leaves the alias unchanged; a write through a two-index alias without `is_write_index` is rejected.
<details><summary>Answer</summary>

```json
POST _aliases
{ "actions": [ { "remove": { "index": "products-v1", "alias": "products-live" } },
               { "add":    { "index": "products-v2", "alias": "products-live" } } ] }

POST _aliases
{ "actions": [ { "add": { "index": "products-v1", "alias": "products-live" } },
               { "add": { "index": "does-not-exist", "alias": "products-live" } } ] }
```

**Verification.**

1. `GET _alias/products-live` after request 1 lists only `products-v2`.
2. Request 2 returns 404 `index_not_found_exception`, and `GET _alias/products-live` still lists only `products-v2` (the first action was rolled back).
3. With the alias on both indices, `PUT products-live/_doc/x { "name": "t" }` fails with 400 (more than one index and no write index); after `POST _aliases { "actions": [ { "add": { "index": "products-v2", "alias": "products-live", "is_write_index": true } } ] }` it succeeds and lands in `products-v2`.

Verification script: [`examples/integration/exam-d6-data-management.itest.ts`](../examples/integration/exam-d6-data-management.itest.ts), test `Q-ECE-052`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#33-zero-downtime-mapping-changes-with-aliases), https://www.elastic.co/docs/manage-data/data-store/aliases

</details>

### Q-ECE-053 · Data Management · difficulty 2 · scenario

To give each customer "its own index", an engineer creates a filtered alias `orders-tenant-42` over the shared index `orders`, with `filter: { term: { tenant: "tenant-42" } }` and `routing: "tenant-42"`, and hands that alias name to the customer's application. What is true?

- A) Searches through the alias are filtered and routed to one shard, and writes get the routing automatically, but it is not a security boundary: anyone with read access to `orders` bypasses the filter
- B) The alias also enforces access control, so the customer can be given a role on `orders`
- C) The routing makes the filter unnecessary
- D) Filtered aliases cannot be used for writes

<details><summary>Answer</summary>

**A.** The alias is a convenience for scoping and routing. For isolation use document-level security in a role, or separate indices.

- Why not B: authorisation is evaluated on the index (or alias) names in the role, not on the alias filter.
- Why not C: a routing value only selects a shard; other tenants' documents can share it.
- Why not D: writes through the alias receive the routing automatically.
- Ref: [modules/10-scaling-sharding-and-multi-cluster.md](../modules/10-scaling-sharding-and-multi-cluster.md#21-filtered-aliases-for-multi-tenancy), https://www.elastic.co/docs/manage-data/data-store/aliases

</details>

### Q-ECE-054 · Data Management · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** create an index template for the pattern `logs-web-*` with `data_stream: {}`, priority 200, and a mapping with `message` as `text`. Index a first document into `logs-web-default` and roll the stream over. Show which write operations a data stream accepts.

**Success criteria:** the stream has two backing indices; a document without `@timestamp` is rejected; an `index` operation with an explicit id is rejected while `create` works.
<details><summary>Answer</summary>

```json
PUT _index_template/logs-web
{ "index_patterns": ["logs-web-*"], "data_stream": {}, "priority": 200,
  "template": { "settings": { "number_of_replicas": 0 },
    "mappings": { "properties": { "message": { "type": "text" } } } } }

POST /logs-web-default/_doc
{ "@timestamp": "2026-11-04T10:00:00Z", "message": "GET /a 200" }

POST /logs-web-default/_rollover
```

**Verification.**

1. The first `POST` returns 201 and creates the stream; `GET _data_stream/logs-web-default` lists one backing index named `.ds-logs-web-default-<yyyy.MM.dd>-000001`.
2. After `_rollover` there are two indices, the second ending in `-000002`, and it is the write index.
3. `POST /logs-web-default/_doc { "message": "no ts" }` returns 400 (a timestamp is required).
4. `PUT /logs-web-default/_doc/1 { ... }` (index operation) returns 400, while `PUT /logs-web-default/_create/1 { "@timestamp": "...", "message": "x" }` returns 201.

Only `op_type: create` is accepted; updates and deletes go through `_update_by_query`, `_delete_by_query` or directly to a backing index with `if_seq_no` and `if_primary_term`.

Verification script: [`examples/integration/exam-d6-data-management.itest.ts`](../examples/integration/exam-d6-data-management.itest.ts), test `Q-ECE-054`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#4-data-streams), https://www.elastic.co/docs/manage-data/data-store/data-streams

</details>

### Q-ECE-055 · Data Management · difficulty 3 · hands-on

**Starting state:** a single-node cluster started with `indices.lifecycle.poll_interval=1s`, no templates.

**Task:** create ILM policy `quick` whose hot phase rolls over at `max_docs` 3 and whose warm phase (`min_age` 0ms) sets the index priority to 50. Attach it through an index template (priority 200, `data_stream: {}`, 1 shard, 0 replicas) for `logs-ilm-*`, index four documents into `logs-ilm-default`, and inspect the lifecycle state.

**Success criteria:** the stream gets a second backing index and the first one is reported in the warm phase with priority 50.
<details><summary>Answer</summary>

```json
PUT _ilm/policy/quick
{ "policy": { "phases": {
  "hot":  { "actions": { "rollover": { "max_docs": 3 } } },
  "warm": { "min_age": "0ms", "actions": { "set_priority": { "priority": 50 } } } } } }

PUT _index_template/logs-ilm
{ "index_patterns": ["logs-ilm-*"], "data_stream": {}, "priority": 200,
  "template": { "settings": { "number_of_shards": 1, "number_of_replicas": 0, "index.lifecycle.name": "quick" } } }
```

**Verification.**

1. Index four documents with `@timestamp` into `logs-ilm-default` (use `_bulk` with `create`), then refresh.
2. Poll `GET _data_stream/logs-ilm-default` until it lists two backing indices.
3. `GET .ds-logs-ilm-default-*-000001/_ilm/explain` reports `managed: true` and `phase: "warm"`; `GET .ds-logs-ilm-default-*-000001/_settings` shows `index.priority: "50"`.
4. If a step is stuck, `step: "ERROR"` and `step_info` explain why; `POST <index>/_ilm/retry` retries it.

ILM checks run every `indices.lifecycle.poll_interval` (10 minutes by default). `min_age` counts from rollover for a rolled-over index.

Verification script: [`examples/integration/exam-d6-data-management.itest.ts`](../examples/integration/exam-d6-data-management.itest.ts), test `Q-ECE-055`.

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#52-min_age-is-relative-to-rollover), [rollover](../modules/08-ingest-pipelines-and-data-lifecycle.md#51-rollover), https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management

</details>

### Q-ECE-056 · Data Management · difficulty 3 · scenario

Daily indices `logs-2026.10.*` use an ILM policy with `rollover` in hot and `delete` after 30 days. The indices are plain indices (no data stream, no rollover alias). Disk is full after 60 days; every index is still in the hot phase. What is the diagnosis and fix?

- A) The rollover step cannot run, so `min_age` (counted from rollover) never starts; `GET <index>/_ilm/explain` shows `step: ERROR`. Fix the setup (data stream or write alias), or remove `rollover` from the policy, then `_ilm/retry`
- B) ILM is disabled cluster-wide; start it with `_ilm/start` only
- C) `min_age` counts from creation, so the delete must have fired and disk is full for another reason
- D) The policy needs a `shrink` action to ever leave hot

<details><summary>Answer</summary>

**A.** An index whose policy contains `rollover` but which never rolls over stays in hot forever. This is a classic "disk full although retention is 30 days" incident.

- Why not B: nothing in the scenario suggests ILM is stopped, and starting it would not fix the failing step.
- Why not C: for rolled-over indices `min_age` counts from rollover time.
- Why not D: shrink is optional.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#52-min_age-is-relative-to-rollover), https://www.elastic.co/docs/troubleshoot/elasticsearch/index-lifecycle-management-errors

</details>

### Q-ECE-057 · Data Management · difficulty 2 · multi

Which THREE requirements need ILM rather than the data stream lifecycle?

- A) Shrink old indices to one shard in a warm phase
- B) Mount old data as a fully mounted searchable snapshot in a cold phase
- C) Force merge indices in a warm phase
- D) Delete data after 30 days
- E) Downsample time-series data after 7 days

<details><summary>Answer</summary>

**A, B, C.** The data stream lifecycle has retention and downsampling only, with no phases or tier migrations in its basic form; shrink, force merge and searchable snapshots are ILM actions.

- Why not D and E: both are configured with `data_retention` and `downsampling` in the data stream lifecycle.
- **Exam delta:** 9.5 adds `frozen_after` to the data stream lifecycle (paid feature); it does not exist on a 9.3 exam cluster, so use ILM there when a frozen tier is required.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#53-data-stream-lifecycle-dsl), https://www.elastic.co/docs/manage-data/lifecycle/data-stream

</details>

### Q-ECE-058 · Data Management · difficulty 2 · single

Which statement about searchable snapshots and tiers is correct?

- A) Fully mounted indices (cold) keep a full local copy of the shard and need no replicas, because the snapshot is the redundancy; partially mounted indices (frozen) use a shared block cache and fetch from the repository on cache misses
- B) Frozen shards keep a full local copy; cold shards use a shared cache
- C) Searchable snapshots work on a Basic license
- D) Mounted indices keep working after the snapshot repository is deleted

<details><summary>Answer</summary>

**A.** Cold has latency close to warm; frozen is the cheapest and slow on cache misses, so queries over it should be asynchronous.

- Why not B: the descriptions are swapped.
- Why not C: searchable snapshots need an Enterprise licence (the trial licence on a lab cluster also works).
- Why not D: mounted indices depend on the repository; deleting it or letting a lifecycle prune its snapshots makes them unrecoverable.
- **Exam delta:** the licence has to be present in the exam environment; the tier behaviour is the same on 9.3 and 9.5.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#6-data-tiers-and-searchable-snapshots), https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/searchable-snapshots

</details>

### Q-ECE-059 · Data Management · difficulty 2 · single

A hot phase has `rollover: { max_age: "30d", max_primary_shard_size: "50gb", max_primary_shard_docs: 200000000 }`. The write index is 2 days old, holds 120 million documents and its primary shard has 60 GB. What happens?

- A) It rolls over, because any `max_*` condition being met is enough
- B) It waits until it is 30 days old
- C) It waits until all three conditions are met
- D) It rolls over only if the policy also has a `min_*` condition

<details><summary>Answer</summary>

**A.** Rollover happens when any `max_*` condition is met (and all `min_*` conditions, if any, hold); the 50 GB limit is exceeded. An empty index never rolls over.

- Why not B: age is only one of the alternatives.
- Why not C: the conditions are alternatives, not a conjunction.
- Why not D: `min_*` conditions only add requirements.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#51-rollover), https://www.elastic.co/docs/reference/elasticsearch/index-lifecycle-actions/ilm-rollover

</details>

### Q-ECE-060 · Data Management · difficulty 2 · single

You change the mapping of `status` from `keyword` to `short` in the template of data stream `logs-web-default`. What happens to the existing data?

- A) Nothing yet: the new mapping applies to the next backing index created at rollover; existing backing indices keep the old mapping, and changing them means reindexing into a new stream
- B) All backing indices are re-mapped in place
- C) The stream rejects all new documents
- D) Elasticsearch reindexes the stream automatically

<details><summary>Answer</summary>

**A.** Templates apply only at index creation; for data streams, a template change takes effect at the next rollover.

- Why not B: a field type cannot change in place; segments are immutable.
- Why not C: writes continue into the current write index.
- Why not D: there is no automatic reindex.
- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#4-data-streams), https://www.elastic.co/docs/manage-data/data-store/data-streams/set-up-data-stream

</details>

---

## Domain 7: Cluster Management

### Q-ECE-061 · Cluster Management · difficulty 2 · hands-on

**Starting state:** the products dataset on a node whose `elasticsearch.yml` sets `path.repo` to a writable directory (referred to as `<path.repo>`).

**Task:** register a shared-filesystem repository `repo`, take a snapshot `snap-1` of `products` without the global state, delete the index, and restore it under the name `restored-products` with no replicas.

**Success criteria:** the snapshot state is `SUCCESS`; `restored-products` holds 7 documents.
<details><summary>Answer</summary>

```json
PUT _snapshot/repo
{ "type": "fs", "settings": { "location": "<path.repo>/repo" } }

PUT _snapshot/repo/snap-1?wait_for_completion=true
{ "indices": "products", "include_global_state": false }

DELETE /products

POST _snapshot/repo/snap-1/_restore
{ "indices": "products", "rename_pattern": "(.+)", "rename_replacement": "restored-$1",
  "index_settings": { "index.number_of_replicas": 0 } }
```

**Verification.**

1. The snapshot response has `snapshot.state: "SUCCESS"` and `shards.failed: 0`.
2. `GET /restored-products/_count` returns 7 once the restore completes (`GET _cluster/health/restored-products?wait_for_status=green`).
3. `GET _snapshot/repo/snap-1` lists `products` among the indices.

The target must be absent or closed. Restoring with `include_global_state` would replace templates, ILM policies and persistent settings.

Verification script: [`examples/integration/exam-d7-cluster-management.itest.ts`](../examples/integration/exam-d7-cluster-management.itest.ts), test `Q-ECE-061`.

- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#61-repositories-and-snapshots), https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/restore-snapshot

</details>

### Q-ECE-062 · Cluster Management · difficulty 2 · single

An SLM policy has `retention: { expire_after: "30d", min_count: 5, max_count: 50 }`. A repository failure kept snapshots from succeeding for weeks; it now holds only 4 snapshots, all older than 30 days. What does the next retention run do?

- A) Deletes nothing, because the newest `min_count` (5) snapshots are always kept
- B) Deletes all four
- C) Deletes three and keeps the newest
- D) Deletes snapshots only if there are more than `max_count`

<details><summary>Answer</summary>

**A.** Retention deletes snapshots older than `expire_after`, but always keeps the newest `min_count` and never keeps more than `max_count`.

- Why not B and C: either would drop below `min_count`.
- Why not D: age-based expiry is independent of `max_count`.
- The schedule `0 30 1 * * ?` is a Quartz cron expression (seconds first), here 01:30 UTC every day.
- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#62-snapshot-lifecycle-management-slm), https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore/create-snapshots

</details>

### Q-ECE-063 · Cluster Management · difficulty 3 · hands-on

**Starting state:** a cluster with security enabled and an `elastic` superuser, plus index `orders-1` (with `tenant` mapped as `keyword`) holding `{ "tenant": "tenant-42", "customer": { "email": "a@example.com", "name": "A" }, "total": 99 }` and `{ "tenant": "tenant-7", "customer": { "email": "b@example.com", "name": "B" }, "total": 5 }`.

**Task:** create role `orders_reader` (cluster `monitor`; on `orders-*` the privileges `read` and `view_index_metadata`) that shows only tenant `tenant-42` and hides `customer.email`. Create user `report-bot` with that role. Do not give it write rights.

**Success criteria:** as `report-bot` a search returns only the tenant-42 document without `customer.email`; indexing a document is refused.
<details><summary>Answer</summary>

```json
POST /_security/role/orders_reader
{ "cluster": ["monitor"],
  "indices": [ { "names": ["orders-*"], "privileges": ["read", "view_index_metadata"],
    "query": { "term": { "tenant": "tenant-42" } },
    "field_security": { "grant": ["*"], "except": ["customer.email"] } } ] }

POST /_security/user/report-bot
{ "password": "<a strong generated secret>", "roles": ["orders_reader"] }
```

**Verification.**

1. As `report-bot`: `GET /orders-1/_search` returns `hits.total.value` 1, and `_source.customer` has only `name`.
2. As `report-bot`: `PUT /orders-1/_doc/9 { "total": 1 }` returns 403 `security_exception`.
3. `GET /_security/_authenticate` as `report-bot` shows `roles: ["orders_reader"]`; `GET /_security/user/_has_privileges` can confirm what the credential may do.

Document- and field-level security are enforced at search time and are the security boundary for multi-tenant indices; applications must never run as `elastic`.

Verification script: [`examples/integration/exam-d7-cluster-management.itest.ts`](../examples/integration/exam-d7-cluster-management.itest.ts), test `Q-ECE-063`.

- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#52-roles-users-and-api-keys), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role

</details>

### Q-ECE-064 · Cluster Management · difficulty 2 · single

An ingestion service must only append documents to data streams matching `logs-app-*` and may have to create them from templates. Which credential follows least privilege?

- A) An expiring API key whose role descriptor grants `create_doc` and `auto_configure` on `logs-app-*`
- B) A password user with the `superuser` role
- C) An API key with `all` on `*`
- D) The `elastic` user, with the password stored in the service's config

<details><summary>Answer</summary>

**A.** Ingestion needs `create_doc` (append only) and `auto_configure`, not `write` or `all`; API keys are scoped, expiring and revocable, and their role descriptors intersect with the creator's privileges.

- Why not B, C and D: each grants far more than needed; a leaked credential becomes a full compromise.
- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#52-roles-users-and-api-keys), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key

</details>

### Q-ECE-065 · Cluster Management · difficulty 2 · hands-on

**Starting state:** a single-node cluster and index `y` created with the default settings plus `number_of_replicas: 1`.

**Task:** find out why the cluster is not green, show the allocator's reasoning for the unassigned shard, and repair the health without deleting data.

**Success criteria:** the status is yellow with one unassigned replica; the explanation names the same-shard rule; after the repair the status is green.
<details><summary>Answer</summary>

```json
GET _cluster/health
GET _cat/shards/y?v&h=index,shard,prirep,state,unassigned.reason
GET _cluster/allocation/explain
{ "index": "y", "shard": 0, "primary": false }

PUT /y/_settings
{ "index.number_of_replicas": 0 }
```

**Verification.**

1. `_cluster/health` returns `status: "yellow"` and `unassigned_shards: 1`.
2. `_cat/shards` shows the primary `STARTED` and the replica `UNASSIGNED`.
3. The explanation lists the single node with decider `same_shard`: a copy of the shard already lives there, because a replica never shares a node with its primary.
4. After the settings change, `GET _cluster/health?wait_for_status=green` returns `green`.

Yellow means all primaries are active but some replica is not; red would mean an unassigned primary.

Verification script: [`examples/integration/exam-d7-cluster-management.itest.ts`](../examples/integration/exam-d7-cluster-management.itest.ts), test `Q-ECE-065`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#1-health-green-yellow-red), [diagnosis loop](../modules/11-operations-security-and-upgrades.md#11-the-diagnosis-loop), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-cluster-allocation-explain

</details>

### Q-ECE-066 · Cluster Management · difficulty 3 · hands-on

**Starting state:** the 3-node lab (`compose.3node.yml`): nodes `es1` (`zone-a`), `es2` (`zone-b`), `es3` (`zone-a`).

**Task:** configure allocation awareness on `zone` with forced values `zone-a` and `zone-b`; create index `ha` with 1 primary and 1 replica; show the copies sit in different zones; stop `es2` and show that the replica is not squeezed into the surviving zone.

**Success criteria:** green before the failure with copies in two zones; after stopping `es2` the index is yellow with an unassigned replica.
<details><summary>Answer</summary>

```json
PUT _cluster/settings
{ "persistent": {
  "cluster.routing.allocation.awareness.attributes": "zone",
  "cluster.routing.allocation.awareness.force.zone.values": "zone-a,zone-b" } }

PUT /ha { "settings": { "number_of_shards": 1, "number_of_replicas": 1 } }
```

**Verification.**

1. `GET _cat/shards/ha?v&h=index,shard,prirep,node` shows one copy on `es2` and the other on `es1` or `es3`; health is green.
2. Stop `es2` (`docker compose -f compose.3node.yml stop es2`). If the primary was on `es2`, the replica in `zone-a` is promoted.
3. `GET _cluster/health/ha` is `yellow` with `unassigned_shards: 1`; `_cluster/allocation/explain` names the awareness decider as the reason the missing copy is not placed in `zone-a`.
4. Without the forced setting, the replica would be rebuilt in the surviving zone, possibly overloading it. Use forced awareness when each zone is sized for its own share only.

Verification script: [`examples/integration/exam-d7-cluster-management.itest.ts`](../examples/integration/exam-d7-cluster-management.itest.ts), test `Q-ECE-066`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/10-scaling-sharding-and-multi-cluster.md](../modules/10-scaling-sharding-and-multi-cluster.md#41-allocation-awareness-and-forced-awareness), https://www.elastic.co/docs/deploy-manage/distributed-architecture/shard-allocation-relocation-recovery/shard-allocation-awareness

</details>

### Q-ECE-067 · Cluster Management · difficulty 2 · ordering

Put the steps of decommissioning the data node `es-data-07` (which is also master-eligible) in order.

- A) Set `cluster.routing.allocation.exclude._name` to `es-data-07` in the persistent cluster settings
- B) Wait until `_cat/shards` shows no shard on the node and the cluster is green
- C) Add a voting configuration exclusion with `POST _cluster/voting_config_exclusions`
- D) Stop the node
- E) Remove the allocation exclusion from the cluster settings

<details><summary>Answer</summary>

**A, B, C, D, E.** Draining first moves all shards off the node; the voting exclusion is needed only because the node is master-eligible, and must be in place before it is stopped; the exclusion setting is cleaned up at the end.

- Why not D earlier: stopping first would leave shard copies unassigned instead of relocated.
- Why not E before D: removing the filter would let shards flow back.
- Ref: [modules/10-scaling-sharding-and-multi-cluster.md](../modules/10-scaling-sharding-and-multi-cluster.md#42-allocation-filtering), https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cluster-level-shard-allocation-routing-settings

</details>

### Q-ECE-068 · Cluster Management · difficulty 2 · scenario

At 96% disk usage on a data node, writes fail with `cluster_block_exception ... FORBIDDEN/12/index read-only / allow delete`. The cluster runs 9.x. What is the correct handling?

- A) Free or add disk so usage falls below the high watermark (90%); the flood-stage block is then released automatically, and deletes were allowed in the meantime
- B) The block must always be removed by hand with `index.blocks.read_only_allow_delete: null`
- C) Raise the flood-stage watermark to 99%
- D) Restart the node, which clears every block

<details><summary>Answer</summary>

**A.** At the flood stage (95%) every index with a shard on the node gets `read_only_allow_delete`. Since 7.4 the block is released automatically once usage falls below the high watermark; many old runbooks still say to remove it manually.

- Why not B: manual removal is only for blocks that did not release, and does not help while the disk is still full.
- Why not C: it hides the symptom and risks a full disk.
- Why not D: the block is a setting; a restart changes nothing.
- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#2-disk-watermarks), https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cluster-level-shard-allocation-routing-settings

</details>

### Q-ECE-069 · Cluster Management · difficulty 3 · multi

Which THREE statements about cross-cluster replication (CCR) are correct?

- A) A follower index is read-only; writes go to the leader
- B) The follower pulls operations (sequence numbers, soft deletes and retention leases) from the leader instead of copying files
- C) CCR is available on the Basic licence
- D) An auto-follow pattern creates follower indices for new leader indices that match given patterns
- E) A follower paused longer than the leader's retention lease can resume without any action

<details><summary>Answer</summary>

**A, B, D.**

- **A:** replication is active-passive per index; "active-active" means two indices replicating in opposite directions with an alias or application logic.
- **B:** operations are pulled, which is why history retention matters.
- **D:** `PUT _ccr/auto_follow/<name>` with `leader_index_patterns`.
- Why not C: CCR needs a Platinum or Enterprise licence.
- Why not E: once the leader's history is merged away the follower must be re-bootstrapped.
- Ref: [modules/10-scaling-sharding-and-multi-cluster.md](../modules/10-scaling-sharding-and-multi-cluster.md#6-cross-cluster-replication-ccr), https://www.elastic.co/docs/deploy-manage/tools/cross-cluster-replication

</details>

### Q-ECE-070 · Cluster Management · difficulty 3 · ordering

Put the steps of upgrading a cluster from 8.15 to 9.5 in order.

- A) Take a snapshot
- B) Rolling upgrade to the latest 8.19.x patch
- C) Run the Upgrade Assistant or `GET /_migration/deprecations`, fix the findings, and reindex or archive indices created in 7.x
- D) Take another snapshot
- E) Rolling upgrade to 9.5.x node by node (allocation restricted to primaries, wait for green), tiers from frozen to hot and master-eligible nodes last
- F) Upgrade the clients

<details><summary>Answer</summary>

**A, B, C, D, E, F.** 9.1 and later require 8.19.x as the starting point, 7.x-created indices block the upgrade, nodes cannot be downgraded, and newer nodes can join an older master but not vice versa. Clients are upgraded after the cluster.

- Why not C after E: nodes refuse to start on 7.x-created indices.
- Why not E before B: a direct 8.15 → 9.5 jump is not supported.
- **Exam delta:** the exam cluster is 9.3; the same paths apply (9.1+ needs 8.19.x).
- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#7-rolling-upgrades-from-8x-to-9x), https://www.elastic.co/docs/deploy-manage/upgrade/deployment-or-cluster/elasticsearch

</details>

---

## Mock Exam

**Format.** 12 hands-on tasks, 180 minutes (about 15 minutes each), all seven domains in proportion to [`README.md`](README.md) §1.2. Work on a live cluster, with only the Elasticsearch documentation open. The real exam does not publish its duration, task count or passing score, so the numbers here are a practice standard. The tasks are not part of the 70 counted questions and are numbered `Q-ECE-101` to `Q-ECE-112`. Starting states use the same datasets as the bank (products, employees, logs-web); task 111 needs a cluster with security enabled, and task 112 runs on the single-node lab.

Solutions and checks are in the collapsible blocks. Do not open them before you have attempted the task. Score with the [scoring key](#scoring-key).

### Q-ECE-101 · Data Modeling · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** create index `library` (1 shard, 0 replicas, `dynamic: strict`): `title` as `text` with the `english` analyzer and a `keyword` multi-field `raw`; `isbn` as `keyword`; `pages` as `short`; `published` as `date`; `authors` as `nested` with `name` (`keyword`) and `born` (`integer`). Index one book with two authors and query it so that a name and a birth year must belong to the same author.
<details><summary>Answer</summary>

```json
PUT /library
{ "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": { "dynamic": "strict", "properties": {
    "title": { "type": "text", "analyzer": "english", "fields": { "raw": { "type": "keyword" } } },
    "isbn": { "type": "keyword" }, "pages": { "type": "short" }, "published": { "type": "date" },
    "authors": { "type": "nested", "properties": { "name": { "type": "keyword" }, "born": { "type": "integer" } } } } } }
```

**Checks (7 points).**

1. (3) `GET /library/_mapping` shows all types, the analyzer, `raw`, `nested` and `dynamic: strict`.
2. (2) With authors `{ "name": "Ada", "born": 1815 }` and `{ "name": "Alan", "born": 1912 }`, a `nested` query on `name: Ada` and `born: 1912` returns 0 hits, and `name: Ada` with `born: 1815` returns 1.
3. (2) Indexing `{ "isbn": "1", "colour": "red" }` is rejected with `strict_dynamic_mapping_exception`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-101`.

- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#42-nested), https://www.elastic.co/docs/manage-data/data-store/mapping

</details>

### Q-ECE-102 · Data Modeling · difficulty 2 · hands-on

**Starting state:** an empty cluster.

**Task:** with a component template `app-settings` (1 shard, 0 replicas) and an index template `app-metrics` for `app-metrics-*` at priority 300, make new indices map strings whose name ends in `_code` as `keyword`, and every `labels.*` string as `keyword` with `ignore_above` 1024. Prove it with the simulate API and with one indexed document.
<details><summary>Answer</summary>

```json
PUT _component_template/app-settings
{ "template": { "settings": { "number_of_shards": 1, "number_of_replicas": 0 } } }

PUT _index_template/app-metrics
{ "index_patterns": ["app-metrics-*"], "composed_of": ["app-settings"], "priority": 300,
  "template": { "mappings": { "dynamic_templates": [
    { "codes": { "match_mapping_type": "string", "match": "*_code", "mapping": { "type": "keyword" } } },
    { "labels": { "path_match": "labels.*", "mapping": { "type": "keyword", "ignore_above": 1024 } } } ] } } }
```

**Checks (8 points).**

1. (2) `PUT` of both templates is acknowledged and the template is retrievable.
2. (3) `POST _index_template/_simulate_index/app-metrics-test` shows 1 shard, 0 replicas and both dynamic templates.
3. (3) After indexing `{ "country_code": "CZ", "labels": { "env": "prod" }, "note": "x" }` into `app-metrics-2026.11`, the mapping has `country_code: keyword`, `labels.env: keyword` with `ignore_above: 1024`, and `note: text` plus `note.keyword`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-102`.

- Ref: [modules/03-mappings-field-types-and-templates.md](../modules/03-mappings-field-types-and-templates.md#72-dynamic-templates), https://www.elastic.co/docs/manage-data/data-store/mapping/dynamic-templates

</details>

### Q-ECE-103 · Search · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** (a) rank products for `office` over `name` (boost 3) and `description` with `best_fields` and a `tie_breaker` of 0.3; (b) return products released in 2026 that have at least one tag; (c) find the product whose `name` contains `keyboard mouse` as a phrase with one position of slack.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "query": { "multi_match": { "query": "office", "fields": ["name^3", "description"], "type": "best_fields", "tie_breaker": 0.3 } } }

GET /products/_search
{ "query": { "bool": { "filter": [ { "range": { "released": { "gte": "2026-01-01", "lt": "2027-01-01" } } }, { "exists": { "field": "tags" } } ] } } }

GET /products/_search
{ "query": { "match_phrase": { "name": { "query": "keyboard mouse", "slop": 1 } } } }
```

**Checks (9 points).**

1. (3) Ranking returns `p4`, `p2`, `p5` in this order (title match times 3 first; between the other two the shorter description wins).
2. (3) Filter returns `p2`, `p3`, `p5` (any order); `p6` has no tags and `p7` was released in 2025.
3. (3) Phrase returns `p5` only: `and` is removed by the `english` analyzer but leaves a position gap that the slop covers.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-103`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/05-query-dsl.md](../modules/05-query-dsl.md#23-multi_match-types), [phrase and slop](../modules/05-query-dsl.md#22-match_phrase-and-slop), https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query

</details>

### Q-ECE-104 · Search · difficulty 3 · hands-on

**Starting state:** the employees dataset.

**Task:** create the lookup index `languages_lookup` (`index.mode: lookup`, fields `languages` as `integer` and `language_name` as `keyword`) with the rows 1 English, 2 Czech, 2 Slovak, 3 German. With ES|QL, join the employees to it on `languages` showing `emp_no`, `languages` and `language_name`, and count the occurrences of every skill across employees.
<details><summary>Answer</summary>

```esql
FROM employees
| KEEP emp_no, languages
| LOOKUP JOIN languages_lookup ON languages
| SORT emp_no, language_name

FROM employees
| MV_EXPAND skills
| STATS n = COUNT(*) BY skills
| SORT n DESC, skills
| LIMIT 2
```

**Checks (9 points).**

1. (2) Creating `languages_lookup` with `"settings": { "index.mode": "lookup" }` succeeds; a join against a normal index is rejected.
2. (4) The join returns 7 rows: `[1,2,Czech]`, `[1,2,Slovak]`, `[2,3,German]`, `[3,1,English]`, `[4,null,null]`, `[5,2,Czech]`, `[5,2,Slovak]`. It is a left join: Tomas (NULL key) is kept; language 2 matches two lookup rows, so Jana and Lucie appear twice.
3. (3) The second query returns `[3,"java"]` and `[1,"k8s"]`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-104`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/06-esql.md](../modules/06-esql.md#46-lookup-join), [multi-valued fields](../modules/06-esql.md#34-multi-valued-fields), https://www.elastic.co/docs/reference/query-languages/esql

</details>

### Q-ECE-105 · Aggregations · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** with no hits returned, compute per `category` the document count and average `price`, and over all products the number of distinct `tags`.
<details><summary>Answer</summary>

```json
GET /products/_search
{ "size": 0, "aggs": {
  "cats": { "terms": { "field": "category" }, "aggs": { "avg_price": { "avg": { "field": "price" } } } },
  "tag_count": { "cardinality": { "field": "tags" } } } }
```

**Checks (7 points).**

1. (4) Buckets: `accessories` 2 (avg 35.0), `bundles` 1 (90.0), `keyboards` 2 (90.0), `mice` 2 (47.5).
2. (2) `tag_count.value` is 4 (`usb`, `rgb`, `bluetooth`, `ergonomic`).
3. (1) `hits.hits` is empty because of `size: 0`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-105`.

- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#1-families-and-the-request-shape), https://www.elastic.co/docs/reference/aggregations/search-aggregations-metrics-cardinality-aggregation

</details>

### Q-ECE-106 · Aggregations · difficulty 3 · hands-on

**Starting state:** the logs-web dataset.

**Task:** over `logs-web-*` return, per `host`, the number of documents with `status` of 500 or more and the sum of `bytes`, plus the total of those sums over all hosts as a pipeline aggregation.
<details><summary>Answer</summary>

```json
GET /logs-web-*/_search
{ "size": 0, "aggs": {
  "by_host": { "terms": { "field": "host" }, "aggs": {
    "errors": { "filter": { "range": { "status": { "gte": 500 } } } },
    "bytes": { "sum": { "field": "bytes" } } } },
  "total_bytes": { "sum_bucket": { "buckets_path": "by_host>bytes" } } } }
```

**Checks (7 points).**

1. (3) `web-1`: `doc_count` 3, `errors.doc_count` 1, `bytes.value` 2000.0.
2. (2) `web-2`: `doc_count` 1, `errors.doc_count` 1, `bytes.value` 0.0.
3. (2) `total_bytes.value` is 2000.0; the `buckets_path` addresses the metric through the parent bucket aggregation with `>`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-106`.

- Ref: [modules/07-aggregations.md](../modules/07-aggregations.md#7-structural-aggregations), https://www.elastic.co/docs/reference/aggregations/search-aggregations-pipeline-sum-bucket-aggregation

</details>

### Q-ECE-107 · Data Processing · difficulty 2 · hands-on

**Starting state:** the products dataset.

**Task:** create an ingest pipeline `to-v3` that sets `schema` to `v3` and computes `price_czk` as `price × 25` with a Painless script. Test it with the simulate API, create `products-v3` with the same mapping and reindex `products` into it through the pipeline.
<details><summary>Answer</summary>

```json
PUT _ingest/pipeline/to-v3
{ "processors": [ { "set": { "field": "schema", "value": "v3" } },
                  { "script": { "source": "ctx.price_czk = ctx.price * 25" } } ] }

POST _reindex
{ "source": { "index": "products" }, "dest": { "index": "products-v3", "pipeline": "to-v3" } }
```

**Checks (8 points).**

1. (2) `POST _ingest/pipeline/to-v3/_simulate` with a product of price 120 returns `price_czk` 3000 and `schema` `v3`.
2. (2) `products-v3` was created before the reindex and has the products mapping.
3. (2) The reindex response reports `total` 7, `created` 7 and no failures.
4. (2) In `products-v3`, `p4` has `price_czk` 375 and `p6` has 1125; all seven documents carry `schema: "v3"`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-107`.

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#14-painless-essentials), [reindex](../modules/08-ingest-pipelines-and-data-lifecycle.md#31-_reindex), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reindex-indices

</details>

### Q-ECE-108 · Data Processing · difficulty 3 · hands-on

**Starting state:** `products-copy`, a reindexed copy of the products dataset.

**Task:** add 10 to the `price` of all products of category `mice` with a parameterised script, skipping version conflicts; then delete every product that is not in stock.
<details><summary>Answer</summary>

```json
POST /products-copy/_update_by_query?conflicts=proceed&refresh=true
{ "query": { "term": { "category": "mice" } },
  "script": { "source": "ctx._source.price += params.delta", "params": { "delta": 10 } } }

POST /products-copy/_delete_by_query?conflicts=proceed&refresh=true
{ "query": { "term": { "in_stock": false } } }
```

**Checks (8 points).**

1. (3) The first response has `updated` 2 and `version_conflicts` 0; `p3` now costs 90 and `p4` 25; other prices are unchanged.
2. (3) The second response has `deleted` 2 (`p3` and `p7`, which are out of stock); `GET /products-copy/_count` returns 5.
3. (2) The script uses `params`, not a literal `10` in the source.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-108`.

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#32-_update_by_query-and-_delete_by_query), https://www.elastic.co/docs/reference/elasticsearch/rest-apis/update-by-query-api

</details>

### Q-ECE-109 · Distributed Datastore · difficulty 3 · hands-on

**Starting state:** an empty cluster.

**Task:** create `events` with 3 primaries and 0 replicas, refresh disabled and explicit request-level translog durability, for a bulk load. Bulk-load six documents `{ "r": "a" }` (three of them) and `{ "r": "b" }` (three) with the routing equal to `r`. Make them searchable, query only routing `a` touching a single shard, then restore the production settings (default refresh interval, one replica).
<details><summary>Answer</summary>

```json
PUT /events
{ "settings": { "number_of_shards": 3, "number_of_replicas": 0, "refresh_interval": "-1", "index.translog.durability": "request" } }

POST /events/_bulk
{"index":{"routing":"a"}}
{"r":"a"}
{"index":{"routing":"a"}}
{"r":"a"}
{"index":{"routing":"a"}}
{"r":"a"}
{"index":{"routing":"b"}}
{"r":"b"}
{"index":{"routing":"b"}}
{"r":"b"}
{"index":{"routing":"b"}}
{"r":"b"}

POST /events/_refresh
GET /events/_search?routing=a { "query": { "term": { "r": "a" } } }

PUT /events/_settings { "refresh_interval": null, "number_of_replicas": 1 }
```

**Checks (10 points).**

1. (3) `GET /events/_settings` shows 3 shards, 0 replicas, `refresh_interval` `-1` and durability `request` before the load.
2. (2) The bulk response has `errors: false` and six `created` items; the body ended with a newline.
3. (3) Before `_refresh` a search returns 0 hits; after it, the routed search returns 3 hits and `_shards.total` is 1.
4. (2) After restoring, `refresh_interval` is no longer set (default 1s) and `number_of_replicas` is 1 (cluster health is yellow on a single node, green with two or more nodes).

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-109`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/02-cluster-architecture-and-near-real-time-search.md](../modules/02-cluster-architecture-and-near-real-time-search.md#7-production-failure-modes), [custom routing](../modules/10-scaling-sharding-and-multi-cluster.md#2-custom-routing), https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/indexing-speed

</details>

### Q-ECE-110 · Data Management · difficulty 3 · hands-on

**Starting state:** an empty single-node cluster.

**Task:** create ILM policy `shop-policy` (hot: rollover at `max_age` 7d or `max_primary_shard_size` 50gb; delete: after 30d), an index template for `logs-shop-*` with `data_stream: {}` that uses the policy (1 shard, 0 replicas), create the stream `logs-shop-prod` by indexing two documents, roll it over by hand, and inspect the lifecycle state of the current write index.
<details><summary>Answer</summary>

```json
PUT _ilm/policy/shop-policy
{ "policy": { "phases": {
  "hot": { "actions": { "rollover": { "max_age": "7d", "max_primary_shard_size": "50gb" } } },
  "delete": { "min_age": "30d", "actions": { "delete": {} } } } } }

PUT _index_template/logs-shop
{ "index_patterns": ["logs-shop-*"], "data_stream": {}, "priority": 200,
  "template": { "settings": { "number_of_shards": 1, "number_of_replicas": 0, "index.lifecycle.name": "shop-policy" } } }

POST /logs-shop-prod/_doc { "@timestamp": "2026-11-04T10:00:00Z", "msg": "one" }
POST /logs-shop-prod/_doc { "@timestamp": "2026-11-04T10:01:00Z", "msg": "two" }
POST /logs-shop-prod/_rollover
```

**Checks (13 points).**

1. (3) `GET _ilm/policy/shop-policy` shows both phases and the three conditions/actions.
2. (3) The template is stored with `data_stream` and the lifecycle setting; `_simulate_index` on a matching name shows `index.lifecycle.name: shop-policy`.
3. (2) After the two documents the stream exists with one backing index `.ds-logs-shop-prod-<date>-000001`.
4. (2) After `_rollover` there are two backing indices; the response shows `rolled_over: true` and `new_index` ending in `-000002`.
5. (3) `GET .ds-logs-shop-prod-*-000002/_ilm/explain` reports `managed: true`, `policy: "shop-policy"` and `phase: "hot"`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-110`.

- Ref: [modules/08-ingest-pipelines-and-data-lifecycle.md](../modules/08-ingest-pipelines-and-data-lifecycle.md#5-index-lifecycle-management-ilm), [data streams](../modules/08-ingest-pipelines-and-data-lifecycle.md#4-data-streams), https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management/configure-lifecycle-policy

</details>

### Q-ECE-111 · Cluster Management · difficulty 3 · hands-on

**Starting state:** a cluster with security enabled.

**Task:** create a role `log_writer` and an API key `ingest-service` (expiration 30 days) that may only append to and create data streams matching `logs-app-*`. Prove with the key that it can append, but cannot read or delete; then revoke it.
<details><summary>Answer</summary>

```json
POST /_security/api_key
{ "name": "ingest-service", "expiration": "30d",
  "role_descriptors": { "log_writer": { "indices": [
    { "names": ["logs-app-*"], "privileges": ["create_doc", "auto_configure"] } ] } } }

DELETE /_security/api_key
{ "name": "ingest-service" }
```

Use the returned `encoded` value as `Authorization: ApiKey <encoded>`.

**Checks (7 points).**

1. (2) The key is created with an `id`, `api_key` and `encoded` value and an `expiration` timestamp.
2. (2) `POST /logs-app-default/_doc { "@timestamp": "2026-11-04T10:00:00Z", "m": "x" }` with the key returns 201 (a template for `logs-app-*` with `data_stream` exists).
3. (2) `GET /logs-app-default/_search` and `DELETE /logs-app-default/_doc/<id>` with the key return 403 `security_exception`.
4. (1) After the revocation, the key returns 401.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-111`.

- Ref: [modules/11-operations-security-and-upgrades.md](../modules/11-operations-security-and-upgrades.md#52-roles-users-and-api-keys), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key

</details>

### Q-ECE-112 · Cluster Management · difficulty 3 · hands-on

**Starting state:** a single-node cluster without any custom node attribute.

**Task:** someone ran `PUT /stuck { "settings": { "number_of_replicas": 0, "index.routing.allocation.require.box_type": "warm" } }`. Diagnose why the index is not green, using the allocator's explanation, and repair it without deleting the index.
<details><summary>Answer</summary>

```json
GET _cluster/health/stuck
GET _cat/shards/stuck?v&h=index,shard,prirep,state,unassigned.reason
GET _cluster/allocation/explain
{ "index": "stuck", "shard": 0, "primary": true }

PUT /stuck/_settings
{ "index.routing.allocation.require.box_type": null }
```

**Checks (7 points).**

1. (2) `_cluster/health/stuck` is `red`: the primary is unassigned.
2. (3) The explanation shows the decision `NO` from the `filter` decider (the node does not match the `require` filter `box_type: warm`).
3. (2) After removing the setting, `GET _cluster/health/stuck?wait_for_status=green` returns `green`.

Verification script: [`examples/integration/exam-mock.itest.ts`](../examples/integration/exam-mock.itest.ts), test `Q-ECE-112`. Offline proof of the deterministic criteria: [`examples/13-exam-reference-answers.test.ts`](../examples/13-exam-reference-answers.test.ts).

- Ref: [modules/10-scaling-sharding-and-multi-cluster.md](../modules/10-scaling-sharding-and-multi-cluster.md#42-allocation-filtering), [diagnosis loop](../modules/11-operations-security-and-upgrades.md#11-the-diagnosis-loop), https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-cluster-allocation-explain

</details>

### Scoring Key

| Task      | Domain                   | Points  | Time budget |
| --------- | ------------------------ | ------- | ----------- |
| Q-ECE-101 | D1 Data Modeling         | 7       | 15 min      |
| Q-ECE-102 | D1 Data Modeling         | 8       | 15 min      |
| Q-ECE-103 | D2 Search                | 9       | 15 min      |
| Q-ECE-104 | D2 Search                | 9       | 15 min      |
| Q-ECE-105 | D3 Aggregations          | 7       | 15 min      |
| Q-ECE-106 | D3 Aggregations          | 7       | 15 min      |
| Q-ECE-107 | D4 Data Processing       | 8       | 15 min      |
| Q-ECE-108 | D4 Data Processing       | 8       | 15 min      |
| Q-ECE-109 | D5 Distributed Datastore | 10      | 15 min      |
| Q-ECE-110 | D6 Data Management       | 13      | 15 min      |
| Q-ECE-111 | D7 Cluster Management    | 7       | 15 min      |
| Q-ECE-112 | D7 Cluster Management    | 7       | 15 min      |
| **Total** |                          | **100** | **180 min** |

**Rules.**

- Each task lists numbered checks with points; a check scores in full when the observable result matches, otherwise 0. A check that depends on an earlier one that you failed is still scored if its own result is correct.
- Partial credit is per check only; there are no fractions of a check and no penalties for extra requests, except that a destructive action on data outside the task (deleting a dataset index, for example) forfeits the task.
- Pass mark: **70 points** (practice threshold, since the real passing score is unpublished). A domain below 50% of its points is a weak area to revise, whatever the total.
- Domain points: D1 15, D2 18, D3 14, D4 16, D5 10, D6 13, D7 14, which mirrors the weights in [`README.md`](README.md) §1.2.
- **Exam delta:** the mock tasks work unchanged on 9.3 and 9.5. On a 9.3 cluster there is no `frozen_after`, no columnar index mode and no ES|QL Views or PromQL; none is needed here.
