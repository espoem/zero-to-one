/**
 * Module 06 — Colorless async: async computations, Loading, isPending/latest,
 * cancellation, errors, streams. Deterministic: every promise is a hand-settled deferred.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  createSignal,
  createMemo,
  createRoot,
  createDeferred,
  flush,
  isPending,
  latest,
  refresh,
  affects,
  resolve,
  from,
  onCleanup,
  untrack,
  resetErrorHalt,
  NotReadyError,
  Loading,
  Errored,
  Reveal,
} from "solid-js";
import { render, cleanup } from "@solidjs/testing-library";
import { captureDiagnosticsAsync, deferred, settle } from "./support/diagnostics.ts";

afterEach(() => {
  cleanup();
  resetErrorHalt();
});

/** A fake API whose calls are settled by the test. */
function fakeApi<T>() {
  const calls: Array<{ arg: unknown; d: ReturnType<typeof deferred<T>>; signal?: AbortSignal }> = [];
  return {
    calls,
    fetch(arg: unknown, signal?: AbortSignal): Promise<T> {
      const d = deferred<T>();
      calls.push({ arg, d, ...(signal ? { signal } : {}) });
      return d.promise;
    },
    async resolveLast(value: T) {
      calls.at(-1)!.d.resolve(value);
      await settle();
      flush();
    },
  };
}

describe("06 · async computations", () => {
  it("an async memo is just a memo returning a Promise; resolve() awaits its settled value", async () => {
    const api = fakeApi<string>();
    const { user, dispose } = createRoot((dispose) => {
      const [id] = createSignal(1);
      const user = createMemo(() => api.fetch(id()));
      return { user, dispose };
    });
    const p = resolve(() => user());
    await api.resolveLast("Ada");
    await expect(p).resolves.toBe("Ada");
    expect(user()).toBe("Ada");
    dispose();
  });

  it("reading a pending async value outside any tracking scope throws NotReadyError", () => {
    const api = fakeApi<string>();
    const { user, dispose } = createRoot((dispose) => {
      const user = createMemo(() => api.fetch(1));
      return { user, dispose };
    });
    expect(() => untrack(user)).toThrow(NotReadyError);
    dispose();
  });

  it("dependencies read after the first await are not tracked (UNTRACKED_READ_AFTER_AWAIT)", async () => {
    const gate = deferred<void>();
    const { codes } = await captureDiagnosticsAsync(async () => {
      const { setQ, dispose, runs } = createRoot((dispose) => {
        const [q, setQ] = createSignal("a");
        let runs = 0;
        createMemo(async () => {
          runs++;
          await gate.promise;
          return q(); // ❌ read after await
        });
        return { setQ, dispose, runs: () => runs };
      });
      gate.resolve();
      await settle();
      flush();
      setQ("b");
      flush();
      await settle();
      expect(runs()).toBe(1); // never re-ran
      dispose();
    });
    expect(codes).toContain("UNTRACKED_READ_AFTER_AWAIT");
  });

  it("an AsyncIterable streams values into the memo", async () => {
    const steps = [deferred<void>(), deferred<void>()];
    async function* ticks() {
      yield 1;
      await steps[0]!.promise;
      yield 2;
      await steps[1]!.promise;
      yield 3;
    }
    const { price, dispose } = createRoot((dispose) => ({ price: createMemo(() => ticks()), dispose }));
    await settle();
    flush();
    expect(price()).toBe(1);
    steps[0]!.resolve();
    await settle();
    flush();
    expect(price()).toBe(2);
    steps[1]!.resolve();
    await settle();
    flush();
    expect(price()).toBe(3);
    dispose();
  });

  it("from() adapts a push subscription; re-runs and disposal unsubscribe", async () => {
    const listeners = new Set<(v: number) => void>();
    const subscribe = (next: (v: number) => void) => {
      listeners.add(next);
      return () => listeners.delete(next);
    };
    const { value, dispose } = createRoot((dispose) => ({
      value: createMemo(() => from<number>((next) => subscribe(next))),
      dispose,
    }));
    for (const l of listeners) l(42);
    await settle();
    flush();
    expect(value()).toBe(42);
    expect(listeners.size).toBe(1);
    dispose();
    expect(listeners.size).toBe(0);
  });

  it("throwing NotReadyError yourself marks a value 'not ready' through the graph", async () => {
    const { derived, setSrc, dispose } = createRoot((dispose) => {
      const [src, setSrc] = createSignal<string | null>(null);
      const derived = createMemo(() => {
        const v = src();
        if (v === null) throw new NotReadyError("waiting for src");
        return v.toUpperCase();
      });
      return { derived, setSrc, dispose };
    });
    expect(() => untrack(derived)).toThrow(NotReadyError);
    setSrc("ok");
    flush();
    expect(derived()).toBe("OK");
    dispose();
  });
});

describe("06 · <Loading> and pending state", () => {
  it("shows the fallback until the first value, then keeps stale content during revalidation", async () => {
    const api = fakeApi<string>();
    const [id, setId] = createSignal(1);
    const user = createRoot(() => createMemo(() => api.fetch(id())));
    const { container } = render(() => (
      <Loading fallback={<p>loading</p>}>
        <p>
          {user()}
          {isPending(() => user()) ? " (updating)" : ""}
        </p>
      </Loading>
    ));
    expect(container.textContent).toBe("loading");
    await api.resolveLast("Ada");
    expect(container.textContent).toBe("Ada");
    setId(2); // input changed: a value change is in flight
    flush();
    await settle();
    flush();
    expect(container.textContent).toBe("Ada (updating)"); // stale content + pending, no fallback
    await api.resolveLast("Grace");
    expect(container.textContent).toBe("Grace");
  });

  it("a bare refresh() is quiet; affects(x) + refresh(x) reads as pending", async () => {
    const api = fakeApi<number>();
    const user = createRoot(() => createMemo(() => api.fetch("u")));
    const { container } = render(() => (
      <Loading fallback={<p>loading</p>}>
        <p>{isPending(() => user()) ? "pending" : `v${user()}`}</p>
      </Loading>
    ));
    await api.resolveLast(1);
    expect(container.textContent).toBe("v1");
    refresh(user);
    flush();
    await settle();
    flush();
    expect(api.calls.length).toBe(2); // re-asked
    expect(container.textContent).toBe("v1"); // …silently
    await api.resolveLast(2);
    expect(container.textContent).toBe("v2");
    affects(user);
    refresh(user);
    flush();
    await settle();
    flush();
    expect(container.textContent).toBe("pending");
    await api.resolveLast(3);
    expect(container.textContent).toBe("v3");
  });

  it("latest(id) peeks at the in-flight input while the frame is held", async () => {
    const api = fakeApi<string>();
    const [id, setId] = createSignal(1);
    const user = createRoot(() => createMemo(() => api.fetch(id())));
    const { container } = render(() => (
      <Loading fallback={<p>loading</p>}>
        <p>
          {user()} / committed {id()} / latest {latest(id)}
        </p>
      </Loading>
    ));
    await api.resolveLast("A");
    setId(2);
    flush();
    await settle();
    flush();
    expect(container.textContent).toBe("A / committed 1 / latest 2");
    await api.resolveLast("B");
    expect(container.textContent).toBe("B / committed 2 / latest 2");
  });

  it("<Loading on={id()}> shows the fallback again when the dependency changes", async () => {
    const api = fakeApi<string>();
    const [id, setId] = createSignal(1);
    const comments = createRoot(() => createMemo(() => api.fetch(id())));
    const { container } = render(() => (
      <Loading on={id()} fallback={<p>spinner</p>}>
        <p>{comments()}</p>
      </Loading>
    ));
    await api.resolveLast("c1");
    expect(container.textContent).toBe("c1");
    setId(2);
    flush();
    await settle();
    flush();
    expect(container.textContent).toBe("spinner");
    await api.resolveLast("c2");
    expect(container.textContent).toBe("c2");
  });

  it("negative: the same data read outside a <Loading on> boundary holds the frame (LOADING_ON_OUTSIDE_HOLD)", async () => {
    const api = fakeApi<string>();
    const [id, setId] = createSignal(1);
    const comments = createRoot(() => createMemo(() => api.fetch(id())));
    const { codes } = await captureDiagnosticsAsync(async () => {
      const { container } = render(() => (
        <div>
          <Loading fallback={<i>outer</i>}>
            <header>{comments().length}</header>
          </Loading>
          <Loading on={id()} fallback={<p>spinner</p>}>
            <p>{comments()}</p>
          </Loading>
        </div>
      ));
      await api.resolveLast("c1");
      setId(2);
      flush();
      await settle();
      flush();
      expect(container.textContent).not.toContain("spinner"); // the fallback can never be seen
      await api.resolveLast("c22");
      expect(container.textContent).toBe("3c22");
    });
    expect(codes).toContain("LOADING_ON_OUTSIDE_HOLD");
  });

  it("createDeferred lags but never leads: the last value stays while the refetch runs", async () => {
    const api = fakeApi<string>();
    const [period, setPeriod] = createSignal("day");
    const rows = createRoot(() => createDeferred(() => api.fetch(period())));
    const { container } = render(() => (
      <Loading fallback={<p>loading</p>}>
        <p>
          {rows()}
          {isPending(() => rows()) ? "*" : ""}
        </p>
      </Loading>
    ));
    await api.resolveLast("day-rows");
    setPeriod("week");
    flush();
    await settle();
    flush();
    expect(container.textContent).toBe("day-rows*");
    await api.resolveLast("week-rows");
    expect(container.textContent).toBe("week-rows");
  });

  it("loadingValue: a declared first paint (no fallback, isPending false during the first flight)", async () => {
    const api = fakeApi<{ items: string[]; provisional?: boolean }>();
    const feed = createRoot(() =>
      createMemo(() => api.fetch("feed"), { loadingValue: { items: ["…"], provisional: true } }),
    );
    const { container } = render(() => (
      <Loading fallback={<p>never shown</p>}>
        <p>
          {feed().items.join(",")}
          {feed().provisional ? " (provisional)" : ""}
          {isPending(() => feed()) ? " pending" : ""}
        </p>
      </Loading>
    ));
    expect(container.textContent).toBe("… (provisional)");
    await api.resolveLast({ items: ["a", "b"] });
    expect(container.textContent).toBe("a,b");
  });
});

describe("06 · cancellation", () => {
  it("onCleanup registered before the first await aborts the superseded flight", async () => {
    const api = fakeApi<string>();
    const [q, setQ] = createSignal("a");
    const results = createRoot(() =>
      createMemo(async () => {
        const ac = new AbortController();
        onCleanup(() => ac.abort()); // ✅ before the first await
        const query = q();
        return api.fetch(query, ac.signal);
      }),
    );
    render(() => (
      <Loading fallback="…">
        <p>{results()}</p>
      </Loading>
    ));
    flush();
    setQ("ab");
    flush();
    await settle();
    flush();
    expect(api.calls[0]!.signal!.aborted).toBe(true); // first request cancelled
    expect(api.calls[1]!.signal!.aborted).toBe(false);
  });

  it("negative: cleanup registered after the first await never cancels the superseded flight", async () => {
    const api = fakeApi<string>();
    const [q, setQ] = createSignal("a");
    const signals: AbortSignal[] = [];
    const results = createRoot(() =>
      createMemo(async () => {
        const query = q();
        await Promise.resolve(); // owner is gone after this point
        const ac = new AbortController();
        signals.push(ac.signal);
        try {
          onCleanup(() => ac.abort()); // ❌ no owner here: NO_OWNER_CLEANUP, never runs
        } catch {
          /* ignore */
        }
        return api.fetch(query, ac.signal);
      }),
    );
    render(() => (
      <Loading fallback="…">
        <p>{results()}</p>
      </Loading>
    ));
    flush();
    await settle();
    setQ("ab");
    flush();
    await settle();
    flush();
    expect(signals.length).toBe(2);
    expect(signals[0]!.aborted).toBe(false); // the stale request runs to completion
  });
});

describe("06 · errors", () => {
  it("<Errored> catches an async rejection; reset() retries and the boundary heals", async () => {
    const api = fakeApi<string>();
    const data = createRoot(() => createMemo(() => api.fetch("x")));
    const { container } = render(() => (
      <Errored
        fallback={(err, reset) => (
          <button onClick={() => reset()}>failed: {String((err() as Error).message)}</button>
        )}
      >
        <Loading fallback={<p>loading</p>}>
          <p>{data()}</p>
        </Loading>
      </Errored>
    ));
    api.calls[0]!.d.reject(new Error("503"));
    await settle();
    flush();
    expect(container.textContent).toBe("failed: 503");
    container.querySelector("button")!.click();
    flush();
    await settle();
    flush();
    expect(api.calls.length).toBe(2); // the errored branch re-asked
    await api.resolveLast("ok");
    expect(container.textContent).toBe("ok");
  });

  it("a later success heals the boundary without reset (input changed)", async () => {
    const api = fakeApi<string>();
    const [id, setId] = createSignal(1);
    const data = createRoot(() => createMemo(() => api.fetch(id())));
    const { container } = render(() => (
      <Errored fallback={(err) => <p>error</p>}>
        <Loading fallback={<p>loading</p>}>
          <p>{data()}</p>
        </Loading>
      </Errored>
    ));
    api.calls[0]!.d.reject(new Error("boom"));
    await settle();
    flush();
    expect(container.textContent).toBe("error");
    setId(2);
    flush();
    await settle();
    flush();
    await api.resolveLast("recovered");
    expect(container.textContent).toBe("recovered");
  });
});

describe("06 · <Reveal>", () => {
  it("sequential (default): a later boundary waits for the earlier one", async () => {
    const a = fakeApi<string>();
    const b = fakeApi<string>();
    const A = createRoot(() => createMemo(() => a.fetch("a")));
    const B = createRoot(() => createMemo(() => b.fetch("b")));
    const { container } = render(() => (
      <Reveal>
        <Loading fallback={<i>a…</i>}>
          <b>{A()}</b>
        </Loading>
        <Loading fallback={<i>b…</i>}>
          <b>{B()}</b>
        </Loading>
      </Reveal>
    ));
    await b.resolveLast("B"); // second resolves first
    expect(container.textContent).toBe("a…b…"); // held behind the frontier
    await a.resolveLast("A");
    expect(container.textContent).toBe("AB");
  });

  it("together: nothing reveals until every boundary is ready", async () => {
    const a = fakeApi<string>();
    const b = fakeApi<string>();
    const A = createRoot(() => createMemo(() => a.fetch("a")));
    const B = createRoot(() => createMemo(() => b.fetch("b")));
    const { container } = render(() => (
      <Reveal order="together">
        <Loading fallback={<i>a…</i>}>
          <b>{A()}</b>
        </Loading>
        <Loading fallback={<i>b…</i>}>
          <b>{B()}</b>
        </Loading>
      </Reveal>
    ));
    await a.resolveLast("A");
    expect(container.textContent).toBe("a…b…");
    await b.resolveLast("B");
    expect(container.textContent).toBe("AB");
  });
});
