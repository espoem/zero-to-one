# Challenger Audit: architecture/data-systems
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `architecture/data-systems`
Date: 2026-10-31

---

## P0 — Factually wrong, must fix before merge

### P0-1 Inverted normal-form containment
- `README.md:31`, `exams/interview.md:83`:
  `$1\text{NF} \subset 2\text{NF} \subset 3\text{NF} \subset \text{BCNF} \subset 4\text{NF} \subset 5\text{NF}$`
- Wrong direction. Stronger = fewer relations satisfy. Correct: `$5\text{NF} \subset 4\text{NF} \subset \text{BCNF} \subset 3\text{NF} \subset 2\text{NF} \subset 1\text{NF}$`.
- Fix both places + `README.md:31` Module-01 bullet.

### P0-2 Q-DATA-024 linear isolation order is false
- `exams/interview.md:379-396`: `RU → RC → SI → RR → Serializable`, claim “SI prevents Lost Update, whereas ANSI RR does not.”
- Berenson/Adya + Postgres docs: SI and ANSI RR are incomparable; in PostgreSQL `REPEATABLE READ` *is* SI. SI prevents `G0/G1/P4` but allows `G-skew`; ANSI RR prevents `A2/A3` but allows `G1/P4` in spec. Cannot linearly order.
- Fix: replace ordering with partial order diagram, note `PG-RR ≡ SI`, or split into ANSI vs Postgres-SI tracks. Rewrite “Why not” explanation.

---

## P1 — AGENTS.md compliance / broken refs / unverified versions

### P1-1 Unverified toolchain versions
- `README.md:3`: `Verified against Node 26.12.1, TypeScript 7.0.2 on 2026-10-30`
- vs `.mise.toml:1-3`: `node="26"`, `package.json:14-18`: `typescript 7.0.2`, `@types/node 26.6.6`.
- `26.12.1` / `@types/node 26.6.6` unverified vs primary sources (nodejs.org, npm registry, `mise.lock`). `node="26"` does not reproduce `26.12.1`. Date is T-1 from today.
- Fix: `mise.lock` pin exact, verify, or mark `(unverified)` per Version Currency §4.

### P1-2 All Domain-01 anchors broken
- `exams/interview.md:21,37,52,67,85` point to `#relational-algebra-formal-algebraic-primitives`, `#functional-dependencies-and-normal-forms-1nf-through-bcnf`, `#schema-on-write-vs-schema-on-read`, `#higher-normal-forms-4nf-5nf-and-denormalization-tradeoffs`
- `modules/01-data-models-and-query-languages.md:7,73,159` actual headings: `## 1. Formal Foundations...`, `## 2. Normalization Theory...`, `## 4. Schema-on-Read versus...`. No such anchors. No 4NF/5NF section at all.
- Fix: retarget anchors or add missing `## Higher Normal Forms (4NF/5NF)` + Datalog sections.

### P1-3 Slotted-page example in wrong domain
- `README.md:31` + `exams/README.md:Domain 01 row`: `01-slotted-page.test.ts` listed under Data Models / Module-01.
- Slotted pages belong Module-02 / Domain-02 (`modules/02-...`, `Q-DATA-006` correctly refs Module-02).
- Fix: move executable proof to Domain-02 row, give Domain-01 a relational-algebra/FD test or `No executable — theory only`.

### P1-4 Wrong test cross-ref for BM25
- `exams/interview.md:184`: BM25 Q-DATA-011 refs `[12-vector-ann-hnsw.test.ts]`.
- That file tests HNSW, not BM25 scoring.
- Fix: drop link or add `examples/xx-bm25.test.ts`.

### P1-5 Missing required README sections
- `README.md:11`: heading `Certifications & Academic Standards`, AGENTS requires `Certifications & Exams`. No `Prerequisites` section, no explicit syllabus-to-official-source mapping statement.
- Fix: rename heading, add Prerequisites + source TOC mapping.

---

## P2 — Ambiguous / overstated questions, depth gaps

### P2-1 Q-DATA-005 construction
`interview.md:70-85`: numbered items `1=BCNF,2=1NF,3=3NF,4=2NF,5=4NF` then options like `2→4→3→1→5`. Technically correct but hostile. Fix: list options by name (`1NF→2NF→3NF→BCNF→4NF`), not by shuffled numbers.

### P2-2 Q-DATA-010 missing assumption
`interview.md:~153-165`: `L=100MB, L+1=1GB ⇒ WA=10`. Only holds if uniform SSTable size + full overlap. Fix: state `assuming equal-sized SSTables and full key-range overlap`.

### P2-3 Q-DATA-042 over-guarantee
`interview.md:~676-686`: “ensuring exactly one worker refreshes.” XFetch is probabilistic, can still stampede. Fix: “with high probability only one …”.

### P2-4 Q-DATA-019 fsyncgate version
`interview.md:~300-309`: “In Linux kernels prior to 4.13 …” No primary LKML/Postgres citation, fix version unverified. Fix: cite PG thread + kernel commit or mark `(unverified)`.

### P2-5 Q-DATA-049 conflates Protobuf vs Avro
`interview.md:782-797`: “Adding optional field with default” is Avro Full-compat rule; proto3 has no required + implicit defaults. Distractor B/D ambiguous across systems. Fix: split into `Protobuf:` / `Avro:` sub-rules.

### P2-6 Module-01 depth gap vs README promise
- `README.md:31` promises `multivalued dependencies, Datalog recursive evaluation, 4NF/5NF`.
- `modules/01-data-models-and-query-languages.md:7-227` has: algebra, FD→BCNF only, paradigms, schema-on-read/write, Then-vs-Now, failures, drill. No Datalog, no 4NF/5NF formal treatment, no 5NF join-dependency.
- Fix: add sections or remove from README promise. Q-DATA-004 then has no teaching target.

---

## P3 — Polish / consistency

- **P3-1** `README.md:94-97`: `mise install` / `mise exec -- npm test` claims “31 unit, scenario, and property tests” — count unverified, no output log. Re-run and assert.
- **P3-2** Count drift: `README.md` + `interview.md:1-3` say `65 questions`, `exams/README.md:Navigation` says `60+`. Fix to exact `65`.
- **P3-3** `modules/01...md:136,142,147,152` + `:210,215,220`: `### 1./2./3./4.` restarts numbering under `## 3.` / `## 6.`. Renumber to `####` or unnumbered.
- **P3-4** Mermaid not checked: `modules/01...md:14-27,88-97,124-132,163-180` — `sequenceDiagram Note over App, Disk:` with space + quoted labels must pass `tools/mermaid-check` for Mermaid 11+12. Run before commit.
