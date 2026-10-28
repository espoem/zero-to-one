# Module 03 — Components, Props and DOM Templating

> **Executable proof:** [`examples/typescript/03-components-props-and-dom.test.tsx`](../examples/typescript/03-components-props-and-dom.test.tsx). The suite renders real components with `@solidjs/testing-library@1.0.0-rc.2` in jsdom, compiles snippets with `@solidjs/compiler@2.0.0-rc.19` to inspect its output, and asserts on the dev diagnostics.
>
> **Typing** of components, props, events and refs is owned by the TypeScript track ([TS module 13](../../../languages/typescript/modules/13-solidjs-2-with-typescript.md), moving to TS M12). This module covers runtime semantics only.

A Solid component is an ordinary function that runs once and returns DOM nodes. Everything dynamic in its JSX becomes a binding in the reactive graph of [Module 01](./01-reactive-core.md). This module explains how the compiler gets there, what that means for props, and how 2.0 changed the DOM surface: attributes, classes, events, refs, directives and form inputs.

---

## 1. From JSX to DOM: what the compiler emits

Solid 2.0 ships two JSX compilers that share options: **`@solidjs/compiler`** ("Solid's native Oxc JSX compiler", Rust with native binaries plus a WASM fallback) and **`@solidjs/babel-plugin`**. `@solidjs/vite-plugin` depends on both and uses the native compiler by default. For this input:

```tsx
export function C(props) {
  return <button class={{ on: props.on }} title={props.t}>Hi {props.n}</button>;
}
```

the rc.19 compiler emits (verbatim, `generate: "dom"`, production mode):

```js
var _tmpl$ = /* @__PURE__ */ _$template(`<button>Hi `);
export function C(props) {
  var _el$ = _tmpl$();                         // clone the parsed template
  _$insert(_el$, () => { return props.n; }, null);   // text hole → insert binding
  _$effect(() => {                              // ONE grouped effect for the element
    return { e: !!props.on, t: props.t };       //   compute: read every dynamic attribute
  }, ({ e, t }, _p$) => {                       //   apply: write only what changed
    e !== _p$?.e && _el$.classList.toggle("on", e);
    t !== _p$?.t && _$setAttribute(_el$, "title", t);
  });
  return _el$;
}
```

What to take away (each item is asserted in the suite or visible in the output above):

1. **Static HTML is parsed once** (`template`) and **cloned** per instance (`cloneNode` is cheaper than `createElement` chains).
2. **Holes become bindings.** A text expression becomes `insert(parent, getter, marker)`; dynamic attributes become a render effect with the split compute/apply shape from [Module 02](./02-effects-and-lifecycle.md).
3. **Attributes of one template share a grouped effect.** The compute half returns all dynamic values; the apply half diffs against the previous object and writes only changed ones. This keeps per-row cost low in lists, and it is the reason behind the form-input pitfall in §6.
4. **The component body is plain code.** It runs once; nothing re-invokes `C`. The suite counts body executions across two updates: `bodyRuns === 1`.

Formally, a component is a function $P \to N$ from a props object to a DOM node, evaluated once inside an owner. Its *reactive content* is the set of bindings it registered; an update $\sigma_k \to \sigma_{k+1}$ re-runs exactly the bindings whose dependencies changed.

### 1.1 Component calls compile to getter props

```tsx
<Counter value={count()} label="x" onPick={pick} {...rest} />
```

compiles to:

```js
_$createComponent(Counter, _$mergeProps({
  get value() { return count(); },   // dynamic expression → getter
  label: "x",                         // static → plain value
  onPick: pick,                       // identifier → plain value
}, rest));
```

So `props.value` is a **getter**: reading it calls `count()` *at the time of the read*, inside whatever tracking scope the read happens in. That one fact explains both prop rules below.

## 2. Props: values at the call site, property reads in the child

The official cheatsheet calls this "together the most common AI-generated bug class in Solid". It is also the most common human one.

### Rule 1 — at the call site, pass the **value**

```tsx
<Counter value={count()} />  // ✅ the getter calls count() when the child reads props.value
<Counter value={count} />    // ❌ the child receives the accessor function itself
```

Proved: with `value={count}` the child observes `typeof props.value === "function"`. It might even render, because `insert` calls functions, which hides the bug until someone does arithmetic on it. If you *intend* to forward something lazily (render props, lazy slots), make it explicit: `getValue={() => count()}` and document it.

### Rule 2 — in the child, read `props.x` where you need it; never destructure

```tsx
function Good(props: { name: string }) { return <i>{props.name}</i>; }   // ✅ read in JSX → tracked
function Bad({ name }: { name: string }) { return <b>{name}</b>; }      // ❌ read once at setup
```

Destructuring evaluates every getter once, in the component body, which is untracked. Proved: after `setName("Grace")` the `<b>` still says `Ada` and the dev build emitted `STRICT_READ_UNTRACKED`. The same applies to `const n = props.count` at the top of a body. For an intentional one-time read, write `untrack(() => props.x)`, which documents the intent and silences the warning.

### 2.1 `merge` and `omit`

Because props must not be destructured, defaults and forwarding need helpers that preserve laziness:

```tsx
const p = merge({ size: "md" }, props);   // defaults; later sources win
const rest = omit(props, "label");        // everything except `label`, still lazy
```

- **`merge(...sources)`** (replaces 1.x `mergeProps`) resolves each property from the last source that defines it, lazily.
- **`omit(props, ...keys)`** (replaces 1.x `splitProps`) returns a view without the given keys. To take the keys out as well, read them from `props` directly.

**Gotcha: `undefined` is a real value.** `merge({ size: "md" }, props)` with `props.size === undefined` yields `undefined`, not `"md"` (proved: the attribute became `"none"` through `?? "none"`). In 1.x `mergeProps` skipped `undefined`. If a parent passes `size={maybe()}`, either default at the read (`p.size ?? "md"`) or make the parent omit the prop.

### 2.2 `children`

`props.children` is also a getter, so reading it twice may create the children twice. Use the `children()` helper to resolve once and memoise ([Module 04](./04-control-flow-and-composition.md)).

## 3. Attributes, classes and styles

2.0 follows HTML by default (RFC 07):

| Rule | 1.x | 2.0 |
|---|---|---|
| Built-in attribute names | camelCase allowed (`tabIndex`, `readOnly`) | **lowercase** (`tabindex`, `readonly`) |
| Attribute vs property | per-type heuristics plus `attr:` / `prop:` / `bool:` | attributes by default; stateful form props (`value`, `checked`, `selected`, `muted`, their `default*` twins) stay properties; `prop:x` forces a property |
| Booleans | `"true"` strings in places | `true` adds the attribute, `false` removes it (proved with `disabled`) |
| Class toggling | `classList={{…}}` | `class` takes a string, an object (`{ active: on() }`) or a nested array (`["card", props.class, { active: on() }]`) (proved) |
| Style | object or string | object of CSS properties, custom properties included (`"--gap"`) (proved) |
| Removed namespaces | `attr:`, `bool:`, `on:`, `oncapture:`, `use:`, `classList`, tolerated `class:` / `style:` | **compile errors** whose message names the replacement (proved for four of them) |

Do not build class strings by hand (`[a && "x"].filter(Boolean).join(" ")`). The array/object form composes and lets the compiler emit `classList.toggle` per key.

For a platform attribute that genuinely needs the string `"true"` (some custom elements), pass the string: `<some-element enabled="true" />`.

## 4. Events

### 4.1 Delegated camelCase handlers

`onClick`, `onInput` and friends are **delegated**: the compiler stores the handler on the element (`_el$._$$click = …`) and emits `delegateEvents(["click"])`. In 2.0, delegation is **owned by the render root**: `render()` / `hydrate()` install the listeners on their root container (or `ShadowRoot`) and remove them when the root is disposed. `Portal` registers its mount point as an extra container. Consequences:

- Two Solid roots on one page do not see each other's synthetic dispatch; `stopPropagation()` inside a nested root can hide the native event from outer roots.
- Events that do not bubble (or that you need in the capture phase) need a native listener.

Only `on` followed by an uppercase letter is an event handler. A lowercase `onclick={fn}` is the plain HTML attribute; passing a function to it warns `LOWERCASE_EVENT_ATTRIBUTE` in dev (proved), and the JSX types do not declare it.

### 4.2 Handlers bind once

> The handler **expression** is evaluated once at mount. `onClick={cond() ? a : b}` picks a handler and never re-evaluates.

Proved: after `setAdmin(true)`, the "bad" button still calls `b`. Put the decision inside a stable handler: `onClick={(e) => (cond() ? a : b)(e)}`. (Spreads are the exception: a spread must re-apply changed props, handlers included.)

### 4.3 Bound handler tuples

`onClick={[handler, data]}` calls `handler(data, event)`. In a long list this avoids allocating a closure per row (proved: clicking the second button calls `remove(2)`). It is a micro-optimisation; a closure is fine for most lists.

### 4.4 Native listener options

`on:` and `oncapture:` are gone. Use a ref callback that calls `addEventListener` with options:

```tsx
const on = (type, handler, options) => (el) => el.addEventListener(type, handler, options);
<div ref={on("click", log, { capture: true })} />
```

Proved: a capture listener on a parent fires before the delegated target handler.

## 5. Refs and directives

`ref` is the single composition point for element access and directives:

```tsx
let el!: HTMLDivElement;
<div ref={el} />                         // compile-time rewrite: assigns el (single ref only)
<div ref={(node) => (el = node)} />      // callback
<input ref={autofocus} />                // directive (a function of the element)
<button ref={tooltip({ content: "Save" })} />   // directive factory
<button ref={[autofocus, tooltip({ content: "Save" })]} />   // compose; arrays may nest
```

Rules (proved where noted):

- **A ref runs before the element is attached.** `el.isConnected` is `false` inside the ref and `true` in `onSettled` (proved). For a template without custom elements, `el.ownerDocument.defaultView` is `null` inside the ref (the template document is inert). Measure layout or read computed styles in `onSettled`, and use the global `window` / `document`.
- **The bare-variable form is a single-ref compile rewrite.** In an array, a variable is just a value and is never assigned (proved: `inArray` stays `undefined`). TypeScript does **not** catch this: the variable has an element type, so the array type-checks. Use a callback inside arrays.
- **No `{ current }` objects.** Refs are functions or assigned variables.

### 5.1 Two-phase directive factories

`use:` directives are gone. A directive is a function that returns a ref callback. The recommended shape splits it like an effect:

```ts
function title(source: () => string) {
  let el: HTMLElement | undefined;
  createEffect(source, (value) => { if (el) el.title = value; });   // setup (owned): primitives
  return (node: HTMLElement) => {                                    // apply (unowned): DOM writes
    el = node;
    el.title = untrack(source);
  };
}
<button ref={title(() => t())} />
```

The factory call happens in the component body (owned), so primitives created there are disposed with the component. The returned callback runs unowned when the element is created, so it must not create primitives. Proved: the title follows the signal.

## 6. Form inputs: not strictly controlled

`value={x()}` / `checked={x()}` write the DOM **property** each time the binding re-runs, without comparing to what the DOM currently holds. Typing changes the DOM directly. Two consequences:

1. **Re-asserting an equal value does nothing.** If a handler rejects a keystroke and the signal does not change, nothing re-runs, and the rejected character stays in the box. Write the filtered value to `e.currentTarget.value` yourself (proved: `12x` becomes `12`). Do not use `equals: false` to force a re-run; that triggers the next problem.
2. **Any re-run overwrites uncommitted text.** Because attributes of one template share a grouped effect (§1), a change to *any other dynamic attribute in the same template* re-runs the effect and writes `value` again. Proved: with `value={name()}` bound to a committed value and `class={{ hl: highlight() }}` on the same input, typing `Ada L` and then toggling `highlight` resets the box to `Ada`, and the dev build emits **`UNCOMMITTED_INPUT_OVERWRITTEN`**.

The fix is the **draft pattern**: keep the in-progress text in a signal written from `onInput`, and commit on `onChange`/submit. The binding then always mirrors the box, so re-runs are harmless (proved: typing survives the `highlight` change and `onChange` commits `Ada L`).

```tsx
const [draft, setDraft] = createSignal(untrack(() => props.name));
<input value={draft()} onInput={(e) => setDraft(e.currentTarget.value)} onChange={() => props.onCommit(draft())} />
```

For values that need not be reactive, go **uncontrolled**: `defaultValue={initial}` and read `new FormData(form)` on submit. Reset with `form.reset()` or by remounting under a keyed `<Show>`. A `value` passed through a spread is rewritten whenever the spread re-evaluates; forward a draft value or bind `value` directly.

## 7. Then vs now

| 1.x (≤ 1.9) | 2.0 RC | Migration |
|---|---|---|
| `import { render } from "solid-js/web"` | `import { render } from "@solidjs/web"` | rewrite imports |
| `jsxImportSource: "solid-js"` | `"@solidjs/web"`; `solid-js` no longer ships `jsx-runtime`; `JSX` type comes from `@solidjs/web` | update tsconfig |
| `mergeProps` / `splitProps` | `merge` / `omit` | `splitProps(p, ["a"])` → read `p.a` directly + `omit(p, "a")`; audit `undefined` defaults |
| `classList={{ a: x() }}` | `class={{ a: x() }}` or array form | compile error guides you |
| `tabIndex`, `readOnly` | `tabindex`, `readonly` | lowercase built-ins |
| `use:tooltip={opts}` + `JSX.Directives` augmentation | `ref={tooltip(opts)}` | turn each directive into a factory |
| `on:click`, `oncapture:click` | `onClick`; ref callback with `addEventListener` options | |
| `attr:` / `bool:` / `prop:` heuristics | attributes by default, `prop:` kept | |
| `/*@once*/` | removed | reactive JSX, `defaultValue`, or `untrack` |
| document-global delegation | root-owned delegation | check multi-root / micro-frontend pages |
| Babel only (`babel-preset-solid`) | `@solidjs/compiler` (Oxc, native) or `@solidjs/babel-plugin` | `@solidjs/vite-plugin` picks it up |

## 8. Production failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Child shows `NaN` or `function…` | passed `count` instead of `count()` | call accessors at the call site |
| Prop never updates | destructured props / top-level read (`STRICT_READ_UNTRACKED`) | read `props.x` in JSX |
| Default ignored | `undefined` overrides in `merge` | default at the read, or omit the prop |
| Click handler stuck on old branch | handler expression binds once | decide inside the handler |
| Typing erased when a class toggles | value bound to committed state; grouped effect re-ran | draft signal |
| Rejected keystroke stays visible | equal signal value does not re-run the binding | assign `e.currentTarget.value` |
| Measurement returns 0 | measured in a ref | `onSettled` |
| Directive ref never set | bare variable inside a ref array | callback in the array |
| Events lost between micro-frontends | root-owned delegation + `stopPropagation` | native listeners or one root |

---

## Interview Drill

<details><summary>1. Walk through what the Solid compiler does with a component's JSX.</summary>

It hoists static markup into a `template()` parsed once and cloned per instance, walks the clone to find dynamic nodes, and emits bindings: `insert(parent, getter, marker)` for child expressions, and one grouped render effect per template whose compute reads all dynamic attributes and whose apply writes only the changed ones. Component calls become `createComponent(Comp, props)` with getters for dynamic props. Events become delegated handler properties plus `delegateEvents([...])`.
</details>

<details><summary>2. Why are props getters, and what two rules follow?</summary>

A dynamic prop compiles to `get value() { return count(); }`, so the read happens when the child reads `props.value`, inside the child's tracking scope. Rule 1: pass values (`value={count()}`), not accessors, or the child receives a function. Rule 2: read `props.x` where it is used; destructuring reads every getter once in the untracked body, freezing it (dev warns `STRICT_READ_UNTRACKED`).
</details>

<details><summary>3. How do you give a prop a default without breaking reactivity? What changed from 1.x?</summary>

`const p = merge({ size: "md" }, props)` and read `p.size`. In 2.0 `undefined` is a real value: a parent passing `size={undefined}` overrides the default, unlike 1.x `mergeProps`, which skipped `undefined`. Default at the read or have the parent omit the prop.
</details>

<details><summary>4. `onClick={isAdmin() ? deleteAll : deleteOne}` — what's wrong?</summary>

Handler expressions bind once at mount, so the choice is frozen. Use a stable handler that decides at call time: `onClick={(e) => (isAdmin() ? deleteAll : deleteOne)(e)}`.
</details>

<details><summary>5. A user's typing disappears when a validation class toggles. Explain and fix.</summary>

The input's `value` is bound to the committed value, and all dynamic attributes of the template share one grouped effect. Toggling the class re-runs it, and it writes `value` again over the uncommitted DOM text (`UNCOMMITTED_INPUT_OVERWRITTEN`). Keep the in-progress text in a draft signal from `onInput` and commit on `onChange`/submit, or go uncontrolled with `defaultValue`.
</details>

<details><summary>6. How do 2.0 directives work, and why is a two-phase factory recommended?</summary>

A directive is a function returning a ref callback, applied with `ref={dir(opts)}` and composed with arrays. The factory runs in the owned component body, so primitives created there are disposed with the component; the returned callback runs unowned at element creation and should only touch the DOM. Splitting setup from application mirrors split effects and keeps ownership correct.
</details>

<details><summary>7. Why does `getBoundingClientRect()` return zeros in a ref, and where should it go?</summary>

Refs run before the element is inserted (`isConnected === false`; for plain templates even `ownerDocument.defaultView` is null). Layout is only meaningful once attached, so measure in `onSettled`.
</details>

<details><summary>8. What happened to `classList`, `use:`, `on:` and `attr:`?</summary>

All removed. On native elements they are compile errors whose message names the replacement: `class` object/array, `ref` directive factories, camelCase handlers or ref callbacks with `addEventListener` options, and plain attributes (with `prop:` to force a property).
</details>

<details><summary>9. Two Solid apps are embedded on one page and one stops receiving clicks after a modal opens. What 2.0 change is relevant?</summary>

Delegation is now owned by each render root's container, not the document. A nested root's `stopPropagation()` can hide the native event from outer roots, and portals mount extra listener containers for their owning root. Check which root owns the portal and where propagation is stopped.
</details>

<details><summary>10. When would you use the `[handler, data]` tuple form?</summary>

In large lists, to avoid allocating a closure per row: `onClick={[remove, item.id]}` calls `remove(item.id, event)`. It is an optimisation, not a requirement.
</details>
