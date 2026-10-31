# Challenger Audit: languages/typescript
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `languages/typescript`
Date: 2026-10-31

---

# P0 — factually wrong / must fix before merge

## P0-1 `types: ["*"]` does not restore 5.x behaviour — Mod 01 §4.1
`modules/01-toolchain-and-compiler-model.md:194` table row:
> `types` \| All of `node_modules/@types/*` \| `[]` \| … `["*"]` restores 5.x behaviour.

`tsc` has no `"*"` wildcard for `compilerOptions.types`. Valid values are package names under `node_modules/@types` / `typeRoots`. Restoring 5.x auto-inclusion is deleting `types` / omitting it, not `["*"]`. `["*"]` looks for a package literally named `*` and resolves to no types. Fix row to: omit `types` or set `typeRoots` explicitly. Same false claim repeated in Cheatsheet §1? Cheatsheet correctly says `"types": ["node"]` fix, no `*` — keep that, fix Mod 01.

## P0-2 `importsNotUsedAsValues` / `preserveValueImports` “both removed in 5.5+” — false — Mod 06 §4
`modules/06-modules-declarations-and-tsconfig.md:143`:
> It supersedes `importsNotUsedAsValues`/`preserveValueImports` (both removed in 5.5+).

They are deprecated, not removed. `tsc --showConfig` 7.0.2 still accepts both (ignored with warning when `verbatimModuleSyntax` is on). There is no TS5102/TS5108 error for them. Either cite removal notice from TS 7.0 announcement or downgrade to “deprecated since 5.0, do not use with `verbatimModuleSyntax`”.

## P0-3 Invented 6.0 inference change — Mod 07 §“How inference works” step 2
`modules/07-generics-and-inference.md:42`:
> (Since 6.0, functions that never use `this` are no longer treated as context sensitive merely because of method syntax.)

No such 6.0 change in `announcing-typescript-6-0`, 6.0 release notes, or checker source. Context-sensitivity rules (`isContextSensitive`) unchanged in 6.0. This looks like hallucinated version behaviour to explain two-pass inference. Remove parenthetical or cite exact PR/issue. Do not ship versioned claim without primary source — violates “Version Currency”.

## P0-4 `M-003` answer overclaims — `in` on primitive union
`exams/certificates-dev-typescript.md:Q-TSC-M-003`:
> Why not D: `in` on a primitive-containing union is an error (`"length" in x` requires an object), and strings also have `length`.

First half is imprecise to the point of wrong: `"length" in x` where `x: string | number[]` errors with TS2686 (`right-hand side of 'in' should be of type any, object type or type parameter`), not because “requires an object” as a narrowing rule, but because the union includes `string` (non-object). More importantly the explanation implies `in` could otherwise narrow `string | number[]` — it cannot narrow `string` at all because `in` requires `object` on RHS operand type after narrowing; correct fix is not mentioned. Also misses that `"length" in x` would be legal if `x: {a:string} | number[]`. Rewrite “Why not D” to name TS2686 and that `in` narrowing only applies when the narrowed type is `object`-constrained.

---

# P1 — compliance / broken refs / unverified claims

## P1-1 `stableTypeOrdering` self-contradiction — Mod 01 §3.3 + Mod 13
Mod 01 says: “always on in 7.0 (the announcement says it ‘cannot be turned off’; the fixture shows that `"stableTypeOrdering": false` is accepted silently).”
Both cannot be true as written. If `false` is accepted silently, output is non-deterministic or flag is ignored — either a compiler bug or a doc bug. If 7.0 ignores `false`, say “parsed but ignored” with `tsc --showConfig` evidence + fixture name. If it errors, give code. Current wording asserts opposite facts in one sentence. Same for Cheatsheet/Table in Mod 13 §“Determinism”. Add measured fixture output.

## P1-2 Version lumping `infer X extends C` “(since 4.7/4.8)” — Mod 09 Formal semantics
`modules/09-conditional-mapped-and-recursive-types.md:54`:
> `infer X extends C` (since 4.7/4.8) adds a constraint…

Split per AGENTS.md “Then vs now”: `infer T extends U` in conditional `extends` clause = 4.7; constrained infer in template-literal pattern parsing (`${infer N extends number}` → `42`) = 4.8. Current “4.7/4.8” fails version-currency rule. Same file correctly separates elsewhere — fix this paragraph.

## P1-3 Exam anchor fragility — all 60+ `Ref:` links
Refs like `[modules/03](../modules/03-unions-narrowing-and-control-flow.md#lesson-33-discriminated-unions--exhaustiveness-checking)`, `#how-inference-works`, `#formal-semantics-in-brief`, `#952-then-vs-now-...` rely on GitHub auto-slug (`3.3`→`33`, `&`→`--`, `,` dropped). They happen to resolve today but there are no explicit `{#anchor}` targets; any heading reword breaks 70 links silently. AGENTS.md requires anchor existence check. Add explicit HTML anchors at each target heading or a link-check test in `examples/exams/`. At minimum verify every anchor mechanically.

---

# P2 — ambiguities / depth gaps (AGENTS.md §Topic Depth)

## P2-1 No formal assignability calculus beyond one formula
Mod 04 gives $S \preceq T \iff \forall p\in props(T)…$ but never formalises call/construct signatures, index signatures, variance composition $G\langle A\rangle \preceq G\langle B\rangle$ via cached marker check, or `comparable` vs `assignable` vs `identical` relations mentioned in Mod 01 §2.2. Add 10-line relation table + counterexample where `comparable` allows `as` but `assignable` rejects (e.g. `string as "a"` vs `string` → `"a"` assignment). Currently Module 01 promises it, Module 04 does not deliver.

## P2-2 Desugaring/lowering incomplete
Mod 01 §2.3 tables `using`/`#private` lowering for `esnext/es2022/es2015` — good — but no desugar for `enum` → IIFE, `namespace` → IIFE, parameter properties → assignment, `import =` → `require`, decorator metadata → `__metadata`. AGENTS.md requires “compiler lowering, desugaring”. Add `erase(S)` rewrite rules for the six non-erasable rows in §1.2 table; currently only prose “Introduces runtime value”.

## P2-3 Checker pipeline: symbols vs types correct, flow nodes missing
Mod 01 §2.2 correctly states interning, relation caches, deferral, interface-vs-intersection caching. Missing: binder flow-node shape (`FlowAssignment`, `FlowCondition`), CFA lattice (narrowing as intersection of asserted types), and why `let` destructured correlated narrowing fails (alias invalidation on assignment — directly needed to justify exam M-005 answer B). One paragraph + link to `src/compiler/checker.ts:getFlowTypeOfReference` would close loop between Mod 03 and Mod 07.

## P2-4 Variance: method bivariance rationale incomplete
Mod 04 + Mod 07 correctly state: function-typed properties contravariant under `strictFunctionTypes`, methods bivariant, `out T` accepted on method-taking-`T` but TS2636 on property-taking-`T` (S-005 verified). Missing the soundness trap AGENTS.md demands: show runtime crash for both holes (`Array<Dog>` → `Array<Animal>` push, plus method-bivariance event-handler counterexample). Track says “both holes crashing at runtime” but `examples/04-assignability` only asserts compile errors, no `node --test` runtime throw for the unsound assignment. Add negative runtime test or drop “crashing” claim.

## P2-5 `Omit` quirk correct, `Pick`/`Record` homomorphy not contrasted
S-008 answer A correct (homomorphic over `keyof T` preserves modifiers + maps tuples). Distractor analysis says “`Record` is not homomorphic” — true — but Mod 08 never states formally that `{[K in keyof T]:…}` distributes over unions in `T` while `Record<keyof T,…>` does not, nor that remapped `{[K in keyof T as …]}` stays homomorphic for modifiers (Mod 09 states it, Mod 08 does not). Cross-link or duplicate one sentence; exam depends on it.

## P2-6 Zod 4 `.default` vs `.prefault` needs I/O table
S-032 answer B correct per Zod 4 changelog, Mod 11 §2.1 has it. But exam bank gives no `z.input`/`z.output` pair for `.prefault` vs `.default` with `undefined` input, only prose. Add two-line type-test (`Expect<Equal<…>>`) reference; otherwise harder-than-exam difficulty-2 question rests on prose alone.

---

# P3 — polish

* **Tables:** spot-checked tables correctly escape `|` as `\|` inside code spans (`RefObject<T \| null>`, `State \| Promise<State>`, `In<A> \| undefined`). No unescaped-literal-pipe violation found in table rows. Code blocks with `| string | number …` in Mod 12 §3.8 are fenced code, exempt. Keep this discipline.
* **Mermaid:** 10 fences (`flowchart TD/LR/TB`, `subgraph…end`, `-.->|label|`, `<br/>`). No `;` literals, labels quoted (`["…"]`), no unquoted `&` as text except `C1 & C2 & C3 & C4 --> D` which is valid flowchart chaining. Still must run `tools/mermaid-check` before commit per AGENTS.md §4.
* **GLOSSARY:** bilingual EN-prose + CZ terms, primary refs present, variance entries (covariant/contravariant/invariant/bivariant) match Pierce/Cardelli. `Bivariance` gloss “for compatibility with array mutation” is loose (real reason: method-parameter compatibility + DOM/event-handler ergonomics) — reword to match Mod 04 defence table.
* **CHEATSHEET §5:** `identity <T>(x:T):T` vs `identity(42): 42` example in Mod 07 §7.1.1 shows literal `42` preserved without `const T` — true only because literal is fresh and `T` infers to literal `42` when argument is literal? Actually `identity(42)` infers `T=42` — add one-line “why `42` stays literal but `"a"` in array widens” to avoid apparent contradiction between Mod 07 example and M-006 answer.
