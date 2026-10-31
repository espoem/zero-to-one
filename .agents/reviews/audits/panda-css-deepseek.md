🍄💬: **Audit of `technologies/panda-css` against AGENTS.md — verdict: content is strong and honestly evidenced; findings are mostly P2/P3, with one P1 outside the track (root README) and one P1-adjacent scope claim inside it.** No P0 found: I found no removed v1 API taught as current, no failing test claim, no broken relative path, no absolute path, no secret.

## Scope note (what I could and could not execute)

This session had read/grep/find/ls only — no shell — so I did **not** re-run `npm test`, `npm run typecheck`, `tools/mermaid-check`, `tools/table-check` or a link checker. Every mechanical claim below is a static read of the files. To close the mechanical gate, run:

```bash
cd technologies/panda-css && mise exec -- npm run typecheck && mise exec -- npm test
mise exec -- node ../../tools/mermaid-check/check.mjs .
mise exec -- node ../../tools/table-check/check.mjs .
```

## Area verdicts

| Focus area | Verdict | Evidence |
|---|---|---|
| Heading consistency | 🟡 Pass with nits | `## Prerequisites` (README:7), `## Syllabus` (13), `## Certifications & Exams` (87), `## Running the tests` (57) all present; `Verified against` line (3). Module titles in the syllabus table do **not** match module H1s (P2 #3). |
| Verified vs stale | 🟡 One real staleness (root README), rest internally consistent | 2.4.0 pins in `package.json` == README line 3 == every module's `Verified against`; `mise.lock` has real sha256 for linux-x64 + macos-arm64; v1 idioms (`createStyleContext`, `panda ship`, `emitPackage`, `containerSizes`, `lightningcss`, template literals) appear only inside Then-vs-now/migration contexts. |
| Depth | 🟢 Good | 12 modules each carry an `Executable proof` line pointing at files that exist (verified: `examples/tests/*` 13 files, `__snapshots__` 12 CSS, `fixtures/negative` 11, `fixtures/configs` 14, `bench/`, `scripts/v2-upgrade-audit.ts`, `tests/helpers/browser.ts`). Interview Drills: 6–8 per module (requirement 5–10). Exam bank: 60 Q, 7 domains, weights match counts, 4 hands-on tasks each naming a real test, mock exam with scoring key. |
| Mermaid + table pipes | 🟢 Parse-clean on read, 2 nits | 7 diagrams (M01 ×2, M02, M06, M08, M10 ×2). Labels are quoted where special chars appear; no `;` in sequence text; anchors used in refs all resolve (I checked every `#…` target: `#presets-is-no-longer-implicit`, `#after-any-upgrade---clean`, `#93-jsxstyleprops-…`, `#0x--1x`, `#diagnostics-you-will-see-and-one-you-will-not` etc.). Pipe escaping: only two escaped pipes exist (`M02:34`, `M10:201`), both correct; I found no unescaped pipe inside a cell in the tables I read. |

---

## P0 — none

## P1 — misleads

1. **`README.md:52` (repo root) is stale and contradicts the merged track.** It still says Panda CSS is "Repo on ^0.51 — two breaking majors; createStyleContext, panda ship, studio removed; Oxc compiler · 🟠 Restructuring (Phase 1)". `.agents/STATUS.md` records `technologies/panda-css` as ✅ merged 2026-10-30 with 118 tests at 2.4.0, and `technologies/panda-css/README.md:3` says the same. Fix: update the row to the merged state (version, test count, date) — and sweep the same table, since every merged Phase-1 track still shows Planned/Restructuring. Source: `.agents/STATUS.md`, `technologies/panda-css/README.md:3`.

2. **`technologies/panda-css/README.md:32` — the out-of-scope sentence claims coverage that does not exist.** It lists "`@pandacss/preset-typography`; `positionTry()`, `viewTransition()` and `firstThatWorks()` helpers beyond mentions". `viewTransition()` *is* mentioned (`modules/06:168`) and so is the ESLint/oxlint plugin (`modules/11:170`), but `preset-typography`, `positionTry()` and `firstThatWorks()` appear **nowhere** in the track (grep: 0 hits outside README:32). AGENTS.md § Topic Depth 5 requires out-of-scope items to be listed with a reason — the reason is fine; the "beyond mentions" wording is false. Fix: either add one clause each in M04 (`positionTry`, `firstThatWorks`) and M06 (`preset-typography`), or reword to "not covered (thin wrappers over CSS features owned by `languages/css`)".

## P2 — inconsistent

3. **Syllabus titles ≠ module H1 titles (all 12).** `README.md:17–31` uses sentence case with `&`; modules use Title Case with "and", and 03/09 add a leading "The":

| README table | Module H1 |
|---|---|
| `Static CSS-in-JS mental model & v2 architecture` | `Static CSS-in-JS Mental Model and the v2 Architecture` |
| `Styling API & conditions` | `The Styling API and Conditions` |
| `JSX factory & style props (React and Solid)` | `The JSX Factory and Style Props (React and Solid)` |
| `Monorepos & shipping a design-system library` | `Monorepos and Shipping a Design-System Library` |

Fix: copy each H1 into the table (or normalise both to the same string). Same drift exists between react/solidjs READMEs and their modules, so a repo-wide normalisation is the cheaper call.

4. **`README.md:57–85` bypasses the pinned toolchain.** Commands are bare `mise install`, `npm install`, `npx playwright install chromium`, `npm run typecheck`, `npm test`. AGENTS.md § Isolation and Polyglot Tooling rule 4 requires `mise exec -- <cmd>`; the sibling `technologies/react/README.md:38–43` does exactly that (`mise exec -- npm ci`). Fix: prefix the four commands; keep `mise install` bare.

5. **Cross-links to the CSS owner stop at its README, now that `languages/css` has landed.** Twelve references point at `../../../languages/css/README.md` (M01:10,122,242,261,286; M03:8; M04:6; M05:6,101; M06:6,168; M12:8; GLOSSARY:5,37,76; README:10) even though the target track has stable module files whose titles the prose already names. Verified targets: `03-cascade-layers-and-scope.md` ("The Cascade, Layers & Scope"), `09-custom-properties-registered-and-functions.md`, `06-layout-flexbox-grid-subgrid-and-lanes.md`, `08-containment-and-container-queries.md`, `10-color-theming-and-typography.md`, `14-css-architecture-and-design-tokens.md`. Fix: link to the module file (AGENTS.md § Knowledge Ownership 1: "Other tracks cross-link to it"). This also closes item 3 of the track's own review file.

6. **Mock-exam question count is wrong in two places.** `exams/README.md:36` says "24-question loop" and `exams/interview.md:771` says `| **60 min** | **24** |`, but the block table lists 8 + 6 + 8 + 2 + 1 = **25** questions (blocks 1–5: Q-INT-001/003/013/019/028/037/049/055; 002/006/030/040/053/056; 007/012/020/025/032/038/050/057; 048/017; 022). Points and time do sum to 100 / 60 min, and the domain mix (D1 24 %, D5 16 %, D3 16 %, D4 12 %, D6 12 %, D7 12 %, D2 8 %) tracks the weights closely, so only the count needs fixing.

7. **Glossary duplicates terms owned elsewhere.** `GLOSSARY.md:93` (Tree Shaking) and `:94` (Monorepo) define concepts that `languages/javascript/GLOSSARY.md:105` already defines with identical English/Czech wording; `:17` (Constant Folding) and `:18` (AST) are general CS terms the root glossary does not yet carry. `:19` (Pure Function) does it correctly — "(Root glossary.)" plus a delta. The track's own review proposed promoting all four to the root glossary; that is still open. Fix: register Constant Folding/AST/Monorepo in `GLOSSARY.md` (root) and convert the four panda rows to the "↑ root" form used by `technologies/react/GLOSSARY.md:12,38`.

8. **`.agents/OWNERSHIP.md:45` registers only one panda concept.** AGENTS.md § Knowledge Ownership 2 requires unregistered cross-cutting concepts to be registered in the same change. Missing: *static style extraction / source transforms as a build-time CSS-in-JS compiler technique* (taught in M01/M10, referenced by `languages/css` architecture module), *design-system distribution via build info* (`panda lib`/`designSystem`, M11), and *cascade-layer coexistence during a CSS migration* (`@import … layer()`, M12:52–56 — the general technique belongs to `languages/css`, panda keeps only the delta). The track's review proposed the first two; neither landed.

9. **`modules/05-design-tokens.md:24` vs `:52` — definitional drift.** §5.1 defines core tokens as "unconditional values (`brand.600 = #4f46e5`)", but §5.2's example declares `radii: { control: { value: '{radii.md}' } }` — a core token whose value is a reference, not a value. Fix: "unconditional values *or unconditional references* (`{radii.md}`), as opposed to semantic tokens that may vary by condition."

## P3 — polish

10. **Verification dates disagree across the track.** M01:3 says 2026-10-28; the other eleven modules, the cheatsheet and the README say 2026-10-29; README adds "tests re-run 2026-10-30". Harmless but it makes "when was this last checked" ambiguous. Pick the re-run date as the track date, or keep per-module dates and say so in one line of README.

11. **`README.md:3` narrows the compiler claim to linux-x64** ("native `@pandacss/compiler` on linux-x64") while `.agents/reviews/panda-css.md` records the verifier running it on macOS arm64 *and* linux x64, and the working tree is macOS. M01's "~11 MB … measured on linux-x64 only" is correctly scoped; the README line should match.

12. **`modules/02:166` miscounts the projects.** "runs `prepare → codegen` for the four example projects" — the script covers six `panda codegen` invocations plus `panda lib` (react, solid, vanilla, fixtures, monorepo/packages/ds, monorepo/apps/web).

13. **`modules/02:231` and `modules/12:117` list `studio` as a removed config option without the CLI nuance.** M02's drill 7 and the 2.4.0 row in M12:155 both say `panda studio` was re-added (hosted, live-connected), and the cheatsheet:40 lists it as a command. A reader of §2.7/§12.3 step 19 could delete a working `panda studio` script line. Add "(the config option; the CLI command returned in 2.4.0)".

14. **`exams/interview.md:540` mislabels its target.** Ref reads "M08 §8.2 … `#then-vs-now`", but `#then-vs-now` is the h3 at `modules/08:123`, which sits in §8.3 (extraction), not §8.2. Use `§8.3` or drop the number.

15. **`exams/README.md` D4 row cites `type-tests.ts` with no path** (two occurrences: matrix row D4, and interview Q-INT-030/031 refs). The file is `examples/react/src/type-tests.ts`; M05:9 gets this right.

16. **Two diagrams parse but their layout encodes the wrong story.** M01:124 uses `flowchart BT` for the cascade ladder (reset at the bottom, utilities at the top), while M06:19 and M10:12 use `TD`/`LR`; a reader trained on top-down diagrams can invert the precedence. M10:12 declares `glob["glob include/exclude"] --> files` in the `host` subgraph but `files` is first mentioned inside the `rust` subgraph, so the node renders on the Rust side of the boundary. Neither is a syntax error; fix by using `flowchart TD` with the ladder written lowest→highest and by declaring `files` in the host subgraph.

17. **`modules/07:111` and `modules/12:149` use "order" for two different things.** M07 says runtime variant *class strings* follow `defaultVariants` key order; M12's 2.3.0 row says recipe variants *emit in config order* again. Both are defensible (attribute order vs stylesheet order) but adjacent readers will see a contradiction. One clause in M07 — "attribute order, not emission order" — settles it.

18. **`.agents/reviews/panda-css.md` is stale in two "Remaining work" items.** Item 2 asks for `mise lock` checksums that `mise.lock` now contains (linux-x64 + macos-arm64), and item 3 says `languages/css` is "not yet in the repo" when it has merged. Update the review file so the next auditor does not re-open resolved work.

19. **Heading convention: the audit brief's `## 1. Modules` / `## 2. Certifications & Exams` pattern does not exist in this repo.** No track has a `## Modules` heading; AGENTS.md only mandates a **Certifications & Exams** section. The repo is split: eight tracks number their sections (`languages/css`, `postgres`, `dsa`, `python`, `data-systems`, `networking`, `security-identity`, `distributed-systems`), five do not (`javascript`, `typescript`, `react`, `solidjs`, `panda-css`). Panda-css matches its frontend siblings, so nothing to change inside the track — but the "Out of scope" paragraph (`README.md:32`) is the one item worth promoting to a `## Out of scope` heading, since react (`README.md:32`) and solidjs keep it inline too and neither is discoverable by a table of contents.

20. **`tools/table-check` is not part of this track's documented gate.** The verifier record lists `tools/mermaid-check` only, and `README.md:85` says "Mermaid diagrams parse with Mermaid 11 and 12" without mentioning table validation. Add `node ../../tools/table-check/check.mjs .` to the README test block and to `.agents/REVIEW.md` §A so pipe escaping is enforced rather than audited by eye.

---

## What I checked and found correct (do not re-open)

- **Version pins are coherent**: `package.json` (`@pandacss/dev`, `preset-base`, `preset-panda`, `vite` 2.4.0; TS 7.0.2; Vite 8.3.5; React 19.3.1; Solid 1.9.17; PostCSS 8.5.32; Playwright 1.64.1) matches README:3, M02:3, M09:3 and `.mise.toml` (`node = "26"`) + `mise.lock` (26.12.1, checksums present).
- **v2 compiler and AST extraction** are taught as current with the v1 `ts-morph`/`ts-evaluator` engine explicitly demoted to history (M01:43–52, M10:123–131), and the fold rules carry a negative test per rule (`negative-extraction.test.ts` + 11 negative fixtures, all present).
- **Recipes, slot recipes, tokens, `@layer`** are internally consistent across M01/M03/M05/M07/M08/GLOSSARY: the five-layer statement, the `recipes` sub-ladder `base, slots, variants, compound_variants`, property-breadth ordering, and `token()`-vs-`token.var()` all agree, and each has a snapshot or e2e assertion.
- **The zero-runtime story is not oversold**: M01:173–196 measures 19,811 → 923 B on the all-static vanilla build and states plainly that the React bundle grew ~3 KB because dynamic call sites keep the runtime.
- **Ownership cross-links exist for every borrowed concept** (`languages/typescript` in M08:8/M09:6, `solidjs` in M03:196, `react`/`solidjs` in M08:8) and no module re-teaches cascade theory — each defers and adds only the Panda delta.
- **No absolute paths, `file:///`, tokens or e-mail addresses** in the track's Markdown (grep: 0 hits).
- **Every exam question** carries the required `### Q-INT-NNN · D<n> · difficulty <1-3> · <type>` header, a `<details>` answer, distractor reasons and module + doc refs; hands-on tasks Q-INT-011/027/044/059 each name an existing test.
