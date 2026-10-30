# 11 · Animation & DOM Platform Integration

> **Track:** `technologies/react` · **React:** 19.3.1 · **Proofs:** [`examples/11-dom-platform/dom-platform.test.tsx`](../examples/11-dom-platform/dom-platform.test.tsx), helper [`examples/11-dom-platform/fake-view-transitions.ts`](../examples/11-dom-platform/fake-view-transitions.ts)
>
> **Cross-links.** The View Transitions API itself (`document.startViewTransition`, `::view-transition-*` pseudo-elements, `view-transition-name`, `:active-view-transition-type()`), scroll-driven animations and the top layer are owned by [languages/css](../../../languages/css/README.md); React adds only the integration described here. Content Security Policy and Trusted Types as a defence are owned by [architecture/security-identity](../../../architecture/security-identity/README.md). Resource hints and HTTP caching: [architecture/networking](../../../architecture/networking/README.md).

React renders into the DOM, but the DOM platform keeps growing features that work best when the framework coordinates them: animated view transitions, group operations on sibling nodes, document metadata, resource loading and DOM-XSS defences. React 19 → 19.3 integrated each of them. This module covers `<ViewTransition>` and `addTransitionType` (stable in 19.3), Fragment refs (stable in 19.3), portals, metadata and resource hoisting (19.0), resource preloading APIs, and Trusted Types (19.3).

---

## 1. `<ViewTransition>`

### 1.1 The model

> **Definition 11.1.** `<ViewTransition>` marks a subtree whose DOM changes should be animated with the browser's View Transitions API. When a commit that came from a **Transition** (`startTransition`, a Suspense reveal, a `useDeferredValue` update) changes a `<ViewTransition>`'s content, React calls `document.startViewTransition`, assigns `view-transition-name`s to the affected elements, applies the DOM mutations inside the browser's update callback, and lets CSS (or the event props) animate between the old and new snapshots.

Three consequences are tested in jsdom with a recording stand-in for the browser API:

| Behaviour | Test |
|---|---|
| Mount and **urgent** updates never animate; only Transition updates call `startViewTransition` | "only Transition updates start a view transition…" |
| `addTransitionType("forward")` inside the transition is passed to the browser as a view-transition **type** | "addTransitionType passes the cause…" |
| React assigns an auto-generated `view-transition-name` (observed `_t_<n>_` in 19.3.1) to the element during the update | "React assigns a view-transition-name…" |
| No browser API → updates commit without animation (progressive enhancement) | "without the browser API… updates still commit" |

The "only Transitions animate" rule is the design: urgent feedback (typing, toggles) must be instant; navigation-like changes are where animation helps — and those are already transitions (Module 05).

### 1.2 Animation triggers

| Trigger | When it fires |
|---|---|
| **enter** | The `<ViewTransition>` is inserted |
| **exit** | It is removed |
| **update** | Its DOM content or layout changes |
| **share** | A **named** `<ViewTransition name="photo-42">` is removed in one place and inserted in another in the same transition (shared-element transition) |

Each trigger takes a **View Transition Class** (a CSS class name) or `"none"`, optionally per transition type:

```tsx
<ViewTransition
  enter={{ forward: "slide-from-right", back: "slide-from-left" }}
  exit={{ forward: "slide-to-left", back: "slide-to-right" }}
  default="none"
>
  <Page />
</ViewTransition>

startTransition(() => { addTransitionType("forward"); navigate(next); });
```

The classes are plain CSS on `::view-transition-old(.slide-to-left)`/`::view-transition-new(…)` pseudo-elements (CSS track). Every transition type is also set on the browser transition, so CSS can match `:active-view-transition-type(forward)`. For imperative animations, the event props `onEnter`, `onExit`, `onUpdate`, `onShare` receive the instance and can run Web Animations.

### 1.3 Suspense + ViewTransition

Wrapping a Suspense boundary gives a fallback → content cross-fade. The documented pattern animates only that update:

```tsx
<ViewTransition update="auto" default="none">
  <Suspense fallback={<Skeleton />}><Content /></Suspense>
</ViewTransition>
```

Principles from the 19.3 announcement: fallbacks appear immediately (no animation), the fallback-to-content swap animates, and children that do not suspend appear immediately. Since 19.3, images and `<style href precedence>` fonts inside a `<ViewTransition>` participate in Suspense so the swap waits for them. The test "a boundary wrapped in <ViewTransition update='auto' default='none'> still reveals normally" checks that the pattern does not change reveal semantics. Server-streamed boundaries batch their reveals since 19.2 (Module 06), which lets them animate together.

### 1.4 Constraints

- DOM only at 19.3 (React Native support in progress).
- One view transition runs at a time in a document; other view-transition libraries on the page cause React's to abort ("A ViewTransition was aborted early…").
- Names must be unique in a document at a given time; two mounted `<ViewTransition name="x">` is a bug.
- Auto-generated names and `useId` changed format to be valid `view-transition-name` idents in 19.2 (`_r_…`, Module 06 §4.4).

> **Then vs now.**
>
> | | Then | Now |
> |---|---|---|
> | ≤ 2024 | Animation libraries measuring DOM (FLIP: First-Last-Invert-Play) in layout effects; `react-transition-group` keeping exiting children mounted; manual `document.startViewTransition(() => flushSync(...))` wrappers | — |
> | 2025 canary/experimental | `unstable_ViewTransition`, `unstable_addTransitionType` | — |
> | 19.3 (2026-09) | — | Stable `<ViewTransition>`, `addTransitionType` |
>
> **Migration:** replace manual `startViewTransition(() => flushSync(update))` with `startTransition(update)` inside a `<ViewTransition>` boundary — the manual version forces synchronous rendering (no concurrent features) and races with React's own scheduling. Keep FLIP/animation libraries for effects View Transitions cannot express (physics, gestures). **Pitfall:** mixing a third-party view-transition helper with `<ViewTransition>` aborts one of them.

---

## 2. Fragment refs (`FragmentInstance`, stable in 19.3)

Before 19.3, operating on "all the elements a component renders" required a wrapper `<div>` (which breaks CSS grid/flex layouts and semantics) or the removed `findDOMNode`. Now:

```tsx
const ref = useRef<FragmentInstance>(null);
<Fragment ref={ref}>
  {items.map((i) => <Card key={i.id} item={i} />)}
</Fragment>
```

`ref.current` is a `FragmentInstance` (test "the ref is a FragmentInstance with group-level DOM methods"), whose methods apply to the fragment's **first-level host children** — even when those children are rendered by components that do not expose refs:

| Method | Semantics | Test |
|---|---|---|
| `addEventListener` / `removeEventListener` / `dispatchEvent` | Listener attached to each first-level child; also to children added later | "addEventListener attaches to every first-level child" |
| `focus()` / `focusLast()` / `blur()` | Focus the first/last focusable descendant (depth-first) | "focus() and focusLast() move focus…" |
| `observeUsing(observer)` / `unobserveUsing` | Calls `observer.observe(child)` for each child — for `IntersectionObserver`/`ResizeObserver` | "observeUsing connects an observer…" |
| `getClientRects()`, `getRootNode()`, `compareDocumentPosition()`, `scrollIntoView()` | Measurement and scrolling over the group | — (layout needs a real browser) |

Typical uses: an `<InView>` wrapper that reports visibility of whatever children it gets, focus management for a group of fields, delegated listeners without a wrapper element. 19.3 fixed a listener leak by normalising the `capture` option as the DOM spec does, so `removeEventListener` with `{capture: true}` vs `true` now matches.

---

## 3. Portals

`createPortal(children, domNode, key?)` renders children into a different DOM node while keeping them in the **same React tree position**:

- **Events bubble through the React tree**, not the DOM tree: a click inside a modal portal reaches `onClick` on the React parent that rendered the portal — test "content renders into another DOM node, but events bubble through the React tree". This surprises people when an outer "click outside to close" handler fires for clicks inside the modal.
- **Context flows** into portals (test "context flows into portals").
- The portal's DOM node must exist before rendering; portals do not create containers.

Use portals for modals, tooltips and toasts that must escape `overflow: hidden` or stacking contexts. For modal dialogs, also consider the native `<dialog>` element with `showModal()` and the **top layer** (CSS track), which solves stacking without a portal; React 19.3 added `onFullscreenChange`/`onFullscreenError` events for the related Fullscreen API. In 19.3, portal contents inside a hidden `<Activity>` are also hidden.

---

## 4. Document metadata and resources (React 19)

### 4.1 Metadata hoisting

`<title>`, `<meta>` and `<link>` rendered **anywhere** in the tree are hoisted into `document.head` on the client, and into the `<head>` of the HTML stream on the server — test "<title>, <meta>, <link> rendered anywhere are hoisted into <head>". Components can own their metadata without a side-channel library.

Rules: `<title>` should have a single string child; there is no deduplication of multiple `<title>`s or `<meta>`s — render one per page, typically in the route component; `<meta itemProp>` is not hoisted (it belongs to its microdata scope). In 19.3, a `<title>` inside an `<Activity>` that becomes hidden is no longer hoisted.

> **Then vs now.** React ≤18 rendered `<title>` where it appeared (inside `<body>`), so apps used `react-helmet`/`react-helmet-async` or framework `<Head>` components with effects (wrong on the first SSR paint unless specially integrated). React 19 hoists natively. Migration: render metadata elements directly; remove the helmet provider; keep the framework's metadata API where it adds features (merging, templates).

### 4.2 Stylesheets with `precedence`

`<link rel="stylesheet" href precedence="…">` opts a stylesheet into React's resource management:

- **deduplicated** by `href` across the whole app, however many components render it;
- **ordered** in `<head>` by precedence, in the order precedences are first encountered;
- on the client, a boundary that renders a not-yet-loaded stylesheet **suspends** until it loads (no flash of unstyled content);
- on the server, emitted in `<head>` before the content that needs it.

Test "SSR: stylesheets with precedence are deduplicated and ordered…" renders two widgets each linking `base.css` twice: one `base.css` in `<head>`, before `theme.css`. (Client-side load-suspension needs real network events, so it is not tested in jsdom.) `<style href precedence>` does the same for inline styles; `<script async src>` is deduplicated similarly.

### 4.3 Resource preloading APIs (`react-dom`)

| API | Emits / does | Use for |
|---|---|---|
| `prefetchDNS(href)` | `<link rel="dns-prefetch">` | Third-party origins you may contact |
| `preconnect(href, {crossOrigin?})` | `<link rel="preconnect">` | Origins you will contact soon |
| `preload(href, {as, type?, crossOrigin?, fetchPriority?, …})` | `<link rel="preload">` | Fonts, hero images, data needed soon |
| `preloadModule(href, opts)` | `<link rel="modulepreload">` | ESM chunks |
| `preinit(href, {as: "script" \| "style", precedence?})` | Loads **and executes/applies** the script or stylesheet | Critical scripts/styles |
| `preinitModule(href, opts)` | Loads and executes an ESM module | |

They can be called **during render** (in Server or Client Components), in effects, or in event handlers; React deduplicates and places the hints. Tests: "SSR: preload / preinit / preconnect called during render emit <head> hints" and "client: preload() inserts a single hint even when called repeatedly". 19.3 added `fetchPriority` for module resources.

---

## 5. Trusted Types (19.3)

[Trusted Types](https://w3c.github.io/trusted-types/dist/spec/) is a browser defence against DOM-based XSS: with the CSP directive `require-trusted-types-for 'script'`, DOM sinks such as `innerHTML` and `script.src` reject plain strings and accept only `TrustedHTML`/`TrustedScript`/`TrustedScriptURL` objects created by policies the page registered.

Before 19.3, React stringified values (`'' + value`) before writing them to the DOM, turning a `TrustedHTML` passed to `dangerouslySetInnerHTML` back into a string — which the browser then rejected, so apps could not enforce Trusted Types with React. Since **19.3** React passes these objects through unchanged.

```tsx
const policy = trustedTypes.createPolicy("app", { createHTML: (s) => DOMPurify.sanitize(s) });
<div dangerouslySetInnerHTML={{ __html: policy.createHTML(userHtml) }} />
```

**What jsdom cannot prove:** jsdom implements neither Trusted Types nor CSP enforcement, so this behaviour has no local test in this track; it needs a real browser (see the review file's remaining work). React's own `javascript:` URL blocking (Module 01 §3.2) remains independent of Trusted Types.

---

## 6. What jsdom cannot prove (and how to verify in a browser)

| Behaviour | Why not in jsdom | Browser check |
|---|---|---|
| Real view-transition animations, pseudo-elements, timing | No View Transitions API, no rendering | Playwright: assert `document.getAnimations()` during a transition; screenshot diffs |
| `getClientRects`, `scrollIntoView`, `IntersectionObserver` callbacks on Fragment refs | No layout | Playwright with real observers |
| Stylesheet suspension until `load` | No network loading of `<link>` | Playwright + slow network route |
| Trusted Types / CSP | Not implemented | Playwright with a CSP header |

---

## 7. Production failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Nothing animates | Update not in a transition; browser lacks the API; another VT library aborted it | `startTransition`; feature-detect; one VT system |
| "A ViewTransition was aborted early" | Concurrent view-transition libraries | Use only `<ViewTransition>` |
| Shared element jumps instead of morphing | Names differ or both instances mounted at once | Same `name`, remove + insert in one transition |
| Modal click closes the modal | Portal events bubble to the React parent's "outside click" handler | Check `event.target` containment in the portal node, or stop propagation |
| Duplicate `<title>` / stale metadata | Multiple components render `<title>` | One metadata owner per route |
| Flash of unstyled content after code-split navigation | Stylesheet not managed by React | `<link rel=stylesheet precedence>` |
| Trusted Types violations with React ≤19.2 | React stringified trusted values | Upgrade to 19.3 |
| Wrapper `<div>` breaks grid layout | Needed a ref on a group of children | Fragment ref (19.3) |

---

## 8. Executable proofs

| Claim | Test (`dom-platform.test.tsx`) |
|---|---|
| Only Transitions animate; types forwarded; auto names; graceful without API | "<ViewTransition>…" (4 tests) |
| `FragmentInstance` methods: listeners, focus, observers | "Fragment refs…" (4 tests) |
| Portals: React-tree event bubbling, context | "portals" (2 tests) |
| Metadata hoisting; stylesheet dedupe/order; resource hints; client dedupe | "document metadata and resources" (4 tests) |
| Suspense + ViewTransition pattern reveals | "Suspense + ViewTransition pattern" |

---

## 9. Interview Drill

<details><summary><strong>1. Why does <code>&lt;ViewTransition&gt;</code> only animate Transition updates?</strong></summary>

Urgent updates (typing, toggles) must reflect input immediately; animating them adds latency. Navigation-like updates are already transitions, can be interrupted and prepared in the background, so React can start a browser view transition, apply the mutations in its update callback and animate old → new snapshots.
</details>

<details><summary><strong>2. What does <code>addTransitionType</code> do?</strong></summary>

It records why a transition happened (e.g. "forward"/"back"). React passes the types to the browser view transition (matchable with `:active-view-transition-type()`) and lets `<ViewTransition>` choose per-type classes for enter/exit/update/share.
</details>

<details><summary><strong>3. What is a Fragment ref and when would you use one?</strong></summary>

Since 19.3, `<Fragment ref>` gives a `FragmentInstance` whose methods (event listeners, focus, observers, rect measurement, scroll) apply to the fragment's first-level DOM children. Use it to observe visibility, manage focus or attach listeners to a group of elements without a wrapper div and without the children exposing refs.
</details>

<details><summary><strong>4. How do events behave in portals?</strong></summary>

They bubble through the React component tree, not the DOM tree, so a parent component's handlers see events from portal content rendered elsewhere in the DOM; context also flows into portals.
</details>

<details><summary><strong>5. How does React 19 handle <code>&lt;title&gt;</code> and stylesheets rendered inside components?</strong></summary>

Metadata tags are hoisted into the document head on client and server. Stylesheets with a `precedence` prop are deduplicated by href, ordered by precedence, emitted in the head during SSR, and on the client suspend the boundary until loaded to avoid unstyled flashes.
</details>

<details><summary><strong>6. <code>preload</code> vs <code>preinit</code>?</strong></summary>

`preload` only fetches a resource early (a hint); `preinit` fetches and executes a script or applies a stylesheet. Both can be called in render and are deduplicated by React.
</details>

<details><summary><strong>7. Why couldn't React apps enforce Trusted Types before 19.3?</strong></summary>

React converted values to strings before writing them to sinks like `innerHTML`, destroying `TrustedHTML` objects, so the browser rejected them under `require-trusted-types-for`. 19.3 passes Trusted Types objects through unchanged.
</details>
