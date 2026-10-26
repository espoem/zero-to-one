# Module 03 — Draft-First Stores and Projections

Solid 1.x split store ergonomics across three ideas: path-setter tuples from `solid-js/store`, the `produce` draft adapter, and the anything-goes `createMutable`. Solid 2.x deletes all three seams and leaves one: `createStore` imported from `solid-js`, whose setter always hands you a mutable draft proxy. This module covers draft setters and the block-braces discipline, the `storePath` escape hatch for migrated path code, keyed reconciliation, shallow stores, `snapshot` versus `deep`, and the derived-store / projection pair that replaces `createSelector`.

## 1. Unified store imports and mutable draft setters by default

There is no `solid-js/store` subpath anymore, no `produce` wrapper, and no `createMutable`. Every store — object or array — comes from one import, and the setter it returns is already draft-first:

```ts
import { createStore } from "solid-js";

type State = { user: { name: string }; tags: string[] };
const [state, setState] = createStore<State>({ user: { name: "A" }, tags: [] });
setState(draft => { draft.user.name = "B"; draft.tags.push("two"); });

const [rows, setRows] = createStore([{ id: 1 }, { id: 2 }]);
setRows(draft => { draft.splice(0, 1); });
```

The store itself is a proxy object or array, never an accessor: read `rows.length`, not `rows()`. When a tracked reader function is required (for example as a `mapArray` source), wrap the read yourself: `() => rows.length`. Type an initially empty collection with its intended element type (`[] as Item[]`); an inferred `never[]` can never accept later items.

> [!NOTE]
> `setStore` and `setState` are not module exports — they are only the conventional local names for the setter half of the `createStore` tuple. Name the pair for what it holds (`[user, setUser]`, `[rows, setRows]`).

### Block braces for mutation, bare returns for replacement

The draft callback has two shapes with sharply different meanings, and the braces decide which one you get. Use a block body when mutating, and return a value only when that value is the intended replacement root:

```ts
// Mutation: block body, returns void.
setRows(draft => { draft.push(row); });

// Replacement: the returned value shallow-replaces the root —
// a top-level diff for objects, indices plus length for arrays.
setRows(draft => draft.filter(row => row.id !== 1));
```

The classic mistake is `setRows(draft => draft.push(row))`: `push` returns a number, so the setter receives a number where it expects `void` or replacement rows. TypeScript flags it, but build the habit anyway — block braces for every mutation, bare returns only for deliberate root replacement. Keyed reconciliation of replacement data belongs to `reconcile` and derived-store returns (sections 3 and 5), not to ad-hoc setter returns.

### `storePath` when path syntax is explicitly needed

New code should use drafts, but migrated v1 path setters need a mechanical translation. `storePath(...segments, valueOrUpdater)` produces a draft callback, so it composes with the ordinary setter:

```ts
import { createStore, storePath } from "solid-js";

setState(storePath("user", "name", "B"));
setState(storePath("user", "name", prev => prev.toUpperCase()));
setRows(storePath(row => row.id === 2, "label", "renamed"));
setState(storePath("user", "nickname", storePath.DELETE));
```

Segments may be keys, indices, ranges, or predicate filters over arrays; the final argument is either a replacement value, an updater of the previous leaf value, or `storePath.DELETE` to remove the leaf. Predicates make targeted array edits without index bookkeeping, and `DELETE` is the only path-syntax way to drop a key. Reach for `storePath` at migration boundaries and in generated code; prefer readable drafts everywhere else.

## 2. Store reconciliation, shallow stores, and snapshots

### `reconcile` and its key argument

`reconcile<T>(value, key?)` returns a store updater that diffs server (or otherwise authoritative) data into the existing store instead of swapping it, preserving stable row identities for keyed lists. The optional key selects the matching strategy positionally as the second argument: omit it to match on `"id"`, pass a field name or key function for custom identity, or pass `null` for fully positional matching where tails grow and shrink by length:

```ts
import { createStore, reconcile } from "solid-js";

setState(draft => { reconcile(serverUser)(draft.user); });
setRows(reconcile(serverRows));        // match on "id"
setRows(reconcile(serverRows, null)); // positional: indices plus length
```

Missing item keys fall back to position, and an array/object mismatch at a nested slot replaces that slot. One contract distinction matters: standalone `reconcile` preserves the root entity chosen by the caller — a different keyed root is an error — while data *returned* from a derived store (section 5) performs an authoritative swap where a changed root identity discards previous descendants. Keep these two root contracts apart: reconcile to refresh, derive to own.

### Shallow stores

`createStore(initial, { shallow: true })` tracks only root properties and array slots. Nested records stay raw, so treat them as immutable and replace their root slot by reference:

```tsx
const [rows, setRows] = createStore([{ id: 1, label: "old" }], { shallow: true });

// Invisible: mutating a nested raw field notifies nobody.
setRows(draft => { draft[0].label = "new"; }); // stale UI — do not do this.

// Visible: swap the root slot.
setRows(draft => { draft[0] = { ...draft[0], label: "new" }; });
```

At a shallow boundary `reconcile` compares nested records by reference rather than by field, swapping changed references wholesale. Pair shallow rows with custom-keyed lists so refreshes that rebuild record objects preserve row DOM identity. Native and branded objects (`Map`, `Date`, DOM nodes, `Headers`) are always raw even in deep stores — replace the slot (`draft.cache = new Map(draft.cache).set("a", 1)`) instead of mutating internals. Ordinary class instances remain wrappable: mutate their fields through the draft. There is no public `markRaw`; it is an internal symbol only.

### `snapshot` versus `deep`

`snapshot(store)` replaces v1 `unwrap`: it returns a plain deep copy of current data without subscribing to anything. A memo or effect that only snapshots never reruns for store writes, which makes it the right tool for serialization, logging, and one-off reads. `deep(store)` returns the same plain shape but tracks every nested property it visits, which makes it the right value to compute inside the two-phase `createEffect(compute, apply)`: compute `() => deep(settings)` to capture plain tracked data, apply to persist or forward it. Both observe active optimistic overlays and preserve sparse-array holes, so `deep` doubles as the persistence hook for optimistic state (covered in Module 05).

## 3. Derived stores and projections

Value-level derivation has a writable/read-only pair (`createSignal(fn)` versus `createMemo(fn)`), and Solid 2.x mirrors it at store level: `createStore(deriveFn, seed, options?)` is the writable derived store, `createProjection(deriveFn, seed, options?)` is the read-only one. The derive callback receives the store's own mutable draft, may mutate it without returning anything, or may return (or yield) replacement data that is reconciled with `key` (default `"id"`). The seed is the backing object shown before first resolution; pass `seedLoadingValue` when that seed should be treated as the provisional first paint rather than a structural hole (see Module 04):

```ts
import { createProjection, createStore } from "solid-js";

const users = createProjection<User[]>(() => api.listUsers(), [], { key: "id" });
const [cache, setCache] = createStore(draft => { draft.x = compute(); }, { x: 0 });
```

The writable form stays settable through its own setter — manual overrides apply immediately and are simply overwritten by the next upstream recompute — while the projection exposes no setter at all, which makes illegal writes a compile error instead of a convention.

### O(1) reactive selection without `createSelector`

v1 `createSelector` is not exported in v2; keyed selection is a projection. The pattern below stores at most one marker, so each row reads only its own key and a selection change notifies exactly the old and new rows instead of every row subscriber:

```tsx
import { createProjection, createSignal } from "solid-js";

const [selectedId, setSelectedId] = createSignal<string>();
const selected = createProjection<Record<string, boolean>>(draft => {
  for (const key of Object.keys(draft)) delete draft[key];
  const id = selectedId();
  if (id !== undefined) draft[`row:${id}`] = true;
}, {});

const isSelected = (id: string) => selected[`row:${id}`] === true;
```

Prefix marker keys (`row:`) to keep arbitrary ids out of JavaScript's special keys, and give each selectable widget its own projection so selections never leak across lists.

### Live nested views over normalized state

A derived store that embeds another store's data keeps the inner store live rather than cloning it away — provided the derive step preserves the inner proxy instead of snapshotting it. Build the view from the entity table on every recompute and read the collection *through the wrapper* (`view.items`, never a detached copy): inner adds, deletes, and reconciliations then reach the view's consumers, while `snapshot(view)` stays a one-off untracked read for serialization. This is the standard shape for normalized caches: one writable entity table plus any number of cheap read-only views.

> [!TIP]
> When a view stops updating, check two things in order: the derive step must read the inner store (not a snapshot of it), and consumers must render through the wrapper path so their subscriptions land on inner structure.

## 4. Anti-patterns versus best practices

| Anti-pattern (v1 habit or trap) | Best practice (Solid 2.x) |
|---|---|
| Importing `createStore` from `solid-js/store`, wrapping setters in `produce`, or reaching for `createMutable` | Import `createStore` from `solid-js`; every setter is already draft-first |
| `setRows(draft => draft.push(row))` — returning the push count as a would-be root | `setRows(draft => { draft.push(row); })`; return values only for deliberate root replacement |
| Hand-rolled path helpers or deep-clone-and-set for nested edits | Mutate the draft directly; use `storePath` (paths, predicates, `DELETE`) only at migration boundaries |
| Replacing whole arrays on every poll, destroying row identity | `reconcile(serverRows)` (default `"id"` key); `null` only for genuinely positional data |
| Mutating nested fields of a `{ shallow: true }` store or raw `Map`/`Date` slots | Replace the root slot by reference; keep keyed lists keyed across reference swaps |
| `unwrap(store)` or spreading the store for a "safe" copy inside effects | `snapshot(store)` for untracked copies; `deep(store)` as effect compute for tracked plain data |
| v1 `createSelector` for selection state | `createProjection` keyed markers with per-row reads — O(1) updates, no broadcast |
| Snapshotting normalized state into a view (view goes stale) | Derive the view from the live entity table and read through the wrapper |

## 5. Exercises

### Exercise 1 — Todo list with keyed reconciliation and O(1) selection

Build a small todo manager over `createStore` plus one projection: todos support add, toggle, rename, and remove; server polls arrive as full arrays and must reconcile by `id` without losing row identity; exactly one todo can be "focused" with O(1) updates. Start from this skeleton and verify each step with `flush()` and `snapshot` assertions.

```ts
import { createProjection, createSignal, createStore, flush, reconcile, snapshot } from "solid-js";

type Todo = { id: string; label: string; done: boolean };

// Solution.
const [todos, setTodos] = createStore<Todo[]>([
  { id: "a", label: "Write spec", done: false },
  { id: "b", label: "Review PR", done: false },
]);
const [focusedId, setFocusedId] = createSignal<string | undefined>(undefined);
const focused = createProjection<Record<string, boolean>>(draft => {
  for (const key of Object.keys(draft)) delete draft[key];
  const id = focusedId();
  if (id !== undefined) draft[`todo:${id}`] = true;
}, {});
const isFocused = (id: string): boolean => focused[`todo:${id}`] === true;

export function addTodo(todo: Todo): void {
  setTodos(draft => { draft.push(todo); });
  flush();
}

export function toggleTodo(id: string): void {
  setTodos(draft => {
    const row = draft.find(row => row.id === id);
    if (row !== undefined) row.done = !row.done;
  });
  flush();
}

export function renameTodo(id: string, label: string): void {
  setTodos(draft => {
    const row = draft.find(row => row.id === id);
    if (row !== undefined) row.label = label;
  });
  flush();
}

export function removeTodo(id: string): void {
  // Block braces would mutate; the bare return replaces the root instead.
  setTodos(draft => draft.filter(row => row.id !== id));
  flush();
}

export function pollServer(serverTodos: Todo[]): void {
  // Default "id" key: fields diff in place, row identities survive.
  setTodos(reconcile(serverTodos));
  flush();
}

export function focusTodo(id: string | undefined): void {
  setFocusedId(id);
  flush();
}

// Verification.
addTodo({ id: "c", label: "Ship it", done: false });
toggleTodo("a");
pollServer([
  { id: "a", label: "Write spec", done: true },
  { id: "b", label: "Review PR (updated)", done: false },
  { id: "c", label: "Ship it", done: false },
]);
focusTodo("b");
console.assert(todos.length === 3, "three todos after poll");
console.assert(todos[0]?.done === true, "toggle survives reconciliation");
console.assert(isFocused("b") && !isFocused("a"), "O(1) focus marks only row b");
console.assert(
  JSON.stringify(snapshot(focused)) === JSON.stringify({ "todo:b": true }),
  "projection holds exactly one marker",
);
removeTodo("a");
console.assert(todos.length === 2 && todos.every(row => row.id !== "a"), "remove drops row a");
```

### Exercise 2 — Normalized entity table with a live filtered view

Normalize a list of messages into an entity table plus an order array, then expose a read-only live view of unread messages. Writes to the table (marking a message read, receiving a new message) must flow through the view without re-creating it, and a snapshot of the view must stay untracked.

```ts
import { createProjection, createStore, flush, snapshot } from "solid-js";

type Message = { id: string; text: string; read: boolean };
type Db = { byId: Record<string, Message>; order: string[] };

// Solution.
const [db, setDb] = createStore<Db>({ byId: {}, order: [] });

function ingest(messages: Message[]): void {
  setDb(draft => {
    for (const message of messages) {
      // Entity first, order second: inserting the id into `order` notifies
      // the live view synchronously, and the row must already be resolvable.
      const isNew = draft.byId[message.id] === undefined;
      draft.byId[message.id] = message;
      if (isNew) draft.order.push(message.id);
    }
  });
  flush();
}

// Live view: reads the inner store on every recompute, never a snapshot of it.
const unread = createProjection<{ rows: Message[] }>(draft => {
  draft.rows = db.order
    .map(id => db.byId[id] as Message)
    .filter(message => !message.read);
}, { rows: [] as Message[] });

export function markRead(id: string): void {
  setDb(draft => {
    const row = draft.byId[id] as Message | undefined;
    if (row !== undefined) row.read = true;
  });
  flush();
}

// Verification.
ingest([
  { id: "m1", text: "Hello", read: false },
  { id: "m2", text: "World", read: false },
]);
console.assert(unread.rows.length === 2, "view shows both unread messages");
const viewBefore = unread.rows;
markRead("m1");
flush();
console.assert(unread.rows.length === 1 && unread.rows[0]?.id === "m2", "table write flows through the live view");
console.assert(unread.rows !== viewBefore, "view re-resolves its rows after the inner write");
ingest([{ id: "m3", text: "Again", read: false }]);
console.assert(unread.rows.length === 2, "new arrivals appear in the view");
const frozen = snapshot(unread);
markRead("m2");
flush();
console.assert(frozen.rows.length === 2, "snapshot is untracked: later writes do not touch it");
console.assert(unread.rows.length === 1, "but the live view follows the write");
```

## 6. What to remember

Draft-first setters collapse v1's three store ergonomics into one import and one rule: block braces mutate, bare returns replace. `storePath` translates migrated path code (including predicates and `DELETE`) into draft callbacks. `reconcile` refreshes authoritative data in place with `"id"` matching by default and positional matching under `null`; shallow stores trade deep tracking for explicit root-slot swaps. `snapshot` reads without subscribing while `deep` subscribes to everything it visits. Writable derived stores and read-only projections mirror the signal/memo split at store level, and projections are the v2 home of O(1) selection and live normalized views. The runnable suite in `examples/03-draft-first-stores-and-projections.ts` verifies every claim above — run it with `node examples/03-draft-first-stores-and-projections.ts`.
