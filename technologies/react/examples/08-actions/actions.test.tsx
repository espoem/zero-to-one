// @vitest-environment jsdom
/**
 * Module 08 — Actions, forms & optimistic UI. react-dom@19.3.1 in jsdom.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { Component, act, startTransition, useActionState, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { requestFormReset, useFormStatus } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

let roots: Root[] = [];
async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
  return { container, root };
}
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
function gate() {
  let open!: () => void;
  let fail!: (e: unknown) => void;
  const promise = new Promise<void>((r, j) => ((open = r), (fail = j)));
  return { promise, open, fail };
}
const $ = <T extends Element>(c: Element, sel: string) => c.querySelector(sel) as T;

describe("<form action={fn}>", () => {
  test("the action receives FormData; useFormStatus reports pending; the form resets after success", async () => {
    const log: string[] = [];
    const g = gate();
    function Status() {
      const { pending, data } = useFormStatus(); // must be rendered INSIDE the form
      log.push(`pending=${pending} q=${data?.get("q") ?? ""}`);
      return null;
    }
    function Search() {
      return (
        <form
          onReset={() => log.push("onReset")}
          action={async (fd: FormData) => {
            log.push(`action q=${fd.get("q")}`);
            await g.promise;
          }}
        >
          <input name="q" defaultValue="initial" />
          <Status />
          <button>go</button>
        </form>
      );
    }
    const { container } = await mount(<Search />);
    $<HTMLInputElement>(container, "input").value = "typed";
    await act(async () => $<HTMLButtonElement>(container, "button").click());
    expect(log).toEqual(["pending=false q=", "action q=typed", "pending=true q=typed"]);
    await act(async () => g.open());
    // Uncontrolled fields are reset to defaultValue after the action; 19.3 fires onReset.
    expect(log.slice(-2)).toEqual(["pending=false q=", "onReset"]);
    expect($<HTMLInputElement>(container, "input").value).toBe("initial");
  });

  test("NEGATIVE: useFormStatus outside the <form> never sees the submission", async () => {
    const seen: boolean[] = [];
    const g = gate();
    function Outside() {
      seen.push(useFormStatus().pending);
      return null;
    }
    const { container } = await mount(
      <>
        <Outside />
        <form action={() => g.promise}>
          <button>go</button>
        </form>
      </>,
    );
    await act(async () => $<HTMLButtonElement>(container, "button").click());
    await act(async () => g.open());
    expect(seen.every((p) => p === false)).toBe(true);
  });

  test("requestFormReset resets a form from inside a transition", async () => {
    let form!: HTMLFormElement;
    const { container } = await mount(
      <form ref={(f) => void (form = f!)}>
        <input name="x" defaultValue="d" />
      </form>,
    );
    $<HTMLInputElement>(container, "input").value = "changed";
    await act(async () => startTransition(() => requestFormReset(form)));
    expect($<HTMLInputElement>(container, "input").value).toBe("d");
  });

  test("SSR: function actions render a throwing javascript: placeholder plus a replay script", () => {
    const html = renderToString(
      <form action={async () => {}}>
        <button formAction={async () => {}}>save</button>
      </form>,
    );
    expect(html).toContain(`action="javascript:throw new Error(&#x27;React form unexpectedly submitted.&#x27;)"`);
    // Submissions that happen before hydration are queued and replayed afterwards.
    expect(html).toContain("$$reactFormReplay");
  });
});

describe("useActionState", () => {
  test("[state, dispatch, isPending]; calls are queued and each receives the previous result", async () => {
    const calls: string[] = [];
    const gates: Array<ReturnType<typeof gate>> = [];
    let dispatch!: (p: string) => void;
    function Log() {
      const [state, d, isPending] = useActionState(async (prev: string, item: string) => {
        calls.push(`prev="${prev}" item=${item}`);
        const g = gate();
        gates.push(g);
        await g.promise;
        return prev + item;
      }, "");
      dispatch = d;
      return (
        <p>
          {state}|{String(isPending)}
        </p>
      );
    }
    const { container } = await mount(<Log />);
    await act(async () =>
      startTransition(() => {
        dispatch("a");
        dispatch("b");
      }),
    );
    expect(container.textContent).toBe("|true");
    expect(calls).toEqual(['prev="" item=a']); // b waits for a: actions are sequential
    await act(async () => gates[0]!.open());
    expect(calls).toEqual(['prev="" item=a', 'prev="a" item=b']);
    await act(async () => gates[1]!.open());
    expect(container.textContent).toBe("ab|false");
  });

  test("NEGATIVE: dispatching outside a transition or action prop warns (isPending is wrong)", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    let dispatch!: () => void;
    function C() {
      const [, d] = useActionState(async () => 1, 0);
      dispatch = d;
      return null;
    }
    await mount(<C />);
    await act(async () => dispatch());
    expect(errors.join("\n")).toMatch(/called outside of a transition/);
  });

  test("as a form action: the first argument is the previous state, the second FormData", async () => {
    function Signup() {
      const [msg, formAction] = useActionState(async (_prev: string, fd: FormData) => {
        const email = String(fd.get("email"));
        return email.includes("@") ? `welcome ${email}` : "invalid email";
      }, "");
      return (
        <form action={formAction}>
          <input name="email" defaultValue="nobody" />
          <button>sign up</button>
          <output>{msg}</output>
        </form>
      );
    }
    const { container } = await mount(<Signup />);
    await act(async () => $<HTMLButtonElement>(container, "button").click());
    expect($<HTMLOutputElement>(container, "output").textContent).toBe("invalid email");
    $<HTMLInputElement>(container, "input").value = "ada@example.com";
    await act(async () => $<HTMLButtonElement>(container, "button").click());
    expect($<HTMLOutputElement>(container, "output").textContent).toBe("welcome ada@example.com");
  });
});

describe("useOptimistic", () => {
  function makeTodos(save: (t: string) => Promise<void>) {
    let add!: (t: string) => void;
    function Todos() {
      const [todos, setTodos] = useState<string[]>(["a"]);
      const [optimistic, addOptimistic] = useOptimistic(todos, (cur: string[], t: string) => [...cur, `${t} (saving)`]);
      add = (t) =>
        startTransition(async () => {
          addOptimistic(t);
          try {
            await save(t);
            startTransition(() => setTodos((cur) => [...cur, t]));
          } catch {
            /* the optimistic entry disappears when the transition ends */
          }
        });
      return <ul>{optimistic.map((t) => <li key={t}>{t}</li>)}</ul>;
    }
    return { Todos, add: (t: string) => add(t) };
  }

  test("shows the optimistic value immediately, then the real state when the action settles", async () => {
    const g = gate();
    const { Todos, add } = makeTodos(() => g.promise);
    const { container } = await mount(<Todos />);
    await act(async () => add("b"));
    expect(container.textContent).toBe("ab (saving)");
    await act(async () => g.open());
    expect(container.textContent).toBe("ab");
  });

  test("on failure the optimistic entry is rolled back automatically", async () => {
    const g = gate();
    const { Todos, add } = makeTodos(() => g.promise);
    const { container } = await mount(<Todos />);
    await act(async () => add("b"));
    await act(async () => g.fail(new Error("500")));
    expect(container.textContent).toBe("a");
  });

  test("NEGATIVE: setting optimistic state outside a transition/action is reverted at once and warns", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    let bad!: () => void;
    function C() {
      const [v, setV] = useOptimistic("real");
      bad = () => setV("optimistic");
      return <p>{v}</p>;
    }
    const { container } = await mount(<C />);
    await act(async () => bad());
    expect(container.textContent).toBe("real");
    expect(errors.join("\n")).toMatch(/optimistic state update occurred outside a transition or action/);
  });
});

describe("ordering and races", () => {
  test("NEGATIVE: independent async handlers resolve out of order and the stale response wins", async () => {
    const gates = new Map<string, ReturnType<typeof gate>>();
    let search!: (q: string) => void;
    function Search() {
      const [result, setResult] = useState("");
      search = async (q) => {
        const g = gate();
        gates.set(q, g);
        await g.promise;
        setResult(`results for ${q}`);
      };
      return <p>{result}</p>;
    }
    const { container } = await mount(<Search />);
    await act(async () => {
      search("re");
      search("react");
    });
    await act(async () => gates.get("react")!.open());
    await act(async () => gates.get("re")!.open()); // slow, older request finishes last
    expect(container.textContent).toBe("results for re");
  });

  test("a sequence number (or AbortController) discards superseded responses", async () => {
    const gates = new Map<string, ReturnType<typeof gate>>();
    let search!: (q: string) => void;
    function Search() {
      const [result, setResult] = useState("");
      const [seq] = useState({ current: 0 });
      search = async (q) => {
        const mine = ++seq.current;
        const g = gate();
        gates.set(q, g);
        await g.promise;
        if (mine === seq.current) setResult(`results for ${q}`);
      };
      return <p>{result}</p>;
    }
    const { container } = await mount(<Search />);
    await act(async () => {
      search("re");
      search("react");
    });
    await act(async () => gates.get("react")!.open());
    await act(async () => gates.get("re")!.open());
    expect(container.textContent).toBe("results for react");
  });

  test("useTransition with an async function keeps isPending true across the await", async () => {
    const g = gate();
    let run!: () => void;
    function Save() {
      const [isPending, start] = useTransition();
      const [saved, setSaved] = useState(false);
      run = () =>
        start(async () => {
          await g.promise;
          startTransition(() => setSaved(true)); // updates after await need their own wrapper
        });
      return <p>{isPending ? "saving" : saved ? "saved" : "idle"}</p>;
    }
    const { container } = await mount(<Save />);
    await act(async () => run());
    expect(container.textContent).toBe("saving");
    await act(async () => g.open());
    expect(container.textContent).toBe("saved");
  });
});

describe("errors in actions", () => {
  test("an action that throws inside useActionState is rethrown during render, to the error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
      override state = { error: null as string | null };
      static getDerivedStateFromError(e: Error) {
        return { error: e.message };
      }
      override render() {
        return this.state.error ? <b>caught: {this.state.error}</b> : this.props.children;
      }
    }
    let dispatch!: () => void;
    function C() {
      const [, d] = useActionState(async () => {
        throw new Error("save failed");
      }, null);
      dispatch = d;
      return <i>form</i>;
    }
    const { container } = await mount(
      <Boundary>
        <C />
      </Boundary>,
    );
    await act(async () => startTransition(() => dispatch()));
    await act(async () => new Promise((r) => setTimeout(r, 10)));
    expect(container.textContent).toBe("caught: save failed");
  });
});
