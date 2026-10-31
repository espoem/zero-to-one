# Drafter/Auditor Audit: languages/javascript
Auditor: `opencode-go/deepseek-v4.1-flash`
Target: `languages/javascript`
Date: 2026-10-31

---

## Verified compliant

- All 13 modules end with `## Interview Drill`, 8–10 collapsible `<details>` each. AGENTS.md 5–10 rule satisfied.
- Table pipe escaping is correct everywhere: `\|` used in `modules/02:368,370`, `modules/12:155` (`\|0`), `modules/11:160`, `modules/13:167`.
- `modules/13:159` carries the ES2015→ES2027 version history table.
- `exams/` present with per-domain matrix, no `❌` rows, ≥5 questions per domain, two mocks, hands-on tasks bound to `examples/exam-hands-on.test.js`.

---

## P0 — blocking

### P0-1 · Question bank count and misfiled questions
- `exams/interview.md` claims Total 73, D3 = 8 questions; `README.md:68` claims "73 questions in 10 domains".
- Actual count is 78 (`Q-JSI-001`…`067` + `074`…`078` + `068`…`073`).
- `Q-JSI-074`…`078` (Classes) sit inside `## D10 · Performance and security`.
- Fix: move `074–078` under `## D3`, renumber to contiguous `068–078`, update totals to 78.

### P0-2 · Mock B classification
- `exams/interview.md:1405` claims all 9 items in Classes section are dedicated class questions, but lists `012`, `020`, `056`, `061`. Reclassify and align mock item lists.

### P0-3 · Hands-on span contradiction
- `interview.md:26` says (span D2, D5, D6), while `exams/README.md:33` says (spans D2, D3, D5, D6). `H5` is D3. Fix `interview.md:26`.

---

## P1 — factual / citation risk

### P1-1 · ECMA-262 §7.2 citations off by one
- `IsStringWellFormedUnicode` (ES2024) occupies §7.2.9, shifting `SameValue` to §7.2.10, `SameValueZero` to §7.2.11, `IsLessThan` to §7.2.13, `IsLooselyEqual` to §7.2.14, `IsStrictlyEqual` to §7.2.15. Update citations.

### P1-2 · Module 11 citation
- `modules/11:3` cites §23.3.1.1 `Uint8Array.fromBase64`. In standard numbering it is §23.2.5.x.

---

## P2 / P3 — Polish

- Module 10 renumbering.
- Fix literal `;` in `modules/05-iterators-generators.md:300` state diagram.
- Run `tools/mermaid-check`.
