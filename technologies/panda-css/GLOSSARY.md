# Panda CSS Glossary

This glossary defines standard technical terms used throughout the `technologies/panda-css/` learning track. All definitions, headings, and explanations are written in English; each term provides its canonical English name, established Czech equivalent, concise definition, and primary authoritative reference. Terminology adheres to official Panda CSS specifications (`panda-css.com`), W3C CSS specifications (Cascade Layers, Container Queries, Media Queries), and design system standards.

---

## 1. Build Model & Static Compilation

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Static AST Extraction** | **Statická extrakce z AST** | A compile-time analysis process where Panda traverses JavaScript/TypeScript Abstract Syntax Trees (via `ts-morph`), extracts style definitions ahead of time, and emits pure static CSS without runtime evaluation. | Panda CSS Architecture |
| **Zero-Runtime CSS-in-JS** | **CSS-in-JS s nulovým během** | A styling paradigm providing CSS-in-JS authoring ergonomics in TypeScript while generating static `.css` files at build time, eliminating runtime library overhead and context providers. | Panda CSS Architecture, RSC Standards |
| **Atomic CSS** | **Atomické CSS** | A CSS architecture where the compiler emits single-purpose, immutable utility classes per unique CSS declaration (property-value pair), guaranteeing minimal CSS footprint through deduplication. | Panda CSS Docs, W3C CSS |
| **Code Generation (`panda codegen`)** | **Generování kódu (`codegen`)** | The CLI command and process that inspects `panda.config.ts` and outputs the typed local artifact directory (`styled-system/`), containing type declarations, runtime functions, recipes, and tokens. | Panda CSS CLI Reference |
| **Box Node** | **Uzel boxu (Box Node)** | The internal abstract representation created by Panda's AST parser to model extracted JSX elements, style calls, and variant attributes before CSS rule generation. | Panda Compiler Internals |
| **Import Map (`importMap`)** | **Mapa importů (`importMap`)** | A configuration setting defining custom module specifiers for importing generated `styled-system` packages (e.g., `@acme/styled-system`), essential for multi-package monorepos. | Panda CSS Monorepo Guide |
| **Static CSS (`staticCss`)** | **Předem vygenerované (statické) CSS** | A configuration manifest forcing Panda to pre-generate specific recipes, variants, and token combinations ahead of time, preventing missing styles when classes are constructed dynamically. | Panda CSS Config Reference |
| **Strict Tokens (`strictTokens`)** | **Striktní vynucení tokenů** | A compiler validation mode that restricts style properties strictly to declared theme token values, rejecting arbitrary or unmapped CSS values at compile time. | Panda CSS Type Safety |
| **Atomic CSS Hashing** | **Hashování atomických tříd** | The deterministic hashing algorithm converting property-value pairs into predictable, stable CSS class names without runtime collisions. | Panda CSS Architecture |
| **Deterministic Slug** | **Deterministický název třídy (slug)** | A predictable human-readable class name format (e.g. `bg_blue.500`) generated ahead-of-time by the compiler parser. | Panda CSS Compiler Spec |
| **Compiler Lowering Pass** | **Průchod snižování abstrakce (lowering pass)** | A sequential transformation phase in the compiler AST pipeline (such as shorthand expansion or cascade layer assignment). | Compiler Engineering Standards |
| **Shorthand Expansion (Desugaring)** | **Rozepsání zkratek na plné vlastnosti (desugaring)** | The compile-time expansion of ergonomic property shorthands (`p`, `bg`, `w`) into standardized W3C CSS properties (`padding`, `background`, `width`). | CSS Language Specifications |
| **Extraction Failure Mode** | **Poruchový režim extrakce (failure mode)** | An authoring anti-pattern (such as dynamic property keys or un-tracked imports) causing the static AST parser to skip style emission. | Panda CSS Troubleshooting Guide |

---

## 2. Design Tokens, Theming & Semantic Scales

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Design Token** | **Návrhový token** | An indivisible design decision (color, spacing, font, radius) stored as key-value pairs and compiled into CSS Custom Properties within the `@layer tokens` cascade layer. | W3C Design Tokens Community Group (DTCG) |
| **Core Token (`defineTokens`)** | **Základní token** | An immutable scale value (e.g., `colors.blue.500: #3b82f6`) that provides the foundational palette, spacing scale, and typography values without contextual switching. | Panda CSS Token Spec |
| **Semantic Token (`defineSemanticTokens`)** | **Sémantický token** | A contextual design token whose resolved value switches dynamically based on conditions such as dark mode, high contrast, or active brand theme (e.g., `bg.surface`). | Panda CSS Theme Spec |
| **Composite Token (Text & Layer Styles)** | **Složený token (textové a vrstvové styly)** | Grouped design properties compiled into reusable style presets; `textStyles` bundle typography properties, while `layerStyles` bundle background, border, shadow, and radius properties. | Panda CSS Composition Spec |
| **Virtual Color (`colorPalette`)** | **Virtuální barevná paleta (`colorPalette`)** | An indirection mechanism that allows components to dynamically inherit entire color scales (`primary`, `success`, `danger`) by mapping token references through a localized CSS variable. | Panda CSS Color Palette Guide |
| **Theme Switching (`themes`)** | **Přepínání motivů (témat)** | A mechanism for swapping entire token sets based on scoped HTML attributes (e.g., `[data-theme="cyberpunk"]`) without requiring re-compilation or separate stylesheets. | Panda CSS Multi-Theme Guide |
| **Token Function (`token()`)** | **Funkce pro čtení tokenů (`token()`)** | A helper function resolving token paths to raw CSS custom property values or JavaScript constants at build time or runtime (e.g., `token('colors.primary')`). | Panda CSS Token API |

---

## 3. Recipes, Slot Recipes & Component Variants

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Config Recipe (`defineRecipe`)** | **Recept v konfiguraci** | A statically extracted, multi-variant component style declaration defined in `panda.config.ts`, generating dedicated class names (e.g., `btn--size_sm`) in `@layer recipes`. | Panda CSS Recipe Architecture |
| **Atomic Recipe (`cva`)** | **Atomický recept (`cva`)** | A client-side or runtime utility function constructing variant-driven class names composed strictly of atomic utility classes (`cva` - Class Variance Authority pattern). | Class Variance Authority Spec |
| **Slot Recipe (`defineSlotRecipe`)** | **Víceslotový recept (slot recipe)** | A compound recipe designed for multi-part components (e.g., Dialog, Alert, Tabs) that orchestrates base styles, variants, and compound variants across distinct sub-element slots. | Panda CSS Slot Recipe Guide |
| **Atomic Slot Recipe (`sva`)** | **Atomický víceslotový recept (`sva`)** | A lightweight variant of `defineSlotRecipe` that operates inline with atomic utility classes rather than generating global class identifiers. | Panda CSS Slot Recipe Guide |
| **Variant** | **Varianta komponenty** | A named visual or behavioral axis of variation (e.g., `variant: 'solid' \| 'outline'`, `size: 'sm' \| 'md'`) declared within a recipe. | Panda CSS Recipe Architecture |
| **Default Variants (`defaultVariants`)** | **Výchozí varianty** | The fallback variant configuration applied automatically when a consumer omits explicit variant properties. | Panda CSS Recipe Architecture |
| **Compound Variant (`compoundVariants`)** | **Složená varianta** | A conditional style block applied exclusively when a specific combination of two or more variants is active simultaneously. | Panda CSS Recipe Architecture |
| **Variant Splitting (`splitVariantProps`)** | **Oddělení variantních vlastností** | A utility function that partitions component props into recipe variant attributes versus native HTML element attributes, preventing invalid DOM attribute forwarding. | Panda CSS Recipe Runtime |
| **Style Context (`createStyleContext`)** | **Kontext stylů pro složené komponenty** | A React Context pattern that provides slot class names to compound component sub-parts (`Root`, `Trigger`, `Content`) without manual prop drilling. | Ark UI / Panda CSS Pattern |

---

## 4. Conditions, Responsive Breakpoints & Cascade Layers

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Condition** | **Podmínka stylu** | A selector, pseudo-class, media query, or theme constraint (e.g., `_hover`, `_focusVisible`, `_dark`, `_osDark`) used to apply styles conditionally. | Panda CSS Condition Reference |
| **Responsive Breakpoints** | **Responzivní body zlomu (breakpoints)** | Mobile-first media query keys (`base`, `sm`, `md`, `lg`, `xl`, `2xl`) declared in the theme scale and applied via array or object notation in style properties. | W3C Media Queries 5 |
| **Container Queries (`cq`, `@/sm`)** | **Kontejnerové dotazy** | Responsive style rules evaluated against the size of an ancestor container marked with `containerType: 'inline-size'` rather than the global browser viewport. | W3C CSS Containment Module Level 3 |
| **Cascade Layers (`@layer`)** | **Kaskádové vrstvy** | Native CSS feature organizing stylesheet rules into an explicit priority order (`reset`, `base`, `tokens`, `recipes`, `utilities`), eliminating specificity wars. | W3C CSS Cascading and Inheritance Level 5 |
| **CSS Reset / Preflight** | **Normalizace stylů (preflight)** | An opinionated base stylesheet injected into `@layer reset` to normalize browser default inconsistencies and establish sensible box-sizing behavior. | modern-normalize, Panda CSS Preflight |
| **Color Mode (`data-color-mode`)** | **Barevný režim** | An implementation pattern for toggling light and dark appearances using CSS variables and HTML attribute selectors with zero-flash rendering. | Panda CSS Color Mode Guide |

---

## 5. Layout Patterns, Style Props & Component Composition

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Layout Pattern (`definePattern`)** | **Rozvrhovací vzor (pattern)** | A reusable layout function and JSX wrapper (e.g., `stack`, `hstack`, `grid`, `flex`) with opinionated spatial behavior and dedicated props-to-style transforms. | Panda CSS Pattern Spec |
| **JSX Factory (`styled`)** | **JSX továrna (`styled`)** | A higher-order component factory (e.g., `styled('button')`) allowing HTML elements and custom components to accept style props and recipes directly. | Panda CSS JSX Architecture |
| **JSX Style Props** | **Stylovací vlastnosti JSX (style props)** | Direct styling attributes passed as JSX component props (e.g., `<Box p="4" bg="surface">`) mapped directly to atomic utility classes. | Panda CSS JSX Engine |
| **System Style Object (`SystemStyleObject`)** | **Systémový stylový objekt** | The central TypeScript type describing type-safe CSS property maps, token paths, pseudo-selectors, and conditions accepted by Panda styling functions. | Panda CSS Type System |
| **Atomic Class Generator (`css()`)** | **Generátor atomických tříd (`css()`)** | The foundational style authoring function that converts style objects into deterministic atomic class name strings. | Panda CSS Core API |
| **Raw Style Object (`css.raw()`)** | **Surový stylový objekt (`css.raw()`)** | A function returning uncompiled system style objects, enabling deterministic object merging without generating intermediate CSS class strings. | Panda CSS Core API |
| **Class Name Concatenator (`cx()`)** | **Spojovač tříd (`cx()`)** | A deterministic class combining utility (analogous to `clsx`) that deduplicates and merges class strings from recipes, atomic utilities, and external libraries. | Panda CSS Core API |

---

## Summary of Relationships

```
Panda CSS Source Code (.tsx / .ts)
               │
               ▼
┌───────────────────────────────┐
│     ts-morph AST Parser       │
│  (Finds css, cva, sva, Box)   │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       Box Node Evaluator      │
│  (Extracts statically known   │
│   tokens, styles, variants)   │
└──────────────┬────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│             Emitted CSS via Cascade Layers             │
│  @layer reset < base < tokens < recipes < utilities    │
└────────────────────────────────────────────────────────┘
```
