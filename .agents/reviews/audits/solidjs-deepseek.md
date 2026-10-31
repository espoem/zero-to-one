🍄💬: Audit complete. **No P0 defects.** The track is unusually rigorous (216 tests recomputed by counting `it(` calls, matching `.agents/STATUS.md`; every rc.19 pin consistent across `package.json`, `package-lock.json`, `mise.lock`, README, modules, cheatsheet, glossary). The real defects are in the *exam bank answer format*, *dead cross-links*, *README structure/titles*, and *heading-level drift inside modules*.

**Scope limit:** this session has no shell tool, so `npm test`, `npm run typecheck`, `tools/mermaid-check` and `tools/table-check` could not be executed. Everything below is static analysis; the diagram and table verdicts are by inspection of source, not by parser.

## P0 — none

No incorrect teaching that would make a learner build a broken app, no secret/path leak (`/Users/`, tokens: zero hits), no missing `Verified against` line, no ❌ row in the exam matrix.

## P1 — merge-blocking per AGENTS.md

| # | Finding | Evidence |
|---|---|---|
| 1 | **Dead cross-links to a TypeScript module that does not exist.** All three point at `languages/typescript/modules/13-solidjs-2-with-typescript.md`; the directory has `12-typing-ui-frameworks.md` (which contains "§4 Solid 2.0 (release candidate)") and `13-library-authoring-performance-and-type-tests.md`. The prose already says "moving to TS M12", so the link is the stale half. | `README.md:12`, `modules/01-reactive-core.md:11`, `modules/03-components-props-and-dom.md:5` |
| 2 | **Exam answers omit "why each distractor is wrong"** for roughly 26 of 60 questions — every question from Q-SOLID-034 onward plus several in D2/D3 (e.g. 014, 015, 040, 041, 042, 043, 045–060). AGENTS.md § Certification and Exam Coverage item 4 makes distractor analysis mandatory. Answers in D1 are exemplary; the bank degrades from D4 on. | `exams/interview.md` (last `- Why not` at line 540) |
| 3 | **No `ordering` question type anywhere in the bank.** AGENTS.md requires the bank to mirror the real format including ordering questions. Zero matches for the `ordering` type tag. | `exams/interview.md` (grep: only prose hit at line 384) |
| 4 | **README module titles do not match module H1 titles — 0 of 10 match.** Examples: "Reactive core" vs "Reactive Core: Signals, Memos, Batching and Ownership"; "SSR, start mode & server functions" vs "Full Stack: SSR, Start Mode, Request Isolation and Server Functions". | `README.md:20–30` vs `modules/*.md:1` |
| 5 | **Two-suite module 08 is presented as one.** M08 ships `08-hydration-roundtrip.test.tsx` (4 client tests) and `08-ssr-and-server-functions.server.test.tsx` (14 server tests); both README's Proof column and the exam matrix list only the server suite, so 4 executed proofs are invisible to a reader deciding whether to trust the module. | `README.md:28`, `exams/README.md` D5 row, `modules/08-ssr-and-start-mode.md:3` |

## P2 — compliance and staleness

| # | Finding | Evidence |
|---|---|---|
| 6 | **README heading structure diverges from the repo's canonical numbered form.** Sibling tracks (`languages/python`, `algorithms/dsa`, `architecture/data-systems`) use `## 1. Syllabus…` / `## 2. Certifications & Exams` with `### Prerequisites` and `### Out of Scope` nested. This track uses unnumbered `## Prerequisites` / `## Syllabus` / `## Run it` / `## Certifications & Exams` / `## Sources`. Note: AGENTS.md itself does not mandate the numbering — the harder requirement it *does* impose (§ Syllabus Completeness) is an explicit out-of-scope list, and the only one in this track lives in `exams/README.md`, not the README. | `README.md:7,13,53` |
| 7 | **`Verified against … on 2026-10-28` is stale.** Modules were rewritten and the suites re-run on 2026-10-29/30, and `.agents/STATUS.md` records the merge as 2026-10-30 with 216 tests. The date line should be bumped (and `exams/README.md`'s "checked 2026-10-28" alongside it if the exam re-check was redone). | `README.md:9`, `.agents/STATUS.md:17`, `.agents/reviews/solidjs.md:5` |
| 8 | **Stale statement: "(languages/javascript, not yet published)".** That track is published and complete (11 modules, own README/GLOSSARY/exams). | `modules/01-reactive-core.md:11` |
| 9 | **False cross-track claim: "the React track links back to Module 10 here".** The React track contains no reference to `technologies/solidjs` or to M10 — its README only mentions SolidJS indirectly via `.agents/OWNERSHIP.md`. Either add the link to the React track or drop the claim. | `README.md:12` |
| 10 | **Heading level/number drift inside modules.** Sub-sections promoted to H2 and duplicate numbers: M01 has two `### 6.1` (Disposal, then `untrack`); M04 uses `### 7.0` and an H2 `## 7.2`; M05 has H2 `## 6.1/6.2/6.3`; M06 has H2 `## 5.1/5.2/7.2`; M07 has H2 `## 5.1`, `### 6.1`, and a duplicate `## 7.1` (Then-vs-now and Worked example); M08 has H2 `## 4.1`; M09 mixes `### 4.1` with H2 `## 4.2–4.6` and `## 5.1`. This breaks in-page navigation and anchor links from the exam bank. | `modules/01,04,05,06,07,08,09` |
| 11 | **Interview Drills exceed the AGENTS 5–10 question range in 7 of 10 modules**: M02 12, M04 13, M05 13, M06 12, M07 14, M08 11, M10 11 (M01 10, M03 10, M09 10 are in range). | `modules/*.md` `<summary>` counts |
| 12 | **Mock-exam domain mix does not match its stated weights.** Stated `5/4/2/5/4/2/3`; actual selection is D1 5, **D2 5**, D3 2, D4 5, **D5 3**, D6 2, D7 3 (= 25, but D2/D5 swapped). | `exams/interview.md:802–820` |
| 13 | **Unverified claims not marked `(unverified)`** as AGENTS requires: "seroval since 1.8" (M08 §7), `@solidjs/diagnostics@2.0.0-rc.19` version claim (package is not installed, so no test backs it), and the Panda CSS row in the ecosystem table. M10 correctly marks its own two `(unverified)` rows, so the pattern exists. | `modules/08-ssr-and-start-mode.md:322`, `modules/09-testing-debugging-performance.md:60`, `modules/10:41` |
| 14 | **Certifications table lacks the "guide version or date verified" column** that AGENTS requires (the date exists only in surrounding prose). | `README.md:46–48` |
| 15 | **Coordination material leaks into learner-facing content:** "(brief §3)" points at `.agents/briefs/solidjs.md`. The React track does the same, so this is repo-wide, but it is still an internal reference a learner cannot follow. | `exams/README.md:14` |

## P3 — polish

- **Interview Drill numbering out of order:** question 10 is last in M06, question 8 is last in M08, question 6 is last in M09 (`modules/06:388–398`, `08:382–392`, `09:379–399`).
- **Cheatsheet ambiguity:** "Removed: … `on` …" sits next to `<Loading on={id()}>` being a documented prop — a reader can conclude `on` is gone entirely (`CHEATSHEET.md:113`).
- **Approximate test citation:** Q-SOLID-021 cites test "draft pattern: the binding always mirrors the box" while the real name ends "…the box, so re-runs are harmless" (`exams/interview.md:313`).
- **Non-executable worked example:** M09 §1.7 uses a `fakeServer` helper it explicitly says is "not a file in this track" — honest, but it is the one code block in the track without a runnable proof.
- **`.agents/reviews/solidjs.md` "Remaining work" items 2–4 are still open** (hand-written `mise.lock` node entry without platform checksums — actually now present with checksums, so item 2 can be closed; router coverage, start-mode end-to-end `test:integration`). Item 2 is stale: `mise.lock` now carries linux-x64 and macos-arm64 checksums.

## What verifies clean (no action)

- **Solid 2.0 / 1.9 identity:** `rc.19` pinned identically in `package.json`, `package-lock.json` (`2.0.0-rc.19`), README, M01, M08, M10, cheatsheet; `solid-js-1` alias `1.9.17` consistent with `languages/typescript/modules/12` ("`latest` is still 1.9.17"). No GA claim anywhere; RC churn is stated as a risk, not hidden.
- **Reactive graph depth:** M01 §2 gives formal graph definitions, height/topological argument, three-colour marking with a loop invariant, height-bucket heap, `Link` generation-stamped dep lists (alien-signals lineage), dormancy sweep, dynamic `adjustHeight`, glitch-freedom proof sketch, and a complexity analysis — plus a negative test per failure mode. This meets the "reactive graph algorithms" bar.
- **Solid vs React mental model:** M10 §4 is genuinely written once here (unit of re-execution, execution trace of one click, async/transitions/actions, memoisation, server rendering, when each wins, translation table) and is registered as the owner in `.agents/OWNERSHIP.md:47–48`.
- **Colorless async, stores/projections, JSX compilation, SSR/Seroval:** API vocabulary is consistent across M01–M10, GLOSSARY, CHEATSHEET and the bank (`NotReadyError`, holds, `isPending`/`latest`/`createDeferred`/`loadingValue`, `createProjection`, `createStore(fn, seed)`, `snapshot`/`deep`, `_hk`/markers/seroval records). M03's compiler claims agree with `languages/typescript/modules/12` (`jsx: preserve`, `jsxImportSource: @solidjs/web`, `on:` as compile error) — rare and valuable cross-track agreement.
- **Exam coverage mechanics:** exactly 60 questions, 12/9/6/12/9/6/6 distributed exactly proportionally to the 20/15/10/20/15/10/10 weights, ≥5 per domain, difficulty 3 present, all 7 hands-on tasks name a test that exists, no ❌ rows.
- **Table pipe escaping:** every union type inside a table cell is escaped (`T \| undefined` in M06, M10, GLOSSARY, M04); unescaped `T | undefined` occurs only in prose. No column-count anomaly found by inspection.
- **Mermaid:** 30 diagrams, all labels quoted, `#59;` used inside sequence text, `;` avoided, ordered pipelines expressed as chained `-->` — consistent with `tools/mermaid-check` rules (not executed here; the review records 0 failing).

Suggested fix order: 1 → 2 → 3 → 4 → 5 (all mechanical, one commit each), then 6–9, then the heading pass (10) as a single `fix(solidjs): heading levels` commit.
