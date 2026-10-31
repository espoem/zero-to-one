# Drafter/Auditor Audit: algorithms/dsa
Auditor: `opencode-go/deepseek-v4.1-flash`
Target: `algorithms/dsa`
Date: 2026-10-31

---

## P0 — merge blockers

1. **Coverage-matrix weights sum to 110%**:
   `exams/README.md:21-34`: 10+8+8+10+10+10+10+8+6+10+5+5+5+5 = 110%. Renormalize to 100%.

2. **Q-DSA-055 link text**:
   `exams/interview.md:858`: link text says `11-greedy-arguments.md`, file is `11-greedy-algorithms-and-exchange-arguments.md`. Fix link text.

3. **Q-DSA-042 answer block**:
   `exams/interview.md:655-665`: Rewrite bolded answer to `**A.**` with clean distractor analysis.

4. **Missing Prerequisites & Out of Scope**:
   Add `## Prerequisites` and `## Out of Scope` to `algorithms/dsa/README.md`.

5. **Root README status**:
   Ensure root README and status match merged state.

---

## P1 — major non-compliance

1. **MIT 6.1220J scope**:
   List NP-completeness / reductions in Out of Scope or clarify scope as concrete algorithm implementations.
2. **Missing algorithm topics**:
   Bipartite testing, PRAM / MS-Queue details.
3. **Difficulty tallies in README**:
   Re-align difficulty counts with actual question tags in bank.

---

## Confirmed clean

- Multi-line `\n` in Mermaid labels parse cleanly.
- Table pipe escaping is clean and verified.
- Interview Drill present in all 14 modules with `<details>`.
- Mathematical proofs (Master theorem, Akra-Bazzi, Bloom, Count-Min, HLL, Brent, Huffman, KMP) verified correct.
