# Challenger Audit: technologies/solidjs
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `technologies/solidjs`
Date: 2026-10-31

---

# Adversarial Audit — `technologies/solidjs`

## P0 — Blocks correctness / executable proof

### P0-1 Version pin consistency: `rc.19` vs `rc.18`
- `README.md` and module headers cite `2.0.0-rc.19`.
- Verify installed version in `package.json` and lockfile; re-run `npm test` to ensure exact reproduction.

### P0-2 `onFlush` export verification
- Verify `onFlush` in `solid-js` export map or clarify lifecycle primitive naming (`onSettled`, `onCleanup`).

### P0-3 Commit model & read consistency
- Clearly define `read(x)` vs `latest(x)` vs `untrack` vs `flush(fn)` visibility semantics during reactive graph updates.

### P0-4 DAG / acyclicity scope
- Restrict DAG claim to compute graph $C$; note that effects ($F$) writing to signals ($S$) form inter-flush edges.

### P0-5 RC internals citations
- Mark implementation-internal data structures (link lists, bucketed heap) with specific file/commit references or label as RC implementation detail.

---

## P1 — Exam / mental-model validity

### P1-1 Mock domain mix
- Rebalance mock exam domain counts to match claimed 25-question mix.

### P1-2 Add ordering questions
- Add ordering questions (e.g., flush phases, SSR chunk sequencing, reconcile steps).

### P1-3 Solid vs React comparisons
- Qualify claims about stale closures and `use()` caching to accurately reflect modern React 19 mechanics.

---

## P2 / P3 — Rigor & Polish

- Renumber Interview Drill items sequentially in modules 06, 08, 09.
- Run `tools/mermaid-check` on all 15+ diagrams.
- Verify table pipe escaping.
