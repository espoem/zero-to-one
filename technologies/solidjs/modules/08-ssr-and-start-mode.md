# Module 08 — Full Stack: SSR, Start Mode, Request Isolation and Server Functions

> **Hydration and streaming proofs:** [`examples/typescript/08-hydration-roundtrip.test.tsx`](../examples/typescript/08-hydration-roundtrip.test.tsx) compiles a fixture with the real compiler for both targets, renders it in a child `node` process (server build), hydrates it in jsdom (browser build), and inspects the streaming wire format.
>
> **Executable proof:** [`examples/typescript/08-ssr-and-server-functions.server.test.tsx`](../examples/typescript/08-ssr-and-server-functions.server.test.tsx) runs in the Vitest **server** project (`environment: "node"`), which `@solidjs/vite-plugin` resolves with server export conditions and SSR codegen, so `isServer === true` and the real `@solidjs/web` server build renders. Server functions are called through the **real client transport** wired straight into the **real `handleServerFunctionRequest`**.
>
> HTTP semantics, caching (RFC 9111), streaming transport and CDNs are owned by `architecture/networking`; `structuredClone`/serialisation limits by `languages/javascript`; Standard Schema typing by the TypeScript track (M11).

---

## 1. The 2.0 full-stack layout

In Solid 1.x, server rendering beyond the basics lived in **SolidStart** (`@solidjs/start`), a metaframework on Vinxi/Nitro. In 2.0 the HTTP exchange moved into core, and the serving layer moved into the Vite plugin:

| Concern | Solid 2.0 home |
|---|---|
| render entry points (`render`, `hydrate`, `renderToString`, `renderToStream`) | `@solidjs/web` |
| request event, response head, `httpStatus`/`httpHeader`, cookies | `@solidjs/web` (+ `@solidjs/web/storage` for request scope) |
| server functions runtime and HTTP handler | `@solidjs/web/server-functions` |
| `"use server"` compilation, dev server, build, production handler | `@solidjs/vite-plugin` (`serverFunctions`, `start`) |
| routing | `@solidjs/router@2.0.0-next.*` |
| server components (experimental) | `@solidjs/web/frames` + `serverFunctions: { components: true }` |

> **Warning — do not install `@solidjs/start` for a Solid 2 app.** As of 2026-10-28, `@solidjs/start@2.1.0` (npm `latest`) has peer dependency `solid-js ^1.9.15` and `@solidjs/router >=0.16.0 <2.0.0-0`, and depends on `vite-plugin-solid` 2.x. It is the **Solid 1.9** metaframework. Installing it next to `solid-js@2.0.0-rc.19` puts two copies of Solid in the graph ("Multiple Solid instances", dead reactivity). For Solid 2, use **start mode of `@solidjs/vite-plugin`**, which its README describes as "the serving layer that replaces SolidStart".

Versions verified on npm 2026-10-28: `@solidjs/vite-plugin@3.0.0-next.52` (peers: `vite ^8 || ^9`, `solid-js ^2.0.0-rc.19`, `@solidjs/web ^2.0.0-rc.19`; Node ≥ 22.12), `@solidjs/router@2.0.0-next.43` (peers `solid-js ^2.0.0-rc.19`); `@solidjs/router@1.0.0` is the Solid 1 router. `@solidjs/vite-plugin` is the renamed `vite-plugin-solid` (migrate by swapping the dependency and the import).

## 2. Start mode

```ts
// vite.config.ts
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [solid({ start: true, ssr: true })],   // SSR start mode
});
```

```tsx
// src/App.tsx — the whole app
export default function App() {
  return <h1>Hello SSR</h1>;
}
```

The plugin owns entries, dev serving and the build: no entry files, no `index.html`, no dev-server script. `ssr` picks the rendering mode for the same conventions: `ssr: true` streams SSR; omitted, the app is client-rendered onto a prerendered static shell. Flipping a project between SPA and SSR is that one boolean.

| Phase | What start mode does (from the plugin README) |
|---|---|
| `vite` (dev) | middleware streams the app for HTML GET requests through the SSR environment, injects the Vite client; SSR errors show Vite's overlay; Chrome Performance panel tracks enabled |
| `vite build` | client assets + manifest to `dist/client`, server bundle to `dist/server/server.js` (client built first, because the server reads the manifest) |
| production | `dist/server/server.js` exports `handleRequest(request) → Response` and a default `{ fetch(request) }` (Workers, Deno, Bun, Netlify, Nitro); `start: { node: true }` also emits `dist/server/node.js` (`node dist/server/node.js`, `PORT`/`HOST`) |
| `vite preview` | runs the production artifact |

Options worth knowing: `middleware` (a module default-exporting `(event, next) => Response`, run for pages *and* server functions, inside the request scope; set `event.nonce` for CSP and `event.renderMode` (`"stream"` / `"async"`) before `next()`), `setup` (per-request app setup, e.g. creating a router bound to the request), `app`, `document`, `clientSetup`, `productionErrorBoundary`, `externalServer`. The `server-only` / `client-only` marker imports turn "server code shipped to the browser" into a build error at the import edge.

## 3. Server rendering

### 3.1 Entry points

| Function | Where | Behaviour |
|---|---|---|
| `renderToString(fn)` | server | synchronous; async boundaries render their fallbacks (proved: escaped, attribute-correct HTML) |
| `renderToStream(fn, opts)` | server | shell first, then each `<Loading>` streams its resolved fragment plus a swap script; `.pipe()`, `.pipeTo()`, `.readable`; **awaiting it yields the fully settled HTML** (replaces the removed `renderToStringAsync`) |
| `hydrate(fn, el)` | client | claims server DOM once at t = 0; needs `generateHydrationScript()` / `<HydrationScript />` before the app markup |
| `render(fn, el)` | client | mounts fresh, returns `dispose` |

Proved: the first streamed chunk contains the `<Loading>` fallback, later chunks contain the resolved content; `await renderToStream(...)` contains `<b>settled</b>`. Text is escaped (`<img …>` becomes `&lt;img …>`).

The compiler emits different code per target. For the same component, `generate: "ssr"` produces string templates with `escape()` holes and hydration keys instead of DOM templates (see [Module 03](./03-components-props-and-dom.md) for the DOM output):

```js
var _tmpl$ = ["<p", ' class="x"><!--$-->', "<!--/--> and <!--$-->", "<!--/--></p>"];
export const C = (p) => _$ssr(_tmpl$, _$ssrHydrationKey(), _$scope(() => _$escape(p.a)), _$scope(() => _$escape(p.b)));
```

### 3.1.1 Hydration, mechanically

Hydratable compilation produces matching code on both sides. Server output for the fixture `<main><button onClick=…>count {n()}</button><p>{props.label}</p></main>` (rendered, verbatim):

```html
<main _hk=0><button>count <!--$-->1<!--/--></button><p>server</p></main>
```

- `_hk` is the **hydration key**: a path-like id derived from the owner tree position (component and child order), the same scheme `createUniqueId` uses. The client computes the same keys while it re-runs the component code.
- `<!--$-->…<!--/-->` brackets a **dynamic hole** whose content may have any length.
- Text and attributes that are static are plain HTML.

Client output for the same source (`generate: "dom", hydratable: true`, verbatim excerpt):

```js
var _el$ = _$getNextElement(_tmpl$);                  // CLAIM the existing <main> by key instead of cloning
var _el$2 = _el$.firstChild;                          // walk the server DOM like a fresh clone
var [_el$5, _el$6] = _$getNextMarker(_el$4.nextSibling); // find the <!--$--> … <!--/--> hole
_el$2._$$click = () => setN(n() + 1);                 // attach delegated handler
_$insert(_el$2, _$scope(() => n()), _el$5, _el$6);    // bind the hole between the markers
_$runHydrationEvents();                               // replay clicks captured before hydration
```

Hydration therefore **re-runs every component once** on the client (setup is needed to create signals and bindings) but **creates no DOM**: elements are claimed by key and bindings attach to existing nodes. Proved in the round-trip test: the `<button>` is the same node object before and after `hydrate()`, and a click afterwards increments it.

The inline bootstrap from `generateHydrationScript()` / `<HydrationScript />` defines `window._$HY` and installs document listeners for the delegated events that **queue user events that happen before the client code arrives**; `runHydrationEvents()` replays them once handlers exist, so an early click is not lost.

**Mismatch is not repaired.** Hydration trusts the server HTML. Proved:

| Situation | Result in rc.19 |
|---|---|
| client props/state differ from the server's (`start: 5, label: "client"` vs server `1, "server"`) | the DOM keeps the **server** text, no diagnostic is emitted; the next update of a binding writes the client value (the count jumps from `1` to `6`) |
| HTML structure does not match the client tree | nothing is claimed and nothing renders (the foreign HTML stays) |

So the inputs to the first client render must equal the server's: serialize them (async memos default to `ssrSource: "server"`, which adopts the server value), never branch on `typeof window` / `isServer` in what you render, and use `createUniqueId` instead of random ids. For values that are legitimately client-only, render a placeholder that matches the server and switch in `onSettled`, or use `ssrSource: "client"` / `clientOnly`.

### 3.1.2 Streaming, on the wire

Verbatim (abridged) chunks from `renderToStream` for a page with one slow `<Loading>`, from the round-trip suite:

```html
<!-- chunk 0: the shell, flushed immediately -->
<main _hk=1><h1>shell</h1><!--$--><template id="pl-2"></template><i _hk=20>wait</i><!--pl-2--><!--/--></main>
<script>(self.$R=self.$R||{})[""]=[];
  _$HY.r["0"]=$R[0]=…pending promise…;          // hydration record for the async memo (id "0")
  _$HY.r["2_fr"]=…pending promise…;             // the boundary's fragment resolver
</script>

<!-- chunk 1: when the data lands -->
<template id="2"><b _hk=2000>42</b></template>
<script>…resolve($R[1], $R[5]={n:42});         // fulfil the memo's promise with the serialized value
  $df("2");                                      // swap: replace the placeholder + fallback with template #2
</script>
```

The mechanics: the fallback is rendered behind a placeholder `<template id="pl-N">`; the async memo's value is written as a **seroval** record (a pending promise in the shell, resolved in a later script with the serialized data); the resolved HTML arrives inside `<template id="N">` and `$df(N)` moves it into place. On hydration, the client's memo **adopts** the record instead of fetching again (`ssrSource: "server"`), so the hydrated value equals what was rendered. Proved structurally by the streaming test (placeholder + fallback + pending record in the shell; template, `{n:42}` and `$df(` later).

```mermaid
sequenceDiagram
  participant S as server render
  participant N as network
  participant B as browser
  S->>N: shell: layout + placeholder + fallback + pending records
  N->>B: parse & paint shell (fallback visible), client JS starts loading
  S->>N: fragment template + data script (when the boundary resolves)
  N->>B: $df swaps fragment in#59; record resolved
  B->>B: hydrate(): claim nodes by _hk, adopt serialized values, replay queued events
```

Because the head is committed with the shell, status codes and headers must be decided before it ([§3.3](#33-status-and-headers-from-the-tree)). A source marked `deferStream: true` keeps the shell from flushing until it resolves.

### 3.2 Hydration policy per computation

Async values computed on the server are **serialized** (with seroval) into the HTML and adopted by the client, so the client does not refetch on load. The policy is per primitive ([Module 06](./06-colorless-async.md)):

- `ssrSource: "server"` (default): the serialized value is authoritative; the client runs the compute once only to record dependencies (a "tracking run" with fake `fetch`/`Promise` so nothing is sent).
- `ssrSource: "hybrid"`: like server, but an AsyncIterable continues streaming on the client.
- `ssrSource: "client"`: never runs on the server; renders the `<Loading>` fallback or a declared `loadingValue`.
- `deferStream: true`: hold the shell flush until this source resolves, for data that decides status codes, headers or `<head>` tags.
- `transparent: true`: for client-only nodes created during hydration, so hydration ids stay aligned.

Two traps from RFC 05's "tracking run" section: a non-fake `await` before the request in a hydrated compute sends a **duplicate request** after hydration; and a cache that stores promises created during the tracking run stores **never-settling** promises. Start requests synchronously, and do not populate caches while `isHydrating()`.

`clientOnly(() => import("./Chart"))` (from `@solidjs/web`, formerly SolidStart) renders `props.fallback` on the server, never imports the module there, hydrates the fallback mismatch-free and swaps after settle. Use it for browser-only libraries.

### 3.3 Status and headers from the tree

```tsx
function NotFound() {
  httpStatus(404);
  httpHeader("cache-control", "no-store");
  return <h1>Not found</h1>;
}
```

`httpStatus` / `httpHeader` are **scope-tied declarations**: they write the response head while the calling scope is alive and are retracted when it is disposed (an error boundary that recovers retracts its 500). They are **shell-time APIs**: once the shell has flushed, the head is on the wire and later writes are no-ops (dev: `LATE_HEADER_WRITE`). If streamed content decides the status, mark its source `deferStream: true`. On the client both are no-ops.

### 3.4 Error sanitization

The production server build replaces plain thrown errors with a generic `Error("Internal Server Error")` on every wire (SSR-serialized boundary errors, streamed rejections, server-function responses), so database messages and connection strings never reach the client. The **development** build keeps full fidelity. `markSafeError(err)` brands an error whose message is meant for the user; it passes intact everywhere (proved through the server-function wire). The dev/prod line is the *build variant* (export condition), not `NODE_ENV`.

## 4. Request isolation: the leak you only see in production

> **Module scope is shared by every request in the process.**

On the client, a module-level store is "global state". On the server it is **shared between users**. Proved in the suite: two concurrent renders write a module-level `currentUser`, then await data; the slower render (Alice's) is served **"hello bob"**. Nothing crashes; one user sees another's data.

The fix is to keep per-request state in the request scope:

- create stores and signals **inside components/providers**, not at module scope (a provider runs once per request on the server);
- read per-request inputs from the **request event** (`getRequestEvent()`), established by `provideRequestEvent(event, fn)` from `@solidjs/web/storage` (AsyncLocalStorage-backed). Start mode does this for every request; the suite does it by hand and proves Alice gets "hello alice";
- read the request event **before** the first `await` in an async computation (same rule as tracking, [Module 06](./06-colorless-async.md)).

```mermaid
flowchart LR
  subgraph Process["one Node process"]
    M["module scope: currentUser (shared!)"]
    subgraph RA["request A scope"]
      EA["event.locals.user = alice"]
    end
    subgraph RB["request B scope"]
      EB["event.locals.user = bob"]
    end
  end
  RA -. "write" .-> M
  RB -. "write" .-> M
  M -. "read after await → wrong user" .-> RA
```

Signal/store setters that run during a server render are inert and warn `SERVER_WRITE` (they will throw in a future release): server rendering is a one-shot projection of state, not an interactive graph.

## 4.1 The request event and the response head

```mermaid
flowchart LR
  Req["Request"] --> H["handleRequest(request, { event, nonce, renderMode })"]
  H --> E["createRequestEvent: { request, locals, response: ResponseStub }"]
  E --> P["provideRequestEvent(event, …) — AsyncLocalStorage scope"]
  P --> MW["middleware chain (event, next)"]
  MW -->|"next()"| R["page render (renderToStream) or server-function dispatch"]
  R -->|"httpStatus / httpHeader / Set-Cookie write the stub"| ST["ResponseStub (status, headers)"]
  ST -->|"shell flush → committed"| Res["Response head on the wire"]
  R --> Body["streamed body"]
```

- `event.locals` is the per-request bag middleware fills (user, tenant, DB handle). Type it by **module-augmenting** `RequestEventLocals` from `@solidjs/web` in a file that is a module (has an import/export); a script-style `declare module` replaces the package types instead of augmenting them.
- Direct (in-process, SSR-time) server-function calls run under a derived event whose `locals` is a **shallow copy**: reads see what middleware set; top-level assignments inside the call do not leak back into the render.
- `event.response` is the response head **as it forms**. Writes after it is `committed` fail loudly (headers) or are dropped with `LATE_HEADER_WRITE` (status via `httpStatus`).
- Errors that escape the chain in production are contained (bodyless 500) and reported once to `configureServerErrors({ onError })`, or `console.error` if no hook is configured; in dev they reject so Vite's overlay shows them.

### 4.2 Cookies and sessions

Core ships the **codec** and the exchange, not a session system (RFC 12):

```ts
import { getRequestEvent, parseCookieHeader, serializeCookie } from "@solidjs/web";
const event = getRequestEvent()!;
const { theme } = parseCookieHeader(event.request.headers.get("cookie"));
event.response.headers.append("set-cookie",
  serializeCookie("session", token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 604800 }));
```

Proved: values are percent-encoded and round-trip any string (`"a b;c=d"`); attributes are emitted exactly when given; `Path=/` is the only default; deleting is expiring (`maxAge: 0`). Reads see only what the client sent: a `Set-Cookie` appended in this request does not read back. Multiple `Set-Cookie` headers are never folded into one.

Sessions are deliberately app-layer. RFC 12's recipe composes a signed-cookie library (`@remix-run/cookie`, WebCrypto-based, secret rotation) with `getRequestEvent()`: read and verify the cookie in middleware or a server function, put the user on `event.locals`, re-issue the cookie on change, and enforce expiry server-side, not only via `Max-Age`. The login flow "set the session cookie, then `throw redirect('/')`" works because the server-function handler folds the stub's cookies onto whatever response leaves, redirects included.

## 5. Server functions

### 5.1 Compilation

```ts
export async function addTodo(title: string) {
  "use server";
  await db.insert(title);
}
```

With `serverFunctions` (or start mode) enabled, the compiler extracts the body to the server build, registers it, and replaces it on the client with a fetch-backed reference. Everything referenced only inside the body (database handles, schemas) is dead-code-eliminated from the client: **the directive boundary is the privacy mechanism**. Function-level directives register the raw function (wrappers around them like `GET(...)` affect only the client transport); module-level `"use server"` registers each export's *evaluated value*, so server-side wrappers (auth, validation) apply to every call path.

### 5.2 The runtime and the wire

```ts
import { handleServerFunctionRequest } from "@solidjs/web/server-functions/server";
if (url.pathname.startsWith("/_server")) return handleServerFunctionRequest(request);
```

Start mode mounts this for you. Properties proved in the suite (calls go through the real client transport, with `configureServerFunctionsClient({ fetch })` routing them into the real handler):

| Property | Evidence |
|---|---|
| default endpoint `/_server`, call data address `/_server/data/<id>` | the request event's pathname starts with `/_server` |
| calls run inside a request-event scope (`provideEvent`) | `getRequestEvent()` works in the function |
| **results** are encoded with seroval: `Date`, `Map`, … survive | yes |
| **arguments** are plain JSON by default; rich arguments need `enableRichArguments()` from `@solidjs/web/server-functions/rich-args` | a `Date` argument is refused with that message |
| POST dispatches; GET/HEAD only for functions declared with `GET(fn)` | GET to an undeclared function → 405 |
| same-origin by default (`Sec-Fetch-Site`/`Origin`/`Referer`); cross-origin only via `csrf.origin` allowlist | cross-site call → 403 and the body never ran |
| thrown `redirect()`/`reload()`/`respond()` are control flow forwarded as metadata | `/login` appears in the response headers |
| plain thrown errors sanitized in prod; `markSafeError` passes | the safe message reached the client |
| every response `Cache-Control: no-store` unless the function sets a policy | observed headers |

`GET(fn)` makes a read cacheable over HTTP GET with codec-encoded query arguments; `withMeta(fn, meta)` writes the metadata channel `prepareRequest` reads. `live(fn)` / `broadcast(fn)` stream standing answers. Single-flight lets a mutation response carry the refreshed data its route needs, saving a round trip.

### 5.3 Validation at the boundary

Arguments arrive from the network: they are **untrusted** whatever their TypeScript type says. Validate in the function. Core deliberately ships no validator: RFC 10's decision record specifies the intended shape (a non-throwing `validate(schema, value)` over **Standard Schema**, the `~standard` interface implemented by Zod, Valibot and ArkType, returning plain serializable `{ ok, value | error }`), but leaves the helper to a standalone package. The suite uses a minimal hand-written Standard Schema object and returns issues as data. Choose per call site whether to return the failure (form state) or throw `respond(error, { status: 400 })`.

### 5.4 Server components (experimental)

A server component is *a function returned from a server function*; there is no `"use client"`. Enable with `serverFunctions: { components: true }`; the client consumes it through `dynamicComponent`/`dynamic`. Content travels as HTML, values as data records, nothing as both ("single-copy"). Treat it as an RC-era experiment; it is out of scope for exercises here.

## 6. Routing

`@solidjs/router@2.0.0-next.43` is the Solid 2 router (peers on `solid-js ^2.0.0-rc.19`), with file-system routing via `@solidjs/router/fs` and a `setup`-hook integration in start mode. Its API is still moving between `next` releases and is not covered by this track's tests; check its README for the pinned version before teaching it (listed under remaining work).

### 6.1 Failure modes proved by negative tests

| Failure | Test |
|---|---|
| module-scope state shared across requests | "module-scope state leaks between concurrent requests" (server suite) |
| hydration data mismatch | "a data mismatch is not repaired…" (round-trip suite) |
| foreign HTML at the hydration root | "structurally foreign HTML is not claimed…" |
| cross-site server-function call | CSRF 403, function body never ran |
| wrong HTTP method | 405 |
| non-JSON arguments | refused with the `enableRichArguments()` hint |

## 7. Then vs now

| 1.x / SolidStart 1 | 2.0 RC | Migration |
|---|---|---|
| `@solidjs/start` (Vinxi/Nitro), `app.config.ts` | `@solidjs/vite-plugin` `start: true` | do **not** upgrade `@solidjs/start` to 2.x for Solid 2; switch to start mode |
| `vite-plugin-solid` | `@solidjs/vite-plugin` (renamed) | swap dependency and import |
| `renderToStringAsync` | `await renderToStream(...)` | |
| `"use server"` via SolidStart / Vinxi | core runtime + plugin compilation | `handleServerFunctionRequest` for custom servers |
| `getRequestEvent` from `solid-js/web` | `@solidjs/web`; scope via `@solidjs/web/storage` | |
| `<HttpStatusCode>`, `<HttpHeader>` components (Start) | `httpStatus()` / `httpHeader()` functions | shell-time only |
| `createResource({ ssrLoadFrom, deferStream })` | `ssrSource`, `deferStream` on any computation | |
| `clientOnly` from `@solidjs/start` | `clientOnly` from `@solidjs/web` | |
| `@solidjs/router` 0.x/1.x `cache`, `createAsync` | router 2.0-next on core async | follow router migration notes |

### 7.1 Then vs now: hydration and streaming details

| | 1.x | 2.0 RC (observed in this track's tests) |
|---|---|---|
| Hydration key attribute | `data-hk` | `_hk` |
| Async value transfer | resources serialized for hydration (seroval since 1.8) | every async computation serialized as a seroval record (`_$HY.r[id]`), adopted by default (`ssrSource: "server"`) |
| Streaming swap | `<template>` + script per `<Suspense>` resolution | `<template id="pl-N">` placeholder, `<template id="N">` content, `$df(N)` swap |
| Early events | delegated events captured by the hydration script and replayed | same idea: `_$HY` queues delegated events, `runHydrationEvents()` replays |
| Duplicate fetch on hydrate | refetch unless `ssrLoadFrom: "initial"` | none by default; beware the tracking-run duplicates in §3.2 |
| Client-only branches | `isServer` checks, `<NoHydration>`, `clientOnly` (Start) | `ssrSource: "client"`, `clientOnly` (core), `NoHydration`/`Hydration` still exported |

**Pitfall when mixing:** an SSR document produced by one version and hydrated by another (stale CDN HTML after a deploy) has different keys and markers; the client claims nothing. Version HTML and client bundles together and purge the HTML cache on deploy.

## 8. Production failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Users see each other's data | module-scope state on the server | providers / request event |
| "Multiple Solid instances", nothing updates | `@solidjs/start@2` (Solid 1.9) installed beside Solid 2 | remove it; use start mode; dedupe `solid-js` |
| Duplicate API calls after hydration | non-fake `await` before the request in a hydrated compute | start the request synchronously |
| A cache hangs forever after navigation | promise created during the hydration tracking run stored | don't populate caches while `isHydrating()` |
| 404 page returns 200 | `httpStatus` called after the shell flushed | `deferStream` on the deciding source |
| DB error text in the browser in dev only | expected: dev keeps fidelity | prod sanitizes; use `markSafeError` for user messages |
| Server function 403 from another site | CSRF default | `csrf.origin` allowlist (never `csrf: false` unless another layer protects it) |
| `Date` argument rejected | arguments are JSON by default | `enableRichArguments()` once at startup |

---

## Interview Drill

<details><summary>1. Where did SolidStart go in Solid 2.0?</summary>

The exchange (render entry points, request event, response head, server-function runtime) moved into `@solidjs/web`, and serving/building moved into `@solidjs/vite-plugin`'s start mode (`solid({ start: true, ssr: true })`). `@solidjs/start@2.x` on npm still targets Solid 1.9 and must not be mixed with Solid 2.
</details>

<details><summary>2. Why is module-scope state dangerous with SSR, and what's the fix?</summary>

The server process handles many requests concurrently and module scope is shared, so writes from one request are visible to another; after an `await`, a render can read another user's value. Create state inside providers (once per request) and read request-specific inputs from `getRequestEvent()`, which `provideRequestEvent` scopes per request.
</details>

<details><summary>3. `renderToString` vs `renderToStream`?</summary>

`renderToString` is synchronous and renders fallbacks for pending boundaries. `renderToStream` flushes the shell immediately and streams each boundary's resolved HTML with a swap script; awaiting it yields the settled HTML. `deferStream` on a source holds the shell until it resolves.
</details>

<details><summary>4. Why must status codes be decided in the shell?</summary>

Once the shell flushes, the HTTP head is on the wire. `httpStatus`/`httpHeader` after that are no-ops (`LATE_HEADER_WRITE` in dev). Content below a `<Loading>` that resolves later cannot change them; use `deferStream` on the deciding source.
</details>

<details><summary>5. How does `"use server"` keep secrets off the client?</summary>

The compiler extracts the body to the server build and replaces it with a reference; dead-code elimination then removes imports only the body used. The directive boundary is the privacy boundary. Module-level directives register the export's evaluated value, so server-side wrappers apply to all call paths.
</details>

<details><summary>6. What does the server-function handler protect against by default?</summary>

Cross-site requests (same-origin check via `Sec-Fetch-Site`/`Origin`/`Referer`, 403 otherwise, allowlist via `csrf.origin`), non-POST methods for non-GET functions (405), leaking error details (prod sanitization; `markSafeError` to opt in), accidental caching (`no-store` unless set), and non-JSON arguments unless rich arguments are enabled.
</details>

<details><summary>7. How do you validate server-function input?</summary>

Treat arguments as `unknown` and validate with a Standard Schema validator (Zod, Valibot, ArkType) inside the function; return issues as data for forms, or throw `respond(error, { status: 400 })`. Core intentionally ships no validator.
</details>

<details><summary>9. What happens if the client's first render does not match the server HTML?</summary>

Hydration trusts the server DOM: with different data, the server's text stays (no diagnostic in rc.19) until a binding next updates; with a different structure, nothing is claimed. Make the first client render's inputs identical (serialized values, `createUniqueId`, no `isServer` branching in output) and switch to client-only values in `onSettled`.
</details>

<details><summary>10. Walk through what the browser receives for a page with one slow `<Loading>`.</summary>

A shell with layout, a placeholder `<template id="pl-N">` plus the fallback, and seroval records for pending async values; later a `<template id="N">` with the resolved HTML plus a script that resolves the record with the serialized data and calls `$df(N)` to swap it in. Hydration then adopts the serialized values instead of refetching.
</details>

<details><summary>8. What problem does `ssrSource: "client"` solve, and what does the server render?</summary>

For client-only computations (localStorage, measurements) where a serialized server value is meaningless. The server never runs it; it renders the nearest `<Loading>` fallback (and the client renders after hydration), or a declared `loadingValue`.
</details>
