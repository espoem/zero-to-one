# Challenger Audit: technologies/postgres
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `technologies/postgres`
Date: 2026-10-31

---

# Challenger Audit — `technologies/postgres`

## P0 — Factually wrong or broken; fix before merge

### P0-1. Broken internal module anchor in exam bank (Q-EDB-038)
`exams/edb-postgres-associate-professional.md:614` links `../modules/08-concurrency-mvcc-and-locking.md`, but filename is `modules/08-concurrency-mvcc-and-isolation.md`. Fix link.

### P0-2. Dead cross-track link (Q-EDB-025)
Links `../../technologies/elasticsearch/README.md`, which does not exist. Replace with PostgreSQL-docs-only ref.

### P0-3. `RETURNING OLD / NEW` version claim
Downgrade or verify with primary source PostgreSQL 18 documentation.

### P0-4. `EXPLAIN (ANALYZE)` BUFFERS default
PostgreSQL did not make `BUFFERS` default in `EXPLAIN (ANALYZE)`. Explicitly pass `BUFFERS`.

### P0-5. UUID version history
Correct pre-18 idiom to `gen_random_uuid()` from `pgcrypto` / core, vs `uuidv7()` builtin in 18 (RFC 9562).

### P0-6. Verified against line
Align with verified toolchain versions.

### P0-7. `WAIT FOR LSN` syntax
Correct to function syntax `pg_wait_for_lsn(lsn, timeout)`.

---

## P1 — Significant gaps / unverified claims

### P1-1. `pgcat` missing
Add section on pgcat (transaction pooling + client-side sharding vs PgBouncer) or note out of scope.

### P1-2. PG19 forward-look features
Mark unverified PG19 features with `(unverified)` or move to speculative forward-look section.

### P1-3. `VACUUM (ONLY)`
`ONLY` predates PG18. Correct attribution.

### P1-4. Mermaid checks
Replace `<br/>` in sequence notes with valid text or `#59;`, quote participants.

### P1-5. EDB exam metadata
Cite exam syllabus or note interview-format alignment.

---

## P2 / P3 — Rigor & Polish

- Q-EDB-040: explicitly scope lock conflicts.
- Add GIN pending list cleanup lock details.
- Verify table pipe escaping.
