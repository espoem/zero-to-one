# Challenger Audit: architecture/networking
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `architecture/networking`
Date: 2026-10-31

---

# Challenger Audit — `architecture/networking`

## P0 — Blocking: must fix before merge

### P0-1 — Missing `exams/interview.md` despite claimed Staff/Principal loop coverage
- `exams/` contains only `n10-009.md` + `README.md`. No `exams/interview.md` found.
- Either add `exams/interview.md` or align claims in README to focus on CompTIA Network+ (N10-009).

### P0-2 — Broken internal module anchors in `exams/n10-009.md`
Slugs like `#osi-7-layer-vs-tcpip-4-layer-model` don't match actual headings (`## 1. Architectural Models: OSI Reference vs. TCP/IP Implementation`).
Regenerate slugs or add explicit `<a id="..."></a>` targets.

### P0-3 — Mock-exam format in `n10-009.md`
Correct mock description to 30-question sampled drill or author full mock.

### P0-4 — Unverified RFC citations
- `RFC 9846` as consolidated TLS 1.3: TLS 1.3 is RFC 8446.
- Fix draft RFC numbers (ECH, ML-KEM).
- Clarify BBRv2/v3 reaction to loss vs BBRv1.

---

## P1 — Correctness gaps

### P1-1 — CUBIC formula inconsistency
`07-congestion-control.md §4`: text wrote $K = \sqrt[3]{W_{\max} \cdot \beta / C}$ with $\beta=0.7$; correct RFC 9438 §3.1 formula is $K = \sqrt[3]{W_{\max} \cdot (1-\beta)/C}$.

### P1-2 — SYN-cookie nuances
Explain that under SYN cookies, TCP options (WScale, SACK, Timestamps) are lost unless encoded in MSS or TCP timestamps.

### P1-3 — 0-RTT anti-replay
Align with RFC 8446 §8 / RFC 8470 mechanisms.

### P1-4 — BGP MED comparison
MED is only compared across routes from the same neighboring AS unless `always-compare-med` is enabled.

### P1-5 — QUIC CID length
Unify to 0–20 bytes (0–160 bits).

### P1-6 — `io_uring` treatment
Expand `io_uring` SQE/CQE lifecycle beyond single table row.

---

## P2 / P3 — Rigor & Polish

- Run `tools/mermaid-check` on all 40+ diagrams.
- Table pipes verified clean.
