# Module 03: Advanced RAG Patterns

First-stage hybrid retrieval optimizes **recall** over millions of chunks in `< 20 ms`, but bi-encoders compress an entire passage into a single vector and treat queries literally. Production accuracy stalls unless retrieval addresses three structural limits: (1) single-vector compression loses fine token-level interactions (**Reranking** & **Small-to-Big**), (2) queries are underspecified or multi-hop (**Query Rewriting**, **Decomposition**, **HyDE**, **Agentic RAG**), and (3) dumping noisy top-20 chunks degrades synthesis (**Lost-in-the-Middle** & **Context Compression**, or global synthesis via **GraphRAG**).

---

## 1. Two-Stage Reranking: Cross-Encoders & ColBERT Late Interaction

Bi-encoders score $q$ and $d$ independently ($O(1)$ dot product at query time), preventing query tokens from attending directly to document tokens. Two-stage retrieval preserves speed by retrieving top-`150` candidates via hybrid search and rescoring only those `150` down to top-`8–20`:

1. **Cross-Encoder Reranking**: Concatenates `[CLS] query [SEP] doc [SEP]` through full self-attention layers, outputting a calibrated relevance logit. Because every pair requires a forward pass, latency scales linearly with candidate count ($O(K)$ passes, typically `50–250 ms` for `100` chunks).
2. **ColBERT Late Interaction (MaxSim)** (Khattab & Zaharia, `arXiv:2004.12832`; v2 `arXiv:2112.01488`): Computes contextualized per-token vectors offline for documents ($E_d \in \mathbb{R}^{|d| \times d_{\text{tok}}}$) and scores query-document relevance via summed maximum inner products:

$$S(q, d) = \sum_{i \in q} \max_{j \in d} \left( E_{q_i} \cdot E_{d_j}^\top \right)$$

| Architecture | Query–Doc Token Interaction | Query-Time Compute | Storage Footprint | Best Role |
| :-- | :-- | :-- | :-- | :-- |
| **Dense Bi-Encoder** | None (single pooled vector) | Very low (ANN dot product) | `1×` vector per chunk | Stage 1 broad candidate generation |
| **ColBERT v2 (MaxSim)** | Token-level max similarity | Low–Moderate (matrix multiply) | High (`N_tok × 128` compressed) | Fast Stage 2 reranker or mid-scale primary index |
| **Cross-Encoder** | Full deep cross-attention | High ($K$ joint passes) | `0` extra index bytes | Precision Stage 2 filter (`top-150 → top-10`) |

---

## 2. Small-to-Big Retrieval: Parent-Document & Sentence-Window

Dense embeddings degrade when a `1,200`-token chunk covers four subtopics (mean pooling dilutes signal). **Small-to-Big Retrieval** separates the **unit of indexing** from the **unit of generation**:

- **Parent-Document Retrieval**: Index fine-grained child chunks (`128–256` tokens) storing `parent_id`; at retrieval time, deduplicate and fetch the full `1,024`-token parent section (or sibling table) for the LLM.
- **Sentence-Window Expansion**: Embed single sentences for razor-sharp matching, then inject $\pm W$ surrounding sentences (`W = 2–3`) before generation so pronouns and caveats remain intact.

---

## 3. GraphRAG: Entity Graphs, Leiden Communities & Global Queries

Vector similarity fails on **global sensemaking** questions (`"What are the top 5 recurring compliance risks across all 4,000 incident postmortems?"`) because no single chunk contains the aggregate answer. **GraphRAG** (Edge et al., `arXiv:2404.16130`, v2 2025-02-19; Microsoft `graphrag` `3.3.0`, in maintenance mode since 2025) solves global queries through hierarchical community summarization:

```mermaid
flowchart LR
  Docs["Source Documents"] --> Extract["LLM Entity & Relation Extraction"]
  Extract --> KG["Knowledge Graph (Entities + Edges)"]
  KG --> Leiden["Hierarchical Leiden Community Detection"]
  Leiden --> Sum["Offline Community Summaries (C0..Ck)"]
  Sum --> Map["Online Map: Score & Partial Answers"]
  Map --> Reduce["Reduce: Synthesize Global Response"]
```

- **Local Search**: Starts from query-matched entities and traverses 1–2 graph hops plus linked text units for multi-hop entity questions.
- **Global Search**: Runs parallel map-reduce across pre-generated **Leiden community summaries** at a chosen hierarchy level, trading high indexing LLM token cost for comprehensive corpus-wide synthesis.
- **Operational Trade-Off**: Full LLM entity extraction across large corpora incurs steep indexing spend and re-index churn; reserve GraphRAG for corpora dominated by cross-document multi-hop reasoning or global thematic synthesis, or adopt lighter-weight incremental graph updates.

---

## 4. Lost-in-the-Middle & Context Compression

Liu et al. (`arXiv:2307.03172`) demonstrated a U-shaped attention recall curve in long-context models: evidence placed at the **beginning** (primacy) and **end** (recency) of the retrieved context is utilized reliably, whereas relevant passages buried in the **middle** suffer sharp accuracy drops even well inside nominal window limits.

Two architectural defenses follow directly:

1. **U-Shaped Reordering**: Place top-1 and top-2 reranked passages at the start and end of `<retrieved_context>`, pushing lower-confidence passages to the center — or prune aggressively to the minimal sufficient set (`5–8` passages).
2. **Context Compression**: Apply extractive sentence-level filtering (cross-encoder sentence scorer) or token-level perplexity pruning (**LLMLingua**-style) to strip boilerplate and off-topic filler before feeding context to an expensive frontier generator.

---

## 5. Query Rewriting, Decomposition, HyDE & Agentic RAG

User queries in conversational apps are often ambiguous, terse, or multi-part. Transforming the query before hitting the index unlocks recall without altering stored documents:

| Pattern | Mechanism | Target Failure Mode | Latency / Cost Delta |
| :-- | :-- | :-- | :-- |
| **Coreference Rewriting** | Condenses chat history + `"How do I cancel it?"` into standalone `"How do I cancel Acme Pro annual billing?"` | Conversational pronouns fail stateless retrieval | `+1` fast LLM call (`~100–200 ms`) |
| **MultiQuery Expansion** | Generates `3–5` paraphrased sub-queries, runs parallel hybrid searches, merges via RRF | Single phrasing misses domain synonyms | `3–5×` retrieval queries (parallelized) |
| **Step-Back Prompting** | Abstracts a specific question (`"Why did Pod X fail with 137?"`) to a higher-level principle (`"Kubernetes OOMKilled exit 137 causes"`) and retrieves both | Specific queries miss foundational troubleshooting docs | `+1` LLM call + parallel search |
| **Least-to-Most Decomposition** | Breaks multi-hop queries (`arXiv:2205.10625`) into ordered sub-questions where answer $i$ informs query $i+1$ | Multi-hop comparison/dependency questions | Sequential retrieval hops (`2–4×` latency) |
| **HyDE (Hypothetical Doc Embeddings)** | (Gao et al., `arXiv:2212.10496`) Prompts LLM to draft a hypothetical answer $z$, embeds $z$, and searches real corpus ($p(y\|x) \approx \sum_z p(y\|z) p(z\|x)$) | Zero-shot vocabulary mismatch between terse questions and formal technical prose | `+1` generation + embed; risk of hallucinated terms steering retrieval off-domain |
| **Agentic RAG** | (`arXiv:2501.09136`) Iterative `retrieve → reflect → refine` loop with tool-routing across vector/SQL/graph/web tools and Corrective RAG fallback | Ambiguous or low-confidence first-pass results | Unbounded unless wrapped in step/cost caps (Module 04) |

---

## 6. Case Study: Diagnosing Silent RAG Failure Modes in a Technical Docs Copilot

A developer-platform RAG copilot reported `0.89` synthetic answer fluency yet users downvoted `38%` of multi-step troubleshooting answers. Tracing failed queries revealed three compounding advanced-RAG failures:

1. **Middle-Context Dropoff**: Feeding `25` raw chunks (`~14k` tokens) pushed the critical Kubernetes RBAC snippet into chunk #13, which the generator ignored (**Lost-in-the-Middle**). Adding a Cross-Encoder reranker (`top-120 → top-6`) + U-shaped placement raised answer accuracy by `+19` points and cut input tokens by `72%`.
2. **Comparison Query Blindness**: Questions like `"Compare latency limits of Region A vs Region B"` retrieved only `Region A` chunks because top-$K$ saturated on one entity. Adding **Query Decomposition** split comparison queries into independent per-entity sub-searches fused prior to generation.
3. **HyDE Hallucination on Proprietary Flags**: Applying HyDE indiscriminately to internal CLI flags caused the synthetic document to invent plausible-sounding nonexistent flags (`--force-sync`), pulling wrong chunks; restricting HyDE exclusively to conceptual prose queries while routing CLI/error queries to BM25+RRF eliminated the regression.

---

## Interview Drill

### Question 1: Compare Cross-Encoder reranking and ColBERT MaxSim late interaction on latency, memory, and accuracy.

<details><summary>Answer</summary>

Cross-Encoders run full joint self-attention across `[query; doc]`, achieving the highest interaction fidelity at the cost of $O(K)$ forward passes at query time (`50–250 ms` for `100` candidates) and zero extra index storage. ColBERT precomputes per-token document embeddings offline and computes $S(q,d) = \sum_{i \in q} \max_{j \in d} E_{q_i} \cdot E_{d_j}^\top$, delivering near-cross-encoder accuracy at much lower query latency in exchange for storing per-token vector matrices.

</details>

### Question 2: Why does Small-to-Big (Parent-Document) retrieval improve both recall and generation quality?

<details><summary>Answer</summary>

Embedding small child spans (`128–256` tokens) avoids semantic dilution across multiple subtopics, producing sharp similarity signals for retrieval. Expanding matched children back to their `1,024+`-token parent section at generation time restores surrounding definitions, tables, and caveats so the LLM does not hallucinate missing context.

</details>

### Question 3: When should an engineering team build GraphRAG instead of relying on hybrid vector + BM25 search?

<details><summary>Answer</summary>

Hybrid vector + BM25 excels at localized fact lookup, but fails at global sensemaking queries requiring aggregation across an entire corpus (e.g., dominant themes across thousands of reports) and dense multi-hop entity joins. GraphRAG extracts entities into a knowledge graph, clusters them into hierarchical Leiden communities, and answers global queries via map-reduce over precomputed community summaries, justifying its higher indexing cost on those workloads.

</details>

### Question 4: How does the "Lost-in-the-Middle" phenomenon influence RAG prompt layout and context compression?

<details><summary>Answer</summary>

Empirical studies (`arXiv:2307.03172`) show LLMs attend most strongly to the beginning and end of long context inputs while missing facts placed in the middle. Teams mitigate this by reranking aggressively to `5–8` high-signal passages, compressing out irrelevant sentences, and ordering the highest-scoring evidence at the start and end of the retrieved context block.

</details>

### Question 5: When does HyDE hurt retrieval quality instead of helping?

<details><summary>Answer</summary>

HyDE bridges vocabulary gaps on conceptual natural-language queries by embedding a synthetic answer, but on proprietary APIs, exact error codes, or recent internal releases missing from pretraining weights, the synthetic document fabricates non-existent identifiers and steers dense retrieval toward false-positive neighbors. In those domains, lexical BM25 + RRF without HyDE outperforms.

</details>
