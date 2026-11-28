# AI Engineering & Security Dossier — verified 2026-11-28

## 0. Version snapshot

| Item | Version / date | Source |
| --- | --- | --- |
| MCP specification | **2026-07-28** | https://modelcontextprotocol.io/specification/latest |
| MCP TypeScript SDK | **1.32.2** | https://www.npmjs.com/package/@modelcontextprotocol/sdk |
| MCP Python SDK | **2.3.0** (v2 API, `MCPServer`, `Client`) | https://pypi.org/project/mcp/ · https://py.sdk.modelcontextprotocol.io/ |
| LangGraph (Python) | **1.2.24** | https://pypi.org/project/langgraph/ |
| LangGraph (JS) | **1.7.5** (`@langchain/langgraph`) | https://www.npmjs.com/package/@langchain/langgraph |
| Ragas | **0.4.4** (collections API; legacy API removed in 1.0) | https://pypi.org/project/ragas/ · https://docs.ragas.io/en/stable/ |
| GraphRAG (MS) | **3.3.0**, maintenance mode since 2025 | https://pypi.org/project/graphrag/ · https://microsoft.github.io/graphrag |
| OWASP LLM Top 10 | **2025** (current stable) + **2026** edition published | https://genai.owasp.org/llm-top-10/ · https://genai.owasp.org/top-10-for-llm-applications-2026/ |
| OWASP Agentic Top 10 | **2026** (ASI01–ASI10), PDF dated 2026-11 | https://genai.owasp.org/top-10-for-agentic-applications-2026/ |
| NIST AI RMF | **1.0**, NIST.AI.100-1, 2023-01-26 (under revision per 2026 action plan) | https://doi.org/10.6028/NIST.AI.100-1 |
| NIST GenAI Profile | **NIST.AI.600-1**, 2024-07-26 | https://doi.org/10.6028/NIST.AI.600-1 |
| MITRE ATLAS | content **v2026.11** (2026-11-27), data format **v6.2.0** | https://atlas.mitre.org/ · https://github.com/mitre-atlas/atlas-data |
| OpenTelemetry GenAI semconv | **Development** status, moved out of core semconv (core at v1.45.0) | https://github.com/open-telemetry/semantic-conventions-genai |
| CycloneDX | **1.7** (2025-10-21), ECMA-424 | https://cyclonedx.org/specification/overview/ |
| ModelScan | **0.8.8** (Python ≥3.10,<3.13) | https://pypi.org/project/modelscan/ |

## 1. MCP (2026-07-28) and LangGraph

### MCP protocol facts

- JSON-RPC 2.0, **stateless**: every request carries `_meta` with `io.modelcontextprotocol/protocolVersion` (required), `clientInfo`, `clientCapabilities` (required), `logLevel`. Missing required field → `-32602` + HTTP 400.
- Architecture: **host** (1 process, N clients, consent/security policy) → **client** (1:1 with one server) → **server** (resources, prompts, tools). Servers must not see full conversation or each other.
- Results carry `resultType`: `"complete"` | `"input_required"`; absent treated as `complete` (back-compat). `input_required` drives **MRTR** (multi round-trip requests) with `inputResponses` + `requestState`; the retry MUST use a new JSON-RPC `id`.
- Error codes: JSON-RPC `-32700…-32603`; MCP reserves `-32020` `HeaderMismatch`, `-32021` `MissingRequiredClientCapability`, `-32022` `UnsupportedProtocolVersion`; `-32000…-32019` legacy; `-32002` resource-not-found retired (clients SHOULD still accept).
- **Deprecated in 2026-07-28**: sampling, roots, logging. New: `server/discover`, unified `subscriptions/listen` (replaces `resources/subscribe`), caching (`ttlMs`, `cacheScope`), extensions (Tasks, Skills, MCP Apps).
- JSON Schema: default dialect **2020-12**; servers MUST NOT auto-dereference remote `$ref` (SSRF/DoS vector); bound schema depth for `anyOf`/`$defs`.
- Tools: `tools/list` (paginated, deterministic order for prompt-cache hits), `tools/call`; `inputSchema`/`outputSchema`; `structuredContent`; `isError: true` for model-recoverable execution errors; protocol errors for unknown tool/malformed request. Tool names 1–128 chars, `[A-Za-z0-9_.-]`. Annotations are **untrusted** unless server is trusted. `x-mcp-header` mirrors primitive params into `Mcp-Param-{Name}` (never for secrets).
- Resources/prompts: `resources/list`, `resources/templates/list`, `resources/read`; `prompts/list`, `prompts/get` (arguments → messages). Client feature: `elicitation/create` (form or URL mode).
- Spec is now **per-request state**, so stateful tools must return explicit opaque handles (validate authorization on every call, bounded lifetime).

### LangGraph stable API (1.x)

- Core: `StateGraph(State)` + typed channels/reducers, `add_node`, `add_edge`, `add_conditional_edges`, `START`/`END`, `compile(checkpointer=…)`.
- Control: `Command(goto=…, update=…)`, `Send(node, arg)` for map-reduce/fan-out, `interrupt()` + `Command(resume=…)` for HITL, `durability="exit"|"async"|"sync"`.
- Runtime model: **Pregel/BSP supersteps** (inspired by Pregel, Apache Beam); checkpointers for durable execution (`langgraph-checkpoint>=4.3.0`), `BaseStore` for long-term memory, `stream_mode` for tokens/updates/events.
- GraphRAG-style patterns map onto subgraphs + `Send`; LangChain agents are built on this runtime, `deepagents` is the harness layer above it.

## 2. RAG pipeline and advanced patterns

### Core formulas

BM25 (Robertson/Zaragoza): `score(D,Q) = Σ_{q∈Q} IDF(q) · f(q,D)(k₁+1) / (f(q,D) + k₁(1 − b + b·|D|/avgdl))`, `IDF(q) = ln(1 + (N − n(q) + 0.5)/(n(q) + 0.5))`, typical `k₁=1.2–2.0`, `b=0.75`.

RRF (Cormack, Clarke, Buettcher, SIGIR 2009, doi:10.1145/1571941.1572114): `RRF(d) = Σ_{r∈R} 1/(k + rank_r(d))`, `k=60`.

Matryoshka (MRL, Kusupati et al., arXiv:2205.13147): `L = Σ_{m∈M} c_m · L(f(x)_{1:m}; y)` — one embedding, nested prefixes valid at 128/256/768/1536/3072.

ColBERT late interaction (Khattab & Zaharia, arXiv:2004.12832; v2 arXiv:2112.01488): `S(q,d) = Σ_{i∈q} max_{j∈d} E_{q_i} · E_{d_j}ᵀ` — token-level MaxSim, precomputed document embeddings.

HyDE (Gao et al., arXiv:2212.10496): `p(y|x) ≈ Σ_{z} p(y|z)·p(z|x)`; generate a hypothetical document `z`, embed it, retrieve real documents — zero-shot dense retrieval, no relevance labels.

Ragas (docs verified):

- Faithfulness = supported claims / total claims in response.
- Context Recall = reference claims attributable to retrieved context / total reference claims.
- Context Precision@K = `Σ_{k=1..K} (Precision@k × v_k) / (total relevant items in top K)`, `v_k ∈ {0,1}` (rank-aware).
- Answer/Response Relevancy = mean cosine similarity between the question and N questions reverse-generated from the answer.
- Noisy-context metrics benchmark uses answer relevance at increasing noise ratios.

### Pattern catalogue with sources

| Pattern | Mechanism | Source |
| --- | --- | --- |
| Chunking | 200–800 tokens, 10–20% overlap, structure-aware (heading/code/table boundaries); sentence-window & semantic chunkers | Anthropic Contextual Retrieval (2024-09-19) https://www.anthropic.com/news/contextual-retrieval |
| Contextual Retrieval | LLM prepends 50–100-token chunk context to both embedding and BM25 index; −35% retrieval failures, −49% with contextual BM25, −67% with rerank | same |
| Small-to-big / parent-document | index child chunks, return parent span; sentence-window expansion | LlamaIndex `ParentDocumentRetriever`, LangChain `ParentDocumentRetriever` |
| Metadata filtering | pre-filter (partition/tenant/ACL) vs post-filter; hybrid: filter pushdown into ANN (HNSW/IVF) | vendor docs (pgvector, Qdrant, Weaviate) |
| Hybrid search | BM25 + dense, fuse by RRF (k=60) or convex combination | Cormack 2009; https://opensearch.org/docs/latest/vector-search/ |
| Reranking | cross-encoder (query,doc) joint scoring; ColBERT MaxSim; top-150 → top-20 | Anthropic 2024; arXiv:2004.12832 |
| Query rewriting / decomposition | MultiQuery, step-back prompting, sub-question decomposition | LangChain `MultiQueryRetriever`; Least-to-most (arXiv:2205.10625) |
| GraphRAG | LLM entity graph → Leiden communities → pre-generated community summaries → map-reduce partial answers | Edge et al., arXiv:2404.16130 (v2 2025-02-19) |
| Agentic RAG | retrieve–reflect–refine loop, tool-using retriever/router, self-RAG/corrective RAG | survey arXiv:2501.09136 |
| Context compression | extractive sentence pruning, LLMLingua-style token pruning, summary memory | Lost in the Middle, arXiv:2307.03172 (position bias justifies compression) |

### Embedding models (verified 2026)

| Model | Dims | Notes |
| --- | --- | --- |
| `gemini-embedding-2` (Apr 2026) | 3072 default, MRL 128–3072 (768/1536 rec.), auto-renormalized | multimodal: text/image/audio/video/PDF, 8192-token input, task prefix instead of `task_type`; incompatible space with `-001` → full re-embed. https://ai.google.dev/gemini-api/docs/embeddings |
| `gemini-embedding-001` (Jun 2025) | 2048 input tokens, 3072 | manual L2 norm when truncated |
| `embed-v5.0-pro` / `-fast` | 256–2048 (default 2048), float/int8/binary | 128k context, 100+ languages, shared space Pro↔Fast; MRL. https://docs.cohere.com/docs/cohere-embed |
| `embed-v4.0` | 256/512/1024/1536 | predecessor |
| OpenAI `text-embedding-3-large` | 3072, shortenable | still GA; re-check before pinning (unverified for 2026) |

## 3. AI agent engineering

Seven concerns: **Harness** (runtime loop, sandbox, retries) → **Loop** (plan/act/observe, budget) → **Context** (window budgeting, compaction, sub-agents) → **Tools** (schema, idempotency, error surfaces) → **Memory** (thread state vs cross-session store) → **Orchestration** (graph/DAG, `Send`, interrupts) → **Guardrails + Permissions** (allow-list, least privilege, HITL) → **Evals** → **Observability**.

**Eight agent metrics (definitions + formulas)**

| # | Metric | Definition |
| --- | --- | --- |
| 1 | Task success rate | `successful_tasks / total_tasks` (binary rubric or exact-match outcome) |
| 2 | Tool accuracy | `correct_tool_calls / total_tool_calls` (Ragas: tool-call accuracy & F1 on name+args) |
| 3 | Steps per task | `Σ agent steps / tasks`; track p50/p95, alert on drift |
| 4 | Escalation rate | `escalated_to_human / total_tasks` |
| 5 | Guardrail hit rate | `blocked_or_rewritten_actions / total_actions`, split by policy ID |
| 6 | Override rate | `human_overrides / agent_proposals` (+ false-positive rate of guardrails) |
| 7 | Cost per task | `Σ(input_tokens·p_in + output_tokens·p_out + tool_calls·p_tool) / tasks` |
| 8 | Time to resolve | wall-clock p50/p90 from first turn to terminal state (exclude queued HITL or report separately) |

**OTel GenAI conventions** (development stability): spans `gen_ai.{chat|embeddings|retrieval|execute_tool|invoke_agent|invoke_workflow|plan|memory}`; attributes `gen_ai.provider.name`, `gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`/`output_tokens`, `gen_ai.tool.name`, `error.type`. Metrics: `gen_ai.client.operation.duration` (s), `gen_ai.server.request.duration`, `gen_ai.server.time_to_first_token`, `gen_ai.server.time_per_output_tokens`, `gen_ai.invoke_agent.duration`, `gen_ai.invoke_agent.inference_calls`, `gen_ai.invoke_agent.tool_calls`. Content capture is opt-in: `OTEL_INSTRUMENTATION_GENAI_CAPTURE_CONTENT = NO_CONTENT (default) | SPAN_ONLY | EVENT_ONLY | SPAN_AND_EVENT`; external upload via `gen_ai.*_ref` attributes. MCP propagates W3C `traceparent`/`tracestate`/`baggage` in `_meta`.

**LLM-as-a-judge biases** (Zheng et al., arXiv:2306.05685) and controls: position bias → randomize/swap and average; verbosity bias → length-controlled pairwise + rubric scoring; self-enhancement → never judge with the generator, use a different family; sycophancy/authority bias → strip claimed credentials, blind model identity; format bias → normalize output format; leniency/central tendency → anchored rubric with discrete levels + calibration set; contamination → held-out, time-sliced evals. Report judge–human agreement (Cohen's κ / Spearman) per rubric.

## 4. AI security stack

**OWASP LLM Top 10:2025** — LLM01 Prompt Injection · LLM02 Sensitive Information Disclosure · LLM03 Supply Chain · LLM04 Data and Model Poisoning · LLM05 Improper Output Handling · LLM06 Excessive Agency · LLM07 System Prompt Leakage · LLM08 Vector and Embedding Weaknesses · LLM09 Misinformation · LLM10 Unbounded Consumption. (https://genai.owasp.org/llmrisk/llm01-prompt-injection/ …)

**OWASP LLM 2026 delta** (published 2026, https://genai.owasp.org/llm2026/): LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Excessive Agency, LLM04 Supply Chain, LLM05 Data & Model Poisoning, LLM06 Unbounded Consumption, LLM07 Misinformation, **LLM08 Hidden Context Exposure** (new), LLM09 Vector & Embedding Weaknesses, LLM10 Improper Output Handling. Teach 2025 for stability and flag 2026 renames/re-ranks.

**OWASP Agentic Top 10 2026** (ASI): ASI01 Agent Goal Hijack · ASI02 Tool Misuse & Exploitation · ASI03 Identity & Privilege Abuse · ASI04 Agentic Supply Chain · ASI05 Unexpected Code Execution (RCE) · ASI06 Memory & Context Poisoning · ASI07 Insecure Inter-Agent Communication · ASI08 Cascading Failures · ASI09 Human-Agent Trust Exploitation · ASI10 Rogue Agents.

**NIST**: AI RMF 1.0 core = GOVERN, MAP, MEASURE, MANAGE, applied to 7 trustworthiness characteristics (valid & reliable, safe, secure & resilient, accountable & transparent, explainable & interpretable, privacy-enhanced, fair with harmful bias managed). GenAI Profile (AI 600-1) lists 12 GenAI risk categories (CBRN, confabulation, dangerous/violent/hateful content, data privacy, environmental impacts, harmful bias, human-AI configuration, information integrity, information security, intellectual property, obscene content, value chain) with suggested actions per GOVERN/MAP/MEASURE/MANAGE.

**MITRE ATLAS** (content v2026.11): 1 matrix, **16 tactics**, **137 techniques**, **98 sub-techniques**, **44 mitigations**, **85 case studies**, 50 entities, 39 software records. Agentic-relevant IDs: `AML.T0051.001` indirect prompt injection, `AML.T0053` AI Agent Tool Invocation, `AML.T0080/.001` context/memory poisoning, `AML.T0110/.000-.002` tool poisoning (definition/implementation/runtime), `AML.T0085` Data from AI Services (RAG DBs, agent tools), `AML.T0067` LLM Response Components Manipulation, `AML.T0034` Cost Harvesting. Mitigations: `AML.M0029` HITL, `AML.M0028` tool access control, `AML.M0037` authority expansion controls, `AML.M0038` scope-drift detection, `AML.M0023` AI BOM, `AML.M0024` telemetry.

**Model supply chain & pickle**

- Pickle is a stack VM: `GLOBAL`/`STACK_GLOBAL` + `REDUCE` invoke arbitrary callables at load time — `torch.load` executes code before you see a tensor.
- Controls: prefer `safetensors` (pure tensor payload, no code); `torch.load(..., weights_only=True)` (default since PyTorch 2.6); scan every artifact pre-load/post-train/pre-deploy.
- ModelScan 0.8.8: byte-level signature scan (never unpickles), formats H5/HDF5, Keras v3, SavedModel, Pickle/Cloudpickle/Dill/Joblib; severities CRITICAL/HIGH/MEDIUM/LOW; exit codes 0 ok, 1 findings, 2 scan error, 3 unsupported input, 4 usage. `modelscan -p model.pkl -r json`.
- Adjacent vectors: GGUF chat-template injection, namespace reuse/rug-pull on hubs, malicious MCP tool descriptors — see ATLAS CS0064/CS0065/CS0054.

**CycloneDX 1.7 ML-BOM**: component `type: "machine-learning-model"` with `modelCard` (`modelParameters` — architecture, datasets, inputs/outputs; `quantitativeAnalysis` — performance metrics with confidence intervals; `considerations` — limitations, ethical/biases, security), `data` components (`type: "dataset"`, `contents`, `governance` — owners, custodians, provenance), `formulation` for build/training steps, plus `dependencies` and `vulnerabilities`. Media types `application/vnd.cyclonedx+json` / `+xml`; predicate `https://cyclonedx.org/bom`.

**Red teaming**: scope by ATLAS tactic + OWASP category; test indirect injection through retrieved docs/tool output/memory; assert on action traces, not just text; keep a regression corpus of attacks with expected guardrail verdicts.

## 5. Canonical URLs

- MCP: https://modelcontextprotocol.io/specification/2026-07-28/ · architecture `…/architecture` · tools `…/server/tools` · basic `…/basic` · deprecations `…/deprecated`
- LangGraph: https://docs.langchain.com/oss/python/langgraph/overview · API https://reference.langchain.com/python/langgraph/
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ (faithfulness, context_precision, context_recall subpages)
- GraphRAG: https://arxiv.org/abs/2404.16130 · https://microsoft.github.io/graphrag
- MRL https://arxiv.org/abs/2205.13147 · ColBERT https://arxiv.org/abs/2004.12832 · HyDE https://arxiv.org/abs/2212.10496 · Lost-in-the-Middle https://arxiv.org/abs/2307.03172 · LLM-judge https://arxiv.org/abs/2306.05685 · Agentic RAG https://arxiv.org/abs/2501.09136
- OWASP: https://genai.owasp.org/llm-top-10/ · https://genai.owasp.org/top-10-for-agentic-applications-2026/ · cheat sheets https://genai.owasp.org/resources/?e-filter-3b7adda-resource-item=cheat-sheets
- NIST: https://www.nist.gov/itl/ai-risk-management-framework · https://airc.nist.gov/
- ATLAS: https://atlas.mitre.org/ · https://github.com/mitre-atlas/atlas-data/blob/main/CHANGELOG.md
- OTel GenAI: https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai
- ModelScan: https://github.com/protectai/modelscan · https://modelscan.ai
- CycloneDX: https://cyclonedx.org/capabilities/mlbom/ · https://cyclonedx.org/docs/latest/

Unverified/pin-before-teaching: OpenAI embedding generation and pricing for 2026; OWASP 2026 PDF pagination/weights (site labels it 2026 while the download link still points at the 2025 resource).
