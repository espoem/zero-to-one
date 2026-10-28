# Panda CSS — Syllabus Depth Audit

Audit of `technologies/panda-css/` against the repository Topic Module Standard (formal definitions, compiler lowering detail, executable proofs, established terminology). Verified against `@pandacss/dev@0.51.1`; `npm test` (`tsc --noEmit` + `panda codegen --clean`) passes and regenerates `styled-system/`.

## Verdict

The track is **strongest exactly where SolidJS is weakest — on compiler mechanics.** Module 13 (`compiler-and-best-practices`) contains a genuine four-phase AST pipeline and a Box evaluation algorithm (`LiteralBox`/`MapBox`/`ArrayBox`/`ConditionalBox`), and a "what cannot be statically evaluated" section. The remaining gaps are narrower and well-defined: (a) Panda's *own* atomic class-name hashing is undocumented, (b) the formal "lowering/desugaring" pass is never named or systematized, (c) the DTCG token format is claimed but not taught, and (d) failure modes are scattered, never consolidated.

## Coverage Matrix — Formal Mechanics

| Area | Where | Status |
| :--- | :--- | :--- |
| Zero-runtime CSS-in-JS | `GLOSSARY.md` §1, `modules/01`, `modules/09` | **Excellent** |
| Static AST extraction | `modules/13` §13.1 (4-phase pipeline, Box algorithm), `modules/01` | **Excellent** |
| Cascade layers `@layer` | 35× `@layer`, 19× "cascade layer", deterministic override order | **Excellent** |
| Recipe slot compilation | `modules/05/06/07` (cva, sva, defineRecipe, defineSlotRecipe, splitVariantProps) | **Excellent**, but the *lowering* of a slot recipe to `name__slot` / `name__slot--variant_value` classes is only mentioned in passing (`modules/07` §? BEM note) |
| W3C design tokens | `modules/08` (809 lines) claims DTCG conformance | **Partial** — "conforming to the W3C DTCG spec" is asserted (`modules/08` §1) but DTCG appears 0×; the `$value`/`$type`/`$description` token format is never taught |
| Atomic CSS hashing | 5× "hash", all about Styled Components' runtime MurmurHash (`modules/09`) | **Missing** — Panda's own deterministic class-slug algorithm is never documented |
| Compiler lowering | "lowering" 0× as a concept (only "lowers opacity") | **Missing as a named pass** — desugaring rules exist scattered, never unified |
| Failure modes | "failure" 0×; "error" 35× mostly type/build errors | **Thin** — never consolidated into a taxonomy with symptoms + diagnosis |

## Gap Analysis

### G1 — Atomic CSS hashing / deterministic class-name generation

The only hashing material in the curriculum describes **Styled Components' runtime** MurmurHash pipeline as an anti-pattern (`modules/09`). Panda's own generation algorithm — how `css({ bg: 'blue.500' })` deterministically maps a declaration to a stable, deduplicated class name — is absent. The missing mechanics:

1. A style object is lowered to a set of property–value declarations.
2. Each declaration maps to a deterministic **slug** (property shorthand + normalized value, e.g. `bg_blue.500`, `fs_1rem`), not a random hash — this is what makes names human-readable and stable across builds.
3. **Deduplication** is by declaration identity: two source locations emitting the same declaration produce the same class and share one CSS rule (the "atomic" guarantee).
4. Where a value is not a literal token path, a compact hash suffix disambiguates (numeric/arbitrary values). Collision/determinism guarantees should be stated.

**Recommended action:** add a "Class-Name Generation & Deduplication" section to `modules/13`, and an example asserting that two distinct `css()` calls with equal declarations emit an identical class string.

### G2 — Compiler lowering / desugaring (unified pass)

The curriculum shows lowering *outcomes* (responsive arrays → media queries, token paths → CSS vars, conditions → selectors) but never names or unifies them. The formal pass should specify:

1. **Shorthand → longhand expansion** (`p: 4` → `padding: 1rem`).
2. **Responsive array/object → mobile-first media queries** (`[base, sm, md]` → `base` unlayered + `@media (min-width: …)`).
3. **Token path → CSS custom property reference** (`blue.500` → `var(--colors-blue-500)`).
4. **Condition → selector** (`_hover` → `&:is(:hover, [data-hover])`; `_dark` → `.dark &` / `[data-color-mode="dark"] &`).
5. **Recipe variant → modifier class** (`{ size: 'sm' }` → `btn--size_sm`).
6. **Slot recipe → BEM element/modifier classes** (`alert__root`, `alert__root--status_error`).

These six rules are the "recipe slot compilation" and "atomic CSS hashing" mechanics the prompt asks about; they are currently scattered across `modules/02/05/06/07` and should be consolidated under an explicit "lowering" heading with a box-node → CSS-rule diagram.

### G3 — DTCG token format (claim without teaching)

`modules/08` asserts conformance to the W3C Design Tokens Community Group specification, but never shows the DTCG JSON shape (`$type`, `$value`, `$description`, `$extensions`) or how Panda's `defineTokens`/`defineSemanticTokens` map onto it. Either teach the format or soften the claim.

### G4 — Failure-mode taxonomy

Static extraction fails *silently* — a style that can't be evaluated is dropped, not errored. The curriculum names individual cases (`modules/13` "What Cannot Be Statically Evaluated") but never consolidates them into a failure-mode list with symptom + diagnosis + repair:

| Failure mode | Symptom | Diagnosis / Repair |
| :--- | :--- | :--- |
| Runtime value in style object | Style silently missing | `npx panda debug <file>`; hoist to a statically-known constant or `staticCss` |
| Dynamically constructed recipe class | Recipe variant classes not emitted | `staticCss` in `panda.config.ts` |
| Conditional style not statically resolvable | Partial extraction | Rewrite as a statically-resolvable ternary or `css.raw()` merge |
| Stale `styled-system/` after config change | Type errors / missing tokens | `panda codegen --clean` before typecheck |
| Monorepo `include`/`importMap` mismatch | Styles from shared package missing | `importMap` + `emitPackage` or app-level `include` globs (`modules/12`) |

**Recommended action:** add this taxonomy to `modules/13`, and an example that provokes a dropped style and asserts `panda debug`/`analyze` flags it.

## Terminology — Glossary Additions (English ↔ Czech)

`GLOSSARY.md` maps the build model well but omits the hashing, lowering, and reliability terms. Frontier compiler terms are **retained in English** (the rule forbids neologisms); established Czech equivalents are given where they exist.

| English Term | Czech Term | Notes |
| :--- | :--- | :--- |
| **Atomic CSS Hashing / Class-Name Hashing** | **Hashování atomických tříd (generování názvu třídy)** | "hash" = haš |
| **Hash Function** | **Hašovací funkce** | Established |
| **Deterministic Class Name (Slug)** | **Deterministický název třídy (slug)** | |
| **Deduplication** | **Deduplikace** | Established |
| **Compiler Lowering** | **Snižování úrovně abstrakce (lowering)** | Compiler term, retained |
| **Desugaring** | **Odstranění syntaktického cukru (desugaring)** | Retained; "syntactic sugar" = "syntaktický cukr" |
| **Shorthand → Longhand Expansion** | **Rozepsání zkratek na plné vlastnosti** | |
| **Static Evaluation** | **Statické vyhodnocení** | |
| **Box Node** | **Uzel boxu** | Already in `GLOSSARY.md` §1 |
| **CSS Custom Property** | **Vlastní vlastnost CSS (custom property)** | Standard (`var()`) |
| **Token Reference / Alias** | **Odkaz na token / alias tokenu** | DTCG concept |
| **Failure Mode** | **Poruchový režim (failure mode)** | Reliability/FMEA term, established |
| **Silent Extraction Failure** | **Tiché selhání extrakce** | Descriptive |
