# AI Engineering Cheatsheet

High-density reference for LLM sampling and contracts, the 16 RAG pipeline patterns, bounded agent harnesses, the 8 operational agent metrics, MCP 2026-07-28, OTel GenAI telemetry, and the 8-layer AI security stack.

## 1. LLM Sampling, Context & Structured Output Rules

| Parameter / Control | Mechanism | Production Guidance |
| :-- | :-- | :-- |
| **Temperature ($T$)** | Divides pre-softmax logits $z_i / T$ | Use `0.0–0.2` for extraction/tool calling; `T = 0` is NOT bit-deterministic under dynamic batching (`FP16`/`BF16`) or MoE routing. |
| **Top-$p$ (Nucleus)** | Smallest token set whose cumulative probability $\ge p$ | Tune `temperature` OR `top_p` (not both aggressively); default `top_p = 0.9–1.0`. |
| **Min-$p$** | Keeps tokens with $P(w) \ge p_{\min} \cdot P_{\max}$ | Scales threshold dynamically with model certainty; prevents low-probability tail garbage at high $T$. |
| **Context Engineering** | `Query → Assemble & Budget → LLM → Response` | Order prompt prefixes strictly **static → volatile** (system rules → tool defs → shared docs → memory → user input) to maximize GPU prefix-cache hits (`50%–90%` cost cut). |
| **Structured Outputs** | JSON Schema → CFG → Pushdown Automaton → Token Mask | Guarantees **syntax only** on completed, non-refusal outputs; always inspect `finish_reason` (`stop` vs `length` vs `refusal`) and validate numeric bounds + invariants in code. |

## 2. End-to-End RAG Pipeline & 16 Core Patterns

Pipeline stages: `Ingest → Chunk → Embed → Store → Retrieve → Generate → Evaluate`

| # | Pattern / Stage | Mechanism & Formula | Key Pitfall / Control |
| :-: | :-- | :-- | :-- |
| 1 | **Fixed / Recursive Chunking** | `200–800` tokens, `10%–20%` overlap along hierarchy (`\n\n` → `\n` → `.`) | Too small loses context; too large dilutes vector cosine signal. |
| 2 | **Structure-Aware Chunking** | Splits on Markdown headings, AST functions, HTML/PDF tables | Preserves code blocks and table row integrity without mid-row cuts. |
| 3 | **Semantic Chunking** | Breaks where adjacent sentence-embedding cosine similarity dips | Higher ingest cost; sensitive to topic-shift threshold tuning. |
| 4 | **Contextual Retrieval** | Prepends `50–100` LLM summary tokens to chunk before embed + BM25 | Cuts retrieval failure rate by `35%` (`49%` w/ BM25, `67%` w/ rerank). |
| 5 | **MRL Embeddings** | Nested prefix loss $\mathcal{L} = \sum_m c_m \mathcal{L}(f(x)_{1:m}; y)$ | Truncate to `768`/`1536` (`gemini-embedding-2` auto-normalizes; `-001` requires manual L2 norm). |
| 6 | **Metadata Pre-Filtering** | Partition by `tenantId`/`acl` before ANN graph traversal | Mandatory for multi-tenant ACL isolation; never filter security ACLs post-ANN. |
| 7 | **Post-Filter Selectivity Trap** | Fetch top-$K$ ANN globally, then apply relational filter | At `1%` selectivity, top-100 ANN yields `~1` surviving match → recall collapses. |
| 8 | **Filter Pushdown (HNSW)** | Evaluates bitset predicates inside HNSW traversal | Avoids post-filter starvation while preserving graph connectivity above `~1%` selectivity. |
| 9 | **Hybrid Search + RRF** | BM25 lexical + dense cosine fused via $\sum_r \frac{1}{k + \text{rank}_r(d)}$ ($k=60$) | Captures exact error codes/SKUs (BM25) + paraphrases (dense) without score calibration. |
| 10 | **Cross-Encoder Reranking** | Joint attention over `(query, doc)` on top-`150` → top-`20` | Too slow for corpus-wide search; ideal as Stage 2 precision filter. |
| 11 | **ColBERT MaxSim** | $S(q,d) = \sum_{i \in q} \max_{j \in d} E_{q_i} \cdot E_{d_j}^\top$ | Precomputes token vectors offline; faster than cross-encoder, heavier storage. |
| 12 | **Small-to-Big Retrieval** | Embed small child chunks (`128–256` tok); return parent span (`1024+` tok) | Decouples sharp embedding matching from rich LLM synthesis context. |
| 13 | **GraphRAG** | Entity graph → Leiden communities → community summaries → map-reduce | Excels on corpus-wide global sensemaking; costly index build (MS GraphRAG 3.3.0 in maintenance mode). |
| 14 | **Context Compression** | Extractive pruning / token compression (`Lost in the Middle` mitigation) | Place highest-relevance evidence at start and end of context window. |
| 15 | **Query Rewriting & Decomp.** | MultiQuery expansion, step-back prompting, least-to-most sub-questions | Resolves coreferences (`"it"`) and multi-hop queries before retrieval. |
| 16 | **HyDE & Agentic RAG** | HyDE embeds synthetic doc $z$; Agentic loops `retrieve → reflect → refine` | HyDE bridges vocabulary mismatch; Agentic RAG adds latency, requiring strict loop caps. |

## 3. Agent Harness, Loop & 8 Operational Metrics

Harness flow: `User Goal → Harness (Sandbox, Budgets, Policy) → Agent Loop (Plan → Act → Observe → Learn) → Tools + Resources → Output`

| # | Metric | Exact Formula | Operational Target / Alert |
| :-: | :-- | :-- | :-- |
| 1 | **Task Success Rate** | $\text{successful tasks} / \text{total tasks}$ | Track by task tier against golden rubric (`>= 85%` prod gate). |
| 2 | **Tool Accuracy** | $\text{correct tool calls} / \text{total tool calls}$ | Measure both tool name and schema-valid argument F1 (`>= 95%`). |
| 3 | **Steps Per Task** | $\frac{1}{N}\sum_{i=1}^{N} \text{steps}_i$ (track p50 / p95) | Cap $S_{\max}$ (`8–15`); alert on p95 upward drift or cycle hashes. |
| 4 | **Escalation Rate** | $\text{escalated to human} / \text{total tasks}$ | Must fit reviewer staffing capacity (`maxHitlQueueDepth`). |
| 5 | **Guardrail Hit Rate** | $\text{blocked or rewritten actions} / \text{total actions}$ | Slice by `policy_id` to detect active attacks vs. broken prompts. |
| 6 | **Override Rate** | $\text{human overrides} / \text{agent proposals}$ | Measures agent error + guardrail false-positive friction; feed back to golden evals. |
| 7 | **Cost Per Task** | $\frac{1}{N}\sum (T_{\text{in}} p_{\text{in}} + T_{\text{out}} p_{\text{out}} + N_{\text{tool}} p_{\text{tool}})$ | Enforce hard `maxCostUsd` per run and atomic tenant `RPM + TPM + USD` caps. |
| 8 | **Time to Resolve** | Wall-clock p50 / p90 from first turn to terminal state | Report autonomous execution latency separately from queued HITL wait time. |

## 4. MCP 2026-07-28 Protocol Quick Reference

- **Topology**: **Host** (policy, consent, $N$ clients) $\to$ **Client** (1:1 isolation) $\to$ **Server** (tools, resources, prompts). Servers never see full conversation or peer servers.
- **Wire Envelope**: Stateless JSON-RPC 2.0. Every request carries `_meta` with `io.modelcontextprotocol/protocolVersion` (required), `clientInfo`, `clientCapabilities` (required). Missing field $\to$ `-32602` + HTTP `400`.
- **Reserved Error Codes**: `-32020` `HeaderMismatch`, `-32021` `MissingRequiredClientCapability`, `-32022` `UnsupportedProtocolVersion`.
- **Multi-Round-Trip Requests (MRTR)**: Tool/request returns `resultType: "input_required"` + `requestState`; retry sends `inputResponses` + `requestState` with a **new** JSON-RPC `id`.
- **2026-07-28 Lifecycle**: Deprecated `sampling`, `roots`, `logging`; added `server/discover`, unified `subscriptions/listen`, caching (`ttlMs`, `cacheScope`). JSON Schema dialect defaults to `2020-12` (block remote `$ref` SSRF).

## 5. AI Security Stack (8 Layers)

| Layer | Control Surface | Primary Standards & Tools |
| :-: | :-- | :-- |
| **1. Red Teaming** | Automated adversarial probes across direct/indirect injection & tool abuse | Assert on **action traces**, maintain attack regression corpus |
| **2. Guardrails + Permissions** | Validator Sandwich (Top/Bottom Bun), least-privilege tool allow-lists, HITL | `OWASP LLM05` / `LLM06`, `OWASP ASI02` / `ASI03` |
| **3. Injection Detection** | Structural `<untrusted_data>` isolation + classifier screening | `OWASP LLM01`, `MITRE ATLAS AML.T0051.001` |
| **4. Model Scanning** | Static bytecode/opcode inspection before deserialization; prefer `safetensors` | `ModelScan 0.8.8` (exit `1` on findings), `torch.load(..., weights_only=True)` |
| **5. Secrets + ML-BOM** | Zero secrets in prompts/logs; signed model + dataset provenance | `CycloneDX 1.7` (`ECMA-424`), `modelCard` + `data` components |
| **6. Policy + Access** | Session-bound `tenantId`, ABAC/ReBAC ACL pre-filters, OPA/Cedar gates | `OWASP LLM02` / `LLM08`, `OWASP ASI03` |
| **7. Monitoring** | OTel GenAI spans (`invoke_agent → chat → execute_tool`), `NO_CONTENT` default | `OTEL_INSTRUMENTATION_GENAI_CAPTURE_CONTENT`, `AML.M0024` |
| **8. Governance Frameworks** | Risk mapping, continuous measurement, and compliance accountability | **OWASP LLM 2025/2026**, **OWASP Agentic 2026**, **NIST AI RMF 1.0 + 600-1**, **MITRE ATLAS v2026.11** |
