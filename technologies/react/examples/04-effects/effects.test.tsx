// @vitest-environment jsdom
/**
 * Module 04 — Effects & synchronization. Real react-dom@19.3.1 in jsdom.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  StrictMode,
  act,
  useCallback,
  useEffect,
  useEffectEvent,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

let roots: Root[] = [];
function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(node));
  return { container, root, rerender: (n: ReactNode) => act(() => root.render(n)) };
}
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function makeLogger(log: string[]) {
  return function Logged({ name, children }: { name: string; children?: ReactNode }) {
    log.push(`render ${name}`);
    useInsertionEffect(() => {
      log.push(`insertion ${name}`);
      return () => void log.push(`insertion-cleanup ${name}`);
    }, []);
    useLayoutEffect(() => {
      log.push(`layout ${name}`);
      return () => void log.push(`layout-cleanup ${name}`);
    }, []);
    useEffect(() => {
      log.push(`passive ${name}`);
      return () => void log.push(`passive-cleanup ${name}`);
    }, []);
    return <div>{children}</div>;
  };
}

describe("effect phases and ordering", () => {
  test("render (parent→child) · insertion · layout (child→parent) · passive (child→parent)", () => {
    const log: string[] = [];
    const L = makeLogger(log);
    mount(
      <L name="parent">
        <L name="child" />
      </L>,
    );
    expect(log).toEqual([
      "render parent",
      "render child",
      "insertion child",
      "insertion parent",
      "layout child",
      "layout parent",
      "passive child",
      "passive parent",
    ]);
  });

  test("unmount runs cleanups: insertion & layout in the mutation phase, then passive", () => {
    const log: string[] = [];
    const L = makeLogger(log);
    const { rerender } = mount(
      <L name="parent">
        <L name="child" />
      </L>,
    );
    log.length = 0;
    rerender(null);
    expect(log).toEqual([
      "insertion-cleanup parent",
      "layout-cleanup parent",
      "insertion-cleanup child",
      "layout-cleanup child",
      "passive-cleanup parent",
      "passive-cleanup child",
    ]);
  });

  test("on dependency change: old cleanup runs before the new setup, with the OLD values", () => {
    const log: string[] = [];
    function Sub({ room }: { room: string }) {
      useEffect(() => {
        log.push(`connect ${room}`);
        return () => void log.push(`disconnect ${room}`);
      }, [room]);
      return null;
    }
    const { rerender } = mount(<Sub room="a" />);
    rerender(<Sub room="a" />); // same deps → nothing
    rerender(<Sub room="b" />);
    expect(log).toEqual(["connect a", "disconnect a", "connect b"]);
  });

  test("a layout effect sees committed DOM and its state update is applied before paint", () => {
    const seen: string[] = [];
    function Measure() {
      const ref = useRef<HTMLParagraphElement>(null);
      const [width, setWidth] = useState(-1);
      useLayoutEffect(() => {
        seen.push(ref.current!.textContent!);
        setWidth(ref.current!.textContent!.length); // re-render happens synchronously, before paint
      }, []);
      return <p ref={ref}>{width === -1 ? "measuring" : `w=${width}`}</p>;
    }
    const { container } = mount(<Measure />);
    expect(seen).toEqual(["measuring"]);
    expect(container.textContent).toBe("w=9");
  });

  test("passive effects are flushed before the next discrete update is processed", () => {
    const log: string[] = [];
    function C() {
      const [n, setN] = useState(0);
      useEffect(() => {
        log.push(`effect ${n}`);
      }, [n]);
      return <button onClick={() => (log.push(`click sees ${n}`), setN(n + 1))}>{n}</button>;
    }
    const { container } = mount(<C />);
    act(() => container.querySelector("button")!.click());
    act(() => container.querySelector("button")!.click());
    expect(log).toEqual(["effect 0", "click sees 0", "effect 1", "click sees 1", "effect 2"]);
  });
});

describe("Strict Mode re-runs setup → cleanup → setup in DEV", () => {
  test("on client mount", () => {
    const log: string[] = [];
    function Conn() {
      useEffect(() => {
        log.push("connect");
        return () => void log.push("disconnect");
      }, []);
      return null;
    }
    mount(
      <StrictMode>
        <Conn />
      </StrictMode>,
    );
    expect(log).toEqual(["connect", "disconnect", "connect"]);
  });

  test("on hydration too, since React 19.3", async () => {
    const log: string[] = [];
    function Conn() {
      useEffect(() => {
        log.push("connect");
        return () => void log.push("disconnect");
      }, []);
      return <p>ssr</p>;
    }
    const app = (
      <StrictMode>
        <Conn />
      </StrictMode>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
    await act(async () => {
      roots.push(hydrateRoot(container, app));
    });
    expect(log).toEqual(["connect", "disconnect", "connect"]);
  });

  test("NEGATIVE: a non-idempotent effect (no cleanup) leaks a duplicate subscription", () => {
    const listeners = new Set<() => void>();
    function Leaky() {
      useEffect(() => {
        const l = () => {};
        listeners.add(l); // no cleanup returned
      }, []);
      return null;
    }
    mount(
      <StrictMode>
        <Leaky />
      </StrictMode>,
    );
    expect(listeners.size).toBe(2); // Strict Mode surfaced the leak
  });
});

describe("ref callbacks and cleanup (React 19)", () => {
  test("a ref callback may return a cleanup, called instead of ref(null)", () => {
    const log: string[] = [];
    const refCb = (el: HTMLElement | null) => {
      log.push(el ? `attach ${el.tagName}` : "called with null");
      return () => void log.push("cleanup");
    };
    const { rerender } = mount(<b ref={refCb} />);
    rerender(null);
    expect(log).toEqual(["attach B", "cleanup"]);
  });

  test("without a cleanup, the legacy protocol calls ref(null) on detach", () => {
    const log: string[] = [];
    const refCb = (el: HTMLElement | null) => {
      log.push(el ? "attach" : "null");
    };
    const { rerender } = mount(<b ref={refCb} />);
    rerender(null);
    expect(log).toEqual(["attach", "null"]);
  });

  test("NEGATIVE: an inline ref callback is detached and re-attached on every render", () => {
    const log: string[] = [];
    function C({ n }: { n: number }) {
      return (
        <b
          ref={(el) => {
            log.push(`attach ${n}`);
            return () => void log.push(`detach ${n}`);
          }}
        />
      );
    }
    const { rerender } = mount(<C n={1} />);
    rerender(<C n={2} />);
    expect(log).toEqual(["attach 1", "detach 1", "attach 2"]);
  });

  test("a stable (useCallback) ref callback runs once", () => {
    const log: string[] = [];
    function C({ n }: { n: number }) {
      const ref = useCallback((_el: HTMLElement | null) => {
        log.push("attach");
        return () => void log.push("detach");
      }, []);
      return <b ref={ref}>{n}</b>;
    }
    const { rerender } = mount(<C n={1} />);
    rerender(<C n={2} />);
    expect(log).toEqual(["attach"]);
  });
});

describe("useEffectEvent (stable in 19.2)", () => {
  test("reads the latest props without re-running the effect", () => {
    const log: string[] = [];
    function Chat({ room, theme }: { room: string; theme: string }) {
      const onConnected = useEffectEvent(() => log.push(`connected to ${room} in ${theme}`));
      useEffect(() => {
        log.push(`connect ${room}`);
        const t = setTimeout(onConnected, 100);
        return () => {
          clearTimeout(t);
          log.push(`disconnect ${room}`);
        };
      }, [room]); // onConnected is NOT a dependency
      return null;
    }
    vi.useFakeTimers();
    const { rerender } = mount(<Chat room="general" theme="light" />);
    rerender(<Chat room="general" theme="dark" />); // theme change: no reconnect
    act(() => vi.advanceTimersByTime(100));
    expect(log).toEqual(["connect general", "connected to general in dark"]);
  });

  test("NEGATIVE: calling an effect event during render throws", () => {
    function Bad() {
      const ev = useEffectEvent(() => 1);
      ev();
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => mount(<Bad />)).toThrow(/can't be called during rendering/);
  });

  test("the stale-closure version it replaces: theme captured at connect time", () => {
    const log: string[] = [];
    function Chat({ room, theme }: { room: string; theme: string }) {
      useEffect(() => {
        const t = setTimeout(() => log.push(`connected in ${theme}`), 100);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately omitting theme
      }, [room]);
      return null;
    }
    vi.useFakeTimers();
    const { rerender } = mount(<Chat room="general" theme="light" />);
    rerender(<Chat room="general" theme="dark" />);
    act(() => vi.advanceTimersByTime(100));
    expect(log).toEqual(["connected in light"]); // stale
  });
});

describe("you might not need an effect", () => {
  test("NEGATIVE: deriving state in an effect costs an extra render and shows a stale frame", () => {
    const committed: string[] = [];
    function Full({ first, last }: { first: string; last: string }) {
      const [full, setFull] = useState("");
      useEffect(() => setFull(`${first} ${last}`), [first, last]);
      useLayoutEffect(() => {
        committed.push(full);
      });
      return <p>{full}</p>;
    }
    mount(<Full first="Ada" last="Lovelace" />);
    expect(committed).toEqual(["", "Ada Lovelace"]); // two commits; the first one was wrong
  });

  test("computing during render: one commit, always consistent", () => {
    const committed: string[] = [];
    function Full({ first, last }: { first: string; last: string }) {
      const full = `${first} ${last}`;
      useLayoutEffect(() => {
        committed.push(full);
      });
      return <p>{full}</p>;
    }
    mount(<Full first="Ada" last="Lovelace" />);
    expect(committed).toEqual(["Ada Lovelace"]);
  });

  test("adjusting state when a prop changes: setState during render beats an effect", () => {
    const commits: string[] = [];
    function Sel({ items }: { items: string[] }) {
      const [prev, setPrev] = useState(items);
      const [selected, setSelected] = useState<string | null>(items[0] ?? null);
      if (prev !== items) {
        setPrev(items); // React re-runs this component immediately, before children/commit
        setSelected(items[0] ?? null);
      }
      useLayoutEffect(() => {
        commits.push(String(selected));
      });
      return <p>{selected}</p>;
    }
    const { rerender } = mount(<Sel items={["a"]} />);
    rerender(<Sel items={["b"]} />);
    expect(commits).toEqual(["a", "b"]); // no intermediate commit showing the stale "a"
  });
});

describe("fetching in effects: races", () => {
  function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  }

  function makeProfile(guarded: boolean, requests: Map<string, ReturnType<typeof deferred<string>>>) {
    return function Profile({ id }: { id: string }) {
      const [name, setName] = useState("…");
      useEffect(() => {
        let ignore = false;
        const d = deferred<string>();
        requests.set(id, d);
        d.promise.then((n) => {
          if (!guarded || !ignore) setName(n);
        });
        return () => {
          ignore = true;
        };
      }, [id]);
      return <p>{name}</p>;
    };
  }

  test("NEGATIVE: without a guard, a slow earlier response overwrites the newer one", async () => {
    const requests = new Map<string, ReturnType<typeof deferred<string>>>();
    const Profile = makeProfile(false, requests);
    const { container, rerender } = mount(<Profile id="1" />);
    rerender(<Profile id="2" />);
    await act(async () => requests.get("2")!.resolve("Bob"));
    await act(async () => requests.get("1")!.resolve("Alice")); // arrives late
    expect(container.textContent).toBe("Alice"); // wrong: id is 2
  });

  test("the cleanup flag discards responses for a superseded request", async () => {
    const requests = new Map<string, ReturnType<typeof deferred<string>>>();
    const Profile = makeProfile(true, requests);
    const { container, rerender } = mount(<Profile id="1" />);
    rerender(<Profile id="2" />);
    await act(async () => requests.get("2")!.resolve("Bob"));
    await act(async () => requests.get("1")!.resolve("Alice"));
    expect(container.textContent).toBe("Bob");
  });

  test("AbortController in cleanup cancels the superseded request", async () => {
    const aborted: string[] = [];
    function Profile({ id }: { id: string }) {
      useEffect(() => {
        const ac = new AbortController();
        ac.signal.addEventListener("abort", () => aborted.push(id));
        return () => ac.abort();
      }, [id]);
      return null;
    }
    const { rerender } = mount(<Profile id="1" />);
    rerender(<Profile id="2" />);
    expect(aborted).toEqual(["1"]);
  });
});

describe("effects on the server", () => {
  test("no effect runs during SSR, and React 19 no longer warns about useLayoutEffect there", () => {
    const ran: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function C() {
      useLayoutEffect(() => void ran.push("layout"));
      useEffect(() => void ran.push("passive"));
      return <p>x</p>;
    }
    expect(renderToString(<C />)).toBe("<p>x</p>");
    expect(ran).toEqual([]);
    expect(spy).not.toHaveBeenCalled(); // React ≤18 printed "useLayoutEffect does nothing on the server"
  });
});
