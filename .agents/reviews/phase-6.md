# Phase 6 Curriculum Expansion — Cross-Model Verification & Resolution Record

Date: 2026-11-28  
Orchestrator: `agy` Neon  
Background Research: `opencode` (`opencode-go/beam-free`, `opencode-go/deepseek-v4.1-flash`)  
Verifiers: `agy` Hydrogen (`flash` read-only verifier across Phases 1, 2, 3) and `opencode-go/beam-free` (Phase 2 mathematical/citation audit)

---

## 1. Provider & Tooling Constraints Recorded

- **`claude -p --model sonnet`** (initial run, expired OAuth): Failed authentication initially; subsequently re-authenticated by the operator and executed cleanly as three parallel read-only cross-family audits (Audit A: Phase 1 enrichments, Audit B: `algorithms/ml-foundations`, Audit C: `architecture/ai-engineering`).
- **`opencode-go/grok-4.7`**: Reached the 5-hour OpenCode Go usage limit mid-audit (`Error: OpenCode Go 5 hour usage limit reached`).
- **Resolution**: Executed both initial `agy` Hydrogen (`flash`) + `opencode-go/beam-free` audits and a complete post-auth **Claude Code Sonnet (`claude -p --model sonnet`) cross-family audit** across all Phase 1–3 tracks, resolving every confirmed defect before final deterministic checks and `npm run check`.

---

## 2. Phase-by-Phase Findings & Resolutions

### Phase 1 (`system-design`, `networking`, `data-systems` + `redis`, `security-identity`)

Verified by `agy` Hydrogen (`67311602`):

1. **`architecture/data-systems/modules/09-caching-theory-and-consistency.md:160-168,298-300`**: Pre-existing tautological XFetch inequality (`\Delta - \beta \cdot \delta \cdot \ln(\text{rand}()) > \text{TTL}` where both $\Delta$ and $\text{TTL}$ represented remaining lifetime) fixed to $-\beta \cdot \delta \cdot \ln(\text{rand}()) \ge \text{TTL}_{\text{remaining}}$.
2. **`architecture/data-systems/modules/09-caching-theory-and-consistency.md:60`**: Literal underscore `$T\_{\text{eff}}$` fixed to `$T_{\text{eff}}$`.
3. **`architecture/data-systems/CHEATSHEET.md:311`**: Removed stray trailing `$$` delimiter.
4. **`architecture/security-identity/examples/python/auth_service.py:344-346`**: Returned `resp` directly instead of raising `HTTPException` so `Set-Cookie` deletion (`Max-Age=0`) on RTR reuse actually reaches the client; added an explicit header assertion in `test_fastapi_auth_bff.py`.
5. **`architecture/security-identity/node_modules`**: Ran `mise exec -- npm ci` on `main` to sync `express@5.3.0`; verified `58/58` TypeScript + `5/5` FastAPI pytest pass.

### Phase 2 (`algorithms/ml-foundations`)

Verified by `agy` Hydrogen (`8c723553`) and `opencode-go/beam-free` (`phase-6-phase2-beam.md`):

1. **Missing practitioner version history table**: Added `## 3. Practitioner Version History & Then vs. Now` to `modules/06-quantization-and-ml-monitoring.md` (`AGENTS.md` § Version Currency).
2. **`oxfmt` Markdown emphasis rewrite inside inline math (`*` / `\_`)**: Fixed corrupted subscripts across `GLOSSARY.md`, `modules/04`, `modules/05`, `modules/06`, and `exams/ml-foundations.md` (`Q-MLF-035`, `Q-MLF-053`, `Q-MLF-058`) and converted affected inline DDPM expressions in `modules/04` to `$$...$$` display math so `oxfmt` preserves exact LaTeX syntax.
3. **GQA parameter `G` consistency in `assets/kv-cache-8-ways-animated.svg`**: Updated panel 2 (`n_kv = n_h / G (group size G)`, `MHA (G=1)`, `MQA (G=n_h)`) to match `modules/05` and `examples/ts/01-kv-cache-compression.test.ts`.
4. **Mismatched external reference URL in `Q-MLF-057`**: Replaced the `ks_2samp.html` link on the PSI question with Siddiqi (2006) _Credit Risk Scorecards_ and `scipy.stats.entropy.html` (while keeping `ks_2samp.html` on `Q-MLF-058`).
5. **Group-wise quantization overhead clarity (`modules/06:17`)**: Qualified `~0.02–0.16` extra bytes per element explicitly across `g = 128` vs `g = 16`.

### Phase 3 (`architecture/ai-engineering`)

Verified by `agy` Hydrogen (`e5895d1e`):

1. **Unresolved `(unverified)` marker**: Resolved `OpenAI text-embedding-3-large` in `modules/02-rag-pipeline-and-vector-retrieval.md:55`.
2. **MCP error code collision & untested allowlist branch**: Changed `dispatchMcpRequest` forbidden-tool response in `examples/02-agent-harness-and-metrics.test.ts:74` from `-32021` (reserved by MCP `2026-07-28` for `MissingRequiredClientCapability`) to `-32601` and added a negative test assertion.
3. **Missing practitioner version history table**: Added `## 4. Practitioner Version History & Then vs. Now` to `modules/07-ai-security-stack-and-responsible-ai.md`.

---

## 3. Claude Code Sonnet Cross-Family Audit (Audits A, B, C)

### Audit A — Phase 1 Enrichments (13 findings, all resolved)

- **Security & Auth (`security-identity`)**: Changed `computeAtHash` in `examples/15-express-auth-bff.test.ts` to `SHA-512` (left-most 32 bytes) for `EdDSA` (`Ed25519`); bound OIDC `pendingTx` to a `__Host-auth-tx` HttpOnly cookie in both Express 5 and FastAPI to defeat login CSRF (with negative tests); used `urllib.parse.urlencode` in FastAPI `/authorize`; added `jwt.ExpiredSignatureError` transparent refresh + reuse revocation on `/bff/orders` + test; refined BFF cookie prose in `CHEATSHEET.md` (`HttpOnly` blocks token exfiltration, not same-origin session riding).
- **System Design, Networking, Data & Redis**: Fixed the "catastrophic race" sequence order in `data-systems/modules/09` and qualified XFetch probabilistic early refresh; adjusted Hexagonal ring invariant rank to `r(Domain Core) = r(Application Ports) > r(Adapters/Infra)` and renamed `waitForVersion` to `satisfiesReadYourWrites` in `system-design/modules/27`; updated Nginx Smooth WRR complexity to `O(N) | O(1)` precomputed cycle and aligned test comments in `networking`; corrected `Q-SD-133` throughput arithmetic (`~3.05 GiB/min`, `3.28 GB/min`); clarified Lua/Function versioned writes vs `SET ... IFDEQ` exact-digest CAS in `redis`.

### Audit B — `algorithms/ml-foundations` (14 findings + 2 minor items, all resolved)

- **Quantization & Drift Math**: Fixed `D = 0.004` ($p < 10^{-6}$) at $N=10^6$ and $D = 0.0045$ ($p < 10^{-4}$) at $N=5\times 10^5$ in `modules/06`; corrected AWQ channel scaling to $s_j = (\mathrm{mean}\lvert X_{:,j}\rvert)^\alpha$ across `modules/06`, `CHEATSHEET.md`, `exams/ml-foundations.md`, and replaced hardcoded scaling in `examples/ts/02-nn-and-quantization.test.ts` with calibration-matrix `mean|X|` + $\alpha \in [0, 1]$ grid search; fixed group-wise metadata byte overhead (`0.125–0.25 B/elem` at `g=16`), dequantization & STE clamp bounds `[(q_min - z)s, (q_max - z)s]`, `PyFloatObject` size (`24 B + 8 B ptr`), and H100 `80 GB (~74.5 GiB)` headroom (`Q-MLF-041`, `Q-MLF-055`).
- **Neural Theory, Leakage Proof & Exams**: Distinguished Hornik (1991, bounded non-constant) from Leshno et al. (1993, non-polynomial) in `modules/03` & `Q-MLF-020`; corrected GCN renormalization spectral range to `(-1, 1]` (`Q-MLF-036`); fixed `Q-MLF-024` distractor rationales and `Q-MLF-053` display math; upgraded `test_leakage_free_pipeline_vs_pre_split_leakage_counterexample` to prove a `+1000` test-half shift leaks >400 units into a pre-split `StandardScaler`; added `Borderline: 26–28 / 40` to the mock scoring key.

### Audit C — `architecture/ai-engineering` (34 findings, all resolved)

- **Security & Harness Proofs (`examples/01–03`)**: Hardened `dispatchMcpRequest` MRTR `requestState` with server-side nonces, canonical `argsHash`, principal, expiry, single-use consumption, and host-verified approvers (with bypass/tamper negative tests); added checkpointed per-action HITL resume, wall-clock deadlines (`DEADLINE_EXCEEDED`), distinct `TOOL_BUDGET_EXHAUSTED`/`PLAN_EXHAUSTED` statuses, and `p50`/`p90` TTR; hardened `sanitizeAndIsolateUntrustedContent` (NFKC + Unicode Tag `U+E0000–E007F`/bidi stripping), URL-parsed host egress fail-closed checks, strict `safetensors` bounds validation + protocol `0–5` / ZIP pickle scanning with allowlists, and aligned CycloneDX 1.7 ML-BOM validation (`type: "data"` + `considerations.technicalLimitations`); widened RRF fixture margin (`> 0.01`) and called `reciprocalRankFusion` directly in the property test.
- **Modules, Cheatsheet & Exams**: Verified & updated `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`, singular `gen_ai.server.time_per_output_token`, `{gen_ai.operation.name} {target}` OTel spans, and full OWASP LLM Top 10:2026 (`LLM01–LLM10`) against primary docs; corrected BPE leading-space mapping, added numbered 16-pattern RAG index in `modules/03`, redefined Ragas `NoiseSensitivity`, cited Fleiss (1981) for $\kappa \ge 0.75$ and `arXiv:2406.12045` (`τ-bench`) + Thinking Machines Lab (2025), aligned canary schedules (`1%→10%→50%→100%`), expanded Demographic Parity impossibility explanation, marked unverified SDK/maintenance versions explicitly, clarified Senior AI Engineer Interview alignment in `exams/README.md`, and rebalanced the 60-question answer key distribution across `A`/`B`/`C`/`D`.
