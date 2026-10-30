# React 19.3 Cheatsheet

Fast lookup for `technologies/react` (React 19.3.1, React Compiler 1.0, eslint-plugin-react-hooks 7.1.1). Each row links to the module that explains and tests it.

## Render model (M01–M02)

| Rule | Detail |
|---|---|
| Element ≠ render | `<X/>` builds `{ $$typeof, type, key, props }`; `X` runs only when React renders it |
| Identity | position + type + key; change any → remount (state lost) |
| Reset state | `<Form key={userId} />` |
| Keys | stable data IDs; never index for reorderable lists, never random |
| `key` before spread | `<p key="k" {...rest} />` (key after spread falls back to `createElement`) |
| `0 &&` | `{n > 0 && <Badge/>}` — `0` renders as text |
| Bailout for free | pass content as `children`; same element object ⇒ skipped |
| Move cost | moving the last keyed item to the front moves *n−1* DOM nodes |
| Commit order | before-mutation → mutation → `root.current` swap → layout → passive |
| `ref` | a regular prop in 19; `forwardRef` unnecessary; `element.ref` removed |

## Hooks & state (M03)

```tsx
const [v, setV] = useState(() => expensiveInit());   // lazy init
setV(prev => prev + 1);                               // compose updates
const [s, dispatch] = useReducer(reducer, init);      // dispatch is stable
const value = use(Ctx);                               // may be conditional
const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot); // cached snapshot!
<Ctx value={v}>…</Ctx>                                // 19: context is the provider
```

| Gotcha | Fix |
|---|---|
| Rendered more/fewer hooks | hooks unconditional, top level |
| `setN(n+1)` ×3 = +1 | `setN(x => x+1)` |
| mutated state not shown | new object/array |
| `getSnapshot` new object → infinite loop | return cached value |
| interval stuck | updater or `useEffectEvent` |

## Effects (M04)

| Hook | When | Use |
|---|---|---|
| `useInsertionEffect` | mutation phase | CSS-in-JS only |
| `useLayoutEffect` | after DOM mutation, before paint (blocks) | measure + fix layout |
| `useEffect` | after paint (flushed before next discrete event) | everything external |
| `useEffectEvent` (19.2) | inside effects only | read latest props without re-sync |

Order: render parent→child; each effect kind child→parent. Strict Mode (dev): setup→cleanup→setup on mount **and hydration (19.3)**. Ref callbacks may `return () => cleanup` (19). Fetch: `ignore` flag + `AbortController`. Don't use effects for derived data, events, resets (key), store subscriptions (uSES).

## Concurrency (M05)

```tsx
const [isPending, start] = useTransition();
start(async () => { await save(); startTransition(() => setDone(true)); }); // re-wrap after await
const deferred = useDeferredValue(query, /* initialValue */ "");
<Activity mode={visible ? "visible" : "hidden"}>…</Activity>             // 19.2
```

| Fact | Value |
|---|---|
| Highest priority lane | `lanes & -lanes` |
| Scheduler slice | 5 ms (`frameInterval`) |
| Blocking lanes batched | Sync + InputContinuous + Default |
| Transitions (19.3) | each lane renders alone — **untangled** (≤19.2: entangled) |
| `<Activity hidden>` | keeps state + DOM, cleans effects, offscreen priority |

## Suspense & SSR (M06)

| API | Note |
|---|---|
| `use(promise)` | promise must be cached; rejected → error boundary |
| `renderToPipeableStream` | `onShellReady` (browsers) / `onAllReady` (bots) / `onShellError` / `onError` → digest |
| `renderToReadableStream` | Web streams (edge; Node since 19.2) |
| `prerender` → `{prelude, postponed}` → `resume` | partial pre-rendering (19.2) |
| `hydrateRoot(el, app, { onRecoverableError })` | mismatch → client-render boundary |
| `suppressHydrationWarning` | one level; keeps server text |
| `useId` | `_r_…_` (19.2+); server `_R_…_` |
| `use(browser(reason))` | 19.3: skip SSR for a subtree; `onBrowserBailout` |

## Server Components (M07)

| Directive / API | Meaning |
|---|---|
| (none) | Server Component in the server graph; may be `async` |
| `"use client"` | module boundary → client references |
| `"use server"` | Server Function = public endpoint: authN, authZ, validate |
| `cache(fn)` / `cacheSignal()` | per-request memo / abort when render ends (19.2) |
| Serialisable props | primitives incl. undefined/BigInt, plain objects, Map, Set, Date, typed arrays, Promise, JSX, Server Functions — **not** functions, class instances |
| Patched floor | `react-server-dom-*` ≥ 19.0.8 / 19.1.9 / 19.2.8, or any 19.3 (CVE-2025-55182 + follow-ups) |

## Actions & forms (M08)

```tsx
const [state, formAction, isPending] = useActionState(async (prev, fd) => next, initial);
const [optimistic, addOptimistic] = useOptimistic(real, (cur, x) => [...cur, x]);
<form action={formAction}><Submit /></form>   // Submit uses useFormStatus() INSIDE the form
```

Queued actions run sequentially · success resets uncontrolled fields (`onReset` fires, 19.3) · optimistic layer lives until the Action settles · **always add request timeouts** (a hung action holds back later transitions).

## React Compiler 1.0 (M09)

```js
["babel-plugin-react-compiler", { target: "19", compilationMode: "infer", panicThreshold: "none" }]
// "use memo" (annotation mode) · "use no memo" (opt out) · target "17"/"18" + react-compiler-runtime
```

Lint: `reactHooks.configs.flat.recommended` → `refs`, `set-state-in-effect`, `static-components`, `purity`, `immutability`, `set-state-in-render`, `preserve-manual-memoization`, `incompatible-library`, `rules-of-hooks`, `exhaustive-deps`. Keep existing `useMemo`; pin the compiler exactly.

## Errors (M10)

| Caught by boundaries | Not caught |
|---|---|
| render, effects, lifecycles, ref callbacks, `use(rejected)` | event handlers, async code, SSR, the boundary itself |

Root options: `onCaughtError`, `onUncaughtError` (root unmounted), `onRecoverableError`. Reset: `key={pathname}` or `resetKey`. Forward async errors: `setState(() => { throw e })`. 19.3: errors don't escape hidden `<Activity>`.

## DOM platform (M11)

| Feature | Snippet |
|---|---|
| View transition (19.3) | `<ViewTransition enter="slide" default="none">` + `startTransition(() => { addTransitionType("forward"); … })` |
| Fragment ref (19.3) | `<Fragment ref={r}>` → `FragmentInstance` (`addEventListener`, `focus`, `observeUsing`, …) |
| Portal | `createPortal(node, el)` — events bubble through the React tree |
| Metadata | `<title>`, `<meta>`, `<link>` hoisted to `<head>` |
| Stylesheet | `<link rel="stylesheet" href precedence="default">` deduped + ordered |
| Hints | `preconnect`, `prefetchDNS`, `preload`, `preloadModule`, `preinit`, `preinitModule` |
| Trusted Types | passed through unchanged (19.3) |

## Performance, testing, upgrades (M12)

| Task | How |
|---|---|
| Measure | `<Profiler onRender>`, DevTools Profiler, Performance Tracks (19.2), production/profiling build |
| Fix order | colocate state → Compiler → stable/split context → transitions → virtualise → `lazy` → RSC |
| Test | RTL `getByRole`/`findBy*`; `await act(async …)` around suspending renders; `act` from `react` |
| 18 → 19 removed | `ReactDOM.render/hydrate/unmountComponentAtNode/findDOMNode`, string refs, legacy context, `createFactory`, fn `defaultProps` & `propTypes` (ignored), `react-dom/test-utils` (except deprecated `act`), `renderToNodeStream` |
| Versions in lockstep | `react` = `react-dom` = `react-server-dom-*`, exact pins |
