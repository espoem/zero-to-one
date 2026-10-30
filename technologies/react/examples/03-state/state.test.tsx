// @vitest-environment jsdom
/**
 * Module 03 — State, hooks & closures. Real react-dom@19.3.1 in jsdom.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  StrictMode,
  act,
  createContext,
  startTransition,
  use,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fiberOf } from "../_shared/internals.ts";
import { fetchMachine, type FetchState } from "./fetch-machine.ts";

let roots: Root[] = [];
function mount(node: ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(node));
  return { container, root, rerender: (n: ReactNode) => act(() => root.render(n)) };
}
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const silenceErrors = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("hooks are a linked list on the fiber, matched by call order", () => {
  test("memoizedState is a chain with one node per hook call, in call order", () => {
    function Three() {
      const [a] = useState("first");
      const r = useRef(42);
      const [b] = useState("third");
      return <p>{a + r.current + b}</p>;
    }
    const { container } = mount(<Three />);
    const fn = fiberOf(container.querySelector("p")!).return!; // the Three fiber
    type Hook = { memoizedState: unknown; next: Hook | null };
    const states: unknown[] = [];
    for (let h = fn.memoizedState as Hook | null; h; h = h.next) states.push(h.memoizedState);
    expect(states).toEqual(["first", { current: 42 }, "third"]);
  });

  test("NEGATIVE: a conditional hook changes the list length → React throws", () => {
    function Conditional({ extra }: { extra: boolean }) {
      const [a] = useState(1);
      if (extra) {
        // Deliberate rules-of-hooks violation.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useState(2);
      }
      return <p>{a}</p>;
    }
    silenceErrors();
    const { rerender } = mount(<Conditional extra={false} />);
    expect(() => rerender(<Conditional extra />)).toThrow(/Rendered more hooks than during the previous render/);
  });

  test("NEGATIVE: hooks skipped by an early return → 'Rendered fewer hooks than expected'", () => {
    function Early({ bail }: { bail: boolean }) {
      const [a] = useState(1);
      if (bail) return null;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [b] = useState(2);
      return <p>{a + b}</p>;
    }
    silenceErrors();
    const { rerender } = mount(<Early bail={false} />);
    expect(() => rerender(<Early bail />)).toThrow(/Rendered fewer hooks than expected/);
  });

  test("NEGATIVE: swapping hook kinds at the same index warns about hook order", () => {
    function Swap({ flip }: { flip: boolean }) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      if (flip) useRef(0);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      else useState(0);
      return null;
    }
    const spy = silenceErrors();
    const { rerender } = mount(<Swap flip={false} />);
    try {
      rerender(<Swap flip />);
    } catch {
      /* may also throw depending on hook kinds */
    }
    expect(spy.mock.calls.flat().join(" ")).toMatch(/change in the order of Hooks/);
  });
});

describe("state updates are queued, not assigned", () => {
  test("three setN(n + 1) calls in one handler increment by one (same closure value)", () => {
    function C() {
      const [n, setN] = useState(0);
      return (
        <button
          onClick={() => {
            setN(n + 1);
            setN(n + 1);
            setN(n + 1);
          }}
        >
          {n}
        </button>
      );
    }
    const { container } = mount(<C />);
    act(() => container.querySelector("button")!.click());
    expect(container.textContent).toBe("1");
  });

  test("functional updaters compose: three setN(x => x + 1) increment by three", () => {
    function C() {
      const [n, setN] = useState(0);
      return (
        <button
          onClick={() => {
            setN((x) => x + 1);
            setN((x) => x + 1);
            setN((x) => x + 1);
          }}
        >
          {n}
        </button>
      );
    }
    const { container } = mount(<C />);
    act(() => container.querySelector("button")!.click());
    expect(container.textContent).toBe("3");
  });

  test("reading state right after setState still gives the old value (snapshot semantics)", () => {
    let seen: number | undefined;
    function C() {
      const [n, setN] = useState(0);
      return (
        <button
          onClick={() => {
            setN(5);
            seen = n;
          }}
        >
          {n}
        </button>
      );
    }
    const { container } = mount(<C />);
    act(() => container.querySelector("button")!.click());
    expect(seen).toBe(0);
    expect(container.textContent).toBe("5");
  });

  test("automatic batching outside act(): two updates in a timeout render once", async () => {
    // act() batches everything by itself, so this test leaves act's world and lets the
    // real scheduler run, to observe production-like batching.
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    g.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const renders = vi.fn();
      let setBoth!: () => void;
      function C() {
        const [a, setA] = useState(0);
        const [b, setB] = useState(0);
        renders();
        setBoth = () => {
          setA(1);
          setB(1);
        };
        return <p>{a + b}</p>;
      }
      const container = document.createElement("div");
      const root = createRoot(container);
      root.render(<C />);
      await new Promise((r) => setTimeout(r, 20));
      expect(renders).toHaveBeenCalledTimes(1);
      setTimeout(setBoth, 0); // outside any React event handler
      await new Promise((r) => setTimeout(r, 20));
      expect(container.textContent).toBe("2");
      expect(renders).toHaveBeenCalledTimes(2); // one render for both updates (React ≤17: two)
      root.unmount();
    } finally {
      g.IS_REACT_ACT_ENVIRONMENT = true;
    }
  });

  test("flushSync opts out of batching and commits immediately", () => {
    const renders = vi.fn();
    let fire!: () => void;
    let domAfterFirst = "";
    function C() {
      const [n, setN] = useState(0);
      renders();
      fire = () => {
        flushSync(() => setN(1));
        domAfterFirst = document.getElementById("v")!.textContent!;
        flushSync(() => setN(2));
      };
      return <p id="v">{n}</p>;
    }
    const { container } = mount(<C />);
    document.body.append(container);
    act(() => fire());
    expect(domAfterFirst).toBe("1");
    expect(renders).toHaveBeenCalledTimes(3);
    container.remove();
  });

  test("Object.is bailout: setting the same value does not re-render children", () => {
    const childRenders = vi.fn();
    function Child() {
      childRenders();
      return null;
    }
    let set!: (v: number) => void;
    function P() {
      const [n, setN] = useState(NaN);
      set = setN;
      return (
        <>
          {String(n)}
          <Child />
        </>
      );
    }
    mount(<P />);
    act(() => set(NaN)); // Object.is(NaN, NaN) === true
    expect(childRenders).toHaveBeenCalledTimes(1);
  });

  test("NEGATIVE: mutating a state object and setting the same reference is ignored", () => {
    let push!: () => void;
    function List() {
      const [items, setItems] = useState<string[]>(["a"]);
      push = () => {
        items.push("b"); // mutation
        setItems(items); // same reference → bail out
      };
      return <p>{items.join(",")}</p>;
    }
    const { container } = mount(<List />);
    act(() => push());
    expect(container.textContent).toBe("a");
  });

  test("lazy initialiser runs once; an eager initial expression runs every render", () => {
    const lazy = vi.fn(() => 1);
    const eager = vi.fn(() => 1);
    let bump!: () => void;
    function C() {
      const [a] = useState(lazy);
      const [b] = useState(eager());
      const [, setT] = useState(0);
      bump = () => setT((t) => t + 1);
      return <p>{a + b}</p>;
    }
    mount(<C />);
    act(() => bump());
    act(() => bump());
    expect(lazy).toHaveBeenCalledTimes(1);
    expect(eager).toHaveBeenCalledTimes(3);
  });

  test("useRef changes do not re-render", () => {
    const renders = vi.fn();
    let r!: { current: number };
    function C() {
      r = useRef(0);
      renders();
      return <p>{r.current}</p>;
    }
    const { container } = mount(<C />);
    r.current = 99;
    expect(renders).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("0");
  });
});

describe("stale closures", () => {
  function useTicker(useUpdater: boolean) {
    const [n, setN] = useState(0);
    useEffect(() => {
      const id = setInterval(() => {
        if (useUpdater) setN((x) => x + 1);
        else setN(n + 1); // captures n from the first render forever
      }, 100);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately empty to show the bug
    }, []);
    return n;
  }

  test("NEGATIVE: interval + [] deps + setN(n + 1) is stuck at 1", () => {
    vi.useFakeTimers();
    function T() {
      return <p>{useTicker(false)}</p>;
    }
    const { container } = mount(<T />);
    act(() => vi.advanceTimersByTime(500));
    expect(container.textContent).toBe("1");
  });

  test("fix: the functional updater does not need the closure value", () => {
    vi.useFakeTimers();
    function T() {
      return <p>{useTicker(true)}</p>;
    }
    const { container } = mount(<T />);
    act(() => vi.advanceTimersByTime(500));
    expect(container.textContent).toBe("5");
  });

  test("an async handler sees the props/state of the render that created it", async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => (resolve = r));
    let alerted = "";
    function Chat({ to }: { to: string }) {
      return (
        <button
          onClick={async () => {
            await gate;
            alerted = to;
          }}
        >
          send
        </button>
      );
    }
    const { container, rerender } = mount(<Chat to="alice" />);
    act(() => container.querySelector("button")!.click());
    rerender(<Chat to="bob" />);
    await act(async () => resolve());
    expect(alerted).toBe("alice"); // the click belonged to the "alice" render
  });
});

describe("useReducer as an explicit state machine", () => {
  test("legal transitions advance; illegal events are ignored (same state reference)", () => {
    let s: FetchState = { status: "idle" };
    s = fetchMachine(s, { type: "FETCH" });
    expect(s).toEqual({ status: "loading" });
    s = fetchMachine(s, { type: "RESOLVE", data: ["x"] });
    expect(s).toEqual({ status: "success", data: ["x"] });
    const before = s;
    expect(fetchMachine(before, { type: "RESOLVE", data: ["y"] })).toBe(before);
    expect(fetchMachine({ status: "idle" }, { type: "REJECT", error: "e" })).toEqual({ status: "idle" });
  });

  test("dispatch is stable across renders and StrictMode double-invokes the reducer", () => {
    const reducerCalls = vi.fn();
    const dispatches = new Set<unknown>();
    function M() {
      const [state, dispatch] = useReducer((s: FetchState, e: Parameters<typeof fetchMachine>[1]) => {
        reducerCalls();
        return fetchMachine(s, e);
      }, { status: "idle" } as FetchState);
      dispatches.add(dispatch);
      return <button onClick={() => dispatch({ type: "FETCH" })}>{state.status}</button>;
    }
    const { container } = mount(
      <StrictMode>
        <M />
      </StrictMode>,
    );
    act(() => container.querySelector("button")!.click());
    expect(container.textContent).toBe("loading");
    expect(dispatches.size).toBe(1);
    expect(reducerCalls).toHaveBeenCalledTimes(2); // StrictMode: reducers must be pure
  });
});

describe("external stores: useSyncExternalStore and tearing", () => {
  function makeStore(initial: number) {
    let value = initial;
    const listeners = new Set<() => void>();
    return {
      get: () => value,
      set(v: number) {
        value = v;
        listeners.forEach((l) => l());
      },
      subscribe(l: () => void) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
  }

  /**
   * Three readers render inside one transition. Reader 0 mutates the store mid-render —
   * a deterministic stand-in for "the store changed while React yielded between components".
   */
  function runTearingScenario(useUSES: boolean): string {
    const store = makeStore(0);
    let mutateOnce = false;
    let bump!: () => void;
    function Reader({ id }: { id: number }) {
      const v = useUSES ? useSyncExternalStore(store.subscribe, store.get) : store.get();
      if (id === 0 && mutateOnce) {
        mutateOnce = false;
        store.set(store.get() + 1);
      }
      return <span>{v}</span>;
    }
    function App() {
      const [, setT] = useState(0);
      bump = () => setT((t) => t + 1);
      return (
        <>
          {[0, 1, 2].map((i) => (
            <Reader key={i} id={i} />
          ))}
        </>
      );
    }
    silenceErrors();
    const { container } = mount(<App />);
    mutateOnce = true;
    act(() => startTransition(() => bump()));
    return container.textContent!;
  }

  test("NEGATIVE: reading a mutable store directly tears (UI shows two versions at once)", () => {
    expect(runTearingScenario(false)).toBe("011");
  });

  test("useSyncExternalStore detects the inconsistency and re-renders synchronously", () => {
    expect(runTearingScenario(true)).toBe("111");
  });

  test("NEGATIVE: getSnapshot returning a fresh object each call is an infinite loop", () => {
    const store = makeStore(1);
    function Bad() {
      const snap = useSyncExternalStore(store.subscribe, () => ({ v: store.get() }));
      return <p>{snap.v}</p>;
    }
    silenceErrors();
    expect(() => mount(<Bad />)).toThrow(/Maximum update depth exceeded/);
  });

  test("getServerSnapshot is used for SSR and is required there", () => {
    const store = makeStore(7);
    function WithServer() {
      return <p>{useSyncExternalStore(store.subscribe, store.get, () => -1)}</p>;
    }
    function WithoutServer() {
      return <p>{useSyncExternalStore(store.subscribe, store.get)}</p>;
    }
    expect(renderToString(<WithServer />)).toBe("<p>-1</p>");
    silenceErrors();
    expect(() => renderToString(<WithoutServer />)).toThrow(/Missing getServerSnapshot/);
  });
});

describe("context", () => {
  const Theme = createContext("light");

  test("<Context value> is the provider in React 19 and use(Context) may be conditional", () => {
    function Label({ show }: { show: boolean }) {
      if (!show) return <i>hidden</i>;
      const theme = use(Theme); // allowed after an early return, unlike useContext
      return <b>{theme}</b>;
    }
    const { container } = mount(
      <Theme value="dark">
        <Label show />
        <Label show={false} />
      </Theme>,
    );
    expect(container.innerHTML).toBe("<b>dark</b><i>hidden</i>");
  });

  test("a consumer without a provider reads the default value", () => {
    function L() {
      return <b>{use(Theme)}</b>;
    }
    expect(mount(<L />).container.textContent).toBe("light");
  });

  test("custom hooks share logic, not state", () => {
    function useCounter() {
      const [n, setN] = useState(0);
      return [n, () => setN((x) => x + 1)] as const;
    }
    function A() {
      const [n, inc] = useCounter();
      return <button onClick={inc}>a{n}</button>;
    }
    function B() {
      const [n] = useCounter();
      return <span>b{n}</span>;
    }
    const { container } = mount(
      <>
        <A />
        <B />
      </>,
    );
    act(() => container.querySelector("button")!.click());
    expect(container.textContent).toBe("a1b0");
  });
});
