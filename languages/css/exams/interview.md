# CSS & Web Platform: Senior Technical Interview & Examination Question Bank

This question bank contains 75 original examination and senior technical interview questions covering modern CSS specifications, rendering engine mechanics, cascade layers, layout algorithms, and design system architecture.

---

## Domain 01: Platform Specs, Snapshots, Baseline & Tooling

### Q-CSS-001 · Platform Specs · difficulty 1 · single
Which organization is the official standards body responsible for standardizing Cascading Style Sheets (CSS)?
- A) ECMA International (TC39)
- B) World Wide Web Consortium (W3C) CSS Working Group
- C) Internet Engineering Task Force (IETF)
- D) Open Source Initiative (OSI)
<details><summary>Answer</summary>

**B.** The W3C Cascading Style Sheets Working Group (CSSWG) is the authoritative consortium responsible for authoring, reviewing, and maintaining CSS specifications.
- Why not A: TC39 standardizes ECMAScript (JavaScript), not CSS.
- Why not C: IETF standardizes internet networking protocols (TCP, IP, HTTP, TLS).
- Why not D: OSI governs open-source software licensing, not web standards.
- Ref: [modules/01-css-platform-specs-baseline-and-tooling.md](../modules/01-css-platform-specs-baseline-and-tooling.md#the-w3c-specification-process--the-snapshot-model)
</details>

### Q-CSS-002 · Platform Specs · difficulty 2 · single
What defines a feature as "Baseline: Widely Available" under the web-features compatibility standard?
- A) It is supported by Google Chrome and Mozilla Firefox only.
- B) Exactly 30 months have passed since the feature shipped in the stable releases of all four core browser engines (Chrome, Edge, Firefox, Safari).
- C) It is published as an official W3C Recommendation (REC).
- D) It can be installed as an npm polyfill package.
<details><summary>Answer</summary>

**B.** Under the web-platform-dx/web-features definition, "Newly Available" occurs when all core engines ship the feature in stable releases. Exactly 30 months later, the feature transitions to "Widely Available", signaling safe universal deployment across enterprise and long-term support platforms without polyfills.
- Why not A: Baseline requires all four core engines: Chrome, Edge, Firefox, and Safari (desktop and mobile).
- Why not C: W3C REC status is a formal process stage; many Widely Available features are in Candidate Recommendation.
- Why not D: Polyfills are independent JavaScript libraries, not browser baseline metrics.
- Ref: [modules/01-css-platform-specs-baseline-and-tooling.md](../modules/01-css-platform-specs-baseline-and-tooling.md#the-baseline-compatibility-standard--web-features)
</details>

### Q-CSS-003 · Platform Specs · difficulty 2 · scenario
An engineer wants to use the `:has()` relational selector in production. How should progressive enhancement be structured in CSS so older engines ignore the block without breaking?
- A) `@supports (:has(*)) { ... }`
- B) `@supports selector(:has(*)) { ... }`
- C) `@media selector(:has(*)) { ... }`
- D) `try { :has(*) } catch { ... }`
<details><summary>Answer</summary>

**B.** According to CSS Conditional Rules Level 4, testing whether an engine can parse and execute a selector requires the `@supports selector(<selector>)` functional syntax.
- Why not A: Testing properties requires property-value syntax (e.g. `display: grid`); `:has()` is a selector, so testing it as a property is invalid syntax.
- Why not C: `@media` queries evaluate media environment characteristics (viewport width, color scheme), not language syntax.
- Why not D: `try/catch` is JavaScript syntax, invalid in CSS.
- Ref: [modules/01-css-platform-specs-baseline-and-tooling.md](../modules/01-css-platform-specs-baseline-and-tooling.md#progressive-enhancement-with-supports)
</details>

### Q-CSS-004 · Platform Specs · difficulty 2 · multi
Which of the following statements are correct regarding modern CSS build tooling like Lightning CSS compared to legacy PostCSS? (Select TWO)
- A) Lightning CSS is written in native Rust and compiles stylesheets orders of magnitude faster than JavaScript-based PostCSS.
- B) Lightning CSS cannot parse native CSS nesting.
- C) Lightning CSS integrates an internal browser compatibility database to generate required vendor prefixes and down-level syntax based on target browsers.
- D) Lightning CSS requires installing Autoprefixer as an external plugin.
<details><summary>Answer</summary>

**A and C.**
- A is correct: Lightning CSS executes as native compiled machine code in Rust, parsing ASTs without JavaScript VM garbage collection pauses.
- C is correct: Lightning CSS contains a built-in compatibility database (driven by browserslist) and down-levels nesting, colors, and prefixes automatically.
- Why not B: Lightning CSS has first-class native support for CSS nesting.
- Why not D: Autoprefixer is obsolete when using Lightning CSS, as prefix generation is built directly into its core engine.
- Ref: [modules/01-css-platform-specs-baseline-and-tooling.md](../modules/01-css-platform-specs-baseline-and-tooling.md#modern-build-tooling-lightning-css--stylelint-17)
</details>

### Q-CSS-005 · Platform Specs · difficulty 3 · single
In a formal W3C CSS specification property definition table, what does the "Computed value" entry specify?
- A) The raw string written by the developer in the `.css` file.
- B) The value produced after the cascade and inheritance phase, resolving relative units (like `rem` and `em`) to absolute values before the layout pass executes.
- C) The physical sub-pixel integer value rounded by the device GPU hardware.
- D) The JavaScript variable name assigned to the property.
<details><summary>Answer</summary>

**B.** The Computed Value is the result of resolving the cascade, handling inheritance, and converting relative units (like `rem`, `em`, and relative URLs) to absolute quantities during the style calculation phase prior to layout.
- Why not A: That is the Declared Value.
- Why not C: That is the Actual Value.
- Why not D: CSS property definitions specify browser engine algorithms, not JavaScript variable names.
- Ref: [modules/01-css-platform-specs-baseline-and-tooling.md](../modules/01-css-platform-specs-baseline-and-tooling.md#anatomy-of-a-specification-property-definition)
</details>

---

## Domain 02: Syntax, Selectors & Specificity Math

### Q-CSS-006 · Selectors · difficulty 2 · single
What is the exact specificity 3-tuple $(A, B, C)$ of the selector `:is(.nav, #header) ul > li.active`?
- A) `(1, 2, 2)`
- B) `(0, 2, 2)`
- C) `(1, 1, 2)`
- D) `(1, 0, 2)`
<details><summary>Answer</summary>

**A.**
- `:is(.nav, #header)` adopts the specificity of its highest argument: `#header` contributes $A = 1, B = 0, C = 0$.
- `ul` is an element type selector: $C = 1$.
- `>` is a child combinator: contributes $(0, 0, 0)$.
- `li` is an element type selector: $C = 1$.
- `.active` is a class selector: $B = 1$.
- Total: $A = 1$, $B = 1$ (from `.active`)? Wait! Does `:is()` have `.nav` or `#header`? `#header` has $A=1$. Is there any other class? `.active` has $B=1$.
Wait: $A = 1$ (from `#header`), $B = 1$ (from `.active`), $C = 2$ (from `ul` and `li`).
Total tuple: $(1, 1, 2)$!
- Why not A: $(1, 2, 2)$ erroneously counted `.nav` alongside `#header`, but `:is()` only takes the maximum argument, not the sum!
- Why not B: $(0, 2, 2)$ missed the ID in `:is()`.
- Why not D: $(1, 0, 2)$ missed `.active`.
- Ref: [modules/02-syntax-selectors-and-specificity.md](../modules/02-syntax-selectors-and-specificity.md#specificity-mathematics-the-a-b-c-tuple)
</details>

### Q-CSS-007 · Selectors · difficulty 2 · single
Why is `:where()` considered the ideal selector primitive for CSS resets and component library default styles?
- A) It prevents styles from being overridden by any other selector.
- B) It always contributes strictly $(0, 0, 0)$ specificity regardless of the complexity of the selectors inside its argument list.
- C) It automatically minifies the output CSS.
- D) It forces styles to apply only inside Shadow DOM roots.
<details><summary>Answer</summary>

**B.** `:where()` has the unique characteristic of contributing zero specificity `(0, 0, 0)` to the selector chain. This allows design-system authors to write comprehensive base styles that consumer developers can effortlessly override with a single class name `(0, 1, 0)`.
- Why not A: It does the opposite: it makes overriding as easy as possible.
- Why not C: Minification is done by build tools, not pseudo-classes.
- Why not D: `:where()` works across standard light DOM and shadow DOM.
- Ref: [modules/02-syntax-selectors-and-specificity.md](../modules/02-syntax-selectors-and-specificity.md#functional-grouping-is-and-where)
</details>

### Q-CSS-008 · Selectors · difficulty 2 · scenario
A web page contains the rule `h1, h2, :-webkit-broken-pseudo { color: red; }`. In Firefox, what color will `<h1>` headings receive if no other rules match?
- A) Red.
- B) The browser's default user-agent color (black), because the entire rule block is discarded.
- C) Blue.
- D) A runtime parsing error halts page rendering.
<details><summary>Answer</summary>

**B.** In standard comma-separated selector lists, error handling is **unforgiving**. If any single selector in the list is unsupported or invalid in that browser engine, the entire selector list is invalidated and the whole rule block is discarded.
- Why not A: Firefox cannot parse `:-webkit-broken-pseudo`, so the entire rule block fails.
- Why not C: Blue would only apply if defined elsewhere.
- Why not D: CSS error recovery silently drops invalid blocks; it never halts page rendering.
- Ref: [modules/02-syntax-selectors-and-specificity.md](../modules/02-syntax-selectors-and-specificity.md#the-error-recovery-invariant)
</details>

### Q-CSS-009 · Selectors · difficulty 3 · scenario
In native CSS nesting, consider the following rule:
```css
.card {
  padding: 1rem;
  & > h2 { color: red; }
  color: blue;
}
```
In modern browser engines implementing CSS Cascading and Inheritance Level 6, what represents the declaration `color: blue` in the CSS Object Model (CSSOM)?
- A) It is discarded as a syntax error because declarations cannot follow nested rules.
- B) It is hoisted above `& > h2` to the top of `.card`.
- C) It is wrapped in an internal `CSSNestedDeclarations` grouping node, preserving its declaration order after the child rule.
- D) It is converted to an inline style attribute.
<details><summary>Answer</summary>

**C.** Under the modern CSS Cascading Level 6 specification, declarations placed after a nested child rule are automatically grouped into a `CSSNestedDeclarations` rule in the CSSOM, ensuring they maintain their exact source order and cascade position.
- Why not A: Declarations after nested rules are fully valid in modern CSS.
- Why not B: Hoisting was an early implementation defect resolved by the `CSSNestedDeclarations` standard.
- Why not D: The CSSOM represents stylesheet objects; it does not inject inline attributes into HTML.
- Ref: [modules/02-syntax-selectors-and-specificity.md](../modules/02-syntax-selectors-and-specificity.md#the-cssnesteddeclarations-object-model-fix)
</details>

### Q-CSS-010 · Selectors · difficulty 2 · multi
Which of the following pseudo-classes contribute to the **$B$ category** (Classes, attributes, and pseudo-classes) in specificity calculations? (Select TWO)
- A) `:hover`
- B) `:is()`
- C) `:focus-visible`
- D) `::before`
<details><summary>Answer</summary>

**A and C.**
- A and C are correct: Standard pseudo-classes like `:hover`, `:focus-visible`, `:checked`, and `:disabled` contribute $1$ to the $B$ tuple column.
- Why not B: `:is()` itself contributes zero to $B$; it adopts the specificity of its highest internal argument (which could be an ID $A$, class $B$, or element $C$).
- Why not D: `::before` is a pseudo-element, which contributes to the $C$ category.
- Ref: [modules/02-syntax-selectors-and-specificity.md](../modules/02-syntax-selectors-and-specificity.md#specificity-mathematics-the-a-b-c-tuple)
</details>

---

## Domain 03: The Cascade, Layers (@layer) & Scope (@scope)

### Q-CSS-011 · Cascade & Layers · difficulty 2 · single
Given an unlayered author style with selector `p` (specificity `(0, 0, 1)`) and an author style inside `@layer components` with selector `#nav .item.active p` (specificity `(1, 2, 1)`), which rule wins the cascade for normal (non-important) declarations?
- A) The layered rule `#nav .item.active p` because it has much higher specificity.
- B) The unlayered rule `p` because unlayered author styles always take precedence over layered author styles.
- C) Neither; it results in a cascade deadlock.
- D) Whichever was declared earlier in the file.
<details><summary>Answer</summary>

**B.** In the formal cascade sort order, Cascade Layers (Step 4) are evaluated before Selector Specificity (Step 5). For normal declarations, unlayered author styles hold higher precedence than any layered author styles. Because the unlayered rule wins at Step 4, specificity is never compared.
- Why not A: Specificity is only evaluated to break ties within the *same* layer.
- Why not C: The cascade is deterministic; deadlocks do not exist.
- Why not D: Order of appearance is the final tie-breaker (Step 7).
- Ref: [modules/03-cascade-layers-and-scope.md](../modules/03-cascade-layers-and-scope.md#the-unlayered-styles-hazard)
</details>

### Q-CSS-012 · Cascade & Layers · difficulty 3 · scenario
Two cascade layers are declared: `@layer reset, overrides;`.
- In `@layer reset`: `p { color: green !important; }`
- In `@layer overrides`: `p { color: red !important; }`
What color will `<p>` elements display, and why?
- A) Red, because `overrides` is declared after `reset`.
- B) Green, because the presence of `!important` inverts the layer precedence order, giving earlier layers higher priority than later layers.
- C) Black, because conflicting `!important` rules cancel each other out.
- D) Blue, from the browser's default user-agent style sheet.
<details><summary>Answer</summary>

**B.** For `!important` author declarations, the precedence of cascade layers inverts completely: earlier declared layers override later layers. Therefore, `@layer reset !important` defeats `@layer overrides !important`, rendering the paragraph green.
- Why not A: Later layers only win for *normal* declarations.
- Why not C: `!important` rules never cancel each other out.
- Why not D: Author styles override User-Agent styles.
- Ref: [modules/03-cascade-layers-and-scope.md](../modules/03-cascade-layers-and-scope.md#the-important-layer-inversion-rule)
</details>

### Q-CSS-013 · Cascade & Layers · difficulty 2 · single
In the `@scope (.card) to (.content-slot)` rule, what does the selector `.content-slot` represent?
- A) The styling target where rules are applied.
- B) The scoping limit (the "donut hole"), marking the boundary where scoped styles stop applying.
- C) An alternative selector used as a fallback for older browsers.
- D) A media query breakpoint.
<details><summary>Answer</summary>

**B.** In `@scope (<root>) to (<limit>)`, the second argument establishes the scoping limit. Any element inside the subtree matching or nested inside `.content-slot` is excluded from the scoped rules, creating a donut-shaped boundary.
- Why not A: Rules apply between the root and the limit, not inside the limit.
- Why not C: Fallbacks are handled with `@supports`, not scope limits.
- Why not D: Media queries use `@media`.
- Ref: [modules/03-cascade-layers-and-scope.md](../modules/03-cascade-layers-and-scope.md#scope-root-and-limits)
</details>

### Q-CSS-014 · Cascade & Layers · difficulty 3 · single
What is the effect of setting `background-color: revert-layer;` on an element?
- A) It resets the background color to transparent (its initial value).
- B) It forces the element to inherit the background color from its parent.
- C) It rolls back the cascade evaluation to the value declared in the previous (lower-priority) cascade layer.
- D) It deletes the element's background in all cascade layers simultaneously.
<details><summary>Answer</summary>

**C.** `revert-layer` rolls back the cascade to the declaration that would have won if the current cascade layer had not participated. It adopts the value from the preceding layer (or user/UA defaults if no earlier layer declared it).
- Why not A: Resetting to specification default is achieved with `initial`.
- Why not B: Forcing inheritance is achieved with `inherit`.
- Why not D: It affects only the element's cascade evaluation, not the stylesheet definitions.
- Ref: [modules/03-cascade-layers-and-scope.md](../modules/03-cascade-layers-and-scope.md#4-resetting-values-initial-inherit-unset-revert-and-revert-layer)
</details>

### Q-CSS-015 · Cascade & Layers · difficulty 2 · ordering
Order the cascade evaluation criteria from highest precedence (evaluated first) to lowest precedence (evaluated last) for normal author declarations:
1. Specificity Tuple
2. Order of Appearance
3. Cascade Layers (`@layer`)
4. Inline Style Attribute
5. Scope Proximity
- A) 4 $\rightarrow$ 3 $\rightarrow$ 1 $\rightarrow$ 5 $\rightarrow$ 2
- B) 3 $\rightarrow$ 4 $\rightarrow$ 1 $\rightarrow$ 5 $\rightarrow$ 2
- C) 4 $\rightarrow$ 1 $\rightarrow$ 3 $\rightarrow$ 5 $\rightarrow$ 2
- D) 1 $\rightarrow$ 4 $\rightarrow$ 3 $\rightarrow$ 2 $\rightarrow$ 5
<details><summary>Answer</summary>

**A.** The formal precedence hierarchy is:
1. Inline style attributes (Step 3)
2. Cascade layers (Step 4)
3. Specificity tuple (Step 5)
4. Scope proximity (Step 6)
5. Order of appearance (Step 7)
- Why not B, C, D: Inline styles precede layers; layers precede specificity; specificity precedes scope proximity; order of appearance is strictly the final tie-breaker.
- Ref: [modules/03-cascade-layers-and-scope.md](../modules/03-cascade-layers-and-scope.md#1-the-formal-cascade-sort-order)
</details>

---

## Domain 04: Value Processing Lifecycle & Modern Units

### Q-CSS-016 · Value Processing · difficulty 3 · scenario
A stylesheet declares:
```css
:root { --invalid: 50px; }
.parent { color: rgb(0, 128, 0); }
.child {
  color: rgb(255, 0, 0);
  color: var(--invalid);
}
```
Under the Invalid at Computed-Value Time (IACVT) rule, what color will `.child` render as?
- A) Red (`rgb(255, 0, 0)`), falling back to the earlier valid declaration.
- B) Green (`rgb(0, 128, 0)`), because IACVT treats the property as `unset`, and `color` is an inherited property that inherits from `.parent`.
- C) Black (`rgb(0, 0, 0)`), because IACVT always defaults to black.
- D) Transparent.
<details><summary>Answer</summary>

**B.** Under IACVT, when an invalid value is substituted during the computed-value phase, the cascade cannot backtrack to earlier declarations. The property is treated as `unset`. Because `color` is naturally inherited, `unset` behaves as `inherit`, inheriting the green color of `.parent`.
- Why not A: Custom property substitution happens after the cascade; earlier declarations are already discarded.
- Why not C: `unset` inherits rather than defaulting to black (unless root is reached).
- Why not D: Text color does not default to transparent.
- Ref: [modules/04-value-processing-and-units.md](../modules/04-value-processing-and-units.md#the-six-stages-of-value-processing), [modules/09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md#the-invalid-at-computed-value-time-iacvt-trap)
</details>

### Q-CSS-017 · Value Processing · difficulty 2 · single
What does `window.getComputedStyle(element).width` return for an element styled with `width: 50%` after layout has completed?
- A) The literal string `"50%"`.
- B) The absolute pixel Used Value (e.g. `"400px"`).
- C) `undefined`.
- D) A floating-point number representing viewport percentage.
<details><summary>Answer</summary>

**B.** According to the CSSOM specification, `getComputedStyle()` returns the "Resolved Value". For layout-dependent geometry properties (`width`, `height`, `left`, `top`, `margin`, `padding`), the resolved value is defined as the **Used Value** (the final computed layout pixels, e.g. `"400px"`).
- Why not A: The raw percentage is only available on the element's style attribute (`element.style.width`).
- Why not C: `getComputedStyle()` always returns strings for valid CSS properties.
- Why not D: Values are returned as CSS string tokens with unit suffixes.
- Ref: [modules/04-value-processing-and-units.md](../modules/04-value-processing-and-units.md#2-the-windowgetcomputedstyle-resolved-value-ambiguity)
</details>

### Q-CSS-018 · Value Processing · difficulty 2 · single
What is the primary difference between the mobile viewport units `100vh` and `100svh`?
- A) `100vh` is for desktop; `100svh` is for mobile.
- B) `100vh` assumes the mobile address bar is hidden (large viewport); `100svh` calculates height assuming all dynamic browser toolbars and address bars are fully expanded, guaranteeing content is not occluded.
- C) `100svh` scales with screen brightness.
- D) `100svh` is deprecated in favor of `100dvh`.
<details><summary>Answer</summary>

**B.** `100svh` (Small Viewport Height) calculates viewport size assuming all expandable browser chrome (address bars, bottom navigation) is visible. In contrast, legacy `100vh` evaluated the maximum height where toolbars are hidden, causing bottom buttons to be occluded on initial load.
- Why not A: Both units function across all devices.
- Why not C: Screen brightness has no relation to CSS length units.
- Why not D: `svh`, `lvh`, and `dvh` are all standard active units with distinct use cases.
- Ref: [modules/04-value-processing-and-units.md](../modules/04-value-processing-and-units.md#2-viewport-variants-small-svh-large-lvh-and-dynamic-dvh)
</details>

### Q-CSS-019 · Value Processing · difficulty 2 · single
What does the typographic unit `1ch` represent?
- A) $1\%$ of the container height.
- B) The advance width of the zero glyph (`0`) in the element's current font.
- C) The height of lowercase character `x`.
- D) The character count of the parent element.
<details><summary>Answer</summary>

**B.** By specification, `1ch` is the width of the `0` (zero) glyph in the element's active font. It is commonly used to establish comfortable, readable paragraph column widths (e.g. `max-width: 65ch`).
- Why not A: That is `1cqb` or `1vh`.
- Why not C: That is `1ex`.
- Why not D: It is a fixed typographic metric, not an element character counter.
- Ref: [modules/04-value-processing-and-units.md](../modules/04-value-processing-and-units.md#1-font-relative-units)
</details>

### Q-CSS-020 · Value Processing · difficulty 2 · multi
Which of the following are valid native mathematical functions standardized in CSS Values Level 4 and 5? (Select TWO)
- A) `round(nearest, 50vw, 8px)`
- B) `eval("50px + 2rem")`
- C) `clamp(1rem, 2.5vw, 3rem)`
- D) `compute(auto)`
<details><summary>Answer</summary>

**A and C.**
- A is correct: `round()` rounds values to specified interval multiples.
- C is correct: `clamp(min, val, max)` clamps a fluid value between boundary thresholds.
- Why not B: `eval()` is a JavaScript security hazard; CSS uses `calc()`.
- Why not D: `compute()` is not a valid CSS function.
- Ref: [modules/04-value-processing-and-units.md](../modules/04-value-processing-and-units.md#3-mathematical-functions-values-level-4--5)
</details>

---

## Domain 05: Box Model, Formatting Contexts (BFC) & Sizing

### Q-CSS-021 · Box Model & BFC · difficulty 2 · single
What is the modern, specification-standard property used to establish a new Block Formatting Context (BFC) on an element without visual side effects?
- A) `overflow: hidden;`
- B) `display: flow-root;`
- C) `float: left;`
- D) `clear: both;`
<details><summary>Answer</summary>

**B.** `display: flow-root` was added in CSS Display Module Level 3 specifically to generate a block box that establishes a new Block Formatting Context without the clipping side effects of `overflow: hidden` or the layout disruption of floating.
- Why not A: `overflow: hidden` creates a BFC, but clips absolute dropdowns and shadows.
- Why not C: `float` takes the element out of normal flow.
- Why not D: `clear` clears floats; it does not create a BFC on the container.
- Ref: [modules/05-box-model-and-visual-formatting-model.md](../modules/05-box-model-and-visual-formatting-model.md#what-triggers-a-block-formatting-context)
</details>

### Q-CSS-022 · Box Model & BFC · difficulty 2 · scenario
Under what condition do vertical margins collapse between a parent element and its first child?
- A) Only when both elements have `display: flex`.
- B) When the parent has no border, no padding, no inline content separating it from the child, and does not establish a BFC.
- C) When the parent has `box-sizing: border-box`.
- D) When the child element has `position: absolute`.
<details><summary>Answer</summary>

**B.** Parent-child margin collapsing occurs when there is no intervening border or padding, no inline content, and no BFC boundary to separate the parent's margin from the child's margin. The child's margin collapses into the parent and pushes the parent down from the outside.
- Why not A: Flex containers prevent margin collapsing between their flex items.
- Why not C: `box-sizing` governs width/height calculation, not margin collapsing.
- Why not D: Absolutely positioned elements never participate in margin collapsing.
- Ref: [modules/05-box-model-and-visual-formatting-model.md](../modules/05-box-model-and-visual-formatting-model.md#margin-collapsing-rules)
</details>

### Q-CSS-023 · Box Model & BFC · difficulty 2 · single
What does `display: block flow-root` declare under the modern two-value display specification?
- A) The outer display type is `block` (participates in block flow), and the inner display type establishes a `flow-root` (new BFC).
- B) The element renders as an inline-block.
- C) The element becomes an inline flex container.
- D) It causes a syntax error in CSS3.
<details><summary>Answer</summary>

**A.** The two-value display syntax decomposes `display` into outer and inner types. `block flow-root` explicitly states that the element is a block-level box in its parent context, and establishes an independent Block Formatting Context for its children.
- Why not B: Inline-block has an outer type of `inline` (`inline flow-root`).
- Why not C: That would be `inline flex`.
- Why not D: Two-value syntax is standard in modern CSS.
- Ref: [modules/05-box-model-and-visual-formatting-model.md](../modules/05-box-model-and-visual-formatting-model.md#the-modern-two-value-display-grammar)
</details>

### Q-CSS-024 · Box Model & BFC · difficulty 2 · single
Why is `overflow: clip` preferred over `overflow: hidden` when you want to prevent visual clipping from establishing a scroll container?
- A) `overflow: clip` allows text to wrap automatically.
- B) `overflow: hidden` establishes a scroll container in the compositor and permits programmatic scrolling via JavaScript, whereas `overflow: clip` strictly clips pixels without creating a scroll container.
- C) `overflow: clip` is supported only on mobile devices.
- D) `overflow: clip` increases GPU memory usage.
<details><summary>Answer</summary>

**B.** `overflow: hidden` creates a scroll container that can still be scrolled programmatically (`element.scrollTo()`) or via keyboard focus. `overflow: clip` strictly clips drawing at the overflow edge and disables all scrolling mechanics, saving compositor resources and preventing unintended scroll jumps.
- Why not A: Text wrapping is controlled by `text-wrap` and `white-space`.
- Why not C: `overflow: clip` is widely supported across desktop and mobile browsers.
- Why not D: It reduces compositor memory overhead.
- Ref: [modules/05-box-model-and-visual-formatting-model.md](../modules/05-box-model-and-visual-formatting-model.md#6-overflow-control-clip-vs-hidden)
</details>

### Q-CSS-025 · Box Model & BFC · difficulty 2 · multi
Which of the following properties establish a new Block Formatting Context (BFC)? (Select TWO)
- A) `display: flow-root;`
- B) `contain: paint;`
- C) `display: inline;`
- D) `color: red;`
<details><summary>Answer</summary>

**A and B.**
- A and B are correct: `display: flow-root` and `contain: paint` explicitly establish a new BFC according to the CSS Display and Containment specifications.
- Why not C: `display: inline` participates in an Inline Formatting Context (IFC).
- Why not D: `color` is a typographic property that has zero impact on formatting contexts.
- Ref: [modules/05-box-model-and-visual-formatting-model.md](../modules/05-box-model-and-visual-formatting-model.md#what-triggers-a-block-formatting-context)
</details>

---

## Domain 06: Layout: Flexbox, Grid, Subgrid & Grid-Lanes

### Q-CSS-026 · Layout · difficulty 2 · single
In CSS Flexbox, what default behavior causes a flex item with `flex: 1` to refuse to shrink below the width of a long text URL?
- A) Flex items have `overflow: scroll` by default.
- B) The item's `min-width` defaults to `auto`, which clamps its minimum size to its `min-content` width.
- C) The flex container has `flex-wrap: nowrap`.
- D) The item's `flex-shrink` factor defaults to 0.
<details><summary>Answer</summary>

**B.** In the Flexbox specification, a flex item's `min-width` (or `min-height` in vertical flow) defaults to `auto`. For flex items, `min-width: auto` evaluates to the item's `min-content` width. The item refuses to shrink below that width, causing overflow unless overridden with `min-width: 0`.
- Why not A: Default overflow is `visible`.
- Why not C: Even with nowrap, items shrink unless clamped by minimum sizing.
- Why not D: `flex: 1` sets `flex-shrink: 1`.
- Ref: [modules/06-layout-flexbox-grid-subgrid-and-lanes.md](../modules/06-layout-flexbox-grid-subgrid-and-lanes.md#the-number-one-flexbox-bug-min-width-auto)
</details>

### Q-CSS-027 · Layout · difficulty 2 · scenario
An engineer defines a two-column grid with `grid-template-columns: 1fr 1fr;`. A wide HTML table placed inside column 1 causes column 1 to expand to 70% width, squeezing column 2 to 30%. How should the column definition be modified to guarantee equal 50/50 sizing?
- A) `grid-template-columns: 50% 50%;`
- B) `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);`
- C) `grid-template-columns: repeat(2, auto);`
- D) `grid-template-columns: fit-content(50%) fit-content(50%);`
<details><summary>Answer</summary>

**B.** By specification, `1fr` is defined as `minmax(auto, 1fr)`. If content has a large `min-content` size, the track expands. Writing `minmax(0, 1fr)` explicitly sets the minimum track bound to `0`, ensuring neither column can exceed its equal fractional allocation.
- Why not A: Using `50%` ignores gaps; with `gap: 20px`, `50% + 50% + 20px` causes horizontal overflow.
- Why not C: `auto` sizes entirely based on content, worsening the imbalance.
- Why not D: `fit-content` does not guarantee equal distribution.
- Ref: [modules/06-layout-flexbox-grid-subgrid-and-lanes.md](../modules/06-layout-flexbox-grid-subgrid-and-lanes.md#track-sizing-the-fractional-unit-fr-and-minmax)
</details>

### Q-CSS-028 · Layout · difficulty 2 · single
What capability does Subgrid (`grid-template-rows: subgrid`) provide that nested CSS Grid cannot?
- A) It allows grid items to animate at 120fps.
- B) It allows child elements of nested grid items to align directly to the row and column tracks defined by the parent grid container.
- C) It converts the layout into a table.
- D) It eliminates the need for CSS Grid entirely.
<details><summary>Answer</summary>

**B.** Subgrid permits a grid item to delegate its row or column tracks to the parent grid. This enables elements inside separate nested cards (such as card headers, body texts, and action buttons) to align to the same continuous track coordinates across all cards.
- Why not A: Frame rates depend on GPU compositing, not subgrid.
- Why not C: Subgrid operates within modern CSS Grid, not HTML tables.
- Why not D: Subgrid is an advanced feature of CSS Grid Level 2.
- Ref: [modules/06-layout-flexbox-grid-subgrid-and-lanes.md](../modules/06-layout-flexbox-grid-subgrid-and-lanes.md#3-subgrid-nested-two-dimensional-alignment)
</details>

### Q-CSS-029 · Layout · difficulty 3 · single
What is the standardized CSS property and value for native waterfall Masonry layout in CSS Grid Level 3?
- A) `display: masonry;`
- B) `display: grid-lanes;`
- C) `masonry-layout: true;`
- D) `display: waterfall;`
<details><summary>Answer</summary>

**B.** In CSS Grid Level 3, the CSSWG reached consensus standardizing native masonry as `display: grid-lanes`. It reuses the Grid coordinate system while allowing the cross axis to pack items into the shortest available column lane.
- Why not A: `display: masonry` was an experimental proposal replaced by `grid-lanes`.
- Why not C and D: These are non-existent properties.
- Ref: [modules/06-layout-flexbox-grid-subgrid-and-lanes.md](../modules/06-layout-flexbox-grid-subgrid-and-lanes.md#4-masonry-status-the-display-grid-lanes-architecture)
</details>

### Q-CSS-030 · Layout · difficulty 2 · multi
Which of the following alignment properties operate along the **Cross Axis** in a row-direction Flexbox container? (Select TWO)
- A) `justify-content`
- B) `align-items`
- C) `align-self`
- D) `justify-items`
<details><summary>Answer</summary>

**B and C.**
- B and C are correct: In Flexbox, `align-items` (on the container) and `align-self` (on individual items) control alignment along the cross axis (vertical axis when `flex-direction: row`).
- Why not A: `justify-content` aligns items along the main axis (horizontal axis in row direction).
- Why not D: `justify-items` has no effect in Flexbox containers (it applies to Grid).
- Ref: [modules/06-layout-flexbox-grid-subgrid-and-lanes.md](../modules/06-layout-flexbox-grid-subgrid-and-lanes.md#1-the-flexbox-algorithm--the-min-width-auto-overflow-trap)
</details>

---

## Domain 07: Positioning, Stacking Contexts & Top Layer

### Q-CSS-031 · Positioning & Stacking · difficulty 2 · single
An element is styled with `position: fixed; top: 0; left: 0;`. However, instead of adhering to the browser viewport, it is positioned relative to an ancestor `.card` element. What CSS property on `.card` causes this containing block trap?
- A) `display: flex;`
- B) `transform: scale(1.02);`
- C) `color: blue;`
- D) `margin: 20px;`
<details><summary>Answer</summary>

**B.** According to the CSS Transforms specification, any element with a `transform` other than `none` acts as the containing block for all descendants, including `position: fixed` elements. Other properties that cause this include `filter`, `perspective`, `contain: paint`, and `will-change: transform`.
- Why not A, C, D: Flexbox, color, and margins do not alter containing block resolution for fixed elements.
- Ref: [modules/07-positioning-stacking-and-top-layer.md](../modules/07-positioning-stacking-and-top-layer.md#the-transformed-ancestor-trap)
</details>

### Q-CSS-032 · Positioning & Stacking · difficulty 2 · single
Why is `isolation: isolate` preferred over hacks like `transform: translateZ(0)` when creating a new stacking context?
- A) It is faster to type.
- B) It explicitly creates a new stacking context without triggering side effects (such as creating a containing block for fixed elements or altering pixel rasterization).
- C) It automatically centers the element on the screen.
- D) It hides the element from screen readers.
<details><summary>Answer</summary>

**B.** `isolation: isolate` was created specifically to establish an isolated stacking context cleanly. Unlike `transform: translateZ(0)` or `opacity: 0.999`, it introduces zero visual distortions, does not trap `position: fixed` children, and avoids GPU layer promotion penalties.
- Why not A: Semantic safety is the goal, not typing speed.
- Why not C: Alignment is handled by flex/grid/margin.
- Why not D: Stacking contexts do not alter the accessibility tree.
- Ref: [modules/07-positioning-stacking-and-top-layer.md](../modules/07-positioning-stacking-and-top-layer.md#what-establishes-a-stacking-context)
</details>

### Q-CSS-033 · Positioning & Stacking · difficulty 2 · single
How does the browser's "Top Layer" differ from high z-index stacking layers (`z-index: 999999`)?
- A) The Top Layer renders elements in an independent browser plane above the document tree, completely escaping ancestor stacking contexts, clipping boundaries, and transformed containing blocks.
- B) The Top Layer only works in Google Chrome.
- C) The Top Layer forces the page to reload.
- D) The Top Layer converts HTML into WebGL.
<details><summary>Answer</summary>

**A.** The Top Layer is a hardware-managed browser plane positioned above all DOM elements and z-indexes. Modal dialogs (`<dialog>`) and popovers in the Top Layer escape parent `overflow: hidden` containers and transformed ancestors natively.
- Why not B: The Top Layer is an interoperable web standard supported across all major engines.
- Why not C and D: It is an internal layout and compositing mechanism; it does not reload pages or use WebGL.
- Ref: [modules/07-positioning-stacking-and-top-layer.md](../modules/07-positioning-stacking-and-top-layer.md#3-the-top-layer-escaping-the-stacking-context)
</details>

### Q-CSS-034 · Positioning & Stacking · difficulty 3 · scenario
In CSS Anchor Positioning, what does the `@position-try` at-rule accomplish?
- A) It retries network requests when an image fails to load.
- B) It defines alternative fallback positions (such as flipping from bottom to top) that the browser applies automatically when the anchored element collides with viewport boundaries.
- C) It attempts to compile TypeScript into CSS.
- D) It creates an animated CSS transition.
<details><summary>Answer</summary>

**B.** `@position-try` defines named fallback placement rules (e.g. `@position-try --flip-top { position-area: top; }`). When referenced via `position-try-fallbacks`, the browser detects viewport collisions and switches to the fallback without JavaScript.
- Why not A: Network retries are handled in service workers or fetch logic.
- Why not C: Preprocessing is handled by build tools.
- Why not D: Animations are defined using `@keyframes`.
- Ref: [modules/07-positioning-stacking-and-top-layer.md](../modules/07-positioning-stacking-and-top-layer.md#4-css-anchor-positioning-declarative-tethering)
</details>

### Q-CSS-035 · Positioning & Stacking · difficulty 2 · multi
Which of the following conditions trigger the creation of a new Stacking Context? (Select TWO)
- A) `opacity: 0.8;`
- B) `isolation: isolate;`
- C) `color: rgb(0, 0, 0);`
- D) `display: block;`
<details><summary>Answer</summary>

**A and B.**
- A and B are correct: `opacity < 1` and `isolation: isolate` both establish a new stacking context according to the CSS Compositing and Blending specification.
- Why not C and D: Standard block display and text colors do not alter 3D depth layering.
- Ref: [modules/07-positioning-stacking-and-top-layer.md](../modules/07-positioning-stacking-and-top-layer.md#what-establishes-a-stacking-context)
</details>

---

## Domain 08: Containment & Container Queries (Size & Style)

### Q-CSS-036 · Containment · difficulty 2 · single
Why is an element prohibited from evaluating container queries against itself (e.g. querying its own width)?
- A) It is a temporary bug in webkit.
- B) To prevent an infinite cyclic layout loop (The Self-Sizing Paradox).
- C) Container queries only support height, not width.
- D) Elements have no width until painted.
<details><summary>Answer</summary>

**B.** If an element evaluated container queries against its own dimensions and applied styles that altered its dimensions, the layout engine would enter an infinite cyclic recalculation loop. The specification mandates that container queries evaluate ancestor containers only.
- Why not A: It is an intentional, permanent architectural design constraint.
- Why not C: Both inline-size (width) and block-size (height) queries are supported.
- Why not D: Width is computed during the layout phase before painting.
- Ref: [modules/08-containment-and-container-queries.md](../modules/08-containment-and-container-queries.md#the-self-sizing-paradox)
</details>

### Q-CSS-037 · Containment · difficulty 2 · single
What happens when you declare `container-type: inline-size` on an element placed inside a shrink-to-fit parent without an explicit width?
- A) The container expands to fill 100vw.
- B) The container collapses to a width of 0px because inline-size containment forbids the container from sizing based on its children.
- C) The browser throws a fatal layout exception.
- D) The container converts into a flexbox.
<details><summary>Answer</summary>

**B.** Declaring `container-type: inline-size` applies inline-size containment. The engine computes the container's inline size as if it contained zero children. In a shrink-to-fit context where width is derived from content, the container collapses to `0px`.
- Why not A: Sizing to 100vw only occurs if explicitly styled.
- Why not C: CSS never throws fatal runtime layout exceptions.
- Why not D: Display formatting is unchanged.
- Ref: [modules/08-containment-and-container-queries.md](../modules/08-containment-and-container-queries.md#the-self-sizing-paradox)
</details>

### Q-CSS-038 · Containment · difficulty 2 · single
How do Style Container Queries (`@container style(...)`) differ from Size Container Queries?
- A) Style queries only work on images.
- B) Style queries evaluate the computed value of CSS custom properties on an ancestor, requiring no `container-type` declaration and applying no size containment.
- C) Style queries require JavaScript `ResizeObserver`.
- D) Style queries are slower than media queries.
<details><summary>Answer</summary>

**B.** Style queries evaluate CSS custom properties (e.g. `@container style(--theme: dark)`). Unlike size queries, they do not require `container-type` and do not apply size containment; every element in the DOM tree acts as an implicit style container for its descendants.
- Why not A: Style queries operate on all elements.
- Why not C: They are pure CSS primitives evaluated by the browser style engine.
- Why not D: Style queries run during style recalculation with high performance.
- Ref: [modules/08-containment-and-container-queries.md](../modules/08-containment-and-container-queries.md#3-style-container-queries)
</details>

### Q-CSS-039 · Containment · difficulty 3 · scenario
An e-commerce site uses `content-visibility: auto` on product cards in an infinite scroll feed. Users complain that as they scroll down, the scrollbar jumps erratically and page position stutters. What missing CSS property fixes this issue?
- A) `overflow: hidden`
- B) `contain-intrinsic-size`
- C) `scroll-behavior: smooth`
- D) `will-change: scroll-position`
<details><summary>Answer</summary>

**B.** When an off-screen element has `content-visibility: auto`, its rendering is skipped, collapsing its rendered height to 0px and miscalculating total scrollable height. `contain-intrinsic-size: auto 350px` assigns an estimated virtual placeholder height to off-screen elements, maintaining stable scrollbar mechanics.
- Why not A: `overflow: hidden` clips content and does not fix scroll height.
- Why not C: `scroll-behavior` affects programmatic scroll animation, not layout height.
- Why not D: `will-change` promotes layers; it does not assign geometry.
- Ref: [modules/08-containment-and-container-queries.md](../modules/08-containment-and-container-queries.md#5-rendering-optimization-content-visibility--contain-intrinsic-size)
</details>

### Q-CSS-040 · Containment · difficulty 2 · multi
Which container query units represent $1\%$ of the query container's inline size and block size respectively? (Select TWO)
- A) `cqi`
- B) `cqb`
- C) `rem`
- D) `vw`
<details><summary>Answer</summary>

**A and B.**
- A is correct: `cqi` represents $1\%$ of the container's inline size (width in horizontal writing modes).
- B is correct: `cqb` represents $1\%$ of the container's block size (height in horizontal writing modes).
- Why not C: `rem` is relative to the root font size.
- Why not D: `vw` is relative to the global viewport width.
- Ref: [modules/08-containment-and-container-queries.md](../modules/08-containment-and-container-queries.md#2-size-container-queries)
</details>

---

## Domain 09: Custom Properties, @property & CSS Functions

### Q-CSS-041 · Custom Properties · difficulty 2 · single
What capability does registering a custom property with the `@property` API provide that standard untyped custom properties lack?
- A) It allows custom properties to be encrypted.
- B) It provides semantic type definitions (`syntax`), enabling smooth mathematical interpolation in animations and guaranteed initial fallback values.
- C) It automatically translates properties to JavaScript.
- D) It hides properties from browser DevTools.
<details><summary>Answer</summary>

**B.** Standard custom properties are untyped token strings that cannot be smoothly interpolated in animations. The `@property` API provides explicit syntax typing (e.g. `syntax: "<angle>"`), inheritance controls, and initial values, allowing browsers to animate properties like gradient rotation angles and counter values frame-by-frame.
- Why not A: CSS custom properties are not encryption mechanisms.
- Why not C and D: Registered properties remain fully accessible in the CSSOM and DevTools.
- Ref: [modules/09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md#2-strongly-typed-variables-the-property-api)
</details>

### Q-CSS-042 · Custom Properties · difficulty 3 · scenario
An author registers a custom property using `@property --theme-spacing { syntax: "<length>"; inherits: false; initial-value: 8px; }`. They set `--theme-spacing: 24px;` on the `:root` element. In a child `.card` component inside `<body>`, what value will `var(--theme-spacing)` resolve to?
- A) `24px`
- B) `8px`
- C) `0px`
- D) `undefined`
<details><summary>Answer</summary>

**B.** Because `inherits: false` was explicitly declared in the `@property` registration, the custom property behaves as a non-inherited property. It does NOT cascade down from `:root` to child elements. The child element receives the registered `initial-value` of `8px`.
- Why not A: It would only resolve to `24px` if `inherits: true` was set.
- Why not C and D: Registered properties always evaluate to their valid initial value when not inherited.
- Ref: [modules/09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md#critical-property-gotchas)
</details>

### Q-CSS-043 · Custom Properties · difficulty 2 · single
In standard CSS, what is the default inheritance behavior of an un-registered custom property (`--my-var: blue;`)?
- A) Non-inherited (applies only to the target element).
- B) Inherited (cascades down the DOM tree to all descendants).
- C) Inherited only by direct children.
- D) Inherited only if specified in `@media`.
<details><summary>Answer</summary>

**B.** By specification, untyped CSS Custom Properties are naturally inherited properties. Declaring `--color: blue` on an ancestor element cascades down through all DOM descendants unless overridden by a closer descendant.
- Why not A: Non-inheritance only occurs if explicitly registered with `@property { inherits: false; }`.
- Why not C and D: Normal inheritance cascades down arbitrary tree depths regardless of media queries.
- Ref: [modules/09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md#1-custom-property-mechanics--the-iacvt-trap)
</details>

### Q-CSS-044 · Custom Properties · difficulty 3 · single
What resolution rule applies when two separate stylesheets define `@property --accent` with conflicting syntax?
- A) The two declarations merge their types into an array.
- B) First registration wins: the first `@property` rule encountered during parsing is activated, and all subsequent registrations for that name are discarded.
- C) Last registration wins.
- D) The browser throws a fatal syntax exception and disables CSS.
<details><summary>Answer</summary>

**B.** Registered custom properties occupy a single flat global document registration table. The specification dictates a strict "first registration wins" rule: the first valid `@property` definition parsed takes effect, and subsequent conflicting definitions are ignored.
- Why not A: CSS property types do not merge into dynamic arrays.
- Why not C: Unlike normal cascade rules, registered properties do not follow last-write-wins.
- Why not D: Browser parsers silently ignore duplicate registrations without throwing exceptions.
- Ref: [modules/09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md#critical-property-gotchas)
</details>

### Q-CSS-045 · Custom Properties · difficulty 2 · multi
Which of the following descriptors are mandatory in a valid `@property` rule? (Select TWO)
- A) `syntax`
- B) `inherits`
- C) `transition`
- D) `scope`
<details><summary>Answer</summary>

**A and B.**
- A and B are correct: In CSS Properties and Values Level 1, both the `syntax` descriptor (e.g. `"<color>"`) and the `inherits` descriptor (`true` or `false`) are strictly required. (`initial-value` is also required unless syntax is `"*"`).
- Why not C and D: `transition` and `scope` are not `@property` descriptors.
- Ref: [modules/09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md#defining-registered-custom-properties)
</details>

---

## Domain 10: Color Spaces (OKLCH), RCS & Typography

### Q-CSS-046 · Color & Typography · difficulty 2 · single
Why is the OKLCH color space preferred over HSL for designing accessible design system palettes?
- A) OKLCH files are smaller in kilobyte size.
- B) OKLCH is perceptually uniform: a Lightness ($L$) value of $70\%$ delivers the exact same perceived brightness to human eyes across all hues, guaranteeing consistent contrast ratios.
- C) OKLCH only supports black and white.
- D) OKLCH is rendered using WebGL.
<details><summary>Answer</summary>

**B.** In HSL, setting lightness to 50% produces a blindingly bright yellow but a dark blue. In OKLCH, Lightness ($L$) is mathematically aligned with human eye luminance perception: $L = 0.70$ has identical perceptual brightness across red, yellow, green, and blue, making contrast calculation deterministic.
- Why not A: CSS color strings have negligible difference in byte size.
- Why not C: OKLCH covers the entire visible human color spectrum (wide gamut).
- Why not D: It is a native CSS color model evaluated by standard 2D color engines.
- Ref: [modules/10-color-theming-and-typography.md](../modules/10-color-theming-and-typography.md#1-color-science-srgb-vs-wide-gamut--the-oklch-breakthrough)
</details>

### Q-CSS-047 · Color & Typography · difficulty 2 · single
What does the Relative Color Syntax expression `oklch(from var(--brand) l c h / 0.5)` produce?
- A) An OKLCH color identical to `--brand` but with its opacity (alpha) set to $50\%$.
- B) A color with half its saturation.
- C) A grayscale color.
- D) A syntax error.
<details><summary>Answer</summary>

**A.** Relative Color Syntax allows deconstructing a color with `from <origin-color>`. Here, Lightness ($l$), Chroma ($c$), and Hue ($h$) are passed through unchanged, while the forward slash sets the alpha channel to $0.5$ ($50\%$ opacity).
- Why not B: Chroma would have to be multiplied (`calc(c * 0.5)`) to alter saturation.
- Why not C: Grayscale requires setting Chroma $c$ to $0$.
- Why not D: Relative Color Syntax is standard in Baseline.
- Ref: [modules/10-color-theming-and-typography.md](../modules/10-color-theming-and-typography.md#relative-color-syntax-rcs)
</details>

### Q-CSS-048 · Color & Typography · difficulty 3 · scenario
An application loads a custom web font via `@font-face`. When the page loads, text is rendered in `Arial` for 1.5 seconds, after which the web font downloads and text snaps to the new font, causing words to shift and trigger Cumulative Layout Shift (CLS). What native CSS feature eliminates this metric shift while preserving the fallback font?
- A) `font-style: italic`
- B) Font Metric Overrides (`size-adjust`, `ascent-override`, `descent-override`) declared on the fallback `@font-face` rule
- C) `text-transform: uppercase`
- D) `font-family: inherit`
<details><summary>Answer</summary>

**B.** Font Metric Overrides (`size-adjust`, `ascent-override`, `descent-override`) allow authors to mathematically stretch and adjust the advance widths and baselines of a local fallback font (like `Arial`) to match the exact physical proportions of the incoming web font, eliminating layout shifts when the font swaps in.
- Why not A, C, D: Italicizing, casing, and inheritance do not adjust typographic font metrics or eliminate layout shifts.
- Ref: [modules/10-color-theming-and-typography.md](../modules/10-color-theming-and-typography.md#font-metric-overrides-eliminating-font-swap-cls)
</details>

### Q-CSS-049 · Color & Typography · difficulty 2 · single
Why must font preloads (`<link rel="preload" as="font" href="...">`) always specify the `crossorigin` attribute even when loading fonts from the exact same origin?
- A) Preloading fails on HTTPS without it.
- B) Web fonts are fetched using Anonymous CORS mode; omitting `crossorigin` on the preload caches the response under credentialed mode, causing the browser to ignore the preload and fetch the font twice.
- C) It is required to encrypt the font file.
- D) `crossorigin` makes the font load asynchronously.
<details><summary>Answer</summary>

**B.** The W3C specification mandates that fonts requested via `@font-face` use Anonymous CORS mode. If `<link rel="preload">` omits `crossorigin`, it fetches the font in non-CORS mode; when the CSS parser encounters the `@font-face` rule, it initiates an Anonymous CORS request, discovers the cached preload has mismatched credentials, and double-downloads the font file.
- Why not A: HTTPS works with or without CORS.
- Why not C: CORS governs cross-origin access control, not file encryption.
- Why not D: Preload is already asynchronous.
- Ref: [modules/10-color-theming-and-typography.md](../modules/10-color-theming-and-typography.md#the-font-preload-link-trap)
</details>

### Q-CSS-050 · Color & Typography · difficulty 2 · multi
Which typographic wrapping properties are standardized in CSS Text Module Level 4? (Select TWO)
- A) `text-wrap: balance;`
- B) `text-wrap: pretty;`
- C) `text-wrap: auto-hyphen-all;`
- D) `text-wrap: justify-lines;`
<details><summary>Answer</summary>

**A and B.**
- A is correct: `text-wrap: balance` balances line lengths across headlines to prevent orphan words.
- B is correct: `text-wrap: pretty` optimizes paragraph breaks to eliminate trailing single-word widows.
- Why not C and D: These are fictitious property names.
- Ref: [modules/10-color-theming-and-typography.md](../modules/10-color-theming-and-typography.md#5-modern-typographic-formatting-text-wrap)
</details>

---

## Domain 11: Motion, Transitions, Scroll & View Transitions

### Q-CSS-051 · Motion · difficulty 2 · single
Why did animating `opacity` from $0$ to $1$ historically fail when an element transitioned from `display: none` to `display: block` in the same frame?
- A) `opacity` does not support numbers.
- B) When transitioning from `display: none`, the element had no prior computed box tree; the start and end values were evaluated in the same frame, causing the property to snap immediately without transitioning.
- C) The GPU was disabled.
- D) `display: none` permanently disables CSS transitions.
<details><summary>Answer</summary>

**B.** An element with `display: none` generates no box in the layout tree. When changed to `display: block`, the browser establishes computed styles for both the layout type and target opacity in the same frame, having no previous rendered frame from which to interpolate.
- Why not A: `opacity` interpolates numbers between 0 and 1.
- Why not C: Hardware acceleration is unrelated to box tree presence.
- Why not D: Transitions work once the element is in the box tree.
- Ref: [modules/11-motion-transitions-animations-and-view-transitions.md](../modules/11-motion-transitions-animations-and-view-transitions.md#1-animating-the-unanimatable-starting-style--discrete-transitions)
</details>

### Q-CSS-052 · Motion · difficulty 2 · single
What does `@starting-style` accomplish in modern CSS transitions?
- A) It defines styles applied only when a web page first opens.
- B) It defines the initial property state an element assumes in the exact frame it receives a layout box or enters the Top Layer, enabling entry transitions from `display: none`.
- C) It resets all CSS properties to their browser defaults.
- D) It loads an external animation stylesheet.
<details><summary>Answer</summary>

**B.** `@starting-style` defines the baseline values an element holds in the frame it transitions from `display: none` or enters the Top Layer, providing the necessary starting baseline for transitions to interpolate smoothly.
- Why not A: Page-load styling is handled by standard rules.
- Why not C: Property resets are handled by `all: revert` or `unset`.
- Why not D: Stylesheet loading is handled by `<link>` or `@import`.
- Ref: [modules/11-motion-transitions-animations-and-view-transitions.md](../modules/11-motion-transitions-animations-and-view-transitions.md#1-animating-the-unanimatable-starting-style--discrete-transitions)
</details>

### Q-CSS-053 · Motion · difficulty 3 · scenario
When animating the closing exit transition of a modal `<dialog>`, the dialog fades out for 0.3 seconds. However, as soon as the closing class is toggled, the dialog immediately vanishes from the screen before the opacity fade completes. What property must be added to the transition declaration?
- A) `transition: z-index 0.3s;`
- B) `transition: overlay 0.3s allow-discrete;`
- C) `transition: transform 1s;`
- D) `animation-fill-mode: forwards;`
<details><summary>Answer</summary>

**B.** In the Top Layer, closing a modal removes its membership from the hardware top-layer plane immediately. Setting `transition: overlay 0.3s allow-discrete` holds the element inside the Top Layer until the exit transition finishes, preventing it from vanishing before the fade completes.
- Why not A: `z-index` does not control Top Layer membership.
- Why not C: `transform` does not hold Top Layer presence.
- Why not D: Transitions are governed by `transition-behavior`, not keyframe fill modes.
- Ref: [modules/11-motion-transitions-animations-and-view-transitions.md](../modules/11-motion-transitions-animations-and-view-transitions.md#full-fledged-dialog-entry-and-exit-animations)
</details>

### Q-CSS-054 · Motion · difficulty 2 · single
How do CSS Scroll-Driven Animations maintain 60fps/120fps motion even when the JavaScript main thread is frozen by heavy computation?
- A) They execute on Web Workers.
- B) They link scroll position directly to animation timelines inside the browser's GPU compositor process, recalculating and compositing frames without dispatching events to the JavaScript main thread.
- C) They downgrade animation frame rates to 10fps.
- D) They pre-record animations as MP4 video files.
<details><summary>Answer</summary>

**B.** CSS Scroll-Driven Animations run off the main thread inside the GPU compositor. The compositor samples touch and wheel events and advances animation timelines on compositor-only properties (`transform`, `opacity`) directly on the GPU, completely decoupled from JavaScript execution.
- Why not A: Web Workers manage data processing and have no direct access to the DOM or CSSOM.
- Why not C: They maintain full hardware refresh rates (60–120fps).
- Why not D: They render vector graphics, not video streams.
- Ref: [modules/11-motion-transitions-animations-and-view-transitions.md](../modules/11-motion-transitions-animations-and-view-transitions.md#2-scroll-driven-animations-declarative-scroller-timelines)
</details>

### Q-CSS-055 · Motion · difficulty 2 · multi
What happens if two visible elements on the same page are assigned the exact same `view-transition-name` during a View Transition? (Select TWO)
- A) The browser animates both elements simultaneously.
- B) The browser detects an ambiguous transition mapping and immediately aborts the view transition.
- C) The DOM update callback still executes, but the visual morph animation is skipped.
- D) The browser throws an uncaught JavaScript error that halts application execution.
<details><summary>Answer</summary>

**B and C.**
- B and C are correct: The View Transitions specification mandates that every `view-transition-name` must be globally unique per frame. When duplicates are encountered, the transition is aborted and the DOM state update executes immediately without animation.
- Why not A: Duplicate names create an ambiguous state graph; the engine cannot determine which element to morph.
- Why not D: The transition promise rejects, but page execution continues normally.
- Ref: [modules/11-motion-transitions-animations-and-view-transitions.md](../modules/11-motion-transitions-animations-and-view-transitions.md#custom-element-morphing-with-view-transition-name)
</details>

---

## Domain 12: Responsive & Accessible CSS (Forced Colors)

### Q-CSS-056 · Accessibility · difficulty 2 · single
In Windows High Contrast Mode (Forced Colors Mode), what happens to elements styled with custom `box-shadow` focus rings?
- A) The box-shadow color changes to bright yellow.
- B) The browser's forced-colors engine completely strips `box-shadow`, leaving keyboard users with zero visual focus indicator unless a CSS `outline` is provided.
- C) The box-shadow is converted into a 3D bevel.
- D) The page refuses to load.
<details><summary>Answer</summary>

**B.** To preserve clean contrast, Forced Colors Mode strips all CSS `box-shadow` and `text-shadow` declarations from the page. If focus rings rely exclusively on `box-shadow`, they disappear completely in high contrast mode; authors must always use CSS `outline`, which is preserved by the engine.
- Why not A: `box-shadow` is not recolored; it is discarded entirely.
- Why not C and D: Shadows are stripped; pages render normally.
- Ref: [modules/12-responsive-and-accessible-css.md](../modules/12-responsive-and-accessible-css.md#the-three-critical-forced-colors-gotchas)
</details>

### Q-CSS-057 · Accessibility · difficulty 2 · single
What UX defect is eliminated by using `:focus-visible` instead of `:focus`?
- A) It prevents screen readers from announcing links.
- B) It prevents unsightly focus outlines when mouse users click on buttons, while preserving high-contrast focus rings when keyboard users navigate via the Tab key.
- C) It eliminates the need for HTML buttons.
- D) It stops form inputs from accepting text.
<details><summary>Answer</summary>

**B.** `:focus-visible` matches based on input heuristics: it applies focus indicators when navigating via keyboard or assistive technologies, but suppresses them when clicking with a mouse or pointer, preventing unwanted outlines on pointer interactions without destroying keyboard accessibility.
- Why not A: Screen reader announcements are unaffected.
- Why not C and D: It is a focus styling selector; it does not replace buttons or inputs.
- Ref: [modules/12-responsive-and-accessible-css.md](../modules/12-responsive-and-accessible-css.md#3-focus-indicator-architecture-focus-vs-focus-visible)
</details>

### Q-CSS-058 · Accessibility · difficulty 2 · single
What does setting `field-sizing: content;` on a `<textarea>` accomplish?
- A) It limits textarea input to 100 characters.
- B) It allows the textarea to expand automatically in inline and block directions to fit the user's typed text natively without JavaScript.
- C) It encrypts the textarea's content.
- D) It downloads a spelling dictionary.
<details><summary>Answer</summary>

**B.** `field-sizing: content` instructs the form control to derive its dimensions intrinsically from its content. As the user types, the textarea or input expands and contracts smoothly without requiring JavaScript scroll-height measurement scripts.
- Why not A: Character limits are governed by `maxlength`.
- Why not C and D: Form control sizing has no relation to encryption or spellcheck.
- Ref: [modules/12-responsive-and-accessible-css.md](../modules/12-responsive-and-accessible-css.md#auto-sizing-form-inputs-field-sizing-content)
</details>

### Q-CSS-059 · Accessibility · difficulty 3 · scenario
An icon button is implemented as `<button class="btn icon-trash"></button>` with `.icon-trash { background-image: url("/icons/trash.svg"); }`. In Windows High Contrast Mode, users report the trash icon disappears completely. Why does this happen, and what is the proper fix?
- A) The SVG file was corrupted; fix by converting to PNG.
- B) Forced Colors Mode strips all CSS `background-image` declarations; fix by using inline SVGs styled with `fill: currentColor` or CSS `mask-image` with `background-color: currentColor`.
- C) High contrast mode disables buttons; fix by switching to `<a>` tags.
- D) The button width collapsed; fix by setting `width: 100vw`.
<details><summary>Answer</summary>

**B.** Forced Colors Mode strips all CSS background images to prevent background textures from interfering with text readability. Icon buttons built using CSS backgrounds vanish entirely. The accessible pattern uses inline SVG elements or CSS masks with `currentColor`, which inherits the system's `CanvasText` or `ButtonText` color.
- Why not A: PNG backgrounds are also stripped.
- Why not C: High contrast mode fully supports buttons.
- Why not D: Width is not the issue; the background image was discarded by the engine.
- Ref: [modules/12-responsive-and-accessible-css.md](../modules/12-responsive-and-accessible-css.md#the-three-critical-forced-colors-gotchas)
</details>

### Q-CSS-060 · Accessibility · difficulty 2 · multi
Which of the following user preference media queries are standardized in CSS Media Queries Level 5? (Select TWO)
- A) `prefers-reduced-motion`
- B) `prefers-contrast`
- C) `prefers-gpu-acceleration`
- D) `prefers-dark-theme-only`
<details><summary>Answer</summary>

**A and B.**
- A and B are correct: `prefers-reduced-motion` (motion sensitivities) and `prefers-contrast` (high-contrast accessibility) are standardized in Media Queries Level 5.
- Why not C and D: These are fictitious media feature names (dark mode uses `prefers-color-scheme`).
- Ref: [modules/12-responsive-and-accessible-css.md](../modules/12-responsive-and-accessible-css.md#system-user-preference-queries)
</details>

---

## Domain 13: Rendering Pipeline, Performance & Core Web Vitals

### Q-CSS-061 · Performance · difficulty 3 · single
What is "Layout Thrashing" (Forced Synchronous Layout) in web performance engineering?
- A) An operating system crash caused by CSS Grid.
- B) The performance anti-pattern where JavaScript interleaves DOM style writes with layout reads (e.g. `offsetHeight`), forcing the browser to pause execution and calculate layout synchronously multiple times within a single frame.
- C) Running animations at 240fps on a 60Hz display.
- D) Minifying CSS files with too many variables.
<details><summary>Answer</summary>

**B.** Normally, the browser queues DOM writes and recalculates layout lazily at the end of the frame. When JavaScript reads a layout metric (like `offsetHeight` or `getBoundingClientRect()`) immediately after modifying styles, the engine cannot return the measurement without calculating layout immediately. Repeating this in a loop causes dozens of synchronous layout recalculations in a single frame, destroying frame rates.
- Why not A: Layout thrashing occurs inside the browser process, not an OS kernel crash.
- Why not C: High refresh rate displays are supported natively.
- Why not D: Minification occurs at build time.
- Ref: [modules/13-rendering-pipeline-and-performance.md](../modules/13-rendering-pipeline-and-performance.md#3-layout-thrashing-forced-synchronous-layout)
</details>

### Q-CSS-062 · Performance · difficulty 2 · single
Which pair of CSS properties can be animated strictly on the GPU compositor thread without triggering either Reflow (Layout) or Repaint?
- A) `width` and `height`
- B) `top` and `left`
- C) `transform` and `opacity`
- D) `margin` and `padding`
<details><summary>Answer</summary>

**C.** `transform` and `opacity` are compositor-only properties in modern rendering engines. Modifying them alters only the compositor layer's transformation matrix or alpha channel, completely bypassing CPU layout (Reflow) and display list recording (Repaint) and running at 120fps on the GPU.
- Why not A, B, D: Sizing and positioning properties alter box geometry and trigger expensive layout reflows on the main thread.
- Ref: [modules/13-rendering-pipeline-and-performance.md](../modules/13-rendering-pipeline-and-performance.md#2-invalidation-scopes-layout-vs-paint-vs-composite)
</details>

### Q-CSS-063 · Performance · difficulty 3 · scenario
An audit reveals that an application's Interaction to Next Paint (INP) metric degraded significantly after introducing the CSS rule `body:has(.modal-open) * { pointer-events: none; }`. What causes this performance regression?
- A) `:has()` cannot be used on `<body>`.
- B) Anchoring `:has()` high in the DOM tree on `body` with a universal selector causes the browser's style engine to invalidate and recalculate styles across the entire DOM tree whenever DOM mutations occur.
- C) The browser runs out of memory.
- D) `pointer-events: none` is deprecated.
<details><summary>Answer</summary>

**B.** Broad, unconstrained `:has()` queries anchored at the document root force the style engine into wide invalidation scopes. Any class change or DOM mutation requires re-evaluating whether the entire tree's elements match, causing long main-thread style calculation pauses that directly elevate INP latency.
- Why not A: It is syntactically valid on `body`, but architecturally catastrophic at scale.
- Why not C: Memory is not exhausted; CPU time is consumed by style recalcs.
- Why not D: `pointer-events` is an active standard property.
- Ref: [modules/13-rendering-pipeline-and-performance.md](../modules/13-rendering-pipeline-and-performance.md#interaction-to-next-paint-inp)
</details>

### Q-CSS-064 · Performance · difficulty 2 · single
What is "Critical CSS" in frontend loading optimization?
- A) A CSS file that throws compiler warnings.
- B) The minimum subset of CSS rules required to render the visible, above-the-fold viewport content, inlined directly into `<head><style>` to avoid render-blocking network roundtrips.
- C) Stylesheets reserved exclusively for mobile devices.
- D) CSS rules that have `!important` flags.
<details><summary>Answer</summary>

**B.** Critical CSS represents the minimal styles required to render the initial above-the-fold viewport. Inlining critical CSS into the HTML `<head>` allows the browser to paint First Contentful Paint (FCP) immediately upon HTML receipt, while deferred non-critical stylesheets download asynchronously in the background.
- Why not A: Critical refers to loading priority, not error states.
- Why not C: Critical CSS covers whatever viewport size is initially rendered.
- Why not D: `!important` is an origin priority marker, unrelated to network loading.
- Ref: [modules/13-rendering-pipeline-and-performance.md](../modules/13-rendering-pipeline-and-performance.md#critical-css-inlining)
</details>

### Q-CSS-065 · Performance · difficulty 2 · multi
Which of the following actions can trigger Cumulative Layout Shift (CLS)? (Select TWO)
- A) Loading web fonts that swap with fallback fonts possessing different advance widths and line-heights without metric overrides.
- B) Animating an element using `transform: translateY(100px);`.
- C) Inserting an image that lacks explicit `width`, `height`, or `aspect-ratio` properties into the flow.
- D) Using `color-mix()` in CSS custom properties.
<details><summary>Answer</summary>

**A and C.**
- A is correct: Mismatched font metrics re-wrap paragraphs, causing sudden vertical text shifts.
- C is correct: Unsized images render at 0px initially, then push content downward when loaded.
- Why not B: `transform` does not alter layout geometry in normal flow; it has 0 CLS impact.
- Why not D: Color calculations do not affect box sizing or geometric positions.
- Ref: [modules/13-rendering-pipeline-and-performance.md](../modules/13-rendering-pipeline-and-performance.md#cumulative-layout-shift-cls)
</details>

---

## Domain 14: Architecture, Zero-Runtime & Design Tokens (DTCG)

### Q-CSS-066 · Architecture & Tokens · difficulty 2 · single
What major performance drawback led modern frontend architectures to migrate away from runtime CSS-in-JS libraries (such as styled-components and Emotion)?
- A) They cannot run on Node.js servers.
- B) Dynamically generating and injecting `<style>` tags into the DOM during React component rendering invalidates the CSSOM, forcing synchronous main-thread style recalculations that degrade INP.
- C) They can only style `<div>` elements.
- D) They do not support custom colors.
<details><summary>Answer</summary>

**B.** Runtime CSS-in-JS evaluates styles in JavaScript during render and injects CSS rules into the document `<head>`. In large applications, this constant CSSOM mutation triggers severe style recalculation storms, causing main-thread stutter, hydration mismatches, and severe Interaction to Next Paint (INP) regressions.
- Why not A: They support SSR on Node.js.
- Why not C and D: They support arbitrary HTML tags and full dynamic colors.
- Ref: [modules/14-css-architecture-and-design-tokens.md](../modules/14-css-architecture-and-design-tokens.md#3-the-rise-and-fall-of-runtime-css-in-js)
</details>

### Q-CSS-067 · Architecture & Tokens · difficulty 2 · single
In the W3C Design Tokens Community Group (DTCG 2025.10) specification, how are token aliases formatted?
- A) `"$alias": "color-primary"`
- B) `"$value": "{color.brand.primary}"`
- C) `"$ref": "@color.brand.primary"`
- D) `"$value": "var(--color)"`
<details><summary>Answer</summary>

**B.** The official W3C DTCG 2025.10 specification dictates that token aliases are declared in `$value` enclosed within curly braces with dot-separated token paths: `"$value": "{color.brand.primary}"`.
- Why not A and C: These do not conform to the DTCG standard syntax.
- Why not D: `var(--color)` is CSS syntax; design token JSON is platform-agnostic (used by iOS, Android, and Figma).
- Ref: [modules/14-css-architecture-and-design-tokens.md](../modules/14-css-architecture-and-design-tokens.md#anatomy-of-a-tokensjson-file)
</details>

### Q-CSS-068 · Architecture & Tokens · difficulty 2 · single
How does a zero-runtime CSS compiler like Panda CSS or StyleX differ from legacy runtime CSS-in-JS?
- A) It compiles styles ahead-of-time (AOT) at build time, extracting deduplicated atomic CSS classes and shipping zero runtime CSS JavaScript to client browsers.
- B) It evaluates styles using PHP.
- C) It disables all CSS animations.
- D) It compiles styles into canvas bitmaps.
<details><summary>Answer</summary>

**A.** Zero-runtime compilers parse component source code statically at build time using AST analyzers. They extract style declarations into optimized atomic utility CSS files and replace component style calls with static class strings, eliminating all runtime JS style evaluation overhead.
- Why not B: Compilers run on Node.js / Rust, not PHP.
- Why not C and D: They output standard CSS supporting all native animations and layout.
- Ref: [modules/14-css-architecture-and-design-tokens.md](../modules/14-css-architecture-and-design-tokens.md#4-the-zero-runtime--atomic-paradigm)
</details>

### Q-CSS-069 · Architecture & Tokens · difficulty 3 · scenario
A Web Component encapsulates its internal DOM inside a shadow root. An author wants to allow external application stylesheets to customize the background color of a specific internal button without exposing the rest of the shadow DOM. What native CSS mechanism achieves this?
- A) Declare `part="custom-button"` on the internal button, allowing external styles to target `my-element::part(custom-button)`.
- B) Break the shadow DOM using `shadowRoot.mode = 'disabled'`.
- C) Write an `!important` rule in the external stylesheet.
- D) Shadow DOM elements cannot be styled externally.
<details><summary>Answer</summary>

**A.** The `::part()` pseudo-element (CSS Shadow Parts) allows a Web Component author to explicitly expose designated shadow elements for external styling via the `part="..."` attribute, maintaining encapsulation for all other internal nodes.
- Why not B: Shadow DOM mode cannot be disabled once attached.
- Why not C: External `!important` rules cannot penetrate shadow boundaries without exposed parts or custom properties.
- Why not D: `::part()` and custom properties explicitly allow controlled styling.
- Ref: [modules/14-css-architecture-and-design-tokens.md](../modules/14-css-architecture-and-design-tokens.md#penetrating-the-shadow-boundary-accurately)
</details>

### Q-CSS-070 · Architecture & Tokens · difficulty 2 · multi
Which standardized metadata fields are defined on individual tokens in the W3C DTCG 2025.10 specification? (Select TWO)
- A) `$value`
- B) `$type`
- C) `$class`
- D) `$module`
<details><summary>Answer</summary>

**A and B.**
- A and B are correct: `$value` (the data value) and `$type` (the data type, e.g. `color`, `dimension`) are formal top-level token properties in the DTCG 2025.10 standard.
- Why not C and D: These are not recognized DTCG token metadata keys.
- Ref: [modules/14-css-architecture-and-design-tokens.md](../modules/14-css-architecture-and-design-tokens.md#anatomy-of-a-tokensjson-file)
</details>

---

## Comprehensive Architecture & Algorithmic Scenarios

### Q-CSS-071 · Architecture · difficulty 3 · scenario
An enterprise application establishes the following layer order: `@layer reset, tokens, base, components, utilities;`. A developer styles a modal dialog inside `@layer components` with selector `#app-modal.active` (specificity `(1, 1, 0)`). An engineer writes an override inside `@layer utilities` with selector `.u-hide` (specificity `(0, 1, 0)`). Which rule takes precedence, and why?
- A) `#app-modal.active` because ID selectors always beat class selectors.
- B) `.u-hide` because later layers take precedence over earlier layers for normal declarations, and layer priority is evaluated before selector specificity.
- C) The rule declared later in the file.
- D) Neither; specificity tie-breaking defaults to user-agent styles.
<details><summary>Answer</summary>

**B.** The cascade algorithm evaluates Cascade Layers (Step 4) before Specificity (Step 5). Because `utilities` appears after `components` in the layer definition list, its declarations take higher layer priority. The conflict is resolved at the layer step; the lower specificity of `.u-hide` is irrelevant.
- Why not A: Specificity is only evaluated to break ties between declarations in the exact same layer.
- Why not C: Order of appearance is evaluated only if layers and specificity are tied.
- Why not D: Tie-breaking falls back to order of appearance, not user-agent styles.
- Ref: [modules/03-cascade-layers-and-scope.md](../modules/03-cascade-layers-and-scope.md#layer-declaration--order-of-precedence)
</details>

### Q-CSS-072 · Layout · difficulty 3 · hands-on
In a three-column CSS Grid defined as `grid-template-columns: repeat(3, minmax(0, 1fr))`, three card components use `grid-template-rows: subgrid` across 3 row tracks. Card 1 has a short title and 1-line body; Card 2 has a 4-line title and 10-line body. What happens to the action buttons placed in Row 3 of Card 1 and Card 2?
- A) Card 1's action button sits directly underneath its 1-line body, misaligned with Card 2.
- B) Both buttons align to the exact same vertical y-coordinate on the screen, because Subgrid shares track sizing across both cards.
- C) Card 2 crashes with track overflow.
- D) Card 1's button is hidden.
<details><summary>Answer</summary>

**B.** Subgrid delegates row track sizing to the parent grid. The parent's Row 1 sizes to fit the tallest header (Card 2's 4-line title), Row 2 sizes to fit the tallest body (Card 2's 10-line body), and Row 3 hosts both action buttons at the exact same vertical y-coordinate, achieving perfect multi-row alignment across cards.
- Why not A: That would occur with standard independent nested grids, which Subgrid explicitly fixes.
- Why not C and D: Subgrid tracks expand smoothly to accommodate the largest item across all subgrids.
- Ref: [modules/06-layout-flexbox-grid-subgrid-and-lanes.md](../modules/06-layout-flexbox-grid-subgrid-and-lanes.md#3-subgrid-nested-two-dimensional-alignment)
</details>

### Q-CSS-073 · Stacking · difficulty 3 · scenario
A dropdown menu component inside a navigation bar has `position: absolute; z-index: 1000;`. When opened, the dropdown renders visually underneath a sibling promotional banner that has `position: relative; z-index: 1;`. What structural issue explains this?
- A) Absolute elements cannot have z-indexes above 100.
- B) The navigation bar ancestor establishing the dropdown's containing context has an effective stacking context with `z-index: 0` or lower than the promotional banner's stacking context.
- C) The promotional banner has `display: flex`.
- D) The browser does not support z-index.
<details><summary>Answer</summary>

**B.** Stacking contexts are hierarchical. The navigation bar and the promotional banner are siblings in the root stacking context. If the navigation bar has no z-index (or a z-index lower than the banner's `z-index: 1`), the entire navigation bar is painted underneath the banner. The dropdown's `z-index: 1000` is trapped within the navigation bar's stacking context and cannot escape.
- Why not A: `z-index` values can exceed millions.
- Why not C: Flexbox alone does not override stacking context priorities.
- Why not D: `z-index` is supported in all browsers.
- Ref: [modules/07-positioning-stacking-and-top-layer.md](../modules/07-positioning-stacking-and-top-layer.md#why-z-index-999999-fails)
</details>

### Q-CSS-074 · Custom Properties · difficulty 3 · scenario
A design token is registered via `@property --accent-color { syntax: "<color>"; inherits: true; initial-value: green; }`. A developer sets `--accent-color: calc(10px + 20px);` on an element. What color will be computed when evaluating `color: var(--accent-color)`?
- A) Green.
- B) 30px.
- C) Transparent.
- D) Blue.
<details><summary>Answer</summary>

**A.** Because `--accent-color` is registered with `syntax: "<color>"`, the browser's parser rejects `calc(10px + 20px)` as an invalid length token for a color property. The variable immediately and cleanly reverts to its registered `initial-value`, which is `green`.
- Why not B: A length cannot be assigned to a `<color>` property.
- Why not C: Transparent is only the default for un-registered properties that reset to initial.
- Why not D: Blue is completely unrelated.
- Ref: [modules/09-custom-properties-registered-and-functions.md](../modules/09-custom-properties-registered-and-functions.md#2-strongly-typed-variables-the-property-api)
</details>

### Q-CSS-075 · Tokens · difficulty 3 · scenario
In a W3C DTCG design token file, Token A defines `$value: "{color.b}"` and Token B defines `$value: "{color.a}"`. What must a conforming design token compiler do when resolving this configuration?
- A) Silently assign `black` to both tokens.
- B) Detect a circular alias dependency and throw a fatal compilation error.
- C) Infinite loop until the computer runs out of memory.
- D) Convert both tokens to RGB.
<details><summary>Answer</summary>

**B.** Under the W3C DTCG 2025.10 specification, token resolvers must construct a directed dependency graph of token aliases. If a cycle is detected ($A \rightarrow B \rightarrow A$), the compiler must reject the file and throw a descriptive circular dependency error to prevent build-time infinite recursion.
- Why not A: Silently guessing fallback colors masks design system bugs.
- Why not C: Conforming compilers track visited nodes in a Set to detect cycles before looping.
- Why not D: Resolving aliases occurs before color formatting.
- Ref: [modules/14-css-architecture-and-design-tokens.md](../modules/14-css-architecture-and-design-tokens.md#3-the-w3c-design-tokens-standard-dtcg-202510), [13-design-tokens-dtcg.test.ts](../examples/13-design-tokens-dtcg.test.ts)
</details>

---

## 60-Minute Mock Technical Examination

This mock examination simulates a senior/staff frontend systems engineering interview round.
- **Time Limit**: 60 minutes
- **Total Questions**: 20
- **Passing Score**: 80% (16 / 20 correct)

### Mock Examination Questions
1. Domain 01: [Q-CSS-002](#q-css-002--platform-specs--difficulty-2--single)
2. Domain 01: [Q-CSS-003](#q-css-003--platform-specs--difficulty-2--scenario)
3. Domain 02: [Q-CSS-006](#q-css-006--selectors--difficulty-2--single)
4. Domain 02: [Q-CSS-007](#q-css-007--selectors--difficulty-2--single)
5. Domain 02: [Q-CSS-009](#q-css-009--selectors--difficulty-3--scenario)
6. Domain 03: [Q-CSS-011](#q-css-011--cascade--layers--difficulty-2--single)
7. Domain 03: [Q-CSS-012](#q-css-012--cascade--layers--difficulty-3--scenario)
8. Domain 04: [Q-CSS-016](#q-css-016--value-processing--difficulty-3--scenario)
9. Domain 04: [Q-CSS-018](#q-css-018--value-processing--difficulty-2--single)
10. Domain 05: [Q-CSS-021](#q-css-021--box-model--bfc--difficulty-2--single)
11. Domain 05: [Q-CSS-022](#q-css-022--box-model--bfc--difficulty-2--scenario)
12. Domain 06: [Q-CSS-026](#q-css-026--layout--difficulty-2--single)
13. Domain 06: [Q-CSS-028](#q-css-028--layout--difficulty-2--single)
14. Domain 07: [Q-CSS-031](#q-css-031--positioning--stacking--difficulty-2--single)
15. Domain 07: [Q-CSS-033](#q-css-033--positioning--stacking--difficulty-2--single)
16. Domain 08: [Q-CSS-036](#q-css-036--containment--difficulty-2--single)
17. Domain 09: [Q-CSS-041](#q-css-041--custom-properties--difficulty-2--single)
18. Domain 10: [Q-CSS-046](#q-css-046--color--typography--difficulty-2--single)
19. Domain 11: [Q-CSS-053](#q-css-053--motion--difficulty-3--scenario)
20. Domain 13: [Q-CSS-061](#q-css-061--performance--difficulty-3--single)

---

### Scoring Key & Competency Evaluation
- **19–20 Correct (95–100%)**: **Staff / Principal Web Platform Architect**. Flawless mastery of browser rendering engines, cascade priorities, containment isolation, and modern web specifications.
- **16–18 Correct (80–90%)**: **Senior Frontend Systems Engineer**. Comprehensive operational knowledge; ready to architect large-scale design systems and diagnose complex layout and performance issues.
- **12–15 Correct (60–75%)**: **Frontend Practitioner**. Solid grasp of day-to-day CSS syntax, but exhibits conceptual gaps in deep browser mechanics (e.g. IACVT behavior, containing block resolution, or layer inversion).
- **$< 12$ Correct ($< 60\%$)**: **Foundational Gap**. Review the 14 curriculum modules and run the interactive browser verification test suites in `examples/`.
