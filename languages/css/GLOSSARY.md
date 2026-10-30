# CSS Platform & Modern Engine Mechanics Bilingual Terminology Glossary

This glossary provides authoritative English ↔ Czech definitions of core CSS platform standards, cascade mechanics, layout algorithms, visual formatting models, color science, and rendering pipeline internals. All definitions and explanations are written in English, pairing canonical W3C/WHATWG English nomenclature with established Czech technical equivalents.

---

## 1. CSS Platform Specs, Baseline & Tooling

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **CSS Snapshot** | **CSS Snapshot (souhrnná specifikace)** | A periodic W3C Working Group document aggregating stable CSS specifications and modules defining the official current state of CSS. | W3C CSS WG Snapshot |
| **Baseline (Web Platform)** | **Baseline (standard webové platformy)** | A cross-browser initiative (W3C, Google, Apple, Mozilla, Microsoft) categorizing web features as "Newly available" or "Widely available" across major browser engines. | WebDX Community Group |
| **Living Standard** | **Živý standard (Living Standard)** | A continuously maintained and updated technical specification without fixed version numbers, standard for WHATWG HTML and DOM. | WHATWG Process |
| **Abstract Syntax Tree (AST)** | **Abstraktní syntaktický strom (AST)** | A tree representation of CSS source code parsing rules, selectors, declarations, and values used by compilers and linters. | CSS Parser Architecture |
| **CSS Bundler / Minifier** | **Slučovač a minifikátor CSS** | A build tool (such as Lightning CSS or PostCSS) that parses CSS, rewrites syntax, inlines `@import`, tree-shakes unused declarations, and minimizes byte size. | Lightning CSS / CSS Specs |
| **Polyfill** | **Polyfill (funkční záplata pro zpětnou kompatibilitu)** | Client-side script code replicating modern platform APIs or behaviors in older browsers lacking native implementation. | Web Engineering Standards |

---

## 2. Syntax, Selectors & Specificity

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Specificity** | **Specificita (váha selektoru)** | A three-component vector `(A, B, C)` calculating selector weight: ID selectors ($A$), class/attribute/pseudo-class selectors ($B$), and type/pseudo-element selectors ($C$). | W3C Selectors Level 4 |
| **Pseudo-class** | **Pseudotřída** | A state or structural selector prefixed by a single colon (`:`) targeting elements based on user interaction, state, or DOM position (e.g., `:hover`, `:checked`, `:nth-child`). | W3C Selectors Level 4 |
| **Pseudo-element** | **Pseudoprvek** | An abstraction prefixed by double colons (`::`) representing a sub-part or generated cosmetic element not directly present in DOM source (e.g., `::before`, `::backdrop`). | W3C Selectors Level 4 |
| **Forgiving Selector List** | **Tolerantní seznam selektorů** | A selector parsing mode used by `:is()` and `:where()` where an invalid or unrecognized selector in the list is dropped rather than invalidating the entire rule. | W3C Selectors Level 4 § 4.2 |
| **Specificity Forgiveness Zero** | **Nulová specificita (:where)** | The behavior of `:where()` pseudo-class which always assigns `(0, 0, 0)` specificity to its entire selector argument regardless of contents. | W3C Selectors Level 4 |
| **Relational Selector (:has)** | **Relační selektor (:has)** | A parent/ancestor/previous-sibling selector pseudo-class evaluating conditions against descendants or adjacent siblings relative to the matched element. | W3C Selectors Level 4 § 3.4 |
| **Structural Pseudo-class** | **Strukturální pseudotřída** | Selectors matching elements based on document tree relationships (e.g., `:nth-child(An+B of selector)`, `:only-child`, `:root`). | W3C Selectors Level 4 |

---

## 3. Cascade, Cascade Layers & Scope

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Cascade Priority Algorithm** | **Algoritmus kaskády (prioritní řazení pravidel)** | The deterministic multi-step process resolving conflicting CSS declarations by origin & importance, context, layers, specificity, scope proximity, and order of appearance. | W3C CSS Cascading & Inheritance Level 5 |
| **Origin & Importance** | **Původ a důležitost (Origins & Importance)** | The highest cascade criteria ordering: Transition, User-Agent `!important`, User `!important`, Author `!important`, Animation, Author normal, User normal, User-Agent normal. | W3C CSS Cascading Level 5 § 6.1 |
| **Cascade Layer (@layer)** | **Kaskádová vrstva (@layer)** | A structured declaration grouping mechanism where unlayered styles defeat layered styles in normal declarations, and layer order inverts for `!important` declarations. | W3C CSS Cascading Level 5 § 6.4 |
| **Scoping Root** | **Kořen oboru platnosti (scoping root)** | The DOM element defining the upper boundary of an `@scope` rule where declarations begin matching. | W3C CSS Scoping Level 1 § 3 |
| **Scoping Limit (Donut Scope)** | **Hranice oboru platnosti (scoping limit / donut scope)** | The DOM selector defining the lower boundary slot where an `@scope` rule ceases to apply to descendants. | W3C CSS Scoping Level 1 § 3.2 |
| **Scope Proximity** | **Blízkost oboru platnosti (scope proximity)** | Cascade tie-breaker preferring declarations originating from the scoping root with the shortest generational DOM tree distance to the target element. | W3C CSS Cascading Level 5 § 6.5 |

---

## 4. Value Processing & Units

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Specified Value** | **Zadaná hodnota (specified value)** | The value of a property resulting from cascade resolution or inherited/default fallback before conversion. | W3C CSS Values and Units Level 4 |
| **Computed Value** | **Vypočtená hodnota (computed value)** | The value resolved during inheritance and initial layout preparation (converting relative lengths like `em` or percentages to absolute pixels where possible without layout). | W3C CSS Values and Units Level 4 |
| **Used Value** | **Použitá hodnota (used value)** | The final absolute value resulting from running full layout algorithms (e.g., percentage widths converted to exact pixels based on container width). | W3C CSS Values and Units Level 4 |
| **Actual Value** | **Skutečná hodnota (actual value)** | The used value adjusted for device hardware constraints such as integer pixel snapping and antialiasing. | W3C CSS Values and Units Level 4 |
| **Dynamic Viewport Units (dvh / dvw)** | **Dynamické jednotky viewportu (dvh / dvw)** | Viewport units that adapt dynamically as mobile browser browser chrome/toolbars expand or collapse. | W3C CSS Values and Units Level 4 § 6.1 |
| **Small / Large Viewport Units (svh / lvh)** | **Malé a velké jednotky viewportu (svh / lvh)** | Fixed viewport units representing the smallest (chrome expanded) and largest (chrome retracted) possible screen viewports. | W3C CSS Values and Units Level 4 § 6.1 |
| **Mathematical Functions** | **Matematické funkce CSS** | CSS functions performing evaluation, clamping, and math (`calc()`, `min()`, `max()`, `clamp()`, `round()`, `mod()`, `sin()`). | W3C CSS Values and Units Level 4 § 10 |

---

## 5. Box Model & Visual Formatting Model

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Box Sizing** | **Model dimenzování rámečku (box-sizing)** | Property determining whether width and height apply to `content-box` (excluding padding/border) or `border-box` (including padding/border). | W3C CSS Box Model Level 3 |
| **Margin Collapsing** | **Slučování vnějších okrajů (margin collapsing)** | The visual formatting rule where adjoining vertical margins of in-flow block boxes combine into a single margin equal to the maximum positive margin. | W3C CSS2 § 8.3.1 |
| **Block Formatting Context (BFC)** | **Blokový formátovací kontext (BFC)** | An isolated layout environment wherein block boxes are laid out vertically, margins do not collapse outside the boundary, and floats are cleared internally. | W3C CSS Display Module Level 3 |
| **Inline Formatting Context (IFC)** | **Řádkový formátovací kontext (IFC)** | An environment where inline-level boxes are arranged horizontally into line boxes, wrapping across lines when exceeding container width. | W3C CSS Display Module Level 3 |
| **Intrinsic Size** | **Přirozená velikost (intrinsic size)** | Size determined by content rather than external styling (`min-content`, `max-content`, `fit-content`). | W3C CSS Sizing Level 3 |
| **Replaced Element** | **Nahrazovaný prvek (replaced element)** | An element whose visual representation and dimensions are provided externally rather than formatted by CSS rules (e.g., `<img>`, `<video>`, `<canvas>`). | W3C CSS2 § 3.1 |

---

## 6. Layout: Flexbox, Grid, Subgrid & Lanes

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Flexible Box Layout (Flexbox)** | **Pružné rozvržení (Flexbox)** | A 1D layout model distributing space and aligning items along a main axis and cross axis within a container. | W3C CSS Flexible Box Layout Level 1 |
| **Flex Factor & Fractional Growth** | **Koeficient roztažení a smrštění (flex-grow / flex-shrink)** | Unitless factors determining how remaining positive space or negative overflow is proportionally distributed among flex items. | W3C CSS Flexible Box Layout Level 1 § 7 |
| **Grid Layout** | **Mřížkové rozvržení (CSS Grid)** | A 2D layout model dividing a container into rows and columns defined by grid lines, tracks, and areas. | W3C CSS Grid Layout Module Level 2 |
| **Flexible Length Unit (fr)** | **Zlomková jednotka mřížky (fr)** | A dimension representing a fraction of the leftover free space in the grid container after allocating non-flexible tracks. | W3C CSS Grid Layout Level 2 § 7.2 |
| **Subgrid** | **Podmřížka (subgrid)** | A grid item whose nested grid tracks inherit and align directly with the row or column track definitions of its parent grid container. | W3C CSS Grid Layout Level 2 § 2 |
| **Auto-fill vs Auto-fit** | **Automatické vyplnění vs přizpůsobení (auto-fill / auto-fit)** | Track repetition keywords where `auto-fill` creates empty tracks if space permits, while `auto-fit` collapses empty tracks to zero pixels. | W3C CSS Grid Layout Level 2 § 7.2.2 |

---

## 7. Positioning, Stacking Contexts & Top Layer

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Stacking Context** | **Kontext vykreslování v ose Z (stacking context)** | A three-dimensional conceptual layering of HTML elements along the z-axis relative to the user, created by specific CSS properties. | W3C CSS2 Appendix E |
| **Painter's Algorithm** | **Malířův algoritmus vykreslování** | The layer rendering order from back to front: background/borders, negative z-indexes, in-flow blocks, non-positioned floats, in-flow inlines, `z-index: 0`, and positive z-indexes. | W3C CSS2 Appendix E |
| **HTML Top Layer** | **Vrchní systémová vrstva (HTML Top Layer)** | A specialized browser viewport stacking plane rendered entirely outside document stacking contexts, hosting `<dialog>`, popovers, and fullscreen elements. | WHATWG HTML Standard § 6.13 |
| **Popover API** | **Rozhraní pro vyskakovací prvky (Popover API)** | Native browser capability enabling non-modal or modal overlay presentation in the Top Layer with automated light-dismiss and keyboard dismissing. | WHATWG HTML Standard § 6.12 |
| **Backdrop Pseudo-element (::backdrop)** | **Pseudoprvek podkladu (::backdrop)** | A full-viewport pseudo-element rendered immediately below a Top Layer element, blocking or dimming the underlying document. | WHATWG HTML Standard / CSS Fullscreen |
| **CSS Anchor Positioning** | **Kotevní pozicování (Anchor Positioning)** | CSS specification allowing an absolutely positioned element to anchor its placement, tethering, and sizing to an independent DOM element without shared parents. | W3C CSS Anchor Positioning Level 1 |

---

## 8. Containment & Container Queries

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **CSS Containment** | **Izolace podstromu (CSS Containment)** | The performance optimization allowing developers to isolate a subtree's layout, style, paint, or size from the rest of the document tree. | W3C CSS Containment Level 3 |
| **Size Containment** | **Velikostní izolace (size containment)** | Containment guaranteeing that an element's sizing can be computed without examining its child contents. | W3C CSS Containment Level 3 § 2.1 |
| **Inline-Size Container** | **Kontejner v řádkové ose (container-type: inline-size)** | An established query container that isolates and measures its dimension along the inline (horizontal in western typography) axis for container queries. | W3C CSS Containment Level 3 § 3 |
| **Container Query (@container)** | **Kontejnerový dotaz (@container)** | A style rule conditional upon the evaluated size, aspect ratio, or computed style of an ancestor query container rather than the global viewport. | W3C CSS Conditional Rules Level 5 |
| **Container Query Units (cqw, cqh, cqi)** | **Jednotky kontejneru (cqw, cqh, cqi)** | Units representing 1% of a query container's width, height, or inline-size. | W3C CSS Containment Level 3 § 4 |
| **Container Style Query** | **Dotaz na styl kontejneru (style query)** | An `@container style(...)` query applying styles conditionally based on the computed custom properties of an ancestor query container. | W3C CSS Conditional Rules Level 5 |

---

## 9. Custom Properties, Registered Properties & Functions

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **CSS Custom Property** | **Uživatelská vlastnost (CSS proměnná)** | An author-defined property prefixed with `--` whose value is substituted via `var()` and undergoes late token substitution during computed value time. | W3C CSS Custom Properties Level 1 |
| **Guaranteed-Invalid Value** | **Zaručeně neplatná hodnota (guaranteed-invalid)** | The initial fallback state of a custom property during cycle evaluation causing declarations referencing it to become invalid at computed-value time. | W3C CSS Custom Properties Level 1 § 3.1 |
| **Invalid at Computed-Value Time** | **Neplatnost v době výpočtu hodnot** | The CSS rule stating that if a custom property substitution yields an invalid property syntax, the property reverts to `unset` (or `initial`/`inherit`), never cascade fallback. | W3C CSS Custom Properties Level 1 § 3.2 |
| **CSS Houdini Properties & Values (@property)** | **Registrace vlastností (@property)** | W3C specification allowing typed registration of custom properties with syntax validation (`<color>`, `<length>`), inheritance control, and initial values. | W3C CSS Properties and Values API Level 1 |
| **Interpolable Custom Property** | **Interpolovatelná uživatelská vlastnost** | A registered property with defined syntactic type allowing CSS transitions and animations to smoothly interpolate between states. | W3C CSS Properties and Values API Level 1 |

---

## 10. Color Spaces, Theming & Typography

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **OKLCH Color Space** | **Barevný prostor OKLCH** | A cylindrical representation of the perceptually uniform Oklab color space specifying Lightness ($L \in [0, 1]$), Chroma ($C \ge 0$), and Hue angle ($H \in [0, 360^\circ]$). | W3C CSS Color Module Level 4 § 10 |
| **Perceptual Uniformity** | **Vjemová rovnoměrnost (perceptual uniformity)** | The mathematical characteristic where an identical Euclidean distance between two colors in color space corresponds to an identical perceived change in human vision. | Ottosson (2020) / CIE |
| **Color Gamut** | **Barevný gamut** | The complete subset of visible colors reproducible by a specific display device or defined within a mathematical color model (e.g., sRGB, Display P3). | W3C CSS Color Module Level 4 § 3 |
| **Gamut Mapping** | **Mapování gamutu (gamut mapping)** | The algorithmic transformation mapping an out-of-gamut color coordinate to the nearest perceptible boundary reproducible inside a destination display gamut. | W3C CSS Color Module Level 4 § 13 |
| **Relative Color Syntax** | **Relativní barevná syntaxe (RCS)** | CSS syntax allowing color derivation and channel mutation from an existing source color (e.g., `oklch(from var(--base) l c h / 0.5)`). | W3C CSS Color Module Level 5 § 3 |
| **Variable Fonts** | **Variabilní písma (OpenType Variable Fonts)** | A font format encoding continuous design axes (weight `wght`, width `wdth`, slant `slnt`, optical size `opsz`) in a single compact file. | OpenType 1.8 / CSS Fonts Level 4 |

---

## 11. Motion: Transitions, Animations & View Transitions

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Discrete Property Transition** | **Přechod diskrétní vlastnosti** | Transitioning discrete properties (like `display` or `overlay`) using `transition-behavior: allow-discrete` to delay flip until transition duration expires. | W3C CSS Transitions Level 2 § 2.2 |
| **Starting Style (@starting-style)** | **Výchozí styl (@starting-style)** | A CSS rule defining initial property values when an element is first rendered in the DOM or enters from `display: none` to enable entry transitions. | W3C CSS Transitions Level 2 § 2.3 |
| **View Transition API** | **Rozhraní zobrazení přechodů (View Transition API)** | A browser mechanism capturing snapshots of old and new DOM states, animating between them via specialized pseudo-element pseudo-trees. | W3C CSS View Transitions Module Level 1 |
| **View Transition Pseudo-tree** | **Pseudostrom přechodu zobrazení** | The temporary pseudo-element hierarchy (`::view-transition`, `::view-transition-group`, `::view-transition-image-pair`, `::view-transition-old/new`). | W3C CSS View Transitions Level 1 § 3 |
| **Cubic Bézier Timing Function** | **Kubická Bézierova časovací funkce** | A mathematical parametric curve $P(t)$ defined by four control points determining acceleration and easing across animation time. | W3C CSS Easing Functions Level 1 |

---

## 12. Responsive & Accessible CSS

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Prefers Reduced Motion** | **Uživatelská preference omezení pohybu** | A user-preference media query (`prefers-reduced-motion: reduce`) detecting operating system accessibility settings requesting minimized animations. | W3C Media Queries Level 5 § 11.1 |
| **Forced Colors Mode** | **Režim vynucených barev (vysoký kontrast OS)** | Operating system accessibility mode overriding author colors with system colors; queried via `forced-colors: active` and managed via `system-color`. | W3C Media Queries Level 5 § 11.4 |
| **Accessible Color Contrast** | **Přístupný barevný kontrast (WCAG 2.2 / APCA)** | The relative luminance ratio between text foreground and background (minimum 4.5:1 for normal text under WCAG AA, or APCA lightness contrast criteria). | W3C WCAG 2.2 / APCA |
| **Focus-Visible (:focus-visible)** | **Viditelné zaměření klávesnicí (:focus-visible)** | Pseudo-class matching only when an element receives focus through keyboard or non-pointer modality, suppressing cosmetic focus rings on click. | W3C Selectors Level 4 § 8.5 |
| **Visually Hidden (Screen-Reader Only)** | **Vizuálně skrytý obsah (pro čtečky obrazovky)** | An accessible CSS pattern clipping elements to 1x1 pixel while maintaining full accessibility tree exposure for assistive technology. | WebAIM / W3C Accessibility Guidelines |

---

## 13. Rendering Pipeline & Performance

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Critical Rendering Path** | **Kritická cesta vykreslování** | The sequence of stages from raw HTML/CSS parsing to pixels on screen: DOM & CSSOM $\rightarrow$ Render Tree $\rightarrow$ Layout $\rightarrow$ Paint $\rightarrow$ Composite. | Browser Architecture Standards |
| **Style Invalidation & Recalculation** | **Neplatnost a přepočet stylů (Recalculate Style)** | The browser engine phase resolving selector matches and re-evaluating computed property values following DOM or class mutations. | Blink / WebKit Engine Internals |
| **Reflow / Layout Thrashing** | **Znovuvyčíslení rozvržení a zahlcení (layout thrashing)** | The performance bottleneck caused by interleaving JavaScript DOM writes and layout-measuring reads (e.g. `offsetWidth`), forcing synchronous reflows. | High Performance Browser Networking |
| **Paint & Compositing** | **Vykreslení a kompozice vrstev (Paint & Composite)** | The process of rasterizing visual display lists into bitmaps and orchestrating independent GPU texture layers without repainting the document. | GPU Accelerated Compositing in Chrome |
| **Content Visibility (content-visibility)** | **Viditelnost obsahu (content-visibility: auto)** | A CSS property instructing the engine to skip layout and painting for offscreen subtrees until they approach the viewport. | W3C CSS Containment Level 2 § 3 |

---

## 14. CSS Architecture & Design Tokens

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Design Token** | **Návrhový token (Design Token)** | A technology-agnostic primitive key-value pair capturing a design decision (color, spacing, duration) shared across design tools and codebases. | W3C DTCG Specification |
| **Design Tokens Community Group (DTCG)** | **Komunitní skupina pro návrhové tokeny (DTCG)** | The W3C community group standardizing token JSON exchange formats, types (`$type`), values (`$value`), and aliasing syntax (`{color.primary}`). | W3C DTCG Format Specification |
| **Token Tiering (Global, Semantic, Component)** | **Úrovně tokenů (globální, sémantické, komponentní)** | A three-tier design token architecture: raw values (Global) $\rightarrow$ intent-based aliases (Semantic) $\rightarrow$ scoped component variables (Component). | Design Systems Architecture |
| **Zero-Runtime CSS** | **Nulový runtime CSS (Zero-Runtime CSS)** | Architecture where styles are extracted, validated, and statically compiled into atomic or grouped stylesheets at build time (e.g., Lightning CSS, Panda CSS). | Modern CSS Tooling |
| **BEM Methodology** | **Metodika BEM (Block, Element, Modifier)** | A CSS naming convention standardizing classes into independent Blocks, constituent Elements (`__`), and state/variant Modifiers (`--`). | Yandex BEM Standard |
