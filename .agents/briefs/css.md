# Brief: CSS & web platform (`languages/css`)

| | |
|---|---|
| Phase | 1 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/css` · `../zto-css` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/H-css.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- **Foundation track (decision D7).** panda-css, react and solidjs cross-link to it. The research dossier is `.agents/research/H-css.md`.
- Use the **web-features dataset** (via `web-features` / Baseline) as the source of truth for Baseline status, not blog prose. Anchor positioning is the known conflict: teach the core as shippable and flag the dataset status.
- Generate visual snapshots inside the pinned Playwright Docker image, because macOS and Linux render fonts differently.
- No authoritative CSS certification exists. Say so in the README, map freeCodeCamp RWD as entry-level, and build the exam bank on the senior frontend interview format.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Cascade, `@layer`, `@scope`, specificity, inheritance, value processing
- Layout (flow, flex, grid, subgrid, anchor positioning), stacking contexts
- Custom properties, `@property`, container queries, color spaces
- View transitions, scroll-driven animations, top layer
- Design-token theory (W3C DTCG format)
- CSS architecture comparison (BEM/ITCSS, utility-first, runtime vs zero-runtime CSS-in-JS)
- Rendering pipeline internals (style → layout → paint → composite, reflow triggers)

**Cross-link only (do not re-explain):**
- HTML event loop & rendering steps (task → microtasks → rAF → style/layout/paint) → owned by `languages/javascript`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### CSS & web-platform rendering — `languages/css`

> Verification method: Baseline statuses below were read directly from the **web-features 3.44.0** dataset (npm, published 2026-10-22; the data source behind Baseline/MDN/caniuse badges) — `package/data.json` → `status.baseline` / `baseline_low_date` / `baseline_high_date`. Tool versions from the npm registry on 2026-10-28. Where web.dev prose and the dataset disagree, the dataset wins and the conflict is flagged.

- **Current stable version(s)**
  - **CSS has no version number.** It is a set of CSSWG modules at different maturity levels (ED → WD → CR → CRD → REC). "CSS3/CSS4" is not a thing; the snapshots are the official "what is CSS now" docs.
    - **CSS Snapshot 2026** — W3C Group Note, 2026-02-26: https://www.w3.org/TR/2026/NOTE-css-2026-20260226/ (announcement: https://www.w3.org/news/2026/css-snapshot-2026-published-as-a-group-note). Included modules are chosen for *spec stability, not browser adoption*, and the snapshot is aimed at implementers. Use it as the syllabus spine, and Baseline as the "can I ship it" axis.
    - CSS Snapshot 2025 — Group Note, 2025-09-09: https://www.w3.org/TR/2025/NOTE-css-2025-20250909/
    - Spec index: https://www.w3.org/Style/CSS/Specs ; editor's drafts: https://drafts.csswg.org/
  - **Baseline (the compatibility model)** — web-platform-dx/web-features: *Newly available* means the feature works in all core browsers (Chrome, Edge, Firefox and Safari, desktop and mobile). *Widely available* means 30 months after the newly-available date (the dataset's low→high dates are always +30 mo). Yearly cohorts ("Baseline 2024") also exist. https://web.dev/baseline ; explorer: https://web-platform-dx.github.io/web-features-explorer/
  - **Engines (Oct 2026):** Chrome 155 is stable (desktop rollout around 2026-10-06, https://borncity.com/news/chrome-155-desktop-version-soll-am-6-oktober-breit-verfuegbar-sein/). Firefox reached 155 by Sept 2026, and Safari 27 is out with 27.2 in beta (https://web.dev/blog/web-platform-09-2026). **Playwright 1.64.1** bundles Chrome for Testing 156.0.8078.4, Firefox 157.0 and WebKit 27.2 (read from `playwright-core@1.64.1/browsers.json`). Those are ahead of stable, so tests run on near-future engines.
  - **Interop 2026** (published 2026-02-12, https://web.dev/blog/interop-2026) has these CSS focus areas: anchor positioning, container style queries, dialogs/popovers, scroll-driven animations, view transitions, `attr()`, `contrast-color()`, custom highlights, scroll snap, `shape()`, `zoom`. This is the best predictor of what becomes Baseline in 2027.
  - **Feature status matrix (web-features 3.44.0)**

    | Feature | Baseline | Newly date / widely date | Notes |
    |---|---|---|---|
    | `@layer` | Widely | 2022-03 / 2024-09 | |
    | Nesting | Widely | 2023-12 / **2026-06** | |
    | `:has()` | Widely | 2023-12 / **2026-06** | |
    | Size container queries | Widely | 2023-02 / 2025-08 | |
    | Subgrid | Widely | 2023-09 / 2026-03 | |
    | OKLCH/OKLab, `color-mix()` | Widely | 2023-05 / 2025-11 | |
    | `inert`, `forced-colors` | Widely | — | |
    | `@property` (registered custom props) | Newly | 2024-07 (→ widely 2027-01) | |
    | Relative color syntax | Newly | 2024-09 | |
    | `@starting-style`, `transition-behavior` | Newly | 2024-08 | |
    | `light-dark()` | Newly | 2024-05; `<image>` in light-dark 2026-09 | |
    | Popover | Newly | 2025-01 | `popover="hint"`: Chrome 151 / FF 153 only |
    | Same-doc View Transitions (+ `view-transition-class`) | Newly | **2025-10-14** (Firefox 144) | |
    | `content-visibility` | Newly | 2025-09 | |
    | Invoker commands (`command`/`commandfor`) | Newly | 2025-12 | |
    | `shape()` | Newly | 2026-02 | |
    | `@scope` | Newly | **2026-03-24** | |
    | `contrast-color()` | Newly | **2026-04-10** | the renamed successor of `color-contrast()`, which was never shipped |
    | Container **style** queries | Newly | **2026-05-19** (Firefox 151) | |
    | Name-only container queries | Newly | 2026-05 | |
    | `field-sizing` | Newly | 2026-06 | |
    | `sibling-count()`/`sibling-index()` | Newly | 2026-08 | |
    | `progress()`, `revert-rule` | Newly | 2026-09 | |
    | **Anchor positioning** | **Not Baseline in dataset** | — | Core (`anchor-name`, `position-area`, `@position-try`) is in Chrome 125, Firefox 147 and Safari 26. Only `position-visibility: anchor-valid/anchor-visible` (Safari 27 only) keeps the umbrella feature out. web.dev's Jan 2026 post calls it Baseline Newly and is internally inconsistent about the Firefox version (147 vs 151): https://web.dev/blog/web-platform-01-2026. **Teach the core as shippable.** |
    | Scroll-driven animations | **Not Baseline** | Chrome 115, Safari 26; **no Firefox stable** | Interop 2026 area |
    | Cross-document view transitions (`@view-transition`) | **Not Baseline** | Chrome 126, Safari 18.2; no Firefox | |
    | Container scroll-state queries | Not Baseline | Chrome 133 only | |
    | Customizable `<select>` (`appearance: base-select`, `::picker(select)`, `<selectedcontent>`) | Not Baseline | Chrome 135, Safari 27; Firefox flag | |
    | `if()` | Not Baseline | Chrome 137 only | |
    | `@function` (css-mixins-1) | Not Baseline | Chrome 139 only | |
    | `@mixin` | Not Baseline | **no engine** | |
    | Typed `attr()` | Not Baseline | Chrome 133, Firefox 155 | |
    | `text-wrap: pretty` | Not Baseline | Chrome 117, Safari 26 | `balance` is Newly 2024-05 |
    | `interpolate-size`/`calc-size()` | Not Baseline | Chrome 129 only | |
    | `text-box` (trim) | Not Baseline | Chrome 133, Safari 18.2 | |
    | `random()` | Not Baseline | Chrome 156 (beta), Safari 26.2 | |
    | Scroll-triggered animations | Not Baseline | Chrome 146 | |
    | Masonry → **`display: grid-lanes`** (css-grid-3) | Not Baseline | **Safari 26.4 only** | Chromium is migrating from `display: masonry` (Chrome 140 flag) and Firefox from its `grid-template-rows: masonry` prototype: https://lilting.ch/en/articles/chrome-146-scroll-animation-safari-grid-lanes |
    | `corner-shape`, gap decorations, `reading-flow`, `interest-invokers`, scroll markers/buttons (carousels) | Not Baseline | Chromium only | |

  - **Tooling versions (npm, 2026-10-28)**
    - `@playwright/test` **1.64.1** (2026-10-14); 1.65 is in daily alpha.
    - `stylelint` **17.16.0** (2026-10-01; v17.0.0 2026-01-15) + `stylelint-config-standard` 40.0.0 + `stylelint-plugin-use-baseline` 1.4.8.
    - `@eslint/css` 2.0.1, which has a `use-baseline` rule.
    - `lightningcss` / `lightningcss-cli` **1.33.0** (2026-07-20).
    - `browserslist` **4.29.5**. It supports `baseline widely available`, `baseline 2024`, `baseline widely available on YYYY-MM-DD` and `with downstream` queries, verified in `index.js` via `baseline-browser-mapping` 2.11.34.
    - `postcss` 8.5.32, `postcss-preset-env` 11.6.1, `@axe-core/playwright` 4.14.0, `web-vitals` 6.2.3, `beasties` 0.5.5 (critical-CSS inliner, the successor of critters).
    - `style-dictionary` 5.7.1, `@terrazzo/cli` 2.10.0, `web-features` 3.44.0.
    - Cross-link targets: `tailwindcss` **4.3.3** (v4.0.0 released 2025-01-21), `@stylexjs/stylex` **0.19.1**, `@pandacss/dev` **2.4.0** (Panda **v2.0.0 shipped 2026-09-29**).
    - **Node 26**: 26.12.1 (2026-10-22). Read from the npm `node` binary-mirror package, not nodejs.org, which was proxy-blocked, so cross-check with `mise ls-remote node 26`. Node 26.0.0 shipped in early May 2026: https://kt3k.github.io/changelog/nodejs/node/2026-05-05
  - **W3C Design Tokens Format Module 2025.10** is the first stable version (2025-10-28) and has three modules:
    - Format: https://www.designtokens.org/tr/2025.10/format/
    - Color: https://www.designtokens.org/tr/2025.10/color/
    - Resolver: https://www.designtokens.org/tr/2025.10/resolver/
    - Announcement: https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
    - Format details: `$value`/`$type`/`$description`/`$extensions`/`$deprecated`, group `$extends`, `$root`, `{alias}` and JSON-Pointer `$ref`; media type `application/design-tokens+json`; extensions `.tokens`/`.tokens.json`. Reference implementations are Style Dictionary, Tokens Studio and Terrazzo.

- **Authoritative syllabi used**
  - **Primary specs**
    - CSS Snapshot 2026 module list (above).
    - CSS Cascade 5/6: https://www.w3.org/TR/css-cascade-5/ , https://drafts.csswg.org/css-cascade-6/
    - CSS Display 3, CSS2.2 §9–10 (visual formatting model): https://www.w3.org/TR/CSS22/visuren.html
    - Flexbox 1, Grid 2/3, Box Sizing 3/4, Position 3, Anchor Position 1: https://drafts.csswg.org/css-anchor-position-1/
    - Contain 2/3, Conditional 5, Values 4/5, Color 4/5, Fonts 4, Animations 1/2, Scroll Animations 1, View Transitions 1/2, Mixins 1: https://drafts.csswg.org/css-mixins-1/
    - Properties & Values API (`@property`): https://www.w3.org/TR/css-properties-values-api-1/
    - Selectors 4: https://www.w3.org/TR/selectors-4/
    - HTML Living Standard for popover, dialog, top layer and the rendering steps of the event loop: https://html.spec.whatwg.org/multipage/
    - Open UI customizable select: https://open-ui.org/components/customizableselect/
  - **Docs ToC**
    - MDN CSS reference + guides: https://developer.mozilla.org/en-US/docs/Web/CSS
    - web.dev "Learn CSS": https://web.dev/learn/css
    - web.dev Baseline monthly digests (e.g. https://web.dev/blog/web-platform-09-2026)
    - Chrome "CSS and UI" docs: https://developer.chrome.com/docs/css-ui
    - Interop 2026.
  - **Certifications — honest assessment: no authoritative, vendor-neutral CSS certification exists.** W3C does not certify developers, and nothing in CSS plays the role CKA plays for Kubernetes. Recognised but entry-level options:
    - **freeCodeCamp Responsive Web Design** (relaunched 2025-12-02). Requirements: 5 certification projects, module quizzes (20 Qs, 18 to pass), and a **50-question timed, closed-book exam** in freeCodeCamp's Exam Environment app. It is not proctored by webcam; staff review passing exams. Free. https://www.freecodecamp.org/news/freecodecamps-new-responsive-web-design-certification-is-now-live/ . Topics: semantic HTML, forms, a11y, flexbox, responsive design, grid. This is the closest thing to an "exam guide" — use it as a floor check, not a target.
    - **Meta Front-End Developer Professional Certificate** (Coursera). 9 courses, one of them "HTML and CSS in depth" (29 h, includes Bootstrap). Completion-based, with no domain weightings. https://www.coursera.org/professional-certificates/meta-front-end-developer
    - **W3Cx (edX) "CSS Basics" / "HTML5 and CSS Fundamentals"**, part of the W3Cx Front-End Web Developer program. A verified-certificate MOOC, partly dated (pre-layer/container-query era): https://classcentral.com/course/w3cx-front-end-web-developer-18397 ; https://www.edx.org/learn/css/the-world-wide-web-consortium-w3c-css-basics . Exact current pricing and syllabus are (unverified).
  - **Fallback target: the senior frontend interview format.**
    - Live CSS layout exercise (build a component from a mock, responsive, no framework).
    - Debugging rounds: specificity/cascade, a z-index that "doesn't work", overflow/scroll containers, CLS.
    - System-design round: design system, tokens, theming, CSS architecture at scale.
    - Performance deep-dive: rendering pipeline, layout thrash, Core Web Vitals.
    - Accessibility review.
    - Module weighting below mirrors this rather than an exam blueprint.

- **Proposed modules** (14, progressive). Every module ends with a **"Then vs now"** box where practice changed.
  1. **01 — CSS as a platform: specs, snapshots, Baseline & tooling**
     - CSSWG process (ED/WD/CR/REC, Snapshot 2026); how to read a spec (propdef tables: initial, inherited, computed value, animation type).
     - Baseline Newly/Widely vs browserslist vs caniuse; web-features dataset; Interop.
     - Progressive enhancement with `@supports` (incl. `selector()`, `at-rule()` status (unverified)).
     - Lightning CSS (`targets` from browserslist), stylelint 17 + `use-baseline`.
     - Then vs now: *vendor prefixes and Autoprefixer → Baseline targets and Lightning CSS; "CSS3" → modules + snapshots.*
  2. **02 — Syntax, selectors & specificity**
     - Tokenization, error recovery (why invalid declarations are dropped, forgiving vs unforgiving selector lists).
     - Selectors 4: `:is()`/`:where()` (specificity 0), `:has()` (Widely 2026-06), `:not()` list, `:focus-visible`, `:user-valid`, `:open`.
     - Specificity math, including `:is()` taking the max of its arguments.
     - Native **nesting**: `&`, implicit `:is()` wrapping, nested declarations (`CSSNestedDeclarations`).
     - Then vs now: *Sass nesting → native nesting (Widely 2026-06); Sass `@extend` → `:is()`.*
  3. **03 — The cascade, layers & scope**
     - Cascade sort order: origin & importance (UA/user/author, `!important` inversion), context (shadow), style attribute, **layers**, specificity, **scope proximity**, order of appearance.
     - `@layer` ordering, unlayered styles beat layered ones, `!important` reverses layer order, `layer()` in `@import`.
     - `@scope (root) to (limit)`, donut scope, `:scope`.
     - `revert`, `revert-layer`, `revert-rule` (Newly 2026-09); `initial`/`unset`/`inherit`.
     - Inheritance and which properties inherit.
     - Then vs now: *BEM/ITCSS specificity discipline → `@layer` for ordering + `@scope` for proximity; `!important` wars → layer order.*
  4. **04 — Value processing & units**
     - Declared → cascaded → specified → computed → used → actual values; what `getComputedStyle` returns (resolved value: computed for some properties, used for others such as `width`).
     - Values 4/5: `calc()`, `min/max/clamp`, `round/mod/rem`, trig/exp, `progress()`; `calc-size()`/`interpolate-size` (Chromium only).
     - Units: `rem`, `lh`/`rlh`, `cap`, `ic`, viewport variants `svh/lvh/dvh`, container units `cqi/cqb`.
     - `attr()` typed (not Baseline), `if()` (Chromium only), `sibling-index()`/`sibling-count()` (Newly 2026-08).
     - Then vs now: *`100vh` mobile bugs → `dvh`/`svh`; JS-measured sizes → container units.*
  5. **05 — Box model & visual formatting model**
     - Box tree generation, `display` two-value syntax (outer/inner), `display: contents` a11y history.
     - Box sizing, intrinsic sizes (`min-content`/`max-content`/`fit-content`/`stretch` (not Baseline)), `aspect-ratio`.
     - **Formatting contexts**: BFC (what creates one, `display: flow-root`), IFC (line boxes, `vertical-align`, `line-height`, half-leading, `text-box` trim).
     - Margin collapsing rules; `align-content` on block containers (Widely 2026-10).
     - Logical properties and writing modes.
     - Overflow, scroll containers, `overflow: clip` vs `hidden`, `overflow-anchor` (Newly 2026-09).
     - Then vs now: *clearfix → `flow-root`; physical `margin-left` → `margin-inline-start`.*
  6. **06 — Layout: flexbox, grid, subgrid, grid-lanes**
     - Flex algorithm: flex-basis resolution, `min-width: auto` default (the #1 overflow bug), free-space distribution, `gap`.
     - Grid: track sizing algorithm, `fr` vs `minmax(0,1fr)`, auto-placement + `dense`, named areas, implicit grid.
     - **Subgrid** (Widely 2026-03) for aligned cards/forms.
     - **Masonry status**: CSSWG chose `display: grid-lanes` (css-grid-3); Safari 26.4 only. Teach the fallback with `@supports (display: grid-lanes)`.
     - Box alignment module across layouts; `reading-flow` vs visual reorder a11y.
     - Then vs now: *floats/inline-block/tables → flex/grid; JS masonry (Masonry.js) → grid-lanes with a fallback.*
  7. **07 — Positioning, stacking & the top layer**
     - Positioning schemes, containing-block resolution (the transformed ancestor trap), sticky (needs a scroll container and a threshold).
     - **Stacking contexts**: every trigger (opacity<1, transform, filter, `isolation`, `will-change`, `contain: paint`, `container-type`? (unverified for size containment creating SC)). Painting order (CSS2 Appendix E).
     - **Top layer**: `<dialog>` `showModal()`, `popover` (auto/manual/hint), `::backdrop`, `inert`, invoker commands (`commandfor`/`command`, Newly 2025-12), light dismiss.
     - **Anchor positioning**: `anchor-name`, `position-anchor`, `position-area`, `anchor()`, `anchor-size()`, `@position-try` / `position-try-fallbacks`, implicit anchors for popovers.
     - Then vs now: *Popper/Floating UI + z-index ladders → popover + top layer + anchor positioning.*
  8. **08 — Containment & container queries**
     - `contain: size/inline-size/layout/style/paint`, `container-type`, the self-sizing paradox (why the container cannot size to its contents).
     - Size queries (Widely 2025-08), name-only queries (Newly 2026-05).
     - **Style queries** `@container style(--x: y)` (Newly 2026-05).
     - **Scroll-state** queries (`stuck`/`snapped`/`scrollable`; Chromium only).
     - `content-visibility: auto` + `contain-intrinsic-size` (Newly 2025-09).
     - Then vs now: *media queries for components → container queries; ResizeObserver class toggling → CQ.*
  9. **09 — Custom properties, `@property` & CSS functions**
     - Custom properties: computed-time substitution, guaranteed-invalid value, invalid at computed-value time (IACVT) behaviour, cycles, inheritance cost.
     - `@property` syntax/inherits/initial-value: enables animation and typed computed values.
     - Space toggles → style queries → `if()`.
     - `@function` (Chromium only), `@mixin` (spec only).
     - Then vs now: *Sass `$vars`/mixins/functions → custom properties + `@property` + (future) `@function`/`@mixin`; preprocessors → native.*
  10. **10 — Color, theming & typography**
      - Color 4/5: OKLCH/OKLab, wide gamut (`display-p3`, `@media (color-gamut)`), `color-mix()`, relative color `oklch(from var(--c) l c h / .5)`, `light-dark()`, `color-scheme`.
      - `contrast-color()` (Newly 2026-04; formerly `color-contrast()`); gamut mapping.
      - Fonts: `@font-face` loading lifecycle (block/swap/fallback periods), `font-display`, metric overrides (`size-adjust`, `ascent-override`; Chromium+Firefox only), `font-size-adjust` (Newly), variable fonts, `unicode-range` subsetting, `preload` + `crossorigin` gotcha.
      - `text-wrap: balance/pretty`, hyphens.
      - Then vs now: *hex/HSL + Sass `darken()` → OKLCH + relative color; FOIT → `font-display` + metric-matched fallbacks.*
  11. **11 — Motion: transitions, animations, scroll-driven, view transitions**
      - Transitions vs animations, the animation type per property, discrete transitions (`transition-behavior: allow-discrete`, `@starting-style`) for entry/exit of dialogs and popovers.
      - Web Animations API relation.
      - **Scroll-driven animations** (`scroll()`, `view()`, `animation-range`, `timeline-scope`; Chrome + Safari 26, no Firefox), scroll-triggered (Chrome 146).
      - **View transitions**: same-doc `document.startViewTransition` (Newly 2025-10), `view-transition-name`/`-class`, types, `::view-transition-*` pseudo tree; cross-doc `@view-transition { navigation: auto }` (Chrome + Safari).
      - Element-scoped VT (Chrome 147).
      - `prefers-reduced-motion`.
      - Then vs now: *JS scroll listeners/GSAP ScrollTrigger → scroll-driven animations; FLIP libraries → view transitions.*
  12. **12 — Responsive & accessible CSS**
      - Media Queries 4/5 range syntax; `prefers-*` (color-scheme, reduced-motion, contrast, reduced-transparency (Chromium)).
      - **Forced colors** (`forced-color-adjust`, system colors), focus indicators, `:focus-visible`.
      - Responsive images: `srcset`/`sizes`, `<picture>`, `image-set()` (Widely 2026-03), `sizes="auto"` for lazy images (not Baseline; no Safari), `loading="lazy"` (Widely 2026-06), `fetchpriority`.
      - Customizable `<select>` (`appearance: base-select`, `::picker(select)`).
      - `field-sizing`, `accent-color`.
      - Then vs now: *breakpoint-only design → intrinsic layouts + CQ; `outline: none` → `:focus-visible`.*
  13. **13 — Rendering pipeline & performance**
      - Style → layout → paint → composite (Chromium RenderingNG: style recalc, layout (LayoutNG), pre-paint, paint, layerize, raster, composite).
      - Invalidation scopes; layout thrashing (forced sync layout from interleaved read/write); what triggers reflow vs repaint vs composite-only (transform/opacity).
      - Layer explosion from `will-change` overuse; containment as an invalidation boundary; `content-visibility`.
      - **Core Web Vitals**: CLS causes (fonts, images without dimensions, late-injected content) and INP's relationship to style/layout cost.
      - Render-blocking CSS, critical CSS (beasties), `media` attribute trick, `@import` waterfalls, selector-matching cost and `:has()` invalidation.
      - DevTools: Performance panel, Rendering → Paint flashing/Layer borders, selector stats.
      - Then vs now: *JS animation of `top/left` → compositor-only transform + `will-change` sparingly; lazy JS virtualisation → `content-visibility`.*
  14. **14 — CSS architecture & design tokens at scale**
      - BEM/ITCSS/OOCSS/CUBE → `@layer` (reset, tokens, base, components, utilities) + `@scope`.
      - CSS Modules; utility-first (**Tailwind v4.3**: CSS-first `@theme`, `@layer`/`@property`/OKLCH output — cross-link).
      - **CSS-in-JS**: runtime (styled-components/Emotion: style injection cost, SSR hydration, React 18+ concurrency issues; styled-components entered maintenance mode (unverified, date)) vs zero-runtime/atomic (**StyleX 0.19**, **Panda 2.x**, vanilla-extract, Linaria) — cross-link.
      - **W3C DTCG 2025.10** tokens: format, color and resolver modules; aliasing; theming; the Style Dictionary 5 / Terrazzo pipeline to CSS custom properties.
      - Shadow DOM styling (`::part`, `:host`, `::slotted`, constructable stylesheets, `adoptedStyleSheets`).
      - Then vs now: *runtime CSS-in-JS → zero-runtime/static extraction; ad-hoc Sass maps → DTCG JSON → custom properties; global namespacing → `@scope`/CSS Modules.*

- **Gotchas & production failure modes**
  1. **Flex items with `min-width: auto`** refuse to shrink below their content (long URLs, `<pre>`, nested flex), which blows out layouts. The fix is `min-width: 0` / `minmax(0,1fr)` in grid, because `1fr` = `minmax(auto,1fr)`.
  2. **Unlayered styles beat every `@layer`.** If you adopt layers for your own CSS but a third-party sheet stays unlayered, the third party wins regardless of specificity. Import it with `@import url(x.css) layer(vendor)`. Conversely, **`!important` in an early layer beats `!important` in later layers** (the order inverts).
  3. **IACVT**: `color: var(--brand)` with an invalid `--brand` does **not** fall back to the previous declaration. It becomes `unset` (inherited or initial), so the cascade has already been "spent". `@property` with `syntax` turns the bad value into the registered `initial-value` instead.
  4. **`@property` is global and the first registration wins.** Two packages registering `--x` with different syntax collide silently. Registered non-inheriting properties also break the "set on root, read in children" pattern.
  5. **`z-index: 9999` not working**: the element is inside a stacking context created by `transform`, `opacity<1`, `filter`, `will-change: transform`, `isolation`, or `position: fixed/sticky`. The top layer (dialog/popover) is the only real escape.
  6. **`position: fixed` relative to a transformed ancestor**: `transform`, `filter`, `perspective`, `contain: paint/layout` and `will-change: transform` create a containing block, so "fixed" modals scroll with a card. Teleporting to `<body>`, or better the top layer, avoids it.
  7. **`position: sticky` silently not sticking**: an ancestor has `overflow: hidden/auto`, which makes it the scroll container, or no `top` is set, or the parent is too short.
  8. **Container query containers can't size to their content.** `container-type: inline-size` applies inline-size containment, so a shrink-to-fit parent (flex item, abs-pos, float) collapses to 0. Also, an element cannot query itself — only ancestors.
  9. **`100vh` on mobile** includes the area behind the dynamic toolbar, which cuts off content. Use `dvh` for full-height UIs and `svh` for stable layout (`dvh` causes relayout on scroll).
  10. **CLS from web fonts**: swap-in metric differences shift text. Use `size-adjust`/`ascent-override` fallbacks (not in Safari — Baseline gap) or `font-display: optional`. Also, **preload without `crossorigin` double-downloads** fonts.
  11. **Images without `width`/`height` attributes** (or `aspect-ratio`) cause CLS. Also, `loading="lazy"` on the LCP image delays LCP.
  12. **Layout thrashing**: reading `offsetHeight`/`getBoundingClientRect()` in a loop after style writes forces synchronous layout N times. Batch reads before writes (cross-link JS track for rAF scheduling).
  13. **`will-change` everywhere** causes layer explosion and GPU memory blowups on mobile (OOM tab crashes). Apply it just-in-time and remove it afterwards.
  14. **Animating `height`/`top`/`box-shadow`** triggers layout/paint per frame, which janks. Animate `transform`/`opacity`, or use `interpolate-size` where supported, with a non-animated fallback.
  15. **`display: none` → block entry animations don't run** without `@starting-style` + `transition-behavior: allow-discrete`, and `overlay` must be transitioned for top-layer exit animations, or the dialog vanishes before the fade.
  16. **View transitions**: duplicate `view-transition-name` on the page aborts the whole transition (with a console error only). Cross-doc VT requires same-origin and opt-in on **both** pages. Long-running snapshots block interaction. Always respect `prefers-reduced-motion`.
  17. **`:has()` invalidation cost**: `:has()` anchored high in the tree (e.g. `body:has(...)`) recalculates style for huge subtrees on every DOM mutation. Scope it narrowly.
  18. **`content-visibility: auto` without `contain-intrinsic-size`** makes scrollbars jump. Hidden content is also still in the a11y tree, but find-in-page and anchor behaviour differ subtly across engines (unverified details per engine).
  19. **Forced colors mode** strips `background-image`/`box-shadow` and overrides colors. Icon-only buttons built with CSS backgrounds disappear, and custom focus rings made of `box-shadow` vanish. Use `outline` (honoured), plus `@media (forced-colors: active)`.
  20. **Transpiler drift**: Lightning CSS/PostCSS lowering nesting for old targets can change specificity (`:is()` wrapping vs naive descendant expansion), so the same source behaves differently per `targets`. Pin browserslist and snapshot the output CSS.
  21. **Runtime CSS-in-JS** inserting rules during render causes style recalc storms and hydration mismatches (React 18 `useInsertionEffect` exists for this reason). A common cause of INP regressions.

- **Interview hot topics**
  1. Walk the cascade order end to end, including layers, scope proximity, `!important` inversion, and shadow DOM context. "Why does this rule lose?"
  2. Specificity of `:is()`/`:where()`/`:has()`/`:not()`; nesting's `&` semantics.
  3. BFC: what creates one, margin collapsing, why `flow-root` replaced clearfix.
  4. Stacking contexts and the top layer; debug "z-index doesn't work".
  5. Flexbox vs grid decision-making; the `min-width: auto` overflow bug; `fr` semantics; subgrid.
  6. Container queries vs media queries; style queries; containment trade-offs.
  7. Custom properties vs Sass variables (runtime vs compile-time, inheritance, IACVT); `@property` for animating gradients.
  8. Rendering pipeline: reflow vs repaint vs composite; what properties are cheap to animate; layout thrashing; `content-visibility`.
  9. Core Web Vitals from the CSS side: CLS causes and fixes, render-blocking CSS, critical CSS, font loading strategy.
  10. Build a tooltip/menu with popover + anchor positioning (and the Floating-UI fallback); dialog accessibility and the top layer.
  11. CSS architecture at scale: BEM vs utility-first vs CSS-in-JS (runtime vs zero-runtime); layers; design tokens (DTCG) → theming (light/dark, brands).
  12. Accessibility: `prefers-reduced-motion`, forced colors, focus-visible, `display: contents` and visual reordering vs DOM order.

- **Executable-proof strategy**
  - **Toolchain** (`.mise.toml`):
    - `node = "26.12.1"`; npm-pinned devDeps: `@playwright/test@1.64.1`, `stylelint@17.16.0`, `stylelint-config-standard@40.0.0`, `stylelint-plugin-use-baseline@1.4.8`, `lightningcss@1.33.0` (+ `lightningcss-cli@1.33.0`), `browserslist@4.29.5`, `@axe-core/playwright@4.14.0`, `style-dictionary@5.7.1`, `web-features@3.44.0`.
    - Run `npx playwright install --with-deps chromium firefox webkit` (pinned engines: CfT 156.0.8078.4, Firefox 157.0, WebKit 27.2).
    - `mise run test` → `playwright test`; `mise run lint` → `stylelint "**/*.css"`; `mise run build` → `lightningcss --targets ">= 0.25%"`, or the API with `browserslistToTargets(browserslist('baseline widely available'))`.
  - **Test pattern**: each example is a static HTML fixture loaded with `page.setContent()` (no server, so it is deterministic). Assertions use:
    - `getComputedStyle(el).getPropertyValue(...)` for cascade/layer/scope/IACVT/`@property` results, e.g. asserting that an unlayered rule wins over `@layer` with higher specificity, or that `--x` registered `<color>` computes to `rgb(...)` vs raw token text.
    - `el.getBoundingClientRect()` / `locator.boundingBox()` for layout: the flex `min-width:auto` overflow (positive control) and the `min-width:0` fix; subgrid alignment (equal row tops); margin collapse vs `flow-root` heights; sticky offset after `scrollTo`; anchor-positioned popover box adjacent to its anchor; container-query switch at a given width via `page.setViewportSize`.
    - `document.elementFromPoint()` for stacking-context/z-index proofs (which element is hit-tested on top), and `:popover-open` / `dialog.open` / `inert` behaviour.
    - `CSS.supports()` + `test.skip(browserName === 'firefox' && !supported)` driven by a **feature-gate helper**, so tests for non-Baseline features (scroll-driven, cross-doc VT, `if()`, `@function`, customizable select, grid-lanes) **assert the fallback path** in unsupported engines rather than being skipped silently. This makes Baseline gaps executable facts.
    - Animations: `page.clock` / `el.getAnimations()` + `animation.currentTime = X` to sample deterministic intermediate frames. Scroll-driven: scroll the container and then read `getAnimations()[0].currentTime` (a CSSNumericValue percentage). View transitions: assert that `document.startViewTransition` resolves `finished`, and that a duplicate name rejects (negative test).
    - Rendering/perf: use Chromium-only CDP (`page.context().newCDPSession` → `Performance.getMetrics` / `LayerTree`) to count `LayoutCount`/`RecalcStyleCount` for the thrash vs batched demo. Mark these tests `chromium`-only. Measure CLS with the `PerformanceObserver('layout-shift')` inside the page (Chromium-only API, since Layout Instability isn't in Firefox/Safari (unverified current status)).
    - **Negative tests**: invalid declaration dropped; IACVT → `unset`; `@property` invalid initial-value rejects the whole rule; a container querying itself does not match; `position: fixed` inside a transformed parent is NOT viewport-relative; `!important` layer inversion.
    - **Accessibility**: `@axe-core/playwright` scan per fixture; `page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active', colorScheme: 'dark', contrast: 'more' })` → assert computed styles change. Check that `contrast` is supported by the pinned Playwright (unverified).
  - **Visual regression**: `expect(page).toHaveScreenshot()` with `animations: 'disabled'`, `caret: 'hide'`, bundled web fonts (no system fonts), `maxDiffPixelRatio` small. **Font rasterisation differs across macOS and Linux**, so baseline PNGs must be generated in the official Docker image `mcr.microsoft.com/playwright:v1.64.1-noble` (tag pattern standard, exact tag (unverified)) both locally (Docker/OrbStack on Mac) and in GitLab CI. Otherwise, mark screenshot tests `@visual` and run them only in the container. Keep per-browser snapshot dirs.
  - **Static proofs**:
    - stylelint 17 with `plugin/use-baseline` set to `available: "widely"` must fail on a fixture using `if()` (negative) and pass on layered/nesting CSS.
    - Lightning CSS transpilation snapshot tests: nesting lowered for `chrome 110` targets, `oklch()` → rgb fallback, `light-dark()` lowering, `@custom-media`. Assert output strings with `node:test` (Node 26 built-in) and `lightningcss.transform({ targets })`.
    - A `web-features` script prints the Baseline status of every feature the curriculum uses, which keeps the matrix in README auto-generated and fails CI on drift.
    - DTCG: validate `tokens/*.tokens.json` against the 2025.10 format (Style Dictionary 5 / Terrazzo 2.10 parse). Snapshot the generated `tokens.css` custom properties. Negative test: a circular alias must error.
  - **Cannot be proven locally / fallbacks**:
    - Real-device mobile behaviour (dynamic toolbar `dvh`, iOS Safari quirks): Playwright WebKit ≠ iOS Safari, so document it and use the `devices['iPhone 15']` emulation only for viewport.
    - Real GPU compositing/jank and field CWV (CrUX): use Chromium traces + Lighthouse lab numbers (`lighthouse` npm, version (unverified)) as proxies.
    - Windows High Contrast real rendering: use `forcedColors` emulation only.
    - Cross-document view transitions need real navigations: serve two same-origin pages with `npx http-server` / Playwright `webServer` and run Chromium + WebKit only.
    - Engines in Playwright are *newer than stable* (CfT 156, Firefox 157 vs stable 155/~155). Tests prove "spec behaviour in current engines", not "works for users", so Baseline data stays the source for shipping decisions.

- **Overlaps / dedupe**
  - **`languages/javascript`** owns the HTML event loop and its "update the rendering" steps: rAF timing, ResizeObserver/IntersectionObserver callbacks within the frame, microtask checkpoints, `requestIdleCallback`, long tasks/INP attribution, Web Animations API object model.
    - **Boundary**: CSS owns what happens *inside* style/layout/paint/composite (invalidation, which properties trigger which stage, containment, layers). JS owns *when* rendering opportunities occur and how scripts force them (forced sync layout is taught in CSS M13 as "what" and cross-linked to JS for "when/scheduling").
    - View transitions: the CSS track owns the pseudo-element tree and animations; JS owns `startViewTransition` promise sequencing and the Navigation API.
  - **`technologies/panda-css`** keeps only Panda-specific mechanics (config, `css()`/recipes/patterns, static extraction, codegen, `@pandacss/dev` 2.x migration) and cross-links here for cascade layers, `@property`, container queries, tokens theory (DTCG) and atomic CSS trade-offs.
  - Same cross-link-only rule for Tailwind v4 / StyleX if they get tracks.
  - **React / Solid tracks** cross-link for view transitions (React `<ViewTransition>` (unverified status) / router integrations, Solid router) and for CSS-in-JS runtime costs. They do not re-teach the CSS.
  - **Accessibility** (if a `foundations/a11y` or HTML track exists) owns ARIA/semantics/dialog focus management. CSS owns prefers-*/forced-colors/focus-visible/reading-order.
  - **Web performance** (if a `foundations/web-performance` track exists) owns CWV measurement methodology, RUM, CrUX and Lighthouse. CSS owns CSS-caused CLS/render-blocking/critical CSS.
  - **HTML track** (if any) owns `srcset`/`<picture>` semantics. This track covers only the CSS side (`image-set()`, `object-fit`, `aspect-ratio`).

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- **W3Cx (edX) "CSS Basics" / "HTML5 and CSS Fundamentals"**, part of the W3Cx Front-End Web Developer program. A verified-certificate MOOC, partly dated (pre-layer/container-query era): https://classcentral.com/course/w3cx-front-end-web-developer-18397 ; https://www.edx.org/learn/css/the-world-wide-web-consortium-w3c-css-basics . Exact current pricing and syllabus are (unverified).
- Progressive enhancement with `@supports` (incl. `selector()`, `at-rule()` status (unverified)).
- **Stacking contexts**: every trigger (opacity<1, transform, filter, `isolation`, `will-change`, `contain: paint`, `container-type`? (unverified for size containment creating SC)). Painting order (CSS2 Appendix E).
- **CSS-in-JS**: runtime (styled-components/Emotion: style injection cost, SSR hydration, React 18+ concurrency issues; styled-components entered maintenance mode (unverified, date)) vs zero-runtime/atomic (**StyleX 0.19**, **Panda 2.x**, vanilla-extract, Linaria) — cross-link.
- 18. **`content-visibility: auto` without `contain-intrinsic-size`** makes scrollbars jump. Hidden content is also still in the a11y tree, but find-in-page and anchor behaviour differ subtly across engines (unverified details per engine).
- Rendering/perf: use Chromium-only CDP (`page.context().newCDPSession` → `Performance.getMetrics` / `LayerTree`) to count `LayoutCount`/`RecalcStyleCount` for the thrash vs batched demo. Mark these tests `chromium`-only. Measure CLS with the `PerformanceObserver('layout-shift')` inside the page (Chromium-only API, since Layout Instability isn't in Firefox/Safari (unverified current status)).
- **Accessibility**: `@axe-core/playwright` scan per fixture; `page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active', colorScheme: 'dark', contrast: 'more' })` → assert computed styles change. Check that `contrast` is supported by the pinned Playwright (unverified).
- **Visual regression**: `expect(page).toHaveScreenshot()` with `animations: 'disabled'`, `caret: 'hide'`, bundled web fonts (no system fonts), `maxDiffPixelRatio` small. **Font rasterisation differs across macOS and Linux**, so baseline PNGs must be generated in the official Docker image `mcr.microsoft.com/playwright:v1.64.1-noble` (tag pattern standard, exact tag (unverified)) both locally (Docker/OrbStack on Mac) and in GitLab CI. Otherwise, mark screenshot tests `@visual` and run them only in the container. Keep per-browser snapshot dirs.
- Real GPU compositing/jank and field CWV (CrUX): use Chromium traces + Lighthouse lab numbers (`lighthouse` npm, version (unverified)) as proxies.
- **React / Solid tracks** cross-link for view transitions (React `<ViewTransition>` (unverified status) / router integrations, Solid router) and for CSS-in-JS runtime costs. They do not re-teach the CSS.

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/css` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(css)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/css.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/css.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
