# Module 05 — Transactional Writes and Optimistic State

Optimistic UI in traditional frameworks is an imperative, error-prone chore: engineers capture manual snapshot backups of previous state, imperatively patch client stores, await network promises inside try/catch blocks, and attempt to manually roll back state when network failures occur. If intermediate updates or background polling arrive while an action is in flight, manual rollbacks overwrite fresh authoritative data, corrupting the client view. SolidJS 2.x abandons manual rollbacks entirely in favor of declarative, speculative overlay state. In Solid 2.0, an optimistic write is a temporary display overlay layered over confirmed server state. The overlay is managed declaratively by the reactive engine: whether an action fulfills normally, catches an error, or rejects, the speculative overlay automatically ends upon transaction completion, seamlessly revealing the underlying authoritative state. This module covers speculative overlay signals and stores (`createOptimistic`, `createOptimisticStore`), generator-based transactional actions (`action`), reactive transaction boundaries, fine-grained pending marks (`affects`), awaitable reconciliation (`refresh`), live WebSocket acknowledgments (`until`), and patterns for resilient table editing and chat synchronization.

## 1. Speculative overlay state: `createOptimistic` and `createOptimisticStore`

In Solid 2.0, optimism is strictly a display overlay, never confirmed authoritative data. The framework provides two primitives for creating speculative overlays: `createOptimistic` for scalar values and accessors, and `createOptimisticStore` for structured objects and collections.

```ts
import { createOptimistic, createOptimisticStore, createSignal } from "solid-js";

// Scalar optimistic signal layered over a base accessor
const [baseTitle, setBaseTitle] = createSignal("Authoritative Document");
const [title, setOptimisticTitle] = createOptimistic(() => baseTitle());

// Structured optimistic store layered over an initial collection
type Todo = { id: string; text: string; done: boolean };
const [todos, setOptimisticTodos] = createOptimisticStore<Todo[]>([
  { id: "1", text: "Ship Solid 2.0", done: true },
]);
```

### The scalar overlay contract: `createOptimistic`

`createOptimistic<T>(initialOrCompute)` returns a standard `Signal<T>` tuple `[get, set]`. When initialized with a compute function `() => T`, reading the accessor evaluates the base derivation whenever no optimistic override is active. When an optimistic override is set via `setOptimisticTitle(nextValue)`, the accessor immediately returns the speculative value without modifying the base signal.

The lifetime of a speculative override depends on transaction context. If `setOptimisticTitle` is called outside an active transaction, the override is committed synchronously on the current tick and automatically reverts upon the next microtask flush. When called inside an active action transaction, the override remains active across all asynchronous yields of the action, reverting automatically the moment the transaction settles or rejects.

```ts
// Outside a transaction: commits immediately, reverts on flush
setOptimisticTitle("Temporary Preview");
console.log(title()); // "Temporary Preview"
flush();
console.log(title()); // "Authoritative Document"
```

### The collection overlay contract: `createOptimisticStore`

`createOptimisticStore<T extends object>(deriveOrInitial, seed?, options?)` manages structured state by maintaining two distinct stores internally: an authoritative confirmed store and a display store. The returned setter `setOptimistic(draft => { ... })` accepts draft-first mutator functions, exactly like standard `createStore` setters.

Each mutation executed through `setOptimistic` is recorded in an active mutation overlay stack. Whenever the underlying authoritative store receives new data (via background WebSocket events, server reconciliation, or refetches), the display store takes a fresh authoritative snapshot and re-applies all active optimistic drafts on top. As a result, incoming server data for unrelated records updates seamlessly on screen without wiping out the user's pending optimistic mutations. When the action finishes, the mutation stack clears and the display store cleanly reverts to authoritative state.

> [!NOTE]
> Optimistic writes neither create nor mask pending states. Setting an optimistic value changes displayed data immediately, but does not cause `isPending` to report true or suspend `<Loading>` boundaries. For a "Saving…" spinner or process indicator, co-write a `createOptimistic(false)` boolean flag or inspect an active edit preview signal.

## 2. Generator actions and reactive transactions

Solid 2.0 introduces generator-based actions via `action(function* () { ... })` and `action(async function* () { ... })`. In standard JavaScript, an ordinary `async/await` function executes continuously on the microtask queue; the runtime has no hook to track intermediate suspension points, coordinate multiple writes across microtasks, or guarantee deterministic cleanup on failure. Generators solve this by providing explicit `yield` suspension points.

`action` accepts a generator function and returns an asynchronous function returning a Promise. When the returned function is invoked, the Solid runtime increments an internal transaction counter (`inTransactionDepth`), wraps execution in a deterministic transaction context, and steps the generator:

```ts
import { action, createOptimistic, refresh } from "solid-js";

const [status, setStatus] = createOptimistic("idle");

const saveDocument = action(async function* (content: string) {
  setStatus("saving");
  const response = await api.postContent(content);
  yield; // Bare yield: restores reactive transaction context after internal await!
  yield refresh(documentData);
  return response.id;
});
```

### The role of `yield` versus `await`

Inside an action generator, `yield` is the transaction-safe suspension point. Yielding a Promise pauses the generator while holding the reactive transaction open across the network boundary. When the yielded Promise fulfills, its resolved value is fed back into the generator via `iterator.next(resolved)`.

When using an `async function*` containing an internal `await` (such as `await api.postContent(content)`), the JavaScript engine steps through microtasks outside the direct interception of the generator iterator. To re-establish the reactive transaction context, flush queued microtask writes, and ensure subsequent state mutations execute within the held transaction, you must place a bare `yield;` immediately after the internal `await`.

### Automatic revert lifecycle

The transaction lifecycle guarantees that speculative overlays are never leaked:

| Generator Outcome | Returned Action Promise | Optimistic Overlay | Authoritative State |
|---|---|---|---|
| Completes normally via `return` | Fulfills with returned value | Automatically removed | Lasting state supplied by confirmed refetch/echo |
| Catches failure internally, then returns | Fulfills with returned value | Automatically removed | Lasting state supplied by confirmed refetch/echo |
| Throws uncaught exception or yielded promise rejects | Rejects with error (preserves error identity) | Automatically removed | Unchanged authoritative state remains visible |

Falsy rejections, such as `throw undefined` or `reject(null)`, are fully supported and preserve their exact error identity. Ordinary action failures reject the returned Promise, strip the speculative overlay, and keep the reactive system completely stable.

## 3. Pending marks, awaitable refresh, and live acknowledgments

Coordinating optimistic writes with network feedback requires fine-grained tools for marking pending targets, awaiting authoritative re-queries, and synchronizing with real-time push streams.

### Fine-grained pending marks: `affects(target, key?)`

`affects` marks reactive targets as actively pending during an action transaction. Outside an active transaction, marks expire at the microtask flush and never reach the UI. Inside an action transaction, marked targets cause `isPending(target)` to report `true` until the transaction settles or reverts:

```ts
import { action, affects, isPending, refresh } from "solid-js";

const [user, setUser] = createSignal({ name: "Alice" });

const reloadUser = action(function* () {
  affects(user); // Marks user as pending
  yield refresh(user); // Re-queries user data
});

// UI reads pending state under Loading boundary
<button disabled={isPending(user)}>Reload</button>
```

`affects` accepts an accessor (`affects(user)`), a store proxy (`affects(store)` to mark records reachable at declaration time), or a store and single property key (`affects(store, "field")` to mark exactly one slot). Marked data remains fully readable while pending.

### Awaitable refresh: `refresh(target)`

`refresh(target)` invalidates the target accessor or store derivation and returns a Promise for its next quiescent state. Superseding invalidations fold into that wait; it returns whatever finally settles. Inside an action, `yield refresh(source)` delivers staged authoritative data to the held transaction, excluding the caller's own optimistic override. A failed refresh rejects with the original source error, while bare un-yielded `refresh()` calls remain quiet for `isPending`.

### Live acknowledgments: `until(predicate, { timeout, signal })`

Many modern applications synchronize mutations across WebSockets, SSE, or broadcast channels rather than simple HTTP response payloads. In this architecture, an action dispatches an HTTP request, but the mutation is not truly confirmed until the server's broadcast echo arrives over a WebSocket.

`until(predicate, options?)` returns a Promise that resolves upon the first settled truthy result returned by the predicate. Falsy or pending results keep waiting. Inside an action, `until` evaluates the predicate directly against authoritative source state, excluding optimistic overrides:

```ts
import { action, createOptimisticStore, until } from "solid-js";

type Message = { id: string; clientId?: string; text: string; pending?: boolean };
type Inbox = { messages: Message[]; receipts: string[] };

function createMessages(
  source: () => AsyncIterable<Message[]>,
  sendMessage: (message: Message) => Promise<unknown>
) {
  const pendingReceipts = new Map<string, boolean>();
  const [inbox, setInbox] = createOptimisticStore<Inbox>(
    async function* () {
      for await (const messages of source()) {
        for (const row of messages) {
          if (row.clientId !== undefined && pendingReceipts.has(row.clientId)) {
            pendingReceipts.set(row.clientId, true);
          }
        }
        yield {
          messages,
          receipts: [...pendingReceipts]
            .filter(([, received]) => received)
            .map(([id]) => id),
        };
      }
    },
    { messages: [], receipts: [] }
  );

  const send = action(function* (text: string) {
    const clientId = crypto.randomUUID();
    const message = { id: clientId, clientId, text };
    pendingReceipts.set(clientId, false);
    try {
      setInbox((draft) => {
        draft.messages.push({ ...message, pending: true });
      });
      yield sendMessage(message);
      yield until(() => inbox.receipts.includes(clientId), { timeout: 3000 });
    } finally {
      pendingReceipts.delete(clientId);
    }
  });

  return { inbox, send };
}
```

This protocol guarantees that completion requires both successful HTTP transport and authoritative WebSocket echo acknowledgment. If the socket drops or the server times out, `until` rejects with a `TimeoutError`, automatically aborting the action and removing the optimistic message.

## 4. Editable row preview overlays over replacing snapshots

A subtle architectural hazard occurs when implementing editable rows in live data feeds. When server snapshots regularly replace arrays of records, writing an optimistic edit directly into a derived store's descendant node can be wiped out when a subsequent server snapshot replaces the parent row proxy.

The resilient pattern separates confirmed server rows from the in-flight edit preview:

```ts
import { action, createOptimistic } from "solid-js";

type Row = { id: string; label: string };

function createRowLabels(
  rows: () => readonly Row[],
  renameAndConfirm: (id: string, label: string) => Promise<void>
) {
  const [preview, setPreview] = createOptimistic<Row | undefined>(undefined);

  const rename = action(function* (id: string, label: string) {
    setPreview({ id, label });
    yield renameAndConfirm(id, label);
  });

  return {
    rows,
    rename,
    label(row: Row): string {
      const edit = preview();
      return edit?.id === row.id ? edit.label : row.label;
    },
    saving: () => preview() !== undefined,
  };
}
```

By storing the in-flight edit in a separate `createOptimistic` signal, intervening server snapshots replace confirmed rows without erasing the active preview. In the UI, `label(row)` renders the preview label if the row ID matches, falling back to the server label. When the action fulfills or rejects, `preview()` automatically reverts to `undefined`, seamlessly transitioning to the confirmed authoritative data.

> [!IMPORTANT]
> Never invoke `action(...)()` during component body setup or inside a tracking computation. Calling an action inside a reactive tracking scope throws `ACTION_CALLED_IN_OWNED_SCOPE` in development. Actions are transaction-starting writes; calling them from computations that track what the action writes creates infinite livelocks. Define actions during component setup, but invoke them exclusively from event handlers, effect apply/error callbacks, `onSettled`, or other imperative triggers.

## 5. Anti-patterns versus best practices

| Anti-pattern (Legacy habit or hazard) | Best practice (Solid 2.x) | Architectural Rationale |
|---|---|---|
| Manual `try/catch` with cached snapshot backups to roll back state on error | Declarative `createOptimistic` or `createOptimisticStore` inside `action` | Solid 2.0 automatically reverts speculative overlays on both fulfillment and rejection, preventing stale rollback corruption. |
| Invoking an action inside a component body or tracking compute expression | Define actions during setup; invoke them from event handlers or `onSettled` | Prevents reactive livelock; calling actions in tracked scopes throws `ACTION_CALLED_IN_OWNED_SCOPE`. |
| Writing `await fetch(...)` inside an async generator action without a following `yield` | Add a bare `yield;` immediately after internal `await` expressions | Restores the reactive transaction context and flushes batched writes across microtask boundaries. |
| Directly mutating derived store rows during in-flight edits | Maintain in-flight edits in a separate `createOptimistic` preview overlay | Prevents intervening server snapshots from wiping out active user edits before server confirmation arrives. |
| Reading `isPending(target)` as a "Saving…" button indicator | Co-write a `createOptimistic(false)` flag or inspect `preview() !== undefined` | `isPending` inspects unrevealed derivation changes or `affects` marks; saving indicators require explicit boolean flags. |
| Using `action` promises without `.catch()` handlers at the UI boundary | Attach `.catch(...)` to action invocation promises in event handlers | Prevents unhandled promise rejection warnings when network mutations fail as expected. |
| Relying on iterator `finally` alone to cancel silent WebSocket subscriptions | Actively close and wake waiting streams in synchronous cleanup | Parked generator iterators queue `.return()` behind awaiting promises; synchronous cleanup unblocks stalled consumers. |

## 6. Exercises

### Exercise 1 — Resilient Inline Table Row Renaming with Separate Preview Overlay

Build a resilient inline row-editing controller for a table feed. The controller must support speculative label updates, protect the in-flight edit against intervening background server snapshots, report saving state via an optimistic flag, mark the row target as pending via `affects`, and cleanly revert to the authoritative server state if the network request fails.

```ts
import {
  action,
  affects,
  createOptimistic,
  createSignal,
  flush,
  isPending,
} from "solid-js";

type Row = { id: string; label: string };

function createInlineEditor(
  initialRows: Row[],
  persistApi: (id: string, newLabel: string) => Promise<void>
) {
  const [rows, setRows] = createSignal<Row[]>(initialRows);
  const [preview, setPreview] = createOptimistic<Row | undefined>(undefined);

  const rename = action(function* (id: string, label: string) {
    setPreview({ id, label });
    affects(rows);
    yield persistApi(id, label);
  });

  return {
    rows,
    setRows,
    rename,
    label(row: Row): string {
      const active = preview();
      return active?.id === row.id ? active.label : row.label;
    },
    saving: () => preview() !== undefined,
  };
}

// Verification
function deferred<T>() {
  let resolveFn: (v: T) => void = () => {};
  let rejectFn: (e: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

const network = deferred<void>();
const editor = createInlineEditor(
  [{ id: "r1", label: "Original Alpha" }],
  () => network.promise
);

console.assert(editor.label(editor.rows()[0]!) === "Original Alpha", "Initial label confirmed");
console.assert(!editor.saving(), "Not saving initially");

// Start renaming
const editPromise = editor.rename("r1", "Speculative Alpha");
flush();
console.assert(editor.label(editor.rows()[0]!) === "Speculative Alpha", "Speculative label visible");
console.assert(editor.saving(), "Saving flag active");
console.assert(isPending(editor.rows), "Target rows signal marked pending via affects");

// Background server snapshot arrives with unrelated data before network settles
editor.setRows([{ id: "r1", label: "Server Stale Snapshot" }]);
flush();
console.assert(
  editor.label(editor.rows()[0]!) === "Speculative Alpha",
  "Preview overlay preserves user edit over intervening snapshot"
);

// Simulate network failure
network.reject(new Error("500 Server Error"));
try {
  await editPromise;
} catch {
  // Handled at boundary
}
flush();

console.assert(
  editor.label(editor.rows()[0]!) === "Server Stale Snapshot",
  "Overlay cleanly reverts to latest server state on failure"
);
console.assert(!editor.saving(), "Saving flag cleared");
console.assert(!isPending(editor.rows), "Pending cleared on transaction settlement");
```

### Exercise 2 — Multi-Step Generator Action with Bare Yield and WebSocket Echo Synchronization

Implement a chat dispatcher where sending a message performs two steps: an HTTP POST to dispatch the payload, followed by awaiting a WebSocket echo receipt using `until()`. The message must be optimistically visible in the store during transmission, marked with `pending: true`, and finalized only when the live echo receipt matches the client-generated ID.

```ts
import {
  action,
  createOptimisticStore,
  flush,
  until,
} from "solid-js";

type ChatItem = { id: string; text: string; pending?: boolean };
type ChatState = { items: ChatItem[]; receipts: string[] };

function createChatManager(
  httpPost: (msg: ChatItem) => Promise<void>
) {
  const [chat, setChat] = createOptimisticStore<ChatState>({
    items: [],
    receipts: [],
  });

  const send = action(function* (text: string) {
    const clientId = `client-${Date.now()}`;
    const draftItem: ChatItem = { id: clientId, text, pending: true };

    setChat((draft) => {
      draft.items.push(draftItem);
    });

    // Step 1: HTTP POST dispatch
    yield httpPost(draftItem);

    // Step 2: Await WebSocket acknowledgment receipt
    yield until(() => chat.receipts.includes(clientId), { timeout: 2000 });

    return clientId;
  });

  return { chat, setChat, send };
}

// Verification
const httpGate = deferred<void>();
const manager = createChatManager(() => httpGate.promise);

const sendPromise = manager.send("Hello World");
flush();

console.assert(manager.chat.items.length === 1, "Optimistic item added immediately");
console.assert(manager.chat.items[0]?.pending === true, "Item flagged as pending");

// HTTP POST completes
httpGate.resolve();
flush();

// Simulate incoming WebSocket broadcast with confirmed message and echo receipt
// (__setConfirmed is a test-harness helper on solid2-runtime.ts simulating an authoritative server push)
(manager.chat as any).__setConfirmed((draft: ChatState) => {
  draft.items.push({ id: "server-id-99", text: "Hello World", pending: false });
  // The echo receipt carries the client ID used to correlate the acknowledgment
  const matchingClientId = manager.chat.items[0]?.id;
  if (matchingClientId) draft.receipts.push(matchingClientId);
});
flush();

await sendPromise;
flush();

console.assert(manager.chat.items.length === 1, "No duplicate items after confirmation");
console.assert(manager.chat.items[0]?.id === "server-id-99", "Authoritative server ID in place");
console.assert(!manager.chat.items[0]?.pending, "Item is no longer pending");
```

## 7. What to remember

Speculative overlay state replaces manual rollback logic with declarative reactive transactions. `createOptimistic` layers scalar overrides over base accessors, while `createOptimisticStore` maintains an active draft mutation stack over confirmed store snapshots. Speculative overlays are strictly display state; they neither cause nor hide pending flags.

Generator actions (`action(function* () {})` and `action(async function* () {})`) coordinate reactive transactions across asynchronous boundaries. Yielding promises pauses generator execution while keeping the transaction open. After an internal `await`, place a bare `yield;` to re-synchronize the transaction context. Speculative overlays automatically revert upon action completion or rejection.

Use `affects(target)` inside actions to mark computations or store paths pending for `isPending(target)` consumers. Use `yield refresh(source)` to reconcile authoritative state, and `yield until(predicate, { timeout, signal })` to synchronize live WebSocket echo acknowledgments. To prevent server snapshots from overwriting active user edits in tables, isolate in-flight edits in separate `createOptimistic` preview overlays. Verify every transactional guarantee using the runnable test suite in `examples/05-transactional-writes-and-optimistic-state.ts`.
