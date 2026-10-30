# Modern CSS & Platform Mechanics Fast-Lookup Cheatsheet

A high-density reference sheet covering CSS platform specifications, cascade mechanics, layout algorithms, visual formatting models, color science, rendering pipeline internals, and design tokens.

---

## 1. Selectors & Specificity Matrix

### Specificity Calculation: `(A, B, C)`
$$\text{Vector: } (A, B, C)$$
- **$A$ (IDs)**: `#header`, `#nav`, `#user-modal`
- **$B$ (Classes, Attributes, Pseudo-classes)**: `.btn`, `[type="submit"]`, `:hover`, `:focus-visible`, `:nth-child(2)`
- **$C$ (Types, Pseudo-elements)**: `div`, `span`, `p`, `::before`, `::after`, `::backdrop`
- **Ignored in calculation**: Universal selector (`*`), combinators (`+`, `>`, `~`, ` `), `:where()` argument.
- **Inherited properties**: Have **no specificity** (evaluated below any directly matched rule).

### Functional Pseudo-Class Specificity Rules
| Pseudo-class | Specificity Behavior | Forgiving Syntax? |
| :--- | :--- | :---: |
| `:where(s1, s2)` | Always **`(0, 0, 0)`** regardless of arguments | Yes |
| `:is(s1, s2)` | Takes specificity of the **most specific argument** in list | Yes |
| `:not(s1, s2)` | Takes specificity of the **most specific argument** in list | No |
| `:has(s1, s2)` | Takes specificity of the **most specific argument** in list | No |
| `:nth-child(An+B of S)` | Specificity of pseudo-class $(0, 1, 0)$ + specificity of selector $S$ | No |

### Relational Selector (`:has()`) Patterns
```css
/* Parent has direct child matching .error */
form:has(> .error) { border-color: red; }

/* Preceding sibling of checked checkbox */
label:has(+ input:checked) { font-weight: bold; }

/* Grid container containing at least 5 child cards */
.grid:has(.card:nth-child(5)) { grid-template-columns: repeat(4, 1fr); }
```

---

## 2. Cascade Priority Algorithm

When two or more declarations target the same element and property, the browser resolves the winning declaration using this strict ordered evaluation:

```
1. Origin & Importance
   ├── 1.1 Transition declarations
   ├── 1.2 User-Agent !important
   ├── 1.3 User !important
   ├── 1.4 Author !important
   ├── 1.5 Animation declarations
   ├── 1.6 Author normal
   ├── 1.7 User normal
   └── 1.8 User-Agent normal
2. Context (Shadow DOM tree boundary encapsulation)
3. Cascade Layers (@layer)
   ├── Normal declarations: Later declared layers defeat earlier layers; unlayered styles WIN over all layers.
   └── !important declarations: INVERTED! Earlier declared layers defeat later layers; layered styles WIN over unlayered.
4. Specificity (A, B, C vector comparison)
5. Scope Proximity (Shorter DOM tree hop distance to @scope root wins)
6. Order of Appearance (Last declared rule in source document wins)
```

---

## 3. Cascade Layers (`@layer`) & Scoping (`@scope`)

### Layer Declaration & Evaluation
```css
/* 1. Explicit layer order definition */
@layer reset, base, components, utilities;

/* 2. Normal cascade precedence (highest to lowest):
   Unlayered > utilities > components > base > reset */

/* 3. !important cascade precedence (highest to lowest):
   reset !important > base !important > components !important > utilities !important > Unlayered !important */
```

### Donut Scoping (`@scope`)
```css
/* Scope applies to .card but excludes descendants inside .content-slot */
@scope (.card) to (.content-slot) {
  h2 { font-size: 1.25rem; }
  p { color: oklch(0.4 0.05 250); }
}

/* Referencing the scope root itself using :scope */
@scope (.alert) {
  :scope { border: 1px solid red; }
  :scope:hover { background-color: pink; }
}
```

---

## 4. Value Processing & Viewport Units

### The 4 Value Processing Stages
$$\text{Specified Value} \xrightarrow{\text{Cascade/Default}} \text{Computed Value} \xrightarrow{\text{Layout Algorithm}} \text{Used Value} \xrightarrow{\text{Device Constraints}} \text{Actual Value}$$
- **Specified**: Raw value parsed from author CSS or user-agent defaults.
- **Computed**: Inheritance resolved; relative font units (`em`, `rem`) converted to absolute `px`; URLs resolved.
- **Used**: Layout-dependent calculations performed (percentages converted to exact `px` based on container box).
- **Actual**: Snapped to device physical pixel grid and display hardware constraints.

### Modern Viewport Units
| Unit | Description | Behavior with Dynamic Mobile Toolbars |
| :--- | :--- | :--- |
| `vh` / `vw` | Traditional viewport height/width | May cause layout shifts or hide behind toolbars |
| `svh` / `svw` | **Small** viewport | Fixed height when mobile toolbars are **expanded** (smallest viewable area) |
| `lvh` / `lvw` | **Large** viewport | Fixed height when mobile toolbars are **collapsed** (largest viewable area) |
| `dvh` / `dvw` | **Dynamic** viewport | Dynamically adjusts in real time as user scrolls and toolbars resize |

---

## 5. Mathematical Functions

```css
/* Arithmetic */
width: calc(100% - 2rem);

/* Min / Max selection */
width: min(100%, 640px); /* Never exceeds container or 640px */
font-size: max(16px, 1.2vw); /* Minimum accessible font-size floor */

/* Clamping: clamp(MIN, PREFERRED, MAX) */
font-size: clamp(1rem, 0.75rem + 1.25vw, 2.5rem);

/* Stepping & Modular arithmetic */
padding: round(to-zero, 17px, 5px); /* 15px */
margin-left: mod(27px, 10px);        /* 7px (same sign as divisor) */
margin-left: rem(27px, 10px);        /* 7px (same sign as dividend) */

/* Trigonometry for rotational motion / circular layouts */
--angle: 45deg;
transform: translate(calc(100px * cos(var(--angle))), calc(100px * sin(var(--angle))));
```

---

## 6. Box Model & Block Formatting Contexts (BFC)

### Margin Collapsing Rules
Vertical margins collapse between:
1. **Adjacent siblings** in in-flow normal block layout.
2. **Parent and first/last child** if there is no border, padding, inline content, or BFC establishment separating them.
3. **Empty block boxes** with zero height, no border, no padding, and no inline content.
- *Horizontal margins never collapse.*
- *Flex items and Grid items never collapse margins.*

### Block Formatting Context (BFC) Triggers
An element creates a new BFC (preventing margin collapse with ancestors and containing internal floats) if it has:
- `display: flow-root;` (modern canonical trigger without side effects)
- `display: flex;` or `display: grid;` (creates flex/grid formatting context)
- `position: absolute;` or `position: fixed;`
- `float: left;` or `float: right;`
- `overflow: hidden;`, `overflow: auto;`, or `overflow: scroll;` (anything other than `visible` or `clip`)
- `contain: layout;` or `contain: content;`

---

## 7. Flexbox & Grid Layout Alignment Matrix

### Box Alignment Property Matrix
| Property | Applies To | Target Axis | Action |
| :--- | :--- | :--- | :--- |
| `justify-content` | Container | Main (Flex) / Inline (Grid) | Distributes free space between all tracks/items |
| `align-content` | Container | Cross (Flex) / Block (Grid) | Distributes free space between multi-line rows/columns |
| `justify-items` | Grid Container | Inline Axis | Default horizontal alignment of items inside cells |
| `align-items` | Container | Cross (Flex) / Block (Grid) | Default vertical alignment of items inside lines/cells |
| `justify-self` | Item | Inline Axis | Self-alignment along inline axis (Grid only) |
| `align-self` | Item | Cross (Flex) / Block (Grid) | Self-alignment overriding container `align-items` |

### CSS Grid Patterns
```css
/* Auto-responsive grid without media queries */
.grid-responsive {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
}

/* Subgrid inheritance */
.parent-grid {
  display: grid;
  grid-template-columns: 200px 1fr 100px;
}
.subgrid-card {
  grid-column: span 3;
  display: grid;
  grid-template-columns: subgrid; /* Aligns nested elements to parent grid tracks */
}
```

---

## 8. Stacking Contexts & Top Layer

### Stacking Context Creation Triggers
An element forms a new Stacking Context if it satisfies ANY of:
1. Document root (`<html>`).
2. `position: fixed;` or `position: sticky;`.
3. `position: relative;` or `position: absolute;` with `z-index` other than `auto`.
4. `opacity` less than `1`.
5. `transform`, `filter`, `perspective`, `clip-path`, `mask`, or `backdrop-filter` other than `none`.
6. `isolation: isolate;` (canonical trigger without cosmetic side effects).
7. `mix-blend-mode` other than `normal`.
8. `contain: paint;` or `contain: strict;`.

### Top Layer & Native Popover API
```html
<button popovertarget="my-menu">Open Menu</button>
<div id="my-menu" popover>
  <p>Rendered in native HTML Top Layer above all document z-indices.</p>
</div>
```
```css
/* Styling popover and backdrop */
[popover] {
  inset: auto;
  margin: 0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
[popover]::backdrop {
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}
```

---

## 9. Container Queries (`@container`)

```css
/* 1. Define container type and optional name */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* 2. Dimensional container query */
@container card (min-width: 480px) {
  .card-body {
    display: flex;
    flex-direction: row;
  }
}

/* 3. Container query units */
.card-title {
  font-size: clamp(1rem, 4cqi, 2rem); /* 1cqi = 1% of container inline size */
}

/* 4. Style query on custom properties */
@container style(--theme: dark) {
  .badge { background: #333; color: #fff; }
}
```

---

## 10. Registered Custom Properties (`@property`)

```css
/* Typed Houdini custom property registration */
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

/* Enables smooth CSS transitions on custom properties */
.animated-card {
  --gradient-angle: 0deg;
  background: linear-gradient(var(--gradient-angle), red, blue);
  transition: --gradient-angle 0.5s ease-in-out;
}
.animated-card:hover {
  --gradient-angle: 180deg;
}
```

---

## 11. Color Spaces & Relative Color Syntax

### OKLCH Model
$$\text{oklch}(L \quad C \quad H \quad [/\quad A])$$
- **$L$ (Lightness)**: $0.0$ (pure black) to $1.0$ (pure white) — perceptually uniform.
- **$C$ (Chroma)**: $0.0$ (grayscale) to $\sim 0.37$ (maximum saturation).
- **$H$ (Hue Angle)**: $0^\circ \text{ to } 360^\circ$ ($0^\circ$ pink-red, $90^\circ$ yellow, $145^\circ$ green, $250^\circ$ blue).

### Relative Color Syntax (RCS)
```css
:root {
  --brand: oklch(0.6 0.22 250);
}

/* Modify lightness, mute chroma, or set alpha */
.surface-dim {
  background-color: oklch(from var(--brand) calc(l - 0.2) c h);
}
.surface-translucent {
  background-color: oklch(from var(--brand) l c h / 0.5);
}
.surface-pastel {
  background-color: oklch(from var(--brand) 0.85 calc(c * 0.4) h);
}
```

---

## 12. Motion: Transitions, Entry & View Transitions

### Entry/Exit Animation with `@starting-style` & Discrete Transitions
```css
dialog[open], [popover]:popover-open {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s ease, transform 0.3s ease, display 0.3s allow-discrete, overlay 0.3s allow-discrete;
}

@starting-style {
  dialog[open], [popover]:popover-open {
    opacity: 0;
    transform: translateY(-20px);
  }
}
```

### View Transitions API
```css
/* Name elements participating in morph transitions */
.hero-image {
  view-transition-name: hero;
}

/* Customize transition animation */
::view-transition-old(hero) {
  animation: 300ms ease-out both fade-out;
}
::view-transition-new(hero) {
  animation: 300ms ease-in both fade-in;
}
```

---

## 13. Accessibility & Media Features

```css
/* Respect user vestibular motion preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Windows High Contrast / Forced Colors Mode */
@media (forced-colors: active) {
  .custom-checkbox {
    forced-color-adjust: none; /* Only if custom colors are strictly necessary */
    border: 1px solid ButtonText;
  }
}

/* Keyboard-only focus indicator */
:focus:not(:focus-visible) { outline: none; }
:focus-visible { outline: 2px solid oklch(0.6 0.22 250); outline-offset: 2px; }

/* Visually Hidden Screen-Reader-Only Pattern */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 14. Rendering Performance & Critical Path

- **Layout Thrashing Trap**: Interleaving DOM reads (`offsetWidth`, `clientHeight`, `getBoundingClientRect()`) with DOM writes (`style.width = ...`) forces synchronous reflow. Batch reads first, writes second.
- **Offscreen Subtree Optimization**:
  ```css
  .large-virtualized-list-item {
    content-visibility: auto;
    contain-intrinsic-size: auto 120px;
  }
  ```
- **GPU Composited Properties**: Only `transform` and `opacity` bypass layout and paint phases entirely, operating directly on GPU texture buffers.

---

## 15. Design Tokens (DTCG Standard)

```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "oklch(0.6 0.22 250)",
        "$type": "color",
        "$description": "Primary interactive accent color"
      }
    }
  },
  "spacing": {
    "base": {
      "$value": "1rem",
      "$type": "dimension"
    }
  },
  "shadow": {
    "card": {
      "$value": {
        "offsetX": "0px",
        "offsetY": "4px",
        "blur": "12px",
        "spread": "0px",
        "color": "oklch(0 0 0 / 0.15)"
      },
      "$type": "shadow"
    }
  }
}
```
