# Challenger Audit: algorithms/dsa
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `algorithms/dsa`
Date: 2026-10-31

---

# DSA Challenger Audit vs AGENTS.md — 2026-10-31

Scope: `algorithms/dsa/` — 14 modules, 14 `examples/*.test.ts`, `exams/interview.md` (75Q + 4-problem mock), `README.md`, `CHEATSHEET.md`, `GLOSSARY.md`.

## P0 — Merge blockers (correctness / integrity / hard AGENTS violations)

**P0-1 Weights sum to 110%, matrix invalid**
`exams/README.md §2`: 10+8+8+10+10+10+10+8+6+10+5+5+5+5 = **110%**. Coverage matrix with weights ≠100% cannot be used for domain-weight proportionality (§Certification #2, #4 requires distribution roughly in proportion to official weights). Fix weights + rebalance Q-bank counts.

**P0-2 Broken internal ref — Q-DSA-055**
`exams/interview.md: Q-DSA-055 Ref: [modules/11-greedy-arguments.md](../modules/11-greedy-algorithms-and-exchange-arguments.md)` — link target `11-greedy-arguments.md` does not exist. Only file is `11-greedy-algorithms-and-exchange-arguments.md`.

**P0-3 Corrupt answer — Q-DSA-042**
`exams/interview.md Q-DSA-042`: `**B** is false; **A** is correct. A queen at (r,c) attacks...` — stem asks which mask triple is O(1), options A vs B identical in intent, answer body contradicts itself and leaves grading non-deterministic. Must rewrite stem/distractors + `Why not` for all options.

**P0-4 No `ordering` / `hands-on` types — bank fails §4 format**
All questions are `single`, `multi`, `scenario`. Need ordering and hands-on questions with runnable verification scripts in `examples/`.

**P0-5 `examples/` layout violation — flat, TS-only**
AGENTS §Code Example Languages #3 + §Isolation: `examples/<language>/…`, each language own mise toolchain + native runner. Missing Python examples for interview live-coding idioms.

**P0-6 Missing CLRS-style pseudocode with loop invariants**
Modules give only TypeScript snippets, no CLRS-style pseudocode with explicit Initialization/Maintenance/Termination invariants.

**P0-7 False verification claim in README**
`README.md §4`: claims 68 tests across 9 suites, while `examples/` has 14 test files. Update counts.

## P1 — Major AGENTS non-compliance

**P1-1 Certification metadata incomplete**
Missing guide version, date verified, format, passing score for MIT 6.1210 / 6.1220J baselines.

**P1-2 Missing Then-vs-now sections**
E.g., `Array.prototype.sort` TimSort vs Quicksort stability evolution.

**P1-4 Question IDs + refs formatting**
Ref anchors like `[modules/01-….md](../modules/01-….md)` lack `#anchor`.

## P2 — Mathematical / rigor gaps

**P2-1 DSU strictly O(1) overclaim**
Correct to $O(\alpha(n)) \approx O(1)$ in practice, not asymptotically $O(1)$.

**P2-2 Tarjan lowlink definition**
Include cross-edges to on-stack nodes.

**P2-4 Morris traversal mutation**
Clarify that it temporarily mutates and then restores tree pointers.

**P2-5 Reservoir sampling 0-indexed vs 1-indexed**
Clarify indexing conventions.

## P3 — Polish

- Verify Mermaid diagrams pass `tools/mermaid-check`.
- Table pipe escaping clean.
