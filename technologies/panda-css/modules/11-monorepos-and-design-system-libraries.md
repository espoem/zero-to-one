# Module 11 · Monorepos and Shipping a Design-System Library

> **Verified against** `@pandacss/dev` 2.4.0 on 2026-10-29.
> **Executable proof:** [`examples/system/preset.ts`](../examples/system/preset.ts) (a preset shared by four Panda projects); the workspace in [`examples/monorepo/`](../examples/monorepo/): the package [`packages/ds`](../examples/monorepo/packages/ds/) built with `panda lib`, and the app [`apps/web`](../examples/monorepo/apps/web/) consuming it with `designSystem`; [`monorepo.test.ts`](../examples/tests/monorepo.test.ts).

There are three ways to share Panda styling across packages. Choosing the right one, and wiring extraction so nothing is scanned twice or missed, is the core of this module. Workspace tooling itself (npm/pnpm workspaces, Turborepo task graphs) is generic; we only cover Panda's delta.

---

## 11.1 Three distribution shapes

| Shape | What ships | Consumer runs Panda? | Consumer can extend the theme? | Use when |
|---|---|---|---|---|
| **Preset** (`definePreset`) | Tokens, semantic tokens, recipes, patterns, conditions: no components | Yes | Yes (`extend`) | A shared design language for several apps |
| **Design system** (`panda lib` + `designSystem`) | Components + the config they were built with + their extracted styles (build info) + generated `styled-system` exports | Yes | Yes, and the package's types follow | A component library inside a monorepo or on npm |
| **Stylesheet** (`panda cssgen --outfile` or `--splitting`) | Plain CSS (+ your compiled components) | No | No | Apps that do not run Panda |

This track uses the first shape for its own examples: [`acmePreset`](../examples/system/preset.ts) is listed by the React app, the Solid app, the fixtures and the design-system package. A preset must be a value, not a factory reference (`presets: [myPreset()]` if it exports a function), and with v2 you still list `@pandacss/preset-base` yourself ([Module 02](./02-installation-and-build-integration.md#presets-is-no-longer-implicit)).

---

## 11.2 Building a design system with `panda lib`

The package is an ordinary Panda project:

```ts
// examples/monorepo/packages/ds/panda.config.ts
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda', acmePreset],
  include: ['./src/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  jsxFramework: 'react',
})
```

```bash
panda codegen && panda lib
```

`panda lib` writes three machine artifacts and edits `package.json`:

```
dist/panda/
├── lib.json        # manifest: name, panda range, preset path, build-info path, importMap, fallback `files`
├── preset.mjs      # the package's theme (tokens, recipes, patterns) as a preset
└── buildinfo.json  # the styles extracted from the package's own source (portable encoder state)
```

```json
// dist/panda/lib.json (from the test run)
{
  "schemaVersion": 1, "name": "@acme/ds", "panda": "^2.0.0",
  "preset": "./preset.mjs", "buildInfo": "./buildinfo.json",
  "importMap": { "css": "@acme/ds/css", "recipes": "@acme/ds/recipes", "patterns": "@acme/ds/patterns", "jsx": "@acme/ds/jsx", "tokens": "@acme/ds/tokens" },
  "files": ["../src/Badge.tsx", "../src/Button.tsx", "../src/index.ts"]
}
```

`package.json` exports: you write `"."`; `panda lib` owns everything else (`./panda/*`, `./css`, `./css/*`, `./recipes`, `./patterns`, `./jsx`, `./tokens`, `./types`, …, only the categories you use) and rewrites them on each run. The test asserts that the committed [`package.json`](../examples/monorepo/packages/ds/package.json) is byte-identical after `panda lib`, so CI notices drift.

`panda buildinfo --outfile …` writes only the build info. `panda lib --files './**/*.{js,mjs}'` overrides the fallback globs when you publish built `dist` instead of `src`. `panda lib --watch` is the monorepo dev loop.

### Then vs now: shipping a library

| v0.x / 1.x | 2.x |
|---|---|
| `emitPackage: true` generated `styled-system` as an installable package | Option gone (no `emitPackage` in the 2.4.0 types or compiler source) |
| `panda emit-pkg` wrote `package.json` exports | Removed; `panda lib` syncs exports |
| `panda ship` wrote a `panda.buildinfo.json` that apps listed in `include` | `panda lib` (full manifest) or `panda buildinfo --outfile` (build info only); apps use `designSystem` |
| App config: `presets: ['@acme/preset']`, `include: [..., './node_modules/@acme/ds/dist/panda.buildinfo.json']`, a hand-written `importMap` for `@acme/styled-system` | App config: `designSystem: '@acme/ds'`. Preset, import map and build info come from the manifest |
| Two `styled-system` runtimes in the bundle (library's + app's) | The app's `styled-system` re-exports what the package owns |

Migration: delete `emitPackage`, the `panda ship`/`emit-pkg` scripts, the build-info entry in the app's `include`, and the manual `importMap`; run `panda lib` in the package; set `designSystem` in the app.

---

## 11.3 Consuming a design system

```ts
// examples/monorepo/apps/web/panda.config.ts
export default defineConfig({
  designSystem: '@acme/ds',
  include: ['./src/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  theme: { extend: { tokens: { colors: { app: { value: '#0f766e' } } } } },
})
```

What `designSystem` does, verified by [`monorepo.test.ts`](../examples/tests/monorepo.test.ts):

1. Loads `@acme/ds/panda/lib.json`, merges `preset.mjs` under your config (your tokens win; a collision reports `design_system_token_conflict` info).
2. Adds the package's import map, so `import { Button } from '@acme/ds'` → `button()` calls inside the package are already covered, and `@acme/ds/css` imports in the app are recognised.
3. **Replays `buildinfo.json`** instead of scanning package source. The app run reports `parsed 2 files` (only the app's own files), yet the CSS contains `.button`, `.button--size_lg` and the badge's `bg_brand.100`, plus the app's `--colors-app`.
4. Generates a slim local `styled-system`: the app extended tokens, so `css()` is generated locally (typed against the merged theme), while `recipes/index.js` is `export * from '@acme/ds/recipes/button'` etc. One runtime, not two.

| App authors… | `css`, `cva`, `cx` | Package recipes/patterns |
|---|---|---|
| Nothing | Re-exported from the package | Re-exported |
| Tokens, utilities, conditions, breakpoints | Generated locally | Re-exported |
| `jsxFramework`/`jsxStyleProps` | Full local tree | Full local tree |

### Fallback and failure

```
app reads buildinfo.json
├─ ok    → replay, no scan
└─ stale/missing/wrong version → re-extract lib.json `files` (warning design_system_buildinfo_stale)
    └─ no `files` → build fails
```

The test removes `buildinfo.json`: the app warns `design_system_buildinfo_stale … Re-extracted 3 source files.` and still emits `button--size_lg`. Rebuild with `panda lib` after upgrading Panda; build info carries a `configFingerprint` and a schema version.

Errors you will meet: `design_system_in_include` (listing the package name in `include`; tested), `design_system_manifest_not_found` (package not built with `panda lib`), `design_system_option_mismatch` (app sets a different `prefix`, `hash` or `separator`: the package's classes no longer match and components render unstyled), `design_system_utility_unregistered`, `design_system_version_mismatch`.

### Tree-shaking the design system

By default all modules in the build info are hydrated. `optimize.treeshakeDesignSystem: true` scans the app's `include` and hydrates only the exports the app imports. With an app file that imports `Button` but not `Badge`, the test shows `bg_brand.100` (Badge) present without the flag and absent with it, while `button--size_lg` stays. 2.4.0 fixed a bug where tree-shaking dropped styles of modules imported *by* an imported component (e.g. a `Label` rendered inside `Checkbox`); packages need a fresh `panda lib` for the fix.

Nested design systems (`designSystem` inside a design-system package) chain: apps configure only the leaf package.

---

## 11.4 Extraction hygiene in a monorepo

The two classic failure modes are opposites:

| Mistake | Effect |
|---|---|
| `include` too narrow (a workspace package that calls `css()` is not covered, and it is not a `designSystem`) | Its styles never reach the CSS: unstyled components |
| `include` too wide (`../../**/*.tsx`, `node_modules`, `dist`, or a glob into a `designSystem` package's source) | Slow builds, duplicated work; with globs into `dist` you also extract compiled code |

Rules:

1. Each app's `include` covers **only its own source** (plus Storybook stories if they render recipes).
2. Shared component packages either run `panda lib` and are consumed with `designSystem`, or are explicitly included by source glob (simpler, but every app re-extracts them).
3. Code that imports Panda from a different path than the app's `outdir` needs an `importMap` entry (string or array form: `importMap: ['styled-system', '@acme/styled-system']`), or extraction ignores it ([Module 10](./10-compiler-internals-and-debugging.md#102-import-matching-rules)).

### Task graph and caching (Turborepo or similar)

```json
// turbo.json (illustrative)
{
  "tasks": {
    "lib":     { "outputs": ["dist/panda/**", "styled-system/**"], "inputs": ["src/**", "panda.config.ts"] },
    "codegen": { "outputs": ["styled-system/**"], "inputs": ["panda.config.ts"] },
    "build":   { "dependsOn": ["^lib", "codegen"], "outputs": ["dist/**"] }
  }
}
```

The app's `build` depends on the package's `lib` (`^lib`) because the manifest and build info must exist before the app's Panda run. Include `panda.config.ts` and every preset file in the cache inputs; a token change must invalidate both `codegen` and `lib`. This track's [`package.json`](../package.json) encodes the same order in its `codegen` script: package `codegen` → package `lib` → app `codegen`.

---

## 11.5 Consumers that do not run Panda

```bash
panda cssgen --outfile dist/styles.css             # one file
panda cssgen --splitting --outdir dist/panda       # per layer + per recipe
```

Export `./styles.css` (and `./styles/*` for split output) from the package. Apps import the whole sheet or only the recipes they render (`@acme/ds/styles/recipes/button.css`). Trade-offs: no theme extension, no type sharing, and runtime-only variants must be pre-generated with `staticCss` because the app never extracts anything. `cssgen --minimal` (rules from the package's own usage) now includes `staticCss` rules, so per-package sheets can repeat rules the host already ships.

---

## 11.6 Governance

- `panda analyze --scope tokens --unused` before removing a token; `--json` for dashboards.
- Mark tokens or utilities `deprecated` so consumers get `deprecated_token_used` / `deprecated_utility_used` warnings before removal.
- `@pandacss/eslint-plugin` (and an oxlint plugin) use the same extraction as the build to flag raw values where tokens exist.
- `isolatedDeclarations`: v2 `cva`/`sva` types are keyed on a clean props type so library `.d.ts` emit does not inline CSS types.

---

## 11.7 Production failure modes

| Symptom | Cause | Fix / proof |
|---|---|---|
| Components from a shared package render unstyled | Package not in `include`, not a `designSystem`, or app `prefix`/`hash` differs | `designSystem`; leave those options unset |
| `design_system_in_include` | Package listed in `include` | Remove it; test |
| `design_system_buildinfo_stale` after a Panda upgrade | Old build info | `panda lib` in the package; fallback test |
| CSS contains every component even though the app uses two | Full hydration | `optimize.treeshakeDesignSystem`; test |
| `package.json` exports diff on every CI run | Hand-edited generated exports | Let `panda lib` own them; byte-identical test |
| Two `css()` runtimes in the bundle | v1-style setup (each package generates its own runtime) | `designSystem` |
| Build order flakes in CI | App builds before the package's `lib` | `dependsOn: ["^lib"]` |

---

## Interview Drill

<details><summary>1. Preset, design system or stylesheet: how do you choose?</summary>

Preset for a shared design language without components; design system (`panda lib` + `designSystem`) for a component library whose apps run Panda and may extend the theme; stylesheet for consumers that do not run Panda (no theme extension, pre-generate dynamic variants).
</details>

<details><summary>2. What does `designSystem: '@acme/ds'` replace from a v1 setup?</summary>

The manual preset entry, the hand-written `importMap` for the library's styled-system package, and listing the library's build info (from `panda ship`) in `include`. It also removes the duplicated runtime: the app's `styled-system` re-exports what the package owns.
</details>

<details><summary>3. How can the app ship the library's CSS without scanning the library's source?</summary>

`panda lib` stores the package's extracted styles as portable encoder state in `buildinfo.json`. The app replays that into its own compiler instance, merging the atoms and recipe usage with its own extraction, then emits one stylesheet.
</details>

<details><summary>4. What happens when the build info is stale or missing?</summary>

The app warns `design_system_buildinfo_stale` and re-extracts the source files listed in `lib.json` `files`; if there are none, the build fails rather than silently missing styles. Fix by running `panda lib` in the package.
</details>

<details><summary>5. An app sets `hash: true` and the design system's components lose their styles. Why?</summary>

Class names are baked into the package's build and runtime. If the app's `hash`, `prefix` or `separator` differ, the app's CSS uses different names than the components emit (`design_system_option_mismatch`). Leave them unset to inherit the package's values.
</details>

<details><summary>6. How do you keep CSS small when apps use a few components from a large library?</summary>

`optimize.treeshakeDesignSystem: true` hydrates only modules the app imports (tracked transitively since 2.4.0's fix), plus `optimize.removeUnusedTokens`; for non-Panda consumers, ship `--splitting` output and import per-recipe files.
</details>

<details><summary>7. Describe a correct CI task graph for a Panda monorepo.</summary>

Package: `codegen` → `lib` (outputs `styled-system/**`, `dist/panda/**`; inputs include config and presets). App: `codegen` and `build` depending on `^lib`. Add `panda codegen --check` and `panda --max-warnings 0` gates, and check that `panda lib` leaves `package.json` unchanged.
</details>

## References

- Design systems overview: https://panda-css.com/docs/design-systems/overview
- Build a design system: https://panda-css.com/docs/design-systems/build-a-design-system
- Consume with Panda: https://panda-css.com/docs/design-systems/consume-with-panda
- Consume without Panda: https://panda-css.com/docs/design-systems/consume-without-panda
- Monorepo workflow: https://panda-css.com/docs/design-systems/monorepo-workflow
- Publishing: https://panda-css.com/docs/design-systems/publishing
- Presets: https://panda-css.com/docs/theming/presets
- Optimization (`treeshakeDesignSystem`): https://panda-css.com/docs/styling/optimization
- CLI (`lib`, `buildinfo`): https://panda-css.com/docs/reference/cli
