# Panda CSS Glossary

Technology-specific terms for the `technologies/panda-css` track (Panda CSS 2.4). Definitions are in English; each term gives its canonical English name, the Czech equivalent used in Czech front-end practice, a concise definition and a primary reference. Product names and API identifiers (`cva`, `sva`, `styled-system`) are not translated; the Czech column then gives the descriptive term used in Czech prose with the identifier in parentheses.

Terms owned by other tracks are only cross-referenced: cascade, cascade layers, specificity, custom properties, `@property`, container queries and design-token theory belong to [`languages/css`](../../languages/css/README.md); general terms such as **Pure Function** and **Hydration** are defined in the [root glossary](../../GLOSSARY.md) and reused verbatim where they appear below.

---

## 1. Build model and compiler

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Static Extraction** | **Statická extrakce** | Collecting style objects from source code by parsing it, without executing it, and emitting CSS for those that can be determined at build time. | panda-css.com/docs/get-started/why-panda |
| **Zero-Runtime CSS-in-JS** | **CSS-in-JS bez běhového prostředí** | CSS-in-JS authoring whose CSS is generated at build time, so the browser never serialises or injects styles. In Panda a small class-name runtime remains unless source transforms remove it. | M01 |
| **Abstract Syntax Tree (AST)** | **Abstraktní syntaktický strom** | Tree representation of source code produced by a parser; Panda v2 obtains it from the Oxc parser, one parse per file. | Aho et al., *Compilers*; oxc.rs |
| **Oxc** | **Oxc (Oxidation Compiler)** | Rust toolchain for JavaScript/TypeScript (parser, semantic analysis, resolver) on which the Panda v2 compiler is built. | oxc.rs |
| **Constant Folding** | **Skládání konstant** | Evaluating expressions whose operands are known at compile time; Panda's literal fold turns style arguments into literal values or gives up (⊥). | Aho et al., *Compilers* |
| **Literal Fold** | **Vyhodnocení literálu (literal fold)** | Panda's fold from an expression to a `Literal` (string, number, boolean, null, object, array, conditional) under fixed rules; unknown values produce no CSS. | M10; design-notes/literal-evaluator.md |
| **Pure Function** | **Čistá funkce** | A function whose return value depends exclusively on its input arguments, producing no observable side effects. (Root glossary.) Panda folds calls to pure helpers with static arguments. | Root GLOSSARY |
| **Cross-File Resolution** | **Rozlišení napříč soubory** | v2 feature that follows named imports, re-exports and barrels to fold values defined in other files; default and namespace imports are not followed. | M10 |
| **Import Map (`importMap`)** | **Mapa importů (`importMap`)** | Module specifiers the extractor treats as Panda entry points; matched by substring and derived from `outdir` by default. | panda-css.com/docs/reference/config#importmap |
| **Codegen** | **Generování kódu (codegen)** | Producing the typed `styled-system` package from the config alone (`panda codegen`). | panda-css.com/docs/reference/cli |
| **Cssgen** | **Generování CSS (cssgen)** | Producing the stylesheet from config plus extracted source usage (`panda cssgen`). | panda-css.com/docs/reference/cli |
| **`styled-system` (outdir)** | **Vygenerovaný adresář `styled-system`** | The generated runtime and type package (`css`, `cva`, `sva`, patterns, recipes, `jsx`, tokens, types); usually gitignored. | M01, M02 |
| **Source Transform** | **Transformace zdrojového kódu** | Bundler-plugin rewrite (`transform: true`) of static `css()`, pattern and recipe calls into string literals so the runtime can drop out. | panda-css.com/docs/styling/source-transforms |
| **Build Info** | **Informace o sestavení (build info)** | `buildinfo.json`: portable record of a design-system package's extracted styles, replayed by consuming apps instead of re-scanning the package. | M11 |
| **Diagnostic** | **Diagnostické hlášení** | Coded compiler message (`error`/`warning`/`info`), e.g. `unknown_condition`, `js_parse_error`, `config_hooks_removed`. | panda-css.com/docs/reference/diagnostics |
| **Plugin / Hook** | **Zásuvný modul / háček (hook)** | v2 extension model: named plugin objects in `plugins`, each with lifecycle hooks (`config:resolved`, `parser:before`, `codegen:prepare`, `cssgen:done`, …). | panda-css.com/docs/reference/plugins |
| **NAPI Binding** | **Nativní vazba (N-API)** | The Node-API boundary through which the JS host calls the Rust compiler (`@pandacss/compiler`); a WASM build exists for browsers. | nodejs.org/api/n-api.html |

## 2. CSS output

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Atomic CSS** | **Atomické CSS** | Architecture in which each class sets one declaration under one condition, so equal declarations share one rule across the codebase. | M01 |
| **Atom** | **Atom** | The triple (property, value, conditions) after shorthand expansion and token resolution; one atom ↔ one CSS rule ↔ one class. | design-notes/atomic-encoding.md |
| **Cascade Layer** | **Kaskádová vrstva** | `@layer` grouping that orders rules before specificity. Panda emits `reset, base, tokens, recipes, utilities`. Theory owned by `languages/css`. | CSS Cascade 5 |
| **Composition Layer** | **Vrstva kompozic** | Nested layer `utilities.compositions` holding text, layer and animation styles; plain utilities override it. | M06 |
| **Property Breadth Order** | **Řazení podle šíře vlastnosti** | v2 sorting of atoms within a layer: shorthands before longhands, so a longhand always wins regardless of source order. | M03 |
| **Preflight** | **Výchozí reset stylů (preflight)** | Panda's optional CSS reset emitted into `@layer reset`. | panda-css.com/docs/reference/config#preflight |
| **Registered Custom Property** | **Registrovaná uživatelská vlastnost** | Custom property declared with `@property` (syntax, inheritance, initial value); v2 registers internal utility variables this way instead of a universal reset. | CSS Properties and Values API |

## 3. Styling API

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Style Object** | **Objekt stylů** | Object of properties, conditions and selectors accepted by `css()` (`SystemStyleObject`). | panda-css.com/docs/styling/writing-styles |
| **Utility** | **Utilita** | Config entry mapping a property or shorthand to a CSS property, token category and optional transform (`px` → `padding-inline`, `spacing`). | panda-css.com/docs/theming/utilities |
| **Shorthand** | **Zkratka (shorthand)** | Short utility name such as `p`, `bg`, `w`; distinct from CSS shorthand properties. | M03 |
| **Condition** | **Podmínka** | Named selector or at-rule template containing `&` (`_hover`, `md`, `_dark`), or a block definition ending in `@slot`. | panda-css.com/docs/theming/conditions |
| **Responsive Value** | **Responzivní hodnota** | A value object keyed by breakpoints (`{ base, md }`) or, still supported, a positional array. | panda-css.com/docs/styling/responsive-design |
| **Escape Hatch (`[value]`)** | **Úniková syntaxe (`[hodnota]`)** | Bracketed raw value accepted under strict modes. | M05 |
| **Pattern** | **Vzor (pattern)** | Typed layout function from `definePattern` whose transform returns a style object (`stack`, `grid`, custom). | panda-css.com/docs/theming/patterns |
| **Style Props** | **Stylové vlastnosti (style props)** | JSX props that are utilities (`<Box bg="red.500">`), extracted like `css()`. | panda-css.com/docs/styling/style-props |
| **JSX Factory (`styled`)** | **Továrna JSX (`styled`)** | Generated factory that creates components accepting style props, `css`, `as`, and recipe variants. | panda-css.com/docs/recipes/styled-factory |

## 4. Recipes

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Recipe** | **Recept (recipe)** | Named variant model `(base, variants, compoundVariants, defaultVariants)` for one element. | panda-css.com/docs/recipes/overview |
| **Atomic Recipe (`cva`)** | **Atomický recept (`cva`)** | Recipe defined in code; emits all variants eagerly as atomic utilities. | M07 |
| **Config Recipe** | **Konfigurační recept** | Recipe registered in the theme; emits named classes in `@layer recipes` only for variants seen as literals (JIT). | M07 |
| **Slot Recipe (`sva`, `defineSlotRecipe`)** | **Slotový recept** | Recipe whose styles are indexed by part (slot); returns one class string per slot. | panda-css.com/docs/recipes/slot-recipes |
| **Variant** | **Varianta** | Named axis of appearance (`size`, `visual`) and its values. | M07 |
| **Compound Variant** | **Složená varianta** | Style applied only when several variant values match together; in v2 config recipes, its own class in `recipes.compound_variants`. | panda-css.com/docs/recipes/compound-variants |
| **JIT Emission** | **Generování na vyžádání (JIT)** | Emitting config-recipe CSS only for variant values found in source. | M07 |
| **Static CSS (`staticCss`)** | **Předgenerované CSS (`staticCss`)** | Config that pre-generates CSS for values extraction cannot see (runtime variants, themes). | panda-css.com/docs/styling/static |
| **Virtual Color (`colorPalette`)** | **Virtuální barva (`colorPalette`)** | Placeholder palette whose `colorPalette.*` tokens resolve to the palette set on the element or an ancestor. | panda-css.com/docs/styling/virtual-color |
| **Recipe Context** | **Kontext receptu** | `createRecipeContext` / `createSlotRecipeContext`: helpers that build compound components sharing variant props via framework context; replace v1 `createStyleContext`. | M08 |

## 5. Tokens and theming

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Design Token** | **Designový token** | Named design decision compiled to a CSS custom property. Theory owned by `languages/css`. | panda-css.com/docs/theming/tokens |
| **Semantic Token** | **Sémantický token** | Token named after a role that references other tokens and may vary by condition (mode, breakpoint, theme). | M05 |
| **Token Reference** | **Odkaz na token** | `{category.path}` inside a value, compiled to `var(--…)`, keeping the chain resolvable in the browser. | M05 |
| **Strict Tokens** | **Striktní tokeny** | `strictTokens`: type-level restriction of token-bound properties to token values. | M05 |
| **Color Mode** | **Barevný režim** | Light/dark (or other) shade of the same palette, selected by a class/attribute or the OS. | M06 |
| **Theme** | **Motiv (téma)** | Alternative token values selected with `data-panda-theme`; shipped statically or on demand. | panda-css.com/docs/theming/multiple-themes |
| **Theme Contract** | **Kontrakt motivu** | `defineThemeContract`: type that requires every theme to define a set of tokens. | M06 |
| **Text / Layer Style** | **Textový / vrstvový styl** | Named composition of typography or surface properties used via `textStyle` / `layerStyle`. | panda-css.com/docs/theming/text-styles |
| **Preset** | **Předvolba (preset)** | Reusable config fragment (`definePreset`) merged left to right before the user config; not implicit in v2. | panda-css.com/docs/theming/presets |
| **Flash of Incorrect Theme** | **Probliknutí nesprávného motivu** | Paint with the default mode before client code applies the stored mode during **Hydration** (root glossary); prevented with a blocking head script or server-side class. | M06 |

## 6. Distribution

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Design-System Package** | **Balíček designového systému** | Package built with `panda lib` that ships components, config, build info and generated exports; consumed via `designSystem`. | panda-css.com/docs/design-systems/overview |
| **Manifest (`lib.json`)** | **Manifest (`lib.json`)** | `panda lib` output listing preset, build info, import map and fallback files. | M11 |
| **Tree Shaking** | **Odstraňování nepoužitého kódu (tree shaking)** | Dropping unused exports; `optimize.treeshakeDesignSystem` applies it to design-system styles. | M11 |
| **Monorepo** | **Monorepozitář** | Repository containing several packages built and versioned together. | M11 |
