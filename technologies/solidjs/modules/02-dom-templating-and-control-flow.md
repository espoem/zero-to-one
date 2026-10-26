# Module 02 — DOM Templating and Control Flow (SolidJS 2.x)

SolidJS 2.x compiles JSX ahead of time into fine-grained DOM bindings instead of a runtime virtual DOM: each dynamic expression becomes a targeted update instruction wired to the exact signal or store field it reads, so a state change patches one text node, attribute, or list row without re-running component functions. The compiler itself moved to an Oxc/Rust toolchain for faster builds, while the authoring model stays familiar JSX with `jsxImportSource: "@solidjs/web"`. This module covers the compiler pipeline and the getter-props convention it relies on, the unified `<For>` list component with its three keying modes plus count-based `<Repeat>`, composable ref factories with `applyRef`, unified `class` bindings and HTML attribute semantics, providerless context, and conditional rendering with `<Show>`, `<Switch>/<Match>`, `dynamic()`, and `<Dynamic>`.

## 1. The Oxc/Rust compiler toolchain

The 2.x toolchain is `@solidjs/vite-plugin` (Vite integration) layered over `@solidjs/compiler` (the Oxc/Rust core, successor to the Babel plugin), configured with `"jsx": "preserve"` and `"jsxImportSource": "@solidjs/web"` so TypeScript leaves JSX intact for the Solid transform. The compiler walks each JSX element once at build time and emits direct DOM creation code (`document.createElement`, `setAttribute`, text-node insertion) plus one reactive binding per dynamic expression, which means the mapping from state to DOM is fixed before the page loads and no diffing happens at runtime. Import renderer-neutral APIs and types from `solid-js` (`createStore`, `Component`, `Element`) and DOM APIs and JSX types from `@solidjs/web` (`render`, `Portal`, `JSX`, `ComponentProps`); the DOM JSX runtime lives in `@solidjs/web/jsx-runtime`, with hyperscript, HTML-template, and custom-renderer variants available for non-DOM targets.

### Getter props and `merge` / `omit`

Because components run once, the compiler passes dynamic values as getter properties (`{ get value() { return count(); } }`) rather than snapshots, so reading `props.value` inside JSX, memos, or effect compute always observes the current value. When constructing prop objects by hand, follow the same contract: use an explicit getter for reactive values, or pass the accessor itself to an accessor-typed API, and read props through JSX or tracked compute rather than destructuring them. Two helpers replace the 1.x prop utilities: `merge(defaults, props, overrides)` layers prop sources with later sources winning per key while preserving getter laziness (replacing `mergeProps`), and `omit(props, "key")` returns a lazily-forwarded view without the listed keys (replacing `splitProps` for the exclusion case).

```tsx
import { merge, omit } from "solid-js";

const resolved = merge({ kind: "info", dismissible: true }, props, { kind: "warning" });
const compiledProps = { get value() { return count(); } }; // compiler output shape
const body = omit(props, "class", "ref"); // forwarded without wrapper keys
```

> [!NOTE]
> `merge` resolves each key from the last source that defines it, so overrides beat component props and props beat defaults; keep every layer as live getters and the merged object stays reactive without extra memos.

## 2. Unified list rendering

Solid 2.0 unifies the 1.x `<For>` and `<Index>` components into a single `<For>` whose `keyed` prop selects one of three modes, with the callback signature changing per mode while `each` always takes the same array value (`each={rows()}` for a signal or memo accessor, `each={rows}` for a store array). List identity comes from the keying mode rather than per-element `key` props, so use a literal boolean or a stable key function to keep the callback type definite, and read any accessors inside JSX, memos, or effect compute because the callback body itself is an owned setup scope where a top-level capture freezes the value.

| `For` mode | Item | Index |
|---|---|---|
| default / `keyed={true}` (identity) | raw value | accessor |
| `keyed={false}` (position) | accessor | number |
| `keyed={row => row.id}` (custom key) | accessor | accessor |

```tsx
import { For } from "solid-js";

function Lists(props: { rows: readonly { id: string; name: string }[] }) {
  return <>
    <ul><For each={props.rows}>{(row, i) => <li>{i()}: {row.name}</li>}</For></ul>
    <ul><For each={props.rows} keyed={false}>{(row, i) => <li>{i}: {row().name}</li>}</For></ul>
    <ul><For each={props.rows} keyed={(row) => row.id}>{(row, i) => <li>{i()}: {row().name}</li>}</For></ul>
  </>;
}
```

Default keyed mode is cheapest when items carry stable identity: rows are matched by reference, so reordering reuses DOM nodes. Positional mode (`keyed={false}`, the `<Index>` replacement) is for index-stable rendering such as per-row inputs, where each slot follows its position and the item arrives as an accessor. A custom key function handles server or normalized data where identity is a field (`row.id`) rather than object identity, giving keyed reuse across refetches that return fresh objects.

### `<Repeat>` for count-based rendering

`<Repeat>` renders a fixed number of positional slots without array diffing: it takes `count` (and optional `from`, default `0`) plus an optional `fallback` for `count <= 0`, and its child callback receives a plain number while reactivity comes from store or signal reads inside the row. Reach for it for pagination placeholders, star ratings, skeleton rows, and step indicators, anywhere allocating an array just to map over indices would be waste.

```tsx
<Repeat count={store.items.length} from={start()} fallback={<Empty />}>
  {(i) => <Row name={store.items[i].name} />}
</Repeat>
```

## 3. Ref directive factories and HTML semantics

Solid 2.0 removes legacy `use:*` directives in favor of composable ref callback factories: a factory runs reactive setup in its owned scope (effects, cleanup) and returns a ref callback that performs DOM work when the node arrives, and factories compose through ref arrays with nesting allowed. Bare local assignment compiles only for a single `ref={node}`; inside arrays always use callbacks (`ref={[el => { node = el; }, autofocus]}`), and library code walks nested forwarded refs with `applyRef` (`JSX.Ref` admits nested arrays, while `applyRef` takes a callback or a flat callback array).

```ts
function titleDirective(source: () => string) {
  let node: HTMLElement | undefined;
  createEffect(source, (title) => { if (node) node.title = title; });
  return (el: HTMLElement) => { node = el; el.title = source(); };
}
// Usage: <div ref={[titleDirective(() => tooltip()), autofocus]} />
```

Attribute semantics follow the platform: use lowercase HTML attributes (`tabindex`, `readonly`) with camelCase event handlers (`onClick`), presence/absence for boolean attributes, and the stateful property forms (`value`, `defaultValue`, `checked`, `defaultChecked`, `selected`, `muted`) where the DOM distinguishes current state from initial state. ARIA true/false states are enumerated strings, not HTML booleans: write `aria-pressed={selected() ? "true" : "false"}` because boolean `false` removes the attribute while the string `"false"` exposes an explicit false state, and the rc.8 JSX types reject boolean `true` for these attributes. Event binding expressions evaluate once, so put changing decisions inside a stable callback (`onClick={(event) => (enabled() ? save : explain)(event)}`); native listener options belong in ref setup with cleanup where the node lifetime requires removal.

### Unified `class` bindings

The `class` prop (lowercase, replacing `classList`) accepts strings, arrays, and objects in any nesting, resolved by `resolveClass` and typed as `JSX.ClassValue`: truthy strings contribute their whitespace-separated tokens, arrays recurse, objects contribute keys with truthy values, and duplicates collapse. Conditional styling therefore needs no helper library, and spreading props reapplies changed handlers through the same binding path.

```tsx
<div class={["card", props.class, { active: active(), hidden: !visible() }]} />
```

## 4. Providerless context

`createContext<T>()` returns the provider component itself: render `<ThemeContext value={...}>` directly with no `.Provider` wrapper, and read it with `useContext(ThemeContext)`. Without a default value, `useContext` returns `T` and throws `ContextNotFoundError` when no provider encloses the reader, which turns a silently-`undefined` theme or store into a loud error at the exact read site; pass `createContext(defaultValue)` only when a genuine fallback exists. Context scopes services and state to a subtree and supports per-request SSR isolation, so prefer it over module singletons for request-scoped data.

```tsx
const TodosContext = createContext<TodosCtx>();
const todos = useContext(TodosContext); // throws ContextNotFoundError without a provider
<TodosContext value={createTodos()}>{props.children}</TodosContext>
```

## 5. Conditional and dynamic rendering

`<Show>` renders its children when `when` is truthy and the `fallback` otherwise; its function child receives a narrowed accessor by default, or the raw narrowed value in `keyed` mode. `<Switch>` with `<Match>` children selects the first truthy branch the same way, and both follow the standard rule that accessors must be read in JSX or tracked compute rather than captured in the callback body. For component-type switching, `dynamic(() => ...)` builds a stable component from a source expression (sharing source evaluation across instances and accepting async component sources) for use as `<Active value={...} />`, with `<Dynamic component={...}>` as the inline equivalent and `createComponent(dynamic(source), props)` for imperative construction.

```tsx
<Show when={user()} fallback={<Login />}>{(u) => <Profile user={u()} />}</Show>
<Show when={user()} keyed>{(u) => <Profile user={u} />}</Show>
<Switch fallback={<Missing />}>
  <Match when={detail()} keyed>{(d) => <Detail data={d} />}</Match>
</Switch>

const Active = dynamic(() => (editing() ? Editor : Viewer));
<Active value={value()} />
// Inline equivalent:
<Dynamic component={editing() ? Editor : Viewer} value={value()} />
```

> [!TIP]
> JSX tracks its expressions, so render changing values as `<span>{label()}</span>`; native element children take renderable values, not bare functions, while `For`/`Show` render callbacks are a separate component contract that receives the item or narrowed value.

## 6. Hands-on exercises

### Exercise 1 — Keyed vs positional lists

Given `rows = [{ id: "a", name: "A" }, { id: "b", name: "B" }]`, render the names with all three `<For>` modes and assert each produces `["A", "B"]`, then render `renderRepeat({ count: 3 }, (i) => i * 2)` and assert `[0, 2, 4]`. The solution must match each mode's callback signature exactly (raw value plus index accessor for default, item accessor plus number index for positional, dual accessors for a custom key) and must read accessors rather than capturing them.

<details>
<summary>Solution</summary>

```ts
import { renderFor, renderRepeat } from "./utils/solid2-runtime.ts";

const rows = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const byIdentity = renderFor(rows, undefined, (row, i) => `${i()}:${row.name}`);
const byPosition = renderFor(rows, { keyed: false }, (row, i) => `${i}:${row().name}`);
const byKey = renderFor(rows, { keyed: (row) => row.id }, (row, i) => `${i()}:${row().name}`);
console.log(byIdentity, byPosition, byKey); // ["0:A","1:B"] three times
console.log(renderRepeat({ count: 3 }, (i) => i * 2)); // [0, 2, 4]
```

Default mode destructures nothing and calls the index accessor; positional mode calls the item accessor with a plain-number index; the custom-key variant calls both accessors after keying rows by `id`.

</details>

### Exercise 2 — Ref factory with `applyRef` and unified `class`

Build a `tooltip` ref factory that applies a `title` from a source accessor and returns its node cleanup, compose it with a focus callback through `applyRef`, and compute the element's class with `resolveClass(["card", { active: true, hidden: false }])`. The solution must register the factory's reactive work in its owned setup scope, perform DOM writes only in the returned ref callback, and assert the composed cleanup runs without touching the real DOM.

<details>
<summary>Solution</summary>

```ts
import { createSignal, createEffect, flush, applyRef, resolveClass } from "./utils/solid2-runtime.ts";

function tooltip(source: () => string) {
  let node: { title: string } | undefined;
  createEffect(source, (title) => { if (node) node.title = title; });
  return (el: { title: string }) => { node = el; el.title = source(); };
}

const [tip, setTip] = createSignal("hello");
const teardown = applyRef(
  [tooltip(tip), (el: { title: string }) => { el.title += "!"; }],
  { title: "" },
);
flush();
setTip("updated");
flush();
console.log(resolveClass(["card", { active: true, hidden: false }])); // "card active"
teardown();
```

The factory's effect lives in setup scope while the returned callback touches the node; `applyRef` fans the composed refs out to the same element and returns one cleanup, and `resolveClass` drops the falsy `hidden` key.

</details>
