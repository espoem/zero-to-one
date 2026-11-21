# Review: system-design · verifier (Antigravity flash) & challenger (Antigravity pro) · 2026-11-20 · branch track/system-design

## Summary

Verdict: **approve** (after full remediation of all P0, P1, P2, and P3 findings from both independent reviews). Capstone track delivers 14 modules (6,600+ lines composing all 28 preceding tracks without duplicating owned theory), 72-term bilingual glossary, 295-line Staff/Principal cheatsheet, deterministic TypeScript proofs (`examples/lib/system-design-models.ts` + 33 passing hermetic tests across 7 suites + 3-test optional Redis/Valkey integration suite), and 70 original Staff/Principal interview questions (`Q-SD-001`–`Q-SD-070`) plus a 50-question timed drill and two 60-minute timed mock design loops with rubrics.

## Multi-Agent Provenance

- **Coordinator / Integrator / Final Gate**: Antigravity (main session) — live primary-source verification (Google SRE Workbook Ch. 5 burn-rate table, Alex Xu Vol. 1/2 publication years, Valkey 9.2.0 / Redis 8.10.3 / Prometheus 3.16.0 / Node 26.13.0 / TS 7.0.2), scaffold (`package.json`, `.mise.toml`, `mise.lock`, `README.md`, `exams/README.md`), `lane-check.ts` manifests, final integration, and root gate verification.
- **Wave 1 Authors (disjoint lanes)**:
  - `modules/01`: initial draft `opencode-go/beam-free`, cleaned and deepened by Antigravity `flash`
  - `modules/02`: Antigravity `flash`
  - `modules/03–04`: initial drafts `opencode-go/iceman-contributor-free`, deepened by Antigravity `flash`
  - `modules/05–06`: `opencode-go/hy4-flash-free`
  - `modules/07–08`: Antigravity `flash`
  - `modules/09–10`: Antigravity `flash`
  - `modules/11–12`: Antigravity `flash`
  - `modules/13–14`: Antigravity `flash`
  - `GLOSSARY.md` & `CHEATSHEET.md`: Antigravity `flash`
  - `examples/lib/system-design-models.ts` & `examples/01..08-*.test.ts`: Antigravity `flash`
  - `exams/interview.md`: Antigravity `flash`
- **Wave 2 Independent Review & Remediation**:
  - Read-only `verifier`: Antigravity `flash`
  - Independent `capable` adversarial `challenger`: Antigravity `pro`
  - Disjoint remediation lanes: Antigravity `flash` (`examples/` and `modules+exams+docs/`)

## Findings

### Challenger Findings (Antigravity `pro`, independent read-only review)

- [x] **P0** `exams/interview.md` (`Q-SD-050`): Claimed global rank across 16 hash-sharded Redis `ZSET`s is computed by summing `ZREVRANK` across all 16 shards (`ZREVRANK` returns `nil` on shards without the member); corrected to fetching `composite_score` via `ZSCORE` on the owning shard and summing `ZCOUNT shard_i (composite_score +inf` across all shards.
- [x] **P0** `modules/14-canonical-designs-transactional-and-staff.md`: Redis Lua GCRA snippet added `emission * cost` before checking `allow_at = new_tat - burst > now` (rejecting request #1 when `burst = 0`); aligned directly with the tested 4-arg GCRA Lua implementation in `examples/08-redis-integration.test.ts`.
- [x] **P0** `modules/06-scaling-reads-writes-and-partitioning.md`: Modulo remapping used $(N-1)/N$ instead of the exact Chinese Remainder Theorem result $1 - \frac{1}{N+1} = \frac{N}{N+1}$, and double-multiplied the 80% cache hit factor (`~72,000` / `~58,000`); corrected to $\frac{N}{N+1}$ and `~91,000` keys moved / `~73,000` cache entries invalidated.
- [x] **P0** `modules/12-canonical-designs-read-heavy-and-content.md`: Combined `CHAR(7)` Base62 ($62^7 \approx 3.52\text{T}$) with a 42-bit integer space ($2^{42} \approx 4.40\text{T} > 62^7$); corrected to 41-bit ($2^{41} \approx 2.20\text{T} < 62^7$) or cycle-walking Feistel modulo $62^7$.
- [x] **P1** `examples/lib/system-design-models.ts` & `examples/05-queueing-and-tail-latency.test.ts`: `simulateQueueing` ignored time-integrated `totalSystemTimeMs` and checked an algebraic identity; fixed event loop to integrate through `maxFinish`, compute `empiricalMeanConcurrency = totalSystemTimeMs / totalElapsedMs` and effective throughput from `completed`, and assert analytical M/M/1 bounds ($W = 1/(\mu - \lambda)$, $L = \rho/(1-\rho)$) plus bounded-queue drop invariance.
- [x] **P1** `examples/03-caching-and-hashing.test.ts` & `modules/05`: Added `simulateHotKeyShards` proving single-shard celebrity saturation vs key-salting and L1 micro-caching, and aligned M05:183 wording.
- [x] **P1** `examples/07-slo-burn-rates-and-health.test.ts` & `modules/11`: Added `estimateTsdbCardinality` proving unbounded `user_id` label RAM explosion vs low-cardinality labels.
- [x] **P1** `README.md`, `modules/12`, `modules/13`, `modules/14`: Separated pinned local tooling from referenced upstream systems/literature in `README.md`, fixed `2.7 \times 10^{18}` bits/day in M12, `1M–2M` concurrent active riders in M13, and `8k`-token FP8 GQA sequences in M14.
- [x] **P2/P3** `examples/lib/system-design-models.ts`, `examples/01`, `modules/08`, `modules/11`, `modules/12`, `CHEATSHEET.md`, `GLOSSARY.md`: Enforced `recordsByOrder` double-charge guard (`DuplicateOrderError` 409), fixed `~27.8 Tbps` comment, aligned M08 Lua snippet + observability link, unified M11 Interview Drill headings, fixed M12 autocomplete diagram prefix ranges, added 200M distinct-key assumption and `1b sign +` Snowflake bit layout.

### Verifier Findings (Antigravity `flash`, independent read-only review)

- [x] **P0** `modules/07-asynchrony-queues-streams-and-workflows.md`: Removed copied Module 08 rows from `## 11. Proof Map` and linked Module 08 for rate limiting/hedging proofs.
- [x] **P0** `modules/11-reliability-slos-observability-and-dr.md`: Backed the Proof Map's TSDB cardinality claim with `estimateTsdbCardinality` and negative test in `examples/07-slo-burn-rates-and-health.test.ts`.
- [x] **P1** `modules/08-rate-limiting-load-shedding-and-resilience.md`: Resolved `ARGV[5]` mismatch in the inline Lua GCRA snippet.
- [x] **P2** `.agents/OWNERSHIP.md` & root `package.json`: Registered LLM serving (KV Cache/PagedAttention/Continuous Batching), Virtual Waiting Room, and Content-Defined Chunking in `OWNERSHIP.md`, and removed the final `LINK_CHECK_PENDING` entry from root `package.json`.

## Final Gate Evidence (2026-11-20)

- `architecture/system-design`: `mise exec -- npm test` (33/33 pass, 0 fail, 0 skipped), `mise exec -- npm run test:integration` (3/3 clean skip without Redis/Valkey), `typecheck` (exit 0), `lint` (0 warnings/errors), `fmt:check` (exit 0).
- Repository root (`main` after fast-forward merge): `bun tools/check-questions.ts "architecture/system-design/exams/interview.md"` (70/70 questions, 0 issues), `npm run check` (`oxfmt --check`, `oxlint`, `wrap-check`, `table-check`, `link-check` with ZERO pending tracks, `mermaid-check` v11+v12, `katex-check`, `heading-check`) all exit 0.

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 01 (`track/system-design-bytebytego`, 2026-11-20)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (root)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free`, corrected by root for Amdahl/Gustafson variable inversion, shuffle-sharding baseline, and Proof Map alignment)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Challenger Findings Resolved**:
  - [x] **P2** `examples/lib/scaling-models.ts`: separated explicit `trackInflightBoots` from `scaleDownCooldownTicks` and added explicit `sessionStoreFailed` parameter + negative SPOF test in `examples/09-scaling-evolution.test.ts`.
  - [x] **P2** `assets/15-scale-evolution-blueprint.svg` & `assets/15-scaling-2021-vs-2026.svg`: shortened/wrapped overflowing bottom-strip and footer lines and tightened sub-label text widths to fit cleanly inside box bounds.
  - [x] **P2** `modules/15-scale-from-zero-to-millions.md`: deferred formal Amdahl/Gustafson derivation to `algorithms/dsa/modules/14-parallel-algorithms-concurrency-and-interview-execution.md` per `.agents/OWNERSHIP.md`, keeping Gunther's USL full.
  - [x] **P3** `modules/15-scale-from-zero-to-millions.md`, `exams/architect-certs-bridge.md`, `exams/interview.md`: fixed `oxfmt` escaped underscore inside KaTeX (`$N_{\max}$`), clarified `Q-CERT-001` worker-pool shuffle-sharding phrasing, and added exact section `#anchor` links to all 11 new question references.

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 02 (`06. Key-Value Store`, Module 16, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (root)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, corrected by root for bandwidth math, non-English token `local写s`, `tombstables` typo, `examples/lib/kv-store-models.ts` snippet alignment, and added primary-literature matrix + SRE guardrail table)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Challenger Findings Resolved**:
  - [x] **P1 (rejected via primary-source check)** `exams/architect-certs-bridge.md` (`Q-CERT-010`): re-verified against Microsoft Learn Cosmos DB documentation — Session consistency reads from 1 replica while Strong/Bounded Staleness read from a 2-replica quorum (`2×` RU cost); preserved fact and documented the 1-replica vs 2-replica RU mechanism explicitly in Module 16 §3.
  - [x] **P2** `exams/architect-certs-bridge.md` (`Q-CERT-008`, `Q-CERT-010`): updated `Q-CERT-008` anchor to `#51-amazon-dynamo-2007-vs-amazon-dynamodb-20222026` and added Cosmos DB Session consistency teaching paragraph to Module 16 §3 so `Q-CERT-010`'s anchor teaches the tested concept directly.
  - [x] **P2** `exams/interview.md` (`Q-SD-077`): clarified partition recovery step (`A` and `C` recover while `B` remains down and hints `D -> B`, `E -> C` have not drained).
  - [x] **P2** `modules/16-distributed-key-value-store.md`: replaced `->` inside Mermaid edge label with `:` (`"Neither dominates: CONCURRENT"`).
  - [x] **P2/P3** `assets/16-kv-store-architecture.svg` & `assets/16-kv-2021-vs-2026.svg`: folded Multi-Region/Global Tables explicitly into Row 1 of the comparison SVG, aligned vnodes label (`100-256 vnodes (16/Tablets)`) and Merkle bucket label (`Sync B51`) with Module 16.
  - [x] **P3** `examples/10-kv-store.test.ts`, `examples/lib/kv-store-models.ts`, `modules/16-distributed-key-value-store.md`: replaced redundant LWW assertion with deterministic equal-timestamp tie-break test, documented standby hint-queue separation comment, and qualified `> 200x` NIC headroom as cluster-aggregate.
