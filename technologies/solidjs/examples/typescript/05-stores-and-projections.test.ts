/**
 * Module 05 — Stores and projections (real solid-js rc.19).
 */
import { describe, it, expect } from "vitest";
import * as solid from "solid-js";
import {
  createSignal,
  createMemo,
  createEffect,
  createRoot,
  createStore,
  createProjection,
  reconcile,
  snapshot,
  deep,
  flush,
} from "solid-js";
import { storePath } from "@solidjs/signals";
import { captureDiagnostics } from "./support/diagnostics.ts";

type Todo = { id: number; text: string; done: boolean };

describe("05 · draft-first setters and property-level tracking", () => {
  it("mutate the draft; reads lag until the commit", () => {
    const [store, setStore] = createStore({ user: { name: "A" }, list: [] as string[] });
    setStore((s) => {
      s.user.name = "B";
      s.list.push("x");
    });
    expect(store.user.name).toBe("A");
    flush();
    expect(store.user.name).toBe("B");
    expect(store.list).toEqual(["x"]);
  });

  it("only computations that read the changed path re-run", () => {
    const { setStore, runs, dispose } = createRoot((dispose) => {
      const [store, setStore] = createStore({ a: { x: 1 }, b: { y: 1 } });
      const runs = { a: 0, b: 0 };
      createMemo(() => (runs.a++, store.a.x));
      createMemo(() => (runs.b++, store.b.y));
      return { setStore, runs, dispose };
    });
    setStore((s) => {
      s.a.x = 2;
    });
    flush();
    expect(runs).toEqual({ a: 2, b: 1 });
    dispose();
  });

  it("returning a value replaces shallowly: arrays by index+length, objects top-level", () => {
    const [store, setStore] = createStore({ list: ["a", "b", "c"], keep: { deep: 1 } });
    const keepRef = store.keep;
    setStore((s) => ({ ...s, list: s.list.filter((x) => x !== "b") }));
    flush();
    expect(store.list).toEqual(["a", "c"]);
    expect(store.keep).toBe(keepRef); // untouched branch keeps its proxy identity
  });

  it("delete removes a key (1.x set-undefined idiom)", () => {
    const [store, setStore] = createStore<{ nick?: string }>({ nick: "x" });
    setStore((s) => {
      delete s.nick;
    });
    flush();
    expect("nick" in store).toBe(false);
  });

  it("storePath is the optional 1.x-style helper, exported by @solidjs/signals (not re-exported by solid-js rc.19)", () => {
    expect("storePath" in solid).toBe(false);
    const [store, setStore] = createStore({ todos: [{ id: 1, done: false }, { id: 2, done: true }] });
    setStore(storePath("todos", (t: { done: boolean }) => !t.done, "done", true));
    flush();
    expect(store.todos.every((t) => t.done)).toBe(true);
  });
});

describe("05 · reconcile, snapshot, deep", () => {
  it("reconcile(data, 'id') preserves the identity of surviving rows that are observed", () => {
    const { store, setStore, row1, rowRuns, dispose } = createRoot((dispose) => {
      const [store, setStore] = createStore<{ todos: Todo[] }>({
        todos: [
          { id: 1, text: "a", done: false },
          { id: 2, text: "b", done: false },
        ],
      });
      // Observe row 1 the way a keyed <For> does: through a computation.
      const row1 = createMemo(() => store.todos.find((t) => t.id === 1));
      const rowRuns = { one: 0, two: 0 };
      createMemo(() => (rowRuns.one++, store.todos.find((t) => t.id === 1)!.text));
      createMemo(() => (rowRuns.two++, store.todos.find((t) => t.id === 2)!.done));
      return { store, setStore, row1, rowRuns, dispose };
    });
    const before = row1();
    const serverTodos: Todo[] = [
      { id: 2, text: "b", done: true },
      { id: 1, text: "a", done: false },
      { id: 3, text: "c", done: false },
    ];
    setStore((s) => {
      reconcile(serverTodos, "id")(s.todos);
    });
    flush();
    expect(store.todos.map((t) => t.id)).toEqual([2, 1, 3]);
    expect(row1()).toBe(before); // same row object → a keyed <For> keeps the row and its DOM
    expect(store.todos[0]!.done).toBe(true);
    expect(rowRuns.two).toBeGreaterThan(1); // the changed leaf notified
    dispose();
  });

  it("reconcile(data, null) merges positionally", () => {
    const [store, setStore] = createStore({ rows: [{ v: 1 }, { v: 2 }] });
    const slot0 = store.rows[0];
    setStore((s) => {
      reconcile([{ v: 9 }, { v: 2 }], null)(s.rows);
    });
    flush();
    expect(store.rows[0]).toBe(slot0);
    expect(store.rows[0]!.v).toBe(9);
  });

  it("snapshot is a plain, untracked copy", () => {
    const [store] = createStore({ user: { name: "A" } });
    const plain = snapshot(store);
    expect(JSON.parse(JSON.stringify(plain))).toEqual({ user: { name: "A" } });
    expect(plain).toEqual({ user: { name: "A" } });
  });

  it("deep() in an effect compute tracks every nested property and hands apply a plain object", () => {
    const seen: unknown[] = [];
    const { setStore, dispose } = createRoot((dispose) => {
      const [store, setStore] = createStore({ a: { b: { c: 1 } } });
      createEffect(
        () => deep(store),
        (plain) => {
          seen.push(JSON.parse(JSON.stringify(plain)));
        },
      );
      return { setStore, dispose };
    });
    flush();
    setStore((s) => {
      s.a.b.c = 2;
    });
    flush();
    expect(seen).toEqual([{ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }]);
    dispose();
  });
});

describe("05 · projections: derived stores", () => {
  it("selection projection: changing the selected id re-runs O(1) rows, not O(n)", () => {
    const N = 1000;
    const { setSelected, rowRuns, dispose } = createRoot((dispose) => {
      const [selectedId, setSelected] = createSignal(0);
      const selected = createProjection<Record<number, boolean>>(
        (draft) => {
          const id = selectedId();
          for (const k of Object.keys(draft)) if (Number(k) !== id) delete draft[Number(k)];
          draft[id] = true;
        },
        {},
      );
      let rowRuns = 0;
      for (let i = 0; i < N; i++) createMemo(() => (rowRuns++, selected[i] === true));
      return { setSelected, rowRuns: () => rowRuns, dispose };
    });
    expect(rowRuns()).toBe(N);
    setSelected(500);
    flush();
    expect(rowRuns() - N).toBe(2); // old row 0 and new row 500 only
    dispose();
  });

  it("a projection that returns data reconciles it by key (identity preserved)", () => {
    const { list, setServer, dispose } = createRoot((dispose) => {
      const [server, setServer] = createSignal<Todo[]>([{ id: 1, text: "a", done: false }]);
      const list = createProjection<Todo[]>(() => server().map((t) => ({ ...t })), [], { key: "id" });
      return { list, setServer, dispose };
    });
    const first = list[0];
    setServer([
      { id: 1, text: "a", done: true },
      { id: 2, text: "b", done: false },
    ]);
    flush();
    expect(list[0]).toBe(first); // same row object, updated field
    expect(list[0]!.done).toBe(true);
    expect(list.length).toBe(2);
    dispose();
  });

  it("createStore(fn, seed) is the writable derived store", () => {
    const { cache, setCache, setSrc, dispose } = createRoot((dispose) => {
      const [src, setSrc] = createSignal(2);
      const [cache, setCache] = createStore<{ value: number; override?: boolean }>(
        (draft) => {
          draft.value = src() * 10;
        },
        { value: 0 },
      );
      return { cache, setCache, setSrc, dispose };
    });
    expect(cache.value).toBe(20);
    setCache((s) => {
      s.override = true;
    });
    setSrc(3);
    flush();
    expect(cache).toEqual({ value: 30, override: true });
    dispose();
  });

  it("shallow stores: root keys reactive, records plain and replaced by reference", () => {
    const [rows, setRows] = createStore<Record<string, { n: number }>>({ a: { n: 1 } }, { shallow: true });
    const rec = rows.a!;
    expect(snapshot(rec)).toBe(rec); // a plain record, not a proxy
    setRows((s) => {
      s.a = { n: 2 }; // replace, never edit
    });
    flush();
    expect(rows.a!.n).toBe(2);
  });
});

describe("05 · negative tests", () => {
  it("writing through the store proxy outside the setter is ignored (STORE_WRITE_OUTSIDE_SETTER)", () => {
    const [store] = createStore({ n: 1 });
    const { codes } = captureDiagnostics(() => {
      (store as { n: number }).n = 2;
      flush();
    });
    expect(store.n).toBe(1);
    expect(codes).toContain("STORE_WRITE_OUTSIDE_SETTER");
  });

  it("an async setter callback is ASYNC_STORE_SETTER: writes after await would be lost", async () => {
    const [, setStore] = createStore({ n: 1 });
    expect(() =>
      setStore((async (s: { n: number }) => {
        s.n = 2;
        await Promise.resolve();
        s.n = 3;
      }) as unknown as (s: { n: number }) => void),
    ).toThrow(/ASYNC_STORE_SETTER/);
  });

  it("re-assigning a mutated object that the store already holds notifies nobody", () => {
    const shared = { label: "a" };
    const { label, runs, setStore, dispose } = createRoot((dispose) => {
      const [store, setStore] = createStore({ item: shared });
      let runs = 0;
      const label = createMemo(() => (runs++, store.item.label));
      return { label, runs: () => runs, setStore, dispose };
    });
    shared.label = "b"; // mutate the original after handing it over
    setStore((s) => {
      s.item = shared; // same reference: nothing to notify
    });
    flush();
    expect(label()).toBe("a"); // the subscriber never heard about "b"
    expect(runs()).toBe(1);
    setStore((s) => {
      s.item = { ...shared }; // a fresh object is diffed and picked up
    });
    flush();
    expect(label()).toBe("b");
    dispose();
  });
});
