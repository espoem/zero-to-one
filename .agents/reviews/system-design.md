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

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 03 (`18. Google Maps`, Module 17 + M15 Insight Merge, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (root)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, refined and verified by root)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Stray `main` Module 15 Draft Harvest**: Archived the earlier untracked `opencode-go/deepseek-v4.1-flash` draft from `main` out of the repo and merged its three unique Staff insights (RESP3 client-side invalidation tracking, Patroni-managed quorum failover, and dual-controller autoscaler conflict plus DNS negative caching) into `modules/15-scale-from-zero-to-millions.md`.
- **Challenger Findings Resolved**:
  - [x] **P1** `modules/17-google-maps.md` & `exams/interview.md` (`Q-SD-083`): corrected super-tile chain length and incident lookup bounds from "`~4–8` / `<= 15`" to the exact quadtree bound $z_{\text{base}} - z_{\text{enclosing}} + 1 \le z_{\text{base}} + 1$ (`6–9` typical metro, `<= 22` at zoom `21`).
  - [x] **P1** `examples/lib/maps-models.ts`, `examples/11-maps-routing.test.ts`, `modules/17-google-maps.md`: implemented Stage 2 exact route-edge overlap filtering (`findImpactedUsers`) alongside Stage 1 coarse super-tile prefiltering (`findCandidateUsers`), and proved `driver-bay` matches while `driver-golden-gate` (shared root, disjoint edges) and `driver-nyc` (different root) are excluded.
  - [x] **P2** `modules/17-google-maps.md`: synced inline `SuperTileRoutingIndex` code snippet verbatim with `examples/lib/maps-models.ts`.
  - [x] **P2** `examples/lib/maps-models.ts`, `examples/11-maps-routing.test.ts`, `modules/17-google-maps.md`: labeled `snapGpsPoint` explicitly as a single-step emission + heading/continuity proxy while documenting full $O(T \cdot S^2)$ Viterbi decoding across $T$ fixes.
  - [x] **P2** `.agents/OWNERSHIP.md`: registered newly introduced Module 17 concepts (Web Mercator tile pyramid, CRP/CH routing tiles, HMM map matching, GNN Supersegment ETA, hierarchical super-tile reroute index) plus Module 15/16 deltas.
  - [x] **P2/P3** `assets/17-google-maps-architecture.svg`: fixed Box B complexity label from `O(1)` to `O(depth)` ancestor lookups + `6-9 metro / <= z_base+1 max`, and shortened zoom-strip bullets so all text sits comfortably inside box bounds.
  - [x] **P3** `exams/architect-certs-bridge.md` (`Q-CERT-014`): aligned shard sizing with Module 17's `1.16M/s` peak (`~1,160` shards) and cited the `1 MB/s/shard` throughput limit alongside `1,000 rec/s/shard`.
  - [x] **P3** `modules/17-google-maps.md` & `examples/lib/maps-models.ts`: fixed malformed `_*A* Speedup..._*` Proof Map markup and tightened `latLonToTile` zoom bound to `[0, 21]`.

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 04 (`19. Distributed Message Queue`, Module 18, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (root)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, expanded and corrected by root to remove leaked CJK token `分裂`, fix KIP-848 vs KIP-98 attribution, escape dollar amounts, and sync verbatim TS proofs)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`, aligned Q-SD-088 cross-AZ totals and official Kafka docs anchor)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Challenger Findings Resolved**:
  - [x] **P0 (false-positive XML escape, valid P1 overflow)** `assets/18-mq-2021-vs-2026.svg:104`: `&lt; 3.9` was already XML-escaped (`xmllint` clean), but the 173-char footer text risked clipping in the 1120 px strip; shortened footer copy cleanly inside bounds.
  - [x] **P1** `modules/18-distributed-message-queue.md`: renamed `firstTimestamp` to `baseTimestamp` and added missing `maxTimestamp (8 B)` row to the `RecordBatch` wire table (`61 B` fixed header).
  - [x] **P1/P3** `assets/18-message-queue-architecture.svg`: shortened Section 2 title and bottom cloud-economics lines to eliminate container overflow, and spelled out `replica.lag.time.max.ms`.
  - [x] **P2** `examples/lib/message-queue-models.ts` & `examples/12-message-queue.test.ts`: upgraded `reconcileReplica` to iterative multi-epoch KIP-101 `OffsetsForLeaderEpoch` lookup and replaced the hand-forced HWM test with authentic lagged-HWM data-loss + multi-epoch divergence proofs.
  - [x] **P2** `examples/lib/message-queue-models.ts` & `examples/12-message-queue.test.ts`: replaced unbounded `log.find()` with a bounded `O(1)` 5-sequence `Map` matching KIP-98 `max.in.flight.requests.per.connection <= 5`, and tested both in-window dedupe and evicted-sequence rejection.
  - [x] **P2** `examples/lib/message-queue-models.ts`, `examples/12-message-queue.test.ts`, `modules/18-distributed-message-queue.md`: added exact `delay = 16` revolution-boundary test to `HierarchicalTimingWheel`, removed unused `nowTick` getter (`slop-guard`), synced inline `readByOffset` snippet verbatim with source, and qualified KIP-405 (`2020`, EA in `3.6`) and KIP-932 (`EA/Preview` in `4.x`).
  - [x] **P3** `exams/interview.md` & `exams/architect-certs-bridge.md`: updated header scope counts to `90` (`Q-SD-001`–`Q-SD-090`) and `24` (`Q-CERT-001`–`Q-CERT-024`).

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 05 (`22. Hotel Reservation System`, Module 19, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (`argon-builder`)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, expanded from 289 to 532 lines by `argon-builder` with full SQL DDL, half-open `[checkIn, checkOut)` vs `BETWEEN` table, SRE guardrails, and verbatim TS proofs)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`, corrected `Q-SD-094` ordering options and `Q-SD-095` / `Q-CERT-030` multi-answer formatting)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Challenger Findings Resolved**:
  - [x] **P1** `assets/19-hotel-architecture.svg`: shortened Section 4 `BUG`/`FIX` SQL callout headers and Section 2 `Reservation & Inventory Svc` title so all text sits comfortably inside box boundaries with zero overflow.
  - [x] **P1** `examples/lib/hotel-models.ts`, `examples/13-hotel-reservation.test.ts`, `modules/19-hotel-reservation-system.md`: upgraded `canonicalReservationHash` to a true 64-char SHA-256 hex digest (`node:crypto` `createHash('sha256')`), added `PENDING_PAYMENT` status and `confirmPayment()` to model the full `PENDING_PAYMENT -> CONFIRMED / CANCELLED` Temporal Saga lifecycle, and synced the inline `reserve()` snippet verbatim.
  - [x] **P1/P2** `examples/lib/hotel-models.ts`, `examples/13-hotel-reservation.test.ts`, `modules/19-hotel-reservation-system.md`, `exams/interview.md` (`Q-SD-092`): upgraded `simulateConcurrentLockOrder` to a step-by-step multi-row lock acquisition and circular-wait detector with non-empty input validation (`RangeError`), sorted `reserve()` by full composite key `hotel_id:room_type_id:date`, tested both 2-night and 3-night partial-overlap deadlocks, and scoped the deadlock-elimination guarantee to uniform `(hotel_id, room_type_id, date)` row-lock granularity.
  - [x] **P1** `exams/architect-certs-bridge.md` (`Q-CERT-025`): aligned the `30,000 QPS` / `300,000 QPS` OTA scenario stem with `~5,000,000` properties (`1,000x` a 5,000-hotel chain).
  - [x] **P2** `modules/19-hotel-reservation-system.md`, `GLOSSARY.md`, `exams/interview.md` (`Q-SD-095`), `exams/architect-certs-bridge.md`, `assets/19-hotel-architecture.svg`: attributed the overbooking vs. walk-penalty critical fractile to Beckmann (1958) / Rothstein (1971) alongside Littlewood (1972) and Belobaba's $EMSR_b$ (1989), unified walk-penalty range at `$350–$600`, derived the `~7.3B–73B` OTA row band (`5M properties × 2–20 room types × 730d`), and normalized overbooking cap expressions to integer `(total_inventory * 110) / 100`.

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 06 (`23. Distributed Email Service`, Module 20, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (`argon-builder`)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, expanded from 320 to 468 lines by `argon-builder` with complete CQL schemas, DMARC/ARC decision matrix, SRE guardrails, and verbatim TS proofs)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`, integrated as `Q-SD-096`–`100` in `exams/interview.md` and `Q-CERT-031`–`036` in `exams/architect-certs-bridge.md`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Challenger Findings Resolved**:
  - [x] **P1** `modules/20-distributed-email-service.md`: corrected RFC 6154 special-use role sample and CQL comment (`INBOX` is the base protocol mailbox; RFC 6154 defines `\All`, `\Archive`, `\Drafts`, `\Flagged`, `\Junk`, `\Sent`, `\Trash`).
  - [x] **P1** `examples/lib/email-models.ts` & `examples/14-email-service.test.ts`: made `normalizeOrgDomain()` public-suffix (`eTLD+1`) aware for multi-label ccTLDs (`.co.uk`, `.com.au`, etc.) and added a negative test proving `evil.co.uk` cannot spoof `bank.co.uk` under `relaxed` DMARC.
  - [x] **P1** `examples/lib/email-models.ts` & `examples/14-email-service.test.ts`: fixed `ContentAddressedAttachmentStore.putAttachment()` to release the previous blob reference when an existing `(userId, emailId, filename)` attachment slot is overwritten with different content, and verified overwrite reclamation in both unit and `fast-check` property tests.
  - [x] **P2** `examples/lib/email-models.ts` & `examples/14-email-service.test.ts`: sorted input messages chronologically by `(timestampMs ASC, messageId ASC)` inside `reconstructThreadTree` so parent linking and cycle breaking are strictly independent of network arrival order.
  - [x] **P2** `examples/lib/email-models.ts` & `examples/14-email-service.test.ts`: replaced lifetime cumulative counters in `DeliverabilityPoolGuard` with a bounded rolling sliding window of FBL batches (`maxRollingBatches`), proving both circuit-breaker trip on `>= 0.3%` complaints and automatic rolling recovery.
  - [x] **P2** `assets/20-email-architecture.svg`: shortened Step 2 and Step 4 lines inside the `433px` send/receive boxes so all text sits cleanly inside container boundaries with zero overflow.
  - [x] **P2/P3** `modules/20-distributed-email-service.md` & `exams/interview.md` (`Q-SD-096`): distinguished system-flag bitmasks from dynamic `label_ids` sets in the Bigtable/Spanner Gmail comparison, stated $O(1)$ partition lookup plus $O(K)$ sequential clustering scan for $K$ unread messages, and clarified `+33.33%` Base64 expansion over raw binary (`25%` of the encoded `25 MB` wire payload).

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 07 (`25. Real-time Gaming Leaderboard`, Module 21, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (`argon-builder`)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, expanded from 330 to 463 lines by `argon-builder` with 64-bit `OBJ_ENCODING_SKIPLIST` byte breakdown, 53-bit IEEE-754 safe integer tie-breaking proofs, Score-Range vs Hash Sharding vs 32-way Write-Sharded DynamoDB GSI architecture, SRE guardrails, and verbatim TS code)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`, integrated as `Q-SD-101`–`105` in `exams/interview.md` and `Q-CERT-037`–`042` in `exams/architect-certs-bridge.md`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Challenger Findings Resolved**:
  - [x] **P0** `modules/21-realtime-gaming-leaderboard.md` & `examples/15-leaderboard.test.ts`: unified the `100x` planetary scale-out tier at `500M DAU / 500M+ active seasonal members (MAU)` so `MAU >= DAU` holds everywhere and `500M × 128 B = 64.0 GB` active ZSET RAM (`128.0 GB` with `2×` `fork()` CoW headroom) is consistent across Section 1, the sizing table, Section 4, `Q-SD-103`, `21-leaderboard-architecture.svg`, and `15-leaderboard.test.ts`.
  - [x] **P1** `modules/21-realtime-gaming-leaderboard.md`: corrected the single-node Valkey CPU headroom ratio from `> 30x` to `~14x–21x` over combined peak read+write load (`~5,787 ops/s` vs `80k–120k ops/s`, or `~28x–41x` over peak writes alone).
  - [x] **P1** `modules/21-realtime-gaming-leaderboard.md`: explicitly noted the reverse-lexicographical tie-break adjustment (`otherId > userId`) on equal-millisecond composite scores alongside the `ZCOUNT(shard_i, (s, +inf))` hash-shard global rank formula, matching `HashShardedLeaderboard.getGlobalRank`.
  - [x] **P1** `modules/21-realtime-gaming-leaderboard.md`: added an explicit bit-budget delta callout contrasting Module 21's `21-bit score + 32-bit milliseconds` (`2^32` divisor, 1 ms resolution over `~49.71 days`) against Module 09 §5.1's `28-bit score + 25-bit seconds` (`2^25` divisor, 1 s resolution over `~1.06 years`).
  - [x] **P2** `modules/21-realtime-gaming-leaderboard.md` & `examples/lib/leaderboard-models.ts`: qualified Score-Range Top-$K$ zero scatter-gather with early-season spillover when the top bracket holds $< K$ players (matching `RangeShardedLeaderboard.getTopK`), and unexported internal helper interfaces in `leaderboard-models.ts` per `slop-guard`.

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 08 (`16. Proximity Service`, Module 22, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (`argon-builder`)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, expanded from 317 to 549 lines by `argon-builder` with 1D B-tree band-intersection + spherical $\cos(\phi)$ bounding-box proofs, 5-option / 6-engine spatial index matrix, compound `geospatial_index` + PostGIS 3.5+ `GiST` DDL, Two-Tier Geohash Cache math, GDPR/CCPA $k$-anonymous privacy architecture, SRE guardrails, and verbatim TS code)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1`, integrated as `Q-SD-106`–`110` in `exams/interview.md` and `Q-CERT-043`–`048` in `exams/architect-certs-bridge.md`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported zero P0 and zero P1 issues)
- **Challenger Findings Resolved**:
  - [x] **P2** `assets/22-proximity-architecture.svg`: shortened the 9 lines inside Section 2 (`x=318`, width `437px`) so all text sits cleanly inside container boundaries with zero overflow.
  - [x] **P2** `modules/22-proximity-service.md`: clarified that the `~32 B/entry` (`19.20 GB`) Tier 1 Valkey estimate models packed 64-bit integer sets (`intset`/`listpack` on a dedicated Tier 1 cluster separate from the Tier 2 detail cache, vs `~24–36 GB` for `sds` sets), and noted that the `16 B/POI` (`~3.5–4.5 GB`) Point Quadtree footprint assumes packed C++/Rust structs compared to V8 heap objects in the TypeScript reference proof.
  - [x] **P3** `modules/22-proximity-service.md`, `examples/16-proximity-service.test.ts`, `exams/architect-certs-bridge.md`: fixed `Mandlebrot` -> `Mandelbrot` typo, unified Quadtree RAM range at `~3.5–4.5 GB`, aligned Test 4 title to `>95%` hit rate, and cleaned up `Why not B:` distractor label in `Q-CERT-045`.

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 09 (`17. Nearby Friends`, Module 23, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (`argon-builder`)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, expanded from 378 to 532 lines by `argon-builder` with static-vs-moving comparison matrix, `333.3k -> 13.33M` fan-out & CPU-vs-RAM derivations, legacy Redis Cluster `PUBLISH` $O(N)$ broadcast trap vs Valkey `SPUBLISH` and `etcd` consistent-hash ring proofs, Cassandra `TWCS` DDL, 9-cell Geohash random discovery diagram, anti-trilateration distance bucketing, SRE guardrails, and verbatim TS code)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1` from `/tmp`, integrated as `Q-SD-111`–`115` in `exams/interview.md` and `Q-CERT-049`–`054` in `exams/architect-certs-bridge.md`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported zero P0 and zero P1 issues)
- **Challenger Findings Resolved**:
  - [x] **P2** `modules/23-nearby-friends.md:345`: fixed `millones` typo to `millions`.
  - [x] **P2** `modules/23-nearby-friends.md:72,390` & `assets/23-nearby-friends-architecture.svg:161`: updated Erlang/BEAM process initial footprint from `~300 bytes` to `~300 words (~2.4 KB on 64-bit)`.
  - [x] **P2/P3** `examples/lib/nearby-friends-models.ts` & `modules/23-nearby-friends.md`: added `exitRadiusMeters` hysteresis deadband support to `NearbyFriendsPubSubRouter` (and synced the inline snippet verbatim), clarified `44.67M` (`134` nodes) vs `46.67M` (`140` nodes) cluster-bus broadcast figures in the Proof Map, and updated `CHEATSHEET.md` #54 denominator to `~1/(N+1)`.

---

## ByteByteGo & Primary-Source Expansion — Wave A Topic 10 (`27. Digital Wallet`, Module 24, 2026-11-21)

- **Coordinator / Integrator / SVG & Proof Author**: Antigravity (`argon-builder`)
- **Prose Draft**: `opencode` (`opencode-go/hy4-flash-free` from `/tmp --auto`, expanded from 420 to 461 lines by `argon-builder` with `1M` transfer TPS $\to$ `2M` leg-TPS sizing across `100 / 1,000 / 10,000 / 100,000` TPS/node tiers, `BigInt` minor-unit wire contract + SHA-256 payload mismatch binding, 6-stage distributed transaction evolution, TC/C debit-first/`NOP` Phase 1 invariant + `out_of_order_flag` Hanging-Try tombstones, deterministic Event Sourcing over Multi-Raft `mmap` logs + RocksDB LSM state + HDFS/S3 Object Lock snapshots, Push-Based Reverse Proxy CQRS, SRE guardrails, and verbatim TS code)
- **Exam & Cert Bridge Questions Draft**: `claude` CLI (`haiku`, `--max-turns 1` from `/tmp`, integrated as `Q-SD-116`–`120` in `exams/interview.md` and `Q-CERT-055`–`060` + the 60-Question Timed Certification Bridge Mock Exam in `exams/architect-certs-bridge.md`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family)
- **Challenger Findings Resolved**:
  - [x] **P0** `examples/lib/wallet-models.ts` & `examples/18-digital-wallet.test.ts`: guarded `TccTransferCoordinator.cancelPhase` against cancelling a transaction after `secondPhase === 'CONFIRM'` (`ALREADY_CONFIRMED`), preventing a late cancel from refunding sender $A$ after receiver $C$ was credited.
  - [x] **P0** `examples/lib/wallet-models.ts`, `modules/24-digital-wallet.md` & `examples/18-digital-wallet.test.ts`: added `computeTransferPayloadSha256` binding `(transactionId, payloadSha256)` across `TccTransferCoordinator`, `EventSourcedWalletMachine`, and `ShardedRaftWalletCluster` (returning `IDEMPOTENCY_PAYLOAD_MISMATCH` on mutated retries), and synced the verbatim TS excerpts in `24-digital-wallet.md`.
  - [x] **P0 & P1** `examples/lib/wallet-models.ts`: eliminated intermediate `__escrow_*__` accounts in `ShardedRaftWalletCluster.executeTransfer` in favor of direct single-leg `processShardLegCommand` validation on each shard's Raft Leader followed by `applyReplicatedEvents` on Raft Followers (so only the Leader validates Commands, Followers apply only replicated immutable Events, and `getTotalClusterSupply` sums all accounts across all shards with zero phantom leakage).
  - [x] **P1–P3** `modules/24-digital-wallet.md`, `examples/lib/wallet-models.ts` & `exams/interview.md`: made `tryStatus === 'FAILED'` terminal (`TRY_ALREADY_FAILED`), separated `TRY_NOT_FOUND` vs `TRY_NOT_SUCCEEDED`, enforced signed 64-bit integer ceiling in `parseExactDecimalToMinorUnits`, isolated genesis seed IDs with `\0seed:`, documented the `fsync` split between the Raft `mmap` event log and derived RocksDB state (`WriteOptions.sync = false`), listed all 4 node-sizing tiers (`20k / 2k / 200 / 20`) in the summary and Q1, and unified `POST /v1/wallet/balance_transfer` in `Q-SD-119`.

---

## ByteByteGo & Primary-Source Expansion — Wave B Batch 1 (`03. System Design Framework` -> M01, `02. Back-of-the-Envelope Estimation` -> M02, `07. Unique-Id Generator` -> M04, 2026-11-21)

- **Coordinator / Integrator**: Antigravity (`argon-builder`)
- **Batch Workers (`swarm` share worktrees)**: `wb1-m01` (`665aa32`), `wb1-m02` (`9851d43`), `wb1-m04` (`f3b1b3d`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported zero P0s, 1 P1, 5 P2s, 4 P3s; verified PG18 `uuidv7()` live against `postgresql.org/docs/18/functions-uuid.html`)
- **Challenger Findings Resolved**:
  - [x] **P1** `modules/04-api-design-data-modeling-and-id-generation.md:442`: replaced volatile `ADD COLUMN new_id uuid DEFAULT uuidv7()` (which triggers a full table rewrite under `ACCESS EXCLUSIVE` lock) with a metadata-only nullable `ADD COLUMN new_id uuid`, single dual-write source + chunked backfill, `SET DEFAULT uuidv7()`, and `NOT VALID` check-constraint promotion to `NOT NULL`.
  - [x] **P2** `modules/02-back-of-the-envelope-estimation.md:382`: harmonized PostgreSQL write ceiling (`<= 10,000` comfortable / `~15,000` max) and softened `7,000` write TPS to warranting Kafka/sharding burst headroom rather than violating single-node physics.
  - [x] **P2** `modules/01-framing-requirements-and-delivery.md:53-55` & `assets/02-latency-and-scale-ladder.svg:62`: explicitly labeled `30.44 d` calendar month vs `30-day` (`720 h`) SRE burn-rate basis, and reconciled NVMe/L1/TTFT range notes in `02-latency-and-scale-ladder.svg`.
  - [x] **P2/P3** `modules/04-api-design-data-modeling-and-id-generation.md:297-298`: clarified Sonyflake `2014 (default epoch)` and linked official PostgreSQL 18 `functions-uuid.html` documentation.

---

## ByteByteGo & Primary-Source Expansion — Wave B Batch 2 (`05. Consistent Hashing` -> M06, `04. Rate Limiter` -> M08, `20. Metrics Monitoring & Alerting` -> M11/M13, 2026-11-21)

- **Coordinator / Integrator**: Antigravity (`argon-builder`)
- **Batch Workers (`swarm` share worktrees, `gemini-3.8-flash-high`)**: `wb2-m06` (`8296a15`), `wb2-m08` (`721aba2`), `wb2-m11` (`82cdadf`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported zero P0s, 2 P1s, 7 P2s, 3 P3s)
- **Challenger Findings Resolved**:
  - [x] **P1** `modules/11-reliability-slos-observability-and-dr.md:302` & `modules/13-canonical-designs-realtime-geo-and-streams.md:338`: reconciled `10M` base series (`100` base host metrics/host) vs `300M` active series (`3,000` series/host including `~30×` container + `le` histogram-bucket expansion).
  - [x] **P1 & P3** `modules/11-reliability-slos-observability-and-dr.md:326-330` & `examples/07-slo-burn-rates-and-health.test.ts:189-201`: updated 1m/1h downsampling calculations to account for 4-field rollups (`sum, count, min, max` $\implies$ `2.37 TB` warm + `480 GB` cold + `828.58 GB` hot = `~3.68 TB` sample payload), and cross-linked the inverted label postings RAM caveat.
  - [x] **P2** `modules/06-scaling-reads-writes-and-partitioning.md:149,570` & `assets/06-consistent-hashing-ring.svg:223-229`: fixed `1/(N+1)` stay / `N/(N+1)` move (`~90.9%` at `N=10`) and `K/(N+1)` consistent-hashing fraction, and shortened Card 3 lines in `06-consistent-hashing-ring.svg` to eliminate text overflow.
  - [x] **P2 & P3** `modules/08-rate-limiting-load-shedding-and-resilience.md`: retitled `Retry-After` (RFC 9110 §10.2.3) vs `draft-ietf-httpapi-ratelimit-headers`, corrected Sliding Window Counter boundary error bound, clarified `SET ... NX EX` + `INCR` (leak-free vs Lua atomicity), reconciled `2W` vs GCRA `period + tau` TTLs, and scoped `503` SDK retry wording.
  - [x] **P2** `modules/11-reliability-slos-observability-and-dr.md:417`: clarified `1.37 B/sample` is combined `(timestamp, float64)` average (`~11.7×` over 16 B).

---

## ByteByteGo & Primary-Source Expansion — Wave B Batch 3a (`08. URL Shortener` -> M12 §1, `11. News Feed` -> M12 §2, `14. YouTube` -> M12 §3, 2026-11-21)

- **Coordinator / Integrator**: Antigravity (`argon-builder`)
- **Batch Workers (`swarm` share worktrees, `gemini-3.8-flash-high`, disjoint SVGs + scratch fragments)**: `wb3a-url` (`b6ba27b`), `wb3a-feed` (`2a249cd`), `wb3a-yt` (`bfe6b6e`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported 1 P0, 3 P1s, 3 P2s, 4 P3s; independently verified Base62 `2009215674938 <-> zn9edcu`, RFC 9110 codes, News Feed & YouTube sizing)
- **Challenger Findings Resolved**:
  - [x] **P0** `modules/12-canonical-designs-read-heavy-and-content.md:78`: replaced bare `$|\Sigma| = 62$` inside Markdown table with `$\lvert\Sigma\rvert = 62$` so `table-check` passes with 0 failing rows.
  - [x] **P1** `modules/12-canonical-designs-read-heavy-and-content.md:294` & `assets/12-news-feed-architecture.svg:158-159`: unified News Feed timeline RAM sizing at `48 B/entry` with Redis/Valkey overhead (`24 KB/user` $\to$ `240 GB` at 10M DAU, `12 TB` at 500M DAU) and fixed `Bounded: top 500 IDs` in SVG.
  - [x] **P1** `modules/12-canonical-designs-read-heavy-and-content.md:560,628`: explicitly labeled §3.2 (`500M-DAU` production model) vs §3.7 (`BBG 5M-DAU` interview baseline) and added the `100×` uncached egress bridge (`$150k/day -> ~$15M/day`).
  - [x] **P1 & P2 & P3** `modules/12-canonical-designs-read-heavy-and-content.md:28,63-67,173`: standardized on 42-bit Feistel cycle-walking modulo $62^7$, gave exact region partition counts for both `2^41` bit-masking (`2^38`) and modulo-$62^7$ range routing (`440,201,832,576`), aligned `307`/`308` (`302` legacy alias) recommendation, and renamed Mermaid label to `Permuted Integer (< 62^7)`.
  - [x] **P2 & P3** `modules/12-canonical-designs-read-heavy-and-content.md:358,400,474` & `assets/12-url-shortener-architecture.svg`: fixed 10M DAU read QPS (`~579/s` at 5 loads/day), noted `8-node` (`4` masters + `4` replicas) Redis cluster, labeled `mergeHybridFeed` as simplified illustration, and shortened lines in `12-url-shortener-architecture.svg` to eliminate overflow.

---

## ByteByteGo & Primary-Source Expansion — Wave B Batch 3b (`15. Google Drive` -> M12 §4, `09. Web Crawler` -> M12 §5, `13. Search Autocomplete` -> M12 §6, 2026-11-21)

- **Coordinator / Integrator**: Antigravity (`argon-builder`)
- **Batch Workers (`swarm` share worktrees, `gemini-3.8-flash-high`, disjoint SVGs + scratch fragments)**: `wb3b-drive` (`69d0b75`), `wb3b-crawler` (`e5a31df`), `wb3b-auto` (`90b58da`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported 0 P0, 3 P1s, 4 P2s, 3 P3s)
- **Challenger Findings Resolved**:
  - [x] **P1** `modules/12-canonical-designs-read-heavy-and-content.md:1597-1599`: corrected Mid-tier Search Autocomplete QPS (`100M * 8 * 6 / 86,400 = 55,556 ~ 56k avg`, `~155k peak` at `2.8×`) and Daily Log Growth (`2.0 GB/day` = `12.5%` of `16 GB`).
  - [x] **P1 & P2 & P3** `modules/12-canonical-designs-read-heavy-and-content.md:1107` & `assets/12-web-crawler-frontier.svg:232`: separated logical uncompressed HTML (`40 MB/s`) from `~25 KB` gzipped wire ingress (`10 MB/s` / `~80 Mbps` avg, `~240 Mbps` peak), fixed footer peak range (`800–12,000 QPS`), and labeled storage scales (`1.5 PB` 1B/mo vs `3.65 PB` 10B/mo net-new).
  - [x] **P2** `modules/12-canonical-designs-read-heavy-and-content.md:1136-1137`: moved `($F_1 \dots F_k$)` and `($B_1 \dots B_m$)` outside `**bold**` spans.
  - [x] **P2** `modules/12-canonical-designs-read-heavy-and-content.md:1600`: reconciled `15–25 GB` (FST-compressed / 30–50M hot prefixes) vs `50 GB` (100M uncompressed prefixes).
  - [x] **P2** `modules/12-canonical-designs-read-heavy-and-content.md:891`: updated Google Drive notification server count to `100–200` servers for `50M–100M` idle connections (`~500k` conn/server).
  - [x] **P3** `modules/12-canonical-designs-read-heavy-and-content.md:1388` & `assets/12-autocomplete-trie-architecture.svg:38`: replaced `\lfloor 3/4 \rfloor = 0` with clean pigeonhole implication, and added Enterprise `116k/350k QPS` to the Autocomplete SVG header.

---

## ByteByteGo & Primary-Source Expansion — Wave B Batch 4 (`12. Chat System` -> M13 §1, `10. Notification System` -> M13 §2, `21. Ad Click Event Aggregation` -> M13 §4, 2026-11-21)

- **Coordinator / Integrator**: Antigravity (`argon-builder`)
- **Batch Workers (`swarm` share worktrees, `gemini-3.8-flash-high`, disjoint SVGs + scratch fragments)**: `wb4-chat` (`13d31f1`), `wb4-notif` (`d9e424a`), `wb4-adclick` (`52f192a`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported 0 P0, 3 P1s, 4 P2s, 5 P3s)
- **Challenger Findings Resolved**:
  - [x] **P1** `assets/13-chat-architecture.svg:28`: updated header from `50M DAU` to `500M DAU · 100M Sockets` matching M13 §1.2.
  - [x] **P1** `modules/13-canonical-designs-realtime-geo-and-streams.md:15,90`: aligned §1.1/§1.5 to the bifurcated group-cap invariant (`<= 100` small-group push, `500–1,024` shared-log interactive, `100k+` broadcast).
  - [x] **P1** `modules/13-canonical-designs-realtime-geo-and-streams.md:242`: aligned multi-device sync formula to per-conversation cursor `NewMessages(conv) = { m in ConversationLog[conv] | m.seq_id > after_seq }`.
  - [x] **P2** `modules/13-canonical-designs-realtime-geo-and-streams.md:126,130,1008`: softened RFC 9420 MLS scale claim to `thousands (design target tens of thousands)`, separated `((channel_id, bucket), seq_id)` ordering from UUIDv7 `message_id` dedupe, and clarified `Kappa serving path + independent batch billing audit`.
  - [x] **P2 & P3** `assets/13-ad-click-aggregation-pipeline.svg`, `assets/13-chat-architecture.svg` & `modules/13`: shortened Panel C lines in `13-ad-click-aggregation-pipeline.svg` (`<= 9px`, zero overflow), updated `Persist ((chan, bucket), seq_id)` & `F <= 500` in `13-chat-architecture.svg`, added ASCII/UTF-8 payload nuance (`~100 KB ASCII; ~400 KB UTF-8`), labeled `~1.04 PB raw/mo -> ~250 TB Parquet/mo`, and distinguished `20M/s` heartbeat writes vs `555k/5.55M/s` status-change fan-out.

---

## ByteByteGo & Primary-Source Expansion — Wave B Batch 5 FINAL (`26. Payment System` -> M14 §2, `28. Stock Exchange` -> M14 §3, `24. S3-like Object Storage` -> M14 §5, 2026-11-21)

- **Coordinator / Integrator**: Antigravity (`argon-builder`)
- **Batch Workers (`swarm` share worktrees, `gemini-3.8-flash-high`, disjoint SVGs + scratch fragments)**: `wb5-pay` (`373342d`), `wb5-exch` (`03f586e`), `wb5-s3` (`a8600ce`)
- **Independent Cross-Family Challenger**: `opencode` (`opencode-go/muse-spark-1.3-contributor`, `muse` family — reported 4 P0s, 11 P1s, 7 P2s, 6 P3s)
- **Challenger Findings Resolved**:
  - [x] **P0-1 & P1-1** `modules/14-canonical-designs-transactional-and-staff.md`: repaired unescaped Python control characters (`\x07pprox`, `\x08inom`, `\x0crac`, `\text`, `\times`) in §5.7–§5.8, replaced 6 forbidden `\operatorname` macros with `\mathrm{...}`, and replaced `\text{shard\_id}` underscores with hyphens (`katex-check`: 190/190 passing).
  - [x] **P0-2, P0-3, P0-4** `modules/14-canonical-designs-transactional-and-staff.md` (§2): disambiguated `150 GB/day` (`55 TB/yr` ledger-only) vs `270 GB/day` (`98.6 TB/yr` total incl. events, orders, and `1.5×` B-Tree indexes), aligned §2.5 journal signs (`DEBIT (+)` / `CREDIT (-)`) with §2.8, and labeled §2.5 as a `2.9%` flat-fee rounding demo vs §2.8's `2.9% + $0.30` full take-rate.
  - [x] **P1-2, P1-3, P1-4** `modules/14-canonical-designs-transactional-and-staff.md` & `assets/14-stock-exchange-architecture.svg` (§3): clarified `99.99%` baseline vs `99.999%` Tier-1 target (`< 864 ms/day`, `RTO < 10 ms`, `RPO = 0`), recomputed exact FIX 4.2 body length (`9=130`) and checksum (`10=046`), and added Flaw 1b (double `limitIter.next()` advance) to the ByteByteGo/liquidslr `match()` bug exposé.
  - [x] **P1-5, P1-6, P1-7** `modules/14-canonical-designs-transactional-and-staff.md` (§5): labeled the `8+4` binomial sum as a naïve annual-simultaneous upper bound with repair-window Markov scaling and correlated-failure disclaimer, reconciled `100 PB` gross (`40%` active = `40 PB` stored / `60 PB` raw) vs `100 PB` net usable (`150 PB` raw), and explicitly scoped `§5.6–§5.9` to S3-Like Object Storage with a cross-link to [Module 08](../../architecture/system-design/modules/08-rate-limiting-load-shedding-and-resilience.md) for Rate Limiter evolution.
  - [x] **P1-8, P1-9, P1-10, P1-11** `modules/14` & `assets/14-payment-system-architecture.svg` (§2): fixed SVG payload to `amount: "1999" (minor units; parse BigInt)`, retitled the HPP workflow to `11-Step`, standardized idempotency scope (`(merchant_id, idempotency_key)` at ingress; `payment_order_id` as PSP nonce), and set sustained peak surge to `k_surge = 5` (`~5,787 TPS`, keeping `10,000 TPS` as Black-Friday burst ceiling).
  - [x] **P2 & P3** `modules/14` & `assets/14-*.svg`: clarified `5 -> 5a/6/7` bus fan-out and strict read-from-primary PG vs Raft SQL in `14-payment-system-architecture.svg`, refined cache wording to `L3-resident, L2-tiled per price level`, added GCRA `SET PX` sub-ms rounding note, added Staff Edge-Case Checklists across §2/§3/§5, replaced `SHA-1` with `CRC32C, CRC64NVME, SHA-256` in `14-s3-2021-vs-2026.svg`, and removed all duplicated-word typos.
