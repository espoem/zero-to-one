# Review Checklist

The cross-reviewer (never the author) goes through every item. Write findings to `.agents/reviews/<track>.md` using the format at the bottom of this file. The final gate (Claude) re-runs the **Mechanical** section and spot-checks the rest.

Severity: **P0** = wrong now (a false claim, a failing test, a removed API taught as current). **P1** = misleads (an outdated version, a missing gotcha, an uncovered exam domain). **P2** = inconsistent (glossary drift, duplicated content). **P3** = polish.

## A. Mechanical (must pass, P0 if not)
- [ ] `mise install` succeeds from a clean checkout; `.mise.toml` and `mise.lock` are committed; no globally installed tool is relied on.
- [ ] `mise exec -- npm test` (or the track's equivalent) passes. `typecheck` passes.
- [ ] `test:integration`, if present, passes with Docker running and skips with a clear message without Docker.
- [ ] Every runnable snippet quoted in `modules/` exists in `examples/` and is exercised by a test.
- [ ] `tools/mermaid-check` passes for the track: every Mermaid diagram parses with Mermaid 11 and 12.
- [ ] Every link is relative and resolves (`lychee --offline` or an equivalent link checker).
- [ ] There are no `file:///`, absolute user paths, secrets or real tokens.
- [ ] The track has every required item: `README.md`, `GLOSSARY.md`, `CHEATSHEET.md`, `modules/`, `examples/`, `exams/`.

## B. Version currency
- [ ] Every pinned version is checked against its primary source (registry, release notes, tags) on the review date. Disagreements go in the findings.
- [ ] The README has `Verified against <versions> on <date>`.
- [ ] No removed or deprecated API is taught as current. Where practice changed, there is a "Then vs now" comparison with version ranges and migration steps.
- [ ] Every `(unverified)` marker from the brief is resolved, or explicitly carried with a reason.

## C. Syllabus and depth
- [ ] Every topic in the brief's module list and syllabus sources is covered, or listed as out of scope with a reason.
- [ ] Formal definitions are anchored in primary specs/RFCs/papers, with mechanics and internals and not just usage.
- [ ] It reads as one progressive narrative, with no Beginner/Senior labels.
- [ ] Every gotcha/failure mode in the brief appears in a module **and** has a negative test or counterexample.
- [ ] Every module ends with an Interview Drill (5–10 questions, answers in `<details>`).

## D. Certifications and exams (AGENTS.md § Certification and Exam Coverage)
- [ ] The README lists every relevant exam with: code, vendor, link to the official guide, guide version/date, targeted product version, status and format. It says explicitly when no exam exists, and names the interview-format fallback.
- [ ] `exams/README.md` has a domain → module coverage matrix with official weights. No ❌ rows; every 🟡 row has a reason.
- [ ] There is an exam-delta callout wherever the exam's product version differs from the track's.
- [ ] Question bank counts: ≥5 per domain, ≥60 per certification, distributed roughly by weight.
- [ ] Question types mirror the real format, and every hands-on task has a verification script in `examples/`.
- [ ] Every question has a difficulty tag, the answer, the explanation, why each distractor is wrong, and module + official doc refs. Spot-check 10 questions for correctness.
- [ ] There is at least one full-length mock exam with a scoring key.
- [ ] All questions are original. Nothing resembles leaked exam content.

## E. Dedupe and terminology
- [ ] Concepts owned by another track (`.agents/OWNERSHIP.md`) are cross-linked, not re-explained. Only the track's delta is present.
- [ ] Newly introduced cross-cutting concepts are registered in `OWNERSHIP.md`.
- [ ] Glossary terms shared with the root `GLOSSARY.md` reuse its English definition and Czech term verbatim. Czech terms are established, not invented.
- [ ] Code languages follow AGENTS.md § Code Example Languages: pseudocode + TypeScript primary, and secondary languages only with a stated reason.

## F. Pedagogy (P2–P3)
- [ ] Diagrams are present where structure matters (Mermaid preferred). KaTeX/LaTeX renders on GitHub.
- [ ] The cheatsheet is accurate and current, and matches the module content.
- [ ] Examples are minimal, deterministic and readable; there is no synthetic middleman/shim layer hiding real APIs (see the 2026-10 audit).

---

## Findings format (`reviews/<track>.md`)

```markdown
# Review: <track> · reviewer <agent/model> · <YYYY-MM-DD> · branch track/<track> @ <sha>

## Summary
<3 lines: verdict (approve / changes required), biggest risks>

## Findings
- [ ] **P0** `path/to/file.md:123`: <what is wrong> → <fix>. Source: <URL>
- [ ] **P1** …

## Resolution (author fills)
- [x] P0 #1 fixed in <sha>
```
