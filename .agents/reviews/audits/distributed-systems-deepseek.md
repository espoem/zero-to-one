# Drafter/Auditor Audit: architecture/distributed-systems
Auditor: `opencode-go/deepseek-v4.1-flash`
Target: `architecture/distributed-systems`
Date: 2026-10-31

---

## P0 — Blocking (broken instruction, dead links, missing mandated sections, wrong exam answer)

### P0-1 `mise run test` instruction
`README.md:88` instructs running `mise run test`, but no `[tasks]` block exists in `.mise.toml`. Change to `mise exec -- npm test`.

### P0-2 Exam `Ref:` anchors
Update internal anchors across `exams/interview.md` so that they resolve to actual headings or add explicit `<a id="...">` targets.

### P0-3 Missing sections in README
Add `### Prerequisites` and `### Out of Scope` sections; rename `## 2. Certifications & Academic Standards` to `## 2. Certifications & Exams`.

### P0-4 Question counts in D13 and D14
Ensure all domains meet the $\ge 5$ questions rule.

### P0-5 CHEATSHEET fencing token rule
Correct rule: reject if `token < highest_token` (allowing retries with same token, or requiring strictly monotonically increasing tokens).

### P0-6 Q-DIST-026 quorum anomaly timeline
Ensure coherent timeline for quorum anomaly scenario ($W=2, N=3$ write + sequential read on different overlapping quorums).

---

## P1 — Major content & validity gaps

### P1-1 Viewstamped Replication (VSR)
Include explicit discussion of VSR (Oki-Liskov 1988 view changes).

### P1-2 Delivery semantics taxonomy
Clearly delineate at-most-once (no retry), at-least-once (retry), and effectively-once (retry + idempotency key dedup).

### P1-3 Coverage matrix weights
Renormalize domain weights to exactly 100%.

---

## Confirmed clean

- Multi-line labels in Mermaid diagrams parse cleanly.
- Table pipe escaping is verified clean.
- All 14 modules include 5-question Interview Drills with `<details>`.
