# CSS Platform, Layout Engines & Architecture Curriculum

> **Verified against Node 26.12.1, TypeScript 7.0.2, Playwright 1.64.1, Chromium 156 on 2026-10-30**

Welcome to the **CSS Platform, Layout Engines & Modern Architecture Learning Track**. This curriculum delivers an exhaustive, academic, and production-tested deep dive into the modern Cascading Style Sheets platform. Moving beyond cosmetic styling, this track explores the underlying mathematical specifications, browser layout and visual formatting engines, rendering pipeline stages, color science, motion primitives, and design system token architectures.

Every module is grounded in authoritative primary specifications (W3C Working Group Recommendations, WHATWG Standards, Design Tokens Community Group) and accompanied by deterministic, headless Chromium test suites in [`examples/`](./examples/) running under native Node.js 26 test runner with Playwright.

---

## 1. Certifications & Industry Examination Standards

Unlike containerization or cloud platforms with vendor certifications (such as CKA or AWS Certified Solutions Architect), CSS does not have an official vendor or foundation certification. In accordance with the repository standard ([`AGENTS.md`](../../AGENTS.md) § Certification and Exam Coverage), technical competency in CSS is evaluated against the recognised industry benchmark:

- **Senior / Staff Frontend Engineering & Design Systems Technical Loop**:
  - **Focus**: Cascade priority algorithm, cascade layers (`@layer`), donut scoping (`@scope`), Block Formatting Contexts, flex factor space distribution formulas, CSS Grid fractional unit computations, subgrid track inheritance, stacking context formation criteria, HTML Top Layer isolation, container queries (`@container`), registered properties (`@property`), perceptual uniformity in OKLCH, relative color derivation, View Transitions pseudo-trees, layout thrashing prevention, and W3C DTCG token schema architecture.
- **[exams/README.md](./exams/README.md)**: Full examination coverage matrix mapping all 14 domains to curriculum modules and verified Playwright test suites with 100% full coverage (0 gaps).
- **[exams/interview.md](./exams/interview.md)**: 75 original technical interview questions tagged across difficulty levels 1–3 (Single Choice, Multiple Select, Scenario Analysis, Ordering, Code Inspection, and Hands-on Tasks) plus a 60-minute mock examination with grading criteria.

---

## 2. Curriculum Syllabus & Topic Breakdown

The curriculum is structured into 14 self-contained, progressively deepening modules:

### [Module 01 — CSS Platform Specs, Baseline & Tooling](./modules/01-css-platform-specs-baseline-and-tooling.md)
- **Concepts**: W3C CSS Working Group process, CSS Snapshot standards, Web Platform Baseline ("Newly available" vs. "Widely available"), AST parsers and compilers (Lightning CSS, PostCSS), vendor prefixes, and transpilation mechanics.
- **Runnable Example**: [`examples/01-platform-and-lightningcss.test.ts`](./examples/01-platform-and-lightningcss.test.ts)

### [Module 02 — Syntax, Selectors & Specificity](./modules/02-syntax-selectors-and-specificity.md)
- **Concepts**: The three-component specificity vector $(A, B, C)$, forgiving selector lists, `:where()` zero specificity, `:is()` maximum-specificity inheritance, relational selector `:has()` parent querying, and structural pseudo-classes (`:nth-child(An+B of S)`).
- **Runnable Example**: [`examples/02-selectors-and-specificity.test.ts`](./examples/02-selectors-and-specificity.test.ts)

### [Module 03 — Cascade, Cascade Layers & Scope](./modules/03-cascade-layers-and-scope.md)
- **Concepts**: Complete 8-tier cascade priority algorithm, origin & importance hierarchy, cascade layers (`@layer`) forward order vs. `!important` inversion, and `@scope (root) to (limit)` donut scoping with scope proximity tie-breaking.
- **Runnable Example**: [`examples/03-cascade-layers-and-scope.test.ts`](./examples/03-cascade-layers-and-scope.test.ts)

### [Module 04 — Value Processing & Units](./modules/04-value-processing-and-units.md)
- **Concepts**: The four value processing phases (Specified $\rightarrow$ Computed $\rightarrow$ Used $\rightarrow$ Actual), dynamic viewport units (`dvh`, `lvh`, `svh`), mathematical evaluation (`calc()`, `clamp()`, `min()`, `max()`, `round()`, `mod()`), and font metrics (`ch`, `lh`).
- **Runnable Example**: [`examples/04-value-processing-and-units.test.ts`](./examples/04-value-processing-and-units.test.ts)

### [Module 05 — Box Model & Visual Formatting Model](./modules/05-box-model-and-visual-formatting-model.md)
- **Concepts**: Box sizing geometry (`content-box` vs. `border-box`), vertical margin collapsing mechanics and exceptions, Block Formatting Context (BFC) establishment triggers (`display: flow-root`), and intrinsic sizing keywords (`min-content`, `max-content`, `fit-content`).
- **Runnable Example**: [`examples/05-box-model-and-bfc.test.ts`](./examples/05-box-model-and-bfc.test.ts)

### [Module 06 — Layout: Flexbox, Grid, Subgrid & Lanes](./modules/06-layout-flexbox-grid-subgrid-and-lanes.md)
- **Concepts**: Flexbox 1D space distribution algorithms, flex factor calculations (`flex-grow`, `flex-shrink`), CSS Grid 2D track sizing, fractional `fr` space allocation, `auto-fit` vs. `auto-fill`, and nested `subgrid` track alignment.
- **Runnable Example**: [`examples/06-flexbox-and-grid.test.ts`](./examples/06-flexbox-and-grid.test.ts)

### [Module 07 — Positioning, Stacking Contexts & Top Layer](./modules/07-positioning-stacking-and-top-layer.md)
- **Concepts**: 3D Stacking Context creation conditions, the Painter's Algorithm rendering order, HTML Top Layer isolation (`[popover]`, `<dialog>`, `::backdrop`), light-dismiss behavior, and CSS Anchor Positioning.
- **Runnable Example**: [`examples/07-stacking-and-top-layer.test.ts`](./examples/07-stacking-and-top-layer.test.ts)

### [Module 08 — Containment & Container Queries](./modules/08-containment-and-container-queries.md)
- **Concepts**: CSS containment primitives (`contain: size layout paint style`), inline-size query containers (`container-type: inline-size`), dimensional `@container` rules, container query units (`cqw`, `cqh`, `cqi`), and container style queries on custom properties.
- **Runnable Example**: [`examples/08-container-queries.test.ts`](./examples/08-container-queries.test.ts)

### [Module 09 — Custom Properties, Registered Properties & Functions](./modules/09-custom-properties-registered-and-functions.md)
- **Concepts**: CSS custom properties token substitution, guaranteed-invalid value states, invalid-at-computed-value-time fallback rules, and typed Houdini `@property` registration with syntax definitions enabling smooth transitions.
- **Runnable Example**: [`examples/09-registered-properties.test.ts`](./examples/09-registered-properties.test.ts)

### [Module 10 — Color Spaces, Theming & Typography](./modules/10-color-theming-and-typography.md)
- **Concepts**: Color science, CIE color models, perceptual uniformity, OKLCH color space ($L, C, H$), wide gamut displays (Display P3 vs. sRGB), Relative Color Syntax (`oklch(from var(--x) ...)`), and OpenType variable fonts design axes.
- **Runnable Example**: [`examples/10-color-oklch-and-theming.test.ts`](./examples/10-color-oklch-and-theming.test.ts)

### [Module 11 — Motion: Transitions, Animations & View Transitions](./modules/11-motion-transitions-animations-and-view-transitions.md)
- **Concepts**: Cubic Bézier easing curves, discrete property transitions (`transition-behavior: allow-discrete`), DOM entry transitions via `@starting-style`, and the View Transitions API pseudo-tree architecture.
- **Runnable Example**: [`examples/11-motion-and-starting-style.test.ts`](./examples/11-motion-and-starting-style.test.ts)

### [Module 12 — Responsive & Accessible CSS](./modules/12-responsive-and-accessible-css.md)
- **Concepts**: Operating system media features (`prefers-reduced-motion`, `prefers-contrast`, `forced-colors`), WCAG 2.2 / APCA contrast algorithms, `:focus-visible` keyboard modality matching, and accessible visually-hidden screen-reader patterns.
- **Runnable Example**: [`examples/12-responsive-and-accessibility.test.ts`](./examples/12-responsive-and-accessibility.test.ts)

### [Module 13 — Rendering Pipeline & Performance](./modules/13-rendering-pipeline-and-performance.md)
- **Concepts**: Critical Rendering Path (DOM/CSSOM $\rightarrow$ Render Tree $\rightarrow$ Layout $\rightarrow$ Paint $\rightarrow$ Composite), style recalculation algorithms, layout thrashing anti-patterns, GPU layer compositing (`transform`, `opacity`), and `content-visibility: auto`.
- **Runnable Example**: [`examples/13-rendering-pipeline-performance.test.ts`](./examples/13-rendering-pipeline-performance.test.ts)

### [Module 14 — CSS Architecture & Design Tokens](./modules/14-css-architecture-and-design-tokens.md)
- **Concepts**: Evolution of CSS architecture (BEM, CSS Modules, Utility-First, Zero-Runtime CSS), Design Tokens Community Group (DTCG) W3C specification, 3-tier token hierarchy (Global $\rightarrow$ Semantic $\rightarrow$ Component), and token compilation pipelines.
- **Runnable Example**: [`examples/14-design-tokens-dtcg.test.ts`](./examples/14-design-tokens-dtcg.test.ts)

---

## 3. Quick Reference & Terminology

- **[GLOSSARY.md](./GLOSSARY.md)**: Authoritative English ↔ Czech terminology index covering all 14 core topic areas.
- **[CHEATSHEET.md](./CHEATSHEET.md)**: High-density quick-lookup reference containing syntax templates, specificity calculation formulas, cascade resolution flowcharts, and alignment matrices.

---

## 4. Running Verification Test Suites

All tests run against headless Chromium using Node.js 26 native test runner and Playwright:

```bash
# Navigate to the track directory
cd languages/css

# Activate pinned toolchain via mise
mise exec -- npm install

# Run all 13 test suites (concurrency limited to 4 browser instances)
mise exec -- npm test

# Run TypeScript typecheck
mise exec -- npm run typecheck
```
