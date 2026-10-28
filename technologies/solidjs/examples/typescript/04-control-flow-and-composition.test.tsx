/**
 * Module 04 — Control flow and composition (real runtime, jsdom).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  createSignal,
  createMemo,
  createRoot,
  createContext,
  useContext,
  children,
  flush,
  mapArray,
  resetErrorHalt,
  For,
  Repeat,
  Show,
  Switch,
  Match,
  type Accessor,
  type ParentComponent,
} from "solid-js";
import { Portal, dynamic, Dynamic } from "@solidjs/web";
import { ContextNotFoundError } from "@solidjs/signals"; // the class is exported by the core package
import { render, cleanup } from "@solidjs/testing-library";
import { captureDiagnostics } from "./support/diagnostics.ts";

afterEach(() => {
  cleanup();
  resetErrorHalt();
});

type Todo = { id: number; text: string };

describe("04 · <For>: three keying modes, three callback shapes", () => {
  it("default (keyed by identity): raw item, index accessor; rows move with their item", () => {
    const a = { id: 1, text: "a" };
    const b = { id: 2, text: "b" };
    const [list, setList] = createSignal<Todo[]>([a, b]);
    let created = 0;
    const { container } = render(() => (
      <ul>
        <For each={list()}>
          {(todo, i) => {
            created++;
            return (
              <li>
                {i()}:{todo.text}
              </li>
            );
          }}
        </For>
      </ul>
    ));
    const firstLi = container.querySelector("li");
    setList([b, a]); // reorder: same objects
    flush();
    expect(container.textContent).toBe("0:b1:a");
    expect(created).toBe(2); // no row re-created
    expect(container.querySelectorAll("li")[1]).toBe(firstLi); // the DOM node moved with `a`
    setList([b, { id: 1, text: "a" }]); // equal data, NEW identity
    flush();
    expect(created).toBe(3); // identity changed → row re-created
  });

  it("keyed={false}: item accessor, plain numeric index; rows stay in place", () => {
    const [list, setList] = createSignal(["x", "y"]);
    let created = 0;
    const { container } = render(() => (
      <ul>
        <For each={list()} keyed={false}>
          {(item, i) => {
            created++;
            return (
              <li>
                {i}:{item()}
              </li>
            );
          }}
        </For>
      </ul>
    ));
    setList(["y", "x"]);
    flush();
    expect(container.textContent).toBe("0:y1:x");
    expect(created).toBe(2); // slots reused, item accessors updated
  });

  it("keyed={fn}: custom key, both arguments are accessors", () => {
    const [list, setList] = createSignal<Todo[]>([{ id: 1, text: "a" }]);
    let created = 0;
    const { container } = render(() => (
      <ul>
        <For each={list()} keyed={(t) => t.id}>
          {(todo) => {
            created++;
            return <li>{todo().text}</li>;
          }}
        </For>
      </ul>
    ));
    setList([{ id: 1, text: "a2" }]); // new object, same key
    flush();
    expect(container.textContent).toBe("a2");
    expect(created).toBe(1); // row kept, accessor updated
  });

  it("fallback renders for an empty list", () => {
    const [list, setList] = createSignal<string[]>([]);
    const { container } = render(() => (
      <For each={list()} fallback={<p>empty</p>}>
        {(s) => <span>{s}</span>}
      </For>
    ));
    expect(container.textContent).toBe("empty");
    setList(["a"]);
    flush();
    expect(container.textContent).toBe("a");
  });

  it("negative: the callback body is an owner, not a tracking scope (frozen read + STRICT_READ_UNTRACKED)", () => {
    const [list, setList] = createSignal(["a"]);
    const { codes } = captureDiagnostics(() => {
      const { container } = render(() => (
        <ul>
          <For each={list()} keyed={false}>
            {(item) => {
              const frozen = item(); // ❌ top-of-callback read
              return (
                <li>
                  {frozen}|{item()}
                </li>
              );
            }}
          </For>
        </ul>
      ));
      setList(["b"]);
      flush();
      expect(container.textContent).toBe("a|b");
    });
    expect(codes).toContain("STRICT_READ_UNTRACKED");
  });

  it("mapArray is the primitive under <For> (for custom list primitives)", () => {
    const { mapped, setList, dispose } = createRoot((dispose) => {
      const [list, setList] = createSignal([1, 2]);
      const mapped = mapArray(list, (n) => n * 10);
      return { mapped, setList, dispose };
    });
    expect(mapped()).toEqual([10, 20]);
    setList([2, 3]);
    flush();
    expect(mapped()).toEqual([20, 30]);
    dispose();
  });
});

describe("04 · <Repeat>: ranges without diffing", () => {
  it("children receive a plain number; count/from window the range", () => {
    const [count, setCount] = createSignal(3);
    const [from, setFrom] = createSignal(0);
    const { container } = render(() => (
      <Repeat count={count()} from={from()} fallback={<i>none</i>}>
        {(i) => <b>{i}</b>}
      </Repeat>
    ));
    expect(container.textContent).toBe("012");
    setFrom(5);
    flush();
    expect(container.textContent).toBe("567");
    setCount(0);
    flush();
    expect(container.textContent).toBe("none");
  });
});

describe("04 · <Show>, <Switch>/<Match>", () => {
  it("non-keyed function child gets a narrowed accessor; the subtree is kept while truthy", () => {
    const [user, setUser] = createSignal<{ name: string } | null>({ name: "Ada" });
    let mounts = 0;
    const { container } = render(() => (
      <Show when={user()} fallback={<p>login</p>}>
        {(u: Accessor<{ name: string }>) => {
          mounts++;
          return <p>{u().name}</p>;
        }}
      </Show>
    ));
    setUser({ name: "Grace" }); // still truthy: same subtree, accessor updates
    flush();
    expect(container.textContent).toBe("Grace");
    expect(mounts).toBe(1);
    setUser(null);
    flush();
    expect(container.textContent).toBe("login");
  });

  it("keyed: identity is the switching condition and the child gets the raw value", () => {
    const [user, setUser] = createSignal<{ name: string } | null>({ name: "Ada" });
    let mounts = 0;
    const { container } = render(() => (
      <Show when={user()} keyed>
        {(u: { name: string }) => {
          mounts++;
          return <p>{u.name}</p>;
        }}
      </Show>
    ));
    setUser({ name: "Grace" });
    flush();
    expect(container.textContent).toBe("Grace");
    expect(mounts).toBe(2); // new identity → remount
  });

  it("Switch renders the first matching Match", () => {
    const [route, setRoute] = createSignal("home");
    const { container } = render(() => (
      <Switch fallback={<p>404</p>}>
        <Match when={route() === "home"}>
          <p>home</p>
        </Match>
        <Match when={route().startsWith("p")}>
          <p>profile-ish</p>
        </Match>
        <Match when={route() === "profile"}>
          <p>never reached</p>
        </Match>
      </Switch>
    ));
    setRoute("profile");
    flush();
    expect(container.textContent).toBe("profile-ish");
    setRoute("zzz");
    flush();
    expect(container.textContent).toBe("404");
  });
});

describe("04 · dynamic components", () => {
  const Viewer = (p: { value: string }) => <span>view:{p.value}</span>;
  const Editor = (p: { value: string }) => <input value={p.value} />;

  it("dynamic() returns a stable component whose identity follows a reactive source", () => {
    const [editing, setEditing] = createSignal(false);
    const [value, setValue] = createSignal("x");
    function Field() {
      const Active = dynamic(() => (editing() ? Editor : Viewer));
      return <Active value={value()} />;
    }
    const { container } = render(() => <Field />);
    expect(container.textContent).toBe("view:x");
    setEditing(true);
    flush();
    expect(container.querySelector("input")!.value).toBe("x");
    setValue("y");
    flush();
    expect(container.querySelector("input")!.value).toBe("y");
  });

  it("a tag name works as a source", () => {
    const [multi, setMulti] = createSignal(false);
    function Box() {
      const Tag = dynamic(() => (multi() ? "textarea" : "input"));
      return <Tag />;
    }
    const { container } = render(() => <Box />);
    expect(container.firstElementChild!.tagName).toBe("INPUT");
    setMulti(true);
    flush();
    expect(container.firstElementChild!.tagName).toBe("TEXTAREA");
  });

  it("<Dynamic component> still works but is the deprecated wrapper form", () => {
    const { container } = render(() => <Dynamic component={Viewer} value="z" />);
    expect(container.textContent).toBe("view:z");
  });
});

describe("04 · children(), Portal", () => {
  it("children() resolves children once and exposes toArray()", () => {
    let created = 0;
    const Item = () => {
      created++;
      return <li>item</li>;
    };
    const List: ParentComponent = (props) => {
      const resolved = children(() => props.children);
      const count = createMemo(() => resolved.toArray().length);
      return (
        <ul data-count={count()}>
          {resolved()}
          {resolved()}
        </ul>
      );
    };
    const { container } = render(() => (
      <List>
        <Item />
        <Item />
      </List>
    ));
    expect(container.querySelector("ul")!.dataset.count).toBe("2");
    expect(created).toBe(2); // resolved once even though read twice
  });

  it("Portal mounts outside the root (and its handlers still work)", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    let clicks = 0;
    const { container } = render(() => (
      <section>
        <Portal mount={target}>
          <button onClick={() => clicks++}>in portal</button>
        </Portal>
      </section>
    ));
    expect(container.textContent).toBe("");
    target.querySelector("button")!.click();
    expect(clicks).toBe(1);
    target.remove();
  });
});

describe("04 · context", () => {
  it("the context object is the provider; default-less form throws without one", () => {
    const Todos = createContext<{ count: number }>();
    function Reader() {
      const ctx = useContext(Todos);
      return <p>{ctx.count}</p>;
    }
    const { container } = render(() => (
      <Todos value={{ count: 3 }}>
        <Reader />
      </Todos>
    ));
    expect(container.textContent).toBe("3");
    cleanup();
    expect(() => render(() => <Reader />)).toThrow(ContextNotFoundError);
  });

  it("undefined means 'not provided'; use null for an optional context", () => {
    const Maybe = createContext<string | undefined>(undefined);
    function ReadMaybe() {
      const v = useContext(Maybe); // throws during the component body
      return <p>{v}</p>;
    }
    let thrown: unknown;
    try {
      render(() => (
        <Maybe value={undefined}>
          <ReadMaybe />
        </Maybe>
      ));
    } catch (e) {
      thrown = e;
    }
    // Under a Provider the throw surfaces wrapped (the provider renders children in a
    // computation); the original ContextNotFoundError is the cause.
    const cause = thrown instanceof ContextNotFoundError ? thrown : (thrown as { cause?: unknown }).cause;
    expect(cause).toBeInstanceOf(ContextNotFoundError);
    expect(String((cause as Error).message)).toMatch(/counts as not provided/);
    cleanup();
    const Session = createContext<{ user: string } | null>(null);
    function Who() {
      const s = useContext(Session);
      return <p>{s ? s.user : "anonymous"}</p>;
    }
    const { container } = render(() => <Who />);
    expect(container.textContent).toBe("anonymous");
  });

  it("default form: useContext falls back to the default outside a provider", () => {
    const Theme = createContext<"light" | "dark">("light");
    function Page() {
      return <p>{useContext(Theme)}</p>;
    }
    const { container } = render(() => (
      <div>
        <Page />
        <Theme value="dark">
          <Page />
        </Theme>
      </div>
    ));
    expect(container.textContent).toBe("lightdark");
  });
});
