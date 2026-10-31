# Challenger Audit: languages/css
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `languages/css`
Date: 2026-10-31

---

## P0 — Factually wrong / must fix (blocks final gate)

1. **Q-CSS-006 answer key inverted — exam invalid:**
   `exams/interview.md:67-82` options: A `(1,2,2)` B `(0,2,2)` C `(1,1,2)` D `(1,0,2)`. Body correctly derives `(1,1,2)` = C (`:is` takes max `#header` A=1 + `.active` B=1 + `ul,li` C=2), then labels `**A.**` correct and says “Why not A: (1,2,2)…”. Key must be **C**. Currently auto-grading / mock (Q3) scores correct answer as wrong.

2. **`display: grid-lanes` taught as standardized consensus — false:**
   `06:146-168,201,236`, Q-029, Q-072, README syllabus. Claims “W3C CSSWG achieved formal consensus in CSS Grid Level 3”, “Safari 26.4 shipped”, `@supports (display: grid-lanes)`. As of cutoff no CR/REC, no Baseline, still ED with competing proposals (`display: masonry`, `grid-template-rows: masonry`, `item-flow`). Do not teach `@supports` snippet as production. Downgrade to “Editor’s Draft proposal `(unverified)`, do not ship” + remove Baseline/date claims.

3. **Cascade origin table omits Transitions/Animations + miscounts steps:**
   `03:11-31` diagram says 7 steps but text says “8-step”; table lists 6 levels low→high `UA-normal → User-normal → Author-normal → Author!important → User!important → UA!important`, omitting `Transition` (highest) and `Animation` (above normal Author). Contradicts `CHEATSHEET.md §2` which does list them (in different order). Fix to CSS-Cascade-5 §6.1 full order and reconcile inline-style vs layer vs shadow-context ordering.

4. **Stacking-context triggers incomplete + self-contradictory:**
   `07: What Establishes…` lists only “positioned with `z-index != auto`”, omits that `fixed`/`sticky` always create SC even with `z-index:auto`. `CHEATSHEET.md §8.2` correctly says `fixed/sticky` always do. Track contradicts itself. Also omits `contain: paint/strict/content`, `container-type: size`, `perspective` on parent, `backdrop-filter` (cheatsheet has it, module doesn’t). Fix to MDN/CSS-Compositing complete list.

5. **Containing-block trap overclaims `contain: layout`:**
   `07: Transformed Ancestor Trap` §5: “`contain: paint`, `contain: layout`, or `container-type: size`” all trap `fixed`. Wrong: `contain: layout` alone traps `absolute` only; `contain: paint` / `strict` / `content` trap `fixed`. Split them, cite CSS-Contain §2.

6. **`filter`/`backdrop-filter` as composite-only — false:**
   `13:45-49` table: `transform, opacity, filter, backdrop-filter` “Bypass layout and paint entirely! 120fps”. `filter`/`backdrop-filter` invalidate paint (re-record display items, expensive). Only `transform`+`opacity` are guaranteed composite-only. Q-062 correctly says only those two — module table contradicts its own exam. Fix table.

7. **`reading-flow` values inconsistent + unverified:**
   `06: prose` says `reading-flow: grid-order or flex-visual`, code says `reading-flow: grid-rows`. Draft values are `normal | source-order | grid-rows | grid-columns | flex-visual` — `grid-order` does not exist. No Baseline. Mark `(unverified)`, unify to one value, add fallback warning.

8. **Future ED features taught as stable Baseline:**
   `contrast-color()` “Baseline Newly Available Apr 2026” (`10`), `if()` (`09: Space Toggles`), `@function --foo()` (`09`), `scroll-state(stuck: top)` (`08`), `contrast-color`, `reading-flow`. All ED, no WPT/Interop proof. Either delete or label `(unverified — ED, no Baseline)` per Version Currency rule. Same for `CSSNestedDeclarations in Cascade Level 6` (`02:173-186`, Q-009) — interface lives in CSS-Nesting/CSSOM, not Cascade-6. Fix attribution.

---

## P1 — Compliance / broken refs / unverified claims

9. **All interview `Ref:` anchors with numbered headings are 404:**
   GitHub slug keeps leading number: `## 1. The W3C…` → `#1-the-w3c-…`, but refs use `#the-w3c-specification-process--the-snapshot-model`, `#the-baseline-compatibility-standard--web-features`, `#specificity-mathematics-the-a-b-c-tuple`, `#the-six-stages-of-value-processing`, `#what-triggers-a-block-formatting-context`, etc. (~20 refs in Q001–Q075). Either add explicit `{#slug}` anchors or include `1-`/`2-` prefix. Verify with link checker.

10. **README ↔ exams ↔ examples mapping broken:**
    - `README.md §2 Module 13` links example `01-platform-and-lightningcss.test.ts` (copy-paste duplicate of Module 01).
    - Module 14 links `13-design-tokens-dtcg.test.ts` — file exists but numbered 13 for module 14, off-by-one.
    - `exams/README.md Domain 13` proof = “Chromium CDP Performance Metrics” (no file) violates “runnable verified test suite, 0 gaps”. Domain 14 proof points to `13-…` file.
    - README says “Run all 13 test suites” for 14 modules; `examples/` has 13 files. Fix names + add missing perf test or mark 🟡 with reason (AGENTS.md forbids ❌ but requires reason for 🟡).

11. **Certification section violates spec:**
    `README.md §1` claims only Senior/Staff loop; `exams/README.md §1` invents “freeCodeCamp 50-question timed exam” + “Meta Front-End Certificate” as recognized credentials with no exam code, vendor link, guide version/date, status, format, weights. AGENTS.md requires all five + domain-weight matrix deltas. Either fully document with links or delete and state “no certification exists → interview format”.

12. **Value-processing stage count inconsistent:**
    Module 04: 6 stages (Declared/Cascaded/Specified/Computed/Used/Actual); Cheatsheet §4: 4 stages; Q-016 ref: `#the-six-stages…` (broken anchor + non-standard term). W3C defines 4 (Specified/Computed/Used/Actual); Declared/Cascaded are pre-steps. Unify terminology.

13. **Mermaid not verified:**
    35 ` ```mermaid` fences found. Run `tools/mermaid-check` before commit.

---

## P2 — Ambiguities / depth gaps

14. **No formal cascade/specificity calculus:** No lexicographic proof that `(1,0,0) > (0,10000,0)`, no `!important` inversion truth table, no `revert-layer` vs `revert` vs `unset` decision tree with inherited/non-inherited examples.
15. **No rendering-pipeline mechanics:** No style-invalidation cost model, no LayoutNG single-pass vs legacy, no property-tree explanation, no `offsetWidth` forced-sync demo beyond prose.
16. **Subgrid margin/gap inheritance untouched:** Never states subgrid does *not* inherit `gap`/`margin` — tracks align, gutters must be redeclared.
17. **Anchor-positioning edge cases missing:** No `position-visibility`, no `anchor-size()`, no `position-try-order`.
18. **IACVT vs `@property` fallback confusion:** Q-074 correctly says invalid `<color>` reverts to `initial-value green`, but Module 09 never contrasts with unregistered `guaranteed-invalid` → `unset` → transparent.
19. **OKLCH “$L=70% identical brightness” overstated:** Soften to “approximately uniform; verify contrast with APCA”.

---

## P3 — Polish

20. **Tables:** No unescaped `|` inside `| … |` grid found — Then/Now matrices use backticked `|` correctly.
21. **Typos:** `06: DefaulMin` (Mermaid node), `13: will-change Hazard` layer-explosion VRAM math assumes DPR² without noting tiling/compression.
22. **GLOSSARY:** Rename “Specificity Forgiveness Zero” to “`:where()` zero-specificity”.
