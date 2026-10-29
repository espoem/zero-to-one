/**
 * Module 07 — Actions, transactions and optimistic state (real solid-js rc.19).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  action,
  affects,
  createMemo,
  createOptimistic,
  createOptimisticStore,
  createRoot,
  createSignal,
  createStore,
  flush,
  isPending,
  refresh,
  resetErrorHalt,
  until,
  TimeoutError,
  createEffect,
  Loading,
} from "solid-js";
import { render, cleanup } from "@solidjs/testing-library";
import { captureDiagnostics, deferred, settle } from "./support/diagnostics.ts";

afterEach(() => {
  cleanup();
  resetErrorHalt();
});

type Todo = { id: number; text: string };

/** In-memory "server" whose calls the test settles by hand. */
function fakeServer(initial: Todo[]) {
  let rows = [...initial];
  const pending: Array<() => void> = [];
  return {
    list: async (): Promise<Todo[]> => rows.map((r) => ({ ...r })),
    add(todo: Todo): Promise<void> {
      const d = deferred<void>();
      pending.push(() => {
        rows = [...rows, todo];
        d.resolve();
      });
      return d.promise;
    },
    fail(): Promise<void> {
      const d = deferred<void>();
      pending.push(() => d.reject(new Error("500")));
      return d.promise;
    },
    async complete(i = 0) {
      pending.splice(i, 1)[0]!();
      await settle();
      flush();
      await settle();
      flush();
    },
    get pendingCount() {
      return pending.length;
    },
  };
}

describe("07 · optimistic store + action: the canonical mutation", () => {
  it("shows the optimistic row at once, then reconciles with the server truth", async () => {
    const server = fakeServer([{ id: 1, text: "a" }]);
    const { todos, addTodo } = createRoot(() => {
      const [todos, setTodos] = createOptimisticStore(() => server.list(), [] as Todo[]);
      const addTodo = action(function* (todo: Todo) {
        setTodos((s) => {
          s.push(todo);
        });
        yield server.add(todo);
        refresh(todos);
      });
      return { todos, addTodo };
    });
    const { container } = render(() => (
      <Loading fallback="…">
        <ul>{todos.map((t) => <li>{t.text}</li>)}</ul>
      </Loading>
    ));
    await settle();
    flush();
    expect(container.textContent).toBe("a");
    const done = addTodo({ id: 2, text: "b" });
    flush();
    expect(container.textContent).toBe("ab"); // optimistic, before the server answered
    await server.complete();
    await done;
    await settle();
    flush();
    expect(container.textContent).toBe("ab"); // now the server's row
  });

  it("a failed action reverts the optimistic write and rejects its promise", async () => {
    const server = fakeServer([{ id: 1, text: "a" }]);
    const { todos, addTodo } = createRoot(() => {
      const [todos, setTodos] = createOptimisticStore(() => server.list(), [] as Todo[]);
      const addTodo = action(function* (todo: Todo) {
        setTodos((s) => {
          s.push(todo);
        });
        yield server.fail();
        refresh(todos);
      });
      return { todos, addTodo };
    });
    const { container } = render(() => (
      <Loading fallback="…">
        <ul>{todos.map((t) => <li>{t.text}</li>)}</ul>
      </Loading>
    ));
    await settle();
    flush();
    const done = addTodo({ id: 2, text: "b" });
    flush();
    expect(container.textContent).toBe("ab");
    const outcome = done.then(
      () => "resolved",
      (e: Error) => `rejected ${e.message}`,
    );
    await server.complete();
    expect(await outcome).toBe("rejected 500");
    await settle();
    flush();
    expect(container.textContent).toBe("a"); // reverted
  });
});

describe("07 · concurrency", () => {
  it("overlapping actions resolving out of order converge on the server truth", async () => {
    const server = fakeServer([]);
    const { todos, addTodo } = createRoot(() => {
      const [todos, setTodos] = createOptimisticStore(() => server.list(), [] as Todo[]);
      const addTodo = action(function* (todo: Todo) {
        setTodos((s) => {
          s.push(todo);
        });
        yield server.add(todo);
        refresh(todos);
      });
      return { todos, addTodo };
    });
    const { container } = render(() => (
      <Loading fallback="…">
        <ul>{todos.map((t) => <li>{t.text}</li>)}</ul>
      </Loading>
    ));
    await settle();
    flush();
    const first = addTodo({ id: 1, text: "x" });
    const second = addTodo({ id: 2, text: "y" });
    flush();
    expect(container.textContent).toBe("xy"); // both guesses visible
    await server.complete(1); // the SECOND request finishes first
    expect(container.textContent).toBe("xy"); // first is still in flight: its guess stays
    await server.complete(0);
    await Promise.all([first, second]);
    await settle();
    flush();
    expect(container.textContent.split("").sort().join("")).toBe("xy"); // server truth, no duplicates
    expect(todos.length).toBe(2);
  });
});

describe("07 · optimistic signals and process flags", () => {
  it("createOptimistic: the guess shows during the action and reverts at settle", async () => {
    const gate = deferred<void>();
    const { saving, save } = createRoot(() => {
      const [saving, setSaving] = createOptimistic(false);
      const save = action(function* () {
        setSaving(true); // a co-written "saving…" flag
        yield gate.promise;
      });
      return { saving, save };
    });
    const { container } = render(() => <p>{saving() ? "saving…" : "idle"}</p>);
    const done = save();
    flush();
    expect(container.textContent).toBe("saving…");
    gate.resolve();
    await done;
    await settle();
    flush();
    expect(container.textContent).toBe("idle"); // reverted, no manual reset
  });

  it("outside an action (nothing held) an optimistic write is as if it never happened", async () => {
    const { name, setName } = createRoot(() => {
      const [name, setName] = createOptimistic("Alice");
      return { name, setName };
    });
    setName("Bob");
    flush();
    await settle();
    flush();
    expect(name()).toBe("Alice");
  });
});

describe("07 · affects: declare what in-flight work will change", () => {
  it("affects(x) makes x read as pending until the action settles", async () => {
    const gate = deferred<void>();
    let n = 0;
    const { user, reload } = createRoot(() => {
      const user = createMemo(async () => `v${++n}`);
      const reload = action(function* () {
        affects(user);
        refresh(user);
        yield gate.promise;
      });
      return { user, reload };
    });
    const { container } = render(() => (
      <Loading fallback="…">
        <p>
          {user()}
          {isPending(() => user()) ? " (pending)" : ""}
        </p>
      </Loading>
    ));
    await settle();
    flush();
    expect(container.textContent).toBe("v1");
    const done = reload();
    flush();
    await settle();
    flush();
    expect(container.textContent).toContain("(pending)");
    gate.resolve();
    await done;
    await settle();
    flush();
    expect(container.textContent).toBe("v2");
  });
});

describe("07 · until: acknowledgement from a live source", () => {
  it("resolves the first time the predicate settles truthy", async () => {
    const [messages, setMessages] = createSignal<string[]>([]);
    const p = until(() => messages().includes("ack-1"));
    setMessages(["other"]);
    flush();
    setMessages(["other", "ack-1"]);
    flush();
    await expect(p).resolves.toBe(true);
  });

  it("rejects with TimeoutError when the confirmation never arrives", async () => {
    const [ok] = createSignal(false);
    await expect(until(() => ok(), { timeout: 5 })).rejects.toBeInstanceOf(TimeoutError);
  });

  it("inside an action, your own optimistic override cannot satisfy your own ack", async () => {
    const gate = deferred<void>();
    const live = createRoot(() => {
      const [rows, setRows] = createStore<{ list: string[] }>({ list: [] }); // the live-fed truth
      const [view, setView] = createOptimisticStore(() => ({ list: [...rows.list] }), { list: [] as string[] });
      const send = action(function* (msg: string) {
        setView((s) => {
          s.list.push(msg); // optimistic
        });
        yield gate.promise; // transport ack only
        yield until(() => view.list.includes(msg), { timeout: 1000 });
      });
      return { rows, setRows, view, send };
    });
    render(() => (
      <Loading fallback="…">
        <p>{live.view.list.join(",")}</p>
      </Loading>
    ));
    await settle();
    flush();
    const done = live.send("hi");
    flush();
    expect(live.view.list).toEqual(["hi"]);
    gate.resolve();
    await settle();
    flush();
    let settled = false;
    void done.then(() => (settled = true));
    await settle();
    expect(settled).toBe(false); // still holding: the overlay alone doesn't count
    live.setRows((s) => {
      s.list.push("hi"); // the server echo arrives on the live channel
    });
    flush();
    await done; // released by the echo, not by the overlay
    await settle();
    flush();
    expect(live.view.list).toEqual(["hi"]); // the override dropped onto data that already has the real row
  });
});

describe("07 · invariants", () => {
  it("calling an action during render is ACTION_CALLED_IN_OWNED_SCOPE", () => {
    const save = action(function* () {
      yield Promise.resolve();
    });
    const { codes } = captureDiagnostics(() => {
      try {
        createRoot((dispose) => {
          try {
            void save().catch(() => {});
          } finally {
            dispose();
          }
        });
      } catch {
        /* dev throws */
      }
    });
    expect(codes).toContain("ACTION_CALLED_IN_OWNED_SCOPE");
  });
});

describe("07 · transaction internals", () => {
  it("plain (non-optimistic) writes inside an action are held until it settles, and read as pending", async () => {
    const gate = deferred<void>();
    const [page, setPage] = createSignal("a");
    const go = action(function* () {
      setPage("b"); // a normal write…
      yield gate.promise; // …inside an open transaction
    });
    const done = go();
    flush();
    await settle();
    flush();
    expect(page()).toBe("a"); // held: the committed value is unchanged
    expect(isPending(() => page())).toBe(true);
    gate.resolve();
    await done;
    await settle();
    flush();
    expect(page()).toBe("b"); // committed together with everything else in the transaction
  });

  it("writes on both sides of a yield commit together, at the end", async () => {
    const gate = deferred<void>();
    const [n, setN] = createSignal(0);
    const seen: number[] = [];
    createRoot(() =>
      createEffect(
        () => n(),
        (v) => {
          seen.push(v);
        },
      ),
    );
    flush();
    const run = action(function* () {
      setN(1);
      yield gate.promise;
      setN(2);
    });
    const done = run();
    flush();
    await settle();
    gate.resolve();
    await done;
    await settle();
    flush();
    expect(seen).toEqual([0, 2]); // the intermediate 1 was never shown
  });

  it("createOptimistic(fn): the guess shows, then the recomputed truth replaces it at commit", async () => {
    const gate = deferred<void>();
    const r = createRoot(() => {
      const [src, setSrc] = createSignal(1);
      const [total, setTotal] = createOptimistic(() => src() * 10);
      return { setSrc, total, setTotal };
    });
    const act = action(function* () {
      r.setTotal(99); // guess
      yield gate.promise;
      r.setSrc(5); // the real change
    });
    const done = act();
    flush();
    await settle();
    flush();
    expect(r.total()).toBe(99);
    gate.resolve();
    await done;
    await settle();
    flush();
    expect(r.total()).toBe(50);
  });

  it("negative: flush() inside an action throws FLUSH_IN_ACTION", async () => {
    let error: unknown;
    const act = action(function* () {
      try {
        flush();
      } catch (e) {
        error = e;
      }
      yield Promise.resolve();
    });
    await act();
    expect(String(error)).toMatch(/FLUSH_IN_ACTION/);
  });

  it("negative: action() needs a generator; a plain async function fails when called", async () => {
    const bad = action((async () => {}) as unknown as () => Generator<never, void, unknown>);
    await expect(Promise.resolve().then(() => bad())).rejects.toThrow(/next is not a function/);
  });

  it("affects(record, key) pends exactly one slot; siblings stay settled", async () => {
    const gate = deferred<void>();
    const { todo, rename } = createRoot(() => {
      const [todos] = createStore({ list: [{ id: 1, text: "a", updatedAt: 0 }] });
      const todo = todos.list[0]!;
      const rename = action(function* () {
        affects(todo, "updatedAt");
        yield gate.promise;
      });
      return { todo, rename };
    });
    const done = rename();
    flush();
    await settle();
    flush();
    expect(isPending(() => todo.updatedAt)).toBe(true);
    expect(isPending(() => todo.text)).toBe(false);
    gate.resolve();
    await done;
    await settle();
    flush();
    expect(isPending(() => todo.updatedAt)).toBe(false);
  });
});

