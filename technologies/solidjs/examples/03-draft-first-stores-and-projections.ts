/**
 * Module 03 — Draft-First Stores and Projections (SolidJS 2.x).
 *
 * Runnable verification suite. Run with:
 *   node examples/03-draft-first-stores-and-projections.ts
 *
 * Covers: unified `createStore` import from `solid-js`, mutable draft setters
 * (block braces vs returned replacement roots), `storePath` (paths, predicate
 * filters, `storePath.DELETE`), `reconcile` (default `"id"` key vs positional
 * `null`), `{ shallow: true }` stores, `snapshot` (untracked) vs `deep`
 * (tracked), writable derived `createStore(deriveFn, seed, options)` vs
 * read-only `createProjection`, O(1) selection projections (the v2 replacement
 * for v1 `createSelector`), and live nested views over normalized state.
 */
import {
  createEffect,
  createProjection,
  createRoot,
  createSignal,
  createStore,
  deep,
  flush,
  reconcile,
  snapshot,
  storePath,
} from "./utils/solid2-runtime.ts";
import { assert, assertDeepEqual, assertEqual } from "./utils/type-helpers.ts";

let passed = 0;
function check(condition: boolean, message: string): void {
  assert(condition, message);
  passed += 1;
  console.log(`ok ${passed} - ${message}`);
}

type User = { name: string; nickname?: string };
type State = { user: User; tags: string[] };
type Row = { id: number; label: string };

// --- 1. Unified import & mutable draft setters --------------------------------
// In Solid 2.x there is no `solid-js/store` subpath, no `produce`, and no
// `createMutable`: `createStore` is imported from `solid-js` and every setter
// already receives a mutable draft proxy.
const [state, setState] = createStore<State>({ user: { name: "A" }, tags: [] });
check(state.user.name === "A", "store reads as a proxy object, not an accessor (no `state()` call)");

setState((draft) => {
  draft.user.name = "B";
  draft.tags.push("two");
});
flush();
assertEqual(state.user.name, "B", "draft mutation updates nested state");
check(state.tags.length === 1 && state.tags[0] === "two", "draft array methods mutate in place");

// --- 2. Block braces for mutation, bare returns for root replacement ---------
const [rows, setRows] = createStore<Row[]>([
  { id: 1, label: "one" },
  { id: 2, label: "two" },
]);

// Mutation shape: use a block body. `draft => draft.push(row)` would return a
// *number* (the push result) where a replacement root is expected, so the
// block form is the only correct mutation shape.
setRows((draft) => {
  draft.push({ id: 3, label: "three" });
});
flush();
check(rows.length === 3, "block-brace draft callback mutates the root array");

// Replacement shape: returning a value shallow-replaces the root (object
// top-level diff, or array indices plus length).
setRows((draft) => draft.filter((row) => row.id !== 1));
flush();
check(rows.length === 2 && rows[0]?.id === 2, "returned array shallow-replaces the root");

// --- 3. storePath for explicit path syntax ------------------------------------
// New code prefers drafts, but `storePath` is the migration path for v1 nested
// path setters: it builds a draft callback from path segments.
setState(storePath<State, "user", "name">("user", "name", "C"));
flush();
assertEqual(state.user.name, "C", "storePath sets a nested path without a hand-written draft");

// Predicate segments filter array elements before descending further. The last
// argument may be a value or an updater function of the previous leaf value.
setRows(storePath<Row[], number, "label">((row: Row) => row.id === 2, "label", (prev: string) => `${prev}!`));
flush();
assertEqual(rows[0]?.label, "two!", "storePath predicate targets only matching array elements");

setState((draft) => {
  draft.user.nickname = "Bobby";
});
flush();
assertEqual(state.user.nickname, "Bobby", "optional field added through a draft");
setState(storePath<State, "user", "nickname">("user", "nickname", storePath.DELETE));
flush();
check(state.user.nickname === undefined, "storePath.DELETE removes the leaf key");
check(!("nickname" in snapshot(state).user), "deleted key is gone from the reconciled snapshot");

// --- 4. Reconciliation: keyed (default "id") vs positional (null) ------------
const [users, setUsers] = createStore<Row[]>([
  { id: 1, label: "old-a" },
  { id: 2, label: "old-b" },
]);
// Omitted key selects `"id"`; standalone reconcile preserves the caller-chosen
// root and diffs fields in place instead of swapping identities.
setUsers(reconcile<Row[], Row[]>([
  { id: 1, label: "new-a" },
  { id: 2, label: "new-b" },
]));
flush();
check(users[0]?.label === "new-a" && users[1]?.label === "new-b", "reconcile with default id key updates fields in place");

// `null` selects fully positional matching: tails grow and shrink by length.
setUsers(reconcile([
  { id: 1, label: "x" },
  { id: 2, label: "y" },
  { id: 3, label: "z" },
], null));
flush();
check(users.length === 3, "positional reconcile (key null) grows the array by length");
setUsers(reconcile([{ id: 9, label: "solo" }], null));
flush();
check(users.length === 1 && users[0]?.id === 9, "positional reconcile truncates removed tails");

// Object reconcile diffs top-level keys and drops keys missing from source.
setState(reconcile({ user: { name: "D" }, tags: [] }));
flush();
check(state.user.name === "D" && state.tags.length === 0, "object reconcile replaces top-level keys and drops the rest");

// --- 5. Shallow stores ---------------------------------------------------------
// `shallow: true` tracks only root properties / array slots. Nested records are
// raw: replace their root slot by reference instead of mutating their fields.
const [shallowRows, setShallowRows] = createStore<Row[]>([{ id: 1, label: "old" }], { shallow: true });
let shallowRuns = 0;
createRoot((dispose) => {
  createEffect(
    () => shallowRows[0]?.label ?? "missing",
    () => {
      shallowRuns += 1;
    },
  );
  // Native effects apply on flush, not synchronously at creation.
  flush();
  check(shallowRuns === 1, "shallow reader effect applies once on setup");

  (shallowRows[0] as Row).label = "mutated-silently";
  flush();
  check(shallowRuns === 1, "nested raw mutation under shallow:true notifies nobody");
  assertEqual(shallowRows[0]?.label, "mutated-silently", "raw nested write is visible to direct readers (the stale-UI risk)");

  setShallowRows((draft) => {
    draft[0] = { ...(draft[0] as Row), label: "new" };
  });
  flush();
  check(shallowRuns === 2, "replacing the root slot notifies shallow readers");
  assertEqual(shallowRows[0]?.label, "new", "root-slot replacement commits the new record");
  dispose();
});

// --- 6. snapshot (untracked) vs deep (tracked) ---------------------------------
// `snapshot` replaces v1 `unwrap`: a plain deep copy that subscribes to nothing.
// `deep` returns the same plain shape but tracks every nested property, which
// makes it the right value to compute inside `createEffect(compute, apply)`.
const [profile, setProfile] = createStore({ user: { name: "A" }, tags: ["x"] });
const snap = snapshot(profile);
check(snap !== (profile as unknown as object), "snapshot returns a plain copy, not the proxy");
assertDeepEqual(snap, { user: { name: "A" }, tags: ["x"] });
// Native snapshots share source identity for unmodified subtrees (structural
// sharing): the snapshot's nested holders are the store's own raw objects,
// so a nested write through the snapshot is visible through the store.
snap.user.name = "edited-copy";
assertEqual(profile.user.name, "edited-copy", "snapshot shares nested identity for unmodified subtrees");
setProfile((draft) => {
  draft.user.name = "A";
});
flush();

let snapComputes = 0;
createRoot((dispose) => {
  createEffect(
    () => {
      snapComputes += 1;
      return snapshot(profile).user.name;
    },
    () => {},
  );
  setProfile((draft) => {
    draft.user.name = "B";
  });
  flush();
  check(snapComputes === 1, "snapshot is untracked: readers do not resubscribe");
  assertEqual(profile.user.name, "B", "store still updates underneath the untracked read");
  dispose();
});

let deepApplies = 0;
createRoot((dispose) => {
  createEffect(() => deep(profile), () => {
    deepApplies += 1;
  });
  flush();
  check(deepApplies === 1, "deep-based effect applies once on setup");
  setProfile((draft) => {
    draft.user.name = "C";
  });
  flush();
  check(deepApplies === 2, "deep tracks nested fields, so the effect recomputes on nested writes");
  assertDeepEqual(deep(profile), snapshot(profile));
  dispose();
});

// --- 7. Writable derived stores vs read-only projections ----------------------
const [settings, setSettings] = createStore({ theme: "light", fontSize: 14 });
const [css, setCss] = createStore(
  (draft: { cssText: string }) => {
    draft.cssText = `${settings.theme}@${settings.fontSize}px`;
  },
  { cssText: "" },
);
flush();
assertEqual(css.cssText, "light@14px", "writable derived store computes from upstream on creation");
setSettings((draft) => {
  draft.theme = "dark";
});
flush();
assertEqual(css.cssText, "dark@14px", "derived store recomputes when upstream state changes");
setCss((draft) => {
  draft.cssText = "manual-override";
});
flush();
assertEqual(css.cssText, "manual-override", "derived store stays writable through its own setter");
setSettings((draft) => {
  draft.fontSize = 16;
});
flush();
assertEqual(css.cssText, "dark@16px", "upstream writes overwrite manual overrides on the next recompute");

// --- 8. O(1) selection projection (replaces v1 createSelector) -----------------
// The projection owns one marker per selected id; each row reads only its own
// marker, so selection changes touch exactly the old and new rows.
const [selectedId, setSelectedId] = createSignal<string | undefined>(undefined);
const selected = createProjection<Record<string, boolean>>((draft) => {
  for (const key of Object.keys(draft)) delete draft[key];
  const id = selectedId();
  if (id !== undefined) draft[`row:${id}`] = true;
}, {});
flush();
const isSelected = (id: string): boolean => selected[`row:${id}`] === true;
check(!isSelected("a"), "no row is selected initially");
setSelectedId("a");
flush();
check(isSelected("a"), "projection marks the selected row for O(1) lookup");
setSelectedId("b");
flush();
check(isSelected("b") && !isSelected("a"), "moving selection touches only the old and new markers");
assertDeepEqual({ ...snapshot(selected) }, { "row:b": true });

// --- 9. Live nested store views over normalized state ---------------------------
type Item = { id: string; label: string };
const [db, setDb] = createStore<{ items: Record<string, Item>; order: string[] }>({
  items: {
    a: { id: "a", label: "A" },
    b: { id: "b", label: "B" },
  },
  order: ["a", "b"],
});
// The derived view embeds inner store data without cloning it away, so the
// inner collection stays live: inner writes reach consumers of the view.
const view = createProjection<{ rows: Item[] }>((draft) => {
  draft.rows = db.order.map((id) => db.items[id] as Item);
}, { rows: [] as Item[] });
flush();
check(view.rows.length === 2, "projection builds a live view over normalized state");
assertEqual(view.rows[0]?.label, "A", "view resolves ids through the entity table");
setDb((draft) => {
  (draft.items["a"] as Item).label = "A2";
});
flush();
assertEqual(view.rows[0]?.label, "A2", "writes to normalized state flow through the live view");

console.log(`\nAll ${passed} checks passed.`);
