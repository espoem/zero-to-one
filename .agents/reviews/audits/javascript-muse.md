# Challenger Audit: languages/javascript
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `languages/javascript`
Date: 2026-10-31

---

# P0 — Factually wrong / must fix before merge

## P0-1. Exam bank count is false: file has 78 questions, docs claim 73
- `exams/interview.md` headings: `Q-JSI-001`…`Q-JSI-067` (=67) + `Q-JSI-074`…`Q-JSI-078` (=5) + `Q-JSI-068`…`Q-JSI-073` (=6) = **78** distinct IDs. `068–073` placed *after* `078`, out of order.
- `exams/interview.md` Domains table claims `Total 73`, D3 `8` questions. Actual D3-adjacent class questions: `015–022` (8) + `074–078` (5) = 13.
- `exams/README.md` repeats `73 questions in 10 domains, 6 hands-on`, D3 row `015–022, H5 (072)`, D2 row `007–014, H4 (071)` — omits `074–078` entirely. Coverage matrix therefore `✅` on false data.
- `AGENTS.md` exam rule: ≥5/domain, ≥60/cert, no `❌` rows, exact mapping. Fix: renumber sequentially (or keep IDs but correct totals to 78, add `074–078` to D3 row, update domain counts/weights, update both READMEs).

## P0-2. JSA mapping misclassifies non-class questions as “dedicated class questions”
- `exams/README.md` JSA table: “12 dedicated class questions in bank (012, 017, 018, 020, 022, 056, 061, 074–078)”.
- `012` is `this`/class-field arrow (D2), `056` is decorators Stage 2.7 status, `061` is `DisposableStack.move()` — none are class-semantics questions. Only `017,018,022,074–078` (=8) are classes; `020` is `instanceof`/realms.
- Mock B “Classes” row lists 9 items (`012,017,018,020,022,056,061,074,075`) but text claims 12, and `076,077,078` exist but are excluded without reason. Either the matrix or the mock is wrong. Fix matrix + mock item lists together.

## P0-3. `Q-JSI-008` explanation is incomplete in a way that will fail in review
- Code has `console.log(readLater.name)` on line 3 *before* `let value`. Answer `D (None)` is the intended output, but explanation says “TDZ is temporal” and ignores the real trap: `readLater.name` is `"readLater"` — correct — however in an ES module `readLater` is *not* on `globalThis`, and `typeof undeclaredName` is safe only because it is unresolvable. The current “Why not B” says “`typeof` special-cases unresolvable references” without stating the normative rule (`typeof` checks `IsUnresolvableReference` before `GetValue`, §13.5.3) and without noting `let value` does *not* put `readLater` in TDZ. As written a challenger will flag it as hand-waving. Add the `GetValue`-vs-reference distinction already taught in `modules/01` §3.4.

---

# P1 — Compliance / broken refs / unverified claims

## P1-1. Internal §-references are not anchors and several do not exist as numbered sections
AGENTS.md requires internal module anchor links actually exist. The bank uses `…(../modules/04-….md) §4.3`, `§4.4`, `§4.1`, `§4.2`, `§2.2`, `§6`, etc. as *plain text* after the link:
- `modules/04-objects-prototypes-classes.md` has `## 4. Classes` with unnumbered `### Fields… / Private names / Static…` — there is no `§4.1–§4.4`. Same for `§2.2/§2.3/§6`, `modules/03… §3/§4/§5/§7`, `modules/10… §2/§3/§7`.
- Not broken Markdown links, but they fail the “anchor exists” audit. Fix: either link to real GitHub anchors (`#4-classes`, etc.) or drop the `§` suffix and cite spec sections only.

## P1-2. Unverifiable “verified on 2026-10-28/30” version claims
- `README.md`: “Node 26.12.1 (V8 14.6.202…) on 2026-10-28”, `modules/06`: “verified against HTML Standard source on 2026-10-30”, `modules/01/07/09`: TC39 stage snapshot “as of 2026-10-28”.
- Cannot be checked from the repo (no `mise.lock` toolchain output, no dossier commit, no `tc39/proposals` SHA). AGENTS.md version-currency rule requires primary-source verification; mark with commit/SHA or `(unverified)`. Highest risk items:
  - Decorators “moved Stage 3 → 2.7 at May 2026 TC39” (`modules/01`, `09`, Q-056).
  - `Iterator.zip/chunks/includes/join` “reached Stage 4 (ES2027) in 2026” correcting the dossier (`modules/01`, `05`).
  - `Math.sumPrecise` “ES2026 but behind `--js-sum-precise` in V8 14.6”, `Iterator.zip/chunks` “not shipped”, `import defer` “behind `--js-defer-import-eval`”, ShadowRealm “behind `--harmony-shadow-realm`”.
  - If any one stage is wrong the whole snapshot table + Q-059/Q-060/Q-056 answers are wrong.

## P1-3. `Iterator.prototype.flatMap` string-rejection claim needs a test262 `esid`
- `modules/05` §3: “`flatMap` … rejects strings returned by the mapper (it flattens only iterators/iterables that are objects)”.
- No `esid`/test cited, no negative test named in `examples/05-*.test.js` description. Spec `Iterator.prototype.flatMap` does `GetMethod` on the mapped value; a primitive string *is* iterable but `GetMethod(string, @@iterator)` boxes it.

---

# P2 — Ambiguities / depth gaps (spec, desugaring, negative tests)

## P2-1. Event-loop “tick accounting” is stated without the `Await` algorithm steps
- `modules/06` §3 table (`await nativePromise` 1 tick, `resolve(thenable)` 2, `new Promise(r=>r(p))` 3) is empirically correct on V8 but the prose does not walk `Await (§27.7.5.3)` → `PromiseResolve` → `PerformPromiseThen` vs. `CreateResolvingFunctions` → `NewPromiseResolveThenableJob`. AGENTS.md demands formal ECMA-262 algorithms. Add the 5-line desugar; otherwise Q-029/Q-030 look like folklore. The `exam-hands-on`/`06-event-loop-model.js` already proves ordering — cite line numbers.

## P2-2. Bound-function `new.target` oversimplified
- `modules/03` §5 + Q-010: “`new` on a bound function ignores `[[BoundThis]]` … `new.target` is the target.”
- True only for direct `new (f.bind(a))()`. For `class C extends boundFn`, `[[Construct]]` forwards the *actual* `newTarget` (`C`). The `myBind` reference in Q-071 correctly uses `Reflect.construct(fn,…,newTarget)`. Align module prose with the solution: “`newTarget` is `Target` iff `SameValue(F,newTarget)`, else preserved.”

## P2-3. `import defer` sync-evaluation caveat is buried
- `modules/08` §5: “evaluate on first property access (synchronously)” + “cannot defer async modules (TLA) synchronously; those are evaluated eagerly.”
- Correct but the first sentence will be quoted without the second. Hoist the TLA exception into the table cell and Q-048/Q-050 distractors, otherwise learners will predict deterministic sync evaluation for TLA graphs (which can deadlock — correctly noted in §4 but not cross-linked here).

## P2-4. Memory-model “tear free” needs normative bound
- `modules/11` §6: “aligned accesses of the element size are tear free where the spec requires … `Float64`/`BigInt64` may tear.”
- Spec §29.7.3 guarantees tear-free only up to 32-bit (and only for aligned accesses); state the bound explicitly (“≤32-bit aligned”) instead of “of the element size”. Current wording implies 64-bit typed-array element reads are tear-free.

## P2-5. V8 pipeline diagram omits feedback invalidation that the text relies on
- `modules/12` correctly notes “patching `Array.prototype[Symbol.iterator]` invalidates the protector for the whole isolate,” but the Mermaid pipeline (`IGN ↔ MG/TF via feedback vector`) shows no protector/invalidation edge. Add a dashed edge or footnote; otherwise the “one patch slows every spread” claim (P1-level perf claim) has no mechanism in the diagram.

## P2-6. `using` + `for (using x of …)` disposal point underspecified
- `modules/10` §2: “`for (using x of resources)`, disposing each value at the end of its iteration.” Does not state whether the *iterator itself* is closed on abrupt exit (it is, via `IteratorClose`) vs. per-element disposal. One sentence + negative test (throw on 2nd element → first already disposed, iterator closed) closes the gap.

---

# P3 — Polish

- **Table-pipe hygiene is mostly good** (`s \| 0`, `x \| 0`, `\|\|=` correctly escaped in `02`, `12`, `13`).
- **Mermaid syntax**: all 14 ` ```mermaid ` fences use quoted labels (`T["…<br/>…"]`), no literal `;` inside `sequenceDiagram` text observed. `classDiagram` line `ThisBindingStatus: lexical | initialized | uninitialized` uses `|` inside Mermaid, not a Markdown table — legal, but add backticks to avoid future lint confusion.
- **Q-ID ordering**: move `074–078` before `068–073` or renumber to `068–078` sequential; update Mock A/B item lists.
- **Duplicate anchors**: `README.md` link `technologies/nodejs` etc. are relative (`../../../technologies/nodejs/`) — valid from `modules/` but broken from repo root preview.
- **Interview Drill depth**: met — each module ends with 8–10 drills. Q-076/Q-077/Q-078 (constructor-returns-object, static inheritance, private-method pollution immunity) are excellent senior discriminators.
