# Module 06 — Full-Stack Start Mode and Server Functions

Modern full-stack web applications demand a unified mental model across the network boundary: server rendering that streams without blocking, type-safe RPC without boilerplate REST endpoints, atomic mutations with automatic cache invalidation, and progressive enhancement that works seamlessly before client JavaScript hydrates. In SolidJS 2.x, server functions and full-stack runtime capabilities are core framework features rather than third-party add-ons. Integrated directly via `@solidjs/vite-plugin` and `@solidjs/web/server-functions`, Solid 2.0 provides an isomorphic execution substrate. A single directive (`"use server"`) marks code that executes exclusively on the server, while the Solid compiler strips server implementations from client bundles and replaces them with lightweight, type-safe RPC references. This module explores Vite Start mode, streaming SSR with `renderToStream`, server function directives and security trust boundaries, request-scoped context via `getRequestEvent`, Standard Schema runtime validation, single-flight mutation revalidation (`X-Single-Flight`), progressive enhancement with encrypted flash cookies, rich argument graph serialization, and the experimental Server Components architecture (`@solidjs/web/frames`).

## 1. Vite plugin start mode, routing, and streaming SSR

Full-stack Solid applications are orchestrated by `@solidjs/vite-plugin`. When configured in start mode, the compiler coordinates dual-target compilation (generating coordinated client and server bundles), file-system routing, and server function extraction:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [
    solid({
      start: true,
      ssr: true,
      serverFunctions: { components: true },
    }),
  ],
});
```

### File-system routing and runtime lifecycle

Start mode adopts file-system routing conventions rooted in `src/routes/`. Each file exports a default Solid component representing a route segment (such as `src/routes/index.tsx` or `src/routes/users/[id].tsx`). Under the hood, the application lifecycle flows through two foundational entries: `src/entry-client.tsx` and `src/entry-server.tsx`.

In `entry-client.tsx`, the client runtime mounts or hydrates the document using `hydrate(() => <StartClient />, document.getElementById("app")!)`. In `entry-server.tsx`, incoming HTTP requests pass through middleware into a request handler using `renderToStream`.

### Streaming SSR and client-only boundaries

Solid 2.0 renders HTML directly to a readable stream via `renderToStream(() => <App />)`. Instead of waiting for all database queries and async derivations to finish before sending the first byte (traditional SSR), `renderToStream` flushes the document shell and synchronous HTML immediately. When an async memo under `<Loading>` suspends, the server renders the fallback into the initial stream and holds a placeholder slot. As async computations resolve in the background, replacement HTML chunks and serialized data are streamed down the wire to replace the fallback in place.

Certain DOM constructs have no meaning on the server. For example, `<Portal>` in `@solidjs/web` renders children into a target DOM node (such as `document.body` for modals and tooltips). During server-side streaming, `<Portal>` is explicitly client-only: it renders nothing into the SSR stream and automatically mounts into the client DOM upon hydration. Bare client-only computations outside server boundaries will cause render errors; wrap browser-only interactive nodes in client checks or suspenseful loading boundaries.

## 2. Server functions (`"use server"`) and the trust boundary

Server functions provide end-to-end type safety between client and server without manual endpoint routing. By placing `"use server"` at the top of a function or module, the function is registered for HTTP dispatch:

```ts
import { respond } from "@solidjs/web";

// Function-level "use server"
export async function getUser(id: string) {
  "use server";
  if (typeof id !== "string") {
    throw respond({ error: "Invalid user identifier" }, { status: 400 });
  }
  return db.users.findById(id);
}
```

### Function-level versus module-level directives

Understanding where the directive lives is vital for code security and bundling:

Function-level `"use server"` registers the specific inner function for HTTP dispatch. The compiler transforms the function on the client into an RPC stub, while preserving the server implementation in the server bundle. Critical boundary enforcement, such as input validation and authentication checks, must live *inside* that inner function body. An outer client wrapper around the reference only affects client-side callers and provides zero protection against malicious HTTP clients POSTing directly to the server endpoint.

Module-level `"use server"` places the directive at the very top of a file. The compiler registers the **evaluated value** of every exported function in the file. Higher-order function wrappers, schemas, database pools, and private server dependencies exported or used within the module remain strictly server-side. The client bundle receives bare function references with all server code stripped.

### Method decoration and metadata: `GET` and `withMeta`

By default, server functions accept `POST` requests to guarantee that mutations are not cached by intermediate proxies and that complex JSON payloads can be delivered safely in the request body. For idempotent read operations that benefit from HTTP caching and CDN distribution, decorate the function with `GET`:

```ts
import { GET, withMeta } from "@solidjs/web/server-functions";

export const getArticle = withMeta(
  GET(async (slug: string) => {
    "use server";
    return db.articles.findBySlug(slug);
  }),
  { cacheControl: "public, max-age=300", requiresAuth: false }
);
```

`GET(fn)` permits HTTP `GET` requests while continuing to accept `POST`. When invoked on the client, GET-decorated functions serialize arguments into URL search parameters (`?args=...`). If the serialized argument URL exceeds browser URL length limits, the client transport automatically falls back to `POST`.

`withMeta(fn, metadata)` shallow-merges arbitrary metadata onto the server function reference. This metadata is inspectable on both client and server via `getServerFunctionMetadata(fn)`. Server middleware uses metadata for role-based access control, audit logging, and custom cache-control headers. You can compose `withMeta` and `GET` in any order. The registered references expose build-stable `id` and `url` properties (`/_server/data/:id`), which can be passed directly to `<form action={fn.url}>` or inspected with `isServerFunction(fn)`.

> [!NOTE]
> Production builds sanitize unhandled thrown errors to `new Error("Internal Server Error")`, stripping private database connection strings, SQL fragments, and stack traces. To send intentional error messages to the client, either throw or return a `respond({ error: message }, { status })` envelope, or wrap the error in `markSafeError(new Error("User-facing error"))`. `isSafeError(error)` checks whether an error was explicitly approved for client exposure.

## 3. Invocation options, request scope, and locals augmentation

Calling a server function from client code uses either direct execution or the `invoke` helper from `@solidjs/web/server-functions`:

```ts
import { invoke } from "@solidjs/web/server-functions";
import { getUser } from "./api/users";

// invoke signature: invoke(fn, options, ...args)
const user = await invoke(
  getUser,
  { signal: abortController.signal, priority: "high" },
  "user-123"
);
```

The options argument in `invoke(fn, options, ...args)` is mandatory; pass `{}` when no options are needed. It accepts `signal` (for cooperative `AbortController` cancellation), `keepalive` (for beacons and background flushes on page unload), and `priority` (`"high" | "low" | "auto"`). If the abort signal fires during an in-flight network call, `invoke` aborts the underlying HTTP fetch and immediately rejects the caller with the abort reason.

### Request scoping: `getRequestEvent` and `provideRequestEvent`

On the server, HTTP requests execute inside an isolated asynchronous context backed by Node's `AsyncLocalStorage`. Calling `getRequestEvent()` from `@solidjs/web` returns the active `RequestEvent`, containing the web-standard `request` object and the mutable `locals` dictionary:

```ts
import { getRequestEvent, respond } from "@solidjs/web";

export async function deletePost(postId: string) {
  "use server";
  const { request, locals } = getRequestEvent();
  if (!locals.user || locals.user.role !== "admin") {
    throw respond({ error: "Unauthorized" }, { status: 403 });
  }
  await db.posts.delete(postId);
  return { success: true };
}
```

In custom server adapters or unit testing environments, use `provideRequestEvent({ request, locals }, () => fn())` to establish request context around server function dispatch.

### Augmenting `RequestEventLocals`

To provide strict type safety across server middleware and server functions, augment the `RequestEventLocals` interface in an ambient declaration module:

```ts
// src/types/server.d.ts
export {};

declare module "@solidjs/web" {
  interface RequestEventLocals {
    user?: {
      id: string;
      email: string;
      role: "admin" | "editor" | "viewer";
    };
    requestId: string;
    sessionToken?: string;
  }
}
```

Because TypeScript declaration merging requires the target file to be treated as a module, always ensure the file contains at least one import or an explicit `export {}`. Once declared, `event.locals.user` is strictly typed throughout all server functions.

## 4. Standard Schema-compatible boundary validation

A critical vulnerability in full-stack TypeScript architectures is relying on compile-time types at runtime boundaries. TypeScript annotations are completely erased during compilation; a malicious user or automated scanner can send arbitrary JSON payloads directly to your server function URL. Every server function accepting client input must validate that input at the runtime boundary.

Solid 2.0 embraces the [Standard Schema](https://github.com/standard-schema/standard-schema) specification, supported natively by validation libraries such as Valibot, Zod, and ArkType. Standard Schema provides a vendor-agnostic specification via the `~standard` property:

```ts
import { respond } from "@solidjs/web";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(50),
  bio: z.string().max(250).optional(),
});

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export async function updateProfile(rawInput: unknown) {
  "use server";
  const parseResult = UpdateProfileSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw respond(
      { error: "Validation failed", issues: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const validData: UpdateProfileInput = parseResult.data;
  return db.users.updateProfile(validData);
}
```

By typing the server function's parameter as `unknown` and validating it via schema before processing, untrusted input is safely narrowed. For teams with dozens of endpoints, create higher-order action factories at the module level that automatically parse inputs and standardize error formatting across all server functions.

## 5. Single-flight mutations and progressive enhancement

In traditional web applications, submitting an update requires multiple network round-trips: first, a POST request submits the mutation; once the POST succeeds, the client dispatches secondary GET requests to re-fetch updated lists, notifications, and balance counters.

Solid 2.0 solves this inefficiency with **Single-Flight Mutations** (`X-Single-Flight`).

```
Traditional Flow:
Client ──[ POST /todos ]───────────────▶ Server (mutates DB)
Client ◀─[ 200 OK ]──────────────────── Server
Client ──[ GET /todos (refetch) ]──────▶ Server (queries DB)
Client ◀─[ 200 OK (fresh list) ]─────── Server

Solid 2.0 Single-Flight Flow:
Client ──[ POST /todos + X-Single-Flight ]─▶ Server (mutates DB + re-runs affected queries)
Client ◀─[ 200 OK + Folded Revalidation ]── Server (mutation result + fresh data in ONE flight)
```

When client components subscribe to flight data via `subscribeFlightData`, outgoing non-GET server function requests automatically attach the `X-Single-Flight: 1` header. On the server, `collectFlightData(event, outcome)` evaluates the mutation's target URL and revalidation tags, computes updated query snapshots, and folds them directly into the mutation's response payload. Staged cookie changes and headers are merged non-destructively using `foldSetCookies`. The client receives both the mutation result and fresh data in a single network round-trip.

### Progressive enhancement: No-JS forms and flash cookies

Solid server functions are fully usable without client JavaScript. Because server function references expose a build-stable `.url` property (`/_server/data/:id`), standard HTML forms submit directly to the server function:

```tsx
<form action={updateProfile.url} method="POST">
  <input type="text" name="displayName" value={user().displayName} />
  <button type="submit">Save</button>
</form>
```

When submitted from a browser without JavaScript, the server function receives the form POST. Standard browser form navigation requires a redirection to prevent form re-submission upon browser refresh (the Post/Redirect/Get pattern).

Solid's `createNoJSHandler` intercepts form submissions, processes the server function, and issues an HTTP `303 See Other` redirect back to the `Referer` URL (falling back to `/`). To communicate the outcome of the form submission (such as success messages or validation errors) to the redirected page, Solid employs **AES-GCM encrypted flash cookies** (`FLASH_COOKIE = "solid_flash"`):

1. The server serializes the outcome, encrypts it using a high-entropy deployment secret (at least 32 random bytes), and emits a `Set-Cookie: solid_flash=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=60` header with the 303 redirect.
2. The browser follows the redirect to the target page, sending the `Cookie: solid_flash=...` header.
3. During server rendering of the target page, `decodeFlashCookie(cookie)` decrypts the payload and makes the outcome available to components via `getRequestEvent().locals`.
4. The server immediately emits `Set-Cookie: solid_flash=; Max-Age=0` to clear the flash cookie, ensuring the message is displayed exactly once. If the cookie is tampered with or expired, it decodes safely as `null`.

## 6. Cross-machine graph serialization and experimental Server Components

By default, server function arguments and returns must be JSON-safe primitives (strings, numbers, booleans, null, arrays, and plain objects). Modern TypeScript code, however, frequently works with rich data structures.

Enabling rich argument serialization installs graph-aware encoding across the wire:

```ts
import { enableRichArguments } from "@solidjs/web/server-functions/rich-args";

// Call once at application bootstrap on client and server
enableRichArguments();
```

`enableRichArguments()` extends the serialization pipeline to support native `Date` objects, `Map`, `Set`, `BigInt`, typed arrays, `undefined`, `NaN`, and circular graph references. Instances are restored with their true JavaScript prototypes rather than degrading into plain strings or arrays.

> [!IMPORTANT]
> Server Components (`@solidjs/web/frames`) are an experimental preview outside Solid 2.0's stability contract. Pin matching versions of `@solidjs/web` and `@solidjs/vite-plugin` when using them. Server components must declare application context providers inside the server component root, because refetches execute out-of-band and cannot inherit outer client providers. Always call `installServerComponents()` before calling `hydrate()` or `render()`.

### The Server Component model (`@solidjs/web/frames`)

In Solid 2.0, a server component is fundamentally a **server function that returns a component function**:

```tsx
// src/api/user-card.tsx
import type { Slot } from "@solidjs/web/frames/server";

export async function UserCard(id: string) {
  "use server";
  const user = await db.users.find(id);

  // Returns a component accepting client slots
  return (props: { actions: Slot<{ compact?: boolean }> }) => (
    <article class="user-card">
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
      {props.actions({ compact: true })}
    </article>
  );
}
```

On the client, the server component is consumed using `dynamic(() => UserCard(props.id))` from `@solidjs/web`. The returned UI streams as a frame-tagged HTML stream rendered within a `<dx-frame data-fid="...">` custom element. New server HTML morphs in place; client-owned slots (`actions`), their DOM identity, and their local signal state survive server re-renders without reset.

## 7. Anti-patterns versus best practices

| Anti-pattern | Best practice (Solid 2.x) | Architectural Rationale |
|---|---|---|
| Trusting TypeScript annotations on server functions without runtime boundary validation | Validate decoded `unknown` inputs using Standard Schema (Zod/Valibot) | TypeScript types are erased at build time; clients can send arbitrary JSON payloads directly to server function URLs. |
| Placing validation or auth checks in an outer client wrapper around a server function reference | Place validation, authorization, and tenant checks *inside* the `"use server"` function body | Client wrappers are stripped by the compiler; only code inside the server function runs upon direct HTTP dispatch. |
| Throwing raw database or driver errors to the client | Throw `respond({ error }, { status })` or wrap in `markSafeError(new Error(...))` | Production builds sanitize unhandled errors to generic messages; explicit safe errors prevent leaking secrets or SQL details. |
| Calling `getRequestEvent()` in top-level module scope or detached background timers | Call `getRequestEvent()` strictly within the synchronous execution of a server function or request middleware | Request context is stored in `AsyncLocalStorage`; calling it outside active request turns throws runtime errors. |
| Invoking server functions on the client using `serverFn(arg)` without options when cancellation is needed | Use `invoke(serverFn, { signal }, arg)` for controllable execution | `invoke` supports cooperative `AbortController` cancellation, immediately rejecting the caller and canceling network transport. |
| Relying on multiple sequential GET refetches after a POST mutation | Configure single-flight mutations with `X-Single-Flight` and `revalidate` cache tags | Folds mutation responses and affected query invalidations into a single HTTP round-trip, eliminating UI waterfalls. |
| Calling `installServerComponents()` after client `hydrate()` or `render()` | Invoke `installServerComponents()` before any client hydration or rendering begins | Installing late causes the initial server function response to use the standard JSON decoder instead of the frame stream decoder. |

## 8. Exercises

### Exercise 1 — Authenticated Mutation with Standard Schema Validation, Locals, and Revalidation Tags

Author an authenticated server function `publishPost` that validates inputs using a Standard Schema validator, verifies that the requesting user possesses the `editor` role via `getRequestEvent().locals`, throws sanitized safe errors when unauthorized, and returns a response envelope tagged with cache revalidation keys (`X-Revalidate`).

```ts
import { getRequestEvent, markSafeError, respond } from "@solidjs/web";

// Standard Schema validator interface
interface StandardSchema<T> {
  "~standard": {
    validate: (val: unknown) => { value: T } | { issues: Array<{ message: string }> };
  };
}

interface PostInput {
  title: string;
  content: string;
}

const postSchema: StandardSchema<PostInput> = {
  "~standard": {
    validate(val: unknown) {
      if (typeof val !== "object" || val === null) {
        return { issues: [{ message: "Payload must be an object" }] };
      }
      const data = val as Record<string, unknown>;
      if (typeof data.title !== "string" || data.title.trim().length < 3) {
        return { issues: [{ message: "Title must be at least 3 characters" }] };
      }
      if (typeof data.content !== "string" || data.content.trim().length === 0) {
        return { issues: [{ message: "Content cannot be empty" }] };
      }
      return { value: { title: data.title.trim(), content: data.content.trim() } };
    },
  },
};

export async function publishPost(rawInput: unknown) {
  "use server";
  const event = getRequestEvent();
  const user = event.locals.user as { id: string; role: string } | undefined;

  if (!user || (user.role !== "editor" && user.role !== "admin")) {
    throw respond({ error: "Forbidden: editor role required" }, { status: 403 });
  }

  const result = postSchema["~standard"].validate(rawInput);
  if ("issues" in result) {
    const errorMsg = result.issues[0]?.message ?? "Validation failed";
    throw respond({ error: errorMsg }, { status: 400 });
  }

  const post = {
    id: `post-${Date.now()}`,
    title: result.value.title,
    content: result.value.content,
    authorId: user.id,
  };

  return respond(post, {
    status: 201,
    headers: { "X-Created-By": user.id },
    revalidate: ["posts:list", `author:${user.id}`],
  });
}
```

### Exercise 2 — End-to-End Server Function HTTP Dispatch Engine

Build an end-to-end integration test verifying that a server function configured with `GET` and custom metadata dispatches properly through `handleServerFunctionRequest`, enforces method constraints (405 Method Not Allowed), decodes query arguments, and supports client cancellation through `invoke()`.

```ts
// In production Solid 2.0 apps, import from "@solidjs/web/server-functions" and "@solidjs/web/server-functions/server".
// For local headless execution in this repository, import from the bundled reference runtime:
import {
  configureServerFunctionsServer,
  GET,
  handleServerFunctionRequest,
  invoke,
  registerServerFunction,
  withMeta,
} from "../examples/utils/solid2-runtime.ts";

// 1. Configure server endpoint
configureServerFunctionsServer({ endpoint: "/_server" });

// 2. Register server function with GET enabled
const searchArticles = withMeta(
  GET(
    registerServerFunction("searchArticles", async (query: string, limit: number) => {
      return [
        { id: "1", title: `Result for ${query} (limit ${limit})` },
      ];
    })
  ),
  { requiresAuth: false }
);

// 3. Test HTTP GET dispatch via URL search parameters
const getUrl = `http://localhost:3000/_server/data/searchArticles?args=${encodeURIComponent(
  JSON.stringify(["solidjs", 5])
)}`;
const getResponse = await handleServerFunctionRequest(new Request(getUrl, { method: "GET" }));
console.assert(getResponse.status === 200, "GET request succeeds with 200");
const getPayload = await getResponse.json();
console.assert(
  getPayload.data[0].title === "Result for solidjs (limit 5)",
  "Arguments correctly decoded from URL"
);

// 4. Test client invoke with cancellation
const abortController = new AbortController();
abortController.abort(new Error("User navigated away"));

let canceled = false;
try {
  await invoke(searchArticles, { signal: abortController.signal }, "solidjs", 5);
} catch (err) {
  canceled = (err as Error).message === "User navigated away";
}
console.assert(canceled, "invoke rejects immediately when AbortSignal fires");
```

## 9. What to remember

Full-stack Solid 2.0 unifies frontend and backend under a single compiler and runtime architecture. `@solidjs/vite-plugin` manages file-system routing and streaming SSR via `renderToStream`. The `"use server"` directive creates an RPC boundary where server code is completely removed from client bundles and replaced with lightweight references.

Always validate incoming server function arguments using Standard Schema at runtime; compile-time TypeScript annotations provide zero protection against raw HTTP calls. Decorate read functions with `GET` for HTTP cacheability, and enrich functions with `withMeta` for authorization and telemetry. Use `getRequestEvent()` to access scoped `request` and `locals` context, and augment `RequestEventLocals` for end-to-end type safety.

Production builds automatically sanitize unhandled errors to generic messages; use `respond` envelopes or `markSafeError` for intentional user feedback. Single-flight mutations fold page revalidation into POST responses, eliminating post-mutation round-trips. Progressive enhancement allows forms to submit to server function URLs without JavaScript, using encrypted AES-GCM flash cookies for one-shot outcome replay. Run and verify all full-stack patterns using the runnable test suite in `examples/06-full-stack-start-mode-and-server-functions.ts`.
