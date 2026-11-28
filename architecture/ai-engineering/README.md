# AI Engineering Architecture Curriculum

Rigorous, production-grounded AI engineering curriculum covering LLM fundamentals, prompt and context engineering, end-to-end and advanced RAG retrieval, bounded agent harnesses, Model Context Protocol (MCP), LangGraph orchestration, agent and RAG evaluation, LLMOps, and the 8-layer AI security stack.

Verified against MCP specification 2026-07-28 (`@modelcontextprotocol/sdk` 1.32.2, Python `mcp` 2.3.0), LangGraph 1.2.24 (Python) / 1.7.5 (`@langchain/langgraph`), Ragas 0.4.4, Microsoft GraphRAG 3.3.0, OpenTelemetry GenAI Semantic Conventions (`Development` status, core semconv 1.45.0), OWASP LLM Top 10:2025 + 2026 edition, OWASP Agentic Top 10 2026 (ASI01–ASI10), NIST AI RMF 1.0 + AI 600-1, MITRE ATLAS v2026.11, CycloneDX 1.7 (ECMA-424), ModelScan 0.8.8, Node 26.13.0, and TypeScript 7.0.2 on 2026-11-28.

## Prerequisites

Master the foundational systems, storage, observability, and security concepts before working through this track:

- [`../system-design/modules/25-reliable-ai-systems.md`](../system-design/modules/25-reliable-ai-systems.md) — Validator Sandwich, semantic cache poisoning, calibrated HITL routing, and bounded loop invariants.
- [`../system-design/modules/14-canonical-designs-transactional-and-staff.md`](../system-design/modules/14-canonical-designs-transactional-and-staff.md#6-llm-serving--chatgpt-architecture-modern-2026-staff-design) — Prefill vs. decode mechanics, KV-cache VRAM sizing, PagedAttention, and continuous batching.
- [`../data-systems/modules/03-indexing-theory-and-vector-search.md`](../data-systems/modules/03-indexing-theory-and-vector-search.md) — Inverted indexes, Okapi BM25, HNSW, IVF, and vector quantization theory.
- [`../security-identity/README.md`](../security-identity/README.md) — Authentication, OAuth 2.1, RBAC/ABAC/ReBAC authorization, and web/API threat modeling.
- [`../../technologies/observability/README.md`](../../technologies/observability/README.md) — OpenTelemetry API/SDK, W3C Trace Context propagation, and collector pipelines.

## Curriculum Syllabus

The curriculum spans 7 self-contained modules in [`modules/`](./modules/):

1. **[01. LLM Fundamentals, Prompt & Context Engineering](./modules/01-llm-fundamentals-prompt-and-context-engineering.md)**: Byte-Pair Encoding (BPE) tokenization, autoregressive sampling (`temperature`, `top-p`, `min-p`), LLM API contracts, prompt engineering for developers, context engineering and token budgeting, function calling and tool use, grammar-constrained structured outputs (`CFG`/`FSM`, JSON Schema, Zod/Pydantic), and framework trade-offs.
2. **[02. RAG Pipeline & Vector Retrieval](./modules/02-rag-pipeline-and-vector-retrieval.md)**: End-to-end RAG lifecycle (`ingest → chunk → embed → store → retrieve → generate → evaluate`), Matryoshka Representation Learning (MRL) embeddings (`gemini-embedding-2`, `embed-v5.0-pro`), vector database selection, document processing and chunking (fixed, recursive, structure-aware, semantic, Anthropic Contextual Retrieval), metadata filtering and the post-filter selectivity trap, and hybrid search (BM25 + dense + RRF).
3. **[03. Advanced RAG Patterns](./modules/03-advanced-rag-patterns.md)**: Two-stage reranking (cross-encoders and ColBERT MaxSim late interaction), small-to-big retrieval (parent-document and sentence-window), GraphRAG (entity graph, Leiden communities, map-reduce), context compression (Lost-in-the-Middle mitigation), query rewriting and decomposition (MultiQuery, step-back, least-to-most), HyDE, Agentic RAG, and production retrieval failure-mode analysis.
4. **[04. Agent Harness & Orchestration Engineering](./modules/04-agent-harness-and-orchestration-engineering.md)**: Harness engineering (`goal → harness → agent → tools + resources → output`), loop engineering (`goal → plan → act → observe → learn`), tool design and idempotency, memory architecture (episodic, semantic, procedural, compaction), Model Context Protocol (MCP 2026-07-28 JSON-RPC 2.0, `input_required` MRTR), orchestration patterns, LangGraph (`StateGraph`, Pregel BSP, `Send`, `Command`, `interrupt()`), multi-agent topologies, and Human-in-the-Loop (HITL) control planes.
5. **[05. Agent Metrics, Evaluations & Benchmarking](./modules/05-agent-metrics-evaluations-and-benchmarking.md)**: Operational definitions and SLOs for the 8 core AI agent metrics (`task success`, `tool accuracy`, `steps per task`, `escalation rate`, `guardrail hits`, `override rate`, `cost per task`, `time to resolve`), trajectory vs. outcome evaluations, RAG evaluation with Ragas 0.4.4 (`faithfulness`, `context precision@K`, `context recall`, answer relevancy), LLM-as-a-Judge bias mitigation and Cohen's $\kappa$, and model benchmarking (contamination and Pareto frontiers).
6. **[06. LLMOps: Serving, Observability & CI/CD](./modules/06-llmops-serving-observability-and-cicd.md)**: Serving open-source models (vLLM, SGLang, disaggregated prefill/decode), deploying LLM applications, OpenTelemetry GenAI semantic conventions and privacy-safe `OTEL_INSTRUMENTATION_GENAI_CAPTURE_CONTENT` governance, and CI/CD for LLM applications (eval regression gates, golden datasets, shadow and canary rollouts).
7. **[07. AI Security Stack & Responsible AI](./modules/07-ai-security-stack-and-responsible-ai.md)**: The 8-layer AI Security Stack (Red Teaming, Guardrails + Permissions, Direct/Indirect Injection Detection, Model Scanning with ModelScan 0.8.8 and safetensors vs. pickle VM, Secrets + CycloneDX 1.7 ML-BOM, Policy + Access, Monitoring, Security Frameworks: OWASP LLM Top 10:2025 + 2026 delta, OWASP Agentic Top 10 2026, NIST AI RMF 1.0 + GenAI 600-1, MITRE ATLAS v2026.11) and Responsible AI practices (data ethics, fairness metrics, governance).

### Out of Scope & Cross-Track Ownership

- Low-level GPU KV-cache shrinkage mechanisms (MQA, GQA, MLA, Attention Sinks, quantization PTQ/QAT) — owned by [`system-design` Module 14](../system-design/modules/14-canonical-designs-transactional-and-staff.md#6-llm-serving--chatgpt-architecture-modern-2026-staff-design) and the companion `algorithms/ml-foundations` curriculum (M05–M06).
- Core HNSW graph construction, IVF centroids, and inverted index codecs — owned by [`data-systems` Module 03](../data-systems/modules/03-indexing-theory-and-vector-search.md).
- Validator Sandwich boundary contracts, guarded semantic cache predicates, and calibrated ECE/Brier HITL thresholds — owned by [`system-design` Module 25](../system-design/modules/25-reliable-ai-systems.md) and cross-linked throughout this track.

## Certifications & Exams

No single vendor-neutral professional certification exists for end-to-end AI Engineering (covering agent harnesses, MCP, RAG pipelines, evals, and AI security together). This track aligns with the **Senior AI Engineer Technical Interview Loop** and maps foundational cloud-AI objectives to the active vendor certifications below:

| Certification / Loop | Vendor / Authority | Official Exam Guide | Target Scope & Status | Format & Duration |
| :-- | :-- | :-- | :-- | :-- |
| **Senior AI Engineer Interview Loop** | Industry Standard | RAG, Agent Harness, Evals, LLMOps & Security rounds | Vendor-neutral production AI systems (Active) | 45–60 min system design + live evaluation/debugging rounds |
| **AWS Certified AI Practitioner (AIF-C01)** | Amazon Web Services | [Official AIF-C01 Guide](https://aws.amazon.com/certification/certified-ai-practitioner/) | GenAI fundamentals, FM selection, Bedrock/RAG, Responsible AI & Governance (Active) | 65 questions (multiple choice / response / matching), 90 minutes, passing score 700/1000 |
| **Microsoft Certified: Azure AI Engineer Associate (AI-200 / AI-102 successor alignment)** | Microsoft Azure | [Microsoft Learn AI Credentials](https://learn.microsoft.com/en-us/credentials/) | GenAI solutions, RAG indexing, agent orchestration, content safety & evaluation (Active) | 40–60 questions (multiple choice, case studies), 100 minutes, passing score 700/1000 |

For the domain-to-module coverage matrix, the 60-question preparation bank (`Q-AIE-001`–`Q-AIE-060`), and the timed 40-question mock exam, see **[exams/README.md](./exams/README.md)**.

## Executable Proofs & Tests

All retrieval scoring, Ragas evaluation metrics, bounded agent harness state machines, MCP dispatch controls, 8-metric aggregators, prompt-injection isolation, pickle opcode inspection, and CycloneDX ML-BOM validators are implemented as deterministic TypeScript test suites in [`examples/`](./examples/).

Run all test suites, type checking, linting, and formatting checks locally via `mise`:

```bash
mise install
mise exec -- npm ci
mise exec -- npm test
mise exec -- npm run typecheck
mise exec -- npm run lint
mise exec -- npm run fmt:check
```
