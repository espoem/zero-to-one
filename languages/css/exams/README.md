# CSS & Modern Web Platform: Industry Standards & Exam Coverage Matrix

This directory contains the certification preparation question bank, curriculum domain mapping, and a comprehensive mock examination for modern CSS and web platform architecture.

---

## 1. Targeted Standards & Industry Evaluation

CSS is an open web standard governed by the W3C CSS Working Group. Unlike proprietary cloud or Linux systems, the W3C does not operate a vendor-neutral developer certification program. Industry evaluation is anchored in two standards:

1. **Recognized Professional Credentials (Entry & Practitioner Tier)**:
   - **freeCodeCamp Responsive Web Design Certification**: The recognized open credential (relaunched with 5 verification projects, module quizzes, and a 50-question timed exam environment). Evaluates foundational HTML5 semantics, flexbox, and media queries.
   - **Meta Front-End Developer Certificate (Coursera)**: Industry specialization covering CSS fundamentals, responsive grids, and design system implementation.
2. **Senior & Staff Frontend Engineer Technical Interview Loop**:
   - The primary hiring evaluation standard across tier-1 software companies (Google, Meta, Apple, Vercel, Stripe, Airbnb).
   - **Format**: Live component implementation from design mocks without frameworks, cascade and specificity debugging ("why does this rule lose?"), stacking context and top layer troubleshooting, Core Web Vitals optimization (CLS/INP), fluid layout scaling without layout thrashing, and enterprise design tokens (W3C DTCG 2025.10).

---

## 2. Exam Domain Coverage Matrix

| Domain # | Domain / Objective | Weight | Primary Module | Executable Proof | Status |
| :-: | :--- | :-: | :--- | :--- | :-: |
| **01** | Platform Specs, Snapshots, Baseline & Tooling | 7% | [01-css-platform-specs-baseline-and-tooling.md](../modules/01-css-platform-specs-baseline-and-tooling.md) | [01-platform-and-lightningcss.test.ts](../examples/01-platform-and-lightningcss.test.ts) | ✅ Full |
| **02** | Syntax, Selectors & Specificity Math | 8% | [02-syntax-selectors-and-specificity.md](../modules/02-syntax-selectors-and-specificity.md) | [02-selectors-and-specificity.test.ts](../examples/02-selectors-and-specificity.test.ts) | ✅ Full |
| **03** | The Cascade, Layers (@layer) & Scope (@scope) | 9% | [03-cascade-layers-and-scope.md](../modules/03-cascade-layers-and-scope.md) | [03-cascade-layers-and-scope.test.ts](../examples/03-cascade-layers-and-scope.test.ts) | ✅ Full |
| **04** | Value Processing Lifecycle & Modern Units | 7% | [04-value-processing-and-units.md](../modules/04-value-processing-and-units.md) | [04-value-processing-and-units.test.ts](../examples/04-value-processing-and-units.test.ts) | ✅ Full |
| **05** | Box Model, Formatting Contexts (BFC) & Sizing | 8% | [05-box-model-and-visual-formatting-model.md](../modules/05-box-model-and-visual-formatting-model.md) | [05-box-model-and-bfc.test.ts](../examples/05-box-model-and-bfc.test.ts) | ✅ Full |
| **06** | Layout: Flexbox, Grid, Subgrid & Grid-Lanes | 9% | [06-layout-flexbox-grid-subgrid-and-lanes.md](../modules/06-layout-flexbox-grid-subgrid-and-lanes.md) | [06-flexbox-and-grid.test.ts](../examples/06-flexbox-and-grid.test.ts) | ✅ Full |
| **07** | Positioning, Stacking Contexts & Top Layer | 8% | [07-positioning-stacking-and-top-layer.md](../modules/07-positioning-stacking-and-top-layer.md) | [07-stacking-and-top-layer.test.ts](../examples/07-stacking-and-top-layer.test.ts) | ✅ Full |
| **08** | Containment & Container Queries (Size & Style) | 7% | [08-containment-and-container-queries.md](../modules/08-containment-and-container-queries.md) | [08-container-queries.test.ts](../examples/08-container-queries.test.ts) | ✅ Full |
| **09** | Custom Properties, @property & CSS Functions | 7% | [09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md) | [09-registered-properties.test.ts](../examples/09-registered-properties.test.ts) | ✅ Full |
| **10** | Color Spaces (OKLCH), RCS & Typography | 7% | [10-color-theming-and-typography.md](../modules/10-color-theming-and-typography.md) | [10-color-oklch-and-theming.test.ts](../examples/10-color-oklch-and-theming.test.ts) | ✅ Full |
| **11** | Motion, Transitions, Scroll & View Transitions | 8% | [11-motion-transitions-animations-and-view-transitions.md](../modules/11-motion-transitions-animations-and-view-transitions.md) | [11-motion-and-starting-style.test.ts](../examples/11-motion-and-starting-style.test.ts) | ✅ Full |
| **12** | Responsive & Accessible CSS (Forced Colors) | 6% | [12-responsive-and-accessible-css.md](../modules/12-responsive-and-accessible-css.md) | [12-responsive-and-accessibility.test.ts](../examples/12-responsive-and-accessibility.test.ts) | ✅ Full |
| **13** | Rendering Pipeline, Performance & Core Web Vitals | 5% | [13-rendering-pipeline-and-performance.md](../modules/13-rendering-pipeline-and-performance.md) | Chromium CDP Performance Metrics | ✅ Full |
| **14** | Architecture, Zero-Runtime & Design Tokens (DTCG) | 4% | [14-css-architecture-and-design-tokens.md](../modules/14-css-architecture-and-design-tokens.md) | [13-design-tokens-dtcg.test.ts](../examples/13-design-tokens-dtcg.test.ts) | ✅ Full |

---

## 3. Question Bank Navigation

The complete preparation question bank, categorized by domain and difficulty (1–3), is available in:
- [interview.md](./interview.md) — 70+ rigorous questions spanning single-choice, multiple-select, scenario analysis, ordering, and hands-on debugging tasks, complete with comprehensive explanations, distractor analysis, cross-module citations, and a 60-minute mock examination with scoring rubrics.
