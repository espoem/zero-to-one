# DeepSeek Flash 4.1 Audit: architecture/data-systems

Audit of `architecture/data-systems` — structure and version pinning are solid; the cross-reference layer is broken and the syllabus overstates module 01.

## 1. Headings & formatting — mostly consistent, two structural gaps

**Good**
- Both docs use uniform numbered H2 sections (README 1–4; `exams/README.md` 1–3), blockquote `Verified against` line at top, fenced run commands.
- All 12 modules share one skeleton: numbered `## 1..N`, then `Then vs Now`, `Production Failure Modes and Anti-Patterns`, `Interview Drill` with `<details>` model answers (`modules/*.md` heading grep confirms 12/12).
- Claims that hold statically: 12 test suites and **31** `it()` blocks match README's "31 unit, scenario, and property tests"; matrix weights sum to exactly 100%; 65 questions = 60 domain + 5 comprehensive, 5 per domain, mock = 20 Q / 60 min / 80% with scoring key.

**Gaps vs the repo standard (AGENTS.md)**
- `README.md:17` — section is "Certifications & Academic **Standards**", the mandated name is "Certifications & **Exams**".
- `README.md` has **no Prerequisites section and no out-of-scope list** (Topic Module Standard requires both); the syllabus sources (CMU 15-445, MIT 6.5840) appear only as prose in the intro, with no source→module mapping table.
- `exams/README.md` is missing the per-exam record the standard demands: no exam-guide link, no guide version/date verified, no status (active/beta/retiring), no duration/passing score, and no explicit statement that **no certification exists** (it only says "there is no single proprietary certification").
- Naming drift: interview.md says 65 questions, `exams/README.md:59` says "60+".
- Example filenames no longer track module numbers: module 01 → `01-slotted-page.test.ts`, module 03 → `12-vector-ann-hnsw.test.ts`.

## 2. Verified / up-to-date — versions consistent, cross-references not verified

**Consistent** (`README.md:3`, `.mise.toml`, `mise.lock`, `package.json`): Node 26.12.1, TypeScript 7.0.2, 2026-10-30; lock has platform checksums. `@types/node` 26.6.6 trailing Node 26.12.1 is normal type-package lag.

**Broken or unverifiable**
- **Every module anchor in `exams/interview.md` is dangling** (65 refs, e.g. `#relational-algebra-formal-algebraic-primitives`, `#cap-vs-pacelc-formal-trade-offs`, `#page-layout-slotted-pages-and-tuple-storage`, `#the-three-passes-of-aries-analysis-redo-undo`). Actual headings are `## 1. Formal Foundations: …`, `## 4. Theoretical Boundaries: …`, `## 1. Physical Page Organization: …`. The slugs were written against a heading set that was never shipped — the whole deep-link layer needs regeneration.
- **Wrong runnable-proof mapping**: `README.md:32` and the matrix row 01 assign `examples/01-slotted-page.test.ts` to module 01, but that file tests slotted pages, which module 02 §1 teaches (`modules/02:7`). Module 01 cites no test at all. So domain 01's "✅ Full … Executable Proof" and the README's "100% full coverage (zero gaps)" are not supported.
- **Domain 03 is overstated**: only BM25 + vector ANN are proven by `12-vector-ann-hnsw.test.ts`; R-trees/BKD-trees (§3) have no executable test.
- No version-history table anywhere in the track (`| Version |`/`Version History` → 0 matches), which the standard requires in the final/migration module; version deltas live only as prose inside each "Then vs Now".
- Release facts against primary sources: facts like fsyncgate, `io_uring`, and the Redlock critique carry no doc URLs, only literature citations.

## 3. Information depth — strong in modules, overstated in the syllabus

- Module bodies are dense and uniform (~230–300 lines each, formulas, state machines, Mermaid, failure modes) — depth is real, not stubbed.
- **`README.md:31` oversells module 01**: it promises "4NF ⊂ 5NF, multivalued dependencies, and Datalog recursive query evaluation", but module 01 contains only 1NF→BCNF (grep for `Datalog|4NF|5NF|multivalued` in module 01 → zero matches). 4NF/5NF exist only in README, CHEATSHEET, GLOSSARY, and exam Q-DATA-004/005 — i.e. two exam questions test material taught by no module.
- Question-format defects: Q-DATA-061 and Q-DATA-064 are tagged `hands-on` but are plain single-choice; the standard requires hands-on items to have a runnable verification script. Only 2 hands-on items exist overall.
- Ref lines omit the official-documentation URL the question template requires (module link + paper citation only).

## Priority fixes
1. Regenerate all 65 module anchors, or drop fragments (plain file links never rot).
2. Re-map module 01 ↔ tests: either add a normalization/relational-algebra test or move the proof mapping to module 02 and downgrade domain 01 to 🟡 with a reason.
3. Add Datalog/4NF/5NF to module 01, or remove them from `README.md:31` and retag Q-DATA-004/005.
4. Fix the matrix's "zero gaps" claim to match the mapping after step 2.
5. Add the missing Prerequisites + out-of-scope sections, rename section 1 to "Certifications & Exams", and give `exams/README.md` the exam-guide version/date/status/format block plus an explicit "no certification exists" statement.
6. Add a version-history table to module 12.
