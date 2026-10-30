# TypeScript Cheat Sheet (TypeScript 7.0)

Fast lookup for the track. Every row links to the module that explains it. Versions: TypeScript 7.0.2, Node 26, Zod 4.6.7, `@types/react` 19.3.0, Solid 2.0.0-rc.19 (release candidate).

---

## 1. Toolchain (TS 7) — [Module 01](./modules/01-toolchain-and-compiler-model.md)

| Task | Command / setting |
|---|---|
| Type-check only | `tsc --noEmit` (or `tsc -b` with project references) |
| Run a `.ts` file | `node file.ts` (Node 26 strips types; no checking) |
| Parallel checking | `--checkers <n>` (default 4), `--builders <n>` for `tsc -b`, `--singleThreaded` |
| Compile a single file next to a tsconfig | `tsc --ignoreConfig file.ts` (else TS5112) |
| Tools needing the compiler API (typescript-eslint, vue-tsc) | `"typescript": "npm:@typescript/typescript6@^6.0.2"`, `"@typescript/native": "npm:typescript@^7.0.2"` |
| Profile | `--extendedDiagnostics`, `--generateTrace <dir>` (one `types_N.json` per checker) |

**Defaults since 6.0:** `strict: true`, `module: esnext`, `target`: latest ES year, `types: []`, `rootDir: ./`, `noUncheckedSideEffectImports: true`, `libReplacement: false`. **Removed in 7.0:** `target es5`, `downlevelIteration`, `moduleResolution node/node10/classic`, `module amd/umd/system/none`, `baseUrl`, `outFile`, `esModuleInterop:false`, `alwaysStrict:false`, `import … assert`.

| Error after upgrading | Fix |
|---|---|
| TS2591 "Cannot find name 'process'" | `"types": ["node"]` |
| TS2882 side-effect import of `./x.css` | `declare module "*.css";` |
| TS5102 / TS5108 option removed | Replace `baseUrl` with `./`-relative `paths`; use `nodenext`/`bundler` |
| TS5011 common source directory | Set `rootDir` |
| TS1294 not erasable | Remove enums/namespaces/parameter properties/`<T>x` |

---

## 2. Minimal tsconfigs — [Module 06](./modules/06-modules-declarations-and-tsconfig.md)

```jsonc
// Node (run by Node)                         // Bundled app (Vite)
{ "compilerOptions": {                        { "compilerOptions": {
  "module": "nodenext",                         "module": "preserve",
  "types": ["node"],                            "jsx": "react-jsx",
  "rootDir": "./src", "outDir": "./dist",       "lib": ["esnext", "dom"],
  "verbatimModuleSyntax": true,                 "types": ["vite/client"],
  "erasableSyntaxOnly": true,                   "noEmit": true,
  "noUncheckedIndexedAccess": true,             "verbatimModuleSyntax": true,
  "skipLibCheck": true } }                      "noUncheckedIndexedAccess": true } }
```

| `nodenext` error | Meaning | Fix |
|---|---|---|
| TS2835 | Relative ESM import needs an extension | `./x.js` (or `.ts` + `rewriteRelativeImportExtensions`) |
| TS1484 | Type imported without `type` | `import type { T }` |
| TS1543 | JSON import needs attribute | `with { type: "json" }` |
| TS6306 | Referenced project not composite | `"composite": true` |

---

## 3. Narrowing — [Module 03](./modules/03-unions-narrowing-and-control-flow.md)

| Guard | Narrows | Trap |
|---|---|---|
| `typeof x === "object"` | to object types **and `null`** | check `x !== null` |
| `if (x)` | removes `null`, `undefined`, **`0`, `""`, `NaN`** | use `!== null` |
| `"k" in x` | members with `k` | right side must be an object |
| `x instanceof C` | to `C` | fails across realms |
| `x.kind === "a"` | discriminated member | destructure only from `const`/params |
| `switch (true) { case cond: }` | per case (5.3+) | |
| `arr.filter(x => x !== null)` | inferred predicate (5.5+) | not for truthiness |
| closures | keep narrowing after the last assignment (5.4+) | later assignment re-widens |

Exhaustiveness: `default: { const _x: never = value; }`.

---

## 4. Assignability — [Module 04](./modules/04-objects-assignability-and-weird-parts.md)

| Fact | Consequence |
|---|---|
| Structural, width subtyping | `Object.keys` → `string[]`; fresh literals get excess-property checks |
| Function properties: contravariant params; **methods: bivariant** | declare callbacks as properties |
| Arrays covariant | take `readonly T[]` |
| `{}` = non-nullish, `object` = non-primitive, `unknown` = anything | |
| `A & B` with conflicting literal property | `never` |
| `:` replaces the type; `satisfies` checks and keeps it; `as` asserts | |
| `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | opt-in beyond `strict` |

---

## 5. Generics & variance — [Module 07](./modules/07-generics-and-inference.md)

| Need | Tool |
|---|---|
| Keep literals/tuples from arguments | `<const T>` |
| Stop a parameter from inferring `T` | `NoInfer<T>` |
| Supply some type args, infer others | not supported (TS2558): curry |
| State variance | `interface P<out T>`, `C<in T>`, `Cell<in out T>` (TS2636 if wrong) |
| Useless generic | `T` used once → replace with its constraint / a schema |

---

## 6. Type-level toolkit — [Modules 08](./modules/08-type-derivation-and-template-literals.md) & [09](./modules/09-conditional-mapped-and-recursive-types.md)

```ts
type Values<T> = T[keyof T];
type Elem<A extends readonly unknown[]> = A[number];
type Awaited2<T> = Awaited<T>;
type NonDist<T> = [T] extends [string] ? 1 : 2;          // stop distribution
type IsNever<T> = [T] extends [never] ? true : false;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Getters<T> = { [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K] };
type PickByValue<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] };
type ToNumber<S> = S extends `${infer N extends number}` ? N : never;
type UnionToMap<U extends { type: string }> = { [E in U as E["type"]]: Omit<E, "type"> };
type Suggest = "primary" | "secondary" | (string & {});   // literals + any string
```

Limits (measured, 7.0.2): non-tail recursion TS2589 at ~48 levels; tail recursion 1000 iterations; template cross products fail at 100,000 members (TS2590). TS 7 template inference splits by **code point**.

---

## 7. API design — [Module 10](./modules/10-type-safe-api-design-patterns.md)

| Pattern | Shape |
|---|---|
| Brand | `type UserId = string & { readonly __brand: "UserId" }` + one parser |
| Predicate / assertion | `(x): x is T` / `(x): asserts x is T` (assertion targets need explicit types, TS2775) |
| Disposable resource | `interface Conn extends Disposable {}`; `using c = connect()` |
| Typed decorator | `<This, Args extends unknown[], R>(fn: (this: This, ...a: Args) => R, ctx: ClassMethodDecoratorContext<This, …>)` |
| Registry (open for augmentation) | `export interface Registry {}` + `declare module "lib" { interface Registry { … } }` |

---

## 8. Runtime boundaries — [Module 11](./modules/11-runtime-boundaries-validation.md)

```ts
const User = z.object({ id: z.uuid(), email: z.email(), age: z.number().int() });
type User = z.infer<typeof User>;           // output; z.input for what clients send
const r = User.safeParse(raw);              // { success: true, data } | { success: false, error }
z.flattenError(r.error!);                   // { formErrors, fieldErrors }
```

Zod 4: top-level formats (`z.email()`), `{ error }` param, `.default` short-circuits (old behaviour = `.prefault`), `z.strictObject`/`z.looseObject`, `.extend` instead of `.merge`. Library-neutral input: `StandardSchemaV1` from `@standard-schema/spec`.

---

## 9. UI typing — [Module 12](./modules/12-typing-ui-frameworks.md)

| React 19 | Solid 2.0 RC |
|---|---|
| `jsx: "react-jsx"` | `jsx: "preserve"`, `jsxImportSource: "@solidjs/web"` |
| `children: ReactNode` | `ParentComponent<P>` / `JSX.Element` |
| `ComponentProps<"button">` (includes `ref`) | `JSX.ButtonHTMLAttributes<HTMLButtonElement>` |
| `ref` is a normal prop; no `forwardRef` | `ref={(el) => …}` |
| `useRef<T>(null)` → `RefObject<T \| null>`; argument required | `createSignal<T>()` → `T \| undefined` |
| Ref callback may return cleanup | `<Show when={x}>{(v) => v()}</Show>` gives an accessor |
| `<Ctx value={…}>`, `use(ctx)` | `<Ctx value={…}>`, `useContext` returns `T` |
| Augment `declare module "react" { namespace JSX … }` | `merge`/`omit` instead of `mergeProps`/`splitProps` |

---

## 10. Publishing — [Module 13](./modules/13-library-authoring-performance-and-type-tests.md)

```json
"type": "module",
"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }
```

`types` first · one `.d.ts` per format (`.d.cts` for CJS) · `isolatedDeclarations` for fast emit · check with `publint` and `attw --pack . --profile esm-only` · type tests: `@ts-expect-error` (TS2578 when stale), `expectTypeOf(x).toEqualTypeOf<T>()`.
