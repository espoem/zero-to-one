# Drafter/Auditor Audit: languages/css
Auditor: `opencode-go/deepseek-v4.1-flash`
Target: `languages/css`
Date: 2026-10-31

---

## P0 — wrong now

1. **Module 13 (`Rendering Pipeline & Performance`) mapping:**
   `README.md:76` lists Module 13 runnable example as `examples/01-platform-and-lightningcss.test.ts`. `examples/13-design-tokens-dtcg.test.ts` proves Module 14. Add dedicated test for Module 13, rename tokens test to `14-design-tokens-dtcg.test.ts`, and re-point both READMEs.

2. **`@property` duplicate-registration rule:**
   `modules/09-…functions.md:113-115` claims first declaration wins. In CSS `@property` syntax, the *later* registration in document order wins (only JS `CSS.registerProperty()` throws `InvalidModificationError`). Correct the text and interview drill.

3. **Module 01 import dependency:**
   `modules/01-…-tooling.md:157` shows `import browserslist from 'browserslist'`, which is not installed. Either add `browserslist` to devDependencies or drop the import and show target literals.

---

## P1 — misleads

4. **"Four core engines"**: Clarify as "all four core browsers (Chrome, Edge, Firefox, Safari), implemented by three engines (Blink, Gecko, WebKit)".
5. **Cascade sort order steps**: Reconcile step count (6 criteria in CSS Cascade 5: origin+importance, context, style attribute, specificity, scope proximity, order of appearance) and clarify the 8 origin/importance sub-levels.
6. **Chromaticity percentages**: Correct Display P3 coverage to ~25% larger than sRGB in CIE 1931 xy space (not ~50% wider).
7. **Mermaid explicit order**: In `modules/11:91-99`, `modules/04:148-155`, and `modules/06:98-105`, add explicit directed links so layouts cannot permute sequential steps.

---

## P2 / P3 — Polish

- Run `tools/mermaid-check` and `tools/table-check`.
- Align module titles between README and H1s.
