# Challenger Audit: architecture/distributed-systems
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `architecture/distributed-systems`
Date: 2026-10-31

---

# Challenger Audit — `architecture/distributed-systems`

Scope: all 14 `modules/*.md`, `README.md`, `CHEATSHEET.md`, `GLOSSARY.md`, `exams/README.md`, `exams/interview.md` (1421 lines, Q-DIST-001…075 + 4 mock scenarios). Checked against `AGENTS.md` §§ 1–6.

---

## P0 — Blocking: correctness / integrity violations

### P0-1 — ALL 75 exam `Ref:` internal anchors are dead
**Files:** `exams/interview.md:23,38,53,66,100,115,…1179` → `modules/01-14-*.md`
Every question links to a section anchor that does not exist as a GitHub slug (e.g., `#timing-models`, `#flp-impossibility-result` vs `#4-the-flp-impossibility-theorem`).
**Fix:** Rewrite all 75 refs to real GitHub slugs or add explicit `<a id="…">` targets.

### P0-2 — Q-DIST-026 quorum-anomaly scenario is self-contradictory
**File:** `exams/interview.md:402-416`
Contradictions in stem: Client C reads `{N1,N2,N3}` and observes `v2` from `N3`, but stem stated N3 dropped B's message.
**Fix:** Rewrite with single coherent timeline (e.g. canonical $W=2, N=3$ partial-write + two sequential reads on different quorums), state timestamp/version rule explicitly.

### P0-3 — Module 02 delivery-semantics table inverts standard taxonomy
**File:** `modules/02-networks-rpc-and-failure-detection.md:31-35`
Conflates at-most-once with retry+dedup, and general exactly-once with bounded transactional EOS.
**Fix:** Standard 3-row taxonomy: at-most-once (no retry, may lose), at-least-once (retry, may duplicate), effectively-once / idempotent (retry + dedup + bounded scope).

---

## P1 — Major theory / coverage / exam-validity gaps

### P1-1 — Viewstamped Replication (VSR) missing
Add treatment of Oki-Liskov 1988 view-change, view-number, primary-backup vs Paxos comparison.

### P1-2 — Linearizability checking missing Wing-Gong algorithm
Module 04 covers Herlihy-Wing 1990 definitions and Knorm checker, but omits Wing-Gong 1993 graph-search / NP-completeness proof.

### P1-3 — TrueTime commit-wait math: $2\epsilon$ vs $\epsilon$ derivation
Module 03 §5 states $2\epsilon$ without showing why uncertainty intervals $[t-\epsilon, t+\epsilon]$ require waiting $2\epsilon$.

### P1-4 — Scenario 1 mock exam has conflicting requirements
Global $<5\text{ms}$ latency + linearizable reads + multi-region WAN is impossible under speed of light ($R+W>N$ across continents > 5ms).

### P1-5 — Op-based (CmRDT) vs state-based (CvRDT) delivery requirements
Module 11 §4: define causal broadcast buffer and why CmRDT diverges without causal delivery.

### P1-6 — Coverage-matrix weights sum to 101%
Renormalize to 100%.

---

## P2 — Technical inaccuracies / version / prose risks

- **P2-1 Percolator date:** Fix Peng & Dabek date to 2010.
- **P2-2 $3f+1$ Byzantine derivation:** Distinguish unauthenticated ($3f+1$) vs authenticated with signatures ($2f+1$).
- **P2-3 Glossary typo:** "Nemocnost FLP" → "Nemožnost FLP".
- **P2-4 Version bounds:** Kafka 4.2 / KIP-932 GA claims.
- **P2-5 Flexible Paxos:** Explicitly state quorum intersection property ($Q_1 \cap Q_2 \neq \emptyset$).
- **P2-6 HLC NTP bound:** State assumption $|l - pt| \le \epsilon$ holds only if NTP offset bounded.

---

## P3 — Style / Mermaid / table hygiene

- Run `tools/mermaid-check`.
- Table pipes verified clean.
- Ensure collapsible `<details>` on all interview drills.
