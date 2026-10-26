# Total TypeScript — Fast-Lookup Cheat Sheet (TS 5.x–7.0, React 19 & SolidJS 2.x)

A dense desk reference covering TypeScript's type-level operators, built-in and custom utility types, generic patterns, narrowing techniques, modern ECMAScript/TypeScript features, React 19 patterns, SolidJS 2.x (`@solidjs/signals`) primitives, and Matt Pocock's recommended `tsconfig.json` rules.

---

## 1. Value World vs. Type World Bridge Operators

| Operator | Direction | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `:` (Annotation) | Type → Value | Constrains a variable or parameter to a declared type (widens literals to the annotated type) | `const cfg: Record<string, number> = { a: 1 }` |
| `satisfies` | Type ↔ Value | Validates that a value matches a contract **without** widening its inferred literal/property types | `const cfg = { a: 1 } satisfies Record<string, number>` (`cfg.a` is `number`, keys are `'a'`) |
| `as const` | Value → Narrow Type | Freezes an expression into deeply `readonly` literal types and fixed-length tuples | `const roles = ['admin', 'user'] as const` (`readonly ['admin', 'user']`) |
| `<const T>` | Call-Site Arg → Narrow Type | Infers deeply `readonly` literal types directly at a generic function call site without requiring `as const` | `function defineRoutes<const T extends readonly string[]>(routes: T): T` |
| `typeof` (type level) | Value → Type | Extracts the static TypeScript type of a runtime variable, function, or class | `type Roles = typeof roles` |
| `keyof` | Type → Union of Keys | Produces a union of all public property keys of a type | `type RoleKey = keyof User` (`'id' \| 'name'`) |
| `keyof typeof` | Value → Union of Keys | Extracts the literal keys of a runtime object | `type EnvKey = keyof typeof ENV` |
| `T[K]` (Indexed Access) | Type → Property Type | Looks up the type of property `K` (or a union of keys) on `T` | `type IdOrName = User['id' \| 'name']` |
| `T[number]` | Array/Tuple → Union | Extracts the union of all element types in an array or tuple | `type Role = (typeof roles)[number]` (`'admin' \| 'user'`) |

---

## 2. Built-In Utility Types Matrix

### Object & Union Manipulation

| Utility Type | Definition Under the Hood | What It Does |
| :--- | :--- | :--- |
| `Partial<T>` | `{ [P in keyof T]?: T[P] }` | Makes all top-level properties of `T` optional |
| `Required<T>` | `{ [P in keyof T]-?: T[P] }` | Makes all top-level properties of `T` required (strips `?`) |
| `Readonly<T>` | `{ readonly [P in keyof T]: T[P] }` | Makes all top-level properties of `T` `readonly` |
| `Pick<T, K>` | `{ [P in K]: T[P] }` (`K extends keyof T`) | Keeps only the specified keys `K` from object `T` |
| `Omit<T, K>` | `Pick<T, Exclude<keyof T, K>>` | Removes keys `K` from object `T` *(Note: does not constrain `K extends keyof T`)* |
| `Record<K, V>` | `{ [P in K]: V }` (`K extends PropertyKey`) | Creates an object type where every key in union `K` maps to value type `V` |
| `Exclude<T, U>` | `T extends U ? never : T` | Removes members of union `T` that are assignable to `U` |
| `Extract<T, U>` | `T extends U ? T : never` | Keeps only members of union `T` that are assignable to `U` |
| `NonNullable<T>` | `T & {}` | Removes `null` and `undefined` from `T` |

### Function, Class, Promise & Inference Control

| Utility Type | Definition Under the Hood | What It Does |
| :--- | :--- | :--- |
| `ReturnType<T>` | `T extends (...args: any) => infer R ? R : any` | Extracts the return type of function type `T` |
| `Parameters<T>` | `T extends (...args: infer P) => any ? P : never` | Extracts a tuple of parameter types of function type `T` |
| `ConstructorParameters<T>` | `T extends abstract new (...args: infer P) => any ? P : never` | Extracts constructor parameter tuple from a class constructor type |
| `InstanceType<T>` | `T extends abstract new (...args: any) => infer R ? R : any` | Extracts the instance type produced by `new Class()` |
| `Awaited<T>` | Recursive `infer` over `.then()` | Recursively unwraps `Promise<Promise<U>>` to `U` |
| `NoInfer<T>` (TS 5.4+) | Intrinsic compiler primitive | Prevents TypeScript from inferring a generic type parameter from a specific argument position |

---

## 3. Essential Custom Type Helpers (The `utils/` Folder)

```ts
// 1. Prettify: Flattens intersections so IDE hovers show clean properties
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// 2. StrictOmit: Enforces that omitted keys actually exist on T
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

// 3. DistributiveOmit: Preserves discriminated unions when omitting a property
export type DistributiveOmit<T, K extends PropertyKey> = T extends any
  ? Omit<T, K>
  : never;

// 4. LooseAutocomplete: Preserves IDE literal autocomplete while accepting any string!
export type LooseAutocomplete<T extends string> = T | (string & {});

// 5. Branded Type: Nominal typing in a structural type system
declare const brand: unique symbol;
export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

// 6. Compile-Time Type Assertion Helpers (Total TypeScript test style)
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;
```

---

## 4. Modern JavaScript & TypeScript 5.x–7.0 Features

| Feature | Syntax / Type | Key Rule |
| :--- | :--- | :--- |
| **Explicit Resource Management** | `using conn = getDb()` / `await using tx = beginTx()` | Implements `[Symbol.dispose](): void` (`Disposable`) or `[Symbol.asyncDispose](): Promise<void>` (`AsyncDisposable`) |
| **Stage-3 Decorators** | `ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>` | Standard ES decorators require no `experimentalDecorators` flag and preserve `this` and argument types |
| **Immutable Array Methods** | `.toSorted()`, `.toReversed()`, `.toSpliced()`, `.with(i, v)` | Available directly on `readonly T[]` without mutating the source array |
| **Typed Grouping** | `Object.groupBy(items, (x) => x.status)` | Infers `Partial<Record<StatusUnion, Item[]>>` directly from literal union keys |
| **ES2025 Set Operations** | `setA.union(setB)`, `setA.intersection(setB)`, `setA.difference(setB)` | Native mathematical set methods returning strongly typed `Set<T>` |
| **`Promise.withResolvers`** | `const { promise, resolve, reject } = Promise.withResolvers<User>()` | Replaces manual `let resolve!: ...` outside `new Promise()` |
| **Erasable Syntax Only** | `--erasableSyntaxOnly` (TS 5.8+ / Node.js native TS) | Disallows runtime-emitting TS features (`enum`, `namespace`, parameter properties) so Node can strip types directly |
| **Isolated Declarations** | `--isolatedDeclarations` (TS 5.5+) | Requires explicit return types on exported APIs so bundlers can emit `.d.ts` files in parallel without full typecheck |

---

## 5. React 19.x with TypeScript Quick Reference

| Task in React 19 | Modern React 19 Type / Pattern |
| :--- | :--- |
| **Pass `ref` to a component** | **No `forwardRef` needed!** Add `ref?: React.Ref<HTMLInputElement>` directly to your props object or use `React.ComponentProps<"input">` (which now includes `ref`!) |
| **Generic component with `ref`** | `function Select<T>({ options, ref }: SelectProps<T> & { ref?: React.Ref<HTMLSelectElement> })` |
| **Ref callback cleanup** | `<div ref={(el) => { ...; return () => cleanup(); }} />` *(Implicit returns like `ref={el => (myRef = el)}` are now a compile error; use block braces `{ myRef = el; }`)* |
| **Strict `useRef` (React 19)** | `useRef<T>(null)` or `useRef<T \| undefined>(undefined)` *(0-arg `useRef<T>()` is disallowed in React 19 types)* |
| **Unwrap Promise or conditional Context** | `const data = use(dataPromise)` or `if (show) { const theme = use(ThemeContext); }` (`Usable<T> = PromiseLike<T> \| Context<T>`) |
| **Context Provider shorthand** | `<ThemeContext value={theme}>{children}</ThemeContext>` (no `.Provider` needed) |
| **Stateful Form Action** | `const [state, formAction, isPending] = useActionState<ActionState, FormData>(serverAction, initialState)` |
| **Optimistic UI State** | `const [optimisticItems, addOptimistic] = useOptimistic<Item[], NewItem>(items, (state, next) => [...state, next])` |
| **Child Form Submit Status** | `const { pending, data } = useFormStatus()` (must be called inside a child component of `<form>`) |
| **RSC Boundary Check** | Ensure props crossing `"use server"` / `"use client"` satisfy `Serializable<T>` (no functions, classes, or DOM nodes) |

---

## 6. SolidJS 2.x (`@solidjs/signals`) with TypeScript Quick Reference

| Task in SolidJS 2.x | SolidJS 2.x Type / Pattern |
| :--- | :--- |
| **TSConfig for Solid** | `"jsx": "preserve"`, `"jsxImportSource": "solid-js"` |
| **Reactive Signal** | `const [count, setCount] = createSignal<number>(0)` → `[Accessor<number>, Setter<number>]` |
| **First-Class Async Memo / Query (Solid 2.0)** | `const user = createAsync(async () => fetchUser(id()))` or `createMemo(async () => ...)` → Returns `Accessor<User>` (**not** `User \| undefined`!). Pending/errors bubble to `<Loading>` and `<ErrorBoundary>`. |
| **Check Pending / Imperative Resolve** | `isPending(user)` (`boolean`) / `await resolve(user)` (`Promise<User>`) |
| **Split Two-Phase Effect (Solid 2.0)** | `createEffect(() => count(), (val, prev) => { console.log(val); return () => cleanup(); })` — Phase 1 tracks synchronously and infers `val: T` for Phase 2! |
| **Deep Store & Mutation** | `const [state, setState] = createStore<State>(initial)` + `setState("users", 0, "name", "Ada")` or `setState(produce((draft) => { draft.users[0].name = "Ada"; }))` |
| **Derived Store Projection (Solid 2.0)** | `const selection = createProjection<Record<string, boolean>>((draft) => { draft[selectedId()] = true; }, {})` |
| **Default Props (Preserving Reactivity)** | `const merged = mergeProps({ size: "md" as const }, props)` (never destructure `props` at setup top-level!) |
| **Split Props for Forwarding** | `const [local, others] = splitProps(props, ["variant", "size"])` → `[Pick<P, "variant" \| "size">, Omit<P, "variant" \| "size">]` |
| **Narrowing in JSX (`<Show>`)** | `<Show when={user()}>{(u: Accessor<User>) => <Profile user={u()} />}</Show>` |
| **Zero-Allocation Event Tuple** | `<button onClick={[handleDelete, item.id]}>Delete</button>` (infers `handleDelete(id: string, e: MouseEvent)`) |
| **Polymorphic Component** | `<Dynamic component={local.as ?? "button"} {...others} />` typed with `ValidComponent` |

---

## 7. Empty Object Trap: `{}` vs. `object` vs. `Record`

| Type | Accepts Primitives (`"hi"`, `123`)? | Accepts Objects (`{ a: 1 }`)? | Accepts `null` / `undefined`? | Actual Meaning |
| :--- | :--- | :--- | :--- | :--- |
| `{}` | **Yes!** | **Yes!** | No | Anything except `null` or `undefined` |
| `object` | No | Yes (including arrays & functions) | No | Any non-primitive reference value |
| `Record<string, unknown>` | No | Yes (key-value objects) | No | Object indexable by `string` keys |
| `Record<PropertyKey, never>` | No | Only `{}` (truly empty object) | No | Object with **zero** allowed properties |
